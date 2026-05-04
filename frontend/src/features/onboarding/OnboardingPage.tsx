import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createInstance,
  createRuntimeKey,
  fetchAccounts,
  fetchAgents,
  fetchBootstrapReadiness,
  fetchOauthOnboarding,
  fetchProviderControlPlane,
  fetchRoutingControlPlane,
  fetchRuntimeKeys,
  runRuntimeKeyFirstSuccessProbe,
  updateInstance,
  updateRoutingPolicy,
  type AgentSummary,
  type GatewayAccount,
  type ProviderControlItem,
  type RoutingPolicyRecord,
  type RuntimeKey,
  type RuntimeKeyFirstSuccessProbeRecord,
} from "../../api/domain";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import { PageHeader } from "../../components/ui/PageHeader";
import { InstanceScopeCard } from "../../components/InstanceScopeCard";
import { Button } from "../../components/ui/Button";
import { ActionBar } from "../../components/ui/ActionBar";
import {
  createOnboardingInterviewState,
  evaluateOnboardingInterview,
  formatTimestamp,
  getOnboardingAccess,
  getOperatingModelDescriptor,
  getStoredFirstSuccessProbe,
  hasProviderSetupSignal,
  humanizeToken,
  mergeOnboardingMetadata,
  toBooleanValue,
  toStringValue,
  type ChecklistTone,
  type OnboardingInterviewState,
  type WizardStepStatus,
} from "./helpers";
import { OnboardingContent } from "./sections";

type OnboardingSignals = {
  bootstrap: { ready: boolean; checks: Array<Record<string, unknown>>; checked_at?: string } | null;
  providers: ProviderControlItem[];
  oauthTargets: Array<Record<string, unknown>>;
  accounts: GatewayAccount[];
  keys: RuntimeKey[];
  routingPolicies: RoutingPolicyRecord[];
  agents: AgentSummary[];
  loaded: {
    bootstrap: boolean;
    providers: boolean;
    oauthTargets: boolean;
    accounts: boolean;
    keys: boolean;
    routing: boolean;
    agents: boolean;
  };
};

type ProviderConnectionRow = {
  provider: string;
  label: string;
  connectionStatus: "local" | "api-key" | "bridge-only" | "unsupported" | "onboarding-only";
  detail: string;
  tone: ChecklistTone;
};

type WizardStepDefinition = {
  id: string;
  title: string;
  done: boolean;
  blocked: boolean;
  summary: string;
  detail: string;
  blockers: string[];
  links: Array<{ label: string; to: string }>;
};

type RoutingPolicyTuple = Pick<
  RoutingPolicyRecord,
  "prefer_local" | "prefer_low_latency" | "allow_premium" | "allow_fallback" | "allow_escalation" | "execution_lane"
>;
type RoutingWizardChoice = "simple" | "non_simple";

const SIMPLE_POLICY_TUPLE: RoutingPolicyTuple = {
  prefer_local: true,
  prefer_low_latency: true,
  allow_premium: false,
  allow_fallback: true,
  allow_escalation: false,
  execution_lane: "sync_interactive",
};

const SIMPLE_MODE_NON_SIMPLE_POLICY_TUPLE: RoutingPolicyTuple = {
  prefer_local: true,
  prefer_low_latency: false,
  allow_premium: false,
  allow_fallback: true,
  allow_escalation: false,
  execution_lane: "queued_background",
};

const NON_SIMPLE_MODE_NON_SIMPLE_POLICY_TUPLE: RoutingPolicyTuple = {
  prefer_local: false,
  prefer_low_latency: false,
  allow_premium: true,
  allow_fallback: true,
  allow_escalation: true,
  execution_lane: "queued_background",
};

const ROUTING_DEFAULT_BY_CHOICE: Record<RoutingWizardChoice, OnboardingInterviewState["routingDefault"]> = {
  simple: "local_first",
  non_simple: "premium_capable",
};

function matchesRoutingPolicyTuple(
  policy: RoutingPolicyRecord | undefined,
  expected: RoutingPolicyTuple,
): boolean {
  if (!policy) {
    return false;
  }
  return policy.prefer_local === expected.prefer_local
    && policy.prefer_low_latency === expected.prefer_low_latency
    && policy.allow_premium === expected.allow_premium
    && policy.allow_fallback === expected.allow_fallback
    && policy.allow_escalation === expected.allow_escalation
    && policy.execution_lane === expected.execution_lane;
}

