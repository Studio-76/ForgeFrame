/**
 * Utility functions for the Instances management feature.
 *
 * @packageDocumentation
 */

import type {
  InstanceReadinessCheck,
  InstanceReadinessSummary,
  InstanceRecord,
  InstanceSetupStatus,
} from "../../api/domain/instances";
import { buildAgentsPath } from "../../app/workInteractionRoutes";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { BlockerItem } from "./types";

/**
 * Map a setup status to a semantic tone for pill/indicator styling.
 * @param status - The setup status value.
 * @returns Semantic tone key.
 */
export function toneForSetupStatus(
  status: InstanceSetupStatus | null | undefined,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "ready":
      return "success";
    case "bridge-only":
    case "onboarding-only":
      return "warning";
    case "not-ready":
    case "unsupported":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Format a timestamp for display.
 * @param value - Raw timestamp string.
 * @returns Formatted string or "n/a".
 */
export function formatTimestamp(value: string | null | undefined): string {
  return value && value.trim() ? value : "n/a";
}

/**
 * Map a setup status to a tone for the next-step indicator.
 * @param status - The setup status value.
 * @returns Semantic tone key.
 */
export function nextStepTone(
  status: InstanceSetupStatus | null | undefined,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "ready":
      return "success";
    case "bridge-only":
    case "onboarding-only":
      return "warning";
    case "not-ready":
    case "unsupported":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Check if an instance matches a scope filter value.
 * @param instance - The instance record.
 * @param filterValue - The filter text (tenant or company ID).
 * @returns Whether the instance matches.
 */
export function scopeMatches(
  instance: InstanceRecord,
  filterValue: string,
): boolean {
  const normalized = filterValue.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return [instance.tenant_id, instance.company_id].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

/**
 * Check if an instance matches a free-text search value.
 * @param instance - The instance record.
 * @param searchValue - The search text.
 * @returns Whether the instance matches.
 */
export function searchMatches(
  instance: InstanceRecord,
  searchValue: string,
): boolean {
  const normalized = searchValue.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return [
    instance.instance_id,
    instance.display_name,
    instance.description,
    instance.slug,
    instance.tenant_id,
    instance.company_id,
    instance.operator_agent?.display_name ?? "",
    instance.readiness?.reason ?? "",
  ].some((value) => value.toLowerCase().includes(normalized));
}

/**
 * Format readiness check summary text.
 * @param readiness - The readiness summary.
 * @returns Formatted string.
 */
export function formatReadinessSummary(
  readiness: InstanceReadinessSummary | null | undefined,
): string {
  if (!readiness) {
    return "Readiness unavailable.";
  }
  return `${readiness.ready_check_count}/${readiness.check_count} checks ready`;
}

/**
 * Format preferred target keys for display.
 * @param values - Target key list.
 * @returns Joined string or "none".
 */
export function preferredTargetsLabel(
  values: string[] | undefined,
): string {
  return values && values.length > 0 ? values.join(", ") : "none";
}

/**
 * Derive the primary blocker text and remediation action for an instance.
 * The returned labels use task-specific wording rather than generic navigation labels.
 * @param instance - The instance record.
 * @returns Blocker info or null if ready.
 */
export function getInstanceBlocker(
  instance: InstanceRecord,
): {
  blocker: string;
  impact: string;
  fixLocation: string;
  actionLabel: string | null;
} | null {
  if (!instance.readiness || instance.readiness.status === "ready") {
    return null;
  }

  // Operator agent missing is the highest-priority blocker
  if (!instance.operator_agent || instance.operator_agent.status !== "ready") {
    return {
      blocker: "Operator agent is not ready",
      impact:
        "Without the default Operator agent, this instance cannot execute any work.",
      fixLocation: "Agents page",
      actionLabel: "Configure operator agent",
    };
  }

  // Provider targets
  if (
    !instance.provider_targets ||
    instance.provider_targets.status !== "ready"
  ) {
    return {
      blocker: "Provider targets are not configured",
      impact:
        "Without ready provider targets, the instance has no backend to route requests to.",
      fixLocation: "Provider Targets page",
      actionLabel: "Review provider targets",
    };
  }

  // Routing
  if (!instance.routing || instance.routing.status !== "ready") {
    return {
      blocker: "Routing policy is incomplete",
      impact:
        "Without a complete routing policy, requests cannot be dispatched to the correct targets.",
      fixLocation: "Routing page",
      actionLabel: "Review routing policy",
    };
  }

  // Fallback: use the readiness reason
  return {
    blocker: instance.readiness.reason || "Instance is not ready",
    impact: "The instance cannot operate until all readiness checks pass.",
    fixLocation: "Readiness checks",
    actionLabel: null,
  };
}

/**
 * Build a checklist of readiness checks grouped into blockers vs passed.
 * @param instance - The instance record.
 * @returns Object with blockers and passed arrays.
 */
export function buildBlockerChecklist(
  instance: InstanceRecord,
): { blockers: BlockerItem[]; passed: BlockerItem[] } {
  const checks = instance.readiness?.checks ?? [];
  const blockers: BlockerItem[] = [];
  const passed: BlockerItem[] = [];

  for (const check of checks) {
    const item: BlockerItem = {
      id: check.id,
      label: check.label,
      status: check.status,
      detail: check.detail,
      isBlocking: check.status !== "ready",
      actionPath: actionPathForCheck(check, instance),
      actionLabel: actionLabelForCheck(check),
    };
    if (item.isBlocking) {
      blockers.push(item);
    } else {
      passed.push(item);
    }
  }

  // If there are no readiness checks but the instance is not ready,
  // synthesize a blocker from the operator agent state, provider targets, or routing.
  if (
    checks.length === 0 &&
    instance.readiness &&
    instance.readiness.status !== "ready"
  ) {
    const blocker = getInstanceBlocker(instance);
    if (blocker) {
      blockers.push({
        id: "synthetic-blocker",
        label: blocker.blocker,
        status: "not-ready",
        detail: blocker.impact,
        isBlocking: true,
        actionPath: null,
        actionLabel: blocker.actionLabel,
      });
    }
  }

  return { blockers, passed };
}

/**
 * Map a readiness check ID to a navigation path for the remediation action.
 * @param check - The readiness check.
 * @param instance - The instance record.
 * @returns A URL path or null.
 */
export function actionPathForCheck(
  check: InstanceReadinessCheck,
  instance: InstanceRecord,
): string | null {
  const id = check.id;
  if (id === "operator_agent" || id === "operator") {
    return buildAgentsPath({ instanceId: instance.instance_id });
  }
  if (id === "provider_targets" || id === "provider_target") {
    return withInstanceScope(
      CONTROL_PLANE_ROUTES.providerTargets,
      instance.instance_id,
    );
  }
  if (id === "routing" || id === "routing_policy") {
    return withInstanceScope(
      CONTROL_PLANE_ROUTES.routing,
      instance.instance_id,
    );
  }
  if (id === "work_interaction" || id === "work") {
    return withInstanceScope(
      CONTROL_PLANE_ROUTES.conversations,
      instance.instance_id,
    );
  }
  if (id === "runtime_access" || id === "api_keys") {
    return withInstanceScope(
      CONTROL_PLANE_ROUTES.apiKeys,
      instance.instance_id,
    );
  }
  return null;
}

/**
 * Map a readiness check ID to a task-specific action label.
 * @param check - The readiness check.
 * @returns Action label string or null.
 */
export function actionLabelForCheck(
  check: InstanceReadinessCheck,
): string | null {
  const id = check.id;
  if (id === "operator_agent" || id === "operator") {
    return "Configure operator agent";
  }
  if (id === "provider_targets" || id === "provider_target") {
    return "Review provider targets";
  }
  if (id === "routing" || id === "routing_policy") {
    return "Review routing policy";
  }
  if (id === "work_interaction" || id === "work") {
    return "Configure work interaction";
  }
  if (id === "runtime_access" || id === "api_keys") {
    return "Configure API keys";
  }
  return null;
}

/**
 * Get the relevant related-page links for the current selected instance.
 * Returns labels and paths, grouped by priority.
 * @param instance - The selected instance record.
 * @param permissions - Permission flags for instance-scoped pages.
 * @returns Array of link objects.
 */
export function getInstanceRelatedLinks(
  instance: InstanceRecord,
  permissions: {
    canOpenTargets: boolean;
    canOpenRouting: boolean;
    canOpenConversations: boolean;
    canOpenApiKeys: boolean;
  },
): Array<{ label: string; path: string; group: "primary" | "related" | "advanced" }> {
  const links: Array<{
    label: string;
    path: string;
    group: "primary" | "related" | "advanced";
  }> = [];

  const isOperatorMissing =
    !instance.operator_agent || instance.operator_agent.status !== "ready";
  const isWorkInteractionBlocking =
    instance.work_interaction?.status !== "ready";
  const isTargetsBlocking =
    instance.provider_targets?.status !== "ready";
  const isRoutingBlocking = instance.routing?.status !== "ready";

  if (isOperatorMissing) {
    links.push({
      label: "Configure operator agent",
      path: buildAgentsPath({ instanceId: instance.instance_id }),
      group: "primary",
    });
  }

  if (isWorkInteractionBlocking) {
    links.push({
      label: "Configure work interaction",
      path: withInstanceScope(
        CONTROL_PLANE_ROUTES.conversations,
        instance.instance_id,
      ),
      group: "primary",
    });
  }

  if (permissions.canOpenTargets) {
    links.push({
      label: isTargetsBlocking
        ? "Review provider targets"
        : "Provider targets",
      path: withInstanceScope(
        CONTROL_PLANE_ROUTES.providerTargets,
        instance.instance_id,
      ),
      group: isTargetsBlocking ? "primary" : "related",
    });
  }

  if (permissions.canOpenRouting) {
    links.push({
      label: isRoutingBlocking ? "Review routing policy" : "Routing policy",
      path: withInstanceScope(
        CONTROL_PLANE_ROUTES.routing,
        instance.instance_id,
      ),
      group: isRoutingBlocking ? "primary" : "related",
    });
  }

  if (permissions.canOpenConversations) {
    links.push({
      label: "Conversations",
      path: withInstanceScope(
        CONTROL_PLANE_ROUTES.conversations,
        instance.instance_id,
      ),
      group: "related",
    });
  }

  if (permissions.canOpenApiKeys) {
    links.push({
      label: "API keys",
      path: withInstanceScope(
        CONTROL_PLANE_ROUTES.apiKeys,
        instance.instance_id,
      ),
      group: "related",
    });
  }

  links.push({
    label: "Release / Validation",
    path: withInstanceScope(
      CONTROL_PLANE_ROUTES.releaseValidation,
      instance.instance_id,
    ),
    group: "related",
  });

  return links;
}
