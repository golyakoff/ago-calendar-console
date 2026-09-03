import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { getContacts, type Contact } from "../api/calendarApi.js";
import { errorMessage } from "./errorMessage.js";
import { useStrings } from "../i18n/StringsContext.js";
import { formatDate } from "../i18n/format.js";

/**
 * `20-12`'s own new kind of screen: every customer lead card the tenant holds, in one plain table -
 * `18-08`'s own restraint carried over (a Dapper read store, a plain table, no charting library), but
 * this report lists raw personal data rather than aggregate counts, and is gated on `customer:read`
 * rather than a configuration permission for exactly that reason.
 */
export function ContactsPage() {
  const { accessToken } = useAuth();
  const strings = useStrings();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (accessToken === null) {
        return;
      }

      try {
        setContacts(await getContacts(accessToken, signal));
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

  if (accessToken === null) {
    return null;
  }

  return (
    <section className="panel">
      <h2>{strings.contactsTitle}</h2>
      <p className="muted">{strings.contactsDescription}</p>

      {error !== null && <p className="error">{error}</p>}

      {contacts === null && error === null && <p className="muted">{strings.loading}</p>}

      {contacts !== null && contacts.length === 0 && <p className="muted">{strings.contactsEmpty}</p>}

      {contacts !== null && contacts.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">{strings.contactsColumnPhone}</th>
              <th scope="col">{strings.contactsColumnName}</th>
              <th scope="col">{strings.contactsColumnNotes}</th>
              <th scope="col">{strings.contactsColumnNoShows}</th>
              <th scope="col">{strings.contactsColumnFirstSeen}</th>
              <th scope="col">{strings.contactsColumnLastSeen}</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.customerId}>
                <td>{contact.phone}</td>
                <td>{contact.displayName ?? <span className="muted">{strings.notRecordedLabel}</span>}</td>
                <td>{contact.notes ?? <span className="muted">—</span>}</td>
                <td>{contact.noShowCount}</td>
                <td>{formatDate(contact.firstSeenAt, strings)}</td>
                <td>{formatDate(contact.lastSeenAt, strings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button type="button" onClick={() => void reload()}>
        {strings.refreshButton}
      </button>
    </section>
  );
}
