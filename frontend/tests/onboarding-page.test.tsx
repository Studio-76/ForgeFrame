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
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  createInstanceMock: vi.fn(),
  updateInstanceMock: vi.fn(),
  fetchAccountsMock: vi.fn(),
  fetchBootstrapReadinessMock: vi.fn(),
  fetchOauthOnboardingMock: vi.fn(),
  fetchProviderControlPlaneMock: vi.fn(),
  fetchRuntimeKeysMock: vi.fn(),
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
  };
});

import type {
  AdminSessionUser,
  GatewayAccount,
  InstanceRecord,
  ProviderControlItem,
  RuntimeKey,
} from "../src/api/admin";
import { OnboardingPage } from "../src/pages/OnboardingPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function createSession(overrides: Partial<AdminSessionUser>): AdminSessionUser {
  return {
    session_id: "session-test",
    user_id: "user-test",
    username: "ops-user",
    display_name: "Ops User",
    role: "operator",
    session_type: "standard",
    read_only: false,
    must_rotate_password: false,
    ...overrides,
  };
}

function createOnboardingMetadata(overrides: Record<string, unknown> = {}) {
  return {
    onboarding_v4: {
      operating_mode: "normative_public_https",
      postgres_mode: "native_host",
      fqdn: "forgeframe.example.com",
      dns_ready: true,
      port_80_ready: true,
      port_443_ready: true,
      tls_mode: "lets_encrypt",
      certificate_status: "issued",
      certificate_auto_renew: true,
      helper_port_80_mode: "acme_redirect_only",
      provider_direction: "mixed_control_plane",
      autonomy_mode: "bounded_autonomy",
      routing_default: "balanced",
      allow_premium_escalation: true,
      runtime_driver_mode: "embedded_control_plane",
      edge_admission_mode: "disabled",
      work_interaction_mode: "ops_assistant",
      inbox_enabled: true,
      tasks_enabled: true,
      notifications_enabled: true,
      assistant_mode: "ops",
      first_success_action: "provider_verification",
      first_artifact: "provider_preview",
      operator_surface: "providers",
      ...overrides,
    },
  };
}

function createLimitedOnboardingMetadata(overrides: Record<string, unknown> = {}) {
  return createOnboardingMetadata({
    operating_mode: "limited_evaluation",
    fqdn: "",
    dns_ready: false,
    port_80_ready: false,
    port_443_ready: false,
    tls_mode: "disabled",
    certificate_status: "manual",
    certificate_auto_renew: false,
    helper_port_80_mode: "not_available",
    ...overrides,
  });
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
    metadata: createOnboardingMetadata(),
    created_at: "2026-04-21T09:50:00Z",
    updated_at: "2026-04-21T09:50:00Z",
    ...overrides,
  };
}

function createBootstrapReadiness(ready = true) {
  return {
    status: "ok",
    ready,
    checks: [
      { id: "compose_file", ok: true, details: "docker/docker-compose.yml" },
      { id: "env_compose", ok: true, details: ".env.compose" },
      { id: "postgres_url", ok: ready, details: "FORGEFRAME_HARNESS_POSTGRES_URL" },
    ],
    next_steps: ["Run ./scripts/bootstrap-forgeframe.sh."],
    checked_at: "2026-04-21T10:00:00Z",
  };
}

