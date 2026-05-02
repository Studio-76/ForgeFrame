import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSessionUser } from "../src/api/domain";
import { OAuthTargetsPage } from "../src/pages/OAuthTargetsPage";
import type { ProvidersAccessState, ProvidersPageActions, ProvidersPageData } from "../src/features/providers/providersShared";
import { withAppContext } from "./testContext";

const mockedUseProvidersControlPlane = vi.fn();

function createActions(): ProvidersPageActions {
  const noopAsync = async () => undefined;

  return {
    load: noopAsync,
    setRunFilter: () => undefined,
    setOperationResult: () => undefined,
    setImportPayload: () => undefined,
    setNewProvider: (() => undefined) as ProvidersPageActions["setNewProvider"],
    setProviderDraftField: () => undefined,
    setNewHarness: (() => undefined) as ProvidersPageActions["setNewHarness"],
    setProviderLabelDraft: () => undefined,
    runHarnessAction: noopAsync,
    previewHarnessProfile: noopAsync,
    verifyHarnessProfile: noopAsync,
    dryRunHarnessProfile: noopAsync,
    probeHarnessProfile: noopAsync,
    toggleHarnessProfile: noopAsync,
    deleteHarnessProfile: noopAsync,
    rollbackHarnessProfile: noopAsync,
    createProvider: noopAsync,
    saveProvider: noopAsync,
    toggleProvider: noopAsync,
    syncProviderModels: noopAsync,
    saveProviderLabel: noopAsync,
    syncAllProviders: noopAsync,
    upsertHarness: noopAsync,
    updateHealth: noopAsync,
    runHealthChecks: noopAsync,
    exportHarness: noopAsync,
    importHarness: noopAsync,
    syncOauthBridgeProfiles: noopAsync,
    probeAllOauthTargets: noopAsync,
    probeOauthTarget: noopAsync,
  };
}

function createSession(overrides: Partial<AdminSessionUser> = {}): AdminSessionUser {
  return {
    session_id: "sess_test",
    user_id: "user_test",
    username: "ops-user",
    display_name: "Ops User",
    role: "operator",
    session_type: "standard",
    read_only: false,
    must_rotate_password: false,
    ...overrides,
  };
}

function createScopedOperatorSession(): AdminSessionUser {
  return createSession({
    active_instance_id: "instance_alpha",
    instance_permissions: {
      instance_alpha: ["providers.read", "providers.write"],
      instance_beta: ["providers.read"],
    },
  });
}

function createScopedNoReadSession(): AdminSessionUser {
  return createSession({
    active_instance_id: "instance_alpha",
    instance_permissions: {
      instance_alpha: ["providers.read", "providers.write"],
    },
  });
}

function createOauthTarget(overrides: Partial<ProvidersPageData["oauthTargets"][number]> = {}): ProvidersPageData["oauthTargets"][number] {
  return {
    provider_key: "openai_codex",
    provider_label: "OpenAI Codex",
    configured: true,
    runtime_bridge_enabled: false,
    probe_enabled: false,
    harness_profile_enabled: false,
    contract_classification: "onboarding-only",
    queue_lane: "not_applicable",
    parallelism_mode: "not_applicable",
    parallelism_limit: null,
    session_reuse_strategy: "No managed refresh.",
    escalation_support: "not_modeled_in_oauth_axis",
    cost_posture: "avoided-cost",
    operator_surface: "/oauth-targets",
    operator_truth: "ForgeFrame consumes a pre-issued access token for Codex OAuth mode.",
    readiness: "partial",
    readiness_reason: "Codex OAuth mode is configured, but the native runtime bridge is still disabled.",
    auth_kind: "oauth_account",
    oauth_mode: "manual_redirect_completion",
    oauth_flow_support: "external_token_only",
    connection_status: "token present",
    connection_status_reason: "Token is present, but runtime proof is still missing.",
    connection_method: "Codex OAuth via manual redirect completion with an externally supplied access token.",
    setup: {
      summary: "Setup is external-only.",
      required_env_vars: ["FORGEFRAME_OPENAI_CODEX_OAUTH_ACCESS_TOKEN", "FORGEFRAME_OPENAI_CODEX_AUTH_MODE"],
      optional_env_vars: ["FORGEFRAME_OPENAI_CODEX_BRIDGE_ENABLED"],
      missing_env_vars: ["FORGEFRAME_OPENAI_CODEX_BRIDGE_ENABLED"],
      steps: ["Set the required env vars outside ForgeFrame and reload the runtime."],
    },
    actions: [
      {
        action_key: "manual_token",
        label: "Add token manually",
        mode: "manual",
        supported: true,
        detail: "Use an externally supplied token.",
      },
      {
        action_key: "connect",
        label: "Connect",
        mode: "unsupported",
        supported: false,
        detail: "ForgeFrame does not ship an in-product Codex OAuth connect flow.",
      },
      {
        action_key: "probe",
        label: "Test connection",
        mode: "api",
        supported: true,
        detail: "Runs the real probe path.",
      },
      {
        action_key: "disconnect",
        label: "Disconnect",
        mode: "manual",
        supported: true,
        detail: "Remove the token outside ForgeFrame.",
      },
    ],
    last_probe: null,
    last_bridge_sync: null,
    last_failed_operation: null,
    next_step: "Enable native runtime bridge for openai_codex.",
    evidence: {
      runtime: { status: "missing", source: "none", recorded_at: null, details: "No runtime evidence." },
      streaming: { status: "missing", source: "none", recorded_at: null, details: "No streaming evidence." },
      tool_calling: { status: "missing", source: "none", recorded_at: null, details: "No tool evidence." },
      live_probe: { status: "missing", source: "none", recorded_at: null, details: "No probe evidence." },
    },
    ...overrides,
  };
}

