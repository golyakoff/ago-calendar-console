import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import {
  CalendarApiError,
  previewRecutSchedule,
  recutSchedule,
  type RecutBookingPreview,
  type RecutDayPreview,
  type RecutPreviewResult,
  type RecutResult,
} from "../api/calendarApi.js";
import { errorMessage } from "./errorMessage.js";
import { renderCustomer, renderPhone, slotStatusLabel } from "../i18n/format.js";
import { useStrings } from "../i18n/StringsContext.js";
import type { ConsoleStrings } from "../i18n/strings.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Decision = "Cancel" | "Keep";

/**
 * `20-16`: the one deliberate, human-triggered exception to `20-14`'s forward-only cursor. Reached
 * from the Workers screen's row actions and from `WorkerScheduleSection`'s own "cannot move earlier"
 * note next to the `materializeFrom` field this screen exists to get around on purpose.
 *
 * <b>Three steps, and the middle one cannot be skipped by typing faster.</b> Pick a date and preview;
 * decide cancel-or-keep for every booking the preview found; review a plain-language summary of the
 * counts before the actually-destructive call fires. `WorkersPage`'s own delete flow is the precedent
 * for "a second panel is the confirmation, not a `<dialog>`" - this screen adds a third step only
 * because a re-cut can destroy far more in one call than a single worker's delete ever could, and
 * because per-booking decisions have to be made somewhere before a summary can be shown at all.
 *
 * <b>The "Confirm" button is disabled, not merely warned-against, until every decidable booking has an
 * explicit choice.</b> The server refuses a request that omits one (`recut.missing_decision`) rather
 * than guessing either way - guessing "keep" would silently leave a day the operator meant to fix
 * untouched, and guessing "cancel" would silently cancel a visit nobody chose to cancel. Disabling the
 * button client-side is a courtesy that saves a round trip; the server's own refusal is the actual
 * guarantee, exactly the same relationship the horizon-days field on `WorkerScheduleSection` has with
 * its own capped-server-side rule.
 *
 * <b>A stale preview is not retried automatically.</b> `recut.stale` clears the preview outright and
 * asks for a fresh one, rather than silently re-fetching and re-applying the operator's already-made
 * decisions to a world that has changed underneath them - the same "refuse the whole thing rather than
 * guess" the server itself applies to the identical situation.
 */
export function WorkerRecutPage() {
  const { workerId } = useParams<{ workerId: string }>();
  const { accessToken } = useAuth();
  const strings = useStrings();

  const [from, setFrom] = useState(today);
  const [preview, setPreview] = useState<RecutPreviewResult | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RecutResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(
    async (event?: { preventDefault(): void }) => {
      event?.preventDefault();
      if (accessToken === null || workerId === undefined) {
        return;
      }

      setBusy(true);
      setError(null);
      setResult(null);
      setConfirming(false);

      try {
        const loaded = await previewRecutSchedule(accessToken, workerId, from);
        setPreview(loaded);
        setDecisions({});
      } catch (reason) {
        setPreview(null);
        setError(errorMessage(reason, strings));
      } finally {
        setBusy(false);
      }
    },
    [accessToken, workerId, from, strings],
  );

  const decidableBookings = (preview?.days ?? []).flatMap((day) => day.bookings.filter((b) => b.canDecide));
  const everyDecisionMade = decidableBookings.every((booking) => decisions[booking.bookingId] !== undefined);

  const daysToBeRecut = (preview?.days ?? []).filter((day) => !dayIsKept(day, decisions));
  const daysToBeSkipped = (preview?.days ?? []).filter((day) => dayIsKept(day, decisions));
  const bookingsToBeCancelled = decidableBookings.filter((b) => decisions[b.bookingId] === "Cancel").length;
  const availableSlotsToDelete = daysToBeRecut.reduce((sum, day) => sum + day.availableSlotsToDelete, 0);

  const handleConfirm = async () => {
    if (accessToken === null || workerId === undefined || preview === null) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const applied = await recutSchedule(accessToken, workerId, {
        from,
        fingerprint: preview.fingerprint,
        decisions: decidableBookings.map((booking) => ({
          bookingId: booking.bookingId,
          decision: decisions[booking.bookingId],
        })),
      });
      setResult(applied);
      setPreview(null);
      setDecisions({});
      setConfirming(false);
    } catch (reason) {
      if (reason instanceof CalendarApiError && reason.code === "recut.stale") {
        // Refused whole, not partially applied - the server's own guarantee. Sending the operator
        // back to a fresh preview is the honest response, not a silent retry with the same decisions.
        setPreview(null);
        setDecisions({});
        setConfirming(false);
      }

      setError(errorMessage(reason, strings));
    } finally {
      setBusy(false);
    }
  };

  if (accessToken === null || workerId === undefined) {
    return null;
  }

  return (
    <section className="panel">
      <p>
        <Link to="/workers">← {strings.navWorkers}</Link>
      </p>
      <h2>{strings.recutTitle}</h2>
      <p className="muted">{strings.recutDescription}</p>

      <form onSubmit={(event) => void loadPreview(event)}>
        <label htmlFor="recut-from">{strings.recutFromFieldLabel}</label>
        <input
          id="recut-from"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          required
        />
        <button type="submit" disabled={busy}>
          {strings.previewButton}
        </button>
      </form>

      {error !== null && <p className="error">{error}</p>}

      {result !== null && (
        <section className="panel">
          <h3>{strings.recutDoneTitle}</h3>
          <p>
            {result.recutDays.length}
            {strings.recutSummaryDaysRecutSuffix}
            {result.skippedDays.length}
            {strings.recutSummaryDaysLeftSuffix}
            {result.slotsDeleted}
            {strings.recutSummarySlotsDeletedSuffix}
            {result.slotsInserted}
            {strings.recutSummarySlotsInsertedSuffix}
            {result.bookingsCancelled}
            {strings.recutSummaryBookingsCancelledSuffix}
          </p>
          {result.skippedDays.length > 0 && (
            <p className="muted">
              {strings.recutLeftInOldGridPrefix}
              {result.skippedDays.join(", ")}
              {strings.recutLeftInOldGridSuffix}
            </p>
          )}
        </section>
      )}

      {preview !== null && !confirming && (
        <>
          {preview.days.every((day) => day.bookings.length === 0) && preview.days.every((day) => day.availableSlotsToDelete === 0) ? (
            <p className="muted">{strings.recutNothingGeneratedNote}</p>
          ) : null}

          {preview.days.map((day) => (
            <RecutDayRow
              key={day.localDate}
              day={day}
              decisions={decisions}
              strings={strings}
              onDecide={(bookingId, decision) =>
                setDecisions((current) => ({ ...current, [bookingId]: decision }))
              }
            />
          ))}

          <p>
            <button type="button" disabled={busy || !everyDecisionMade} onClick={() => setConfirming(true)}>
              {strings.reviewAndConfirmButton}
            </button>
          </p>
          {!everyDecisionMade && <p className="muted">{strings.recutChooseDecisionNote}</p>}
        </>
      )}

      {preview !== null && confirming && (
        <section className="panel">
          <h3>{strings.recutConfirmTitle}</h3>
          <p>
            {strings.recutConfirmPrefix}
            <strong>{daysToBeRecut.length}</strong>
            {strings.recutConfirmDaysSuffix}
            <strong>{availableSlotsToDelete}</strong>
            {strings.recutConfirmSlotsSuffix}
            <strong>{bookingsToBeCancelled}</strong>
            {strings.recutConfirmBookingsSuffix}
            <strong>{daysToBeSkipped.length}</strong>
            {strings.recutConfirmSkippedSuffix}
          </p>
          <p className="muted">{strings.recutCannotBeUndoneNote}</p>
          <button type="button" disabled={busy} onClick={() => void handleConfirm()}>
            {strings.confirmRecutButton}
          </button>{" "}
          <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
            {strings.backButton}
          </button>
        </section>
      )}
    </section>
  );
}

