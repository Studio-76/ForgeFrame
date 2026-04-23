import type {
  AdminSessionUser,
  GatewayAccount,
  InstanceRecord,
  ProviderControlItem,
  RuntimeKey,
} from "../../api/admin";
import {
  roleAllows,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasAnyInstancePermission,
} from "../../app/adminAccess";

export type ChecklistTone = "success" | "warning" | "danger" | "neutral";

export type BootstrapReadiness = {
  ready: boolean;
  checks: Array<Record<string, unknown>>;
  next_steps: string[];
  checked_at?: string;
};

export type OnboardingSignals = {
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

export type OnboardingAccessState = {
  badgeLabel: string;
  badgeTone: ChecklistTone;
  detail: string;
  canVerifyProviders: boolean;
  canIssueRuntimeAccess: boolean;
  canPersistOnboarding: boolean;
};

export type ChecklistLink = {
  label: string;
  to: string;
};

export type ChecklistStep = {
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

export const DEFAULT_GO_LIVE_RUNTIME_SCOPES = ["models:read", "chat:write", "responses:write"] as const;
export const ONBOARDING_METADATA_KEY = "onboarding_v4";

export type OnboardingInterviewState = {
  instanceId: string;
  displayName: string;
  description: string;
  tenantId: string;
  companyId: string;
  deploymentMode: InstanceRecord["deployment_mode"];
  exposureMode: InstanceRecord["exposure_mode"];
  operatingMode: "normative_public_https" | "limited_evaluation";
  postgresMode: "native_host" | "dedicated_container" | "external_managed";
  fqdn: string;
  dnsReady: boolean;
  port80Ready: boolean;
  port443Ready: boolean;
  tlsMode: "lets_encrypt" | "manual" | "self_signed" | "disabled";
  certificateStatus: "not_started" | "pending" | "issued" | "renewal_blocked" | "failed" | "manual";
  certificateAutoRenew: boolean;
  helperPort80Mode: "acme_redirect_only" | "minimal_redirect_only" | "not_available" | "unrestricted_http";
  providerDirection: "mixed_control_plane" | "oauth_account_providers" | "openai_compatible_clients" | "local_first";
  autonomyMode: "operator_assist" | "bounded_autonomy" | "autonomous_worker";
  routingDefault: "local_first" | "balanced" | "premium_capable";
  allowPremiumEscalation: boolean;
  runtimeDriverMode: "embedded_control_plane" | "remote_runtime_driver";
  edgeAdmissionMode: "disabled" | "enabled";
  workInteractionMode: "control_plane_only" | "ops_assistant" | "team_assistant" | "personal_assistant";
  inboxEnabled: boolean;
  tasksEnabled: boolean;
  notificationsEnabled: boolean;
  assistantMode: "none" | "ops" | "team" | "personal";
  firstSuccessAction: "provider_verification" | "runtime_request" | "artifact_review" | "operator_handoff";
  firstArtifact: "provider_preview" | "runtime_response" | "execution_trace" | "audit_evidence";
  operatorSurface: "dashboard" | "providers" | "usage" | "logs";
};

export type OnboardingBlocker = {
  code: string;
  tone: ChecklistTone;
  message: string;
};

export type OnboardingInterviewEvaluation = {
  tone: ChecklistTone;
  statusLabel: string;
  summary: string;
  detail: string;
  blockers: OnboardingBlocker[];
  normativeReady: boolean;
  persistable: boolean;
};

export const INITIAL_SIGNALS: OnboardingSignals = {
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

export function toStringValue(value: unknown, fallback = "-"): string {
  if (typeof value === "string") {
    return value || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

export function toBooleanValue(value: unknown): boolean {
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

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function humanizeToken(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.replace("T", " ").replace("Z", " UTC");
}

export function maxTimestamp(values: Array<string | null | undefined>): string | null {
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

export function recordTimestamp(value: Record<string, unknown> | null | undefined): string | null {
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

function readChoice<T extends string>(record: Record<string, unknown> | null, key: string, fallback: T): T {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value as T : fallback;
}

function readBoolean(record: Record<string, unknown> | null, key: string, fallback: boolean): boolean {
  if (!record || !(key in record)) {
    return fallback;
  }
  return toBooleanValue(record[key]);
}

function readString(record: Record<string, unknown> | null, key: string, fallback = ""): string {
  const value = record?.[key];
  return typeof value === "string" ? value : fallback;
}

function hasObservedEvidence(value: unknown): boolean {
  const record = asRecord(value);
  return record !== null && toStringValue(record.status, "") === "observed";
}

function getStoredOnboardingRecord(instance: InstanceRecord | null): Record<string, unknown> | null {
  return asRecord(instance?.metadata?.[ONBOARDING_METADATA_KEY]);
}

export function createOnboardingInterviewState(instance: InstanceRecord | null): OnboardingInterviewState {
  const stored = getStoredOnboardingRecord(instance);
  const inferredNormativeMode = instance?.deployment_mode === "linux_host_native" && instance.exposure_mode === "same_origin";

  return {
    instanceId: instance?.instance_id ?? "",
    displayName: instance?.display_name ?? "",
    description: instance?.description ?? "",
    tenantId: instance?.tenant_id ?? "",
    companyId: instance?.company_id ?? "",
    deploymentMode: instance?.deployment_mode ?? "linux_host_native",
    exposureMode: instance?.exposure_mode ?? "same_origin",
    operatingMode: readChoice(stored, "operating_mode", inferredNormativeMode ? "normative_public_https" : "limited_evaluation"),
    postgresMode: readChoice(stored, "postgres_mode", "native_host"),
    fqdn: readString(stored, "fqdn"),
    dnsReady: readBoolean(stored, "dns_ready", false),
    port80Ready: readBoolean(stored, "port_80_ready", false),
    port443Ready: readBoolean(stored, "port_443_ready", false),
    tlsMode: readChoice(stored, "tls_mode", inferredNormativeMode ? "lets_encrypt" : "disabled"),
    certificateStatus: readChoice(stored, "certificate_status", inferredNormativeMode ? "not_started" : "manual"),
    certificateAutoRenew: readBoolean(stored, "certificate_auto_renew", inferredNormativeMode),
    helperPort80Mode: readChoice(stored, "helper_port_80_mode", inferredNormativeMode ? "acme_redirect_only" : "not_available"),
    providerDirection: readChoice(stored, "provider_direction", "mixed_control_plane"),
    autonomyMode: readChoice(stored, "autonomy_mode", "bounded_autonomy"),
    routingDefault: readChoice(stored, "routing_default", "balanced"),
    allowPremiumEscalation: readBoolean(stored, "allow_premium_escalation", true),
    runtimeDriverMode: readChoice(stored, "runtime_driver_mode", "embedded_control_plane"),
    edgeAdmissionMode: readChoice(stored, "edge_admission_mode", instance?.exposure_mode === "edge_admission" ? "enabled" : "disabled"),
    workInteractionMode: readChoice(stored, "work_interaction_mode", "ops_assistant"),
    inboxEnabled: readBoolean(stored, "inbox_enabled", true),
    tasksEnabled: readBoolean(stored, "tasks_enabled", true),
    notificationsEnabled: readBoolean(stored, "notifications_enabled", true),
    assistantMode: readChoice(stored, "assistant_mode", "ops"),
    firstSuccessAction: readChoice(stored, "first_success_action", "provider_verification"),
    firstArtifact: readChoice(stored, "first_artifact", "provider_preview"),
    operatorSurface: readChoice(stored, "operator_surface", "providers"),
  };
}

export function buildOnboardingMetadata(state: OnboardingInterviewState): Record<string, unknown> {
  return {
    operating_mode: state.operatingMode,
    postgres_mode: state.postgresMode,
    fqdn: state.fqdn.trim(),
    dns_ready: state.dnsReady,
    port_80_ready: state.port80Ready,
    port_443_ready: state.port443Ready,
    tls_mode: state.tlsMode,
    certificate_status: state.certificateStatus,
    certificate_auto_renew: state.certificateAutoRenew,
    helper_port_80_mode: state.helperPort80Mode,
    provider_direction: state.providerDirection,
    autonomy_mode: state.autonomyMode,
    routing_default: state.routingDefault,
    allow_premium_escalation: state.allowPremiumEscalation,
    runtime_driver_mode: state.runtimeDriverMode,
    edge_admission_mode: state.edgeAdmissionMode,
    work_interaction_mode: state.workInteractionMode,
    inbox_enabled: state.inboxEnabled,
    tasks_enabled: state.tasksEnabled,
    notifications_enabled: state.notificationsEnabled,
    assistant_mode: state.assistantMode,
    first_success_action: state.firstSuccessAction,
    first_artifact: state.firstArtifact,
    operator_surface: state.operatorSurface,
  };
}

export function mergeOnboardingMetadata(
  existingMetadata: Record<string, unknown>,
  state: OnboardingInterviewState,
): Record<string, unknown> {
  return {
    ...existingMetadata,
    [ONBOARDING_METADATA_KEY]: buildOnboardingMetadata(state),
  };
}

export function formatOnboardingBlocker(blocker: OnboardingBlocker): string {
  return `${blocker.code}: ${blocker.message}`;
}

export function evaluateOnboardingInterview(state: OnboardingInterviewState): OnboardingInterviewEvaluation {
  const blockers: OnboardingBlocker[] = [];

  if (!state.displayName.trim()) {
    blockers.push({
      code: "display_name_missing",
      tone: "danger",
      message: "The first instance still has no display name.",
    });
  }

  if (!state.tenantId.trim()) {
    blockers.push({
      code: "tenant_scope_missing",
      tone: "danger",
      message: "The onboarding flow still has no tenant binding for the instance boundary.",
    });
  }

  if (!state.companyId.trim()) {
    blockers.push({
      code: "execution_scope_missing",
      tone: "danger",
      message: "The onboarding flow still has no execution scope binding.",
    });
  }

  if (state.workInteractionMode !== "control_plane_only" && !state.inboxEnabled) {
    blockers.push({
      code: "inbox_path_disabled",
      tone: "warning",
      message: "A work-interaction mode is selected, but inbox triage is disabled.",
    });
  }

  if (state.workInteractionMode !== "control_plane_only" && !state.tasksEnabled) {
    blockers.push({
      code: "task_path_disabled",
      tone: "warning",
      message: "A work-interaction mode is selected, but task follow-up is disabled.",
    });
  }

  if (state.assistantMode !== "none" && state.workInteractionMode === "control_plane_only") {
    blockers.push({
      code: "assistant_mode_without_work_interaction",
      tone: "warning",
      message: "Assistant specialization is selected without a corresponding work-interaction mode.",
    });
  }

  if (state.edgeAdmissionMode === "enabled" && state.exposureMode !== "edge_admission") {
    blockers.push({
      code: "edge_admission_mode_mismatch",
      tone: "danger",
      message: "Edge admission is selected, but the instance exposure mode is not `edge_admission`.",
    });
  }

  if (state.operatingMode === "limited_evaluation") {
    blockers.push({
      code: "limited_mode_selected",
      tone: "warning",
      message: "The instance is explicitly classified as a limited evaluation path instead of the normative public HTTPS stack.",
    });
  } else {
    if (state.deploymentMode !== "linux_host_native") {
      blockers.push({
        code: "linux_host_native_required",
        tone: "danger",
        message: "The normative path requires `linux_host_native` deployment mode.",
      });
    }

    if (state.exposureMode !== "same_origin") {
      blockers.push({
        code: "same_origin_required",
        tone: "danger",
        message: "The normative path requires same-origin UI and API exposure.",
      });
    }

    if (!state.fqdn.trim()) {
      blockers.push({
        code: "fqdn_missing",
        tone: "danger",
        message: "No public FQDN is recorded for the normative HTTPS path.",
      });
    }

    if (!state.dnsReady) {
      blockers.push({
        code: "dns_not_ready",
        tone: "danger",
        message: "DNS readiness is not recorded for the public FQDN.",
      });
    }

    if (!state.port80Ready) {
      blockers.push({
        code: "port_80_unreachable",
        tone: "danger",
        message: "Port 80 is not recorded as reachable for ACME or the minimal redirect helper.",
      });
    }

    if (!state.port443Ready) {
      blockers.push({
        code: "port_443_unreachable",
        tone: "danger",
        message: "Port 443 is not recorded as reachable for the primary HTTPS listener.",
      });
    }

    if (state.tlsMode !== "lets_encrypt") {
      blockers.push({
        code: "lets_encrypt_not_selected",
        tone: "danger",
        message: "The normative path requires automated Let's Encrypt certificate management.",
      });
    }

    if (state.certificateStatus !== "issued") {
      blockers.push({
        code: "certificate_not_issued",
        tone: "danger",
        message: "The certificate state is not recorded as issued and valid.",
      });
    }

    if (!state.certificateAutoRenew) {
      blockers.push({
        code: "certificate_auto_renew_disabled",
        tone: "danger",
        message: "Automatic certificate renewal is not recorded for the normative HTTPS path.",
      });
    }

    if (state.helperPort80Mode !== "acme_redirect_only" && state.helperPort80Mode !== "minimal_redirect_only") {
      blockers.push({
        code: "port_80_helper_not_restricted",
        tone: "danger",
        message: "Port 80 is not restricted to ACME and minimal redirect duties.",
      });
    }
  }

  const hasDanger = blockers.some((blocker) => blocker.tone === "danger");
  const persistable = state.displayName.trim().length > 0 && state.tenantId.trim().length > 0 && state.companyId.trim().length > 0;
  const normativeReady = state.operatingMode === "normative_public_https" && !hasDanger;

  if (!persistable) {
    return {
      tone: "danger",
      statusLabel: "Identity incomplete",
      summary: "The onboarding interview is still missing the minimum instance identity and scope truth.",
      detail: "ForgeFrame cannot persist a first instance boundary until display name, tenant scope, and execution scope are recorded.",
      blockers,
      normativeReady,
      persistable,
    };
  }

  if (normativeReady) {
    return {
      tone: "success",
      statusLabel: "Normative path recorded",
      summary: "The onboarding interview records the public HTTPS operating model required by the target image.",
      detail: `Instance ${state.displayName} is recorded as linux_host_native, same-origin, publicly exposed under ${state.fqdn.trim()} with Let's Encrypt and automated renewal.`,
      blockers,
      normativeReady,
      persistable,
    };
  }

  if (state.operatingMode === "limited_evaluation" && !hasDanger) {
    return {
      tone: "warning",
      statusLabel: "Limited mode recorded",
      summary: "The onboarding interview is persisted, but the instance remains outside the normative HTTPS sales path.",
      detail: "The instance is explicitly classified as limited evaluation. That keeps the deviation visible instead of reporting a false go-live green.",
      blockers,
      normativeReady,
      persistable,
    };
  }

  return {
    tone: hasDanger ? "danger" : "warning",
    statusLabel: hasDanger ? "Normative path blocked" : "Interview incomplete",
    summary: "The onboarding interview is saved, but the normative Linux and HTTPS operating path still has unresolved blockers.",
    detail: `Recorded operating mode: ${humanizeToken(state.operatingMode)}. Deployment: ${state.deploymentMode}. Exposure: ${state.exposureMode}.`,
    blockers,
    normativeReady,
    persistable,
  };
}

export function hasOauthTargetEvidence(target: Record<string, unknown>): boolean {
  const evidence = asRecord(target.evidence);
  if (!evidence) {
    return false;
  }
  return hasObservedEvidence(evidence.live_probe) || hasObservedEvidence(evidence.runtime);
}

export function hasProviderSetupSignal(provider: ProviderControlItem): boolean {
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

export function isLiveProviderProof(provider: ProviderControlItem): boolean {
  return provider.provider !== "forgeframe_baseline" && provider.ready && provider.runtime_readiness === "ready";
}

export function isGlobalRuntimeKey(key: RuntimeKey): boolean {
  return key.account_id === null;
}

function runtimeKeyHasScope(key: RuntimeKey, scope: string): boolean {
  return key.scopes.includes(scope);
}

export function isWriteCapableRuntimeKey(key: RuntimeKey): boolean {
  return runtimeKeyHasScope(key, "chat:write") || runtimeKeyHasScope(key, "responses:write");
}

export function isGoLiveRuntimeKey(key: RuntimeKey): boolean {
  return DEFAULT_GO_LIVE_RUNTIME_SCOPES.every((scope) => runtimeKeyHasScope(key, scope));
}

export function missingGoLiveScopes(key: RuntimeKey): string[] {
  return DEFAULT_GO_LIVE_RUNTIME_SCOPES.filter((scope) => !runtimeKeyHasScope(key, scope));
}

export function accountAllowsProvider(account: GatewayAccount | undefined, providerKey: string): boolean {
  if (!account) {
    return false;
  }
  return account.provider_bindings.length === 0 || account.provider_bindings.includes(providerKey);
}

export function getOnboardingAccess(session: AdminSessionUser | null, sessionReady: boolean): OnboardingAccessState {
  const canVerifyProviders = sessionCanMutateScopedOrAnyInstance(session, null, "providers.write");
  const canPersistOnboarding = sessionCanMutateScopedOrAnyInstance(session, null, "instance.write");
  const canIssueRuntimeAccess = Boolean(session)
    && !session?.read_only
    && roleAllows(session?.role, "admin");

  if (!sessionReady) {
    return {
      badgeLabel: "Checking permissions",
      badgeTone: "neutral",
      detail: "ForgeFrame is checking how much of the setup flow this session can run.",
      canVerifyProviders: false,
      canIssueRuntimeAccess: false,
      canPersistOnboarding: false,
    };
  }

  if (!session) {
    return {
      badgeLabel: "Read only",
      badgeTone: "warning",
      detail: "Setup signals stay visible, but provider verification, runtime access issuance, and onboarding persistence require an authenticated operator or admin session.",
      canVerifyProviders: false,
      canIssueRuntimeAccess: false,
      canPersistOnboarding: false,
    };
  }

  if (session.read_only) {
    return {
      badgeLabel: "Read only session",
      badgeTone: "warning",
      detail: "Read-only sessions can inspect bootstrap, provider, runtime access, and onboarding posture, but they cannot persist changes or complete verification and issuance.",
      canVerifyProviders: false,
      canIssueRuntimeAccess: false,
      canPersistOnboarding: false,
    };
  }

  if (!sessionHasAnyInstancePermission(session, "providers.read") && !roleAllows(session.role, "admin")) {
    return {
      badgeLabel: "Viewer access",
      badgeTone: "warning",
      detail: "Viewer sessions can inspect the full checklist, but provider verification requires an operator or admin, and onboarding persistence plus runtime access issuance require an admin.",
      canVerifyProviders: false,
      canIssueRuntimeAccess: false,
      canPersistOnboarding: false,
    };
  }

  if (canPersistOnboarding && canIssueRuntimeAccess) {
    return {
      badgeLabel: "Admin setup actions enabled",
      badgeTone: "success",
      detail: "Standard admin sessions can persist onboarding truth, verify providers, and issue the first runtime account or key from the linked governance routes.",
      canVerifyProviders,
      canIssueRuntimeAccess,
      canPersistOnboarding,
    };
  }

  return {
    badgeLabel: "Operator setup with admin handoff",
    badgeTone: "warning",
    detail: "Standard operator sessions can verify providers and inspect onboarding posture, but the first instance mutation and runtime access issuance still require an admin handoff.",
    canVerifyProviders,
    canIssueRuntimeAccess: false,
    canPersistOnboarding,
  };
}

export function createStep(
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
