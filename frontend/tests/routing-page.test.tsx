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

vi.mock("../src/api/admin/routing", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/routing")>("../src/api/admin/routing");
  return {
    ...actual,
    fetchRoutingControlPlane: fetchRoutingControlPlaneMock,
    updateRoutingPolicy: updateRoutingPolicyMock,
    updateRoutingBudget: updateRoutingBudgetMock,
    updateRoutingCircuit: updateRoutingCircuitMock,
    simulateRouting: simulateRoutingMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
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

const adminSession: AdminSessionUser = {
  ...operatorSession,
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
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
  simulateRoutingMock.mockImplementation(async (payload: Record<string, unknown>) => {
    const isNonSimple = Array.isArray(payload.tools) && payload.tools.length > 0;
    return {
      status: "ok",
      decision: {
        decision_id: isNonSimple ? "route_non_simple" : "route_simple",
        source: "admin_simulation",
        instance_id: "instance_alpha",
        selected_target_key: isNonSimple ? "openai_api::gpt-4.1-mini" : "ollama::llama3.2",
        classification: isNonSimple ? "non_simple" : "simple",
        classification_summary: isNonSimple
          ? "Deterministic routing rules classified this request as non-simple."
          : "No non-simple routing rule matched, so the request stays on the simple path.",
        classification_rules: isNonSimple ? ["tool_calling_requires_non_simple"] : ["default_simple_path"],
        policy_stage: "preferred",
        execution_lane: isNonSimple ? "queued_background" : "sync_interactive",
        summary: isNonSimple
          ? "non-simple routing selected 'openai_api::gpt-4.1-mini' on the preferred stage."
          : "simple routing selected 'ollama::llama3.2' on the preferred stage.",
        structured_details: { selected_target: isNonSimple ? "openai_api::gpt-4.1-mini" : "ollama::llama3.2", candidate_count: 2 },
        raw_details: {
          policy: { allow_premium: isNonSimple },
          selection_basis: {
            allowed_providers: payload.allowed_providers ?? null,
            route_context: payload.route_context ?? {},
            request_path_policy: (payload.route_context as Record<string, string> | undefined)?.request_path_policy ?? "smart_routing",
            blocked_cost_classes: [],
            budget_matching_scopes: [],
            open_circuits: [],
          },
        },
        candidates: [
          {
            target_key: "ollama::llama3.2",
            provider: "ollama",
            model_id: "llama3.2",
            label: "Ollama · llama3.2",
            stage_eligible: true,
            selected: !isNonSimple,
            priority: 120,
            cost_class: "low",
            latency_class: "low",
            availability_status: "healthy",
            health_status: "healthy",
            queue_eligible: true,
            capability_match: true,
            exclusion_reasons: isNonSimple ? ["tool_calling_missing"] : [],
            selection_reasons: !isNonSimple ? ["policy_prefers_local", "simple_cost_floor_match"] : [],
          },
          {
            target_key: "openai_api::gpt-4.1-mini",
            provider: "openai_api",
            model_id: "gpt-4.1-mini",
            label: "OpenAI · gpt-4.1-mini",
            stage_eligible: true,
            selected: isNonSimple,
            priority: 85,
            cost_class: "high",
            latency_class: "medium",
            availability_status: "healthy",
            health_status: "healthy",
            queue_eligible: true,
            capability_match: true,
            exclusion_reasons: [],
            selection_reasons: isNonSimple ? ["tool_calling_requires_non_simple", "non_simple_queue_match"] : [],
          },
        ],
        created_at: "2026-04-23T08:15:00Z",
      },
    };
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
  it("loads routing truth and compares simple and non-simple simulations with real routing context", async () => {
    await renderIntoDom(withAppContext({
      path: "/routing?instanceId=instance_alpha",
      element: <RoutingPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchRoutingControlPlaneMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Smart Execution Routing");
    expect(container.textContent).toContain("Policy editor");
    expect(container.textContent).toContain("Budget and circuit guardrails");
    expect(container.textContent).toContain("Ollama · llama3.2");

    const providerSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Simulation provider"]');
    const pathSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Request path policy"]');
    const scopeTypeSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Budget scope type"]');
    const requestClassSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Simulation request class"]');
    let scopeKeyInput = container.querySelector<HTMLInputElement>('input[aria-label="Budget scope key"]');

    expect(providerSelect).not.toBeNull();
    expect(pathSelect).not.toBeNull();
    expect(scopeTypeSelect).not.toBeNull();
    expect(requestClassSelect).not.toBeNull();
    expect(scopeKeyInput).not.toBeNull();

    await act(async () => {
      requestClassSelect!.value = "non_simple";
      requestClassSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      providerSelect!.value = "openai_api";
      providerSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      pathSelect!.value = "queue_background";
      pathSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      scopeTypeSelect!.value = "agent";
      scopeTypeSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    scopeKeyInput = container.querySelector<HTMLInputElement>('input[aria-label="Budget scope key"]');
    expect(scopeKeyInput).not.toBeNull();

    await act(async () => {
      scopeKeyInput!.value = "assistant-alpha";
      scopeKeyInput!.dispatchEvent(new Event("input", { bubbles: true }));
      scopeKeyInput!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    const simulateButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Run configured simulation");
    await act(async () => {
      simulateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(simulateRoutingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requested_model: null,
        allowed_providers: ["openai_api"],
        route_context: expect.objectContaining({
          instance_id: "instance_alpha",
          request_path_policy: "queue_background",
        }),
      }),
      "instance_alpha",
    );
    expect(container.textContent).toContain("Short decision");
    expect(container.textContent).toContain("openai_api::gpt-4.1-mini");
    expect(container.textContent).toContain("Expected lane matched: queued_background");

    const simpleButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Run simple simulation");
    await act(async () => {
      simpleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("ollama::llama3.2");
    expect(container.textContent).toContain("Simple and non-simple simulations currently resolve to different targets");
  });

  it("sanitizes writable budget scopes and shows inline simulation errors", async () => {
    await renderIntoDom(withAppContext({
      path: "/routing?instanceId=instance_alpha",
      element: <RoutingPage />,
      session: operatorSession,
    }));
    await flushEffects();

    const budgetTextarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Scoped budget rules writable JSON"]');
    expect(budgetTextarea).not.toBeNull();

    const parsedBudgetScopes = JSON.parse(budgetTextarea!.value) as Array<Record<string, unknown>>;
    expect(parsedBudgetScopes[0]).not.toHaveProperty("observed_cost");
    expect(parsedBudgetScopes[0]).not.toHaveProperty("soft_limit_exceeded");
    expect(parsedBudgetScopes[0]).not.toHaveProperty("last_evaluated_at");

    simulateRoutingMock.mockRejectedValueOnce(new Error("Unknown or inactive model: does-not-exist"));

    const modelInput = container.querySelector<HTMLInputElement>('input[aria-label="Simulation model"]');
    const runButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Run configured simulation");

    await act(async () => {
      modelInput!.value = "does-not-exist";
      modelInput!.dispatchEvent(new Event("input", { bubbles: true }));
      modelInput!.dispatchEvent(new Event("change", { bubbles: true }));
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Unknown or inactive model: does-not-exist");
  });
});
