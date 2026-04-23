import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
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
    setNewHarness: (() => undefined) as ProvidersPageActions["setNewHarness"],
    setProviderLabelDraft: () => undefined,
    runHarnessAction: noopAsync,
    probeHarnessProfile: noopAsync,
    toggleHarnessProfile: noopAsync,
    deleteHarnessProfile: noopAsync,
    rollbackHarnessProfile: noopAsync,
    createProvider: noopAsync,
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
        lifecycle_status: "ok",
        last_verified_at: "2026-04-23T09:00:00Z",
        last_verify_status: "ok",
        last_probe_at: "2026-04-23T09:00:00Z",
        last_probe_status: "ok",
        last_sync_at: "2026-04-23T09:00:00Z",
        last_sync_status: "ok",
        needs_attention: false,
      },
    ],
    runs: [
      {
        run_id: "run-harness-1",
        provider_key: "openai-primary",
        mode: "verify",
        status: "success",
      },
    ],
    runSummary: { success: 1 },
    runOps: {},
    runFilters: {
      mode: "all",
      status: "all",
      provider: "all",
      client: "all",
    },
    operationResult: "{\"status\":\"ok\"}",
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
    },
    providerLabelDrafts: {},
    providerErrors: {},
    modelErrors: {},
    integrationErrors: {},
    profileErrors: {},
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

    expect(markup).toContain("Harness Control Plane");
    expect(markup).toContain("Harness Onboarding");
    expect(markup).toContain("Saved Harness Profiles");
    expect(markup).toContain("Last Control-Plane Action");
    expect(markup).toContain("Save profile");
    expect(markup).toContain("Preview + Verify");
    expect(markup).not.toContain("Control-Plane Summary");
  });

  it("hides harness mutations for viewer sessions while keeping proof visible", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/harness",
        element: <HarnessPage />,
        session: createSession({ role: "viewer", username: "viewer" }),
      }),
    );

    expect(markup).toContain("Viewer access");
    expect(markup).toContain("Harness proof posture");
    expect(markup).toContain("Saved Harness Profiles");
    expect(markup).not.toContain("Save profile");
    expect(markup).not.toContain("Preview + Verify");
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
});
