import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchAccounts,
  fetchBootstrapReadiness,
  fetchOauthOnboarding,
  fetchProviderControlPlane,
  fetchRuntimeKeys,
  type AdminSessionUser,
  type GatewayAccount,
  type ProviderControlItem,
  type RuntimeKey,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getTenantIdFromSearchParams, withTenantScope } from "../app/tenantScope";
import { PageIntro } from "../components/PageIntro";

type ChecklistTone = "success" | "warning" | "danger" | "neutral";

type BootstrapReadiness = {
  ready: boolean;
  checks: Array<Record<string, unknown>>;
  next_steps: string[];
  checked_at?: string;
};

type OnboardingSignals = {
  bootstrap: BootstrapReadiness | null;
  providers: ProviderControlItem[];
  oauthTargets: Array<Record<string, unknown>>;
  accounts: GatewayAccount[];
  keys: RuntimeKey[];
  loaded: {
    bootstrap: boolean;
    providers: boolean;
    oauthTargets: boolean;
    accounts: boolean;
    keys: boolean;
  };
};

type OnboardingAccessState = {
  badgeLabel: string;
  badgeTone: ChecklistTone;
  detail: string;
  canVerifyProviders: boolean;
  canIssueRuntimeAccess: boolean;
};

type ChecklistLink = {
  label: string;
  to: string;
};

type ChecklistStep = {
  id: string;
  step: number;
  title: string;
  statusLabel: string;
  tone: ChecklistTone;
  summary: string;
  detail: string;
  blockers: string[];
  links: ChecklistLink[];
};

const DEFAULT_GO_LIVE_RUNTIME_SCOPES = ["models:read", "chat:write", "responses:write"] as const;

const INITIAL_SIGNALS: OnboardingSignals = {
  bootstrap: null,
  providers: [],
  oauthTargets: [],
  accounts: [],
  keys: [],
  loaded: {
    bootstrap: false,
    providers: false,
    oauthTargets: false,
    accounts: false,
    keys: false,
  },
};

