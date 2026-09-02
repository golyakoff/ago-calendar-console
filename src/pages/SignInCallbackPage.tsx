import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userManager } from "../auth/userManager.js";
import { useStrings } from "../i18n/StringsContext.js";

/**
 * Where Keycloak sends the browser back with `?code=&state=`. Completes the PKCE exchange and gets
 * out of the way.
 *
 * <b>The URL is replaced, not pushed.</b> A back button that returned to `/callback` would try to
 * redeem an authorization code that has already been spent, and Keycloak would - correctly - refuse
 * it. `replace: true` is what keeps that page out of the history at all.
 */
export function SignInCallbackPage() {
  const navigate = useNavigate();
  const strings = useStrings();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void userManager
      .signinRedirectCallback()
      .then(() => {
        if (!cancelled) {
          void navigate("/", { replace: true });
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : strings.signInFailedDefaultError);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, strings.signInFailedDefaultError]);

  if (error !== null) {
    return (
      <section className="panel">
        <h2>{strings.signInFailedTitle}</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  return <p className="muted">{strings.signingIn}</p>;
}