function routingChoiceFromPersistedDefault(
  value: OnboardingInterviewState["routingDefault"],
): RoutingWizardChoice | null {
  if (value === "local_first") {
    return "simple";
  }
  if (value === "premium_capable") {
    return "non_simple";
  }
  return null;
}

const INITIAL_SIGNALS: OnboardingSignals = {
  bootstrap: null,
  providers: [],
  oauthTargets: [],
  accounts: [],
  keys: [],
  routingPolicies: [],
  agents: [],
  loaded: {
    bootstrap: false,
    providers: false,
    oauthTargets: false,
    accounts: false,
    keys: false,
    routing: false,
    agents: false,
  },
};

function classifyProviderConnection(provider: ProviderControlItem): ProviderConnectionRow {
  if (provider.contract_classification === "unsupported") {
    return {
      provider: provider.provider,
      label: provider.label,
      connectionStatus: "unsupported",
      detail: provider.readiness_reason ?? "Provider remains unsupported for production runtime use.",
      tone: "danger",
    };
  }

  if (provider.contract_classification === "bridge-only") {
    return {
      provider: provider.provider,
      label: provider.label,
      connectionStatus: "bridge-only",
      detail: provider.readiness_reason ?? "OAuth bridge evidence exists, but this target is not promoted to native runtime-ready truth.",
      tone: "warning",
    };
  }

  if (provider.contract_classification === "onboarding-only") {
    return {
      provider: provider.provider,
      label: provider.label,
      connectionStatus: "onboarding-only",
      detail: provider.readiness_reason ?? "Target remains onboarding-only and does not satisfy go-live provider requirements.",
      tone: "warning",
    };
  }

  const auth = (provider.auth_mechanism ?? "").toLowerCase();
  if (auth.includes("internal") || auth.includes("local")) {
    return {
      provider: provider.provider,
      label: provider.label,
      connectionStatus: "local",
      detail: provider.ready
        ? "Local runtime path is connected and available."
        : (provider.readiness_reason ?? "Local runtime path exists but still lacks full readiness evidence."),
      tone: provider.ready ? "success" : "warning",
    };
  }

  return {
    provider: provider.provider,
    label: provider.label,
    connectionStatus: "api-key",
    detail: provider.ready
      ? "API-key or native credential runtime path is connected."
      : (provider.readiness_reason ?? "Credential-based provider exists but is not runtime-ready yet."),
    tone: provider.ready ? "success" : "warning",
  };
}

function deriveWizardSteps(definitions: WizardStepDefinition[]) {
  const firstIncompleteIndex = definitions.findIndex((step) => !step.done);
  return definitions.map((step, index) => {
    let status: WizardStepStatus = "done";
    if (!step.done) {
      if (index === firstIncompleteIndex) {
        status = step.blocked ? "blocked" : "current";
      } else if (step.blocked) {
        status = "blocked";
      } else {
        status = "skipped";
      }
    }
    return {
      id: step.id,
      title: step.title,
      status,
      summary: step.summary,
      detail: step.detail,
      blockers: step.blockers,
      links: step.links,
    };
  });
}

