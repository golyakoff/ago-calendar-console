import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext, type AuthState } from "../auth/AuthContext.js";

export const TEST_TOKEN = "test-access-token";

/** `20-15`: which URL a page is mounted at, and what route pattern resolves it - only needed by a
 * page that reads `useParams` (today, only `WorkerSlotsPage`) or renders a `<Link>` (`20-13` onward).
 * A bare `MemoryRouter` with no `<Route>` would leave `useParams` seeing no match at all, so this is
 * two settings, not one. */
export interface RouteOptions {
  /** The pattern a `<Route>` is registered under. Defaults to matching anything, which is enough for
   * a page that only renders `<Link>`s and reads no param of its own. */
  path?: string;
  /** The URL the router starts at. Defaults to `/`, which is not a page under test today but is a
   * harmless default for one that ignores its own location. */
  route?: string;
}

/**
 * Mounts a page with a signed-in operator.
 *
 * <b>The auth context is faked and nothing else is.</b> What it stands in for is a real Keycloak
 * redirect, which is a browser navigation no jsdom test can perform - and which would prove that
 * `oidc-client-ts` works rather than that this console does. Every other collaborator in these tests
 * is the real thing behind a stubbed `fetch`, so what is asserted is the request this console makes
 * and what it renders from the answer.
 *
 * <b>`20-15`: also a real `MemoryRouter`, not a second fake.</b> `WorkersPage`'s own `<Link>` to this
 * item's own slots screen throws outside a router context - `react-router`'s `useHref` demands one
 * unconditionally - so every page under test needs one from here on, not only the one that reads
 * `useParams`. `main.tsx`'s own `BrowserRouter` is not it: jsdom has no real navigation to route
 * against, and a `MemoryRouter` is the same contract without one.
 */
export function renderWithAuth(
  element: ReactElement,
  overrides: Partial<AuthState> = {},
  routing: RouteOptions = {},
): RenderResult {
  const { path = "*", route = "/" } = routing;
  const value: AuthState = {
    accessToken: TEST_TOKEN,
    displayName: "Sam",
    isLoading: false,
    signIn: () => undefined,
    signOut: () => undefined,
    ...overrides,
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
