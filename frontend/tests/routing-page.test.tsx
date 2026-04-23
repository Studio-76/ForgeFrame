// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchRoutingControlPlaneMock,
  updateRoutingPolicyMock,
  updateRoutingBudgetMock,
  updateRoutingCircuitMock,
  simulateRoutingMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchRoutingControlPlaneMock: vi.fn(),
  updateRoutingPolicyMock: vi.fn(),
  updateRoutingBudgetMock: vi.fn(),
  updateRoutingCircuitMock: vi.fn(),
  simulateRoutingMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchRoutingControlPlane: fetchRoutingControlPlaneMock,
    updateRoutingPolicy: updateRoutingPolicyMock,
    updateRoutingBudget: updateRoutingBudgetMock,
    updateRoutingCircuit: updateRoutingCircuitMock,
    simulateRouting: simulateRoutingMock,
  };
});

import type { AdminSessionUser, InstanceRecord } from "../src/api/admin";
import { RoutingPage } from "../src/pages/RoutingPage";
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
    description: "Alpha instance",
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
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  fetchRoutingControlPlaneMock.mockResolvedValue({
    status: "ok",
    object: "routing_control_plane",
    instance: createInstanceRecord(),
    policies: [
      {
        classification: "simple",
        display_name: "Simple",
        description: "Simple path",
        execution_lane: "sync_interactive",
        prefer_local: true,
        prefer_low_latency: true,
        allow_premium: false,
        allow_fallback: true,
        allow_escalation: true,
        require_queue_eligible: false,
        preferred_target_keys: ["ollama::llama3.2"],
        fallback_target_keys: ["openai_api::gpt-4.1-mini"],
        escalation_target_keys: ["anthropic::claude-3-5-sonnet-latest"],
      },
      {
        classification: "non_simple",
        display_name: "Non-Simple",
        description: "Non-simple path",
        execution_lane: "queued_background",
        prefer_local: false,
        prefer_low_latency: false,
        allow_premium: true,
        allow_fallback: true,
        allow_escalation: true,
        require_queue_eligible: true,
        preferred_target_keys: ["openai_api::gpt-4.1-mini"],
        fallback_target_keys: ["ollama::llama3.2"],
        escalation_target_keys: ["anthropic::claude-3-5-sonnet-latest"],
      },
    ],
    budget: {
      hard_blocked: false,
      blocked_cost_classes: ["premium"],
      reason: "Keep premium spend manual.",
      updated_at: "2026-04-23T08:00:00Z",
      scopes: [
        {
          scope_type: "agent",
          scope_key: "assistant-alpha",
          window: "24h",
          enabled: true,
          soft_cost_limit: 4,
          hard_cost_limit: 7,
          soft_token_limit: null,
          hard_token_limit: null,
          soft_blocked_cost_classes: ["high", "premium"],
          note: "Agent guardrail",
          observed_cost: 5.2,
          observed_tokens: 1200,
          previous_window_cost: 2.1,
          previous_window_tokens: 600,
          soft_limit_exceeded: true,
          hard_limit_exceeded: false,
          last_evaluated_at: "2026-04-23T08:05:00Z",
        },
      ],
      anomalies: [
        {
          scope_type: "agent",
          scope_key: "assistant-alpha",
          window: "24h",
          anomaly_type: "soft_limit_exceeded",
          severity: "warning",
          observed_cost: 5.2,
          observed_tokens: 1200,
          threshold_cost: 4,
          threshold_tokens: null,
          details: { source: "budget_scope" },
          detected_at: "2026-04-23T08:05:00Z",
        },
      ],
      last_evaluated_at: "2026-04-23T08:05:00Z",
    },
    circuits: [
      {
        target_key: "ollama::llama3.2",
        state: "open",
        reason: "Local model overloaded",
        updated_at: "2026-04-23T08:10:00Z",
      },
    ],
    targets: [
      {
        target_key: "ollama::llama3.2",
        provider: "ollama",
        model_id: "llama3.2",
        model_routing_key: "ollama/llama3.2",
        label: "Ollama · llama3.2",
        instance_id: "instance_alpha",
        product_axis: "local_providers",
        auth_type: "local_none",
        credential_type: "local_endpoint",
        capability_profile: { streaming: true, queue_eligible: true },
        cost_class: "low",
        latency_class: "low",
        enabled: true,
        priority: 120,
        queue_eligible: true,
        stream_capable: true,
        tool_capable: false,
        vision_capable: false,
        fallback_allowed: true,
        fallback_target_keys: [],
        escalation_allowed: true,
        escalation_target_keys: [],
        health_status: "healthy",
        availability_status: "healthy",
        readiness_status: "ready",
        status_reason: null,
        provider_label: "Ollama",
        model_display_name: "llama3.2",
        model_owned_by: "Ollama",
        runtime_ready: true,
        runtime_readiness_reason: "Runtime ready",
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
        product_axis: "openai_compatible_providers",
        auth_type: "api_key",
        credential_type: "api_key_secret",
        capability_profile: { streaming: true, tool_calling: true, queue_eligible: true },
        cost_class: "high",
        latency_class: "medium",
        enabled: true,
        priority: 85,
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
        status_reason: null,
        provider_label: "OpenAI",
        model_display_name: "gpt-4.1-mini",
        model_owned_by: "OpenAI",
        runtime_ready: true,
        runtime_readiness_reason: "Runtime ready",
        provider_enabled: true,
        model_active: true,
      },
    ],
    recent_decisions: [],
    summary: {
      policy_count: 2,
      open_circuits: 1,
      hard_budget_blocked: false,
      blocked_cost_classes: ["premium"],
      recent_decision_count: 0,
      classification_counts: { simple: 0, non_simple: 0 },
    },
  });
  updateRoutingPolicyMock.mockResolvedValue({ status: "ok", policy: {} });
  updateRoutingBudgetMock.mockResolvedValue({ status: "ok", budget: {} });
  updateRoutingCircuitMock.mockResolvedValue({ status: "ok", circuit: {} });
  simulateRoutingMock.mockResolvedValue({
    status: "ok",
    decision: {
      decision_id: "route_123",
      source: "admin_simulation",
      instance_id: "instance_alpha",
      selected_target_key: "openai_api::gpt-4.1-mini",
      classification: "non_simple",
      classification_summary: "Deterministic routing rules classified this request as non-simple.",
      classification_rules: ["tool_calling_requires_non_simple"],
      policy_stage: "preferred",
      execution_lane: "queued_background",
      summary: "non-simple routing selected 'openai_api::gpt-4.1-mini' on the preferred stage.",
      structured_details: { selected_target: "openai_api::gpt-4.1-mini", candidate_count: 2 },
      raw_details: { policy: { allow_premium: true }, selection_basis: { tools: true } },
      candidates: [],
      created_at: "2026-04-23T08:15:00Z",
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

describe("Routing page", () => {
  it("loads routing truth and can simulate a policy decision", async () => {
    await renderIntoDom(withAppContext({
      path: "/routing?instanceId=instance_alpha",
      element: <RoutingPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchRoutingControlPlaneMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Smart Execution Routing");
    expect(container.textContent).toContain("Policy Register");
    expect(container.textContent).toContain("Budget & Circuits");
    expect(container.textContent).toContain("Ollama · llama3.2");

    const simulateButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Run simulation");
    await act(async () => {
      simulateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(simulateRoutingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requested_model: null,
        prompt: "Route this quick provider health summary and keep it local if possible.",
        stream: false,
        require_vision: false,
      }),
      "instance_alpha",
    );
    expect(container.textContent).toContain("Simulation Result");
    expect(container.textContent).toContain("openai_api::gpt-4.1-mini");
    expect(container.textContent).toContain("Structured Explainability");
    expect(container.textContent).toContain("Raw Explainability");
  });
});