function createProvider(overrides: Partial<ProviderControlItem> = {}): ProviderControlItem {
  return {
    provider: "openai_codex",
    label: "OpenAI Codex",
    enabled: true,
    integration_class: "native",
    template_id: null,
    config: {},
    ready: true,
    readiness_reason: null,
    contract_classification: "runtime-ready",
    capabilities: {},
    tool_calling_level: "full",
    compatibility_depth: "validated",
    runtime_readiness: "ready",
    streaming_readiness: "ready",
    provider_axis: "oauth_account_providers",
    auth_mechanism: "oauth",
    oauth_required: true,
    oauth_mode: "oauth",
    discovery_supported: false,
    model_count: 1,
    models: [
      {
        id: "codex-mini-latest",
        source: "static",
        discovery_status: "listed",
        active: true,
        health_status: "healthy",
        last_seen_at: "2026-04-21T10:05:00Z",
        last_probe_at: "2026-04-21T10:05:00Z",
      },
    ],
    last_sync_at: "2026-04-21T10:10:00Z",
    last_sync_status: "ok",
    harness_profile_count: 0,
    harness_run_count: 0,
    harness_needs_attention_count: 0,
    harness_proof_status: "none",
    harness_proven_profile_keys: [],
    oauth_failure_count: 0,
    oauth_last_probe: { executed_at: "2026-04-21T10:15:00Z" },
    oauth_last_bridge_sync: null,
    ...overrides,
  };
}

function createAccount(overrides: Partial<GatewayAccount> = {}): GatewayAccount {
  return {
    account_id: "acct-1",
    label: "Primary runtime account",
    status: "active",
    provider_bindings: ["openai_codex"],
    notes: "",
    created_at: "2026-04-21T10:20:00Z",
    updated_at: "2026-04-21T10:20:00Z",
    runtime_key_count: 1,
    ...overrides,
  };
}

function createKey(overrides: Partial<RuntimeKey> = {}): RuntimeKey {
  return {
    key_id: "key-1",
    account_id: "acct-1",
    label: "Primary runtime key",
    prefix: "fg_live_123",
    scopes: ["models:read", "chat:write", "responses:write"],
    status: "active",
    created_at: "2026-04-21T10:25:00Z",
    updated_at: "2026-04-21T10:25:00Z",
    ...overrides,
  };
}

