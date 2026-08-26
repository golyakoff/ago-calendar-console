import type { ReactNode } from "react";
import { useAuth } from "./AuthContext.js";

/**
 * Renders a sign-in prompt instead of the page when nobody is signed in.
 *
 * <b>Not a route guard that redirects.</b> An automatic redirect to Keycloak on first load would
 * make the console impossible to look at while signed out, and - more practically - would turn every
 * expired token into an unexplained navigation away from whatever the operator was doing. A visible
 * button says what is about to happen.
 *
 * <b>This is not the security boundary and must not be mistaken for one.</b> Everything real is
 * refused by `Ago.Calendar.Api`'s own `calendar-operator` policy and by `PermissionChecker`; this is
 * a rendering decision in a bundle the operator's own browser can be told to ignore.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { accessToken, isLoading, signIn } = useAuth();

  if (isLoading) {
    return <p className="muted">Checking your session…</p>;
  }

  if (accessToken === null) {
    return (
      <section className="panel">
        <h2>Sign in</h2>
        <p className="muted">
          This console signs in through the same Keycloak realm AGO Chat uses. Signing in there does
          not by itself make you an operator here - AGO Calendar keeps its own operators.
        </p>
        <button type="button" onClick={signIn}>
          Sign in with Keycloak
        </button>
      </section>
    );
  }

  return <>{children}</>;
}
