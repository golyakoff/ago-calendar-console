import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext.js";
import {
  addWorkingHoursRule,
  createCalendar,
  createService,
  getConfiguration,
  setAllowedOrigins,
  type TenantConfiguration,
} from "../api/calendarApi.js";
import { errorMessage } from "./errorMessage.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Tenant setup: calendars, services, working hours, and the embed's own allowed origins.
 *
 * <b>One screen, three short forms, and a re-read after every write.</b> No optimistic update and no
 * client-side cache: the server refuses things this form cannot know about in advance (a duplicate
 * role name, a buffer the aggregate calls absurd), so the authoritative answer is always the next
 * `GET`. That is the right trade for a screen a tenant uses a handful of times, and it is the wrong
 * trade for the queue - which is why the queue does something different.
 *
 * <b>The public key is displayed with the script tag around it</b>, because that is the artefact the
 * shop actually needs. A key on its own leaves the last, error-prone step - writing the tag - to
 * somebody who has never seen one.
 *
 * <b>`20-13`: workers moved to their own screen.</b> This page created a worker with a single
 * display-name field and nothing else - no rename, no deactivate, no delete, and the split
 * фамилия/имя/отчество fields this item added had nowhere to go here. `WorkersPage` (the "Workers"
 * nav link) is where a worker is created, edited and deleted now; `configuration.workers` still
 * flows through this page's own state because the working-hours form below still needs it to name
 * whose hours are whose.
 */
export function ConfigurationPage() {
  const { accessToken } = useAuth();
  const [configuration, setConfiguration] = useState<TenantConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (accessToken === null) {
        return;
      }

      try {
        setConfiguration(await getConfiguration(accessToken, signal));
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
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (accessToken === null) {
    return null;
  }

  if (configuration === null) {
    return error === null ? <p className="muted">Loading…</p> : <p className="error">{error}</p>;
  }

  return (
    <div className="stack">
      {error !== null && <p className="error">{error}</p>}

      <section className="panel">
        <h2>{configuration.tenantName}</h2>
        <p className="muted">
          Paste this on your own site. One tag: the chat widget and the booking flow arrive together.
        </p>
        <pre aria-label="Embed snippet">{embedSnippet(configuration.publicKey)}</pre>

        <h3>Approved page origins</h3>
        <p className="muted">
          A page may only embed your booking surface if its origin is listed here. Scheme, host and
          port - no path.
        </p>
        <OriginsForm
          origins={configuration.allowedOrigins}
          disabled={busy}
          onSubmit={(origins) => void run(() => setAllowedOrigins(accessToken, origins))}
        />
      </section>

      <section className="panel">
        <h2>Calendars</h2>
        <ul>
          {configuration.calendars.map((calendar) => (
            <li key={calendar.calendarId}>
              <strong>{calendar.name}</strong> · {calendar.timeZone} ·{" "}
              {calendar.isPublished ? "published" : "not published"}
              <ul>
                {calendar.workingHours.map((rule) => (
                  <li key={rule.ruleId}>
                    {DAY_NAMES[rule.dayOfWeek]} {rule.startsAt}–{rule.endsAt} ·{" "}
                    {configuration.workers.find((worker) => worker.workerId === rule.workerId)?.displayName ??
                      rule.workerId}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <CalendarForm
          disabled={busy}
          onSubmit={(body) => void run(() => createCalendar(accessToken, body))}
        />
      </section>

      <section className="panel">
        <h2>Services</h2>
        <ul>
          {configuration.services.map((service) => (
            <li key={service.serviceId}>
              {service.name} · {service.durationMinutes} min
            </li>
          ))}
        </ul>
        <ServiceForm disabled={busy} onSubmit={(body) => void run(() => createService(accessToken, body))} />
      </section>

      <section className="panel">
        <h2>Working hours</h2>
        <p className="muted">
          Wall clock in the calendar&rsquo;s own time zone - &ldquo;we open at nine&rdquo;, not an
          instant. A shift that crosses midnight is two rules on two days.
        </p>
        <WorkingHoursForm
          configuration={configuration}
          disabled={busy}
          onSubmit={(body) => void run(() => addWorkingHoursRule(accessToken, body))}
        />
      </section>
    </div>
  );
}

function embedSnippet(publicKey: string): string {
  return [
    `<script src="https://…/ago-chat.js"`,
    `        data-site="YOUR-CHAT-SITE-KEY"`,
    `        data-booking="${publicKey}"`,
    `        data-booking-api="${config().apiBaseUrl}"`,
    `        async></script>`,
  ].join("\n");
}

// A function rather than a module-level read, so the snippet reflects the deployment this bundle was
// built for without this file importing config at module scope in a test's way.
function config() {
  return { apiBaseUrl: import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "") };
}

function OriginsForm({
  origins,
  disabled,
  onSubmit,
}: {
  origins: string[];
  disabled: boolean;
  onSubmit: (origins: string[]) => void;
}) {
  const [text, setText] = useState(origins.join("\n"));

  useEffect(() => setText(origins.join("\n")), [origins]);

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit(
          text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
        );
      }}
    >
      <label htmlFor="origins">One origin per line</label>
      <textarea
        id="origins"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="https://shop.example"
      />
      <button type="submit" disabled={disabled}>
        Save origins
      </button>
    </form>
  );
}

function CalendarForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (body: { name: string; timeZone: string; publish: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [timeZone, setTimeZone] = useState("Europe/Moscow");
  const [publish, setPublish] = useState(true);

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit({ name, timeZone, publish });
        setName("");
      }}
    >
      <label htmlFor="calendar-name">Calendar name</label>
      <input id="calendar-name" value={name} onChange={(event) => setName(event.target.value)} required />

      <label htmlFor="calendar-zone">IANA time zone</label>
      {/* An IANA zone id, never an offset: an offset is wrong for half the year in any zone that
          observes DST, and this value can never be changed once slots exist. */}
      <input id="calendar-zone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} required />

      <label>
        <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} /> Published
      </label>

      <button type="submit" disabled={disabled}>
        Add calendar
      </button>
    </form>
  );
}

function ServiceForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (body: { name: string; durationMinutes: number }) => void;
}) {
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit({ name, durationMinutes });
        setName("");
      }}
    >
      <label htmlFor="service-name">Service name</label>
      <input id="service-name" value={name} onChange={(event) => setName(event.target.value)} required />

      <label htmlFor="service-duration">Duration (minutes)</label>
      <input
        id="service-duration"
        type="number"
        min={1}
        value={durationMinutes}
        onChange={(event) => setDurationMinutes(Number(event.target.value))}
      />

      <button type="submit" disabled={disabled}>
        Add service
      </button>
    </form>
  );
}

function WorkingHoursForm({
  configuration,
  disabled,
  onSubmit,
}: {
  configuration: TenantConfiguration;
  disabled: boolean;
  onSubmit: (body: {
    calendarId: string;
    workerId: string;
    dayOfWeek: number;
    startsAt: string;
    endsAt: string;
  }) => void;
}) {
  const [workerId, setWorkerId] = useState(configuration.workers[0]?.workerId ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("18:00");

  if (configuration.workers.length === 0) {
    return <p className="muted">Add a worker first - working hours belong to a worker on a calendar.</p>;
  }

  const worker = configuration.workers.find((candidate) => candidate.workerId === workerId) ?? configuration.workers[0];
  const calendar = configuration.calendars.find((candidate) => candidate.workerIds.includes(worker.workerId));

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (calendar === undefined) {
          return;
        }
        onSubmit({ calendarId: calendar.calendarId, workerId: worker.workerId, dayOfWeek, startsAt, endsAt });
      }}
    >
      <label htmlFor="hours-worker">Worker</label>
      <select id="hours-worker" value={worker.workerId} onChange={(event) => setWorkerId(event.target.value)}>
        {configuration.workers.map((candidate) => (
          <option key={candidate.workerId} value={candidate.workerId}>
            {candidate.displayName}
          </option>
        ))}
      </select>

      <label htmlFor="hours-day">Day</label>
      <select id="hours-day" value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value))}>
        {DAY_NAMES.map((day, index) => (
          <option key={day} value={index}>
            {day}
          </option>
        ))}
      </select>

      <label htmlFor="hours-start">Opens</label>
      <input id="hours-start" type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />

      <label htmlFor="hours-end">Closes</label>
      <input id="hours-end" type="time" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />

      <button type="submit" disabled={disabled || calendar === undefined}>
        Add working hours
      </button>
      {calendar === undefined && (
        <p className="muted">That worker is not on a calendar yet, so there are no hours to give them.</p>
      )}
    </form>
  );
}
