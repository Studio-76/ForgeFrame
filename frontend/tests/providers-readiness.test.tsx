import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
import {
  ExpansionTargetsSection,
  HarnessControlSection,
  ProviderInventorySection,
  ProvidersOverviewSection,
} from "../src/features/providers/ProvidersSections";
import { getProvidersAccess, type ProvidersPageActions, type ProvidersPageData } from "../src/features/providers/providersShared";

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

function createEvidence(
  overrides: Partial<{
    runtime: Partial<{ status: "missing" | "observed" | "failed"; source: string; recorded_at: string | null; details: string }>;
    streaming: Partial<{ status: "missing" | "observed" | "failed"; source: string; recorded_at: string | null; details: string }>;
    tool_calling: Partial<{ status: "missing" | "observed" | "failed"; source: string; recorded_at: string | null; details: string }>;
    live_probe: Partial<{ status: "missing" | "observed" | "failed"; source: string; recorded_at: string | null; details: string }>;
  }> = {},
) {
  return {
    runtime: {
      status: "observed" as const,
      source: "runtime_non_stream" as const,
      recorded_at: "2026-04-21T20:00:00Z",
      details: "Runtime request proof recorded.",
      ...overrides.runtime,
    },
    streaming: {
      status: "missing" as const,
      source: "none" as const,
      recorded_at: null,
      details: "No streaming proof recorded yet.",
      ...overrides.streaming,
    },
    tool_calling: {
      status: "observed" as const,
      source: "runtime_tool_call" as const,
      recorded_at: "2026-04-21T20:05:00Z",
      details: "Tool-calling proof recorded.",
      ...overrides.tool_calling,
    },
    live_probe: {
      status: "observed" as const,
      source: "oauth_probe" as const,
      recorded_at: "2026-04-21T20:10:00Z",
      details: "Probe evidence recorded.",
      ...overrides.live_probe,
    },
  };
}

