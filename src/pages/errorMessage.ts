import { CalendarApiError } from "../api/calendarApi.js";
import type { ConsoleStrings } from "../i18n/strings.js";

/**
 * What to show an operator when something was refused.
 *
 * <b>The server's own `detail` verbatim</b> for anything this console has not been taught about -
 * `api-design.md`'s rule is that clients branch on `type` and never on the message, and the
 * corollary is that a message the client does not branch on should reach the human unedited rather
 * than be replaced by a generic sentence that loses what actually happened. That is also why this
 * function takes `strings` as a parameter rather than calling `useStrings()` itself: it is a plain
 * function, not a component, called from a dozen different `catch` blocks - `strings` is the same
 * fixed fragment every other caller composes with, `strings.ts`'s own header on interpolation.
 *
 * The one code that gets its own sentence is the permission failure, because the server's wording
 * names a permission string an operator has no way to act on.
 */
export function errorMessage(reason: unknown, strings: ConsoleStrings): string {
  if (reason instanceof CalendarApiError) {
    if (
      reason.code === "configuration.forbidden" ||
      reason.code === "booking.forbidden" ||
      reason.code === "access.forbidden" ||
      reason.code === "contacts.forbidden" ||
      reason.code === "worker_slots.forbidden" ||
      reason.code === "recut.forbidden"
    ) {
      return strings.permissionDeniedError;
    }

    return reason.message;
  }

  // A network failure and a CORS refusal are indistinguishable to a page by design: the browser
  // deliberately tells JavaScript nothing about a response it was not allowed to read. Guessing
  // which one it was would be worse than saying neither.
  return strings.networkError;
}
