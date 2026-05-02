/**
 * Security management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type AdminRole,
  type AdminPermissionKey,
  type AdminInstanceMembership,
  type AdminSessionUser,
  type ApprovalStatus,
  appendQueryParams,
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type { ApprovalStatus, AdminRole, AdminPermissionKey, AdminInstanceMembership, AdminSessionUser };

// ---------------------------------------------------------------------------
// Security types
// ---------------------------------------------------------------------------

/** Elevated access request type. */
export type ElevatedAccessRequestType = "break_glass" | "impersonation";

/** Session status for elevated access approvals. */
export type ApprovalSessionStatus = "not_issued" | "active" | "expired" | "revoked";

/** Elevated access request record. */
export type ElevatedAccessRequest = {
  request_id: string;
  request_type: ElevatedAccessRequestType;
  gate_status: ApprovalStatus;
  issuance_status: "pending" | "issued";
  requested_by_user_id: string;
  target_user_id: string;
  target_role: AdminRole;
  session_role: AdminRole;
  approval_reference: string;
  justification: string;
  notification_targets: string[];
  duration_minutes: number;
  approval_expires_at: string;
  decision_note?: string | null;
  decided_at?: string | null;
  decided_by_user_id?: string | null;
  decided_by_username?: string | null;
  issued_at?: string | null;
  issued_by_user_id?: string | null;
  issued_by_username?: string | null;
  issued_session_id?: string | null;
  created_at: string;
  updated_at: string;
  approval_id: string;
  requested_by_username?: string | null;
  requested_by_display_name?: string | null;
  target_username?: string | null;
  target_display_name?: string | null;
  ready_to_issue: boolean;
  session_status: ApprovalSessionStatus;
};

/** Admin user record. */
export type AdminUser = {
  user_id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  status: "active" | "disabled";
  must_rotate_password: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  created_by?: string | null;
};

/** Admin password rotation payload. */
export type AdminPasswordRotationPayload = {
  new_password: string;
  must_rotate_password?: true;
};

/** Admin security session record. */
export type AdminSecuritySession = {
  session_id: string;
  user_id: string;
  role: AdminRole;
  membership_id?: string | null;
  instance_id?: string | null;
  tenant_id?: string | null;
  session_type: "standard" | "impersonation" | "break_glass";
  created_at: string;
  expires_at: string;
  last_used_at: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  username: string;
  display_name: string;
  user_status: string;
  active: boolean;
  expired?: boolean;
  elevated?: boolean;
  read_only?: boolean;
  issued_by_user_id?: string | null;
  issued_by_username?: string | null;
  approved_by_user_id?: string | null;
  approved_by_username?: string | null;
  approval_request_id?: string | null;
  approval_reference?: string | null;
  justification?: string | null;
  notification_targets?: string[];
};

/** Elevated access approver posture. */
export type ElevatedAccessApproverPosture = {
  state: "approval_available" | "recovery_required";
  label: string;
  approval_requires_distinct_admin: boolean;
  eligible_admin_approver_count: number;
  blocked_reason?: string | null;
  primary_message: string;
  secondary_message: string;
};

/** Security credential policy. */
export type SecurityCredentialPolicy = {
  human_sessions?: Record<string, unknown>;
  elevated_access_requests?: {
    approval_ttl_minutes: number;
    gate_statuses: string[];
    issuance_states: string[];
    requester_claim_required: boolean;
    self_approval_allowed: boolean;
    approver_availability: ElevatedAccessApproverPosture;
  };
  service_account_keys?: Record<string, unknown>;
  impersonation_sessions?: {
    max_ttl_minutes: number;
    approval_reference_required: boolean;
    notification_targets_required: boolean;
    approval_required_before_issue: boolean;
    read_only: boolean;
    write_capable_admin_routes: boolean;
  };
  break_glass_sessions?: {
    max_ttl_minutes: number;
    approval_reference_required: boolean;
    notification_targets_required: boolean;
    approval_required_before_issue: boolean;
    eligible_roles: string[];
  };
  audit?: Record<string, unknown>;
  rate_limits?: Record<string, unknown>;
  observability?: Record<string, unknown>;
};

/** Security blocker. */
export type SecurityBlocker = {
  blocker_id: string;
  label: string;
  active: boolean;
  tone: "success" | "warning" | "danger" | "neutral";
  count?: number;
  summary: string;
  detail: string;
};

/** Security bootstrap status. */
export type SecurityBootstrapStatus = {
  admin_auth_enabled: boolean;
  bootstrap_username: string;
  must_rotate_password: boolean;
  default_password_in_use: boolean;
  admin_user_count: number;
  active_session_count: number;
  governance_storage_backend: string;
};

