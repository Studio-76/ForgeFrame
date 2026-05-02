import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { createConversation, fetchConversations, type ConversationSummary } from "../api/domain/conversations";
import {
  createInboxItem,
  fetchInboxItemDetail,
  fetchInboxItems,
  updateInboxItem,
  type InboxDetail,
  type InboxStatus,
  type InboxSummary,
  type TriageStatus,
  type WorkItemPriority,
} from "../api/domain/inbox";
import { createTask, fetchTasks, type TaskSummary } from "../api/domain/tasks";
import { fetchAgents, type AgentSummary } from "../api/domain/agents";
import { fetchInstances } from "../api/domain/instances";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { buildArtifactsPath, buildConversationPath, buildInboxPath, buildTaskPath, buildWorkspacePath } from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

const TRIAGE_OPTIONS: Array<TriageStatus | "all"> = ["all", "new", "relevant", "delegated", "blocked", "done"];
const STATUS_OPTIONS: Array<InboxStatus | "all"> = ["all", "open", "snoozed", "closed", "archived"];
const PRIORITY_OPTIONS: Array<WorkItemPriority | "all"> = ["all", "low", "normal", "high", "critical"];
const SOURCE_OPTIONS = ["all", "manual", "conversation", "workspace", "run", "approval", "artifact"] as const;

type InboxSourceFilter = typeof SOURCE_OPTIONS[number];

