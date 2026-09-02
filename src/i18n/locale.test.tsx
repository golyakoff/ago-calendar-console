import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { App } from "../App.js";
import { QueuePage } from "../pages/QueuePage.js";
import { WorkersPage } from "../pages/WorkersPage.js";
import { WorkerSlotsPage } from "../pages/WorkerSlotsPage.js";
import { AuthContext, type AuthState } from "../auth/AuthContext.js";
import { TEST_TOKEN, type RouteOptions } from "../testing/renderWithAuth.js";
import { urlOf } from "../testing/urlOf.js";
import { getStrings, type SupportedLocale } from "./resolve.js";
import { StringsProvider } from "./StringsContext.js";
import type { TenantConfiguration, WorkerSlot } from "../api/calendarApi.js";

/**
 * `11-15`'s own Done-when, read as a DOM test rather than asserted from the string table alone -
 * `ago-console`'s own `consoleLocale.test.tsx` set exactly this bar for the widget/console side of the
 * identical feature (`11-11`), and this is `ago-calendar-console`'s twin.
 *
 * <b>Before this item, this file could not exist</b>: there was no `<StringsProvider>`, no
 * `useStrings()`, and every page read its strings from an inline English literal (or, for
 * `WorkerScheduleSection`, a hardcoded Russian one) regardless of anything - passing the `en` table
 * here and getting Russian text, or the reverse, was not a bug the mechanism could produce because the
 * mechanism did not exist. Run against the pre-`11-15` tree, `renderWithLocale(<QueuePage/>, "ru")`
 * would show "Pending bookings" (the fixed English literal) rather than "Ожидающие подтверждения
 * записи" - the fails-before case this suite is written to catch, and the exact shape `15-11`'s own
 * gate screenshots caught live (`Иванова А. П.'s slots`, an English possessive bolted onto a Cyrillic
 * name) - the `WorkerSlotsPage` describe block below is that defect, reproduced and fixed.
 */
function renderWithLocale(element: ReactElement, locale: SupportedLocale, routing: RouteOptions = {}) {
  const { path = "*", route = "/" } = routing;
  const auth: AuthState = {
    accessToken: TEST_TOKEN,
    displayName: "Sam",
    isLoading: false,
    signIn: () => undefined,
    signOut: () => undefined,
  };

  return render(
    <AuthContext.Provider value={auth}>
      <StringsProvider value={getStrings(locale)}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={element} />
          </Routes>
        </MemoryRouter>
      </StringsProvider>
    </AuthContext.Provider>,
  );
}

describe("switching locale changes rendered text", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the pending-bookings queue in English for the en table", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }))));

    renderWithLocale(<QueuePage />, "en");

    expect(await screen.findByText("Pending bookings")).toBeDefined();
    expect(screen.getByText("Nothing is waiting.")).toBeDefined();
  });

  it("renders the same queue in Russian for the ru table - same data, different chrome", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }))));

    renderWithLocale(<QueuePage />, "ru");

    expect(await screen.findByText("Ожидающие подтверждения записи")).toBeDefined();
    expect(screen.getByText("Ничего не ожидает.")).toBeDefined();
    expect(screen.queryByText("Pending bookings")).toBeNull();
  });

  it("renders the worker card's split-name fields in Russian for the ru table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL) => {
        const target = urlOf(url);
        if (target.endsWith("/workers")) {
          return Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
        }
        const configuration: TenantConfiguration = {
          tenantName: "Barbershop",
          publicKey: "demo",
          allowedOrigins: [],
          calendars: [{ calendarId: "cal-1", name: "Main", timeZone: "UTC", isPublished: true, workerIds: [], workingHours: [] }],
          workers: [],
          services: [],
        };
        return Promise.resolve(new Response(JSON.stringify(configuration), { status: 200, headers: { "Content-Type": "application/json" } }));
      }),
    );

    renderWithLocale(<WorkersPage />, "ru");

    await screen.findByText("Сотрудники");
    await userEvent.click(await screen.findByRole("button", { name: "Добавить сотрудника" }));

    expect(await screen.findByLabelText("Фамилия")).toBeDefined();
    expect(screen.getByLabelText("Имя")).toBeDefined();
    expect(screen.getByLabelText("Отчество")).toBeDefined();
  });

  /**
   * `15-11`'s own found-live defect, reproduced directly: an English possessive suffix baked around a
   * name that is not always English. `slotsHeadingPrefix`/`slotsHeadingSuffix` fixes it by letting
   * each locale place its own fixed fragment on whichever side of the name its own grammar needs
   * (`strings.ts`'s own header has the full reasoning) - proven here both ways against the identical
   * worker name, not just in English as `WorkerSlotsPage.test.tsx` already did.
   */
  describe("the worker-slots heading - 15-11's own found defect, fixed", () => {
    const configuration: TenantConfiguration = {
      tenantName: "Barbershop",
      publicKey: "demo",
      allowedOrigins: [],
      calendars: [{ calendarId: "cal-1", name: "Main", timeZone: "UTC", isPublished: true, workerIds: ["w1"], workingHours: [] }],
      workers: [{ workerId: "w1", displayName: "Alex Doe", isActive: true, serviceIds: [] }],
      services: [],
    };
    const slots: WorkerSlot[] = [];

    function stubFetch() {
      vi.stubGlobal(
        "fetch",
        vi.fn((url: RequestInfo | URL) => {
          const target = urlOf(url);
          if (target.endsWith("/configuration")) {
            return Promise.resolve(new Response(JSON.stringify(configuration), { status: 200, headers: { "Content-Type": "application/json" } }));
          }
          if (target.includes("/slots")) {
            return Promise.resolve(new Response(JSON.stringify(slots), { status: 200, headers: { "Content-Type": "application/json" } }));
          }
          return Promise.resolve(new Response(null, { status: 204 }));
        }),
      );
    }

    it("reads 'Alex Doe’s slots' in English - the possessive suffix after the name", async () => {
      stubFetch();
      renderWithLocale(<WorkerSlotsPage />, "en", { path: "/workers/:workerId/slots", route: "/workers/w1/slots" });

      expect(await screen.findByText("Alex Doe’s slots")).toBeDefined();
    });

    it("reads 'Слоты — Alex Doe' in Russian - a fixed prefix before the name, never an English apostrophe-s", async () => {
      stubFetch();
      renderWithLocale(<WorkerSlotsPage />, "ru", { path: "/workers/:workerId/slots", route: "/workers/w1/slots" });

      expect(await screen.findByText("Слоты — Alex Doe")).toBeDefined();
      expect(screen.queryByText(/Doe’s/)).toBeNull();
    });
  });
});

describe("the app shell's own default locale", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * `App.tsx` wraps its own tree in `<StringsProvider value={getStrings(resolveConsoleLocale())}>`
   * unconditionally - unlike `ago-console`, there is no per-tenant value to read yet
   * (`resolve.ts`'s own remarks), so this is the one place that hardcoded choice is actually exercised
   * end to end, with no override from the test.
   */
  it("renders the shell's nav and sign-out in Russian, with no locale override at all", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));

    const auth: AuthState = {
      accessToken: TEST_TOKEN,
      displayName: "Sam",
      isLoading: false,
      signIn: () => undefined,
      signOut: () => undefined,
    };

    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByRole("link", { name: "Очередь" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Сотрудники" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Выйти" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Queue" })).toBeNull();
  });
});
