/**
 * Skills management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Skill types
// ---------------------------------------------------------------------------

/** Skill scope discriminator. */
export type SkillScope = "instance" | "agent";
/** Skill lifecycle status. */
export type SkillStatus = "draft" | "review" | "active" | "archived";
/** Skill activation status. */
export type SkillActivationStatus = "active" | "inactive" | "archived";
/** Skill usage outcome. */
export type SkillUsageOutcome = "success" | "blocked" | "error";
/** Skill approval posture. */
export type SkillApprovalPosture = "draft" | "review_required" | "approved" | "archived";
/** Skill provenance kind. */
export type SkillProvenanceKind = "operator" | "learning" | "memory" | "knowledge_source" | "plugin" | "unknown";

/** Approval summary for a skill. */
export type SkillApprovalSummary = {
  posture: SkillApprovalPosture;
  label: string;
  note: string;
};

/** Provenance summary for a skill. */
export type SkillProvenanceSummary = {
  kind: SkillProvenanceKind;
  label: string;
  detail?: string | null;
};

/** Telemetry summary for a skill. */
export type SkillTelemetrySummary = {
  usage_count: number;
  last_outcome?: SkillUsageOutcome | null;
  success_count: number;
  blocked_count: number;
  error_count: number;
};

/** Version record for a skill. */
export type SkillVersionRecord = {
  version_id: string;
  skill_id: string;
  instance_id: string;
  company_id: string;
  version_number: number;
  status: SkillStatus;
  summary: string;
  instruction_core: string;
  provenance: Record<string, unknown>;
  activation_conditions: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Activation record for a skill. */
export type SkillActivationRecord = {
  activation_id: string;
  skill_id: string;
  version_id: string;
  instance_id: string;
  company_id: string;
  scope: SkillScope;
  scope_label: string;
  scope_agent_id?: string | null;
  status: SkillActivationStatus;
  activation_conditions: Record<string, unknown>;
  activated_by_type: string;
  activated_by_id?: string | null;
  activated_at: string;
  deactivated_at?: string | null;
  metadata: Record<string, unknown>;
};

/** Usage event record for a skill. */
export type SkillUsageEventRecord = {
  usage_event_id: string;
  skill_id: string;
  version_id: string;
  version_number?: number | null;
  activation_id?: string | null;
  instance_id: string;
  company_id: string;
  agent_id?: string | null;
  run_id?: string | null;
  conversation_id?: string | null;
  outcome: SkillUsageOutcome;
  details: Record<string, unknown>;
  created_at: string;
};

/** Summary view of a skill. */
export type SkillSummary = {
  skill_id: string;
  instance_id: string;
  company_id: string;
  display_name: string;
  summary: string;
  scope: SkillScope;
  scope_label: string;
  scope_agent_id?: string | null;
  current_version_number: number;
  status: SkillStatus;
  approval: SkillApprovalSummary;
  provenance: Record<string, unknown>;
  provenance_summary: SkillProvenanceSummary;
  activation_conditions: Record<string, unknown>;
  instruction_core: string;
  telemetry: Record<string, unknown>;
  telemetry_summary: SkillTelemetrySummary;
  metadata: Record<string, unknown>;
  last_used_at?: string | null;
  active_activation_count: number;
  active_scope_labels: string[];
  last_outcome?: SkillUsageOutcome | null;
  created_at: string;
  updated_at: string;
};

/** Detailed skill view. */
export type SkillDetail = SkillSummary & {
  scope_agent?: import("./_internal").RecordLink | null;
  versions: SkillVersionRecord[];
  activations: SkillActivationRecord[];
  recent_usage: SkillUsageEventRecord[];
};

// ---------------------------------------------------------------------------
// Skill API functions
// ---------------------------------------------------------------------------

/**
 * Fetch skills for the given instance with optional filters.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, scope, limit).
 * @returns Response with skills list.
 */
export function fetchSkills(
  instanceId?: string | null,
  filters: {
    status?: SkillStatus | "all";
    scope?: SkillScope | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; skills: SkillSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/skills", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      scope: filters.scope && filters.scope !== "all" ? filters.scope : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch skill detail by ID.
 * @param skillId - The skill ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with skill detail.
 */
export function fetchSkillDetail(skillId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; skill: SkillDetail }>(
    appendTenantScope(`/admin/skills/${encodeURIComponent(skillId)}`, undefined, instanceId),
  );
}

/**
 * Create a new skill.
 * @param instanceId - The instance ID or null.
 * @param payload - Skill creation parameters.
 * @returns Response with the created skill.
 */
export function createSkill(
  instanceId: string | null | undefined,
  payload: {
    skill_id?: string | null;
    display_name: string;
    summary?: string;
    scope?: SkillScope;
    scope_agent_id?: string | null;
    status?: SkillStatus;
    provenance?: Record<string, unknown>;
    activation_conditions?: Record<string, unknown>;
    instruction_core: string;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; skill: SkillDetail }>(appendTenantScope("/admin/skills", undefined, instanceId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing skill.
 * @param instanceId - The instance ID or null.
 * @param skillId - The skill ID.
 * @param payload - Fields to update.
 * @returns Response with the updated skill.
 */
export function updateSkill(
  instanceId: string | null | undefined,
  skillId: string,
  payload: {
    display_name?: string;
    summary?: string;
    scope?: SkillScope | null;
    scope_agent_id?: string | null;
    status?: SkillStatus | null;
    provenance?: Record<string, unknown>;
    activation_conditions?: Record<string, unknown>;
    instruction_core?: string;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; skill: SkillDetail }>(
    appendTenantScope(`/admin/skills/${encodeURIComponent(skillId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Activate a skill.
 * @param instanceId - The instance ID or null.
 * @param skillId - The skill ID.
 * @param payload - Activation parameters.
 * @returns Response with the activated skill.
 */
export function activateSkill(
  instanceId: string | null | undefined,
  skillId: string,
  payload: {
    version_id?: string | null;
    scope?: SkillScope | null;
    scope_agent_id?: string | null;
    activation_conditions?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; skill: SkillDetail }>(
    appendTenantScope(`/admin/skills/${encodeURIComponent(skillId)}/activate`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Archive a skill.
 * @param instanceId - The instance ID or null.
 * @param skillId - The skill ID.
 * @returns Response with the archived skill.
 */
export function archiveSkill(instanceId: string | null | undefined, skillId: string) {
  return fetchJson<{ status: string; skill: SkillDetail }>(
    appendTenantScope(`/admin/skills/${encodeURIComponent(skillId)}/archive`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Record a skill usage event.
 * @param instanceId - The instance ID or null.
 * @param skillId - The skill ID.
 * @param payload - Usage event parameters.
 * @returns Response with the updated skill.
 */
export function recordSkillUsage(
  instanceId: string | null | undefined,
  skillId: string,
  payload: {
    version_id?: string | null;
    activation_id?: string | null;
    agent_id?: string | null;
    run_id?: string | null;
    conversation_id?: string | null;
    outcome: SkillUsageOutcome;
    details?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; skill: SkillDetail }>(
    appendTenantScope(`/admin/skills/${encodeURIComponent(skillId)}/usage-events`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