function createData(access: ProvidersAccessState, overrides: Partial<ProvidersPageData> = {}): ProvidersPageData {
  return {
    state: "success",
    error: null,
    access,
    providers: [],
    supportedProviderClasses: [
      {
        key: "oauth_account",
        label: "OAuth / Account-backed",
        description: "",
        integration_class: "oauth_account",
        template_id: null,
        default_config: {
          provider_class: "oauth_account",
          auth_scheme: "oauth_account",
          oauth_mode: "account_portal",
        },
      },
    ],
    templates: [],
    profiles: [],
    runs: [],
    runSummary: {},
    runOps: {},
    runFilters: {
      mode: "all",
      status: "all",
      provider: "all",
      client: "all",
    },
    operationResult: "",
    lastHarnessAction: null,
    syncNote: "",
    healthConfig: null,
    newProvider: {
      provider: "",
      label: "",
      providerClass: "oauth_account",
      integrationClass: "oauth_account",
      templateId: "",
      endpointBaseUrl: "",
      authScheme: "oauth_account",
      oauthMode: "account_portal",
    },
    providerDrafts: {},
    providerLabelDrafts: {},
    providerErrors: {},
    modelErrors: {},
    integrationErrors: {},
    profileErrors: {},
    providerCatalog: [],
    providerCatalogSummary: null,
    openaiCompatibilitySignoff: null,
    clients: [],
    productAxisTargets: [],
    oauthTargets: [],
    oauthOperations: [],
    oauthRecentOps: [],
    oauthTotalOps: 0,
    oauthOnboarding: [],
    compatibilityMatrix: [],
    bootstrapReadiness: null,
    importPayload: "",
    newHarness: {
      provider_key: "",
      label: "",
      template_id: "",
      integration_class: "openai_compatible",
      endpoint_base_url: "",
      auth_scheme: "none",
      auth_value: "",
      auth_header: "",
      models: "",
      stream_enabled: false,
    },
    ...overrides,
  };
}

vi.mock("../src/features/providers/useProvidersControlPlane", () => ({
  useProvidersControlPlane: (access: ProvidersAccessState, instanceId?: string | null) => mockedUseProvidersControlPlane(access, instanceId),
}));

describe("OAuth targets page", () => {
  beforeEach(() => {
    mockedUseProvidersControlPlane.mockImplementation((access: ProvidersAccessState) => ({
      data: createData(access),
      actions: createActions(),
    }));
  });

  it("renders the dedicated OAuth operator surface", () => {
    mockedUseProvidersControlPlane.mockImplementation((access: ProvidersAccessState) => ({
      data: createData(access, {
        oauthTargets: [createOauthTarget()],
      }),
      actions: createActions(),
    }));

    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets",
        element: <OAuthTargetsPage />,
        session: createSession(),
      }),
    );

    expect(markup).toContain("OAuth Targets");
    expect(markup).toContain("Which OAuth target needs credential setup, probing, or review?");
    expect(markup).toContain(">OAuth Provider Targets</h3>");
    expect(markup).toContain("OpenAI Codex");
    expect(markup).toContain("Test");
    expect(markup).toContain("Route Diagnostics");
  });

  it("forwards instance scope from the route into the shared providers hook", () => {
    renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_alpha",
        element: <OAuthTargetsPage />,
        session: createSession(),
      }),
    );

    expect(mockedUseProvidersControlPlane).toHaveBeenCalledWith(expect.any(Object), "instance_alpha");
  });

  it("preserves instance scope in the adjacent route links", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_alpha",
        element: <OAuthTargetsPage />,
        session: createSession(),
      }),
    );

    expect(markup).toContain('href="/providers?instanceId=instance_alpha"');
    expect(markup).toContain('href="/harness?instanceId=instance_alpha"');
    expect(markup).toContain('href="/dashboard?instanceId=instance_alpha"');
    expect(markup).toContain('href="/usage?instanceId=instance_alpha"');
  });

  it("keeps probe controls for operate-only access but reserves bridge sync for write-capable sessions", () => {
    const alphaMarkup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_alpha",
        element: <OAuthTargetsPage />,
        session: createScopedOperatorSession(),
      }),
    );
    const betaMarkup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_beta",
        element: <OAuthTargetsPage />,
        session: createScopedOperatorSession(),
      }),
    );

    expect(alphaMarkup).toContain("Operator mutations enabled");
    expect(alphaMarkup).toContain("Probe all targets");
    expect(alphaMarkup).toContain("Sync bridge profiles");
    expect(betaMarkup).not.toContain("Operator mutations enabled");
    expect(betaMarkup).toContain("Probe all targets");
    expect(betaMarkup).not.toContain("Sync bridge profiles");
    expect(betaMarkup).toContain("Operate only");
  });

  it("shows an honest blocked state when the session lacks scoped providers.read", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_beta",
        element: <OAuthTargetsPage />,
        session: createScopedNoReadSession(),
      }),
    );

    expect(markup).toContain("Read access required");
    expect(markup).toContain("the backend will return 403 until providers.read is granted here");
    expect(markup).not.toContain(">OAuth Provider Targets</h3>");
    expect(markup).not.toContain("Probe all targets");
  });
});
