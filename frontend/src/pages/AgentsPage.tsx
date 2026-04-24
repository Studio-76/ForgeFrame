import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

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
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<AgentStatus | "all"> = ["all", "active", "paused", "archived"];
const ROLE_OPTIONS: AgentRoleKind[] = ["operator", "specialist", "reviewer", "worker", "observer"];
const PARTICIPATION_OPTIONS: AgentParticipationMode[] = ["direct", "mentioned_only", "roundtable", "handoff_only"];

const DEFAULT_CREATE_FORM = {
  agentId: "",
  displayName: "",
  defaultName: "",
  roleKind: "specialist" as AgentRoleKind,
  status: "active" as AgentStatus,
  participationMode: "direct" as AgentParticipationMode,
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
  allowedTargets: "",
  isDefaultOperator: "no" as "yes" | "no",
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

function parseCsv(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function AgentsPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const agentId = searchParams.get("agentId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as AgentStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [agents, setAgents] = useState<AgentDetail[]>([]);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [archiveReplacement, setArchiveReplacement] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingArchive, setSavingArchive] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => setSearchParams(next, { replace }));
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
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent instance scope could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setAgents([]);
      setDetail(null);
      return;
    }
    let cancelled = false;
    setListState("loading");
    void fetchAgents(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) return;
        setAgents(payload.agents);
        setListState("success");
        setError("");
        const nextAgentId = payload.agents.some((item) => item.agent_id === agentId)
          ? agentId
          : payload.agents[0]?.agent_id ?? "";
        if (nextAgentId !== agentId) {
          updateRoute((next) => {
            if (nextAgentId) next.set("agentId", nextAgentId);
            else next.delete("agentId");
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Agent inventory could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, canRead, instanceId, refreshNonce, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !agentId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailState("loading");
    void fetchAgentDetail(agentId, instanceId)
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
    return () => {
      cancelled = true;
    };
  }, [agentId, canRead, instanceId, refreshNonce]);

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
      allowedTargets: detail.allowed_targets.join(", "),
      isDefaultOperator: detail.is_default_operator ? "yes" : "no",
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
    setArchiveReplacement("");
    setArchiveReason("");
  }, [detail]);

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
        allowed_targets: parseCsv(createForm.allowedTargets),
        is_default_operator: createForm.isDefaultOperator === "yes",
        metadata: parseJsonObject(createForm.metadataJson, "Agent metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
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
        allowed_targets: parseCsv(editForm.allowedTargets),
        is_default_operator: editForm.isDefaultOperator === "yes",
        metadata: parseJsonObject(editForm.metadataJson, "Agent metadata"),
      });
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
      setMessage(`Agent ${payload.agent.agent_id} archived.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Agent archive failed.");
    } finally {
      setSavingArchive(false);
    }
  };

  if (!sessionReady) {
    return <section className="fg-page"><PageIntro eyebrow="Work Interaction" title="Agents" description="ForgeFrame is restoring instance-scoped agent truth." question="Which agent registry should open once scope resolves?" links={[{ label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while session scope resolves." }]} badges={[{ label: "Checking access", tone: "neutral" }]} note="Agents stay instance-scoped and Operator must exist as a real record." /></section>;
  }

  if (!canRead) {
    return <section className="fg-page"><PageIntro eyebrow="Work Interaction" title="Agents" description="This route is reserved for operators and admins who can inspect real agent truth." question="Which adjacent surface should remain open while agent access is outside the current permission envelope?" links={[{ label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Inspect conversation truth without opening the agent registry." }]} badges={[{ label: "Operator or admin required", tone: "warning" }]} note="ForgeFrame does not render a cosmetic agent shell without real work-interaction access." /></section>;
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Agents"
        description="Instance-scoped agent registry with a mandatory Operator record, participation posture, and assistant-profile linkage."
        question="Is agent identity real enough to drive mentions, handoffs, learning, and routing scope, or is the product still faking it with roles and labels?"
        links={[
          { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Open conversation flows that reference these agents." },
          { label: "Skills", to: CONTROL_PLANE_ROUTES.skills, description: "Open agent-scoped skills bound to these agents." },
          { label: "Learning", to: CONTROL_PLANE_ROUTES.learning, description: "Review learning events that promote memory or skill drafts for agents." },
        ]}
        badges={[
          { label: `${agents.length} agent${agents.length === 1 ? "" : "s"}`, tone: agents.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="The default Operator is a hard product object. Archiving it requires an explicit replacement."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
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
                if (value === "all") next.delete("status");
                else next.set("status", value);
              })}
            >
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <span className="fg-pill" data-tone={instancesState === "success" && listState === "success" ? "success" : "neutral"}>
            {instancesState}/{listState}/{detailState}
          </span>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <h3>Agent inventory</h3>
          {agents.length === 0 ? <p className="fg-muted">No agents found for this instance.</p> : (
            <ul className="fg-list">
              {agents.map((agent) => (
                <li key={agent.agent_id}>
                  <button type="button" className="fg-linklike" onClick={() => updateRoute((next) => next.set("agentId", agent.agent_id))}>
                    {agent.display_name}
                  </button>
                  {" · "}{agent.role_kind}{" · "}{agent.status}
                  {agent.is_default_operator ? " · default Operator" : ""}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="fg-card">
          <h3>{detail ? `Agent ${detail.agent_id}` : "Agent detail"}</h3>
          {detail ? (
            <div className="fg-stack">
              <ul className="fg-list">
                <li>Display name: {detail.display_name}</li>
                <li>Default name: {detail.default_name}</li>
                <li>Role: {detail.role_kind}</li>
                <li>Status: {detail.status}</li>
                <li>Participation mode: {detail.participation_mode}</li>
                <li>Allowed targets: {detail.allowed_targets.length ? detail.allowed_targets.join(", ") : "none"}</li>
                <li>Assistant profile: {detail.assistant_profile?.label ?? "none"}</li>
              </ul>

              <form className="fg-stack" onSubmit={handleUpdate}>
                <label>
                  Display name
                  <input value={editForm.displayName} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} />
                </label>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Default name
                    <input value={editForm.defaultName} onChange={(event) => setEditForm((current) => ({ ...current, defaultName: event.target.value }))} />
                  </label>
                  <label>
                    Role
                    <select value={editForm.roleKind} onChange={(event) => setEditForm((current) => ({ ...current, roleKind: event.target.value as AgentRoleKind }))}>
                      {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Status
                    <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as AgentStatus }))}>
                      {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Participation mode
                    <select value={editForm.participationMode} onChange={(event) => setEditForm((current) => ({ ...current, participationMode: event.target.value as AgentParticipationMode }))}>
                      {PARTICIPATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Default Operator
                    <select value={editForm.isDefaultOperator} onChange={(event) => setEditForm((current) => ({ ...current, isDefaultOperator: event.target.value as "yes" | "no" }))}>
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  </label>
                </div>
                <label>
                  Allowed targets (CSV)
                  <input value={editForm.allowedTargets} onChange={(event) => setEditForm((current) => ({ ...current, allowedTargets: event.target.value }))} />
                </label>
                <label>
                  Metadata JSON
                  <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingUpdate}>{savingUpdate ? "Saving agent" : "Save agent"}</button>
                </div>
              </form>

              <div className="fg-stack">
                <h4>Archive agent</h4>
                <label>
                  Replacement agent
                  <select value={archiveReplacement} onChange={(event) => setArchiveReplacement(event.target.value)}>
                    <option value="">none</option>
                    {agents.filter((agent) => agent.agent_id !== detail.agent_id && agent.status !== "archived").map((agent) => (
                      <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name} ({agent.agent_id})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Archive reason
                  <input value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} />
                </label>
                <div className="fg-actions">
                  <button type="button" disabled={!canMutate || savingArchive} onClick={() => void handleArchive()}>
                    {savingArchive ? "Archiving agent" : "Archive agent"}
                  </button>
                </div>
              </div>
            </div>
          ) : <p className="fg-muted">Select an agent to inspect or mutate it.</p>}
        </article>
      </div>

      <article className="fg-card">
        <h3>Create agent</h3>
        <form className="fg-stack" onSubmit={handleCreate}>
          <div className="fg-grid fg-grid-compact">
            <label>
              Agent ID
              <input value={createForm.agentId} onChange={(event) => setCreateForm((current) => ({ ...current, agentId: event.target.value }))} placeholder="agent_pricing" />
            </label>
            <label>
              Display name
              <input value={createForm.displayName} onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))} />
            </label>
            <label>
              Default name
              <input value={createForm.defaultName} onChange={(event) => setCreateForm((current) => ({ ...current, defaultName: event.target.value }))} />
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Role
              <select value={createForm.roleKind} onChange={(event) => setCreateForm((current) => ({ ...current, roleKind: event.target.value as AgentRoleKind }))}>
                {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Status
              <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as AgentStatus }))}>
                {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Participation mode
              <select value={createForm.participationMode} onChange={(event) => setCreateForm((current) => ({ ...current, participationMode: event.target.value as AgentParticipationMode }))}>
                {PARTICIPATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Default Operator
              <select value={createForm.isDefaultOperator} onChange={(event) => setCreateForm((current) => ({ ...current, isDefaultOperator: event.target.value as "yes" | "no" }))}>
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
            </label>
          </div>
          <label>
            Allowed targets (CSV)
            <input value={createForm.allowedTargets} onChange={(event) => setCreateForm((current) => ({ ...current, allowedTargets: event.target.value }))} placeholder="target_alpha, target_beta" />
          </label>
          <label>
            Metadata JSON
            <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
          </label>
          <div className="fg-actions">
            <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.displayName.trim()}>
              {savingCreate ? "Creating agent" : "Create agent"}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
