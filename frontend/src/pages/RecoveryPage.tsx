import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  createRecoveryBackupPolicy,
  fetchRecoveryOverview,
  importRecoveryBackupReport,
  importRecoveryRestoreReport,
  importRecoveryUpgradeReport,
  type RecoveryBackupManifestPayload,
  updateRecoveryBackupPolicy,
  type RecoveryBackupReportRecord,
  type RecoveryBackupTargetClass,
  type RecoveryOverviewResponse,
  type RecoveryPolicySummary,
  type RecoveryProtectedDataClass,
  type RecoveryRestoreReportRecord,
  type RecoveryRestoreImportPayload,
  type RecoveryUpgradeImportPayload,
  type RecoveryUpgradeReportRecord,
} from "../api/domain/recovery";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { IncidentResponsePage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { ActionBar } from "../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { Button } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import type { DataTableColumn } from "../components/ui/DataTable";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { DetailPanel } from "../components/ui/DetailPanel";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { latestTimestamp } from "./workInteractionPageSupport";

type LoadState = "idle" | "loading" | "success" | "error";
type SectionKey = "overview" | "policies" | "backup" | "restore" | "upgrade";
type PolicyDrawerMode = "closed" | "create" | "edit";
type StatusKey = "ready" | "partial" | "blocked";
type PolicyFormState = {
  policy_id: string;
  label: string;
  status: "active" | "paused";
  target_class: RecoveryBackupTargetClass;
  target_label: string;
  target_config_json: string;
  protected_data_classes: RecoveryProtectedDataClass[];
  source_database: string;
  cluster_system_identifier: string;
  deployment_slug: string;
  public_fqdn: string;
  schedule_hint: string;
  max_backup_age_hours: number;
  max_restore_age_hours: number;
  notes: string;
};
type ImportFormState = {
  policy_id: string;
  protected_data_classes: RecoveryProtectedDataClass[];
  payload_json: string;
  notes: string;
};
type UpgradeImportFormState = {
  payload_json: string;
  notes: string;
};
type JsonValidationState = {
  valid: boolean;
  error: string | null;
};
type ReportValidationState<T extends Record<string, unknown>> = {
  valid: boolean;
  payload: T | null;
  errors: string[];
};
type ImportResultState = {
  title: string;
  statusLabel: string;
  tone: StatusTone;
  details: string[];
  raw: Record<string, unknown>;
};
type CoverageRow = {
  key: string;
  dataClass: RecoveryProtectedDataClass;
  protectedLabel: string;
  protectedStatusKey: StatusKey;
  policyLabels: string;
  backupTargets: string;
  lastBackupAt: string | null;
  lastRestoreAt: string | null;
  riskLabel: string;
  riskTone: StatusTone;
  statusKey: StatusKey;
  blocker: string;
  notes: string[];
  severity: number;
};
type PolicyFormValidationState = {
  valid: boolean;
  errors: string[];
};
type PolicyEvidenceRow = {
  key: string;
  policy: RecoveryPolicySummary;
  statusLabel: string;
  statusKey: StatusKey;
  tone: StatusTone;
  evidenceAt: string | null;
  blocker: string;
  notes: string[];
};
type UpgradeRow = {
  key: string;
  report: RecoveryUpgradeReportRecord;
  statusLabel: string;
  statusKey: StatusKey;
  tone: StatusTone;
  blocker: string;
  notes: string[];
};

const TARGET_CLASSES: RecoveryBackupTargetClass[] = [
  "local_secondary_disk",
  "second_host",
  "nas_share",
  "offsite_copy",
  "object_storage",
];
const DATA_CLASSES: RecoveryProtectedDataClass[] = [
  "database",
  "artifact_metadata",
  "blob_contents",
  "configuration_state",
  "secret_metadata",
];

const DEFAULT_CREATE_FORM: PolicyFormState = {
  policy_id: "",
  label: "",
  status: "active",
  target_class: "local_secondary_disk",
  target_label: "",
  target_config_json: '{\n  "path": "/var/backups/forgeframe"\n}',
  protected_data_classes: ["database"],
  source_database: "",
  cluster_system_identifier: "",
  deployment_slug: "",
  public_fqdn: "",
  schedule_hint: "nightly",
  max_backup_age_hours: 24,
  max_restore_age_hours: 168,
  notes: "",
};
const DEFAULT_IMPORT_FORM: ImportFormState = {
  policy_id: "",
  protected_data_classes: ["database"],
  payload_json: '{\n  "status": "ok"\n}',
  notes: "",
};
const DEFAULT_UPGRADE_IMPORT_FORM: UpgradeImportFormState = {
  payload_json: JSON.stringify({
    release_id: "release-2026-04-23",
    target_version: "0.6.0",
    upgrade_result: "succeeded",
    rollback_classification: "not_needed",
    failure_classification: "none",
    bootstrap_recovery_state: "recovered",
    queue_drain_ok: true,
    no_loss_ok: true,
    before: {
      captured_at: "2026-04-23T08:00:00Z",
      source_identity: {
        source_database: "forgeframe",
        cluster_system_identifier: "cluster-123",
        deployment_slug: "forgeframe-prod",
        public_fqdn: "forgeframe.example.com",
      },
      migration: { latest_version: 28, applied_versions: [1, 2, 28] },
      critical_object_counts: { runs: 12, run_approval_links: 3, memory_entries: 8, skills: 2 },
      queue_state_counts: { queued: 0, executing: 0 },
    },
    after: {
      captured_at: "2026-04-23T08:10:00Z",
      source_identity: {
        source_database: "forgeframe",
        cluster_system_identifier: "cluster-123",
        deployment_slug: "forgeframe-prod",
        public_fqdn: "forgeframe.example.com",
      },
      migration: { latest_version: 29, applied_versions: [1, 2, 29] },
      critical_object_counts: { runs: 12, run_approval_links: 3, memory_entries: 8, skills: 2 },
      queue_state_counts: { queued: 0, executing: 0 },
    },
  }, null, 2),
  notes: "",
};

function toggleClass<T extends string>(values: T[], candidate: T): T[] {
  return values.includes(candidate) ? values.filter((item) => item !== candidate) : [...values, candidate];
}

function parseJsonInput(raw: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : "parse error"}`);
  }
  throw new Error(`${label} must be a JSON object.`);
}

function validateJson(raw: string, label: string): JsonValidationState {
  try {
    parseJsonInput(raw, label);
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : `${label} is invalid.` };
  }
}

function getNonEmptyString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getObjectValue(payload: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = payload[key];
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length > 0) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function buildReportValidation<T extends Record<string, unknown>>(
  raw: string,
  label: string,
  validator: (payload: T) => string[],
): ReportValidationState<T> {
  try {
    const payload = parseJsonInput(raw, label) as T;
    const errors = validator(payload);
    return {
      valid: errors.length === 0,
      payload,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      payload: null,
      errors: [error instanceof Error ? error.message : `${label} is invalid.`],
    };
  }
}

function validateBackupManifest(raw: string): ReportValidationState<RecoveryBackupManifestPayload> {
  return buildReportValidation<RecoveryBackupManifestPayload>(raw, "Backup manifest", (payload) => {
    const errors: string[] = [];
    if (!getNonEmptyString(payload, ["backup_path"])) {
      errors.push("Backup manifest must contain backup_path.");
    }
    if (!getNonEmptyString(payload, ["manifest_path"])) {
      errors.push("Backup manifest must contain manifest_path.");
    }
    if (!getNonEmptyString(payload, ["database", "source_database"])) {
      errors.push("Backup manifest must contain database or source_database.");
    }
    if (!getNonEmptyString(payload, ["cluster_system_identifier", "source_cluster_system_identifier"])) {
      errors.push("Backup manifest must contain cluster_system_identifier or source_cluster_system_identifier.");
    }
    return errors;
  });
}

function validateRestoreReport(raw: string): ReportValidationState<RecoveryRestoreImportPayload> {
  return buildReportValidation<RecoveryRestoreImportPayload>(raw, "Restore report", (payload) => {
    const errors: string[] = [];
    if (!getNonEmptyString(payload, ["restored_database", "target_database"])) {
      errors.push("Restore report must contain restored_database or target_database.");
    }
    if (!getNonEmptyString(payload, ["database", "source_database"])) {
      errors.push("Restore report must contain database or source_database.");
    }
    if (!getNonEmptyString(payload, ["cluster_system_identifier", "source_cluster_system_identifier"])) {
      errors.push("Restore report must contain cluster_system_identifier or source_cluster_system_identifier.");
    }
    if (typeof payload.tables_compared !== "number" || !Number.isInteger(payload.tables_compared) || payload.tables_compared < 1) {
      errors.push("Restore report must contain integer tables_compared >= 1.");
    }
    return errors;
  });
}

function validateUpgradeReport(raw: string): ReportValidationState<RecoveryUpgradeImportPayload> {
  return buildReportValidation<RecoveryUpgradeImportPayload>(raw, "Upgrade proof report", (payload) => {
    const errors: string[] = [];
    const upgradeResult = typeof payload.upgrade_result === "string" && payload.upgrade_result.trim()
      ? payload.upgrade_result.trim()
      : "partial_failure";
    if (!getNonEmptyString(payload, ["release_id", "release"])) {
      errors.push("Upgrade report must contain release_id or release.");
    }
    const before = getObjectValue(payload, ["before", "before_snapshot"]);
    const after = getObjectValue(payload, ["after", "after_snapshot"]);
    if (!before) {
      errors.push("Upgrade report must contain before or before_snapshot.");
    }
    if (!after) {
      errors.push("Upgrade report must contain after or after_snapshot.");
    }
    if (!before || !getObjectValue(before, ["source_identity"])) {
      errors.push("Upgrade report must contain before.source_identity.");
    }
    if (!after || !getObjectValue(after, ["source_identity"])) {
      errors.push("Upgrade report must contain after.source_identity.");
    }
    if (!["succeeded", "failed", "rolled_back", "partial_failure"].includes(upgradeResult)) {
      errors.push(`Unsupported upgrade_result '${upgradeResult}'.`);
    }
    const rollbackClassification = typeof payload.rollback_classification === "string" ? payload.rollback_classification.trim() : "";
    const failureClassification = typeof payload.failure_classification === "string" ? payload.failure_classification.trim() : "";
    if (upgradeResult === "succeeded") {
      if (!["", "not_needed"].includes(rollbackClassification)) {
        errors.push("Successful upgrade reports must use rollback_classification=not_needed or leave it empty.");
      }
      if (!["", "none"].includes(failureClassification)) {
        errors.push("Successful upgrade reports must use failure_classification=none or leave it empty.");
      }
    } else {
      if (["", "none"].includes(failureClassification)) {
        errors.push("Non-success upgrade reports must describe failure_classification.");
      }
      if (upgradeResult === "rolled_back" && ["", "not_needed"].includes(rollbackClassification)) {
        errors.push("Rolled-back upgrade reports must describe rollback_classification.");
      }
    }
    return errors;
  });
}

function formatTimestamp(value: string | null | undefined, fallback = "never"): string {
  return value && value.trim() ? value : fallback;
}

function uniqueLabels(values: string[]): string {
  const normalized = values.filter((value) => value.trim());
  return normalized.length > 0 ? Array.from(new Set(normalized)).join(", ") : "none";
}

function toneForStatus(status: StatusKey): StatusTone {
  if (status === "ready") {
    return "success";
  }
  if (status === "blocked") {
    return "danger";
  }
  return "warning";
}

function toneForRuntimeStatus(status: "ok" | "warning" | "blocked"): StatusTone {
  if (status === "ok") {
    return "success";
  }
  if (status === "blocked") {
    return "danger";
  }
  return "warning";
}

function statusKeyForRuntimeStatus(status: "ok" | "warning" | "blocked"): StatusKey {
  return status === "ok" ? "ready" : status === "blocked" ? "blocked" : "partial";
}

function statusKeyForPolicy(summary: RecoveryPolicySummary): StatusKey {
  return summary.overall_status === "ok" ? "ready" : summary.overall_status === "blocked" ? "blocked" : "partial";
}

function policyStatusLabel(summary: RecoveryPolicySummary): string {
  if (summary.policy.status === "paused") {
    return "paused / not effective";
  }
  if (summary.overall_status === "ok") {
    return "covered and restore-tested";
  }
  if (!summary.latest_restore) {
    return "restore never tested";
  }
  if (!summary.latest_backup) {
    return "backup evidence missing";
  }
  if (!summary.restore_fresh) {
    return "restore evidence stale";
  }
  if (!summary.backup_fresh) {
    return "backup evidence stale";
  }
  return summary.overall_status;
}

function evidenceNotes(report: RecoveryBackupReportRecord | RecoveryRestoreReportRecord | null | undefined): string[] {
  if (!report) {
    return [];
  }
  return [
    `status=${report.status}`,
    `source_identity_match=${String(report.source_identity_match)}`,
    `coverage_match=${String(report.coverage_match)}`,
    ...report.mismatch_reasons,
  ];
}

function buildCoverageRow(dataClass: RecoveryProtectedDataClass, policies: RecoveryPolicySummary[]): CoverageRow {
  const candidatePolicies = policies.filter((policy) => policy.policy.protected_data_classes.includes(dataClass));
  const coveringPolicies = candidatePolicies.filter((policy) => policy.policy.status === "active");
  const backupReports = coveringPolicies
    .map((policy) => policy.latest_backup)
    .filter((report): report is RecoveryBackupReportRecord => Boolean(report && report.protected_data_classes.includes(dataClass)));
  const restoreReports = coveringPolicies
    .map((policy) => policy.latest_restore)
    .filter((report): report is RecoveryRestoreReportRecord => Boolean(report && report.protected_data_classes.includes(dataClass)));
  const lastBackupAt = latestTimestamp(backupReports.map((report) => report.created_at));
  const lastRestoreAt = latestTimestamp(restoreReports.map((report) => report.created_at));
  const policyLabels = uniqueLabels(coveringPolicies.map((policy) => policy.policy.label));
  const backupTargets = uniqueLabels(coveringPolicies.map((policy) => policy.validation.target_locator || policy.policy.target_label || policy.policy.target_class));
  const notes = [
    ...candidatePolicies.map((policy) => `${policy.policy.label}: status=${policy.policy.status}`),
    ...coveringPolicies.map((policy) => `${policy.policy.label}: overall=${policy.overall_status} backup_fresh=${String(policy.backup_fresh)} restore_fresh=${String(policy.restore_fresh)}`),
    ...backupReports.flatMap((report) => evidenceNotes(report)),
    ...restoreReports.flatMap((report) => evidenceNotes(report)),
  ];

  if (coveringPolicies.length === 0) {
    return {
      key: dataClass,
      dataClass,
      protectedLabel: "unprotected",
      protectedStatusKey: "blocked",
      policyLabels,
      backupTargets,
      lastBackupAt,
      lastRestoreAt,
      riskLabel: "unprotected",
      riskTone: "danger",
      statusKey: "blocked",
      blocker: candidatePolicies.length > 0
        ? "Only paused recovery policies cover this data class."
        : "No active recovery policy protects this data class.",
      notes,
      severity: 3,
    };
  }

  if (backupReports.length === 0) {
    return {
      key: dataClass,
      dataClass,
      protectedLabel: "protected",
      protectedStatusKey: "ready",
      policyLabels,
      backupTargets,
      lastBackupAt,
      lastRestoreAt,
      riskLabel: "backup evidence missing",
      riskTone: "danger",
      statusKey: "blocked",
      blocker: "A policy exists, but no backup evidence has been imported for this data class.",
      notes,
      severity: 3,
    };
  }

  if (restoreReports.length === 0) {
    return {
      key: dataClass,
      dataClass,
      protectedLabel: "protected",
      protectedStatusKey: "ready",
      policyLabels,
      backupTargets,
      lastBackupAt,
      lastRestoreAt,
      riskLabel: "restore never tested",
      riskTone: "danger",
      statusKey: "blocked",
      blocker: "Backup evidence exists, but restore has never been tested for this data class.",
      notes,
      severity: 3,
    };
  }

  const policyWithHardMismatch = coveringPolicies.find((policy) => policy.mismatches.length > 0 || !policy.source_identity_verified);
  if (policyWithHardMismatch) {
    return {
      key: dataClass,
      dataClass,
      protectedLabel: "protected",
      protectedStatusKey: "ready",
      policyLabels,
      backupTargets,
      lastBackupAt,
      lastRestoreAt,
      riskLabel: "identity or coverage mismatch",
      riskTone: "warning",
      statusKey: "partial",
      blocker: `${policyWithHardMismatch.policy.label} still reports ${policyWithHardMismatch.mismatches[0] ?? "source identity mismatch"}.`,
      notes,
      severity: 2,
    };
  }

  const stalePolicy = coveringPolicies.find((policy) => !policy.backup_fresh || !policy.restore_fresh || policy.overall_status !== "ok");
  if (stalePolicy) {
    return {
      key: dataClass,
      dataClass,
      protectedLabel: "protected",
      protectedStatusKey: "ready",
      policyLabels,
      backupTargets,
      lastBackupAt,
      lastRestoreAt,
      riskLabel: "evidence stale",
      riskTone: "warning",
      statusKey: "partial",
      blocker: `${stalePolicy.policy.label} has stale or warning-level recovery evidence.`,
      notes,
      severity: 2,
    };
  }

  return {
    key: dataClass,
    dataClass,
    protectedLabel: "protected",
    protectedStatusKey: "ready",
    policyLabels,
    backupTargets,
    lastBackupAt,
    lastRestoreAt,
    riskLabel: "covered and restore-tested",
    riskTone: "success",
    statusKey: "ready",
    blocker: "This data class is protected, backed up, and restore-tested.",
    notes,
    severity: 0,
  };
}

function buildBackupRow(policy: RecoveryPolicySummary): PolicyEvidenceRow {
  if (policy.policy.status !== "active") {
    return {
      key: policy.policy.policy_id,
      policy,
      statusLabel: "paused / not effective",
      statusKey: "partial",
      tone: "warning",
      evidenceAt: policy.latest_backup?.created_at ?? null,
      blocker: "This policy is paused and does not count as effective backup protection.",
      notes: policy.mismatches,
    };
  }
  if (!policy.latest_backup) {
    return {
      key: policy.policy.policy_id,
      policy,
      statusLabel: "missing",
      statusKey: "blocked",
      tone: "danger",
      evidenceAt: null,
      blocker: "No backup manifest has been imported for this policy.",
      notes: policy.mismatches,
    };
  }
  if (!policy.backup_fresh || policy.latest_backup.status !== "ok" || !policy.latest_backup.source_identity_match || !policy.latest_backup.coverage_match) {
    return {
      key: policy.policy.policy_id,
      policy,
      statusLabel: !policy.backup_fresh ? "stale" : policy.latest_backup.status,
      statusKey: !policy.backup_fresh ? "partial" : "blocked",
      tone: !policy.backup_fresh ? "warning" : "danger",
      evidenceAt: policy.latest_backup.created_at,
      blocker: policy.latest_backup.mismatch_reasons[0] ?? (!policy.backup_fresh ? "Backup evidence is stale." : "Backup evidence is degraded."),
      notes: evidenceNotes(policy.latest_backup),
    };
  }
  return {
    key: policy.policy.policy_id,
    policy,
    statusLabel: "ready",
    statusKey: "ready",
    tone: "success",
    evidenceAt: policy.latest_backup.created_at,
    blocker: "Backup evidence is current for this policy.",
    notes: evidenceNotes(policy.latest_backup),
  };
}

function buildRestoreRow(policy: RecoveryPolicySummary): PolicyEvidenceRow {
  if (policy.policy.status !== "active") {
    return {
      key: policy.policy.policy_id,
      policy,
      statusLabel: "paused / not effective",
      statusKey: "partial",
      tone: "warning",
      evidenceAt: policy.latest_restore?.created_at ?? null,
      blocker: "This policy is paused and does not count as effective restore protection.",
      notes: policy.mismatches,
    };
  }
  if (!policy.latest_restore) {
    return {
      key: policy.policy.policy_id,
      policy,
      statusLabel: "never tested",
      statusKey: "blocked",
      tone: "danger",
      evidenceAt: null,
      blocker: "Restore has never been tested for this policy.",
      notes: policy.mismatches,
    };
  }
  if (!policy.restore_fresh || policy.latest_restore.status !== "ok" || !policy.latest_restore.source_identity_match || !policy.latest_restore.coverage_match) {
    return {
      key: policy.policy.policy_id,
      policy,
      statusLabel: !policy.restore_fresh ? "stale" : policy.latest_restore.status,
      statusKey: !policy.restore_fresh ? "partial" : "blocked",
      tone: !policy.restore_fresh ? "warning" : "danger",
      evidenceAt: policy.latest_restore.created_at,
      blocker: policy.latest_restore.mismatch_reasons[0] ?? (!policy.restore_fresh ? "Restore evidence is stale." : "Restore evidence is degraded."),
      notes: evidenceNotes(policy.latest_restore),
    };
  }
  return {
    key: policy.policy.policy_id,
    policy,
    statusLabel: "restore-tested",
    statusKey: "ready",
    tone: "success",
    evidenceAt: policy.latest_restore.created_at,
    blocker: "Restore evidence is current for this policy.",
    notes: evidenceNotes(policy.latest_restore),
  };
}

function buildUpgradeRow(report: RecoveryUpgradeReportRecord): UpgradeRow {
  const fullyReady = report.status === "ok" && report.no_loss_ok && report.queue_drain_ok && report.source_identity_stable;
  if (fullyReady) {
    const rollbackProven = Boolean(report.rollback_classification && report.rollback_classification !== "not_needed");
    return {
      key: report.report_id,
      report,
      statusLabel: rollbackProven ? "rollback proven" : "upgrade proven",
      statusKey: "ready",
      tone: "success",
      blocker: rollbackProven ? "Upgrade and rollback evidence are fully recorded." : "No-loss upgrade evidence is fully recorded; rollback was not needed.",
      notes: report.mismatch_reasons,
    };
  }
  const partial = report.status !== "failed" && (report.no_loss_ok || report.queue_drain_ok || report.source_identity_stable);
  return {
    key: report.report_id,
    report,
    statusLabel: partial ? "review required" : "blocked",
    statusKey: partial ? "partial" : "blocked",
    tone: partial ? "warning" : "danger",
    blocker: report.mismatch_reasons[0] ?? `${report.upgrade_result} / ${report.failure_classification}`,
    notes: [
      `no_loss_ok=${String(report.no_loss_ok)}`,
      `queue_drain_ok=${String(report.queue_drain_ok)}`,
      `source_identity_stable=${String(report.source_identity_stable)}`,
      ...report.mismatch_reasons,
    ],
  };
}

function validatePolicyForm(form: PolicyFormState, configValidation: JsonValidationState, mode: PolicyDrawerMode): PolicyFormValidationState {
  const errors: string[] = [];
  if (form.label.trim() === "") {
    errors.push("Label is required.");
  }
  if (form.protected_data_classes.length === 0) {
    errors.push("At least one protected data class is required.");
  }
  if (!Number.isInteger(form.max_backup_age_hours) || form.max_backup_age_hours < 1) {
    errors.push("Max backup age must be an integer >= 1.");
  }
  if (!Number.isInteger(form.max_restore_age_hours) || form.max_restore_age_hours < 1) {
    errors.push("Max restore age must be an integer >= 1.");
  }
  if (!configValidation.valid) {
    errors.push(configValidation.error ?? "Target config JSON is invalid.");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function policyFormFromSummary(summary: RecoveryPolicySummary): PolicyFormState {
  return {
    policy_id: summary.policy.policy_id,
    label: summary.policy.label,
    status: summary.policy.status,
    target_class: summary.policy.target_class,
    target_label: summary.policy.target_label,
    target_config_json: JSON.stringify(summary.policy.target_config, null, 2),
    protected_data_classes: summary.policy.protected_data_classes,
    source_database: summary.policy.expected_source_identity.source_database,
    cluster_system_identifier: summary.policy.expected_source_identity.cluster_system_identifier,
    deployment_slug: summary.policy.expected_source_identity.deployment_slug,
    public_fqdn: summary.policy.expected_source_identity.public_fqdn,
    schedule_hint: summary.policy.schedule_hint,
    max_backup_age_hours: summary.policy.max_backup_age_hours,
    max_restore_age_hours: summary.policy.max_restore_age_hours,
    notes: summary.policy.notes,
  };
}

export function RecoveryPage() {
  const { session } = useAppSession();
  const canMutate = session?.read_only !== true && (session?.role === "admin" || session?.role === "owner");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [overview, setOverview] = useState<RecoveryOverviewResponse | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [selectedCoverageKey, setSelectedCoverageKey] = useState<RecoveryProtectedDataClass>("database");
  const [selectedUpgradeId, setSelectedUpgradeId] = useState("");
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [policyDrawerMode, setPolicyDrawerMode] = useState<PolicyDrawerMode>("closed");
  const [createForm, setCreateForm] = useState<PolicyFormState>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<PolicyFormState>(DEFAULT_CREATE_FORM);
  const [backupImport, setBackupImport] = useState<ImportFormState>(DEFAULT_IMPORT_FORM);
  const [restoreImport, setRestoreImport] = useState<ImportFormState>(DEFAULT_IMPORT_FORM);
  const [upgradeImport, setUpgradeImport] = useState<UpgradeImportFormState>(DEFAULT_UPGRADE_IMPORT_FORM);
  const [backupImportResult, setBackupImportResult] = useState<ImportResultState | null>(null);
  const [restoreImportResult, setRestoreImportResult] = useState<ImportResultState | null>(null);
  const [upgradeImportResult, setUpgradeImportResult] = useState<ImportResultState | null>(null);

  const createConfigValidation = useMemo(
    () => validateJson(createForm.target_config_json, "Target config"),
    [createForm.target_config_json],
  );
  const editConfigValidation = useMemo(
    () => validateJson(editForm.target_config_json, "Target config"),
    [editForm.target_config_json],
  );
  const backupValidation = useMemo(
    () => validateBackupManifest(backupImport.payload_json),
    [backupImport.payload_json],
  );
  const restoreValidation = useMemo(
    () => validateRestoreReport(restoreImport.payload_json),
    [restoreImport.payload_json],
  );
  const upgradeValidation = useMemo(
    () => validateUpgradeReport(upgradeImport.payload_json),
    [upgradeImport.payload_json],
  );

  const loadOverview = async (preferredPolicyId?: string) => {
    setLoadState("loading");
    setError("");
    const payload = await fetchRecoveryOverview();
    setOverview(payload);
    const nextSelectedPolicyId = preferredPolicyId ?? payload.policies[0]?.policy.policy_id ?? "";
    setSelectedPolicyId(nextSelectedPolicyId);
    setBackupImport((current) => ({ ...current, policy_id: nextSelectedPolicyId }));
    setRestoreImport((current) => ({ ...current, policy_id: nextSelectedPolicyId }));
    setSelectedUpgradeId((current) => current || payload.recent_upgrades[0]?.report_id || "");
    setLoadState("success");
  };

  useEffect(() => {
    void loadOverview().catch((loadError) => {
      setOverview(null);
      setLoadState("error");
      setError(loadError instanceof Error ? loadError.message : "Recovery surface loading failed.");
    });
  }, []);

  const selectedPolicy = useMemo(
    () => overview?.policies.find((policy) => policy.policy.policy_id === selectedPolicyId) ?? null,
    [overview, selectedPolicyId],
  );
  const coverageRows = useMemo(
    () => overview ? DATA_CLASSES.map((dataClass) => buildCoverageRow(dataClass, overview.policies)) : [],
    [overview],
  );
  const selectedCoverage = coverageRows.find((row) => row.key === selectedCoverageKey) ?? coverageRows[0] ?? null;
  const backupRows = useMemo(
    () => overview ? overview.policies.map((policy) => buildBackupRow(policy)) : [],
    [overview],
  );
  const restoreRows = useMemo(
    () => overview ? overview.policies.map((policy) => buildRestoreRow(policy)) : [],
    [overview],
  );
  const upgradeRows = useMemo(
    () => overview ? overview.recent_upgrades.map((report) => buildUpgradeRow(report)) : [],
    [overview],
  );
  const selectedUpgrade = overview?.recent_upgrades.find((report) => report.report_id === selectedUpgradeId) ?? overview?.recent_upgrades[0] ?? null;

  useEffect(() => {
    if (!selectedPolicy) {
      setEditForm(DEFAULT_CREATE_FORM);
      return;
    }
    setEditForm(policyFormFromSummary(selectedPolicy));
  }, [selectedPolicy]);

  useEffect(() => {
    if (!selectedPolicyId && overview?.policies[0]) {
      setSelectedPolicyId(overview.policies[0].policy.policy_id);
    }
  }, [overview, selectedPolicyId]);

  useEffect(() => {
    if (!coverageRows.some((row) => row.key === selectedCoverageKey) && coverageRows[0]) {
      setSelectedCoverageKey(coverageRows[0].dataClass);
    }
  }, [coverageRows, selectedCoverageKey]);

  useEffect(() => {
    if (!overview?.recent_upgrades.some((report) => report.report_id === selectedUpgradeId) && overview?.recent_upgrades[0]) {
      setSelectedUpgradeId(overview.recent_upgrades[0].report_id);
    }
  }, [overview, selectedUpgradeId]);

  const selectPolicy = (policyId: string) => {
    setSelectedPolicyId(policyId);
    setBackupImport((current) => ({ ...current, policy_id: policyId }));
    setRestoreImport((current) => ({ ...current, policy_id: policyId }));
  };

  const handleRefresh = () => {
    void loadOverview(selectedPolicyId || undefined).catch((loadError) => {
      setLoadState("error");
      setError(loadError instanceof Error ? loadError.message : "Recovery surface loading failed.");
    });
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !createConfigValidation.valid) {
      return;
    }
    try {
      setError("");
      setMessage("");
      const targetConfig = parseJsonInput(createForm.target_config_json, "Target config");
      const response = await createRecoveryBackupPolicy({
        policy_id: createForm.policy_id || undefined,
        label: createForm.label,
        status: createForm.status,
        target_class: createForm.target_class,
        target_label: createForm.target_label,
        target_config: targetConfig,
        protected_data_classes: createForm.protected_data_classes,
        expected_source_identity: {
          source_database: createForm.source_database,
          cluster_system_identifier: createForm.cluster_system_identifier,
          deployment_slug: createForm.deployment_slug,
          public_fqdn: createForm.public_fqdn,
        },
        schedule_hint: createForm.schedule_hint,
        max_backup_age_hours: createForm.max_backup_age_hours,
        max_restore_age_hours: createForm.max_restore_age_hours,
        notes: createForm.notes,
      });
      await loadOverview(response.policy.policy.policy_id);
      setCreateForm(DEFAULT_CREATE_FORM);
      setPolicyDrawerMode("closed");
      setMessage(`Recovery policy ${response.policy.policy.label} created.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Recovery policy creation failed.");
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !selectedPolicy || !editConfigValidation.valid) {
      return;
    }
    try {
      setError("");
      setMessage("");
      const targetConfig = parseJsonInput(editForm.target_config_json, "Target config");
      const response = await updateRecoveryBackupPolicy(selectedPolicy.policy.policy_id, {
        label: editForm.label,
        status: editForm.status,
        target_label: editForm.target_label,
        target_config: targetConfig,
        protected_data_classes: editForm.protected_data_classes,
        expected_source_identity: {
          source_database: editForm.source_database,
          cluster_system_identifier: editForm.cluster_system_identifier,
          deployment_slug: editForm.deployment_slug,
          public_fqdn: editForm.public_fqdn,
        },
        schedule_hint: editForm.schedule_hint,
        max_backup_age_hours: editForm.max_backup_age_hours,
        max_restore_age_hours: editForm.max_restore_age_hours,
        notes: editForm.notes,
      });
      await loadOverview(response.policy.policy.policy_id);
      setPolicyDrawerMode("closed");
      setMessage(`Recovery policy ${response.policy.policy.label} updated.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Recovery policy update failed.");
    }
  };

  const handleBackupImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !backupImport.policy_id || !backupValidation.valid || !backupValidation.payload) {
      return;
    }
    try {
      setError("");
      setMessage("");
      const response = await importRecoveryBackupReport({
        policy_id: backupImport.policy_id,
        manifest: backupValidation.payload,
        protected_data_classes: backupImport.protected_data_classes,
        notes: backupImport.notes,
      });
      setBackupImportResult({
        title: `Backup import: ${response.policy.policy.label}`,
        statusLabel: response.report.status,
        tone: response.report.status === "ok" ? "success" : response.report.status === "failed" ? "danger" : "warning",
        details: [
          `created_at=${response.report.created_at}`,
          `backup_path=${response.report.backup_path}`,
          `coverage_match=${String(response.report.coverage_match)}`,
          `source_identity_match=${String(response.report.source_identity_match)}`,
        ],
        raw: response.report.raw_report,
      });
      await loadOverview(response.policy.policy.policy_id);
      setMessage(`Backup report imported for ${response.policy.policy.label}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Backup report import failed.");
    }
  };

  const handleRestoreImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !restoreImport.policy_id || !restoreValidation.valid || !restoreValidation.payload) {
      return;
    }
    try {
      setError("");
      setMessage("");
      const response = await importRecoveryRestoreReport({
        policy_id: restoreImport.policy_id,
        report: restoreValidation.payload,
        protected_data_classes: restoreImport.protected_data_classes,
        notes: restoreImport.notes,
      });
      setRestoreImportResult({
        title: `Restore import: ${response.policy.policy.label}`,
        statusLabel: response.report.status,
        tone: response.report.status === "ok" ? "success" : response.report.status === "failed" ? "danger" : "warning",
        details: [
          `created_at=${response.report.created_at}`,
          `restored_database=${response.report.restored_database}`,
          `tables_compared=${response.report.tables_compared}`,
          `source_identity_match=${String(response.report.source_identity_match)}`,
        ],
        raw: response.report.raw_report,
      });
      await loadOverview(response.policy.policy.policy_id);
      setMessage(`Restore report imported for ${response.policy.policy.label}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Restore report import failed.");
    }
  };

  const handleUpgradeImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !upgradeValidation.valid || !upgradeValidation.payload) {
      return;
    }
    try {
      setError("");
      setMessage("");
      const response = await importRecoveryUpgradeReport({
        report: upgradeValidation.payload,
        notes: upgradeImport.notes,
      });
      setUpgradeImportResult({
        title: `Upgrade import: ${response.report.release_id}`,
        statusLabel: response.report.status,
        tone: response.report.status === "ok" ? "success" : response.report.status === "failed" ? "danger" : "warning",
        details: [
          `target_version=${response.report.target_version}`,
          `upgrade_result=${response.report.upgrade_result}`,
          `no_loss_ok=${String(response.report.no_loss_ok)}`,
          `queue_drain_ok=${String(response.report.queue_drain_ok)}`,
        ],
        raw: response.report.raw_report,
      });
      await loadOverview();
      setUpgradeImport(DEFAULT_UPGRADE_IMPORT_FORM);
      setMessage(`Upgrade proof imported for ${response.report.release_id}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Upgrade proof import failed.");
    }
  };

  // ── Derived data ──────────────────────────────────────────

  const blockedCoverageRows = coverageRows
    .filter((row) => row.severity > 0)
    .sort((left, right) => right.severity - left.severity || left.dataClass.localeCompare(right.dataClass));

  const protectedClasses = coverageRows.filter((row) => row.protectedStatusKey === "ready").length;
  const restoreTestedClasses = coverageRows.filter((row) => row.lastRestoreAt !== null).length;
  const neverTestedPolicies = restoreRows.filter((row) => row.statusKey === "blocked" && row.evidenceAt === null).length;

  // ── Build attention items from recovery posture ──────────
  const attentionItems: AttentionPayload[] = [];

  if (overview) {
    const runtimeStatus = overview.summary.runtime_status;
    const upgradeStatus = overview.upgrade_posture.runtime_status;

    if (runtimeStatus === "blocked") {
      const blockedClasses = coverageRows.filter((r) => r.statusKey === "blocked");
      attentionItems.push({
        key: "recovery-blocked",
        level: "primary_blocker",
        title: blockedClasses.length > 0
          ? `${blockedClasses[0].blocker}`
          : "Recovery posture is blocked — review policies and evidence.",
        description: `${blockedClasses.length} data class(es) need attention.`,
      });
    } else if (runtimeStatus === "warning") {
      attentionItems.push({
        key: "recovery-degraded",
        level: "needs_action",
        title: "Recovery posture is degraded — review stale or partial evidence.",
        description: `${neverTestedPolicies} policy path(s) still have no restore proof.`,
      });
    }

    if (upgradeStatus === "blocked") {
      attentionItems.push({
        key: "upgrade-blocked",
        level: "warning",
        title: "Upgrade integrity is missing or degraded.",
        description: overview.upgrade_posture.blockers.join(", ") || "Import upgrade proof to validate.",
      });
    } else if (upgradeStatus === "ok") {
      attentionItems.push({
        key: "upgrade-ok",
        level: "healthy",
        title: "Upgrade integrity is proven.",
      });
    }

    if (runtimeStatus === "ok") {
      attentionItems.push({
        key: "recovery-healthy",
        level: "healthy",
        title: "Recovery posture is healthy.",
      });
    }
  }

  const summaryItems = overview
    ? [
        {
          key: "classes",
          label: "Protected classes" as const,
          value: `${protectedClasses}/${DATA_CLASSES.length}` as string,
          tone: (protectedClasses === DATA_CLASSES.length ? "success" : "danger") as "success" | "danger",
          status: (protectedClasses === DATA_CLASSES.length ? "ready" : "blocked") as "ready" | "blocked",
        },
        {
          key: "restore",
          label: "Restore-tested" as const,
          value: `${restoreTestedClasses}/${DATA_CLASSES.length}` as string,
          tone: (restoreTestedClasses === DATA_CLASSES.length ? "success" : "danger") as "success" | "danger",
          status: (restoreTestedClasses === DATA_CLASSES.length ? "ready" : "blocked") as "ready" | "blocked",
        },
        {
          key: "policies",
          label: "Policy posture" as const,
          value: `${overview.summary.healthy_policies} healthy / ${overview.summary.blocked_policies} blocked` as string,
          tone: toneForRuntimeStatus(overview.summary.runtime_status) as "success" | "warning" | "danger",
          status: statusKeyForRuntimeStatus(overview.summary.runtime_status) as "ready" | "partial" | "blocked",
        },
        {
          key: "upgrade",
          label: "Upgrade / rollback" as const,
          value: overview.upgrade_posture.latest_release_id ?? "missing" as string,
          tone: toneForRuntimeStatus(overview.upgrade_posture.runtime_status) as "success" | "warning" | "danger",
          status: statusKeyForRuntimeStatus(overview.upgrade_posture.runtime_status) as "ready" | "partial" | "blocked",
        },
      ]
    : undefined;

  const sectionLabels: Record<SectionKey, string> = {
    overview: "Overview",
    policies: "Policies",
    backup: "Backup Evidence",
    restore: "Restore Evidence",
    upgrade: "Upgrade / Rollback",
  };

  // ── DataTable column definitions ──────────────────────────

  const coverageColumns: DataTableColumn<CoverageRow>[] = [
    {
      id: "dataClass",
      header: "Data class",
      accessorFn: (row) => (
        <Button variant="tertiary" density="compact" onPress={() => setSelectedCoverageKey(row.dataClass)}>
          <div className="text-left">
            <strong>{row.dataClass}</strong>
            <div className="fg-muted text-xs">{row.policyLabels}</div>
          </div>
        </Button>
      ),
    },
    {
      id: "protected",
      header: "Protected",
      accessorFn: (row) => (
        <StatusBadge tone={toneForStatus(row.protectedStatusKey)} status={row.protectedStatusKey}>
          {row.protectedLabel}
        </StatusBadge>
      ),
    },
    {
      id: "backupTargets",
      header: "Backup target",
      accessorFn: (row) => row.backupTargets,
    },
    {
      id: "lastBackup",
      header: "Last backup",
      accessorFn: (row) => formatTimestamp(row.lastBackupAt),
    },
    {
      id: "lastRestore",
      header: "Last restore test",
      accessorFn: (row) => formatTimestamp(row.lastRestoreAt),
    },
    {
      id: "risk",
      header: "Risk",
      accessorFn: (row) => (
        <StatusBadge tone={row.riskTone} status={row.statusKey}>
          {row.riskLabel}
        </StatusBadge>
      ),
    },
  ];

  const policyColumns: DataTableColumn<RecoveryPolicySummary>[] = [
    {
      id: "policy",
      header: "Policy",
      accessorFn: (row) => (
        <Button variant="tertiary" density="compact" onPress={() => selectPolicy(row.policy.policy_id)}>
          <div className="text-left">
            <strong>{row.policy.label}</strong>
            <div className="fg-muted text-xs">{row.policy.policy_id}</div>
          </div>
        </Button>
      ),
    },
    {
      id: "status",
      header: "Posture",
      accessorFn: (row) => (
        <StatusBadge tone={toneForStatus(statusKeyForPolicy(row))} status={statusKeyForPolicy(row)}>
          {policyStatusLabel(row)}
        </StatusBadge>
      ),
    },
    {
      id: "coverage",
      header: "Protected classes",
      accessorFn: (row) => row.policy.protected_data_classes.join(", "),
    },
    {
      id: "backup",
      header: "Backup",
      accessorFn: (row) => formatTimestamp(row.latest_backup?.created_at),
    },
    {
      id: "restore",
      header: "Restore",
      accessorFn: (row) => formatTimestamp(row.latest_restore?.created_at),
    },
  ];

  const backupColumns: DataTableColumn<PolicyEvidenceRow>[] = [
    {
      id: "policy",
      header: "Policy",
      accessorFn: (row) => (
        <Button variant="tertiary" density="compact" onPress={() => selectPolicy(row.policy.policy.policy_id)}>
          <div className="text-left">
            <strong>{row.policy.policy.label}</strong>
            <div className="fg-muted text-xs">{row.policy.validation.target_locator || row.policy.policy.target_label || row.policy.policy.target_class}</div>
          </div>
        </Button>
      ),
    },
    {
      id: "status",
      header: "Backup evidence",
      accessorFn: (row) => (
        <StatusBadge tone={row.tone} status={row.statusKey}>
          {row.statusLabel}
        </StatusBadge>
      ),
    },
    {
      id: "evidence",
      header: "Last import",
      accessorFn: (row) => formatTimestamp(row.evidenceAt),
    },
    {
      id: "coverage",
      header: "Protected classes",
      accessorFn: (row) => row.policy.policy.protected_data_classes.join(", "),
    },
    {
      id: "blocker",
      header: "Result",
      accessorFn: (row) => row.blocker,
    },
  ];

  const restoreColumns: DataTableColumn<PolicyEvidenceRow>[] = [
    {
      id: "policy",
      header: "Policy",
      accessorFn: (row) => (
        <Button variant="tertiary" density="compact" onPress={() => selectPolicy(row.policy.policy.policy_id)}>
          <div className="text-left">
            <strong>{row.policy.policy.label}</strong>
            <div className="fg-muted text-xs">{row.policy.policy.target_class}</div>
          </div>
        </Button>
      ),
    },
    {
      id: "status",
      header: "Restore evidence",
      accessorFn: (row) => (
        <StatusBadge tone={row.tone} status={row.statusKey}>
          {row.statusLabel}
        </StatusBadge>
      ),
    },
    {
      id: "evidence",
      header: "Last restore test",
      accessorFn: (row) => formatTimestamp(row.evidenceAt),
    },
    {
      id: "tables",
      header: "Tables compared",
      accessorFn: (row) => row.policy.latest_restore?.tables_compared ?? 0,
    },
    {
      id: "blocker",
      header: "Result",
      accessorFn: (row) => row.blocker,
    },
  ];

  const upgradeColumns: DataTableColumn<UpgradeRow>[] = [
    {
      id: "release",
      header: "Release",
      accessorFn: (row) => (
        <Button variant="tertiary" density="compact" onPress={() => setSelectedUpgradeId(row.report.report_id)}>
          <div className="text-left">
            <strong>{row.report.release_id}</strong>
            <div className="fg-muted text-xs">{row.report.target_version}</div>
          </div>
        </Button>
      ),
    },
    {
      id: "status",
      header: "Upgrade posture",
      accessorFn: (row) => (
        <StatusBadge tone={row.tone} status={row.statusKey}>
          {row.statusLabel}
        </StatusBadge>
      ),
    },
    {
      id: "evidence",
      header: "Imported at",
      accessorFn: (row) => formatTimestamp(row.report.imported_at),
    },
    {
      id: "rollback",
      header: "Rollback class",
      accessorFn: (row) => row.report.rollback_classification,
    },
    {
      id: "blocker",
      header: "Result",
      accessorFn: (row) => row.blocker,
    },
  ];

  const drawerForm = policyDrawerMode === "create" ? createForm : editForm;
  const setDrawerForm = policyDrawerMode === "create" ? setCreateForm : setEditForm;
  const drawerValidation = policyDrawerMode === "create" ? createConfigValidation : editConfigValidation;
  const drawerFormValidation = validatePolicyForm(drawerForm, drawerValidation, policyDrawerMode);
  const drawerFormId = policyDrawerMode === "create" ? "recovery-policy-create-form" : "recovery-policy-edit-form";

  // ── Loading / error states ────────────────────────────────
  if (loadState === "loading" && !overview) {
    return (
      <IncidentResponsePage
        eyebrow="Operations"
        title="Recovery / Backup / Restore"
        description="Backup coverage, restore proof, and upgrade integrity."
        noIncidents
        noIncidentsConfig={{
          title: "Loading recovery posture",
          description: "Loading coverage, backup evidence, restore evidence.",
        }}
      />
    );
  }

  if (loadState === "error" && !overview) {
    return (
      <IncidentResponsePage
        eyebrow="Operations"
        title="Recovery / Backup / Restore"
        description="Recovery posture loading failed."
        attentionItems={[
          { key: "load-error", level: "primary_blocker", title: error || "Recovery surface loading failed.", description: "Retry to reload recovery posture data." },
        ]}
        noIncidents
        noIncidentsConfig={{
          title: "Recovery surface failed",
          description: error || "An unexpected error occurred.",
        }}
        actions={[
          { label: "Retry", kind: "primary", intent: "run", onClick: handleRefresh },
        ]}
      />
    );
  }

  const drawerActions = (
    <div className="flex gap-2">
      <Button variant="secondary" onPress={() => setPolicyDrawerMode("closed")}>
        Cancel
      </Button>
      <Button
        variant="primary"
        isDisabled={!canMutate || !drawerFormValidation.valid || (policyDrawerMode === "edit" && !selectedPolicy)}
        onPress={() => {
          const form = document.getElementById(drawerFormId) as HTMLFormElement | null;
          form?.requestSubmit();
        }}
      >
        {policyDrawerMode === "create" ? "Create recovery policy" : "Save selected policy"}
      </Button>
    </div>
  );

  const diagnosticsContent = (
    <div className="fg-stack">
      {overview ? (
        <>
          <p>Total policies: {overview.summary.total_policies}</p>
          <p>Fresh backup: {overview.summary.fresh_backup_policies}, fresh restore: {overview.summary.fresh_restore_policies}</p>
          <p>Source identity verified: {overview.summary.source_identity_verified_policies}</p>
          <p>Upgrade blocker: {overview.upgrade_posture.blockers.join(", ") || "none"}</p>
        </>
      ) : null}
      {error ? <p className="fg-danger">{error}</p> : null}
    </div>
  );

  return (
    <IncidentResponsePage
      eyebrow="Operations"
      title="Recovery / Backup / Restore"
      description="Backup coverage, restore proof, upgrade integrity, and source identity."
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Recovery diagnostics"
      actions={[
        { label: "Refresh", kind: "secondary" as const, intent: "run" as const, onClick: handleRefresh },
        ...(activeSection === "policies" && canMutate
          ? [
              { label: "Create policy", kind: "primary" as const, intent: "configure" as const, onClick: () => setPolicyDrawerMode("create") },
              { label: "Edit policy", kind: "secondary" as const, intent: "configure" as const, disabled: !selectedPolicy, onClick: () => setPolicyDrawerMode("edit") },
            ]
          : []),
      ]}
    >
      {/* Section tab bar */}
      <ActionBar
        title={sectionLabels[activeSection]}
        actions={(
          <div className="flex gap-2 flex-wrap">
            {(["overview", "policies", "backup", "restore", "upgrade"] as SectionKey[]).map((section) => (
              <Button
                key={section}
                variant={activeSection === section ? "primary" : "secondary"}
                density="compact"
                onPress={() => setActiveSection(section)}
              >
                {sectionLabels[section]}
              </Button>
            ))}
          </div>
        )}
      />

      {message ? <p className="text-muted mb-2">{message}</p> : null}

      {/* ── Overview section ── */}
      {overview && activeSection === "overview" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <DataTable
              title="Coverage summary"
              description="Protected data classes, backup targets, and risk posture."
              data={coverageRows}
              columns={coverageColumns}
              rowKey={(row) => row.key}
              selectedRowId={selectedCoverage?.key ?? null}
              onSelectedRowChange={(key) => {
                if (key) {
                  const row = coverageRows.find((r) => r.key === key);
                  if (row) setSelectedCoverageKey(row.dataClass);
                }
              }}
              enablePagination={false}
              showSearch={false}
              showPresets={false}
            />

            {blockedCoverageRows.length > 0 ? (
              <DataTable
                title="Current recovery risks"
                description="Hardest gaps surfaced first."
                data={blockedCoverageRows}
                columns={[
                  {
                    id: "dataClass",
                    header: "Data class",
                    accessorFn: (row) => (
                      <div>
                        <strong>{row.dataClass}</strong>
                        <div className="fg-muted text-xs">{row.policyLabels}</div>
                      </div>
                    ),
                  },
                  {
                    id: "risk",
                    header: "Risk",
                    accessorFn: (row) => (
                      <StatusBadge tone={row.riskTone} status={row.statusKey}>
                        {row.riskLabel}
                      </StatusBadge>
                    ),
                  },
                  {
                    id: "blocker",
                    header: "Reason",
                    accessorFn: (row) => row.blocker,
                  },
                ]}
                rowKey={(row) => row.key}
                enablePagination={false}
                showSearch={false}
                showPresets={false}
              />
            ) : null}
          </div>

          <div className="ff-operator-sidebar">
            <DetailPanel
              title={selectedCoverage?.dataClass ?? "Coverage details"}
              description={selectedCoverage ? "Data-class posture and evidence." : "Select a data class to inspect."}
              status={selectedCoverage?.riskLabel}
              statusTone={selectedCoverage?.riskTone}
              statusKey={selectedCoverage?.statusKey}
              sticky
            >
              {selectedCoverage ? (
                <div className="fg-stack">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Coverage truth</h4>
                    <p>Protected by: {selectedCoverage.policyLabels}</p>
                    <p>Protected status: {selectedCoverage.protectedLabel}</p>
                    <p>Backup target: {selectedCoverage.backupTargets}</p>
                    <p>Last backup: {formatTimestamp(selectedCoverage.lastBackupAt)}</p>
                    <p>Last restore test: {formatTimestamp(selectedCoverage.lastRestoreAt)}</p>
                    <p>Risk: {selectedCoverage.blocker}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-1">Next action</h4>
                    <p>{selectedCoverage.statusKey === "ready" ? "Keep the latest backup and restore cadence current." : "Open the relevant section below and close the missing proof."}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button variant="navigation" density="compact" onPress={() => setActiveSection("policies")}>
                        Review Policies
                      </Button>
                      <Button variant="navigation" density="compact" onPress={() => setActiveSection("backup")}>
                        Review Backup Evidence
                      </Button>
                      <Button variant="navigation" density="compact" onPress={() => setActiveSection("restore")}>
                        Review Restore Evidence
                      </Button>
                    </div>
                  </div>

                  <AdvancedDiagnostics
                    title="Coverage notes"
                    description="Policy and evidence fragments backing this data-class posture."
                    status={selectedCoverage.riskLabel}
                    statusTone={selectedCoverage.riskTone}
                    statusKey={selectedCoverage.statusKey}
                  >
                    <ul className="fg-list">
                      {selectedCoverage.notes.map((note, index) => <li key={`${selectedCoverage.key}-${index}`}>{note}</li>)}
                    </ul>
                  </AdvancedDiagnostics>
                </div>
              ) : null}
            </DetailPanel>
          </div>
        </div>
      ) : null}

      {/* ── Policies section ── */}
      {overview && activeSection === "policies" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <DataTable
              title="Policies"
              description="Policy inventory with freshness, identity, and restore posture."
              data={overview.policies}
              columns={policyColumns}
              rowKey={(row) => row.policy.policy_id}
              selectedRowId={selectedPolicy?.policy.policy_id ?? null}
              onSelectedRowChange={(id) => {
                if (id) selectPolicy(id);
              }}
              enablePagination={false}
              showSearch={false}
              showPresets={false}
            />
          </div>

          <div className="ff-operator-sidebar">
            <DetailPanel
              title={selectedPolicy?.policy.label ?? "Selected policy"}
              description={selectedPolicy ? "Target contract, source identity, and the latest evidence for the selected policy." : "Select a policy to inspect it."}
              status={selectedPolicy ? policyStatusLabel(selectedPolicy) : undefined}
              statusTone={selectedPolicy ? toneForStatus(statusKeyForPolicy(selectedPolicy)) : "neutral"}
              statusKey={selectedPolicy ? statusKeyForPolicy(selectedPolicy) : undefined}
              sticky
            >
              {selectedPolicy ? (
                <div className="fg-stack">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Policy contract</h4>
                    <p>Target class: {selectedPolicy.policy.target_class}</p>
                    <p>Target label: {selectedPolicy.policy.target_label || "n/a"}</p>
                    <p>Target locator: {selectedPolicy.validation.target_locator || "n/a"}</p>
                    <p>Schedule hint: {selectedPolicy.policy.schedule_hint || "n/a"}</p>
                    <p>Backup age budget: {selectedPolicy.policy.max_backup_age_hours}h</p>
                    <p>Restore age budget: {selectedPolicy.policy.max_restore_age_hours}h</p>
                    <p>Protected classes: {selectedPolicy.policy.protected_data_classes.join(", ")}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-1">Restore contract</h4>
                    <p>{selectedPolicy.latest_restore ? `Latest restore test: ${selectedPolicy.latest_restore.created_at}` : "Restore never tested for this policy."}</p>
                    <p>{selectedPolicy.latest_backup ? `Latest backup: ${selectedPolicy.latest_backup.created_at}` : "No backup evidence imported yet."}</p>
                    <p>{selectedPolicy.latest_backup && !selectedPolicy.latest_restore ? "Backup exists, but this policy is still blocked until a restore test is imported." : "Backup and restore posture are evaluated separately."}</p>
                  </div>

                  <AdvancedDiagnostics
                    title="Policy validation and mismatches"
                    description="Raw validation reasons and mismatch truth for the selected policy."
                    status={selectedPolicy.validation.state}
                    statusTone={toneForRuntimeStatus(selectedPolicy.validation.state)}
                    statusKey={selectedPolicy.validation.state === "ok" ? "ready" : selectedPolicy.validation.state === "blocked" ? "blocked" : "partial"}
                  >
                    <ul className="fg-list">
                      <li>Validation checked at: {selectedPolicy.validation.checked_at}</li>
                      <li>Validation reasons: {selectedPolicy.validation.reasons.join(", ") || "none"}</li>
                      <li>Mismatches: {selectedPolicy.mismatches.join(", ") || "none"}</li>
                      <li>Expected source database: {selectedPolicy.policy.expected_source_identity.source_database || "n/a"}</li>
                      <li>Expected cluster identifier: {selectedPolicy.policy.expected_source_identity.cluster_system_identifier || "n/a"}</li>
                    </ul>
                  </AdvancedDiagnostics>
                </div>
              ) : null}
            </DetailPanel>
          </div>
        </div>
      ) : null}

      {/* ── Backup section ── */}
      {overview && activeSection === "backup" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <DataTable
              title="Backup Evidence"
              description="Imported backup manifests per policy."
              data={backupRows}
              columns={backupColumns}
              rowKey={(row) => row.key}
              selectedRowId={selectedPolicy?.policy.policy_id ?? null}
              onSelectedRowChange={(id) => {
                if (id) selectPolicy(id);
              }}
              enablePagination={false}
              showSearch={false}
              showPresets={false}
            />
          </div>

          <div className="ff-operator-sidebar">
            <DetailPanel
              title={selectedPolicy?.policy.label ?? "Backup import"}
              description="Import backup manifest with validation and evidence result."
              status={backupValidation.valid ? "report valid" : "report invalid"}
              statusTone={backupValidation.valid ? "success" : "danger"}
              statusKey={backupValidation.valid ? "ready" : "blocked"}
              sticky
            >
              <div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Import backup manifest</h4>
                  <form className="fg-stack" onSubmit={handleBackupImport}>
                    <label>
                      Policy
                      <select value={backupImport.policy_id} onChange={(event) => setBackupImport((current) => ({ ...current, policy_id: event.target.value }))}>
                        {overview.policies.map((item) => <option key={`backup-${item.policy.policy_id}`} value={item.policy.policy_id}>{item.policy.label}</option>)}
                      </select>
                    </label>
                    <fieldset className="fg-stack">
                      <legend>Protected data classes</legend>
                      {DATA_CLASSES.map((item) => (
                        <label key={`backup-report-${item}`}>
                          <input
                            type="checkbox"
                            checked={backupImport.protected_data_classes.includes(item)}
                            onChange={() => setBackupImport((current) => ({ ...current, protected_data_classes: toggleClass(current.protected_data_classes, item) }))}
                          />
                          {item}
                        </label>
                      ))}
                    </fieldset>
                    <label>
                      Backup manifest JSON
                      <textarea rows={12} value={backupImport.payload_json} onChange={(event) => setBackupImport((current) => ({ ...current, payload_json: event.target.value }))} />
                    </label>
                    {backupValidation.errors.length > 0 ? (
                      <ul className="fg-list fg-danger">
                        {backupValidation.errors.map((item, index) => <li key={`backup-validation-${index}`}>{item}</li>)}
                      </ul>
                    ) : <p className="fg-muted">Backup manifest passed semantic validation and is ready for import.</p>}
                    <label>
                      Notes
                      <textarea rows={3} value={backupImport.notes} onChange={(event) => setBackupImport((current) => ({ ...current, notes: event.target.value }))} />
                    </label>
                    <div className="fg-actions">
                      <Button type="submit" variant="primary" isDisabled={!canMutate || !backupImport.policy_id || !backupValidation.valid}>
                        Import backup manifest
                      </Button>
                    </div>
                  </form>
                </div>

                {backupImportResult ? (
                  <AdvancedDiagnostics
                    title={backupImportResult.title}
                    description="The most recent accepted backup import result."
                    status={backupImportResult.statusLabel}
                    statusTone={backupImportResult.tone}
                  >
                    <ul className="fg-list">
                      {backupImportResult.details.map((detail, index) => <li key={`backup-result-${index}`}>{detail}</li>)}
                    </ul>
                    <pre>{JSON.stringify(backupImportResult.raw, null, 2)}</pre>
                  </AdvancedDiagnostics>
                ) : null}
              </div>
            </DetailPanel>
          </div>
        </div>
      ) : null}

      {/* ── Restore section ── */}
      {overview && activeSection === "restore" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <DataTable
              title="Restore Evidence"
              description="Imported restore reports per policy."
              data={restoreRows}
              columns={restoreColumns}
              rowKey={(row) => row.key}
              selectedRowId={selectedPolicy?.policy.policy_id ?? null}
              onSelectedRowChange={(id) => {
                if (id) selectPolicy(id);
              }}
              enablePagination={false}
              showSearch={false}
              showPresets={false}
            />
          </div>

          <div className="ff-operator-sidebar">
            <DetailPanel
              title={selectedPolicy?.policy.label ?? "Restore import"}
              description="Import restore report with validation and visible result."
              status={restoreValidation.valid ? "report valid" : "report invalid"}
              statusTone={restoreValidation.valid ? "success" : "danger"}
              statusKey={restoreValidation.valid ? "ready" : "blocked"}
              sticky
            >
              <div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Import restore report</h4>
                  <p className="mb-2">{selectedPolicy?.latest_restore ? `Latest restore proof: ${selectedPolicy.latest_restore.created_at}` : "No restore proof exists for the selected policy yet."}</p>
                  <form className="fg-stack" onSubmit={handleRestoreImport}>
                    <label>
                      Policy
                      <select value={restoreImport.policy_id} onChange={(event) => setRestoreImport((current) => ({ ...current, policy_id: event.target.value }))}>
                        {overview.policies.map((item) => <option key={`restore-${item.policy.policy_id}`} value={item.policy.policy_id}>{item.policy.label}</option>)}
                      </select>
                    </label>
                    <fieldset className="fg-stack">
                      <legend>Protected data classes</legend>
                      {DATA_CLASSES.map((item) => (
                        <label key={`restore-report-${item}`}>
                          <input
                            type="checkbox"
                            checked={restoreImport.protected_data_classes.includes(item)}
                            onChange={() => setRestoreImport((current) => ({ ...current, protected_data_classes: toggleClass(current.protected_data_classes, item) }))}
                          />
                          {item}
                        </label>
                      ))}
                    </fieldset>
                    <label>
                      Restore report JSON
                      <textarea rows={12} value={restoreImport.payload_json} onChange={(event) => setRestoreImport((current) => ({ ...current, payload_json: event.target.value }))} />
                    </label>
                    {restoreValidation.errors.length > 0 ? (
                      <ul className="fg-list fg-danger">
                        {restoreValidation.errors.map((item, index) => <li key={`restore-validation-${index}`}>{item}</li>)}
                      </ul>
                    ) : <p className="fg-muted">Restore report passed semantic validation and is ready for import.</p>}
                    <label>
                      Notes
                      <textarea rows={3} value={restoreImport.notes} onChange={(event) => setRestoreImport((current) => ({ ...current, notes: event.target.value }))} />
                    </label>
                    <div className="fg-actions">
                      <Button type="submit" variant="primary" isDisabled={!canMutate || !restoreImport.policy_id || !restoreValidation.valid}>
                        Import restore report
                      </Button>
                    </div>
                  </form>
                </div>

                {restoreImportResult ? (
                  <AdvancedDiagnostics
                    title={restoreImportResult.title}
                    description="The most recent accepted restore import result."
                    status={restoreImportResult.statusLabel}
                    statusTone={restoreImportResult.tone}
                  >
                    <ul className="fg-list">
                      {restoreImportResult.details.map((detail, index) => <li key={`restore-result-${index}`}>{detail}</li>)}
                    </ul>
                    <pre>{JSON.stringify(restoreImportResult.raw, null, 2)}</pre>
                  </AdvancedDiagnostics>
                ) : null}
              </div>
            </DetailPanel>
          </div>
        </div>
      ) : null}

      {/* ── Upgrade section ── */}
      {overview && activeSection === "upgrade" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <DataTable
              title="Upgrade / Rollback"
              description="Upgrade proof with rollback and no-loss evidence."
              data={upgradeRows}
              columns={upgradeColumns}
              rowKey={(row) => row.key}
              enablePagination={false}
              showSearch={false}
              showPresets={false}
            />
          </div>

          <div className="ff-operator-sidebar">
            <DetailPanel
              title={selectedUpgrade?.release_id ?? "Upgrade import"}
              description="Import upgrade proof and inspect rollback, queue-drain, and no-loss truth."
              status={overview.upgrade_posture.runtime_status}
              statusTone={toneForRuntimeStatus(overview.upgrade_posture.runtime_status)}
              statusKey={statusKeyForRuntimeStatus(overview.upgrade_posture.runtime_status)}
              sticky
            >
              <div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Upgrade posture</h4>
                  <p>Latest release: {overview.upgrade_posture.latest_release_id ?? "missing"}</p>
                  <p>Target version: {overview.upgrade_posture.latest_target_version ?? "missing"}</p>
                  <p>No-loss proof: {String(overview.upgrade_posture.latest_no_loss_ok)}</p>
                  <p>Queue drained: {String(overview.upgrade_posture.latest_queue_drain_ok)}</p>
                  <p>Source identity stable: {String(overview.upgrade_posture.latest_source_identity_stable)}</p>
                  <p>Blockers: {overview.upgrade_posture.blockers.join(", ") || "none"}</p>
                  <p>Cross-check route: <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.releaseValidation}>View Release / Validation</Link></p>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-1">Import upgrade proof</h4>
                  <form className="fg-stack" onSubmit={handleUpgradeImport}>
                    <label>
                      Upgrade proof JSON
                      <textarea rows={14} value={upgradeImport.payload_json} onChange={(event) => setUpgradeImport((current) => ({ ...current, payload_json: event.target.value }))} />
                    </label>
                    {upgradeValidation.errors.length > 0 ? (
                      <ul className="fg-list fg-danger">
                        {upgradeValidation.errors.map((item, index) => <li key={`upgrade-validation-${index}`}>{item}</li>)}
                      </ul>
                    ) : <p className="fg-muted">Upgrade report passed semantic validation and is ready for import.</p>}
                    <label>
                      Notes
                      <textarea rows={3} value={upgradeImport.notes} onChange={(event) => setUpgradeImport((current) => ({ ...current, notes: event.target.value }))} />
                    </label>
                    <div className="fg-actions">
                      <Button type="submit" variant="primary" isDisabled={!canMutate || !upgradeValidation.valid}>
                        Import upgrade proof
                      </Button>
                    </div>
                  </form>
                </div>

                {upgradeImportResult ? (
                  <AdvancedDiagnostics
                    title={upgradeImportResult.title}
                    description="The most recent accepted upgrade import result."
                    status={upgradeImportResult.statusLabel}
                    statusTone={upgradeImportResult.tone}
                  >
                    <ul className="fg-list">
                      {upgradeImportResult.details.map((detail, index) => <li key={`upgrade-result-${index}`}>{detail}</li>)}
                    </ul>
                    <pre>{JSON.stringify(upgradeImportResult.raw, null, 2)}</pre>
                  </AdvancedDiagnostics>
                ) : null}

                {selectedUpgrade ? (
                  <AdvancedDiagnostics
                    title="Selected upgrade proof"
                    description="Before/after migration and object-count truth for the selected report."
                    status={selectedUpgrade.status}
                    statusTone={selectedUpgrade.status === "ok" ? "success" : selectedUpgrade.status === "failed" ? "danger" : "warning"}
                  >
                    <ul className="fg-list">
                      <li>Before migration version: {selectedUpgrade.before_snapshot.migration_version ?? "n/a"}</li>
                      <li>After migration version: {selectedUpgrade.after_snapshot.migration_version ?? "n/a"}</li>
                      <li>Upgrade result: {selectedUpgrade.upgrade_result}</li>
                      <li>Rollback classification: {selectedUpgrade.rollback_classification}</li>
                      <li>Mismatch reasons: {selectedUpgrade.mismatch_reasons.join(", ") || "none"}</li>
                    </ul>
                  </AdvancedDiagnostics>
                ) : null}
              </div>
            </DetailPanel>
          </div>
        </div>
      ) : null}

      {/* ── Policy create / edit drawer ── */}
      <DetailDrawer
        open={policyDrawerMode !== "closed"}
        title={policyDrawerMode === "create" ? "Create Recovery Policy" : "Edit Recovery Policy"}
        description={policyDrawerMode === "create" ? "Structured policy fields for target class, source identity, and recovery windows." : "Adjust the selected policy without turning the main page back into a long form."}
        status={drawerFormValidation.valid ? "form ready" : "form incomplete"}
        statusTone={drawerFormValidation.valid ? "success" : "danger"}
        onClose={() => setPolicyDrawerMode("closed")}
        actions={drawerActions}
      >
        <form id={drawerFormId} className="fg-stack" onSubmit={policyDrawerMode === "create" ? handleCreate : handleUpdate}>
          {drawerFormValidation.errors.length > 0 ? (
            <ul className="fg-list fg-danger">
              {drawerFormValidation.errors.map((item, index) => <li key={`policy-validation-${index}`}>{item}</li>)}
            </ul>
          ) : (
            <p className="fg-muted">The policy form passed semantic validation and is ready to submit.</p>
          )}
          <section className="fg-subcard">
            <h4>Basics</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Policy ID
                <input
                  value={drawerForm.policy_id}
                  disabled={policyDrawerMode === "edit"}
                  onChange={(event) => setDrawerForm((current) => ({ ...current, policy_id: event.target.value }))}
                  placeholder="backup_policy_offsite"
                />
              </label>
              <label>
                Label
                <input
                  value={drawerForm.label}
                  onChange={(event) => setDrawerForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="Offsite object storage"
                />
              </label>
              <label>
                Status
                <select value={drawerForm.status} onChange={(event) => setDrawerForm((current) => ({ ...current, status: event.target.value as "active" | "paused" }))}>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                </select>
              </label>
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Target contract</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Target class
                <select value={drawerForm.target_class} onChange={(event) => setDrawerForm((current) => ({ ...current, target_class: event.target.value as RecoveryBackupTargetClass }))}>
                  {TARGET_CLASSES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                Target label
                <input
                  value={drawerForm.target_label}
                  onChange={(event) => setDrawerForm((current) => ({ ...current, target_label: event.target.value }))}
                  placeholder="s3://forgeframe-prod"
                />
              </label>
            </div>
            <fieldset className="fg-stack">
              <legend>Protected data classes</legend>
              {DATA_CLASSES.map((item) => (
                <label key={`${policyDrawerMode}-${item}`}>
                  <input
                    type="checkbox"
                    checked={drawerForm.protected_data_classes.includes(item)}
                    onChange={() => setDrawerForm((current) => ({ ...current, protected_data_classes: toggleClass(current.protected_data_classes, item) }))}
                  />
                  {item}
                </label>
              ))}
            </fieldset>
            <label>
              Target config JSON
              <textarea rows={8} value={drawerForm.target_config_json} onChange={(event) => setDrawerForm((current) => ({ ...current, target_config_json: event.target.value }))} />
            </label>
            {drawerValidation.error ? <p className="fg-danger">{drawerValidation.error}</p> : <p className="fg-muted">Target config JSON is valid.</p>}
          </section>

          <section className="fg-subcard">
            <h4>Source identity</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Expected source database
                <input value={drawerForm.source_database} onChange={(event) => setDrawerForm((current) => ({ ...current, source_database: event.target.value }))} />
              </label>
              <label>
                Expected cluster identifier
                <input value={drawerForm.cluster_system_identifier} onChange={(event) => setDrawerForm((current) => ({ ...current, cluster_system_identifier: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Deployment slug
                <input value={drawerForm.deployment_slug} onChange={(event) => setDrawerForm((current) => ({ ...current, deployment_slug: event.target.value }))} />
              </label>
              <label>
                Public FQDN
                <input value={drawerForm.public_fqdn} onChange={(event) => setDrawerForm((current) => ({ ...current, public_fqdn: event.target.value }))} />
              </label>
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Recovery windows</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Schedule hint
                <input value={drawerForm.schedule_hint} onChange={(event) => setDrawerForm((current) => ({ ...current, schedule_hint: event.target.value }))} />
              </label>
              <label>
                Max backup age (hours)
                <input type="number" value={drawerForm.max_backup_age_hours} onChange={(event) => setDrawerForm((current) => ({ ...current, max_backup_age_hours: Number(event.target.value) || 1 }))} />
              </label>
              <label>
                Max restore age (hours)
                <input type="number" value={drawerForm.max_restore_age_hours} onChange={(event) => setDrawerForm((current) => ({ ...current, max_restore_age_hours: Number(event.target.value) || 1 }))} />
              </label>
            </div>
            <label>
              Notes
              <textarea rows={4} value={drawerForm.notes} onChange={(event) => setDrawerForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
          </section>
        </form>
      </DetailDrawer>
    </IncidentResponsePage>
  );
}