function dayIsKept(day: RecutDayPreview, decisions: Record<string, Decision>): boolean {
  return day.bookings.some((booking) => !booking.canDecide || decisions[booking.bookingId] === "Keep");
}

function RecutDayRow({
  day,
  decisions,
  strings,
  onDecide,
}: {
  day: RecutDayPreview;
  decisions: Record<string, Decision>;
  strings: ConsoleStrings;
  onDecide: (bookingId: string, decision: Decision) => void;
}) {
  const kept = dayIsKept(day, decisions);

  return (
    <section className="panel">
      <h4>
        {day.localDate} {kept && <span className="muted">{strings.recutDayKeptNote}</span>}
      </h4>
      <p className="muted">
        {day.availableSlotsToDelete}
        {strings.recutDaySlotsToDeleteSuffix}
      </p>

      {day.bookings.length === 0 && <p className="muted">{strings.recutNoBookingsNote}</p>}

      {day.bookings.map((booking) => (
        <RecutBookingRow
          key={booking.bookingId}
          booking={booking}
          decision={decisions[booking.bookingId]}
          strings={strings}
          onDecide={(decision) => onDecide(booking.bookingId, decision)}
        />
      ))}
    </section>
  );
}

function RecutBookingRow({
  booking,
  decision,
  strings,
  onDecide,
}: {
  booking: RecutBookingPreview;
  decision: Decision | undefined;
  strings: ConsoleStrings;
  onDecide: (decision: Decision) => void;
}) {
  const groupName = `recut-decision-${booking.bookingId}`;

  return (
    <div>
      {/* Each field its own element, not a run of sibling text nodes inside one <span> - so a
          screen-reader and a query alike can address "the customer's name" as one thing rather than
          having to parse it back out of a sentence. */}
      <span>
        {new Date(booking.startsAt).toLocaleString()} – {new Date(booking.endsAt).toLocaleTimeString()}
      </span>{" "}
      <span>{booking.serviceName ?? <span className="muted">—</span>}</span>{" "}
      <span>{renderCustomer(booking, strings)}</span>{" "}
      <span>{renderPhone(booking, strings)}</span>{" "}
      <span className="muted">({slotStatusLabel(booking.status, strings)})</span>{" "}
      {booking.canDecide ? (
        <span>
          <label>
            <input
              type="radio"
              name={groupName}
              value="Cancel"
              checked={decision === "Cancel"}
              onChange={() => onDecide("Cancel")}
            />
            {strings.cancelDecisionLabel}
          </label>{" "}
          <label>
            <input
              type="radio"
              name={groupName}
              value="Keep"
              checked={decision === "Keep"}
              onChange={() => onDecide("Keep")}
            />
            {strings.keepDecisionLabel}
          </label>
        </span>
      ) : (
        <span className="muted">{strings.alreadyNoShowNote}</span>
      )}
    </div>
  );
}
