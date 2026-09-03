/**
 * `15-11`: the seeded world every screen in this gate renders against.
 *
 * Fixed ids and fixed dates, never `Date.now()` or a random guid: a screenshot that differs between
 * runs is an artifact nobody opens twice, and this gate's screenshots exist to be looked at by a
 * human deciding whether a screen is usable. The same reasoning `playwright.config.ts` states for
 * `reducedMotion`.
 *
 * Values are obviously synthetic - `.invalid` addresses, repeated-digit guids - because everything in
 * this repository is public and a fixture that looks like real tenant data invites somebody to treat
 * it as such.
 */

export const OPERATOR_SUB = "11111111-1111-4111-8111-111111111111";
export const TENANT_ID = "22222222-2222-4222-8222-222222222222";
export const CALENDAR_ID = "33333333-3333-4333-8333-333333333333";
export const WORKER_ID = "44444444-4444-4444-8444-444444444444";
export const SECOND_WORKER_ID = "55555555-5555-4555-8555-555555555555";
export const SERVICE_ID = "66666666-6666-4666-8666-666666666666";
export const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
export const CUSTOMER_ID = "88888888-8888-4888-8888-888888888888";
export const ROLE_ID = "99999999-9999-4999-8999-999999999999";

/** A Monday, chosen so a weekly schedule's own day columns read naturally in a screenshot. */
export const SEED_DATE = "2026-09-07";

export const CONFIGURATION = {
  // `11-19` (`ago-root#350`): every free-text value here is Cyrillic, on purpose - the fourth gate
  // assertion's own precondition (`ux-gate/lib/i18nCompleteness.ts`'s own header). `publicKey` stays
  // as-is: a site key is a technical identifier rendered only inside `<pre>` (the install snippet),
  // exempt by tag regardless of script. `timeZone` stays as-is too: an IANA zone id is Latin-script by
  // the standard itself, named explicitly in that same file's exemption list.
  tenantName: "Салон «Тестовые ворота»",
  publicKey: "uxgate-public-key-0000",
  allowedOrigins: ["https://shop.example.invalid"],
  calendars: [
    {
      calendarId: CALENDAR_ID,
      name: "Основной зал",
      timeZone: "Europe/Moscow",
      isPublished: true,
      workerIds: [WORKER_ID, SECOND_WORKER_ID],
      workingHours: [],
    },
  ],
  workers: [
    { workerId: WORKER_ID, displayName: "Иванова А. П.", isActive: true, serviceIds: [SERVICE_ID] },
    { workerId: SECOND_WORKER_ID, displayName: "Петров С. С.", isActive: false, serviceIds: [] },
  ],
  services: [{ serviceId: SERVICE_ID, name: "Консультация", durationMinutes: 60 }],
};

export const WORKERS = [
  {
    workerId: WORKER_ID,
    lastName: "Иванова",
    firstName: "Анна",
    middleName: "Петровна",
    displayName: "Иванова А. П.",
    displayNameIsCustom: false,
    isActive: true,
    serviceIds: [SERVICE_ID],
    createdAt: `${SEED_DATE}T08:00:00+03:00`,
    updatedAt: `${SEED_DATE}T08:00:00+03:00`,
  },
  {
    workerId: SECOND_WORKER_ID,
    lastName: "Петров",
    firstName: "Сергей",
    middleName: null,
    displayName: "Петров С. С.",
    displayNameIsCustom: true,
    isActive: false,
    serviceIds: [],
    createdAt: `${SEED_DATE}T08:00:00+03:00`,
    updatedAt: `${SEED_DATE}T08:00:00+03:00`,
  },
];

export const WORKER_SCHEDULE = {
  scheduleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  workerId: WORKER_ID,
  kind: "Cycle" as const,
  cycleAnchor: SEED_DATE,
  cycleWorkingDays: 2,
  cycleRestDays: 2,
  cycleStartsAt: "09:00:00",
  cycleEndsAt: "18:00:00",
  slotMinutes: 30,
  bufferMinutes: 10,
  weeklyDays: [],
  materialiseFrom: SEED_DATE,
  horizonDays: 30,
  breaksCountAsWorkingTime: true,
};

export const WORKER_SLOTS = [0, 1, 2, 3, 4, 5].map((i) => ({
  eventId: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, "0")}`,
  localDate: SEED_DATE,
  weekday: 1,
  startsAt: `${SEED_DATE}T${String(9 + i).padStart(2, "0")}:00:00+03:00`,
  endsAt: `${SEED_DATE}T${String(9 + i).padStart(2, "0")}:30:00+03:00`,
  status: i % 3 === 0 ? "Booked" : "Available",
  serviceId: SERVICE_ID,
  bookingId: i % 3 === 0 ? BOOKING_ID : null,
}));

export const PENDING_BOOKINGS = [
  {
    bookingId: BOOKING_ID,
    calendarId: CALENDAR_ID,
    workerId: WORKER_ID,
    serviceId: SERVICE_ID,
    customerId: CUSTOMER_ID,
    startsAt: `${SEED_DATE}T09:00:00+03:00`,
    endsAt: `${SEED_DATE}T10:00:00+03:00`,
    localDate: SEED_DATE,
    confirmationDeadline: `${SEED_DATE}T08:30:00+03:00`,
    isOverdue: false,
    customerPhone: "+7 900 000-00-00",
    customerDisplayName: "Смирнова О. И.",
    slotCount: 2,
  },
];

export const CONTACTS = [
  {
    customerId: CUSTOMER_ID,
    phone: "+7 900 000-00-00",
    displayName: "Смирнова О. И.",
    notes: null,
    noShowCount: 0,
    // `11-19`: this fixture had drifted from `Contact`'s own current shape (`calendarApi.ts`) - no
    // `firstSeenAt`/`lastSeenAt` at all, plus four fields (`bookingsTotal`/`bookingsConfirmed`/
    // `bookingsCancelled`/`lastBookingAt`) `ContactsPage.tsx` never reads and the interface no longer
    // declares. `apiStubs.ts` returns fixture bodies as `unknown`, so nothing caught the mismatch at
    // compile time - `ContactsPage.tsx`'s own `new Date(contact.firstSeenAt)` silently produced
    // `Invalid Date` (rendered as the literal English words "Invalid Date"), which is exactly how
    // `ux-gate`'s own fourth assertion (`ago-root#350`) found it: a real, pre-existing fixture defect
    // this item surfaced as a side effect, not a translation gap. Corrected to the real contract.
    firstSeenAt: `${SEED_DATE}T09:00:00+03:00`,
    lastSeenAt: `${SEED_DATE}T09:00:00+03:00`,
  },
];

export const ROLES = [
  // `11-19`: "Owner" reseeded to Cyrillic, the same reasoning as `CONFIGURATION.tenantName` above - a
  // role's name is server-held data (`Role.Create` accepts any string), not interface chrome, and the
  // whole point of seeding every fixture in Cyrillic is that it stays that way regardless.
  { roleId: ROLE_ID, name: "Владелец", permissions: ["customer:read", "booking:write", "schedule:write"] },
];

export const OPERATORS = [
  {
    operatorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    displayName: "Иванова Анна",
    isAccountOwner: true,
    isInvited: false,
    invitedEmail: null,
    roleIds: [ROLE_ID],
  },
  {
    operatorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    displayName: "Петров Сергей",
    isAccountOwner: false,
    isInvited: true,
    invitedEmail: "invited@example.invalid",
    roleIds: [],
  },
];
