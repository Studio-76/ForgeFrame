// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchBootstrapReadinessMock,
  fetchIngressTlsStatusMock,
  fetchRecoveryOverviewMock,
  fetchRuntimeHealthMock,
  fetchProviderControlPlaneMock,
  fetchRoutingControlPlaneMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchBootstrapReadinessMock: vi.fn(),
  fetchIngressTlsStatusMock: vi.fn(),
  fetchRecoveryOverviewMock: vi.fn(),
  fetchRuntimeHealthMock: vi.fn(),
  fetchProviderControlPlaneMock: vi.fn(),
  fetchRoutingControlPlaneMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchBootstrapReadiness: fetchBootstrapReadinessMock,
    fetchIngressTlsStatus: fetchIngressTlsStatusMock,
    fetchRecoveryOverview: fetchRecoveryOverviewMock,
    fetchRuntimeHealth: fetchRuntimeHealthMock,
    fetchProviderControlPlane: fetchProviderControlPlaneMock,
    fetchRoutingControlPlane: fetchRoutingControlPlaneMock,
  };
});

import type { AdminSessionUser, InstanceRecord } from "../src/api/admin";
import { IngressTlsPage } from "../src/pages/IngressTlsPage";
import { ReleaseValidationPage } from "../src/pages/ReleaseValidationPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

