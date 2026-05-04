import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSessionUser } from "../src/api/domain";
import { HarnessPage } from "../src/pages/HarnessPage";
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
        provider: "openai_api",
        label: "OpenAI",
        provider_class: "openai_compatible",
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
        oauth_required: false,
        discovery_supported: true,
        model_count: 1,
        models: [],
        last_sync_at: "2026-04-23T09:00:00Z",
        last_sync_status: "ok",
        harness_profile_count: 1,
        harness_run_count: 2,
        harness_needs_attention_count: 0,
        harness_proof_status: "proven",
        harness_proven_profile_keys: ["openai-primary"],
        auth_type: "api_key",
        target_count: 0,
        enabled_target_count: 0,
        ready_target_count: 0,
        oauth_connect_required: false,
        health_status: "healthy",
        healthy_model_count: 1,
        attention_model_count: 0,
        last_health_check_at: "2026-04-23T09:00:00Z",
        last_probe_at: "2026-04-23T09:00:00Z",
        next_action: "None",
        next_action_kind: "none",
      },
    ],
    supportedProviderClasses: [
      {
        key: "openai_compatible",
        label: "OpenAI-compatible",
        description: "OpenAI compatible profile",
        integration_class: "openai_compatible",
        template_id: "openai_compatible",
        default_config: {
          provider_class: "openai_compatible",
          endpoint_base_url: "https://api.openai.com/v1",
          auth_scheme: "bearer",
        },
      },
    ],
    templates: [
      {
        id: "openai_compatible",
        label: "OpenAI Compatible",
        integration_class: "openai_compatible",
        description: "OpenAI compatible profile",
      },
    ],
    profiles: [
      {
        provider_key: "openai-primary",
        label: "OpenAI Primary",
        integration_class: "openai_compatible",
        endpoint_base_url: "https://api.openai.com/v1",
        auth_scheme: "bearer",
        auth_value: "",
        auth_header: "Authorization",
        template_id: "openai_compatible",
        enabled: true,
        models: ["gpt-4.1-mini"],
        discovery_enabled: true,
        lifecycle_status: "ready",
        last_verified_at: "2026-04-23T09:00:00Z",
        last_verify_status: "ok",
        last_probe_at: "2026-04-23T09:00:00Z",
        last_probe_status: "ok",
        last_sync_at: "2026-04-23T09:00:00Z",
        last_sync_status: "ok",
        last_error: null,
        needs_attention: false,
      },
    ],
    runs: [
      {
        run_id: "run-harness-1",
        provider_key: "openai-primary",
        mode: "verify",
        status: "ok",
        success: true,
        steps: [],
        executed_at: "2026-04-23T09:00:00Z",
      },
    ],
    runSummary: { total: 1, failed: 0, preview: 1, dry_run: 0, verify: 1, probe: 0, runtime_non_stream: 0, runtime_stream: 0 },
    runOps: {
      last_runs_by_provider: {
        "openai-primary": {
          run_id: "run-harness-1",
          provider_key: "openai-primary",
          mode: "verify",
          status: "ok",
          success: true,
          steps: [],
          executed_at: "2026-04-23T09:00:00Z",
        },
      },
    },
    runFilters: {
      mode: "all",
      status: "all",
      provider: "all",
      client: "all",
    },
    operationResult: "{\"status\":\"ok\"}",
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
      provider_key: "openai-primary",
      label: "OpenAI Primary",
      template_id: "openai_compatible",
      integration_class: "openai_compatible",
      endpoint_base_url: "https://api.openai.com/v1",
      auth_scheme: "bearer",
      auth_value: "",
      auth_header: "Authorization",
      models: "gpt-4.1-mini",
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
  useProvidersControlPlane: (access: ProvidersAccessState, instanceId?: string | null) => mockedUseProvidersControlPlane(access, instanceId),
}));

describe("Harness page separation", () => {
  beforeEach(() => {
    mockedUseProvidersControlPlane.mockImplementation((access: ProvidersAccessState) => ({
      data: createData(access),
      actions: createActions(),
    }));
  });

  it("renders harness as its own primary control-plane surface", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/harness?instanceId=instance_alpha",
        element: <HarnessPage />,
        session: createSession(),
      }),
    );

    expect(markup).toContain(">Harness<");
    expect(markup).toContain("Profiles");
    expect(markup).toContain("OpenAI Primary");
    expect(markup).toContain("Run History");
    expect(markup).toContain("Advanced Diagnostics");
    expect(markup).toContain("Verify profile");
    expect(markup).toContain("Preview request");
    expect(markup).toContain("Run dry-run request");
    expect(markup).not.toContain("Control-Plane Summary");
  });

  it("shows an honest blocked state when the session lacks scoped providers.read", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/harness?instanceId=instance_beta",
        element: <HarnessPage />,
        session: createScopedNoReadSession(),
      }),
    );

    expect(markup).toContain("Read access required");
    expect(markup).toContain("the backend will return 403 until providers.read is granted here");
    expect(markup).not.toContain("Profiles");
    expect(markup).not.toContain("OpenAI Primary");
    expect(markup).not.toContain("Verify profile");
    expect(markup).not.toContain("Export redacted");
  });

  it("forwards instance scope from the route into the harness hook", () => {
    renderToStaticMarkup(
      withAppContext({
        path: "/harness?instanceId=instance_alpha",
        element: <HarnessPage />,
        session: createSession(),
      }),
    );

    expect(mockedUseProvidersControlPlane).toHaveBeenCalledWith(expect.any(Object), "instance_alpha");
  });

  it("preserves instance scope in the dedicated harness route links", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/harness?instanceId=instance_alpha",
        element: <HarnessPage />,
        session: createSession(),
      }),
    );

    // Navigation links are now <Button variant="navigation"> (no href).
    // Verify that scoped nav labels render in the markup.
    expect(markup).toContain("Harness");
    expect(markup).toContain("Setup progress");
    expect(markup).toContain("Providers");
    expect(markup).toContain("Logs");
  });

  it("only shows mutating harness controls on the instance that grants write access", () => {
    const alphaMarkup = renderToStaticMarkup(
      withAppContext({
        path: "/harness?instanceId=instance_alpha",
        element: <HarnessPage />,
        session: createScopedOperatorSession(),
      }),
    );
    const betaMarkup = renderToStaticMarkup(
      withAppContext({
        path: "/harness?instanceId=instance_beta",
        element: <HarnessPage />,
        session: createScopedOperatorSession(),
      }),
    );

    // "Edit profile" and "Create draft from preset" are only rendered
    // when canMutate is true (alpha has providers.write on this instance).
    expect(alphaMarkup).toContain("Edit profile");
    expect(alphaMarkup).toContain("Create draft from preset");
    expect(betaMarkup).not.toContain("Edit profile");
    expect(betaMarkup).not.toContain("Create draft from preset");
    // Both render harness status — only alpha shows mutation controls.
    expect(alphaMarkup).toContain("OpenAI Primary");
    expect(betaMarkup).toContain("OpenAI Primary");
  });
});