/** Security secret posture for a provider. */
export type SecuritySecretPosture = {
  provider: string;
  configured: boolean;
  auth_mode: string;
  rotation_support: string;
  secret_storage: string;
  credential_reference: string;
  history_source: string;
  needs_rotation_evidence: boolean;
  state: "missing" | "rotatable" | "blocked";
  state_label: string;
  state_reason: string;
  history_count: number;
  last_rotation_at?: string | null;
  last_rotation_reference?: string | null;
  last_rotation_kind?: string | null;
  profile_count?: number;
  oauth_mode?: string | null;
  oauth_flow_support?: string | null;
  oauth_operator_truth?: string | null;
};

/** Harness profile secret posture. */
export type HarnessSecretPosture = {
  provider_key: string;
  label: string;
  configured: boolean;
  auth_mode: string;
  rotation_support: string;
  secret_storage: string;
  credential_reference: string;
  config_revision: number;
  history_source: string;
  needs_rotation_evidence: boolean;
  state: "missing" | "rotatable" | "blocked";
  state_label: string;
  state_reason: string;
  history_count: number;
  last_rotation_at?: string | null;
  last_rotation_reference?: string | null;
  last_rotation_kind?: string | null;
};

/** Security rotation event. */
export type SecurityRotationEvent = {
  event_id: string;
  target_type: string;
  target_id: string;
  kind: string;
  recorded_at: string;
  recorded_by_user_id?: string | null;
  reference?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  history_source?: string | null;
};

/** Secret storage control info. */
export type SecretStorageControl = {
  credential_class: string;
  storage: string;
  plaintext_persisted: boolean;
  notes: string;
};

/** Security bootstrap response. */
export type SecurityBootstrapResponse = {
  status: "ok";
  credential_policy: SecurityCredentialPolicy;
  elevated_access_approver_posture: ElevatedAccessApproverPosture;
  security_blockers: SecurityBlocker[];
  bootstrap?: SecurityBootstrapStatus;
  secret_posture?: SecuritySecretPosture[];
  harness_profiles?: HarnessSecretPosture[];
  recent_rotations?: SecurityRotationEvent[];
  secret_storage_controls?: SecretStorageControl[];
};

// ---------------------------------------------------------------------------
// Security API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the security bootstrap status.
 * @returns Security bootstrap response.
 */
export function fetchSecurityBootstrap() {
  return fetchJson<SecurityBootstrapResponse>("/admin/security/bootstrap");
}

/**
 * Fetch elevated access requests, optionally filtered by gate status.
 * @param gateStatus - Gate status filter (default "all").
 * @returns Response with elevated access requests.
 */
export function fetchElevatedAccessRequests(gateStatus: ApprovalStatus | "all" = "all") {
  return fetchJson<{ status: string; requests: ElevatedAccessRequest[] }>(
    appendQueryParams("/admin/security/elevated-access-requests", {
      gate_status: gateStatus === "all" ? null : gateStatus,
    }),
  );
}

/**
 * Create a break-glass elevated access request.
 * @param payload - Break-glass request parameters.
 * @returns Response with the created request.
 */
