/**
 * Recovery management API functions and types.
 *
 * @packageDocumentation
 */

import {
  fetchJson,
} from "./_internal";

// ---------------------------------------------------------------------------
// Recovery types
// ---------------------------------------------------------------------------

/** Recovery backup target class. */
export type RecoveryBackupTargetClass =
  | "local_secondary_disk"
  | "second_host"
  | "nas_share"
  | "offsite_copy"
  | "object_storage";

/** Recovery protected data class. */
export type RecoveryProtectedDataClass =
  | "database"
  | "artifact_metadata"
  | "blob_contents"
  | "configuration_state"
  | "secret_metadata";

/** Recovery source identity. */
export type RecoverySourceIdentity = {
  source_database: string;
  cluster_system_identifier: string;
  deployment_slug: string;
  public_fqdn: string;
  metadata: Record<string, unknown>;
};

/** Recovery policy validation. */
export type RecoveryPolicyValidation = {
  state: "ok" | "warning" | "blocked";
  reasons: string[];
  target_locator: string;
  checked_at: string;
};

/** Recovery backup report record. */
export type RecoveryBackupReportRecord = {
  report_id: string;
  policy_id: string;
  status: "ok" | "warning" | "failed";
  protected_data_classes: RecoveryProtectedDataClass[];
  source_identity: RecoverySourceIdentity;
  target_locator: string;
  backup_path: string;
  manifest_path: string;
  byte_size?: number | null;
  checksum_sha256?: string | null;
  source_identity_match: boolean;
  coverage_match: boolean;
  mismatch_reasons: string[];
  raw_report: Record<string, unknown>;
  created_at: string;
  imported_at: string;
  notes: string;
};

/** Recovery backup manifest payload. */
export type RecoveryBackupManifestPayload = {
  backup_path: string;
  manifest_path: string;
  database?: string;
  source_database?: string;
  cluster_system_identifier?: string;
  source_cluster_system_identifier?: string;
  deployment_slug?: string;
  public_fqdn?: string;
  created_at?: string;
  byte_size?: number | null;
  checksum_sha256?: string | null;
  protected_data_classes?: RecoveryProtectedDataClass[];
  [key: string]: unknown;
};

/** Recovery restore report record. */
export type RecoveryRestoreReportRecord = {
  report_id: string;
  policy_id: string;
  status: "ok" | "warning" | "failed";
  protected_data_classes: RecoveryProtectedDataClass[];
  source_identity: RecoverySourceIdentity;
  validated_source_identities: RecoverySourceIdentity[];
  restored_database: string;
  tables_compared: number;
  source_identity_match: boolean;
  coverage_match: boolean;
  mismatch_reasons: string[];
  raw_report: Record<string, unknown>;
  created_at: string;
  imported_at: string;
  notes: string;
};

/** Recovery restore import payload. */
export type RecoveryRestoreImportPayload = {
  restored_database?: string;
  target_database?: string;
  source_database?: string;
  database?: string;
  source_cluster_system_identifier?: string;
  cluster_system_identifier?: string;
  deployment_slug?: string;
  public_fqdn?: string;
  validated_source_databases?: Array<Record<string, unknown>>;
  tables_compared?: number;
  checked_at?: string;
  restored_at?: string;
  protected_data_classes?: RecoveryProtectedDataClass[];
  [key: string]: unknown;
};

