/**
 * `20-06`'s console had no string table at all - every label written inline in English, which is how
 * `15-11`'s own gate screenshots produced `Иванова А. П.'s slots`: a Cyrillic customer name carrying
 * an English possessive baked into the template around it. `11-15` gives this console the same
 * mechanism `ago-console` already proved out (`11-11`/`11-12`/`11-13`) - a flat interface, not a
 * framework, mirrored rather than reinvented: `ago-console/src/i18n/strings.ts`'s own doc comment
 * makes the identical call, "the same small string table `ago-widget`'s own `11-10` already proved
 * in production."
 *
 * <b>Only interface chrome lives here.</b> A customer's name, a worker's name, a service name, a
 * phone number, a server-assigned status enum's own wire value, and a server's own `detail` message
 * all come from data and stay exactly as the API sent them - `errorMessage.ts`'s own remarks give the
 * one exception (the two sentences this console composes itself, `permissionDeniedError`/
 * `networkError`, translated here; everything else the server says passes through untouched).
 *
 * <b>Interpolated values are composed at the call site against fixed fragments here</b> - a site id's
 * prefix, a count, a worker's display name - never a function stored in the table, the identical
 * choice `ago-console`'s own table made. `slotsHeadingPrefix`/`slotsHeadingSuffix` is the one field
 * pair that exists *because of* that discipline: English wraps a name in a possessive suffix
 * (`{name}’s slots`), Russian puts the fixed phrase before the name instead
 * (`{prefix}{name}`) - a single field holding `"’s slots"` could never have been given a Russian
 * value that reads as a sentence, which is exactly the bug this item exists to fix.
 */
export interface ConsoleStrings {
  /** `11-19`: the BCP-47 tag driving every `Intl`/`toLocaleString` call in this bundle
   * (`i18n/format.tsx`'s own `formatDateTime`/`formatTime`/`formatDate`) - not interface chrome
   * itself (nothing here is displayed), but the one piece of locale metadata every raw date-
   * formatting call in this codebase was missing before this item, which is exactly how a Russian
   * screen ended up showing an English "AM"/"PM" marker (`WorkersTable.tsx`'s `formatDate`,
   * `QueuePage.tsx`'s inline calls, both found by running `ux-gate`'s own fourth assertion for real).
   * Lives on this table, alongside the strings it formats around, rather than as a second lookup
   * keyed off `SupportedLocale` separately - one place per locale, the same discipline `resolve.ts`'s
   * own `getStrings` already established. */
  intlLocale: string;

  // --- Shell (App.tsx) ---
  navQueue: string;
  navSetup: string;
  navWorkers: string;
  navAvailability: string;
  navContacts: string;
  navAccess: string;
  signOut: string;
  /** `11-14`: the hamburger button's own accessible name at mobile widths, reused as `NavDrawer`'s
   * `aria-label` too - the button says what it opens, the dialog it opens says what it is, and today
   * that is the same phrase for both. */
  navMenuLabel: string;

  // --- Auth (RequireAuth.tsx / SignInCallbackPage.tsx) ---
  checkingSession: string;
  signInTitle: string;
  signInDescription: string;
  signInButton: string;
  signingIn: string;
  signInFailedTitle: string;
  signInFailedDefaultError: string;

  // --- Shared across screens ---
  loading: string;
  cancelButton: string;
  deleteButton: string;
  backButton: string;
  refreshButton: string;
  saveButton: string;
  /** The boolean-flag word, reused for `WorkerCard`'s "Active" checkbox, `WorkersTable`'s "Active"/
   * "Inactive" column value, and `AccessPage`'s operator status column. */
  activeLabel: string;
  inactiveLabel: string;
  workerFieldLabel: string;
  dayFieldLabel: string;
  opensFieldLabel: string;
  closesFieldLabel: string;
  fromFieldLabel: string;
  toFieldLabel: string;
  /** `WorkerSlotsPage`'s hidden-phone/hidden-customer cell and `WorkerRecutPage`'s own copy of the
   * identical rule - never used for a genuinely empty cell (that renders a plain dash instead). */
  hiddenContactLabel: string;
  hiddenContactTooltip: string;
  weekdaySunday: string;
  weekdayMonday: string;
  weekdayTuesday: string;
  weekdayWednesday: string;
  weekdayThursday: string;
  weekdayFriday: string;
  weekdaySaturday: string;

