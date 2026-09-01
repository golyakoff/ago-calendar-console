import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bodyOf, urlOf } from "../testing/urlOf.js";
import {
  CalendarApiError,
  createCalendar,
  getConfiguration,
  getPendingBookings,
  rejectBooking,
  setAllowedOrigins,
} from "./calendarApi.js";

/**
 * The console's whole conversation with `Ago.Calendar.Api`.
 *
 * <b>The first test is the one that matters.</b> Every other assertion here is about plumbing; that
 * one is about isolation. The tenant must never appear in a request this console builds - it comes
 * off the operator's own token, resolved server-side against `ago-calendar`'s own `operators` table -
 * and a console that could name a tenant would be a console that could name somebody else's.
 */
describe("the calendar console API client", () => {
  const token = "operator-token";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({}))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("never names a tenant in a URL or a body", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);

    await getConfiguration(token);
    await createCalendar(token, { name: "Main", timeZone: "Europe/Moscow", publish: true });
    await setAllowedOrigins(token, ["https://shop.example"]);
    await rejectBooking(token, "11111111-1111-1111-1111-111111111111");

    for (const [url, init] of fetchMock.mock.calls) {
      const target = urlOf(url);
      const body = bodyOf(init);

      expect(target.toLowerCase()).not.toContain("tenant");
      expect(body.toLowerCase()).not.toContain("tenant");
    }
  });

  it("sends the token it was handed, on every call", async () => {
    // A parameter, never a module-level capture: silent renewal replaces the token on its own
    // schedule, and `ago-console` shipped the captured-token defect once (`5-16`).
    const fetchMock = vi.mocked(globalThis.fetch);

    await getConfiguration(token);
    await getPendingBookings("a-newer-token");

    expect(headerOf(fetchMock.mock.calls[0][1], "Authorization")).toBe(`Bearer ${token}`);
    expect(headerOf(fetchMock.mock.calls[1][1], "Authorization")).toBe("Bearer a-newer-token");
  });

  it("addresses the console's own route group under the configured origin", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);

    await getPendingBookings(token);

    expect(urlOf(fetchMock.mock.calls[0][0])).toBe(
      "https://calendar.test.invalid/api/v1/console/pending-bookings",
    );
  });

  it("carries the server's stable problem-details type through, not just its message", async () => {
    // api-design.md: "clients branch on `type`, never on the message". A client that only kept the
    // message would have to string-match to tell a permission failure from a lost race.
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ type: "configuration.forbidden", detail: "Nope." }), {
            status: 403,
            headers: { "Content-Type": "application/problem+json" },
          }),
        ),
      ),
    );

    const failure = await rejectBooking(token, "x").catch((reason: unknown) => reason);

    expect(failure).toBeInstanceOf(CalendarApiError);
    expect((failure as CalendarApiError).code).toBe("configuration.forbidden");
    expect((failure as CalendarApiError).message).toBe("Nope.");
    expect((failure as CalendarApiError).status).toBe(403);
  });

  it("turns a 401 into a sentence about the session rather than an empty problem body", async () => {
    // A 401 is the framework refusing before any of this product's code ran, so there is no
    // problem-details body to parse and nothing useful to show from one.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))));

    const failure = (await getConfiguration(token).catch((reason: unknown) => reason)) as CalendarApiError;

    expect(failure.code).toBe("auth.unauthenticated");
    expect(failure.message).toContain("Sign in again");
  });

  it("survives an error response with no JSON body at all", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("<html>502</html>", { status: 502 }))));

    const failure = (await getConfiguration(token).catch((reason: unknown) => reason)) as CalendarApiError;

    expect(failure.code).toBe("http.502");
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.[name];
}
