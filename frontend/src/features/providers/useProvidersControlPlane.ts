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
  type ProviderClassDescriptor,
  type ProviderClassKey,
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
  ProviderEditorDraft,
  ProvidersAccessState,
  ProviderRunFilters,
  ProvidersPageActions,
  ProvidersPageData,
} from "./providersShared";

type ProvidersControlPlaneOptions = {
  includeUsageSummary?: boolean;
  includeHarness?: boolean;
  includeOauthTargets?: boolean;
  includeCompatibilityMatrix?: boolean;
  includeBootstrapReadiness?: boolean;
  includeClientView?: boolean;
};

const DEFAULT_OPTIONS: Required<ProvidersControlPlaneOptions> = {
  includeUsageSummary: true,
  includeHarness: true,
  includeOauthTargets: true,
  includeCompatibilityMatrix: true,
  includeBootstrapReadiness: true,
  includeClientView: true,
};

const INITIAL_RUN_FILTERS: ProviderRunFilters = {
  mode: "all",
  status: "all",
  provider: "all",
  client: "all",
};

const INITIAL_PROVIDER_DRAFT: ProviderDraft = {
  provider: "",
  label: "",
  providerClass: "openai_compatible",
  integrationClass: "openai_compatible",
  templateId: "openai_compatible",
  endpointBaseUrl: "https://example.invalid/v1",
  authScheme: "bearer",
  oauthMode: "account_portal",
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

const DEFAULT_PROVIDER_CLASS_OPTIONS: ProviderClassDescriptor[] = [
  {
    key: "openai_compatible",
    label: "OpenAI-compatible",
    description: "Remote or gateway-backed OpenAI-style runtime with explicit endpoint and auth semantics.",
    integration_class: "openai_compatible",
    template_id: "openai_compatible",
    default_config: {
      provider_class: "openai_compatible",
      endpoint_base_url: "https://example.invalid/v1",
      auth_scheme: "bearer",
    },
  },
  {
    key: "local_ollama",
    label: "Local / Ollama",
    description: "Dedicated local runtime path for Ollama-style deployments and local model inventories.",
    integration_class: "local_ollama",
    template_id: "ollama",
    default_config: {
      provider_class: "local_ollama",
      endpoint_base_url: "http://localhost:11434/v1",
      auth_scheme: "none",
    },
  },
  {
    key: "oauth_account",
    label: "OAuth / Account-backed",
    description: "Account-backed runtime that depends on an operator or end-user OAuth/session bridge.",
    integration_class: "oauth_account",
    template_id: null,
    default_config: {
      provider_class: "oauth_account",
      auth_scheme: "oauth_account",
      oauth_mode: "account_portal",
    },
  },
  {
    key: "custom",
    label: "Custom",
    description: "Explicit custom wiring when the provider does not fit the built-in runtime classes cleanly yet.",
    integration_class: "custom",
    template_id: null,
    default_config: {
      provider_class: "custom",
    },
  },
];

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

function getProviderClassDescriptor(
  providerClass: ProviderClassKey,
  supportedClasses: ProviderClassDescriptor[],
): ProviderClassDescriptor {
  return supportedClasses.find((item) => item.key === providerClass)
    ?? DEFAULT_PROVIDER_CLASS_OPTIONS.find((item) => item.key === providerClass)
    ?? DEFAULT_PROVIDER_CLASS_OPTIONS[0];
}

function inferProviderClass(
  provider: {
    provider: string;
    provider_class?: string | null;
    integration_class?: string | null;
    template_id?: string | null;
    config?: Record<string, string>;
    oauth_required?: boolean;
  },
): ProviderClassKey {
  const configuredClass = provider.config?.provider_class ?? provider.provider_class ?? "";
  if (configuredClass === "openai_compatible" || configuredClass === "local_ollama" || configuredClass === "oauth_account" || configuredClass === "custom") {
    return configuredClass;
  }
  const integrationClass = (provider.integration_class ?? "").toLowerCase();
  const templateId = (provider.template_id ?? "").toLowerCase();
  const providerKey = provider.provider.toLowerCase();
  const authScheme = (provider.config?.auth_scheme ?? "").toLowerCase();

  if (providerKey === "ollama" || templateId === "ollama" || integrationClass.includes("ollama")) {
    return "local_ollama";
  }
  if (provider.oauth_required || authScheme === "oauth_account" || integrationClass.includes("oauth")) {
    return "oauth_account";
  }
  if (
    integrationClass === "openai_compatible"
    || integrationClass === "harness_generic"
    || templateId === "openai_compatible"
    || authScheme === "bearer"
    || authScheme === "api_key_header"
  ) {
    return "openai_compatible";
  }
  return "custom";
}

function buildProviderEditorDraft(
  provider: ProvidersPageData["providers"][number],
  supportedClasses: ProviderClassDescriptor[],
): ProviderEditorDraft {
  const providerClass = inferProviderClass(provider);
  const descriptor = getProviderClassDescriptor(providerClass, supportedClasses);
  return {
    label: provider.label,
    providerClass,
    integrationClass: provider.integration_class || descriptor.integration_class,
    templateId: provider.template_id ?? descriptor.template_id ?? "",
    endpointBaseUrl: provider.config.endpoint_base_url ?? descriptor.default_config.endpoint_base_url ?? "",
    authScheme: provider.config.auth_scheme ?? descriptor.default_config.auth_scheme ?? "bearer",
    oauthMode: provider.config.oauth_mode ?? descriptor.default_config.oauth_mode ?? "account_portal",
  };
}

function buildProviderConfig(
  draft: Pick<ProviderDraft, "providerClass" | "endpointBaseUrl" | "authScheme" | "oauthMode">,
  supportedClasses: ProviderClassDescriptor[],
): Record<string, string> {
  const descriptor = getProviderClassDescriptor(draft.providerClass, supportedClasses);
  const config: Record<string, string> = { ...descriptor.default_config, provider_class: draft.providerClass };

  if (draft.providerClass !== "oauth_account" && draft.endpointBaseUrl.trim()) {
    config.endpoint_base_url = draft.endpointBaseUrl.trim();
  } else {
    delete config.endpoint_base_url;
  }
  if (draft.providerClass === "oauth_account") {
    config.auth_scheme = "oauth_account";
    config.oauth_mode = draft.oauthMode.trim() || descriptor.default_config.oauth_mode || "account_portal";
  } else {
    config.auth_scheme = draft.authScheme.trim() || descriptor.default_config.auth_scheme || "bearer";
    delete config.oauth_mode;
  }
  return config;
}

export function useProvidersControlPlane(
  access: ProvidersAccessState,
  instanceId?: string | null,
  options: ProvidersControlPlaneOptions = DEFAULT_OPTIONS,
): { data: ProvidersPageData; actions: ProvidersPageActions } {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProvidersPageData["providers"]>([]);
  const [supportedProviderClasses, setSupportedProviderClasses] = useState<ProviderClassDescriptor[]>(DEFAULT_PROVIDER_CLASS_OPTIONS);
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
  const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderEditorDraft>>({});
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

  const clearScopedData = () => {
    setProviders([]);
    setSupportedProviderClasses(DEFAULT_PROVIDER_CLASS_OPTIONS);
    setTemplates([]);
    setProfiles([]);
    setRuns([]);
    setRunSummary({});
    setRunOps({});
    setClients([]);
    setProductAxisTargets([]);
    setOauthTargets([]);
    setOauthOperations([]);
    setOauthRecentOps([]);
    setOauthTotalOps(0);
    setOauthOnboarding([]);
    setCompatibilityMatrix([]);
    setBootstrapReadiness(null);
    setSyncNote("No sync note provided.");
    setHealthConfig(null);
    setProviderErrors({});
    setModelErrors({});
    setIntegrationErrors({});
    setProfileErrors({});
    setProviderCatalog([]);
    setProviderCatalogSummary(null);
    setOpenAICompatibilitySignoff(null);
    setProviderDrafts({});
    setProviderLabelDrafts({});
  };

  const load = async () => {
    if (!access.canRead) {
      clearScopedData();
      setState("success");
      setError(null);
      return;
    }

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
        resolvedOptions.includeUsageSummary
          ? (instanceId ? fetchUsageSummary("24h", instanceId) : fetchUsageSummary())
          : Promise.resolve(null),
        resolvedOptions.includeHarness ? fetchHarnessTemplates() : Promise.resolve(null),
        resolvedOptions.includeHarness ? fetchHarnessProfiles(instanceId) : Promise.resolve(null),
        resolvedOptions.includeHarness
          ? fetchHarnessRuns(
            runFilters.provider === "all" ? undefined : runFilters.provider,
            runFilters.mode === "all" ? undefined : runFilters.mode,
            runFilters.status === "all" ? undefined : runFilters.status,
            runFilters.client === "all" ? undefined : runFilters.client,
            40,
            instanceId,
          )
          : Promise.resolve(null),
        resolvedOptions.includeClientView
          ? (instanceId ? fetchClientOperationalView("24h", instanceId) : fetchClientOperationalView())
          : Promise.resolve(null),
        resolvedOptions.includeOauthTargets
          ? (instanceId ? fetchProductAxisTargets(instanceId) : fetchProductAxisTargets())
          : Promise.resolve(null),
        resolvedOptions.includeOauthTargets
          ? (instanceId ? fetchOauthAccountTargets(instanceId) : fetchOauthAccountTargets())
          : Promise.resolve(null),
        resolvedOptions.includeOauthTargets
          ? (instanceId ? fetchOauthAccountOperations(instanceId) : fetchOauthAccountOperations())
          : Promise.resolve(null),
        resolvedOptions.includeOauthTargets
          ? (instanceId ? fetchOauthOnboarding(instanceId) : fetchOauthOnboarding())
          : Promise.resolve(null),
        resolvedOptions.includeBootstrapReadiness ? fetchBootstrapReadiness() : Promise.resolve(null),
        resolvedOptions.includeCompatibilityMatrix
          ? (instanceId ? fetchCompatibilityMatrix(instanceId) : fetchCompatibilityMatrix())
          : Promise.resolve(null),
      ]);

      setProviders(payload.providers);
      setSupportedProviderClasses(payload.supported_provider_classes ?? DEFAULT_PROVIDER_CLASS_OPTIONS);
      setTemplates(harnessTemplates?.templates ?? []);
      setProfiles(harnessProfiles?.profiles ?? []);
      setRuns(harnessRuns?.runs.slice(0, 20) ?? []);
      setRunSummary(harnessRuns?.summary ?? {});
      setRunOps(harnessRuns?.ops ?? {});
      setClients(clientView?.clients ?? []);
      setProductAxisTargets(productAxisTargetsResponse?.targets ?? []);
      setOauthTargets(oauthTargetsResponse?.targets ?? []);
      setOauthOperations(oauthOpsResponse?.operations ?? []);
      setOauthRecentOps(oauthOpsResponse?.recent ?? []);
      setOauthTotalOps(Number(oauthOpsResponse?.total_operations ?? 0));
      setOauthOnboarding(oauthOnboardingResponse?.targets ?? []);
      setCompatibilityMatrix(compatibilityResponse?.matrix ?? []);
      setBootstrapReadiness(
        bootstrapResponse
          ? {
            ready: Boolean(bootstrapResponse.ready),
            checks: bootstrapResponse.checks ?? [],
            next_steps: bootstrapResponse.next_steps ?? [],
          }
          : null,
      );
      setSyncNote(typeof payload.notes.sync_action === "string" ? payload.notes.sync_action : "No sync note provided.");
      setHealthConfig(payload.health_config);
      setProviderErrors(
        usage
          ? Object.fromEntries(usage.aggregations.errors_by_provider.map((item) => [String(item.provider), Number(item.errors)]))
          : {},
      );
      setModelErrors(
        usage
          ? Object.fromEntries(usage.aggregations.errors_by_model.map((item) => [String(item.model), Number(item.errors)]))
          : {},
      );
      setIntegrationErrors(
        usage
          ? Object.fromEntries(usage.aggregations.errors_by_integration.map((item) => [String(item.integration_key), Number(item.errors)]))
          : {},
      );
      setProfileErrors(
        usage
          ? Object.fromEntries(usage.aggregations.errors_by_profile.map((item) => [String(item.profile_key), Number(item.errors)]))
          : {},
      );
      setProviderCatalog(payload.provider_catalog ?? []);
      setProviderCatalogSummary(payload.provider_catalog_summary ?? null);
      setOpenAICompatibilitySignoff(payload.openai_compatibility_signoff ?? null);
      setProviderDrafts(
        Object.fromEntries(
          payload.providers.map((provider) => [provider.provider, buildProviderEditorDraft(provider, payload.supported_provider_classes ?? DEFAULT_PROVIDER_CLASS_OPTIONS)]),
        ),
      );
      setProviderLabelDrafts(Object.fromEntries(payload.providers.map((provider) => [provider.provider, provider.label])));
      setState("success");
    } catch (actionError) {
      setState("error");
      setError(getActionError(actionError, "Unknown provider loading error."));
    }
  };

  useEffect(() => {
    void load();
  }, [
    instanceId,
    access.canRead,
    resolvedOptions.includeBootstrapReadiness,
    resolvedOptions.includeClientView,
    resolvedOptions.includeCompatibilityMatrix,
    resolvedOptions.includeHarness,
    resolvedOptions.includeOauthTargets,
    resolvedOptions.includeUsageSummary,
    runFilters.client,
    runFilters.mode,
    runFilters.provider,
    runFilters.status,
  ]);

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
    setProviderDrafts((current) => ({
      ...current,
      [provider]: current[provider]
        ? {
          ...current[provider],
          label,
        }
        : {
          label,
          providerClass: "custom",
          integrationClass: "custom",
          templateId: "",
          endpointBaseUrl: "",
          authScheme: "bearer",
          oauthMode: "account_portal",
        },
    }));
  };

  const setProviderDraftField = (provider: string, field: keyof ProviderEditorDraft, value: string) => {
    setProviderDrafts((current) => ({
      ...current,
      [provider]: {
        ...(current[provider] ?? {
          label: providerLabelDrafts[provider] ?? provider,
          providerClass: "custom",
          integrationClass: "custom",
          templateId: "",
          endpointBaseUrl: "",
          authScheme: "bearer",
          oauthMode: "account_portal",
        }),
        [field]: value,
      },
    }));
    if (field === "label") {
      setProviderLabelDrafts((current) => ({ ...current, [provider]: value }));
    }
  };

  const runHarnessAction = async (providerKey: string, model?: string) =>
    withAction(async () => {
      const targetModel = model ?? profiles.find((item) => item.provider_key === providerKey)?.models[0] ?? "model-1";
      const preview = await previewHarness({ provider_key: providerKey, model: targetModel, message: "preview", stream: false }, instanceId);
      const dry = await dryRunHarness({ provider_key: providerKey, model: targetModel, message: "dry-run", stream: false }, instanceId);
      const verify = await verifyHarnessProfile({ provider_key: providerKey, model: targetModel }, instanceId);
      setOperationResult(JSON.stringify({ preview, dry, verify }, null, 2));
      await load();
    }, "Harness action failed.", true);

  const probeHarnessProfile = async (providerKey: string, model?: string) =>
    withAction(async () => {
      const targetModel = model ?? profiles.find((item) => item.provider_key === providerKey)?.models[0] ?? "model-1";
      const response = await probeHarness({ provider_key: providerKey, model: targetModel, message: "probe", stream: false }, instanceId);
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "Harness probe failed.", true);

  const toggleHarnessProfile = async (providerKey: string, enabled: boolean) =>
    withAction(async () => {
      if (enabled) {
        await deactivateHarnessProfile(providerKey, instanceId);
      } else {
        await activateHarnessProfile(providerKey, instanceId);
      }
      await load();
    }, "Harness profile update failed.", true);

  const deleteHarnessProfile = async (providerKey: string) =>
    withAction(async () => {
      await deleteHarnessProfileRequest(providerKey, instanceId);
      await load();
    }, "Harness profile deletion failed.", true);

  const rollbackHarnessProfile = async (providerKey: string, revision: number) =>
    withAction(async () => {
      const response = await rollbackHarnessProfileRequest(providerKey, revision, instanceId);
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
    if (newProvider.providerClass !== "oauth_account" && !newProvider.endpointBaseUrl.trim()) {
      setError("An endpoint URL is required for OpenAI-compatible, local, and custom providers.");
      return;
    }

    await withAction(async () => {
      const descriptor = getProviderClassDescriptor(newProvider.providerClass, supportedProviderClasses);
      await createProvider(
        {
          provider,
          label,
          provider_class: newProvider.providerClass,
          integration_class: newProvider.integrationClass.trim() || descriptor.integration_class,
          template_id: newProvider.templateId.trim() || descriptor.template_id || null,
          config: buildProviderConfig(newProvider, supportedProviderClasses),
        },
        instanceId,
      );
      setNewProvider(INITIAL_PROVIDER_DRAFT);
      await load();
    }, "Provider creation failed.");
  };

  const toggleProvider = async (provider: string, enabled: boolean) =>
    withAction(async () => {
      if (enabled) {
        await deactivateProvider(provider, instanceId);
      } else {
        await activateProvider(provider, instanceId);
      }
      await load();
    }, "Provider state update failed.", true);

  const syncProviderModels = async (provider: string) =>
    withAction(async () => {
      await syncProviders(provider, instanceId);
      await load();
    }, "Provider sync failed.", true);

  const saveProvider = async (provider: string) => {
    if (!ensureMutationAllowed()) {
      return;
    }

    const draft = providerDrafts[provider];
    if (!draft) {
      setError("Provider draft is not available.");
      return;
    }

    const label = draft.label.trim();
    if (!label) {
      setError("Provider label is required.");
      return;
    }
    if (draft.providerClass !== "oauth_account" && !draft.endpointBaseUrl.trim()) {
      setError("An endpoint URL is required for OpenAI-compatible, local, and custom providers.");
      return;
    }

    await withAction(async () => {
      const descriptor = getProviderClassDescriptor(draft.providerClass, supportedProviderClasses);
      await updateProvider(
        provider,
        {
          label,
          provider_class: draft.providerClass,
          integration_class: draft.integrationClass.trim() || descriptor.integration_class,
          template_id: draft.templateId.trim() || descriptor.template_id || null,
          config: buildProviderConfig(draft, supportedProviderClasses),
        },
        instanceId,
      );
      await load();
    }, "Provider update failed.", true);
  };

  const saveProviderLabel = async (provider: string) => {
    if (!ensureMutationAllowed()) {
      return;
    }

    const currentDraft = providerDrafts[provider];
    if (currentDraft) {
      await saveProvider(provider);
      return;
    }

    const label = (providerLabelDrafts[provider] ?? "").trim();
    if (!label) {
      setError("Provider label is required.");
      return;
    }

    await withAction(async () => {
      await updateProvider(provider, { label }, instanceId);
      await load();
    }, "Provider label update failed.", true);
  };

  const syncAllProviders = async () =>
    withAction(async () => {
      await syncProviders(undefined, instanceId);
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
      }, instanceId);
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
      const response = await patchHealthConfig(patch, instanceId);
      setHealthConfig(response.config);
      await load();
    }, "Health config update failed.", true);

  const runHealthChecksAction = async () =>
    withAction(async () => {
      await runHealthChecks(instanceId);
      await load();
    }, "Health check run failed.", true);

  const exportHarness = async (redactSecrets: boolean) =>
    withAction(async () => {
      if (redactSecrets ? !ensureRedactedExportAllowed() : !ensureFullExportAllowed()) {
        return;
      }
      const response = await fetchHarnessExport(redactSecrets, instanceId);
      const formatted = JSON.stringify(response.snapshot, null, 2);
      setImportPayload(formatted);
      setOperationResult(formatted);
    }, "Harness export failed.");

  const importHarness = async (dryRun: boolean) =>
    withAction(async () => {
      const parsed = JSON.parse(importPayload) as Record<string, unknown>;
      const result = await importHarnessConfig(parsed, dryRun, instanceId);
      setOperationResult(JSON.stringify(result, null, 2));
      if (!dryRun) {
        await load();
      }
    }, "Harness import failed.", true);

  const syncOauthBridgeProfiles = async () =>
    withAction(async () => {
      const response = await syncOauthAccountBridgeProfiles(instanceId);
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "OAuth bridge sync failed.", true);

  const probeAllOauthTargets = async () =>
    withAction(async () => {
      const response = await probeAllOauthAccountProviders(instanceId);
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "OAuth probe failed.", true);

  const probeOauthTarget = async (providerKey: string) =>
    withAction(async () => {
      const response = await probeOauthAccountProvider(providerKey, instanceId);
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "OAuth probe failed.", true);

  const data: ProvidersPageData = {
    state,
    error,
    access,
    providers,
    supportedProviderClasses,
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
    providerDrafts,
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
    setProviderDraftField,
    setNewHarness,
    setProviderLabelDraft,
    runHarnessAction,
    probeHarnessProfile,
    toggleHarnessProfile,
    deleteHarnessProfile,
    rollbackHarnessProfile,
    createProvider: createProviderAction,
    saveProvider,
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
