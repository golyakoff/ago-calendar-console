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
        setError(errorMessage(reason));
      } finally {
        setBusy(false);
      }
    },
    [accessToken, workerId, from],
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

      setError(errorMessage(reason));
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
        <Link to="/workers">← Workers</Link>
      </p>
      <h2>Re-cut schedule</h2>
      <p className="muted">
        Moves this worker&rsquo;s materialisation cursor back to a date that is already cut, and
        regenerates every day in between from the current template. This deletes free slots and, for
        any booking you choose to cancel, cancels it through the ordinary cancellation flow - the
        customer is told, and the booking&rsquo;s own row survives as cancelled rather than being
        deleted.
      </p>

      <form onSubmit={(event) => void loadPreview(event)}>
        <label htmlFor="recut-from">Re-cut from</label>
        <input
          id="recut-from"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          required
        />
        <button type="submit" disabled={busy}>
          Preview
        </button>
      </form>

      {error !== null && <p className="error">{error}</p>}

      {result !== null && (
        <section className="panel">
          <h3>Done</h3>
          <p>
            {result.recutDays.length} day(s) re-cut, {result.skippedDays.length} day(s) left untouched
            because they held a kept booking. {result.slotsDeleted} free slot(s) deleted,{" "}
            {result.slotsInserted} inserted, {result.bookingsCancelled} booking(s) cancelled.
          </p>
          {result.skippedDays.length > 0 && (
            <p className="muted">Left in the old grid: {result.skippedDays.join(", ")}.</p>
          )}
        </section>
      )}

      {preview !== null && !confirming && (
        <>
          {preview.days.every((day) => day.bookings.length === 0) && preview.days.every((day) => day.availableSlotsToDelete === 0) ? (
            <p className="muted">Nothing in this range has been generated yet - a re-cut will simply cut it fresh.</p>
          ) : null}

          {preview.days.map((day) => (
            <RecutDayRow
              key={day.localDate}
              day={day}
              decisions={decisions}
              onDecide={(bookingId, decision) =>
                setDecisions((current) => ({ ...current, [bookingId]: decision }))
              }
            />
          ))}

          <p>
            <button type="button" disabled={busy || !everyDecisionMade} onClick={() => setConfirming(true)}>
              Review &amp; confirm
            </button>
          </p>
          {!everyDecisionMade && (
            <p className="muted">Choose cancel or keep for every booking above before continuing.</p>
          )}
        </>
      )}

      {preview !== null && confirming && (
        <section className="panel">
          <h3>Confirm re-cut</h3>
          <p>
            This will clear and regenerate <strong>{daysToBeRecut.length}</strong> day(s), deleting{" "}
            <strong>{availableSlotsToDelete}</strong> free slot(s) and cancelling{" "}
            <strong>{bookingsToBeCancelled}</strong> booking(s). <strong>{daysToBeSkipped.length}</strong>{" "}
            day(s) will be left exactly as they are because they hold a booking you chose to keep, or a
            no-show that cannot be decided.
          </p>
          <p className="muted">This cannot be undone from this screen.</p>
          <button type="button" disabled={busy} onClick={() => void handleConfirm()}>
            Confirm re-cut
          </button>{" "}
          <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
            Back
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
  onDecide,
}: {
  day: RecutDayPreview;
  decisions: Record<string, Decision>;
  onDecide: (bookingId: string, decision: Decision) => void;
}) {
  const kept = dayIsKept(day, decisions);

  return (
    <section className="panel">
      <h4>
        {day.localDate} {kept && <span className="muted">(will be left untouched)</span>}
      </h4>
      <p className="muted">{day.availableSlotsToDelete} free slot(s) would be deleted if this day is re-cut.</p>

      {day.bookings.length === 0 && <p className="muted">No bookings on this day.</p>}

      {day.bookings.map((booking) => (
        <RecutBookingRow
          key={booking.bookingId}
          booking={booking}
          decision={decisions[booking.bookingId]}
          onDecide={(decision) => onDecide(booking.bookingId, decision)}
        />
      ))}
    </section>
  );
}

function RecutBookingRow({
  booking,
  decision,
  onDecide,
}: {
  booking: RecutBookingPreview;
  decision: Decision | undefined;
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
      <span>{renderCustomer(booking)}</span>{" "}
      <span>{renderPhone(booking)}</span>{" "}
      <span className="muted">({booking.status})</span>{" "}
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
            Cancel
          </label>{" "}
          <label>
            <input
              type="radio"
              name={groupName}
              value="Keep"
              checked={decision === "Keep"}
              onChange={() => onDecide("Keep")}
            />
            Keep
          </label>
        </span>
      ) : (
        <span className="muted">Already happened as a no-show - cannot be cancelled, its day is kept.</span>
      )}
    </div>
  );
}

/** The identical two-null-reasons rule `WorkerSlotsPage.renderCustomer` already established - every
 * row here holds a customer by construction, so only the permission reason ever applies, but the same
 * helper shape is kept rather than assuming that and simplifying it away. */
function renderCustomer(booking: RecutBookingPreview) {
  if (booking.customerId === null) {
    return <span className="muted">—</span>;
  }

  if (booking.customerDisplayName === null) {
    return (
      <span className="muted" title="You don't have contact-visibility permission for this tenant.">
        hidden
      </span>
    );
  }

  return booking.customerDisplayName;
}

function renderPhone(booking: RecutBookingPreview) {
  if (booking.customerId === null) {
    return <span className="muted">—</span>;
  }

  if (booking.phone === null) {
    return (
      <span className="muted" title="You don't have contact-visibility permission for this tenant.">
        hidden
      </span>
    );
  }

  return booking.phone;
}
