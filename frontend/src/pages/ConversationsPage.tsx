import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  appendConversationMessage,
  createConversation,
  fetchAgents,
  fetchConversationDetail,
  fetchConversations,
  fetchTasks,
  fetchInstances,
  type AgentSummary,
  updateConversation,
  type ConversationDetail,
  type ConversationEventRecord,
  type ConversationMessageRole,
  type ConversationMessageRecord,
  type ConversationSessionKind,
  type ConversationStatus,
  type ConversationSummary,
  type TaskSummary,
  type TriageStatus,
  type WorkItemPriority,
} from "../api/admin";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildAgentsPath,
  buildArtifactsPath,
  buildConversationPath,
  buildInboxPath,
  buildTaskPath,
  buildWorkspacePath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

const STATUS_OPTIONS: Array<ConversationStatus | "all"> = ["all", "open", "paused", "closed", "archived"];
const TRIAGE_OPTIONS: Array<TriageStatus | "all"> = ["all", "new", "relevant", "delegated", "blocked", "done"];
const PRIORITY_OPTIONS: WorkItemPriority[] = ["low", "normal", "high", "critical"];
const SESSION_KIND_OPTIONS: ConversationSessionKind[] = ["runtime", "operator", "assistant", "external"];
const MESSAGE_ROLE_OPTIONS: ConversationMessageRole[] = ["user", "assistant", "system", "operator", "tool"];
const MESSAGE_DIRECTION_OPTIONS = ["all", "to_agent", "from_agent", "human", "system"] as const;
const LINK_LENS_OPTIONS = ["all", "task", "run", "approval", "artifact", "workspace"] as const;

type MessageDirectionLens = typeof MESSAGE_DIRECTION_OPTIONS[number];
type ConversationLinkLens = typeof LINK_LENS_OPTIONS[number];
type TimelineItem =
  | {
    kind: "message";
    sortAt: string;
    threadId: string;
    message: ConversationMessageRecord;
    mentions: ConversationDetail["mentions"];
    events: ConversationEventRecord[];
  }
  | {
    kind: "event";
    sortAt: string;
    threadId: string;
    event: ConversationEventRecord;
  };

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
  participantAgentIds: [] as string[],
  initialMentionAgentIds: [] as string[],
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
  mentionAgentIds: [] as string[],
  handoffToAgentId: "",
  reviewRequestAgentId: "",
  blockerAgentId: "",
  roundtableAgentIds: [] as string[],
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

function conversationMatchesLinkLens(
  conversation: ConversationSummary,
  linkLens: ConversationLinkLens,
  conversationIdsWithTasks: Set<string>,
): boolean {
  if (linkLens === "all") {
    return true;
  }
  if (linkLens === "task") {
    return conversationIdsWithTasks.has(conversation.conversation_id);
  }
  if (linkLens === "run") {
    return Boolean(conversation.run_id);
  }
  if (linkLens === "approval") {
    return Boolean(conversation.approval_id);
  }
  if (linkLens === "artifact") {
    return Boolean(conversation.artifact_id);
  }
  return Boolean(conversation.workspace_id);
}