function createData(sessionOverrides: Partial<AdminSessionUser> = {}): ProvidersPageData {
  return {
    state: "success",
    error: null,
    access: getProvidersAccess(createSession(sessionOverrides), true),
    providers: [
      {
        provider: "openai",
        label: "OpenAI",
        enabled: true,
        integration_class: "direct",
        template_id: null,
        config: {},
        ready: true,
        readiness_reason: null,
        contract_classification: "runtime-ready",
        capabilities: {},
        tool_calling_level: "full",
        compatibility_depth: "validated",
        runtime_readiness: "ready",
        streaming_readiness: "partial",
        provider_axis: "wired",
        auth_mechanism: "api_key",
        oauth_required: false,
        oauth_mode: null,
        discovery_supported: true,
        model_count: 1,
        models: [],
        last_sync_at: "2026-04-21T20:00:00Z",
        last_sync_status: "ok",
        last_sync_error: null,
        harness_profile_count: 1,
        harness_run_count: 2,
        harness_needs_attention_count: 0,
        harness_proof_status: "proven",
        harness_proven_profile_keys: ["generic_openai_like"],
        oauth_failure_count: 0,
        oauth_last_probe: null,
        oauth_last_bridge_sync: null,
      },
    ],
    templates: [],
    profiles: [
      {
        provider_key: "openai",
        label: "OpenAI",
        integration_class: "openai_compatible",
        endpoint_base_url: "https://api.openai.com/v1",
        auth_scheme: "bearer",
        auth_value: "",
        auth_header: "Authorization",
        template_id: null,
        enabled: true,
        models: ["gpt-4.1"],
        discovery_enabled: true,
        lifecycle_status: "ok",
        last_verify_status: "ok",
        last_probe_status: "ok",
        last_sync_status: "ok",
        needs_attention: false,
      },
    ],
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
    syncNote: "",
    healthConfig: {
      provider_health_enabled: true,
      model_health_enabled: false,
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
    productAxisTargets: [
      {
        provider_key: "github_copilot",
        product_axis: "oauth_account_providers",
        provider_type: "oauth_account",
        readiness: "partial",
        runtime_path: "bridge",
        auth_model: "oauth",
        contract_classification: "bridge-only",
        classification_reason: "This target remains bridge-only in the current release truth.",
        technical_requirements: ["Credentials must be configured."],
        operator_surface: "/oauth-targets",
        readiness_score: 72,
        status_summary: "Probe required",
        runtime_readiness: "partial",
        streaming_readiness: "partial",
        verify_probe_readiness: "partial",
        ui_readiness: "partial",
        health_semantics: "bridge",
        verify_probe_axis: "partial",
        observability_axis: "partial",
        ui_axis: "partial",
        evidence: createEvidence({
          runtime: { status: "missing", source: "none", recorded_at: null, details: "No native runtime proof recorded for this bridge slice." },
          streaming: { status: "missing", source: "none", recorded_at: null, details: "No streaming bridge proof recorded." },
          tool_calling: { status: "missing", source: "none", recorded_at: null, details: "No tool-calling proof recorded." },
        }),
        notes: "Needs another bridge probe before runtime confidence improves.",
        oauth_account_provider: true,
      },
    ],
    oauthTargets: [],
    oauthOperations: [],
    oauthRecentOps: [],
    oauthTotalOps: 0,
    oauthOnboarding: [],
    compatibilityMatrix: [
      {
        provider: "openai",
        label: "OpenAI",
        compatibility_depth: "validated",
        contract_classification: "runtime-ready",
        ready: true,
        runtime_readiness: "partial",
        streaming_readiness: "ready",
        provider_axis: "wired",
        streaming: "supported",
        tool_calling: "full",
        vision: "supported",
        discovery: "automatic",
        oauth_required: false,
        ui_models: 12,
        proof_status: "proven",
        proven_profile_keys: ["generic_openai_like"],
        evidence: createEvidence(),
        notes: "Matrix keeps both readiness axes visible.",
      },
    ],
    bootstrapReadiness: null,
    importPayload: "",
    newHarness: {
      provider_key: "openai",
      label: "OpenAI",
      template_id: "openai_compatible",
      integration_class: "openai_compatible",
      endpoint_base_url: "https://api.openai.com/v1",
      auth_scheme: "none",
      auth_value: "",
      auth_header: "",
      models: "gpt-4.1",
      stream_enabled: false,
    },
  };
}

describe("Provider readiness axes", () => {
  it("renders runtime and streaming readiness separately in the inventory and matrix", () => {
    const markup = renderToStaticMarkup(<ProviderInventorySection data={createData()} actions={createActions()} />);
    const inventoryReadinessDetail = "contract=runtime ready · runtime axis=ready · streaming axis=partial · provider axis=wired · compatibility depth=validated";
    const matrixReadinessDetail = "compatibility depth=validated · contract=runtime ready · runtime axis=partial · streaming axis=ready · provider axis=wired";
    const inventoryProofDetail = "harness proof=proven · proven profiles=generic_openai_like";
    const matrixProofDetail = "proof=proven · proven profiles=generic_openai_like";

    expect(markup).toContain("harness proven");
    expect(markup).toContain("proof proven");
    expect(markup).toContain("runtime ready");
    expect(markup).toContain("streaming partial");
    expect(markup).toContain("runtime partial");
    expect(markup).toContain("streaming ready");
    expect(markup).toContain(inventoryReadinessDetail);
    expect(markup).toContain(matrixReadinessDetail);
    expect(markup).toContain(inventoryProofDetail);
    expect(markup).toContain(matrixProofDetail);
    expect(markup.split(inventoryReadinessDetail)).toHaveLength(2);
    expect(markup.split(matrixReadinessDetail)).toHaveLength(2);
    expect(markup).not.toContain("compatibility depth=validated · contract=runtime ready · runtime axis=ready · streaming axis=partial · provider axis=wired");
    expect(markup).not.toContain("contract=runtime ready · runtime axis=partial · streaming axis=ready · provider axis=wired · compatibility depth=validated");
  });

  it("uses warning tones for partial readiness and needs-attention states", () => {
    const data = createData();
    data.profiles = [{ ...data.profiles[0], lifecycle_status: "degraded", last_verify_status: "warning", needs_attention: true }];

    const inventoryMarkup = renderToStaticMarkup(<ProviderInventorySection data={data} actions={createActions()} />);
    const harnessMarkup = renderToStaticMarkup(<HarnessControlSection data={data} actions={createActions()} />);

    expect(inventoryMarkup).toContain('data-tone="warning">streaming partial');
    expect(inventoryMarkup).toContain('data-tone="warning">runtime partial');
    expect(harnessMarkup).toContain('data-tone="warning">degraded');
    expect(harnessMarkup).toContain('data-tone="warning">needs attention');
    expect(harnessMarkup).not.toContain('data-tone="danger">needs attention');
  });

  it("renders unmapped native runtime axes as outside the shipped product axes", () => {
    const data = createData();
    data.providers = [
      {
        ...data.providers[0],
        provider: "anthropic",
        label: "Anthropic",
        ready: false,
        contract_classification: "unsupported",
        runtime_readiness: "partial",
        streaming_readiness: "partial",
        provider_axis: "unmapped_native_runtime",
        compatibility_depth: "limited",
      },
    ];
    data.compatibilityMatrix = [
      {
        ...data.compatibilityMatrix[0],
        provider: "anthropic",
        label: "Anthropic",
        compatibility_depth: "limited",
        contract_classification: "unsupported",
        runtime_readiness: "partial",
        streaming_readiness: "partial",
        provider_axis: "unmapped_native_runtime",
      },
    ];

    const markup = renderToStaticMarkup(<ProviderInventorySection data={data} actions={createActions()} />);

    expect(markup).toContain("contract=unsupported · runtime axis=partial · streaming axis=partial · provider axis=native runtime (outside product axes) · compatibility depth=limited");
    expect(markup).toContain(
      "compatibility depth=limited · contract=unsupported · runtime axis=partial · streaming axis=partial · provider axis=native runtime (outside product axes)",
    );
  });

  it("labels OAuth expansion rows as onboarding status instead of generic readiness", () => {
    const data = createData();
    data.productAxisTargets = [
      {
        ...data.productAxisTargets[0],
        readiness: "ready",
        status_summary: "Live probe evidence is recorded, but runtime stays outside live provider truth.",
        verify_probe_readiness: "ready",
      },
    ];
    data.oauthTargets = [
      {
        provider_key: "github_copilot",
        configured: true,
        runtime_bridge_enabled: true,
        probe_enabled: true,
        harness_profile_enabled: true,
        readiness: "partial",
        contract_classification: "bridge-only",
        queue_lane: "bridge_probe_only",
        parallelism_mode: "not_enforced",
        parallelism_limit: null,
        session_reuse_strategy: "Pre-issued OAuth access token is forwarded through bridge/profile operations only; no managed refresh or session reuse contract exists.",
        escalation_support: "native_runtime_unavailable",
        cost_posture: "avoided-cost is tracked while direct provider billing stays outside ForgeFrame.",
        operator_surface: "/oauth-targets",
        operator_truth: "ForgeFrame can probe or sync bridge profiles for this target, but no native runtime lane is shipped for it in the current release truth.",
        evidence: createEvidence({
          runtime: { status: "missing", source: "none", recorded_at: null, details: "No native runtime proof recorded for this target." },
          streaming: { status: "missing", source: "none", recorded_at: null, details: "No streaming proof recorded for this target." },
          tool_calling: { status: "missing", source: "none", recorded_at: null, details: "No tool-calling proof recorded for this target." },
        }),
      },
    ];
    data.oauthOnboarding = [
      {
        provider_key: "github_copilot",
        readiness: "partial",
        contract_classification: "bridge-only",
        queue_lane: "bridge_probe_only",
        parallelism_mode: "not_enforced",
        parallelism_limit: null,
        session_reuse_strategy: "Pre-issued OAuth access token is forwarded through bridge/profile operations only; no managed refresh or session reuse contract exists.",
        escalation_support: "native_runtime_unavailable",
        cost_posture: "avoided-cost is tracked while direct provider billing stays outside ForgeFrame.",
        operator_surface: "/oauth-targets",
        operator_truth: "ForgeFrame can probe or sync bridge profiles for this target, but no native runtime lane is shipped for it in the current release truth.",
        configured: true,
        runtime_bridge_enabled: true,
        probe_enabled: true,
        harness_profile_enabled: true,
        auth_kind: "oauth_account",
        oauth_mode: null,
        oauth_flow_support: null,
        evidence: createEvidence({
          runtime: { status: "missing", source: "none", recorded_at: null, details: "No native runtime proof recorded for this target." },
          streaming: { status: "missing", source: "none", recorded_at: null, details: "No streaming proof recorded for this target." },
          tool_calling: { status: "missing", source: "none", recorded_at: null, details: "No tool-calling proof recorded for this target." },
        }),
        operational_depth: "bridge_probe_evidenced",
        readiness_reason: "Live probe evidence is recorded, but this target remains onboarding/bridge-only in the current release truth.",
        next_steps: ["Keep github_copilot positioned as onboarding/bridge-only; probe success does not promote it to native runtime-ready truth."],
      },
    ];

    const markup = renderToStaticMarkup(<ExpansionTargetsSection data={data} actions={createActions()} />);

    expect(markup).toContain("onboarding ready");
    expect(markup).toContain("onboarding status=partial");
    expect(markup).toContain("Evidence &amp; Proof");
    expect(markup).toContain("observability axis=partial");
    expect(markup).toContain("live probe · status=observed");
    expect(markup).not.toContain("readiness=partial");
  });

  it("hides provider mutation controls for viewer sessions while keeping read-only surfaces visible", () => {
    const data = createData({ role: "viewer" });
    const markup = renderToStaticMarkup(
      <>
        <ProvidersOverviewSection data={data} actions={createActions()} />
        <HarnessControlSection data={data} actions={createActions()} />
        <ProviderInventorySection data={data} actions={createActions()} />
        <ExpansionTargetsSection data={data} actions={createActions()} />
      </>,
    );

    expect(markup).toContain("Refresh");
    expect(markup).toContain("Permission-limited provider view");
    expect(markup).toContain("Harness export and import actions stay hidden for viewer sessions.");
    expect(markup).not.toContain("Sync all providers");
    expect(markup).not.toContain("Export redacted");
    expect(markup).not.toContain("Export full snapshot");
    expect(markup).not.toContain("Save profile");
    expect(markup).not.toContain("Preview + Verify");
    expect(markup).not.toContain("Create provider");
    expect(markup).not.toContain("Save label");
    expect(markup).not.toContain("Run health checks");
    expect(markup).not.toContain("Sync OAuth bridge profiles");
    expect(markup).not.toContain("Probe OAuth target");
  });

  it("hides provider mutation controls for read-only impersonation sessions", () => {
    const data = createData({ read_only: true, session_type: "impersonation" });
    const markup = renderToStaticMarkup(
      <>
        <HarnessControlSection data={data} actions={createActions()} />
        <ProviderInventorySection data={data} actions={createActions()} />
        <ExpansionTargetsSection data={data} actions={createActions()} />
      </>,
    );

    expect(markup).toContain("Read-only provider view");
    expect(markup).toContain("Export redacted");
    expect(markup).toContain("Redacted harness export stays available for inspection");
    expect(markup).not.toContain("Export full snapshot");
    expect(markup).not.toContain("Dry-run import");
    expect(markup).not.toContain("Apply import");
    expect(markup).not.toContain("Create provider");
    expect(markup).not.toContain("Save current config");
    expect(markup).not.toContain("Probe all OAuth targets");
  });

  it("keeps routine provider mutations visible for admin sessions", () => {
    const data = createData();
    const markup = renderToStaticMarkup(
      <>
        <ProvidersOverviewSection data={data} actions={createActions()} />
        <HarnessControlSection data={data} actions={createActions()} />
        <ProviderInventorySection data={data} actions={createActions()} />
        <ExpansionTargetsSection data={data} actions={createActions()} />
      </>,
    );

    expect(markup).toContain("Sync all providers");
    expect(markup).toContain("Save profile");
    expect(markup).toContain("Preview + Verify");
    expect(markup).toContain("Export redacted");
    expect(markup).toContain("Export full snapshot");
    expect(markup).toContain("Dry-run import");
    expect(markup).toContain("Create provider");
    expect(markup).toContain("Save label");
    expect(markup).toContain("Run health checks");
    expect(markup).toContain("Sync OAuth bridge profiles");
    expect(markup).toContain("Probe OAuth target");
  });
});
