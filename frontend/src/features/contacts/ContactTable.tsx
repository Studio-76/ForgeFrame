/**
 * Contact inventory table — lists contacts with reachability, channels,
 * source, and linked work counts.
 *
 * @packageDocumentation
 */

import type { ContactSummary } from "../../api/domain";
import { channelInventoryLabel, formatTimestamp, statusTone } from "./utils";

/** Props for ContactTable. */
export interface ContactTableProps {
  /** Full list of contact summaries. */
  contacts: ContactSummary[];
  /** Currently selected contact ID. */
  selectedContactId: string;
  /** Current list loading state. */
  listState: string;
  /** Route updater function. */
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
}

/**
 * Contact inventory table — each row shows source truth, reachable channels,
 * and linked work counts.
 */
export function ContactTable({
  contacts,
  selectedContactId,
  listState,
  updateRoute,
}: ContactTableProps) {
  if (listState === "loading") {
    return (
      <article className="fg-card ff-contacts-table-container">
        <div className="ff-contacts-table-status">Loading contact inventory\u2026</div>
      </article>
    );
  }

  if (listState === "error") {
    return (
      <article className="fg-card ff-contacts-table-container">
        <div className="ff-contacts-table-status ff-contacts-table-status-error">
          Contact inventory could not be loaded.
        </div>
      </article>
    );
  }

  if (contacts.length === 0) {
    return (
      <article className="fg-card ff-contacts-table-container">
        <div className="ff-contacts-table-status">No contacts matched the selected filters.</div>
      </article>
    );
  }

  return (
    <article className="fg-card ff-contacts-table-container">
      <div className="fg-table-wrap">
        <table className="ff-contacts-table" aria-label="Contact inventory">
          <thead>
            <tr>
              <th>Name</th>
              <th>Organization</th>
              <th>Source</th>
              <th>Routes</th>
              <th>Last contact</th>
              <th>Linked</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr
                key={contact.contact_id}
                className={contact.contact_id === selectedContactId ? "ff-contacts-table-row-selected" : undefined}
              >
                <td>
                  <button
                    className="ff-contacts-table-trigger"
                    type="button"
                    onClick={() => updateRoute((next) => {
                      next.set("contactId", contact.contact_id);
                    })}
                  >
                    {contact.display_name}
                  </button>
                  <div className="ff-contacts-table-meta">
                    <span className="ff-contacts-pill ff-contacts-pill-id">{contact.contact_id}</span>
                    {" \u00b7 "}
                    <span className="ff-contacts-pill" data-tone={statusTone(contact.status)}>{contact.status}</span>
                  </div>
                  {contact.route_warnings[0] ? (
                    <div className="ff-contacts-route-warning">{contact.route_warnings[0]}</div>
                  ) : null}
                </td>
                <td>
                  <div>{contact.organization ?? "Not recorded"}</div>
                  <div className="ff-contacts-table-meta">{contact.title ?? "No title"} \u00b7 {contact.visibility_scope}</div>
                </td>
                <td>
                  <div>{contact.source_label ?? "Unlinked"}</div>
                  <div className="ff-contacts-table-meta">{contact.source_kind ?? "No source kind"}</div>
                </td>
                <td>
                  <div>{channelInventoryLabel(contact.channels)}</div>
                  <div className="ff-contacts-table-meta">{contact.reachable_channel_count} reachable route{contact.reachable_channel_count === 1 ? "" : "s"}</div>
                </td>
                <td>{formatTimestamp(contact.last_contact_at, "No contact recorded")}</td>
                <td>
                  <div>{contact.conversation_count}</div>
                  <div className="ff-contacts-table-meta">{contact.memory_count} memory</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
