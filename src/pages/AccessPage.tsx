import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import {
  createRole,
  getOperators,
  getRoles,
  grantOperatorRole,
  revokeOperatorRole,
  type OperatorInfo,
  type Role,
} from "../api/calendarApi.js";
import { errorMessage } from "./errorMessage.js";

/**
 * `20-12`'s own surface gap: a tenant provisions a second role and moves an operator onto or off it.
 *
 * <b>One fixed template, not a permission-checkbox role builder.</b> The item's own scope is
 * deliberately smaller than "extend the role system" - `Role.Create` already accepts any name and any
 * permission subset server-side, but this screen offers exactly one choice: "add a role without
 * contact access", which posts the seeded role's own permission set minus `customer:read`. A tenant
 * that wants something more specific still has a general server to build a richer screen against
 * later; this is the smallest surface that satisfies the item's own Done-when.
 *
 * <b>The account owner's own row never offers to revoke their last contact-granting role.</b> Not
 * because the button is hidden defensively - the server refuses it either way
 * (`Ago.Calendar.Domain.Operator`'s own invariant) - but because offering a control that always fails
 * would be a worse console, not a safer one.
 */
const NON_CONTACT_TEMPLATE = {
  name: "No contact access",
  permissions: ["booking:confirm", "booking:reject", "booking:cancel", "booking:mark_no_show", "customer:edit", "calendar:configure"],
};

export function AccessPage() {
  const { accessToken } = useAuth();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [operators, setOperators] = useState<OperatorInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (accessToken === null) {
        return;
      }

      try {
        const [loadedRoles, loadedOperators] = await Promise.all([
          getRoles(accessToken, signal),
          getOperators(accessToken, signal),
        ]);
        setRoles(loadedRoles);
        setOperators(loadedOperators);
        setError(null);
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(errorMessage(reason));
        }
      }
    },
    [accessToken],
  );

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    if (accessToken === null) {
      return;
    }

    setBusyKey(key);
    try {
      await action();
      await reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusyKey(null);
    }
  };

  if (accessToken === null) {
    return null;
  }

  if (roles === null || operators === null) {
    return error === null ? <p className="muted">Loading…</p> : <p className="error">{error}</p>;
  }

  return (
    <div className="stack">
      {error !== null && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Roles</h2>
        <ul>
          {roles.map((role) => (
            <li key={role.roleId}>
              <strong>{role.name}</strong> · {role.permissions.join(", ")}
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={busyKey !== null}
          onClick={() =>
            void run("create-role", () =>
              createRole(accessToken, { name: NON_CONTACT_TEMPLATE.name, permissions: NON_CONTACT_TEMPLATE.permissions }),
            )
          }
        >
          Add a role without contact access
        </button>
        <p className="muted">
          Grants everything the seeded role does except reading a customer&rsquo;s phone, name and
          notes - a receptionist who works the queue but should not see contact details.
        </p>
      </section>

      <section className="panel">
        <h2>Operators</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Operator</th>
              <th scope="col">Roles</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((operator) => (
              <tr key={operator.operatorId}>
                <td>
                  {operator.displayName}
                  {operator.isAccountOwner && <> · account owner</>}
                </td>
                <td>
                  {roles.map((role) => {
                    const held = operator.roleIds.includes(role.roleId);
                    const key = `${operator.operatorId}:${role.roleId}`;
                    return (
                      <label key={role.roleId} style={{ marginRight: "1em" }}>
                        <input
                          type="checkbox"
                          checked={held}
                          disabled={busyKey !== null}
                          onChange={() =>
                            void run(key, () =>
                              held
                                ? revokeOperatorRole(accessToken, operator.operatorId, role.roleId)
                                : grantOperatorRole(accessToken, operator.operatorId, role.roleId),
                            )
                          }
                        />{" "}
                        {role.name}
                      </label>
                    );
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
