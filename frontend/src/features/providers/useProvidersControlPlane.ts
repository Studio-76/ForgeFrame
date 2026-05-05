import { useEffect, useState } from "react";

import {
  activateHarnessProfile,
  activateProvider,
  createProvider,
  deactivateHarnessProfile,
  deactivateProvider,
  deleteHarnessProfile as deleteHarnessProfileRequest,
  dryRunHarness as dryRunHarnessRequest,
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
  type HarnessRun,
  importHarnessConfig,
  patchHealthConfig,
  previewHarness as previewHarnessRequest,
  probeAllOauthAccountProviders,
  probeHarness as probeHarnessRequest,
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
  verifyHarnessProfile as verifyHarnessProfileRequest,
} from "../../api/domain";
import type {
  HarnessDraft,
  HarnessActionKind,
  HarnessActionResult,
  LoadState,
  ProviderDraft,
  ProviderEditorDraft,
  ProvidersActionFeedback,
  ProvidersAccessState,
  ProviderRunFilters,
  ProvidersPageActions,
  ProvidersPageData,
} from "./providersShared";

export type ProvidersControlPlaneOptions = {
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

type ActionRequirement = "read" | "operate" | "mutate";

type ProviderActionContext = {
  pendingKey: string;
  successMessage?: string;
};

function getActionError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatOperationPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  return JSON.stringify(payload, null, 2) ?? "";
}

