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

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

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
    report: overview.recent_upgrades[0],
    upgrade_posture: overview.upgrade_posture,
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
  it("loads overview posture and renders coverage plus policy truth", async () => {
    await renderRecoveryPage();

    expect(fetchRecoveryOverviewMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Recovery / Backup / Restore");
    expect(container.textContent).toContain("Coverage summary");
    expect(container.textContent).toContain("Upgrade / Rollback posture");
    expect(container.textContent).toContain("Local secondary backup");
    expect(container.textContent).toContain("Latest backup evidence");
    expect(container.textContent).toContain("Latest restore evidence");
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

    const textInputs = Array.from(container.querySelectorAll("input[type='text'], input:not([type])"));
    const textareas = Array.from(container.querySelectorAll("textarea"));
    const selects = Array.from(container.querySelectorAll("select"));
    const buttons = Array.from(container.querySelectorAll("button"));

    await act(async () => {
      setControlValue(textInputs[0] as HTMLInputElement, "backup_policy_object");
      setControlValue(textInputs[1] as HTMLInputElement, "Object storage backup");
      setControlValue(selects[0] as HTMLSelectElement, "object_storage");
      setControlValue(textInputs[2] as HTMLInputElement, "s3://forgeframe-prod");
      setControlValue(textareas[0] as HTMLTextAreaElement, "{\n  \"provider\": \"s3\",\n  \"bucket\": \"forgeframe-prod\",\n  \"prefix\": \"nightly\"\n}");
      buttons.find((button) => button.textContent?.includes("Create recovery policy"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
      const editLabelInput = Array.from(container.querySelectorAll("input"))
        .find((input) => (input as HTMLInputElement).value === "Object storage backup") as HTMLInputElement;
      setControlValue(editLabelInput, "Local secondary backup updated");
      buttons.find((button) => button.textContent?.includes("Save selected policy"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateRecoveryBackupPolicyMock).toHaveBeenCalledWith("backup_policy_object", expect.objectContaining({
      label: "Local secondary backup updated",
    }));
  });

  it("imports backup, restore, and upgrade evidence through the product surface", async () => {
    fetchRecoveryOverviewMock
      .mockResolvedValueOnce(createOverview())
      .mockResolvedValue(createOverview());

    await renderRecoveryPage();

    const textareas = Array.from(container.querySelectorAll("textarea"));
    const buttons = Array.from(container.querySelectorAll("button"));

    await act(async () => {
      setControlValue(textareas[4] as HTMLTextAreaElement, "{\n  \"backup_path\": \"/var/backups/forgeframe/latest.dump\",\n  \"manifest_path\": \"/var/backups/forgeframe/latest.dump.json\",\n  \"database\": \"forgeframe\",\n  \"cluster_system_identifier\": \"cluster-123\"\n}");
      buttons.find((button) => button.textContent?.includes("Import backup manifest"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(importRecoveryBackupReportMock).toHaveBeenCalledWith(expect.objectContaining({
      policy_id: "backup_policy_local",
      manifest: expect.objectContaining({ database: "forgeframe" }),
    }));

    await act(async () => {
      setControlValue(textareas[6] as HTMLTextAreaElement, "{\n  \"restored_database\": \"forgeframe_restore_smoke\",\n  \"source_database\": \"forgeframe\",\n  \"source_cluster_system_identifier\": \"cluster-123\",\n  \"validated_source_databases\": [{\"database\": \"forgeframe\", \"cluster_system_identifier\": \"cluster-123\"}],\n  \"tables_compared\": 42\n}");
      buttons.find((button) => button.textContent?.includes("Import restore report"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(importRecoveryRestoreReportMock).toHaveBeenCalledWith(expect.objectContaining({
      policy_id: "backup_policy_local",
      report: expect.objectContaining({ restored_database: "forgeframe_restore_smoke" }),
    }));

    await act(async () => {
      setControlValue(textareas[8] as HTMLTextAreaElement, "{\n  \"release_id\": \"release-2026-04-24\",\n  \"target_version\": \"0.6.1\",\n  \"upgrade_result\": \"succeeded\",\n  \"rollback_classification\": \"not_needed\",\n  \"failure_classification\": \"none\",\n  \"bootstrap_recovery_state\": \"recovered\",\n  \"before\": {\n    \"source_identity\": {\"source_database\": \"forgeframe\", \"cluster_system_identifier\": \"cluster-123\", \"deployment_slug\": \"forgeframe-prod\", \"public_fqdn\": \"forgeframe.example.com\"},\n    \"migration\": {\"latest_version\": 28},\n    \"critical_object_counts\": {\"runs\": 12, \"run_approval_links\": 3, \"memory_entries\": 8, \"skills\": 2},\n    \"queue_state_counts\": {\"queued\": 0, \"executing\": 0}\n  },\n  \"after\": {\n    \"source_identity\": {\"source_database\": \"forgeframe\", \"cluster_system_identifier\": \"cluster-123\", \"deployment_slug\": \"forgeframe-prod\", \"public_fqdn\": \"forgeframe.example.com\"},\n    \"migration\": {\"latest_version\": 29},\n    \"critical_object_counts\": {\"runs\": 12, \"run_approval_links\": 3, \"memory_entries\": 8, \"skills\": 2},\n    \"queue_state_counts\": {\"queued\": 0, \"executing\": 0}\n  }\n}");
      buttons.find((button) => button.textContent?.includes("Import upgrade proof"))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(importRecoveryUpgradeReportMock).toHaveBeenCalledWith(expect.objectContaining({
      report: expect.objectContaining({ release_id: "release-2026-04-24", target_version: "0.6.1" }),
    }));
  });
});
