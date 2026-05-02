// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  createInstanceMock,
  updateInstanceMock,
  fetchAccountsMock,
  fetchBootstrapReadinessMock,
  fetchOauthOnboardingMock,
  fetchProviderControlPlaneMock,
  fetchRuntimeKeysMock,
  fetchRoutingControlPlaneMock,
  fetchAgentsMock,
  updateRoutingPolicyMock,
  createRuntimeKeyMock,
  runRuntimeKeyFirstSuccessProbeMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  createInstanceMock: vi.fn(),
  updateInstanceMock: vi.fn(),
  fetchAccountsMock: vi.fn(),
  fetchBootstrapReadinessMock: vi.fn(),
  fetchOauthOnboardingMock: vi.fn(),
  fetchProviderControlPlaneMock: vi.fn(),
  fetchRuntimeKeysMock: vi.fn(),
  fetchRoutingControlPlaneMock: vi.fn(),
  fetchAgentsMock: vi.fn(),
  updateRoutingPolicyMock: vi.fn(),
  createRuntimeKeyMock: vi.fn(),
  runRuntimeKeyFirstSuccessProbeMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    createInstance: createInstanceMock,
    updateInstance: updateInstanceMock,
    fetchAccounts: fetchAccountsMock,
    fetchBootstrapReadiness: fetchBootstrapReadinessMock,
    fetchOauthOnboarding: fetchOauthOnboardingMock,
    fetchProviderControlPlane: fetchProviderControlPlaneMock,
    fetchRuntimeKeys: fetchRuntimeKeysMock,
    fetchRoutingControlPlane: fetchRoutingControlPlaneMock,
    fetchAgents: fetchAgentsMock,
    updateRoutingPolicy: updateRoutingPolicyMock,
    createRuntimeKey: createRuntimeKeyMock,
    runRuntimeKeyFirstSuccessProbe: runRuntimeKeyFirstSuccessProbeMock,
  };
});

vi.mock("../src/api/domain/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/domain/instances")>("../src/api/domain/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, InstanceRecord } from "../src/api/admin";
import { OnboardingPage } from "../src/pages/OnboardingPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function createSession(overrides: Partial<AdminSessionUser>): AdminSessionUser {
  return {
    session_id: "session-test",
    user_id: "user-test",
    username: "admin",
    display_name: "Admin",
    role: "admin",
    session_type: "standard",
    read_only: false,
    must_rotate_password: false,
    ...overrides,
  };
}

function createInstanceRecord(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Alpha Instance",
    description: "Alpha runtime slice",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "linux_host_native",
    exposure_mode: "same_origin",
    is_default: true,
    metadata: {
      onboarding_v4: {
        operating_model: "team_company",
        operating_mode: "normative_public_https",
        routing_default: "local_first",
        fqdn: "forgeframe.example.com",
        dns_ready: true,
        port_80_ready: true,
        port_443_ready: true,
        tls_mode: "lets_encrypt",
        certificate_status: "issued",
        certificate_auto_renew: true,
        helper_port_80_mode: "acme_redirect_only",
      },
    },
    created_at: "2026-04-21T09:50:00Z",
    updated_at: "2026-04-21T09:50:00Z",
    ...overrides,
  };
}

function createOnboardingMetadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    operating_model: "team_company",
    operating_mode: "normative_public_https",
    routing_default: "local_first",
    fqdn: "forgeframe.example.com",
    dns_ready: true,
    port_80_ready: true,
    port_443_ready: true,
    tls_mode: "lets_encrypt",
    certificate_status: "issued",
    certificate_auto_renew: true,
    helper_port_80_mode: "acme_redirect_only",
    ...overrides,
  };
}

function createFirstSuccessProbe(overrides: Record<string, unknown> = {}) {
  return {
    runtime_key_id: "key-1",
    instance_id: "instance_alpha",
    tenant_id: "tenant_alpha",
    models_probe: {
      attempted: true,
      ok: true,
      status_code: 200,
      model_count: 2,
      error: null,
    },
    chat_probe: {
      attempted: false,
      ok: false,
      status_code: null,
      model: null,
      error: null,
    },
    success: true,
    executed_at: "2026-04-21T10:40:00Z",
    ...overrides,
  };
}

type RoutingPolicyOverride = Partial<{
  execution_lane: "sync_interactive" | "queued_background";
  prefer_local: boolean;
  prefer_low_latency: boolean;
  allow_premium: boolean;
  allow_fallback: boolean;
  allow_escalation: boolean;
  require_queue_eligible: boolean;
  preferred_target_keys: string[];
  fallback_target_keys: string[];
  escalation_target_keys: string[];
}>;

