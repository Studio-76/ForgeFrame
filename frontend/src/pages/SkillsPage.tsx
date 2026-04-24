import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  activateSkill,
  archiveSkill,
  createSkill,
  fetchAgents,
  fetchInstances,
  fetchSkillDetail,
  fetchSkills,
  recordSkillUsage,
  updateSkill,
  type AgentSummary,
  type SkillDetail,
  type SkillSummary,
  type SkillScope,
  type SkillStatus,
  type SkillUsageOutcome,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<SkillStatus | "all"> = ["all", "draft", "review", "active", "archived"];
const SCOPE_OPTIONS: Array<SkillScope | "all"> = ["all", "instance", "agent"];
const USAGE_OUTCOME_OPTIONS: SkillUsageOutcome[] = ["success", "blocked", "error"];

const DEFAULT_CREATE_FORM = {
  skillId: "",
  displayName: "",
  summary: "",
  scope: "instance" as SkillScope,
  scopeAgentId: "",
  status: "draft" as SkillStatus,
  instructionCore: "",
  provenanceJson: "{}",
  activationConditionsJson: "{}",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  displayName: "",
  summary: "",
  scope: "instance" as SkillScope,
  scopeAgentId: "",
  status: "draft" as SkillStatus,
  instructionCore: "",
  provenanceJson: "{}",
  activationConditionsJson: "{}",
  metadataJson: "{}",
};

const DEFAULT_USAGE_FORM = {
  versionId: "",
  activationId: "",
  agentId: "",
  runId: "",
  conversationId: "",
  outcome: "success" as SkillUsageOutcome,
  detailsJson: "{}",
};