  // --- errorMessage.ts ---
  /** The one message this console composes itself for a `*.forbidden` code - every other server
   * message passes through verbatim (`errorMessage.ts`'s own remarks). */
  permissionDeniedError: string;
  networkError: string;

  // --- QueuePage (/) ---
  queueTitle: string;
  queueDescription: string;
  queueEmpty: string;
  queueColumnWhen: string;
  queueColumnCalendar: string;
  queueColumnPhone: string;
  queueColumnDeadline: string;
  queueColumnActions: string;
  queueOverdueNote: string;
  rejectButton: string;
  noShowButton: string;

  // --- ConfigurationPage (/setup) ---
  setupEmbedDescription: string;
  setupEmbedSnippetAriaLabel: string;
  setupOriginsTitle: string;
  setupOriginsDescription: string;
  setupOriginsFieldLabel: string;
  setupSaveOriginsButton: string;
  setupCalendarsTitle: string;
  publishedLabel: string;
  notPublishedLabel: string;
  setupCalendarNameLabel: string;
  setupCalendarZoneLabel: string;
  setupCalendarPublishedLabel: string;
  setupAddCalendarButton: string;
  setupServicesTitle: string;
  setupServiceMinutesSuffix: string;
  setupServiceNameLabel: string;
  setupServiceDurationLabel: string;
  setupAddServiceButton: string;
  setupWorkingHoursTitle: string;
  setupWorkingHoursDescription: string;
  setupNoWorkersNote: string;
  setupAddWorkingHoursButton: string;
  setupWorkerNotOnCalendarNote: string;

  // --- WorkersPage (/workers) ---
  workersTitle: string;
  editButton: string;
  scheduleButton: string;
  slotsLinkLabel: string;
  recutLinkLabel: string;
  addWorkerButton: string;
  workersNoCalendarNote: string;
  newWorkerTitle: string;
  editWorkerTitle: string;
  viewSlotsLinkLabel: string;
  workersDeleteConfirmPrefix: string;
  workersDeleteConfirmSuffix: string;

  // --- WorkerCard.tsx ---
  lastNameFieldLabel: string;
  firstNameFieldLabel: string;
  middleNameFieldLabel: string;
  displayNameFieldLabel: string;
  displayNameCustomNote: string;
  displayNameDerivedNote: string;
  calendarFieldLabel: string;
  servicesPerformedLegend: string;
  /** Distinct from `workersNoCalendarNote` (`WorkersPage`'s own version names the Setup screen by
   * name) - this one is the card's own copy, shown only when a worker card is opened in `create`
   * mode with zero calendars configured, which today `WorkersPage` already guards against before
   * ever opening the card - kept because the card can be reached with no such guard in principle. */
  workerCardNoCalendarNote: string;

  // --- WorkersTable.tsx ---
  workersEmpty: string;
  workersColumnName: string;
  workersColumnActive: string;
  workersColumnCreated: string;
  workersColumnUpdated: string;
  workersColumnActions: string;
  backfilledNameTooltip: string;
  needsCorrectionLabel: string;

  // --- WorkerScheduleSection.tsx ---
  scheduleSectionTitle: string;
  scheduleEmptyNote: string;
  templateFieldLabel: string;
  weeklyTemplateOption: string;
  cycleTemplateOption: string;
  switchingToWeeklyNote: string;
  cycleAnchorFieldLabel: string;
  cycleWorkingDaysFieldLabel: string;
  cycleRestDaysFieldLabel: string;
  cycleShiftPatternNote: string;
  weeklyHoursNote: string;
  slotLengthFieldLabel: string;
  slotLengthNote: string;
  bufferFieldLabel: string;
  bufferCountsTowardDurationLabel: string;
  /** The worked-example sentence: `{arithmeticExamplePrefix}{N}{arithmeticExampleUnitSuffix}{count}
   * {slotWordOne|Few|Many}, {start}–{end}.` - see this file's own header for why a fixed suffix,
   * rather than a possessive-style field, is what lets English and Russian word order differ. */
  arithmeticExamplePrefix: string;
  arithmeticExampleUnitSuffix: string;
  /** Russian's three-way plural (1 / 2-4 / 5+). English has no "few" form of its own, so its table
   * fills all three with whichever of "slot"/"slots" is grammatical - the interface offers what each
   * locale's own grammar needs, not a lowest common denominator. */
  slotWordOne: string;
  slotWordFew: string;
  slotWordMany: string;
  horizonFieldLabel: string;
  horizonCapPrefix: string;
  horizonCapSuffix: string;
  materializeFromFieldLabel: string;
  materializeFromCannotMoveEarlierPrefix: string;
  materializeFromCannotMoveEarlierSuffix: string;
  scheduleRecutNotePrefix: string;
  scheduleRecutLinkLabel: string;
  scheduleRecutNoteSuffix: string;
  createScheduleButton: string;
  saveScheduleButton: string;

