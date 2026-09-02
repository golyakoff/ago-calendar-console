import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkersPage } from "./WorkersPage.js";
import { renderWithAuth } from "../testing/renderWithAuth.js";
import type { TenantConfiguration, WorkerDetail } from "../api/calendarApi.js";
import { bodyOf, urlOf } from "../testing/urlOf.js";

/**
 * `20-13`'s own Done-when at the console's own level: a workers table that lists everyone, a card
 * used for both create and edit, activity toggled from the row, and deletion behind a confirmation.
 * `Ago.Calendar.Integration.Tests.WorkerEndpointTests` proves the same requests really configure a
 * tenant against a real Postgres; this is the half that suite cannot see - which request each
 * control builds, and what the screen shows afterwards.
 */
describe("the workers screen", () => {
  const alex: WorkerDetail = {
    workerId: "w1",
    lastName: "Doe",
    firstName: "Alex",
    middleName: null,
    displayName: "Alex Doe",
    displayNameIsCustom: false,
    isActive: true,
    createdAt: "2026-03-02T09:00:00Z",
    updatedAt: "2026-03-02T09:00:00Z",
  };

  const configuration: TenantConfiguration = {
    tenantName: "Barbershop",
    publicKey: "demo-barbershop",
    allowedOrigins: [],
    calendars: [
      {
        calendarId: "cal-1",
        name: "Main",
        timeZone: "Europe/Moscow",
        isPublished: true,
        workerIds: ["w1"],
        workingHours: [],
      },
    ],
    workers: [{ workerId: "w1", displayName: "Alex Doe", isActive: true, serviceIds: [] }],
    services: [{ serviceId: "s1", name: "Haircut", durationMinutes: 45 }],
  };

  let workers: WorkerDetail[];
  let requests: { method: string; url: string; body: unknown }[];

  beforeEach(() => {
    workers = [alex];
    requests = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
        const target = urlOf(url);
        const method = init?.method ?? "GET";

        if (method === "GET" && target.endsWith("/configuration")) {
          return Promise.resolve(
            new Response(JSON.stringify(configuration), { status: 200, headers: { "Content-Type": "application/json" } }),
          );
        }

        if (method === "GET" && target.endsWith("/workers")) {
          return Promise.resolve(
            new Response(JSON.stringify(workers), { status: 200, headers: { "Content-Type": "application/json" } }),
          );
        }

        // `20-14`: the schedule section the worker card now renders while editing fires its own GET
        // on mount. None of these tests care about the schedule, so every worker starts with none -
        // the real server's own "not configured yet" answer.
        if (method === "GET" && /\/workers\/[^/]+\/schedule$/.test(target)) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ type: "configuration.no_schedule", detail: "No schedule yet." }),
              { status: 404, headers: { "Content-Type": "application/problem+json" } },
            ),
          );
        }

        requests.push({ method, url: target, body: JSON.parse(bodyOf(init) || "null") as unknown });

        if (method === "POST" && target.endsWith("/workers")) {
          const created: WorkerDetail = {
            workerId: "w2",
            lastName: "Fox",
            firstName: "Robin",
            middleName: null,
            displayName: "Robin Fox",
            displayNameIsCustom: false,
            isActive: true,
            createdAt: "2026-04-01T00:00:00Z",
            updatedAt: "2026-04-01T00:00:00Z",
          };
          workers = [...workers, created];
          return Promise.resolve(
            new Response(JSON.stringify({ workerId: "w2" }), { status: 201, headers: { "Content-Type": "application/json" } }),
          );
        }

        if (method === "PUT" && /\/workers\/w1$/.test(target)) {
          const body = JSON.parse(bodyOf(init) || "null") as {
            lastName: string;
            firstName: string;
            middleName: string | null;
            displayName: string | null;
            isActive: boolean;
          };
          workers = workers.map((w) =>
            w.workerId === "w1"
              ? {
                  ...w,
                  lastName: body.lastName,
                  firstName: body.firstName,
                  middleName: body.middleName,
                  displayName: body.displayName ?? `${body.firstName} ${body.lastName}`,
                  displayNameIsCustom: body.displayName !== null || w.displayNameIsCustom,
                  isActive: body.isActive,
                }
              : w,
          );
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        if (method === "DELETE" && /\/workers\/w1$/.test(target)) {
          workers = workers.filter((w) => w.workerId !== "w1");
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        if (method === "DELETE" && /\/workers\/booked$/.test(target)) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                type: "configuration.worker_has_booking_history",
                detail: "Worker booked has a booking that is pending, confirmed, or a recorded no-show, and cannot be deleted. Deactivate him instead.",
              }),
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

  it("lists every worker with their activity, created and updated timestamps", async () => {
    renderWithAuth(<WorkersPage />);

    await screen.findByText("Alex Doe");
    const row = screen.getByText("Alex Doe").closest("tr");
    expect(row?.textContent).toContain("Active");
  });

  it("creates a worker with split name fields, on exactly one calendar", async () => {
    renderWithAuth(<WorkersPage />);
    await screen.findByText("Alex Doe");

    await userEvent.click(screen.getByRole("button", { name: "Add worker" }));
    await userEvent.type(screen.getByLabelText("Last name"), "Fox");
    await userEvent.type(screen.getByLabelText("First name"), "Robin");
    await userEvent.click(screen.getByLabelText("Haircut"));
    await userEvent.click(screen.getByRole("button", { name: "Add worker" }));

    await waitFor(() => {
      expect(requests.some((r) => r.method === "POST" && r.url.endsWith("/workers"))).toBe(true);
    });
    const created = requests.find((r) => r.method === "POST" && r.url.endsWith("/workers"));
    expect(created?.body).toEqual({
      lastName: "Fox",
      firstName: "Robin",
      middleName: null,
      displayName: null,
      calendarId: "cal-1",
      serviceIds: ["s1"],
    });
  });

  it("refuses to offer a create card before there is a calendar to put a worker on", async () => {
    vi.mocked(fetch).mockImplementation((url: RequestInfo | URL, init?: RequestInit) => {
      const target = urlOf(url);
      const method = init?.method ?? "GET";
      if (method === "GET" && target.endsWith("/configuration")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ...configuration, calendars: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (method === "GET" && target.endsWith("/workers")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    renderWithAuth(<WorkersPage />);

    await screen.findByText(/Add a calendar first/i);
    expect(screen.getByRole("button", { name: "Add worker" })).toHaveProperty("disabled", true);
  });

  it("renaming a worker before any custom display name keeps deriving it", async () => {
    renderWithAuth(<WorkersPage />);
    await screen.findByText("Alex Doe");

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const lastName = await screen.findByLabelText("Last name");
    await userEvent.clear(lastName);
    await userEvent.type(lastName, "Sparrow");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const put = requests.find((r) => r.method === "PUT");
      expect(put?.body).toMatchObject({ lastName: "Sparrow", firstName: "Alex", displayName: null });
    });
  });

  it("editing the display name by hand sends it as a custom override", async () => {
    renderWithAuth(<WorkersPage />);
    await screen.findByText("Alex Doe");

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const displayName = await screen.findByLabelText("Display name");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "Foxy");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const put = requests.find((r) => r.method === "PUT");
      expect(put?.body).toMatchObject({ displayName: "Foxy" });
    });
  });

  it("deletes a worker after confirming, and reloads the table", async () => {
    renderWithAuth(<WorkersPage />);
    await screen.findByText("Alex Doe");

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByText(/never been booked/);
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);

    await waitFor(() => {
      expect(requests.some((r) => r.method === "DELETE")).toBe(true);
    });
    await waitFor(() => expect(screen.queryByText("Alex Doe")).toBeNull());
  });
});
