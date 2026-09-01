import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkerScheduleSection } from "./WorkerScheduleSection.js";
import { renderWithAuth } from "../testing/renderWithAuth.js";
import { bodyOf, urlOf } from "../testing/urlOf.js";
import type { WorkerSchedule } from "../api/calendarApi.js";

/**
 * `20-14`'s own console-level Done-when: the schedule section a human actually fills in, for both a
 * worker who has none yet and one being reconfigured. `Ago.Calendar.Integration.Tests` proves the same
 * requests really save a schedule against a real Postgres; this is the half that suite cannot see -
 * which request the form builds, and what it shows for the two starting states.
 */
describe("the worker schedule section", () => {
  let requests: { method: string; url: string; body: unknown }[];
  let schedule: WorkerSchedule | null;

  const weekly: WorkerSchedule = {
    scheduleId: "sched-1",
    workerId: "w1",
    kind: "Weekly",
    cycleAnchor: null,
    cycleWorkingDays: null,
    cycleRestDays: null,
    cycleStartsAt: null,
    cycleEndsAt: null,
    slotMinutes: 45,
    bufferMinutes: 10,
    horizonDays: 30,
    materializeFrom: "2026-03-02",
    createdAt: "2026-03-02T09:00:00Z",
    updatedAt: "2026-03-02T09:00:00Z",
  };

  beforeEach(() => {
    requests = [];
    schedule = null;

    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
        const target = urlOf(url);
        const method = init?.method ?? "GET";

        if (method === "GET" && target.endsWith("/w1/schedule")) {
          if (schedule === null) {
            return Promise.resolve(
              new Response(
                JSON.stringify({ type: "configuration.no_schedule", detail: "Worker w1 has no schedule yet." }),
                { status: 404, headers: { "Content-Type": "application/problem+json" } },
              ),
            );
          }

          return Promise.resolve(
            new Response(JSON.stringify(schedule), { status: 200, headers: { "Content-Type": "application/json" } }),
          );
        }

        if (method === "PUT" && target.endsWith("/w1/schedule")) {
          const body = JSON.parse(bodyOf(init) || "null") as Record<string, unknown>;
          requests.push({ method, url: target, body });

          if (body["horizonDays"] === 999) {
            return Promise.resolve(
              new Response(
                JSON.stringify({ type: "configuration.invalid", detail: "A horizon above 180 days is refused." }),
                { status: 400, headers: { "Content-Type": "application/problem+json" } },
              ),
            );
          }

          schedule = { ...weekly, ...body, scheduleId: "sched-1", workerId: "w1" };
          return Promise.resolve(
            new Response(JSON.stringify(schedule), { status: 200, headers: { "Content-Type": "application/json" } }),
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

  it("shows a 'no schedule yet' state for a worker who has none", async () => {
    renderWithAuth(<WorkerScheduleSection workerId="w1" />);

    await screen.findByText(/materialises nothing until one is saved/);
    expect(screen.getByRole("button", { name: "Create schedule" })).toBeTruthy();
  });

  it("prefills the form from an existing schedule", async () => {
    schedule = weekly;
    renderWithAuth(<WorkerScheduleSection workerId="w1" />);

    await screen.findByRole("button", { name: "Save schedule" });
    expect(screen.getByLabelText("Slot length (minutes)")).toHaveProperty("value", "45");
    expect(screen.getByLabelText("Buffer between slots (minutes)")).toHaveProperty("value", "10");
  });

  it("creates a weekly schedule with the numbers a human typed", async () => {
    renderWithAuth(<WorkerScheduleSection workerId="w1" />);
    await screen.findByRole("button", { name: "Create schedule" });

    await userEvent.clear(screen.getByLabelText("Slot length (minutes)"));
    await userEvent.type(screen.getByLabelText("Slot length (minutes)"), "30");
    await userEvent.click(screen.getByRole("button", { name: "Create schedule" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].body).toMatchObject({
      kind: "Weekly",
      cycleAnchor: null,
      cycleWorkingDays: null,
      cycleRestDays: null,
      cycleStartsAt: null,
      cycleEndsAt: null,
      slotMinutes: 30,
    });
  });

  it("switching to Cycle reveals the cycle fields and sends them, not the weekly ones", async () => {
    renderWithAuth(<WorkerScheduleSection workerId="w1" />);
    await screen.findByRole("button", { name: "Create schedule" });

    await userEvent.selectOptions(screen.getByLabelText("Template"), "Cycle");
    expect(screen.getByLabelText("Working days")).toBeTruthy();

    await userEvent.clear(screen.getByLabelText("Working days"));
    await userEvent.type(screen.getByLabelText("Working days"), "1");
    await userEvent.clear(screen.getByLabelText("Rest days"));
    await userEvent.type(screen.getByLabelText("Rest days"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Create schedule" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].body).toMatchObject({
      kind: "Cycle",
      cycleWorkingDays: 1,
      cycleRestDays: 3,
    });
  });

  it("warns before a save that would switch a cycle schedule back to weekly", async () => {
    // The only destructive direction: the cycle fields live on this aggregate and are cleared by
    // ReconfigureWeekly, while Weekly -> Cycle sets fields that were simply null before - nothing is
    // lost going that way, so only this direction gets a warning.
    schedule = {
      ...weekly,
      kind: "Cycle",
      cycleAnchor: "2026-03-02",
      cycleWorkingDays: 2,
      cycleRestDays: 2,
      cycleStartsAt: "09:00",
      cycleEndsAt: "18:00",
    };
    renderWithAuth(<WorkerScheduleSection workerId="w1" />);
    await screen.findByRole("button", { name: "Save schedule" });

    await userEvent.selectOptions(screen.getByLabelText("Template"), "Weekly");

    await screen.findByText(/clears the cycle settings/);
  });

  it("shows the server's own refusal, such as a horizon above the cap", async () => {
    renderWithAuth(<WorkerScheduleSection workerId="w1" />);
    await screen.findByRole("button", { name: "Create schedule" });

    await userEvent.clear(screen.getByLabelText("Horizon (days ahead kept generated)"));
    await userEvent.type(screen.getByLabelText("Horizon (days ahead kept generated)"), "999");
    await userEvent.click(screen.getByRole("button", { name: "Create schedule" }));

    await screen.findByText("A horizon above 180 days is refused.");
  });
});
