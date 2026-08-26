# ago-calendar-console

AGO Calendar's operator console: tenant setup, the shared pending-bookings queue, and the two manual
availability edits. A React + Vite SPA talking to `Ago.Calendar.Api`.

Part of the [AGO Platform](https://github.com/golyakoff/ago-root) project. The rules, decisions and
backlog live in `ago-root`; this repository holds only this bundle.

## Why this is its own repository and not a page in `ago-console`

Decided in `ago-root/docs/adr/0064`, by `repositories.md`'s own test — **a thing gets its own
repository when it versions or deploys independently.** This bundle tracks `Ago.Calendar.Api`'s
contract; `ago-console` tracks `Ago.Chat.Api`'s. They are two products with two databases, two
release cadences and two images, and one shared bundle would mean a calendar change rebuilding and
redeploying the chat console.

The decision has a real cost and the ADR states it rather than hiding it: the OIDC plumbing here
(`src/auth/`) is `ago-console`'s, copied. That is the second time this project has accepted a
duplication of that kind — `adr/0027` accepted the first, in the claims transformation — and it is
recorded as a cost, not a coincidence.

**The framework is not a new decision.** `adr/0023` chose React for `ago-console`; this reuses it
unchanged, and `20-06` says explicitly that it is not re-litigating that choice.

## Running it

```bash
cd ago-calendar-console
cp .env.example .env.local     # nothing in it is a secret; see the file's own comments
npm install
npm run dev
```

It needs `Ago.Calendar.Api` running and reachable at `VITE_API_BASE_URL`, and its origin listed in
that API's `Operator:ConsoleOrigins` — the console's origin is *configuration*, deliberately not
something a tenant can add to its own allowed-origins list. See
`ago-root/docs/runbooks/local-dev.md`.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## What is deliberately not here

- **No `.env.production`.** AGO Calendar has no deployment, and committing one would mean inventing
  an API origin and a Keycloak issuer for a cluster that does not run this product. The Dockerfile
  says the same thing at more length, including why `adr/0051` forbids solving it with a build
  argument.
- **No image publish in CI.** Nothing deploys this image yet. A job that pushed one nobody pulls
  would be ceremony that looks like infrastructure.
- **No delete, anywhere.** Workers, calendars and services are deactivated or unpublished, never
  removed: a booked history is what a customer's lead card is for.
