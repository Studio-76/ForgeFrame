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
import { buildContactPath, buildConversationPath, buildMemoryPath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const SOURCE_KIND_OPTIONS: Array<KnowledgeSourceKind | "all"> = ["all", "mail", "calendar", "contacts", "drive", "knowledge_base"];
const STATUS_OPTIONS: Array<KnowledgeSourceStatus | "all"> = ["all", "active", "paused", "error"];
const VISIBILITY_OPTIONS: VisibilityScope[] = ["instance", "team", "personal", "restricted"];

const SOURCE_KIND_CONFIG: Record<KnowledgeSourceKind, {
  targetLabel: string;
  targetHint: string;
  targetPlaceholder: string;
  accountLabel: string;
  accountPlaceholder: string;
  collectionLabel: string;
  collectionPlaceholder: string;
}> = {
  mail: {
    targetLabel: "Mailbox target",
    targetHint: "Point this source at the real mailbox or ingest alias that powers recall. Sync still happens outside this page.",
    targetPlaceholder: "imap://mail.example.com/inbox",
    accountLabel: "Mailbox account",
    accountPlaceholder: "ops@example.com",
    collectionLabel: "Folder / label",
    collectionPlaceholder: "INBOX/Customers",
  },
  calendar: {
    targetLabel: "Calendar target",
    targetHint: "Use the concrete calendar feed or room calendar this source reflects.",
    targetPlaceholder: "calendar://team-primary",
    accountLabel: "Calendar account",
    accountPlaceholder: "calendar@example.com",
    collectionLabel: "Calendar / window",
    collectionPlaceholder: "Primary calendar",
  },
  contacts: {
    targetLabel: "Directory target",
    targetHint: "This should name the upstream contact directory or CRM projection behind source recall.",
    targetPlaceholder: "contacts://crm/global",
    accountLabel: "Directory account",
    accountPlaceholder: "crm-service-account",
    collectionLabel: "List / segment",
    collectionPlaceholder: "Enterprise customers",
  },
  drive: {
    targetLabel: "Library target",
    targetHint: "Point at the file corpus or library this source indexes for recall.",
    targetPlaceholder: "drive://shared/pricing",
    accountLabel: "Drive account",
    accountPlaceholder: "drive-sync@example.com",
    collectionLabel: "Root folder",
    collectionPlaceholder: "/pricing",
  },
  knowledge_base: {
    targetLabel: "Knowledge target",
    targetHint: "Use the concrete corpus, collection, or namespace that powers durable recall.",
    targetPlaceholder: "kb://pricing-playbook",
    accountLabel: "Connector identity",
    accountPlaceholder: "kb-sync-service",
    collectionLabel: "Collection / namespace",
    collectionPlaceholder: "pricing-playbook",
  },
};

const DEFAULT_STRUCTURED_FIELDS = {
  label: "",
  description: "",
  connectionTarget: "",
  status: "active" as KnowledgeSourceStatus,
  visibilityScope: "team" as VisibilityScope,
  lastSyncedAt: "",
  lastError: "",
  connectorAccount: "",
  connectorCollection: "",
  indexMode: "",
  recallClass: "",
  scopeNote: "",
  errorNextStep: "",
  advancedMetadataJson: "{}",
};

const DEFAULT_CREATE_FORM = {
  sourceId: "",
  sourceKind: "mail" as KnowledgeSourceKind,
  ...DEFAULT_STRUCTURED_FIELDS,
};

const DEFAULT_EDIT_FORM = {
  sourceKind: "mail" as KnowledgeSourceKind,
  ...DEFAULT_STRUCTURED_FIELDS,
};

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

function sourceStatusTone(status: KnowledgeSourceStatus): "success" | "warning" | "danger" {
  if (status === "active") {
    return "success";
  }
  if (status === "paused") {
    return "warning";
  }
  return "danger";
}

function syncTone(state: string): "success" | "warning" | "danger" {
  if (state === "synced") {
    return "success";
  }
  if (state === "attention_required") {
    return "danger";
  }
  return "warning";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

function cleanupSection(section: Record<string, unknown>, keys: string[]) {
  keys.forEach((key) => {
    const value = section[key];
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      delete section[key];
    }
  });
}

function splitSourceMetadata(detail: KnowledgeSourceDetail) {
  const advanced = cloneMetadata(detail.metadata);
  const connector = asRecord(advanced.connector) ?? {};
  const boundary = asRecord(advanced.knowledge_boundary) ?? {};
  const errorGuidance = asRecord(advanced.error_guidance) ?? {};

  const connectorAccount = readString(connector.account || advanced.connector_account).trim();
  const connectorCollection = readString(connector.collection || advanced.collection).trim();
  const indexMode = readString(connector.index_mode || advanced.index_mode).trim();
  const recallClass = readString(boundary.recall_class || advanced.recall_class).trim();
  const scopeNote = readString(boundary.scope_note || advanced.scope_note).trim();
  const errorNextStep = readString(errorGuidance.next_step || advanced.sync_next_step).trim();

  delete connector.account;
  delete connector.collection;
  delete connector.index_mode;
  cleanupSection(connector, Object.keys(connector));
  if (Object.keys(connector).length === 0) {
    delete advanced.connector;
  } else {
    advanced.connector = connector;
  }
  delete advanced.connector_account;
  delete advanced.collection;
  delete advanced.index_mode;

  delete boundary.recall_class;
  delete boundary.scope_note;
  cleanupSection(boundary, Object.keys(boundary));
  if (Object.keys(boundary).length === 0) {
    delete advanced.knowledge_boundary;
  } else {
    advanced.knowledge_boundary = boundary;
  }
  delete advanced.recall_class;
  delete advanced.scope_note;

  delete errorGuidance.next_step;
  cleanupSection(errorGuidance, Object.keys(errorGuidance));
  if (Object.keys(errorGuidance).length === 0) {
    delete advanced.error_guidance;
  } else {
    advanced.error_guidance = errorGuidance;
  }
  delete advanced.sync_next_step;

  return {
    connectorAccount,
    connectorCollection,
    indexMode,
    recallClass,
    scopeNote,
    errorNextStep,
    advancedMetadataJson: JSON.stringify(advanced, null, 2),
  };
}

function buildSourceMetadata(form: typeof DEFAULT_CREATE_FORM | typeof DEFAULT_EDIT_FORM): Record<string, unknown> {
  const metadata = parseJsonObject(form.advancedMetadataJson, "Knowledge-source advanced metadata");
  const connector = { ...(asRecord(metadata.connector) ?? {}) };
  const knowledgeBoundary = { ...(asRecord(metadata.knowledge_boundary) ?? {}) };
  const errorGuidance = { ...(asRecord(metadata.error_guidance) ?? {}) };
  delete metadata.connector;
  delete metadata.knowledge_boundary;
  delete metadata.error_guidance;

  if (normalizeOptional(form.connectorAccount)) {
    connector.account = form.connectorAccount.trim();
  }
  if (normalizeOptional(form.connectorCollection)) {
    connector.collection = form.connectorCollection.trim();
  }
  if (normalizeOptional(form.indexMode)) {
    connector.index_mode = form.indexMode.trim();
  }
  cleanupSection(connector, Object.keys(connector));
  if (Object.keys(connector).length > 0) {
    metadata.connector = connector;
  }

  if (normalizeOptional(form.recallClass)) {
    knowledgeBoundary.recall_class = form.recallClass.trim();
  }
  if (normalizeOptional(form.scopeNote)) {
    knowledgeBoundary.scope_note = form.scopeNote.trim();
  }
  cleanupSection(knowledgeBoundary, Object.keys(knowledgeBoundary));
  if (Object.keys(knowledgeBoundary).length > 0) {
    metadata.knowledge_boundary = knowledgeBoundary;
  }

  if (normalizeOptional(form.errorNextStep)) {
    errorGuidance.next_step = form.errorNextStep.trim();
  }
  cleanupSection(errorGuidance, Object.keys(errorGuidance));
  if (Object.keys(errorGuidance).length > 0) {
    metadata.error_guidance = errorGuidance;
  }

  return metadata;
}

function buildSkillPath(instanceId: string, skillId: string): string {
  const search = new URLSearchParams();
  if (instanceId.trim()) {
    search.set("instanceId", instanceId.trim());
  }
  search.set("skillId", skillId);
  return `${CONTROL_PLANE_ROUTES.skills}?${search.toString()}`;
}

function buildInventoryPath(path: string, instanceId: string): string {
  if (!instanceId.trim()) {
    return path;
  }
  return `${path}?instanceId=${encodeURIComponent(instanceId.trim())}`;
}

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

  const sourceKindConfig = SOURCE_KIND_CONFIG[detail?.source_kind ?? editForm.sourceKind ?? createForm.sourceKind];
  const createSourceKindConfig = SOURCE_KIND_CONFIG[createForm.sourceKind];

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

    const structuredMetadata = splitSourceMetadata(detail);
    setEditForm({
      sourceKind: detail.source_kind,
      label: detail.label,
      description: detail.description,
      connectionTarget: detail.connection_target,
      status: detail.status,
      visibilityScope: detail.visibility_scope,
      lastSyncedAt: detail.last_synced_at ?? "",
      lastError: detail.last_error ?? "",
      connectorAccount: structuredMetadata.connectorAccount,
      connectorCollection: structuredMetadata.connectorCollection,
      indexMode: structuredMetadata.indexMode,
      recallClass: structuredMetadata.recallClass,
      scopeNote: structuredMetadata.scopeNote,
      errorNextStep: structuredMetadata.errorNextStep,
      advancedMetadataJson: structuredMetadata.advancedMetadataJson,
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
        metadata: buildSourceMetadata(createForm),
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
        metadata: buildSourceMetadata(editForm),
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
          description="ForgeFrame is restoring connector-backed source truth before exposing sync state, scope, and recall posture."
          question="Which source inventory should open once the active session is restored?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect linked contacts after scope resolves." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Knowledge sources stay instance-scoped and must surface sync state, visibility, scope, and linkage truth."
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
        description="Connector-backed recall sources with scope, sync posture, visibility, indexed object counts, and downstream links into contacts, conversations, skills, and durable memory."
        question="Are these sources real product objects with scope and sync truth, or just decorative connector labels without durable context boundaries?"
        links={[
          { label: "Knowledge Sources", to: buildInventoryPath(CONTROL_PLANE_ROUTES.knowledgeSources, instanceId), description: "Stay on the knowledge-source inventory and detail surface." },
          { label: "Contacts", to: buildInventoryPath(CONTROL_PLANE_ROUTES.contacts, instanceId), description: "Inspect contact records linked to the selected source." },
          { label: "Memory", to: buildInventoryPath(CONTROL_PLANE_ROUTES.memory, instanceId), description: "Review durable memory linked to the selected source." },
          { label: "Skills", to: buildInventoryPath(CONTROL_PLANE_ROUTES.skills, instanceId), description: "Inspect skills whose provenance points back to the selected source." },
        ]}
        badges={[
          { label: `${sources.length} source${sources.length === 1 ? "" : "s"}`, tone: sources.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Knowledge recall and Durable Memory are different layers: recall can drift on the next sync, while Memory holds governed facts that survive connector changes."
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
              <p className="fg-muted">Each row exposes source type, scope, sync state, visibility, and the latest error without hiding behind connector labels.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading knowledge-source inventory.</p> : null}
          {listState === "success" && sources.length === 0 ? <p className="fg-muted">No knowledge sources matched the selected filters.</p> : null}

          {sources.length > 0 ? (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Knowledge-source inventory">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Source type</th>
                    <th>Scope</th>
                    <th>Sync status</th>
                    <th>Last sync</th>
                    <th>Visibility</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.source_id} className={source.source_id === selectedSourceId ? "is-selected" : undefined}>
                      <td>
                        <button
                          className="fg-table-trigger"
                          type="button"
                          onClick={() => updateRoute((next) => {
                            next.set("sourceId", source.source_id);
                          })}
                        >
                          {source.label}
                        </button>
                        <div className="fg-muted"><span className="fg-code">{source.source_id}</span></div>
                      </td>
                      <td>
                        <div>{source.source_kind}</div>
                        <div className="fg-muted">{source.status}</div>
                      </td>
                      <td>{source.scope_label}</td>
                      <td>
                        <span className="fg-pill" data-tone={syncTone(source.sync.state)}>{source.sync.state}</span>
                        <div className="fg-muted">{source.sync.action_state}</div>
                      </td>
                      <td>{formatTimestamp(source.last_synced_at, "Never synced")}</td>
                      <td>{source.visibility_scope}</td>
                      <td>
                        <div>{source.last_error ?? "No error"}</div>
                        <div className="fg-muted">{source.sync.next_step}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Knowledge-source detail</h3>
              <p className="fg-muted">Connector configuration, indexed objects, sync posture, and downstream recall usage converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.source_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a knowledge source to inspect scope, connector configuration, and linked recall truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading knowledge-source detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Source kind: {detail.source_kind}</li>
                    <li>Source scope: {detail.scope_label}</li>
                    <li>Visibility: {detail.visibility_scope}</li>
                    <li>Status: {detail.status}</li>
                    <li>Last sync: {formatTimestamp(detail.last_synced_at, "Never synced")}</li>
                    <li>Last error: {detail.last_error ?? "None"}</li>
                  </ul>
                  <p>{detail.description || "No description was recorded."}</p>
                </article>

                <article className="fg-subcard">
                  <h4>Sync posture</h4>
                  <ul className="fg-list">
                    <li>Sync state: {detail.sync.state}</li>
                    <li>Action state: {detail.sync.action_state}</li>
                    <li>Action available: {detail.sync.action_available ? "yes" : "no"}</li>
                    <li>Action reason: {detail.sync.action_reason}</li>
                  </ul>
                  <p>{detail.sync.next_step}</p>
                </article>

                <article className="fg-subcard">
                  <h4>Indexed objects</h4>
                  <ul className="fg-list">
                    <li>Contacts: {detail.indexed_objects.contacts}</li>
                    <li>Durable memory: {detail.indexed_objects.durable_memory}</li>
                    <li>Linked conversations: {detail.indexed_objects.linked_conversations}</li>
                    <li>Linked skills: {detail.indexed_objects.linked_skills}</li>
                  </ul>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Connector configuration</h4>
                <p className="fg-muted">{SOURCE_KIND_CONFIG[detail.source_kind].targetHint}</p>
                <ul className="fg-list">
                  {detail.connector_fields.map((field) => (
                    <li key={field.key}>
                      {field.label}: {field.value}
                      {field.note ? ` · ${field.note}` : ""}
                      {field.redacted ? " · redacted" : ""}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Knowledge recall vs durable memory</h4>
                <p>{detail.recall_vs_memory_note}</p>
                <div className="fg-actions">
                  <Link className="fg-nav-link" to={buildInventoryPath(CONTROL_PLANE_ROUTES.memory, instanceId)}>Open durable memory</Link>
                </div>
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
                  <h4>Linked durable memory</h4>
                  {detail.memory_entries.length === 0 ? <p className="fg-muted">No durable memory entries are linked to this source.</p> : (
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

                <article className="fg-subcard">
                  <h4>Linked conversations</h4>
                  {detail.linked_conversations.length === 0 ? <p className="fg-muted">No conversations are linked to this source.</p> : (
                    <ul className="fg-list">
                      {detail.linked_conversations.map((conversation) => (
                        <li key={conversation.record_id}>
                          <Link to={buildConversationPath({ instanceId, conversationId: conversation.record_id })}>{conversation.label}</Link>
                          {conversation.status ? ` · ${conversation.status}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Linked skills</h4>
                  {detail.linked_skills.length === 0 ? <p className="fg-muted">No skills point back to this source.</p> : (
                    <ul className="fg-list">
                      {detail.linked_skills.map((skill) => (
                        <li key={skill.record_id}>
                          <Link to={buildSkillPath(instanceId, skill.record_id)}>{skill.label}</Link>
                          {skill.status ? ` · ${skill.status}` : ""}
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
              <p className="fg-muted">Create a durable source record with type-specific connector fields. Free JSON stays in Advanced only.</p>
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
                Visibility scope
                <select value={createForm.visibilityScope} onChange={(event) => setCreateForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                  {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>
              {createSourceKindConfig.targetLabel}
              <input value={createForm.connectionTarget} onChange={(event) => setCreateForm((current) => ({ ...current, connectionTarget: event.target.value }))} placeholder={createSourceKindConfig.targetPlaceholder} />
            </label>
            <p className="fg-muted">{createSourceKindConfig.targetHint}</p>
            <div className="fg-grid fg-grid-compact">
              <label>
                {createSourceKindConfig.accountLabel}
                <input value={createForm.connectorAccount} onChange={(event) => setCreateForm((current) => ({ ...current, connectorAccount: event.target.value }))} placeholder={createSourceKindConfig.accountPlaceholder} />
              </label>
              <label>
                {createSourceKindConfig.collectionLabel}
                <input value={createForm.connectorCollection} onChange={(event) => setCreateForm((current) => ({ ...current, connectorCollection: event.target.value }))} placeholder={createSourceKindConfig.collectionPlaceholder} />
              </label>
              <label>
                Index mode
                <input value={createForm.indexMode} onChange={(event) => setCreateForm((current) => ({ ...current, indexMode: event.target.value }))} placeholder="full, metadata-only, subject+body" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Recall class
                <input value={createForm.recallClass} onChange={(event) => setCreateForm((current) => ({ ...current, recallClass: event.target.value }))} placeholder="operator recall, customer recall, reference recall" />
              </label>
              <label>
                Scope note
                <input value={createForm.scopeNote} onChange={(event) => setCreateForm((current) => ({ ...current, scopeNote: event.target.value }))} placeholder="Tenant-shared sales knowledge" />
              </label>
              <label>
                Error next step
                <input value={createForm.errorNextStep} onChange={(event) => setCreateForm((current) => ({ ...current, errorNextStep: event.target.value }))} placeholder="Refresh connector credentials and re-run bridge sync" />
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
            <details>
              <summary>Advanced metadata</summary>
              <label>
                Advanced metadata JSON
                <textarea rows={6} value={createForm.advancedMetadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))} />
              </label>
            </details>
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
              <p className="fg-muted">Keep the selected source aligned with connector configuration, sync posture, scope, and durable-memory boundaries.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.source_id : "Select a knowledge source"}</span>
          </div>

          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Source kind
                  <input value={editForm.sourceKind} readOnly />
                </label>
                <label>
                  Label
                  <input value={editForm.label} onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} />
                </label>
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as KnowledgeSourceStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Visibility scope
                  <select value={editForm.visibilityScope} onChange={(event) => setEditForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                    {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <label>
                {sourceKindConfig.targetLabel}
                <input value={editForm.connectionTarget} onChange={(event) => setEditForm((current) => ({ ...current, connectionTarget: event.target.value }))} />
              </label>
              <p className="fg-muted">{sourceKindConfig.targetHint}</p>
              <div className="fg-grid fg-grid-compact">
                <label>
                  {sourceKindConfig.accountLabel}
                  <input value={editForm.connectorAccount} onChange={(event) => setEditForm((current) => ({ ...current, connectorAccount: event.target.value }))} />
                </label>
                <label>
                  {sourceKindConfig.collectionLabel}
                  <input value={editForm.connectorCollection} onChange={(event) => setEditForm((current) => ({ ...current, connectorCollection: event.target.value }))} />
                </label>
                <label>
                  Index mode
                  <input value={editForm.indexMode} onChange={(event) => setEditForm((current) => ({ ...current, indexMode: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Recall class
                  <input value={editForm.recallClass} onChange={(event) => setEditForm((current) => ({ ...current, recallClass: event.target.value }))} />
                </label>
                <label>
                  Scope note
                  <input value={editForm.scopeNote} onChange={(event) => setEditForm((current) => ({ ...current, scopeNote: event.target.value }))} />
                </label>
                <label>
                  Error next step
                  <input value={editForm.errorNextStep} onChange={(event) => setEditForm((current) => ({ ...current, errorNextStep: event.target.value }))} />
                </label>
              </div>
              <label>
                Description
                <textarea rows={3} value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Last synced at
                  <input value={editForm.lastSyncedAt} onChange={(event) => setEditForm((current) => ({ ...current, lastSyncedAt: event.target.value }))} />
                </label>
                <label>
                  Last error
                  <input value={editForm.lastError} onChange={(event) => setEditForm((current) => ({ ...current, lastError: event.target.value }))} />
                </label>
              </div>
              <details>
                <summary>Advanced metadata</summary>
                <label>
                  Advanced metadata JSON
                  <textarea rows={6} value={editForm.advancedMetadataJson} onChange={(event) => setEditForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))} />
                </label>
              </details>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate || !editForm.label.trim() || !editForm.connectionTarget.trim()}>
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
