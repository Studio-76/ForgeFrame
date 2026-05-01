import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

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
  type SkillActivationRecord,
  type SkillDetail,
  type SkillProvenanceKind,
  type SkillScope,
  type SkillStatus,
  type SkillSummary,
  type SkillUsageOutcome,
} from "../api/admin";
import { buildExecutionReviewPath } from "../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import {
  buildAgentsPath,
  buildConversationPath,
  buildKnowledgeSourcePath,
  buildLearningPath,
  buildMemoryPath,
} from "../app/workInteractionRoutes";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<SkillStatus | "all"> = ["all", "draft", "review", "active", "archived"];
const CREATE_STATUS_OPTIONS: SkillStatus[] = ["draft", "review"];
const MUTABLE_STATUS_OPTIONS: SkillStatus[] = ["draft", "review", "active"];
const SCOPE_OPTIONS: Array<SkillScope | "all"> = ["all", "instance", "agent"];
const USAGE_OUTCOME_OPTIONS: SkillUsageOutcome[] = ["success", "blocked", "error"];
const PROVENANCE_KIND_OPTIONS: SkillProvenanceKind[] = ["operator", "learning", "memory", "knowledge_source", "plugin", "unknown"];

const DEFAULT_PROVENANCE_FORM = {
  originKind: "operator" as SkillProvenanceKind,
  learningEventId: "",
  memoryId: "",
  sourceId: "",
  pluginName: "",
  note: "",
  extraJson: "{}",
};

const DEFAULT_ACTIVATION_SETTINGS = {
  previewRequired: false,
  channelHint: "",
  note: "",
  extraJson: "{}",
};

const DEFAULT_CREATE_FORM = {
  skillId: "",
  displayName: "",
  summary: "",
  scope: "instance" as SkillScope,
  scopeAgentId: "",
  status: "draft" as SkillStatus,
  instructionCore: "",
  provenance: DEFAULT_PROVENANCE_FORM,
  activationSettings: DEFAULT_ACTIVATION_SETTINGS,
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  displayName: "",
  summary: "",
  scope: "instance" as SkillScope,
  scopeAgentId: "",
  status: "draft" as SkillStatus,
  instructionCore: "",
  provenance: DEFAULT_PROVENANCE_FORM,
  activationSettings: DEFAULT_ACTIVATION_SETTINGS,
  metadataJson: "{}",
};

const DEFAULT_ACTIVATION_FORM = {
  versionId: "",
  scope: "instance" as SkillScope,
  scopeAgentId: "",
  settings: DEFAULT_ACTIVATION_SETTINGS,
  metadataJson: "{}",
};

const DEFAULT_USAGE_FORM = {
  versionId: "",
  activationId: "",
  agentId: "",
  runId: "",
  conversationId: "",
  outcome: "success" as SkillUsageOutcome,
  decision: "",
  note: "",
  detailsJson: "{}",
};

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

function normalizeText(value: string): string {
  return value.trim();
}

function buildInventoryPath(path: string, instanceId: string): string {
  if (!instanceId.trim()) {
    return path;
  }
  return `${path}?instanceId=${encodeURIComponent(instanceId.trim())}`;
}

function buildSkillPath(instanceId: string, skillId: string): string {
  const search = new URLSearchParams();
  if (instanceId.trim()) {
    search.set("instanceId", instanceId.trim());
  }
  search.set("skillId", skillId);
  return `${CONTROL_PLANE_ROUTES.skills}?${search.toString()}`;
}

function buildRunPath(instanceId: string, runId: string): string {
  return buildExecutionReviewPath({ instanceId, runId });
}

function statusTone(status: SkillStatus): "success" | "warning" | "danger" {
  if (status === "active") {
    return "success";
  }
  if (status === "archived") {
    return "danger";
  }
  return "warning";
}

function outcomeTone(outcome: SkillUsageOutcome | null | undefined): "success" | "warning" | "danger" | "neutral" {
  if (outcome === "success") {
    return "success";
  }
  if (outcome === "blocked") {
    return "warning";
  }
  if (outcome === "error") {
    return "danger";
  }
  return "neutral";
}

function provenanceTone(kind: SkillProvenanceKind): "success" | "warning" | "danger" | "neutral" {
  if (kind === "operator" || kind === "learning" || kind === "memory" || kind === "knowledge_source") {
    return "success";
  }
  if (kind === "plugin") {
    return "warning";
  }
  return "neutral";
}

function scopeNeedsAgent(scope: SkillScope): boolean {
  return scope === "agent";
}

