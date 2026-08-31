import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueuePage } from "./QueuePage.js";
import { renderWithAuth } from "../testing/renderWithAuth.js";
import type { PendingBooking } from "../api/calendarApi.js";
import { urlOf } from "../testing/urlOf.js";

/**
 * `20-06`'s second Done-when, at the console's own level: the queue spans every calendar, and an
 * operator can reject from it.
 *
 * Two calendars in the fixture, deliberately - the item's own parenthesis. A queue that were scoped
 * to one calendar would pass a single-calendar test and fail the product.
 */
describe("the pending-bookings queue", () => {
  const rows: PendingBooking[] = [
    booking("b1", "cal-1", "2026-05-05T09:00:00+00:00", "2026-05-05T08:15:00+00:00", false),
    booking("b2", "cal-2", "2026-05-05T11:00:00+00:00", "2026-05-05T08:45:00+00:00", false),
  ];

  let remaining: PendingBooking[];

  beforeEach(() => {
    remaining = [...rows];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
        const target = urlOf(url);

        if (target.endsWith("/reject")) {
          const id = target.split("/").at(-2);
          remaining = remaining.filter((row) => row.bookingId !== id);
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        if (init?.method === undefined || init.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(remaining), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
  });

  afterEach(() => {
    // Explicit, because Testing Library only registers its own automatic cleanup when vitest's
    // globals are on - and they are not here. Without it the previous test's table is still in the
    // document and every query finds two of everything, which is how this was noticed.
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows bookings from every calendar the tenant has, not just one", async () => {
    renderWithAuth(<QueuePage />);

    await screen.findByText("cal-1");
    expect(screen.getByText("cal-2")).toBeDefined();
  });

  it("rejects a booking and drops it from the queue", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    renderWithAuth(<QueuePage />);
    await screen.findByText("cal-1");

    await userEvent.click(screen.getAllByRole("button", { name: "Reject" })[1]);

    await waitFor(() => {
      expect(screen.queryByText("cal-2")).toBeNull();
    });

    // The row left because the server said so and the queue was re-read - not because the component
    // removed it optimistically. An optimistic removal would hide a rejection the server refused.
    expect(
      fetchMock.mock.calls.some(([url]) => urlOf(url).includes("/bookings/b2/reject")),
    ).toBe(true);
    expect(screen.getByText("cal-1")).toBeDefined();
  });

  it("shows an overdue row loudly instead of hiding it", async () => {
    // An overdue row means the confirmation sweep is not running, and the customer has already been
    // told they are booked. Filtering these out would make a broken sweep invisible to the only
    // person in a position to notice (`20-04`).
    remaining = [booking("b3", "cal-1", "2026-05-05T09:00:00+00:00", "2026-05-05T08:15:00+00:00", true)];

    renderWithAuth(<QueuePage />);

    await screen.findByText(/the sweep is not running/i);
  });

  it("says what the server said when an action is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL) => {
        if (urlOf(url).endsWith("/reject")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ type: "booking.invalid_state", detail: "That booking was already confirmed." }),
              { status: 409, headers: { "Content-Type": "application/problem+json" } },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }),
    );

    renderWithAuth(<QueuePage />);
    await screen.findByText("cal-1");

    await userEvent.click(screen.getAllByRole("button", { name: "Reject" })[0]);

    // Losing a race with the sweep is an ordinary outcome, and the server's own wording is what the
    // operator needs - not a generic "something went wrong".
    await screen.findByText("That booking was already confirmed.");
  });

  it("shows the phone when the server includes it", async () => {
    remaining = [booking("b4", "cal-1", "2026-05-05T09:00:00+00:00", "2026-05-05T08:15:00+00:00", false, "+79990000001")];

    renderWithAuth(<QueuePage />);

    await screen.findByText("+79990000001");
  });

  it("shows 'hidden', not a blank cell, when the server omits the phone", async () => {
    // `20-12`: a `null` phone means the operator does not hold `customer:read`, never "no phone
    // recorded" - Customer.Phone is not nullable, so the console must never render that state as an
    // empty cell indistinguishable from "nothing to show".
    remaining = [booking("b5", "cal-1", "2026-05-05T09:00:00+00:00", "2026-05-05T08:15:00+00:00", false, null)];

    renderWithAuth(<QueuePage />);

    await screen.findByText("hidden");
  });

  it("explains a permission failure in words an operator can act on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              type: "booking.forbidden",
              detail: "This operator does not hold 'booking:reject' for this tenant.",
            }),
            { status: 403, headers: { "Content-Type": "application/problem+json" } },
          ),
        ),
      ),
    );

    renderWithAuth(<QueuePage />);

    // The server names a permission string; the operator cannot act on that, so this is the one code
    // the console rewords.
    await screen.findByText(/does not have permission/i);
  });
});

function booking(
  bookingId: string,
  calendarId: string,
  startsAt: string,
  confirmationDeadline: string,
  isOverdue: boolean,
  phone: string | null = null,
): PendingBooking {
  return {
    bookingId,
    calendarId,
    workerId: "w1",
    serviceId: "s1",
    customerId: "c1",
    startsAt,
    endsAt: startsAt,
    localDate: "2026-05-05",
    confirmationDeadline,
    isOverdue,
    phone,
  };
}
