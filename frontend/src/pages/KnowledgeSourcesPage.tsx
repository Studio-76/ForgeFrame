import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createKnowledgeSource,
  fetchInstances,
  fetchKnowledgeSourceDetail,
  fetchKnowledgeSources,
  updateKnowledgeSource,
  type KnowledgeSourceDetail,
  type KnowledgeSourceKind,
  type KnowledgeSourceStatus,
  type KnowledgeSourceSummary,
  type VisibilityScope,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { buildContactPath, buildMemoryPath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const SOURCE_KIND_OPTIONS: Array<KnowledgeSourceKind | "all"> = ["all", "mail", "calendar", "contacts", "drive", "knowledge_base"];
const STATUS_OPTIONS: Array<KnowledgeSourceStatus | "all"> = ["all", "active", "paused", "error"];
const VISIBILITY_OPTIONS: VisibilityScope[] = ["instance", "team", "personal", "restricted"];

const DEFAULT_CREATE_FORM = {
  sourceId: "",
  sourceKind: "mail" as KnowledgeSourceKind,
  label: "",
  description: "",
  connectionTarget: "",
  status: "active" as KnowledgeSourceStatus,
  visibilityScope: "team" as VisibilityScope,
  lastSyncedAt: "",
  lastError: "",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  label: "",
  description: "",
  connectionTarget: "",
  status: "active" as KnowledgeSourceStatus,
  visibilityScope: "team" as VisibilityScope,
  lastSyncedAt: "",
  lastError: "",
  metadataJson: "{}",
};

export function KnowledgeSourcesPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedSourceId = searchParams.get("sourceId")?.trim() ?? "";
  const sourceKindFilter = (searchParams.get("sourceKind")?.trim() as KnowledgeSourceKind | "all" | "") || "all";
  const statusFilter = (searchParams.get("status")?.trim() as KnowledgeSourceStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [sources, setSources] = useState<KnowledgeSourceSummary[]>([]);
  const [detail, setDetail] = useState<KnowledgeSourceDetail | null>(null);
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
        setError(loadError instanceof Error ? loadError.message : "Knowledge-source instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setSources([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchKnowledgeSources(instanceId, { sourceKind: sourceKindFilter, status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setSources(payload.sources);
        setListState("success");
        setError("");

        const nextSourceId = payload.sources.some((source) => source.source_id === selectedSourceId)
          ? selectedSourceId
          : payload.sources[0]?.source_id ?? "";
        if (nextSourceId !== selectedSourceId) {
          updateRoute((next) => {
            if (nextSourceId) {
              next.set("sourceId", nextSourceId);
            } else {
              next.delete("sourceId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setSources([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Knowledge-source inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedSourceId, sourceKindFilter, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedSourceId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchKnowledgeSourceDetail(selectedSourceId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.source);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Knowledge-source detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedSourceId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    setEditForm({
      label: detail.label,
      description: detail.description,
      connectionTarget: detail.connection_target,
      status: detail.status,
      visibilityScope: detail.visibility_scope,
      lastSyncedAt: detail.last_synced_at ?? "",
      lastError: detail.last_error ?? "",
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
      const payload = await createKnowledgeSource(instanceId, {
        source_id: normalizeOptional(createForm.sourceId),
        source_kind: createForm.sourceKind,
        label: createForm.label.trim(),
        description: createForm.description.trim(),
        connection_target: createForm.connectionTarget.trim(),
        status: createForm.status,
        visibility_scope: createForm.visibilityScope,
        last_synced_at: normalizeOptional(createForm.lastSyncedAt),
        last_error: normalizeOptional(createForm.lastError),
        metadata: parseJsonObject(createForm.metadataJson, "Knowledge-source metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("sourceId", payload.source.source_id);
      });
      setMessage(`Knowledge source ${payload.source.source_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Knowledge-source creation failed.");
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
      const payload = await updateKnowledgeSource(instanceId, detail.source_id, {
        label: editForm.label.trim(),
        description: editForm.description.trim(),
        connection_target: editForm.connectionTarget.trim(),
        status: editForm.status,
        visibility_scope: editForm.visibilityScope,
        last_synced_at: normalizeOptional(editForm.lastSyncedAt),
        last_error: normalizeOptional(editForm.lastError),
        metadata: parseJsonObject(editForm.metadataJson, "Knowledge-source metadata"),
      });
      setMessage(`Knowledge source ${payload.source.source_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Knowledge-source update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Knowledge Sources"
          description="ForgeFrame is restoring connector-backed source truth before exposing sync and context posture."
          question="Which source inventory should open once the active session is restored?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect linked contacts after scope resolves." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Knowledge sources stay instance-scoped and must surface sync state, visibility, and linkage truth."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Knowledge Sources"
          description="This route is reserved for operators and admins who can inspect real connector and context-source truth."
          question="Which adjacent surface should remain open while source access is outside the current permission envelope?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contact posture without opening source records." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approvals while source truth remains closed." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic source shell when the session cannot inspect real source state."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Knowledge Sources"
        description="Connector-backed knowledge and context sources with sync posture, visibility scope, contact linkage, and memory linkage."
        question="Are these sources real product objects with sync and governance truth, or just decorative connector labels?"
        links={[
          { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Stay on the knowledge-source inventory and detail surface." },
          { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contact records linked to the selected source." },
          { label: "Memory", to: CONTROL_PLANE_ROUTES.memory, description: "Review context records linked to the selected source." },
          { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Inspect work linked downstream from source-derived context." },
        ]}
        badges={[
          { label: `${sources.length} source${sources.length === 1 ? "" : "s"}`, tone: sources.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Knowledge sources are first-class objects. Sync truth, visibility, and downstream work linkage cannot stay implicit."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the source inventory by kind and lifecycle state.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Knowledge-source instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("sourceId");
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
            Source kind
            <select
              aria-label="Knowledge-source kind filter"
              value={sourceKindFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("sourceKind");
                } else {
                  next.set("sourceKind", nextValue);
                }
                next.delete("sourceId");
              })}
            >
              {SOURCE_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Knowledge-source status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("sourceId");
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
              <h3>Knowledge-source inventory</h3>
              <p className="fg-muted">Each row is a persisted context source with sync posture, not a cosmetic connector stub.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading knowledge-source inventory.</p> : null}
          {listState === "success" && sources.length === 0 ? <p className="fg-muted">No knowledge sources matched the selected filters.</p> : null}

          {sources.length > 0 ? (
            <div className="fg-stack">
              {sources.map((source) => (
                <button
                  key={source.source_id}
                  type="button"
                  className={`fg-data-row${source.source_id === selectedSourceId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("sourceId", source.source_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{source.source_id}</span>
                      <strong>{source.label}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={source.status === "active" ? "success" : source.status === "error" ? "danger" : "warning"}>
                        {source.status}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{source.source_kind} · {source.visibility_scope}</span>
                    <span className="fg-muted">contacts {source.contact_count} · memory {source.memory_count}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Knowledge-source detail</h3>
              <p className="fg-muted">Connector target, sync state, contacts, and context records converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.source_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a knowledge source to inspect linked context truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading knowledge-source detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <article className="fg-subcard">
                <h4>Summary</h4>
                <ul className="fg-list">
                  <li>Source kind: {detail.source_kind}</li>
                  <li>Status: {detail.status}</li>
                  <li>Visibility: {detail.visibility_scope}</li>
                  <li>Connection target: {detail.connection_target}</li>
                  <li>Last synced: {detail.last_synced_at ?? "Not recorded"}</li>
                  <li>Last error: {detail.last_error ?? "None"}</li>
                </ul>
                <p>{detail.description || "No description was recorded."}</p>
              </article>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Linked contacts</h4>
                  {detail.contacts.length === 0 ? <p className="fg-muted">No contacts are linked to this source.</p> : (
                    <ul className="fg-list">
                      {detail.contacts.map((contact) => (
                        <li key={contact.contact_id}>
                          <Link to={buildContactPath({ instanceId, contactId: contact.contact_id })}>{contact.display_name}</Link>
                          {" · "}{contact.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
                <article className="fg-subcard">
                  <h4>Linked memory</h4>
                  {detail.memory_entries.length === 0 ? <p className="fg-muted">No memory entries are linked to this source.</p> : (
                    <ul className="fg-list">
                      {detail.memory_entries.map((memory) => (
                        <li key={memory.memory_id}>
                          <Link to={buildMemoryPath({ instanceId, memoryId: memory.memory_id })}>{memory.title}</Link>
                          {" · "}{memory.memory_kind}{" · "}{memory.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create knowledge source</h3>
              <p className="fg-muted">Create a durable connector-backed source with sync posture and governed metadata.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Source ID
                <input value={createForm.sourceId} onChange={(event) => setCreateForm((current) => ({ ...current, sourceId: event.target.value }))} placeholder="source_mail_primary" />
              </label>
              <label>
                Source kind
                <select value={createForm.sourceKind} onChange={(event) => setCreateForm((current) => ({ ...current, sourceKind: event.target.value as KnowledgeSourceKind }))}>
                  {SOURCE_KIND_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as KnowledgeSourceStatus }))}>
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Label
                <input value={createForm.label} onChange={(event) => setCreateForm((current) => ({ ...current, label: event.target.value }))} placeholder="Primary mail connector" />
              </label>
              <label>
                Connection target
                <input value={createForm.connectionTarget} onChange={(event) => setCreateForm((current) => ({ ...current, connectionTarget: event.target.value }))} placeholder="imap://mail.example.com/inbox" />
              </label>
              <label>
                Visibility
                <select value={createForm.visibilityScope} onChange={(event) => setCreateForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                  {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea rows={3} value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Last synced at
                <input value={createForm.lastSyncedAt} onChange={(event) => setCreateForm((current) => ({ ...current, lastSyncedAt: event.target.value }))} placeholder="2026-04-23T10:00:00Z" />
              </label>
              <label>
                Last error
                <input value={createForm.lastError} onChange={(event) => setCreateForm((current) => ({ ...current, lastError: event.target.value }))} placeholder="Optional sync error" />
              </label>
            </div>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.label.trim() || !createForm.connectionTarget.trim()}>
                {savingCreate ? "Creating knowledge source" : "Create knowledge source"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit knowledge source</h3>
              <p className="fg-muted">Keep the selected source aligned with connector target, sync posture, and visibility truth.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.source_id : "Select a knowledge source"}</span>
          </div>

          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Label
                  <input value={editForm.label} onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} />
                </label>
                <label>
                  Connection target
                  <input value={editForm.connectionTarget} onChange={(event) => setEditForm((current) => ({ ...current, connectionTarget: event.target.value }))} />
                </label>
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as KnowledgeSourceStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <label>
                Description
                <textarea rows={3} value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Visibility
                  <select value={editForm.visibilityScope} onChange={(event) => setEditForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                    {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Last synced at
                  <input value={editForm.lastSyncedAt} onChange={(event) => setEditForm((current) => ({ ...current, lastSyncedAt: event.target.value }))} />
                </label>
                <label>
                  Last error
                  <input value={editForm.lastError} onChange={(event) => setEditForm((current) => ({ ...current, lastError: event.target.value }))} />
                </label>
              </div>
              <label>
                Metadata JSON
                <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate}>
                  {savingUpdate ? "Saving knowledge source" : "Save knowledge source"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select a knowledge source before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
