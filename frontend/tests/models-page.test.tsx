// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchModelRegisterMock, fetchInstancesMock, syncProvidersMock } = vi.hoisted(() => ({
  fetchModelRegisterMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
  syncProvidersMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchModelRegister: fetchModelRegisterMock,
    fetchInstances: fetchInstancesMock,
    syncProviders: syncProvidersMock,
  };
});

import type { AdminSessionUser, InstanceRecord } from "../src/api/admin";
import { ModelsPage } from "../src/pages/ModelsPage";
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
  instance_permissions: {
    instance_alpha: ["providers.read", "providers.write"],
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

function setControlValue(control: HTMLInputElement | HTMLSelectElement, value: string) {
  control.value = value;
  control.dispatchEvent(new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

function buildModelRegisterPayload() {
  return {
    status: "ok" as const,
    object: "model_register" as const,
    models: [
      {
        provider: "openai_api",
        provider_label: "OpenAI",
        provider_enabled: true,
        provider_integration_class: "openai_compatible",
        provider_last_sync_status: "ok",
        provider_last_sync_at: "2026-04-22T08:10:00Z",
        provider_last_sync_error: null,
        model_id: "gpt-4.1-mini",
        display_name: "gpt-4.1-mini",
        owned_by: "OpenAI",
        category: "general",
        routing_key: "openai_api/gpt-4.1-mini",
        capabilities: { streaming: true, tool_calling: true },
        execution_traits: { queue_eligible: true },
        policy_flags: { premium: true },
        economic_profile: { cost_class: "premium" },
        declared_capability_keys: ["streaming", "tool_calling", "queue_eligible"],
        source: "static",
        discovery_status: "catalog",
        runtime_status: "ready",
        availability_status: "healthy",
        health_status: "healthy",
        status_reason: null,
        active: true,
        target_count: 1,
        active_target_count: 1,
        routing_target_count: 1,
        target_keys: ["openai_api::gpt-4.1-mini"],
        linked_targets: [
          {
            target_key: "openai_api::gpt-4.1-mini",
            label: "OpenAI · gpt-4.1-mini",
            enabled: true,
            readiness_status: "ready",
            availability_status: "healthy",
            priority: 120,
            provider_enabled: true,
            model_active: true,
            routing_eligible: true,
          },
        ],
        routing_policy_classes: ["simple"],
        routing_status: "routable" as const,
        routing_ready: true,
        routing_reason: "1 provider target can route this model on the selected instance.",
        trust_status: "tested" as const,
        trust_reason: "Operator-visible verification exists through sync, health, or live probe records.",
        evidence: {
          runtime: {
            status: "observed",
            source: "runtime_non_stream",
            recorded_at: "2026-04-22T08:12:00Z",
            details: "Successful non-stream runtime request recorded.",
          },
          streaming: {
            status: "observed",
            source: "runtime_stream",
            recorded_at: "2026-04-22T08:13:00Z",
            details: "Successful streaming runtime request recorded.",
          },
          tool_calling: {
            status: "observed",
            source: "runtime_tool_call",
            recorded_at: "2026-04-22T08:14:00Z",
            details: "Successful runtime request with tool-call output recorded.",
          },
          live_probe: {
            status: "missing",
            source: "none",
            recorded_at: null,
            details: "No successful live probe recorded yet.",
          },
        },
        tested_evidence: {
          health_check: {
            status: "observed" as const,
            source: "provider_health",
            recorded_at: "2026-04-22T08:10:00Z",
            details: "Latest provider health posture is healthy.",
          },
          discovery_sync: {
            status: "observed" as const,
            source: "provider_sync",
            recorded_at: "2026-04-22T08:10:00Z",
            details: "Latest provider sync status is ok.",
          },
          live_probe: {
            status: "not_applicable" as const,
            source: "oauth_probe",
            recorded_at: null,
            details: "No explicit OAuth or live probe evidence exists for this model/provider path.",
          },
        },
        sync: {
          available: true,
          mode: "provider_sync" as const,
          detail: "Provider model discovery can be refreshed through POST /admin/providers/sync.",
        },
        last_seen_at: "2026-04-22T08:10:00Z",
        last_probe_at: null,
        stale_since: null,
      },
      {
        provider: "generic_harness",
        provider_label: "Generic Harness",
        provider_enabled: true,
        provider_integration_class: "harness_generic",
        provider_last_sync_status: "warning",
        provider_last_sync_at: "2026-04-22T09:00:00Z",
        provider_last_sync_error: "1 harness profile sync issue",
        model_id: "acme-vision-preview",
        display_name: "acme-vision-preview",
        owned_by: "Generic Harness",
        category: "general",
        routing_key: "generic_harness/acme-vision-preview",
        capabilities: { vision: true, streaming: false },
        execution_traits: {},
        policy_flags: {},
        economic_profile: { cost_class: "medium" },
        declared_capability_keys: ["vision"],
        source: "manual",
        discovery_status: "stale",
        runtime_status: "stale",
        availability_status: "stale",
        health_status: "degraded",
        status_reason: "removed_from_profile_models",
        active: false,
        target_count: 0,
        active_target_count: 0,
        routing_target_count: 0,
        target_keys: [],
        linked_targets: [],
        routing_policy_classes: [],
        routing_status: "stale" as const,
        routing_ready: false,
        routing_reason: "This model is stale and is not treated as a healthy routing candidate.",
        trust_status: "verification_failed" as const,
        trust_reason: "A recorded sync, health check, or live probe failed for this provider/model path.",
        evidence: {
          runtime: {
            status: "missing",
            source: "none",
            recorded_at: null,
            details: "No successful non-stream runtime request recorded yet.",
          },
          streaming: {
            status: "missing",
            source: "none",
            recorded_at: null,
            details: "No successful streaming runtime request recorded yet.",
          },
          tool_calling: {
            status: "missing",
            source: "none",
            recorded_at: null,
            details: "No successful runtime request with tool-call output recorded yet.",
          },
          live_probe: {
            status: "missing",
            source: "none",
            recorded_at: null,
            details: "No successful live probe recorded yet.",
          },
        },
        tested_evidence: {
          health_check: {
            status: "failed" as const,
            source: "provider_health",
            recorded_at: "2026-04-22T09:00:00Z",
            details: "Latest provider health posture is degraded.",
          },
          discovery_sync: {
            status: "failed" as const,
            source: "provider_sync",
            recorded_at: "2026-04-22T09:00:00Z",
            details: "1 harness profile sync issue",
          },
          live_probe: {
            status: "not_applicable" as const,
            source: "oauth_probe",
            recorded_at: null,
            details: "No explicit OAuth or live probe evidence exists for this model/provider path.",
          },
        },
        sync: {
          available: true,
          mode: "provider_sync" as const,
          detail: "Provider model discovery can be refreshed through POST /admin/providers/sync.",
        },
        last_seen_at: "2026-04-22T09:00:00Z",
        last_probe_at: null,
        stale_since: "2026-04-22T09:00:00Z",
      },
    ],
    summary: {
      total_models: 2,
      active_models: 1,
      models_with_targets: 1,
      runtime_ready_models: 1,
      routable_models: 1,
      tested_models: 1,
      uncovered_models: 1,
    },
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
  fetchModelRegisterMock.mockResolvedValue(buildModelRegisterPayload());
  syncProvidersMock.mockResolvedValue({
    status: "ok",
    synced_providers: ["openai_api"],
    sync_at: "2026-04-22T08:30:00Z",
    note: "provider sync finished",
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

describe("Models page", () => {
  it("loads the model register and renders routing, trust, and evidence truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/models?instanceId=instance_alpha",
      element: <ModelsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchModelRegisterMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Models Register");
    expect(container.textContent).toContain("Persistent model register");
    expect(container.textContent).toContain("gpt-4.1-mini");
    expect(container.textContent).toContain("OpenAI");
    expect(container.textContent).toContain("Policies: Simple");
    expect(container.textContent).toContain("Observed runtime evidence");
    expect(container.textContent).toContain("Tool calling");
    expect(container.textContent).toContain("1/1 routing-eligible targets");
  });

  it("filters the register by routing status and capability", async () => {
    await renderIntoDom(withAppContext({
      path: "/models?instanceId=instance_alpha",
      element: <ModelsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    const statusSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Filter by routing status"]');
    const capabilitySelect = container.querySelector<HTMLSelectElement>('select[aria-label="Filter by capability"]');

    expect(statusSelect).not.toBeNull();
    expect(capabilitySelect).not.toBeNull();

    await act(async () => {
      setControlValue(statusSelect!, "stale");
    });

    expect(container.textContent).toContain("acme-vision-preview");
    expect(container.textContent).not.toContain("gpt-4.1-miniPolicies: Simple");

    await act(async () => {
      setControlValue(statusSelect!, "all");
      setControlValue(capabilitySelect!, "vision");
    });

    expect(container.textContent).toContain("acme-vision-preview");
    expect(container.textContent).not.toContain("OpenAI · gpt-4.1-mini");
  });

  it("runs the real provider sync action when the session can mutate provider discovery", async () => {
    await renderIntoDom(withAppContext({
      path: "/models?instanceId=instance_alpha",
      element: <ModelsPage />,
      session: adminSession,
    }));
    await flushEffects();

    const syncButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Sync provider inventory"),
    );
    expect(syncButton).not.toBeNull();

    await act(async () => {
      syncButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(syncProvidersMock).toHaveBeenCalledWith("openai_api", "instance_alpha");
    expect(fetchModelRegisterMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Synced openai_api");
  });
});