function createOauthTarget(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provider_key: "openai_codex",
    readiness: "ready",
    configured: true,
    next_steps: ["Codex is operational; verify UI and runtime behavior against live upstreams."],
    operational_depth: "runtime_evidenced",
    evidence: {
      live_probe: { status: "missing" },
      runtime: { status: "observed", details: "Live runtime traffic is recorded for this provider." },
    },
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

async function renderOnboardingPage(session: AdminSessionUser, path = "/onboarding") {
  await renderIntoDom(withAppContext({
    path,
    element: <OnboardingPage />,
    session,
  }));
  await flushEffects();
}

function collectLinkHrefs(): string[] {
  return Array.from(container.querySelectorAll("a"))
    .map((link) => link.getAttribute("href"))
    .filter((href): href is string => Boolean(href));
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
  const field = getField<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
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

async function changeCheckbox(name: string, checked: boolean) {
  const field = getField<HTMLInputElement>(`input[name="${name}"]`);
  await act(async () => {
    if (field.checked !== checked) {
      field.click();
    }
  });
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
  fetchBootstrapReadinessMock.mockResolvedValue(createBootstrapReadiness(true));
  fetchProviderControlPlaneMock.mockResolvedValue({
    status: "ok",
    object: "provider_control_plane",
    providers: [createProvider()],
    health_config: {
      provider_health_enabled: true,
      model_health_enabled: true,
      interval_seconds: 300,
      probe_mode: "discovery",
      selected_models: [],
    },
    notes: {},
  });
  fetchOauthOnboardingMock.mockResolvedValue({
    status: "ok",
    targets: [createOauthTarget()],
  });
  fetchAccountsMock.mockResolvedValue({
    status: "ok",
    accounts: [createAccount()],
  });
  fetchRuntimeKeysMock.mockResolvedValue({
    status: "ok",
    keys: [createKey()],
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

describe("Onboarding page checklist", () => {
  it("shows the go-live success state for standard admin sessions when onboarding truth is normative", async () => {
    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    expect(fetchBootstrapReadinessMock).toHaveBeenCalledTimes(1);
    expect(fetchProviderControlPlaneMock).toHaveBeenCalledTimes(1);
    expect(fetchOauthOnboardingMock).toHaveBeenCalledTimes(1);
    expect(fetchAccountsMock).toHaveBeenCalledTimes(1);
    expect(fetchRuntimeKeysMock).toHaveBeenCalledTimes(1);

    expect(container.textContent).toContain("Admin setup actions enabled");
    expect(container.textContent).toContain("Normative path recorded");
    expect(container.textContent).toContain("Ready for live traffic");
    expect(container.textContent).toContain("ForgeFrame is ready for live traffic from the current control-plane view.");
    expect(container.textContent).toContain("1/1 configured OAuth/account targets have live probe or runtime evidence.");
    expect(container.textContent).toContain("Checklist progress");
    expect(container.textContent).toContain("5/5");
    expect(container.textContent).toContain("Open Dashboard");
  });

  it("threads instance scope through onboarding fetches and checklist links", async () => {
    await renderOnboardingPage(
      createSession({ role: "admin", username: "admin", display_name: "Admin" }),
      "/onboarding?instanceId=instance_alpha",
    );

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchProviderControlPlaneMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchOauthOnboardingMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchAccountsMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchRuntimeKeysMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Instance scope: Alpha Instance");
    expect(container.textContent).toContain("Current binding: tenant tenant_alpha");

    const hrefs = collectLinkHrefs();
    expect(hrefs).toContain("/onboarding?instanceId=instance_alpha");
    expect(hrefs).toContain("/providers?instanceId=instance_alpha");
    expect(hrefs).toContain("/accounts?instanceId=instance_alpha");
    expect(hrefs).toContain("/api-keys?instanceId=instance_alpha");
    expect(hrefs).toContain("/dashboard?instanceId=instance_alpha");
    expect(hrefs).toContain("/providers?instanceId=instance_alpha#provider-health-runs");
  });

  it("counts bridge-only probe evidence without treating the target as live-provider proof", async () => {
    fetchProviderControlPlaneMock.mockResolvedValueOnce({
      status: "ok",
      object: "provider_control_plane",
      providers: [],
      health_config: {
        provider_health_enabled: true,
        model_health_enabled: true,
        interval_seconds: 300,
        probe_mode: "discovery",
        selected_models: [],
      },
      notes: {},
    });
    fetchOauthOnboardingMock.mockResolvedValueOnce({
      status: "ok",
      targets: [
        {
          provider_key: "github_copilot",
          readiness: "partial",
          configured: true,
          readiness_reason: "Live probe evidence is recorded, but this target remains onboarding/bridge-only in the current release truth.",
          operational_depth: "bridge_probe_evidenced",
          evidence: {
            live_probe: {
              status: "observed",
              details: "GitHub Copilot bridge probe succeeded.",
            },
            runtime: {
              status: "missing",
            },
          },
          next_steps: ["Keep github_copilot positioned as onboarding/bridge-only; probe success does not promote it to native runtime-ready truth."],
        },
      ],
    });
    fetchAccountsMock.mockResolvedValueOnce({
      status: "ok",
      accounts: [],
    });
    fetchRuntimeKeysMock.mockResolvedValueOnce({
      status: "ok",
      keys: [],
    });

    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    expect(container.textContent).toContain("Provider onboarding is visible, but no route is ready for live traffic yet.");
    expect(container.textContent).toContain("0 runtime-ready provider routes, 0 eligible for live go-live proof. 1/1 configured OAuth/account targets have live probe or runtime evidence.");
    expect(container.textContent).toContain("Provider verification still blocks go-live.");
    expect(container.textContent).not.toContain("At least one provider route is verified for live runtime traffic.");
  });

  it("shows the admin runtime-access handoff for operator sessions", async () => {
    fetchAccountsMock.mockResolvedValueOnce({
      status: "ok",
      accounts: [],
    });
    fetchRuntimeKeysMock.mockResolvedValueOnce({
      status: "ok",
      keys: [],
    });

    await renderOnboardingPage(createSession({ role: "operator", username: "operator", display_name: "Operator" }));

    expect(container.textContent).toContain("Operator setup with admin handoff");
    expect(container.textContent).toContain("Runtime access still needs an admin handoff.");
    expect(container.textContent).toContain("Go-live needs an admin handoff before the first key can be issued.");
    expect(container.textContent).toContain("Issue a global key on API Keys, or create an account first only if the first key should be tied to a specific runtime identity.");
    expect(container.textContent).not.toContain("Create the first account before issuing a runtime key.");
  });

  it("keeps the checklist visible but permission-limited for viewers", async () => {
    fetchAccountsMock.mockResolvedValueOnce({
      status: "ok",
      accounts: [],
    });
    fetchRuntimeKeysMock.mockResolvedValueOnce({
      status: "ok",
      keys: [],
    });

    await renderOnboardingPage(createSession({ role: "viewer", username: "viewer", display_name: "Viewer" }));

    expect(container.textContent).toContain("Viewer access");
    expect(container.textContent).toContain("Viewer sessions can inspect the full checklist, but provider verification requires an operator or admin, and onboarding persistence plus runtime access issuance require an admin.");
    expect(container.textContent).toContain("Handoff required");
  });

  it("shows read-only setup visibility for restricted sessions", async () => {
    await renderOnboardingPage(createSession({
      role: "admin",
      username: "readonly-admin",
      display_name: "Read Only Admin",
      read_only: true,
      session_type: "impersonation",
    }));

    expect(container.textContent).toContain("Read only session");
    expect(container.textContent).toContain("Read-only sessions can inspect bootstrap, provider, runtime access, and onboarding posture, but they cannot persist changes or complete verification and issuance.");
  });

  it("does not treat the ForgeFrame baseline smoke path as live provider verification", async () => {
    fetchProviderControlPlaneMock.mockResolvedValueOnce({
      status: "ok",
      object: "provider_control_plane",
      providers: [
        createProvider({
          provider: "forgeframe_baseline",
          label: "ForgeFrame Baseline",
          integration_class: "internal",
          tool_calling_level: "none",
          compatibility_depth: "constrained",
          provider_axis: "openai_compatible_provider",
          auth_mechanism: "internal",
          oauth_required: false,
          oauth_mode: null,
          models: [
            {
              id: "forgeframe-baseline-chat-v1",
              source: "static",
              discovery_status: "listed",
              active: true,
              health_status: "healthy",
              last_seen_at: "2026-04-21T10:05:00Z",
              last_probe_at: "2026-04-21T10:05:00Z",
            },
          ],
        }),
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
    fetchOauthOnboardingMock.mockResolvedValueOnce({
      status: "ok",
      targets: [],
    });
    fetchAccountsMock.mockResolvedValueOnce({
      status: "ok",
      accounts: [],
    });
    fetchRuntimeKeysMock.mockResolvedValueOnce({
      status: "ok",
      keys: [createKey({ account_id: null, label: "Global runtime key" })],
    });

    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    expect(container.textContent).toContain("Only internal smoke routes are runtime-ready; a real provider still needs live verification.");
    expect(container.textContent).toContain("1 runtime-ready provider routes, 0 eligible for live go-live proof.");
    expect(container.textContent).toContain("ForgeFrame baseline is runtime-ready for internal smoke checks, but it does not count as verified live provider coverage for go-live.");
    expect(container.textContent).toContain("Provider verification still blocks go-live.");
    expect(container.textContent).not.toContain("ForgeFrame is ready for live traffic from the current control-plane view.");
  });

  it("counts bridge-only OAuth targets with probe evidence even when onboarding readiness stays partial", async () => {
    fetchOauthOnboardingMock.mockResolvedValueOnce({
      status: "ok",
      targets: [
        createOauthTarget({
          provider_key: "antigravity",
          readiness: "partial",
          operational_depth: "bridge_probe_evidenced",
          next_steps: [
            "Keep antigravity positioned as onboarding/bridge-only; probe success does not promote it to native runtime-ready truth.",
          ],
          evidence: {
            live_probe: {
              status: "observed",
              details: "Live probe evidence is recorded, but this target remains onboarding/bridge-only in the current release truth.",
            },
            runtime: { status: "missing" },
          },
        }),
      ],
    });

    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    expect(container.textContent).toContain("1/1 configured OAuth/account targets have live probe or runtime evidence.");
    expect(container.textContent).not.toContain("0/1 configured OAuth/account targets have live probe or runtime evidence.");
    expect(container.textContent).not.toContain("configured OAuth/account targets are ready.");
  });

  it("treats a global runtime key as a valid runtime access path", async () => {
    fetchAccountsMock.mockResolvedValueOnce({
      status: "ok",
      accounts: [],
    });
    fetchRuntimeKeysMock.mockResolvedValueOnce({
      status: "ok",
      keys: [createKey({ account_id: null, label: "Global runtime key" })],
    });

    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    expect(container.textContent).toContain("At least one runtime key covers the default runtime route scopes.");
    expect(container.textContent).toContain("0 active runtime accounts. 1 active runtime keys. 1 global key is not bound to an account. 1 key covers the default route set (models:read, chat:write, responses:write).");
    expect(container.textContent).not.toContain("Create the first account before issuing a runtime key.");
  });

  it("keeps restricted-scope active keys from satisfying runtime-access readiness or go-live", async () => {
    fetchAccountsMock.mockResolvedValueOnce({
      status: "ok",
      accounts: [],
    });
    fetchRuntimeKeysMock.mockResolvedValueOnce({
      status: "ok",
      keys: [createKey({ account_id: null, label: "Global runtime key", scopes: ["models:read"] })],
    });

    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    expect(container.textContent).toContain("Partial access");
    expect(container.textContent).toContain("Active runtime keys exist, but none can send live write traffic yet.");
    expect(container.textContent).toContain("Active runtime keys exist, but none currently permit live write traffic on `/v1/chat/completions` or `/v1/responses`.");
    expect(container.textContent).toContain("Global runtime key: missing chat:write, responses:write for the default go-live route set.");
    expect(container.textContent).toContain("Runtime key scope coverage still blocks go-live.");
    expect(container.textContent).not.toContain("ForgeFrame is ready for live traffic from the current control-plane view.");
  });

  it("blocks go-live when a full-scope account-bound key cannot reach the verified provider", async () => {
    fetchAccountsMock.mockResolvedValueOnce({
      status: "ok",
      accounts: [createAccount({ provider_bindings: ["openai_api"] })],
    });
    fetchRuntimeKeysMock.mockResolvedValueOnce({
      status: "ok",
      keys: [createKey({ account_id: "acct-1", label: "Bound full-scope key" })],
    });

    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    expect(container.textContent).toContain("At least one runtime key covers the default runtime route scopes.");
    expect(container.textContent).toContain("Current account provider bindings do not yet line up with the verified live provider set.");
    expect(container.textContent).toContain("Provider-binding reachability still blocks go-live.");
    expect(container.textContent).toContain("At least one full-scope runtime key must be able to reach a verified live provider through its current account bindings before go-live.");
    expect(container.textContent).toContain("Bound full-scope key: account bindings allow openai_api, while the verified live provider set is openai_codex.");
    expect(container.textContent).toContain("Open Accounts");
    expect(container.textContent).not.toContain("ForgeFrame is ready for live traffic from the current control-plane view.");
  });

  it("persists onboarding truth on an existing instance and clears typed blockers once normative data is saved", async () => {
    fetchInstancesMock
      .mockResolvedValueOnce({
        status: "ok",
        instances: [createInstanceRecord({ metadata: createLimitedOnboardingMetadata(), updated_at: "2026-04-21T09:50:00Z" })],
      })
      .mockResolvedValueOnce({
        status: "ok",
        instances: [createInstanceRecord({ metadata: createOnboardingMetadata({ fqdn: "customer.example.com" }), updated_at: "2026-04-21T11:15:00Z" })],
      });
    updateInstanceMock.mockResolvedValueOnce({
      status: "ok",
      instance: createInstanceRecord({ metadata: createOnboardingMetadata({ fqdn: "customer.example.com" }), updated_at: "2026-04-21T11:15:00Z" }),
    });

    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    expect(container.textContent).toContain("limited_mode_selected");

    await changeSelect("operatingMode", "normative_public_https");
    await changeTextControl("fqdn", "customer.example.com");
    await changeSelect("tlsMode", "lets_encrypt");
    await changeSelect("certificateStatus", "issued");
    await changeSelect("helperPort80Mode", "acme_redirect_only");
    await changeCheckbox("dnsReady", true);
    await changeCheckbox("port80Ready", true);
    await changeCheckbox("port443Ready", true);
    await changeCheckbox("certificateAutoRenew", true);
    await submitInterviewForm();

    expect(updateInstanceMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      display_name: "Alpha Instance",
      tenant_id: "tenant_alpha",
      company_id: "company_alpha",
      deployment_mode: "linux_host_native",
      exposure_mode: "same_origin",
      metadata: expect.objectContaining({
        onboarding_v4: expect.objectContaining({
          operating_mode: "normative_public_https",
          fqdn: "customer.example.com",
          dns_ready: true,
          port_80_ready: true,
          port_443_ready: true,
          tls_mode: "lets_encrypt",
          certificate_status: "issued",
          certificate_auto_renew: true,
        }),
      }),
    }));
    expect(container.textContent).toContain("Onboarding truth for Alpha Instance saved.");
    expect(container.textContent).toContain("Ready for live traffic");
    expect(container.textContent).not.toContain("limited_mode_selected");
  });

  it("creates the first instance from onboarding when the catalog is empty", async () => {
    fetchInstancesMock
      .mockResolvedValueOnce({
        status: "ok",
        instances: [],
      })
      .mockResolvedValueOnce({
        status: "ok",
        instances: [createInstanceRecord({
          instance_id: "customer-prod",
          slug: "customer-prod",
          display_name: "Customer Production",
          tenant_id: "customer-prod",
          company_id: "customer-prod",
          metadata: createOnboardingMetadata({ fqdn: "customer.example.com" }),
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
        metadata: createOnboardingMetadata({ fqdn: "customer.example.com" }),
      }),
    });

    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    await changeTextControl("instanceId", "customer-prod");
    await changeTextControl("displayName", "Customer Production");
    await changeTextControl("tenantId", "customer-prod");
    await changeTextControl("companyId", "customer-prod");
    await changeSelect("operatingMode", "normative_public_https");
    await changeTextControl("fqdn", "customer.example.com");
    await changeSelect("tlsMode", "lets_encrypt");
    await changeSelect("helperPort80Mode", "acme_redirect_only");
    await changeCheckbox("dnsReady", true);
    await changeCheckbox("port80Ready", true);
    await changeCheckbox("port443Ready", true);
    await changeSelect("certificateStatus", "issued");
    await changeCheckbox("certificateAutoRenew", true);
    await submitInterviewForm();

    expect(createInstanceMock).toHaveBeenCalledWith(expect.objectContaining({
      instance_id: "customer-prod",
      display_name: "Customer Production",
      tenant_id: "customer-prod",
      company_id: "customer-prod",
      deployment_mode: "linux_host_native",
      exposure_mode: "same_origin",
      metadata: expect.objectContaining({
        onboarding_v4: expect.objectContaining({
          fqdn: "customer.example.com",
          operating_mode: "normative_public_https",
        }),
      }),
    }));
    expect(container.textContent).toContain("First instance Customer Production created and onboarding truth saved.");
  });
});
