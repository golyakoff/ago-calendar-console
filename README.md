# ago-calendar-console (retired)

This repository has been retired. It held AGO Calendar's operator console — tenant setup, the shared
pending-bookings queue, workers and their schedules, availability edits, the contacts report, and
access control — a React + Vite SPA talking to `Ago.Calendar.Api`.

## Where the screens went

The six screens moved into [`ago-console`](https://github.com/golyakoff/ago-console), gated by the
`calendar:configure` permission, under `/calendar`:

| Screen | Was here | Now in `ago-console` |
|---|---|---|
| Queue | `src/pages/QueuePage.tsx` | `src/pages/CalendarQueuePage.tsx` |
| Setup | `src/pages/ConfigurationPage.tsx` | `src/pages/CalendarSetupPage.tsx` |
| Workers | `src/pages/WorkersPage.tsx` | `src/pages/CalendarWorkersPage.tsx` |
| Availability | `src/pages/AvailabilityPage.tsx` | `src/pages/CalendarAvailabilityPage.tsx` |
| Contacts | `src/pages/ContactsPage.tsx` | `src/pages/CalendarContactsPage.tsx` |
| Access | `src/pages/AccessPage.tsx` | `src/pages/CalendarAccessPage.tsx` |

Two drill-down routes moved with them: a worker's materialised slots
(`WorkerSlotsPage.tsx` → `CalendarWorkerSlotsPage.tsx`) and the schedule re-cut screen
(`WorkerRecutPage.tsx` → `CalendarWorkerRecutPage.tsx`), both reachable only from the Workers screen,
neither with a navigation entry of its own — unchanged from how they worked here.

Every screen was rewritten against `ago-console`'s own closed set of eleven UI components
(`adr/0030`) rather than carried over as bare-HTML markup, and every screen's tests moved with it.
The API client (`src/api/calendarApi.ts`), the i18n catalogue (English and Russian), and the
`ux-gate` accessibility/i18n-completeness gate all moved and merged into `ago-console`'s own
equivalents.

**`Ago.Calendar.Api` itself did not move and did not change.** The console merged; the API did not —
it keeps its own repository, its own database, and its own deployment
(`calendar-api.reserve-me.ru`). `ago-console` talks to it through its own second API origin
(`VITE_CALENDAR_API_BASE_URL`), the same shape `ago-console` already used for `ago-faq`'s backend.

## Why

`docs/adr/0093-tenancy-and-identity-unify-domains-stay-apart.md` (`ago-root`) is the decision: domains
stay apart, but tenancy, identity, the role catalogue and the console unify across products. A
product's screens now live in `ago-console`, permission-gated, talking to that product's own API
origin — the shape `ago-faq` already shipped, generalised here to AGO Calendar. `docs/adr/0064`
recorded this repository's own reason for existing in the first place — a thing gets its own
repository when it versions or deploys independently — and that reasoning never applied to the
*console*, only to the fact that two products have two APIs. Bare product names retired from the
console's own hostname scheme at the same time (`adr/0091`); `office.reserve-me.ru` is now the one
console for every product.

Carried out by `docs/backlog/22-06-one-console.md` (`ago-root#371`).

## What is left here, and why

Only this file and `LICENSE`. Every application source file, build and deploy config
(`package.json`, `vite.config.ts`, `tsconfig*.json`, `Dockerfile`, `nginx.conf`, `eslint.config.js`,
`index.html`), CI workflow and Dependabot config has been removed — there is nothing left to build,
test, lint or deploy, and keeping any of it would only invite someone to run a command against a
repository that no longer does anything.

**This repository has not been archived.** Archiving is a GitHub setting only the repository's owner
can set, and stripping the source is the reversible half of retiring it — the git history, every past
commit and this repository's own identity are untouched. Archiving it (or deleting it, should that
ever be wanted) is the author's own action to take, not this change's.
