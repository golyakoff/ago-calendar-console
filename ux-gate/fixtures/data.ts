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
  tenantName: "UX Gate Salon",
  publicKey: "uxgate-public-key-0000",
  allowedOrigins: ["https://shop.example.invalid"],
  calendars: [
    {
      calendarId: CALENDAR_ID,
      name: "Main room",
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
    bookingsTotal: 4,
    bookingsConfirmed: 3,
    bookingsCancelled: 1,
    noShowCount: 0,
    lastBookingAt: `${SEED_DATE}T09:00:00+03:00`,
  },
];

export const ROLES = [
  { roleId: ROLE_ID, name: "Owner", permissions: ["customer:read", "booking:write", "schedule:write"] },
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
