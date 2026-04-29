import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  archiveAgent,
  createAgent,
  fetchAgentDetail,
  fetchAgents,
  fetchInstances,
  updateAgent,
  type AgentDetail,
  type AgentParticipationMode,
  type AgentRoleKind,
  type AgentStatus,
  type AgentSummary,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildAssistantProfilePath,
  buildConversationPath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

type DrawerMode = "closed" | "create" | "edit";

const STATUS_OPTIONS: Array<AgentStatus | "all"> = ["all", "active", "paused", "archived"];
const ROLE_OPTIONS: AgentRoleKind[] = ["operator", "specialist", "reviewer", "worker", "observer"];
const PARTICIPATION_OPTIONS: Array<{
  value: AgentParticipationMode;
  label: string;
  description: string;
}> = [
  {
    value: "direct",
    label: "assigned/owner",
    description: "Active participant and owner-capable conversation agent.",
  },
  {
    value: "mentioned_only",
    label: "mentioned-only",
    description: "Mention target only; not offered for ownership or handoff controls.",
  },
  {
    value: "roundtable",
    label: "broadcast participant",
    description: "Eligible for roundtable/broadcast participation and mentions.",
  },
  {
    value: "handoff_only",
    label: "handoff-only",
    description: "Only offered for handoff or blocker-owner routing.",
  },
];
const UNSUPPORTED_PARTICIPATION_MODES = ["silent", "subscribed"];
const DRAWER_FORM_ID = "agents-drawer-form";

const DEFAULT_CREATE_FORM = {
  agentId: "",
  displayName: "",
  defaultName: "",
  roleKind: "specialist" as AgentRoleKind,
  status: "active" as AgentStatus,
  participationMode: "direct" as AgentParticipationMode,
  assistantProfileId: "",
  allowedTargets: "",
  isDefaultOperator: "no" as "yes" | "no",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  displayName: "",
  defaultName: "",
  roleKind: "specialist" as AgentRoleKind,
  status: "active" as AgentStatus,
  participationMode: "direct" as AgentParticipationMode,
  assistantProfileId: "",
  allowedTargets: "",
  isDefaultOperator: "no" as "yes" | "no",
  metadataJson: "{}",
};