function toStringValue(value: unknown, fallback = "-"): string {
  if (typeof value === "string") {
    return value || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function toBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function humanizeToken(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.replace("T", " ").replace("Z", " UTC");
}

function maxTimestamp(values: Array<string | null | undefined>): string | null {
  return values.reduce<string | null>((latest, value) => {
    if (!value) {
      return latest;
    }
    if (!latest || value > latest) {
      return value;
    }
    return latest;
  }, null);
}

function recordTimestamp(value: Record<string, unknown> | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const candidate = value.executed_at ?? value.checked_at ?? value.updated_at ?? value.created_at;
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function hasObservedEvidence(value: unknown): boolean {
  const record = asRecord(value);
  return record !== null && toStringValue(record.status, "") === "observed";
}

function hasOauthTargetEvidence(target: Record<string, unknown>): boolean {
  const evidence = asRecord(target.evidence);
  if (!evidence) {
    return false;
  }
  return hasObservedEvidence(evidence.live_probe) || hasObservedEvidence(evidence.runtime);
}

function hasProviderSetupSignal(provider: ProviderControlItem): boolean {
  return (
    provider.ready ||
    provider.enabled ||
    provider.runtime_readiness !== "planned" ||
    provider.last_sync_status !== "never" ||
    provider.model_count > 0 ||
    (provider.harness_profile_count ?? 0) > 0 ||
    (provider.harness_run_count ?? 0) > 0 ||
    (provider.harness_needs_attention_count ?? 0) > 0 ||
    (provider.oauth_failure_count ?? 0) > 0
  );
}

function isLiveProviderProof(provider: ProviderControlItem): boolean {
  return provider.provider !== "forgegate_baseline" && provider.ready && provider.runtime_readiness === "ready";
}

function isGlobalRuntimeKey(key: RuntimeKey): boolean {
  return key.account_id === null;
}

function runtimeKeyHasScope(key: RuntimeKey, scope: string): boolean {
  return key.scopes.includes(scope);
}

function isWriteCapableRuntimeKey(key: RuntimeKey): boolean {
  return runtimeKeyHasScope(key, "chat:write") || runtimeKeyHasScope(key, "responses:write");
}

function isGoLiveRuntimeKey(key: RuntimeKey): boolean {
  return DEFAULT_GO_LIVE_RUNTIME_SCOPES.every((scope) => runtimeKeyHasScope(key, scope));
}

function missingGoLiveScopes(key: RuntimeKey): string[] {
  return DEFAULT_GO_LIVE_RUNTIME_SCOPES.filter((scope) => !runtimeKeyHasScope(key, scope));
}

function accountAllowsProvider(account: GatewayAccount | undefined, providerKey: string): boolean {
  if (!account) {
    return false;
  }
  return account.provider_bindings.length === 0 || account.provider_bindings.includes(providerKey);
}

function getOnboardingAccess(session: AdminSessionUser | null, sessionReady: boolean): OnboardingAccessState {
  if (!sessionReady) {
    return {
      badgeLabel: "Checking permissions",
      badgeTone: "neutral",
      detail: "ForgeGate is checking how much of the setup flow this session can run.",
      canVerifyProviders: false,
      canIssueRuntimeAccess: false,
    };
  }

  if (!session) {
    return {
      badgeLabel: "Read only",
      badgeTone: "warning",
      detail: "Setup signals stay visible, but provider verification and runtime access issuance require an authenticated operator or admin session.",
      canVerifyProviders: false,
      canIssueRuntimeAccess: false,
    };
  }

  if (session.read_only) {
    return {
      badgeLabel: "Read only session",
      badgeTone: "warning",
      detail: "Read-only sessions can inspect bootstrap, provider, and runtime access posture, but provider verification and runtime access issuance still require a standard operator or admin session.",
      canVerifyProviders: false,
      canIssueRuntimeAccess: false,
    };
  }

  if (session.role === "viewer") {
    return {
      badgeLabel: "Viewer access",
      badgeTone: "warning",
      detail: "Viewer sessions can inspect the full checklist, but provider verification requires an operator or admin, and runtime access issuance requires an admin.",
      canVerifyProviders: false,
      canIssueRuntimeAccess: false,
    };
  }

  if (session.role === "admin") {
    return {
      badgeLabel: "Admin setup actions enabled",
      badgeTone: "success",
      detail: "Standard admin sessions can verify providers and issue the first runtime account or key from the linked governance routes.",
      canVerifyProviders: true,
      canIssueRuntimeAccess: true,
    };
  }

  return {
    badgeLabel: "Operator setup with admin handoff",
    badgeTone: "warning",
    detail: "Standard operator sessions can verify providers and review setup posture, but the first runtime account and key still require an admin handoff on Accounts and API Keys.",
    canVerifyProviders: true,
    canIssueRuntimeAccess: false,
  };
}

function createStep(
  step: number,
  title: string,
  statusLabel: string,
  tone: ChecklistTone,
  summary: string,
  detail: string,
  blockers: string[],
  links: ChecklistLink[],
): ChecklistStep {
  return {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    step,
    title,
    statusLabel,
    tone,
    summary,
    detail,
    blockers,
    links,
  };
}

export function OnboardingPage() {
  const [signals, setSignals] = useState<OnboardingSignals>(INITIAL_SIGNALS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const tenantId = getTenantIdFromSearchParams(searchParams);

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
        tenantId ? fetchProviderControlPlane(tenantId) : fetchProviderControlPlane(),
        fetchOauthOnboarding(tenantId),
        fetchAccounts(tenantId),
        fetchRuntimeKeys(tenantId),
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
  }, [tenantId]);

  const access = getOnboardingAccess(session, sessionReady);
  const bootstrapChecks = signals.bootstrap?.checks ?? [];
  const requiredBootstrapChecks = bootstrapChecks.filter((check) => toStringValue(check.id) !== "docker_host_hint");
  const failedBootstrapChecks = requiredBootstrapChecks.filter((check) => !toBooleanValue(check.ok));
  const bootstrapReady = Boolean(signals.bootstrap?.ready);
  const bootstrapCheckedAt = formatTimestamp(signals.bootstrap?.checked_at ?? null);

  const runtimeReadyProviders = signals.providers.filter((provider) => provider.ready && provider.runtime_readiness === "ready");
  const liveReadyProviders = runtimeReadyProviders.filter(isLiveProviderProof);
  const smokeOnlyReadyProviders = runtimeReadyProviders.filter((provider) => provider.provider === "forgegate_baseline");
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

  const liveTrafficReady = bootstrapReady && hasVerifiedProvider && hasProviderReachableGoLiveKey;

  const bootstrapBlockers = [
    ...(!signals.loaded.bootstrap ? ["Bootstrap readiness is unavailable in this heartbeat."] : []),
    ...failedBootstrapChecks.slice(0, 3).map((check) => `${humanizeToken(toStringValue(check.id))}: ${toStringValue(check.details)}`),
  ];

  const providerBlockers = [
    ...(!signals.loaded.providers ? ["Provider control-plane truth is unavailable."] : []),
    ...(!signals.loaded.oauthTargets ? ["OAuth onboarding target state is unavailable."] : []),
    ...(!hasVerifiedProvider && providerSignals.length === 0 && configuredOauthTargets.length === 0
      ? ["No provider verification signal is recorded yet. Open Providers & Harness to configure or verify the first live route."]
      : []),
    ...(!hasVerifiedProvider && smokeOnlyReadyProviders.length > 0
      ? ["ForgeGate baseline is runtime-ready for internal smoke checks, but it does not count as verified live provider coverage for go-live."]
      : []),
    ...signals.providers
      .filter((provider) => hasProviderSetupSignal(provider) && !isLiveProviderProof(provider))
      .slice(0, 2)
      .map((provider) => provider.provider === "forgegate_baseline"
        ? `${provider.label}: internal ForgeGate smoke path only; verify a real provider route before go-live.`
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

  const bootstrapStep = signals.loaded.bootstrap
    ? createStep(
        1,
        "Bootstrap readiness",
        bootstrapReady ? "Ready" : "Continue setup",
        bootstrapReady ? "success" : "warning",
        bootstrapReady
          ? "Required bootstrap checks passed for the current control-plane posture."
          : "Bootstrap prerequisites still need attention before ForgeGate should take live traffic.",
        `${requiredBootstrapChecks.length - failedBootstrapChecks.length}/${requiredBootstrapChecks.length || 0} required checks passed.${bootstrapCheckedAt ? ` Last checked ${bootstrapCheckedAt}.` : ""}`,
        bootstrapReady ? [] : bootstrapBlockers,
        [],
      )
    : createStep(
        1,
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
        2,
        "Provider verification",
        hasVerifiedProvider ? "Ready" : "Continue setup",
        hasVerifiedProvider ? "success" : "warning",
        hasVerifiedProvider
          ? "At least one provider route is verified for live runtime traffic."
          : smokeOnlyReadyProviders.length > 0
            ? "Only internal smoke routes are runtime-ready; a real provider still needs live verification."
            : "Provider onboarding is visible, but no route is ready for live traffic yet.",
        `${runtimeReadyProviders.length} runtime-ready provider routes, ${liveReadyProviders.length} eligible for live go-live proof. ${evidencedOauthTargets.length}/${configuredOauthTargets.length} configured OAuth/account targets have live probe or runtime evidence.${smokeOnlyReadyProviders.length > 0 ? " Internal smoke routes stay visible here, but they do not satisfy the live-provider proof required for go-live." : ""}${latestProviderEvidence ? ` Latest provider evidence ${latestProviderEvidence}.` : " No verify/probe evidence is recorded yet."}${access.canVerifyProviders ? "" : " This session can inspect provider truth, but verify/probe and bridge actions still require an operator or admin session on Providers & Harness."}`,
        hasVerifiedProvider ? providerBlockers.filter((item) => item.includes("unavailable")) : providerBlockers,
        [{ label: "Open Providers & Harness", to: CONTROL_PLANE_ROUTES.providers }],
      )
    : createStep(
        2,
        "Provider verification",
        "Signal unavailable",
        "danger",
        "Provider onboarding signals did not load in this heartbeat.",
        "The checklist cannot confirm current runtime/provider truth right now.",
        providerBlockers,
        [{ label: "Open Providers & Harness", to: CONTROL_PLANE_ROUTES.providers }],
      );

  const runtimeAccessStep = signals.loaded.accounts || signals.loaded.keys
    ? createStep(
        3,
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
        3,
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
    ...(!bootstrapReady ? ["Bootstrap prerequisites are still incomplete."] : []),
    ...(!hasVerifiedProvider ? [access.canVerifyProviders ? "Provider verification still needs to finish on Providers & Harness." : "Provider verification still needs an operator or admin handoff."] : []),
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
    4,
    "Go-live handoff",
    liveTrafficReady ? "Ready for runtime" : (!hasRuntimeAccess && !access.canIssueRuntimeAccess) || (!hasVerifiedProvider && !access.canVerifyProviders) ? "Handoff required" : "Continue setup",
    liveTrafficReady ? "success" : "warning",
    liveTrafficReady
      ? "ForgeGate is ready for live traffic from the current control-plane view."
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
      : !bootstrapReady
        ? "Bootstrap still depends on the documented repo bootstrap and validation scripts when the backend does not expose control-plane automation for that step yet."
        : !hasVerifiedProvider
          ? access.canVerifyProviders
            ? "Continue on Providers & Harness for preview, verify, probe, or bridge checks."
            : "Inspect provider truth here, then hand verification to an operator or admin on Providers & Harness."
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
      : !hasVerifiedProvider
        ? [{ label: "Open Providers & Harness", to: CONTROL_PLANE_ROUTES.providers }]
        : hasGoLiveRuntimeAccess && !hasProviderReachableGoLiveKey
          ? [
              { label: "Open Accounts", to: CONTROL_PLANE_ROUTES.accounts },
              { label: "Open API Keys", to: CONTROL_PLANE_ROUTES.apiKeys },
            ]
        : !hasGoLiveRuntimeAccess
          ? [{ label: activeAccounts.length > 0 ? "Open API Keys" : "Open Accounts", to: runtimeAccessRoute }]
          : [],
  );

  const steps = [bootstrapStep, providersStep, runtimeAccessStep, goLiveStep];
  const completedSteps = steps.filter((step) => step.tone === "success").length;
  const overallTone: ChecklistTone = liveTrafficReady ? "success" : loading ? "neutral" : "warning";

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Onboarding Setup Checklist"
        description="Bootstrap readiness, provider verification, runtime access issuance, and go-live handoff grounded in current backend truth."
        question="What needs setup?"
        links={[
          {
            label: "Setup Checklist",
            to: CONTROL_PLANE_ROUTES.onboarding,
            description: "Read the sequenced go-live checklist and current session handoff state.",
          },
          {
            label: "Providers & Harness",
            to: CONTROL_PLANE_ROUTES.providers,
            description: "Run preview, verify, probe, and bridge checks for live provider routes.",
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
              : "Use as the next operational destination once the checklist reaches go-live readiness.",
            badge: liveTrafficReady ? "Go live" : undefined,
          },
        ]}
        badges={[
          { label: access.badgeLabel, tone: access.badgeTone },
          { label: liveTrafficReady ? "Ready for runtime" : "Continue setup", tone: overallTone },
          ...(tenantId ? [{ label: `Tenant scope: ${tenantId}`, tone: "success" as const }] : []),
        ]}
        note={access.detail}
      />

      {error ? <p className="fg-danger">{error}</p> : null}

      {loading ? (
        <article className="fg-card">
          <h3>Loading setup signals</h3>
          <p className="fg-muted">ForgeGate is checking bootstrap readiness, provider verification, runtime access inventory, and the current session scope.</p>
        </article>
      ) : null}

      {!loading ? (
        <>
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Setup status</h3>
                <p className="fg-muted">
                  {liveTrafficReady
                    ? "The control plane has bootstrap, provider, and runtime access coverage to hand off into operations monitoring."
                    : "The checklist still exposes the next missing step or handoff instead of ending on raw onboarding lists."}
                </p>
              </div>
              <div className="fg-actions">
                <span className="fg-pill" data-tone={overallTone}>
                  {liveTrafficReady ? "Ready for live traffic" : `${completedSteps}/4 steps complete`}
                </span>
                {goLiveStep.links.map((link) => (
                  <Link key={link.label} className="fg-nav-link" to={withTenantScope(link.to, tenantId)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="fg-grid fg-grid-compact">
              <article className="fg-kpi">
                <span className="fg-muted">Checklist progress</span>
                <strong className="fg-kpi-value">{completedSteps}/4</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Runtime-ready providers</span>
                <strong className="fg-kpi-value">{signals.loaded.providers || signals.loaded.oauthTargets ? runtimeReadyProviders.length : "?"}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Active runtime keys</span>
                <strong className="fg-kpi-value">{signals.loaded.keys ? activeKeys.length : "?"}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Current session</span>
                <strong>{access.badgeLabel}</strong>
              </article>
            </div>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Sequenced setup checklist</h3>
                <p className="fg-muted">The order stays explicit: bootstrap first, then provider verification, then runtime access issuance, then the go-live handoff into operations.</p>
              </div>
            </div>

            <ol className="fg-checklist">
              {steps.map((step) => (
                <li key={step.id} className="fg-subcard fg-checklist-step">
                  <div className="fg-panel-heading">
                    <div className="fg-row">
                      <span className="fg-checklist-index" aria-hidden="true">
                        {step.step}
                      </span>
                      <div className="fg-checklist-copy">
                        <h4>{step.title}</h4>
                        <p className="fg-muted">{step.summary}</p>
                      </div>
                    </div>
                    <span className="fg-pill" data-tone={step.tone}>
                      {step.statusLabel}
                    </span>
                  </div>

                  <p className="fg-muted">{step.detail}</p>

                  {step.blockers.length > 0 ? (
                    <ul className="fg-list">
                      {step.blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  ) : null}

                  {step.links.length > 0 ? (
                    <div className="fg-actions">
                      {step.links.map((link) => (
                        <Link key={`${step.id}-${link.label}`} className="fg-nav-link" to={withTenantScope(link.to, tenantId)}>
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </article>
        </>
      ) : null}
    </section>
  );
}
