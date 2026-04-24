// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchProviderTargetsMock, updateProviderTargetMock, fetchInstancesMock } = vi.hoisted(() => ({
  fetchProviderTargetsMock: vi.fn(),
  updateProviderTargetMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchProviderTargets: fetchProviderTargetsMock,
    updateProviderTarget: updateProviderTargetMock,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, InstanceRecord } from "../src/api/admin";
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
        technical_capabilities: { streaming: true, tool_calling: true, vision: true },
        execution_traits: { queue_eligible: true, task_complexity_floor: "general" },
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
      },
    ],
    summary: {
      total_targets: 1,
      enabled_targets: 1,
      queue_eligible_targets: 1,
      ready_targets: 1,
    },
  });
  updateProviderTargetMock.mockResolvedValue({
    status: "ok",
    target: {
      target_key: "openai_api::gpt-4.1-mini",
      enabled: false,
      priority: 200,
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

describe("Provider targets page", () => {
  it("loads instance-bound targets and allows operator priority updates", async () => {
    await renderIntoDom(withAppContext({
      path: "/provider-targets?instanceId=instance_alpha",
      element: <ProviderTargetsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchProviderTargetsMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Provider Targets");
    expect(container.textContent).toContain("Instance-Bound Target Register");
    expect(container.textContent).toContain("openai_api::gpt-4.1-mini");
    expect(container.textContent).toContain("priority=125");

    const priorityInput = container.querySelector("input");
    const saveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Save priority"));

    await act(async () => {
      setInputValue(priorityInput as HTMLInputElement, "200");
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateProviderTargetMock).toHaveBeenCalledWith("openai_api::gpt-4.1-mini", {
      priority: 200,
    }, "instance_alpha");
  });
});