export function createBreakGlassRequest(payload: {
  approval_reference: string;
  justification: string;
  notification_targets: string[];
  duration_minutes: number;
}) {
  return fetchJson<{ status: string; request: ElevatedAccessRequest }>("/admin/security/break-glass", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Create an impersonation elevated access request.
 * @param payload - Impersonation request parameters.
 * @returns Response with the created request.
 */
export function createImpersonationRequest(payload: {
  target_user_id: string;
  approval_reference: string;
  justification: string;
  notification_targets: string[];
  duration_minutes: number;
}) {
  return fetchJson<{ status: string; request: ElevatedAccessRequest }>("/admin/security/impersonations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Cancel an elevated access request.
 * @param requestId - The request ID to cancel.
 * @returns Response with the cancelled request.
 */
export function cancelElevatedAccessRequest(requestId: string) {
  return fetchJson<{ status: string; request: ElevatedAccessRequest }>(
    `/admin/security/elevated-access-requests/${encodeURIComponent(requestId)}/cancel`,
    {
      method: "POST",
      body: "{}",
    },
  );
}

/**
 * Approve an elevated access request.
 * @param requestId - The request ID to approve.
 * @param decisionNote - Note accompanying the approval decision.
 * @returns Response with the approved request.
 */
export function approveElevatedAccessRequest(requestId: string, decisionNote: string) {
  return fetchJson<{ status: string; request: ElevatedAccessRequest }>(
    `/admin/security/elevated-access-requests/${encodeURIComponent(requestId)}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ decision_note: decisionNote }),
    },
  );
}

/**
 * Reject an elevated access request.
 * @param requestId - The request ID to reject.
 * @param decisionNote - Note accompanying the rejection decision.
 * @returns Response with the rejected request.
 */
export function rejectElevatedAccessRequest(requestId: string, decisionNote: string) {
  return fetchJson<{ status: string; request: ElevatedAccessRequest }>(
    `/admin/security/elevated-access-requests/${encodeURIComponent(requestId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ decision_note: decisionNote }),
    },
  );
}

/**
 * Issue an elevated access session from an approved request.
 * @param requestId - The approved request ID.
 * @returns Response with the issued access token and session user.
 */
export function issueElevatedAccessRequest(requestId: string) {
  return fetchJson<{
    status: string;
    request: ElevatedAccessRequest;
    access_token: string;
    token_type: string;
    expires_at: string;
    user: AdminSessionUser;
  }>(`/admin/security/elevated-access-requests/${encodeURIComponent(requestId)}/issue`, {
    method: "POST",
    body: "{}",
  });
}

/**
 * Fetch all admin users.
 * @returns Response with the list of admin users.
 */
export function fetchAdminUsers() {
  return fetchJson<{ status: string; users: AdminUser[] }>("/admin/security/users");
}

/**
 * Fetch memberships for a specific admin user.
 * @param userId - The user ID.
 * @returns Response with the user's memberships.
 */
export function fetchAdminUserMemberships(userId: string) {
  return fetchJson<{ status: string; memberships: AdminInstanceMembership[] }>(
    `/admin/security/users/${encodeURIComponent(userId)}/memberships`,
  );
}

/**
 * Create a new admin user.
 * @param payload - User creation parameters.
 * @returns Response with the created user.
 */
export function createAdminUser(payload: { username: string; display_name: string; role: string; password: string }) {
  return fetchJson<{ status: string; user: AdminUser }>("/admin/security/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing admin user.
 * @param userId - The user ID.
 * @param payload - Fields to update.
 * @returns Response with the updated user.
 */
export function updateAdminUser(
  userId: string,
  payload: { display_name?: string; role?: string; status?: string; must_rotate_password?: true },
) {
  return fetchJson<{ status: string; user: AdminUser }>(`/admin/security/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Rotate an admin user's password.
 * @param userId - The user ID.
 * @param payload - New password payload.
 * @returns Response with the updated user.
 */
export function rotateAdminPassword(userId: string, payload: AdminPasswordRotationPayload) {
  return fetchJson<{ status: string; user: AdminUser }>(`/admin/security/users/${userId}/rotate-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Upsert an admin user's membership for a specific instance.
 * @param userId - The user ID.
 * @param instanceId - The instance ID.
 * @param payload - Membership role and status.
 * @returns Response with the membership record.
 */
export function upsertAdminUserMembership(
  userId: string,
  instanceId: string,
  payload: { role: AdminRole; status: "active" | "disabled" },
) {
  return fetchJson<{ status: string; membership: AdminInstanceMembership }>(
    `/admin/security/users/${encodeURIComponent(userId)}/memberships/${encodeURIComponent(instanceId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Delete an admin user's membership for a specific instance.
 * @param userId - The user ID.
 * @param instanceId - The instance ID.
 * @returns Response confirming deletion.
 */
export function deleteAdminUserMembership(userId: string, instanceId: string) {
  return fetchJson<{ status: string; deleted: { user_id: string; instance_id: string } }>(
    `/admin/security/users/${encodeURIComponent(userId)}/memberships/${encodeURIComponent(instanceId)}`,
    {
      method: "DELETE",
      body: "{}",
    },
  );
}

/**
 * Fetch all active admin sessions.
 * @returns Response with the list of sessions.
 */
export function fetchAdminSessions() {
  return fetchJson<{ status: string; sessions: AdminSecuritySession[] }>("/admin/security/sessions");
}

/**
 * Revoke an admin session.
 * @param sessionId - The session ID to revoke.
 * @returns Response with the revoked session.
 */
export function revokeAdminSession(sessionId: string) {
  return fetchJson<{ status: string; session: AdminSecuritySession }>(`/admin/security/sessions/${sessionId}/revoke`, {
    method: "POST",
    body: "{}",
  });
}

/**
 * Fetch the provider secret posture across all providers and harness profiles.
 * @returns Response with secret posture data.
 */
export function fetchProviderSecretPosture() {
  return fetchJson<{
    status: string;
    providers: SecuritySecretPosture[];
    harness_profiles: HarnessSecretPosture[];
    recent_rotations: SecurityRotationEvent[];
    controls: SecretStorageControl[];
  }>("/admin/security/secret-posture");
}

/**
 * Record a secret rotation event.
 * @param payload - Rotation event details.
 * @returns Response with the recorded rotation event.
 */
export function recordSecretRotation(payload: {
  target_type: "provider" | "harness_profile";
  target_id: string;
  kind: string;
  reference?: string;
  notes?: string;
}) {
  return fetchJson<{ status: string; rotation: SecurityRotationEvent }>("/admin/security/secret-rotations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