export function SkillsPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const skillId = searchParams.get("skillId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as SkillStatus | "all" | "") || "all";
  const scopeFilter = (searchParams.get("scope")?.trim() as SkillScope | "all" | "") || "all";

  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [usageForm, setUsageForm] = useState(DEFAULT_USAGE_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingActivate, setSavingActivate] = useState(false);
  const [savingArchive, setSavingArchive] = useState(false);
  const [savingUsage, setSavingUsage] = useState(false);
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
          updateRoute((next) => next.set("instanceId", payload.instances[0].instance_id), true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Skill instance scope could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setAgents([]);
      return;
    }
    void fetchAgents(instanceId, { status: "active", limit: 100 }).then((payload) => setAgents(payload.agents)).catch(() => setAgents([]));
  }, [canRead, instanceId, refreshNonce]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setSkills([]);
      return;
    }
    let cancelled = false;
    setListState("loading");
    void fetchSkills(instanceId, { status: statusFilter, scope: scopeFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) return;
        setSkills(payload.skills);
        setListState("success");
        const nextSkillId = payload.skills.some((item) => item.skill_id === skillId) ? skillId : payload.skills[0]?.skill_id ?? "";
        if (nextSkillId !== skillId) {
          updateRoute((next) => {
            if (nextSkillId) next.set("skillId", nextSkillId);
            else next.delete("skillId");
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Skill inventory could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, skillId, statusFilter, scopeFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !skillId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailState("loading");
    void fetchSkillDetail(skillId, instanceId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.skill);
        setDetailState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Skill detail could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, skillId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setUsageForm(DEFAULT_USAGE_FORM);
      return;
    }
    setEditForm({
      displayName: detail.display_name,
      summary: detail.summary,
      scope: detail.scope,
      scopeAgentId: detail.scope_agent_id ?? "",
      status: detail.status,
      instructionCore: detail.instruction_core,
      provenanceJson: JSON.stringify(detail.provenance, null, 2),
      activationConditionsJson: JSON.stringify(detail.activation_conditions, null, 2),
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
    setUsageForm({
      versionId: detail.versions[0]?.version_id ?? "",
      activationId: detail.activations[0]?.activation_id ?? "",
      agentId: detail.scope_agent_id ?? "",
      runId: "",
      conversationId: "",
      outcome: "success",
      detailsJson: "{}",
    });
  }, [detail]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) return;
    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createSkill(instanceId, {
        skill_id: normalizeOptional(createForm.skillId),
        display_name: createForm.displayName.trim(),
        summary: createForm.summary.trim(),
        scope: createForm.scope,
        scope_agent_id: createForm.scope === "agent" ? normalizeOptional(createForm.scopeAgentId) : null,
        status: createForm.status,
        instruction_core: createForm.instructionCore.trim(),
        provenance: parseJsonObject(createForm.provenanceJson, "Skill provenance"),
        activation_conditions: parseJsonObject(createForm.activationConditionsJson, "Skill activation conditions"),
        metadata: parseJsonObject(createForm.metadataJson, "Skill metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      setMessage(`Skill ${payload.skill.skill_id} created.`);
      updateRoute((next) => next.set("skillId", payload.skill.skill_id));
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill creation failed.");
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
      const payload = await updateSkill(instanceId, detail.skill_id, {
        display_name: editForm.displayName.trim(),
        summary: editForm.summary.trim(),
        scope: editForm.scope,
        scope_agent_id: editForm.scope === "agent" ? normalizeOptional(editForm.scopeAgentId) : null,
        status: editForm.status,
        instruction_core: editForm.instructionCore.trim(),
        provenance: parseJsonObject(editForm.provenanceJson, "Skill provenance"),
        activation_conditions: parseJsonObject(editForm.activationConditionsJson, "Skill activation conditions"),
        metadata: parseJsonObject(editForm.metadataJson, "Skill metadata"),
      });
      setMessage(`Skill ${payload.skill.skill_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleActivate = async () => {
    if (!canMutate || !instanceId || !detail) return;
    setSavingActivate(true);
    setError("");
    setMessage("");
    try {
      const payload = await activateSkill(instanceId, detail.skill_id, {
        version_id: normalizeOptional(detail.versions[0]?.version_id ?? ""),
        scope: detail.scope,
        scope_agent_id: detail.scope === "agent" ? normalizeOptional(detail.scope_agent_id ?? "") : null,
        activation_conditions: detail.activation_conditions,
      });
      setMessage(`Skill ${payload.skill.skill_id} activated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill activation failed.");
    } finally {
      setSavingActivate(false);
    }
  };

  const handleArchive = async () => {
    if (!canMutate || !instanceId || !detail) return;
    setSavingArchive(true);
    setError("");
    setMessage("");
    try {
      const payload = await archiveSkill(instanceId, detail.skill_id);
      setMessage(`Skill ${payload.skill.skill_id} archived.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill archive failed.");
    } finally {
      setSavingArchive(false);
    }
  };

  const handleUsage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) return;
    setSavingUsage(true);
    setError("");
    setMessage("");
    try {
      const payload = await recordSkillUsage(instanceId, detail.skill_id, {
        version_id: normalizeOptional(usageForm.versionId),
        activation_id: normalizeOptional(usageForm.activationId),
        agent_id: normalizeOptional(usageForm.agentId),
        run_id: normalizeOptional(usageForm.runId),
        conversation_id: normalizeOptional(usageForm.conversationId),
        outcome: usageForm.outcome,
        details: parseJsonObject(usageForm.detailsJson, "Usage details"),
      });
      setMessage(`Usage recorded for skill ${payload.skill.skill_id}.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill usage recording failed.");
    } finally {
      setSavingUsage(false);
    }
  };

  if (!sessionReady) {
    return <section className="fg-page"><PageIntro eyebrow="Work Interaction" title="Skills" description="ForgeFrame is restoring the skills registry." question="Which skill surface should open once scope resolves?" links={[{ label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while session scope resolves." }]} badges={[{ label: "Checking access", tone: "neutral" }]} note="Skills stay versioned, activatable, and scoped." /></section>;
  }

  if (!canRead) {
    return <section className="fg-page"><PageIntro eyebrow="Work Interaction" title="Skills" description="This route is reserved for operators and admins who can inspect real skill truth." question="Which adjacent surface should remain open while skill access is outside the current permission envelope?" links={[{ label: "Learning", to: CONTROL_PLANE_ROUTES.learning, description: "Review learning suggestions without opening the skills registry." }]} badges={[{ label: "Operator or admin required", tone: "warning" }]} note="ForgeFrame does not render cosmetic skill state without scoped access." /></section>;
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Skills"
        description="Versioned skill registry with scope, provenance, activation conditions, and usage telemetry."
        question="Are skills explicit product objects with lifecycle and telemetry, or are they still hiding as undocumented prompt behavior?"
        links={[
          { label: "Agents", to: CONTROL_PLANE_ROUTES.agents, description: "Open the agent registry that scopes agent-bound skills." },
          { label: "Learning", to: CONTROL_PLANE_ROUTES.learning, description: "Review learning events that promote new skill drafts." },
        ]}
        badges={[
          { label: `${skills.length} skill${skills.length === 1 ? "" : "s"}`, tone: skills.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Every meaningful skill change should become a new version. Activation and usage stay visible."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-inline-form">
          <label>
            Instance
            <select value={instanceId} onChange={(event) => updateRoute((next) => { next.set("instanceId", event.target.value); next.delete("skillId"); })}>
              {instances.map((instance) => <option key={instance.instance_id} value={instance.instance_id}>{instance.display_name} ({instance.instance_id})</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => updateRoute((next) => { const value = event.target.value; if (value === "all") next.delete("status"); else next.set("status", value); })}>
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Scope
            <select value={scopeFilter} onChange={(event) => updateRoute((next) => { const value = event.target.value; if (value === "all") next.delete("scope"); else next.set("scope", value); })}>
              {SCOPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <span className="fg-pill" data-tone={instancesState === "success" && listState === "success" ? "success" : "neutral"}>
            {instancesState}/{listState}/{detailState}
          </span>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <h3>Skill inventory</h3>
          {skills.length === 0 ? <p className="fg-muted">No skills found for this instance.</p> : (
            <ul className="fg-list">
              {skills.map((skill) => (
                <li key={skill.skill_id}>
                  <button type="button" className="fg-linklike" onClick={() => updateRoute((next) => next.set("skillId", skill.skill_id))}>
                    {skill.display_name}
                  </button>
                  {" · "}{skill.status}{" · "}{skill.scope}{" · version "}{skill.current_version_number}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="fg-card">
          <h3>{detail ? `Skill ${detail.skill_id}` : "Skill detail"}</h3>
          {detail ? (
            <div className="fg-stack">
              <ul className="fg-list">
                <li>Status: {detail.status}</li>
                <li>Scope: {detail.scope}{detail.scope_agent ? ` · ${detail.scope_agent.label}` : ""}</li>
                <li>Current version: {detail.current_version_number}</li>
                <li>Active activations: {detail.active_activation_count}</li>
                <li>Last used at: {detail.last_used_at ?? "never"}</li>
              </ul>

              <article className="fg-subcard">
                <h4>Versions</h4>
                <ul className="fg-list">
                  {detail.versions.map((version) => <li key={version.version_id}>v{version.version_number} · {version.status} · {version.created_at}</li>)}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Activations</h4>
                <ul className="fg-list">
                  {detail.activations.length === 0 ? <li>No activations recorded.</li> : detail.activations.map((activation) => <li key={activation.activation_id}>{activation.status} · version {activation.version_id} · {activation.activated_at}</li>)}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Recent usage</h4>
                <ul className="fg-list">
                  {detail.recent_usage.length === 0 ? <li>No usage recorded.</li> : detail.recent_usage.map((usage) => <li key={usage.usage_event_id}>{usage.outcome} · {usage.created_at}</li>)}
                </ul>
              </article>

              <form className="fg-stack" onSubmit={handleUpdate}>
                <label>
                  Display name
                  <input value={editForm.displayName} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} />
                </label>
                <label>
                  Summary
                  <textarea rows={3} value={editForm.summary} onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} />
                </label>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Scope
                    <select value={editForm.scope} onChange={(event) => setEditForm((current) => ({ ...current, scope: event.target.value as SkillScope }))}>
                      {SCOPE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Scope agent
                    <select value={editForm.scopeAgentId} onChange={(event) => setEditForm((current) => ({ ...current, scopeAgentId: event.target.value }))}>
                      <option value="">none</option>
                      {agents.map((agent) => <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>)}
                    </select>
                  </label>
                  <label>
                    Status
                    <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as SkillStatus }))}>
                      {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  Instruction core
                  <textarea rows={6} value={editForm.instructionCore} onChange={(event) => setEditForm((current) => ({ ...current, instructionCore: event.target.value }))} />
                </label>
                <label>
                  Provenance JSON
                  <textarea rows={4} value={editForm.provenanceJson} onChange={(event) => setEditForm((current) => ({ ...current, provenanceJson: event.target.value }))} />
                </label>
                <label>
                  Activation conditions JSON
                  <textarea rows={4} value={editForm.activationConditionsJson} onChange={(event) => setEditForm((current) => ({ ...current, activationConditionsJson: event.target.value }))} />
                </label>
                <label>
                  Metadata JSON
                  <textarea rows={4} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingUpdate}>{savingUpdate ? "Saving skill" : "Save skill"}</button>
                  <button type="button" disabled={!canMutate || savingActivate} onClick={() => void handleActivate()}>{savingActivate ? "Activating" : "Activate current version"}</button>
                  <button type="button" disabled={!canMutate || savingArchive} onClick={() => void handleArchive()}>{savingArchive ? "Archiving" : "Archive skill"}</button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleUsage}>
                <h4>Record usage</h4>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Version
                    <select value={usageForm.versionId} onChange={(event) => setUsageForm((current) => ({ ...current, versionId: event.target.value }))}>
                      <option value="">current</option>
                      {detail.versions.map((version) => <option key={version.version_id} value={version.version_id}>v{version.version_number}</option>)}
                    </select>
                  </label>
                  <label>
                    Activation
                    <select value={usageForm.activationId} onChange={(event) => setUsageForm((current) => ({ ...current, activationId: event.target.value }))}>
                      <option value="">none</option>
                      {detail.activations.map((activation) => <option key={activation.activation_id} value={activation.activation_id}>{activation.status} · {activation.activation_id}</option>)}
                    </select>
                  </label>
                  <label>
                    Agent
                    <select value={usageForm.agentId} onChange={(event) => setUsageForm((current) => ({ ...current, agentId: event.target.value }))}>
                      <option value="">none</option>
                      {agents.map((agent) => <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Run ID
                    <input value={usageForm.runId} onChange={(event) => setUsageForm((current) => ({ ...current, runId: event.target.value }))} />
                  </label>
                  <label>
                    Conversation ID
                    <input value={usageForm.conversationId} onChange={(event) => setUsageForm((current) => ({ ...current, conversationId: event.target.value }))} />
                  </label>
                  <label>
                    Outcome
                    <select value={usageForm.outcome} onChange={(event) => setUsageForm((current) => ({ ...current, outcome: event.target.value as SkillUsageOutcome }))}>
                      {USAGE_OUTCOME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  Details JSON
                  <textarea rows={4} value={usageForm.detailsJson} onChange={(event) => setUsageForm((current) => ({ ...current, detailsJson: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingUsage}>{savingUsage ? "Recording usage" : "Record usage"}</button>
                </div>
              </form>
            </div>
          ) : <p className="fg-muted">Select a skill to inspect versions, activations, and usage.</p>}
        </article>
      </div>

      <article className="fg-card">
        <h3>Create skill</h3>
        <form className="fg-stack" onSubmit={handleCreate}>
          <div className="fg-grid fg-grid-compact">
            <label>
              Skill ID
              <input value={createForm.skillId} onChange={(event) => setCreateForm((current) => ({ ...current, skillId: event.target.value }))} placeholder="skill_pricing_review" />
            </label>
            <label>
              Display name
              <input value={createForm.displayName} onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))} />
            </label>
            <label>
              Status
              <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as SkillStatus }))}>
                {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Scope
              <select value={createForm.scope} onChange={(event) => setCreateForm((current) => ({ ...current, scope: event.target.value as SkillScope }))}>
                {SCOPE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Scope agent
              <select value={createForm.scopeAgentId} onChange={(event) => setCreateForm((current) => ({ ...current, scopeAgentId: event.target.value }))}>
                <option value="">none</option>
                {agents.map((agent) => <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>)}
              </select>
            </label>
          </div>
          <label>
            Summary
            <textarea rows={3} value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
          </label>
          <label>
            Instruction core
            <textarea rows={6} value={createForm.instructionCore} onChange={(event) => setCreateForm((current) => ({ ...current, instructionCore: event.target.value }))} />
          </label>
          <label>
            Provenance JSON
            <textarea rows={4} value={createForm.provenanceJson} onChange={(event) => setCreateForm((current) => ({ ...current, provenanceJson: event.target.value }))} />
          </label>
          <label>
            Activation conditions JSON
            <textarea rows={4} value={createForm.activationConditionsJson} onChange={(event) => setCreateForm((current) => ({ ...current, activationConditionsJson: event.target.value }))} />
          </label>
          <label>
            Metadata JSON
            <textarea rows={4} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
          </label>
          <div className="fg-actions">
            <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.displayName.trim() || !createForm.instructionCore.trim()}>
              {savingCreate ? "Creating skill" : "Create skill"}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
