import { CalendarApiError } from "../api/calendarApi.js";

/**
 * What to show an operator when something was refused.
 *
 * <b>The server's own `detail` verbatim</b> for anything this console has not been taught about -
 * `api-design.md`'s rule is that clients branch on `type` and never on the message, and the
 * corollary is that a message the client does not branch on should reach the human unedited rather
 * than be replaced by a generic sentence that loses what actually happened.
 *
 * The one code that gets its own sentence is the permission failure, because the server's wording
 * names a permission string an operator has no way to act on.
 */
export function errorMessage(reason: unknown): string {
  if (reason instanceof CalendarApiError) {
    if (reason.code === "configuration.forbidden" || reason.code === "booking.forbidden") {
      return "Your operator account does not have permission for that in this tenant.";
    }

    return reason.message;
  }

  // A network failure and a CORS refusal are indistinguishable to a page by design: the browser
  // deliberately tells JavaScript nothing about a response it was not allowed to read. Guessing
  // which one it was would be worse than saying neither.
  return "The console could not reach AGO Calendar.";
}
