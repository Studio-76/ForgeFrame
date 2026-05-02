/**
 * Runtime key management API functions and types.
 *
 * @packageDocumentation
 */

import {
  appendTenantScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Runtime key types
// ---------------------------------------------------------------------------

/** Runtime key record. */
export type RuntimeKey = {
  key_id: string;
  account_id: string | null;
  instance_id?: string | null;
  tenant_id?: string | null;
  label: string;
  prefix: string;
  scopes: string[];
  status: "active" | "disabled" | "revoked";
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
  rotated_from?: string | null;
  allowed_request_paths?: Array<"smart_routing" | "pinned_target" | "local_only" | "queue_background" | "blocked" | "review_required">;
  default_request_path?: "smart_routing" | "pinned_target" | "local_only" | "queue_background" | "blocked" | "review_required";
  pinned_target_key?: string | null;
  local_only_policy?: "prefer_local" | "require_local_target";
  review_required_conditions?: string[];
};

/** Runtime key request path policy. */
export type RuntimeKeyRequestPathPolicy = {
  allowed_request_paths: Array<"smart_routing" | "pinned_target" | "local_only" | "queue_background" | "blocked" | "review_required">;
  default_request_path: "smart_routing" | "pinned_target" | "local_only" | "queue_background" | "blocked" | "review_required";
  pinned_target_key?: string | null;
  local_only_policy?: "prefer_local" | "require_local_target";
  review_required_conditions?: string[];
};

/** Runtime key first success probe record. */
export type RuntimeKeyFirstSuccessProbeRecord = {
  runtime_key_id: string;
  instance_id: string;
  tenant_id: string;
  models_probe: {
    attempted: boolean;
    ok: boolean;
    status_code: number | null;
    model_count: number;
    error: string | null;
  };
  chat_probe: {
    attempted: boolean;
    ok: boolean;
    status_code: number | null;
    model: string | null;
    error: string | null;
  };
  success: boolean;
  executed_at: string;
};

/** Runtime key first success probe response. */
export type RuntimeKeyFirstSuccessProbeResponse = {
  status: string;
  probe: RuntimeKeyFirstSuccessProbeRecord;
};

// ---------------------------------------------------------------------------
// Runtime key API functions
// ---------------------------------------------------------------------------

/**
 * Fetch all runtime keys for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with runtime keys.
 */
export function fetchRuntimeKeys(instanceId?: string | null) {
  return fetchJson<{ status: string; keys: RuntimeKey[] }>(appendTenantScope("/admin/keys/", undefined, instanceId));
}

/**
 * Create a new runtime key.
 * @param instanceId - The instance ID or null.
 * @param payload - Key creation parameters.
 * @returns Response with the issued key.
 */
export function createRuntimeKey(
  instanceId: string | null | undefined,
  payload: {
    label: string;
    account_id?: string | null;
    scopes?: string[];
    allowed_request_paths?: RuntimeKeyRequestPathPolicy["allowed_request_paths"];
    default_request_path?: RuntimeKeyRequestPathPolicy["default_request_path"];
    pinned_target_key?: string | null;
    local_only_policy?: RuntimeKeyRequestPathPolicy["local_only_policy"];
    review_required_conditions?: string[];
  },
) {
  return fetchJson<{
    status: string;
    issued: {
      key_id: string;
      instance_id?: string | null;
      tenant_id?: string | null;
      token: string;
      prefix: string;
      account_id: string | null;
      label: string;
      scopes: string[];
      created_at: string;
      allowed_request_paths?: RuntimeKeyRequestPathPolicy["allowed_request_paths"];
      default_request_path?: RuntimeKeyRequestPathPolicy["default_request_path"];
      pinned_target_key?: string | null;
      local_only_policy?: RuntimeKeyRequestPathPolicy["local_only_policy"];
      review_required_conditions?: string[];
    };
  }>(
    appendTenantScope("/admin/keys/", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Rotate a runtime key (issue new token).
 * @param instanceId - The instance ID or null.
 * @param keyId - The key ID.
 * @returns Response with the rotated key.
 */
export function rotateRuntimeKey(instanceId: string | null | undefined, keyId: string) {
  return fetchJson<{ status: string; issued: { key_id: string; instance_id?: string | null; tenant_id?: string | null; token: string; prefix: string; account_id: string | null; label: string; scopes: string[]; created_at: string } }>(
    appendTenantScope(`/admin/keys/${keyId}/rotate`, undefined, instanceId),
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Set a runtime key's status (activate/disable/revoke).
 * @param instanceId - The instance ID or null.
 * @param keyId - The key ID.
 * @param action - The status action to perform.
 * @returns Response with the updated key.
 */
export function setRuntimeKeyStatus(instanceId: string | null | undefined, keyId: string, action: "activate" | "disable" | "revoke") {
  return fetchJson<{ status: string; key: RuntimeKey }>(appendTenantScope(`/admin/keys/${keyId}/${action}`, undefined, instanceId), {
    method: "POST",
    body: "{}",
  });
}

/**
 * Fetch the request path policy for a runtime key.
 * @param instanceId - The instance ID or null.
 * @param keyId - The key ID.
 * @returns Response with the policy.
 */
export function fetchRuntimeKeyRequestPathPolicy(instanceId: string | null | undefined, keyId: string) {
  return fetchJson<{ status: string; policy: RuntimeKeyRequestPathPolicy }>(
    appendTenantScope(`/admin/keys/${encodeURIComponent(keyId)}/request-path-policy`, undefined, instanceId),
  );
}

/**
 * Update the request path policy for a runtime key.
 * @param instanceId - The instance ID or null.
 * @param keyId - The key ID.
 * @param payload - The new policy.
 * @returns Response with the updated key.
 */
export function updateRuntimeKeyRequestPathPolicy(
  instanceId: string | null | undefined,
  keyId: string,
  payload: RuntimeKeyRequestPathPolicy,
) {
  return fetchJson<{ status: string; key: RuntimeKey }>(
    appendTenantScope(`/admin/keys/${encodeURIComponent(keyId)}/request-path-policy`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Run a first-success probe for a runtime key.
 * @param instanceId - The instance ID or null.
 * @param payload - Probe parameters.
 * @returns Response with probe results.
 */
export function runRuntimeKeyFirstSuccessProbe(
  instanceId: string | null | undefined,
  payload: {
    runtime_key: string;
    chat_probe?: boolean;
    model?: string | null;
    message?: string;
  },
) {
  return fetchJson<RuntimeKeyFirstSuccessProbeResponse>(
    appendTenantScope("/admin/keys/first-success/probe", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
