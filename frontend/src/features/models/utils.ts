import type { AdminModelRegisterRecord } from "../../api/admin";
import type { StatusTone } from "../../components/ui/StatusBadge";
import {
  type ModelNextAction,
  type ModelUsabilityState,
  NEXT_ACTION_LABELS,
  USABILITY_EXPLANATIONS,
  USABILITY_LABELS,
} from "./types";

/**
 * Composite key for a model record.
 */
export function modelKey(model: AdminModelRegisterRecord): string {
  return `${model.provider}:${model.model_id}`;
}

/**
 * Format an ISO-8601 timestamp to a human-readable string.
 * @param value - ISO timestamp string or null/undefined.
 * @returns Formatted string or "Not recorded".
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
 * Replace separators with spaces and trim.
 */
export function humanize(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  return value.replace(/[_-]+/g, " ");
}

/**
 * Title-case a value.
 */
export function titleCase(value: string | null | undefined): string {
  return humanize(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Return a human-readable capability label.
 */
export function capabilityLabel(value: string): string {
  const labels: Record<string, string> = {
    tool_calling: "Tool calling",
    queue_eligible: "Queue eligible",
    discovery_support: "Discovery support",
  };
  return labels[value] ?? titleCase(value);
}

/**
 * Format a list of capability keys into a display string.
 */
export function formatCapabilityList(values: string[]): string {
  return values.length > 0 ? values.map(capabilityLabel).join(", ") : "None declared";
}

/**
 * Derive the primary usability state for a model.
 *
 * Priority order (first match wins):
 *  1. Placeholder / generic harness
 *  2. Disabled / inactive / removed
 *  3. Declaration only (no targets at all)
 *  4. Ready (routable + verified)
 *  5. Needs verification (routable but not trusted)
 *  6. No routable target (has targets but none eligible)
 *  7. Degraded (partial failure)
 *  8. Stale → needs verification
 */
export function deriveUsabilityState(model: AdminModelRegisterRecord): ModelUsabilityState {
  const isHarnessPlaceholder =
    model.provider_integration_class === "harness_generic" ||
    model.display_name.toLowerCase().includes("placeholder");

  if (isHarnessPlaceholder) {
    return "placeholder";
  }

  if (model.routing_status === "disabled" || model.routing_status === "removed" || !model.active) {
    return "disabled";
  }

  if (model.target_count === 0) {
    return "declaration_only";
  }

  if (model.routing_ready && model.trust_status === "tested") {
    return "ready";
  }

  if (model.routing_ready && model.trust_status !== "tested") {
    return "needs_verification";
  }

  if (model.routing_target_count === 0 && model.target_count > 0) {
    return "no_routable_target";
  }

  if (model.routing_status === "degraded") {
    return "degraded";
  }

  // Fallback for stale/other states
  return "needs_verification";
}

/**
 * Determine the recommended next action for a model.
 */
export function deriveNextAction(model: AdminModelRegisterRecord): ModelNextAction {
  const state = deriveUsabilityState(model);

  switch (state) {
    case "ready":
      return "none";
    case "placeholder":
      return "none";
    case "disabled":
      return "enable_provider_target";
    case "needs_verification":
      return "run_verification";
    case "no_routable_target":
      return "configure_routing";
    case "declaration_only":
      return "add_discovery_sync";
    case "degraded":
      return "review_provider";
  }
}

/**
 * Map a usability state to a StatusBadge tone.
 */
export function toneForUsability(state: ModelUsabilityState): StatusTone {
  switch (state) {
    case "ready":
      return "success";
    case "disabled":
      return "danger";
    case "needs_verification":
      return "warning";
    case "no_routable_target":
      return "danger";
    case "declaration_only":
      return "neutral";
    case "degraded":
      return "warning";
    case "placeholder":
      return "neutral";
  }
}

/**
 * Map a usability state to a summary status key for the status-hero badge.
 */
export function statusKeyForUsability(state: ModelUsabilityState): string {
  switch (state) {
    case "ready":
      return "ready";
    case "disabled":
      return "blocked";
    case "needs_verification":
      return "degraded";
    case "no_routable_target":
      return "blocked";
    case "declaration_only":
      return "partial";
    case "degraded":
      return "degraded";
    case "placeholder":
      return "bridge-only";
  }
}

/**
 * Return the next-step tone for a given usability state.
 */
export function nextStepTone(state: ModelUsabilityState): "success" | "warning" | "danger" | "neutral" {
  switch (state) {
    case "ready":
      return "success";
    case "needs_verification":
    case "degraded":
      return "warning";
    case "disabled":
    case "no_routable_target":
      return "danger";
    case "declaration_only":
      return "neutral";
    case "placeholder":
      return "neutral";
  }
}

/**
 * Build a structured next-step object.
 */
export interface NextStepInfo {
  readonly label: string;
  readonly explanation: string;
  readonly tone: "success" | "warning" | "danger" | "neutral";
}

/**
 * Build the next-step recommendation for a model.
 */
export function buildNextStep(model: AdminModelRegisterRecord): NextStepInfo {
  const state = deriveUsabilityState(model);
  const action = deriveNextAction(model);

  return {
    label: action === "none" ? USABILITY_LABELS[state] : NEXT_ACTION_LABELS[action],
    explanation: USABILITY_EXPLANATIONS[state],
    tone: nextStepTone(state),
  };
}

/**
 * Check whether a model is a placeholder.
 */
export function isPlaceholderModel(model: AdminModelRegisterRecord): boolean {
  return (
    model.provider_integration_class === "harness_generic" ||
    model.display_name.toLowerCase().includes("placeholder")
  );
}

/**
 * Check whether a model is stale (no recent activity, no routing).
 */
export function isStaleModel(model: AdminModelRegisterRecord): boolean {
  return model.routing_status === "stale" || model.health_status === "stale";
}

/**
 * Format target coverage as an operator-friendly string.
 */
export function formatCoverage(model: AdminModelRegisterRecord): string {
  if (model.target_count === 0) {
    return "No targets";
  }
  if (model.routing_target_count === model.target_count) {
    return `All ${model.target_count} targets routable`;
  }
  return `${model.routing_target_count}/${model.target_count} routable`;
}

/**
 * Simple check: does the model have any evidence of any type?
 */
export function hasAnyEvidence(model: AdminModelRegisterRecord): boolean {
  const ev = model.evidence;
  return (
    ev.runtime.status !== "missing" ||
    ev.streaming.status !== "missing" ||
    ev.tool_calling.status !== "missing"
  );
}