const DEFAULT_CREATE_FORM = {
  inboxId: "",
  conversationId: "",
  threadId: "",
  workspaceId: "",
  title: "",
  summary: "",
  triageStatus: "new" as TriageStatus,
  priority: "normal" as WorkItemPriority,
  status: "open" as InboxStatus,
  contactRef: "",
  runId: "",
  artifactId: "",
  approvalId: "",
  decisionId: "",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  conversationId: "",
  threadId: "",
  workspaceId: "",
  title: "",
  summary: "",
  triageStatus: "new" as TriageStatus,
  priority: "normal" as WorkItemPriority,
  status: "open" as InboxStatus,
  contactRef: "",
  runId: "",
  artifactId: "",
  approvalId: "",
  decisionId: "",
  metadataJson: "{}",
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

function inboxSourceLabel(item: InboxSummary): Exclude<InboxSourceFilter, "all"> {
  if (item.conversation_id) {
    return "conversation";
  }
  if (item.workspace_id) {
    return "workspace";
  }
  if (item.run_id) {
    return "run";
  }
  if (item.approval_id) {
    return "approval";
  }
  if (item.artifact_id) {
    return "artifact";
  }
  return "manual";
}

function inboxQueuePosture(item: Pick<InboxSummary, "triage_status" | "status">): { label: string; tone: "success" | "danger" | "warning" | "neutral" } {
  if (item.status === "archived") {
    return { label: "archived", tone: "neutral" };
  }
  if (item.triage_status === "done" || item.status === "closed") {
    return { label: "done", tone: "success" };
  }
  if (item.triage_status === "blocked") {
    return { label: "blocked", tone: "danger" };
  }
  if (item.status === "snoozed") {
    return { label: "waiting", tone: "warning" };
  }
  if (item.triage_status === "delegated") {
    return { label: "delegated", tone: "warning" };
  }
  if (item.triage_status === "relevant") {
    return { label: "relevant", tone: "success" };
  }
  return { label: "new", tone: "neutral" };
}

export function InboxPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedInboxId = searchParams.get("inboxId")?.trim() ?? "";
  const triageFilter = (searchParams.get("triageStatus")?.trim() as TriageStatus | "all" | "") || "all";
  const statusFilter = (searchParams.get("status")?.trim() as InboxStatus | "all" | "") || "all";
  const priorityFilter = (searchParams.get("priority")?.trim() as WorkItemPriority | "all" | "") || "all";

  const canRead = sessionReady && (
    sessionHasAnyInstancePermission(session, "execution.read")
    || sessionHasAnyInstancePermission(session, "approvals.read")
  );
  const canMutate = sessionReady && session?.read_only !== true && roleAllows(session?.role, "admin");

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [agentsState, setAgentsState] = useState<LoadState>("idle");
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [tasksState, setTasksState] = useState<LoadState>("idle");
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [conversationsState, setConversationsState] = useState<LoadState>("idle");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [items, setItems] = useState<InboxSummary[]>([]);
  const [detail, setDetail] = useState<InboxDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<InboxSourceFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [quickActionState, setQuickActionState] = useState<Record<string, boolean>>({});

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
        setError(loadError instanceof Error ? loadError.message : "Inbox instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setAgents([]);
      setAgentsState("idle");
      setTasks([]);
      setTasksState("idle");
      setConversations([]);
      setConversationsState("idle");
      return;
    }

    let cancelled = false;
    setAgentsState("loading");
    setTasksState("loading");
    setConversationsState("loading");

    void fetchAgents(instanceId, { status: "all", limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setAgents(payload.agents);
        setAgentsState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setAgents([]);
        setAgentsState("error");
        setError(loadError instanceof Error ? loadError.message : "Inbox agent registry could not be loaded.");
      });

    void fetchTasks(instanceId, { status: "all", limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setTasks(payload.tasks);
        setTasksState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setTasks([]);
        setTasksState("error");
        setError(loadError instanceof Error ? loadError.message : "Inbox task links could not be loaded.");
      });

    void fetchConversations(instanceId, { status: "all", triageStatus: "all", agentId: null, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setConversations(payload.conversations);
        setConversationsState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setConversations([]);
        setConversationsState("error");
        setError(loadError instanceof Error ? loadError.message : "Inbox conversation links could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setItems([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchInboxItems(instanceId, {
      triageStatus: triageFilter,
      status: statusFilter,
      priority: priorityFilter,
      limit: 100,
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setItems(payload.items);
        setListState("success");
        setError("");

        const nextInboxId = payload.items.some((item) => item.inbox_id === selectedInboxId)
          ? selectedInboxId
          : payload.items[0]?.inbox_id ?? "";
        if (nextInboxId !== selectedInboxId) {
          updateRoute((next) => {
            if (nextInboxId) {
              next.set("inboxId", nextInboxId);
            } else {
              next.delete("inboxId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setItems([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Inbox inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, priorityFilter, refreshNonce, selectedInboxId, statusFilter, triageFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedInboxId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchInboxItemDetail(selectedInboxId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.item);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Inbox detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedInboxId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    setEditForm({
      conversationId: detail.conversation_id ?? "",
      threadId: detail.thread_id ?? "",
      workspaceId: detail.workspace_id ?? "",
      title: detail.title,
      summary: detail.summary,
      triageStatus: detail.triage_status,
      priority: detail.priority,
      status: detail.status,
      contactRef: detail.contact_ref ?? "",
      runId: detail.run_id ?? "",
      artifactId: detail.artifact_id ?? "",
      approvalId: detail.approval_id ?? "",
      decisionId: detail.decision_id ?? "",
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
      const payload = await createInboxItem(instanceId, {
        inbox_id: createForm.inboxId.trim() || null,
        conversation_id: createForm.conversationId.trim() || null,
        thread_id: createForm.threadId.trim() || null,
        workspace_id: createForm.workspaceId.trim() || null,
        title: createForm.title.trim(),
        summary: createForm.summary.trim(),
        triage_status: createForm.triageStatus,
        priority: createForm.priority,
        status: createForm.status,
        contact_ref: createForm.contactRef.trim() || null,
        run_id: createForm.runId.trim() || null,
        artifact_id: createForm.artifactId.trim() || null,
        approval_id: createForm.approvalId.trim() || null,
        decision_id: createForm.decisionId.trim() || null,
        metadata: parseJsonObject(createForm.metadataJson, "Inbox metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("inboxId", payload.item.inbox_id);
      });
      setMessage(`Inbox item ${payload.item.inbox_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Inbox item creation failed.");
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
      const payload = await updateInboxItem(instanceId, detail.inbox_id, {
        conversation_id: editForm.conversationId.trim() || null,
        thread_id: editForm.threadId.trim() || null,
        workspace_id: editForm.workspaceId.trim() || null,
        title: editForm.title.trim(),
        summary: editForm.summary.trim(),
        triage_status: editForm.triageStatus,
        priority: editForm.priority,
        status: editForm.status,
        contact_ref: editForm.contactRef.trim() || null,
        run_id: editForm.runId.trim() || null,
        artifact_id: editForm.artifactId.trim() || null,
        approval_id: editForm.approvalId.trim() || null,
        decision_id: editForm.decisionId.trim() || null,
        metadata: parseJsonObject(editForm.metadataJson, "Inbox metadata"),
      });
      setMessage(`Inbox item ${payload.item.inbox_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Inbox item update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const relatedTasks = useMemo(
    () => detail
      ? tasks.filter((task) => task.inbox_id === detail.inbox_id || (detail.conversation_id && task.conversation_id === detail.conversation_id))
      : [],
    [detail, tasks],
  );
  const conversationById = useMemo(
    () => new Map(conversations.map((conversation) => [conversation.conversation_id, conversation])),
    [conversations],
  );
  const agentNameById = useMemo(
    () => new Map(agents.map((agent) => [agent.agent_id, agent.display_name])),
    [agents],
  );
  const visibleItems = useMemo(() => items.filter((item) => {
    if (sourceFilter !== "all" && inboxSourceLabel(item) !== sourceFilter) {
      return false;
    }
    if (!ownerFilter) {
      return true;
    }
    const relatedTask = tasks.find((task) => task.inbox_id === item.inbox_id);
    if (relatedTask?.owner_id === ownerFilter) {
      return true;
    }
    const linkedConversation = item.conversation_id ? conversationById.get(item.conversation_id) : null;
    return Boolean(linkedConversation?.participant_agent_ids.includes(ownerFilter));
  }), [conversationById, items, ownerFilter, sourceFilter, tasks]);
  const availableOwnerAgents = useMemo(() => {
    const ownerIds = new Set<string>();
    tasks.forEach((task) => {
      if (task.owner_id) {
        ownerIds.add(task.owner_id);
      }
    });
    conversations.forEach((conversation) => {
      conversation.participant_agent_ids.forEach((agentId) => ownerIds.add(agentId));
    });
    return agents.filter((agent) => ownerIds.has(agent.agent_id));
  }, [agents, conversations, tasks]);

  const runQuickAction = async (
    actionKey: string,
    payload: Partial<Pick<InboxDetail, "triage_status" | "status">>,
  ) => {
    if (!detail || !instanceId || !canMutate) {
      return;
    }

    setQuickActionState((current) => ({ ...current, [actionKey]: true }));
    setError("");
    setMessage("");
    try {
      const response = await updateInboxItem(instanceId, detail.inbox_id, {
        triage_status: payload.triage_status ?? detail.triage_status,
        status: payload.status ?? detail.status,
      });
      setMessage(`Inbox item ${response.item.inbox_id} updated via ${actionKey}.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Inbox quick action '${actionKey}' failed.`);
    } finally {
      setQuickActionState((current) => ({ ...current, [actionKey]: false }));
    }
  };

  const handleCreateConversationFromInbox = async () => {
    if (!detail || !instanceId || !canMutate) {
      return;
    }

    setQuickActionState((current) => ({ ...current, create_conversation: true }));
    setError("");
    setMessage("");
    try {
      const conversation = await createConversation(instanceId, {
        workspace_id: detail.workspace_id ?? null,
        subject: detail.title,
        summary: detail.summary,
        triage_status: detail.triage_status,
        priority: detail.priority,
        contact_ref: detail.contact_ref ?? null,
        run_id: detail.run_id ?? null,
        artifact_id: detail.artifact_id ?? null,
        approval_id: detail.approval_id ?? null,
        decision_id: detail.decision_id ?? null,
        initial_thread_title: detail.thread_id ?? "Inbox intake",
        initial_session_kind: "operator",
        initial_message_role: "operator",
        initial_message_body: detail.summary || detail.title,
        create_inbox_entry: false,
      });
      await updateInboxItem(instanceId, detail.inbox_id, {
        conversation_id: conversation.conversation.conversation_id,
        thread_id: conversation.conversation.active_thread_id ?? null,
      });
      setMessage(`Conversation ${conversation.conversation.conversation_id} created from inbox item ${detail.inbox_id}.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Inbox-to-conversation handoff failed.");
    } finally {
      setQuickActionState((current) => ({ ...current, create_conversation: false }));
    }
  };

  const handleCreateTaskFromInbox = async () => {
    if (!detail || !instanceId || !canMutate) {
      return;
    }

    setQuickActionState((current) => ({ ...current, create_task: true }));
    setError("");
    setMessage("");
    try {
      const task = await createTask(instanceId, {
        title: detail.title,
        summary: detail.summary,
        priority: detail.priority,
        status: "open",
        conversation_id: detail.conversation_id ?? null,
        inbox_id: detail.inbox_id,
        workspace_id: detail.workspace_id ?? null,
      });
      setMessage(`Task ${task.task.task_id} created from inbox item ${detail.inbox_id}.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Inbox-to-task handoff failed.");
    } finally {
      setQuickActionState((current) => ({ ...current, create_task: false }));
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Inbox"
          description="ForgeFrame is restoring inbox scope before exposing the triage queue."
          question="Which triage queue should open first once the current session is restored?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while session state resolves." },
            { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Open persisted conversation history after session scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Inbox truth stays instance-scoped and triage-backed. ForgeFrame waits for session scope before opening the queue."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Inbox"
          description="This route is reserved for operators and admins who can inspect real triage posture."
          question="Which adjacent surface should stay open when triage review is outside the current permission envelope?"
          links={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect runtime truth without opening the triage queue." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approval state without opening the inbox." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard and branch into the correct route." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewers do not get a cosmetic inbox shell. This route stays closed unless the session can inspect real triage truth."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Inbox"
        description="Persistent triage queue with status, priority, conversation linkage, and links back to runtime, approvals, workspace, and artifacts."
        question="Is the queue grounded in real conversation and runtime context, or is triage still detached from product truth?"
        links={[
          { label: "Inbox", to: CONTROL_PLANE_ROUTES.inbox, description: "Stay on the triage queue and detail surface." },
          { label: "Conversations", to: buildConversationPath({ instanceId }), description: "Open the linked conversation inventory." },
          { label: "Workspaces", to: CONTROL_PLANE_ROUTES.workspaces, description: "Open workspace truth linked from triage items." },
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect runtime truth linked from triage items." },
        ]}
        badges={[
          { label: `${items.length} inbox item${items.length === 1 ? "" : "s"}`, tone: items.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Inbox items are first-class work records. Triage, priority, conversation linkage, and runtime references must reconcile here."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then narrow the triage queue by status, priority, source, and responsible agent/owner.</p>
          </div>
          <span
            className="fg-pill"
            data-tone={
              instancesState === "error" || agentsState === "error" || tasksState === "error" || conversationsState === "error"
                ? "danger"
                : instancesState === "success" && agentsState !== "loading" && tasksState !== "loading" && conversationsState !== "loading"
                  ? "success"
                  : "neutral"
            }
          >
            instances {instancesState} · agents {agentsState} · tasks {tasksState} · conversations {conversationsState}
          </span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Inbox instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("inboxId");
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
            Triage
            <select
              aria-label="Inbox triage filter"
              value={triageFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("triageStatus");
                } else {
                  next.set("triageStatus", nextValue);
                }
                next.delete("inboxId");
              })}
            >
              {TRIAGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Inbox status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("inboxId");
              })}
            >
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Inbox priority filter"
              value={priorityFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("priority");
                } else {
                  next.set("priority", nextValue);
                }
                next.delete("inboxId");
              })}
            >
              {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Source
            <select
              aria-label="Inbox source filter"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as InboxSourceFilter)}
            >
              {SOURCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Agent / owner
            <select
              aria-label="Inbox owner filter"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
            >
              <option value="">all agents</option>
              {availableOwnerAgents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {agent.display_name}
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
              <h3>Inbox inventory</h3>
              <p className="fg-muted">Each row is a triageable work item with explicit source, priority, and next-path linkage into conversation, task, runtime, or approval follow-up.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>
              {listState}
            </span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading inbox inventory.</p> : null}
          {listState === "success" && visibleItems.length === 0 ? <p className="fg-muted">No inbox items matched the selected filters and lenses.</p> : null}

          {visibleItems.length > 0 ? (
            <div className="fg-stack">
              {visibleItems.map((item) => {
                const linkedTask = tasks.find((task) => task.inbox_id === item.inbox_id);
                const linkedConversation = item.conversation_id ? conversationById.get(item.conversation_id) : null;
                const posture = inboxQueuePosture(item);
                const ownerLabel = linkedTask?.owner_id
                  ? (agentNameById.get(linkedTask.owner_id) ?? linkedTask.owner_id)
                  : linkedConversation?.participant_agent_ids[0]
                    ? (agentNameById.get(linkedConversation.participant_agent_ids[0]) ?? linkedConversation.participant_agent_ids[0])
                    : "unassigned";
                return (
                <button
                  key={item.inbox_id}
                  type="button"
                  className={`fg-data-row${item.inbox_id === selectedInboxId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("inboxId", item.inbox_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{item.inbox_id}</span>
                      <strong>{item.title}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={posture.tone}>
                        {posture.label}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{item.status} · {item.priority} priority · source {inboxSourceLabel(item)}</span>
                    <span className="fg-muted">triage {item.triage_status} · owner {ownerLabel}</span>
                    <span className="fg-muted">conversation {item.conversation_id ?? "none"} · task {linkedTask?.task_id ?? "none"}</span>
                  </div>
                </button>
                );
              })}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Inbox detail</h3>
              <p className="fg-muted">Triage posture, waiting/blocking state, linked conversation/task/runtime references, and the next action path converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.inbox_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select an inbox item to inspect triage state and linked conversation truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading inbox detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-actions">
                <span className="fg-pill" data-tone={inboxQueuePosture(detail).tone}>Queue posture {inboxQueuePosture(detail).label}</span>
                <span className="fg-pill">{detail.priority} priority</span>
                <span className="fg-pill">source {inboxSourceLabel(detail)}</span>
              </div>
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Inbox ID: <span className="fg-code">{detail.inbox_id}</span></li>
                    <li>Instance scope: <span className="fg-code">{detail.instance_id}</span></li>
                    <li>Execution scope: <span className="fg-code">{detail.company_id}</span></li>
                    <li>Triage: {detail.triage_status}</li>
                    <li>Status: {detail.status}</li>
                    <li>Queue posture: {inboxQueuePosture(detail).label}</li>
                    <li>Priority: {detail.priority}</li>
                    <li>Source: {inboxSourceLabel(detail)}</li>
                    <li>Latest message: {detail.latest_message_at ?? "Not recorded"}</li>
                  </ul>
                </article>
                <article className="fg-subcard">
                  <h4>Next path</h4>
                  <ul className="fg-list">
                    <li>Conversation: {detail.conversation_id ?? "Not linked"}</li>
                    <li>Thread: {detail.thread_id ?? "Not linked"}</li>
                    <li>Workspace: {detail.workspace_id ?? "Not linked"}</li>
                    <li>Run: {detail.run_id ?? "Not linked"}</li>
                    <li>Approval: {detail.approval_id ?? "Not linked"}</li>
                    <li>Artifact: {detail.artifact_id ?? "Not linked"}</li>
                    <li>Decision: {detail.decision_id ?? "Not linked"}</li>
                    <li>Contact: {detail.contact_ref ?? "Not recorded"}</li>
                    <li>Tasks: {relatedTasks.length > 0 ? `${relatedTasks.length} linked` : "No linked task"}</li>
                  </ul>
                  <div className="fg-actions">
                    {detail.conversation_id ? <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.conversation_id })}>Open conversation</Link> : null}
                    {!detail.conversation_id ? (
                      <button type="button" disabled={!canMutate || quickActionState.create_conversation} onClick={() => void handleCreateConversationFromInbox()}>
                        {quickActionState.create_conversation ? "Creating conversation" : "Create conversation from item"}
                      </button>
                    ) : null}
                    {relatedTasks[0] ? <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: relatedTasks[0].task_id })}>Open task</Link> : null}
                    {!relatedTasks[0] ? (
                      <button type="button" disabled={!canMutate || quickActionState.create_task} onClick={() => void handleCreateTaskFromInbox()}>
                        {quickActionState.create_task ? "Creating task" : "Create follow-up task"}
                      </button>
                    ) : null}
                    {detail.workspace_id ? <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}>Open workspace</Link> : null}
                    {detail.artifact_id ? <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, artifactId: detail.artifact_id })}>Open artifact</Link> : null}
                    {detail.run_id ? <Link className="fg-nav-link" to={buildExecutionRoute(instanceId, detail.run_id)}>Open execution review</Link> : null}
                    {detail.approval_id ? <Link className="fg-nav-link" to={buildApprovalRoute(instanceId, detail.approval_id)}>Open approval review</Link> : null}
                  </div>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Triage actions</h4>
                <p className="fg-muted">Drive the queue directly from here instead of opening the generic edit form for every state transition.</p>
                <div className="fg-actions">
                  <button type="button" disabled={!canMutate || quickActionState.relevant} onClick={() => void runQuickAction("relevant", { triage_status: "relevant", status: "open" })}>
                    {quickActionState.relevant ? "Setting relevant" : "Mark relevant"}
                  </button>
                  <button type="button" disabled={!canMutate || quickActionState.delegated} onClick={() => void runQuickAction("delegated", { triage_status: "delegated", status: "open" })}>
                    {quickActionState.delegated ? "Delegating" : "Delegate"}
                  </button>
                  <button type="button" disabled={!canMutate || quickActionState.blocked} onClick={() => void runQuickAction("blocked", { triage_status: "blocked", status: "open" })}>
                    {quickActionState.blocked ? "Blocking" : "Block"}
                  </button>
                  <button type="button" disabled={!canMutate || quickActionState.waiting} onClick={() => void runQuickAction("waiting", { status: "snoozed" })}>
                    {quickActionState.waiting ? "Waiting" : "Wait"}
                  </button>
                  <button type="button" disabled={!canMutate || quickActionState.done} onClick={() => void runQuickAction("done", { triage_status: "done", status: "closed" })}>
                    {quickActionState.done ? "Completing" : "Done"}
                  </button>
                  <button type="button" disabled={!canMutate || quickActionState.archive} onClick={() => void runQuickAction("archive", { status: "archived" })}>
                    {quickActionState.archive ? "Archiving" : "Archive"}
                  </button>
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Summary text</h4>
                <p>{detail.summary || "No inbox summary was recorded."}</p>
              </article>

              <article className="fg-subcard">
                <h4>Conversation summary</h4>
                {detail.conversation ? (
                  <ul className="fg-list">
                    <li>
                      <Link to={buildConversationPath({ instanceId, conversationId: detail.conversation.conversation_id })}>
                        {detail.conversation.subject}
                      </Link>
                    </li>
                    <li>Status: {detail.conversation.status}</li>
                    <li>Triage: {detail.conversation.triage_status}</li>
                    <li>Threads: {detail.conversation.thread_count} · sessions {detail.conversation.session_count} · messages {detail.conversation.message_count}</li>
                  </ul>
                ) : (
                  <p className="fg-muted">No conversation summary is linked to this inbox item.</p>
                )}
              </article>

              <article className="fg-subcard">
                <h4>Related tasks</h4>
                {tasksState === "loading" ? <p className="fg-muted">Loading linked tasks.</p> : null}
                {relatedTasks.length === 0 ? <p className="fg-muted">No task is currently linked to this inbox item. Use the direct create action above if follow-up should move into task tracking.</p> : null}
                {relatedTasks.length > 0 ? (
                  <ul className="fg-list">
                    {relatedTasks.map((task) => (
                      <li key={task.task_id}>
                        <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: task.task_id })}>{task.title}</Link>
                        {" · "}{task.status}
                        {" · owner "}{task.owner_id ? (agentNameById.get(task.owner_id) ?? task.owner_id) : "unassigned"}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Manual intake</h3>
              <p className="fg-muted">Create inbox items manually only when inbound work did not already arrive through conversation, runtime, approval, or workspace truth.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Inbox ID
                <input value={createForm.inboxId} onChange={(event) => setCreateForm((current) => ({ ...current, inboxId: event.target.value }))} placeholder="inbox_customer_pricing" />
              </label>
              <label>
                Conversation ID
                <input value={createForm.conversationId} onChange={(event) => setCreateForm((current) => ({ ...current, conversationId: event.target.value }))} placeholder="conversation_customer_pricing" />
              </label>
              <label>
                Thread ID
                <input value={createForm.threadId} onChange={(event) => setCreateForm((current) => ({ ...current, threadId: event.target.value }))} placeholder="thread_alpha" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Workspace ID
                <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} placeholder="ws_customer_pricing" />
              </label>
              <label>
                Title
                <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Confirm pricing follow-up" />
              </label>
              <label>
                Contact ref
                <input value={createForm.contactRef} onChange={(event) => setCreateForm((current) => ({ ...current, contactRef: event.target.value }))} placeholder="contact://customer/acme" />
              </label>
            </div>
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
                  {PRIORITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as InboxStatus }))}>
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Run ID
                <input value={createForm.runId} onChange={(event) => setCreateForm((current) => ({ ...current, runId: event.target.value }))} placeholder="run_alpha" />
              </label>
              <label>
                Artifact ID
                <input value={createForm.artifactId} onChange={(event) => setCreateForm((current) => ({ ...current, artifactId: event.target.value }))} placeholder="artifact_alpha" />
              </label>
              <label>
                Approval ID
                <input value={createForm.approvalId} onChange={(event) => setCreateForm((current) => ({ ...current, approvalId: event.target.value }))} placeholder="run:instance_alpha:company_alpha:approval-1" />
              </label>
            </div>
            <label>
              Decision ID
              <input value={createForm.decisionId} onChange={(event) => setCreateForm((current) => ({ ...current, decisionId: event.target.value }))} placeholder="decision_preview_alpha" />
            </label>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim()}>
                {savingCreate ? "Creating inbox item" : "Create inbox item"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Inbox settings</h3>
              <p className="fg-muted">Use the form below for deeper edits. Fast triage should happen through the direct actions in the detail panel.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>
              {detail ? detail.inbox_id : "Select an inbox item"}
            </span>
          </div>
          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Conversation ID
                  <input value={editForm.conversationId} onChange={(event) => setEditForm((current) => ({ ...current, conversationId: event.target.value }))} />
                </label>
                <label>
                  Thread ID
                  <input value={editForm.threadId} onChange={(event) => setEditForm((current) => ({ ...current, threadId: event.target.value }))} />
                </label>
                <label>
                  Workspace ID
                  <input value={editForm.workspaceId} onChange={(event) => setEditForm((current) => ({ ...current, workspaceId: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Title
                  <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>
                  Contact ref
                  <input value={editForm.contactRef} onChange={(event) => setEditForm((current) => ({ ...current, contactRef: event.target.value }))} />
                </label>
              </div>
              <label>
                Summary
                <textarea rows={3} value={editForm.summary} onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} />
              </label>
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
                    {PRIORITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as InboxStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
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
                  {savingUpdate ? "Saving inbox item" : "Save inbox item"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select an inbox item before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
