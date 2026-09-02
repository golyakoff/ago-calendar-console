import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarApiError, getWorkerSchedule, saveWorkerSchedule, type WorkerSchedule } from "../api/calendarApi.js";
import { useAuth } from "../auth/AuthContext.js";
import { errorMessage } from "../pages/errorMessage.js";
import { useStrings } from "../i18n/StringsContext.js";
import type { ConsoleStrings } from "../i18n/strings.js";

const DEFAULT_HORIZON_DAYS = 30;
const MAX_HORIZON_DAYS = 180;

/**
 * `20-14`: the schedule section of `20-13`'s worker card - rendered through that card's own
 * `children` slot, which was built ahead of this item precisely so this could land without touching
 * `WorkerCard.tsx`.
 *
 * <b>One form, whichever kind is active, and a create-or-replace save either way.</b> There is no
 * separate "add a schedule" flow: a worker with none yet sees this same form pre-filled with sensible
 * defaults (Weekly, today, `DEFAULT_HORIZON_DAYS`), and the first `PUT` creates the row the server was
 * missing - `SaveWorkerSchedule`'s own remarks call this an upsert for exactly this reason.
 *
 * <b>Switching kind is a warning, not a confirmation gate.</b> `20-14`'s own "Decided" section says
 * the console tells a human before saving that the other kind's parameters are cleared; it does not
 * say a second click is required, and this component takes it at its word - the aggregate's own save
 * refuses nothing destructive here (no already-materialised day is touched by this endpoint at all),
 * so the two-step confirmation `WorkersPage`'s own delete flow uses would be ceremony this action does
 * not need.
 */
export interface WorkerScheduleSectionProps {
  workerId: string;
}

type FormState = {
  kind: "Weekly" | "Cycle";
  slotMinutes: string;
  bufferMinutes: string;
  horizonDays: string;
  materializeFrom: string;
  cycleAnchor: string;
  cycleWorkingDays: string;
  cycleRestDays: string;
  cycleStartsAt: string;
  cycleEndsAt: string;
  buffersCountTowardServiceDuration: boolean;
};

/** `20-18`: the fixed illustrative service length the arithmetic note is worked through with - the
 * item's own 70-minute example, not any real service on this tenant's catalogue. The note exists so
 * a tenant sees the *consequence* of the toggle in their own worker's numbers, not so it prices a
 * particular service. */
const ARITHMETIC_EXAMPLE_MINUTES = 70;

/** The item's own worked arithmetic (`ConsecutiveRunFinder.ComputeSlotsNeeded`'s exact rule,
 * mirrored here for display only - the server's own copy is the one that ever decides anything). */
function slotsNeededFor(durationMinutes: number, slotMinutes: number, bufferMinutes: number, buffersCount: boolean): number {
  if (buffersCount) {
    return Math.ceil((durationMinutes + bufferMinutes) / (slotMinutes + bufferMinutes));
  }

  return Math.ceil(durationMinutes / slotMinutes);
}

