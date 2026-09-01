import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigurationPage } from "./ConfigurationPage.js";
import { renderWithAuth } from "../testing/renderWithAuth.js";
import type { TenantConfiguration } from "../api/calendarApi.js";
import { bodyOf, urlOf } from "../testing/urlOf.js";

/**
 * `20-06`'s first Done-when at the console's own level: a tenant can create a calendar, a service, a
 * worker and a working-hours rule, and can see the embed snippet that makes the whole thing
 * reachable from a stranger's page.
 *
 * The end-to-end proof that those calls really configure a tenant is
 * `Ago.Calendar.Integration.Tests.ConsoleEndpointTests`, against a real Postgres. What these tests
 * add is the half that suite cannot see: which request each form actually builds, and whether the
 * screen shows the answer afterwards.
 */
describe("the tenant setup screen", () => {
  let configuration: TenantConfiguration;
  let posted: { url: string; body: unknown }[];

  beforeEach(() => {
    posted = [];
    configuration = {
      tenantName: "Barbershop",
      publicKey: "demo-barbershop",
      allowedOrigins: ["https://shop.example"],
      calendars: [
        {
          calendarId: "cal-1",
          name: "Main",
          timeZone: "Europe/Moscow",
          bufferMinutes: 10,
          isPublished: true,
          workerIds: ["w1"],
          workingHours: [],
        },
      ],
      workers: [{ workerId: "w1", displayName: "Alex", isActive: true, serviceIds: ["s1"] }],
      services: [{ serviceId: "s1", name: "Haircut", durationMinutes: 45 }],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(configuration), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        posted.push({ url: urlOf(url), body: JSON.parse(bodyOf(init) || "null") as unknown });
        return Promise.resolve(
          new Response(JSON.stringify({ calendarId: "cal-2", serviceId: "s2", workerId: "w2", ruleId: "r1" }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the embed snippet with the tenant's own public key in it", async () => {
    // The artefact the shop actually needs. A key on its own leaves the last and most error-prone
    // step - writing the script tag - to somebody who has never seen one.
    renderWithAuth(<ConfigurationPage />);

    const snippet = await screen.findByLabelText("Embed snippet");

    expect(snippet.textContent).toContain('data-booking="demo-barbershop"');
    expect(snippet.textContent).toContain('data-booking-api="https://calendar.test.invalid"');
    // One tag, not two: the chat site key is on the same element.
    expect(snippet.textContent).toContain("data-site=");
    expect(snippet.textContent?.match(/<script/g)).toHaveLength(1);
  });

  it("creates a calendar with an IANA zone and a buffer", async () => {
    renderWithAuth(<ConfigurationPage />);
    await screen.findByLabelText("Calendar name");

    await userEvent.type(screen.getByLabelText("Calendar name"), "Second chair");
    await userEvent.click(screen.getByRole("button", { name: "Add calendar" }));

    const call = posted.find((entry) => entry.url.endsWith("/console/calendars"));
    expect(call?.body).toEqual({
      name: "Second chair",
      // A zone id, never an offset - an offset is wrong for half the year in any zone with DST, and
      // this value can never be changed once slots exist.
      timeZone: "Europe/Moscow",
      bufferMinutes: 10,
      publish: true,
    });
  });

  it("sends working hours as wall clock, never as an instant", async () => {
    renderWithAuth(<ConfigurationPage />);
    await screen.findByLabelText("Opens");

    await userEvent.click(screen.getByRole("button", { name: "Add working hours" }));

    const body = posted.find((entry) => entry.url.endsWith("/console/working-hours"))?.body as Record<string, unknown>;

    // "09:00", not "2026-05-05T09:00:00+03:00". The single conversion to instants happens in the
    // materialiser, through the calendar's own zone; an offset chosen here would freeze one that is
    // wrong for half the year.
    expect(body["startsAt"]).toBe("09:00");
    expect(body["endsAt"]).toBe("18:00");
    expect(body["dayOfWeek"]).toBe(1);
    expect(body["workerId"]).toBe("w1");
  });

  it("replaces the whole allowed-origin list rather than appending to it", async () => {
    renderWithAuth(<ConfigurationPage />);
    const origins = await screen.findByLabelText("One origin per line");

    await userEvent.clear(origins);
    await userEvent.type(origins, "https://a.example\nhttps://b.example");
    await userEvent.click(screen.getByRole("button", { name: "Save origins" }));

    expect(posted.find((entry) => entry.url.endsWith("/allowed-origins"))?.body).toEqual({
      origins: ["https://a.example", "https://b.example"],
    });
  });

  it("shows the server's own rejection instead of pretending the write worked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(configuration), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              type: "configuration.invalid",
              detail: "'https://shop.example/booking' is not an origin.",
            }),
            { status: 400, headers: { "Content-Type": "application/problem+json" } },
          ),
        );
      }),
    );

    renderWithAuth(<ConfigurationPage />);
    await screen.findByLabelText("One origin per line");

    await userEvent.click(screen.getByRole("button", { name: "Save origins" }));

    await screen.findByText("'https://shop.example/booking' is not an origin.");
  });
});
