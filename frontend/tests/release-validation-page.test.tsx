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

vi.mock("../src/api/admin/bootstrap", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/bootstrap")>("../src/api/admin/bootstrap");
  return { ...actual, fetchBootstrapReadiness: fetchBootstrapReadinessMock };
});

vi.mock("../src/api/admin/ingress-tls", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/ingress-tls")>("../src/api/admin/ingress-tls");
  return { ...actual, fetchIngressTlsStatus: fetchIngressTlsStatusMock };
});

vi.mock("../src/api/admin/providers", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/providers")>("../src/api/admin/providers");
  return { ...actual, fetchProviderControlPlane: fetchProviderControlPlaneMock };
});

vi.mock("../src/api/admin/recovery", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/recovery")>("../src/api/admin/recovery");
  return { ...actual, fetchRecoveryOverview: fetchRecoveryOverviewMock };
});

vi.mock("../src/api/admin/routing", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/routing")>("../src/api/admin/routing");
  return { ...actual, fetchRoutingControlPlane: fetchRoutingControlPlaneMock };
});

vi.mock("../src/api/admin/health", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/health")>("../src/api/admin/health");
  return { ...actual, fetchRuntimeHealth: fetchRuntimeHealthMock };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return { ...actual, fetchInstances: fetchInstancesMock };
});

import type { AdminSessionUser } from "../src/api/admin";
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

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
}

