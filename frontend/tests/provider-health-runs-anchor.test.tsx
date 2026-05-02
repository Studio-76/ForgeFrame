// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseProvidersControlPlane = vi.fn();
const mockedUseInstanceCatalog = vi.fn();

vi.mock("../src/features/providers/useProvidersControlPlane", () => ({
  useProvidersControlPlane: (access: unknown, instanceId?: string | null, options?: Record<string, unknown>) =>
    mockedUseProvidersControlPlane(access, instanceId, options),
}));

vi.mock("../src/app/useInstanceCatalog", () => ({
  useInstanceCatalog: (instanceId: string | null) => mockedUseInstanceCatalog(instanceId),
}));

import type { AdminSessionUser } from "../src/api/admin";
import { ProvidersPage } from "../src/pages/ProvidersPage";
import type { ProvidersAccessState, ProvidersPageActions, ProvidersPageData } from "../src/features/providers/providersShared";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const scrollIntoViewMock = vi.fn();

const session: AdminSessionUser = {
  session_id: "session-provider-health",
  user_id: "user-provider-health",
  username: "operator",
  display_name: "Operator",
  role: "admin",
  read_only: false,
};

let container: HTMLDivElement;
let root: Root | null = null;

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

function createAccess(): ProvidersAccessState {
  return {
    canRead: true,
    canOperate: true,
    canExportRedacted: true,
    canExportFull: true,
    canMutate: true,
    isBlocked: false,
    isReadOnly: false,
    isCheckingAccess: false,
    badgeLabel: "Admin mutations enabled",
    badgeTone: "success",
    summaryTitle: "Provider mutations enabled",
    summaryDetail: "Provider mutations are enabled.",
    operateBlockedMessage: "",
    exportBlockedMessage: "",
    fullExportBlockedMessage: "",
    mutationBlockedMessage: "",
  };
}

function createData(): ProvidersPageData {
  return {
    state: "success",
    error: null,
    access: createAccess(),
    providers: [
      {
        provider: "local_runtime",
        label: "Local Runtime",
        enabled: true,
        provider_class: "local_ollama",
        integration_class: "local_ollama",
        template_id: "ollama",
        config: { provider_class: "local_ollama", endpoint_base_url: "http://localhost:11434/v1", auth_scheme: "none" },
        ready: false,
        readiness_reason: "probe failed",
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
            status_reason: "probe timeout",
            last_probe_at: "2026-04-23T09:00:00Z",
          },
        ],
        last_sync_at: "2026-04-23T09:00:00Z",
        last_sync_status: "warning",
        last_sync_error: "model sync stalled",
        harness_profile_count: 1,
        harness_run_count: 1,
        harness_needs_attention_count: 1,
        harness_proof_status: "partial",
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
        next_action: "Run health now",
        next_action_kind: "run_health",
      },
    ],
    supportedProviderClasses: [],
    templates: [],
    profiles: [],
    runs: [
      {
        run_id: "run_probe_alpha",
        provider_key: "local_runtime",
        instance_id: "instance_alpha",
        integration_class: "local_ollama",
        model: "llama3.1",
        mode: "probe",
        status: "failed",
        success: false,
        steps: [],
        error: "provider probe timed out",
        executed_at: "2026-04-23T09:00:00Z",
        duration_ms: 4200,
        client_id: "control_plane",
        consumer: "provider_health",
        integration: "local_ollama",
      },
    ],
    runSummary: { total: 1, failed: 1, probe: 1 },
    runOps: {
      last_failed_run: {
        provider_key: "local_runtime",
        status: "failed",
        executed_at: "2026-04-23T09:00:00Z",
      },
      last_runs_by_provider: {
        local_runtime: {
          provider_key: "local_runtime",
          model: "llama3.1",
          mode: "probe",
          status: "failed",
          error: "provider probe timed out",
          executed_at: "2026-04-23T09:00:00Z",
        },
      },
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
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  });
  mockedUseProvidersControlPlane.mockImplementation(() => ({
    data: createData(),
    actions: createActions(),
  }));
  mockedUseInstanceCatalog.mockReturnValue({
    instances: [
      {
        instance_id: "instance_alpha",
        slug: "instance-alpha",
        display_name: "Alpha Instance",
        description: "Alpha provider scope",
        status: "active",
        tenant_id: "tenant_alpha",
        company_id: "company_alpha",
        deployment_mode: "restricted_eval",
        exposure_mode: "local_only",
        is_default: true,
        metadata: {},
        created_at: "2026-04-22T08:00:00Z",
        updated_at: "2026-04-22T08:00:00Z",
      },
    ],
    loadState: "success",
    error: "",
    selectedInstance: {
      instance_id: "instance_alpha",
      slug: "instance-alpha",
      display_name: "Alpha Instance",
      description: "Alpha provider scope",
      status: "active",
      tenant_id: "tenant_alpha",
      company_id: "company_alpha",
      deployment_mode: "restricted_eval",
      exposure_mode: "local_only",
      is_default: true,
      metadata: {},
      created_at: "2026-04-22T08:00:00Z",
      updated_at: "2026-04-22T08:00:00Z",
    },
    refresh: async () => [],
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

describe("Provider health runs anchor", () => {
  it("focuses and highlights the provider health runs section when opened by hash", async () => {
    await renderIntoDom(withAppContext({
      path: "/providers?instanceId=instance_alpha#provider-health-runs",
      element: <ProvidersPage />,
      session,
    }));
    await flushEffects();

    const anchor = container.querySelector<HTMLElement>("#provider-health-runs");
    expect(anchor).not.toBeNull();
    expect(anchor?.className).toContain("is-anchor-target");
    expect(document.activeElement).toBe(anchor);
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(container.textContent).toContain("Provider Readiness");
  });
});
