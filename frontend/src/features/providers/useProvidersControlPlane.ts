import { useEffect, useState } from "react";

import {
  activateHarnessProfile,
  activateProvider,
  createProvider,
  deactivateHarnessProfile,
  deactivateProvider,
  deleteHarnessProfile as deleteHarnessProfileRequest,
  dryRunHarness,
  fetchBootstrapReadiness,
  fetchClientOperationalView,
  fetchCompatibilityMatrix,
  fetchHarnessExport,
  fetchHarnessProfiles,
  fetchHarnessRuns,
  fetchHarnessTemplates,
  fetchOauthAccountOperations,
  fetchOauthAccountTargets,
  fetchOauthOnboarding,
  fetchProductAxisTargets,
  fetchProviderControlPlane,
  fetchUsageSummary,
  importHarnessConfig,
  patchHealthConfig,
  previewHarness,
  probeAllOauthAccountProviders,
  probeHarness,
  probeOauthAccountProvider,
  rollbackHarnessProfile as rollbackHarnessProfileRequest,
  runHealthChecks,
  syncOauthAccountBridgeProfiles,
  syncProviders,
  type HarnessProfile,
  type HealthConfig,
  updateProvider,
  upsertHarnessProfile,
  verifyHarnessProfile,
} from "../../api/admin";
import type {
  HarnessDraft,
  LoadState,
  ProviderDraft,
  ProvidersAccessState,
  ProviderRunFilters,
  ProvidersPageActions,
  ProvidersPageData,
} from "./providersShared";

const INITIAL_RUN_FILTERS: ProviderRunFilters = {
  mode: "all",
  status: "all",
  provider: "all",
  client: "all",
};

const INITIAL_PROVIDER_DRAFT: ProviderDraft = {
  provider: "",
  label: "",
};

const INITIAL_HARNESS_DRAFT: HarnessDraft = {
  provider_key: "generic_openai_like",
  label: "Generic OpenAI-like",
  template_id: "openai_compatible",
  integration_class: "openai_compatible",
  endpoint_base_url: "https://example.invalid/v1",
  auth_scheme: "bearer",
  auth_value: "",
  auth_header: "Authorization",
  models: "model-1",
  stream_enabled: false,
};

function getActionError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getModelSource(integrationClass: HarnessProfile["integration_class"]): "manual" | "templated" | "static" {
  if (integrationClass === "static_catalog") {
    return "static";
  }
  if (integrationClass === "templated_http") {
    return "templated";
  }
  return "manual";
}

