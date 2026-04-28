import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
import { ProvidersPage } from "../src/pages/ProvidersPage";
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

function createData(access: ProvidersAccessState): ProvidersPageData {
  return {
    state: "success",
    error: null,
    access,
    providers: [
      {
        provider: "local_runtime",
        label: "Local Runtime",
        enabled: false,
        provider_class: "local_ollama",
        integration_class: "local_ollama",
        template_id: "ollama",
        config: {
          provider_class: "local_ollama",
          endpoint_base_url: "http://localhost:11434/v1",
          auth_scheme: "none",
        },
        ready: false,
        readiness_reason: "runtime disabled",
        contract_classification: "partial-runtime",
        capabilities: {},
        tool_calling_level: "partial",
        compatibility_depth: "limited",
        runtime_readiness: "partial",
        streaming_readiness: "partial",
        provider_axis: "local_providers",
        auth_mechanism: "none",
        oauth_required: false,
        discovery_supported: true,
        model_count: 1,
        models: [
          {
            id: "llama3.1",
            source: "manual",
            discovery_status: "configured",
            active: true,
            health_status: "attention",
          },
        ],
        last_sync_at: "2026-04-23T09:00:00Z",
        last_sync_status: "warning",
        harness_profile_count: 0,
        harness_run_count: 0,
        harness_needs_attention_count: 0,
        harness_proof_status: "none",
        harness_proven_profile_keys: [],
        oauth_connect_required: false,
        target_count: 0,
        enabled_target_count: 0,
        ready_target_count: 0,
        health_status: "attention",
        healthy_model_count: 0,
        attention_model_count: 1,
        last_health_check_at: "2026-04-23T09:00:00Z",
        last_probe_at: "2026-04-23T09:00:00Z",
        next_action: "Enable provider in this instance",
        next_action_kind: "activate_provider",
      },
    ],
    supportedProviderClasses: [
      {
        key: "openai_compatible",
        label: "OpenAI-compatible",
        description: "",
        integration_class: "openai_compatible",
        template_id: "openai_compatible",
        default_config: {
          provider_class: "openai_compatible",
          endpoint_base_url: "https://example.invalid/v1",
          auth_scheme: "bearer",
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
    healthConfig: {
      provider_health_enabled: true,
      model_health_enabled: true,
      interval_seconds: 300,
      probe_mode: "provider",
      selected_models: [],
    },
    newProvider: {
      provider: "",
      label: "",
      providerClass: "openai_compatible",
      integrationClass: "openai_compatible",
      templateId: "openai_compatible",
      endpointBaseUrl: "https://example.invalid/v1",
      authScheme: "bearer",
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
  };
}

function createSession(overrides: Partial<AdminSessionUser> = {}): AdminSessionUser {
  return {
    session_id: "sess_test",
    user_id: "user_test",
    username: "ops-user",
    display_name: "Ops User",
    role: "admin",
    session_type: "standard",
    read_only: false,
    must_rotate_password: false,
    ...overrides,
  };
}

function createScopedOperatorSession(): AdminSessionUser {
  return createSession({
    role: "operator",
    active_instance_id: "instance_alpha",
    instance_permissions: {
      instance_alpha: ["providers.read", "providers.write"],
      instance_beta: ["providers.read"],
    },
  });
}

function createScopedNoReadSession(): AdminSessionUser {
  return createSession({
    role: "operator",
    active_instance_id: "instance_alpha",
    instance_permissions: {
      instance_alpha: ["providers.read", "providers.write"],
    },
  });
}

vi.mock("../src/features/providers/useProvidersControlPlane", () => ({
  useProvidersControlPlane: (access: ProvidersAccessState, instanceId?: string | null, options?: Record<string, unknown>) =>
    mockedUseProvidersControlPlane(access, instanceId, options),
}));

describe("Providers page hierarchy", () => {
  beforeEach(() => {
    mockedUseProvidersControlPlane.mockImplementation((access: ProvidersAccessState) => ({
      data: createData(access),
      actions: createActions(),
    }));
  });

  it("renders the route-level page header before the first summary card", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/providers",
        element: <ProvidersPage />,
        session: createSession(),
      }),
    );

    expect(markup).toContain("<section class=\"fg-page\">");
    expect(markup).toContain("Which provider are you configuring, syncing, validating, or recovering right now?");
    expect(markup).toContain(">Harness<");
    expect(markup).toContain("href=\"/harness\"");
    expect(markup).toContain(">Provider Targets<");
    expect(markup).toContain(">Provider Runtime Inventory</h3>");
    expect(markup).toContain(">Provider Health</h3>");
    expect(markup).toContain(">Provider Inventory</h3>");
    expect(markup).toContain(">Provider hinzufügen</h3>");
    expect(markup).toContain(">Advanced Diagnostics</strong>");
    expect(markup).toContain("Admin mutations enabled");
    expect(markup).toContain("Sync all providers");
    expect(markup).toContain("Providers");
    expect(markup).not.toContain("Save profile");
    expect(markup).not.toContain("Preview + Verify");
    expect(markup.indexOf("Providers")).toBeLessThan(markup.indexOf(">Provider Runtime Inventory</h3>"));
  });

  it("shows an honest blocked state when the session lacks scoped providers.read", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/providers?instanceId=instance_beta",
        element: <ProvidersPage />,
        session: createScopedNoReadSession(),
      }),
    );

    expect(markup).toContain("Read access required");
    expect(markup).toContain("the backend will return 403 until providers.read is granted here");
    expect(markup).not.toContain(">Provider Runtime Inventory</h3>");
    expect(markup).not.toContain("Sync all providers");
    expect(markup).not.toContain(">Activate<");
  });

  it("forwards instance scope from the route into the providers hook", () => {
    renderToStaticMarkup(
      withAppContext({
        path: "/providers?instanceId=instance_alpha",
        element: <ProvidersPage />,
        session: createSession(),
      }),
    );

    expect(mockedUseProvidersControlPlane).toHaveBeenCalledWith(
      expect.any(Object),
      "instance_alpha",
      expect.objectContaining({
        includeUsageSummary: false,
        includeHarness: false,
        includeOauthTargets: false,
        includeCompatibilityMatrix: false,
        includeBootstrapReadiness: false,
        includeClientView: false,
      }),
    );
  });

  it("only shows mutating provider controls on the instance that grants write access", () => {
    const alphaMarkup = renderToStaticMarkup(
      withAppContext({
        path: "/providers?instanceId=instance_alpha",
        element: <ProvidersPage />,
        session: createScopedOperatorSession(),
      }),
    );
    const betaMarkup = renderToStaticMarkup(
      withAppContext({
        path: "/providers?instanceId=instance_beta",
        element: <ProvidersPage />,
        session: createScopedOperatorSession(),
      }),
    );

    expect(alphaMarkup).toContain("Operator mutations enabled");
    expect(alphaMarkup).toContain("Sync all providers");
    expect(betaMarkup).not.toContain("Operator mutations enabled");
    expect(betaMarkup).not.toContain("Sync all providers");
    expect(betaMarkup).toContain("Operate only");
  });

  it("shows read-only copy for impersonated sessions before the page surfaces actions", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/providers",
        element: <ProvidersPage />,
        session: createSession({ read_only: true, session_type: "impersonation" }),
      }),
    );

    expect(markup).toContain("Read only session");
    expect(markup).toContain("provider inventory and health here");
    expect(markup).toContain("OAuth/account targets live on the dedicated OAuth Targets route");
    expect(markup).toContain("dedicated harness state, runs, plus redacted harness exports stay on the Harness route");
    expect(markup).toContain("Provider truth and health stay visible here without surfacing mutations that the backend will block.");
    expect(markup).not.toContain("Sync all providers");
    expect(markup).not.toContain(">Activate<");
    expect(markup).not.toContain(">Sync models<");
    expect(markup).not.toContain(">Run health now<");
    expect(markup).toContain("Enable provider in this instance");
  });
});
