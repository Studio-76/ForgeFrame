// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchRoutingControlPlaneMock,
  fetchUsageSummaryMock,
  updateRoutingBudgetMock,
  updateRoutingCircuitMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchRoutingControlPlaneMock: vi.fn(),
  fetchUsageSummaryMock: vi.fn(),
  updateRoutingBudgetMock: vi.fn(),
  updateRoutingCircuitMock: vi.fn(),
}));

vi.mock("../src/api/admin/routing", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/routing")>("../src/api/admin/routing");
  return {
    ...actual,
    fetchRoutingControlPlane: fetchRoutingControlPlaneMock,
    updateRoutingBudget: updateRoutingBudgetMock,
    updateRoutingCircuit: updateRoutingCircuitMock,
  };
});

vi.mock("../src/api/admin/usage", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/usage")>("../src/api/admin/usage");
  return {
    ...actual,
    fetchUsageSummary: fetchUsageSummaryMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, InstanceRecord, RoutingControlPlaneResponse, UsageSummaryResponse } from "../src/api/admin";
import { CostsPage } from "../src/pages/CostsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

const auditOnlySession: AdminSessionUser = {
  session_id: "session-audit-only",
  user_id: "user-audit-only",
  username: "auditor",
  display_name: "Auditor",
  role: "operator",
  active_instance_id: "instance_alpha",
  instance_permissions: {
    instance_alpha: ["audit.read"],
  },
};

function createInstanceRecord(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Alpha Instance",
    description: "Alpha cost scope",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "linux_host_native",
    exposure_mode: "same_origin",
    is_default: true,
    metadata: {},
    created_at: "2026-04-24T08:00:00Z",
    updated_at: "2026-04-24T08:00:00Z",
    ...overrides,
  };
}

function createUsageSummary(): UsageSummaryResponse {
  return {
    status: "ok",
    object: "usage_summary",
    metrics: {
      active_model_count: 4,
      stream_capable_model_count: 3,
      recorded_request_count: 14,
      recorded_error_count: 2,
      recorded_health_event_count: 4,
    },
    aggregations: {
      by_provider: [
        { provider: "openai_api", requests: 8, tokens: 4200, actual_cost: 3.8, hypothetical_cost: 3.8, avoided_cost: 0 },
        { provider: "openai_codex", requests: 4, tokens: 1800, actual_cost: 0, hypothetical_cost: 2.2, avoided_cost: 2.2 },
      ],
      by_model: [],
      by_auth: [],
      by_client: [
        { client_id: "ops-ui", requests: 10, tokens: 3300, actual_cost: 2.6, hypothetical_cost: 3.4, avoided_cost: 0.8 },
      ],
      by_traffic_type: [
        { traffic_type: "runtime", requests: 14, tokens: 6000, actual_cost: 3.8, hypothetical_cost: 6.0, avoided_cost: 2.2 },
        { traffic_type: "health_check", requests: 4, tokens: 200, actual_cost: 0.4, hypothetical_cost: 0.4, avoided_cost: 0 },
      ],
      errors_by_provider: [],
      errors_by_model: [],
      errors_by_client: [],
      errors_by_traffic_type: [],
      errors_by_type: [],
      errors_by_integration: [],
      errors_by_profile: [],
    },
    traffic_split: {
      runtime: { traffic_type: "runtime", requests: 14, tokens: 6000, actual_cost: 3.8, hypothetical_cost: 6.0, avoided_cost: 2.2 },
      health_check: { traffic_type: "health_check", requests: 4, tokens: 200, actual_cost: 0.4, hypothetical_cost: 0.4, avoided_cost: 0 },
    },
    cost_truths: {
      actual: {
        label: "Actual",
        status: "tracked",
        billing_truth: true,
        description: "Persisted runtime and health costs when ForgeFrame is the direct metering path.",
        runtime_cost: 3.8,
        health_check_cost: 0.4,
        total_cost: 4.2,
      },
      provider_reported: {
        label: "Provider reported",
        status: "unsupported",
        billing_truth: true,
        description: "ForgeFrame does not ingest provider invoices or billing exports on this host.",
        runtime_cost: null,
        health_check_cost: null,
        total_cost: null,
      },
      estimated: {
        label: "Estimated",
        status: "derived",
        billing_truth: false,
        description: "Configured price-card estimate across recorded traffic. Useful for forecast, not billing truth.",
        runtime_cost: 6.0,
        health_check_cost: 0.4,
        total_cost: 6.4,
      },
      modeled: {
        label: "Modeled",
        status: "derived",
        billing_truth: false,
        description: "Estimated cost exposure that is not directly metered by ForgeFrame actual-cost records.",
        runtime_cost: 2.2,
        health_check_cost: 0,
        total_cost: 2.2,
      },
      avoided: {
        label: "Avoided",
        status: "derived",
        billing_truth: false,
        description: "Estimated spend avoided when traffic would have been billable under a metered equivalent.",
        runtime_cost: 2.2,
        health_check_cost: 0,
        total_cost: 2.2,
      },
    },
    cost_axes: {
      actual: "tracked for metered API providers",
      provider_reported: "unsupported in the current control plane",
      estimated: "derived from configured pricing, never billing truth",
      modeled: "derived gap between estimated and metered actual cost",
      avoided: "derived from actual vs hypothetical",
    },
    window: "24h",
    latest_health: [],
    timeline_24h: [],
    alerts: [],
    selected_filters: {
      provider: null,
      client_id: null,
      model: null,
    },
    pricing_snapshot: {
      openai_input_per_1m: 10,
      openai_output_per_1m: 30,
      codex_hyp_input_per_1m: 15,
      codex_hyp_output_per_1m: 45,
    },
  };
}