function resolveHarnessActionStatus(run: HarnessRun | null | undefined, fallback: string): string {
  if (run?.status) {
    return run.status;
  }
  return fallback;
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
  const [actionFeedback, setActionFeedback] = useState<ProvidersActionFeedback | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProvidersPageData["providers"]>([]);
  const [supportedProviderClasses, setSupportedProviderClasses] = useState<ProviderClassDescriptor[]>(DEFAULT_PROVIDER_CLASS_OPTIONS);
  const [templates, setTemplates] = useState<ProvidersPageData["templates"]>([]);
  const [profiles, setProfiles] = useState<ProvidersPageData["profiles"]>([]);
  const [runs, setRuns] = useState<ProvidersPageData["runs"]>([]);
  const [runSummary, setRunSummary] = useState<Record<string, number>>({});
  const [runOps, setRunOps] = useState<ProvidersPageData["runOps"]>({});
  const [runFilters, setRunFilters] = useState<ProviderRunFilters>(INITIAL_RUN_FILTERS);
  const [operationResult, setOperationResult] = useState<string>("");
  const [lastHarnessAction, setLastHarnessAction] = useState<HarnessActionResult | null>(null);
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

  const ensureOperateAllowed = () => {
    if (access.canOperate) {
      return true;
    }

    setError(access.operateBlockedMessage);
    return false;
  };

  const ensureActionAllowed = (requirement: ActionRequirement) => {
    if (requirement === "mutate") {
      return ensureMutationAllowed();
    }
    if (requirement === "operate") {
      return ensureOperateAllowed();
    }
    if (access.canRead) {
      return true;
    }
    setError(access.summaryDetail);
    return false;
  };

  const getActionBlockedMessage = (requirement: ActionRequirement): string => {
    if (requirement === "mutate") {
      return access.mutationBlockedMessage;
    }
    if (requirement === "operate") {
      return access.operateBlockedMessage;
    }
    return access.summaryDetail;
  };

  const recordHarnessAction = (
    kind: HarnessActionKind,
    title: string,
    payload: unknown,
    options: {
      providerKey?: string;
      model?: string | null;
      status?: string;
      summary: string;
      error?: string | null;
      run?: HarnessRun | null;
    },
  ) => {
    setOperationResult(formatOperationPayload(payload));
    setLastHarnessAction({
      kind,
      title,
      providerKey: options.providerKey,
      model: options.model,
      status: options.status ?? "ok",
      summary: options.summary,
      capturedAt: new Date().toISOString(),
      error: options.error ?? null,
      run: options.run ?? null,
      payload,
    });
  };

  const clearScopedData = () => {
    setProviders([]);
    setActionFeedback(null);
    setPendingAction(null);
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
    setImportPayload("");
    setOperationResult("");
    setLastHarnessAction(null);
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
          ? Object.fromEntries(
            (usage.aggregations?.errors_by_provider ?? []).map((item) => [
              String(item.provider),
              Number(item.errors),
            ]),
          )
          : {},
      );
      setModelErrors(
        usage
          ? Object.fromEntries(
            (usage.aggregations?.errors_by_model ?? []).map((item) => [
              String(item.model),
              Number(item.errors),
            ]),
          )
          : {},
      );
      setIntegrationErrors(
        usage
          ? Object.fromEntries(
            (usage.aggregations?.errors_by_integration ?? []).map((item) => [
              String(item.integration_key),
              Number(item.errors),
            ]),
          )
          : {},
      );
      setProfileErrors(
        usage
          ? Object.fromEntries(
            (usage.aggregations?.errors_by_profile ?? []).map((item) => [
              String(item.profile_key),
              Number(item.errors),
            ]),
          )
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
      const message = getActionError(actionError, "Unknown provider loading error.");
      setState("error");
      setError(message);
      setActionFeedback({
        tone: "error",
        message: "Provider records could not be loaded.",
        detail: message,
      });
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

  const withAction = async <T>(
    task: () => Promise<T>,
    fallback: string,
    requirement: ActionRequirement = "read",
    onFailure?: (message: string) => void,
    context?: ProviderActionContext,
  ): Promise<T | undefined> => {
    if (!ensureActionAllowed(requirement)) {
      setActionFeedback({
        tone: "error",
        message: "This session cannot run that provider action.",
        detail: getActionBlockedMessage(requirement),
      });
      return;
    }

    setError(null);
    setActionFeedback(null);
    if (context) {
      setPendingAction(context.pendingKey);
    }
    try {
      const result = await task();
      if (context?.successMessage) {
        setActionFeedback({ tone: "success", message: context.successMessage });
      }
      return result;
    } catch (actionError) {
      const message = getActionError(actionError, fallback);
      setError(message);
      setActionFeedback({ tone: "error", message: fallback, detail: message });
      onFailure?.(message);
    } finally {
      if (context) {
        setPendingAction((current) => (current === context.pendingKey ? null : current));
      }
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

  const previewHarnessProfile = async (
    providerKey: string,
    model: string,
    message: string,
    stream = false,
  ) =>
    withAction(async () => {
      const response = await previewHarnessRequest({ provider_key: providerKey, model, message, stream }, instanceId);
      recordHarnessAction("preview", "Preview request", response, {
        providerKey,
        model,
        run: response.run ?? null,
        status: resolveHarnessActionStatus(response.run, "ok"),
        summary: `Preview rendered for ${providerKey} using ${model}.`,
      });
      await load();
    }, "Harness preview failed.", "read", (messageText) => {
      recordHarnessAction("preview", "Preview request", { error: messageText }, {
        providerKey,
        model,
        status: "failed",
        summary: `Preview failed for ${providerKey}.`,
        error: messageText,
      });
    });

  const dryRunHarnessProfile = async (
    providerKey: string,
    model: string,
    message: string,
    stream = false,
  ) =>
    withAction(async () => {
      const response = await dryRunHarnessRequest({ provider_key: providerKey, model, message, stream }, instanceId);
      recordHarnessAction("dry-run", "Dry-run request", response, {
        providerKey,
        model,
        run: response.run,
        status: resolveHarnessActionStatus(response.run, "ok"),
        summary: `Dry-run completed for ${providerKey} using ${model}.`,
        error: response.run.error ?? null,
      });
      await load();
    }, "Harness dry-run failed.", "operate", (messageText) => {
      recordHarnessAction("dry-run", "Dry-run request", { error: messageText }, {
        providerKey,
        model,
        status: "failed",
        summary: `Dry-run failed for ${providerKey}.`,
        error: messageText,
      });
    });

  const verifyHarnessProfileAction = async (providerKey: string, model?: string, testMessage?: string) =>
    withAction(async () => {
      const targetModel = model ?? profiles.find((item) => item.provider_key === providerKey)?.models[0] ?? "model-1";
      const response = await verifyHarnessProfileRequest(
        {
          provider_key: providerKey,
          model: targetModel,
          test_message: testMessage,
          include_preview: true,
        },
        instanceId,
      );
      recordHarnessAction("verify", "Verification run", response, {
        providerKey,
        model: targetModel,
        run: response.verification.run ?? null,
        status: response.verification.success ? resolveHarnessActionStatus(response.verification.run, "ok") : "failed",
        summary: response.verification.success
          ? `Verification passed for ${providerKey}.`
          : `Verification reported failures for ${providerKey}.`,
        error: response.verification.success ? null : "verification_failed",
      });
      await load();
    }, "Harness verification failed.", "operate", (messageText) => {
      recordHarnessAction("verify", "Verification run", { error: messageText }, {
        providerKey,
        model: model ?? null,
        status: "failed",
        summary: `Verification failed for ${providerKey}.`,
        error: messageText,
      });
    });

  const runHarnessAction = async (providerKey: string, model?: string) =>
    withAction(async () => {
      const targetModel = model ?? profiles.find((item) => item.provider_key === providerKey)?.models[0] ?? "model-1";
      const preview = await previewHarnessRequest({ provider_key: providerKey, model: targetModel, message: "preview", stream: false }, instanceId);
      const dry = await dryRunHarnessRequest({ provider_key: providerKey, model: targetModel, message: "dry-run", stream: false }, instanceId);
      const verify = await verifyHarnessProfileRequest({ provider_key: providerKey, model: targetModel }, instanceId);
      recordHarnessAction("preview-verify-bundle", "Legacy preview / dry-run / verify bundle", { preview, dry, verify }, {
        providerKey,
        model: targetModel,
        run: verify.verification.run ?? dry.run ?? preview.run ?? null,
        status: verify.verification.success ? "ok" : "failed",
        summary: `Preview, dry-run, and verification completed for ${providerKey}.`,
        error: verify.verification.success ? null : "verification_failed",
      });
      await load();
    }, "Harness action failed.", "operate", (messageText) => {
      recordHarnessAction("preview-verify-bundle", "Legacy preview / dry-run / verify bundle", { error: messageText }, {
        providerKey,
        model: model ?? null,
        status: "failed",
        summary: `Legacy harness bundle failed for ${providerKey}.`,
        error: messageText,
      });
    });

  const probeHarnessProfile = async (providerKey: string, model?: string) =>
    withAction(async () => {
      const targetModel = model ?? profiles.find((item) => item.provider_key === providerKey)?.models[0] ?? "model-1";
      const response = await probeHarnessRequest({ provider_key: providerKey, model: targetModel, message: "probe", stream: false }, instanceId);
      recordHarnessAction("probe", "Live probe", response, {
        providerKey,
        model: targetModel,
        run: response.run,
        status: resolveHarnessActionStatus(response.run, response.status_code < 400 ? "ok" : "failed"),
        summary: response.status_code < 400
          ? `Probe succeeded for ${providerKey}.`
          : `Probe returned HTTP ${response.status_code} for ${providerKey}.`,
        error: response.run.error ?? null,
      });
      await load();
    }, "Harness probe failed.", "operate", (messageText) => {
      recordHarnessAction("probe", "Live probe", { error: messageText }, {
        providerKey,
        model: model ?? null,
        status: "failed",
        summary: `Probe failed for ${providerKey}.`,
        error: messageText,
      });
    });

  const toggleHarnessProfile = async (providerKey: string, enabled: boolean) =>
    withAction(async () => {
      const response = enabled
        ? await deactivateHarnessProfile(providerKey, instanceId)
        : await activateHarnessProfile(providerKey, instanceId);
      recordHarnessAction(enabled ? "deactivate" : "activate", enabled ? "Deactivate profile" : "Activate profile", response.profile, {
        providerKey,
        status: "ok",
        summary: enabled ? `${providerKey} was deactivated.` : `${providerKey} was activated.`,
      });
      await load();
    }, "Harness profile update failed.", "mutate", (messageText) => {
      recordHarnessAction(enabled ? "deactivate" : "activate", enabled ? "Deactivate profile" : "Activate profile", { error: messageText }, {
        providerKey,
        status: "failed",
        summary: `Profile state change failed for ${providerKey}.`,
        error: messageText,
      });
    });

  const deleteHarnessProfile = async (providerKey: string) =>
    withAction(async () => {
      const response = await deleteHarnessProfileRequest(providerKey, instanceId);
      recordHarnessAction("delete", "Delete profile", response, {
        providerKey,
        status: "ok",
        summary: `${providerKey} was deleted.`,
      });
      await load();
    }, "Harness profile deletion failed.", "mutate");

  const rollbackHarnessProfile = async (providerKey: string, revision: number) =>
    withAction(async () => {
      const response = await rollbackHarnessProfileRequest(providerKey, revision, instanceId);
      recordHarnessAction("rollback", "Rollback profile", response.profile, {
        providerKey,
        status: "ok",
        summary: `${providerKey} was rolled back to revision ${revision}.`,
      });
      await load();
    }, "Harness rollback failed.", "mutate", (messageText) => {
      recordHarnessAction("rollback", "Rollback profile", { error: messageText, revision }, {
        providerKey,
        status: "failed",
        summary: `Rollback failed for ${providerKey}.`,
        error: messageText,
      });
    });

  const createProviderAction = async () => {
    if (!ensureMutationAllowed()) {
      return;
    }

    const provider = newProvider.provider.trim();
    const label = newProvider.label.trim();
    if (!provider || !label) {
      const message = "Provider key and label are required.";
      setError(message);
      setActionFeedback({ tone: "error", message });
      return;
    }
    if (newProvider.providerClass !== "oauth_account" && !newProvider.endpointBaseUrl.trim()) {
      const message = "An endpoint URL is required for OpenAI-compatible, local, and custom providers.";
      setError(message);
      setActionFeedback({ tone: "error", message });
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
    }, "Provider creation failed.", "mutate", undefined, {
      pendingKey: "create-provider",
      successMessage: `${label} was added. Enable it, sync models, then check Provider Targets if routing is still blocked.`,
    });
  };

  const toggleProvider = async (provider: string, enabled: boolean) =>
    withAction(async () => {
      if (enabled) {
        await deactivateProvider(provider, instanceId);
      } else {
        await activateProvider(provider, instanceId);
      }
      await load();
    }, "Provider state update failed.", "mutate", undefined, {
      pendingKey: `toggle-provider:${provider}`,
      successMessage: enabled ? `${provider} was disabled.` : `${provider} was enabled.`,
    });

  const syncProviderModels = async (provider: string) =>
    withAction(async () => {
      await syncProviders(provider, instanceId);
      await load();
    }, "Provider sync failed.", "mutate", undefined, {
      pendingKey: `sync-provider:${provider}`,
      successMessage: `${provider} model sync finished. Review ready targets before routing traffic.`,
    });

  const saveProvider = async (provider: string) => {
    if (!ensureMutationAllowed()) {
      return;
    }

    const draft = providerDrafts[provider];
    if (!draft) {
      const message = "Provider draft is not available.";
      setError(message);
      setActionFeedback({ tone: "error", message });
      return;
    }

    const label = draft.label.trim();
    if (!label) {
      const message = "Provider label is required.";
      setError(message);
      setActionFeedback({ tone: "error", message });
      return;
    }
    if (draft.providerClass !== "oauth_account" && !draft.endpointBaseUrl.trim()) {
      const message = "An endpoint URL is required for OpenAI-compatible, local, and custom providers.";
      setError(message);
      setActionFeedback({ tone: "error", message });
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
    }, "Provider update failed.", "mutate", undefined, {
      pendingKey: `save-provider:${provider}`,
      successMessage: `${label} settings were saved.`,
    });
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
      const message = "Provider label is required.";
      setError(message);
      setActionFeedback({ tone: "error", message });
      return;
    }

    await withAction(async () => {
      await updateProvider(provider, { label }, instanceId);
      await load();
    }, "Provider label update failed.", "mutate", undefined, {
      pendingKey: `save-provider:${provider}`,
      successMessage: `${label} label was saved.`,
    });
  };

  const syncAllProviders = async () =>
    withAction(async () => {
      await syncProviders(undefined, instanceId);
      await load();
    }, "Provider sync failed.", "mutate", undefined, {
      pendingKey: "sync-all-providers",
      successMessage: "All provider model syncs finished. Check the readiness cards for remaining repair work.",
    });

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
      const response = await upsertHarnessProfile(providerKey, {
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
      recordHarnessAction("save-profile", "Save harness profile", response.profile, {
        providerKey,
        status: "ok",
        summary: `Harness profile ${providerKey} was saved.`,
      });
      setNewHarness({
        ...INITIAL_HARNESS_DRAFT,
        template_id: newHarness.template_id || INITIAL_HARNESS_DRAFT.template_id,
        integration_class: newHarness.integration_class,
      });
      await load();
    }, "Harness profile save failed.", "mutate", (messageText) => {
      recordHarnessAction("save-profile", "Save harness profile", { error: messageText }, {
        providerKey,
        status: "failed",
        summary: `Saving harness profile ${providerKey} failed.`,
        error: messageText,
      });
    });
  };

  const updateHealth = async (patch: Partial<HealthConfig>) =>
    withAction(async () => {
      const response = await patchHealthConfig(patch, instanceId);
      setHealthConfig(response.config);
      await load();
    }, "Health config update failed.", "mutate");

  const runHealthChecksAction = async () =>
    withAction(async () => {
      await runHealthChecks(instanceId);
      await load();
    }, "Health check run failed.", "mutate", undefined, {
      pendingKey: "run-provider-health",
      successMessage: "Provider health checks finished. Attention badges now reflect the latest probe result.",
    });

  const exportHarness = async (redactSecrets: boolean) =>
    withAction(async () => {
      if (redactSecrets ? !ensureRedactedExportAllowed() : !ensureFullExportAllowed()) {
        return;
      }
      const response = await fetchHarnessExport(redactSecrets, instanceId);
      const formatted = formatOperationPayload(response.snapshot);
      setImportPayload(formatted);
      recordHarnessAction(redactSecrets ? "export-redacted" : "export-full", redactSecrets ? "Export redacted snapshot" : "Export full snapshot", response.snapshot, {
        status: "ok",
        summary: redactSecrets
          ? "Redacted harness snapshot exported into the diagnostics buffer."
          : "Full harness snapshot exported into the diagnostics buffer.",
      });
    }, "Harness export failed.");

  const importHarness = async (dryRun: boolean) =>
    withAction(async () => {
      const parsed = JSON.parse(importPayload) as Record<string, unknown>;
      const result = await importHarnessConfig(parsed, dryRun, instanceId);
      recordHarnessAction(dryRun ? "import-dry-run" : "import-apply", dryRun ? "Dry-run import" : "Apply import", result, {
        status: typeof result.status === "string" ? result.status : "ok",
        summary: dryRun ? "Import payload validated without applying changes." : "Import payload applied to harness profiles.",
      });
      if (!dryRun) {
        await load();
      }
    }, "Harness import failed.", "mutate", (messageText) => {
      recordHarnessAction(dryRun ? "import-dry-run" : "import-apply", dryRun ? "Dry-run import" : "Apply import", { error: messageText }, {
        status: "failed",
        summary: dryRun ? "Dry-run import failed." : "Import apply failed.",
        error: messageText,
      });
    });

  const syncOauthBridgeProfiles = async () =>
    withAction(async () => {
      const response = await syncOauthAccountBridgeProfiles(instanceId);
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "OAuth bridge sync failed.", "mutate");

  const probeAllOauthTargets = async () =>
    withAction(async () => {
      const response = await probeAllOauthAccountProviders(instanceId);
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "OAuth probe failed.", "operate");

  const probeOauthTarget = async (providerKey: string) =>
    withAction(async () => {
      const response = await probeOauthAccountProvider(providerKey, instanceId);
      setOperationResult(JSON.stringify(response, null, 2));
      await load();
    }, "OAuth probe failed.", "operate");

  const data: ProvidersPageData = {
    state,
    error,
    actionFeedback,
    pendingAction,
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
    lastHarnessAction,
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
    previewHarnessProfile,
    verifyHarnessProfile: verifyHarnessProfileAction,
    dryRunHarnessProfile,
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
