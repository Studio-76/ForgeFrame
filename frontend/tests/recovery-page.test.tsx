// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchRecoveryOverviewMock,
  createRecoveryBackupPolicyMock,
  updateRecoveryBackupPolicyMock,
  importRecoveryBackupReportMock,
  importRecoveryRestoreReportMock,
  importRecoveryUpgradeReportMock,
} = vi.hoisted(() => ({
  fetchRecoveryOverviewMock: vi.fn(),
  createRecoveryBackupPolicyMock: vi.fn(),
  updateRecoveryBackupPolicyMock: vi.fn(),
  importRecoveryBackupReportMock: vi.fn(),
  importRecoveryRestoreReportMock: vi.fn(),
  importRecoveryUpgradeReportMock: vi.fn(),
}));

vi.mock("../src/api/admin/recovery", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/recovery")>("../src/api/admin/recovery");
  return {
    ...actual,
    fetchRecoveryOverview: fetchRecoveryOverviewMock,
    createRecoveryBackupPolicy: createRecoveryBackupPolicyMock,
    updateRecoveryBackupPolicy: updateRecoveryBackupPolicyMock,
    importRecoveryBackupReport: importRecoveryBackupReportMock,
    importRecoveryRestoreReport: importRecoveryRestoreReportMock,
    importRecoveryUpgradeReport: importRecoveryUpgradeReportMock,
  };
});

import type { AdminSessionUser, RecoveryOverviewResponse, RecoveryPolicySummary } from "../src/api/admin";
import { RecoveryPage } from "../src/pages/RecoveryPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createPolicySummary(overrides: Partial<RecoveryPolicySummary> = {}): RecoveryPolicySummary {
  return {
    policy: {
      policy_id: "backup_policy_local",
      label: "Local secondary backup",
      status: "active",
      target_class: "local_secondary_disk",
      target_label: "Local backup disk",
      target_config: { path: "/var/backups/forgeframe" },
      protected_data_classes: ["database", "artifact_metadata"],
      expected_source_identity: {
        source_database: "forgeframe",
        cluster_system_identifier: "cluster-123",
        deployment_slug: "forgeframe-prod",
        public_fqdn: "forgeframe.example.com",
        metadata: {},
      },
      schedule_hint: "nightly",
      max_backup_age_hours: 24,
      max_restore_age_hours: 168,
      notes: "Primary local backup.",
      created_at: "2026-04-23T08:00:00Z",
      updated_at: "2026-04-23T08:00:00Z",
    },
    validation: {
      state: "ok",
      reasons: [],
      target_locator: "/var/backups/forgeframe",
      checked_at: "2026-04-23T08:05:00Z",
    },
    latest_backup: {
      report_id: "backup_report_1",
      policy_id: "backup_policy_local",
      status: "ok",
      protected_data_classes: ["database", "artifact_metadata"],
      source_identity: {
        source_database: "forgeframe",
        cluster_system_identifier: "cluster-123",
        deployment_slug: "forgeframe-prod",
        public_fqdn: "forgeframe.example.com",
        metadata: {},
      },
      target_locator: "/var/backups/forgeframe",
      backup_path: "/var/backups/forgeframe/latest.dump",
      manifest_path: "/var/backups/forgeframe/latest.dump.json",
      byte_size: 12345,
      checksum_sha256: "checksum",
      source_identity_match: true,
      coverage_match: true,
      mismatch_reasons: [],
      raw_report: {},
      created_at: "2026-04-23T08:10:00Z",
      imported_at: "2026-04-23T08:10:10Z",
      notes: "",
    },
    latest_restore: {
      report_id: "restore_report_1",
      policy_id: "backup_policy_local",
      status: "ok",
      protected_data_classes: ["database", "artifact_metadata"],
      source_identity: {
        source_database: "forgeframe",
        cluster_system_identifier: "cluster-123",
        deployment_slug: "forgeframe-prod",
        public_fqdn: "forgeframe.example.com",
        metadata: {},
      },
      validated_source_identities: [
        {
          source_database: "forgeframe",
          cluster_system_identifier: "cluster-123",
          deployment_slug: "",
          public_fqdn: "",
          metadata: {},
        },
      ],
      restored_database: "forgeframe_restore_smoke",
      tables_compared: 42,
      source_identity_match: true,
      coverage_match: true,
      mismatch_reasons: [],
      raw_report: {},
      created_at: "2026-04-23T08:15:00Z",
      imported_at: "2026-04-23T08:15:10Z",
      notes: "",
    },
    backup_fresh: true,
    restore_fresh: true,
    source_identity_verified: true,
    mismatches: [],
    overall_status: "ok",
    ...overrides,
  };
}

