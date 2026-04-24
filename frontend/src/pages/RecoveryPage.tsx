import { useEffect, useMemo, useState } from "react";

import {
  createRecoveryBackupPolicy,
  fetchRecoveryOverview,
  importRecoveryBackupReport,
  importRecoveryRestoreReport,
  importRecoveryUpgradeReport,
  updateRecoveryBackupPolicy,
  type RecoveryBackupTargetClass,
  type RecoveryOverviewResponse,
  type RecoveryPolicySummary,
  type RecoveryProtectedDataClass,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";
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
  status: "active" as const,
  target_class: "local_secondary_disk" as RecoveryBackupTargetClass,
  target_label: "",
  target_config_json: "{\n  \"path\": \"/var/backups/forgeframe\"\n}",
  protected_data_classes: ["database"] as RecoveryProtectedDataClass[],
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
  protected_data_classes: ["database"] as RecoveryProtectedDataClass[],
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

function coverageLabel(values: RecoveryProtectedDataClass[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

export function RecoveryPage() {
  const { session } = useAppSession();
  const canMutate = session?.read_only !== true && (session?.role === "admin" || session?.role === "owner");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [overview, setOverview] = useState<RecoveryOverviewResponse | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [createForm, setCreateForm] = useState<PolicyFormState>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<PolicyFormState>(DEFAULT_CREATE_FORM);
  const [backupImport, setBackupImport] = useState<ImportFormState>(DEFAULT_IMPORT_FORM);
  const [restoreImport, setRestoreImport] = useState<ImportFormState>(DEFAULT_IMPORT_FORM);
  const [upgradeImport, setUpgradeImport] = useState<UpgradeImportFormState>(DEFAULT_UPGRADE_IMPORT_FORM);

  const loadOverview = async (preferredPolicyId?: string) => {
    setLoadState("loading");
    setError("");
    const payload = await fetchRecoveryOverview();
    setOverview(payload);
    const nextSelectedPolicyId = preferredPolicyId ?? payload.policies[0]?.policy.policy_id ?? "";
    setSelectedPolicyId(nextSelectedPolicyId);
    setBackupImport((current) => ({ ...current, policy_id: current.policy_id || nextSelectedPolicyId }));
    setRestoreImport((current) => ({ ...current, policy_id: current.policy_id || nextSelectedPolicyId }));
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

  useEffect(() => {
    if (!selectedPolicy) {
      setEditForm(DEFAULT_CREATE_FORM);
      return;
    }
    setEditForm({
      policy_id: selectedPolicy.policy.policy_id,
      label: selectedPolicy.policy.label,
      status: selectedPolicy.policy.status,
      target_class: selectedPolicy.policy.target_class,
      target_label: selectedPolicy.policy.target_label,
      target_config_json: JSON.stringify(selectedPolicy.policy.target_config, null, 2),
      protected_data_classes: selectedPolicy.policy.protected_data_classes,
      source_database: selectedPolicy.policy.expected_source_identity.source_database,
      cluster_system_identifier: selectedPolicy.policy.expected_source_identity.cluster_system_identifier,
      deployment_slug: selectedPolicy.policy.expected_source_identity.deployment_slug,
      public_fqdn: selectedPolicy.policy.expected_source_identity.public_fqdn,
      schedule_hint: selectedPolicy.policy.schedule_hint,
      max_backup_age_hours: selectedPolicy.policy.max_backup_age_hours,
      max_restore_age_hours: selectedPolicy.policy.max_restore_age_hours,
      notes: selectedPolicy.policy.notes,
    });
  }, [selectedPolicy]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate) {
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
      setMessage(`Recovery policy ${response.policy.policy.label} created.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Recovery policy creation failed.");
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !selectedPolicy) {
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
      setMessage(`Recovery policy ${response.policy.policy.label} updated.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Recovery policy update failed.");
    }
  };

  const handleBackupImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !backupImport.policy_id) {
      return;
    }
    try {
      setError("");
      setMessage("");
      const manifest = parseJsonInput(backupImport.payload_json, "Backup manifest");
      const response = await importRecoveryBackupReport({
        policy_id: backupImport.policy_id,
        manifest,
        protected_data_classes: backupImport.protected_data_classes,
        notes: backupImport.notes,
      });
      await loadOverview(response.policy.policy.policy_id);
      setMessage(`Backup report imported for ${response.policy.policy.label}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Backup report import failed.");
    }
  };

  const handleRestoreImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !restoreImport.policy_id) {
      return;
    }
    try {
      setError("");
      setMessage("");
      const report = parseJsonInput(restoreImport.payload_json, "Restore report");
      const response = await importRecoveryRestoreReport({
        policy_id: restoreImport.policy_id,
        report,
        protected_data_classes: restoreImport.protected_data_classes,
        notes: restoreImport.notes,
      });
      await loadOverview(response.policy.policy.policy_id);
      setMessage(`Restore report imported for ${response.policy.policy.label}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Restore report import failed.");
    }
  };

  const handleUpgradeImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate) {
      return;
    }
    try {
      setError("");
      setMessage("");
      const report = parseJsonInput(upgradeImport.payload_json, "Upgrade proof report");
      const response = await importRecoveryUpgradeReport({
        report,
        notes: upgradeImport.notes,
      });
      await loadOverview();
      setUpgradeImport(DEFAULT_UPGRADE_IMPORT_FORM);
      setMessage(`Upgrade proof imported for ${response.report.release_id}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Upgrade proof import failed.");
    }
  };

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Recovery / Backup / Restore"
        description="Backup target classes, restore evidence, report freshness, and source-identity verification are persisted here instead of hiding in host-side script output."
        question="Would the current deployment survive a restore audit, and can ForgeFrame prove which target, source identity, and protected data classes were actually covered?"
        links={[
          { label: "Recovery / Backup / Restore", to: CONTROL_PLANE_ROUTES.recovery, description: "Stay on the resilience evidence surface." },
          { label: "Release / Validation", to: CONTROL_PLANE_ROUTES.releaseValidation, description: "Cross-check release posture against recovery evidence." },
          { label: "Health", to: CONTROL_PLANE_ROUTES.health, description: "Inspect runtime readiness and deployment posture after recovery evidence loads." },
        ]}
        badges={[
          { label: overview ? `${overview.summary.total_policies} policy${overview.summary.total_policies === 1 ? "" : "ies"}` : "No policy data yet", tone: overview?.summary.total_policies ? "success" : "warning" },
          { label: overview?.summary.runtime_status === "ok" ? "Recovery posture healthy" : "Recovery posture degraded", tone: overview?.summary.runtime_status === "ok" ? "success" : "warning" },
          { label: overview?.upgrade_posture.runtime_status === "ok" ? "Upgrade integrity proven" : "Upgrade integrity missing or degraded", tone: overview?.upgrade_posture.runtime_status === "ok" ? "success" : "warning" },
          { label: canMutate ? "Policy mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="This surface expects real backup manifests, restore reports, and upgrade no-loss proofs. Missing or stale evidence stays visible as product truth."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {loadState === "loading" ? <article className="fg-card"><p className="fg-muted">Loading recovery posture.</p></article> : null}

      {overview ? (
        <>
          <div className="fg-grid">
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Coverage summary</h3>
                  <p className="fg-muted">Target-class support and protected-data coverage stay explicit here.</p>
                </div>
              </div>
              <ul className="fg-list">
                <li>Total policies: {overview.summary.total_policies}</li>
                <li>Active policies: {overview.summary.active_policies}</li>
                <li>Healthy policies: {overview.summary.healthy_policies}</li>
                <li>Fresh backup policies: {overview.summary.fresh_backup_policies}</li>
                <li>Fresh restore policies: {overview.summary.fresh_restore_policies}</li>
                <li>Source-identity verified: {overview.summary.source_identity_verified_policies}</li>
                <li>Missing target classes: {overview.summary.missing_target_classes.join(", ") || "none"}</li>
                <li>Missing protected data classes: {overview.summary.missing_protected_data_classes.join(", ") || "none"}</li>
                <li>Upgrade runtime status: {overview.upgrade_posture.runtime_status}</li>
              </ul>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Policy inventory</h3>
                  <p className="fg-muted">Each policy carries its own validation, freshness, and mismatch truth.</p>
                </div>
              </div>
              <div className="fg-stack">
                {overview.policies.length === 0 ? <p className="fg-muted">No recovery policies are recorded yet.</p> : null}
                {overview.policies.map((policySummary) => (
                  <button
                    key={policySummary.policy.policy_id}
                    type="button"
                    className={`fg-data-row${policySummary.policy.policy_id === selectedPolicyId ? " is-current" : ""}`}
                    onClick={() => {
                      setSelectedPolicyId(policySummary.policy.policy_id);
                      setBackupImport((current) => ({ ...current, policy_id: policySummary.policy.policy_id }));
                      setRestoreImport((current) => ({ ...current, policy_id: policySummary.policy.policy_id }));
                    }}
                  >
                    <div className="fg-panel-heading fg-data-row-heading">
                      <div className="fg-page-header">
                        <span className="fg-code">{policySummary.policy.policy_id}</span>
                        <strong>{policySummary.policy.label}</strong>
                      </div>
                      <div className="fg-actions">
                        <span className="fg-pill" data-tone={policySummary.overall_status === "ok" ? "success" : policySummary.overall_status === "blocked" ? "danger" : "warning"}>
                          {policySummary.overall_status}
                        </span>
                        <span className="fg-pill" data-tone="neutral">{policySummary.policy.target_class}</span>
                      </div>
                    </div>
                    <div className="fg-detail-grid">
                      <span className="fg-muted">{policySummary.validation.target_locator || policySummary.policy.target_label || "no target locator"}</span>
                      <span className="fg-muted">coverage {coverageLabel(policySummary.policy.protected_data_classes)}</span>
                      <span className="fg-muted">backup fresh {String(policySummary.backup_fresh)} · restore fresh {String(policySummary.restore_fresh)}</span>
                      <span className="fg-muted">source identity verified {String(policySummary.source_identity_verified)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Upgrade / Rollback posture</h3>
                  <p className="fg-muted">Release integrity depends on a persisted no-loss proof, not on optimistic migration success claims.</p>
                </div>
              </div>
              <ul className="fg-list">
                <li>Total upgrade reports: {overview.upgrade_posture.total_reports}</li>
                <li>Runtime status: {overview.upgrade_posture.runtime_status}</li>
                <li>Latest release: {overview.upgrade_posture.latest_release_id ?? "missing"}</li>
                <li>Latest target version: {overview.upgrade_posture.latest_target_version ?? "missing"}</li>
                <li>Latest report status: {overview.upgrade_posture.latest_status ?? "missing"}</li>
                <li>No-loss proof: {String(overview.upgrade_posture.latest_no_loss_ok)}</li>
                <li>Queue drained: {String(overview.upgrade_posture.latest_queue_drain_ok)}</li>
                <li>Source identity stable: {String(overview.upgrade_posture.latest_source_identity_stable)}</li>
                <li>Blockers: {overview.upgrade_posture.blockers.join(", ") || "none"}</li>
              </ul>
            </article>
          </div>

          {selectedPolicy ? (
            <div className="fg-grid">
              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Selected policy</h3>
                    <p className="fg-muted">Validation reasons, latest backup evidence, and latest restore evidence are shown side by side.</p>
                  </div>
                  <span className="fg-pill" data-tone={selectedPolicy.overall_status === "ok" ? "success" : selectedPolicy.overall_status === "blocked" ? "danger" : "warning"}>
                    {selectedPolicy.overall_status}
                  </span>
                </div>
                <ul className="fg-list">
                  <li>Target class: {selectedPolicy.policy.target_class}</li>
                  <li>Target label: {selectedPolicy.policy.target_label || "n/a"}</li>
                  <li>Target locator: {selectedPolicy.validation.target_locator || "n/a"}</li>
                  <li>Policy status: {selectedPolicy.policy.status}</li>
                  <li>Validation state: {selectedPolicy.validation.state}</li>
                  <li>Validation reasons: {selectedPolicy.validation.reasons.join(", ") || "none"}</li>
                  <li>Mismatches: {selectedPolicy.mismatches.join(", ") || "none"}</li>
                  <li>Expected source database: {selectedPolicy.policy.expected_source_identity.source_database || "n/a"}</li>
                  <li>Expected cluster identifier: {selectedPolicy.policy.expected_source_identity.cluster_system_identifier || "n/a"}</li>
                </ul>
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Latest backup evidence</h3>
                    <p className="fg-muted">Freshness and source-identity truth for the most recent backup import.</p>
                  </div>
                </div>
                <ul className="fg-list">
                  <li>Present: {String(Boolean(selectedPolicy.latest_backup))}</li>
                  <li>Fresh: {String(selectedPolicy.backup_fresh)}</li>
                  <li>Status: {selectedPolicy.latest_backup?.status ?? "missing"}</li>
                  <li>Created at: {selectedPolicy.latest_backup?.created_at ?? "n/a"}</li>
                  <li>Backup path: {selectedPolicy.latest_backup?.backup_path ?? "n/a"}</li>
                  <li>Manifest path: {selectedPolicy.latest_backup?.manifest_path ?? "n/a"}</li>
                  <li>Checksum: {selectedPolicy.latest_backup?.checksum_sha256 ?? "n/a"}</li>
                  <li>Identity match: {selectedPolicy.latest_backup ? String(selectedPolicy.latest_backup.source_identity_match) : "n/a"}</li>
                </ul>
              </article>

              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Latest restore evidence</h3>
                    <p className="fg-muted">Restore freshness, validated source identity, and mismatch truth for the selected policy.</p>
                  </div>
                </div>
                <ul className="fg-list">
                  <li>Present: {String(Boolean(selectedPolicy.latest_restore))}</li>
                  <li>Fresh: {String(selectedPolicy.restore_fresh)}</li>
                  <li>Status: {selectedPolicy.latest_restore?.status ?? "missing"}</li>
                  <li>Created at: {selectedPolicy.latest_restore?.created_at ?? "n/a"}</li>
                  <li>Restored database: {selectedPolicy.latest_restore?.restored_database ?? "n/a"}</li>
                  <li>Tables compared: {selectedPolicy.latest_restore?.tables_compared ?? 0}</li>
                  <li>Identity match: {selectedPolicy.latest_restore ? String(selectedPolicy.latest_restore.source_identity_match) : "n/a"}</li>
                  <li>Validated identities: {selectedPolicy.latest_restore?.validated_source_identities.length ?? 0}</li>
                </ul>
              </article>
            </div>
          ) : null}

          <div className="fg-grid">
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Recent upgrade proofs</h3>
                  <p className="fg-muted">Every release needs explicit rollback, queue-drain, and no-loss evidence.</p>
                </div>
              </div>
              {overview.recent_upgrades.length === 0 ? <p className="fg-muted">No upgrade proofs are recorded yet.</p> : null}
              <ul className="fg-list">
                {overview.recent_upgrades.map((report) => (
                  <li key={report.report_id}>
                    {report.release_id} · {report.target_version || "n/a"} · status {report.status} · result {report.upgrade_result} · no-loss {String(report.no_loss_ok)} · queue drained {String(report.queue_drain_ok)}
                  </li>
                ))}
              </ul>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Create policy</h3>
                  <p className="fg-muted">Model backup target class, protected data coverage, and expected source identity.</p>
                </div>
              </div>
              <form className="fg-stack" onSubmit={handleCreate}>
                <label>
                  Policy ID
                  <input value={createForm.policy_id} onChange={(event) => setCreateForm((current) => ({ ...current, policy_id: event.target.value }))} placeholder="backup_policy_offsite" />
                </label>
                <label>
                  Label
                  <input value={createForm.label} onChange={(event) => setCreateForm((current) => ({ ...current, label: event.target.value }))} placeholder="Offsite object storage" />
                </label>
                <label>
                  Target class
                  <select value={createForm.target_class} onChange={(event) => setCreateForm((current) => ({ ...current, target_class: event.target.value as RecoveryBackupTargetClass }))}>
                    {TARGET_CLASSES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  Target label
                  <input value={createForm.target_label} onChange={(event) => setCreateForm((current) => ({ ...current, target_label: event.target.value }))} placeholder="s3-eu-central-1 / forgeframe-prod" />
                </label>
                <label>
                  Target config JSON
                  <textarea rows={8} value={createForm.target_config_json} onChange={(event) => setCreateForm((current) => ({ ...current, target_config_json: event.target.value }))} />
                </label>
                <fieldset className="fg-stack">
                  <legend>Protected data classes</legend>
                  {DATA_CLASSES.map((item) => (
                    <label key={`create-${item}`}>
                      <input
                        type="checkbox"
                        checked={createForm.protected_data_classes.includes(item)}
                        onChange={() => setCreateForm((current) => ({ ...current, protected_data_classes: toggleClass(current.protected_data_classes, item) }))}
                      />
                      {item}
                    </label>
                  ))}
                </fieldset>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Expected source database
                    <input value={createForm.source_database} onChange={(event) => setCreateForm((current) => ({ ...current, source_database: event.target.value }))} />
                  </label>
                  <label>
                    Expected cluster identifier
                    <input value={createForm.cluster_system_identifier} onChange={(event) => setCreateForm((current) => ({ ...current, cluster_system_identifier: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Deployment slug
                    <input value={createForm.deployment_slug} onChange={(event) => setCreateForm((current) => ({ ...current, deployment_slug: event.target.value }))} />
                  </label>
                  <label>
                    Public FQDN
                    <input value={createForm.public_fqdn} onChange={(event) => setCreateForm((current) => ({ ...current, public_fqdn: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Schedule hint
                    <input value={createForm.schedule_hint} onChange={(event) => setCreateForm((current) => ({ ...current, schedule_hint: event.target.value }))} />
                  </label>
                  <label>
                    Max backup age (hours)
                    <input type="number" value={createForm.max_backup_age_hours} onChange={(event) => setCreateForm((current) => ({ ...current, max_backup_age_hours: Number(event.target.value) || 1 }))} />
                  </label>
                  <label>
                    Max restore age (hours)
                    <input type="number" value={createForm.max_restore_age_hours} onChange={(event) => setCreateForm((current) => ({ ...current, max_restore_age_hours: Number(event.target.value) || 1 }))} />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea rows={4} value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate}>Create recovery policy</button>
                </div>
              </form>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Edit selected policy</h3>
                  <p className="fg-muted">Policy edits stay explicit so freshness and identity checks remain deterministic.</p>
                </div>
              </div>
              <form className="fg-stack" onSubmit={handleUpdate}>
                <label>
                  Selected policy
                  <select value={selectedPolicyId} onChange={(event) => setSelectedPolicyId(event.target.value)} disabled={overview.policies.length === 0}>
                    {overview.policies.map((item) => <option key={item.policy.policy_id} value={item.policy.policy_id}>{item.policy.label}</option>)}
                  </select>
                </label>
                <label>
                  Label
                  <input value={editForm.label} onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} />
                </label>
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as "active" | "paused" }))}>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                  </select>
                </label>
                <label>
                  Target label
                  <input value={editForm.target_label} onChange={(event) => setEditForm((current) => ({ ...current, target_label: event.target.value }))} />
                </label>
                <label>
                  Target config JSON
                  <textarea rows={8} value={editForm.target_config_json} onChange={(event) => setEditForm((current) => ({ ...current, target_config_json: event.target.value }))} />
                </label>
                <fieldset className="fg-stack">
                  <legend>Protected data classes</legend>
                  {DATA_CLASSES.map((item) => (
                    <label key={`edit-${item}`}>
                      <input
                        type="checkbox"
                        checked={editForm.protected_data_classes.includes(item)}
                        onChange={() => setEditForm((current) => ({ ...current, protected_data_classes: toggleClass(current.protected_data_classes, item) }))}
                      />
                      {item}
                    </label>
                  ))}
                </fieldset>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Expected source database
                    <input value={editForm.source_database} onChange={(event) => setEditForm((current) => ({ ...current, source_database: event.target.value }))} />
                  </label>
                  <label>
                    Expected cluster identifier
                    <input value={editForm.cluster_system_identifier} onChange={(event) => setEditForm((current) => ({ ...current, cluster_system_identifier: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Deployment slug
                    <input value={editForm.deployment_slug} onChange={(event) => setEditForm((current) => ({ ...current, deployment_slug: event.target.value }))} />
                  </label>
                  <label>
                    Public FQDN
                    <input value={editForm.public_fqdn} onChange={(event) => setEditForm((current) => ({ ...current, public_fqdn: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Schedule hint
                    <input value={editForm.schedule_hint} onChange={(event) => setEditForm((current) => ({ ...current, schedule_hint: event.target.value }))} />
                  </label>
                  <label>
                    Max backup age (hours)
                    <input type="number" value={editForm.max_backup_age_hours} onChange={(event) => setEditForm((current) => ({ ...current, max_backup_age_hours: Number(event.target.value) || 1 }))} />
                  </label>
                  <label>
                    Max restore age (hours)
                    <input type="number" value={editForm.max_restore_age_hours} onChange={(event) => setEditForm((current) => ({ ...current, max_restore_age_hours: Number(event.target.value) || 1 }))} />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea rows={4} value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || !selectedPolicy}>Save selected policy</button>
                </div>
              </form>
            </article>
          </div>

          <div className="fg-grid">
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Import backup manifest</h3>
                  <p className="fg-muted">Paste the JSON output from the host backup flow so it becomes durable product evidence.</p>
                </div>
              </div>
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
                  <textarea rows={10} value={backupImport.payload_json} onChange={(event) => setBackupImport((current) => ({ ...current, payload_json: event.target.value }))} />
                </label>
                <label>
                  Notes
                  <textarea rows={3} value={backupImport.notes} onChange={(event) => setBackupImport((current) => ({ ...current, notes: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || !backupImport.policy_id}>Import backup manifest</button>
                </div>
              </form>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Import restore report</h3>
                  <p className="fg-muted">Paste the restore validation JSON so freshness and source-identity checks become operator-visible truth.</p>
                </div>
              </div>
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
                  <textarea rows={10} value={restoreImport.payload_json} onChange={(event) => setRestoreImport((current) => ({ ...current, payload_json: event.target.value }))} />
                </label>
                <label>
                  Notes
                  <textarea rows={3} value={restoreImport.notes} onChange={(event) => setRestoreImport((current) => ({ ...current, notes: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || !restoreImport.policy_id}>Import restore report</button>
                </div>
              </form>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Import upgrade no-loss proof</h3>
                  <p className="fg-muted">Paste the JSON output from the shipped upgrade-proof flow so rollback class, migration checkpoint, and object preservation become durable evidence.</p>
                </div>
              </div>
              <form className="fg-stack" onSubmit={handleUpgradeImport}>
                <label>
                  Upgrade proof JSON
                  <textarea rows={14} value={upgradeImport.payload_json} onChange={(event) => setUpgradeImport((current) => ({ ...current, payload_json: event.target.value }))} />
                </label>
                <label>
                  Notes
                  <textarea rows={3} value={upgradeImport.notes} onChange={(event) => setUpgradeImport((current) => ({ ...current, notes: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate}>Import upgrade proof</button>
                </div>
              </form>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
