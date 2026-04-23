import { type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createInstance,
  fetchAccounts,
  fetchBootstrapReadiness,
  fetchOauthOnboarding,
  fetchProviderControlPlane,
  fetchRuntimeKeys,
  updateInstance,
} from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import { InstanceScopeCard } from "../../components/InstanceScopeCard";
import { PageIntro } from "../../components/PageIntro";
import {
  accountAllowsProvider,
  createOnboardingInterviewState,
  createStep,
  DEFAULT_GO_LIVE_RUNTIME_SCOPES,
  evaluateOnboardingInterview,
  formatOnboardingBlocker,
  formatTimestamp,
  getOnboardingAccess,
  hasOauthTargetEvidence,
  hasProviderSetupSignal,
  humanizeToken,
  INITIAL_SIGNALS,
  isGlobalRuntimeKey,
  isGoLiveRuntimeKey,
  isLiveProviderProof,
  isWriteCapableRuntimeKey,
  maxTimestamp,
  mergeOnboardingMetadata,
  missingGoLiveScopes,
  recordTimestamp,
  toBooleanValue,
  toStringArray,
  toStringValue,
  type ChecklistLink,
  type ChecklistTone,
  type OnboardingInterviewState,
  type OnboardingSignals,
} from "./helpers";
import { OnboardingContent } from "./sections";

function getOperatorSurfaceLink(surface: OnboardingInterviewState["operatorSurface"]): ChecklistLink {
  switch (surface) {
    case "dashboard":
      return { label: "Open Dashboard", to: CONTROL_PLANE_ROUTES.dashboard };
    case "usage":
      return { label: "Open Usage & Costs", to: CONTROL_PLANE_ROUTES.usage };
    case "logs":
      return { label: "Open Errors & Activity", to: CONTROL_PLANE_ROUTES.logs };
    case "providers":
    default:
      return { label: "Open Providers", to: CONTROL_PLANE_ROUTES.providers };
  }
}

function getFirstSuccessActionLink(action: OnboardingInterviewState["firstSuccessAction"]): ChecklistLink {
  switch (action) {
    case "runtime_request":
      return { label: "Open API Keys", to: CONTROL_PLANE_ROUTES.apiKeys };
    case "artifact_review":
      return { label: "Open Errors & Activity", to: CONTROL_PLANE_ROUTES.logs };
    case "operator_handoff":
      return { label: "Open Command Center", to: CONTROL_PLANE_ROUTES.dashboard };
    case "provider_verification":
    default:
      return { label: "Open Providers", to: CONTROL_PLANE_ROUTES.providers };
  }
}

