import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";

import {
  archiveAgent,
  createAgent,
  fetchAgentDetail,
  fetchAgents,
  updateAgent,
  type AgentDetail,
  type AgentParticipationMode,
  type AgentRoleKind,
  type AgentStatus,
  type AgentSummary,
} from "../api/domain/agents";
import { fetchInstances } from "../api/domain/instances";
import { useAppSession } from "../app/session";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import type { Action } from "../components/ui/models/action";
import { AdvancedDiagnostics, RawJson } from "../components/ui/AdvancedDiagnostics";

import {
  AgentList,
  AgentDetailPanel,
  AgentCreateForm as AgentCreateFormComponent,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  agentStatusTone,
  participationLabel,
} from "../features/agents";
import type { AgentCreateForm, AgentEditForm, DrawerMode } from "../features/agents/types";

export function AgentsPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedAgentId = searchParams.get("agentId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as AgentStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [operatorState, setOperatorState] = useState<LoadState>("idle");
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [operatorAgent, setOperatorAgent] = useState<AgentSummary | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [createForm, setCreateForm] = useState<AgentCreateForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<AgentEditForm>(DEFAULT_EDIT_FORM);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [archiveReplacement, setArchiveReplacement] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingArchive, setSavingArchive] = useState(false);
  const [repairingOperator, setRepairingOperator] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => setSearchParams(next, { replace }));
  };

  const syncSelectedAgentRoute = (nextAgents: AgentSummary[], preferredAgentId = selectedAgentId) => {
    const nextAgentId = nextAgents.some((item) => item.agent_id === preferredAgentId)
      ? preferredAgentId
      : nextAgents[0]?.agent_id ?? "";
    if (nextAgentId !== selectedAgentId) {
      updateRoute((next) => {
        if (nextAgentId) {
          next.set("agentId", nextAgentId);
        } else {
          next.delete("agentId");
        }
      }, true);
    }
  };

  // ── Data fetching effects ──

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
          updateRoute((next) => { next.set("instanceId", payload.instances[0].instance_id); }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent instance scope could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setOperatorAgent(null);
      setOperatorState("idle");
      return;
    }
    let cancelled = false;
    setOperatorState("loading");
    void fetchAgents(instanceId, { status: "all", limit: 100, ensureDefaultOperator: false })
      .then((payload) => {
        if (cancelled) return;
        setOperatorAgent(payload.agents.find((item) => item.is_default_operator) ?? null);
        setOperatorState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setOperatorAgent(null);
        setOperatorState("error");
        setError(loadError instanceof Error ? loadError.message : "Required Operator truth could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [canRead, instanceId, refreshNonce]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setAgents([]);
      setDetail(null);
      return;
    }
    let cancelled = false;
    setListState("loading");
    void fetchAgents(instanceId, { status: statusFilter, limit: 100, ensureDefaultOperator: false })
      .then((payload) => {
        if (cancelled) return;
        setAgents(payload.agents);
        setListState("success");
        setError("");
        syncSelectedAgentRoute(payload.agents);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent inventory could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [canRead, instanceId, refreshNonce, selectedAgentId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedAgentId) {
      setDetail(null);
      setDetailState("idle");
      return;
    }
    let cancelled = false;
    setDetailState("loading");
    void fetchAgentDetail(selectedAgentId, instanceId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.agent);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent detail could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [canRead, instanceId, refreshNonce, selectedAgentId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setArchiveReplacement("");
      setArchiveReason("");
      return;
    }
    setEditForm({
      displayName: detail.display_name,
      defaultName: detail.default_name,
      roleKind: detail.role_kind,
      status: detail.status,
      participationMode: detail.participation_mode,
      assistantProfileId: detail.assistant_profile_id ?? "",
      allowedTargets: detail.allowed_targets.join(", "),
      isDefaultOperator: detail.is_default_operator ? "yes" : "no",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
    setArchiveReplacement("");
    setArchiveReason("");
  }, [detail]);

  // ── Drawer helpers ──

  const closeDrawer = () => {
    setDrawerMode("closed");
    setCreateForm(DEFAULT_CREATE_FORM);
  };

  const openCreateDrawer = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setDrawerMode("create");
  };

  const openEditDrawer = () => {
    if (!detail) return;
    setDrawerMode("edit");
  };

  // ── State sync helper ──

  const syncAgent = (agent: AgentDetail) => {
    setDetail(agent);
    setDetailState("success");
    if (agent.is_default_operator) {
      setOperatorAgent(agent);
    } else if (operatorAgent?.agent_id === agent.agent_id) {
      setOperatorAgent(null);
    }
    setAgents((current) => {
      const nextAgents = current.map((item) => (item.agent_id === agent.agent_id ? { ...item, ...agent } : item));
      return nextAgents.some((item) => item.agent_id === agent.agent_id) ? nextAgents : [agent, ...nextAgents];
    });
  };

  // ── Event handlers ──

  const handleRestoreOperator = async () => {
    if (!canMutate || !instanceId) return;
    setRepairingOperator(true);
    setError("");
    setMessage("");
    try {
      const repairedRegistry = await fetchAgents(instanceId, { status: "all", limit: 100, ensureDefaultOperator: true });
      const operator = repairedRegistry.agents.find((item) => item.is_default_operator) ?? null;
      setOperatorAgent(operator);
      setOperatorState("success");
      const filteredPayload = statusFilter === "all"
        ? repairedRegistry
        : await fetchAgents(instanceId, { status: statusFilter, limit: 100, ensureDefaultOperator: false });
      setAgents(filteredPayload.agents);
      setListState("success");
      if (operator) {
        syncSelectedAgentRoute(filteredPayload.agents, statusFilter === "all" ? operator.agent_id : selectedAgentId);
        setMessage(
          statusFilter === "all"
            ? `Required Operator ${operator.display_name} restored.`
            : `Required Operator ${operator.display_name} restored. The current status filter keeps it out of the table.`,
        );
      } else {
        setMessage("Operator repair request completed, but no Operator record was returned.");
      }
    } catch (repairError) {
      setError(repairError instanceof Error ? repairError.message : "Operator repair failed.");
    } finally {
      setRepairingOperator(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) return;
    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createAgent(instanceId, {
        agent_id: normalizeOptional(createForm.agentId),
        display_name: createForm.displayName.trim(),
        default_name: normalizeOptional(createForm.defaultName),
        role_kind: createForm.roleKind,
        status: createForm.status,
        participation_mode: createForm.participationMode,
        assistant_profile_id: normalizeOptional(createForm.assistantProfileId),
        allowed_targets: createForm.allowedTargets
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        is_default_operator: createForm.isDefaultOperator === "yes",
        metadata: parseJsonObject(createForm.metadataJson, "Agent metadata"),
      });
      syncAgent(payload.agent);
      closeDrawer();
      setMessage(`Agent ${payload.agent.agent_id} created.`);
      updateRoute((next) => next.set("agentId", payload.agent.agent_id));
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Agent creation failed.");
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
      const payload = await updateAgent(instanceId, detail.agent_id, {
        display_name: editForm.displayName.trim(),
        default_name: normalizeOptional(editForm.defaultName),
        role_kind: editForm.roleKind,
        status: editForm.status,
        participation_mode: editForm.participationMode,
        assistant_profile_id: normalizeOptional(editForm.assistantProfileId),
        allowed_targets: editForm.allowedTargets
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        is_default_operator: editForm.isDefaultOperator === "yes",
        metadata: parseJsonObject(editForm.metadataJson, "Agent metadata"),
      });
      syncAgent(payload.agent);
      setDrawerMode("closed");
      setMessage(`Agent ${payload.agent.agent_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Agent update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleArchive = async () => {
    if (!canMutate || !instanceId || !detail) return;
    setSavingArchive(true);
    setError("");
    setMessage("");
    try {
      const payload = await archiveAgent(instanceId, detail.agent_id, {
        replacement_agent_id: normalizeOptional(archiveReplacement),
        reason: normalizeOptional(archiveReason),
      });
      syncAgent(payload.agent);
      setMessage(`Agent ${payload.agent.agent_id} archived.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Agent archive failed.");
    } finally {
      setSavingArchive(false);
    }
  };

  const handleSubmitDrawerForm = (event: FormEvent<HTMLFormElement>) => {
    if (drawerMode === "create") {
      return handleCreate(event);
    }
    return handleUpdate(event);
  };

  const handleAgentRowClick = (row: AgentSummary) => {
    updateRoute((next) => next.set("agentId", row.agent_id));
  };

  const handleInstanceChange = (value: string) => {
    updateRoute((next) => { next.set("instanceId", value); next.delete("agentId"); });
  };

  const handleStatusChange = (value: string) => {
    updateRoute((next) => {
      if (value === "all") {
        next.delete("status");
      } else {
        next.set("status", value);
      }
      next.delete("agentId");
    });
  };

  // ── Derived state ──

  const matchedInstance = instances.find((i) => i.instance_id === instanceId);
  const currentInstanceLabel = matchedInstance
    ? `${matchedInstance.display_name} (${instanceId})`
    : instanceId || "Select instance";

  const operatorHiddenByFilter = Boolean(
    operatorAgent && statusFilter !== "all" && !agents.some((agent) => agent.is_default_operator),
  );

  const attentionItems: AttentionPayload[] = [];

  // Error as blocker
  if (error) {
    attentionItems.push({
      key: "error",
      level: "primary_blocker",
      title: "Error",
      description: error,
    });
  }

  // Message as informational
  if (message) {
    attentionItems.push({
      key: "message",
      level: "informational",
      title: message,
    });
  }

  // Status for data loading states (collapsed/diagnostic)
  if (instancesState === "error" || listState === "error" || detailState === "error") {
    attentionItems.push({
      key: "load_errors",
      level: "warning",
      title: "Some data failed to load",
    });
  }

  const actions: Action[] = [
    {
      label: "New agent",
      kind: "primary" as const,
      intent: "configure" as const,
      disabled: !canMutate,
      onClick: openCreateDrawer,
    },
  ];

  const detailStatusTone = detail
    ? agentStatusTone(detail.status)
    : ("neutral" as const);

  // ── Early returns for auth/session ──

  if (!sessionReady) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Agents"
        description="ForgeFrame is restoring instance-scoped agent truth."
        attentionItems={[
          { key: "session", level: "warning", title: "Checking access", description: "Session state is resolving." },
        ]}
      />
    );
  }

  if (!canRead) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Agents"
        description="This route is reserved for operators and admins who can inspect real agent truth."
        attentionItems={[
          {
            key: "permission",
            level: "primary_blocker",
            title: "Operator or admin required",
            description: "ForgeFrame does not render a cosmetic agent shell without real work-interaction access.",
          },
        ]}
      />
    );
  }

  // ── Main render ──

  return (
    <>
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Agents"
        description="Per-instance agent registry for the required Operator, specialized agents, participation posture, profile links, and conversation addressability."
        scope={{
          label: currentInstanceLabel,
          onChange:
            instances.length > 1
              ? () => {
                  const nextIdx = instances.findIndex((i) => i.instance_id === instanceId);
                  const next = instances[(nextIdx + 1) % instances.length];
                  if (next) handleInstanceChange(next.instance_id);
                }
              : undefined,
        }}
        attentionItems={attentionItems}
        summaryItems={[
          {
            key: "total",
            label: "Agents",
            value: agents.length,
            tone: agents.length > 0 ? "success" : "warning",
          },
          {
            key: "access",
            label: "Access",
            value: canMutate ? "Read/write" : "Read only",
            tone: canMutate ? "success" : "neutral",
          },
        ]}
        actions={actions}
        filterContent={
          <>
            <label className="flex items-center gap-2 text-sm text-muted">
              Instance
              <select
                className="bg-surface border border-border rounded px-2 py-1 text-sm text-primary"
                value={instanceId}
                onChange={(event) => handleInstanceChange(event.target.value)}
              >
                {instances.map((instance) => (
                  <option key={instance.instance_id} value={instance.instance_id}>
                    {instance.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              Status
              <select
                className="bg-surface border border-border rounded px-2 py-1 text-sm text-primary"
                value={statusFilter}
                onChange={(event) => handleStatusChange(event.target.value)}
              >
                {(["all", "active", "paused", "archived"] as const).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </>
        }
        hasSelection={detail != null}
        selectedItemContent={
          detail ? (
            <AgentDetailPanel
              detail={detail}
              instanceId={instanceId}
              detailState={detailState}
              canMutate={canMutate}
              agents={agents}
              archiveReplacement={archiveReplacement}
              archiveReason={archiveReason}
              savingArchive={savingArchive}
              setArchiveReplacement={setArchiveReplacement}
              setArchiveReason={setArchiveReason}
              onArchive={() => void handleArchive()}
              onOpenEdit={openEditDrawer}
            />
          ) : undefined
        }
        emptyDetailHint="Select an agent to inspect coordinator posture, profile links, and conversation effect."
        diagnostics={
          <AdvancedDiagnostics title="Agent diagnostics" defaultOpen={false}>
            <div className="fg-stack">
              <p className="text-meta text-muted">Internal state for debugging registry behavior.</p>
              <div className="fg-grid fg-grid-compact">
                <div><strong>instanceId:</strong> {instanceId || "—"}</div>
                <div><strong>selectedAgentId:</strong> {selectedAgentId || "—"}</div>
                <div><strong>statusFilter:</strong> {statusFilter}</div>
                <div><strong>listState:</strong> {listState}</div>
                <div><strong>detailState:</strong> {detailState}</div>
                <div><strong>instancesState:</strong> {instancesState}</div>
                <div><strong>operatorState:</strong> {operatorState}</div>
                <div><strong>canRead:</strong> {String(canRead)}</div>
                <div><strong>canMutate:</strong> {String(canMutate)}</div>
              </div>
              {detail ? (
                <RawJson data={detail} label="Current detail payload" />
              ) : null}
            </div>
          </AdvancedDiagnostics>
        }
      >
        <AgentList
          agents={agents}
          selectedAgentId={selectedAgentId}
          instanceId={instanceId}
          loading={listState === "loading"}
          error={listState === "error" ? error : null}
          onRowClick={handleAgentRowClick}
        />
      </RegistryManagementPage>

      {/* ── Operator section ── */}
      {operatorAgent ? (
        <section className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Required Operator</h3>
              <p className="fg-muted">{operatorAgent.display_name} is the coordinator / lead agent for this instance.</p>
            </div>
            <div className="fg-actions">
              <span className="fg-pill" data-tone={agentStatusTone(operatorAgent.status)}>
                {operatorAgent.status}
              </span>
              <span className="fg-pill" data-tone="success">Coordinator / lead Operator</span>
            </div>
          </div>
          <div className="fg-detail-grid">
            <span className="fg-muted">
              {participationLabel(operatorAgent.participation_mode)} · {operatorAgent.addressability_reason}
            </span>
            <span className="fg-muted">
              last activity {operatorAgent.last_activity_at ?? operatorAgent.updated_at ?? "Not recorded"}
            </span>
          </div>
          {operatorHiddenByFilter ? (
            <>
              <p className="fg-muted">The current status filter hides the active Operator. Switch back to `all` or `active` to inspect it in the registry table.</p>
              <div className="fg-actions">
                <Link className="fg-nav-link" to={`/conversations?instanceId=${instanceId}&agentId=${operatorAgent.agent_id}`}>
                  View Operator conversations
                </Link>
                <button
                  type="button"
                  className="ff-btn-secondary ff-btn-sm"
                  onClick={() => updateRoute((next) => {
                    next.delete("status");
                    next.set("agentId", operatorAgent.agent_id);
                  }, true)}
                >
                  Show Operator in table
                </button>
              </div>
            </>
          ) : (
            <div className="fg-actions">
                <Link className="fg-nav-link" to={`/conversations?instanceId=${instanceId}&agentId=${operatorAgent.agent_id}`}>
                  View Operator conversations
                </Link>
            </div>
          )}
        </section>
      ) : null}

      {operatorState === "success" && !operatorAgent ? (
        <section className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Operator missing</h3>
              <p className="fg-muted">This instance is missing its required Operator coordinator/lead agent. Reads do not auto-heal the defect.</p>
            </div>
            <span className="fg-pill" data-tone="danger">missing required operator</span>
          </div>
          <div className="fg-actions">
              <Link className="fg-nav-link" to={`/conversations?instanceId=${instanceId}`}>
                View conversations
              </Link>
              <button
                type="button"
                className="ff-btn-secondary ff-btn-sm"
                disabled={!canMutate || repairingOperator || !instanceId}
                onClick={() => void handleRestoreOperator()}
              >
                {repairingOperator ? "Restoring Operator" : "Restore required Operator"}
              </button>
          </div>
          <p className="fg-muted">The backend supports an explicit repair path. ForgeFrame does not silently create the Operator just because someone opened the registry.</p>
        </section>
      ) : null}

      {/* ── Create/edit drawer ── */}
      <AgentCreateFormComponent
        drawerMode={drawerMode}
        onClose={closeDrawer}
        createForm={createForm}
        setCreateForm={setCreateForm}
        editForm={editForm}
        setEditForm={setEditForm}
        savingCreate={savingCreate}
        savingUpdate={savingUpdate}
        canMutate={canMutate}
        instanceId={instanceId}
        hasDetail={detail != null}
        detailStatusTone={detailStatusTone}
        onSubmit={handleSubmitDrawerForm}
      />
    </>
  );
}