function createInstanceRecord(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Alpha Instance",
    description: "Alpha setup scope",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "linux_host_native",
    exposure_mode: "same_origin",
    is_default: true,
    metadata: {},
    created_at: "2026-04-23T08:00:00Z",
    updated_at: "2026-04-23T08:00:00Z",
    ...overrides,
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

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  fetchBootstrapReadinessMock.mockResolvedValue({
    status: "ok",
    ready: false,
    checked_at: "2026-04-23T08:30:00Z",
    checks: [
      { id: "root_ui_on_slash", ok: false, details: "Root slash still redirects to a non-normative surface." },
      { id: "same_origin_runtime_api", ok: true, details: "Runtime API is mounted under the same origin." },
      { id: "public_https_listener", ok: false, details: "Public HTTPS listener is not yet active." },
      { id: "port80_certificate_helper", ok: true, details: "Port 80 helper listener is available for ACME." },
      { id: "tls_certificate_management", ok: false, details: "Integrated certificate automation is missing." },
      { id: "linux_host_installation", ok: false, details: "Host-native Linux installation path is incomplete." },
    ],
    next_steps: [
      "Bind the UI to 0.0.0.0:443 under /.",
      "Enable integrated certificate automation before go-live.",
    ],
  });
  fetchIngressTlsStatusMock.mockResolvedValue({
    status: "ok",
    fqdn: "forgeframe.example.com",
    public_origin: "https://forgeframe.example.com",
    frontend_root_path: "/",
    runtime_api_base: "/v1",
    admin_api_base: "/admin",
    public_https_host: "0.0.0.0",
    public_https_port: 443,
    public_http_helper_host: "0.0.0.0",
    public_http_helper_port: 80,
    tls_mode: "disabled",
    acme_directory_url: "https://acme-v02.api.letsencrypt.org/directory",
    acme_webroot_path: "/var/lib/forgeframe/acme-webroot",
    integrated_tls_automation: true,
    dns_resolves: true,
    resolved_addresses: ["203.0.113.10"],
    certificate: {
      present: false,
      certificate_path: "/etc/forgeframe/tls/live/fullchain.pem",
      key_path: "/etc/forgeframe/tls/live/privkey.pem",
      issuer: null,
      subject: null,
      valid_from: null,
      valid_to: null,
      days_remaining: null,
      last_error: "certificate material missing",
    },
    mode_classification: "limited_exception",
    blockers: ["tls_mode_disabled", "certificate_material_missing"],
    checked_at: "2026-04-23T08:40:00Z",
  });
  fetchRuntimeHealthMock.mockResolvedValue({
    status: "ok",
    app: "ForgeFrame",
    version: "test",
    api_base: "/",
    readiness: {
      state: "degraded",
      accepting_traffic: true,
      checked_at: "2026-04-23T08:45:00Z",
      checks: [
        { id: "root_ui_on_slash", ok: false, severity: "warning" },
        { id: "runtime_signal_path", ok: true, severity: "ok" },
      ],
      warning_count: 1,
      critical_count: 0,
    },
  });
  fetchRecoveryOverviewMock.mockResolvedValue({
    status: "ok",
    summary: {
      total_policies: 1,
      active_policies: 1,
      healthy_policies: 1,
      warning_policies: 0,
      blocked_policies: 0,
      fresh_backup_policies: 1,
      fresh_restore_policies: 1,
      source_identity_verified_policies: 1,
      target_classes_present: ["local_secondary_disk"],
      missing_target_classes: ["second_host", "nas_share", "offsite_copy", "object_storage"],
      protected_data_classes_present: ["database"],
      missing_protected_data_classes: ["artifact_metadata", "blob_contents", "configuration_state", "secret_metadata"],
      runtime_status: "ok",
      checked_at: "2026-04-23T08:43:00Z",
    },
    upgrade_posture: {
      total_reports: 0,
      latest_release_id: null,
      latest_target_version: null,
      latest_status: null,
      latest_upgrade_result: null,
      latest_created_at: null,
      latest_imported_at: null,
      latest_no_loss_ok: false,
      latest_queue_drain_ok: false,
      latest_source_identity_stable: false,
      runtime_status: "blocked",
      blockers: ["upgrade_evidence_missing"],
    },
    recent_upgrades: [],
    policies: [],
  });
  fetchProviderControlPlaneMock.mockResolvedValue({
    status: "ok",
    object: "provider_control_plane",
    instance: createInstanceRecord(),
    providers: [
      {
        provider: "openai_api",
        label: "OpenAI",
        enabled: true,
        integration_class: "native",
        template_id: null,
        config: {},
        ready: true,
        readiness_reason: null,
        contract_classification: "runtime-ready",
        capabilities: {},
        runtime_readiness: "ready",
        streaming_readiness: "ready",
        oauth_required: false,
        discovery_supported: true,
        model_count: 1,
        models: [],
        last_sync_at: null,
        last_sync_status: "ok",
        harness_proof_status: "proven",
        harness_proven_profile_keys: ["openai-primary"],
      },
    ],
    health_config: {
      provider_health_enabled: true,
      model_health_enabled: true,
      interval_seconds: 300,
      probe_mode: "provider",
      selected_models: [],
    },
    notes: {},
  });
  fetchRoutingControlPlaneMock.mockResolvedValue({
    status: "ok",
    object: "routing_control_plane",
    instance: createInstanceRecord(),
    policies: [],
    budget: {
      hard_blocked: false,
      blocked_cost_classes: [],
      reason: null,
      updated_at: "2026-04-23T08:50:00Z",
    },
    circuits: [],
    targets: [],
    recent_decisions: [],
    summary: {},
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

describe("setup module pages", () => {
  it("renders the dedicated ingress and tls surface", async () => {
    await renderIntoDom(withAppContext({
      path: "/ingress-tls?instanceId=instance_alpha",
      element: <IngressTlsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(fetchBootstrapReadinessMock).toHaveBeenCalled();
    expect(fetchIngressTlsStatusMock).toHaveBeenCalled();
    expect(container.textContent).toContain("Ingress / TLS / Certificates");
    expect(container.textContent).toContain("forgeframe.example.com");
    expect(container.textContent).toContain("Certificate posture");
    expect(container.textContent).toContain("tls_mode_disabled");
    expect(container.textContent).toContain("Current blockers");
    expect(container.textContent).toContain("Bind the UI to 0.0.0.0:443 under /.");
  });

  it("renders the dedicated release validation surface", async () => {
    await renderIntoDom(withAppContext({
      path: "/release-validation?instanceId=instance_alpha",
      element: <ReleaseValidationPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(fetchBootstrapReadinessMock).toHaveBeenCalled();
    expect(fetchRuntimeHealthMock).toHaveBeenCalled();
    expect(fetchRecoveryOverviewMock).toHaveBeenCalled();
    expect(fetchProviderControlPlaneMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchRoutingControlPlaneMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Release / Validation");
    expect(container.textContent).toContain("Gate summary");
    expect(container.textContent).toContain("Current blockers");
    expect(container.textContent).toContain("root_ui_on_slash");
    expect(container.textContent).toContain("Upgrade integrity is not green");
    expect(container.textContent).toContain("Open Ingress / TLS / Certificates");
  });
});
