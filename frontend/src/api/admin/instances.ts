/**
 * Instance management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type AgentDetail,
  type InstanceRecord,
  type InstanceSetupStatus,
  type InstanceOperatorAgentSummary,
  type InstanceProviderTargetSummary,
  type InstanceRoutingSummary,
  type InstanceRuntimeAccessSummary,
  type InstanceWorkInteractionSummary,
  type InstanceReadinessCheck,
  type InstanceReadinessSummary,
  appendTenantScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type {
  InstanceRecord,
  InstanceSetupStatus,
  InstanceOperatorAgentSummary,
  InstanceProviderTargetSummary,
  InstanceRoutingSummary,
  InstanceRuntimeAccessSummary,
  InstanceWorkInteractionSummary,
  InstanceReadinessCheck,
  InstanceReadinessSummary,
};

// ---------------------------------------------------------------------------
// Instance API functions
// ---------------------------------------------------------------------------

/**
 * Fetch all instances.
 * @returns Response with the list of instances.
 */
export function fetchInstances() {
  return fetchJson<{ status: string; instances: InstanceRecord[] }>("/admin/instances/");
}

/**
 * Create a new instance.
 * @param payload - Instance creation parameters.
 * @returns Response with the created instance and operator agent.
 */
export function createInstance(payload: {
  instance_id?: string | null;
  display_name: string;
  description?: string;
  tenant_id?: string | null;
  company_id?: string | null;
  deployment_mode?: InstanceRecord["deployment_mode"];
  exposure_mode?: InstanceRecord["exposure_mode"];
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ status: string; instance: InstanceRecord; operator_agent: AgentDetail; operator_agent_created: boolean }>("/admin/instances/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing instance.
 * @param instanceId - The instance ID.
 * @param payload - Fields to update.
 * @returns Response with the updated instance.
 */
export function updateInstance(
  instanceId: string,
  payload: {
    display_name?: string;
    description?: string;
    tenant_id?: string;
    company_id?: string;
    status?: InstanceRecord["status"];
    deployment_mode?: InstanceRecord["deployment_mode"];
    exposure_mode?: InstanceRecord["exposure_mode"];
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; instance: InstanceRecord }>(`/admin/instances/${encodeURIComponent(instanceId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