export function ConversationsPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedConversationId = searchParams.get("conversationId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as ConversationStatus | "all" | "") || "all";
  const triageFilter = (searchParams.get("triageStatus")?.trim() as TriageStatus | "all" | "") || "all";
  const agentFilter = searchParams.get("agentId")?.trim() ?? "";

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
  const [threadLensId, setThreadLensId] = useState("all");
  const [messageDirectionLens, setMessageDirectionLens] = useState<MessageDirectionLens>("all");
  const [messageAgentLensId, setMessageAgentLensId] = useState("");
  const [linkLens, setLinkLens] = useState<ConversationLinkLens>("all");

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
      setAgents([]);
      setAgentsState("idle");
      return;
    }

    let cancelled = false;
    setAgentsState("loading");

    void fetchAgents(instanceId, { status: "all", limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setAgents(payload.agents);
        setAgentsState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setAgents([]);
        setAgentsState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent registry could not be loaded for conversation routing.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setTasks([]);
      setTasksState("idle");
      return;
    }

    let cancelled = false;
    setTasksState("loading");

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
        setError(loadError instanceof Error ? loadError.message : "Conversation task links could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce]);

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
      agentId: agentFilter || null,
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
  }, [agentFilter, canRead, instanceId, refreshNonce, selectedConversationId, statusFilter, triageFilter]);

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
      setThreadLensId("all");
      setMessageDirectionLens("all");
      setMessageAgentLensId("");
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
      mentionAgentIds: [],
      handoffToAgentId: "",
      reviewRequestAgentId: "",
      blockerAgentId: "",
      roundtableAgentIds: [],
    }));
    setThreadLensId("all");
    setMessageDirectionLens("all");
    setMessageAgentLensId("");
  }, [detail]);

  const selectableAgents = agents.filter((agent) => agent.status !== "archived");
  const activeSelectableAgents = useMemo(
    () => selectableAgents.filter((agent) => agent.status === "active"),
    [selectableAgents],
  );
  const participantSelectableAgents = useMemo(
    () => activeSelectableAgents.filter((agent) => agent.participation_mode === "direct" || agent.participation_mode === "roundtable"),
    [activeSelectableAgents],
  );
  const mentionSelectableAgents = useMemo(
    () => activeSelectableAgents.filter((agent) => agent.participation_mode !== "handoff_only"),
    [activeSelectableAgents],
  );
  const roundtableSelectableAgents = useMemo(
    () => activeSelectableAgents.filter((agent) => agent.participation_mode === "direct" || agent.participation_mode === "roundtable"),
    [activeSelectableAgents],
  );
  const handoffSelectableAgents = useMemo(
    () => activeSelectableAgents.filter((agent) => agent.participation_mode === "direct" || agent.participation_mode === "handoff_only"),
    [activeSelectableAgents],
  );
  const resolveAgentLabel = (agentId: string | null | undefined) => {
    if (!agentId) {
      return "Unassigned";
    }
    return agents.find((agent) => agent.agent_id === agentId)?.display_name ?? agentId;
  };
  const conversationIdsWithTasks = useMemo(
    () => new Set(tasks.filter((task) => task.conversation_id).map((task) => task.conversation_id as string)),
    [tasks],
  );
  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => conversationMatchesLinkLens(conversation, linkLens, conversationIdsWithTasks)),
    [conversations, conversationIdsWithTasks, linkLens],
  );
  const visibleTasks = useMemo(
    () => detail ? tasks.filter((task) => task.conversation_id === detail.conversation_id) : [],
    [detail, tasks],
  );
  const mentionsByMessageId = useMemo(() => {
    const grouped = new Map<string, ConversationDetail["mentions"]>();
    if (!detail) {
      return grouped;
    }
    detail.mentions.forEach((mention) => {
      const current = grouped.get(mention.message_id) ?? [];
      current.push(mention);
      grouped.set(mention.message_id, current);
    });
    return grouped;
  }, [detail]);
  const eventsByMessageId = useMemo(() => {
    const grouped = new Map<string, ConversationEventRecord[]>();
    if (!detail) {
      return grouped;
    }
    detail.events.forEach((eventItem) => {
      if (!eventItem.source_message_id) {
        return;
      }
      const current = grouped.get(eventItem.source_message_id) ?? [];
      current.push(eventItem);
      grouped.set(eventItem.source_message_id, current);
    });
    return grouped;
  }, [detail]);
  const threadTitleById = useMemo(
    () => new Map((detail?.threads ?? []).map((thread) => [thread.thread_id, thread.title])),
    [detail],
  );
  const sessionById = useMemo(
    () => new Map((detail?.sessions ?? []).map((sessionItem) => [sessionItem.session_id, sessionItem])),
    [detail],
  );
  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!detail) {
      return [];
    }
    const items: TimelineItem[] = [
      ...detail.messages.map((messageItem) => ({
        kind: "message" as const,
        sortAt: messageItem.created_at,
        threadId: messageItem.thread_id,
        message: messageItem,
        mentions: mentionsByMessageId.get(messageItem.message_id) ?? [],
        events: eventsByMessageId.get(messageItem.message_id) ?? [],
      })),
      ...detail.events.map((eventItem) => ({
        kind: "event" as const,
        sortAt: eventItem.created_at,
        threadId: eventItem.thread_id,
        event: eventItem,
      })),
    ];
    return items.sort((left, right) => left.sortAt.localeCompare(right.sortAt));
  }, [detail, eventsByMessageId, mentionsByMessageId]);
  const filteredTimelineItems = useMemo(() => timelineItems.filter((item) => {
    if (threadLensId !== "all" && item.threadId !== threadLensId) {
      return false;
    }

    if (item.kind === "event") {
      if (messageAgentLensId && item.event.target_agent_id !== messageAgentLensId && item.event.source_agent_id !== messageAgentLensId) {
        return false;
      }
      if (messageDirectionLens === "to_agent" && !item.event.target_agent_id) {
        return false;
      }
      if (messageDirectionLens === "from_agent") {
        return false;
      }
      if (messageDirectionLens === "human") {
        return false;
      }
      return true;
    }

    const isAgentAuthored = item.message.author_type === "agent" || item.message.message_role === "assistant";
    const isHumanAuthored = item.message.message_role === "user" || item.message.message_role === "operator";
    const isSystemAuthored = item.message.message_role === "system" || item.message.message_role === "tool";
    const agentIds = [
      ...item.mentions.map((mention) => mention.agent_id),
      ...item.events.flatMap((eventItem) => [eventItem.source_agent_id, eventItem.target_agent_id].filter(Boolean) as string[]),
      item.message.author_id ?? "",
    ].filter(Boolean);

    if (messageAgentLensId && !agentIds.includes(messageAgentLensId)) {
      return false;
    }
    if (messageDirectionLens === "to_agent" && item.mentions.length === 0 && item.events.every((eventItem) => !eventItem.target_agent_id)) {
      return false;
    }
    if (messageDirectionLens === "from_agent" && !isAgentAuthored) {
      return false;
    }
    if (messageDirectionLens === "human" && !isHumanAuthored) {
      return false;
    }
    if (messageDirectionLens === "system" && !isSystemAuthored) {
      return false;
    }
    return true;
  }), [messageAgentLensId, messageDirectionLens, threadLensId, timelineItems]);
  const composerStructuredSelections = [
    ...appendForm.mentionAgentIds.map((agentId) => `Mention ${resolveAgentLabel(agentId)}`),
    appendForm.handoffToAgentId ? `Handoff to ${resolveAgentLabel(appendForm.handoffToAgentId)}` : null,
    appendForm.reviewRequestAgentId ? `Review from ${resolveAgentLabel(appendForm.reviewRequestAgentId)}` : null,
    appendForm.blockerAgentId ? `Blocker owner ${resolveAgentLabel(appendForm.blockerAgentId)}` : null,
    ...appendForm.roundtableAgentIds.map((agentId) => `Roundtable ${resolveAgentLabel(agentId)}`),
  ].filter((item): item is string => Boolean(item));

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
        participant_agent_ids: createForm.participantAgentIds,
        initial_mention_agent_ids: createForm.initialMentionAgentIds,
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
        mention_agent_ids: appendForm.mentionAgentIds,
        handoff_to_agent_id: appendForm.handoffToAgentId.trim() || null,
        review_request_agent_id: appendForm.reviewRequestAgentId.trim() || null,
        blocker_agent_id: appendForm.blockerAgentId.trim() || null,
        roundtable_agent_ids: appendForm.roundtableAgentIds,
        structured_payload: parseJsonObject(appendForm.structuredPayloadJson, "Structured payload"),
      });
      setAppendForm((current) => ({
        ...current,
        threadId: payload.conversation.active_thread_id ?? current.threadId,
        sessionId: "",
        body: "",
        structuredPayloadJson: "{}",
        continuityKey: "",
        mentionAgentIds: [],
        handoffToAgentId: "",
        reviewRequestAgentId: "",
        blockerAgentId: "",
        roundtableAgentIds: [],
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
            <p className="fg-muted">Choose the instance boundary, then constrain the work surface by lifecycle, triage, responsible agents, and linked task/run/approval objects.</p>
          </div>
          <span
            className="fg-pill"
            data-tone={
              instancesState === "error" || agentsState === "error" || tasksState === "error"
                ? "danger"
                : instancesState === "success" && agentsState !== "loading" && tasksState !== "loading"
                  ? "success"
                  : "neutral"
            }
          >
            instances {instancesState} · agents {agentsState} · tasks {tasksState}
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
          <label>
            Agent lens
            <select
              aria-label="Conversation agent filter"
              value={agentFilter}
              onChange={(event) => updateRoute((next) => {
                const nextAgentId = event.target.value;
                if (nextAgentId) {
                  next.set("agentId", nextAgentId);
                } else {
                  next.delete("agentId");
                }
                next.delete("conversationId");
              })}
            >
              <option value="">all agents</option>
              {agents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {agent.display_name} ({agent.agent_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Link lens
            <select
              aria-label="Conversation link lens"
              value={linkLens}
              onChange={(event) => setLinkLens(event.target.value as ConversationLinkLens)}
            >
              {LINK_LENS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <div className="fg-card-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Conversation and thread inventory</h3>
              <p className="fg-muted">Choose the work item on the left, then stay in the middle timeline to continue the thread instead of drifting into metadata-only editing.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>
              {listState}
            </span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading conversation inventory.</p> : null}
          {listState === "success" && visibleConversations.length === 0 ? <p className="fg-muted">No conversations matched the selected filters and link lens.</p> : null}

          {visibleConversations.length > 0 ? (
            <div className="fg-stack">
              {visibleConversations.map((conversation) => (
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
                    <span className="fg-muted">participants {conversation.participant_count} · mentions {conversation.mention_count} · events {conversation.event_count}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {detail?.threads.length ? (
            <article className="fg-subcard">
              <h4>Thread lane</h4>
              <div className="fg-stack">
                {detail.threads.map((thread) => (
                  <button
                    key={thread.thread_id}
                    type="button"
                    className={`fg-data-row${thread.thread_id === detail.active_thread_id ? " is-current" : ""}`}
                    onClick={() => {
                      setThreadLensId(thread.thread_id);
                      setEditForm((current) => ({ ...current, activeThreadId: thread.thread_id }));
                    }}
                  >
                    <strong>{thread.title}</strong>
                    <span className="fg-muted">{thread.status} · messages {thread.message_count} · sessions {thread.session_count}</span>
                  </button>
                ))}
              </div>
            </article>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Continuation timeline</h3>
              <p className="fg-muted">Messages and system events stay in one chronological stream, with thread/session context and structured agent routing visible beside each contribution.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.conversation_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a conversation to inspect the live thread and continue work from the correct session context.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading conversation detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <article className="fg-subcard">
                <h4>Current work header</h4>
                <div className="fg-detail-grid">
                  <span className="fg-muted">{detail.subject}</span>
                  <span className="fg-muted">active thread {threadTitleById.get(detail.active_thread_id ?? "") ?? detail.active_thread_id ?? "not set"}</span>
                  <span className="fg-muted">latest message {detail.latest_message_at ?? "not recorded"}</span>
                  <span className="fg-muted">structured @Agent routing ready</span>
                </div>
                <p>{detail.summary || "No conversation summary was recorded."}</p>
              </article>

              <article className="fg-subcard">
                <h4>Timeline</h4>
                {filteredTimelineItems.length === 0 ? <p className="fg-muted">No timeline items matched the selected thread and agent lenses.</p> : null}
                {filteredTimelineItems.length > 0 ? (
                  <div className="fg-stack">
                    {filteredTimelineItems.map((item) => {
                      if (item.kind === "event") {
                        return (
                          <article key={item.event.event_id} className="fg-subcard">
                            <div className="fg-panel-heading">
                              <div>
                                <strong>System event</strong>
                                <p className="fg-muted">{item.event.created_at} · {threadTitleById.get(item.event.thread_id) ?? item.event.thread_id}</p>
                              </div>
                              <span className="fg-pill" data-tone="warning">{item.event.event_type}</span>
                            </div>
                            <p>{item.event.summary}</p>
                            <p className="fg-muted">
                              {item.event.target_agent_id ? `Target ${resolveAgentLabel(item.event.target_agent_id)}` : "No target agent"}
                              {item.event.related_object_type && item.event.related_object_id ? ` · ${item.event.related_object_type}:${item.event.related_object_id}` : ""}
                            </p>
                          </article>
                        );
                      }

                      const sessionItem = item.message.session_id ? sessionById.get(item.message.session_id) : null;
                      const contributorLabel = item.message.message_role === "assistant" || item.message.author_type === "agent"
                        ? "Agent"
                        : item.message.message_role === "system" || item.message.message_role === "tool"
                          ? "System"
                          : "Human";
                      const contributorTone = contributorLabel === "Agent"
                        ? "success"
                        : contributorLabel === "System"
                          ? "warning"
                          : "neutral";
                      const authorLabel = contributorLabel === "Agent"
                        ? resolveAgentLabel(item.events[0]?.target_agent_id ?? item.mentions[0]?.agent_id ?? item.message.author_id)
                        : contributorLabel === "System"
                          ? "System event stream"
                          : "Human operator";

                      return (
                        <article key={item.message.message_id} className="fg-subcard">
                          <div className="fg-panel-heading">
                            <div>
                              <strong>{authorLabel}</strong>
                              <p className="fg-muted">
                                {item.message.created_at}
                                {" · "}{threadTitleById.get(item.message.thread_id) ?? item.message.thread_id}
                                {sessionItem ? ` · ${sessionItem.session_kind} session` : " · no session"}
                                {sessionItem?.continuity_key ? ` · ${sessionItem.continuity_key}` : ""}
                              </p>
                            </div>
                            <span className="fg-pill" data-tone={contributorTone}>{contributorLabel}</span>
                          </div>
                          <p>{item.message.body}</p>
                          {Object.keys(item.message.structured_payload).length > 0 ? (
                            <pre>{JSON.stringify(item.message.structured_payload, null, 2)}</pre>
                          ) : null}
                          <div className="fg-detail-grid">
                            <span className="fg-muted">role {item.message.message_role}</span>
                            <span className="fg-muted">author {item.message.author_type}</span>
                            <span className="fg-muted">mentions {item.mentions.length}</span>
                            <span className="fg-muted">events {item.events.length}</span>
                          </div>
                          {item.mentions.length > 0 ? (
                            <ul className="fg-list">
                              {item.mentions.map((mention) => (
                                <li key={mention.mention_id}>
                                  <Link className="fg-nav-link" to={buildAgentsPath({ instanceId, agentId: mention.agent_id })}>{mention.token}</Link>
                                  {" · "}{mention.agent_display_name}
                                  {" · "}{mention.status}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </article>

              <form className="fg-stack" onSubmit={handleAppend}>
                <h4>Append message</h4>
                <p className="fg-muted">Message composer with structured @Agent routing. Mentions, handoffs, review requests, blockers, and roundtables are persisted as first-class conversation objects.</p>
                <article className="fg-subcard">
                  <h4>Structured agent routing</h4>
                  {composerStructuredSelections.length === 0 ? (
                    <p className="fg-muted">No structured agent routing is selected yet. The composer will still persist the message against the chosen thread/session context.</p>
                  ) : (
                    <ul className="fg-list">
                      {composerStructuredSelections.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </article>
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
                <div className="fg-card-grid">
                  <label>
                    Mention agents
                    <select
                      multiple
                      size={Math.min(Math.max(mentionSelectableAgents.length, 3), 6)}
                      value={appendForm.mentionAgentIds}
                      onChange={(event) => setAppendForm((current) => ({
                        ...current,
                        mentionAgentIds: Array.from(event.target.selectedOptions, (option) => option.value),
                      }))}
                    >
                      {mentionSelectableAgents.map((agent) => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          @{agent.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Roundtable agents
                    <select
                      multiple
                      size={Math.min(Math.max(roundtableSelectableAgents.length, 3), 6)}
                      value={appendForm.roundtableAgentIds}
                      onChange={(event) => setAppendForm((current) => ({
                        ...current,
                        roundtableAgentIds: Array.from(event.target.selectedOptions, (option) => option.value),
                      }))}
                    >
                      {roundtableSelectableAgents.map((agent) => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agent.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Handoff to
                    <select
                      value={appendForm.handoffToAgentId}
                      onChange={(event) => setAppendForm((current) => ({ ...current, handoffToAgentId: event.target.value }))}
                    >
                      <option value="">none</option>
                      {handoffSelectableAgents.map((agent) => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agent.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Review request
                    <select
                      value={appendForm.reviewRequestAgentId}
                      onChange={(event) => setAppendForm((current) => ({ ...current, reviewRequestAgentId: event.target.value }))}
                    >
                      <option value="">none</option>
                      {handoffSelectableAgents.map((agent) => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agent.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Blocker owner
                    <select
                      value={appendForm.blockerAgentId}
                      onChange={(event) => setAppendForm((current) => ({ ...current, blockerAgentId: event.target.value }))}
                    >
                      <option value="">none</option>
                      {handoffSelectableAgents.map((agent) => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agent.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="fg-muted">Composer routing follows the live registry. Mention targets come from mention-capable modes; handoff, review, and blocker ownership only expose owner-capable modes.</p>
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
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Context and objects</h3>
              <p className="fg-muted">Thread, session, tasks, runs, approvals, workspaces, artifacts, and agent events stay visible on the right so continuation never loses its runtime or governance context.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "success" : "neutral"}>{detail ? "Context loaded" : "No conversation selected"}</span>
          </div>

          {detail ? (
            <div className="fg-stack">
              <article className="fg-subcard">
                <h4>Conversation lenses</h4>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Thread lens
                    <select value={threadLensId} onChange={(event) => setThreadLensId(event.target.value)}>
                      <option value="all">all threads</option>
                      {detail.threads.map((thread) => <option key={thread.thread_id} value={thread.thread_id}>{thread.title}</option>)}
                    </select>
                  </label>
                  <label>
                    An/von Agent
                    <select value={messageDirectionLens} onChange={(event) => setMessageDirectionLens(event.target.value as MessageDirectionLens)}>
                      {MESSAGE_DIRECTION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Agent
                    <select value={messageAgentLensId} onChange={(event) => setMessageAgentLensId(event.target.value)}>
                      <option value="">all agents</option>
                      {selectableAgents.map((agent) => <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>)}
                    </select>
                  </label>
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Linked objects</h4>
                <ul className="fg-list">
                  <li>Workspace: {detail.workspace_id ?? "Not linked"}</li>
                  <li>Run: {detail.run_id ?? "Not linked"}</li>
                  <li>Approval: {detail.approval_id ?? "Not linked"}</li>
                  <li>Artifact: {detail.artifact_id ?? "Not linked"}</li>
                  <li>Decision: {detail.decision_id ?? "Not linked"}</li>
                  <li>Tasks: {visibleTasks.length > 0 ? `${visibleTasks.length} linked` : tasksState === "loading" ? "Loading" : "No linked tasks"}</li>
                </ul>
                <div className="fg-actions">
                  {detail.workspace_id ? <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}>Open workspace</Link> : null}
                  {detail.run_id ? <Link className="fg-nav-link" to={buildExecutionRoute(instanceId, detail.run_id)}>Open execution review</Link> : null}
                  {detail.approval_id ? <Link className="fg-nav-link" to={buildApprovalRoute(instanceId, detail.approval_id)}>Open approval review</Link> : null}
                  {detail.artifact_id ? <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, artifactId: detail.artifact_id })}>Open artifact</Link> : null}
                  {detail.inbox_items[0] ? <Link className="fg-nav-link" to={buildInboxPath({ instanceId, inboxId: detail.inbox_items[0].inbox_id })}>Open inbox item</Link> : null}
                  {visibleTasks[0] ? <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: visibleTasks[0].task_id })}>Open task</Link> : null}
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Related tasks</h4>
                {tasksState === "loading" ? <p className="fg-muted">Loading task links.</p> : null}
                {visibleTasks.length === 0 ? <p className="fg-muted">No tasks are currently linked to this conversation.</p> : null}
                {visibleTasks.length > 0 ? (
                  <ul className="fg-list">
                    {visibleTasks.map((task) => (
                      <li key={task.task_id}>
                        <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: task.task_id })}>{task.title}</Link>
                        {" · "}{task.status}
                        {" · "}{task.priority}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>

              <article className="fg-subcard">
                <h4>Thread and session context</h4>
                <ul className="fg-list">
                  {detail.threads.map((thread) => (
                    <li key={thread.thread_id}>
                      <span className="fg-code">{thread.thread_id}</span>
                      {" · "}{thread.title}
                      {" · "}{thread.status}
                      {" · messages "}{thread.message_count}
                    </li>
                  ))}
                  {detail.sessions.map((sessionItem) => (
                    <li key={sessionItem.session_id}>
                      <span className="fg-code">{sessionItem.session_id}</span>
                      {" · "}{sessionItem.session_kind}
                      {" · "}{sessionItem.continuity_key ?? "no continuity key"}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Agent participation</h4>
                {detail.participants.length === 0 ? <p className="fg-muted">No agent participants were recorded.</p> : (
                  <ul className="fg-list">
                    {detail.participants.map((participant) => (
                      <li key={participant.participant_id}>
                        <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.conversation_id, agentId: participant.agent_id ?? undefined })}>
                          {participant.display_label}
                        </Link>
                        {" · "}{participant.participant_kind}
                        {" · "}{participant.participant_status}
                        {participant.agent_id ? (
                          <>
                            {" · "}
                            <Link className="fg-nav-link" to={buildAgentsPath({ instanceId, agentId: participant.agent_id })}>Open agent</Link>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="fg-subcard">
                <h4>Mentions and events</h4>
                {detail.mentions.length === 0 && detail.events.length === 0 ? <p className="fg-muted">No structured mentions or agent events were recorded.</p> : null}
                {detail.mentions.length > 0 ? (
                  <ul className="fg-list">
                    {detail.mentions.map((mention) => (
                      <li key={mention.mention_id}>
                        <Link className="fg-nav-link" to={buildAgentsPath({ instanceId, agentId: mention.agent_id })}>{mention.token}</Link>
                        {" · "}{mention.agent_display_name}
                        {" · "}{mention.status}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {detail.events.length > 0 ? (
                  <ul className="fg-list">
                    {detail.events.map((eventItem) => (
                      <li key={eventItem.event_id}>
                        <strong>{eventItem.summary}</strong>
                        {" · "}{eventItem.event_type}
                        {eventItem.target_agent_id ? ` · ${resolveAgentLabel(eventItem.target_agent_id)}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </div>
          ) : (
            <p className="fg-muted">Select a conversation to expose lenses, tasks, sessions, approvals, workspace links, and agent events.</p>
          )}
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
            <div className="fg-card-grid">
              <label>
                Participants
                <select
                  multiple
                  size={Math.min(Math.max(participantSelectableAgents.length, 3), 6)}
                  value={createForm.participantAgentIds}
                  onChange={(event) => setCreateForm((current) => ({
                    ...current,
                    participantAgentIds: Array.from(event.target.selectedOptions, (option) => option.value),
                  }))}
                >
                  {participantSelectableAgents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.display_name} ({agent.role_kind})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Initial mentions
                <select
                  multiple
                  size={Math.min(Math.max(mentionSelectableAgents.length, 3), 6)}
                  value={createForm.initialMentionAgentIds}
                  onChange={(event) => setCreateForm((current) => ({
                    ...current,
                    initialMentionAgentIds: Array.from(event.target.selectedOptions, (option) => option.value),
                  }))}
                >
                  {mentionSelectableAgents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      @{agent.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="fg-muted">Conversation creation respects agent participation modes: owner-capable agents populate participant lists, while mention pickers exclude `handoff_only` agents.</p>
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
              <h3>Conversation settings</h3>
              <p className="fg-muted">Create and edit remain secondary actions. Use them to keep summary, triage, and object linkage coherent around the active work thread.</p>
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
            </div>
          ) : (
            <p className="fg-muted">Select a conversation before attempting a mutation or continuation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
