import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App.js";
import { AuthContext, type AuthState } from "./auth/AuthContext.js";
import { TEST_TOKEN } from "./testing/renderWithAuth.js";
import { ru } from "./i18n/ru.js";
import type { TenantConfiguration } from "./api/calendarApi.js";
import type { NavItem } from "./nav/navItems.js";
import { urlOf } from "./testing/urlOf.js";

/**
 * `11-14`: proves the shell's own hard requirement - that the desktop bar and the mobile drawer are
 * two renderers over one array, not two lists that happen to agree today. The mock below is the only
 * way to demonstrate that honestly: it changes what `buildNavItems` returns and checks that *both*
 * renderers moved, which a test that only reads the six real items could not distinguish from two
 * lists kept in sync by hand.
 *
 * The rest of this file covers what jsdom can prove about `NavDrawer` and what it cannot -
 * `NavDrawer.tsx`'s own doc comment has the full reasoning: jsdom has no `showModal`/`close` at all
 * (not merely no focus semantics), so `App.tsx`'s feature-detected fallback (toggling the `open`
 * property directly) is what every test below actually exercises. Backdrop-click and choosing-an-item
 * are genuinely proven here, because both are this codebase's own click-handling logic. Escape is
 * proven only as "our `onCancel` handler does the right thing when the `cancel` event fires" - not
 * "pressing Escape fires that event", which is the browser's job and is proven for real in
 * `ux-gate/navDrawer.spec.ts`. Focus entering, being trapped, and returning to the hamburger are not
 * attempted here at all, for the same reason: jsdom cannot produce a true answer to any of them.
 */
vi.mock("./nav/navItems.js", async () => {
  const actual = await vi.importActual<typeof import("./nav/navItems.js")>("./nav/navItems.js");
  return {
    ...actual,
    buildNavItems: (...args: Parameters<typeof actual.buildNavItems>) => [
      ...actual.buildNavItems(...args),
      { to: "/extra-test-item", label: "Extra test item" } satisfies NavItem,
    ],
  };
});

const CONFIGURATION: TenantConfiguration = {
  tenantName: "Barbershop",
  publicKey: "demo",
  allowedOrigins: [],
  calendars: [],
  workers: [],
  services: [],
};

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: RequestInfo | URL) => {
      const target = urlOf(url);
      if (target.includes("/configuration")) {
        return Promise.resolve(
          new Response(JSON.stringify(CONFIGURATION), { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }
      return Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
    }),
  );
}

function renderApp() {
  const auth: AuthState = {
    accessToken: TEST_TOKEN,
    displayName: "Sam",
    isLoading: false,
    signIn: () => undefined,
    signOut: () => undefined,
  };

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("the shell's navigation - one array, two renderers", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("an item added to buildNavItems appears in both the bar and the drawer", () => {
    stubFetch();
    const { container } = renderApp();

    const bar = container.querySelector("nav.top-nav");
    const drawer = container.querySelector(".nav-drawer__list");
    expect(bar).not.toBeNull();
    expect(drawer).not.toBeNull();

    expect(bar?.textContent).toContain("Extra test item");
    expect(drawer?.textContent).toContain("Extra test item");
  });

  it("the drawer's items match the bar's items exactly, in the same order - would fail if the drawer rendered anything else", () => {
    stubFetch();
    const { container } = renderApp();

    const bar = container.querySelector("nav.top-nav");
    const drawer = container.querySelector(".nav-drawer__list");
    const barLabels = Array.from(bar?.querySelectorAll("a") ?? []).map((a) => a.textContent);
    const drawerLabels = Array.from(drawer?.querySelectorAll("a") ?? []).map((a) => a.textContent);

    expect(barLabels.length).toBeGreaterThan(0);
    expect(drawerLabels).toEqual(barLabels);
  });
});

describe("the mobile drawer - open, and the two dismissal routes jsdom can honestly prove", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("the hamburger opens the drawer and reflects it in aria-expanded", async () => {
    stubFetch();
    renderApp();

    const hamburger = screen.getByRole("button", { name: ru.navMenuLabel });
    expect(hamburger.getAttribute("aria-expanded")).toBe("false");

    const dialog = document.querySelector<HTMLDialogElement>(".nav-drawer");
    expect(dialog.open).toBe(false);

    await userEvent.click(hamburger);

    expect(hamburger.getAttribute("aria-expanded")).toBe("true");
    expect(dialog.open).toBe(true);
  });

  it("a click on the backdrop (the dialog element itself, not its content) closes the drawer", async () => {
    stubFetch();
    renderApp();

    await userEvent.click(screen.getByRole("button", { name: ru.navMenuLabel }));
    const dialog = document.querySelector<HTMLDialogElement>(".nav-drawer");
    expect(dialog.open).toBe(true);

    // A click event whose target is the `<dialog>` element itself - what a real backdrop click looks
    // like, since `::backdrop` is not its own event target.
    fireEvent.click(dialog);

    expect(dialog.open).toBe(false);
  });

  it("choosing an item in the drawer closes it and navigates to that screen", async () => {
    stubFetch();
    renderApp();

    await userEvent.click(screen.getByRole("button", { name: ru.navMenuLabel }));
    const dialog = document.querySelector<HTMLDialogElement>(".nav-drawer");
    const workersLink = within(dialog).getByRole("link", { name: ru.navWorkers });

    await userEvent.click(workersLink);

    expect(dialog.open).toBe(false);
    // A heading query, not `findByText` - the bar's own "Сотрудники" link is real text on the page
    // too (`ru.navWorkers` and `ru.workersTitle` are the same word), and only a role-scoped query
    // (a heading is not a link) tells the two apart without depending on the drawer's own visibility.
    expect(await screen.findByRole("heading", { name: ru.workersTitle })).toBeDefined();
  });

  it("our own onCancel handler closes the drawer when the dialog's `cancel` event fires", async () => {
    // Does not prove that pressing Escape fires this event in jsdom - it does not, since jsdom has no
    // native dialog-cancel behaviour at all. What this proves is that *when a browser fires it* (which
    // a real modal `<dialog>` does on Escape, and `ux-gate/navDrawer.spec.ts` confirms against a real
    // one), this component's own handler does the right thing: prevent the default and close.
    stubFetch();
    renderApp();

    await userEvent.click(screen.getByRole("button", { name: ru.navMenuLabel }));
    const dialog = document.querySelector<HTMLDialogElement>(".nav-drawer");
    expect(dialog.open).toBe(true);

    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(dialog.open).toBe(false);
  });
});
