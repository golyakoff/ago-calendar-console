import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessPage } from "./AccessPage.js";
import { renderWithAuth } from "../testing/renderWithAuth.js";
import type { OperatorInfo, Role } from "../api/calendarApi.js";
import { bodyOf, urlOf } from "../testing/urlOf.js";

/**
 * `20-12`'s own Done-when at the console's own level: a tenant can provision a second role and move a
 * real operator onto or off it. `Ago.Calendar.Integration.Tests.AccessControlEndpointTests` proves the
 * same thing end to end against a real Postgres; this is the half that suite cannot see - which
 * request each control actually builds, and what the screen shows afterwards.
 */
describe("the access screen", () => {
  const seededRole: Role = { roleId: "role-1", name: "Operator", permissions: ["customer:read", "booking:reject"] };
  const dispatcherRole: Role = { roleId: "role-2", name: "Dispatcher", permissions: ["booking:reject"] };

  let roles: Role[];
  let operators: OperatorInfo[];
  let requests: { method: string; url: string; body: unknown }[];

  beforeEach(() => {
    roles = [seededRole, dispatcherRole];
    operators = [
      { operatorId: "op-owner", displayName: "Sam", isAccountOwner: true, roleIds: ["role-1"] },
      { operatorId: "op-junior", displayName: "Robin", isAccountOwner: false, roleIds: [] },
    ];
    requests = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
        const target = urlOf(url);
        const method = init?.method ?? "GET";

        if (method === "GET" && target.endsWith("/roles")) {
          return Promise.resolve(
            new Response(JSON.stringify(roles), { status: 200, headers: { "Content-Type": "application/json" } }),
          );
        }

        if (method === "GET" && target.endsWith("/operators")) {
          return Promise.resolve(
            new Response(JSON.stringify(operators), { status: 200, headers: { "Content-Type": "application/json" } }),
          );
        }

        requests.push({ method, url: target, body: JSON.parse(bodyOf(init) || "null") as unknown });

        if (method === "POST" && target.endsWith("/roles")) {
          roles = [...roles, { roleId: "role-3", name: "No contact access", permissions: [] }];
          return Promise.resolve(
            new Response(JSON.stringify({ roleId: "role-3" }), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (method === "POST" && /\/operators\/.+\/roles\/.+/.test(target)) {
          const [, operatorId, , roleId] = target.split("/").slice(-4);
          operators = operators.map((o) => (o.operatorId === operatorId ? { ...o, roleIds: [...o.roleIds, roleId] } : o));
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        if (method === "DELETE" && /\/operators\/.+\/roles\/.+/.test(target)) {
          const [, operatorId, , roleId] = target.split("/").slice(-4);

          // The account owner's own only contact-granting role - the server refuses this one.
          if (operatorId === "op-owner" && roleId === "role-1") {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  type: "access.account_owner_requires_contact_access",
                  detail:
                    "Operator op-owner is tenant t-1's account owner and must always hold a role granting 'customer:read'; revoking 'Operator' would leave them without one.",
                }),
                { status: 409, headers: { "Content-Type": "application/problem+json" } },
              ),
            );
          }

          operators = operators.map((o) =>
            o.operatorId === operatorId ? { ...o, roleIds: o.roleIds.filter((id) => id !== roleId) } : o,
          );
          return Promise.resolve(new Response(null, { status: 204 }));
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

  it("shows every role and marks the account owner", async () => {
    renderWithAuth(<AccessPage />);

    // "Dispatcher" appears twice by design (the Roles list, and every operator's own checkbox
    // label), so this asserts on the plural rather than picking one arbitrarily.
    await waitFor(() => expect(screen.getAllByText("Dispatcher").length).toBeGreaterThan(0));
    expect(screen.getByText(/Sam/)).toBeDefined();
    expect(screen.getByText(/account owner/)).toBeDefined();
  });

  it("adds a role without contact access from the fixed template", async () => {
    renderWithAuth(<AccessPage />);
    await waitFor(() => expect(screen.getAllByText("Dispatcher").length).toBeGreaterThan(0));

    await userEvent.click(screen.getByRole("button", { name: "Add a role without contact access" }));

    await waitFor(() => {
      expect(requests.some((r) => r.method === "POST" && r.url.endsWith("/roles"))).toBe(true);
    });
    const created = requests.find((r) => r.method === "POST" && r.url.endsWith("/roles"));
    const body = created.body as { name: string; permissions: string[] };
    expect(body.permissions).not.toContain("customer:read");
    await waitFor(() => expect(screen.getAllByText("No contact access").length).toBeGreaterThan(0));
  });

  it("grants a role to an operator who does not hold it", async () => {
    renderWithAuth(<AccessPage />);
    await screen.findByText(/Robin/);

    const robinRow = screen.getByText(/Robin/).closest("tr");
    const dispatcherCheckbox = Array.from(robinRow.querySelectorAll("input[type=checkbox]"))[1] as HTMLInputElement;
    await userEvent.click(dispatcherCheckbox);

    await waitFor(() => {
      expect(
        requests.some((r) => r.method === "POST" && r.url.includes("op-junior") && r.url.includes("role-2")),
      ).toBe(true);
    });
  });

  it("revoking the account owner's only contact-granting role shows the server's own refusal", async () => {
    renderWithAuth(<AccessPage />);
    await screen.findByText(/Sam/);

    const ownerRow = screen.getByText(/Sam/).closest("tr");
    const operatorRoleCheckbox = Array.from(ownerRow.querySelectorAll("input[type=checkbox]"))[0] as HTMLInputElement;
    expect(operatorRoleCheckbox.checked).toBe(true);
    await userEvent.click(operatorRoleCheckbox);

    await screen.findByText(/must always hold a role granting/);
  });
});
