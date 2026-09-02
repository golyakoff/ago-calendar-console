import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext.js";
import {
  deleteDayOff,
  editDayBoundary,
  getConfiguration,
  type TenantConfiguration,
} from "../api/calendarApi.js";
import { errorMessage } from "./errorMessage.js";
import { useStrings } from "../i18n/StringsContext.js";
import type { ConsoleStrings } from "../i18n/strings.js";

/**
 * `20-02`'s two manual edits, given the surface `20-06` owes them: "this worker is closed on this
 * day", and "on this day they start late or finish early".
 *
 * <b>Both address a business-local day, not an instant range</b> - that is how a shop thinks about
 * it, and it is the column `events.local_date` stores for exactly this query. The boundary times are
 * wall clock for the same reason working hours are: an offset typed here would be wrong for half the
 * year.
 *
 * <b>Neither can touch a day that has a booking on it</b>, and the console does not try to hide
 * that. The server refuses with `availability.day_has_bookings`, and the operator is told to cancel
 * the booking first - because the customer has to be told, and deleting the slot out from under them
 * would not tell them.
 *
 * <b>Undoing a day off is an edit, not an undo button.</b> Setting boundaries on a closed day
 * regenerates it, which is v1's only way back and is deliberate: a blocked row has no customer
 * attached by construction, so replacing it strands nobody.
 */
export function AvailabilityPage() {
  const { accessToken } = useAuth();
  const strings = useStrings();
  const [configuration, setConfiguration] = useState<TenantConfiguration | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (accessToken === null) {
        return;
      }

      try {
        setConfiguration(await getConfiguration(accessToken, signal));
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(errorMessage(reason, strings));
        }
      }
    },
    [accessToken, strings],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (reason) {
      setError(errorMessage(reason, strings));
    } finally {
      setBusy(false);
    }
  };

  if (accessToken === null) {
    return null;
  }

  if (configuration === null) {
    return error === null ? <p className="muted">{strings.loading}</p> : <p className="error">{error}</p>;
  }

  const workersWithCalendars = configuration.workers
    .map((worker) => ({
      worker,
      calendar: configuration.calendars.find((calendar) => calendar.workerIds.includes(worker.workerId)),
    }))
    .filter((pair): pair is { worker: (typeof configuration.workers)[number]; calendar: (typeof configuration.calendars)[number] } =>
      pair.calendar !== undefined,
    );

  if (workersWithCalendars.length === 0) {
    return <p className="muted">{strings.availabilityNoWorkersNote}</p>;
  }

  return (
    <div className="stack">
      {message !== null && <p className="muted">{message}</p>}
      {error !== null && <p className="error">{error}</p>}

      <DayForm
        title={strings.closeDayTitle}
        description={strings.closeDayDescription}
        submitLabel={strings.closeDayButton}
        workers={workersWithCalendars}
        disabled={busy}
        strings={strings}
        onSubmit={(selection) =>
          void run(
            () =>
              deleteDayOff(accessToken, {
                calendarId: selection.calendarId,
                workerId: selection.workerId,
                localDate: selection.localDate,
              }),
            strings.closeDayDoneMessage,
          )
        }
      />

      <DayForm
        title={strings.changeDayHoursTitle}
        description={strings.changeDayHoursDescription}
        submitLabel={strings.applyNewHoursButton}
        workers={workersWithCalendars}
        disabled={busy}
        strings={strings}
        withTimes
        onSubmit={(selection) =>
          void run(
            () =>
              editDayBoundary(accessToken, {
                calendarId: selection.calendarId,
                workerId: selection.workerId,
                localDate: selection.localDate,
                opensAt: selection.opensAt,
                closesAt: selection.closesAt,
              }),
            strings.changeDayHoursDoneMessage,
          )
        }
      />
    </div>
  );
}

interface DaySelection {
  calendarId: string;
  workerId: string;
  localDate: string;
  opensAt: string;
  closesAt: string;
}

function DayForm({
  title,
  description,
  submitLabel,
  workers,
  disabled,
  strings,
  withTimes = false,
  onSubmit,
}: {
  title: string;
  description: string;
  submitLabel: string;
  workers: { worker: { workerId: string; displayName: string }; calendar: { calendarId: string; name: string } }[];
  disabled: boolean;
  strings: ConsoleStrings;
  withTimes?: boolean;
  onSubmit: (selection: DaySelection) => void;
}) {
  const [workerId, setWorkerId] = useState(workers[0].worker.workerId);
  const [localDate, setLocalDate] = useState("");
  const [opensAt, setOpensAt] = useState("11:00");
  const [closesAt, setClosesAt] = useState("16:00");

  const selected = workers.find((pair) => pair.worker.workerId === workerId) ?? workers[0];
  const fieldId = title.replace(/\s+/g, "-").toLowerCase();

  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit({
            calendarId: selected.calendar.calendarId,
            workerId: selected.worker.workerId,
            localDate,
            opensAt,
            closesAt,
          });
        }}
      >
        <label htmlFor={`${fieldId}-worker`}>{strings.workerFieldLabel}</label>
        <select id={`${fieldId}-worker`} value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
          {workers.map((pair) => (
            <option key={pair.worker.workerId} value={pair.worker.workerId}>
              {pair.worker.displayName} · {pair.calendar.name}
            </option>
          ))}
        </select>

        <label htmlFor={`${fieldId}-date`}>{strings.dayFieldLabel}</label>
        {/* The shop's own business day, in the calendar's zone - not the reader's. */}
        <input
          id={`${fieldId}-date`}
          type="date"
          value={localDate}
          onChange={(event) => setLocalDate(event.target.value)}
          required
        />

        {withTimes && (
          <>
            <label htmlFor={`${fieldId}-opens`}>{strings.opensFieldLabel}</label>
            <input id={`${fieldId}-opens`} type="time" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />

            <label htmlFor={`${fieldId}-closes`}>{strings.closesFieldLabel}</label>
            <input id={`${fieldId}-closes`} type="time" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
          </>
        )}

        <button type="submit" disabled={disabled}>
          {submitLabel}
        </button>
      </form>
    </section>
  );
}