  // --- WorkerSlotsPage (/workers/:id/slots) ---
  slotsHeadingPrefix: string;
  slotsHeadingSuffix: string;
  slotsHeadingFallback: string;
  slotsDescription: string;
  slotsTimezoneNotePrefix: string;
  slotsTimezoneNoteSuffix: string;
  slotsEmpty: string;
  slotsColumnDate: string;
  slotsColumnWeekday: string;
  slotsColumnTime: string;
  slotsColumnStatus: string;
  slotsColumnService: string;
  slotsColumnCustomer: string;
  slotsColumnPhone: string;
  /** `WorkerSlot.status`'s six wire values - a fixed server-defined enumeration, not free text, so it
   * is chrome the same way `ago-console`'s own `outcomeConverted`/`outcomeUnset` are. */
  slotStatusAvailable: string;
  slotStatusPendingConfirmation: string;
  slotStatusBooked: string;
  slotStatusCancelled: string;
  slotStatusNoShow: string;
  slotStatusBlocked: string;

  // --- WorkerRecutPage (/workers/:id/recut) ---
  recutTitle: string;
  recutDescription: string;
  recutFromFieldLabel: string;
  previewButton: string;
  recutDoneTitle: string;
  recutSummaryDaysRecutSuffix: string;
  recutSummaryDaysLeftSuffix: string;
  recutSummarySlotsDeletedSuffix: string;
  recutSummarySlotsInsertedSuffix: string;
  recutSummaryBookingsCancelledSuffix: string;
  recutLeftInOldGridPrefix: string;
  recutLeftInOldGridSuffix: string;
  recutNothingGeneratedNote: string;
  recutDayKeptNote: string;
  recutDaySlotsToDeleteSuffix: string;
  recutNoBookingsNote: string;
  reviewAndConfirmButton: string;
  recutChooseDecisionNote: string;
  recutConfirmTitle: string;
  recutConfirmPrefix: string;
  recutConfirmDaysSuffix: string;
  recutConfirmSlotsSuffix: string;
  recutConfirmBookingsSuffix: string;
  recutConfirmSkippedSuffix: string;
  recutCannotBeUndoneNote: string;
  confirmRecutButton: string;
  cancelDecisionLabel: string;
  keepDecisionLabel: string;
  alreadyNoShowNote: string;

  // --- AvailabilityPage (/availability) ---
  availabilityNoWorkersNote: string;
  closeDayTitle: string;
  closeDayDescription: string;
  closeDayButton: string;
  closeDayDoneMessage: string;
  changeDayHoursTitle: string;
  changeDayHoursDescription: string;
  applyNewHoursButton: string;
  changeDayHoursDoneMessage: string;

  // --- ContactsPage (/contacts) ---
  contactsTitle: string;
  contactsDescription: string;
  contactsEmpty: string;
  contactsColumnPhone: string;
  contactsColumnName: string;
  contactsColumnNotes: string;
  contactsColumnNoShows: string;
  contactsColumnFirstSeen: string;
  contactsColumnLastSeen: string;
  notRecordedLabel: string;

  // --- AccessPage (/access) ---
  rolesTitle: string;
  addRoleButton: string;
  addRoleDescription: string;
  /** The name this console itself gives the role it creates - persisted server-side afterward, but
   * chosen by this bundle rather than typed by the tenant, so it is chrome (this file's own header)
   * translated the same as any other button label, not data left as the server returned it. */
  addRoleTemplateName: string;
  operatorsTitle: string;
  nameFieldLabel: string;
  emailFieldLabel: string;
  invitePlaceholderName: string;
  invitePlaceholderEmail: string;
  inviteButton: string;
  inviteNote: string;
  accessColumnOperator: string;
  accessColumnStatus: string;
  accessColumnRoles: string;
  accountOwnerSuffix: string;
  invitedStatusLabel: string;
}
