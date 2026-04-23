import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createContact,
  fetchContactDetail,
  fetchContacts,
  fetchInstances,
  updateContact,
  type ContactDetail,
  type ContactStatus,
  type ContactSummary,
  type VisibilityScope,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { buildConversationPath, buildKnowledgeSourcePath, buildMemoryPath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<ContactStatus | "all"> = ["all", "active", "snoozed", "archived"];
const VISIBILITY_OPTIONS: VisibilityScope[] = ["instance", "team", "personal", "restricted"];

const DEFAULT_CREATE_FORM = {
  contactId: "",
  contactRef: "",
  sourceId: "",
  displayName: "",
  primaryEmail: "",
  primaryPhone: "",
  organization: "",
  title: "",
  status: "active" as ContactStatus,
  visibilityScope: "team" as VisibilityScope,
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  contactRef: "",
  sourceId: "",
  displayName: "",
  primaryEmail: "",
  primaryPhone: "",
  organization: "",
  title: "",
  status: "active" as ContactStatus,
  visibilityScope: "team" as VisibilityScope,
  metadataJson: "{}",
};

export function ContactsPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedContactId = searchParams.get("contactId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as ContactStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Contact instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setContacts([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchContacts(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setContacts(payload.contacts);
        setListState("success");
        setError("");

        const nextContactId = payload.contacts.some((contact) => contact.contact_id === selectedContactId)
          ? selectedContactId
          : payload.contacts[0]?.contact_id ?? "";
        if (nextContactId !== selectedContactId) {
          updateRoute((next) => {
            if (nextContactId) {
              next.set("contactId", nextContactId);
            } else {
              next.delete("contactId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setContacts([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Contact inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedContactId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedContactId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchContactDetail(selectedContactId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.contact);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Contact detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedContactId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    setEditForm({
      contactRef: detail.contact_ref,
      sourceId: detail.source_id ?? "",
      displayName: detail.display_name,
      primaryEmail: detail.primary_email ?? "",
      primaryPhone: detail.primary_phone ?? "",
      organization: detail.organization ?? "",
      title: detail.title ?? "",
      status: detail.status,
      visibilityScope: detail.visibility_scope,
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
  }, [detail]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createContact(instanceId, {
        contact_id: normalizeOptional(createForm.contactId),
        contact_ref: normalizeOptional(createForm.contactRef),
        source_id: normalizeOptional(createForm.sourceId),
        display_name: createForm.displayName.trim(),
        primary_email: normalizeOptional(createForm.primaryEmail),
        primary_phone: normalizeOptional(createForm.primaryPhone),
        organization: normalizeOptional(createForm.organization),
        title: normalizeOptional(createForm.title),
        status: createForm.status,
        visibility_scope: createForm.visibilityScope,
        metadata: parseJsonObject(createForm.metadataJson, "Contact metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("contactId", payload.contact.contact_id);
      });
      setMessage(`Contact ${payload.contact.contact_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Contact creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      const payload = await updateContact(instanceId, detail.contact_id, {
        contact_ref: normalizeOptional(editForm.contactRef),
        source_id: normalizeOptional(editForm.sourceId),
        display_name: editForm.displayName.trim(),
        primary_email: normalizeOptional(editForm.primaryEmail),
        primary_phone: normalizeOptional(editForm.primaryPhone),
        organization: normalizeOptional(editForm.organization),
        title: normalizeOptional(editForm.title),
        status: editForm.status,
        visibility_scope: editForm.visibilityScope,
        metadata: parseJsonObject(editForm.metadataJson, "Contact metadata"),
      });
      setMessage(`Contact ${payload.contact.contact_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Contact update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Contacts"
          description="ForgeFrame is restoring scoped contact truth before exposing linked context and source records."
          question="Which contact surface should open once the active session is restored?"
          links={[
            { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Inspect source inventory once session scope resolves." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Contacts stay instance-scoped and must link back to knowledge sources, conversations, and memory."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Contacts"
          description="This route is reserved for operators and admins who can inspect real contact and context truth."
          question="Which adjacent surface should remain open while contact access is outside the current permission envelope?"
          links={[
            { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Inspect source posture without opening contact records." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approvals while contact truth remains closed." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic contact shell when the session cannot inspect real contact state."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Contacts"
        description="Persistent contact records with source linkage, conversation linkage, and recent memory truth."
        question="Are these contact records real, linked objects, or is work still leaking into free-form refs and external address books?"
        links={[
          { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Stay on the contact inventory and detail surface." },
          { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Inspect the connector-backed source registry behind these contacts." },
          { label: "Memory", to: CONTROL_PLANE_ROUTES.memory, description: "Review context records linked to the selected contact." },
          { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Open conversation truth linked to the selected contact." },
        ]}
        badges={[
          { label: `${contacts.length} contact${contacts.length === 1 ? "" : "s"}`, tone: contacts.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Contacts are first-class product records. They cannot collapse back into ad-hoc refs or opaque connector payloads."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the contact inventory by lifecycle state.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Contact instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("contactId");
              })}
            >
              {instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Contact status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("contactId");
              })}
            >
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Contact inventory</h3>
              <p className="fg-muted">Each row is a persisted contact, not an ungoverned reference string.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading contact inventory.</p> : null}
          {listState === "success" && contacts.length === 0 ? <p className="fg-muted">No contacts matched the selected filters.</p> : null}

          {contacts.length > 0 ? (
            <div className="fg-stack">
              {contacts.map((contact) => (
                <button
                  key={contact.contact_id}
                  type="button"
                  className={`fg-data-row${contact.contact_id === selectedContactId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("contactId", contact.contact_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{contact.contact_id}</span>
                      <strong>{contact.display_name}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={contact.status === "active" ? "success" : contact.status === "snoozed" ? "warning" : "neutral"}>
                        {contact.status}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{contact.organization ?? "No organization"} · {contact.visibility_scope}</span>
                    <span className="fg-muted">conversations {contact.conversation_count} · memory {contact.memory_count}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Contact detail</h3>
              <p className="fg-muted">Source truth, conversation history, and recent memory converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.contact_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a contact to inspect linked context truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading contact detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Ref: {detail.contact_ref}</li>
                    <li>Status: {detail.status}</li>
                    <li>Visibility: {detail.visibility_scope}</li>
                    <li>Email: {detail.primary_email ?? "Not recorded"}</li>
                    <li>Phone: {detail.primary_phone ?? "Not recorded"}</li>
                    <li>Organization: {detail.organization ?? "Not recorded"}</li>
                    <li>Title: {detail.title ?? "Not recorded"}</li>
                  </ul>
                </article>
                <article className="fg-subcard">
                  <h4>Source linkage</h4>
                  {detail.source ? (
                    <div className="fg-stack">
                      <p><strong>{detail.source.label}</strong>{" · "}{detail.source.source_kind}</p>
                      <p className="fg-muted">Target: {detail.source.connection_target}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildKnowledgeSourcePath({ instanceId, sourceId: detail.source.source_id })}>Open source</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No knowledge source is linked to this contact.</p>}
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Recent conversations</h4>
                {detail.recent_conversations.length === 0 ? <p className="fg-muted">No conversations are linked to this contact.</p> : (
                  <ul className="fg-list">
                    {detail.recent_conversations.map((conversation) => (
                      <li key={conversation.record_id}>
                        <Link to={buildConversationPath({ instanceId, conversationId: conversation.record_id })}>{conversation.label}</Link>
                        {conversation.status ? ` · ${conversation.status}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="fg-subcard">
                <h4>Recent memory</h4>
                {detail.recent_memory.length === 0 ? <p className="fg-muted">No memory entries are linked to this contact.</p> : (
                  <ul className="fg-list">
                    {detail.recent_memory.map((memory) => (
                      <li key={memory.memory_id}>
                        <Link to={buildMemoryPath({ instanceId, memoryId: memory.memory_id })}>{memory.title}</Link>
                        {" · "}{memory.memory_kind}{" · "}{memory.status}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create contact</h3>
              <p className="fg-muted">Create a durable contact record with source linkage and governed metadata.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Contact ID
                <input value={createForm.contactId} onChange={(event) => setCreateForm((current) => ({ ...current, contactId: event.target.value }))} placeholder="contact_acme_ops" />
              </label>
              <label>
                Contact ref
                <input value={createForm.contactRef} onChange={(event) => setCreateForm((current) => ({ ...current, contactRef: event.target.value }))} placeholder="contact://acme/ops" />
              </label>
              <label>
                Source ID
                <input value={createForm.sourceId} onChange={(event) => setCreateForm((current) => ({ ...current, sourceId: event.target.value }))} placeholder="source_mail_primary" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Display name
                <input value={createForm.displayName} onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Pat Morgan" />
              </label>
              <label>
                Primary email
                <input value={createForm.primaryEmail} onChange={(event) => setCreateForm((current) => ({ ...current, primaryEmail: event.target.value }))} placeholder="pat@example.com" />
              </label>
              <label>
                Primary phone
                <input value={createForm.primaryPhone} onChange={(event) => setCreateForm((current) => ({ ...current, primaryPhone: event.target.value }))} placeholder="+49-30-555-100" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Organization
                <input value={createForm.organization} onChange={(event) => setCreateForm((current) => ({ ...current, organization: event.target.value }))} placeholder="Acme GmbH" />
              </label>
              <label>
                Title
                <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Operations Lead" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ContactStatus }))}>
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Visibility
                <select value={createForm.visibilityScope} onChange={(event) => setCreateForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                  {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.displayName.trim()}>
                {savingCreate ? "Creating contact" : "Create contact"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit contact</h3>
              <p className="fg-muted">Keep the selected contact coherent with source, visibility, and linked context truth.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.contact_id : "Select a contact"}</span>
          </div>

          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Contact ref
                  <input value={editForm.contactRef} onChange={(event) => setEditForm((current) => ({ ...current, contactRef: event.target.value }))} />
                </label>
                <label>
                  Source ID
                  <input value={editForm.sourceId} onChange={(event) => setEditForm((current) => ({ ...current, sourceId: event.target.value }))} />
                </label>
                <label>
                  Display name
                  <input value={editForm.displayName} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Primary email
                  <input value={editForm.primaryEmail} onChange={(event) => setEditForm((current) => ({ ...current, primaryEmail: event.target.value }))} />
                </label>
                <label>
                  Primary phone
                  <input value={editForm.primaryPhone} onChange={(event) => setEditForm((current) => ({ ...current, primaryPhone: event.target.value }))} />
                </label>
                <label>
                  Organization
                  <input value={editForm.organization} onChange={(event) => setEditForm((current) => ({ ...current, organization: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Title
                  <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as ContactStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Visibility
                  <select value={editForm.visibilityScope} onChange={(event) => setEditForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                    {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <label>
                Metadata JSON
                <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate}>
                  {savingUpdate ? "Saving contact" : "Save contact"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select a contact before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
