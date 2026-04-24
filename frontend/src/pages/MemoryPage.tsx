import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  correctMemoryEntry,
  createMemoryEntry,
  deleteMemoryEntry,
  fetchInstances,
  fetchMemoryDetail,
  fetchMemoryEntries,
  revokeMemoryEntry,
  updateMemoryEntry,
  type MemoryDetail,
  type MemoryKind,
  type MemorySensitivity,
  type MemoryStatus,
  type MemorySummary,
  type VisibilityScope,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildContactPath,
  buildConversationPath,
  buildKnowledgeSourcePath,
  buildMemoryPath,
  buildLearningPath,
  buildNotificationPath,
  buildTaskPath,
  buildWorkspacePath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<MemoryStatus | "all"> = ["all", "active", "corrected", "deleted"];
const VISIBILITY_OPTIONS: Array<VisibilityScope | "all"> = ["all", "instance", "team", "personal", "restricted"];
const MEMORY_KIND_OPTIONS: MemoryKind[] = ["fact", "preference", "constraint", "summary"];
const SENSITIVITY_OPTIONS: MemorySensitivity[] = ["normal", "sensitive", "restricted"];

const DEFAULT_CREATE_FORM = {
  memoryId: "",
  sourceId: "",
  contactId: "",
  conversationId: "",
  taskId: "",
  notificationId: "",
  workspaceId: "",
  memoryKind: "fact" as MemoryKind,
  title: "",
  body: "",
  visibilityScope: "team" as VisibilityScope,
  sensitivity: "normal" as MemorySensitivity,
  correctionNote: "",
  expiresAt: "",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  sourceId: "",
  contactId: "",
  conversationId: "",
  taskId: "",
  notificationId: "",
  workspaceId: "",
  memoryKind: "fact" as MemoryKind,
  title: "",
  body: "",
  visibilityScope: "team" as VisibilityScope,
  sensitivity: "normal" as MemorySensitivity,
  correctionNote: "",
  expiresAt: "",
  metadataJson: "{}",
};

const DEFAULT_CORRECTION_FORM = {
  title: "",
  body: "",
  correctionNote: "",
  memoryKind: "fact" as MemoryKind,
  visibilityScope: "team" as VisibilityScope,
  sensitivity: "normal" as MemorySensitivity,
  expiresAt: "",
  metadataJson: "{}",
};

const DEFAULT_DELETE_FORM = {
  deletionNote: "",
};

const DEFAULT_REVOKE_FORM = {
  revocationNote: "",
};