beforeEach(() => {
  vi.resetAllMocks();

  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [
      {
        instance_id: "instance_alpha",
        slug: "instance-alpha",
        display_name: "Alpha Instance",
        description: "Alpha",
        status: "active",
        tenant_id: "tenant_alpha",
        company_id: "company_alpha",
        deployment_mode: "linux_host_native",
        exposure_mode: "same_origin",
        is_default: true,
        metadata: {},
        created_at: "2026-04-23T08:00:00Z",
        updated_at: "2026-04-23T08:00:00Z",
      },
    ],
  });

  fetchBootstrapReadinessMock.mockResolvedValue({
    status: "ok",
    ready: false,
    checked_at: "2026-04-23T08:30:00Z",
    checks: [
      { id: "root_ui_on_slash", ok: false, details: "Root slash still redirects to a non-normative surface." },
      { id: "public_https_listener", ok: true, details: "0.0.0.0:443;mode=integrated_acme" },
    ],
    next_steps: ["Restore root UI on slash."],
  });

  fetchRuntimeHealthMock.mockResolvedValue({
    status: "ok",
    app: "ForgeFrame",
    version: "test",
    api_base: "/v1",
    readiness: {
      state: "degraded",
      accepting_traffic: false,
      checked_at: "2026-04-23T08:45:00Z",
      checks: [
        { id: "runtime_accepting_traffic", ok: false, severity: "critical" },
      ],
      warning_count: 0,
      critical_count: 1,
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
    instance: null,
    providers: [
      {
        provider: "openai_api",
        label: "OpenAI",
        enabled: true,
        provider_class: "openai_compatible",
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
        last_sync_at: "2026-04-23T08:20:00Z",
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
    instance: null,
    policies: [],
    budget: {
      hard_blocked: false,
      blocked_cost_classes: [],
      reason: null,
      updated_at: "2026-04-23T08:50:00Z",
      scopes: [],
      anomalies: [],
      last_evaluated_at: "2026-04-23T08:50:00Z",
    },
    circuits: [],
    targets: [],
    recent_decisions: [],
    summary: {},
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
    tls_mode: "manual",
    acme_directory_url: "https://acme-v02.api.letsencrypt.org/directory",
    acme_webroot_path: "/var/lib/forgeframe/acme-webroot",
    integrated_tls_automation: true,
    dns_resolves: true,
    resolved_addresses: ["203.0.113.10"],
    certificate: {
      present: true,
      certificate_path: "/etc/forgeframe/tls/live/fullchain.pem",
      key_path: "/etc/forgeframe/tls/live/privkey.pem",
      trust_state: "self_signed",
      issuer: "CN=forgeframe.example.com",
      subject: "CN=forgeframe.example.com",
      valid_from: "Apr 23 00:00:00 2026 GMT",
      valid_to: "Jul 22 23:59:59 2026 GMT",
      last_issued_at: "2026-04-23T00:00:00+00:00",
      last_renewed_at: "2026-04-23T00:00:00+00:00",
      renewal_due_at: "2026-06-22T23:59:59+00:00",
      days_remaining: 54,
      last_error: null,
    },
    mode_classification: "limited_exception",
    renewal_supported: true,
    renewal_allowed: false,
    renewal_blocked_reason: "tls_mode_not_integrated_acme",
    blockers: ["tls_mode_not_integrated_acme"],
    checked_at: "2026-04-23T08:40:00Z",
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

describe("release validation page", () => {
  it("renders all gate categories with evidence timestamps and generated next routes", async () => {
    await renderIntoDom(withAppContext({
      path: "/release-validation?instanceId=instance_alpha",
      element: <ReleaseValidationPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(container.textContent).toContain("Build / Test");
    expect(container.textContent).toContain("Bootstrap");
    expect(container.textContent).toContain("Runtime API");
    expect(container.textContent).toContain("Provider");
    expect(container.textContent).toContain("OAuth");
    expect(container.textContent).toContain("Routing");
    expect(container.textContent).toContain("Queue / Dispatch");
    expect(container.textContent).toContain("Security");
    expect(container.textContent).toContain("TLS");
    expect(container.textContent).toContain("Backup / Recovery");
    expect(container.textContent).toContain("manual evidence required");
    expect(container.textContent).toContain("Review security posture");
    expect(container.textContent).toContain("Review queue and dispatch");
  });

  it("shows selected gate detail with the responsible correction route", async () => {
    await renderIntoDom(withAppContext({
      path: "/release-validation?instanceId=instance_alpha",
      element: <ReleaseValidationPage />,
      session: operatorSession,
    }));
    await flushEffects();

    const tlsButton = getButtonByText(container, "TLS");
    await act(async () => {
      tlsButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Ingress / TLS certificate status API");
    expect(container.textContent).toContain("exception mode");
    expect(container.textContent).toContain("View Ingress / TLS");
  });

  it("downgrades functionally green gates without evidence timestamps to manual evidence required", async () => {
    fetchBootstrapReadinessMock.mockResolvedValueOnce({
      status: "ok",
      ready: true,
      checks: [
        { id: "root_ui_on_slash", ok: true, details: "Root slash is bound to the control plane." },
      ],
      next_steps: [],
    });
    fetchRuntimeHealthMock.mockResolvedValueOnce({
      status: "ok",
      app: "ForgeFrame",
      version: "test",
      api_base: "/v1",
      readiness: {
        state: "ready",
        accepting_traffic: true,
        checks: [
          { id: "runtime_accepting_traffic", ok: true, severity: "ok" },
        ],
        warning_count: 0,
        critical_count: 0,
      },
    });
    fetchRecoveryOverviewMock.mockResolvedValueOnce({
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
        missing_target_classes: [],
        protected_data_classes_present: ["database", "artifact_metadata", "blob_contents", "configuration_state", "secret_metadata"],
        missing_protected_data_classes: [],
        runtime_status: "ok",
      },
      upgrade_posture: {
        total_reports: 1,
        latest_release_id: "release-1",
        latest_target_version: "2026.04.0",
        latest_status: "ok",
        latest_upgrade_result: "ok",
        latest_created_at: null,
        latest_imported_at: null,
        latest_no_loss_ok: true,
        latest_queue_drain_ok: true,
        latest_source_identity_stable: true,
        runtime_status: "ok",
        blockers: [],
      },
      recent_upgrades: [],
      policies: [],
    });
    fetchProviderControlPlaneMock.mockResolvedValueOnce({
      status: "ok",
      object: "provider_control_plane",
      instance: null,
      providers: [
        {
          provider: "openai_api",
          label: "OpenAI",
          enabled: true,
          provider_class: "openai_compatible",
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
    fetchRoutingControlPlaneMock.mockResolvedValueOnce({
      status: "ok",
      object: "routing_control_plane",
      instance: null,
      policies: [],
      budget: {
        hard_blocked: false,
        blocked_cost_classes: [],
        reason: null,
        scopes: [],
        anomalies: [],
      },
      circuits: [],
      targets: [
        {
          target_key: "openai-primary",
          provider: "openai_api",
          model: "gpt-4.1",
          enabled: true,
          mode: "primary",
          priority: 10,
        },
      ],
      recent_decisions: [],
      summary: {},
    });
    fetchIngressTlsStatusMock.mockResolvedValueOnce({
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
      tls_mode: "integrated_acme",
      acme_directory_url: "https://acme-v02.api.letsencrypt.org/directory",
      acme_webroot_path: "/var/lib/forgeframe/acme-webroot",
      integrated_tls_automation: true,
      dns_resolves: true,
      resolved_addresses: ["203.0.113.10"],
      certificate: {
        present: true,
        certificate_path: "/etc/forgeframe/tls/live/fullchain.pem",
        key_path: "/etc/forgeframe/tls/live/privkey.pem",
        trust_state: "public_ca",
        issuer: "Let's Encrypt",
        subject: "CN=forgeframe.example.com",
        valid_from: "Apr 23 00:00:00 2026 GMT",
        valid_to: "Jul 22 23:59:59 2026 GMT",
        last_issued_at: "2026-04-23T00:00:00+00:00",
        last_renewed_at: "2026-04-23T00:00:00+00:00",
        renewal_due_at: "2026-06-22T23:59:59+00:00",
        days_remaining: 54,
        last_error: null,
      },
      mode_classification: "normative_public_https",
      renewal_supported: true,
      renewal_allowed: true,
      renewal_blocked_reason: null,
      blockers: [],
    });

    await renderIntoDom(withAppContext({
      path: "/release-validation?instanceId=instance_alpha",
      element: <ReleaseValidationPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(container.textContent).toContain("release blocked");
    expect(container.textContent).not.toContain("Every hard gate is currently backed by real evidence.");

    const bootstrapButton = getButtonByText(container, "Bootstrap");
    await act(async () => {
      bootstrapButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Last checked");
    expect(container.textContent).toContain("Bootstrap is functionally green, but the release gate has no evidence timestamp.");
  });
});