function createRoutingSnapshot(): RoutingControlPlaneResponse {
  return {
    status: "ok",
    object: "routing_control_plane",
    instance: createInstanceRecord(),
    policies: [],
    budget: {
      hard_blocked: false,
      blocked_cost_classes: ["premium"],
      reason: "soft budget pressure",
      updated_at: "2026-04-24T08:12:00Z",
      scopes: [
        {
          scope_type: "instance",
          scope_key: "instance_alpha",
          window: "24h",
          enabled: true,
          soft_cost_limit: 4,
          hard_cost_limit: 8,
          soft_token_limit: null,
          hard_token_limit: null,
          soft_blocked_cost_classes: ["premium"],
          note: "Instance budget",
          observed_cost: 4.4,
          observed_tokens: 6200,
          previous_window_cost: 2.1,
          previous_window_tokens: 3100,
          soft_limit_exceeded: true,
          hard_limit_exceeded: false,
          last_evaluated_at: "2026-04-24T08:13:00Z",
        },
      ],
      anomalies: [
        {
          scope_type: "instance",
          scope_key: "instance_alpha",
          window: "24h",
          anomaly_type: "soft_limit_exceeded",
          severity: "warning",
          observed_cost: 4.4,
          observed_tokens: 6200,
          threshold_cost: 4,
          threshold_tokens: null,
          details: { source: "budget_scope" },
          detected_at: "2026-04-24T08:13:00Z",
        },
      ],
      last_evaluated_at: "2026-04-24T08:13:00Z",
    },
    circuits: [
      { target_key: "openai_api::gpt-4.1", state: "open", reason: "cost spike", updated_at: "2026-04-24T08:14:00Z" },
      { target_key: "ollama::llama3", state: "closed", reason: null, updated_at: "2026-04-24T07:55:00Z" },
    ],
    targets: [
      {
        target_key: "openai_api::gpt-4.1",
        provider: "openai_api",
        model_id: "gpt-4.1",
        model_routing_key: "openai_api/gpt-4.1",
        label: "OpenAI · gpt-4.1",
        instance_id: "instance_alpha",
        product_axis: "llm",
        auth_type: "api_key",
        credential_type: "api_key",
        capability_profile: {},
        technical_capabilities: {},
        execution_traits: {},
        policy_flags: {},
        economic_profile: {},
        cost_class: "premium",
        latency_class: "medium",
        priority: 100,
        enabled: true,
        queue_eligible: true,
        stream_capable: true,
        tool_capable: true,
        vision_capable: true,
        fallback_allowed: true,
        fallback_target_keys: [],
        escalation_allowed: true,
        escalation_target_keys: [],
        health_status: "healthy",
        availability_status: "healthy",
        readiness_status: "ready",
        runtime_ready: true,
        provider_enabled: true,
        model_active: true,
      },
      {
        target_key: "openai_api::gpt-4.1-mini",
        provider: "openai_api",
        model_id: "gpt-4.1-mini",
        model_routing_key: "openai_api/gpt-4.1-mini",
        label: "OpenAI · gpt-4.1-mini",
        instance_id: "instance_alpha",
        product_axis: "llm",
        auth_type: "api_key",
        credential_type: "api_key",
        capability_profile: {},
        technical_capabilities: {},
        execution_traits: {},
        policy_flags: {},
        economic_profile: {},
        cost_class: "medium",
        latency_class: "medium",
        priority: 80,
        enabled: true,
        queue_eligible: true,
        stream_capable: true,
        tool_capable: true,
        vision_capable: true,
        fallback_allowed: true,
        fallback_target_keys: [],
        escalation_allowed: true,
        escalation_target_keys: [],
        health_status: "healthy",
        availability_status: "healthy",
        readiness_status: "ready",
        runtime_ready: true,
        provider_enabled: true,
        model_active: true,
      },
      {
        target_key: "ollama::llama3",
        provider: "ollama",
        model_id: "llama3",
        model_routing_key: "ollama/llama3",
        label: "Ollama · llama3",
        instance_id: "instance_alpha",
        product_axis: "llm",
        auth_type: "bridge",
        credential_type: "bridge",
        capability_profile: {},
        technical_capabilities: {},
        execution_traits: {},
        policy_flags: {},
        economic_profile: {},
        cost_class: "low",
        latency_class: "low",
        priority: 60,
        enabled: true,
        queue_eligible: true,
        stream_capable: true,
        tool_capable: true,
        vision_capable: false,
        fallback_allowed: true,
        fallback_target_keys: [],
        escalation_allowed: false,
        escalation_target_keys: [],
        health_status: "healthy",
        availability_status: "healthy",
        readiness_status: "ready",
        runtime_ready: true,
        provider_enabled: true,
        model_active: true,
      },
    ],
    recent_decisions: [
      {
        decision_id: "route_1",
        source: "runtime_dispatch",
        instance_id: "instance_alpha",
        classification: "non_simple",
        classification_summary: "non-simple route",
        classification_rules: ["tool_calling"],
        policy_stage: "escalation",
        execution_lane: "sync_interactive",
        summary: "Premium model selected during escalation.",
        structured_details: {},
        raw_details: {},
        candidates: [
          {
            target_key: "openai_api::gpt-4.1",
            provider: "openai_api",
            model_id: "gpt-4.1",
            label: "OpenAI · gpt-4.1",
            stage_eligible: true,
            selected: true,
            priority: 100,
            cost_class: "premium",
            latency_class: "medium",
            availability_status: "healthy",
            health_status: "healthy",
            queue_eligible: true,
            capability_match: true,
            exclusion_reasons: [],
            selection_reasons: ["fallback_to_premium"],
          },
        ],
        created_at: "2026-04-24T08:15:00Z",
      },
      {
        decision_id: "route_2",
        source: "runtime_dispatch",
        instance_id: "instance_alpha",
        classification: "simple",
        classification_summary: "simple route",
        classification_rules: ["default_simple_path"],
        policy_stage: "preferred",
        execution_lane: "sync_interactive",
        summary: "Low-cost local target selected.",
        structured_details: {},
        raw_details: {},
        candidates: [
          {
            target_key: "ollama::llama3",
            provider: "ollama",
            model_id: "llama3",
            label: "Ollama · llama3",
            stage_eligible: true,
            selected: true,
            priority: 60,
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
        created_at: "2026-04-24T08:16:00Z",
      },
    ],
    summary: {},
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

async function renderCostsPage(session: AdminSessionUser) {
  await renderIntoDom(withAppContext({
    path: "/costs?instanceId=instance_alpha",
    element: <CostsPage />,
    session,
  }));
  await flushEffects();
}

function getInputByAriaLabel(label: string): HTMLInputElement {
  const input = container.querySelector(`[aria-label="${label}"]`);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Input ${label} not found`);
  }
  return input;
}

function getButtonByText(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent?.trim() === label);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button ${label} not found`);
  }
  return button;
}

function setControlValue(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLInputElement | HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  fetchUsageSummaryMock.mockResolvedValue(createUsageSummary());
  fetchRoutingControlPlaneMock.mockResolvedValue(createRoutingSnapshot());
  updateRoutingBudgetMock.mockResolvedValue({
    status: "ok",
    budget: createRoutingSnapshot().budget,
  });
  updateRoutingCircuitMock.mockResolvedValue({
    status: "ok",
    circuit: createRoutingSnapshot().circuits[0],
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

describe("costs page", () => {
  it("separates billing truth from estimated and modeled cost while staying honest about read-only sessions", async () => {
    await renderCostsPage(operatorSession);

    expect(container.textContent).toContain("Costs & Budget Controls");
    expect(container.textContent).toContain("Cost truth ledger");
    expect(container.textContent).toContain("Provider reported");
    expect(container.textContent).toContain("unsupported");
    expect(container.textContent).toContain("Budget posture");
    expect(container.textContent).toContain("Blocked cost classes");
    expect(container.textContent).toContain("Circuit & guard map");
    expect(container.textContent).toContain("This session is read-only for routing.write.");
    expect(getButtonByText("Save budget posture").disabled).toBe(true);
  });

  it("marks routing-derived budget and circuit summaries as hidden when routing truth is not visible", async () => {
    await renderCostsPage(auditOnlySession);

    expect(container.textContent).toContain("routing.read is required before this page can claim any budget, blocked-class, or circuit truth.");
    expect(container.textContent).toContain("Routing budget posture hidden");
    expect(container.textContent).toContain("Routing mix hidden");
    expect(container.textContent).not.toContain("No hard limit");
    expect(container.textContent).not.toContain("No target circuit is currently open.");
    expect(fetchRoutingControlPlaneMock).not.toHaveBeenCalled();
  });

  it("persists budget edits and target circuit state through the routing API when the session can mutate", async () => {
    await renderCostsPage(adminSession);

    await act(async () => {
      setControlValue(getInputByAriaLabel("Blocked cost classes"), "premium, high");
      setControlValue(getInputByAriaLabel("Budget reason"), "manual guard");
    });

    await act(async () => {
      getButtonByText("Save budget posture").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateRoutingBudgetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hard_blocked: false,
        blocked_cost_classes: ["premium", "high"],
        reason: "manual guard",
        scopes: [
          expect.objectContaining({
            scope_type: "instance",
            scope_key: "instance_alpha",
            window: "24h",
            soft_cost_limit: 4,
            hard_cost_limit: 8,
            soft_blocked_cost_classes: ["premium"],
          }),
        ],
      }),
      "instance_alpha",
    );

    const circuitReason = getInputByAriaLabel("Circuit reason ollama::llama3");
    await act(async () => {
      setControlValue(circuitReason, "load shed");
    });

    const targetRow = circuitReason.closest("tr");
    const openButton = Array.from(targetRow?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "Open");
    if (!(openButton instanceof HTMLButtonElement)) {
      throw new Error("Open button for ollama target not found");
    }

    await act(async () => {
      openButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateRoutingCircuitMock).toHaveBeenCalledWith(
      "ollama::llama3",
      {
        state: "open",
        reason: "load shed",
      },
      "instance_alpha",
    );
  });
});