function getLabeledAgent(agents: AgentSummary[], agentId: string | null | undefined): string | null {
  const match = agents.find((agent) => agent.agent_id === agentId);
  return match?.display_name ?? null;
}

function splitObject(value: Record<string, unknown>, handledKeys: string[]) {
  const extra: Record<string, unknown> = { ...value };
  for (const key of handledKeys) {
    delete extra[key];
  }
  return extra;
}

function splitProvenanceForm(provenance: Record<string, unknown>) {
  const learningEventId = typeof provenance.learning_event_id === "string" ? provenance.learning_event_id : "";
  const memoryId = typeof provenance.memory_id === "string" ? provenance.memory_id : "";
  const sourceId = typeof provenance.source_id === "string" ? provenance.source_id : "";
  const pluginName = typeof provenance.plugin_name === "string"
    ? provenance.plugin_name
    : typeof provenance.plugin_id === "string"
      ? provenance.plugin_id
      : "";
  const note = typeof provenance.note === "string" ? provenance.note : "";
  const source = typeof provenance.source === "string" ? provenance.source : "";

  let originKind: SkillProvenanceKind = "unknown";
  if (learningEventId) {
    originKind = "learning";
  } else if (memoryId) {
    originKind = "memory";
  } else if (sourceId) {
    originKind = "knowledge_source";
  } else if (pluginName) {
    originKind = "plugin";
  } else if (source === "operator") {
    originKind = "operator";
  }

  return {
    originKind,
    learningEventId,
    memoryId,
    sourceId,
    pluginName,
    note,
    extraJson: JSON.stringify(splitObject(provenance, ["learning_event_id", "memory_id", "source_id", "plugin_name", "plugin_id", "note", "source"]), null, 2),
  };
}

function buildProvenancePayload(form: typeof DEFAULT_PROVENANCE_FORM): Record<string, unknown> {
  const extra = parseJsonObject(form.extraJson, "Skill provenance extras");
  const payload: Record<string, unknown> = { ...extra };
  const note = normalizeOptional(form.note);
  if (note) {
    payload.note = note;
  }
  if (form.originKind === "operator") {
    payload.source = "operator";
  }
  if (form.originKind === "learning" && normalizeText(form.learningEventId)) {
    payload.learning_event_id = normalizeText(form.learningEventId);
  }
  if (form.originKind === "memory" && normalizeText(form.memoryId)) {
    payload.memory_id = normalizeText(form.memoryId);
  }
  if (form.originKind === "knowledge_source" && normalizeText(form.sourceId)) {
    payload.source_id = normalizeText(form.sourceId);
  }
  if (form.originKind === "plugin" && normalizeText(form.pluginName)) {
    payload.plugin_name = normalizeText(form.pluginName);
  }
  return payload;
}

function splitActivationSettings(conditions: Record<string, unknown>) {
  return {
    previewRequired: conditions.preview_required === true,
    channelHint: typeof conditions.channel === "string" ? conditions.channel : "",
    note: typeof conditions.note === "string" ? conditions.note : "",
    extraJson: JSON.stringify(splitObject(conditions, ["preview_required", "channel", "note"]), null, 2),
  };
}

function buildActivationConditions(settings: typeof DEFAULT_ACTIVATION_SETTINGS): Record<string, unknown> {
  const extra = parseJsonObject(settings.extraJson, "Skill activation extras");
  const payload: Record<string, unknown> = { ...extra };
  if (settings.previewRequired) {
    payload.preview_required = true;
  }
  if (normalizeText(settings.channelHint)) {
    payload.channel = normalizeText(settings.channelHint);
  }
  if (normalizeText(settings.note)) {
    payload.note = normalizeText(settings.note);
  }
  return payload;
}

function buildUsageDetails(form: typeof DEFAULT_USAGE_FORM): Record<string, unknown> {
  const extra = parseJsonObject(form.detailsJson, "Skill usage details");
  const payload: Record<string, unknown> = { ...extra };
  if (normalizeText(form.decision)) {
    payload.decision = normalizeText(form.decision);
  }
  if (normalizeText(form.note)) {
    payload.note = normalizeText(form.note);
  }
  return payload;
}

function validateScopedAgent(scope: SkillScope, scopeAgentId: string): string | null {
  if (scopeNeedsAgent(scope) && !normalizeText(scopeAgentId)) {
    return "Agent-scoped skills require a scope agent.";
  }
  return null;
}

function outcomeLabel(outcome: SkillUsageOutcome | null | undefined): string {
  return outcome ?? "none";
}