function dedupeLinks(links: ChecklistLink[]): ChecklistLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}:${link.to}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function OnboardingPage() {
  const [signals, setSignals] = useState<OnboardingSignals>(INITIAL_SIGNALS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance, refresh } = useInstanceCatalog(instanceId);
  const [interview, setInterview] = useState<OnboardingInterviewState>(createOnboardingInterviewState(null));

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
    setInterview(createOnboardingInterviewState(selectedInstance));
    setSaveError("");
  }, [selectedInstance?.instance_id, selectedInstance?.updated_at]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [
        bootstrapResult,
        providersResult,
        oauthResult,
        accountsResult,
        keysResult,
      ] = await Promise.allSettled([
        fetchBootstrapReadiness(),
        fetchProviderControlPlane(instanceId),
        fetchOauthOnboarding(instanceId),
        fetchAccounts(instanceId),
        fetchRuntimeKeys(instanceId),
      ]);

      if (!mounted) {
        return;
      }

      const nextSignals: OnboardingSignals = {
        bootstrap: bootstrapResult.status === "fulfilled"
          ? {
              ready: Boolean(bootstrapResult.value.ready),
              checks: bootstrapResult.value.checks ?? [],
              next_steps: bootstrapResult.value.next_steps ?? [],
              checked_at: bootstrapResult.value.checked_at,
            }
          : null,
        providers: providersResult.status === "fulfilled" ? providersResult.value.providers ?? [] : [],
        oauthTargets: oauthResult.status === "fulfilled" ? oauthResult.value.targets ?? [] : [],
        accounts: accountsResult.status === "fulfilled" ? accountsResult.value.accounts ?? [] : [],
        keys: keysResult.status === "fulfilled" ? keysResult.value.keys ?? [] : [],
        loaded: {
          bootstrap: bootstrapResult.status === "fulfilled",
          providers: providersResult.status === "fulfilled",
          oauthTargets: oauthResult.status === "fulfilled",
          accounts: accountsResult.status === "fulfilled",
          keys: keysResult.status === "fulfilled",
        },
      };

      const failures = [
        bootstrapResult.status === "rejected" ? "Bootstrap readiness did not load." : "",
        providersResult.status === "rejected" ? "Provider control-plane truth did not load." : "",
        oauthResult.status === "rejected" ? "OAuth onboarding targets did not load." : "",
        accountsResult.status === "rejected" ? "Runtime account posture did not load." : "",
        keysResult.status === "rejected" ? "Runtime key posture did not load." : "",
      ].filter(Boolean);

      setSignals(nextSignals);
      setError(failures.join(" "));
      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const access = getOnboardingAccess(session, sessionReady);
  const interviewEvaluation = evaluateOnboardingInterview(interview);

  const handleInterviewFieldChange = <K extends keyof OnboardingInterviewState>(field: K, value: OnboardingInterviewState[K]) => {
    setInterview((current) => ({ ...current, [field]: value }));
    setSaveError("");
    setSaveMessage("");
  };

  const handleInterviewSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access.canPersistOnboarding) {
      return;
    }
    if (!interviewEvaluation.persistable) {
      setSaveError("Display name, tenant scope, and execution scope are mandatory before ForgeFrame can persist onboarding truth.");
      return;
    }

    const payload = {
      display_name: interview.displayName.trim(),
      description: interview.description.trim(),
      tenant_id: interview.tenantId.trim(),
      company_id: interview.companyId.trim(),
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
        ? `Onboarding truth for ${result.instance.display_name} saved.`
        : `First instance ${result.instance.display_name} created and onboarding truth saved.`);
    } catch (persistError) {
      setSaveError(persistError instanceof Error ? persistError.message : "Onboarding truth could not be persisted.");
    } finally {
      setSavePending(false);
    }
  };

  const bootstrapChecks = signals.bootstrap?.checks ?? [];
  const requiredBootstrapChecks = bootstrapChecks.filter((check) => toStringValue(check.id) !== "docker_host_hint");
  const failedBootstrapChecks = requiredBootstrapChecks.filter((check) => !toBooleanValue(check.ok));
  const bootstrapReady = Boolean(signals.bootstrap?.ready);
  const bootstrapCheckedAt = formatTimestamp(signals.bootstrap?.checked_at ?? null);

  const runtimeReadyProviders = signals.providers.filter((provider) => provider.ready && provider.runtime_readiness === "ready");
  const liveReadyProviders = runtimeReadyProviders.filter(isLiveProviderProof);
  const smokeOnlyReadyProviders = runtimeReadyProviders.filter((provider) => provider.provider === "forgeframe_baseline");
  const providerSignals = signals.providers.filter(hasProviderSetupSignal);
  const configuredOauthTargets = signals.oauthTargets.filter((target) => toBooleanValue(target.configured));
  const evidencedOauthTargets = configuredOauthTargets.filter(hasOauthTargetEvidence);
  const latestProviderEvidence = formatTimestamp(
    maxTimestamp(
      signals.providers.flatMap((provider) => [
        provider.last_sync_at,
        recordTimestamp(provider.oauth_last_probe ?? null),
        recordTimestamp(provider.oauth_last_bridge_sync ?? null),
        ...provider.models.flatMap((model) => [model.last_seen_at ?? null, model.last_probe_at ?? null]),
      ]),
    ),
  );
  const hasVerifiedProvider = liveReadyProviders.length > 0;

  const activeAccounts = signals.accounts.filter((account) => account.status === "active");
  const activeAccountIndex = new Map(activeAccounts.map((account) => [account.account_id, account]));
  const activeKeys = signals.keys.filter((key) => key.status === "active");
  const activeGlobalKeys = activeKeys.filter(isGlobalRuntimeKey);
  const goLiveRuntimeKeys = activeKeys.filter(isGoLiveRuntimeKey);
  const partialWriteRuntimeKeys = activeKeys.filter((key) => isWriteCapableRuntimeKey(key) && !isGoLiveRuntimeKey(key));
  const restrictedRuntimeKeys = activeKeys.filter((key) => !isGoLiveRuntimeKey(key));
  const leadingRestrictedRuntimeKey = restrictedRuntimeKeys[0] ?? null;
  const verifiedProviderKeys = liveReadyProviders.map((provider) => provider.provider);
  const providerReachableGoLiveKeys = goLiveRuntimeKeys.filter((key) => {
    const accountId = key.account_id;
    return accountId === null
      ? verifiedProviderKeys.length > 0
      : verifiedProviderKeys.some((providerKey) => accountAllowsProvider(activeAccountIndex.get(accountId), providerKey));
  });
  const blockedGoLiveKeys = goLiveRuntimeKeys.filter((key) => !providerReachableGoLiveKeys.includes(key));
  const leadingBlockedGoLiveKey = blockedGoLiveKeys[0] ?? null;
  const runtimeAccessRoute = CONTROL_PLANE_ROUTES.apiKeys;
  const latestAccessUpdate = formatTimestamp(
    maxTimestamp([
      ...signals.accounts.map((account) => account.updated_at),
      ...signals.keys.map((key) => key.updated_at),
      ...signals.keys.map((key) => key.last_used_at ?? null),
    ]),
  );
  const hasRuntimeAccess = activeKeys.length > 0;
  const hasGoLiveRuntimeAccess = goLiveRuntimeKeys.length > 0;
  const hasProviderReachableGoLiveKey = providerReachableGoLiveKeys.length > 0;

  const interviewBlockers = interviewEvaluation.blockers.map(formatOnboardingBlocker);
  const liveTrafficReady = interviewEvaluation.normativeReady && bootstrapReady && hasVerifiedProvider && hasProviderReachableGoLiveKey;

  const bootstrapBlockers = [
    ...(!signals.loaded.bootstrap ? ["Bootstrap readiness is unavailable in this heartbeat."] : []),
    ...failedBootstrapChecks.slice(0, 3).map((check) => `${humanizeToken(toStringValue(check.id))}: ${toStringValue(check.details)}`),
  ];

  const providerBlockers = [
    ...(!signals.loaded.providers ? ["Provider control-plane truth is unavailable."] : []),
    ...(!signals.loaded.oauthTargets ? ["OAuth onboarding target state is unavailable."] : []),
    ...(!hasVerifiedProvider && providerSignals.length === 0 && configuredOauthTargets.length === 0
      ? ["No provider verification signal is recorded yet. Open Providers or Harness to configure, verify, or probe the first live route."]
      : []),
    ...(!hasVerifiedProvider && smokeOnlyReadyProviders.length > 0
      ? ["ForgeFrame baseline is runtime-ready for internal smoke checks, but it does not count as verified live provider coverage for go-live."]
      : []),
    ...signals.providers
      .filter((provider) => hasProviderSetupSignal(provider) && !isLiveProviderProof(provider))
      .slice(0, 2)
      .map((provider) => provider.provider === "forgeframe_baseline"
        ? `${provider.label}: internal ForgeFrame smoke path only; verify a real provider route before go-live.`
        : `${provider.label}: ${provider.readiness_reason ?? "verification is still incomplete."}`),
    ...signals.oauthTargets
      .filter((target) => toStringValue(target.readiness) !== "ready")
      .slice(0, 1)
      .flatMap((target) => {
        const nextSteps = toStringArray(target.next_steps);
        if (nextSteps.length === 0) {
          return [];
        }
        return [`${humanizeToken(toStringValue(target.provider_key))}: ${nextSteps[0]}`];
      }),
  ];

  const runtimeAccessBlockers = [
    ...(!signals.loaded.accounts ? ["Runtime account inventory is unavailable."] : []),
    ...(!signals.loaded.keys ? ["Runtime key inventory is unavailable."] : []),
    ...(!hasRuntimeAccess
      ? [activeAccounts.length > 0
        ? "No active runtime key exists yet. API Keys still shows the secret once at issuance; recovery is not implied later."
        : "No active runtime key exists yet. Issue a global key on API Keys, or create an account first only if the first key should be tied to a specific runtime identity."]
      : []),
    ...(hasRuntimeAccess && !hasGoLiveRuntimeAccess
      ? [
          partialWriteRuntimeKeys.length > 0
            ? "Active runtime keys exist, but no single key currently covers the default live route set (`models:read`, `chat:write`, `responses:write`)."
            : "Active runtime keys exist, but none currently permit live write traffic on `/v1/chat/completions` or `/v1/responses`.",
        ]
      : []),
    ...(hasRuntimeAccess && !hasGoLiveRuntimeAccess && leadingRestrictedRuntimeKey
      ? [`${leadingRestrictedRuntimeKey.label}: missing ${missingGoLiveScopes(leadingRestrictedRuntimeKey).join(", ")} for the default go-live route set.`]
      : []),
    ...(hasRuntimeAccess && !hasGoLiveRuntimeAccess && !access.canIssueRuntimeAccess
      ? ["This session can inspect runtime key coverage, but a standard admin session still has to widen scopes for the default go-live path."]
      : []),
    ...(!hasRuntimeAccess && !access.canIssueRuntimeAccess
      ? ["This session can inspect runtime access posture, but a standard admin session still has to complete issuance."]
      : []),
    ...(hasVerifiedProvider && hasGoLiveRuntimeAccess && !hasProviderReachableGoLiveKey
      ? ["Full-scope runtime keys exist, but none currently reach the verified live provider set through account provider bindings."]
      : []),
    ...(hasVerifiedProvider && hasGoLiveRuntimeAccess && !hasProviderReachableGoLiveKey && leadingBlockedGoLiveKey?.account_id
      ? [(() => {
          const account = activeAccountIndex.get(leadingBlockedGoLiveKey.account_id ?? "");
          if (!account) {
            return `${leadingBlockedGoLiveKey.label}: bound account is inactive or unavailable for the current provider reachability check.`;
          }
          const bindings = account.provider_bindings.length > 0 ? account.provider_bindings.join(", ") : "all providers";
          return `${leadingBlockedGoLiveKey.label}: account bindings allow ${bindings}, while the verified live provider set is ${verifiedProviderKeys.join(", ")}.`;
        })()]
      : []),
  ];

  const operatorSurfaceLink = getOperatorSurfaceLink(interview.operatorSurface);
  const firstSuccessActionLink = getFirstSuccessActionLink(interview.firstSuccessAction);
  const firstSuccessLinks = dedupeLinks([firstSuccessActionLink, operatorSurfaceLink]);

  let firstSuccessTone: ChecklistTone = "warning";
  let firstSuccessLabel = "Pending";
  let firstSuccessSummary = "";
  let firstSuccessDetail = "";

  if (interview.firstSuccessAction === "provider_verification") {
    const ready = hasVerifiedProvider;
    firstSuccessTone = ready ? "success" : signals.loaded.providers || signals.loaded.oauthTargets ? "warning" : "danger";
    firstSuccessLabel = ready ? "Provider proof ready" : "Provider proof pending";
    firstSuccessSummary = ready
      ? "The selected first success action is already backed by a verified live provider route."
      : "The selected first success action is still blocked by missing provider verification.";
    firstSuccessDetail = ready
      ? `${liveReadyProviders.length} live-ready provider route${liveReadyProviders.length === 1 ? "" : "s"} are recorded for the current instance.`
      : "Use the dedicated Providers and Harness modules to produce a real provider verification signal instead of leaving onboarding on descriptive UI alone.";
  } else if (interview.firstSuccessAction === "runtime_request") {
    const ready = bootstrapReady && hasVerifiedProvider && hasProviderReachableGoLiveKey;
    firstSuccessTone = ready ? "success" : signals.loaded.bootstrap && signals.loaded.providers && signals.loaded.keys ? "warning" : "danger";
    firstSuccessLabel = ready ? "Runtime request ready" : "Runtime request blocked";
    firstSuccessSummary = ready
      ? "The selected first success action can already send a live runtime request through the current provider and key posture."
      : "The selected first success action is still blocked by bootstrap, provider, or runtime access gaps.";
    firstSuccessDetail = ready
      ? `Bootstrap, provider verification, and at least one provider-reachable full-scope runtime key are already present.`
      : "A first runtime request is only real once bootstrap, a verified provider route, and a provider-reachable full-scope runtime key exist at the same time.";
  } else if (interview.firstSuccessAction === "artifact_review") {
    const ready = runtimeReadyProviders.length > 0 || activeKeys.length > 0;
    firstSuccessTone = ready ? "success" : signals.loaded.providers || signals.loaded.keys ? "warning" : "danger";
    firstSuccessLabel = ready ? "Artifact path visible" : "Artifact path pending";
    firstSuccessSummary = ready
      ? "The selected first success action already has enough runtime or access truth to produce a reviewable artifact."
      : "The selected first success action still lacks enough runtime or access truth to produce a real artifact.";
    firstSuccessDetail = ready
      ? `Runtime-ready providers: ${runtimeReadyProviders.length}. Active runtime keys: ${activeKeys.length}.`
      : "Without runtime-ready providers or active runtime keys, the first artifact remains a promise instead of a product path.";
  } else {
    const ready = signals.loaded.bootstrap || signals.loaded.providers || signals.loaded.keys;
    firstSuccessTone = ready ? "success" : "danger";
    firstSuccessLabel = ready ? "Operator handoff ready" : "Operator handoff blocked";
    firstSuccessSummary = ready
      ? "The selected first success action already has a visible operator surface for the first handoff."
      : "The selected first success action still lacks enough loaded truth for a real operator handoff.";
    firstSuccessDetail = ready
      ? `The chosen operator surface is ${interview.operatorSurface}, and the page already exposes live setup truth for that handoff.`
      : "The operator surface cannot become the first success action until setup truth loads.";
  }

  const interviewStep = createStep(
    1,
    "Guided onboarding truth",
    interviewEvaluation.statusLabel,
    interviewEvaluation.tone,
    interviewEvaluation.summary,
    `${interviewEvaluation.detail}${selectedInstance ? ` Current instance: ${selectedInstance.display_name}.` : " No instance exists yet; save will create the first instance boundary."}`,
    interviewBlockers,
    dedupeLinks([
      { label: "Open Instances", to: CONTROL_PLANE_ROUTES.instances },
      operatorSurfaceLink,
    ]),
  );

  const bootstrapStep = signals.loaded.bootstrap
    ? createStep(
        2,
        "Bootstrap readiness",
        bootstrapReady ? "Ready" : "Continue setup",
        bootstrapReady ? "success" : "warning",
        bootstrapReady
          ? "Required bootstrap checks passed for the current control-plane posture."
          : "Bootstrap prerequisites still need attention before ForgeFrame should take live traffic.",
        `${requiredBootstrapChecks.length - failedBootstrapChecks.length}/${requiredBootstrapChecks.length || 0} required checks passed.${bootstrapCheckedAt ? ` Last checked ${bootstrapCheckedAt}.` : ""}`,
        bootstrapReady ? [] : bootstrapBlockers,
        [],
      )
    : createStep(
        2,
        "Bootstrap readiness",
        "Signal unavailable",
        "danger",
        "Bootstrap readiness did not load in this heartbeat.",
        "The checklist cannot confirm compose, storage, or observability bootstrap state right now.",
        bootstrapBlockers,
        [],
      );

  const providersStep = signals.loaded.providers || signals.loaded.oauthTargets
    ? createStep(
        3,
        "Provider verification",
        hasVerifiedProvider ? "Ready" : "Continue setup",
        hasVerifiedProvider ? "success" : "warning",
        hasVerifiedProvider
          ? "At least one provider route is verified for live runtime traffic."
          : smokeOnlyReadyProviders.length > 0
            ? "Only internal smoke routes are runtime-ready; a real provider still needs live verification."
            : "Provider onboarding is visible, but no route is ready for live traffic yet.",
        `${runtimeReadyProviders.length} runtime-ready provider routes, ${liveReadyProviders.length} eligible for live go-live proof. ${evidencedOauthTargets.length}/${configuredOauthTargets.length} configured OAuth/account targets have live probe or runtime evidence.${smokeOnlyReadyProviders.length > 0 ? " Internal smoke routes stay visible here, but they do not satisfy the live-provider proof required for go-live." : ""}${latestProviderEvidence ? ` Latest provider evidence ${latestProviderEvidence}.` : " No verify/probe evidence is recorded yet."}${access.canVerifyProviders ? "" : " This session can inspect provider truth, but verify/probe and bridge actions still require an operator or admin session on Providers or Harness."}`,
        hasVerifiedProvider ? providerBlockers.filter((item) => item.includes("unavailable")) : providerBlockers,
        [
          { label: "Open Providers", to: CONTROL_PLANE_ROUTES.providers },
          { label: "Open Harness", to: CONTROL_PLANE_ROUTES.harness },
        ],
      )
    : createStep(
        3,
        "Provider verification",
        "Signal unavailable",
        "danger",
        "Provider onboarding signals did not load in this heartbeat.",
        "The checklist cannot confirm current runtime/provider truth right now.",
        providerBlockers,
        [
          { label: "Open Providers", to: CONTROL_PLANE_ROUTES.providers },
          { label: "Open Harness", to: CONTROL_PLANE_ROUTES.harness },
        ],
      );

  const runtimeAccessStep = signals.loaded.accounts || signals.loaded.keys
    ? createStep(
        4,
        "Runtime access issuance",
        hasGoLiveRuntimeAccess ? "Ready" : hasRuntimeAccess ? "Partial access" : access.canIssueRuntimeAccess ? "Continue setup" : "Admin handoff",
        hasGoLiveRuntimeAccess ? "success" : "warning",
        hasGoLiveRuntimeAccess
          ? "At least one runtime key covers the default runtime route scopes."
          : partialWriteRuntimeKeys.length > 0
            ? "Active runtime keys exist, but scope coverage is still partial."
            : hasRuntimeAccess
              ? "Active runtime keys exist, but none can send live write traffic yet."
              : access.canIssueRuntimeAccess
                ? "Runtime access still needs the first active key."
                : "Runtime access still needs an admin handoff.",
        `${activeAccounts.length} active runtime accounts. ${activeKeys.length} active runtime keys.${activeGlobalKeys.length > 0 ? ` ${activeGlobalKeys.length} global key${activeGlobalKeys.length === 1 ? " is" : "s are"} not bound to an account.` : ""}${hasGoLiveRuntimeAccess ? ` ${goLiveRuntimeKeys.length} key${goLiveRuntimeKeys.length === 1 ? "" : "s"} cover${goLiveRuntimeKeys.length === 1 ? "s" : ""} the default route set (${DEFAULT_GO_LIVE_RUNTIME_SCOPES.join(", ")}).` : partialWriteRuntimeKeys.length > 0 ? ` ${partialWriteRuntimeKeys.length} key${partialWriteRuntimeKeys.length === 1 ? "" : "s"} can reach some live write traffic, but scope coverage is still partial.` : hasRuntimeAccess ? " Active keys remain restricted away from live write traffic." : ""}${hasVerifiedProvider && hasGoLiveRuntimeAccess && !hasProviderReachableGoLiveKey ? " Current account provider bindings do not yet line up with the verified live provider set." : ""}${latestAccessUpdate ? ` Latest access evidence ${latestAccessUpdate}.` : ""}${hasGoLiveRuntimeAccess ? "" : hasRuntimeAccess ? access.canIssueRuntimeAccess ? " Use API Keys to widen scopes until one key covers models, chat, and responses traffic for the default go-live path." : " Inspect API Keys here, then hand scope widening to a standard admin session before go-live." : access.canIssueRuntimeAccess ? activeAccounts.length > 0 ? " Issue the first key on API Keys, or keep Accounts optional unless the key should be tied to a specific runtime identity." : " Issue the first global key on API Keys, or create an account first only if the first key should be account-bound." : " Inspect Accounts and API Keys here, then hand the final issuance step to a standard admin session."}`,
        hasGoLiveRuntimeAccess ? runtimeAccessBlockers.filter((item) => item.includes("unavailable")) : runtimeAccessBlockers,
        [
          { label: "Open Accounts", to: CONTROL_PLANE_ROUTES.accounts },
          { label: "Open API Keys", to: CONTROL_PLANE_ROUTES.apiKeys },
        ],
      )
    : createStep(
        4,
        "Runtime access issuance",
        "Signal unavailable",
        "danger",
        "Runtime access posture did not load in this heartbeat.",
        "The checklist cannot confirm current account or key issuance state right now.",
        runtimeAccessBlockers,
        [
          { label: "Open Accounts", to: CONTROL_PLANE_ROUTES.accounts },
          { label: "Open API Keys", to: CONTROL_PLANE_ROUTES.apiKeys },
        ],
      );

  const goLiveBlockers = [
    ...(!interviewEvaluation.normativeReady ? interviewBlockers : []),
    ...(!bootstrapReady ? ["Bootstrap prerequisites are still incomplete."] : []),
    ...(!hasVerifiedProvider ? [access.canVerifyProviders ? "Provider verification still needs to finish on Providers or Harness." : "Provider verification still needs an operator or admin handoff."] : []),
    ...(!hasGoLiveRuntimeAccess ? [hasRuntimeAccess ? "At least one active runtime key still needs the default go-live scopes (`models:read`, `chat:write`, `responses:write`)." : access.canIssueRuntimeAccess ? "Issue the first active runtime key before declaring go-live." : "A standard admin session still has to complete runtime access issuance."] : []),
    ...(hasVerifiedProvider && hasGoLiveRuntimeAccess && !hasProviderReachableGoLiveKey
      ? ["At least one full-scope runtime key must be able to reach a verified live provider through its current account bindings before go-live."]
      : []),
    ...(hasVerifiedProvider && hasGoLiveRuntimeAccess && !hasProviderReachableGoLiveKey && leadingBlockedGoLiveKey?.account_id
      ? [(() => {
          const account = activeAccountIndex.get(leadingBlockedGoLiveKey.account_id ?? "");
          if (!account) {
            return `${leadingBlockedGoLiveKey.label}: bound account is inactive or unavailable for the current provider reachability check.`;
          }
          const bindings = account.provider_bindings.length > 0 ? account.provider_bindings.join(", ") : "all providers";
          return `${leadingBlockedGoLiveKey.label}: account bindings allow ${bindings}, while the verified live provider set is ${verifiedProviderKeys.join(", ")}.`;
        })()]
      : []),
  ];

  const goLiveStep = createStep(
    5,
    "Go-live handoff",
    liveTrafficReady ? "Ready for runtime" : (!hasRuntimeAccess && !access.canIssueRuntimeAccess) || (!hasVerifiedProvider && !access.canVerifyProviders) ? "Handoff required" : "Continue setup",
    liveTrafficReady ? "success" : "warning",
    liveTrafficReady
      ? "ForgeFrame is ready for live traffic from the current control-plane view."
      : !interviewEvaluation.normativeReady
        ? "The normative public HTTPS product path is still blocked by missing or limited onboarding truth."
        : !bootstrapReady
          ? "Bootstrap still blocks the move from setup into operations."
          : !hasVerifiedProvider
            ? access.canVerifyProviders
              ? "Provider verification still blocks go-live."
              : "Provider verification needs a handoff before go-live."
            : hasGoLiveRuntimeAccess && !hasProviderReachableGoLiveKey
              ? "Provider-binding reachability still blocks go-live."
              : hasRuntimeAccess
                ? "Runtime key scope coverage still blocks go-live."
                : access.canIssueRuntimeAccess
                  ? "Runtime access issuance still blocks go-live."
                  : "Go-live needs an admin handoff before the first key can be issued.",
    liveTrafficReady
      ? "Leave setup and move into the dashboard or provider health monitoring instead of staying on static onboarding lists."
      : !interviewEvaluation.normativeReady
        ? "ForgeFrame must keep the deviation visible here until the onboarding interview records the normative Linux and HTTPS operating path."
        : !bootstrapReady
          ? "Bootstrap still depends on the documented repo bootstrap and validation scripts when the backend does not expose control-plane automation for that step yet."
        : !hasVerifiedProvider
          ? access.canVerifyProviders
              ? "Continue on Providers for runtime truth and on Harness for preview, verify, probe, or bridge checks."
              : "Inspect provider truth here, then hand verification to an operator or admin on Providers or Harness."
            : hasGoLiveRuntimeAccess && !hasProviderReachableGoLiveKey
              ? access.canIssueRuntimeAccess
                ? "Adjust Accounts and API Keys so one full-scope key can reach the verified live provider set, then return here for the final go-live call."
                : "Inspect Accounts and API Keys here, then hand provider-binding alignment to a standard admin session before declaring go-live."
              : hasRuntimeAccess
                ? access.canIssueRuntimeAccess
                  ? "Broaden one runtime key on API Keys until it covers models, chat, and responses traffic, then return here for the final go-live call."
                  : "Inspect API Keys here, then hand scope widening to a standard admin session before declaring go-live."
                : access.canIssueRuntimeAccess
                  ? "Finish Accounts and API Keys issuance, then return here for the final go-live call."
                  : "Inspect runtime access posture here, then hand issuance to a standard admin session before declaring go-live.",
    liveTrafficReady ? [] : goLiveBlockers,
    liveTrafficReady
      ? [
          { label: "Open Dashboard", to: CONTROL_PLANE_ROUTES.dashboard },
          { label: "Open Provider Health & Runs", to: CONTROL_PLANE_ROUTES.providerHealthRuns },
        ]
      : !interviewEvaluation.normativeReady
        ? dedupeLinks([
            { label: "Open Instances", to: CONTROL_PLANE_ROUTES.instances },
            operatorSurfaceLink,
          ])
        : !hasVerifiedProvider
          ? [
              { label: "Open Providers", to: CONTROL_PLANE_ROUTES.providers },
              { label: "Open Harness", to: CONTROL_PLANE_ROUTES.harness },
            ]
          : hasGoLiveRuntimeAccess && !hasProviderReachableGoLiveKey
            ? [
                { label: "Open Accounts", to: CONTROL_PLANE_ROUTES.accounts },
                { label: "Open API Keys", to: CONTROL_PLANE_ROUTES.apiKeys },
              ]
            : !hasGoLiveRuntimeAccess
              ? [{ label: activeAccounts.length > 0 ? "Open API Keys" : "Open Accounts", to: runtimeAccessRoute }]
              : [],
  );

  const steps = [interviewStep, bootstrapStep, providersStep, runtimeAccessStep, goLiveStep];
  const completedSteps = steps.filter((step) => step.tone === "success").length;
  const overallTone: ChecklistTone = liveTrafficReady
    ? "success"
    : loading
      ? "neutral"
      : interviewEvaluation.tone === "danger"
        ? "danger"
        : "warning";

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Guided Onboarding and Go-Live"
        description="Interview-backed onboarding truth for instance scope, Linux and HTTPS posture, provider verification, runtime access issuance, and the final go-live handoff."
        question="What still blocks a real first instance and a real public runtime path?"
        links={[
          {
            label: "Guided Onboarding",
            to: CONTROL_PLANE_ROUTES.onboarding,
            description: "Persist the onboarding interview, read current runtime truth, and close the remaining go-live blockers.",
          },
          {
            label: "Instances",
            to: CONTROL_PLANE_ROUTES.instances,
            description: "Review the canonical instance registry and top-level scope bindings.",
          },
          {
            label: "Providers",
            to: CONTROL_PLANE_ROUTES.providers,
            description: "Review live provider runtime truth, compatibility, and expansion posture.",
          },
          {
            label: "Harness",
            to: CONTROL_PLANE_ROUTES.harness,
            description: "Run preview, verify, probe, import/export, and proof checks for live provider routes.",
          },
          {
            label: "API Keys",
            to: runtimeAccessRoute,
            description: access.canIssueRuntimeAccess
              ? "Continue runtime access issuance from API Keys; Accounts stays optional unless the first key should be account-bound."
              : "Inspect runtime access posture here and hand the issuance step to an admin session.",
            badge: access.canIssueRuntimeAccess ? undefined : "Handoff",
          },
          {
            label: "Dashboard",
            to: CONTROL_PLANE_ROUTES.dashboard,
            description: liveTrafficReady
              ? "Leave setup and move into routine monitoring."
              : "Use as the next operational destination once the checklist reaches the normative go-live state.",
            badge: liveTrafficReady ? "Go live" : undefined,
          },
        ]}
        badges={[
          { label: access.badgeLabel, tone: access.badgeTone },
          { label: interviewEvaluation.statusLabel, tone: interviewEvaluation.tone },
          { label: liveTrafficReady ? "Ready for runtime" : "Normative path not ready", tone: overallTone },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
        ]}
        note={access.detail}
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="guided onboarding and go-live truth"
        onInstanceChange={onInstanceChange}
      />

      <OnboardingContent
        error={error}
        loading={loading}
        liveTrafficReady={liveTrafficReady}
        completedSteps={completedSteps}
        overallTone={overallTone}
        goLiveLinks={goLiveStep.links}
        runtimeReadyProviderCount={signals.loaded.providers || signals.loaded.oauthTargets ? runtimeReadyProviders.length : "?"}
        activeRuntimeKeyCount={signals.loaded.keys ? activeKeys.length : "?"}
        currentSessionLabel={access.badgeLabel}
        steps={steps}
        instanceId={instanceId}
        interview={interview}
        interviewEvaluation={interviewEvaluation}
        canPersistOnboarding={access.canPersistOnboarding}
        hasSelectedInstance={Boolean(selectedInstance)}
        savePending={savePending}
        saveError={saveError}
        saveMessage={saveMessage}
        onInterviewSave={handleInterviewSave}
        onInterviewFieldChange={handleInterviewFieldChange}
        firstSuccessTone={firstSuccessTone}
        firstSuccessLabel={firstSuccessLabel}
        firstSuccessSummary={firstSuccessSummary}
        firstSuccessDetail={firstSuccessDetail}
        firstSuccessLinks={firstSuccessLinks}
      />
    </section>
  );
}
