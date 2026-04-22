// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchAccountsMock,
  fetchBootstrapReadinessMock,
  fetchOauthOnboardingMock,
  fetchProviderControlPlaneMock,
  fetchRuntimeKeysMock,
} = vi.hoisted(() => ({
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

function createBootstrapReadiness(ready = true) {
  return {
    status: "ok",
    ready,
    checks: [
      { id: "compose_file", ok: true, details: "docker/docker-compose.yml" },
      { id: "env_compose", ok: true, details: ".env.compose" },
      { id: "postgres_url", ok: ready, details: "FORGEGATE_HARNESS_POSTGRES_URL" },
    ],
    next_steps: ["Run ./scripts/bootstrap-forgegate.sh."],
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
    capabilities: {},
    tool_calling_level: "full",
    compatibility_tier: "beta_plus",
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

beforeEach(() => {
  vi.resetAllMocks();

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
  it("shows the go-live success state for standard admin sessions", async () => {
    await renderOnboardingPage(createSession({ role: "admin", username: "admin", display_name: "Admin" }));

    expect(fetchBootstrapReadinessMock).toHaveBeenCalledTimes(1);
    expect(fetchProviderControlPlaneMock).toHaveBeenCalledTimes(1);
    expect(fetchOauthOnboardingMock).toHaveBeenCalledTimes(1);
    expect(fetchAccountsMock).toHaveBeenCalledTimes(1);
    expect(fetchRuntimeKeysMock).toHaveBeenCalledTimes(1);

    expect(container.textContent).toContain("Admin setup actions enabled");
    expect(container.textContent).toContain("Ready for live traffic");
    expect(container.textContent).toContain("ForgeGate is ready for live traffic from the current control-plane view.");
    expect(container.textContent).toContain("1/1 configured OAuth/account targets have live probe or runtime evidence.");
    expect(container.textContent).not.toContain("configured OAuth/account targets are ready.");
    expect(container.textContent).toContain("Open Dashboard");
  });

  it("threads tenant scope through onboarding fetches and checklist links", async () => {
    await renderOnboardingPage(
      createSession({ role: "admin", username: "admin", display_name: "Admin" }),
      "/onboarding?tenantId=tenant-acme",
    );

    expect(fetchProviderControlPlaneMock).toHaveBeenCalledWith("tenant-acme");
    expect(fetchOauthOnboardingMock).toHaveBeenCalledWith("tenant-acme");
    expect(fetchAccountsMock).toHaveBeenCalledWith("tenant-acme");
    expect(fetchRuntimeKeysMock).toHaveBeenCalledWith("tenant-acme");
    expect(container.textContent).toContain("Tenant scope: tenant-acme");

    const hrefs = collectLinkHrefs();
    expect(hrefs).toContain("/onboarding?tenantId=tenant-acme");
    expect(hrefs).toContain("/providers?tenantId=tenant-acme");
    expect(hrefs).toContain("/accounts?tenantId=tenant-acme");
    expect(hrefs).toContain("/api-keys?tenantId=tenant-acme");
    expect(hrefs).toContain("/dashboard?tenantId=tenant-acme");
    expect(hrefs).toContain("/providers?tenantId=tenant-acme#provider-health-runs");
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
          readiness_reason: "Live probe evidence is recorded, but this target remains onboarding/bridge-only in the current beta slice.",
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
    expect(container.textContent).toContain("Viewer sessions can inspect the full checklist, but provider verification requires an operator or admin, and runtime access issuance requires an admin.");
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
    expect(container.textContent).toContain("Read-only sessions can inspect bootstrap, provider, and runtime access posture, but provider verification and runtime access issuance still require a standard operator or admin session.");
  });

  it("does not treat the ForgeGate baseline smoke path as live provider verification", async () => {
    fetchProviderControlPlaneMock.mockResolvedValueOnce({
      status: "ok",
      object: "provider_control_plane",
      providers: [
        createProvider({
          provider: "forgegate_baseline",
          label: "ForgeGate Baseline",
          integration_class: "internal",
          tool_calling_level: "none",
          compatibility_tier: "beta",
          provider_axis: "openai_compatible_provider",
          auth_mechanism: "internal",
          oauth_required: false,
          oauth_mode: null,
          models: [
            {
              id: "forgegate-baseline-chat-v1",
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
    expect(container.textContent).toContain("ForgeGate baseline is runtime-ready for internal smoke checks, but it does not count as verified live provider coverage for go-live.");
    expect(container.textContent).toContain("Provider verification still blocks go-live.");
    expect(container.textContent).not.toContain("ForgeGate is ready for live traffic from the current control-plane view.");
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
              details: "Live probe evidence is recorded, but this target remains onboarding/bridge-only in the current beta slice.",
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
    expect(container.textContent).not.toContain("ForgeGate is ready for live traffic from the current control-plane view.");
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
    expect(container.textContent).not.toContain("ForgeGate is ready for live traffic from the current control-plane view.");
  });
});