export function useProvidersControlPlane(
  access: ProvidersAccessState,
  instanceId?: string | null,
): { data: ProvidersPageData; actions: ProvidersPageActions } {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProvidersPageData["providers"]>([]);
  const [templates, setTemplates] = useState<ProvidersPageData["templates"]>([]);
  const [profiles, setProfiles] = useState<ProvidersPageData["profiles"]>([]);
  const [runs, setRuns] = useState<ProvidersPageData["runs"]>([]);
  const [runSummary, setRunSummary] = useState<Record<string, number>>({});
  const [runOps, setRunOps] = useState<ProvidersPageData["runOps"]>({});
  const [runFilters, setRunFilters] = useState<ProviderRunFilters>(INITIAL_RUN_FILTERS);
  const [operationResult, setOperationResult] = useState<string>("");
  const [syncNote, setSyncNote] = useState<string>("No sync note provided.");
  const [healthConfig, setHealthConfig] = useState<ProvidersPageData["healthConfig"]>(null);
  const [newProvider, setNewProvider] = useState<ProviderDraft>(INITIAL_PROVIDER_DRAFT);
  const [providerLabelDrafts, setProviderLabelDrafts] = useState<Record<string, string>>({});
  const [providerErrors, setProviderErrors] = useState<Record<string, number>>({});
  const [modelErrors, setModelErrors] = useState<Record<string, number>>({});
  const [integrationErrors, setIntegrationErrors] = useState<Record<string, number>>({});
  const [profileErrors, setProfileErrors] = useState<Record<string, number>>({});
  const [providerCatalog, setProviderCatalog] = useState<ProvidersPageData["providerCatalog"]>([]);
  const [providerCatalogSummary, setProviderCatalogSummary] = useState<ProvidersPageData["providerCatalogSummary"]>(null);
  const [openaiCompatibilitySignoff, setOpenAICompatibilitySignoff] = useState<ProvidersPageData["openaiCompatibilitySignoff"]>(null);
  const [clients, setClients] = useState<ProvidersPageData["clients"]>([]);
  const [productAxisTargets, setProductAxisTargets] = useState<ProvidersPageData["productAxisTargets"]>([]);
  const [oauthTargets, setOauthTargets] = useState<ProvidersPageData["oauthTargets"]>([]);
  const [oauthOperations, setOauthOperations] = useState<ProvidersPageData["oauthOperations"]>([]);
  const [oauthRecentOps, setOauthRecentOps] = useState<ProvidersPageData["oauthRecentOps"]>([]);
  const [oauthTotalOps, setOauthTotalOps] = useState<number>(0);
  const [oauthOnboarding, setOauthOnboarding] = useState<ProvidersPageData["oauthOnboarding"]>([]);
  const [compatibilityMatrix, setCompatibilityMatrix] = useState<ProvidersPageData["compatibilityMatrix"]>([]);
  const [bootstrapReadiness, setBootstrapReadiness] = useState<ProvidersPageData["bootstrapReadiness"]>(null);
  const [importPayload, setImportPayload] = useState<string>("");
  const [newHarness, setNewHarness] = useState<HarnessDraft>(INITIAL_HARNESS_DRAFT);

  const ensureRedactedExportAllowed = () => {
    if (access.canExportRedacted) {
      return true;
    }

    setError(access.exportBlockedMessage);
    return false;
  };

  const ensureFullExportAllowed = () => {
    if (access.canExportFull) {
      return true;
    }

    setError(access.fullExportBlockedMessage);
    return false;
  };

  const ensureMutationAllowed = () => {
    if (access.canMutate) {
      return true;
    }

    setError(access.mutationBlockedMessage);
    return false;
  };

  const load = async () => {
    setState("loading");
    setError(null);
    try {
      const [
        payload,
        usage,
        harnessTemplates,
        harnessProfiles,
        harnessRuns,
        clientView,
        productAxisTargetsResponse,
        oauthTargetsResponse,
        oauthOpsResponse,
        oauthOnboardingResponse,
        bootstrapResponse,
        compatibilityResponse,
      ] = await Promise.all([
        instanceId ? fetchProviderControlPlane(instanceId) : fetchProviderControlPlane(),
        instanceId ? fetchUsageSummary("24h", instanceId) : fetchUsageSummary(),
        fetchHarnessTemplates(),
        fetchHarnessProfiles(),
        fetchHarnessRuns(
          runFilters.provider === "all" ? undefined : runFilters.provider,
          runFilters.mode === "all" ? undefined : runFilters.mode,
          runFilters.status === "all" ? undefined : runFilters.status,
          runFilters.client === "all" ? undefined : runFilters.client,
          40,
        ),
        instanceId ? fetchClientOperationalView("24h", instanceId) : fetchClientOperationalView(),
        instanceId ? fetchProductAxisTargets(instanceId) : fetchProductAxisTargets(),
        instanceId ? fetchOauthAccountTargets(instanceId) : fetchOauthAccountTargets(),
        instanceId ? fetchOauthAccountOperations(instanceId) : fetchOauthAccountOperations(),
        instanceId ? fetchOauthOnboarding(instanceId) : fetchOauthOnboarding(),
        fetchBootstrapReadiness(),
        instanceId ? fetchCompatibilityMatrix(instanceId) : fetchCompatibilityMatrix(),
      ]);

      setProviders(payload.providers);
      setTemplates(harnessTemplates.templates);
      setProfiles(harnessProfiles.profiles);
      setRuns(harnessRuns.runs.slice(0, 20));
      setRunSummary(harnessRuns.summary ?? {});
      setRunOps(harnessRuns.ops ?? {});
      setClients(clientView.clients ?? []);
      setProductAxisTargets(productAxisTargetsResponse.targets ?? []);
      setOauthTargets(oauthTargetsResponse.targets ?? []);
      setOauthOperations(oauthOpsResponse.operations ?? []);
      setOauthRecentOps(oauthOpsResponse.recent ?? []);
      setOauthTotalOps(Number(oauthOpsResponse.total_operations ?? 0));
      setOauthOnboarding(oauthOnboardingResponse.targets ?? []);
      setCompatibilityMatrix(compatibilityResponse.matrix ?? []);
      setBootstrapReadiness({
        ready: Boolean(bootstrapResponse.ready),
        checks: bootstrapResponse.checks ?? [],
        next_steps: bootstrapResponse.next_steps ?? [],
      });
      setSyncNote(typeof payload.notes.sync_action === "string" ? payload.notes.sync_action : "No sync note provided.");
      setHealthConfig(payload.health_config);
      setProviderErrors(Object.fromEntries(usage.aggregations.errors_by_provider.map((item) => [String(item.provider), Number(item.errors)])));
      setModelErrors(Object.fromEntries(usage.aggregations.errors_by_model.map((item) => [String(item.model), Number(item.errors)])));
      setIntegrationErrors(Object.fromEntries(usage.aggregations.errors_by_integration.map((item) => [String(item.integration_key), Number(item.errors)])));
      setProfileErrors(Object.fromEntries(usage.aggregations.errors_by_profile.map((item) => [String(item.profile_key), Number(item.errors)])));
      setProviderCatalog(payload.provider_catalog ?? []);
      setProviderCatalogSummary(payload.provider_catalog_summary ?? null);
      setOpenAICompatibilitySignoff(payload.openai_compatibility_signoff ?? null);
      setProviderLabelDrafts(Object.fromEntries(payload.providers.map((provider) => [provider.provider, provider.label])));
      setState("success");
    } catch (actionError) {
      setState("error");
      setError(getActionError(actionError, "Unknown provider loading error."));
    }
  };

  useEffect(() => {
    void load();
  }, [instanceId, runFilters.client, runFilters.mode, runFilters.provider, runFilters.status]);

  const withAction = async (task: () => Promise<void>, fallback: string, requiresMutation = false) => {
    if (requiresMutation && !ensureMutationAllowed()) {
      return;
    }

    setError(null);
    try {
      await task();
    } catch (actionError) {
      setError(getActionError(actionError, fallback));
    }
  };

  const setRunFilter = (field: keyof ProviderRunFilters, value: string) => {
    setRunFilters((current) => ({ ...current, [field]: value }));
  };

  const setProviderLabelDraft = (provider: string, label: string) => {
    setProviderLabelDrafts((current) => ({ ...current, [provider]: label }));
  };

  const runHarnessAction = async (providerKey: string, model?: string) =>
    withAction(async () => {
      const targetModel = model ?? profiles.find((item) => item.provider_key === providerKey)?.models[0] ?? "model-1";
      const preview = await previewHarness({ provider_key: providerKey, model: targetModel, message: "preview", stream: false });
      const dry = await dryRunHarness({ provider_key: providerKey, model: targetModel, message: "dry-run", stream: false });
      const verify = await verifyHarnessProfile({ provider_key: providerKey, model: targetModel });
      setOperationResult(JSON.stringify({ preview, dry, verify }, null, 2));
      await load();
    }, "Harness action failed.", true);

  const probeHarnessProfile = async (providerKey: string, model?: string) =>
    withAction(async () => {
      const targetModel = model ?? profiles.find((item) => item.provider_key === providerKey)?.models[0] ?? "model-1";
      const response = await probeHarness({ provider_key: providerKey, model: targetModel, message: "probe", stream: false });
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "Harness probe failed.", true);

  const toggleHarnessProfile = async (providerKey: string, enabled: boolean) =>
    withAction(async () => {
      if (enabled) {
        await deactivateHarnessProfile(providerKey);
      } else {
        await activateHarnessProfile(providerKey);
      }
      await load();
    }, "Harness profile update failed.", true);

  const deleteHarnessProfile = async (providerKey: string) =>
    withAction(async () => {
      await deleteHarnessProfileRequest(providerKey);
      await load();
    }, "Harness profile deletion failed.", true);

  const rollbackHarnessProfile = async (providerKey: string, revision: number) =>
    withAction(async () => {
      const response = await rollbackHarnessProfileRequest(providerKey, revision);
      setOperationResult(JSON.stringify(response.profile, null, 2));
      await load();
    }, "Harness rollback failed.", true);

  const createProviderAction = async () => {
    if (!ensureMutationAllowed()) {
      return;
    }

    const provider = newProvider.provider.trim();
    const label = newProvider.label.trim();
    if (!provider || !label) {
      setError("Provider key and label are required.");
      return;
    }

    await withAction(async () => {
      await createProvider({ provider, label, integration_class: "native", config: {} });
      setNewProvider(INITIAL_PROVIDER_DRAFT);
      await load();
    }, "Provider creation failed.");
  };

  const toggleProvider = async (provider: string, enabled: boolean) =>
    withAction(async () => {
      if (enabled) {
        await deactivateProvider(provider);
      } else {
        await activateProvider(provider);
      }
      await load();
    }, "Provider state update failed.", true);

  const syncProviderModels = async (provider: string) =>
    withAction(async () => {
      await syncProviders(provider);
      await load();
    }, "Provider sync failed.", true);

  const saveProviderLabel = async (provider: string) => {
    if (!ensureMutationAllowed()) {
      return;
    }

    const label = (providerLabelDrafts[provider] ?? "").trim();
    if (!label) {
      setError("Provider label is required.");
      return;
    }

    await withAction(async () => {
      await updateProvider(provider, { label });
      await load();
    }, "Provider label update failed.", true);
  };

  const syncAllProviders = async () =>
    withAction(async () => {
      await syncProviders();
      await load();
    }, "Provider sync failed.", true);

  const upsertHarness = async () => {
    if (!ensureMutationAllowed()) {
      return;
    }

    const providerKey = newHarness.provider_key.trim();
    const label = newHarness.label.trim();
    const endpointBaseUrl = newHarness.endpoint_base_url.trim();
    const models = newHarness.models
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!providerKey || !label || !endpointBaseUrl) {
      setError("Provider key, label, and endpoint are required for harness onboarding.");
      return;
    }
    if (models.length === 0) {
      setError("At least one model is required for a harness profile.");
      return;
    }
    if (newHarness.auth_scheme !== "none" && !newHarness.auth_value.trim()) {
      setError("Auth value is required when harness authentication is enabled.");
      return;
    }
    if (newHarness.auth_scheme === "api_key_header" && !newHarness.auth_header.trim()) {
      setError("Auth header is required for API key header profiles.");
      return;
    }

    await withAction(async () => {
      await upsertHarnessProfile(providerKey, {
        provider_key: providerKey,
        label,
        template_id: newHarness.template_id || null,
        integration_class: newHarness.integration_class,
        endpoint_base_url: endpointBaseUrl,
        auth_scheme: newHarness.auth_scheme,
        auth_value: newHarness.auth_scheme === "none" ? "" : newHarness.auth_value,
        auth_header: newHarness.auth_header || "Authorization",
        enabled: true,
        models,
        discovery_enabled: false,
        stream_mapping: { enabled: newHarness.stream_enabled },
        capabilities: {
          streaming: newHarness.stream_enabled,
          discovery_support: false,
          model_source: getModelSource(newHarness.integration_class),
        },
      });
      setNewHarness({
        ...INITIAL_HARNESS_DRAFT,
        template_id: newHarness.template_id || INITIAL_HARNESS_DRAFT.template_id,
        integration_class: newHarness.integration_class,
      });
      await load();
    }, "Harness profile save failed.", true);
  };

  const updateHealth = async (patch: Partial<HealthConfig>) =>
    withAction(async () => {
      const response = await patchHealthConfig(patch);
      setHealthConfig(response.config);
      await load();
    }, "Health config update failed.", true);

  const runHealthChecksAction = async () =>
    withAction(async () => {
      await runHealthChecks();
      await load();
    }, "Health check run failed.", true);

  const exportHarness = async (redactSecrets: boolean) =>
    withAction(async () => {
      if (redactSecrets ? !ensureRedactedExportAllowed() : !ensureFullExportAllowed()) {
        return;
      }
      const response = await fetchHarnessExport(redactSecrets);
      const formatted = JSON.stringify(response.snapshot, null, 2);
      setImportPayload(formatted);
      setOperationResult(formatted);
    }, "Harness export failed.");

  const importHarness = async (dryRun: boolean) =>
    withAction(async () => {
      const parsed = JSON.parse(importPayload) as Record<string, unknown>;
      const result = await importHarnessConfig(parsed, dryRun);
      setOperationResult(JSON.stringify(result, null, 2));
      if (!dryRun) {
        await load();
      }
    }, "Harness import failed.", true);

  const syncOauthBridgeProfiles = async () =>
    withAction(async () => {
      const response = await syncOauthAccountBridgeProfiles();
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "OAuth bridge sync failed.", true);

  const probeAllOauthTargets = async () =>
    withAction(async () => {
      const response = await probeAllOauthAccountProviders();
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "OAuth probe failed.", true);

  const probeOauthTarget = async (providerKey: string) =>
    withAction(async () => {
      const response = await probeOauthAccountProvider(providerKey);
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "OAuth probe failed.", true);

  const data: ProvidersPageData = {
    state,
    error,
    access,
    providers,
    templates,
    profiles,
    runs,
    runSummary,
    runOps,
    runFilters,
    operationResult,
    syncNote,
    healthConfig,
    newProvider,
    providerLabelDrafts,
    providerErrors,
    modelErrors,
    integrationErrors,
    profileErrors,
    providerCatalog,
    providerCatalogSummary,
    openaiCompatibilitySignoff,
    clients,
    productAxisTargets,
    oauthTargets,
    oauthOperations,
    oauthRecentOps,
    oauthTotalOps,
    oauthOnboarding,
    compatibilityMatrix,
    bootstrapReadiness,
    importPayload,
    newHarness,
  };

  const actions: ProvidersPageActions = {
    load,
    setRunFilter,
    setOperationResult,
    setImportPayload,
    setNewProvider,
    setNewHarness,
    setProviderLabelDraft,
    runHarnessAction,
    probeHarnessProfile,
    toggleHarnessProfile,
    deleteHarnessProfile,
    rollbackHarnessProfile,
    createProvider: createProviderAction,
    toggleProvider,
    syncProviderModels,
    saveProviderLabel,
    syncAllProviders,
    upsertHarness,
    updateHealth,
    runHealthChecks: runHealthChecksAction,
    exportHarness,
    importHarness,
    syncOauthBridgeProfiles,
    probeAllOauthTargets,
    probeOauthTarget,
  };

  return { data, actions };
}
