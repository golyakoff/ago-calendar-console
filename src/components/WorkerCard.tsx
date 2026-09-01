import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ConfiguredCalendar, ConfiguredService, WorkerDetail } from "../api/calendarApi.js";

/**
 * `20-13`: one card, used for both creating a worker and editing one.
 *
 * <b>The display-name field prefills with the derived value and only marks it custom when a human
 * actually edits it.</b> That is tracked entirely client-side, by whether *this* editing session has
 * typed into the field - not by comparing strings, which would be fooled by a coincidental match, and
 * not by asking the server first, which would be a round trip before every keystroke. The actual
 * freezing guarantee is enforced server-side, in `Worker.Rename`/`Worker.SetDisplayName`
 * (`Ago.Calendar.Domain`) - this component only decides what one submission sends, never what the
 * rule is.
 *
 * <b>Extensibility.</b> `children`, rendered after the base fields whenever a worker is being edited
 * (never on create, since there is nothing yet to attach a schedule or a slot view to). `20-14`'s
 * schedule template and `20-15`'s slot view land here without editing this file - they render a
 * section through this slot, keyed off the same `worker.workerId`. This is the one place in the
 * `20-13`→`20-18` chain deliberately given more structure than today's literal requirement, per the
 * item's own scope note that three more items build directly on this shape.
 */
export interface WorkerCardFields {
  lastName: string;
  firstName: string;
  middleName: string | null;
  /** Non-null only when the human edited the display-name field this session - see the component's
   * own remarks. */
  displayName: string | null;
  isActive: boolean;
  /** Only meaningful (and only sent) on create - v1 is one calendar per worker, chosen once. */
  calendarId: string;
  serviceIds: string[];
}

export interface WorkerCardProps {
  mode: "create" | "edit";
  worker?: WorkerDetail;
  calendars: ConfiguredCalendar[];
  services: ConfiguredService[];
  busy: boolean;
  onSubmit: (fields: WorkerCardFields) => void;
  onCancel: () => void;
  children?: ReactNode;
}

function derive(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.split(/\s+/).filter((part) => part.length > 0).join(" ");
}

export function WorkerCard({ mode, worker, calendars, services, busy, onSubmit, onCancel, children }: WorkerCardProps) {
  const [lastName, setLastName] = useState(worker?.lastName ?? "");
  const [firstName, setFirstName] = useState(worker?.firstName ?? "");
  const [middleName, setMiddleName] = useState(worker?.middleName ?? "");
  const [displayName, setDisplayName] = useState(worker?.displayName ?? "");
  // Seeded from the worker's own flag (edit mode) so an already-custom name does not silently start
  // re-deriving the moment somebody edits the last name - the same rule Worker.Rename enforces
  // server-side, mirrored here only for what the field shows while typing.
  const [displayNameTouched, setDisplayNameTouched] = useState(worker?.displayNameIsCustom ?? false);
  const [isActive, setIsActive] = useState(worker?.isActive ?? true);
  const [calendarId, setCalendarId] = useState(calendars[0]?.calendarId ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  useEffect(() => {
    if (!displayNameTouched) {
      setDisplayName(derive(firstName, lastName));
    }
  }, [firstName, lastName, displayNameTouched]);

  if (mode === "create" && calendars.length === 0) {
    return <p className="muted">Add a calendar first - a worker belongs to exactly one.</p>;
  }

  return (
    <form
      className="worker-card"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit({
          lastName,
          firstName,
          middleName: middleName.trim() === "" ? null : middleName,
          displayName: displayNameTouched ? displayName : null,
          isActive,
          calendarId: calendarId || calendars[0]?.calendarId || "",
          serviceIds,
        });
      }}
    >
      <label htmlFor="worker-last-name">Фамилия</label>
      <input
        id="worker-last-name"
        value={lastName}
        onChange={(event) => setLastName(event.target.value)}
        required
      />

      <label htmlFor="worker-first-name">Имя</label>
      <input
        id="worker-first-name"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        required
      />

      <label htmlFor="worker-middle-name">Отчество</label>
      <input id="worker-middle-name" value={middleName} onChange={(event) => setMiddleName(event.target.value)} />

      <label htmlFor="worker-display-name">Display name</label>
      <input
        id="worker-display-name"
        value={displayName}
        onChange={(event) => {
          setDisplayNameTouched(true);
          setDisplayName(event.target.value);
        }}
      />
      <p className="muted">
        {displayNameTouched
          ? "Set by hand - renaming фамилия or имя will not change it again."
          : "Derived from имя and фамилия until you edit it."}
      </p>

      {mode === "create" && (
        <>
          <label htmlFor="worker-calendar">Calendar</label>
          {/* One calendar per worker in v1 - a single select, not a multi-select, because the
              aggregate refuses a second and a multi-select would promise a shape it will not
              accept. */}
          <select id="worker-calendar" value={calendarId} onChange={(event) => setCalendarId(event.target.value)}>
            {calendars.map((calendar) => (
              <option key={calendar.calendarId} value={calendar.calendarId}>
                {calendar.name}
              </option>
            ))}
          </select>

          <fieldset>
            <legend>Services performed</legend>
            {services.map((service) => (
              <label key={service.serviceId}>
                <input
                  type="checkbox"
                  checked={serviceIds.includes(service.serviceId)}
                  onChange={(event) =>
                    setServiceIds((current) =>
                      event.target.checked
                        ? [...current, service.serviceId]
                        : current.filter((id) => id !== service.serviceId),
                    )
                  }
                />{" "}
                {service.name}
              </label>
            ))}
          </fieldset>
        </>
      )}

      {mode === "edit" && (
        <label>
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Active
        </label>
      )}

      <div className="worker-card-actions">
        <button type="submit" disabled={busy}>
          {mode === "create" ? "Add worker" : "Save"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>

      {mode === "edit" && children}
    </form>
  );
}
