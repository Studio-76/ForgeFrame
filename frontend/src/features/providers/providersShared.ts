import type { Dispatch, SetStateAction } from "react";

import type { AdminSessionUser } from "../../api/admin";
import {
  roleAllows,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasAnyInstancePermission,
} from "../../app/adminAccess";
import type {
  CompatibilityMatrixRow,
  HarnessProfile,
  HarnessTemplate,
  HealthConfig,
  OauthOnboardingTarget,
  OauthTargetStatus,
  ProviderControlItem,
  ProductAxisTarget,
} from "../../api/admin";

export type LoadState = "idle" | "loading" | "success" | "error";

export type ProviderRunFilters = {
  mode: string;
  status: string;
  provider: string;
  client: string;
};

export type ProviderDraft = {
  provider: string;
  label: string;
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
  canExportRedacted: boolean;
  canExportFull: boolean;
  canMutate: boolean;
  isViewer: boolean;
  isReadOnly: boolean;
  isCheckingAccess: boolean;
  badgeLabel: string;
  badgeTone: ProvidersAccessBadgeTone;
  summaryTitle: string;
  summaryDetail: string;
  exportBlockedMessage: string;
  fullExportBlockedMessage: string;
  mutationBlockedMessage: string;
};

export type ProvidersPageData = {
  state: LoadState;
  error: string | null;
  access: ProvidersAccessState;
  providers: ProviderControlItem[];
  templates: HarnessTemplate[];
  profiles: HarnessProfile[];
  runs: UnknownRecord[];
  runSummary: Record<string, number>;
  runOps: UnknownRecord;
  runFilters: ProviderRunFilters;
  operationResult: string;
  syncNote: string;
  healthConfig: HealthConfig | null;
  newProvider: ProviderDraft;
  providerLabelDrafts: Record<string, string>;
  providerErrors: Record<string, number>;
  modelErrors: Record<string, number>;
  integrationErrors: Record<string, number>;
  profileErrors: Record<string, number>;
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
  setNewHarness: Dispatch<SetStateAction<HarnessDraft>>;
  setProviderLabelDraft: (provider: string, label: string) => void;
  runHarnessAction: (providerKey: string, model?: string) => Promise<void>;
  probeHarnessProfile: (providerKey: string, model?: string) => Promise<void>;
  toggleHarnessProfile: (providerKey: string, enabled: boolean) => Promise<void>;
  deleteHarnessProfile: (providerKey: string) => Promise<void>;
  rollbackHarnessProfile: (providerKey: string, revision: number) => Promise<void>;
  createProvider: () => Promise<void>;
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

export function getProvidersAccess(session: AdminSessionUser | null, sessionReady: boolean): ProvidersAccessState {
  const canReadProviders = sessionHasAnyInstancePermission(session, "providers.read");
  const canWriteProviders = sessionCanMutateScopedOrAnyInstance(session, null, "providers.write");
  const isViewer = Boolean(session) && !canReadProviders;
  const isReadOnly = Boolean(session?.read_only);
  const isAdmin = roleAllows(session?.role, "admin");
  const canExportRedacted = sessionReady && canReadProviders;
  const canExportFull = sessionReady && isAdmin && !isReadOnly;
  const canMutate = sessionReady && canWriteProviders;

  if (!sessionReady) {
    return {
      canExportRedacted: false,
      canExportFull: false,
      canMutate: false,
      isViewer,
      isReadOnly,
      isCheckingAccess: true,
      badgeLabel: "Checking permissions",
      badgeTone: "neutral",
      summaryTitle: "Checking provider permissions",
      summaryDetail: "ForgeFrame is confirming whether this session can run provider, harness, health, and OAuth control-plane actions.",
      exportBlockedMessage: "ForgeFrame is still checking whether this session can inspect redacted harness exports.",
      fullExportBlockedMessage: "ForgeFrame is still checking whether this session can inspect full secret-bearing harness exports.",
      mutationBlockedMessage: "ForgeFrame is still checking whether this session can run provider mutations.",
    };
  }

  if (canMutate) {
    const roleLabel = isAdmin ? "Admin" : "Operator";

    return {
      canExportRedacted: true,
      canExportFull,
      canMutate: true,
      isViewer,
      isReadOnly,
      isCheckingAccess: false,
      badgeLabel: `${roleLabel} mutations enabled`,
      badgeTone: "success",
      summaryTitle: "Provider mutations enabled",
      summaryDetail: `Standard ${roleLabel.toLowerCase()} sessions can manage provider state here and use the dedicated Harness route for saved-profile, verify, probe, import, and export operations.`,
      exportBlockedMessage: "",
      fullExportBlockedMessage: isAdmin ? "" : "Full secret-bearing harness export stays admin-only on the dedicated Harness surface.",
      mutationBlockedMessage: "",
    };
  }

  if (canExportRedacted && isReadOnly) {
    return {
      canExportRedacted: true,
      canExportFull: false,
      canMutate: false,
      isViewer,
      isReadOnly: true,
      isCheckingAccess: false,
      badgeLabel: "Read only session",
      badgeTone: "warning",
      summaryTitle: "Read-only provider view",
      summaryDetail: "Read-only sessions can inspect provider truth and expansion targets here, and can inspect dedicated harness state, runs, and redacted harness exports on the Harness route, but full secret-bearing exports plus provider, health, import, and OAuth mutations stay hidden.",
      exportBlockedMessage: "",
      fullExportBlockedMessage: "Full secret-bearing harness export stays admin-only and hidden for read-only sessions.",
      mutationBlockedMessage: "This session is read only, so provider and harness mutations stay hidden on this surface.",
    };
  }

  if (isViewer) {
    return {
      canExportRedacted: false,
      canExportFull: false,
      canMutate: false,
      isViewer: true,
      isReadOnly,
      isCheckingAccess: false,
      badgeLabel: "Viewer access",
      badgeTone: "warning",
      summaryTitle: "Permission-limited provider view",
      summaryDetail: "Viewer sessions can inspect provider truth and expansion targets here, and can inspect dedicated harness state and runs on the Harness route, but harness export and mutating provider actions stay hidden.",
      exportBlockedMessage: "Viewer sessions can inspect provider truth here, but harness export actions stay hidden.",
      fullExportBlockedMessage: "Viewer sessions can inspect provider truth here, but full secret-bearing harness export stays hidden.",
      mutationBlockedMessage: "Viewer sessions can inspect provider truth here, but mutating provider and harness actions stay hidden.",
    };
  }

  return {
    canExportRedacted,
    canExportFull: false,
    canMutate: false,
    isViewer,
    isReadOnly,
    isCheckingAccess: false,
    badgeLabel: "Read only",
    badgeTone: "warning",
    summaryTitle: "Read-only provider view",
    summaryDetail: "This session can inspect provider truth and expansion targets here, and can inspect dedicated harness runs and redacted exports on the Harness route, but full secret-bearing export and provider mutations stay hidden.",
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
