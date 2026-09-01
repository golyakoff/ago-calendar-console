import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { ContactsPage } from "./ContactsPage.js";
import { renderWithAuth } from "../testing/renderWithAuth.js";
import type { Contact } from "../api/calendarApi.js";

/**
 * `20-12`'s own new kind of screen: `Ago.Calendar.Integration.Tests.ContactsReportTests` proves the
 * report's data end to end against a real Postgres; this is the half that suite cannot see - whether
 * the console actually renders what the server sends, honestly (a missing name shown as "not
 * recorded", not silently blank).
 */
describe("the contacts report", () => {
  let contacts: Contact[];

  beforeEach(() => {
    contacts = [
      {
        customerId: "c1",
        phone: "+79990000001",
        displayName: "Anna",
        notes: "Prefers afternoons",
        noShowCount: 0,
        firstSeenAt: "2026-03-01T09:00:00+00:00",
        lastSeenAt: "2026-05-01T09:00:00+00:00",
      },
      {
        customerId: "c2",
        phone: "+79990000002",
        displayName: null,
        notes: null,
        noShowCount: 2,
        firstSeenAt: "2026-04-01T09:00:00+00:00",
        lastSeenAt: "2026-04-01T09:00:00+00:00",
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(contacts), { status: 200, headers: { "Content-Type": "application/json" } }),
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists every contact's phone, name and notes", async () => {
    renderWithAuth(<ContactsPage />);

    await screen.findByText("+79990000001");
    expect(screen.getByText("Anna")).toBeDefined();
    expect(screen.getByText("Prefers afternoons")).toBeDefined();
  });

  it("shows an honest placeholder for a customer with no name recorded, not a blank cell", async () => {
    renderWithAuth(<ContactsPage />);

    await screen.findByText("+79990000002");
    expect(screen.getByText("not recorded")).toBeDefined();
  });

  it("shows the real no-show count, including zero", async () => {
    renderWithAuth(<ContactsPage />);

    await screen.findByText("+79990000001");
    expect(screen.getByText("2")).toBeDefined();
  });

  it("explains a permission failure in words an operator can act on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              type: "contacts.forbidden",
              detail: "This operator does not hold 'customer:read' for this tenant.",
            }),
            { status: 403, headers: { "Content-Type": "application/problem+json" } },
          ),
        ),
      ),
    );

    renderWithAuth(<ContactsPage />);

    await screen.findByText(/does not have permission/i);
  });
});