export function MemoryPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedMemoryId = searchParams.get("memoryId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as MemoryStatus | "all" | "") || "all";
  const visibilityFilter = (searchParams.get("visibilityScope")?.trim() as VisibilityScope | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [memoryEntries, setMemoryEntries] = useState<MemorySummary[]>([]);
  const [detail, setDetail] = useState<MemoryDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [correctionForm, setCorrectionForm] = useState(DEFAULT_CORRECTION_FORM);
  const [deleteForm, setDeleteForm] = useState(DEFAULT_DELETE_FORM);
  const [revokeForm, setRevokeForm] = useState(DEFAULT_REVOKE_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [savingDelete, setSavingDelete] = useState(false);
  const [savingRevoke, setSavingRevoke] = useState(false);
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
        setError(loadError instanceof Error ? loadError.message : "Memory instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setMemoryEntries([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchMemoryEntries(instanceId, { status: statusFilter, visibilityScope: visibilityFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setMemoryEntries(payload.memory);
        setListState("success");
        setError("");

        const nextMemoryId = payload.memory.some((entry) => entry.memory_id === selectedMemoryId)
          ? selectedMemoryId
          : payload.memory[0]?.memory_id ?? "";
        if (nextMemoryId !== selectedMemoryId) {
          updateRoute((next) => {
            if (nextMemoryId) {
              next.set("memoryId", nextMemoryId);
            } else {
              next.delete("memoryId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setMemoryEntries([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Memory inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedMemoryId, statusFilter, visibilityFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedMemoryId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchMemoryDetail(selectedMemoryId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.memory);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Memory detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedMemoryId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setCorrectionForm(DEFAULT_CORRECTION_FORM);
      setDeleteForm(DEFAULT_DELETE_FORM);
      setRevokeForm(DEFAULT_REVOKE_FORM);
      return;
    }

    setEditForm({
      sourceId: detail.source_id ?? "",
      contactId: detail.contact_id ?? "",
      conversationId: detail.conversation_id ?? "",
      taskId: detail.task_id ?? "",
      notificationId: detail.notification_id ?? "",
      workspaceId: detail.workspace_id ?? "",
      memoryKind: detail.memory_kind,
      title: detail.title,
      body: detail.body,
      visibilityScope: detail.visibility_scope,
      sensitivity: detail.sensitivity,
      correctionNote: detail.correction_note ?? "",
      expiresAt: detail.expires_at ?? "",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
    setCorrectionForm({
      title: detail.title,
      body: detail.body,
      correctionNote: "",
      memoryKind: detail.memory_kind,
      visibilityScope: detail.visibility_scope,
      sensitivity: detail.sensitivity,
      expiresAt: detail.expires_at ?? "",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
    setDeleteForm(DEFAULT_DELETE_FORM);
    setRevokeForm(DEFAULT_REVOKE_FORM);
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
      const payload = await createMemoryEntry(instanceId, {
        memory_id: normalizeOptional(createForm.memoryId),
        source_id: normalizeOptional(createForm.sourceId),
        contact_id: normalizeOptional(createForm.contactId),
        conversation_id: normalizeOptional(createForm.conversationId),
        task_id: normalizeOptional(createForm.taskId),
        notification_id: normalizeOptional(createForm.notificationId),
        workspace_id: normalizeOptional(createForm.workspaceId),
        memory_kind: createForm.memoryKind,
        title: createForm.title.trim(),
        body: createForm.body.trim(),
        visibility_scope: createForm.visibilityScope,
        sensitivity: createForm.sensitivity,
        correction_note: normalizeOptional(createForm.correctionNote),
        expires_at: normalizeOptional(createForm.expiresAt),
        metadata: parseJsonObject(createForm.metadataJson, "Memory metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("memoryId", payload.memory.memory_id);
      });
      setMessage(`Memory entry ${payload.memory.memory_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory creation failed.");
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
      const payload = await updateMemoryEntry(instanceId, detail.memory_id, {
        source_id: normalizeOptional(editForm.sourceId),
        contact_id: normalizeOptional(editForm.contactId),
        conversation_id: normalizeOptional(editForm.conversationId),
        task_id: normalizeOptional(editForm.taskId),
        notification_id: normalizeOptional(editForm.notificationId),
        workspace_id: normalizeOptional(editForm.workspaceId),
        memory_kind: editForm.memoryKind,
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        visibility_scope: editForm.visibilityScope,
        sensitivity: editForm.sensitivity,
        correction_note: normalizeOptional(editForm.correctionNote),
        expires_at: normalizeOptional(editForm.expiresAt),
        metadata: parseJsonObject(editForm.metadataJson, "Memory metadata"),
      });
      setMessage(`Memory entry ${payload.memory.memory_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleCorrect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingCorrection(true);
    setError("");
    setMessage("");
    try {
      const payload = await correctMemoryEntry(instanceId, detail.memory_id, {
        title: correctionForm.title.trim(),
        body: correctionForm.body.trim(),
        correction_note: correctionForm.correctionNote.trim(),
        memory_kind: correctionForm.memoryKind,
        visibility_scope: correctionForm.visibilityScope,
        sensitivity: correctionForm.sensitivity,
        expires_at: normalizeOptional(correctionForm.expiresAt),
        metadata: parseJsonObject(correctionForm.metadataJson, "Correction metadata"),
      });
      updateRoute((next) => {
        next.set("memoryId", payload.memory.memory_id);
      });
      setMessage(`Memory entry ${payload.memory.memory_id} corrected.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory correction failed.");
    } finally {
      setSavingCorrection(false);
    }
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingDelete(true);
    setError("");
    setMessage("");
    try {
      const payload = await deleteMemoryEntry(instanceId, detail.memory_id, {
        deletion_note: normalizeOptional(deleteForm.deletionNote),
      });
      setMessage(`Memory entry ${payload.memory.memory_id} deleted.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory deletion failed.");
    } finally {
      setSavingDelete(false);
    }
  };

  const handleRevoke = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingRevoke(true);
    setError("");
    setMessage("");
    try {
      const payload = await revokeMemoryEntry(instanceId, detail.memory_id, {
        revocation_note: revokeForm.revocationNote.trim(),
      });
      setMessage(`Memory entry ${payload.memory.memory_id} revoked.`);
      setRefreshNonce((current) => current + 1);
      setRevokeForm(DEFAULT_REVOKE_FORM);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory revocation failed.");
    } finally {
      setSavingRevoke(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Memory"
          description="ForgeFrame is restoring scoped context truth before exposing correction and deletion controls."
          question="Which context surface should open once the active session is restored?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect linked contacts after scope resolves." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Memory stays instance-scoped and must expose visibility, sensitivity, correction, and deletion truth."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Memory"
          description="This route is reserved for operators and admins who can inspect real context and memory truth."
          question="Which adjacent surface should remain open while memory access is outside the current permission envelope?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contact posture without opening memory records." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approvals while memory truth remains closed." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic memory shell when the session cannot inspect real context state."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Memory"
        description="Correctable and deletable context records with sensitivity, visibility, and direct links back to source, contact, conversation, task, notification, and workspace truth."
        question="Is this context actually governed and revisable, or is memory still hiding as unbounded prompt residue?"
        links={[
          { label: "Memory", to: CONTROL_PLANE_ROUTES.memory, description: "Stay on the memory inventory and detail surface." },
          { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contacts linked to the selected memory entry." },
          { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Inspect source truth behind the selected memory entry." },
          { label: "Tasks", to: CONTROL_PLANE_ROUTES.tasks, description: "Open work records linked to the selected memory entry." },
        ]}
        badges={[
          { label: `${memoryEntries.length} memory entr${memoryEntries.length === 1 ? "y" : "ies"}`, tone: memoryEntries.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Memory is a first-class product record. Correction, deletion, sensitivity, and scope must stay visible and enforceable."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the memory inventory by lifecycle state and visibility scope.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Memory instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("memoryId");
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
              aria-label="Memory status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("memoryId");
              })}
            >
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Visibility
            <select
              aria-label="Memory visibility filter"
              value={visibilityFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("visibilityScope");
                } else {
                  next.set("visibilityScope", nextValue);
                }
                next.delete("memoryId");
              })}
            >
              {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Memory inventory</h3>
              <p className="fg-muted">Each row is a persisted context record with lifecycle state, not a hidden prompt artifact.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading memory inventory.</p> : null}
          {listState === "success" && memoryEntries.length === 0 ? <p className="fg-muted">No memory entries matched the selected filters.</p> : null}

          {memoryEntries.length > 0 ? (
            <div className="fg-stack">
              {memoryEntries.map((memory) => (
                <button
                  key={memory.memory_id}
                  type="button"
                  className={`fg-data-row${memory.memory_id === selectedMemoryId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("memoryId", memory.memory_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{memory.memory_id}</span>
                      <strong>{memory.title}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={memory.status === "active" ? "success" : memory.status === "deleted" ? "danger" : "warning"}>
                        {memory.status}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{memory.memory_kind} · {memory.visibility_scope} · {memory.sensitivity}</span>
                    <span className="fg-muted">truth {memory.truth_state} · trust {memory.source_trust_class}{memory.human_override ? " · human override" : ""}</span>
                    <span className="fg-muted">{memory.contact_id ?? memory.source_id ?? "unlinked"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Memory detail</h3>
              <p className="fg-muted">Source, contact, work-item, and correction truth converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.memory_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a memory entry to inspect linked context truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading memory detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <article className="fg-subcard">
                <h4>Summary</h4>
                <ul className="fg-list">
                  <li>Kind: {detail.memory_kind}</li>
                  <li>Status: {detail.status}</li>
                  <li>Truth state: {detail.truth_state}</li>
                  <li>Source trust: {detail.source_trust_class}</li>
                  <li>Human override: {detail.human_override ? "yes" : "no"}</li>
                  <li>Visibility: {detail.visibility_scope}</li>
                  <li>Sensitivity: {detail.sensitivity}</li>
                  <li>Correction note: {detail.correction_note ?? "None"}</li>
                  <li>Supersedes: {detail.supersedes_memory_id ?? "None"}</li>
                  <li>Learned from event: {detail.learned_from_event_id ?? "None"}</li>
                  <li>Expires at: {detail.expires_at ?? "Not scheduled"}</li>
                  <li>Deleted at: {detail.deleted_at ?? "Not deleted"}</li>
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Body</h4>
                <p>{detail.body}</p>
              </article>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Truth maintenance</h4>
                  <ul className="fg-list">
                    <li>Truth state: {detail.truth_state}</li>
                    <li>Source trust class: {detail.source_trust_class}</li>
                    <li>Human override: {detail.human_override ? "Applied" : "No"}</li>
                    <li>Learned from event: {detail.learned_from_event_id ?? "Not linked"}</li>
                  </ul>
                  <div className="fg-actions">
                    {detail.learned_from_event_id ? (
                      <Link
                        className="fg-nav-link"
                        to={buildLearningPath({ instanceId, eventId: detail.learned_from_event_id })}
                      >
                        Open learning event
                      </Link>
                    ) : null}
                    {detail.supersedes_memory_id ? (
                      <Link
                        className="fg-nav-link"
                        to={buildMemoryPath({ instanceId, memoryId: detail.supersedes_memory_id })}
                      >
                        Open superseded memory
                      </Link>
                    ) : null}
                  </div>
                </article>
                <article className="fg-subcard">
                  <h4>Source linkage</h4>
                  {detail.source ? (
                    <div className="fg-stack">
                      <p><strong>{detail.source.label}</strong>{" · "}{detail.source.source_kind}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildKnowledgeSourcePath({ instanceId, sourceId: detail.source.source_id })}>Open source</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No source is linked to this memory entry.</p>}
                </article>
                <article className="fg-subcard">
                  <h4>Contact linkage</h4>
                  {detail.contact ? (
                    <div className="fg-stack">
                      <p><strong>{detail.contact.display_name}</strong>{" · "}{detail.contact.status}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildContactPath({ instanceId, contactId: detail.contact.contact_id })}>Open contact</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No contact is linked to this memory entry.</p>}
                </article>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Conversation linkage</h4>
                  {detail.conversation ? (
                    <div className="fg-stack">
                      <p><strong>{detail.conversation.label}</strong>{detail.conversation.status ? ` · ${detail.conversation.status}` : ""}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.conversation.record_id })}>Open conversation</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No conversation is linked to this memory entry.</p>}
                </article>
                <article className="fg-subcard">
                  <h4>Task linkage</h4>
                  {detail.task ? (
                    <div className="fg-stack">
                      <p><strong>{detail.task.label}</strong>{detail.task.status ? ` · ${detail.task.status}` : ""}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: detail.task.record_id })}>Open task</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No task is linked to this memory entry.</p>}
                </article>
                <article className="fg-subcard">
                  <h4>Notification linkage</h4>
                  {detail.notification ? (
                    <div className="fg-stack">
                      <p><strong>{detail.notification.label}</strong>{detail.notification.status ? ` · ${detail.notification.status}` : ""}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildNotificationPath({ instanceId, notificationId: detail.notification.record_id })}>Open notification</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No notification is linked to this memory entry.</p>}
                </article>
                <article className="fg-subcard">
                  <h4>Workspace linkage</h4>
                  {detail.workspace ? (
                    <div className="fg-stack">
                      <p><strong>{detail.workspace.label}</strong>{detail.workspace.status ? ` · ${detail.workspace.status}` : ""}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace.record_id })}>Open workspace</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No workspace is linked to this memory entry.</p>}
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
              <h3>Create memory entry</h3>
              <p className="fg-muted">Create a durable context record with explicit links, scope, sensitivity, and expiry posture.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Memory ID
                <input value={createForm.memoryId} onChange={(event) => setCreateForm((current) => ({ ...current, memoryId: event.target.value }))} placeholder="memory_pricing_preference" />
              </label>
              <label>
                Source ID
                <input value={createForm.sourceId} onChange={(event) => setCreateForm((current) => ({ ...current, sourceId: event.target.value }))} />
              </label>
              <label>
                Contact ID
                <input value={createForm.contactId} onChange={(event) => setCreateForm((current) => ({ ...current, contactId: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Conversation ID
                <input value={createForm.conversationId} onChange={(event) => setCreateForm((current) => ({ ...current, conversationId: event.target.value }))} />
              </label>
              <label>
                Task ID
                <input value={createForm.taskId} onChange={(event) => setCreateForm((current) => ({ ...current, taskId: event.target.value }))} />
              </label>
              <label>
                Notification ID
                <input value={createForm.notificationId} onChange={(event) => setCreateForm((current) => ({ ...current, notificationId: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Workspace ID
                <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} />
              </label>
              <label>
                Memory kind
                <select value={createForm.memoryKind} onChange={(event) => setCreateForm((current) => ({ ...current, memoryKind: event.target.value as MemoryKind }))}>
                  {MEMORY_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Visibility
                <select value={createForm.visibilityScope} onChange={(event) => setCreateForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                  {VISIBILITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Sensitivity
                <select value={createForm.sensitivity} onChange={(event) => setCreateForm((current) => ({ ...current, sensitivity: event.target.value as MemorySensitivity }))}>
                  {SENSITIVITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Expires at
                <input value={createForm.expiresAt} onChange={(event) => setCreateForm((current) => ({ ...current, expiresAt: event.target.value }))} placeholder="2026-04-24T09:00:00Z" />
              </label>
            </div>
            <label>
              Title
              <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Pricing preference" />
            </label>
            <label>
              Body
              <textarea rows={4} value={createForm.body} onChange={(event) => setCreateForm((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <label>
              Correction note
              <input value={createForm.correctionNote} onChange={(event) => setCreateForm((current) => ({ ...current, correctionNote: event.target.value }))} placeholder="Optional initial correction note" />
            </label>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim() || !createForm.body.trim()}>
                {savingCreate ? "Creating memory entry" : "Create memory entry"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit and govern memory</h3>
              <p className="fg-muted">Keep the selected memory entry coherent, then correct or delete it with explicit operator evidence.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.memory_id : "Select a memory entry"}</span>
          </div>

          {detail ? (
            <div className="fg-stack">
              <form className="fg-stack" onSubmit={handleUpdate}>
                <h4>Save memory</h4>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Source ID
                    <input value={editForm.sourceId} onChange={(event) => setEditForm((current) => ({ ...current, sourceId: event.target.value }))} />
                  </label>
                  <label>
                    Contact ID
                    <input value={editForm.contactId} onChange={(event) => setEditForm((current) => ({ ...current, contactId: event.target.value }))} />
                  </label>
                  <label>
                    Conversation ID
                    <input value={editForm.conversationId} onChange={(event) => setEditForm((current) => ({ ...current, conversationId: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Task ID
                    <input value={editForm.taskId} onChange={(event) => setEditForm((current) => ({ ...current, taskId: event.target.value }))} />
                  </label>
                  <label>
                    Notification ID
                    <input value={editForm.notificationId} onChange={(event) => setEditForm((current) => ({ ...current, notificationId: event.target.value }))} />
                  </label>
                  <label>
                    Workspace ID
                    <input value={editForm.workspaceId} onChange={(event) => setEditForm((current) => ({ ...current, workspaceId: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Memory kind
                    <select value={editForm.memoryKind} onChange={(event) => setEditForm((current) => ({ ...current, memoryKind: event.target.value as MemoryKind }))}>
                      {MEMORY_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Visibility
                    <select value={editForm.visibilityScope} onChange={(event) => setEditForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                      {VISIBILITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Sensitivity
                    <select value={editForm.sensitivity} onChange={(event) => setEditForm((current) => ({ ...current, sensitivity: event.target.value as MemorySensitivity }))}>
                      {SENSITIVITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Expires at
                    <input value={editForm.expiresAt} onChange={(event) => setEditForm((current) => ({ ...current, expiresAt: event.target.value }))} />
                  </label>
                  <label>
                    Correction note
                    <input value={editForm.correctionNote} onChange={(event) => setEditForm((current) => ({ ...current, correctionNote: event.target.value }))} />
                  </label>
                </div>
                <label>
                  Title
                  <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>
                  Body
                  <textarea rows={4} value={editForm.body} onChange={(event) => setEditForm((current) => ({ ...current, body: event.target.value }))} />
                </label>
                <label>
                  Metadata JSON
                  <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingUpdate}>
                    {savingUpdate ? "Saving memory" : "Save memory"}
                  </button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleCorrect}>
                <h4>Correct memory</h4>
                <label>
                  Title
                  <input value={correctionForm.title} onChange={(event) => setCorrectionForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>
                  Body
                  <textarea rows={4} value={correctionForm.body} onChange={(event) => setCorrectionForm((current) => ({ ...current, body: event.target.value }))} />
                </label>
                <label>
                  Correction note
                  <input value={correctionForm.correctionNote} onChange={(event) => setCorrectionForm((current) => ({ ...current, correctionNote: event.target.value }))} placeholder="Reason for correction" />
                </label>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Memory kind
                    <select value={correctionForm.memoryKind} onChange={(event) => setCorrectionForm((current) => ({ ...current, memoryKind: event.target.value as MemoryKind }))}>
                      {MEMORY_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Visibility
                    <select value={correctionForm.visibilityScope} onChange={(event) => setCorrectionForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                      {VISIBILITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Sensitivity
                    <select value={correctionForm.sensitivity} onChange={(event) => setCorrectionForm((current) => ({ ...current, sensitivity: event.target.value as MemorySensitivity }))}>
                      {SENSITIVITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  Expires at
                  <input value={correctionForm.expiresAt} onChange={(event) => setCorrectionForm((current) => ({ ...current, expiresAt: event.target.value }))} />
                </label>
                <label>
                  Metadata JSON
                  <textarea rows={6} value={correctionForm.metadataJson} onChange={(event) => setCorrectionForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingCorrection || !correctionForm.title.trim() || !correctionForm.body.trim() || !correctionForm.correctionNote.trim()}>
                    {savingCorrection ? "Correcting memory" : "Correct memory"}
                  </button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleDelete}>
                <h4>Delete memory</h4>
                <label>
                  Deletion note
                  <input value={deleteForm.deletionNote} onChange={(event) => setDeleteForm({ deletionNote: event.target.value })} placeholder="Reason for deletion" />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingDelete}>
                    {savingDelete ? "Deleting memory" : "Delete memory"}
                  </button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleRevoke}>
                <h4>Revoke memory</h4>
                <label>
                  Revocation note
                  <input
                    value={revokeForm.revocationNote}
                    onChange={(event) => setRevokeForm({ revocationNote: event.target.value })}
                    placeholder="Reason for revocation"
                  />
                </label>
                <div className="fg-actions">
                  <button
                    type="submit"
                    disabled={!canMutate || savingRevoke || !revokeForm.revocationNote.trim() || detail.status === "deleted"}
                  >
                    {savingRevoke ? "Revoking memory" : "Revoke memory"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="fg-muted">Select a memory entry before attempting a mutation, correction, or deletion.</p>
          )}
        </article>
      </div>
    </section>
  );
}
