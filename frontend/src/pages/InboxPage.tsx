/**
 * InboxPage — persistent triage queue with status, priority, conversation
 * linkage, and links back to runtime, approvals, workspace, and artifacts.
 *
 * Uses the IncidentResponsePage template for consistent layout with
 * attention items, summary strip, actions, selected-item detail, and
 * collapsed diagnostics.
 *
 * Feature module at {@link features/inbox}.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createConversation,
  fetchConversations,
  type ConversationSummary,
} from "../api/domain/conversations";
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
import { useAppSession } from "../app/session";
import { IncidentResponsePage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import type { AttentionPayload } from "../components/ui/models/attention";
import { Button, DiagnosticSection, RawJson } from "../components/ui";

import {
  InboxList,
  InboxDetail as InboxDetailPanel,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  TRIAGE_OPTIONS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  parseJsonObject,
  inboxSourceLabel,
} from "../features/inbox";

import type { CreateForm, EditForm, InboxSourceFilter } from "../features/inbox";

type LoadState = "idle" | "loading" | "success" | "error";

/**
 * Inbox page — triage queue exposed through the IncidentResponsePage
 * template with a scope/filter card, inbox inventory list, detail panel,
 * create form, and diagnostics.
 */
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
  const [createForm, setCreateForm] = useState<CreateForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditForm>(DEFAULT_EDIT_FORM);
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

  // ── Effects ─────────────────────────────────────────────────────────

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

  // ── Handlers ────────────────────────────────────────────────────────

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

  // ── Derived data ────────────────────────────────────────────────────

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
    payload: Partial<{ triage_status: TriageStatus | null; status: InboxStatus | null }>,
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

  // ── Inline handlers for filter changes ───────────────────────────────

  const handleInstanceChange = (nextInstanceId: string) => {
    updateRoute((next) => {
      next.set("instanceId", nextInstanceId);
      next.delete("inboxId");
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "source") {
      setSourceFilter(value as InboxSourceFilter);
      return;
    }
    if (key === "owner") {
      setOwnerFilter(value);
      return;
    }
    updateRoute((next) => {
      if (value === "all") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      next.delete("inboxId");
    });
  };

  const handleSelectItem = (inboxId: string) => {
    updateRoute((next) => {
      next.set("inboxId", inboxId);
    });
  };

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value } as EditForm));
  };

  // ── Template props ──────────────────────────────────────────────────

  const attentionItems: AttentionPayload[] = [];
  if (error) {
    attentionItems.push({
      key: "error",
      level: "warning",
      title: error,
    });
  }
  if (message) {
    attentionItems.push({
      key: "message",
      level: "informational",
      title: message,
    });
  }

  const summaryItems: Array<{ key: string; label: string; value: string | number; tone?: "success" | "warning" | "danger" | "info" | "neutral" }> = [
    {
      key: "items",
      label: "Inbox items",
      value: items.length,
      tone: items.length > 0 ? "warning" : "success",
    },
    {
      key: "read-write",
      label: "Access",
      value: canMutate ? "Read/write" : "Read only",
      tone: canMutate ? "success" : "neutral",
    },
  ];

  const actions: Action[] = [];

  const selectedItemContent = detail ? (
    <InboxDetailPanel
      detail={detail}
      detailState={detailState}
      instanceId={instanceId}
      canMutate={canMutate}
      relatedTasks={relatedTasks}
      agentNameById={agentNameById}
      tasksState={tasksState}
      editForm={editForm}
      savingUpdate={savingUpdate}
      quickActionState={quickActionState}
      onQuickAction={(actionKey, payload) => void runQuickAction(actionKey, payload)}
      onCreateConversation={() => void handleCreateConversationFromInbox()}
      onCreateTask={() => void handleCreateTaskFromInbox()}
      onUpdate={handleUpdate}
      onEditFormChange={handleEditFormChange}
    />
  ) : null;

  const diagnosticsContent = (
    <>
      <DiagnosticSection label="Filters">
        <RawJson data={{ triageFilter, statusFilter, priorityFilter, sourceFilter, ownerFilter }} />
      </DiagnosticSection>
      <DiagnosticSection label="Load states">
        <RawJson data={{ instancesState, agentsState, tasksState, conversationsState, listState, detailState }} />
      </DiagnosticSection>
      <DiagnosticSection label="Raw inbox items">
        <RawJson data={items} />
      </DiagnosticSection>
    </>
  );

  // ── Session guards ──────────────────────────────────────────────────

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <p className="fg-muted">ForgeFrame is restoring inbox scope before exposing the triage queue.</p>
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <p className="fg-muted">Operator or admin access is required to inspect inbox triage posture.</p>
      </section>
    );
  }

  return (
    <IncidentResponsePage
      eyebrow="Work Interaction"
      title="Inbox"
      description="Persistent triage queue with status, priority, conversation linkage, and links back to runtime, approvals, workspace, and artifacts."
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      actions={actions}
      selectedItemContent={selectedItemContent}
      hasSelection={Boolean(detail)}
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Inbox diagnostics"
    >
      {/* ── Scope, filters, and inbox inventory ── */}
      <InboxList
        instances={instances}
        instanceId={instanceId}
        instancesState={instancesState}
        agentsState={agentsState}
        tasksState={tasksState}
        conversationsState={conversationsState}
        listState={listState}
        triageFilter={triageFilter}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        sourceFilter={sourceFilter}
        ownerFilter={ownerFilter}
        availableOwnerAgents={availableOwnerAgents}
        items={items}
        selectedInboxId={selectedInboxId}
        tasks={tasks}
        conversations={conversations}
        conversationById={conversationById}
        agentNameById={agentNameById}
        visibleItems={visibleItems}
        onInstanceChange={handleInstanceChange}
        onFilterChange={handleFilterChange}
        onSelectItem={handleSelectItem}
      />

      {/* ── Manual intake form ── */}
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
            <Button type="submit" variant="primary" isDisabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim()}>
              {savingCreate ? "Creating inbox item" : "Create inbox item"}
            </Button>
          </div>
        </form>
      </article>
    </IncidentResponsePage>
  );
}