function createOverview(policies: RecoveryPolicySummary[] = [createPolicySummary()]): RecoveryOverviewResponse {
  return {
    status: "ok",
    summary: {
      total_policies: policies.length,
      active_policies: policies.filter((policy) => policy.policy.status === "active").length,
      healthy_policies: policies.filter((policy) => policy.overall_status === "ok").length,
      warning_policies: policies.filter((policy) => policy.overall_status === "warning").length,
      blocked_policies: policies.filter((policy) => policy.overall_status === "blocked").length,
      fresh_backup_policies: policies.filter((policy) => policy.backup_fresh).length,
      fresh_restore_policies: policies.filter((policy) => policy.restore_fresh).length,
      source_identity_verified_policies: policies.filter((policy) => policy.source_identity_verified).length,
      target_classes_present: policies.map((policy) => policy.policy.target_class),
      missing_target_classes: ["second_host", "nas_share", "offsite_copy", "object_storage"],
      protected_data_classes_present: ["database", "artifact_metadata"],
      missing_protected_data_classes: ["blob_contents", "configuration_state", "secret_metadata"],
      runtime_status: "warning",
      checked_at: "2026-04-23T08:20:00Z",
    },
    upgrade_posture: {
      total_reports: 1,
      latest_release_id: "release-2026-04-23",
      latest_target_version: "0.6.0",
      latest_status: "ok",
      latest_upgrade_result: "succeeded",
      latest_created_at: "2026-04-23T08:18:00Z",
      latest_imported_at: "2026-04-23T08:18:10Z",
      latest_no_loss_ok: true,
      latest_queue_drain_ok: true,
      latest_source_identity_stable: true,
      runtime_status: "ok",
      blockers: [],
    },
    recent_upgrades: [
      {
        report_id: "upgrade_report_1",
        release_id: "release-2026-04-23",
        target_version: "0.6.0",
        status: "ok",
        upgrade_result: "succeeded",
        rollback_classification: "not_needed",
        failure_classification: "none",
        bootstrap_recovery_state: "recovered",
        before_snapshot: {
          captured_at: "2026-04-23T08:00:00Z",
          source_identity: {
            source_database: "forgeframe",
            cluster_system_identifier: "cluster-123",
            deployment_slug: "forgeframe-prod",
            public_fqdn: "forgeframe.example.com",
            metadata: {},
          },
          migration_version: 28,
          applied_migration_versions: [1, 2, 28],
          critical_object_counts: { runs: 12, run_approval_links: 3, memory_entries: 8, skills: 2 },
          queue_state_counts: { queued: 0, executing: 0 },
          database_targets: [],
        },
        after_snapshot: {
          captured_at: "2026-04-23T08:10:00Z",
          source_identity: {
            source_database: "forgeframe",
            cluster_system_identifier: "cluster-123",
            deployment_slug: "forgeframe-prod",
            public_fqdn: "forgeframe.example.com",
            metadata: {},
          },
          migration_version: 29,
          applied_migration_versions: [1, 2, 29],
          critical_object_counts: { runs: 12, run_approval_links: 3, memory_entries: 8, skills: 2 },
          queue_state_counts: { queued: 0, executing: 0 },
          database_targets: [],
        },
        no_loss_ok: true,
        queue_drain_ok: true,
        source_identity_stable: true,
        mismatch_reasons: [],
        raw_report: {},
        created_at: "2026-04-23T08:18:00Z",
        imported_at: "2026-04-23T08:18:10Z",
        notes: "",
      },
    ],
    policies,
  };
}

