import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { RequireAuth } from "./auth/RequireAuth.js";
import { AccessPage } from "./pages/AccessPage.js";
import { ConfigurationPage } from "./pages/ConfigurationPage.js";
import { ContactsPage } from "./pages/ContactsPage.js";
import { QueuePage } from "./pages/QueuePage.js";
import { AvailabilityPage } from "./pages/AvailabilityPage.js";
import { WorkersPage } from "./pages/WorkersPage.js";
import { WorkerSlotsPage } from "./pages/WorkerSlotsPage.js";
import { WorkerRecutPage } from "./pages/WorkerRecutPage.js";
import { SignInCallbackPage } from "./pages/SignInCallbackPage.js";
import { getStrings, resolveConsoleLocale } from "./i18n/resolve.js";
import { StringsProvider, useStrings } from "./i18n/StringsContext.js";

/**
 * <b>AGO Calendar's console, and deliberately not a page inside AGO Chat's.</b> `adr/0064` records
 * the decision and the alternative; the short version is `repositories.md`'s own test - a thing gets
 * its own repository when it versions or deploys independently, and this bundle tracks
 * `Ago.Calendar.Api`'s contract while `ago-console` tracks `Ago.Chat.Api`'s.
 *
 * The framework is `adr/0023`'s React, reused unchanged. **`20-06` does not re-litigate that
 * choice**, and this file is where a drift to something else would have started.
 *
 * `11-15`: this is also where `<StringsProvider>` mounts, once, for the whole tree - `resolve.ts`'s
 * own remarks explain why the value it is given (`getStrings(resolveConsoleLocale())`) is a hardcoded
 * constant rather than anything read off this identity or a tenant record. "AGO Calendar" itself is
 * never in the string table: a product's own brand name is a technical identifier, not interface
 * chrome a translator should touch (`11-15`'s own backlog item names exactly this exemption).
 */
export function App() {
  return (
    <StringsProvider value={getStrings(resolveConsoleLocale())}>
      <AppShell />
    </StringsProvider>
  );
}

function AppShell() {
  const { accessToken, displayName, signOut } = useAuth();
  const strings = useStrings();

  return (
    <div className="shell">
      <header>
        <h1>AGO Calendar</h1>
        {accessToken !== null && (
          <nav>
            <NavLink to="/">{strings.navQueue}</NavLink>
            <NavLink to="/setup">{strings.navSetup}</NavLink>
            <NavLink to="/workers">{strings.navWorkers}</NavLink>
            <NavLink to="/availability">{strings.navAvailability}</NavLink>
            <NavLink to="/contacts">{strings.navContacts}</NavLink>
            <NavLink to="/access">{strings.navAccess}</NavLink>
          </nav>
        )}
        {accessToken !== null && (
          <div className="identity">
            <span>{displayName}</span>{" "}
            <button type="button" onClick={signOut}>
              {strings.signOut}
            </button>
          </div>
        )}
      </header>

      <main>
        <Routes>
          <Route path="/callback" element={<SignInCallbackPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <QueuePage />
              </RequireAuth>
            }
          />
          <Route
            path="/setup"
            element={
              <RequireAuth>
                <ConfigurationPage />
              </RequireAuth>
            }
          />
          <Route
            path="/workers"
            element={
              <RequireAuth>
                <WorkersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/workers/:workerId/slots"
            element={
              <RequireAuth>
                <WorkerSlotsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/workers/:workerId/recut"
            element={
              <RequireAuth>
                <WorkerRecutPage />
              </RequireAuth>
            }
          />
          <Route
            path="/availability"
            element={
              <RequireAuth>
                <AvailabilityPage />
              </RequireAuth>
            }
          />
          <Route
            path="/contacts"
            element={
              <RequireAuth>
                <ContactsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/access"
            element={
              <RequireAuth>
                <AccessPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
