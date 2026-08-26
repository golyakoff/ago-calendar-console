import { createContext, useContext } from "react";

export interface AuthState {
  /** Null while the first `getUser()` is in flight, and again after a sign-out. */
  readonly accessToken: string | null;
  readonly displayName: string | null;
  readonly isLoading: boolean;
  /** Properties, not method shorthand. A method on an interface is one a caller can detach from its
   * object and call with the wrong `this` - `@typescript-eslint/unbound-method` says so at lint time,
   * and every consumer here destructures these off the context, which is exactly that detaching. */
  readonly signIn: () => void;
  readonly signOut: () => void;
}

/**
 * Split from the provider component's own file on purpose: a module that exports both a component
 * and a non-component breaks React Fast Refresh's ability to hot-swap the component, and
 * `eslint-plugin-react-refresh` says so at lint time. `ago-console` settled on the same split, and
 * the reason is worth carrying rather than rediscovering.
 */
export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (state === null) {
    throw new Error("useAuth was called outside <AuthProvider>.");
  }

  return state;
}
