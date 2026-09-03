import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import {
  cancelBooking,
  getPendingBookings,
  markNoShow,
  rejectBooking,
  type PendingBooking,
} from "../api/calendarApi.js";
import { errorMessage } from "./errorMessage.js";
import { useStrings } from "../i18n/StringsContext.js";
import { formatDateTime, formatTime } from "../i18n/format.js";

/**
 * The shared pending-bookings queue (`20-04`), and the three transitions an operator can make on it.
 *
 * <b>One queue, spanning every calendar the tenant has.</b> There is deliberately no filter by
 * calendar and no notion of "mine": the product's queue is shared so that whoever is around handles
 * whatever arrived, which is also why `Ago.Calendar.Domain.Operator` carries no presence and no
 * capacity. A calendar column is shown because an operator still needs to know which shop floor they
 * are looking at - shown, never filtered on.
 *
 * <b>Reject, not approve.</b> Everything here auto-confirms unless somebody vetoes it before the
 * deadline. A shop that never opens this console still has every booking confirmed, which is the
 * property the whole two-step mechanic exists to give the customer.
 *
 * <b>Overdue rows are shown, loudly, rather than hidden.</b> An overdue row means the confirmation
 * sweep is not running - and the customer has already been told they are booked. Filtering those out
 * would make a broken sweep invisible to the only person in a position to notice.
 */
export function QueuePage() {
  const { accessToken } = useAuth();
  const strings = useStrings();
  const [rows, setRows] = useState<PendingBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (accessToken === null) {
        return;
      }

      try {
        setRows(await getPendingBookings(accessToken, signal));
        setError(null);
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
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const act = async (bookingId: string, action: (token: string, id: string) => Promise<void>) => {
    if (accessToken === null) {
      return;
    }

    setBusyId(bookingId);
    try {
      await action(accessToken, bookingId);
      await reload();
    } catch (reason) {
      // Losing a race with the sweep is an ordinary outcome, not a fault: the server reports it as
      // `booking.invalid_state` or `booking.concurrency_conflict`, and either way the honest thing to
      // do is show what it said and re-read the queue.
      //
      // **Re-read first, then set the message.** The other order looks identical and is not: a
      // successful reload clears the error, so setting the message before reloading wipes the one
      // sentence the operator needed - the action silently appearing to do nothing. Found by the
      // test that asserts the server's own wording is on screen.
      const failure = errorMessage(reason, strings);
      await reload();
      setError(failure);
    } finally {
      setBusyId(null);
    }
  };

  if (accessToken === null) {
    return null;
  }

  return (
    <section className="panel">
      <h2>{strings.queueTitle}</h2>
      <p className="muted">{strings.queueDescription}</p>

      {error !== null && <p className="error">{error}</p>}

      {rows === null && <p className="muted">{strings.loading}</p>}

      {rows !== null && rows.length === 0 && <p className="muted">{strings.queueEmpty}</p>}

      {rows !== null && rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">{strings.queueColumnWhen}</th>
              <th scope="col">{strings.queueColumnCalendar}</th>
              <th scope="col">{strings.queueColumnPhone}</th>
              <th scope="col">{strings.queueColumnDeadline}</th>
              <th scope="col">{strings.queueColumnActions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.bookingId} className={row.isOverdue ? "overdue" : undefined}>
                {/* `20-18`: this row can now be several consecutive slots claimed as one booking, so
                    "when" is the run's own whole span - startsAt to endsAt - not just its first
                    slot's own start. */}
                <td>
                  {formatDateTime(row.startsAt, strings)}
                  {" – "}
                  {formatTime(row.endsAt, strings)}
                </td>
                <td>
                  <code>{row.calendarId.slice(0, 8)}</code>
                </td>
                <td>
                  {/* `20-12`: `null` means "hidden - you don't have contact-visibility permission",
                      never a blank cell indistinguishable from "nothing recorded" - see
                      `PendingBooking.phone`'s own remarks for why the latter cannot actually occur. */}
                  {row.phone === null ? (
                    <span className="muted" title={strings.hiddenContactTooltip}>
                      {strings.hiddenContactLabel}
                    </span>
                  ) : (
                    row.phone
                  )}
                </td>
                <td>
                  {formatDateTime(row.confirmationDeadline, strings)}
                  {row.isOverdue && <strong>{strings.queueOverdueNote}</strong>}
                </td>
                <td>
                  <button type="button" disabled={busyId === row.bookingId} onClick={() => void act(row.bookingId, rejectBooking)}>
                    {strings.rejectButton}
                  </button>{" "}
                  <button type="button" disabled={busyId === row.bookingId} onClick={() => void act(row.bookingId, cancelBooking)}>
                    {strings.cancelButton}
                  </button>{" "}
                  <button type="button" disabled={busyId === row.bookingId} onClick={() => void act(row.bookingId, markNoShow)}>
                    {strings.noShowButton}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button type="button" onClick={() => void reload()}>
        {strings.refreshButton}
      </button>
    </section>
  );
}
