import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { WorkerSlotsPage } from "./WorkerSlotsPage.js";
import { renderWithAuth } from "../testing/renderWithAuth.js";
import type { TenantConfiguration, WorkerSlot } from "../api/calendarApi.js";
import { urlOf } from "../testing/urlOf.js";

/**
 * `20-15`'s own Done-when at the console's own level: the table shows date, weekday, local time and
 * status, an occupied slot's contact fields render honestly (name/phone when permitted, `hidden` when
 * not, a plain dash when there is no customer at all) - `Ago.Calendar.Integration.Tests.WorkerSlotsTests`
 * proves the same data end to end against a real Postgres; this is the half that suite cannot see:
 * whether the console renders what the server sends without collapsing three different states into
 * one blank cell.
 */
describe("the materialised slot view", () => {
  const configuration: TenantConfiguration = {
    tenantName: "Barbershop",
    publicKey: "demo-barbershop",
    allowedOrigins: [],
    calendars: [
      {
        calendarId: "cal-1",
        name: "Main",
        // UTC, deliberately - so a slot's rendered local time is a fixed, assertable string instead
        // of depending on this test host's own tz database entry for a real zone.
        timeZone: "UTC",
        isPublished: true,
        workerIds: ["w1"],
        workingHours: [],
      },
    ],
    workers: [{ workerId: "w1", displayName: "Alex Doe", isActive: true, serviceIds: [] }],
    services: [{ serviceId: "s1", name: "Haircut", durationMinutes: 45 }],
  };

  let slots: WorkerSlot[];

  beforeEach(() => {
    slots = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL) => {
        const target = urlOf(url);

        if (target.endsWith("/configuration")) {
          return Promise.resolve(
            new Response(JSON.stringify(configuration), { status: 200, headers: { "Content-Type": "application/json" } }),
          );
        }

        if (target.includes("/workers/w1/slots")) {
          return Promise.resolve(
            new Response(JSON.stringify(slots), { status: 200, headers: { "Content-Type": "application/json" } }),
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
    return renderWithAuth(<WorkerSlotsPage />, {}, { path: "/workers/:workerId/slots", route: "/workers/w1/slots" });
  }

  it("shows the worker's name in the heading, from the tenant's own configuration", async () => {
    render();

    await screen.findByText("Alex Doe’s slots");
  });

  it("shows date, weekday, local time and status for a slot", async () => {
    slots = [slot({ status: "Available" })];

    render();

    await screen.findByText("2026-05-12");
    // The seeded local date is a Tuesday, and UTC is the calendar's own zone here, so both are fixed,
    // assertable strings rather than depending on this host's own locale or clock.
    expect(screen.getByText("Tuesday")).toBeDefined();
    expect(screen.getByText("Available")).toBeDefined();
    expect(screen.getByText(/09:00.*09:30/)).toBeDefined();
  });

  it("shows a plain dash, never 'hidden', for a slot nobody holds", async () => {
    slots = [slot({ status: "Available", customerId: null, customerDisplayName: null, phone: null })];

    render();

    await screen.findByText("Available");
    expect(screen.queryByText("hidden")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the customer's name and phone when the server includes them", async () => {
    slots = [
      slot({
        status: "Booked",
        customerId: "c1",
        customerDisplayName: "Dana",
        phone: "+79990000001",
      }),
    ];

    render();

    await screen.findByText("Dana");
    expect(screen.getByText("+79990000001")).toBeDefined();
  });

  it("shows 'hidden', not a blank cell, for an occupied slot the operator may not see the contact of", async () => {
    // `20-12`'s own rule, restated here: `customerId` non-null with `customerDisplayName`/`phone`
    // null means someone holds the slot and this operator lacks `customer:read` - never "nobody
    // booked this", which is what a genuinely free slot (customerId null) looks like instead.
    slots = [slot({ status: "Booked", customerId: "c1", customerDisplayName: null, phone: null })];

    render();

    const hidden = await screen.findAllByText("hidden");
    expect(hidden.length).toBe(2);
  });

  it("shows service name where one was chosen, and a dash on a blocked row", async () => {
    slots = [
      slot({ status: "Booked", serviceId: "s1", serviceName: "Haircut" }),
      slot({ eventId: "e2", status: "Blocked", serviceId: null, serviceName: null, customerId: null, customerDisplayName: null, phone: null }),
    ];

    render();

    await screen.findByText("Haircut");
    expect(screen.getByText("Blocked")).toBeDefined();
  });

  it("explains a permission failure in words an operator can act on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL) => {
        const target = urlOf(url);
        if (target.endsWith("/configuration")) {
          return Promise.resolve(
            new Response(JSON.stringify(configuration), { status: 200, headers: { "Content-Type": "application/json" } }),
          );
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              type: "worker_slots.forbidden",
              detail: "This operator does not hold 'calendar:configure' for this tenant.",
            }),
            { status: 403, headers: { "Content-Type": "application/problem+json" } },
          ),
        );
      }),
    );

    render();

    await screen.findByText(/does not have permission/i);
  });
});

function slot(overrides: Partial<WorkerSlot> = {}): WorkerSlot {
  return {
    eventId: "e1",
    localDate: "2026-05-12",
    weekday: 2,
    startsAt: "2026-05-12T09:00:00Z",
    endsAt: "2026-05-12T09:30:00Z",
    status: "Available",
    serviceId: null,
    serviceName: null,
    customerId: null,
    customerDisplayName: null,
    phone: null,
    ...overrides,
  };
}
