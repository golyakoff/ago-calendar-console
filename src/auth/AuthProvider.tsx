import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "oidc-client-ts";
import { AuthContext, type AuthState } from "./AuthContext.js";
import { userManager } from "./userManager.js";

/**
 * Holds the current Keycloak user and re-renders when it changes.
 *
 * <b>Subscribes to `addUserLoaded`, and that is not decoration.</b> Silent renewal replaces the
 * access token roughly a minute before it expires (see `userManager.ts`), so any component that
 * captured the token once and held it would go on sending an expired one. `ago-console` shipped
 * exactly that defect and found it in `5-16`; the subscription below is the whole fix, and it costs
 * one `useEffect`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void userManager
      .getUser()
      .then((current) => {
        if (!cancelled) {
          setUser(current);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    const onLoaded = (loaded: User) => setUser(loaded);
    const onUnloaded = () => setUser(null);
    userManager.events.addUserLoaded(onLoaded);
    userManager.events.addUserUnloaded(onUnloaded);

    return () => {
      cancelled = true;
      userManager.events.removeUserLoaded(onLoaded);
      userManager.events.removeUserUnloaded(onUnloaded);
    };
  }, []);

  const signIn = useCallback(() => void userManager.signinRedirect(), []);
  const signOut = useCallback(() => void userManager.signoutRedirect(), []);

  const value = useMemo<AuthState>(
    () => ({
      // Expired tokens are treated as absent: `oidc-client-ts` keeps the user object around past
      // expiry, and sending a token we already know is dead would turn a sign-in prompt into a 401.
      accessToken: user && !user.expired ? user.access_token : null,
      displayName: (user?.profile.preferred_username ?? user?.profile.name) ?? null,
      isLoading,
      signIn,
      signOut,
    }),
    [user, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
