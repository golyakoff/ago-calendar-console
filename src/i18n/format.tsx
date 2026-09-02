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
