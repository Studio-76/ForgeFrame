/**
 * Agent management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  type AgentRoleKind,
  type AgentStatus,
  type AgentParticipationMode,
  type AgentSummary,
  type AgentDetail,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Agent API functions
// ---------------------------------------------------------------------------

/**
 * Fetch agents for the given instance with optional filters.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, limit, ensureDefaultOperator).
 * @returns Response with agents list.
 */
export function fetchAgents(
  instanceId?: string | null,
  filters: {
    status?: AgentStatus | "all";
    limit?: number;
    ensureDefaultOperator?: boolean;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; agents: AgentSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/agents", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      limit: filters.limit ?? 100,
      ensureDefaultOperator:
        filters.ensureDefaultOperator === true
          ? "true"
          : filters.ensureDefaultOperator === false
            ? "false"
            : null,
    }),
  );
}

/**
 * Fetch agent detail by ID.
 * @param agentId - The agent ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with agent detail.
 */
export function fetchAgentDetail(agentId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; agent: AgentDetail }>(
    appendTenantScope(`/admin/agents/${encodeURIComponent(agentId)}`, undefined, instanceId),
  );
}

/**
 * Create a new agent.
 * @param instanceId - The instance ID or null.
 * @param payload - Agent creation parameters.
 * @returns Response with the created agent.
 */
export function createAgent(
  instanceId: string | null | undefined,
  payload: {
    agent_id?: string | null;
    display_name: string;
    default_name?: string | null;
    role_kind?: AgentRoleKind;
    status?: AgentStatus;
    participation_mode?: AgentParticipationMode;
    allowed_targets?: string[];
    assistant_profile_id?: string | null;
    is_default_operator?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; agent: AgentDetail }>(appendTenantScope("/admin/agents", undefined, instanceId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing agent.
 * @param instanceId - The instance ID or null.
 * @param agentId - The agent ID.
 * @param payload - Fields to update.
 * @returns Response with the updated agent.
 */
export function updateAgent(
  instanceId: string | null | undefined,
  agentId: string,
  payload: {
    display_name?: string;
    default_name?: string | null;
    role_kind?: AgentRoleKind | null;
    status?: AgentStatus | null;
    participation_mode?: AgentParticipationMode | null;
    allowed_targets?: string[] | null;
    assistant_profile_id?: string | null;
    is_default_operator?: boolean | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; agent: AgentDetail }>(
    appendTenantScope(`/admin/agents/${encodeURIComponent(agentId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Archive an agent (soft-delete).
 * @param instanceId - The instance ID or null.
 * @param agentId - The agent ID.
 * @param payload - Optional replacement agent and reason.
 * @returns Response with the archived agent.
 */
export function archiveAgent(
  instanceId: string | null | undefined,
  agentId: string,
  payload: {
    replacement_agent_id?: string | null;
    reason?: string | null;
  },
) {
  return fetchJson<{ status: string; agent: AgentDetail }>(
    appendTenantScope(`/admin/agents/${encodeURIComponent(agentId)}/archive`, undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
