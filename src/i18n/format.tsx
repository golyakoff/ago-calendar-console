import type { ConsoleStrings } from "./strings.js";
import type { WorkerSlot } from "../api/calendarApi.js";

/**
 * `11-15`: locale-aware rendering helpers shared by `WorkerSlotsPage` and `WorkerRecutPage` - split
 * into their own file, rather than exported from `WorkerSlotsPage.tsx` itself, because
 * `eslint-plugin-react-refresh` refuses to let a component file export anything but components (Fast
 * Refresh cannot hot-swap a module that also exports a plain function). Both pages show the same kind
 * of row - a slot or a booking preview, wire-enum status, a possibly-hidden customer - so one set of
 * helpers serves both rather than each page growing its own copy that could drift.
 */

/**
 * `11-19`: the raw `Date.prototype.toLocaleString`/`toLocaleTimeString`/`toLocaleDateString` calls
 * this file's own callers used to make directly (`WorkersTable.tsx`, `QueuePage.tsx`,
 * `WorkerRecutPage.tsx`, `ContactsPage.tsx`) all took **no locale argument**, which means "whichever
 * locale the runtime's own `Intl` default happens to be" - the browser's, not the console's own
 * selected one. Found by running `ux-gate`'s fourth assertion for real: on the `queue` and `workers`
 * screens this rendered an English "AM"/"PM" marker on an otherwise all-Russian page, the identical
 * class of gap `ago-console`'s own `i18nCompleteness.ts` names for its `DISPLAY_LOCALE = "en-GB"`
 * (its interface i18n was explicit that dates were out of scope; this codebase never made that call
 * on purpose, the raw call sites just never carried a locale). `WorkerSlotsPage.tsx`'s own
 * `formatLocalTime` was already safe by construction - `hour12: false` and no month/weekday fields
 * mean no letters can appear regardless of locale - so it is unchanged; these three helpers exist for
 * every other call site that renders a full date or a 12-hour-shaped time.
 *
 * `strings.intlLocale` (`strings.ts`'s own header) is the one piece of locale metadata this table
 * carries for exactly this purpose - `ru-RU` renders a 24-hour clock and a dot-separated numeric date
 * with no textual month or day-period at all, which is what actually fixes the defect rather than
 * merely relocating it.
 */
export function formatDateTime(iso: string, strings: ConsoleStrings): string {
  return new Date(iso).toLocaleString(strings.intlLocale);
}

export function formatTime(iso: string, strings: ConsoleStrings): string {
  return new Date(iso).toLocaleTimeString(strings.intlLocale);
}

export function formatDate(iso: string, strings: ConsoleStrings): string {
  return new Date(iso).toLocaleDateString(strings.intlLocale);
}

/** The seven-day enumeration `ConfigurationPage`'s working-hours form and `WorkerSlotsPage`'s own
 * table both need, keyed off the same `ConsoleStrings` fields so the two can never drift apart. */
export function weekdayNames(strings: ConsoleStrings): string[] {
  return [
    strings.weekdaySunday,
    strings.weekdayMonday,
    strings.weekdayTuesday,
    strings.weekdayWednesday,
    strings.weekdayThursday,
    strings.weekdayFriday,
    strings.weekdaySaturday,
  ];
}

/** `WorkerSlot.status`'s six wire values, mapped to this locale's own chrome - `strings.ts`'s own
 * remarks on `slotStatus*` explain why a fixed server enum counts as chrome here. `WorkerRecutPage`
 * shows a narrower, three-value subset on its own booking rows; that union is assignable to this
 * wider parameter type, so the one switch serves both files. */
export function slotStatusLabel(status: WorkerSlot["status"], strings: ConsoleStrings): string {
  switch (status) {
    case "Available":
      return strings.slotStatusAvailable;
    case "PendingConfirmation":
      return strings.slotStatusPendingConfirmation;
    case "Booked":
      return strings.slotStatusBooked;
    case "Cancelled":
      return strings.slotStatusCancelled;
    case "NoShow":
      return strings.slotStatusNoShow;
    case "Blocked":
      return strings.slotStatusBlocked;
  }
}

/** No customer at all (a free or blocked slot) reads as a plain dash - never confusable with
 * `hidden`, which only ever means "somebody holds this and I may not see who" (`renderPhone`'s own
 * remarks give the full two-state story). */
export function renderCustomer(slot: { customerId: string | null; customerDisplayName: string | null }, strings: ConsoleStrings) {
  if (slot.customerId === null) {
    return <span className="muted">—</span>;
  }

  if (slot.customerDisplayName === null) {
    return (
      <span className="muted" title={strings.hiddenContactTooltip}>
        {strings.hiddenContactLabel}
      </span>
    );
  }

  return slot.customerDisplayName;
}

/**
 * `20-12`'s own rule, restated for a screen that - unlike the pending queue - has rows with no
 * customer at all: `phone === null` is ambiguous by itself (no customer, or a customer this operator
 * may not see), and `customerId` is what tells the two apart. Rendering `hidden` for a genuinely free
 * slot would be a lie; rendering a blank dash for a withheld one would be indistinguishable from "no
 * phone recorded", which cannot happen (`Ago.Calendar.Domain.Customer.Phone` is never nullable).
 */
export function renderPhone(slot: { customerId: string | null; phone: string | null }, strings: ConsoleStrings) {
  if (slot.customerId === null) {
    return <span className="muted">—</span>;
  }

  if (slot.phone === null) {
    return (
      <span className="muted" title={strings.hiddenContactTooltip}>
        {strings.hiddenContactLabel}
      </span>
    );
  }

  return slot.phone;
}
