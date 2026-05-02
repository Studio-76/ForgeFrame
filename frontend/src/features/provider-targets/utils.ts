import type { StatusTone } from "../../components/ui/StatusBadge";
import type { CapabilityFilter, PrimaryTargetStatus, ProviderTargetRecord, ReadinessSummary, TargetDraft, TargetNextAction } from "./types";

/**
 * Derive the primary status for a provider target.
 */
export function contractStatusForTarget(target: ProviderTargetRecord): PrimaryTargetStatus {
  if (!target.enabled) {
    return "disabled";
  }
  if (!target.provider_enabled || !target.model_active) {
    return "blocked";
  }

  const readiness = target.readiness_status.trim().toLowerCase();
  if (readiness === "runtime-ready") {
    return "runtime-ready";
  }
  if (readiness === "bridge-only") {
    return "bridge-only";
  }
  if (readiness === "unsupported") {
    return "unsupported";
  }
  if (readiness === "degraded") {
    return "degraded";
  }
  if (readiness === "partial") {
    return "partial";
  }
  if (readiness === "blocked") {
    return "blocked";
  }
  if (readiness === "ready") {
    if (target.runtime_ready && target.health_status === "healthy" && target.availability_status === "healthy") {
      return "runtime-ready";
    }
    if (!target.runtime_ready) {
      return "partial";
    }
    if (target.health_status !== "healthy" || target.availability_status !== "healthy") {
      return "degraded";
    }
    return "ready";
  }

  return target.runtime_ready ? "partial" : "blocked";
}

/**
 * Human-readable label for a target's primary status.
 */
export function statusLabelForTarget(target: ProviderTargetRecord): string {
  const status = contractStatusForTarget(target);
  if (status === "runtime-ready") {
    return "Runtime ready";
  }
  return titleCase(status);
}

/**
 * Map a primary status to its display tone.
 */
export function toneForTargetStatus(status: PrimaryTargetStatus): StatusTone {
  switch (status) {
    case "runtime-ready":
    case "ready":
      return "success";
    case "partial":
    case "degraded":
    case "bridge-only":
      return "warning";
    case "blocked":
    case "disabled":
      return "danger";
    case "unsupported":
    default:
      return "info";
  }
}

/**
 * Recommended next action for a non-ready target.
 */
export function nextActionForTarget(target: ProviderTargetRecord): TargetNextAction {
  const status = contractStatusForTarget(target);

  switch (status) {
    case "runtime-ready":
    case "ready":
      return { label: "No action needed", kind: "none" };

    case "disabled":
      if (!target.provider_enabled) {
        return { label: "Enable provider", kind: "enable-target" };
      }
      if (!target.model_active) {
        return { label: "Activate model", kind: "enable-target" };
      }
      return { label: "Enable target", kind: "enable-target" };

    case "blocked":
      if (!target.provider_enabled) {
        return { label: "Enable provider", kind: "enable-target" };
      }
      if (!target.model_active) {
        return { label: "Activate model", kind: "enable-target" };
      }
      if (target.readiness_status?.toLowerCase() === "blocked") {
        return { label: "Run provider health check", kind: "health-check" };
      }
      return { label: "Review routing policy", kind: "routing-policy" };

    case "partial":
      if (!target.runtime_ready) {
        return { label: "Enable runtime readiness", kind: "enable-runtime" };
      }
      return { label: "Fix probe configuration", kind: "probe-config" };

    case "degraded":
      return { label: "Run provider health check", kind: "health-check" };

    case "bridge-only":
      return { label: "Review routing policy", kind: "routing-policy" };

    case "unsupported":
      return { label: "Disable placeholder target", kind: "disable-placeholder" };

    default:
      return { label: "Review configuration", kind: "routing-policy" };
  }
}

/**
 * Human-readable summary of why a target is not in its best state.
 */
export function reasonForTargetStatus(target: ProviderTargetRecord): string {
  const status = contractStatusForTarget(target);

  if (status === "runtime-ready") {
    return "Target is fully operational and can receive runtime traffic.";
  }
  if (status === "ready") {
    return "Target is enabled and healthy but lacks runtime proof.";
  }

  if (target.status_reason) {
    return target.status_reason;
  }
  if (target.runtime_readiness_reason) {
    return target.runtime_readiness_reason;
  }

  switch (status) {
    case "disabled":
      return "Target is disabled and cannot receive traffic.";
    case "blocked":
      return "Target is blocked by provider or model state.";
    case "partial":
      return "Target is missing some requirements for full runtime readiness.";
    case "degraded":
      return "Target is operational but degraded.";
    case "bridge-only":
      return "Target is bridge-only and cannot receive direct runtime traffic.";
    case "unsupported":
      return "Target uses an unsupported provider class.";
    default:
      return "Unknown target state.";
  }
}

/**
 * Format a title-case string from a kebab/snake/underscore value.
 */
export function titleCase(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Format an ISO timestamp for display.
 */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().replace(".000Z", "Z").replace("T", " ");
}

/**
 * Format a record of entries for inline display.
 */
export function formatRecordEntries(values: Record<string, unknown>): string {
  const entries = Object.entries(values ?? {});
  return entries.length > 0
    ? entries.map(([key, val]) => `${key}=${String(val)}`).join(" · ")
    : "none";
}

/** Safely coerce a value to string. */
export function valueAsString(value: unknown, fallback = "unknown"): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

/** Safely coerce a value to boolean. */
export function valueAsBoolean(value: unknown): boolean {
  return value === true;
}

