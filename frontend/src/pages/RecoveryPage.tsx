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
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EntityTable, type EntityTableColumn } from "../components/ui/EntityTable";
import { ErrorState, LoadingState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";

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
  key: RecoveryProtectedDataClass;
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
  target_config_json: "{\n  \"path\": \"/var/backups/forgeframe\"\n}",
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
  payload_json: "{\n  \"status\": \"ok\"\n}",
  notes: "",
};
const DEFAULT_UPGRADE_IMPORT_FORM: UpgradeImportFormState = {
  payload_json: "{\n  \"release_id\": \"release-2026-04-23\",\n  \"target_version\": \"0.6.0\",\n  \"upgrade_result\": \"succeeded\",\n  \"rollback_classification\": \"not_needed\",\n  \"failure_classification\": \"none\",\n  \"bootstrap_recovery_state\": \"recovered\",\n  \"queue_drain_ok\": true,\n  \"no_loss_ok\": true,\n  \"before\": {\n    \"captured_at\": \"2026-04-23T08:00:00Z\",\n    \"source_identity\": {\n      \"source_database\": \"forgeframe\",\n      \"cluster_system_identifier\": \"cluster-123\",\n      \"deployment_slug\": \"forgeframe-prod\",\n      \"public_fqdn\": \"forgeframe.example.com\"\n    },\n    \"migration\": { \"latest_version\": 28, \"applied_versions\": [1, 2, 28] },\n    \"critical_object_counts\": { \"runs\": 12, \"run_approval_links\": 3, \"memory_entries\": 8, \"skills\": 2 },\n    \"queue_state_counts\": { \"queued\": 0, \"executing\": 0 }\n  },\n  \"after\": {\n    \"captured_at\": \"2026-04-23T08:10:00Z\",\n    \"source_identity\": {\n      \"source_database\": \"forgeframe\",\n      \"cluster_system_identifier\": \"cluster-123\",\n      \"deployment_slug\": \"forgeframe-prod\",\n      \"public_fqdn\": \"forgeframe.example.com\"\n    },\n    \"migration\": { \"latest_version\": 29, \"applied_versions\": [1, 2, 29] },\n    \"critical_object_counts\": { \"runs\": 12, \"run_approval_links\": 3, \"memory_entries\": 8, \"skills\": 2 },\n    \"queue_state_counts\": { \"queued\": 0, \"executing\": 0 }\n  }\n}",
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

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const normalized = values
    .filter((value): value is string => Boolean(value && value.trim()))
    .sort();
  return normalized.at(-1) ?? null;
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
  if (mode === "create" && form.policy_id.trim() === "") {
    // Optional server-side, but if left blank the generated ID is opaque; keep create flow explicit.
  }
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
      setSelectedCoverageKey(coverageRows[0].key);
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

  const blockedCoverageRows = coverageRows
    .filter((row) => row.severity > 0)
    .sort((left, right) => right.severity - left.severity || left.dataClass.localeCompare(right.dataClass));
  const protectedClasses = coverageRows.filter((row) => row.protectedStatusKey === "ready").length;
  const restoreTestedClasses = coverageRows.filter((row) => row.lastRestoreAt !== null).length;
  const neverTestedPolicies = restoreRows.filter((row) => row.statusKey === "blocked" && row.evidenceAt === null).length;
  const summaryItems: SummaryStripItem[] = [
    {
      key: "classes",
      label: "Protected data classes",
      value: `${protectedClasses}/${DATA_CLASSES.length}`,
      meta: coverageRows.filter((row) => row.statusKey === "blocked" && row.policyLabels === "none").map((row) => row.dataClass).join(", ") || "Every data class has at least one policy.",
      tone: protectedClasses === DATA_CLASSES.length ? "success" : "danger",
      status: protectedClasses === DATA_CLASSES.length ? "ready" : "blocked",
    },
    {
      key: "restore",
      label: "Restore-tested classes",
      value: `${restoreTestedClasses}/${DATA_CLASSES.length}`,
      meta: neverTestedPolicies > 0 ? `${neverTestedPolicies} policy path(s) still have no restore proof. Backup alone is not green.` : "Every protected class has restore evidence.",
      tone: restoreTestedClasses === DATA_CLASSES.length ? "success" : "danger",
      status: restoreTestedClasses === DATA_CLASSES.length ? "ready" : "blocked",
    },
    {
      key: "policies",
      label: "Policy posture",
      value: overview ? `${overview.summary.healthy_policies} healthy / ${overview.summary.blocked_policies} blocked` : "n/a",
      meta: overview ? `fresh backup=${overview.summary.fresh_backup_policies}, fresh restore=${overview.summary.fresh_restore_policies}, source identity verified=${overview.summary.source_identity_verified_policies}` : "Recovery overview not loaded.",
      tone: overview?.summary.runtime_status === "ok" ? "success" : overview?.summary.runtime_status === "blocked" ? "danger" : "warning",
      status: overview ? statusKeyForRuntimeStatus(overview.summary.runtime_status) : "blocked",
    },
    {
      key: "upgrade",
      label: "Upgrade / rollback",
      value: overview?.upgrade_posture.latest_release_id ?? "missing",
      meta: overview?.upgrade_posture.blockers.join(", ") || "Latest no-loss and queue-drain proof are recorded.",
      tone: toneForRuntimeStatus(overview?.upgrade_posture.runtime_status ?? "blocked"),
      status: overview ? statusKeyForRuntimeStatus(overview.upgrade_posture.runtime_status) : "blocked",
    },
  ];

  const sectionLabels: Record<SectionKey, string> = {
    overview: "Overview",
    policies: "Policies",
    backup: "Backup Evidence",
    restore: "Restore Evidence",
    upgrade: "Upgrade / Rollback",
  };
  const sectionDescriptions: Record<SectionKey, string> = {
    overview: "Coverage per data class, last backup, last restore test, and the current risk posture.",
    policies: "Policy inventory, target contract validation, source identity, and recovery windows.",
    backup: "Separated backup evidence imports and the latest manifest truth per policy.",
    restore: "Separated restore-test evidence with hard visibility when restore has never been exercised.",
    upgrade: "Upgrade, rollback, queue-drain, and no-loss proofs with durable results.",
  };

  const coverageColumns: EntityTableColumn<CoverageRow>[] = [
    {
      key: "dataClass",
      header: "Data class",
      render: (row) => (
        <button type="button" className="fg-data-row" onClick={() => setSelectedCoverageKey(row.key)}>
          <div>
            <strong>{row.dataClass}</strong>
            <div className="fg-muted">{row.policyLabels}</div>
          </div>
        </button>
      ),
    },
    {
      key: "protected",
      header: "Protected",
      render: (row) => (
        <StatusBadge tone={toneForStatus(row.protectedStatusKey)} status={row.protectedStatusKey}>
          {row.protectedLabel}
        </StatusBadge>
      ),
    },
    {
      key: "backupTargets",
      header: "Backup target",
      render: (row) => row.backupTargets,
    },
    {
      key: "lastBackup",
      header: "Last backup",
      render: (row) => formatTimestamp(row.lastBackupAt),
    },
    {
      key: "lastRestore",
      header: "Last restore test",
      render: (row) => formatTimestamp(row.lastRestoreAt),
    },
    {
      key: "risk",
      header: "Risk",
      render: (row) => (
        <StatusBadge tone={row.riskTone} status={row.statusKey}>
          {row.riskLabel}
        </StatusBadge>
      ),
    },
  ];
  const policyColumns: EntityTableColumn<RecoveryPolicySummary>[] = [
    {
      key: "policy",
      header: "Policy",
      render: (row) => (
        <button type="button" className="fg-data-row" onClick={() => selectPolicy(row.policy.policy_id)}>
          <div>
            <strong>{row.policy.label}</strong>
            <div className="fg-muted">{row.policy.policy_id}</div>
          </div>
        </button>
      ),
    },
    {
      key: "status",
      header: "Posture",
      render: (row) => (
        <StatusBadge tone={toneForStatus(statusKeyForPolicy(row))} status={statusKeyForPolicy(row)}>
          {policyStatusLabel(row)}
        </StatusBadge>
      ),
    },
    {
      key: "coverage",
      header: "Protected classes",
      render: (row) => row.policy.protected_data_classes.join(", "),
    },
    {
      key: "backup",
      header: "Backup",
      render: (row) => formatTimestamp(row.latest_backup?.created_at),
    },
    {
      key: "restore",
      header: "Restore",
      render: (row) => formatTimestamp(row.latest_restore?.created_at),
    },
  ];
  const backupColumns: EntityTableColumn<PolicyEvidenceRow>[] = [
    {
      key: "policy",
      header: "Policy",
      render: (row) => (
        <button type="button" className="fg-data-row" onClick={() => selectPolicy(row.policy.policy.policy_id)}>
          <div>
            <strong>{row.policy.policy.label}</strong>
            <div className="fg-muted">{row.policy.validation.target_locator || row.policy.policy.target_label || row.policy.policy.target_class}</div>
          </div>
        </button>
      ),
    },
    {
      key: "status",
      header: "Backup evidence",
      render: (row) => (
        <StatusBadge tone={row.tone} status={row.statusKey}>
          {row.statusLabel}
        </StatusBadge>
      ),
    },
    {
      key: "evidence",
      header: "Last import",
      render: (row) => formatTimestamp(row.evidenceAt),
    },
    {
      key: "coverage",
      header: "Protected classes",
      render: (row) => row.policy.policy.protected_data_classes.join(", "),
    },
    {
      key: "blocker",
      header: "Result",
      render: (row) => row.blocker,
    },
  ];
  const restoreColumns: EntityTableColumn<PolicyEvidenceRow>[] = [
    {
      key: "policy",
      header: "Policy",
      render: (row) => (
        <button type="button" className="fg-data-row" onClick={() => selectPolicy(row.policy.policy.policy_id)}>
          <div>
            <strong>{row.policy.policy.label}</strong>
            <div className="fg-muted">{row.policy.policy.target_class}</div>
          </div>
        </button>
      ),
    },
    {
      key: "status",
      header: "Restore evidence",
      render: (row) => (
        <StatusBadge tone={row.tone} status={row.statusKey}>
          {row.statusLabel}
        </StatusBadge>
      ),
    },
    {
      key: "evidence",
      header: "Last restore test",
      render: (row) => formatTimestamp(row.evidenceAt),
    },
    {
      key: "tables",
      header: "Tables compared",
      render: (row) => row.policy.latest_restore?.tables_compared ?? 0,
    },
    {
      key: "blocker",
      header: "Result",
      render: (row) => row.blocker,
    },
  ];
  const upgradeColumns: EntityTableColumn<UpgradeRow>[] = [
    {
      key: "release",
      header: "Release",
      render: (row) => (
        <button type="button" className="fg-data-row" onClick={() => setSelectedUpgradeId(row.report.report_id)}>
          <div>
            <strong>{row.report.release_id}</strong>
            <div className="fg-muted">{row.report.target_version}</div>
          </div>
        </button>
      ),
    },
    {
      key: "status",
      header: "Upgrade posture",
      render: (row) => (
        <StatusBadge tone={row.tone} status={row.statusKey}>
          {row.statusLabel}
        </StatusBadge>
      ),
    },
    {
      key: "evidence",
      header: "Imported at",
      render: (row) => formatTimestamp(row.report.imported_at),
    },
    {
      key: "rollback",
      header: "Rollback class",
      render: (row) => row.report.rollback_classification,
    },
    {
      key: "blocker",
      header: "Result",
      render: (row) => row.blocker,
    },
  ];

  const drawerForm = policyDrawerMode === "create" ? createForm : editForm;
  const setDrawerForm = policyDrawerMode === "create" ? setCreateForm : setEditForm;
  const drawerValidation = policyDrawerMode === "create" ? createConfigValidation : editConfigValidation;
  const drawerFormValidation = validatePolicyForm(drawerForm, drawerValidation, policyDrawerMode);
  const drawerFormId = policyDrawerMode === "create" ? "recovery-policy-create-form" : "recovery-policy-edit-form";

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Recovery / Backup / Restore"
        description="Recovery is an operator surface for backup coverage, restore proof, upgrade integrity, and source identity, not a passive dump of host-side scripts."
        question="Which data class is still unprotected or untested, and can the current deployment prove backup, restore, upgrade, and rollback truth with timestamps?"
        links={[
          { label: "Recovery / Backup / Restore", to: CONTROL_PLANE_ROUTES.recovery, description: "Stay on the resilience evidence surface." },
          { label: "Release / Validation", to: CONTROL_PLANE_ROUTES.releaseValidation, description: "Cross-check release posture against recovery truth." },
          { label: "Health", to: CONTROL_PLANE_ROUTES.health, description: "Inspect runtime readiness after recovery posture changes." },
        ]}
        badges={[
          { label: overview ? `${overview.summary.total_policies} policy${overview.summary.total_policies === 1 ? "" : "ies"}` : "No policy data yet", tone: "neutral" },
          { label: overview?.summary.runtime_status === "ok" ? "Recovery posture healthy" : overview?.summary.runtime_status === "blocked" ? "Recovery posture blocked" : "Recovery posture degraded", tone: toneForRuntimeStatus(overview?.summary.runtime_status ?? "blocked") },
          { label: overview?.upgrade_posture.runtime_status === "ok" ? "Upgrade integrity proven" : "Upgrade integrity missing or degraded", tone: toneForRuntimeStatus(overview?.upgrade_posture.runtime_status ?? "blocked") },
          { label: canMutate ? "Policy mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Backup evidence without restore proof stays blocked. Import validation happens before submit, and every accepted report leaves a visible result on the page."
      />

      <ActionBar
        title={sectionLabels[activeSection]}
        description={sectionDescriptions[activeSection]}
        actions={(
          <div className="fg-actions">
            <button type="button" onClick={handleRefresh}>Refresh</button>
            {(["overview", "policies", "backup", "restore", "upgrade"] as SectionKey[]).map((section) => (
              <button
                key={section}
                type="button"
                aria-pressed={activeSection === section}
                onClick={() => setActiveSection(section)}
              >
                {sectionLabels[section]}
              </button>
            ))}
            {activeSection === "policies" ? (
              <>
                <button type="button" disabled={!canMutate} onClick={() => setPolicyDrawerMode("create")}>Create policy</button>
                <button type="button" disabled={!canMutate || !selectedPolicy} onClick={() => setPolicyDrawerMode("edit")}>Edit selected policy</button>
              </>
            ) : null}
          </div>
        )}
      />

      <SummaryStrip items={summaryItems} />

      {error ? (
        <ErrorState
          title="Recovery surface failed"
          description={error}
          action={<button type="button" onClick={handleRefresh}>Retry</button>}
        />
      ) : null}
      {message ? <p>{message}</p> : null}
      {loadState === "loading" && !overview ? (
        <LoadingState
          title="Loading recovery posture"
          description="Restoring coverage, backup evidence, restore evidence, and upgrade posture."
        />
      ) : null}

      {overview && activeSection === "overview" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <EntityTable
              title="Coverage summary"
              description="Every protected data class shows backup target, last backup, last restore test, and a hard risk posture."
              columns={coverageColumns}
              rows={coverageRows}
              rowKey={(row) => row.key}
              tableLabel="Recovery coverage by data class"
              getRowClassName={(row) => (row.key === selectedCoverage?.key ? "is-selected" : undefined)}
            />

            <EntityTable
              title="Current recovery risks"
              description="The hardest gaps surface here first so unprotected or untested classes are impossible to miss."
              columns={[
                {
                  key: "dataClass",
                  header: "Data class",
                  render: (row) => (
                    <div>
                      <strong>{row.dataClass}</strong>
                      <div className="fg-muted">{row.policyLabels}</div>
                    </div>
                  ),
                },
                {
                  key: "risk",
                  header: "Risk",
                  render: (row) => (
                    <StatusBadge tone={row.riskTone} status={row.statusKey}>
                      {row.riskLabel}
                    </StatusBadge>
                  ),
                },
                {
                  key: "blocker",
                  header: "Reason",
                  render: (row) => row.blocker,
                },
              ]}
              rows={blockedCoverageRows}
              rowKey={(row) => row.key}
              tableLabel="Recovery risk rows"
              emptyTitle="No data-class recovery gaps"
              emptyDescription="Every protected data class has backup and restore evidence."
            />
          </div>

          <div className="ff-operator-sidebar">
            <DetailPanel
              title={selectedCoverage?.dataClass ?? "Coverage details"}
              description={selectedCoverage ? "Selected data-class posture and the evidence behind it." : "Pick a data class to inspect coverage."}
              status={selectedCoverage?.riskLabel}
              statusTone={selectedCoverage?.riskTone}
              statusKey={selectedCoverage?.statusKey}
              sticky
            >
              {selectedCoverage ? (
                <div className="fg-stack">
                  <section className="fg-subcard">
                    <h4>Coverage truth</h4>
                    <p>Protected by: {selectedCoverage.policyLabels}</p>
                    <p>Protected status: {selectedCoverage.protectedLabel}</p>
                    <p>Backup target: {selectedCoverage.backupTargets}</p>
                    <p>Last backup: {formatTimestamp(selectedCoverage.lastBackupAt)}</p>
                    <p>Last restore test: {formatTimestamp(selectedCoverage.lastRestoreAt)}</p>
                    <p>Risk: {selectedCoverage.blocker}</p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Next action</h4>
                    <p>{selectedCoverage.statusKey === "ready" ? "Keep the latest backup and restore cadence current." : "Open Policies, Backup Evidence, or Restore Evidence and close the missing proof."}</p>
                    <div className="fg-actions">
                      <button type="button" onClick={() => setActiveSection("policies")}>Open Policies</button>
                      <button type="button" onClick={() => setActiveSection("backup")}>Open Backup Evidence</button>
                      <button type="button" onClick={() => setActiveSection("restore")}>Open Restore Evidence</button>
                    </div>
                  </section>

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

      {overview && activeSection === "policies" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <EntityTable
              title="Policies"
              description="Policy inventory, freshness, source identity, and restore posture stay distinct from report imports."
              columns={policyColumns}
              rows={overview.policies}
              rowKey={(row) => row.policy.policy_id}
              tableLabel="Recovery policies"
              actions={(
                <>
                  <button type="button" disabled={!canMutate} onClick={() => setPolicyDrawerMode("create")}>Create policy</button>
                  <button type="button" disabled={!canMutate || !selectedPolicy} onClick={() => setPolicyDrawerMode("edit")}>Edit selected policy</button>
                </>
              )}
              getRowClassName={(row) => (row.policy.policy_id === selectedPolicy?.policy.policy_id ? "is-selected" : undefined)}
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
                  <section className="fg-subcard">
                    <h4>Policy contract</h4>
                    <p>Target class: {selectedPolicy.policy.target_class}</p>
                    <p>Target label: {selectedPolicy.policy.target_label || "n/a"}</p>
                    <p>Target locator: {selectedPolicy.validation.target_locator || "n/a"}</p>
                    <p>Schedule hint: {selectedPolicy.policy.schedule_hint || "n/a"}</p>
                    <p>Backup age budget: {selectedPolicy.policy.max_backup_age_hours}h</p>
                    <p>Restore age budget: {selectedPolicy.policy.max_restore_age_hours}h</p>
                    <p>Protected classes: {selectedPolicy.policy.protected_data_classes.join(", ")}</p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Restore contract</h4>
                    <p>{selectedPolicy.latest_restore ? `Latest restore test: ${selectedPolicy.latest_restore.created_at}` : "Restore never tested for this policy."}</p>
                    <p>{selectedPolicy.latest_backup ? `Latest backup: ${selectedPolicy.latest_backup.created_at}` : "No backup evidence imported yet."}</p>
                    <p>{selectedPolicy.latest_backup && !selectedPolicy.latest_restore ? "Backup exists, but this policy is still blocked until a restore test is imported." : "Backup and restore posture are evaluated separately."}</p>
                  </section>

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

      {overview && activeSection === "backup" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <EntityTable
              title="Backup Evidence"
              description="Backup manifests are imported and tracked separately from restore tests."
              columns={backupColumns}
              rows={backupRows}
              rowKey={(row) => row.key}
              tableLabel="Backup evidence table"
              getRowClassName={(row) => (row.policy.policy.policy_id === selectedPolicy?.policy.policy_id ? "is-selected" : undefined)}
            />
          </div>

          <div className="ff-operator-sidebar">
            <DetailPanel
              title={selectedPolicy?.policy.label ?? "Backup import"}
              description="Import a backup manifest with immediate validation, then inspect the accepted evidence result."
              status={backupValidation.valid ? "report valid" : "report invalid"}
              statusTone={backupValidation.valid ? "success" : "danger"}
              statusKey={backupValidation.valid ? "ready" : "blocked"}
              sticky
            >
              <div className="fg-stack">
                <section className="fg-subcard">
                  <h4>Import backup manifest</h4>
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
                      <button type="submit" disabled={!canMutate || !backupImport.policy_id || !backupValidation.valid}>Import backup manifest</button>
                    </div>
                  </form>
                </section>

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

      {overview && activeSection === "restore" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <EntityTable
              title="Restore Evidence"
              description="Restore proof is tracked separately so a backup-only posture never reads as green."
              columns={restoreColumns}
              rows={restoreRows}
              rowKey={(row) => row.key}
              tableLabel="Restore evidence table"
              getRowClassName={(row) => (row.policy.policy.policy_id === selectedPolicy?.policy.policy_id ? "is-selected" : undefined)}
            />
          </div>

          <div className="ff-operator-sidebar">
            <DetailPanel
              title={selectedPolicy?.policy.label ?? "Restore import"}
              description="Import a restore report with immediate validation and visible result."
              status={restoreValidation.valid ? "report valid" : "report invalid"}
              statusTone={restoreValidation.valid ? "success" : "danger"}
              statusKey={restoreValidation.valid ? "ready" : "blocked"}
              sticky
            >
              <div className="fg-stack">
                <section className="fg-subcard">
                  <h4>Import restore report</h4>
                  <p>{selectedPolicy?.latest_restore ? `Latest restore proof: ${selectedPolicy.latest_restore.created_at}` : "No restore proof exists for the selected policy yet."}</p>
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
                      <button type="submit" disabled={!canMutate || !restoreImport.policy_id || !restoreValidation.valid}>Import restore report</button>
                    </div>
                  </form>
                </section>

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

      {overview && activeSection === "upgrade" ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <EntityTable
              title="Upgrade / Rollback"
              description="No-loss, queue-drain, rollback class, and source-identity stability stay visible as release evidence."
              columns={upgradeColumns}
              rows={upgradeRows}
              rowKey={(row) => row.key}
              tableLabel="Upgrade evidence table"
              emptyTitle="No upgrade reports"
              emptyDescription="Import upgrade and rollback proof before calling a release path validated."
              getRowClassName={(row) => (row.report.report_id === selectedUpgrade?.report_id ? "is-selected" : undefined)}
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
              <div className="fg-stack">
                <section className="fg-subcard">
                  <h4>Upgrade posture</h4>
                  <p>Latest release: {overview.upgrade_posture.latest_release_id ?? "missing"}</p>
                  <p>Target version: {overview.upgrade_posture.latest_target_version ?? "missing"}</p>
                  <p>No-loss proof: {String(overview.upgrade_posture.latest_no_loss_ok)}</p>
                  <p>Queue drained: {String(overview.upgrade_posture.latest_queue_drain_ok)}</p>
                  <p>Source identity stable: {String(overview.upgrade_posture.latest_source_identity_stable)}</p>
                  <p>Blockers: {overview.upgrade_posture.blockers.join(", ") || "none"}</p>
                  <p>Cross-check route: <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.releaseValidation}>Open Release / Validation</Link></p>
                </section>

                <section className="fg-subcard">
                  <h4>Import upgrade proof</h4>
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
                      <button type="submit" disabled={!canMutate || !upgradeValidation.valid}>Import upgrade proof</button>
                    </div>
                  </form>
                </section>

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

      <DetailDrawer
        open={policyDrawerMode !== "closed"}
        title={policyDrawerMode === "create" ? "Create Recovery Policy" : "Edit Recovery Policy"}
        description={policyDrawerMode === "create" ? "Structured policy fields for target class, source identity, and recovery windows." : "Adjust the selected policy without turning the main page back into a long form."}
        status={drawerFormValidation.valid ? "form ready" : "form incomplete"}
        statusTone={drawerFormValidation.valid ? "success" : "danger"}
        onClose={() => setPolicyDrawerMode("closed")}
        actions={(
          <>
            <button type="button" onClick={() => setPolicyDrawerMode("closed")}>Cancel</button>
            <button type="submit" form={drawerFormId} disabled={!canMutate || !drawerFormValidation.valid || (policyDrawerMode === "edit" && !selectedPolicy)}>
              {policyDrawerMode === "create" ? "Create recovery policy" : "Save selected policy"}
            </button>
          </>
        )}
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
    </section>
  );
}