let container: HTMLDivElement;
let root: Root | null = null;

async function renderIntoDom(element: ReactNode) {
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

function getButtonByText(scope: ParentNode, text: string) {
  const button = Array.from(scope.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(text));
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  return button as HTMLButtonElement;
}

function getLabeledControl(scope: ParentNode, labelText: string) {
  const label = Array.from(scope.querySelectorAll("label")).find((candidate) => candidate.textContent?.includes(labelText));
  if (!label) {
    throw new Error(`Label not found: ${labelText}`);
  }
  const control = label.querySelector("input, textarea, select");
  if (!control) {
    throw new Error(`Control not found for label: ${labelText}`);
  }
  return control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

function getDrawerByTitle(title: string) {
  const drawer = container.querySelector(`aside[aria-label="${title}"]`);
  if (!drawer) {
    throw new Error(`Drawer not found: ${title}`);
  }
  return drawer;
}

async function renderRecoveryPage() {
  await renderIntoDom(withAppContext({
    path: "/recovery",
    element: <RecoveryPage />,
    session: adminSession,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  const overview = createOverview();
  fetchRecoveryOverviewMock.mockResolvedValue(overview);
  createRecoveryBackupPolicyMock.mockResolvedValue({
    status: "ok",
    policy: createPolicySummary({
      policy: {
        ...overview.policies[0].policy,
        policy_id: "backup_policy_object",
        label: "Object storage backup",
        target_class: "object_storage",
        target_label: "s3://forgeframe-prod",
        target_config: { provider: "s3", bucket: "forgeframe-prod", prefix: "nightly" },
      },
    }),
  });
  updateRecoveryBackupPolicyMock.mockResolvedValue({
    status: "ok",
    policy: createPolicySummary({
      policy: { ...overview.policies[0].policy, label: "Local secondary backup updated" },
    }),
  });
  importRecoveryBackupReportMock.mockResolvedValue({
    status: "ok",
    report: overview.policies[0].latest_backup!,
    policy: overview.policies[0],
  });
  importRecoveryRestoreReportMock.mockResolvedValue({
    status: "ok",
    report: overview.policies[0].latest_restore!,
    policy: overview.policies[0],
  });
  importRecoveryUpgradeReportMock.mockResolvedValue({
    status: "ok",
    report: {
      ...overview.recent_upgrades[0],
      release_id: "release-2026-04-24",
      target_version: "0.6.1",
    },
    upgrade_posture: {
      ...overview.upgrade_posture,
      latest_release_id: "release-2026-04-24",
      latest_target_version: "0.6.1",
    },
  });
  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
});

afterEach(() => {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  root = null;
});

describe("Recovery page", () => {
  it("loads overview posture and separates coverage, policy, backup, restore, and upgrade workflows", async () => {
    await renderRecoveryPage();

    expect(fetchRecoveryOverviewMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Recovery / Backup / Restore");
    expect(container.textContent).toContain("Coverage summary");
    expect(container.textContent).toContain("Current recovery risks");
    expect(container.textContent).toContain("blob_contents");
    expect(container.textContent).toContain("unprotected");
    expect(container.textContent).toContain("Protected");
    expect(container.textContent).toContain("Local secondary backup");

    await act(async () => {
      getButtonByText(container, "Policies").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    expect(container.textContent).toContain("Create policy");
    expect(container.textContent).toContain("Edit selected policy");

    await act(async () => {
      getButtonByText(container, "Backup Evidence").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    expect(container.textContent).toContain("Import backup manifest");

    await act(async () => {
      getButtonByText(container, "Restore Evidence").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    expect(container.textContent).toContain("Import restore report");

    await act(async () => {
      getButtonByText(container, "Upgrade / Rollback").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    expect(container.textContent).toContain("Import upgrade proof");
  });

  it("creates and updates recovery policies from the operator surface", async () => {
    fetchRecoveryOverviewMock
      .mockResolvedValueOnce(createOverview())
      .mockResolvedValueOnce(createOverview([createPolicySummary({
        policy: {
          ...createPolicySummary().policy,
          policy_id: "backup_policy_object",
          label: "Object storage backup",
          target_class: "object_storage",
          target_label: "s3://forgeframe-prod",
          target_config: { provider: "s3", bucket: "forgeframe-prod", prefix: "nightly" },
        },
      })]))
      .mockResolvedValueOnce(createOverview([createPolicySummary({
        policy: {
          ...createPolicySummary().policy,
          label: "Local secondary backup updated",
        },
      })]));

    await renderRecoveryPage();

    await act(async () => {
      getButtonByText(container, "Policies").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    await act(async () => {
      getButtonByText(container, "Create policy").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const createDrawer = getDrawerByTitle("Create Recovery Policy");
    await act(async () => {
      setControlValue(getLabeledControl(createDrawer, "Policy ID"), "backup_policy_object");
      setControlValue(getLabeledControl(createDrawer, "Label"), "Object storage backup");
      setControlValue(getLabeledControl(createDrawer, "Target class"), "object_storage");
      setControlValue(getLabeledControl(createDrawer, "Target label"), "s3://forgeframe-prod");
      setControlValue(getLabeledControl(createDrawer, "Target config JSON"), "{\n  \"provider\": \"s3\",\n  \"bucket\": \"forgeframe-prod\",\n  \"prefix\": \"nightly\"\n}");
      getButtonByText(createDrawer, "Create recovery policy").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createRecoveryBackupPolicyMock).toHaveBeenCalledWith(expect.objectContaining({
      policy_id: "backup_policy_object",
      label: "Object storage backup",
      target_class: "object_storage",
      target_label: "s3://forgeframe-prod",
      target_config: { provider: "s3", bucket: "forgeframe-prod", prefix: "nightly" },
    }));

    await act(async () => {
      getButtonByText(container, "Edit selected policy").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const editDrawer = getDrawerByTitle("Edit Recovery Policy");
    await act(async () => {
      setControlValue(getLabeledControl(editDrawer, "Label"), "Local secondary backup updated");
      getButtonByText(editDrawer, "Save selected policy").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateRecoveryBackupPolicyMock).toHaveBeenCalledWith("backup_policy_object", expect.objectContaining({
      label: "Local secondary backup updated",
    }));
  });

  it("keeps backup-only coverage blocked until restore evidence exists", async () => {
    fetchRecoveryOverviewMock.mockResolvedValueOnce(createOverview([
      createPolicySummary({
        latest_restore: null,
        restore_fresh: false,
        source_identity_verified: false,
        mismatches: ["restore_report_missing"],
        overall_status: "blocked",
      }),
    ]));

    await renderRecoveryPage();

    expect(container.textContent).toContain("restore never tested");
    expect(container.textContent).toContain("blocked");

    await act(async () => {
      getButtonByText(container, "Restore Evidence").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("never tested");
    expect(container.textContent).toContain("Restore has never been tested for this policy.");
  });

  it("treats paused policies as not effective protection", async () => {
    const pausedOverview = createOverview([
      createPolicySummary({
        policy: {
          ...createPolicySummary().policy,
          status: "paused",
        },
        backup_fresh: true,
        restore_fresh: true,
        source_identity_verified: true,
        mismatches: ["policy_paused_non_effective"],
        overall_status: "warning",
      }),
    ]);
    pausedOverview.summary = {
      ...pausedOverview.summary,
      active_policies: 0,
      healthy_policies: 0,
      warning_policies: 0,
      blocked_policies: 0,
      fresh_backup_policies: 0,
      fresh_restore_policies: 0,
      source_identity_verified_policies: 0,
      target_classes_present: [],
      protected_data_classes_present: [],
      missing_protected_data_classes: ["database", "artifact_metadata", "blob_contents", "configuration_state", "secret_metadata"],
      runtime_status: "blocked",
    };
    fetchRecoveryOverviewMock.mockResolvedValueOnce(pausedOverview);

    await renderRecoveryPage();

    expect(container.textContent).toContain("0/5");
    expect(container.textContent).not.toContain("covered and restore-tested");

    await act(async () => {
      getButtonByText(container, "Policies").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("paused / not effective");

    await act(async () => {
      getButtonByText(container, "Backup Evidence").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    expect(container.textContent).toContain("paused / not effective");
    expect(container.textContent).toContain("does not count as effective backup protection");

    await act(async () => {
      getButtonByText(container, "Restore Evidence").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    expect(container.textContent).toContain("paused / not effective");
    expect(container.textContent).toContain("does not count as effective restore protection");
  });

  it("imports backup, restore, and upgrade evidence through the product surface", async () => {
    fetchRecoveryOverviewMock
      .mockResolvedValueOnce(createOverview())
      .mockResolvedValue(createOverview());

    await renderRecoveryPage();

    await act(async () => {
      getButtonByText(container, "Backup Evidence").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    await act(async () => {
      setControlValue(getLabeledControl(container, "Backup manifest JSON"), "{}");
    });
    await flushEffects();
    expect(container.textContent).toContain("Backup manifest must contain backup_path.");

    await act(async () => {
      setControlValue(getLabeledControl(container, "Backup manifest JSON"), "{\n  \"backup_path\": \"/var/backups/forgeframe/latest.dump\",\n  \"manifest_path\": \"/var/backups/forgeframe/latest.dump.json\",\n  \"database\": \"forgeframe\",\n  \"cluster_system_identifier\": \"cluster-123\"\n}");
      getButtonByText(container, "Import backup manifest").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(importRecoveryBackupReportMock).toHaveBeenCalledWith(expect.objectContaining({
      policy_id: "backup_policy_local",
      manifest: expect.objectContaining({ database: "forgeframe" }),
    }));
    expect(container.textContent).toContain("Backup import: Local secondary backup");

    await act(async () => {
      getButtonByText(container, "Restore Evidence").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    await act(async () => {
      setControlValue(getLabeledControl(container, "Restore report JSON"), "{}");
    });
    await flushEffects();
    expect(container.textContent).toContain("Restore report must contain restored_database or target_database.");

    await act(async () => {
      setControlValue(getLabeledControl(container, "Restore report JSON"), "{\n  \"restored_database\": \"forgeframe_restore_smoke\",\n  \"source_database\": \"forgeframe\",\n  \"source_cluster_system_identifier\": \"cluster-123\",\n  \"tables_compared\": 1.5\n}");
    });
    await flushEffects();
    expect(container.textContent).toContain("Restore report must contain integer tables_compared >= 1.");

    await act(async () => {
      setControlValue(getLabeledControl(container, "Restore report JSON"), "{\n  \"restored_database\": \"forgeframe_restore_smoke\",\n  \"source_database\": \"forgeframe\",\n  \"source_cluster_system_identifier\": \"cluster-123\",\n  \"validated_source_databases\": [{\"database\": \"forgeframe\", \"cluster_system_identifier\": \"cluster-123\"}],\n  \"tables_compared\": 42\n}");
      getButtonByText(container, "Import restore report").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(importRecoveryRestoreReportMock).toHaveBeenCalledWith(expect.objectContaining({
      policy_id: "backup_policy_local",
      report: expect.objectContaining({ restored_database: "forgeframe_restore_smoke" }),
    }));
    expect(container.textContent).toContain("Restore import: Local secondary backup");

    await act(async () => {
      getButtonByText(container, "Upgrade / Rollback").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    await act(async () => {
      setControlValue(getLabeledControl(container, "Upgrade proof JSON"), "{}");
    });
    await flushEffects();
    expect(container.textContent).toContain("Upgrade report must contain release_id or release.");

    await act(async () => {
      setControlValue(getLabeledControl(container, "Upgrade proof JSON"), "{\n  \"release_id\": \"release-2026-04-24\",\n  \"target_version\": \"0.6.1\",\n  \"upgrade_result\": \"succeeded\",\n  \"rollback_classification\": \"not_needed\",\n  \"failure_classification\": \"none\",\n  \"before\": {},\n  \"after\": {}\n}");
    });
    await flushEffects();
    expect(container.textContent).toContain("Upgrade report must contain before or before_snapshot.");

    await act(async () => {
      setControlValue(getLabeledControl(container, "Upgrade proof JSON"), "{\n  \"release_id\": \"release-2026-04-24\",\n  \"target_version\": \"0.6.1\",\n  \"upgrade_result\": \"succeeded\",\n  \"rollback_classification\": \"manual_failover\",\n  \"failure_classification\": \"fatal\",\n  \"bootstrap_recovery_state\": \"recovered\",\n  \"before\": {\n    \"source_identity\": {\"source_database\": \"forgeframe\", \"cluster_system_identifier\": \"cluster-123\", \"deployment_slug\": \"forgeframe-prod\", \"public_fqdn\": \"forgeframe.example.com\"},\n    \"migration\": {\"latest_version\": 28},\n    \"critical_object_counts\": {\"runs\": 12, \"run_approval_links\": 3, \"memory_entries\": 8, \"skills\": 2},\n    \"queue_state_counts\": {\"queued\": 0, \"executing\": 0}\n  },\n  \"after\": {\n    \"source_identity\": {\"source_database\": \"forgeframe\", \"cluster_system_identifier\": \"cluster-123\", \"deployment_slug\": \"forgeframe-prod\", \"public_fqdn\": \"forgeframe.example.com\"},\n    \"migration\": {\"latest_version\": 29},\n    \"critical_object_counts\": {\"runs\": 12, \"run_approval_links\": 3, \"memory_entries\": 8, \"skills\": 2},\n    \"queue_state_counts\": {\"queued\": 0, \"executing\": 0}\n  }\n}");
    });
    await flushEffects();
    expect(container.textContent).toContain("Successful upgrade reports must use rollback_classification=not_needed or leave it empty.");

    await act(async () => {
      setControlValue(getLabeledControl(container, "Upgrade proof JSON"), "{\n  \"release_id\": \"release-2026-04-24\",\n  \"target_version\": \"0.6.1\",\n  \"upgrade_result\": \"succeeded\",\n  \"rollback_classification\": \"not_needed\",\n  \"failure_classification\": \"none\",\n  \"bootstrap_recovery_state\": \"recovered\",\n  \"before\": {\n    \"source_identity\": {\"source_database\": \"forgeframe\", \"cluster_system_identifier\": \"cluster-123\", \"deployment_slug\": \"forgeframe-prod\", \"public_fqdn\": \"forgeframe.example.com\"},\n    \"migration\": {\"latest_version\": 28},\n    \"critical_object_counts\": {\"runs\": 12, \"run_approval_links\": 3, \"memory_entries\": 8, \"skills\": 2},\n    \"queue_state_counts\": {\"queued\": 0, \"executing\": 0}\n  },\n  \"after\": {\n    \"source_identity\": {\"source_database\": \"forgeframe\", \"cluster_system_identifier\": \"cluster-123\", \"deployment_slug\": \"forgeframe-prod\", \"public_fqdn\": \"forgeframe.example.com\"},\n    \"migration\": {\"latest_version\": 29},\n    \"critical_object_counts\": {\"runs\": 12, \"run_approval_links\": 3, \"memory_entries\": 8, \"skills\": 2},\n    \"queue_state_counts\": {\"queued\": 0, \"executing\": 0}\n  }\n}");
      getButtonByText(container, "Import upgrade proof").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(importRecoveryUpgradeReportMock).toHaveBeenCalledWith(expect.objectContaining({
      report: expect.objectContaining({ release_id: "release-2026-04-24", target_version: "0.6.1" }),
    }));
    expect(container.textContent).toContain("Upgrade import: release-2026-04-24");
  });
});
