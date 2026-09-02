import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { getConfiguration, getWorkerSlots, type TenantConfiguration, type WorkerSlot } from "../api/calendarApi.js";
import { errorMessage } from "./errorMessage.js";
import { useStrings } from "../i18n/StringsContext.js";
import { renderCustomer, renderPhone, slotStatusLabel, weekdayNames } from "../i18n/format.js";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 14);
  return { from: isoDate(today), to: isoDate(horizon) };
}

/**
 * `20-15`: the materialised slot view - what a worker's own schedule actually produced, over a date
 * range. Reached from the Workers screen (the row's own action and the edit card's extension slot);
 * read-only, one plain table, matching `18-08`'s and `20-12`'s own restraint - no calendar grid, no
 * aggregate, no edit of its own.
 *
 * <b>Every status is shown, not just the occupied ones.</b> A materialised-but-never-claimed
 * `Available` row is as much a part of "did my schedule come out right" as a `Booked` one - a day
 * with no rows at all and a day whose rows are all still `Available` look identical from the public
 * widget's side and are two different problems from this screen's.
 *
 * <b>Local times are the calendar's own zone, not this browser's.</b> `startsAt`/`endsAt` arrive as
 * instants; formatting them with the worker's calendar's IANA zone (from `getConfiguration`, the same
 * source `AvailabilityPage` already reads) is what makes "local" mean the shop's own wall clock rather
 * than whichever zone the operator's own machine happens to be set to - the identical distinction the
 * public booking widget draws for a customer, and why the server never sends a pre-formatted string:
 * the zone conversion belongs to whoever is rendering, and only the browser knows which zone that is
 * *for the reader*, while only the calendar's own configuration knows the zone *for the business*.
 *
 * <b>The default range is today through +14 days, both editable, and the past is not special-cased.</b>
 * The item's own open question leaned this way for readability over the full materialisation horizon
 * (up to 180 rows per worker); nothing stops an operator from widening the range, including into the
 * past - "who came last Tuesday" is arguably `20-12`'s contacts report's job, but refusing a past
 * `from` here would only turn that into a second screen's worth of code for a distinction an operator
 * looking at their own schedule has no reason to care about.
 */
export function WorkerSlotsPage() {
  const { workerId } = useParams<{ workerId: string }>();
  const { accessToken } = useAuth();
  const strings = useStrings();
  const [configuration, setConfiguration] = useState<TenantConfiguration | null>(null);
  const [slots, setSlots] = useState<WorkerSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(defaultRange);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (accessToken === null || workerId === undefined) {
        return;
      }

      try {
        // Two calls, not one - the same split `WorkersPage` already made: `getWorkerSlots` is this
        // item's own row shape, and `getConfiguration` is still where a calendar's own time zone (and
        // a worker's display name for the heading) comes from.
        const [loadedConfiguration, loadedSlots] = await Promise.all([
          getConfiguration(accessToken, signal),
          getWorkerSlots(accessToken, workerId, range.from, range.to, signal),
        ]);
        setConfiguration(loadedConfiguration);
        setSlots(loadedSlots);
        setError(null);
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(errorMessage(reason, strings));
        }
      }
    },
    [accessToken, workerId, range, strings],
  );

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  if (accessToken === null || workerId === undefined) {
    return null;
  }

  const worker = configuration?.workers.find((candidate) => candidate.workerId === workerId);
  const calendar = configuration?.calendars.find((candidate) => candidate.workerIds.includes(workerId));
  const weekdays = weekdayNames(strings);

  return (
    <section className="panel">
      <p>
        <Link to="/workers">← {strings.navWorkers}</Link>
      </p>
      <h2>
        {worker !== undefined
          ? `${strings.slotsHeadingPrefix}${worker.displayName}${strings.slotsHeadingSuffix}`
          : strings.slotsHeadingFallback}
      </h2>
      <p className="muted">
        {strings.slotsDescription}
        {calendar !== undefined && `${strings.slotsTimezoneNotePrefix}${calendar.timeZone}${strings.slotsTimezoneNoteSuffix}`}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void reload();
        }}
      >
        <label htmlFor="worker-slots-from">{strings.fromFieldLabel}</label>
        <input
          id="worker-slots-from"
          type="date"
          value={range.from}
          onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
          required
        />

        <label htmlFor="worker-slots-to">{strings.toFieldLabel}</label>
        <input
          id="worker-slots-to"
          type="date"
          value={range.to}
          onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
          required
        />

        <button type="submit">{strings.refreshButton}</button>
      </form>

      {error !== null && <p className="error">{error}</p>}

      {slots === null && error === null && <p className="muted">{strings.loading}</p>}

      {slots !== null && slots.length === 0 && <p className="muted">{strings.slotsEmpty}</p>}

      {slots !== null && slots.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">{strings.slotsColumnDate}</th>
              <th scope="col">{strings.slotsColumnWeekday}</th>
              <th scope="col">{strings.slotsColumnTime}</th>
              <th scope="col">{strings.slotsColumnStatus}</th>
              <th scope="col">{strings.slotsColumnService}</th>
              <th scope="col">{strings.slotsColumnCustomer}</th>
              <th scope="col">{strings.slotsColumnPhone}</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, index) => (
              <tr key={slot.eventId} className={bookingGroupClassName(slots, index)}>
                <td>{slot.localDate}</td>
                <td>{weekdays[slot.weekday]}</td>
                <td>
                  {formatLocalTime(slot.startsAt, calendar?.timeZone)}
                  {"–"}
                  {formatLocalTime(slot.endsAt, calendar?.timeZone)}
                </td>
                <td>{slotStatusLabel(slot.status, strings)}</td>
                <td>{slot.serviceName ?? <span className="muted">—</span>}</td>
                <td>{renderCustomer(slot, strings)}</td>
                <td>{renderPhone(slot, strings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * `20-18`: a visual cue that two or more adjacent rows are the same multi-slot booking, without
 * merging the rows themselves - this item's own scope keeps a slot as one row with one status. Rows
 * arrive from the server already ordered by `startsAt` (`WorkerSlotReadStore`'s own `order by
 * e.starts_at`), and a booking's own rows are contiguous by construction (`ConsecutiveRunFinder`
 * never claims a gap), so a plain adjacent-index comparison is enough - no need to pre-group into a
 * map keyed by `bookingId` for what is always a run of consecutive array entries.
 */
function bookingGroupClassName(slots: WorkerSlot[], index: number): string | undefined {
  const slot = slots[index];
  if (slot.bookingId === null) {
    return undefined;
  }

  const sharesWithPrevious = index > 0 && slots[index - 1].bookingId === slot.bookingId;
  const sharesWithNext = index < slots.length - 1 && slots[index + 1].bookingId === slot.bookingId;
  if (!sharesWithPrevious && !sharesWithNext) {
    return undefined;
  }

  const classNames = ["booking-group"];
  if (!sharesWithPrevious) {
    classNames.push("booking-group-start");
  }
  if (!sharesWithNext) {
    classNames.push("booking-group-end");
  }

  return classNames.join(" ");
}

/** The business's own zone when known (from the calendar this worker is on); the reader's browser
 * zone only as a fallback for the instant between the page mounting and `getConfiguration` resolving,
 * since a table with no times at all reads worse than one that briefly shows the wrong zone's for a
 * moment. */
function formatLocalTime(iso: string, timeZone: string | undefined): string {
  if (timeZone === undefined) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(
    new Date(iso),
  );
}
