import type { Dispatch, SetStateAction } from "react";

import type { AdminSessionUser } from "../../api/admin";
import {
  roleAllows,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../../app/adminAccess";
import type {
  CompatibilityMatrixRow,
  HarnessRun,
  HarnessProfile,
  HarnessTemplate,
  HealthConfig,
  OpenAICompatibilitySignoffResponse,
  OauthOnboardingTarget,
  OauthTargetStatus,
  ProviderClassDescriptor,
  ProviderClassKey,
  ProviderCatalogEntry,
  ProviderCatalogSummary,
  ProviderControlItem,
  ProductAxisTarget,
} from "../../api/admin";

export type LoadState = "idle" | "loading" | "success" | "error";

/**
 * User-visible outcome for the last provider control-plane action.
 */
export type ProvidersActionFeedback = {
  tone: "success" | "error";
  message: string;
  detail?: string;
};

export type ProviderRunFilters = {
  mode: string;
  status: string;
  provider: string;
  client: string;
};

export type ProviderDraft = {
  provider: string;
  label: string;
  providerClass: ProviderClassKey;
  integrationClass: string;
  templateId: string;
  endpointBaseUrl: string;
  authScheme: string;
  oauthMode: string;
};

export type ProviderEditorDraft = {
  label: string;
  providerClass: ProviderClassKey;
  integrationClass: string;
  templateId: string;
  endpointBaseUrl: string;
  authScheme: string;
  oauthMode: string;
};

export type HarnessDraft = {
  provider_key: string;
  label: string;
  template_id: string;
  integration_class: HarnessProfile["integration_class"];
  endpoint_base_url: string;
  auth_scheme: HarnessProfile["auth_scheme"];
  auth_value: string;
  auth_header: string;
  models: string;
  stream_enabled: boolean;
};

export type BootstrapReadiness = {
  ready: boolean;
  checks: Array<Record<string, unknown>>;
  next_steps: string[];
};

export type ClientOpsRecord = Record<string, string | number | boolean>;
export type UnknownRecord = Record<string, unknown>;
export type ProvidersAccessBadgeTone = "success" | "warning" | "neutral";

export type ProvidersAccessState = {
  canRead: boolean;
  canOperate: boolean;
  canExportRedacted: boolean;
  canExportFull: boolean;
  canMutate: boolean;
  isBlocked: boolean;
  isReadOnly: boolean;
  isCheckingAccess: boolean;
  badgeLabel: string;
  badgeTone: ProvidersAccessBadgeTone;
  summaryTitle: string;
  summaryDetail: string;
  operateBlockedMessage: string;
  exportBlockedMessage: string;
  fullExportBlockedMessage: string;
  mutationBlockedMessage: string;
};

export type HarnessActionKind =
  | "preview"
  | "verify"
  | "dry-run"
  | "probe"
  | "activate"
  | "deactivate"
  | "delete"
  | "export-redacted"
  | "export-full"
  | "import-dry-run"
  | "import-apply"
  | "rollback"
  | "save-profile"
  | "preview-verify-bundle";

export type HarnessActionResult = {
  kind: HarnessActionKind;
  title: string;
  providerKey?: string;
  model?: string | null;
  status: string;
  summary: string;
  capturedAt: string;
  error?: string | null;
  run?: HarnessRun | null;
  payload?: unknown;
};

export type ProvidersPageData = {
  state: LoadState;
  error: string | null;
  actionFeedback: ProvidersActionFeedback | null;
  pendingAction: string | null;
  access: ProvidersAccessState;
  providers: ProviderControlItem[];
  supportedProviderClasses: ProviderClassDescriptor[];
  templates: HarnessTemplate[];
  profiles: HarnessProfile[];
  runs: HarnessRun[];
  runSummary: Record<string, number>;
  runOps: UnknownRecord;
  runFilters: ProviderRunFilters;
  operationResult: string;
  lastHarnessAction: HarnessActionResult | null;
  syncNote: string;
  healthConfig: HealthConfig | null;
  newProvider: ProviderDraft;
  providerDrafts: Record<string, ProviderEditorDraft>;
  providerLabelDrafts: Record<string, string>;
  providerErrors: Record<string, number>;
  modelErrors: Record<string, number>;
  integrationErrors: Record<string, number>;
  profileErrors: Record<string, number>;
  providerCatalog: ProviderCatalogEntry[];
  providerCatalogSummary: ProviderCatalogSummary | null;
  openaiCompatibilitySignoff: OpenAICompatibilitySignoffResponse | null;
  clients: ClientOpsRecord[];
  productAxisTargets: ProductAxisTarget[];
  oauthTargets: OauthTargetStatus[];
  oauthOperations: UnknownRecord[];
  oauthRecentOps: UnknownRecord[];
  oauthTotalOps: number;
  oauthOnboarding: OauthOnboardingTarget[];
  compatibilityMatrix: CompatibilityMatrixRow[];
  bootstrapReadiness: BootstrapReadiness | null;
  importPayload: string;
  newHarness: HarnessDraft;
};

export type ProvidersPageActions = {
  load: () => Promise<void>;
  setRunFilter: (field: keyof ProviderRunFilters, value: string) => void;
  setOperationResult: (value: string) => void;
  setImportPayload: (value: string) => void;
  setNewProvider: Dispatch<SetStateAction<ProviderDraft>>;
  setProviderDraftField: (provider: string, field: keyof ProviderEditorDraft, value: string) => void;
  setNewHarness: Dispatch<SetStateAction<HarnessDraft>>;
  setProviderLabelDraft: (provider: string, label: string) => void;
  runHarnessAction: (providerKey: string, model?: string) => Promise<void>;
  previewHarnessProfile: (providerKey: string, model: string, message: string, stream?: boolean) => Promise<void>;
  verifyHarnessProfile: (providerKey: string, model?: string, testMessage?: string) => Promise<void>;
  dryRunHarnessProfile: (providerKey: string, model: string, message: string, stream?: boolean) => Promise<void>;
  probeHarnessProfile: (providerKey: string, model?: string) => Promise<void>;
  toggleHarnessProfile: (providerKey: string, enabled: boolean) => Promise<void>;
  deleteHarnessProfile: (providerKey: string) => Promise<void>;
  rollbackHarnessProfile: (providerKey: string, revision: number) => Promise<void>;
  createProvider: () => Promise<void>;
  saveProvider: (provider: string) => Promise<void>;
  toggleProvider: (provider: string, enabled: boolean) => Promise<void>;
  syncProviderModels: (provider: string) => Promise<void>;
  saveProviderLabel: (provider: string) => Promise<void>;
  syncAllProviders: () => Promise<void>;
  upsertHarness: () => Promise<void>;
  updateHealth: (patch: Partial<HealthConfig>) => Promise<void>;
  runHealthChecks: () => Promise<void>;
  exportHarness: (redactSecrets: boolean) => Promise<void>;
  importHarness: (dryRun: boolean) => Promise<void>;
  syncOauthBridgeProfiles: () => Promise<void>;
  probeAllOauthTargets: () => Promise<void>;
  probeOauthTarget: (providerKey: string) => Promise<void>;
};

export function getProvidersAccess(
  session: AdminSessionUser | null,
  sessionReady: boolean,
  instanceId?: string | null,
): ProvidersAccessState {
  const canReadProviders = sessionHasScopedOrAnyInstancePermission(session, instanceId, "providers.read");
  const canWriteProviders = sessionCanMutateScopedOrAnyInstance(session, instanceId, "providers.write");
  const isReadOnly = Boolean(session?.read_only);
  const isAdmin = roleAllows(session?.role, "admin");
  const canRead = sessionReady && canReadProviders;
  const canOperate = canRead && !isReadOnly;
  const canExportRedacted = canRead;
  const canExportFull = sessionReady && isAdmin && !isReadOnly;
  const canMutate = canRead && canWriteProviders;
  const isBlocked = sessionReady && !canReadProviders;

  if (!sessionReady) {
    return {
      canRead: false,
      canOperate: false,
      canExportRedacted: false,
      canExportFull: false,
      canMutate: false,
      isBlocked: false,
      isReadOnly,
      isCheckingAccess: true,
      badgeLabel: "Checking permissions",
      badgeTone: "neutral",
      summaryTitle: "Checking provider permissions",
      summaryDetail: "ForgeFrame is confirming whether this session can run provider, harness, health, and OAuth control-plane actions.",
      operateBlockedMessage: "ForgeFrame is still checking whether this session can run verify, dry-run, and probe actions for saved harness profiles.",
      exportBlockedMessage: "ForgeFrame is still checking whether this session can inspect redacted harness exports.",
      fullExportBlockedMessage: "ForgeFrame is still checking whether this session can inspect full secret-bearing harness exports.",
      mutationBlockedMessage: "ForgeFrame is still checking whether this session can run provider mutations.",
    };
  }

  if (canMutate) {
    const roleLabel = isAdmin ? "Admin" : "Operator";

    return {
      canRead: true,
      canOperate: true,
      canExportRedacted: true,
      canExportFull,
      canMutate: true,
      isBlocked: false,
      isReadOnly,
      isCheckingAccess: false,
      badgeLabel: `${roleLabel} mutations enabled`,
      badgeTone: "success",
      summaryTitle: "Provider mutations enabled",
      summaryDetail: `Standard ${roleLabel.toLowerCase()} sessions can manage provider inventory and health here. OAuth/account targets live on the dedicated OAuth Targets route, and saved-profile verify, probe, import, and export work stays on the dedicated Harness route.`,
      operateBlockedMessage: "",
      exportBlockedMessage: "",
      fullExportBlockedMessage: isAdmin ? "" : "Full secret-bearing harness export stays admin-only on the dedicated Harness surface.",
      mutationBlockedMessage: "",
    };
  }

  if (canExportRedacted && isReadOnly) {
    return {
      canRead: true,
      canOperate: false,
      canExportRedacted: true,
      canExportFull: false,
      canMutate: false,
      isBlocked: false,
      isReadOnly: true,
      isCheckingAccess: false,
      badgeLabel: "Read only session",
      badgeTone: "warning",
      summaryTitle: "Read-only provider view",
      summaryDetail: "Read-only sessions can inspect provider inventory and health here. OAuth/account targets live on the dedicated OAuth Targets route, and dedicated harness state, runs, plus redacted harness exports stay on the Harness route, but full secret-bearing exports plus provider, health, import, and OAuth mutations stay hidden.",
      operateBlockedMessage: "Read-only sessions can preview harness request contracts and inspect exports, but verify, dry-run, probe, and profile mutations stay blocked because the backend rejects impersonation-backed operator actions.",
      exportBlockedMessage: "",
      fullExportBlockedMessage: "Full secret-bearing harness export stays admin-only and hidden for read-only sessions.",
      mutationBlockedMessage: "This session is read only, so provider and harness mutations stay hidden on this surface.",
    };
  }

  if (isBlocked) {
    return {
      canRead: false,
      canOperate: false,
      canExportRedacted: false,
      canExportFull: false,
      canMutate: false,
      isBlocked: true,
      isReadOnly,
      isCheckingAccess: false,
      badgeLabel: "Read access required",
      badgeTone: "warning",
      summaryTitle: "Read access required",
      summaryDetail: "This session cannot inspect provider, harness, or OAuth control-plane truth on the selected instance. ForgeFrame keeps the route reachable so you can change instance scope or permissions, but the backend will return 403 until providers.read is granted here.",
      operateBlockedMessage: "Harness verify, dry-run, and probe actions are unavailable because this session does not have providers.read on the selected instance.",
      exportBlockedMessage: "Harness export is unavailable because this session does not have providers.read on the selected instance.",
      fullExportBlockedMessage: "Full secret-bearing harness export is unavailable because this session does not have providers.read on the selected instance.",
      mutationBlockedMessage: "Provider, harness, health, and OAuth mutations are unavailable because this session does not have providers.read and providers.write on the selected instance.",
    };
  }

  return {
    canRead: true,
    canOperate,
    canExportRedacted,
    canExportFull: false,
    canMutate: false,
    isBlocked: false,
    isReadOnly,
    isCheckingAccess: false,
    badgeLabel: canOperate ? "Operate only" : "Read only",
    badgeTone: "warning",
    summaryTitle: canOperate ? "Operate-only provider view" : "Read-only provider view",
    summaryDetail: canOperate
      ? "This session can inspect provider inventory and health here. On the Harness route it can preview, verify, dry-run, and probe saved profiles, plus inspect redacted exports, but provider/profile mutations and full secret-bearing export stay hidden."
      : "This session can inspect provider inventory and health here. OAuth/account targets live on the dedicated OAuth Targets route, and dedicated harness runs plus redacted exports stay on the Harness route, but full secret-bearing export and provider mutations stay hidden.",
    operateBlockedMessage: canOperate
      ? ""
      : "This session can inspect harness profiles and preview request contracts, but verify, dry-run, and probe actions require a write-capable non-impersonation session.",
    exportBlockedMessage: "This session cannot inspect redacted harness exports on this surface.",
    fullExportBlockedMessage: "This session cannot inspect full secret-bearing harness exports on this surface.",
    mutationBlockedMessage: "This session cannot run provider mutations on this surface.",
  };
}

export function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as UnknownRecord;
}

export function toStringValue(value: unknown, fallback = "-"): string {
  if (typeof value === "string") {
    return value || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

export function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
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

export function formatMetric(value: unknown, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toNumberValue(value));
}

export function formatTimestamp(value: unknown, fallback = "never"): string {
  return typeof value === "string" && value ? value : fallback;
}

export function joinList(items: string[], fallback = "none"): string {
  return items.length > 0 ? items.join(", ") : fallback;
}

export function formatProviderAxis(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  if (value === "unmapped_native_runtime") {
    return "native runtime (outside product axes)";
  }
  return value.replaceAll("_", " ");
}
