import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkerRecutPage } from "./WorkerRecutPage.js";
import { renderWithAuth } from "../testing/renderWithAuth.js";
import { bodyOf, urlOf } from "../testing/urlOf.js";
import type { RecutBookingPreview, RecutDayPreview } from "../api/calendarApi.js";

/**
 * `20-16`'s own console-level Done-when: the preview shows every affected day and every booking on
 * it with a cancel/keep control (or none at all for a no-show), the "Confirm" step is unreachable
 * until every decidable booking has a choice, and it names counts before the destructive call fires.
 * `Ago.Calendar.Integration.Tests.RecutScheduleTests` proves the same data end to end against a real
 * Postgres; this is the half that suite cannot see - what the console renders and refuses to let an
 * operator skip.
 */
describe("the re-cut schedule screen", () => {
  let previewDays: RecutDayPreview[];
  let confirmRequests: { method: string; url: string; body: unknown }[];
  let confirmStatus: number;
  let confirmBody: unknown;

  beforeEach(() => {
    previewDays = [];
    confirmRequests = [];
    confirmStatus = 200;
    confirmBody = { recutDays: ["2026-05-05"], skippedDays: [], slotsDeleted: 9, slotsInserted: 18, bookingsCancelled: 0 };

    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
        const target = urlOf(url);
        const method = init?.method ?? "GET";

        if (method === "POST" && target.includes("/schedule/recut/preview")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ days: previewDays, fingerprint: "fp-1" }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }

        if (method === "POST" && target.endsWith("/schedule/recut")) {
          confirmRequests.push({ method, url: target, body: JSON.parse(bodyOf(init)) as unknown });
          if (confirmStatus === 200) {
            return Promise.resolve(
              new Response(JSON.stringify(confirmBody), { status: 200, headers: { "Content-Type": "application/json" } }),
            );
          }

          return Promise.resolve(
            new Response(
              JSON.stringify({ type: "recut.stale", detail: "The bookings in this range changed since the preview was generated." }),
              { status: 409, headers: { "Content-Type": "application/problem+json" } },
            ),
          );
        }

        return Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function render() {
    return renderWithAuth(<WorkerRecutPage />, {}, { path: "/workers/:workerId/recut", route: "/workers/w1/recut" });
  }

  it("shows an affected day's slot count once previewed", async () => {
    previewDays = [day({ localDate: "2026-05-05", availableSlotsToDelete: 9, bookings: [] })];
    render();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    await screen.findByText("2026-05-05");
    expect(screen.getByText(/9 free slot/)).toBeDefined();
  });

  it("offers a cancel/keep control for a decidable booking, and shows name and phone when permitted", async () => {
    previewDays = [
      day({
        localDate: "2026-05-05",
        bookings: [booking({ bookingId: "b1", customerDisplayName: "Dana", phone: "+79990000001" })],
      }),
    ];
    render();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    await screen.findByText("Dana");
    expect(screen.getByText("+79990000001")).toBeDefined();
    expect(screen.getByRole("radio", { name: "Cancel" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "Keep" })).toBeDefined();
  });

  it("shows 'hidden', not the name, when the server withheld contact data", async () => {
    previewDays = [
      day({ localDate: "2026-05-05", bookings: [booking({ customerId: "c1", customerDisplayName: null, phone: null })] }),
    ];
    render();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    const hidden = await screen.findAllByText("hidden");
    expect(hidden.length).toBe(2);
  });

  it("offers no control at all for a no-show, and says why", async () => {
    previewDays = [
      day({
        localDate: "2026-05-05",
        bookings: [booking({ bookingId: "b1", status: "NoShow", canDecide: false })],
      }),
    ];
    render();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    await screen.findByText(/cannot be cancelled/);
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("keeps 'Review & confirm' disabled until every decidable booking has a decision", async () => {
    previewDays = [
      day({ localDate: "2026-05-05", bookings: [booking({ bookingId: "b1" }), booking({ bookingId: "b2" })] }),
    ];
    render();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await screen.findByText("2026-05-05");

    const confirmButton = screen.getByRole("button", { name: /Review & confirm/ });
    expect(confirmButton).toHaveProperty("disabled", true);

    const cancelRadios = screen.getAllByRole("radio", { name: "Cancel" });
    await userEvent.click(cancelRadios[0]);
    expect(confirmButton).toHaveProperty("disabled", true);

    await userEvent.click(cancelRadios[1]);
    expect(confirmButton).toHaveProperty("disabled", false);
  });

  it("names the counts before the destructive call, and only fires it on the second click", async () => {
    previewDays = [
      day({ localDate: "2026-05-05", availableSlotsToDelete: 9, bookings: [booking({ bookingId: "b1" })] }),
      day({ localDate: "2026-05-06", availableSlotsToDelete: 18, bookings: [] }),
    ];
    render();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await screen.findByText("2026-05-05");
    await userEvent.click(screen.getByRole("radio", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: /Review & confirm/ }));

    await screen.findByRole("heading", { name: "Confirm re-cut" });
    expect(confirmRequests.length).toBe(0);
    // Two days re-cut, one booking cancelled - named before the operator can press the real button.
    expect(screen.getByText("2", { selector: "strong" })).toBeDefined();
    expect(screen.getByText("1", { selector: "strong" })).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "Confirm re-cut" }));

    await waitFor(() => expect(confirmRequests.length).toBe(1));
    const sent = confirmRequests[0].body as { from: string; fingerprint: string; decisions: unknown };
    expect(typeof sent.from).toBe("string");
    expect(sent.fingerprint).toBe("fp-1");
    expect(sent.decisions).toEqual([{ bookingId: "b1", decision: "Cancel" }]);
  });

  it("shows the result summary once the recut actually applies", async () => {
    previewDays = [day({ localDate: "2026-05-05", bookings: [] })];
    render();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await screen.findByText("2026-05-05");
    await userEvent.click(screen.getByRole("button", { name: /Review & confirm/ }));
    await screen.findByRole("heading", { name: "Confirm re-cut" });
    await userEvent.click(screen.getByRole("button", { name: "Confirm re-cut" }));

    await screen.findByText("Done");
    expect(screen.getByText(/1 day\(s\) re-cut/)).toBeDefined();
  });

  it("sends the operator back to a fresh preview, rather than retrying, when the booking set went stale", async () => {
    previewDays = [day({ localDate: "2026-05-05", bookings: [] })];
    confirmStatus = 409;
    render();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await screen.findByText("2026-05-05");
    await userEvent.click(screen.getByRole("button", { name: /Review & confirm/ }));
    await screen.findByRole("heading", { name: "Confirm re-cut" });
    await userEvent.click(screen.getByRole("button", { name: "Confirm re-cut" }));

    await screen.findByText(/bookings in this range changed/);
    // Back to nothing shown at all - not a stale list the operator could mistake for current.
    expect(screen.queryByText("2026-05-05")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Confirm re-cut" })).toBeNull();
  });
});

function day(overrides: Partial<RecutDayPreview> = {}): RecutDayPreview {
  return {
    localDate: "2026-05-05",
    availableSlotsToDelete: 0,
    bookings: [],
    ...overrides,
  };
}

function booking(overrides: Partial<RecutBookingPreview> = {}): RecutBookingPreview {
  return {
    bookingId: "b1",
    startsAt: "2026-05-05T09:00:00Z",
    endsAt: "2026-05-05T09:45:00Z",
    status: "PendingConfirmation",
    serviceId: "s1",
    serviceName: "Haircut",
    customerId: "c1",
    customerDisplayName: null,
    phone: null,
    canDecide: true,
    ...overrides,
  };
}