/** Recovery backup policy record. */
export type RecoveryBackupPolicyRecord = {
  policy_id: string;
  label: string;
  status: "active" | "paused";
  target_class: RecoveryBackupTargetClass;
  target_label: string;
  target_config: Record<string, unknown>;
  protected_data_classes: RecoveryProtectedDataClass[];
  expected_source_identity: RecoverySourceIdentity;
  schedule_hint: string;
  max_backup_age_hours: number;
  max_restore_age_hours: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

/** Recovery upgrade snapshot. */
export type RecoveryUpgradeSnapshot = {
  captured_at?: string | null;
  source_identity: RecoverySourceIdentity;
  migration_version?: number | null;
  applied_migration_versions: number[];
  critical_object_counts: Record<string, number>;
  queue_state_counts: Record<string, number>;
  database_targets: Array<Record<string, unknown>>;
};

/** Recovery upgrade report record. */
export type RecoveryUpgradeReportRecord = {
  report_id: string;
  release_id: string;
  target_version: string;
  status: "ok" | "warning" | "failed";
  upgrade_result: "succeeded" | "failed" | "rolled_back" | "partial_failure";
  rollback_classification: string;
  failure_classification: string;
  bootstrap_recovery_state: string;
  before_snapshot: RecoveryUpgradeSnapshot;
  after_snapshot: RecoveryUpgradeSnapshot;
  no_loss_ok: boolean;
  queue_drain_ok: boolean;
  source_identity_stable: boolean;
  mismatch_reasons: string[];
  raw_report: Record<string, unknown>;
  created_at: string;
  imported_at: string;
  notes: string;
};

/** Recovery upgrade import payload. */
export type RecoveryUpgradeImportPayload = {
  release_id?: string;
  release?: string;
  target_version?: string;
  upgrade_result?: "succeeded" | "failed" | "rolled_back" | "partial_failure" | string;
  rollback_classification?: string;
  failure_classification?: string;
  bootstrap_recovery_state?: string;
  queue_drain_ok?: boolean;
  no_loss_ok?: boolean;
  before?: Record<string, unknown>;
  before_snapshot?: Record<string, unknown>;
  after?: Record<string, unknown>;
  after_snapshot?: Record<string, unknown>;
  [key: string]: unknown;
};

/** Recovery upgrade posture. */
export type RecoveryUpgradePosture = {
  total_reports: number;
  latest_release_id?: string | null;
  latest_target_version?: string | null;
  latest_status?: "ok" | "warning" | "failed" | null;
  latest_upgrade_result?: "succeeded" | "failed" | "rolled_back" | "partial_failure" | null;
  latest_created_at?: string | null;
  latest_imported_at?: string | null;
  latest_no_loss_ok: boolean;
  latest_queue_drain_ok: boolean;
  latest_source_identity_stable: boolean;
  runtime_status: "ok" | "warning" | "blocked";
  blockers: string[];
};

/** Recovery policy summary. */
export type RecoveryPolicySummary = {
  policy: RecoveryBackupPolicyRecord;
  validation: RecoveryPolicyValidation;
  latest_backup?: RecoveryBackupReportRecord | null;
  latest_restore?: RecoveryRestoreReportRecord | null;
  backup_fresh: boolean;
  restore_fresh: boolean;
  source_identity_verified: boolean;
  mismatches: string[];
  overall_status: "ok" | "warning" | "blocked";
};

/** Recovery overview response. */
export type RecoveryOverviewResponse = {
  status: "ok";
  summary: {
    total_policies: number;
    active_policies: number;
    healthy_policies: number;
    warning_policies: number;
    blocked_policies: number;
    fresh_backup_policies: number;
    fresh_restore_policies: number;
    source_identity_verified_policies: number;
    target_classes_present: RecoveryBackupTargetClass[];
    missing_target_classes: RecoveryBackupTargetClass[];
    protected_data_classes_present: RecoveryProtectedDataClass[];
    missing_protected_data_classes: RecoveryProtectedDataClass[];
    runtime_status: "ok" | "warning" | "blocked";
    checked_at: string;
  };
  upgrade_posture: RecoveryUpgradePosture;
  recent_upgrades: RecoveryUpgradeReportRecord[];
  policies: RecoveryPolicySummary[];
};

// ---------------------------------------------------------------------------
// Recovery API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the recovery overview.
 * @returns Recovery overview response.
 */
export function fetchRecoveryOverview(): Promise<RecoveryOverviewResponse> {
  return fetchJson<RecoveryOverviewResponse>("/admin/recovery/");
}

/**
 * Create a new backup policy.
 * @param payload - Policy creation parameters.
 * @returns Response with the created policy.
 */
export function createRecoveryBackupPolicy(payload: {
  policy_id?: string | null;
  label: string;
  status?: "active" | "paused";
  target_class: RecoveryBackupTargetClass;
  target_label?: string;
  target_config?: Record<string, unknown>;
  protected_data_classes?: RecoveryProtectedDataClass[];
  expected_source_identity?: Partial<RecoverySourceIdentity>;
  schedule_hint?: string;
  max_backup_age_hours?: number;
  max_restore_age_hours?: number;
  notes?: string;
}) {
  return fetchJson<{ status: string; policy: RecoveryPolicySummary }>("/admin/recovery/backup-policies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing backup policy.
 * @param policyId - The policy ID.
 * @param payload - Fields to update.
 * @returns Response with the updated policy.
 */
export function updateRecoveryBackupPolicy(policyId: string, payload: {
  label?: string;
  status?: "active" | "paused";
  target_label?: string;
  target_config?: Record<string, unknown>;
  protected_data_classes?: RecoveryProtectedDataClass[];
  expected_source_identity?: Partial<RecoverySourceIdentity>;
  schedule_hint?: string;
  max_backup_age_hours?: number;
  max_restore_age_hours?: number;
  notes?: string;
}) {
  return fetchJson<{ status: string; policy: RecoveryPolicySummary }>(`/admin/recovery/backup-policies/${encodeURIComponent(policyId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Import a recovery backup report.
 * @param payload - Report import parameters.
 * @returns Response with the imported report.
 */
export function importRecoveryBackupReport(payload: {
  policy_id: string;
  status?: "ok" | "warning" | "failed";
  manifest: RecoveryBackupManifestPayload;
  protected_data_classes?: RecoveryProtectedDataClass[];
  notes?: string;
  reported_at?: string | null;
}) {
  return fetchJson<{ status: string; report: RecoveryBackupReportRecord; policy: RecoveryPolicySummary }>("/admin/recovery/backup-reports/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Import a recovery restore report.
 * @param payload - Report import parameters.
 * @returns Response with the imported report.
 */
export function importRecoveryRestoreReport(payload: {
  policy_id: string;
  status?: "ok" | "warning" | "failed";
  report: RecoveryRestoreImportPayload;
  protected_data_classes?: RecoveryProtectedDataClass[];
  notes?: string;
  reported_at?: string | null;
}) {
  return fetchJson<{ status: string; report: RecoveryRestoreReportRecord; policy: RecoveryPolicySummary }>("/admin/recovery/restore-reports/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Import a recovery upgrade report.
 * @param payload - Report import parameters.
 * @returns Response with the imported report and upgrade posture.
 */
export function importRecoveryUpgradeReport(payload: {
  status?: "ok" | "warning" | "failed" | null;
  report: RecoveryUpgradeImportPayload;
  notes?: string;
  reported_at?: string | null;
}) {
  return fetchJson<{ status: string; report: RecoveryUpgradeReportRecord; upgrade_posture: RecoveryUpgradePosture }>("/admin/recovery/upgrade-reports/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
