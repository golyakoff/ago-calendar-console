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
import { useStrings } from "../i18n/StringsContext.js";
import type { ConsoleStrings } from "../i18n/strings.js";
import { weekdayNames } from "../i18n/format.js";

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
  const strings = useStrings();
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
          setError(errorMessage(reason, strings));
        }
      }
    },
    [accessToken, strings],
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
      setError(errorMessage(reason, strings));
    } finally {
      setBusy(false);
    }
  };

  if (accessToken === null) {
    return null;
  }

  if (configuration === null) {
    return error === null ? <p className="muted">{strings.loading}</p> : <p className="error">{error}</p>;
  }

  const days = weekdayNames(strings);

  return (
    <div className="stack">
      {error !== null && <p className="error">{error}</p>}

      <section className="panel">
        <h2>{configuration.tenantName}</h2>
        <p className="muted">{strings.setupEmbedDescription}</p>
        <pre aria-label={strings.setupEmbedSnippetAriaLabel}>{embedSnippet(configuration.publicKey)}</pre>

        <h3>{strings.setupOriginsTitle}</h3>
        <p className="muted">{strings.setupOriginsDescription}</p>
        <OriginsForm
          origins={configuration.allowedOrigins}
          disabled={busy}
          strings={strings}
          onSubmit={(origins) => void run(() => setAllowedOrigins(accessToken, origins))}
        />
      </section>

      <section className="panel">
        <h2>{strings.setupCalendarsTitle}</h2>
        <ul>
          {configuration.calendars.map((calendar) => (
            <li key={calendar.calendarId}>
              <strong>{calendar.name}</strong> · {calendar.timeZone} ·{" "}
              {calendar.isPublished ? strings.publishedLabel : strings.notPublishedLabel}
              <ul>
                {calendar.workingHours.map((rule) => (
                  <li key={rule.ruleId}>
                    {days[rule.dayOfWeek]} {rule.startsAt}–{rule.endsAt} ·{" "}
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
          strings={strings}
          onSubmit={(body) => void run(() => createCalendar(accessToken, body))}
        />
      </section>

      <section className="panel">
        <h2>{strings.setupServicesTitle}</h2>
        <ul>
          {configuration.services.map((service) => (
            <li key={service.serviceId}>
              {service.name} · {service.durationMinutes}
              {strings.setupServiceMinutesSuffix}
            </li>
          ))}
        </ul>
        <ServiceForm disabled={busy} strings={strings} onSubmit={(body) => void run(() => createService(accessToken, body))} />
      </section>

      <section className="panel">
        <h2>{strings.setupWorkingHoursTitle}</h2>
        <p className="muted">{strings.setupWorkingHoursDescription}</p>
        <WorkingHoursForm
          configuration={configuration}
          disabled={busy}
          strings={strings}
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
  strings,
  onSubmit,
}: {
  origins: string[];
  disabled: boolean;
  strings: ConsoleStrings;
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
      <label htmlFor="origins">{strings.setupOriginsFieldLabel}</label>
      <textarea
        id="origins"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="https://shop.example"
      />
      <button type="submit" disabled={disabled}>
        {strings.setupSaveOriginsButton}
      </button>
    </form>
  );
}

function CalendarForm({
  disabled,
  strings,
  onSubmit,
}: {
  disabled: boolean;
  strings: ConsoleStrings;
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
      <label htmlFor="calendar-name">{strings.setupCalendarNameLabel}</label>
      <input id="calendar-name" value={name} onChange={(event) => setName(event.target.value)} required />

      <label htmlFor="calendar-zone">{strings.setupCalendarZoneLabel}</label>
      {/* An IANA zone id, never an offset: an offset is wrong for half the year in any zone that
          observes DST, and this value can never be changed once slots exist. */}
      <input id="calendar-zone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} required />

      <label>
        <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} /> {strings.setupCalendarPublishedLabel}
      </label>

      <button type="submit" disabled={disabled}>
        {strings.setupAddCalendarButton}
      </button>
    </form>
  );
}

function ServiceForm({
  disabled,
  strings,
  onSubmit,
}: {
  disabled: boolean;
  strings: ConsoleStrings;
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
      <label htmlFor="service-name">{strings.setupServiceNameLabel}</label>
      <input id="service-name" value={name} onChange={(event) => setName(event.target.value)} required />

      <label htmlFor="service-duration">{strings.setupServiceDurationLabel}</label>
      <input
        id="service-duration"
        type="number"
        min={1}
        value={durationMinutes}
        onChange={(event) => setDurationMinutes(Number(event.target.value))}
      />

      <button type="submit" disabled={disabled}>
        {strings.setupAddServiceButton}
      </button>
    </form>
  );
}

function WorkingHoursForm({
  configuration,
  disabled,
  strings,
  onSubmit,
}: {
  configuration: TenantConfiguration;
  disabled: boolean;
  strings: ConsoleStrings;
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
    return <p className="muted">{strings.setupNoWorkersNote}</p>;
  }

  const worker = configuration.workers.find((candidate) => candidate.workerId === workerId) ?? configuration.workers[0];
  const calendar = configuration.calendars.find((candidate) => candidate.workerIds.includes(worker.workerId));
  const days = weekdayNames(strings);

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
      <label htmlFor="hours-worker">{strings.workerFieldLabel}</label>
      <select id="hours-worker" value={worker.workerId} onChange={(event) => setWorkerId(event.target.value)}>
        {configuration.workers.map((candidate) => (
          <option key={candidate.workerId} value={candidate.workerId}>
            {candidate.displayName}
          </option>
        ))}
      </select>

      <label htmlFor="hours-day">{strings.dayFieldLabel}</label>
      <select id="hours-day" value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value))}>
        {days.map((day, index) => (
          <option key={day} value={index}>
            {day}
          </option>
        ))}
      </select>

      <label htmlFor="hours-start">{strings.opensFieldLabel}</label>
      <input id="hours-start" type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />

      <label htmlFor="hours-end">{strings.closesFieldLabel}</label>
      <input id="hours-end" type="time" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />

      <button type="submit" disabled={disabled || calendar === undefined}>
        {strings.setupAddWorkingHoursButton}
      </button>
      {calendar === undefined && <p className="muted">{strings.setupWorkerNotOnCalendarNote}</p>}
    </form>
  );
}