function createRoutingControlPlanePayload(
  nonSimpleApplied = false,
  overrides?: {
    simple?: RoutingPolicyOverride;
    non_simple?: RoutingPolicyOverride;
  },
) {
  return {
    status: "ok",
    object: "routing_control_plane",
    policies: [
      {
        classification: "simple",
        display_name: "Simple",
        description: "",
        execution_lane: "sync_interactive",
        prefer_local: true,
        prefer_low_latency: true,
        allow_premium: false,
        allow_fallback: true,
        allow_escalation: false,
        require_queue_eligible: false,
        preferred_target_keys: [],
        fallback_target_keys: [],
        escalation_target_keys: [],
        ...overrides?.simple,
      },
      {
        classification: "non_simple",
        display_name: "Non simple",
        description: "",
        execution_lane: "queued_background",
        prefer_local: !nonSimpleApplied,
        prefer_low_latency: false,
        allow_premium: nonSimpleApplied,
        allow_fallback: true,
        allow_escalation: nonSimpleApplied,
        require_queue_eligible: false,
        preferred_target_keys: [],
        fallback_target_keys: [],
        escalation_target_keys: [],
        ...overrides?.non_simple,
      },
    ],
    budget: { hard_blocked: false, blocked_cost_classes: [], scopes: [], anomalies: [] },
    circuits: [],
    targets: [],
    recent_decisions: [],
    summary: {},
  };
}

function createOperatorAgent(instanceId: string, companyId: string) {
  return {
    agent_id: `agent_${instanceId}`,
    instance_id: instanceId,
    company_id: companyId,
    display_name: "Operator",
    default_name: "Operator",
    role_kind: "operator" as const,
    status: "active" as const,
    participation_mode: "direct" as const,
    allowed_targets: [],
    is_default_operator: true,
    metadata: {},
    created_at: "2026-04-21T10:25:00Z",
    updated_at: "2026-04-21T10:25:00Z",
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
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderOnboardingPage(session: AdminSessionUser, path = "/onboarding") {
  await renderIntoDom(withAppContext({
    path,
    element: <OnboardingPage />,
    session,
  }));
  await flushEffects();
}

async function remountOnboardingPage(session: AdminSessionUser, path = "/onboarding") {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
    root = null;
  }
  await renderOnboardingPage(session, path);
}

function getField<T extends Element>(selector: string): T {
  const field = container.querySelector(selector);
  if (!field) {
    throw new Error(`Field not found: ${selector}`);
  }
  return field as T;
}

function setElementValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
}