function agentStatusTone(status: AgentStatus): "success" | "warning" | "neutral" {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warning";
    case "archived":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

function participationLabel(mode: AgentParticipationMode): string {
  return PARTICIPATION_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function participationDescription(mode: AgentParticipationMode): string {
  return PARTICIPATION_OPTIONS.find((option) => option.value === mode)?.description ?? mode;
}

function addressabilityTone(addressable: boolean, status: AgentStatus): "success" | "warning" | "neutral" {
  if (!addressable && status === "paused") {
    return "warning";
  }
  return addressable ? "success" : "neutral";
}

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
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
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
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent instance scope could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
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
        if (cancelled) {
          return;
        }
        setOperatorAgent(payload.agents.find((item) => item.is_default_operator) ?? null);
        setOperatorState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setOperatorAgent(null);
        setOperatorState("error");
        setError(loadError instanceof Error ? loadError.message : "Required Operator truth could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
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
        if (cancelled) {
          return;
        }
        setAgents(payload.agents);
        setListState("success");
        setError("");
        syncSelectedAgentRoute(payload.agents);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent inventory could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
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
        if (cancelled) {
          return;
        }
        setDetail(payload.agent);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent detail could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
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

  const closeDrawer = () => {
    setDrawerMode("closed");
    setCreateForm(DEFAULT_CREATE_FORM);
  };

  const openCreateDrawer = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setDrawerMode("create");
  };

  const openEditDrawer = () => {
    if (!detail) {
      return;
    }
    setDrawerMode("edit");
  };

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

  const handleRestoreOperator = async () => {
    if (!canMutate || !instanceId) {
      return;
    }
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
    if (!canMutate || !instanceId) {
      return;
    }
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
    if (!canMutate || !instanceId || !detail) {
      return;
    }
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
    if (!canMutate || !instanceId || !detail) {
      return;
    }
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

  const operatorHiddenByFilter = Boolean(operatorAgent && statusFilter !== "all" && !agents.some((agent) => agent.is_default_operator));
  const drawerModeLabel = drawerMode === "create" ? "Create agent" : "Edit agent";
  const drawerStatus = drawerMode === "create" ? "secondary create path" : detail?.agent_id ?? "Select an agent";
  const drawerStatusTone = drawerMode === "create" ? "neutral" : detail ? agentStatusTone(detail.status) : "warning";

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Agents"
          description="ForgeFrame is restoring instance-scoped agent truth."
          question="Which agent registry should open once scope resolves?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while session scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Agents stay instance-scoped and the required Operator must exist as a real registry record."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Agents"
          description="This route is reserved for operators and admins who can inspect real agent truth."
          question="Which adjacent surface should remain open while agent access is outside the current permission envelope?"
          links={[
            { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Inspect conversation truth without opening the agent registry." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic agent shell without real work-interaction access."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Agents"
        description="Per-instance agent registry for the required Operator, specialized agents, participation posture, profile links, and conversation addressability."
        question="Can this instance actually route, mention, and govern real agents, or is agent identity still just decoration around conversations?"
        links={[
          { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Open live conversation routing that consumes these agent participation modes." },
          { label: "Assistant Profiles", to: CONTROL_PLANE_ROUTES.assistantProfiles, description: "Inspect the profiles linked to these agents." },
          { label: "Learning", to: CONTROL_PLANE_ROUTES.learning, description: "Review learning events that affect agent behavior." },
        ]}
        badges={[
          { label: `${agents.length} agent${agents.length === 1 ? "" : "s"}`, tone: agents.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="The Operator record is mandatory. Registry reads stay non-healing by default, so missing-Operator defects remain visible until a user triggers repair deliberately."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      {operatorAgent ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Required Operator</h3>
              <p className="fg-muted">{operatorAgent.display_name} is the coordinator / lead agent for this instance.</p>
            </div>
            <div className="fg-actions">
              <span className="fg-pill" data-tone={agentStatusTone(operatorAgent.status)}>{operatorAgent.status}</span>
              <span className="fg-pill" data-tone="success">Coordinator / lead Operator</span>
            </div>
          </div>
          <div className="fg-detail-grid">
            <span className="fg-muted">{participationLabel(operatorAgent.participation_mode)} · {operatorAgent.addressability_reason}</span>
            <span className="fg-muted">last activity {formatTimestamp(operatorAgent.last_activity_at, operatorAgent.updated_at)}</span>
          </div>
          {operatorHiddenByFilter ? (
            <>
              <p className="fg-muted">The current status filter hides the active Operator. Switch back to `all` or `active` to inspect it in the registry table.</p>
              <div className="fg-actions">
                <Link className="fg-nav-link" to={buildConversationPath({ instanceId, agentId: operatorAgent.agent_id })}>Open Operator conversations</Link>
                <button
                  type="button"
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
              <Link className="fg-nav-link" to={buildConversationPath({ instanceId, agentId: operatorAgent.agent_id })}>Open Operator conversations</Link>
            </div>
          )}
        </article>
      ) : null}

      {operatorState === "success" && !operatorAgent ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Operator missing</h3>
              <p className="fg-muted">This instance is missing its required Operator coordinator/lead agent. Reads do not auto-heal the defect.</p>
            </div>
            <span className="fg-pill" data-tone="danger">missing required operator</span>
          </div>
          <div className="fg-actions">
            <Link className="fg-nav-link" to={buildConversationPath({ instanceId })}>Open conversations</Link>
            <button type="button" disabled={!canMutate || repairingOperator || !instanceId} onClick={() => void handleRestoreOperator()}>
              {repairingOperator ? "Restoring Operator" : "Restore required Operator"}
            </button>
          </div>
          <p className="fg-muted">The backend supports an explicit repair path. ForgeFrame does not silently create the Operator just because someone opened the registry.</p>
        </article>
      ) : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary first, then constrain the registry by backend agent status.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" && listState === "success" ? "success" : "neutral"}>
            instances {instancesState} · list {listState} · detail {detailState}
          </span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("agentId");
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
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const value = event.target.value;
                if (value === "all") {
                  next.delete("status");
                } else {
                  next.set("status", value);
                }
                next.delete("agentId");
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
              <h3>Agent registry</h3>
              <p className="fg-muted">The table shows real instance agent objects, not generic UI roles.</p>
            </div>
            <div className="fg-actions">
              <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
              <button type="button" disabled={!canMutate} onClick={openCreateDrawer}>New agent</button>
            </div>
          </div>

          {agents.length === 0 ? <p className="fg-muted">No agents found for this instance.</p> : (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Agent registry">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role kind</th>
                    <th>Status</th>
                    <th>Participation mode</th>
                    <th>Profile</th>
                    <th>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.agent_id} className={agent.agent_id === selectedAgentId ? "is-selected" : undefined}>
                      <td>
                        <button
                          className="fg-table-trigger"
                          type="button"
                          onClick={() => updateRoute((next) => next.set("agentId", agent.agent_id))}
                        >
                          {agent.display_name}
                        </button>
                        <div className="fg-muted">
                          {agent.agent_id}
                          {agent.is_default_operator ? " · Coordinator / lead Operator" : ""}
                        </div>
                        <div className="fg-muted">
                          {agent.addressable_in_conversations ? "Addressable in conversations" : "Not addressable in live conversations"}
                        </div>
                      </td>
                      <td>{agent.role_kind}</td>
                      <td>
                        <span className="fg-pill" data-tone={agentStatusTone(agent.status)}>{agent.status}</span>
                      </td>
                      <td>
                        {participationLabel(agent.participation_mode)}
                        <div className="fg-muted">{agent.addressability_reason}</div>
                      </td>
                      <td>
                        {agent.assistant_profile_id ? (
                          <Link className="fg-nav-link" to={buildAssistantProfilePath({ instanceId, assistantProfileId: agent.assistant_profile_id })}>
                            {agent.assistant_profile_id}
                          </Link>
                        ) : "Not linked"}
                      </td>
                      <td>
                        {formatTimestamp(agent.last_activity_at, agent.updated_at)}
                        <div className="fg-muted">conversations {agent.conversation_count} · mentions {agent.mention_count}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Agent detail</h3>
              <p className="fg-muted">Coordinator posture, participation effect, profile linkage, and conversation addressability stay visible here.</p>
            </div>
            <div className="fg-actions">
              {detail ? <span className="fg-pill">{detail.agent_id}</span> : null}
              <button type="button" disabled={!canMutate || !detail} onClick={openEditDrawer}>Edit selected agent</button>
            </div>
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select an agent to inspect coordinator posture, profile links, and conversation effect.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading agent detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-actions">
                <span className="fg-pill" data-tone={detail.is_default_operator ? "success" : "neutral"}>{detail.is_default_operator ? "Coordinator / lead Operator" : detail.role_kind}</span>
                <span className="fg-pill" data-tone={agentStatusTone(detail.status)}>{detail.status}</span>
                <span className="fg-pill" data-tone={addressabilityTone(detail.addressable_in_conversations, detail.status)}>
                  {detail.addressable_in_conversations ? "conversation-addressable" : "not addressable"}
                </span>
                <span className="fg-pill">{participationLabel(detail.participation_mode)}</span>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Registry posture</h4>
                  <ul className="fg-list">
                    <li>Display name: {detail.display_name}</li>
                    <li>Default name: {detail.default_name}</li>
                    <li>Role kind: {detail.role_kind}</li>
                    <li>Required Operator: {detail.is_default_operator ? "yes" : "no"}</li>
                    <li>Last activity: {formatTimestamp(detail.last_activity_at, detail.updated_at)}</li>
                  </ul>
                </article>

                <article className="fg-subcard">
                  <h4>Conversation addressability</h4>
                  <ul className="fg-list">
                    <li>Addressable: {detail.addressable_in_conversations ? "yes" : "no"}</li>
                    <li>Reason: {detail.addressability_reason}</li>
                    <li>Conversation participation: {detail.conversation_count}</li>
                    <li>Mentions recorded: {detail.mention_count}</li>
                  </ul>
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={buildConversationPath({ instanceId, agentId: detail.agent_id })}>Open conversations</Link>
                  </div>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Profile and rights</h4>
                <ul className="fg-list">
                  <li>Assistant profile: {detail.assistant_profile ? detail.assistant_profile.label : detail.assistant_profile_id ?? "Not linked"}</li>
                  <li>Allowed targets: {detail.allowed_targets.length > 0 ? detail.allowed_targets.join(", ") : "none"}</li>
                  <li>Participation mode meaning: {participationDescription(detail.participation_mode)}</li>
                  <li>Unsupported backend modes: {UNSUPPORTED_PARTICIPATION_MODES.join(", ")}</li>
                </ul>
                <div className="fg-actions">
                  {detail.assistant_profile ? (
                    <Link className="fg-nav-link" to={buildAssistantProfilePath({ instanceId, assistantProfileId: detail.assistant_profile.record_id })}>
                      Open assistant profile
                    </Link>
                  ) : null}
                </div>
                <p className="fg-muted">ForgeFrame does not invent unsupported participation modes. `silent` and `subscribed` are displayed as backend gaps instead of being faked as writable values.</p>
              </article>

              <article className="fg-subcard">
                <h4>Archive and replacement</h4>
                <p className="fg-muted">Archiving the required Operator is blocked until another real agent is named as replacement.</p>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Replacement agent
                    <select value={archiveReplacement} onChange={(event) => setArchiveReplacement(event.target.value)}>
                      <option value="">none</option>
                      {agents
                        .filter((agent) => agent.agent_id !== detail.agent_id && agent.status !== "archived")
                        .map((agent) => (
                          <option key={agent.agent_id} value={agent.agent_id}>
                            {agent.display_name} ({agent.agent_id})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Archive reason
                    <input value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} />
                  </label>
                </div>
                <div className="fg-actions">
                  <button
                    type="button"
                    disabled={!canMutate || savingArchive || (detail.is_default_operator && !archiveReplacement)}
                    onClick={() => void handleArchive()}
                  >
                    {savingArchive ? "Archiving agent" : "Archive agent"}
                  </button>
                </div>
              </article>
            </div>
          ) : null}
        </article>
      </div>

      <DetailDrawer
        open={drawerMode !== "closed"}
        title={drawerModeLabel}
        description={drawerMode === "create"
          ? "Create remains available, but the registry now centers on real operator and participation truth."
          : "Adjust display name, participation posture, role, and profile linkage in a focused drawer."}
        status={drawerStatus}
        statusTone={drawerStatusTone}
        properties={[
          { label: "Supported participation", value: "assigned/owner, mentioned-only, broadcast participant, handoff-only" },
          { label: "Unsupported modes", value: UNSUPPORTED_PARTICIPATION_MODES.join(", ") },
          { label: "Conversation effect", value: "Conversations only offer agents where the participation mode actually permits the control." },
        ]}
        actions={(
          <>
            <button type="button" onClick={closeDrawer}>Cancel</button>
            <button
              type="submit"
              form={DRAWER_FORM_ID}
              disabled={!canMutate || (drawerMode === "create" ? savingCreate || !instanceId || !createForm.displayName.trim() : savingUpdate || !detail)}
            >
              {drawerMode === "create" ? (savingCreate ? "Creating agent" : "Create agent") : (savingUpdate ? "Saving agent" : "Save agent")}
            </button>
          </>
        )}
        onClose={closeDrawer}
      >
        <form id={DRAWER_FORM_ID} className="fg-stack" onSubmit={drawerMode === "create" ? handleCreate : handleUpdate}>
          <section className="fg-subcard">
            <h4>Identity</h4>
            <div className="fg-grid fg-grid-compact">
              {drawerMode === "create" ? (
                <label>
                  Agent ID
                  <input value={createForm.agentId} onChange={(event) => setCreateForm((current) => ({ ...current, agentId: event.target.value }))} placeholder="agent_pricing" />
                </label>
              ) : null}
              <label>
                Display name
                <input
                  value={drawerMode === "create" ? createForm.displayName : editForm.displayName}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, displayName: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, displayName: nextValue }));
                  }}
                />
              </label>
              <label>
                Default name
                <input
                  value={drawerMode === "create" ? createForm.defaultName : editForm.defaultName}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, defaultName: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, defaultName: nextValue }));
                  }}
                />
              </label>
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Role and participation</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Role kind
                <select
                  value={drawerMode === "create" ? createForm.roleKind : editForm.roleKind}
                  onChange={(event) => {
                    const nextValue = event.target.value as AgentRoleKind;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, roleKind: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, roleKind: nextValue }));
                  }}
                >
                  {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Status
                <select
                  value={drawerMode === "create" ? createForm.status : editForm.status}
                  onChange={(event) => {
                    const nextValue = event.target.value as AgentStatus;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, status: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, status: nextValue }));
                  }}
                >
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Default Operator
                <select
                  value={drawerMode === "create" ? createForm.isDefaultOperator : editForm.isDefaultOperator}
                  onChange={(event) => {
                    const nextValue = event.target.value as "yes" | "no";
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, isDefaultOperator: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, isDefaultOperator: nextValue }));
                  }}
                >
                  <option value="no">no</option>
                  <option value="yes">yes</option>
                </select>
              </label>
            </div>

            <label>
              Participation mode
              <select
                value={drawerMode === "create" ? createForm.participationMode : editForm.participationMode}
                onChange={(event) => {
                  const nextValue = event.target.value as AgentParticipationMode;
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, participationMode: nextValue }));
                    return;
                  }
                  setEditForm((current) => ({ ...current, participationMode: nextValue }));
                }}
              >
                {PARTICIPATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="fg-muted">Unsupported registry modes stay explicit: `silent` and `subscribed` are not persisted by the current backend and are therefore not shown as editable options.</p>
          </section>

          <section className="fg-subcard">
            <h4>Profile and routing</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Assistant profile ID
                <input
                  value={drawerMode === "create" ? createForm.assistantProfileId : editForm.assistantProfileId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, assistantProfileId: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, assistantProfileId: nextValue }));
                  }}
                />
              </label>
              <label>
                Allowed targets (CSV)
                <input
                  value={drawerMode === "create" ? createForm.allowedTargets : editForm.allowedTargets}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (drawerMode === "create") {
                      setCreateForm((current) => ({ ...current, allowedTargets: nextValue }));
                      return;
                    }
                    setEditForm((current) => ({ ...current, allowedTargets: nextValue }));
                  }}
                  placeholder="conversation, review"
                />
              </label>
            </div>
            <label>
              Metadata JSON
              <textarea
                rows={6}
                value={drawerMode === "create" ? createForm.metadataJson : editForm.metadataJson}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, metadataJson: nextValue }));
                    return;
                  }
                  setEditForm((current) => ({ ...current, metadataJson: nextValue }));
                }}
              />
            </label>
          </section>
        </form>
      </DetailDrawer>
    </section>
  );
}