export function OnboardingPage() {
  const [signals, setSignals] = useState<OnboardingSignals>(INITIAL_SIGNALS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance, refresh } = useInstanceCatalog(instanceId);

  const [interview, setInterview] = useState<OnboardingInterviewState>(createOnboardingInterviewState(null));
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [routingChoice, setRoutingChoice] = useState<RoutingWizardChoice>("simple");
  const [routingChoiceDirty, setRoutingChoiceDirty] = useState(false);
  const [routingPending, setRoutingPending] = useState(false);
  const [routingError, setRoutingError] = useState("");
  const [routingMessage, setRoutingMessage] = useState("");
  const [routingIntentOverrides, setRoutingIntentOverrides] = useState<Record<string, RoutingWizardChoice>>({});

  const [issueKeyPending, setIssueKeyPending] = useState(false);
  const [issueKeyError, setIssueKeyError] = useState("");
  const [issueKeyMessage, setIssueKeyMessage] = useState("");
  const [issuedRuntimeToken, setIssuedRuntimeToken] = useState("");

  const [runtimeKeyTokenInput, setRuntimeKeyTokenInput] = useState("");
  const [firstSuccessPending, setFirstSuccessPending] = useState(false);
  const [firstSuccessError, setFirstSuccessError] = useState("");
  const [firstSuccessResult, setFirstSuccessResult] = useState<RuntimeKeyFirstSuccessProbeRecord | null>(null);
  const selectedInstanceId = selectedInstance?.instance_id ?? null;
  const selectedInstanceIdRef = useRef<string | null>(selectedInstanceId);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  useEffect(() => {
    const nextInterview = createOnboardingInterviewState(selectedInstance);
    const persistedRoutingChoice = routingChoiceFromPersistedDefault(nextInterview.routingDefault);
    const nextRoutingChoice = selectedInstance?.instance_id
      ? (routingIntentOverrides[selectedInstance.instance_id] ?? persistedRoutingChoice)
      : persistedRoutingChoice;
    setInterview(nextInterview);
    setSaveError("");
    setRoutingChoice(nextRoutingChoice ?? "simple");
    setRoutingChoiceDirty(false);
  }, [selectedInstance?.instance_id, selectedInstance?.updated_at]);

  useEffect(() => {
    selectedInstanceIdRef.current = selectedInstanceId;
  }, [selectedInstanceId]);

  useEffect(() => {
    setIssueKeyPending(false);
    setIssueKeyError("");
    setIssueKeyMessage("");
    setIssuedRuntimeToken("");
    setRuntimeKeyTokenInput("");
    setFirstSuccessPending(false);
    setFirstSuccessError("");
    setFirstSuccessResult(getStoredFirstSuccessProbe(selectedInstance));
  }, [selectedInstanceId]);

  const loadSignals = useCallback(async () => {
    setLoading(true);
    const agentScopeInstanceId = instanceId ?? selectedInstance?.instance_id ?? null;
    const requests: [
      Promise<{ status: string; ready: boolean; checks: Array<Record<string, unknown>>; checked_at?: string }>,
      Promise<{ status: "ok"; providers: ProviderControlItem[] }>,
      Promise<{ status: string; targets: Array<Record<string, unknown>> }>,
      Promise<{ status: string; accounts: GatewayAccount[] }>,
      Promise<{ status: string; keys: RuntimeKey[] }>,
      Promise<{ status: "ok"; policies: RoutingPolicyRecord[] }>,
      Promise<{ status: string; agents: AgentSummary[] }>,
    ] = [
      fetchBootstrapReadiness(),
      fetchProviderControlPlane(instanceId).then((payload) => ({ status: payload.status, providers: payload.providers })),
      fetchOauthOnboarding(instanceId),
      fetchAccounts(instanceId),
      fetchRuntimeKeys(instanceId),
      fetchRoutingControlPlane(instanceId).then((payload) => ({ status: payload.status, policies: payload.policies })),
      agentScopeInstanceId ? fetchAgents(agentScopeInstanceId) : Promise.resolve({ status: "ok", agents: [] }),
    ];

    const [
      bootstrapResult,
      providersResult,
      oauthResult,
      accountsResult,
      keysResult,
      routingResult,
      agentsResult,
    ] = await Promise.allSettled(requests);

    const nextSignals: OnboardingSignals = {
      bootstrap: bootstrapResult.status === "fulfilled"
        ? {
            ready: Boolean(bootstrapResult.value.ready),
            checks: bootstrapResult.value.checks ?? [],
            checked_at: bootstrapResult.value.checked_at,
          }
        : null,
      providers: providersResult.status === "fulfilled" ? providersResult.value.providers ?? [] : [],
      oauthTargets: oauthResult.status === "fulfilled" ? oauthResult.value.targets ?? [] : [],
      accounts: accountsResult.status === "fulfilled" ? accountsResult.value.accounts ?? [] : [],
      keys: keysResult.status === "fulfilled" ? keysResult.value.keys ?? [] : [],
      routingPolicies: routingResult.status === "fulfilled" ? routingResult.value.policies ?? [] : [],
      agents: agentsResult.status === "fulfilled" ? agentsResult.value.agents ?? [] : [],
      loaded: {
        bootstrap: bootstrapResult.status === "fulfilled",
        providers: providersResult.status === "fulfilled",
        oauthTargets: oauthResult.status === "fulfilled",
        accounts: accountsResult.status === "fulfilled",
        keys: keysResult.status === "fulfilled",
        routing: routingResult.status === "fulfilled",
        agents: agentsResult.status === "fulfilled",
      },
    };

    const failures = [
      bootstrapResult.status === "rejected" ? "Bootstrap readiness did not load." : "",
      providersResult.status === "rejected" ? "Provider control-plane truth did not load." : "",
      oauthResult.status === "rejected" ? "OAuth onboarding truth did not load." : "",
      accountsResult.status === "rejected" ? "Runtime account posture did not load." : "",
      keysResult.status === "rejected" ? "Runtime key posture did not load." : "",
      routingResult.status === "rejected" ? "Routing control-plane truth did not load." : "",
      agentsResult.status === "rejected" ? "Agent inventory did not load." : "",
    ].filter(Boolean);

    setSignals(nextSignals);
    setError(failures.join(" "));
    setLoading(false);
  }, [instanceId, selectedInstance?.instance_id]);

  useEffect(() => {
    void loadSignals();
  }, [loadSignals]);

  const access = getOnboardingAccess(session, sessionReady);
  const persistedInterview = useMemo(() => createOnboardingInterviewState(selectedInstance), [selectedInstance]);
  const interviewEvaluation = evaluateOnboardingInterview(interview);
  const persistedInterviewEvaluation = evaluateOnboardingInterview(persistedInterview);
  const operatingModelDescriptor = getOperatingModelDescriptor(interview.operatingModel);

  const providerRows = useMemo(() => {
    const eligibleProviders = signals.providers.filter(hasProviderSetupSignal);
    if (eligibleProviders.length === 0) {
      return [{
        provider: "none",
        label: "No configured provider",
        connectionStatus: "onboarding-only" as const,
        detail: "No provider target is configured yet for this instance scope.",
        tone: "warning" as const,
      }];
    }
    return eligibleProviders.map(classifyProviderConnection);
  }, [signals.providers]);

  const operatorAgent = useMemo(
    () => signals.agents.find((agent) => agent.is_default_operator && agent.status === "active") ?? null,
    [signals.agents],
  );

  const activeKeys = signals.keys.filter((key) => key.status === "active");
  const connectedProviderRows = providerRows.filter((item) => item.tone === "success" && (item.connectionStatus === "local" || item.connectionStatus === "api-key"));
  const providerReady = connectedProviderRows.length > 0;

  const simplePolicy = signals.routingPolicies.find((policy) => policy.classification === "simple");
  const nonSimplePolicy = signals.routingPolicies.find((policy) => policy.classification === "non_simple");
  const persistedRoutingChoice = selectedInstanceId
    ? (routingIntentOverrides[selectedInstanceId] ?? routingChoiceFromPersistedDefault(persistedInterview.routingDefault))
    : routingChoiceFromPersistedDefault(persistedInterview.routingDefault);
  const routingSimpleApplied = matchesRoutingPolicyTuple(simplePolicy, SIMPLE_POLICY_TUPLE)
    && matchesRoutingPolicyTuple(nonSimplePolicy, SIMPLE_MODE_NON_SIMPLE_POLICY_TUPLE);
  const routingNonSimpleApplied = matchesRoutingPolicyTuple(simplePolicy, SIMPLE_POLICY_TUPLE)
    && matchesRoutingPolicyTuple(nonSimplePolicy, NON_SIMPLE_MODE_NON_SIMPLE_POLICY_TUPLE);
  const routingChoiceFromPolicies = routingSimpleApplied
    ? "simple"
    : routingNonSimpleApplied
      ? "non_simple"
      : null;
  const effectiveRoutingChoice = routingChoiceDirty ? routingChoice : (persistedRoutingChoice ?? routingChoice);
  const routingChoiceApplied = !routingChoiceDirty && persistedRoutingChoice !== null && (
    persistedRoutingChoice === "simple" ? routingSimpleApplied : routingNonSimpleApplied
  );
  const routingSummary = routingChoiceDirty
    ? `${effectiveRoutingChoice === "simple" ? "simple local/low-cost" : "non-simple premium/OAuth"} selected (unsaved)`
    : persistedRoutingChoice
      ? `${effectiveRoutingChoice === "simple" ? "simple local/low-cost" : "non-simple premium/OAuth"} selected`
      : "No routing default persisted yet";
  const routingDetail = !persistedRoutingChoice
    ? "Persist a routing decision from this wizard step before go-live validation can trust backend routing truth."
    : routingChoiceApplied
      ? "Routing policies match the persisted mode."
      : routingChoiceFromPolicies && routingChoiceFromPolicies !== persistedRoutingChoice
        ? `Routing policies currently match ${routingChoiceFromPolicies}, but the persisted onboarding intent for this instance is ${persistedRoutingChoice}.`
        : "Routing policies are not yet aligned to the persisted mode.";

  const bootstrapChecks = signals.bootstrap?.checks ?? [];
  const bootstrapById = new Map(bootstrapChecks.map((check) => [toStringValue(check.id), Boolean(check.ok)]));
  const tlsRequiredChecks = [
    "public_fqdn_configured",
    "public_dns_resolution",
    "public_https_listener",
    "certificate_material",
    "tls_mode_classification",
    "tls_certificate_management",
  ];
  const tlsEvidenceBlockers = tlsRequiredChecks
    .filter((checkId) => bootstrapById.get(checkId) !== true)
    .map((checkId) => `${humanizeToken(checkId)} is not proven by bootstrap API evidence.`);
  const tlsEvidenceReady = signals.loaded.bootstrap && tlsEvidenceBlockers.length === 0;
  const tlsEvidenceCheckedAt = formatTimestamp(signals.bootstrap?.checked_at ?? null);

  const persistedOnboardingBlockers = selectedInstance
    ? persistedInterviewEvaluation.blockers.map((item) => `${item.code}: ${item.message}`)
    : [];
  const persistedOnboardingReady = Boolean(selectedInstance) && persistedInterviewEvaluation.normativeReady;
  const firstSuccessForSelectedInstance = selectedInstance && firstSuccessResult?.instance_id === selectedInstance.instance_id
    ? firstSuccessResult
    : null;
  const firstSuccessReady = Boolean(firstSuccessForSelectedInstance?.success);
  const goLiveReady = persistedOnboardingReady
    && Boolean(selectedInstance)
    && Boolean(operatorAgent)
    && providerReady
    && routingChoiceApplied
    && activeKeys.length > 0
    && tlsEvidenceReady
    && firstSuccessReady;

  const goLiveBlockers = [
    ...(!persistedOnboardingReady
      ? (persistedOnboardingBlockers.length > 0
        ? persistedOnboardingBlockers
        : ["Persisted onboarding truth is not normative public HTTPS ready for the selected instance."])
      : []),
    ...(!selectedInstance ? ["First instance is missing."] : []),
    ...(selectedInstance && !operatorAgent ? ["Default Operator agent is missing for this instance."] : []),
    ...(!providerReady ? ["Provider onboarding has no connected local/API-key runtime target yet."] : []),
    ...(!routingChoiceApplied ? ["Routing defaults are not aligned with the chosen simple/non-simple decision."] : []),
    ...(activeKeys.length === 0 ? ["No active runtime key exists."] : []),
    ...(!tlsEvidenceReady ? tlsEvidenceBlockers : []),
    ...(!firstSuccessReady ? ["First-success probe has not succeeded yet."] : []),
  ];

  const handleInterviewFieldChange = <K extends keyof OnboardingInterviewState>(field: K, value: OnboardingInterviewState[K]) => {
    setInterview((current) => ({ ...current, [field]: value }));
    setSaveError("");
    setSaveMessage("");
  };

  const handleRoutingChoiceChange = (value: RoutingWizardChoice) => {
    setRoutingChoice(value);
    setRoutingChoiceDirty(value !== persistedRoutingChoice);
    setRoutingError("");
    setRoutingMessage("");
  };

  const handleInterviewSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access.canPersistOnboarding) {
      return;
    }
    if (!interviewEvaluation.persistable) {
      setSaveError("Display name and required scope fields for the selected operating model are mandatory before persistence.");
      return;
    }

    const defaultScopeSeed = interview.instanceId.trim() || selectedInstance?.instance_id || "forgeframe-default";
    const tenantIdValue = interview.tenantId.trim() || selectedInstance?.tenant_id || defaultScopeSeed;
    const companyIdValue = interview.companyId.trim() || selectedInstance?.company_id || defaultScopeSeed;

    const payload = {
      display_name: interview.displayName.trim(),
      description: interview.description.trim(),
      tenant_id: tenantIdValue,
      company_id: companyIdValue,
      deployment_mode: interview.deploymentMode,
      exposure_mode: interview.exposureMode,
      metadata: mergeOnboardingMetadata(selectedInstance?.metadata ?? {}, interview),
    };

    setSavePending(true);
    setSaveError("");
    setSaveMessage("");
    try {
      const result = selectedInstance
        ? await updateInstance(selectedInstance.instance_id, payload)
        : await createInstance({
            instance_id: interview.instanceId.trim() ? interview.instanceId.trim() : null,
            ...payload,
          });
      await refresh();
      onInstanceChange(result.instance.instance_id);
      setSaveMessage(selectedInstance
        ? `Onboarding state for ${result.instance.display_name} saved.`
        : `First instance ${result.instance.display_name} created and onboarding state saved.`);
      await loadSignals();
    } catch (persistError) {
      setSaveError(persistError instanceof Error ? persistError.message : "Onboarding state could not be persisted.");
    } finally {
      setSavePending(false);
    }
  };

  const handleApplyRoutingChoice = async () => {
    if (!access.canConfigureRouting) {
      return;
    }
    const nextRoutingChoice = effectiveRoutingChoice;
    const nextRoutingDefault = ROUTING_DEFAULT_BY_CHOICE[nextRoutingChoice];
    setRoutingPending(true);
    setRoutingError("");
    setRoutingMessage("");
    try {
      if (nextRoutingChoice === "simple") {
        await updateRoutingPolicy("simple", SIMPLE_POLICY_TUPLE, instanceId);
        await updateRoutingPolicy("non_simple", SIMPLE_MODE_NON_SIMPLE_POLICY_TUPLE, instanceId);
        setRoutingMessage("Routing defaults saved as simple (local/low-cost first).");
      } else {
        await updateRoutingPolicy("simple", SIMPLE_POLICY_TUPLE, instanceId);
        await updateRoutingPolicy("non_simple", NON_SIMPLE_MODE_NON_SIMPLE_POLICY_TUPLE, instanceId);
        setRoutingMessage("Routing defaults saved as non-simple (premium/OAuth capable).");
      }
      if (selectedInstance) {
        await updateInstance(selectedInstance.instance_id, {
          metadata: mergeOnboardingMetadata(selectedInstance.metadata ?? {}, {
            ...persistedInterview,
            routingDefault: nextRoutingDefault,
          }),
        });
        setRoutingIntentOverrides((current) => ({
          ...current,
          [selectedInstance.instance_id]: nextRoutingChoice,
        }));
      }
      setInterview((current) => ({
        ...current,
        routingDefault: nextRoutingDefault,
      }));
      await loadSignals();
      setRoutingChoice(nextRoutingChoice);
      setRoutingChoiceDirty(false);
    } catch (routingUpdateError) {
      setRoutingError(routingUpdateError instanceof Error ? routingUpdateError.message : "Routing defaults could not be saved.");
    } finally {
      setRoutingPending(false);
    }
  };

  const handleIssueRuntimeKey = async () => {
    if (!access.canIssueRuntimeAccess) {
      return;
    }
    const scopeInstanceId = selectedInstanceIdRef.current;
    setIssueKeyPending(true);
    setIssueKeyError("");
    setIssueKeyMessage("");
    try {
      const issued = await createRuntimeKey(instanceId, {
        label: "Onboarding First Success Key",
        scopes: ["models:read", "chat:write", "responses:write"],
      });
      if (selectedInstanceIdRef.current !== scopeInstanceId) {
        return;
      }
      setIssuedRuntimeToken(issued.issued.token);
      setRuntimeKeyTokenInput(issued.issued.token);
      setIssueKeyMessage("Runtime key issued. Secret is shown once here for first-success probing.");
      await loadSignals();
    } catch (issueError) {
      if (selectedInstanceIdRef.current !== scopeInstanceId) {
        return;
      }
      setIssueKeyError(issueError instanceof Error ? issueError.message : "Runtime key could not be issued.");
    } finally {
      if (selectedInstanceIdRef.current === scopeInstanceId) {
        setIssueKeyPending(false);
      }
    }
  };

  const handleRunFirstSuccessProbe = async () => {
    const token = runtimeKeyTokenInput.trim();
    if (!token) {
      setFirstSuccessError("Runtime key token is required for first-success probing.");
      return;
    }
    const scopeInstanceId = selectedInstanceIdRef.current;
    setFirstSuccessPending(true);
    setFirstSuccessError("");
    try {
      const result = await runRuntimeKeyFirstSuccessProbe(instanceId, {
        runtime_key: token,
        chat_probe: true,
      });
      await refresh();
      if (selectedInstanceIdRef.current !== scopeInstanceId) {
        return;
      }
      setFirstSuccessResult(result.probe);
      await loadSignals();
    } catch (probeError) {
      if (selectedInstanceIdRef.current !== scopeInstanceId) {
        return;
      }
      setFirstSuccessError(probeError instanceof Error ? probeError.message : "First-success probe failed.");
    } finally {
      if (selectedInstanceIdRef.current === scopeInstanceId) {
        setFirstSuccessPending(false);
      }
    }
  };

  const steps = deriveWizardSteps([
    {
      id: "operating-model",
      title: "Operating model and scope",
      done: persistedOnboardingReady,
      blocked: Boolean(selectedInstance) ? !persistedOnboardingReady : !access.canPersistOnboarding,
      summary: selectedInstance ? persistedInterviewEvaluation.summary : operatingModelDescriptor.label,
      detail: selectedInstance
        ? persistedInterviewEvaluation.detail
        : `Internal mode ${operatingModelDescriptor.internalMode}; tenant requirement ${operatingModelDescriptor.tenantRequirement}.`,
      blockers: selectedInstance ? persistedOnboardingBlockers : interviewEvaluation.blockers.map((item) => `${item.code}: ${item.message}`),
      links: [{ label: "Open setup progress", to: CONTROL_PLANE_ROUTES.dashboard }],
    },
    {
      id: "instance-operator",
      title: "First instance and Operator agent",
      done: Boolean(selectedInstance) && Boolean(operatorAgent),
      blocked: Boolean(selectedInstance) && signals.loaded.agents && !operatorAgent,
      summary: selectedInstance ? `Instance ${selectedInstance.display_name}` : "No instance selected",
      detail: operatorAgent
        ? `Default operator found: ${operatorAgent.display_name}.`
        : "Default operator product object is still missing.",
      blockers: selectedInstance && !operatorAgent ? ["Default Operator agent must exist for this instance."] : [],
      links: [
        { label: "Open Instances", to: CONTROL_PLANE_ROUTES.instances },
        { label: "Open Agents", to: CONTROL_PLANE_ROUTES.agents },
      ],
    },
    {
      id: "provider-targets",
      title: "Connect provider target",
      done: providerReady,
      blocked: !Boolean(selectedInstance),
      summary: providerReady ? "Connected provider target present" : "No connected local/API-key provider target yet",
      detail: `${providerRows.length} provider classifications loaded from control-plane truth.`,
      blockers: providerReady ? [] : ["At least one local or API-key provider target must be runtime-ready."],
      links: [
        { label: "Open Providers", to: CONTROL_PLANE_ROUTES.providers },
        { label: "Open Provider Targets", to: CONTROL_PLANE_ROUTES.providerTargets },
      ],
    },
    {
      id: "routing-defaults",
      title: "Routing simple/non-simple",
      done: routingChoiceApplied,
      blocked: !signals.loaded.routing || !access.canConfigureRouting || !routingChoiceApplied,
      summary: routingSummary,
      detail: routingDetail,
      blockers: routingChoiceApplied ? [] : [access.canConfigureRouting ? "Apply routing defaults from this wizard step." : "Routing defaults need an operator/admin handoff."],
      links: [{ label: "Open Routing", to: CONTROL_PLANE_ROUTES.routing }],
    },
    {
      id: "runtime-key",
      title: "Issue runtime key",
      done: activeKeys.length > 0,
      blocked: !access.canIssueRuntimeAccess && activeKeys.length === 0,
      summary: `${activeKeys.length} active runtime key(s)`,
      detail: activeKeys.length > 0
        ? "Runtime key inventory is active for this instance."
        : "Issue the first runtime key from onboarding.",
      blockers: activeKeys.length === 0 ? [access.canIssueRuntimeAccess ? "No active runtime key exists yet." : "Runtime key issuance needs an admin session."] : [],
      links: [{ label: "Open API Keys", to: CONTROL_PLANE_ROUTES.apiKeys }],
    },
    {
      id: "fqdn-tls",
      title: "FQDN/TLS API evidence",
      done: tlsEvidenceReady,
      blocked: !tlsEvidenceReady,
      summary: tlsEvidenceReady ? "FQDN/TLS checks proven by API evidence" : "FQDN/TLS evidence still missing",
      detail: tlsEvidenceCheckedAt ? `Last bootstrap evidence at ${tlsEvidenceCheckedAt}.` : "Bootstrap check timestamp is unavailable.",
      blockers: tlsEvidenceBlockers,
      links: [{ label: "Open Ingress TLS", to: CONTROL_PLANE_ROUTES.ingressTls }],
    },
    {
      id: "first-success",
      title: "First Success Probe",
      done: firstSuccessReady,
      blocked: !runtimeKeyTokenInput.trim() && !firstSuccessReady,
      summary: firstSuccessReady ? "Runtime probe succeeded" : "Runtime probe pending",
      detail: firstSuccessForSelectedInstance
        ? `Models probe: ${firstSuccessForSelectedInstance.models_probe.ok ? "ok" : "failed"}, chat probe: ${firstSuccessForSelectedInstance.chat_probe.ok ? "ok" : firstSuccessForSelectedInstance.chat_probe.attempted ? "failed" : "not attempted"}.`
        : "Run the probe with a runtime key token to confirm /v1/models or chat success.",
      blockers: firstSuccessReady ? [] : ["No successful first probe result is recorded yet."],
      links: [],
    },
    {
      id: "go-live",
      title: "Go-live summary",
      done: goLiveReady,
      blocked: !goLiveReady,
      summary: goLiveReady ? "Ready for go-live" : "Not ready for go-live",
      detail: goLiveReady
        ? "Wizard confirms instance, operator, provider, routing, runtime key, TLS evidence, and first-success runtime probe."
        : "Resolve the listed blockers before go-live handoff.",
      blockers: goLiveBlockers,
      links: [{ label: "Open Dashboard", to: CONTROL_PLANE_ROUTES.dashboard }],
    },
  ]);

  const completedSteps = steps.filter((step) => step.status === "done").length;
  const overallTone: ChecklistTone = goLiveReady ? "success" : "warning";

  return (
    <section className="fg-page">
      <PageHeader
        eyebrow="Setup"
        title="Guided setup checklist"
        description="Wizard-driven first go-live flow: operating model, first instance, operator agent, provider target, routing defaults, runtime key issuance, TLS evidence, and first success."
      />

      {/* ── Scope indicator ── */}
      {selectedInstance ? (
        <div className="flex items-center gap-2 px-1 py-1.5 mb-2 text-meta text-muted">
          <span className="font-medium">Scope:</span>
          <span className="text-primary">{selectedInstance.display_name ?? selectedInstance.instance_id}</span>
          <Button variant="navigation" density="compact" onPress={() => onInstanceChange(null)}>
            Change
          </Button>
        </div>
      ) : null}
      <div hidden={!!selectedInstance}>
        <InstanceScopeCard
          instanceId={instanceId}
          selectedInstance={selectedInstance}
          instances={instances}
          loadState={loadState}
          error={instancesError}
          surfaceLabel="onboarding wizard"
          onInstanceChange={onInstanceChange}
        />
      </div>
      <ActionBar
        title="Go-live handoffs"
        description="Use adjacent surfaces only when the wizard needs external evidence or a final release check."
      >
        <div className="fg-actions">
          <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.dashboard}>Setup progress</Link>
          <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.providers}>Providers</Link>
          <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.dashboard}>
            {goLiveReady ? "Dashboard (Go live)" : "Dashboard"}
          </Link>
        </div>
      </ActionBar>

      <OnboardingContent
        error={error}
        loading={loading}
        instanceId={instanceId}
        steps={steps}
        interview={interview}
        interviewEvaluation={interviewEvaluation}
        persistedInterviewEvaluation={persistedInterviewEvaluation}
        operatingModelDescriptor={operatingModelDescriptor}
        canPersistOnboarding={access.canPersistOnboarding}
        canConfigureRouting={access.canConfigureRouting}
        canIssueRuntimeAccess={access.canIssueRuntimeAccess}
        hasSelectedInstance={Boolean(selectedInstance)}
        savePending={savePending}
        saveError={saveError}
        saveMessage={saveMessage}
        onInterviewSave={handleInterviewSave}
        onInterviewFieldChange={handleInterviewFieldChange}
        operatorAgentLabel={operatorAgent?.display_name ?? null}
        providerRows={providerRows}
        routingChoice={effectiveRoutingChoice}
        routingPending={routingPending}
        routingError={routingError}
        routingMessage={routingMessage}
        onRoutingChoiceChange={handleRoutingChoiceChange}
        onApplyRoutingChoice={handleApplyRoutingChoice}
        runtimeKeyCount={activeKeys.length}
        issueKeyPending={issueKeyPending}
        issueKeyError={issueKeyError}
        issueKeyMessage={issueKeyMessage}
        issuedRuntimeToken={issuedRuntimeToken}
        onIssueRuntimeKey={handleIssueRuntimeKey}
        runtimeKeyTokenInput={runtimeKeyTokenInput}
        onRuntimeKeyTokenInputChange={setRuntimeKeyTokenInput}
        firstSuccessPending={firstSuccessPending}
        firstSuccessError={firstSuccessError}
        firstSuccessResult={firstSuccessForSelectedInstance}
        onRunFirstSuccessProbe={handleRunFirstSuccessProbe}
        tlsEvidenceReady={tlsEvidenceReady}
        tlsEvidenceCheckedAt={tlsEvidenceCheckedAt}
        tlsEvidenceBlockers={tlsEvidenceBlockers}
        goLiveSummary={goLiveReady
          ? "All onboarding wizard requirements are satisfied for go-live handoff."
          : "Go-live remains blocked until the wizard closes every required step with API evidence."}
        goLiveBlockers={goLiveBlockers}
      />
    </section>
  );
}
