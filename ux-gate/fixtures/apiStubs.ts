/**
 * `15-11`: every REST call the gated screens make, answered locally.
 *
 * One interception over `**()/api/v1/console/**` rather than a route per endpoint: `calendarApi.ts`
 * composes every request through a single `request(token, method, path)` helper against one base
 * (`${apiBaseUrl}/api/v1/console`), so matching that base is matching all of them - and an endpoint
 * added later reaches this dispatcher rather than escaping to a real network, which is the failure
 * mode worth designing against. Anything unrecognised is answered `404` **loudly** rather than with
 * an empty `200`: a screen that renders fine against silently-empty data would let this gate pass
 * over a screen the product could never show.
 */
import type { Page } from "@playwright/test";
import {
  CONFIGURATION,
  CONTACTS,
  OPERATORS,
  PENDING_BOOKINGS,
  ROLES,
  WORKERS,
  WORKER_SCHEDULE,
  WORKER_SLOTS,
} from "./data.js";

const CONSOLE_BASE = "/api/v1/console";

function bodyFor(pathname: string): unknown {
  const rest = pathname.slice(pathname.indexOf(CONSOLE_BASE) + CONSOLE_BASE.length);

  if (rest === "/configuration") return CONFIGURATION;
  if (rest === "/pending-bookings") return PENDING_BOOKINGS;
  if (rest === "/contacts") return CONTACTS;
  if (rest === "/roles") return ROLES;
  if (rest === "/operators") return OPERATORS;
  if (rest === "/workers") return WORKERS;

  // `/workers/{id}`, `/workers/{id}/schedule`, `/workers/{id}/slots` - matched on shape rather than
  // on the seeded id, so a screen that navigates to a worker this fixture set does not know about
  // still renders instead of hanging on a pending request.
  const worker = /^\/workers\/[^/]+(\/(schedule|slots))?$/.exec(rest);
  if (worker) {
    if (worker[2] === "schedule") return WORKER_SCHEDULE;
    if (worker[2] === "slots") return WORKER_SLOTS;
    return WORKERS[0];
  }

  return undefined;
}

export async function stubConsoleApi(page: Page): Promise<void> {
  await page.route(`**${CONSOLE_BASE}/**`, async (route) => {
    const request = route.request();

    // Writes are accepted and answered empty. This gate never asserts on a mutation's result - it
    // renders screens and measures them - and a rejected write would leave a screen showing an error
    // banner, which is a different screen from the one being measured.
    if (request.method() !== "GET") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    const body = bodyFor(new URL(request.url()).pathname);
    if (body === undefined) {
      await route.fulfill({
        status: 404,
        contentType: "application/problem+json",
        body: JSON.stringify({
          title: "ux-gate: no stub for this endpoint",
          detail: `${request.method()} ${request.url()} - add it to ux-gate/fixtures/apiStubs.ts`,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
