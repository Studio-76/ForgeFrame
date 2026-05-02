import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  appendConversationMessage,
  createConversation,
  fetchAgents,
  fetchConversationDetail,
  fetchConversations,
  fetchInstances,
  fetchTasks,
  updateConversation,
  type AgentSummary,
  type ConversationDetail,
  type ConversationEventRecord,
  type ConversationStatus,
  type ConversationSummary,
  type TaskSummary,
  type TriageStatus,
} from "../../api/domain";
import { roleAllows, sessionHasAnyInstancePermission } from "../../app/adminAccess";
import { useAppSession } from "../../app/session";
import { parseJsonObject } from "./utils";
import {
  DEFAULT_APPEND_FORM,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  type AppendConversationForm,
  type ConversationLinkLens,
  type CreateConversationForm,
  type EditConversationForm,
  type LoadState,
  type MessageDirectionLens,
  type TimelineItem,
} from "./types";

/**
 * Return value of the `useConversations()` hook.
 * Provides all state, handlers, memoized data, and form setters for the Conversations page.
 */
export interface UseConversationsReturn {
  session: ReturnType<typeof useAppSession>["session"];
  sessionReady: boolean;
  canRead: boolean;
  canMutate: boolean;
  instanceId: string;
  selectedConversationId: string;
  statusFilter: string;
  triageFilter: string;
  agentFilter: string;

  instances: Array<{ instance_id: string; display_name: string }>;
  agents: AgentSummary[];
  tasks: TaskSummary[];
  conversations: ConversationSummary[];
  detail: ConversationDetail | null;

  instancesState: LoadState;
  agentsState: LoadState;
  tasksState: LoadState;
  listState: LoadState;
  detailState: LoadState;

  createForm: CreateConversationForm;
  editForm: EditConversationForm;
  appendForm: AppendConversationForm;

  savingCreate: boolean;
  savingUpdate: boolean;
  savingAppend: boolean;

  error: string;
  message: string;

  threadLensId: string;
  messageDirectionLens: MessageDirectionLens;
  messageAgentLensId: string;
  linkLens: ConversationLinkLens;

  selectableAgents: AgentSummary[];
  activeSelectableAgents: AgentSummary[];
  participantSelectableAgents: AgentSummary[];
  mentionSelectableAgents: AgentSummary[];
  roundtableSelectableAgents: AgentSummary[];
  handoffSelectableAgents: AgentSummary[];

  conversationIdsWithTasks: Set<string>;
  visibleConversations: ConversationSummary[];
  visibleTasks: TaskSummary[];
  mentionsByMessageId: Map<string, ConversationDetail["mentions"]>;
  eventsByMessageId: Map<string, ConversationEventRecord[]>;
  threadTitleById: Map<string, string>;
  sessionById: Map<string, ConversationDetail["sessions"][number]>;
  timelineItems: TimelineItem[];
  filteredTimelineItems: TimelineItem[];
  composerStructuredSelections: string[];

  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
  resolveAgentLabel: (agentId: string | null | undefined) => string;
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleAppend: (event: FormEvent<HTMLFormElement>) => Promise<void>;

  setCreateForm: React.Dispatch<React.SetStateAction<CreateConversationForm>>;
  setEditForm: React.Dispatch<React.SetStateAction<EditConversationForm>>;
  setAppendForm: React.Dispatch<React.SetStateAction<AppendConversationForm>>;
  setThreadLensId: React.Dispatch<React.SetStateAction<string>>;
  setMessageDirectionLens: React.Dispatch<React.SetStateAction<MessageDirectionLens>>;
  setMessageAgentLensId: React.Dispatch<React.SetStateAction<string>>;
  setLinkLens: React.Dispatch<React.SetStateAction<ConversationLinkLens>>;
}

/**
 * Master hook for the Conversations page.
 * Manages session access, URL state, data fetching, lens state, form state,
 * memoized timeline/computed data, and all CRUD handlers.
 */
