// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchLogsMock,
  fetchProviderControlPlaneMock,
  fetchRoutingControlPlaneMock,
  fetchRuntimeHealthMock,
  fetchUsageSummaryMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchLogsMock: vi.fn(),
  fetchProviderControlPlaneMock: vi.fn(),
  fetchRoutingControlPlaneMock: vi.fn(),
  fetchRuntimeHealthMock: vi.fn(),
  fetchUsageSummaryMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchLogs: fetchLogsMock,
    fetchProviderControlPlane: fetchProviderControlPlaneMock,
    fetchRoutingControlPlane: fetchRoutingControlPlaneMock,
    fetchRuntimeHealth: fetchRuntimeHealthMock,
    fetchUsageSummary: fetchUsageSummaryMock,
  };
});

import type { AdminSessionUser, InstanceRecord } from "../src/api/admin";
import { CostsPage } from "../src/pages/CostsPage";
import { ErrorsPage } from "../src/pages/ErrorsPage";
import { HealthPage } from "../src/pages/HealthPage";
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
    description: "Alpha observability scope",
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
  fetchUsageSummaryMock.mockResolvedValue({
    status: "ok",
    object: "usage_summary",
    metrics: {
      active_model_count: 4,
      stream_capable_model_count: 3,
      recorded_request_count: 12,
      recorded_error_count: 2,
      recorded_health_event_count: 3,
    },
    aggregations: {
      by_provider: [{ provider: "openai_api", actual_cost: 3.4, hypothetical_cost: 4.1, avoided_cost: 0.7 }],
      by_model: [],
      by_auth: [],
      by_client: [{ client_id: "web-ui", requests: 8, actual_cost: 1.5 }],
      by_traffic_type: [],
      errors_by_provider: [],
      errors_by_model: [],
      errors_by_client: [],
      errors_by_traffic_type: [],
      errors_by_type: [],
      errors_by_integration: [],
      errors_by_profile: [],
    },
    traffic_split: {
      runtime: { actual_cost: 3.4, hypothetical_cost: 4.1, avoided_cost: 0.7 },
      health_check: { actual_cost: 0.2 },
    },
    cost_axes: { actual: "tracked", hypothetical: "tracked", avoided: "tracked" },
    window: "24h",
    latest_health: [],
    timeline_24h: [],
    alerts: [],
    pricing_snapshot: { openai_input_per_1m: 10, openai_output_per_1m: 30 },
  });
  fetchRoutingControlPlaneMock.mockResolvedValue({
    status: "ok",
    object: "routing_control_plane",
    instance: createInstanceRecord(),
    policies: [],
    budget: {
      hard_blocked: false,
      blocked_cost_classes: ["premium"],
      reason: "manual_control",
      updated_at: "2026-04-23T08:10:00Z",
      scopes: [
        {
          scope_type: "task",
          scope_key: "task-42",
          window: "24h",
          enabled: true,
          soft_cost_limit: 3,
          hard_cost_limit: 6,
          soft_token_limit: null,
          hard_token_limit: null,
          soft_blocked_cost_classes: ["premium"],
          note: "Task control",
          observed_cost: 3.6,
          observed_tokens: 800,
          previous_window_cost: 1.2,
          previous_window_tokens: 300,
          soft_limit_exceeded: true,
          hard_limit_exceeded: false,
          last_evaluated_at: "2026-04-23T08:11:00Z",
        },
      ],
      anomalies: [
        {
          scope_type: "task",
          scope_key: "task-42",
          window: "24h",
          anomaly_type: "soft_limit_exceeded",
          severity: "warning",
          observed_cost: 3.6,
          observed_tokens: 800,
          threshold_cost: 3,
          threshold_tokens: null,
          details: { source: "budget_scope" },
          detected_at: "2026-04-23T08:11:00Z",
        },
      ],
      last_evaluated_at: "2026-04-23T08:11:00Z",
    },
    circuits: [
      { target_key: "ollama::llama3.2", state: "open", reason: "overloaded", updated_at: "2026-04-23T08:12:00Z" },
    ],
    targets: [],
    recent_decisions: [
      {
        decision_id: "route_1",
        source: "runtime_dispatch",
        instance_id: "instance_alpha",
        classification: "simple",
        classification_summary: "simple",
        classification_rules: ["default_simple_path"],
        policy_stage: "preferred",
        execution_lane: "sync_interactive",
        summary: "simple routing selected local target",
        structured_details: { selected_target: "ollama::llama3.2" },
        raw_details: { policy: { allow_premium: false } },
        candidates: [
          {
            target_key: "ollama::llama3.2",
            provider: "ollama",
            model_id: "llama3.2",
            label: "Ollama · llama3.2",
            stage_eligible: true,
            selected: true,
            priority: 100,
            cost_class: "low",
            latency_class: "low",
            availability_status: "healthy",
            health_status: "healthy",
            queue_eligible: true,
            capability_match: true,
            exclusion_reasons: [],
            selection_reasons: ["local_bias"],
          },
        ],
        created_at: "2026-04-23T08:15:00Z",
      },
    ],
    summary: {},
  });
  fetchLogsMock.mockResolvedValue({
    status: "ok",
    audit_preview: [],
    audit_retention: { eventLimit: 1000, oldestAvailableAt: null, retentionLimited: false, latestEventAt: null },
    alerts: [{ severity: "warning", type: "provider_hotspot", message: "Provider openai_api is degraded." }],
    error_summary: { errors_24h: 2, errors_by_provider: [{ provider: "openai_api", errors: 2 }] },
    operability: {
      ready: true,
      checks: [
        { id: "runtime_signal_path", ok: true, details: "requests_24h=12" },
        { id: "routing_explainability_path", ok: true, details: "structured=1,raw=1" },
      ],
      metrics: {
        routing_metrics: {
          recent_failures: [
            { decision_id: "route_blocked", error_type: "routing_budget_exceeded", summary: "budget blocked", created_at: "2026-04-23T08:20:00Z" },
          ],
        },
      },
      logging: {},
      tracing: {},
    },
  });
  fetchRuntimeHealthMock.mockResolvedValue({
    status: "ok",
    app: "ForgeFrame",
    version: "test",
    api_base: "/",
    readiness: {
      state: "degraded",
      accepting_traffic: true,
      checked_at: "2026-04-23T08:30:00Z",
      checks: [
        { id: "root_ui_delivery", ok: false, severity: "warning" },
        { id: "public_https_listener", ok: false, severity: "warning" },
      ],
      warning_count: 2,
      critical_count: 0,
    },
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
        ready: false,
        readiness_reason: "probe_failed",
        contract_classification: "runtime-ready",
        capabilities: {},
        runtime_readiness: "partial",
        streaming_readiness: "partial",
        oauth_required: false,
        discovery_supported: true,
        model_count: 1,
        models: [
          {
            id: "gpt-4.1-mini",
            source: "catalog",
            discovery_status: "catalog",
            active: true,
            health_status: "degraded",
            availability_status: "degraded",
          },
        ],
        last_sync_at: null,
        last_sync_status: "ok",
        harness_proof_status: "partial",
        harness_proven_profile_keys: [],
      },
    ],
    health_config: {
      provider_health_enabled: true,
      model_health_enabled: true,
      interval_seconds: 300,
      probe_mode: "synthetic_probe",
      selected_models: [],
    },
    notes: {},
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

describe("observability pages", () => {
  it("renders the dedicated costs surface", async () => {
    await renderIntoDom(withAppContext({
      path: "/costs?instanceId=instance_alpha",
      element: <CostsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(container.textContent).toContain("Costs & Budget Controls");
    expect(container.textContent).toContain("Budget Posture");
    expect(container.textContent).toContain("Provider Cost Hotspots");
    expect(container.textContent).toContain("Recent Routing Cost Mix");
  });

  it("renders the dedicated errors surface", async () => {
    await renderIntoDom(withAppContext({
      path: "/errors?instanceId=instance_alpha",
      element: <ErrorsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(container.textContent).toContain("Errors & Incident Review");
    expect(container.textContent).toContain("Blocked Routing Failures");
    expect(container.textContent).toContain("routing_budget_exceeded");
  });

  it("renders the dedicated health surface", async () => {
    await renderIntoDom(withAppContext({
      path: "/health-status?instanceId=instance_alpha",
      element: <HealthPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(container.textContent).toContain("Health & Readiness");
    expect(container.textContent).toContain("Runtime Readiness");
    expect(container.textContent).toContain("Provider Health Posture");
    expect(container.textContent).toContain("public_https_listener");
  });
});
