import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  appendConversationMessage,
  createConversation,
  fetchConversationDetail,
  fetchConversations,
  fetchInstances,
  updateConversation,
  type ConversationDetail,
  type ConversationMessageRole,
  type ConversationSessionKind,
  type ConversationStatus,
  type ConversationSummary,
  type TriageStatus,
  type WorkItemPriority,
} from "../api/admin";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { buildArtifactsPath, buildConversationPath, buildInboxPath, buildWorkspacePath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

const STATUS_OPTIONS: Array<ConversationStatus | "all"> = ["all", "open", "paused", "closed", "archived"];
const TRIAGE_OPTIONS: Array<TriageStatus | "all"> = ["all", "new", "relevant", "delegated", "blocked", "done"];
const PRIORITY_OPTIONS: WorkItemPriority[] = ["low", "normal", "high", "critical"];
const SESSION_KIND_OPTIONS: ConversationSessionKind[] = ["runtime", "operator", "assistant", "external"];
const MESSAGE_ROLE_OPTIONS: ConversationMessageRole[] = ["user", "assistant", "system", "operator", "tool"];

const DEFAULT_CREATE_FORM = {
  conversationId: "",
  workspaceId: "",
  subject: "",
  summary: "",
  triageStatus: "new" as TriageStatus,
  priority: "normal" as WorkItemPriority,
  contactRef: "",
  runId: "",
  artifactId: "",
  approvalId: "",
  decisionId: "",
  metadataJson: "{}",
  initialThreadTitle: "Primary",
  initialSessionKind: "operator" as ConversationSessionKind,
  initialContinuityKey: "",
  initialMessageRole: "user" as ConversationMessageRole,
  initialMessageBody: "",
  createInboxEntry: "yes" as "yes" | "no",
  inboxTitle: "",
  inboxSummary: "",
};

const DEFAULT_EDIT_FORM = {
  subject: "",
  summary: "",
  workspaceId: "",
  status: "open" as ConversationStatus,
  triageStatus: "new" as TriageStatus,
  priority: "normal" as WorkItemPriority,
  contactRef: "",
  runId: "",
  artifactId: "",
  approvalId: "",
  decisionId: "",
  activeThreadId: "",
  metadataJson: "{}",
};

const DEFAULT_APPEND_FORM = {
  threadId: "",
  sessionId: "",
  threadTitle: "",
  startNewSession: "yes" as "yes" | "no",
  sessionKind: "operator" as ConversationSessionKind,
  continuityKey: "",
  messageRole: "operator" as ConversationMessageRole,
  structuredPayloadJson: "{}",
  body: "",
};

function parseJsonObject(rawValue: string, fieldLabel: string): Record<string, unknown> {
  const normalized = rawValue.trim();
  if (!normalized) {
    return {};
  }
  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function buildExecutionRoute(instanceId: string, runId: string): string {
  return `${CONTROL_PLANE_ROUTES.execution}?${new URLSearchParams({ instanceId, runId }).toString()}`;
}

function buildApprovalRoute(instanceId: string, approvalId: string): string {
  return `${CONTROL_PLANE_ROUTES.approvals}?${new URLSearchParams({ instanceId, approvalId, status: "all" }).toString()}`;
}

export function ConversationsPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedConversationId = searchParams.get("conversationId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as ConversationStatus | "all" | "") || "all";
  const triageFilter = (searchParams.get("triageStatus")?.trim() as TriageStatus | "all" | "") || "all";

  const canRead = sessionReady && (
    sessionHasAnyInstancePermission(session, "execution.read")
    || sessionHasAnyInstancePermission(session, "approvals.read")
  );
  const canMutate = sessionReady && session?.read_only !== true && roleAllows(session?.role, "admin");

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [appendForm, setAppendForm] = useState(DEFAULT_APPEND_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingAppend, setSavingAppend] = useState(false);
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
        setError(loadError instanceof Error ? loadError.message : "Conversation instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setConversations([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchConversations(instanceId, {
      status: statusFilter,
      triageStatus: triageFilter,
      limit: 100,
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setConversations(payload.conversations);
        setListState("success");
        setError("");

        const nextConversationId = payload.conversations.some((item) => item.conversation_id === selectedConversationId)
          ? selectedConversationId
          : payload.conversations[0]?.conversation_id ?? "";
        if (nextConversationId !== selectedConversationId) {
          updateRoute((next) => {
            if (nextConversationId) {
              next.set("conversationId", nextConversationId);
            } else {
              next.delete("conversationId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setConversations([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Conversation inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedConversationId, statusFilter, triageFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedConversationId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchConversationDetail(selectedConversationId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.conversation);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Conversation detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedConversationId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setAppendForm(DEFAULT_APPEND_FORM);
      return;
    }

    setEditForm({
      subject: detail.subject,
      summary: detail.summary,
      workspaceId: detail.workspace_id ?? "",
      status: detail.status,
      triageStatus: detail.triage_status,
      priority: detail.priority,
      contactRef: detail.contact_ref ?? "",
      runId: detail.run_id ?? "",
      artifactId: detail.artifact_id ?? "",
      approvalId: detail.approval_id ?? "",
      decisionId: detail.decision_id ?? "",
      activeThreadId: detail.active_thread_id ?? "",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
    setAppendForm((current) => ({
      ...current,
      threadId: detail.active_thread_id ?? detail.threads[0]?.thread_id ?? "",
      sessionId: "",
      threadTitle: detail.threads[0]?.title ?? "",
      body: "",
      structuredPayloadJson: "{}",
      continuityKey: "",
    }));
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
      const payload = await createConversation(instanceId, {
        conversation_id: createForm.conversationId.trim() || null,
        workspace_id: createForm.workspaceId.trim() || null,
        subject: createForm.subject.trim(),
        summary: createForm.summary.trim(),
        triage_status: createForm.triageStatus,
        priority: createForm.priority,
        contact_ref: createForm.contactRef.trim() || null,
        run_id: createForm.runId.trim() || null,
        artifact_id: createForm.artifactId.trim() || null,
        approval_id: createForm.approvalId.trim() || null,
        decision_id: createForm.decisionId.trim() || null,
        metadata: parseJsonObject(createForm.metadataJson, "Conversation metadata"),
        initial_thread_title: createForm.initialThreadTitle.trim() || "Primary",
        initial_session_kind: createForm.initialSessionKind,
        initial_continuity_key: createForm.initialContinuityKey.trim() || null,
        initial_message_role: createForm.initialMessageRole,
        initial_message_body: createForm.initialMessageBody.trim(),
        create_inbox_entry: createForm.createInboxEntry === "yes",
        inbox_title: createForm.inboxTitle.trim() || null,
        inbox_summary: createForm.inboxSummary.trim() || null,
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("conversationId", payload.conversation.conversation_id);
      });
      setMessage(`Conversation ${payload.conversation.conversation_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Conversation creation failed.");
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
      const payload = await updateConversation(instanceId, detail.conversation_id, {
        subject: editForm.subject.trim(),
        summary: editForm.summary.trim(),
        workspace_id: editForm.workspaceId.trim() || null,
        status: editForm.status,
        triage_status: editForm.triageStatus,
        priority: editForm.priority,
        contact_ref: editForm.contactRef.trim() || null,
        run_id: editForm.runId.trim() || null,
        artifact_id: editForm.artifactId.trim() || null,
        approval_id: editForm.approvalId.trim() || null,
        decision_id: editForm.decisionId.trim() || null,
        active_thread_id: editForm.activeThreadId.trim() || null,
        metadata: parseJsonObject(editForm.metadataJson, "Conversation metadata"),
      });
      setMessage(`Conversation ${payload.conversation.conversation_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Conversation update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleAppend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingAppend(true);
    setError("");
    setMessage("");
    try {
      const payload = await appendConversationMessage(instanceId, detail.conversation_id, {
        thread_id: appendForm.threadId.trim() || null,
        session_id: appendForm.sessionId.trim() || null,
        thread_title: appendForm.threadTitle.trim() || null,
        start_new_session: appendForm.startNewSession === "yes",
        session_kind: appendForm.sessionKind,
        continuity_key: appendForm.continuityKey.trim() || null,
        message_role: appendForm.messageRole,
        body: appendForm.body.trim(),
        structured_payload: parseJsonObject(appendForm.structuredPayloadJson, "Structured payload"),
      });
      setAppendForm((current) => ({
        ...current,
        threadId: payload.conversation.active_thread_id ?? current.threadId,
        sessionId: "",
        body: "",
        structuredPayloadJson: "{}",
        continuityKey: "",
      }));
      setMessage(`Conversation ${payload.conversation.conversation_id} extended.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Conversation continuation failed.");
    } finally {
      setSavingAppend(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Conversations"
          description="ForgeFrame is restoring the conversation scope before exposing persisted thread and session history."
          question="Which conversation surface should anchor the next piece of inbound work?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while session scope resolves." },
            { label: "Inbox", to: CONTROL_PLANE_ROUTES.inbox, description: "Open the triage queue after session scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Conversation truth stays instance-scoped and history-backed. ForgeFrame waits for session state before opening the surface."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Conversations"
          description="This route is reserved for operators and admins who can inspect real conversation and continuation state."
          question="Which adjacent surface should stay open when conversation review is outside the current permission envelope?"
          links={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect runtime truth without opening conversation history." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approval state when the conversation surface is unavailable." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard and branch into the correct route." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewers do not get a cosmetic conversation shell. This route stays closed unless the session can inspect real work-interaction truth."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Conversations"
        description="Persistent conversations with thread/session history, continuation context, and links back to runtime, approvals, workspace, and inbox triage."
        question="Is the current conversation carrying real history and triage truth, or is work still dissolving into loose runs, approvals, and notes?"
        links={[
          { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Stay on the conversation inventory and detail surface." },
          { label: "Inbox", to: buildInboxPath({ instanceId }), description: "Open the triage queue linked to conversation work." },
          { label: "Workspaces", to: CONTROL_PLANE_ROUTES.workspaces, description: "Open workspace truth linked from the selected conversation." },
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect runtime truth linked from the selected conversation." },
        ]}
        badges={[
          { label: `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`, tone: conversations.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Conversations are first-class objects. Threads, sessions, messages, triage, and inbox linkage must reconcile here."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the conversation inventory by lifecycle and triage posture.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>
            {instancesState}
          </span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Conversation instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("conversationId");
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
              aria-label="Conversation status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextStatus = event.target.value;
                if (nextStatus === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextStatus);
                }
                next.delete("conversationId");
              })}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Triage
            <select
              aria-label="Conversation triage filter"
              value={triageFilter}
              onChange={(event) => updateRoute((next) => {
                const nextTriage = event.target.value;
                if (nextTriage === "all") {
                  next.delete("triageStatus");
                } else {
                  next.set("triageStatus", nextTriage);
                }
                next.delete("conversationId");
              })}
            >
              {TRIAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Conversation inventory</h3>
              <p className="fg-muted">Each row is a persistent conversation object with inbox count and message continuity, not an orphaned note.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>
              {listState}
            </span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading conversation inventory.</p> : null}
          {listState === "success" && conversations.length === 0 ? <p className="fg-muted">No conversations matched the selected filters.</p> : null}

          {conversations.length > 0 ? (
            <div className="fg-stack">
              {conversations.map((conversation) => (
                <button
                  key={conversation.conversation_id}
                  type="button"
                  className={`fg-data-row${conversation.conversation_id === selectedConversationId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("conversationId", conversation.conversation_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{conversation.conversation_id}</span>
                      <strong>{conversation.subject}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={conversation.triage_status === "done" ? "success" : conversation.triage_status === "blocked" ? "danger" : "warning"}>
                        {conversation.triage_status}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{conversation.status} · {conversation.priority} priority · inbox {conversation.inbox_count}</span>
                    <span className="fg-muted">threads {conversation.thread_count} · sessions {conversation.session_count} · messages {conversation.message_count}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Conversation detail</h3>
              <p className="fg-muted">Thread history, session continuity, triage posture, and runtime links converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.conversation_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a conversation to inspect history, context, triage, and inbox linkage.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading conversation detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Conversation ID: <span className="fg-code">{detail.conversation_id}</span></li>
                    <li>Instance scope: <span className="fg-code">{detail.instance_id}</span></li>
                    <li>Execution scope: <span className="fg-code">{detail.company_id}</span></li>
                    <li>Status: {detail.status}</li>
                    <li>Triage: {detail.triage_status}</li>
                    <li>Priority: {detail.priority}</li>
                    <li>Latest message: {detail.latest_message_at ?? "Not recorded"}</li>
                  </ul>
                </article>
                <article className="fg-subcard">
                  <h4>Links</h4>
                  <ul className="fg-list">
                    <li>Workspace: {detail.workspace_id ?? "Not linked"}</li>
                    <li>Run: {detail.run_id ?? "Not linked"}</li>
                    <li>Approval: {detail.approval_id ?? "Not linked"}</li>
                    <li>Artifact: {detail.artifact_id ?? "Not linked"}</li>
                    <li>Decision: {detail.decision_id ?? "Not linked"}</li>
                    <li>Contact: {detail.contact_ref ?? "Not recorded"}</li>
                  </ul>
                  <div className="fg-actions">
                    {detail.workspace_id ? <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}>Open workspace</Link> : null}
                    {detail.artifact_id ? <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, artifactId: detail.artifact_id })}>Open artifact</Link> : null}
                    {detail.run_id ? <Link className="fg-nav-link" to={buildExecutionRoute(instanceId, detail.run_id)}>Open execution review</Link> : null}
                    {detail.approval_id ? <Link className="fg-nav-link" to={buildApprovalRoute(instanceId, detail.approval_id)}>Open approval review</Link> : null}
                    {detail.inbox_items[0] ? <Link className="fg-nav-link" to={buildInboxPath({ instanceId, inboxId: detail.inbox_items[0].inbox_id })}>Open inbox item</Link> : null}
                  </div>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Summary text</h4>
                <p>{detail.summary || "No conversation summary was recorded."}</p>
              </article>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Threads</h4>
                  {detail.threads.length === 0 ? <p className="fg-muted">No threads were recorded.</p> : (
                    <ul className="fg-list">
                      {detail.threads.map((thread) => (
                        <li key={thread.thread_id}>
                          <span className="fg-code">{thread.thread_id}</span> · {thread.title} · {thread.status} · messages {thread.message_count}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
                <article className="fg-subcard">
                  <h4>Sessions</h4>
                  {detail.sessions.length === 0 ? <p className="fg-muted">No sessions were recorded.</p> : (
                    <ul className="fg-list">
                      {detail.sessions.map((sessionItem) => (
                        <li key={sessionItem.session_id}>
                          <span className="fg-code">{sessionItem.session_id}</span> · {sessionItem.session_kind} · {sessionItem.continuity_key ?? "no continuity key"}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
                <article className="fg-subcard">
                  <h4>Inbox linkage</h4>
                  {detail.inbox_items.length === 0 ? <p className="fg-muted">No inbox items are linked to this conversation.</p> : (
                    <ul className="fg-list">
                      {detail.inbox_items.map((item) => (
                        <li key={item.inbox_id}>
                          <Link to={buildInboxPath({ instanceId, inboxId: item.inbox_id })}>{item.title}</Link>
                          {" · "}{item.triage_status}{" · "}{item.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Messages</h4>
                {detail.messages.length === 0 ? <p className="fg-muted">No messages were recorded.</p> : (
                  <ul className="fg-list">
                    {detail.messages.map((messageItem) => (
                      <li key={messageItem.message_id}>
                        <strong>{messageItem.message_role}</strong> · {messageItem.created_at} · {messageItem.body}
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
              <h3>Create conversation</h3>
              <p className="fg-muted">Create a durable conversation with initial thread, initial session, initial message, and optional inbox entry.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Conversation ID
                <input value={createForm.conversationId} onChange={(event) => setCreateForm((current) => ({ ...current, conversationId: event.target.value }))} placeholder="conversation_customer_pricing" />
              </label>
              <label>
                Workspace ID
                <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} placeholder="ws_customer_pricing" />
              </label>
            </div>
            <label>
              Subject
              <input value={createForm.subject} onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Customer pricing conversation" />
            </label>
            <label>
              Summary
              <textarea rows={3} value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Triage
                <select value={createForm.triageStatus} onChange={(event) => setCreateForm((current) => ({ ...current, triageStatus: event.target.value as TriageStatus }))}>
                  {TRIAGE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Priority
                <select value={createForm.priority} onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value as WorkItemPriority }))}>
                  {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Create inbox entry
                <select value={createForm.createInboxEntry} onChange={(event) => setCreateForm((current) => ({ ...current, createInboxEntry: event.target.value as "yes" | "no" }))}>
                  <option value="yes">yes</option>
                  <option value="no">no</option>
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Contact ref
                <input value={createForm.contactRef} onChange={(event) => setCreateForm((current) => ({ ...current, contactRef: event.target.value }))} placeholder="contact://customer/acme" />
              </label>
              <label>
                Run ID
                <input value={createForm.runId} onChange={(event) => setCreateForm((current) => ({ ...current, runId: event.target.value }))} placeholder="run_alpha" />
              </label>
              <label>
                Artifact ID
                <input value={createForm.artifactId} onChange={(event) => setCreateForm((current) => ({ ...current, artifactId: event.target.value }))} placeholder="artifact_alpha" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Approval ID
                <input value={createForm.approvalId} onChange={(event) => setCreateForm((current) => ({ ...current, approvalId: event.target.value }))} placeholder="run:instance_alpha:company_alpha:approval-1" />
              </label>
              <label>
                Decision ID
                <input value={createForm.decisionId} onChange={(event) => setCreateForm((current) => ({ ...current, decisionId: event.target.value }))} placeholder="decision_preview_alpha" />
              </label>
              <label>
                Initial thread title
                <input value={createForm.initialThreadTitle} onChange={(event) => setCreateForm((current) => ({ ...current, initialThreadTitle: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Initial session
                <select value={createForm.initialSessionKind} onChange={(event) => setCreateForm((current) => ({ ...current, initialSessionKind: event.target.value as ConversationSessionKind }))}>
                  {SESSION_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Initial message role
                <select value={createForm.initialMessageRole} onChange={(event) => setCreateForm((current) => ({ ...current, initialMessageRole: event.target.value as ConversationMessageRole }))}>
                  {MESSAGE_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Continuity key
                <input value={createForm.initialContinuityKey} onChange={(event) => setCreateForm((current) => ({ ...current, initialContinuityKey: event.target.value }))} placeholder="assistant-review-1" />
              </label>
            </div>
            <label>
              Initial message
              <textarea rows={4} value={createForm.initialMessageBody} onChange={(event) => setCreateForm((current) => ({ ...current, initialMessageBody: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Inbox title
                <input value={createForm.inboxTitle} onChange={(event) => setCreateForm((current) => ({ ...current, inboxTitle: event.target.value }))} placeholder="Triage pricing request" />
              </label>
              <label>
                Inbox summary
                <input value={createForm.inboxSummary} onChange={(event) => setCreateForm((current) => ({ ...current, inboxSummary: event.target.value }))} placeholder="Customer is waiting for pricing confirmation." />
              </label>
            </div>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.subject.trim() || !createForm.initialMessageBody.trim()}>
                {savingCreate ? "Creating conversation" : "Create conversation"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit and continue</h3>
              <p className="fg-muted">Keep triage, links, and active thread truth coherent, then append the next message against the right context.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>
              {detail ? detail.conversation_id : "Select a conversation"}
            </span>
          </div>

          {detail ? (
            <div className="fg-stack">
              <form className="fg-stack" onSubmit={handleUpdate}>
                <label>
                  Subject
                  <input value={editForm.subject} onChange={(event) => setEditForm((current) => ({ ...current, subject: event.target.value }))} />
                </label>
                <label>
                  Summary
                  <textarea rows={3} value={editForm.summary} onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} />
                </label>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Workspace ID
                    <input value={editForm.workspaceId} onChange={(event) => setEditForm((current) => ({ ...current, workspaceId: event.target.value }))} />
                  </label>
                  <label>
                    Status
                    <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as ConversationStatus }))}>
                      {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Active thread
                    <select value={editForm.activeThreadId} onChange={(event) => setEditForm((current) => ({ ...current, activeThreadId: event.target.value }))}>
                      <option value="">none</option>
                      {detail.threads.map((thread) => <option key={thread.thread_id} value={thread.thread_id}>{thread.title} ({thread.thread_id})</option>)}
                    </select>
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Triage
                    <select value={editForm.triageStatus} onChange={(event) => setEditForm((current) => ({ ...current, triageStatus: event.target.value as TriageStatus }))}>
                      {TRIAGE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Priority
                    <select value={editForm.priority} onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value as WorkItemPriority }))}>
                      {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Contact ref
                    <input value={editForm.contactRef} onChange={(event) => setEditForm((current) => ({ ...current, contactRef: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Run ID
                    <input value={editForm.runId} onChange={(event) => setEditForm((current) => ({ ...current, runId: event.target.value }))} />
                  </label>
                  <label>
                    Artifact ID
                    <input value={editForm.artifactId} onChange={(event) => setEditForm((current) => ({ ...current, artifactId: event.target.value }))} />
                  </label>
                  <label>
                    Approval ID
                    <input value={editForm.approvalId} onChange={(event) => setEditForm((current) => ({ ...current, approvalId: event.target.value }))} />
                  </label>
                </div>
                <label>
                  Decision ID
                  <input value={editForm.decisionId} onChange={(event) => setEditForm((current) => ({ ...current, decisionId: event.target.value }))} />
                </label>
                <label>
                  Metadata JSON
                  <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingUpdate}>
                    {savingUpdate ? "Saving conversation" : "Save conversation"}
                  </button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleAppend}>
                <h4>Append message</h4>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Thread
                    <select value={appendForm.threadId} onChange={(event) => setAppendForm((current) => ({ ...current, threadId: event.target.value }))}>
                      <option value="">active thread</option>
                      {detail.threads.map((thread) => <option key={thread.thread_id} value={thread.thread_id}>{thread.title} ({thread.thread_id})</option>)}
                    </select>
                  </label>
                  <label>
                    Session
                    <select value={appendForm.sessionId} onChange={(event) => setAppendForm((current) => ({ ...current, sessionId: event.target.value }))}>
                      <option value="">latest or new</option>
                      {detail.sessions.map((sessionItem) => <option key={sessionItem.session_id} value={sessionItem.session_id}>{sessionItem.session_kind} ({sessionItem.session_id})</option>)}
                    </select>
                  </label>
                  <label>
                    Start new session
                    <select value={appendForm.startNewSession} onChange={(event) => setAppendForm((current) => ({ ...current, startNewSession: event.target.value as "yes" | "no" }))}>
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Session kind
                    <select value={appendForm.sessionKind} onChange={(event) => setAppendForm((current) => ({ ...current, sessionKind: event.target.value as ConversationSessionKind }))}>
                      {SESSION_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Message role
                    <select value={appendForm.messageRole} onChange={(event) => setAppendForm((current) => ({ ...current, messageRole: event.target.value as ConversationMessageRole }))}>
                      {MESSAGE_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Continuity key
                    <input value={appendForm.continuityKey} onChange={(event) => setAppendForm((current) => ({ ...current, continuityKey: event.target.value }))} placeholder="assistant-review-2" />
                  </label>
                </div>
                <label>
                  Thread title
                  <input value={appendForm.threadTitle} onChange={(event) => setAppendForm((current) => ({ ...current, threadTitle: event.target.value }))} placeholder="Follow-up" />
                </label>
                <label>
                  Structured payload JSON
                  <textarea rows={4} value={appendForm.structuredPayloadJson} onChange={(event) => setAppendForm((current) => ({ ...current, structuredPayloadJson: event.target.value }))} />
                </label>
                <label>
                  Message body
                  <textarea rows={4} value={appendForm.body} onChange={(event) => setAppendForm((current) => ({ ...current, body: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingAppend || !appendForm.body.trim()}>
                    {savingAppend ? "Appending message" : "Append message"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="fg-muted">Select a conversation before attempting a mutation or continuation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
