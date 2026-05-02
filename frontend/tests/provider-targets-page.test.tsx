// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchProviderTargetsMock, updateProviderTargetMock, fetchInstancesMock } = vi.hoisted(() => ({
  fetchProviderTargetsMock: vi.fn(),
  updateProviderTargetMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
}));

vi.mock("../src/api/admin/providers", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/providers")>("../src/api/admin/providers");
  return {
    ...actual,
    fetchProviderTargets: fetchProviderTargetsMock,
    updateProviderTarget: updateProviderTargetMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

vi.mock("../src/api/domain", async () => {
  const actual = await vi.importActual<typeof import("../src/api/domain")>("../src/api/domain");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, InstanceRecord, ProviderTargetRecord } from "../src/api/domain";
import { ProviderTargetsPage } from "../src/pages/ProviderTargetsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
  active_instance_id: "instance_alpha",
  instance_permissions: {
    instance_alpha: [
      "instance.read",
      "provider_targets.read",
      "provider_targets.write",
    ],
  },
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
    created_at: "2026-04-22T08:00:00Z",
    updated_at: "2026-04-22T08:00:00Z",
    ...overrides,
  };
}

function createTarget(overrides: Partial<ProviderTargetRecord> = {}): ProviderTargetRecord {
  return {
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
    technical_capabilities: { streaming: true, tool_calling: true, vision: true },
    execution_traits: { queue_eligible: true, task_complexity_floor: "general", execution_lane: "queued_background" },
    policy_flags: { fallback_allowed: true, premium_policy_gate: false },
    economic_profile: { cost_class: "high", latency_class: "medium", quality_tier: "premium" },
    cost_class: "high",
    latency_class: "medium",
    enabled: true,
    priority: 125,
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
    runtime_readiness_reason: "Live runtime evidence is recorded for this provider.",
    provider_enabled: true,
    model_active: true,
    last_probe_at: "2026-04-22T08:00:00Z",
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

function setInputValue(control: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(control: HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  fetchProviderTargetsMock.mockResolvedValue({
    status: "ok",
    object: "provider_target_register",
    targets: [
      createTarget(),
      createTarget({
        target_key: "anthropic_oauth::claude-3.5-sonnet",
        provider: "anthropic_oauth",
        model_id: "claude-3.5-sonnet",
        model_routing_key: "anthropic_oauth/claude-3.5-sonnet",
        label: "Anthropic OAuth · Claude 3.5 Sonnet",
        product_axis: "oauth_account_providers",
        auth_type: "oauth_account",
        credential_type: "oauth_token",
        capability_profile: { streaming: true, tool_calling: true, queue_eligible: false },
        technical_capabilities: { streaming: true, tool_calling: true, vision: false },
        execution_traits: { queue_eligible: false, task_complexity_floor: "premium", execution_lane: "sync_interactive" },
        policy_flags: { fallback_allowed: false, premium_policy_gate: true },
        economic_profile: { cost_class: "premium", latency_class: "medium", quality_tier: "premium" },
        cost_class: "premium",
        latency_class: "medium",
        enabled: false,
        priority: 10,
        queue_eligible: false,
        stream_capable: true,
        tool_capable: true,
        vision_capable: false,
        fallback_allowed: false,
        fallback_target_keys: [],
        escalation_allowed: false,
        escalation_target_keys: [],
        health_status: "degraded",
        availability_status: "degraded",
        readiness_status: "partial",
        status_reason: "OAuth bridge is present but native runtime evidence is incomplete.",
        provider_label: "Anthropic OAuth",
        model_display_name: "Claude 3.5 Sonnet",
        model_owned_by: "Anthropic",
        runtime_ready: false,
        runtime_readiness_reason: "Probe evidence exists, but premium OAuth target is not runtime-ready yet.",
      }),
    ],
    summary: {
      total_targets: 2,
      enabled_targets: 1,
      queue_eligible_targets: 1,
      ready_targets: 1,
    },
  });
  updateProviderTargetMock.mockResolvedValue({
    status: "ok",
    target: createTarget({
      enabled: false,
      priority: 200,
    }),
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

describe("Provider targets page", () => {
  it("loads instance-bound targets, keeps capabilities and policy flags separate, and saves priority updates", async () => {
    await renderIntoDom(withAppContext({
      path: "/provider-targets?instanceId=instance_alpha",
      element: <ProviderTargetsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchProviderTargetsMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Provider Targets");
    expect(container.textContent).toContain("Instance-bound target table");
    expect(container.textContent).toContain("OpenAI · gpt-4.1-mini");
    expect(container.textContent).toContain("Routing Dry Run");
    expect(container.textContent).toContain("Provider Health");
    expect(container.textContent).toContain("Capabilities");
    expect(container.textContent).toContain("Cost / quality profile");

    // Filters are collapsed by default — expand them
    const filterToggle = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Filter targets"),
    );
    expect(filterToggle).toBeTruthy();
    await act(async () => {
      filterToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const providerFilter = container.querySelector<HTMLSelectElement>('select[aria-label="Provider filter"]');
    expect(providerFilter?.value).toBe("all");

    await act(async () => {
      setSelectValue(providerFilter!, "OpenAI");
    });

    expect(container.textContent).toContain("Showing 1 of 2 instance-bound provider targets.");

    // Open policy editor to access priority and save controls
    const editPolicyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Edit target policy"),
    );
    expect(editPolicyButton).toBeTruthy();

    await act(async () => {
      editPolicyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const priorityInput = container.querySelector<HTMLInputElement>('input[aria-label="Priority"]');
    const saveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Save target changes"));

    await act(async () => {
      setInputValue(priorityInput!, "200");
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateProviderTargetMock).toHaveBeenCalledWith("openai_api::gpt-4.1-mini", {
      priority: 200,
    }, "instance_alpha");
  });

  it("requires explicit acknowledgement before promoting a premium OAuth target to the default active path", async () => {
    await renderIntoDom(withAppContext({
      path: "/provider-targets?instanceId=instance_alpha",
      element: <ProviderTargetsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    const oauthRowButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Anthropic OAuth · Claude 3.5 Sonnet"),
    );

    await act(async () => {
      oauthRowButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Disabled");
    expect(container.textContent).toContain("Anthropic OAuth · Claude 3.5 Sonnet");

    // Open policy editor to access enable checkbox and save
    const editPolicyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Edit target policy"),
    );
    expect(editPolicyButton).toBeTruthy();

    await act(async () => {
      editPolicyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const enableCheckbox = container.querySelector<HTMLInputElement>('input[aria-label="Enable target"]');
    let saveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Save target changes"));

    await act(async () => {
      enableCheckbox?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateProviderTargetMock).toHaveBeenCalledTimes(0);
    expect(container.textContent).toContain("Premium or OAuth target becomes the default active path");

    const confirmCheckbox = container.querySelector<HTMLInputElement>('input[aria-label="Confirm premium or OAuth default warning"]');

    await act(async () => {
      confirmCheckbox?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateProviderTargetMock).toHaveBeenCalledWith("anthropic_oauth::claude-3.5-sonnet", {
      enabled: true,
    }, "instance_alpha");
  });
});