export function useConversations(): UseConversationsReturn {
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
  const [createForm, setCreateForm] = useState<CreateConversationForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditConversationForm>(DEFAULT_EDIT_FORM);
  const [appendForm, setAppendForm] = useState<AppendConversationForm>(DEFAULT_APPEND_FORM);
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

  // Fetch instances
  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }
    let cancelled = false;
    setInstancesState("loading");
    void fetchInstances()
      .then((payload) => {
        if (cancelled) return;
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Conversation instance scope could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  // Fetch agents
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
        if (cancelled) return;
        setAgents(payload.agents);
        setAgentsState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setAgents([]);
        setAgentsState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent registry could not be loaded for conversation routing.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce]);

  // Fetch tasks
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
        if (cancelled) return;
        setTasks(payload.tasks);
        setTasksState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setTasks([]);
        setTasksState("error");
        setError(loadError instanceof Error ? loadError.message : "Conversation task links could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce]);

  // Fetch conversations list
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
        if (cancelled) return;
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
        if (cancelled) return;
        setConversations([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Conversation inventory could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [agentFilter, canRead, instanceId, refreshNonce, selectedConversationId, statusFilter, triageFilter]);

  // Fetch conversation detail
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
        if (cancelled) return;
        setDetail(payload.conversation);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Conversation detail could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedConversationId]);

  // Sync forms when detail changes
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

  // Derived agent lists
  const selectableAgents = agents.filter((agent) => agent.status !== "archived");
  const activeSelectableAgents = useMemo(
    () => selectableAgents.filter((agent) => agent.status === "active"),
    [selectableAgents],
  );
  const participantSelectableAgents = useMemo(
    () => activeSelectableAgents.filter(
      (agent) => agent.participation_mode === "direct" || agent.participation_mode === "roundtable",
    ),
    [activeSelectableAgents],
  );
  const mentionSelectableAgents = useMemo(
    () => activeSelectableAgents.filter((agent) => agent.participation_mode !== "handoff_only"),
    [activeSelectableAgents],
  );
  const roundtableSelectableAgents = useMemo(
    () => activeSelectableAgents.filter(
      (agent) => agent.participation_mode === "direct" || agent.participation_mode === "roundtable",
    ),
    [activeSelectableAgents],
  );
  const handoffSelectableAgents = useMemo(
    () => activeSelectableAgents.filter(
      (agent) => agent.participation_mode === "direct" || agent.participation_mode === "handoff_only",
    ),
    [activeSelectableAgents],
  );

  // Memoized derived data
  const conversationIdsWithTasks = useMemo(
    () => new Set(tasks.filter((task) => task.conversation_id).map((task) => task.conversation_id as string)),
    [tasks],
  );
  const visibleConversations = useMemo(
    () => conversations.filter(
      (conversation) => {
        if (linkLens === "all") return true;
        if (linkLens === "task") return conversationIdsWithTasks.has(conversation.conversation_id);
        if (linkLens === "run") return Boolean(conversation.run_id);
        if (linkLens === "approval") return Boolean(conversation.approval_id);
        if (linkLens === "artifact") return Boolean(conversation.artifact_id);
        return Boolean(conversation.workspace_id);
      },
    ),
    [conversations, conversationIdsWithTasks, linkLens],
  );
  const visibleTasks = useMemo(
    () => (detail ? tasks.filter((task) => task.conversation_id === detail.conversation_id) : []),
    [detail, tasks],
  );
  const mentionsByMessageId = useMemo(() => {
    const grouped = new Map<string, ConversationDetail["mentions"]>();
    if (!detail) return grouped;
    detail.mentions.forEach((mention) => {
      const current = grouped.get(mention.message_id) ?? [];
      current.push(mention);
      grouped.set(mention.message_id, current);
    });
    return grouped;
  }, [detail]);
  const eventsByMessageId = useMemo(() => {
    const grouped = new Map<string, ConversationEventRecord[]>();
    if (!detail) return grouped;
    detail.events.forEach((eventItem) => {
      if (!eventItem.source_message_id) return;
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
    if (!detail) return [];
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

  const filteredTimelineItems = useMemo(
    () => timelineItems.filter((item) => {
      if (threadLensId !== "all" && item.threadId !== threadLensId) return false;
      if (item.kind === "event") {
        if (messageAgentLensId
          && item.event.target_agent_id !== messageAgentLensId
          && item.event.source_agent_id !== messageAgentLensId) {
          return false;
        }
        if (messageDirectionLens === "to_agent" && !item.event.target_agent_id) return false;
        if (messageDirectionLens === "from_agent") return false;
        if (messageDirectionLens === "human") return false;
        return true;
      }
      const isAgentAuthored = item.message.author_type === "agent" || item.message.message_role === "assistant";
      const isHumanAuthored = item.message.message_role === "user" || item.message.message_role === "operator";
      const isSystemAuthored = item.message.message_role === "system" || item.message.message_role === "tool";
      const agentIds = [
        ...item.mentions.map((mention) => mention.agent_id),
        ...item.events.flatMap((e) => [e.source_agent_id, e.target_agent_id].filter(Boolean) as string[]),
        item.message.author_id ?? "",
      ].filter(Boolean);
      if (messageAgentLensId && !agentIds.includes(messageAgentLensId)) return false;
      if (messageDirectionLens === "to_agent"
        && item.mentions.length === 0
        && item.events.every((e) => !e.target_agent_id)) return false;
      if (messageDirectionLens === "from_agent" && !isAgentAuthored) return false;
      if (messageDirectionLens === "human" && !isHumanAuthored) return false;
      if (messageDirectionLens === "system" && !isSystemAuthored) return false;
      return true;
    }),
    [messageAgentLensId, messageDirectionLens, threadLensId, timelineItems],
  );

  const resolveAgentLabel = (agentId: string | null | undefined): string => {
    if (!agentId) return "Unassigned";
    return agents.find((agent) => agent.agent_id === agentId)?.display_name ?? agentId;
  };

  const composerStructuredSelections = useMemo(
    () => [
      ...appendForm.mentionAgentIds.map((agentId) => `Mention ${resolveAgentLabel(agentId)}`),
      appendForm.handoffToAgentId ? `Handoff to ${resolveAgentLabel(appendForm.handoffToAgentId)}` : null,
      appendForm.reviewRequestAgentId ? `Review from ${resolveAgentLabel(appendForm.reviewRequestAgentId)}` : null,
      appendForm.blockerAgentId ? `Blocker owner ${resolveAgentLabel(appendForm.blockerAgentId)}` : null,
      ...appendForm.roundtableAgentIds.map((agentId) => `Roundtable ${resolveAgentLabel(agentId)}`),
    ].filter((item): item is string => Boolean(item)),
    [appendForm],
  );

  // Handlers
  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) return;
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
    if (!canMutate || !instanceId || !detail) return;
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
    if (!canMutate || !instanceId || !detail) return;
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

  return {
    session,
    sessionReady,
    canRead,
    canMutate,
    instanceId,
    selectedConversationId,
    statusFilter,
    triageFilter,
    agentFilter,
    instances,
    agents,
    tasks,
    conversations,
    detail,
    instancesState,
    agentsState,
    tasksState,
    listState,
    detailState,
    createForm,
    editForm,
    appendForm,
    savingCreate,
    savingUpdate,
    savingAppend,
    error,
    message,
    threadLensId,
    messageDirectionLens,
    messageAgentLensId,
    linkLens,
    selectableAgents,
    activeSelectableAgents,
    participantSelectableAgents,
    mentionSelectableAgents,
    roundtableSelectableAgents,
    handoffSelectableAgents,
    conversationIdsWithTasks,
    visibleConversations,
    visibleTasks,
    mentionsByMessageId,
    eventsByMessageId,
    threadTitleById,
    sessionById,
    timelineItems,
    filteredTimelineItems,
    composerStructuredSelections,
    updateRoute,
    resolveAgentLabel,
    handleCreate,
    handleUpdate,
    handleAppend,
    setCreateForm,
    setEditForm,
    setAppendForm,
    setThreadLensId,
    setMessageDirectionLens,
    setMessageAgentLensId,
    setLinkLens,
  };
}