async function changeTextControl(name: string, value: string) {
  const field = getField<HTMLInputElement>(`[name="${name}"]`);
  await act(async () => {
    setElementValue(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function changeSelect(name: string, value: string) {
  const field = getField<HTMLSelectElement>(`select[name="${name}"]`);
  await act(async () => {
    setElementValue(field, value);
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function changeInstanceScope(value: string) {
  const field = container.querySelector(".fg-inline-form select");
  if (!(field instanceof HTMLSelectElement)) {
    throw new Error("Instance scope select not found");
  }
  await act(async () => {
    setElementValue(field, value);
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flushEffects();
}

async function clickButton(text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  await act(async () => {
    (button as HTMLButtonElement).click();
  });
  await flushEffects();
}

function getWizardStepCard(title: string): HTMLElement {
  const heading = Array.from(container.querySelectorAll(".fg-checklist-step h4")).find((item) => item.textContent?.trim() === title);
  if (!(heading instanceof HTMLElement)) {
    throw new Error(`Wizard step not found: ${title}`);
  }
  const card = heading.closest(".fg-checklist-step");
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Wizard step card not found: ${title}`);
  }
  return card;
}

function getWizardStepStatus(title: string): string {
  const status = getWizardStepCard(title).querySelector(".fg-pill");
  if (!(status instanceof HTMLElement)) {
    throw new Error(`Wizard step status not found: ${title}`);
  }
  return status.textContent?.trim() ?? "";
}

function getPageCard(title: string): HTMLElement {
  const heading = Array.from(container.querySelectorAll(".fg-card h3")).find((item) => item.textContent?.trim() === title);
  if (!(heading instanceof HTMLElement)) {
    throw new Error(`Page card not found: ${title}`);
  }
  const card = heading.closest(".fg-card");
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Page card wrapper not found: ${title}`);
  }
  return card;
}

async function submitInterviewForm() {
  const form = getField<HTMLFormElement>("form");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();

  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  createInstanceMock.mockResolvedValue({
    status: "ok",
    instance: createInstanceRecord(),
  });
  updateInstanceMock.mockResolvedValue({
    status: "ok",
    instance: createInstanceRecord(),
  });
  fetchBootstrapReadinessMock.mockResolvedValue({
    status: "ok",
    ready: true,
    checks: [
      { id: "public_fqdn_configured", ok: true },
      { id: "public_dns_resolution", ok: true },
      { id: "public_https_listener", ok: true },
      { id: "certificate_material", ok: true },
      { id: "tls_mode_classification", ok: true },
      { id: "tls_certificate_management", ok: true },
    ],
    checked_at: "2026-04-21T10:00:00Z",
    next_steps: [],
  });
  fetchProviderControlPlaneMock.mockResolvedValue({
    status: "ok",
    object: "provider_control_plane",
    providers: [
      {
        provider: "openai_api",
        label: "OpenAI API",
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
        last_sync_at: "2026-04-21T10:00:00Z",
        last_sync_status: "ok",
        harness_proof_status: "none",
        harness_proven_profile_keys: [],
        provider_axis: "openai_compatible_providers",
        auth_mechanism: "api_key",
      },
    ],
    health_config: {
      provider_health_enabled: true,
      model_health_enabled: true,
      interval_seconds: 300,
      probe_mode: "discovery",
      selected_models: [],
    },
    notes: {},
  });
  fetchOauthOnboardingMock.mockResolvedValue({ status: "ok", targets: [] });
  fetchAccountsMock.mockResolvedValue({ status: "ok", accounts: [] });
  fetchRuntimeKeysMock.mockResolvedValue({
    status: "ok",
    keys: [{
      key_id: "key-1",
      account_id: null,
      label: "Primary key",
      prefix: "fg_live_123",
      scopes: ["models:read", "chat:write", "responses:write"],
      status: "active",
      created_at: "2026-04-21T10:25:00Z",
      updated_at: "2026-04-21T10:25:00Z",
    }],
  });
  fetchRoutingControlPlaneMock.mockResolvedValue(createRoutingControlPlanePayload(false));
  fetchAgentsMock.mockResolvedValue({
    status: "ok",
    agents: [createOperatorAgent("instance_alpha", "company_alpha")],
  });
  updateRoutingPolicyMock.mockResolvedValue({ status: "ok" });
  createRuntimeKeyMock.mockResolvedValue({
    status: "ok",
    issued: {
      key_id: "key-2",
      token: "fg_live_new_token",
      prefix: "fg_live_new",
      account_id: null,
      label: "Onboarding First Success Key",
      scopes: ["models:read", "chat:write", "responses:write"],
      created_at: "2026-04-21T10:25:00Z",
    },
  });
  runRuntimeKeyFirstSuccessProbeMock.mockResolvedValue({
    status: "ok",
    probe: {
      runtime_key_id: "key-2",
      instance_id: "instance_alpha",
      tenant_id: "tenant_alpha",
      models_probe: {
        attempted: true,
        ok: true,
        status_code: 200,
        model_count: 2,
        error: null,
      },
      chat_probe: {
        attempted: false,
        ok: false,
        status_code: null,
        model: null,
        error: null,
      },
      success: true,
      executed_at: "2026-04-21T10:40:00Z",
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

describe("Onboarding wizard", () => {
  it("renders wizard-first onboarding with operating-model mapping and operator visibility", async () => {
    await renderOnboardingPage(createSession({ role: "admin" }));

    expect(container.textContent).toContain("Guided setup checklist");
    expect(container.textContent).toContain("Solo operator");
    expect(container.textContent).toContain("My team / company");
    expect(container.textContent).toContain("Multiple customers / organizations");
    expect(container.textContent).toContain("Default operator product object detected: Operator.");
    expect(container.textContent).toContain("local, API-key, bridge-only, onboarding-only, unsupported");
  });

  it("creates the first instance from the wizard when inventory is empty", async () => {
    fetchInstancesMock
      .mockResolvedValueOnce({ status: "ok", instances: [] })
      .mockResolvedValueOnce({
        status: "ok",
        instances: [createInstanceRecord({
          instance_id: "customer-prod",
          slug: "customer-prod",
          display_name: "Customer Production",
          tenant_id: "customer-prod",
          company_id: "customer-prod",
        })],
      });
    createInstanceMock.mockResolvedValueOnce({
      status: "ok",
      instance: createInstanceRecord({
        instance_id: "customer-prod",
        slug: "customer-prod",
        display_name: "Customer Production",
        tenant_id: "customer-prod",
        company_id: "customer-prod",
      }),
    });

    await renderOnboardingPage(createSession({ role: "admin" }));
    await changeTextControl("instanceId", "customer-prod");
    await changeTextControl("displayName", "Customer Production");
    await changeTextControl("tenantId", "customer-prod");
    await changeTextControl("companyId", "customer-prod");
    await changeSelect("operatingMode", "normative_public_https");
    await submitInterviewForm();

    expect(createInstanceMock).toHaveBeenCalledWith(expect.objectContaining({
      instance_id: "customer-prod",
      display_name: "Customer Production",
      tenant_id: "customer-prod",
      company_id: "customer-prod",
    }));

    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(container.textContent).toContain("First instance Customer Production created and onboarding state saved.");
  });

  it("applies non-simple routing defaults and runs first-success probe", async () => {
    await renderOnboardingPage(createSession({ role: "admin" }));

    await act(async () => {
      const radio = getField<HTMLInputElement>('input[name="routingChoice"][value="non_simple"]');
      radio.click();
    });
    await clickButton("Apply routing defaults");

    expect(updateRoutingPolicyMock).toHaveBeenCalledWith("simple", expect.any(Object), null);
    expect(updateRoutingPolicyMock).toHaveBeenCalledWith("non_simple", expect.objectContaining({ allow_premium: true }), null);
    expect(updateInstanceMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      metadata: expect.objectContaining({
        onboarding_v4: expect.objectContaining({
          routing_default: "premium_capable",
        }),
      }),
    }));
    expect(container.textContent).toContain("Routing defaults saved as non-simple");

    await clickButton("Issue runtime key");
    expect(createRuntimeKeyMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("fg_live_new_token");

    await clickButton("Run first success probe");
    expect(runRuntimeKeyFirstSuccessProbeMock).toHaveBeenCalledWith(null, expect.objectContaining({
      runtime_key: "fg_live_new_token",
      chat_probe: true,
    }));
    expect(container.textContent).toContain("/v1/models: ok (200)");
  });

  it("keeps persisted first-success proof after probing and switching away and back", async () => {
    let currentInstances = [
      createInstanceRecord({
        metadata: {
          onboarding_v4: createOnboardingMetadata(),
        },
      }),
      createInstanceRecord({
        instance_id: "instance_beta",
        slug: "instance-beta",
        display_name: "Beta Instance",
        tenant_id: "tenant_beta",
        company_id: "company_beta",
        is_default: false,
        metadata: {
          onboarding_v4: createOnboardingMetadata(),
        },
      }),
    ];
    fetchInstancesMock.mockImplementation(async () => ({
      status: "ok",
      instances: currentInstances,
    }));
    fetchAgentsMock.mockImplementation(async (scopeInstanceId?: string | null) => ({
      status: "ok",
      agents: scopeInstanceId === "instance_beta"
        ? [createOperatorAgent("instance_beta", "company_beta")]
        : [createOperatorAgent("instance_alpha", "company_alpha")],
    }));
    runRuntimeKeyFirstSuccessProbeMock.mockImplementation(async () => {
      currentInstances = [
        createInstanceRecord({
          metadata: {
            onboarding_v4: createOnboardingMetadata(),
            onboarding_last_first_success_probe: createFirstSuccessProbe(),
          },
        }),
        createInstanceRecord({
          instance_id: "instance_beta",
          slug: "instance-beta",
          display_name: "Beta Instance",
          tenant_id: "tenant_beta",
          company_id: "company_beta",
          is_default: false,
          metadata: {
            onboarding_v4: createOnboardingMetadata(),
          },
        }),
      ];
      return {
        status: "ok",
        probe: createFirstSuccessProbe(),
      };
    });

    await renderOnboardingPage(createSession({ role: "admin" }), "/onboarding?instanceId=instance_alpha");

    expect(getWizardStepStatus("First Success Probe")).toBe("blocked");

    await changeTextControl("runtimeKeyTokenInput", "fg_live_alpha_probe");
    await clickButton("Run first success probe");

    expect(fetchInstancesMock).toHaveBeenCalledTimes(2);
    expect(getWizardStepStatus("First Success Probe")).toBe("done");
    expect(container.textContent).toContain("Executed at: 2026-04-21 10:40:00 UTC");

    await changeInstanceScope("instance_beta");
    expect(getWizardStepStatus("First Success Probe")).toBe("blocked");

    await changeInstanceScope("instance_alpha");
    expect(getWizardStepStatus("First Success Probe")).toBe("done");
    expect(container.textContent).toContain("Executed at: 2026-04-21 10:40:00 UTC");
  });

  it("keeps routing step blocked until backend truth matches the persisted non-simple intent", async () => {
    const instanceWithPersistedNonSimpleIntent = createInstanceRecord({
      metadata: {
        onboarding_v4: createOnboardingMetadata({
          routing_default: "premium_capable",
        }),
        onboarding_last_first_success_probe: createFirstSuccessProbe(),
      },
    });
    let currentRoutingControlPlane = createRoutingControlPlanePayload(false);
    fetchInstancesMock.mockImplementation(async () => ({
      status: "ok",
      instances: [instanceWithPersistedNonSimpleIntent],
    }));
    fetchRoutingControlPlaneMock.mockImplementation(async () => currentRoutingControlPlane);

    await renderOnboardingPage(createSession({ role: "admin" }), "/onboarding?instanceId=instance_alpha");

    expect(getField<HTMLInputElement>('input[name="routingChoice"][value="non_simple"]').checked).toBe(true);
    expect(getWizardStepCard("Routing simple/non-simple").textContent).toContain("non-simple premium/OAuth selected");
    expect(getWizardStepStatus("Routing simple/non-simple")).toBe("blocked");
    expect(getWizardStepCard("Routing simple/non-simple").textContent).toContain("Apply routing defaults from this wizard step.");
    expect(getWizardStepStatus("Go-live summary")).toBe("blocked");
    expect(getWizardStepCard("Go-live summary").textContent).toContain("Routing defaults are not aligned with the chosen simple/non-simple decision.");

    currentRoutingControlPlane = createRoutingControlPlanePayload(true, {
      non_simple: {
        allow_escalation: false,
      },
    });
    await remountOnboardingPage(createSession({ role: "admin" }), "/onboarding?instanceId=instance_alpha");

    expect(getWizardStepStatus("Routing simple/non-simple")).toBe("blocked");
    expect(getWizardStepCard("Routing simple/non-simple").textContent).toContain("Apply routing defaults from this wizard step.");
    expect(getWizardStepStatus("Go-live summary")).toBe("blocked");
    expect(getWizardStepCard("Go-live summary").textContent).toContain("Routing defaults are not aligned with the chosen simple/non-simple decision.");

    currentRoutingControlPlane = createRoutingControlPlanePayload(true);
    await remountOnboardingPage(createSession({ role: "admin" }), "/onboarding?instanceId=instance_alpha");

    expect(getField<HTMLInputElement>('input[name="routingChoice"][value="non_simple"]').checked).toBe(true);
    expect(getWizardStepCard("Routing simple/non-simple").textContent).toContain("non-simple premium/OAuth selected");
    expect(getWizardStepStatus("Routing simple/non-simple")).toBe("done");
    expect(getWizardStepStatus("Go-live summary")).toBe("done");
  });

  it("uses persisted normative onboarding truth for step 1 and go-live instead of unsaved draft edits", async () => {
    fetchInstancesMock.mockResolvedValue({
      status: "ok",
      instances: [createInstanceRecord({
        metadata: {
          onboarding_v4: createOnboardingMetadata({
            operating_mode: "limited_evaluation",
          }),
          onboarding_last_first_success_probe: createFirstSuccessProbe(),
        },
      })],
    });

    await renderOnboardingPage(createSession({ role: "admin" }));

    expect(getWizardStepStatus("Operating model and scope")).toBe("blocked");
    expect(getWizardStepStatus("First Success Probe")).toBe("done");
    expect(getWizardStepStatus("Go-live summary")).toBe("blocked");
    expect(getPageCard("1) Operating model and first instance").textContent).toContain("Limited mode recorded");

    await changeSelect("operatingMode", "normative_public_https");

    expect(getWizardStepStatus("Operating model and scope")).toBe("blocked");
    expect(getWizardStepStatus("Go-live summary")).toBe("blocked");
    expect(getWizardStepCard("Operating model and scope").textContent).toContain("limited_mode_selected");
    expect(getWizardStepCard("Go-live summary").textContent).toContain("limited_mode_selected");
    expect(getPageCard("1) Operating model and first instance").textContent).toContain("Limited mode recorded");
    expect(getPageCard("1) Operating model and first instance").textContent).not.toContain("Normative path recorded");
  });

  it("loads persisted first-success proof per instance and clears probe state when scope changes", async () => {
    fetchInstancesMock.mockResolvedValue({
      status: "ok",
      instances: [
        createInstanceRecord({
          metadata: {
            onboarding_v4: createOnboardingMetadata(),
            onboarding_last_first_success_probe: createFirstSuccessProbe(),
          },
        }),
        createInstanceRecord({
          instance_id: "instance_beta",
          slug: "instance-beta",
          display_name: "Beta Instance",
          tenant_id: "tenant_beta",
          company_id: "company_beta",
          is_default: false,
          metadata: {
            onboarding_v4: createOnboardingMetadata(),
          },
        }),
      ],
    });
    fetchAgentsMock.mockImplementation(async (instanceId?: string | null) => ({
      status: "ok",
      agents: instanceId
        ? [{
            agent_id: `agent_${instanceId}`,
            instance_id: instanceId,
            company_id: instanceId === "instance_beta" ? "company_beta" : "company_alpha",
            display_name: "Operator",
            default_name: "Operator",
            role_kind: "operator",
            status: "active",
            participation_mode: "direct",
            allowed_targets: [],
            is_default_operator: true,
            metadata: {},
            created_at: "2026-04-21T10:25:00Z",
            updated_at: "2026-04-21T10:25:00Z",
          }]
        : [],
    }));

    await renderOnboardingPage(createSession({ role: "admin" }), "/onboarding?instanceId=instance_alpha");

    expect(runRuntimeKeyFirstSuccessProbeMock).not.toHaveBeenCalled();
    expect(getWizardStepStatus("First Success Probe")).toBe("done");
    expect(container.textContent).toContain("/v1/models: ok (200)");

    await clickButton("Issue runtime key");
    expect(container.textContent).toContain("fg_live_new_token");

    await changeTextControl("runtimeKeyTokenInput", "alpha-manual-token");
    expect(getField<HTMLInputElement>('[name="runtimeKeyTokenInput"]').value).toBe("alpha-manual-token");

    await changeInstanceScope("instance_beta");

    expect(getWizardStepStatus("First Success Probe")).toBe("blocked");
    expect(getField<HTMLInputElement>('[name="runtimeKeyTokenInput"]').value).toBe("");
    expect(container.textContent).not.toContain("fg_live_new_token");
    expect(container.textContent).not.toContain("Executed at: 2026-04-21 10:40:00 UTC");
  });

  it("shows bridge-only provider posture and TLS blockers when evidence is missing", async () => {
    fetchProviderControlPlaneMock.mockResolvedValue({
      status: "ok",
      object: "provider_control_plane",
      providers: [
        {
          provider: "github_copilot",
          label: "GitHub Copilot",
          enabled: true,
          integration_class: "bridge",
          template_id: null,
          config: {},
          ready: false,
          readiness_reason: "Bridge probe exists but native runtime truth is missing.",
          contract_classification: "bridge-only",
          capabilities: {},
          runtime_readiness: "partial",
          streaming_readiness: "partial",
          oauth_required: true,
          discovery_supported: false,
          model_count: 0,
          models: [],
          last_sync_at: null,
          last_sync_status: "warning",
          harness_proof_status: "none",
          harness_proven_profile_keys: [],
          provider_axis: "oauth_account_providers",
          auth_mechanism: "oauth",
        },
      ],
      health_config: {
        provider_health_enabled: true,
        model_health_enabled: true,
        interval_seconds: 300,
        probe_mode: "discovery",
        selected_models: [],
      },
      notes: {},
    });
    fetchBootstrapReadinessMock.mockResolvedValue({
      status: "ok",
      ready: false,
      checks: [
        { id: "public_fqdn_configured", ok: false },
        { id: "public_dns_resolution", ok: false },
      ],
      checked_at: "2026-04-21T10:00:00Z",
      next_steps: [],
    });

    await renderOnboardingPage(createSession({ role: "admin" }));

    expect(container.textContent).toContain("bridge-only");
    expect(container.textContent).toContain("Bridge probe exists but native runtime truth is missing.");
    expect(container.textContent).toContain("FQDN/TLS remains blocked until bootstrap API checks show DNS, HTTPS listener, and certificate evidence.");
  });
});