function activationLabel(activation: SkillActivationRecord): string {
  return `${activation.scope_label} · ${activation.status}`;
}

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
  const [activationForm, setActivationForm] = useState(DEFAULT_ACTIVATION_FORM);
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
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => next.set("instanceId", payload.instances[0].instance_id), true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
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
    void fetchAgents(instanceId, { status: "active", limit: 100 })
      .then((payload) => setAgents(payload.agents))
      .catch(() => setAgents([]));
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
        if (cancelled) {
          return;
        }
        setSkills(payload.skills);
        setListState("success");
        const nextSkillId = payload.skills.some((item) => item.skill_id === skillId) ? skillId : payload.skills[0]?.skill_id ?? "";
        if (nextSkillId !== skillId) {
          updateRoute((next) => {
            if (nextSkillId) {
              next.set("skillId", nextSkillId);
            } else {
              next.delete("skillId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Skill inventory could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, scopeFilter, skillId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !skillId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailState("loading");
    void fetchSkillDetail(skillId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.skill);
        setDetailState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
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
      setActivationForm(DEFAULT_ACTIVATION_FORM);
      setUsageForm(DEFAULT_USAGE_FORM);
      return;
    }
    const provenanceForm = splitProvenanceForm(detail.provenance);
    const activationSettings = splitActivationSettings(detail.activation_conditions);
    const latestActivation = detail.activations[0];

    setEditForm({
      displayName: detail.display_name,
      summary: detail.summary,
      scope: detail.scope,
      scopeAgentId: detail.scope_agent_id ?? "",
      status: detail.status,
      instructionCore: detail.instruction_core,
      provenance: provenanceForm,
      activationSettings,
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });

    setActivationForm({
      versionId: latestActivation?.version_id ?? detail.versions[0]?.version_id ?? "",
      scope: latestActivation?.scope ?? detail.scope,
      scopeAgentId: latestActivation?.scope_agent_id ?? detail.scope_agent_id ?? "",
      settings: latestActivation ? splitActivationSettings(latestActivation.activation_conditions) : activationSettings,
      metadataJson: JSON.stringify(latestActivation?.metadata ?? {}, null, 2),
    });

    setUsageForm({
      versionId: detail.versions[0]?.version_id ?? "",
      activationId: detail.activations[0]?.activation_id ?? "",
      agentId: detail.scope_agent_id ?? "",
      runId: "",
      conversationId: "",
      outcome: "success",
      decision: "",
      note: "",
      detailsJson: "{}",
    });
  }, [detail]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }
    const scopeError = validateScopedAgent(createForm.scope, createForm.scopeAgentId);
    if (scopeError) {
      setError(scopeError);
      return;
    }
    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createSkill(instanceId, {
        skill_id: normalizeOptional(createForm.skillId),
        display_name: normalizeText(createForm.displayName),
        summary: normalizeText(createForm.summary),
        scope: createForm.scope,
        scope_agent_id: createForm.scope === "agent" ? normalizeOptional(createForm.scopeAgentId) : null,
        status: createForm.status,
        instruction_core: normalizeText(createForm.instructionCore),
        provenance: buildProvenancePayload(createForm.provenance),
        activation_conditions: buildActivationConditions(createForm.activationSettings),
        metadata: parseJsonObject(createForm.metadataJson, "Skill metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      setMessage(`Skill ${payload.skill.skill_id} created as a registry entry.`);
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
    if (!canMutate || !instanceId || !detail) {
      return;
    }
    const scopeError = validateScopedAgent(editForm.scope, editForm.scopeAgentId);
    if (scopeError) {
      setError(scopeError);
      return;
    }
    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      const payload = await updateSkill(instanceId, detail.skill_id, {
        display_name: normalizeText(editForm.displayName),
        summary: normalizeText(editForm.summary),
        scope: editForm.scope,
        scope_agent_id: editForm.scope === "agent" ? normalizeOptional(editForm.scopeAgentId) : null,
        status: editForm.status,
        instruction_core: normalizeText(editForm.instructionCore),
        provenance: buildProvenancePayload(editForm.provenance),
        activation_conditions: buildActivationConditions(editForm.activationSettings),
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

  const handleActivate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }
    const scopeError = validateScopedAgent(activationForm.scope, activationForm.scopeAgentId);
    if (scopeError) {
      setError(scopeError);
      return;
    }
    setSavingActivate(true);
    setError("");
    setMessage("");
    try {
      const payload = await activateSkill(instanceId, detail.skill_id, {
        version_id: normalizeOptional(activationForm.versionId),
        scope: activationForm.scope,
        scope_agent_id: activationForm.scope === "agent" ? normalizeOptional(activationForm.scopeAgentId) : null,
        activation_conditions: buildActivationConditions(activationForm.settings),
        metadata: parseJsonObject(activationForm.metadataJson, "Activation metadata"),
      });
      setMessage(`Skill ${payload.skill.skill_id} activated with ${activationForm.scope === "agent" ? "agent" : "instance"} scope.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill activation failed.");
    } finally {
      setSavingActivate(false);
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
      const payload = await archiveSkill(instanceId, detail.skill_id);
      setMessage(`Skill ${payload.skill.skill_id} archived. Versions and telemetry were retained.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill archive failed.");
    } finally {
      setSavingArchive(false);
    }
  };

  const handleUsage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }
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
        details: buildUsageDetails(usageForm),
      });
      setMessage(`Usage recorded for skill ${payload.skill.skill_id} with outcome ${usageForm.outcome}.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill usage recording failed.");
    } finally {
      setSavingUsage(false);
    }
  };

  if (!sessionReady) {
    return <section className="fg-page"><PageIntro eyebrow="Work Interaction" title="Skills" description="Restoring skill registry scope." question="Open skill inventory when session access resolves." links={[{ label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to dashboard while access resolves." }]} badges={[{ label: "Checking access", tone: "neutral" }]} note="Skills remain versioned and scoped." /></section>;
  }

  if (!canRead) {
    return <section className="fg-page"><PageIntro eyebrow="Work Interaction" title="Skills" description="Skill data is available to operators and admins." question="Use Learning until skill access is available." links={[{ label: "Learning", to: CONTROL_PLANE_ROUTES.learning, description: "Review learning suggestions." }]} badges={[{ label: "Operator or admin required", tone: "warning" }]} note="No placeholder skill state is rendered without scoped access." /></section>;
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Skills"
        description="Manage versioned skills with scope, provenance, activation, and usage telemetry."
        question="Select a skill to review version, activation, and recent outcomes."
        links={[
          { label: "Learning", to: buildInventoryPath(CONTROL_PLANE_ROUTES.learning, instanceId), description: "Review learning events that can promote draft skills." },
          { label: "Agents", to: buildInventoryPath(CONTROL_PLANE_ROUTES.agents, instanceId), description: "Inspect agent inventory for agent-scoped skill activations." },
          { label: "Knowledge Sources", to: buildInventoryPath(CONTROL_PLANE_ROUTES.knowledgeSources, instanceId), description: "Inspect knowledge sources referenced by skill provenance." },
        ]}
        badges={[
          { label: `${skills.length} skill${skills.length === 1 ? "" : "s"}`, tone: skills.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Skills are registry records, not plugins or provider targets."
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
          <span className="fg-pill" data-tone={instancesState === "success" && listState === "success" ? "success" : listState === "error" || detailState === "error" ? "danger" : "neutral"}>
            {instancesState}/{listState}/{detailState}
          </span>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-section-heading">
            <div>
              <h3>Skill registry</h3>
              <p className="fg-muted">Version, approval, scope, activation, and recent outcomes.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {skills.length === 0 ? (
            <p className="fg-muted">No skills match this scope and filter.</p>
          ) : (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Skill registry">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Version</th>
                    <th>Status / Approval</th>
                    <th>Scope</th>
                    <th>Active in scope</th>
                    <th>Last used</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((skill) => (
                    <tr key={skill.skill_id}>
                      <td>
                        <button type="button" className="fg-table-trigger" onClick={() => updateRoute((next) => next.set("skillId", skill.skill_id))}>
                          {skill.display_name}
                        </button>
                        <div className="fg-muted">{skill.provenance_summary.label}</div>
                      </td>
                      <td>
                        <div>v{skill.current_version_number}</div>
                        <div className="fg-muted">{formatTimestamp(skill.updated_at)}</div>
                      </td>
                      <td>
                        <span className="fg-pill" data-tone={statusTone(skill.status)}>{skill.status}</span>
                        <div className="fg-muted">{skill.approval.label}</div>
                      </td>
                      <td>
                        <div>{skill.scope_label}</div>
                        <div className="fg-muted">{skill.active_activation_count} active</div>
                      </td>
                      <td>
                        <div>{skill.active_scope_labels[0] ?? "No active scope"}</div>
                        <div className="fg-muted">{skill.active_scope_labels.slice(1).join(" · ") || "No additional activations."}</div>
                      </td>
                      <td>
                        <div>{formatTimestamp(skill.last_used_at, "Never used")}</div>
                        <div className="fg-muted">{skill.telemetry_summary.usage_count} recorded uses</div>
                      </td>
                      <td>
                        <span className="fg-pill" data-tone={outcomeTone(skill.last_outcome)}>{outcomeLabel(skill.last_outcome)}</span>
                        <div className="fg-muted">{skill.telemetry_summary.success_count} success / {skill.telemetry_summary.blocked_count} blocked / {skill.telemetry_summary.error_count} error</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="fg-card">
          <div className="fg-section-heading">
            <div>
              <h3>{detail ? detail.display_name : "Skill detail"}</h3>
              <p className="fg-muted">{detail ? `Skill ${detail.skill_id}` : "Select a skill to inspect versions, activations, provenance, and telemetry."}</p>
            </div>
            {detail ? <span className="fg-pill">{detail.skill_id}</span> : null}
          </div>

          {detail ? (
            <div className="fg-stack">
              <div className="fg-inline-form">
                <span className="fg-pill" data-tone={statusTone(detail.status)}>{detail.status}</span>
                <span className="fg-pill" data-tone={provenanceTone(detail.provenance_summary.kind)}>{detail.provenance_summary.label}</span>
                <span className="fg-pill" data-tone={outcomeTone(detail.last_outcome)}>{outcomeLabel(detail.last_outcome)}</span>
                <span className="fg-pill">{detail.scope_label}</span>
              </div>

              <article className="fg-subcard">
                <h4>Registry overview</h4>
                <div className="fg-grid fg-grid-compact">
                  <div>
                    <strong>Approval posture</strong>
                    <p>{detail.approval.label}</p>
                    <p className="fg-muted">{detail.approval.note}</p>
                  </div>
                  <div>
                    <strong>Scope</strong>
                    <p>{detail.scope_label}</p>
                    <p className="fg-muted">{detail.scope_agent?.label ?? "No agent pin."}</p>
                  </div>
                  <div>
                    <strong>Telemetry</strong>
                    <p>{detail.telemetry_summary.usage_count} recorded uses</p>
                    <p className="fg-muted">Last outcome: {outcomeLabel(detail.telemetry_summary.last_outcome)}</p>
                  </div>
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Provenance and boundaries</h4>
                <p>{detail.provenance_summary.label}</p>
                <p className="fg-muted">{detail.provenance_summary.detail ?? "No additional provenance note was recorded."}</p>
                <p className="fg-muted">
                  {detail.provenance_summary.kind === "plugin"
                    ? "This skill is plugin-managed provenance, but still remains a registry object with versions, activations, and telemetry."
                    : "This skill is distinct from plugins, harness runs, and provider targets. Those surfaces may reference the skill, but they do not replace the skill registry."}
                </p>
                <div className="fg-actions">
                  {typeof detail.provenance.learning_event_id === "string" ? <Link className="fg-nav-link" to={buildLearningPath({ instanceId, eventId: detail.provenance.learning_event_id })}>Open learning event</Link> : null}
                  {typeof detail.provenance.memory_id === "string" ? <Link className="fg-nav-link" to={buildMemoryPath({ instanceId, memoryId: detail.provenance.memory_id })}>Open source memory</Link> : null}
                  {typeof detail.provenance.source_id === "string" ? <Link className="fg-nav-link" to={buildKnowledgeSourcePath({ instanceId, sourceId: detail.provenance.source_id })}>Open knowledge source</Link> : null}
                  {detail.scope_agent ? <Link className="fg-nav-link" to={buildAgentsPath({ instanceId, agentId: detail.scope_agent.record_id })}>Open scope agent</Link> : null}
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Versions</h4>
                <div className="fg-table-wrap">
                  <table className="fg-table" aria-label="Skill versions">
                    <thead>
                      <tr>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Summary</th>
                        <th>Provenance</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.versions.map((version) => (
                        <tr key={version.version_id}>
                          <td>v{version.version_number}</td>
                          <td><span className="fg-pill" data-tone={statusTone(version.status)}>{version.status}</span></td>
                          <td>{version.summary}</td>
                          <td>{typeof version.provenance.learning_event_id === "string" ? `learning ${version.provenance.learning_event_id}` : typeof version.provenance.memory_id === "string" ? `memory ${version.provenance.memory_id}` : typeof version.provenance.source_id === "string" ? `source ${version.provenance.source_id}` : typeof version.provenance.source === "string" ? String(version.provenance.source) : "registry"}</td>
                          <td>{formatTimestamp(version.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Activations</h4>
                <div className="fg-table-wrap">
                  <table className="fg-table" aria-label="Skill activations">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Scope</th>
                        <th>Version</th>
                        <th>Activated</th>
                        <th>Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.activations.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No activations recorded.</td>
                        </tr>
                      ) : detail.activations.map((activation) => (
                        <tr key={activation.activation_id}>
                          <td><span className="fg-pill" data-tone={activation.status === "active" ? "success" : activation.status === "inactive" ? "warning" : "danger"}>{activation.status}</span></td>
                          <td>{activation.scope_label}</td>
                          <td>{activation.version_id}</td>
                          <td>{formatTimestamp(activation.activated_at)}</td>
                          <td>{activation.activated_by_type}{activation.activated_by_id ? ` · ${activation.activated_by_id}` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Usage telemetry</h4>
                <div className="fg-grid fg-grid-compact">
                  <div>
                    <strong>Usage count</strong>
                    <p>{detail.telemetry_summary.usage_count}</p>
                  </div>
                  <div>
                    <strong>Last outcome</strong>
                    <p>{outcomeLabel(detail.telemetry_summary.last_outcome)}</p>
                  </div>
                  <div>
                    <strong>Outcome mix</strong>
                    <p>{detail.telemetry_summary.success_count} success / {detail.telemetry_summary.blocked_count} blocked / {detail.telemetry_summary.error_count} error</p>
                  </div>
                </div>
                <div className="fg-table-wrap">
                  <table className="fg-table" aria-label="Recent skill usage">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Version</th>
                        <th>Outcome</th>
                        <th>Run / conversation</th>
                        <th>Agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.recent_usage.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No usage recorded.</td>
                        </tr>
                      ) : detail.recent_usage.map((usage) => (
                        <tr key={usage.usage_event_id}>
                          <td>{formatTimestamp(usage.created_at)}</td>
                          <td>v{usage.version_number ?? "?"}</td>
                          <td><span className="fg-pill" data-tone={outcomeTone(usage.outcome)}>{usage.outcome}</span></td>
                          <td>
                            {usage.run_id ? <Link to={buildRunPath(instanceId, usage.run_id)}>run {usage.run_id}</Link> : "no run"}
                            {usage.conversation_id ? <><br /><Link to={buildConversationPath({ instanceId, conversationId: usage.conversation_id })}>conversation {usage.conversation_id}</Link></> : null}
                          </td>
                          <td>{getLabeledAgent(agents, usage.agent_id) ?? usage.agent_id ?? "none"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <form className="fg-stack" onSubmit={handleUpdate}>
                <article className="fg-subcard">
                  <h4>Update registry entry</h4>
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Display name
                      <input value={editForm.displayName} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} />
                    </label>
                    <label>
                      Status
                      <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as SkillStatus }))}>
                        {MUTABLE_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label>
                      Scope
                      <select value={editForm.scope} onChange={(event) => setEditForm((current) => ({ ...current, scope: event.target.value as SkillScope }))}>
                        {SCOPE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Scope agent
                      <select value={editForm.scopeAgentId} onChange={(event) => setEditForm((current) => ({ ...current, scopeAgentId: event.target.value }))}>
                        <option value="">none</option>
                        {agents.map((agent) => <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>)}
                      </select>
                    </label>
                    <label>
                      Summary
                      <textarea rows={3} value={editForm.summary} onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} />
                    </label>
                  </div>
                  <label>
                    Instruction core
                    <textarea rows={6} value={editForm.instructionCore} onChange={(event) => setEditForm((current) => ({ ...current, instructionCore: event.target.value }))} />
                  </label>
                </article>

                <article className="fg-subcard">
                  <h4>Provenance</h4>
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Origin
                      <select value={editForm.provenance.originKind} onChange={(event) => setEditForm((current) => ({ ...current, provenance: { ...current.provenance, originKind: event.target.value as SkillProvenanceKind } }))}>
                        {PROVENANCE_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label>
                      Learning event ID
                      <input value={editForm.provenance.learningEventId} onChange={(event) => setEditForm((current) => ({ ...current, provenance: { ...current.provenance, learningEventId: event.target.value } }))} />
                    </label>
                    <label>
                      Memory ID
                      <input value={editForm.provenance.memoryId} onChange={(event) => setEditForm((current) => ({ ...current, provenance: { ...current.provenance, memoryId: event.target.value } }))} />
                    </label>
                  </div>
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Source ID
                      <input value={editForm.provenance.sourceId} onChange={(event) => setEditForm((current) => ({ ...current, provenance: { ...current.provenance, sourceId: event.target.value } }))} />
                    </label>
                    <label>
                      Plugin name
                      <input value={editForm.provenance.pluginName} onChange={(event) => setEditForm((current) => ({ ...current, provenance: { ...current.provenance, pluginName: event.target.value } }))} />
                    </label>
                    <label>
                      Note
                      <input value={editForm.provenance.note} onChange={(event) => setEditForm((current) => ({ ...current, provenance: { ...current.provenance, note: event.target.value } }))} />
                    </label>
                  </div>
                  <details>
                    <summary>Additional provenance JSON</summary>
                    <textarea rows={6} value={editForm.provenance.extraJson} onChange={(event) => setEditForm((current) => ({ ...current, provenance: { ...current.provenance, extraJson: event.target.value } }))} />
                  </details>
                </article>

                <article className="fg-subcard">
                  <h4>Default activation posture</h4>
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Preview required
                      <select value={editForm.activationSettings.previewRequired ? "yes" : "no"} onChange={(event) => setEditForm((current) => ({ ...current, activationSettings: { ...current.activationSettings, previewRequired: event.target.value === "yes" } }))}>
                        <option value="no">no</option>
                        <option value="yes">yes</option>
                      </select>
                    </label>
                    <label>
                      Channel hint
                      <input value={editForm.activationSettings.channelHint} onChange={(event) => setEditForm((current) => ({ ...current, activationSettings: { ...current.activationSettings, channelHint: event.target.value } }))} />
                    </label>
                    <label>
                      Activation note
                      <input value={editForm.activationSettings.note} onChange={(event) => setEditForm((current) => ({ ...current, activationSettings: { ...current.activationSettings, note: event.target.value } }))} />
                    </label>
                  </div>
                  <details>
                    <summary>Additional activation JSON</summary>
                    <textarea rows={6} value={editForm.activationSettings.extraJson} onChange={(event) => setEditForm((current) => ({ ...current, activationSettings: { ...current.activationSettings, extraJson: event.target.value } }))} />
                  </details>
                </article>

                <details>
                  <summary>Metadata JSON</summary>
                  <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                </details>

                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingUpdate}>{savingUpdate ? "Saving skill" : "Save registry entry"}</button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleActivate}>
                <article className="fg-subcard">
                  <h4>Activate version</h4>
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Version
                      <select value={activationForm.versionId} onChange={(event) => setActivationForm((current) => ({ ...current, versionId: event.target.value }))}>
                        {detail.versions.map((version) => <option key={version.version_id} value={version.version_id}>v{version.version_number} · {version.status}</option>)}
                      </select>
                    </label>
                    <label>
                      Scope
                      <select value={activationForm.scope} onChange={(event) => setActivationForm((current) => ({ ...current, scope: event.target.value as SkillScope }))}>
                        {SCOPE_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label>
                      Scope agent
                      <select value={activationForm.scopeAgentId} onChange={(event) => setActivationForm((current) => ({ ...current, scopeAgentId: event.target.value }))}>
                        <option value="">none</option>
                        {agents.map((agent) => <option key={agent.agent_id} value={agent.agent_id}>{agent.display_name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Preview required
                      <select value={activationForm.settings.previewRequired ? "yes" : "no"} onChange={(event) => setActivationForm((current) => ({ ...current, settings: { ...current.settings, previewRequired: event.target.value === "yes" } }))}>
                        <option value="no">no</option>
                        <option value="yes">yes</option>
                      </select>
                    </label>
                    <label>
                      Channel hint
                      <input value={activationForm.settings.channelHint} onChange={(event) => setActivationForm((current) => ({ ...current, settings: { ...current.settings, channelHint: event.target.value } }))} />
                    </label>
                    <label>
                      Activation note
                      <input value={activationForm.settings.note} onChange={(event) => setActivationForm((current) => ({ ...current, settings: { ...current.settings, note: event.target.value } }))} />
                    </label>
                  </div>
                  <details>
                    <summary>Additional activation metadata</summary>
                    <textarea rows={5} value={activationForm.metadataJson} onChange={(event) => setActivationForm((current) => ({ ...current, metadataJson: event.target.value }))} />
                    <textarea rows={5} value={activationForm.settings.extraJson} onChange={(event) => setActivationForm((current) => ({ ...current, settings: { ...current.settings, extraJson: event.target.value } }))} />
                  </details>
                </article>

                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingActivate}>{savingActivate ? "Activating" : "Activate skill version"}</button>
                  <button type="button" disabled={!canMutate || savingArchive} onClick={() => void handleArchive()}>{savingArchive ? "Archiving" : "Archive skill"}</button>
                </div>
                <p className="fg-muted">Archiving keeps versions, activations, and usage telemetry. It is not a delete action.</p>
              </form>

              <form className="fg-stack" onSubmit={handleUsage}>
                <article className="fg-subcard">
                  <h4>Record usage telemetry</h4>
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
                        {detail.activations.map((activation) => <option key={activation.activation_id} value={activation.activation_id}>{activationLabel(activation)}</option>)}
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
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Decision
                      <input value={usageForm.decision} onChange={(event) => setUsageForm((current) => ({ ...current, decision: event.target.value }))} placeholder="allow / block / escalate" />
                    </label>
                    <label>
                      Usage note
                      <input value={usageForm.note} onChange={(event) => setUsageForm((current) => ({ ...current, note: event.target.value }))} />
                    </label>
                  </div>
                  <details>
                    <summary>Additional usage details JSON</summary>
                    <textarea rows={5} value={usageForm.detailsJson} onChange={(event) => setUsageForm((current) => ({ ...current, detailsJson: event.target.value }))} />
                  </details>
                </article>

                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingUsage}>{savingUsage ? "Recording usage" : "Record usage"}</button>
                </div>
              </form>
            </div>
          ) : <p className="fg-muted">Select a skill to inspect versions, activations, provenance, approval posture, and telemetry.</p>}
        </article>
      </div>

      <article className="fg-card">
        <h3>Create skill registry entry</h3>
        <p className="fg-muted">Create a draft or review-stage registry object. Activation is a separate explicit step, so creation does not silently make the skill live.</p>
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
                {CREATE_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
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

          <section className="fg-subcard">
            <h4>Provenance</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Origin
                <select value={createForm.provenance.originKind} onChange={(event) => setCreateForm((current) => ({ ...current, provenance: { ...current.provenance, originKind: event.target.value as SkillProvenanceKind } }))}>
                  {PROVENANCE_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Learning event ID
                <input value={createForm.provenance.learningEventId} onChange={(event) => setCreateForm((current) => ({ ...current, provenance: { ...current.provenance, learningEventId: event.target.value } }))} />
              </label>
              <label>
                Memory ID
                <input value={createForm.provenance.memoryId} onChange={(event) => setCreateForm((current) => ({ ...current, provenance: { ...current.provenance, memoryId: event.target.value } }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Source ID
                <input value={createForm.provenance.sourceId} onChange={(event) => setCreateForm((current) => ({ ...current, provenance: { ...current.provenance, sourceId: event.target.value } }))} />
              </label>
              <label>
                Plugin name
                <input value={createForm.provenance.pluginName} onChange={(event) => setCreateForm((current) => ({ ...current, provenance: { ...current.provenance, pluginName: event.target.value } }))} />
              </label>
              <label>
                Note
                <input value={createForm.provenance.note} onChange={(event) => setCreateForm((current) => ({ ...current, provenance: { ...current.provenance, note: event.target.value } }))} />
              </label>
            </div>
            <details>
              <summary>Additional provenance JSON</summary>
              <textarea rows={6} value={createForm.provenance.extraJson} onChange={(event) => setCreateForm((current) => ({ ...current, provenance: { ...current.provenance, extraJson: event.target.value } }))} />
            </details>
          </section>

          <section className="fg-subcard">
            <h4>Default activation posture</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Preview required
                <select value={createForm.activationSettings.previewRequired ? "yes" : "no"} onChange={(event) => setCreateForm((current) => ({ ...current, activationSettings: { ...current.activationSettings, previewRequired: event.target.value === "yes" } }))}>
                  <option value="no">no</option>
                  <option value="yes">yes</option>
                </select>
              </label>
              <label>
                Channel hint
                <input value={createForm.activationSettings.channelHint} onChange={(event) => setCreateForm((current) => ({ ...current, activationSettings: { ...current.activationSettings, channelHint: event.target.value } }))} />
              </label>
              <label>
                Activation note
                <input value={createForm.activationSettings.note} onChange={(event) => setCreateForm((current) => ({ ...current, activationSettings: { ...current.activationSettings, note: event.target.value } }))} />
              </label>
            </div>
            <details>
              <summary>Additional activation JSON</summary>
              <textarea rows={6} value={createForm.activationSettings.extraJson} onChange={(event) => setCreateForm((current) => ({ ...current, activationSettings: { ...current.activationSettings, extraJson: event.target.value } }))} />
            </details>
          </section>

          <details>
            <summary>Metadata JSON</summary>
            <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
          </details>

          <div className="fg-actions">
            <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !normalizeText(createForm.displayName) || !normalizeText(createForm.instructionCore)}>
              {savingCreate ? "Creating skill" : "Create registry entry"}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