/** Safely coerce a value to string array. */
export function valueAsStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => valueAsString(entry)).filter(Boolean) : [];
}

/** Extract quality tier from economic profile. */
export function qualityTierOf(target: ProviderTargetRecord): string {
  return valueAsString(target.economic_profile.quality_tier, "standard");
}

/** Extract execution lane from execution traits. */
export function executionLaneOf(target: ProviderTargetRecord): string {
  return valueAsString(target.execution_traits.execution_lane, target.queue_eligible ? "queued_background" : "sync_interactive");
}

/**
 * Create a mutable draft from a target record.
 */
export function targetDraftFromRecord(target: ProviderTargetRecord): TargetDraft {
  return {
    enabled: target.enabled,
    priority: String(target.priority),
    queueEligible: target.queue_eligible,
    fallbackAllowed: target.fallback_allowed,
    fallbackTargetKeys: [...target.fallback_target_keys],
    escalationAllowed: target.escalation_allowed,
    escalationTargetKeys: [...target.escalation_target_keys],
    acknowledgeDefaultRisk: false,
  };
}

/** Check whether a target has premium or OAuth risk. */
export function targetHasPremiumOrOauthRisk(target: ProviderTargetRecord): boolean {
  return target.auth_type.toLowerCase().includes("oauth")
    || target.credential_type.toLowerCase().includes("oauth")
    || target.cost_class.toLowerCase().includes("high")
    || qualityTierOf(target).toLowerCase().includes("premium");
}

/** Parse a priority string to a number with fallback. */
export function normalizePriority(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

/** Sort string values. */
export function sortStringValues(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

/** Check if two string arrays are equal (order-independent). */
export function arraysEqual(left: string[], right: string[]): boolean {
  return JSON.stringify(sortStringValues(left)) === JSON.stringify(sortStringValues(right));
}

/**
 * Check whether a target is the default among enabled targets.
 */
export function isDefaultEnabledTarget(
  priority: number,
  enabled: boolean,
  otherEnabledPriorities: number[],
): boolean {
  if (!enabled) {
    return false;
  }
  const lowestOtherPriority = otherEnabledPriorities.length > 0 ? Math.min(...otherEnabledPriorities) : null;
  return lowestOtherPriority === null || priority <= lowestOtherPriority;
}

/**
 * Format a target's capability list for display.
 */
export function capabilityList(target: ProviderTargetRecord): string[] {
  const capabilities = new Set<string>();
  if (target.stream_capable || valueAsBoolean(target.capability_profile.streaming)) {
    capabilities.add("streaming");
  }
  if (target.tool_capable || valueAsBoolean(target.capability_profile.tool_calling)) {
    capabilities.add("tool calling");
  }
  if (target.vision_capable || valueAsBoolean(target.capability_profile.vision)) {
    capabilities.add("vision");
  }
  if (target.queue_eligible || valueAsBoolean(target.capability_profile.queue_eligible)) {
    capabilities.add("queue eligible");
  }
  return Array.from(capabilities);
}

/** Check whether a target matches a capability filter. */
export function capabilityFilterMatches(target: ProviderTargetRecord, capability: CapabilityFilter): boolean {
  if (capability === "all") {
    return true;
  }
  if (capability === "streaming") {
    return target.stream_capable || valueAsBoolean(target.capability_profile.streaming);
  }
  if (capability === "tool_calling") {
    return target.tool_capable || valueAsBoolean(target.capability_profile.tool_calling);
  }
  if (capability === "vision") {
    return target.vision_capable || valueAsBoolean(target.capability_profile.vision);
  }
  return target.queue_eligible || valueAsBoolean(target.capability_profile.queue_eligible);
}

/**
 * Compute the readiness summary from a list of targets.
 */
export function computeReadinessSummary(targets: ProviderTargetRecord[]): ReadinessSummary {
  const totalTargets = targets.length;
  const runtimeReadyCount = targets.filter((t) => contractStatusForTarget(t) === "runtime-ready").length;
  const enabledCount = targets.filter((t) => t.enabled).length;

  let primaryBlocker: string | null = null;
  let nextAction: string | null = null;

  if (totalTargets === 0) {
    primaryBlocker = "No targets configured";
    nextAction = "Add provider targets to enable routing";
  } else if (runtimeReadyCount === 0 && enabledCount === 0) {
    primaryBlocker = "No targets are enabled";
    nextAction = "Enable at least one target";
  } else if (runtimeReadyCount === 0) {
    const blocked = targets.filter((t) => contractStatusForTarget(t) === "blocked");
    const partial = targets.filter((t) => contractStatusForTarget(t) === "partial");
    const degraded = targets.filter((t) => contractStatusForTarget(t) === "degraded");

    if (blocked.length > 0) {
      primaryBlocker = `${blocked.length} target(s) blocked`;
      nextAction = "Run provider health check or enable provider/model";
    } else if (partial.length > 0) {
      primaryBlocker = `${partial.length} target(s) partial — runtime proof missing`;
      nextAction = "Enable runtime readiness or fix probe configuration";
    } else if (degraded.length > 0) {
      primaryBlocker = `${degraded.length} target(s) degraded`;
      nextAction = "Run provider health check";
    } else {
      primaryBlocker = "No targets are runtime-ready";
      nextAction = "Review target configuration";
    }
  } else {
    nextAction = "All clear — targets are ready for dispatch";
  }

  return { totalTargets, runtimeReadyCount, enabledCount, primaryBlocker, nextAction };
}


