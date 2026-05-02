/**
 * Gateway account management API functions and types.
 *
 * @packageDocumentation
 */

import {
  appendTenantScope,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Account types
// ---------------------------------------------------------------------------

/** Gateway account record. */
export type GatewayAccount = {
  account_id: string;
  instance_id?: string | null;
  tenant_id?: string | null;
  label: string;
  status: "active" | "suspended" | "disabled";
  provider_bindings: string[];
  notes: string;
  created_at: string;
  updated_at: string;
  last_activity_at?: string | null;
  runtime_key_count?: number;
};

// ---------------------------------------------------------------------------
// Account API functions
// ---------------------------------------------------------------------------

/**
 * Fetch gateway accounts for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with the list of accounts.
 */
export function fetchAccounts(instanceId?: string | null) {
  return fetchJson<{ status: string; accounts: GatewayAccount[] }>(
    appendTenantScope("/admin/accounts/", undefined, instanceId),
  );
}

/**
 * Create a new gateway account.
 * @param instanceId - Instance ID for scoping (may be null).
 * @param payload - Account creation parameters.
 * @returns Response with the created account.
 */
export function createAccount(
  instanceId: string | null | undefined,
  payload: { label: string; provider_bindings?: string[]; notes?: string },
) {
  return fetchJson<{ status: string; account: GatewayAccount }>(
    appendTenantScope("/admin/accounts/", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing gateway account.
 * @param instanceId - Instance ID for scoping (may be null).
 * @param accountId - The account ID.
 * @param payload - Fields to update.
 * @returns Response with the updated account.
 */
export function updateAccount(
  instanceId: string | null | undefined,
  accountId: string,
  payload: { label?: string; provider_bindings?: string[]; notes?: string; status?: string },
) {
  return fetchJson<{ status: string; account: GatewayAccount }>(
    appendTenantScope(`/admin/accounts/${accountId}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
