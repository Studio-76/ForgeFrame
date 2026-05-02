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
  type SkillScope,
  type SkillStatus,
  type SkillSummary,
} from "../../api/domain";
import { useAppSession } from "../../app/session";
import {
  getWorkInteractionAccess,
  normalizeOptional,
  parseJsonObject,
  type LoadState,
} from "../../pages/workInteractionPageSupport";
import {
  DEFAULT_ACTIVATION_FORM,
  DEFAULT_ACTIVATION_SETTINGS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  DEFAULT_PROVENANCE_FORM,
  DEFAULT_USAGE_FORM,
  type ActivationForm,
  type CreateSkillForm,
  type EditSkillForm,
  type UsageForm,
} from "./types";
import {
  buildActivationConditions,
  buildProvenancePayload,
  buildUsageDetails,
  normalizeText,
  splitActivationSettings,
  splitProvenanceForm,
  validateScopedAgent,
} from "./utils";

/**
 * Summary counts derived from the skills list.
 */
export interface SkillSummaryCounts {
  /** Total number of skills. */
  total: number;
  /** Number of draft skills. */
  draft: number;
  /** Number of skills pending review. */
  review: number;
  /** Number of active skills. */
  active: number;
  /** Number of archived skills. */
  archived: number;
  /** Number of skills needing attention (review-required posture). */
  attention: number;
}

/**
 * Return value of the `useSkills()` hook.
 */
export interface UseSkillsReturn {
  session: ReturnType<typeof useAppSession>["session"];
  sessionReady: boolean;
  canRead: boolean;
  canMutate: boolean;
  instanceId: string;
  skillId: string;
  statusFilter: string;
  scopeFilter: string;
  activeOnly: boolean;
  needsReview: boolean;
  instances: Array<{ instance_id: string; display_name: string }>;
  agents: AgentSummary[];
  skills: SkillSummary[];
  detail: SkillDetail | null;
  summaryCounts: SkillSummaryCounts;
  showCreateForm: boolean;
  instancesState: LoadState;
  listState: LoadState;
  detailState: LoadState;
  createForm: CreateSkillForm;
  editForm: EditSkillForm;
  activationForm: ActivationForm;
  usageForm: UsageForm;
  savingCreate: boolean;
  savingUpdate: boolean;
  savingActivate: boolean;
  savingArchive: boolean;
  savingUsage: boolean;
  error: string;
  message: string;
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleActivate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleArchive: () => Promise<void>;
  handleUsage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateSkillForm>>;
  setEditForm: React.Dispatch<React.SetStateAction<EditSkillForm>>;
  setActivationForm: React.Dispatch<React.SetStateAction<ActivationForm>>;
  setUsageForm: React.Dispatch<React.SetStateAction<UsageForm>>;
  setShowCreateForm: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Compute summary counts from the skills list.
 */
function computeSummaryCounts(skills: SkillSummary[]): SkillSummaryCounts {
  let draft = 0;
  let review = 0;
  let active = 0;
  let archived = 0;
  let attention = 0;

  for (const skill of skills) {
    if (skill.status === "draft") draft++;
    else if (skill.status === "review") review++;
    else if (skill.status === "active") active++;
    else if (skill.status === "archived") archived++;

    if (skill.approval.posture === "review_required") attention++;
  }

  return {
    total: skills.length,
    draft,
    review,
    active,
    archived,
    attention,
  };
}

/**
 * Master hook for the Skills page.
 *
 * Manages session access, URL state, data fetching, form state,
 * all CRUD handlers, and the create-form visibility toggle.
 */
export function useSkills(): UseSkillsReturn {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const skillId = searchParams.get("skillId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as SkillStatus | "all" | "") || "all";
  const scopeFilter = (searchParams.get("scope")?.trim() as SkillScope | "all" | "") || "all";
  const activeOnly = searchParams.get("activeOnly") === "1";
  const needsReview = searchParams.get("needsReview") === "1";

  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSkillForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditSkillForm>(DEFAULT_EDIT_FORM);
  const [activationForm, setActivationForm] = useState<ActivationForm>(DEFAULT_ACTIVATION_FORM);
  const [usageForm, setUsageForm] = useState<UsageForm>(DEFAULT_USAGE_FORM);
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

  // Fetch agents
  useEffect(() => {
    if (!canRead || !instanceId) {
      setAgents([]);
      return;
    }
    void fetchAgents(instanceId, { status: "active", limit: 100 })
      .then((payload) => setAgents(payload.agents))
      .catch(() => setAgents([]));
  }, [canRead, instanceId, refreshNonce]);

  // Fetch skills list
  useEffect(() => {
    if (!canRead || !instanceId) {
      setSkills([]);
      return;
    }
    let cancelled = false;
    setListState("loading");
    void fetchSkills(instanceId, {
      status: statusFilter as SkillStatus | "all",
      scope: scopeFilter as SkillScope | "all",
      limit: 100,
    })
      .then((payload) => {
        if (cancelled) return;
        let filtered = payload.skills;
        if (activeOnly) {
          filtered = filtered.filter((s) => s.status === "active");
        }
        if (needsReview) {
          filtered = filtered.filter((s) => s.approval.posture === "review_required");
        }
        setSkills(filtered);
        setListState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Skill inventory could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, scopeFilter, statusFilter, activeOnly, needsReview]);

  // Auto-select skill when skills list changes or selection becomes invalid
  useEffect(() => {
    if (!canRead || !instanceId) return;
    const nextSkillId = skills.some((item) => item.skill_id === skillId)
      ? skillId
      : skills[0]?.skill_id ?? "";
    if (nextSkillId !== skillId) {
      updateRoute((next) => {
        if (nextSkillId) {
          next.set("skillId", nextSkillId);
        } else {
          next.delete("skillId");
        }
      }, true);
    }
  }, [skills, skillId, canRead, instanceId]);

  // Fetch skill detail
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

  // Sync forms when detail changes
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
    if (!canMutate || !instanceId) return;
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
      setShowCreateForm(false);
      setMessage(`Skill "${payload.skill.display_name}" created as a draft.`);
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
      setMessage(`Skill "${payload.skill.display_name}" updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleActivate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) return;
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
      setMessage(`Skill activated with ${activationForm.scope === "agent" ? "agent" : "instance"} scope.`);
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
      setMessage(`Skill "${payload.skill.display_name}" archived. Versions and telemetry retained.`);
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
        details: buildUsageDetails(usageForm),
      });
      setMessage(`Usage recorded with outcome ${usageForm.outcome}.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill usage recording failed.");
    } finally {
      setSavingUsage(false);
    }
  };

  const summaryCounts = computeSummaryCounts(skills);

  return {
    session,
    sessionReady,
    canRead,
    canMutate,
    instanceId,
    skillId,
    statusFilter,
    scopeFilter,
    activeOnly,
    needsReview,
    instances,
    agents,
    skills,
    detail,
    summaryCounts,
    showCreateForm,
    instancesState,
    listState,
    detailState,
    createForm,
    editForm,
    activationForm,
    usageForm,
    savingCreate,
    savingUpdate,
    savingActivate,
    savingArchive,
    savingUsage,
    error,
    message,
    updateRoute,
    handleCreate,
    handleUpdate,
    handleActivate,
    handleArchive,
    handleUsage,
    setCreateForm,
    setEditForm,
    setActivationForm,
    setUsageForm,
    setShowCreateForm,
  };
}