function formatClock(totalMinutesFromMidnight: number): string {
  const hours = Math.floor(totalMinutesFromMidnight / 60) % 24;
  const minutes = totalMinutesFromMidnight % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Russian's three-way plural (1 / 2-4 / 5+), the same threshold the pre-`11-15` code already used
 * when this note was hardcoded Russian-only - `strings.ts`'s own remarks on `slotWordOne/Few/Many`
 * have the full reasoning for why English fills all three fields rather than the interface offering
 * only the two forms English happens to need. */
function slotWord(strings: ConsoleStrings, count: number): string {
  if (count === 1) {
    return strings.slotWordOne;
  }
  return count < 5 ? strings.slotWordFew : strings.slotWordMany;
}

function defaultForm(): FormState {
  return {
    kind: "Weekly",
    slotMinutes: "30",
    bufferMinutes: "0",
    horizonDays: String(DEFAULT_HORIZON_DAYS),
    materializeFrom: today(),
    cycleAnchor: today(),
    cycleWorkingDays: "2",
    cycleRestDays: "2",
    cycleStartsAt: "09:00",
    cycleEndsAt: "18:00",
    // Matches WorkerSchedule.BuffersCountTowardServiceDuration's own default - the author's own
    // stated default, "перерывы включаются в групповой слот".
    buffersCountTowardServiceDuration: true,
  };
}

function formFrom(schedule: WorkerSchedule): FormState {
  return {
    kind: schedule.kind,
    slotMinutes: String(schedule.slotMinutes),
    bufferMinutes: String(schedule.bufferMinutes),
    horizonDays: String(schedule.horizonDays),
    materializeFrom: schedule.materializeFrom,
    cycleAnchor: schedule.cycleAnchor ?? today(),
    cycleWorkingDays: schedule.cycleWorkingDays === null ? "2" : String(schedule.cycleWorkingDays),
    cycleRestDays: schedule.cycleRestDays === null ? "2" : String(schedule.cycleRestDays),
    cycleStartsAt: schedule.cycleStartsAt ?? "09:00",
    cycleEndsAt: schedule.cycleEndsAt ?? "18:00",
    buffersCountTowardServiceDuration: schedule.buffersCountTowardServiceDuration,
  };
}

export function WorkerScheduleSection({ workerId }: WorkerScheduleSectionProps) {
  const { accessToken } = useAuth();
  const strings = useStrings();
  const [existing, setExisting] = useState<WorkerSchedule | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (accessToken === null) {
        return;
      }

      setLoading(true);
      try {
        const schedule = await getWorkerSchedule(accessToken, workerId, signal);
        setExisting(schedule);
        setForm(formFrom(schedule));
        setError(null);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return;
        }

        if (reason instanceof CalendarApiError && reason.code === "configuration.no_schedule") {
          setExisting(null);
          setForm(defaultForm());
          setError(null);
        } else {
          setError(errorMessage(reason, strings));
        }
      } finally {
        setLoading(false);
      }
    },
    [workerId, accessToken, strings],
  );

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (accessToken === null) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const saved = await saveWorkerSchedule(accessToken, workerId, {
        kind: form.kind,
        cycleAnchor: form.kind === "Cycle" ? form.cycleAnchor : null,
        cycleWorkingDays: form.kind === "Cycle" ? Number(form.cycleWorkingDays) : null,
        cycleRestDays: form.kind === "Cycle" ? Number(form.cycleRestDays) : null,
        cycleStartsAt: form.kind === "Cycle" ? form.cycleStartsAt : null,
        cycleEndsAt: form.kind === "Cycle" ? form.cycleEndsAt : null,
        slotMinutes: Number(form.slotMinutes),
        bufferMinutes: Number(form.bufferMinutes),
        horizonDays: Number(form.horizonDays),
        materializeFrom: form.materializeFrom,
        buffersCountTowardServiceDuration: form.buffersCountTowardServiceDuration,
      });
      setExisting(saved);
      setForm(formFrom(saved));
    } catch (reason) {
      setError(errorMessage(reason, strings));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="worker-schedule">
        <h3>{strings.scheduleSectionTitle}</h3>
        <p className="muted">{strings.loading}</p>
      </section>
    );
  }

  // Only the Cycle -> Weekly direction actually clears anything: the cycle fields live on this
  // aggregate and are nulled out by ReconfigureWeekly, while the weekly kind has no fields of its
  // own here at all - its hours are the separate WorkingHoursRule rows this save never touches. So
  // Weekly -> Cycle loses nothing and gets no warning.
  const switchingAwayFromCycle = existing !== null && existing.kind === "Cycle" && form.kind === "Weekly";

  return (
    <section className="worker-schedule">
      <h3>{strings.scheduleSectionTitle}</h3>
      {existing === null && <p className="muted">{strings.scheduleEmptyNote}</p>}
      {error !== null && <p className="error">{error}</p>}

      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="schedule-kind">{strings.templateFieldLabel}</label>
        <select
          id="schedule-kind"
          value={form.kind}
          onChange={(event) => setForm({ ...form, kind: event.target.value as "Weekly" | "Cycle" })}
        >
          <option value="Weekly">{strings.weeklyTemplateOption}</option>
          <option value="Cycle">{strings.cycleTemplateOption}</option>
        </select>
        {switchingAwayFromCycle && <p className="muted">{strings.switchingToWeeklyNote}</p>}

        {form.kind === "Cycle" && (
          <>
            <label htmlFor="schedule-cycle-anchor">{strings.cycleAnchorFieldLabel}</label>
            <input
              id="schedule-cycle-anchor"
              type="date"
              value={form.cycleAnchor}
              onChange={(event) => setForm({ ...form, cycleAnchor: event.target.value })}
              required
            />

            <label htmlFor="schedule-cycle-working">{strings.cycleWorkingDaysFieldLabel}</label>
            <input
              id="schedule-cycle-working"
              type="number"
              min={1}
              value={form.cycleWorkingDays}
              onChange={(event) => setForm({ ...form, cycleWorkingDays: event.target.value })}
              required
            />

            <label htmlFor="schedule-cycle-rest">{strings.cycleRestDaysFieldLabel}</label>
            <input
              id="schedule-cycle-rest"
              type="number"
              min={0}
              value={form.cycleRestDays}
              onChange={(event) => setForm({ ...form, cycleRestDays: event.target.value })}
              required
            />
            <p className="muted">{strings.cycleShiftPatternNote}</p>

            <label htmlFor="schedule-cycle-starts">{strings.opensFieldLabel}</label>
            <input
              id="schedule-cycle-starts"
              type="time"
              value={form.cycleStartsAt}
              onChange={(event) => setForm({ ...form, cycleStartsAt: event.target.value })}
              required
            />

            <label htmlFor="schedule-cycle-ends">{strings.closesFieldLabel}</label>
            <input
              id="schedule-cycle-ends"
              type="time"
              value={form.cycleEndsAt}
              onChange={(event) => setForm({ ...form, cycleEndsAt: event.target.value })}
              required
            />
          </>
        )}

        {form.kind === "Weekly" && <p className="muted">{strings.weeklyHoursNote}</p>}

        <label htmlFor="schedule-slot">{strings.slotLengthFieldLabel}</label>
        <input
          id="schedule-slot"
          type="number"
          min={1}
          value={form.slotMinutes}
          onChange={(event) => setForm({ ...form, slotMinutes: event.target.value })}
          required
        />
        {/* `20-18`: `20-14`'s own interim rule - a longer service simply was not offered - is gone.
            A service longer than one slot is now several consecutive slots claimed as one booking. */}
        <p className="muted">{strings.slotLengthNote}</p>

        <label htmlFor="schedule-buffer">{strings.bufferFieldLabel}</label>
        <input
          id="schedule-buffer"
          type="number"
          min={0}
          value={form.bufferMinutes}
          onChange={(event) => setForm({ ...form, bufferMinutes: event.target.value })}
        />

        <label>
          <input
            type="checkbox"
            checked={form.buffersCountTowardServiceDuration}
            onChange={(event) => setForm({ ...form, buffersCountTowardServiceDuration: event.target.checked })}
          />{" "}
          {strings.bufferCountsTowardDurationLabel}
        </label>
        {(() => {
          const slotMinutes = Number(form.slotMinutes);
          const bufferMinutes = Number(form.bufferMinutes);
          if (!Number.isFinite(slotMinutes) || slotMinutes <= 0 || !Number.isFinite(bufferMinutes) || bufferMinutes < 0) {
            return null;
          }

          const slotsNeeded = slotsNeededFor(
            ARITHMETIC_EXAMPLE_MINUTES,
            slotMinutes,
            bufferMinutes,
            form.buffersCountTowardServiceDuration,
          );
          const spanMinutes = slotsNeeded * slotMinutes + (slotsNeeded - 1) * bufferMinutes;
          const exampleStart = 12 * 60; // 12:00, the item's own illustrative anchor.

          return (
            <p className="muted">
              {strings.arithmeticExamplePrefix}
              {ARITHMETIC_EXAMPLE_MINUTES}
              {strings.arithmeticExampleUnitSuffix}
              {slotsNeeded} {slotWord(strings, slotsNeeded)}, {formatClock(exampleStart)}–{formatClock(exampleStart + spanMinutes)}.
            </p>
          );
        })()}

        <label htmlFor="schedule-horizon">{strings.horizonFieldLabel}</label>
        <input
          id="schedule-horizon"
          type="number"
          min={0}
          value={form.horizonDays}
          onChange={(event) => setForm({ ...form, horizonDays: event.target.value })}
          required
        />
        {/* No client-side `max`: the cap is enforced server-side (WorkerSchedule.MaxHorizonDays), on
            purpose, so a direct API call cannot bypass it either - a browser-blocked submit with no
            visible reason would be worse UX than the server's own clear rejection below. */}
        <p className="muted">
          {strings.horizonCapPrefix}
          {MAX_HORIZON_DAYS}
          {strings.horizonCapSuffix}
        </p>

        <label htmlFor="schedule-materialize-from">
          {strings.materializeFromFieldLabel}
          {existing !== null && (
            <span className="muted">
              {strings.materializeFromCannotMoveEarlierPrefix}
              {existing.materializeFrom}
              {strings.materializeFromCannotMoveEarlierSuffix}
            </span>
          )}
        </label>
        <input
          id="schedule-materialize-from"
          type="date"
          min={existing?.materializeFrom}
          value={form.materializeFrom}
          onChange={(event) => setForm({ ...form, materializeFrom: event.target.value })}
          required
        />
        {/* `20-16`: this save can only move the cursor forward - see WorkerSchedule's own forward-only
            guard. Moving it back on purpose, to regenerate days already cut under a wrong template,
            is a separate, destructive screen with its own preview and confirmation. */}
        {existing !== null && (
          <p className="muted">
            {strings.scheduleRecutNotePrefix}
            <Link to={`/workers/${workerId}/recut`}>{strings.scheduleRecutLinkLabel}</Link>
            {strings.scheduleRecutNoteSuffix}
          </p>
        )}

        <div className="worker-schedule-actions">
          <button type="submit" disabled={busy}>
            {existing === null ? strings.createScheduleButton : strings.saveScheduleButton}
          </button>
        </div>
      </form>
    </section>
  );
}
