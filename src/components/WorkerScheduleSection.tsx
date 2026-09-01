import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarApiError, getWorkerSchedule, saveWorkerSchedule, type WorkerSchedule } from "../api/calendarApi.js";
import { useAuth } from "../auth/AuthContext.js";
import { errorMessage } from "../pages/errorMessage.js";

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
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
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
  };
}

export function WorkerScheduleSection({ workerId }: WorkerScheduleSectionProps) {
  const { accessToken } = useAuth();
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
          setError(errorMessage(reason));
        }
      } finally {
        setLoading(false);
      }
    },
    [workerId, accessToken],
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
      });
      setExisting(saved);
      setForm(formFrom(saved));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="worker-schedule">
        <h3>Schedule</h3>
        <p className="muted">Loading…</p>
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
      <h3>Schedule</h3>
      {existing === null && <p className="muted">No schedule yet - this worker materialises nothing until one is saved.</p>}
      {error !== null && <p className="error">{error}</p>}

      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="schedule-kind">Template</label>
        <select
          id="schedule-kind"
          value={form.kind}
          onChange={(event) => setForm({ ...form, kind: event.target.value as "Weekly" | "Cycle" })}
        >
          <option value="Weekly">Weekly (ordinary week)</option>
          <option value="Cycle">Cycle (N days on, M days off)</option>
        </select>
        {switchingAwayFromCycle && (
          <p className="muted">
            Switching to Weekly clears the cycle settings on save. Already materialised days are untouched either
            way.
          </p>
        )}

        {form.kind === "Cycle" && (
          <>
            <label htmlFor="schedule-cycle-anchor">Anchor date (first working day)</label>
            <input
              id="schedule-cycle-anchor"
              type="date"
              value={form.cycleAnchor}
              onChange={(event) => setForm({ ...form, cycleAnchor: event.target.value })}
              required
            />

            <label htmlFor="schedule-cycle-working">Working days</label>
            <input
              id="schedule-cycle-working"
              type="number"
              min={1}
              value={form.cycleWorkingDays}
              onChange={(event) => setForm({ ...form, cycleWorkingDays: event.target.value })}
              required
            />

            <label htmlFor="schedule-cycle-rest">Rest days</label>
            <input
              id="schedule-cycle-rest"
              type="number"
              min={0}
              value={form.cycleRestDays}
              onChange={(event) => setForm({ ...form, cycleRestDays: event.target.value })}
              required
            />
            <p className="muted">
              &ldquo;2 через 2&rdquo; is 2 working / 2 rest. &ldquo;Сутки через трое&rdquo; is 1 working / 3 rest, plus
              the hours below - not a 24-hour window.
            </p>

            <label htmlFor="schedule-cycle-starts">Opens</label>
            <input
              id="schedule-cycle-starts"
              type="time"
              value={form.cycleStartsAt}
              onChange={(event) => setForm({ ...form, cycleStartsAt: event.target.value })}
              required
            />

            <label htmlFor="schedule-cycle-ends">Closes</label>
            <input
              id="schedule-cycle-ends"
              type="time"
              value={form.cycleEndsAt}
              onChange={(event) => setForm({ ...form, cycleEndsAt: event.target.value })}
              required
            />
          </>
        )}

        {form.kind === "Weekly" && (
          <p className="muted">
            Weekly hours are set on the Setup screen&rsquo;s working-hours form, per day of the week.
          </p>
        )}

        <label htmlFor="schedule-slot">Slot length (minutes)</label>
        <input
          id="schedule-slot"
          type="number"
          min={1}
          value={form.slotMinutes}
          onChange={(event) => setForm({ ...form, slotMinutes: event.target.value })}
          required
        />
        <p className="muted">A service longer than this is not offered for this worker, until per-service grids exist.</p>

        <label htmlFor="schedule-buffer">Buffer between slots (minutes)</label>
        <input
          id="schedule-buffer"
          type="number"
          min={0}
          value={form.bufferMinutes}
          onChange={(event) => setForm({ ...form, bufferMinutes: event.target.value })}
        />

        <label htmlFor="schedule-horizon">Horizon (days ahead kept generated)</label>
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
        <p className="muted">Capped at {MAX_HORIZON_DAYS} days.</p>

        <label htmlFor="schedule-materialize-from">
          Don&rsquo;t generate before
          {existing !== null && <span className="muted"> (cannot move earlier than {existing.materializeFrom})</span>}
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
            Need to fix days already cut under an old template? <Link to={`/workers/${workerId}/recut`}>Re-cut the schedule</Link>{" "}
            instead of moving this date - it shows what would be deleted before anything is.
          </p>
        )}

        <div className="worker-schedule-actions">
          <button type="submit" disabled={busy}>
            {existing === null ? "Create schedule" : "Save schedule"}
          </button>
        </div>
      </form>
    </section>
  );
}
