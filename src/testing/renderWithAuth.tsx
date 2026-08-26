import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { AuthContext, type AuthState } from "../auth/AuthContext.js";

export const TEST_TOKEN = "test-access-token";

/**
 * Mounts a page with a signed-in operator.
 *
 * <b>The auth context is faked and nothing else is.</b> What it stands in for is a real Keycloak
 * redirect, which is a browser navigation no jsdom test can perform - and which would prove that
 * `oidc-client-ts` works rather than that this console does. Every other collaborator in these tests
 * is the real thing behind a stubbed `fetch`, so what is asserted is the request this console makes
 * and what it renders from the answer.
 */
export function renderWithAuth(element: ReactElement, overrides: Partial<AuthState> = {}): RenderResult {
  const value: AuthState = {
    accessToken: TEST_TOKEN,
    displayName: "Sam",
    isLoading: false,
    signIn: () => undefined,
    signOut: () => undefined,
    ...overrides,
  };

  return render(<AuthContext.Provider value={value}>{element}</AuthContext.Provider>);
}
