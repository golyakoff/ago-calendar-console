import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { RequireAuth } from "./auth/RequireAuth.js";
import { AccessPage } from "./pages/AccessPage.js";
import { ConfigurationPage } from "./pages/ConfigurationPage.js";
import { ContactsPage } from "./pages/ContactsPage.js";
import { QueuePage } from "./pages/QueuePage.js";
import { AvailabilityPage } from "./pages/AvailabilityPage.js";
import { WorkersPage } from "./pages/WorkersPage.js";
import { SignInCallbackPage } from "./pages/SignInCallbackPage.js";

/**
 * <b>AGO Calendar's console, and deliberately not a page inside AGO Chat's.</b> `adr/0064` records
 * the decision and the alternative; the short version is `repositories.md`'s own test - a thing gets
 * its own repository when it versions or deploys independently, and this bundle tracks
 * `Ago.Calendar.Api`'s contract while `ago-console` tracks `Ago.Chat.Api`'s.
 *
 * The framework is `adr/0023`'s React, reused unchanged. **`20-06` does not re-litigate that
 * choice**, and this file is where a drift to something else would have started.
 */
export function App() {
  const { accessToken, displayName, signOut } = useAuth();

  return (
    <div className="shell">
      <header>
        <h1>AGO Calendar</h1>
        {accessToken !== null && (
          <nav>
            <NavLink to="/">Queue</NavLink>
            <NavLink to="/setup">Setup</NavLink>
            <NavLink to="/workers">Workers</NavLink>
            <NavLink to="/availability">Availability</NavLink>
            <NavLink to="/contacts">Contacts</NavLink>
            <NavLink to="/access">Access</NavLink>
          </nav>
        )}
        {accessToken !== null && (
          <div className="identity">
            <span>{displayName}</span>{" "}
            <button type="button" onClick={signOut}>
              Sign out
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
