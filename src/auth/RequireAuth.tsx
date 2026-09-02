import type { ReactNode } from "react";
import { useAuth } from "./AuthContext.js";
import { useStrings } from "../i18n/StringsContext.js";

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
  const strings = useStrings();

  if (isLoading) {
    return <p className="muted">{strings.checkingSession}</p>;
  }

  if (accessToken === null) {
    return (
      <section className="panel">
        <h2>{strings.signInTitle}</h2>
        <p className="muted">{strings.signInDescription}</p>
        <button type="button" onClick={signIn}>
          {strings.signInButton}
        </button>
      </section>
    );
  }

  return <>{children}</>;
}
