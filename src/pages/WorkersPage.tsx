import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import {
  createWorker,
  deleteWorker,
  getConfiguration,
  listWorkers,
  updateWorker,
  type ConfiguredCalendar,
  type ConfiguredService,
  type WorkerDetail,
} from "../api/calendarApi.js";
import { errorMessage } from "./errorMessage.js";
import { WorkersTable } from "../components/WorkersTable.js";
import { WorkerCard, type WorkerCardFields } from "../components/WorkerCard.js";

/**
 * `20-13`: the tenant's staff list, with real CRUD - the screen `POST /workers`-only console never
 * had before this item. Replaces the bare, add-only "Workers" section `ConfigurationPage` carried
 * since `20-06`; that section is gone from there, and everything about a worker beyond initial
 * creation now lives here: renaming, the display-name override, the activity toggle, and deletion
 * for a worker nobody has ever booked.
 *
 * <b>No search, no paging, no filter.</b> The item's own scope: ten workers is a lot for this
 * product, by the author's own measure, so one table with every row in it is the whole screen.
 *
 * <b>Re-reads after every write, like `ConfigurationPage`.</b> No optimistic update: the server
 * refuses things this form cannot know about in advance (a worker with booking history, an invalid
 * name), so the authoritative answer is always the next `GET`.
 */
export function WorkersPage() {
  const { accessToken } = useAuth();
  const [workers, setWorkers] = useState<WorkerDetail[] | null>(null);
  const [calendars, setCalendars] = useState<ConfiguredCalendar[]>([]);
  const [services, setServices] = useState<ConfiguredService[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<WorkerDetail | "new" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<WorkerDetail | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (accessToken === null) {
        return;
      }

      try {
        // Two calls, not one: `listWorkers` is this item's own full-detail row shape, and
        // `getConfiguration` is still where calendars and services come from - `20-13` did not touch
        // either of those lists, and duplicating them into a second endpoint here would be a second
        // place for that shape to disagree with `ConfigurationPage`'s own read of the same data.
        const [loadedWorkers, configuration] = await Promise.all([
          listWorkers(accessToken, signal),
          getConfiguration(accessToken, signal),
        ]);
        setWorkers(loadedWorkers);
        setCalendars(configuration.calendars);
        setServices(configuration.services);
        setError(null);
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(errorMessage(reason));
        }
      }
    },
    [accessToken],
  );

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const run = async (action: () => Promise<unknown>) => {
    if (accessToken === null) {
      return;
    }

    setBusy(true);
    try {
      await action();
      await reload();
      setEditing(null);
      setConfirmingDelete(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (accessToken === null) {
    return null;
  }

  if (workers === null) {
    return error === null ? <p className="muted">Loading…</p> : <p className="error">{error}</p>;
  }

  return (
    <div className="stack">
      {error !== null && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Workers</h2>
        <WorkersTable
          workers={workers}
          renderRowActions={(worker) => (
            <>
              <button type="button" disabled={busy} onClick={() => setEditing(worker)}>
                Edit
              </button>{" "}
              <button type="button" disabled={busy} onClick={() => setConfirmingDelete(worker)}>
                Delete
              </button>
              {/* `20-14`'s schedule link and `20-15`'s slots link arrive here, as more buttons in
                  this same cell - absent until then, not broken (the item's own scope). */}
            </>
          )}
        />

        {editing === null && (
          <button type="button" disabled={busy || calendars.length === 0} onClick={() => setEditing("new")}>
            Add worker
          </button>
        )}
        {calendars.length === 0 && editing === null && (
          <p className="muted">Add a calendar first, on the Setup screen - a worker belongs to exactly one.</p>
        )}
      </section>

      {editing !== null && (
        <section className="panel">
          <h2>{editing === "new" ? "New worker" : "Edit worker"}</h2>
          <WorkerCard
            mode={editing === "new" ? "create" : "edit"}
            worker={editing === "new" ? undefined : editing}
            calendars={calendars}
            services={services}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSubmit={(fields: WorkerCardFields) =>
              void run(() =>
                editing === "new"
                  ? createWorker(accessToken, {
                      lastName: fields.lastName,
                      firstName: fields.firstName,
                      middleName: fields.middleName,
                      displayName: fields.displayName,
                      calendarId: fields.calendarId,
                      serviceIds: fields.serviceIds,
                    })
                  : updateWorker(accessToken, editing.workerId, {
                      lastName: fields.lastName,
                      firstName: fields.firstName,
                      middleName: fields.middleName,
                      displayName: fields.displayName,
                      isActive: fields.isActive,
                    }),
              )
            }
          />
        </section>
      )}

      {confirmingDelete !== null && (
        <section className="panel">
          <p>
            Delete <strong>{confirmingDelete.displayName}</strong>? This only works for a worker who has
            never been booked - one with a pending, confirmed or no-show visit is refused, and the
            console shows the server&rsquo;s own reason if it is.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => deleteWorker(accessToken, confirmingDelete.workerId))}
          >
            Delete
          </button>{" "}
          <button type="button" disabled={busy} onClick={() => setConfirmingDelete(null)}>
            Cancel
          </button>
        </section>
      )}
    </div>
  );
}
