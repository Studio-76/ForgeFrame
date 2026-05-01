import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  type DashboardAttentionItem,
  type DashboardResponse,
} from "../../api/admin";
import { useDashboardQuery } from "../../api/adminQueries";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import type { OverallStatus, SetupActions, SetupMode, SetupState, SetupStep, SetupStepStatus } from "./types";

/**
 * Derive overall status from step statuses.
 */
function deriveOverallStatus(steps: SetupStep[], mustRotate: boolean): OverallStatus {
  if (mustRotate) {
    return "restricted";
  }
  if (steps.length === 0) {
    return "not-started";
  }
  const allDone = steps.every((s) => s.status === "complete");
  if (allDone) {
    return "live";
  }
  const hasBlocked = steps.some((s) => s.status === "blocked");
  if (hasBlocked) {
    return "blocked";
  }
  return "in-progress";
}

/**
 * Find the first attention item matching a setup axis or title keyword.
 * @param dashboard - Dashboard payload used as setup truth.
 * @param matches - Predicate for selecting a relevant attention item.
 * @returns Matching attention item, or null when no item applies.
 */
function findAttentionItem(
  dashboard: DashboardResponse | null | undefined,
  matches: (item: DashboardAttentionItem) => boolean,
): DashboardAttentionItem | null {
  return dashboard?.attention.find(matches) ?? null;
}

/**
 * Read a numeric dashboard KPI defensively.
 * @param dashboard - Dashboard payload used as setup truth.
 * @param key - KPI key from the backend dashboard response.
 * @returns Numeric KPI value, or 0 when absent.
 */
function dashboardKpi(
  dashboard: DashboardResponse | null | undefined,
  key: string,
): number {
  return dashboard?.kpis[key] ?? 0;
}

/**
 * Return true when a backend action would only reopen the setup surface.
 * @param to - Route supplied by dashboard primary action data.
 * @returns Whether the route points back to setup instead of a detail page.
 */
function isSetupSurfaceRoute(to: string): boolean {
  const [path] = to.split(/[?#]/);
  return path === "/onboarding" || path === CONTROL_PLANE_ROUTES.dashboard;
}

/**
 * Replace setup self-links with a concrete detail route.
 * @param to - Candidate route from backend setup or attention data.
 * @param fallback - Route to use when the candidate points back to setup.
 * @returns Candidate route unless it would reopen the current setup surface.
 */
function detailRouteOrFallback(to: string | null | undefined, fallback: string): string {
  if (!to || isSetupSurfaceRoute(to)) {
    return fallback;
  }
  return to;
}

/**
 * Return a dashboard section status by key.
 * @param dashboard - Dashboard payload used as setup truth.
 * @param key - Dashboard section key.
 * @returns Section status string, or null when unavailable.
 */
function dashboardSectionStatus(
  dashboard: DashboardResponse | null | undefined,
  key: DashboardResponse["sections"][number]["key"],
): string | null {
  return dashboard?.sections.find((section) => section.key === key)?.status ?? null;
}

/**
 * Build setup steps from dashboard data and session state.
 */
function deriveSteps(
  dashboard: DashboardResponse | null | undefined,
  mustRotatePassword: boolean,
  hasInstance: boolean,
  loading: boolean,
): SetupStep[] {
  if (loading) {
    return [];
  }

  if (mustRotatePassword) {
    return [
      {
        id: "rotate-password",
        stepNumber: 1,
        title: "Rotate password",
        description:
          "The system is in restricted bootstrap mode. Replace the temporary password to unlock the control plane.",
        status: "current",
        blockers: [],
        actionLabel: "Rotate password",
        actionTo: "/rotate-password",
      },
    ];
  }

  const steps: SetupStep[] = [];
  let currentAssigned = false;

  function addStep(
    id: string,
    stepNumber: number,
    title: string,
    description: string,
    isDone: boolean,
    isBlocked: boolean,
    blockers: string[],
    actionLabel: string | null,
    actionTo: string | null,
  ): void {
    let status: SetupStepStatus;
    if (isDone) {
      status = "complete";
    } else if (!currentAssigned) {
      status = isBlocked ? "blocked" : "current";
      currentAssigned = true;
    } else {
      status = "upcoming";
    }

    steps.push({
      id,
      stepNumber,
      title,
      description,
      status,
      blockers,
      actionLabel,
      actionTo,
    });
  }

  /* Step 2: Configure instance & scope. */
  const needsInstance = !hasInstance;
  const instanceAttention = dashboard?.attention.find(
    (a) => a.axis === "instance" || a.title.toLowerCase().includes("instance"),
  );
  addStep(
    "configure-instance",
    2,
    "Configure instance and scope",
    "Set the display name, tenant scope, deployment mode, and exposure mode for the first instance.",
    !needsInstance,
    instanceAttention?.severity === "critical",
    needsInstance ? ["No instance is configured yet. Create the first instance to proceed."] : [],
    needsInstance ? "Open instances" : null,
    needsInstance ? "/instances" : null,
  );

  /* Step 3: Connect provider */
  const providerAttention = findAttentionItem(
    dashboard,
    (a) => a.axis.toLowerCase().includes("provider") || a.title.toLowerCase().includes("provider"),
  );
  const configuredProviderCount = dashboardKpi(dashboard, "configured_providers");
  const readyProviderCount = dashboardKpi(dashboard, "ready_providers");
  const providerDone = readyProviderCount > 0;
  const providerBlocked = configuredProviderCount === 0 || providerAttention?.severity === "critical";
  const providerBlockers: string[] = [];
  if (!providerDone) {
    if (providerAttention) {
      providerBlockers.push(providerAttention.cause);
    } else if (configuredProviderCount === 0) {
      providerBlockers.push("Add one provider record, save endpoint/auth, sync inventory, and create a runtime-ready target.");
    } else {
      providerBlockers.push("At least one provider target must be runtime-ready before routing can send traffic.");
    }
  }
  addStep(
    "connect-provider",
    3,
    "Connect provider",
    "Add one provider record, save endpoint/auth, sync inventory, and make one target runtime-ready. Use Harness only after the target exists for live proof.",
    providerDone,
    providerBlocked,
    providerBlockers,
    "Open providers",
    CONTROL_PLANE_ROUTES.providers,
  );

  /* Step 4: Configure routing */
  const routingAttention = findAttentionItem(
    dashboard,
    (a) => a.axis === "routing" || a.axis === "routing_queue",
  );
  const routingStatus = dashboardSectionStatus(dashboard, "routing_queue");
  const routingDone = routingStatus === "ready";
  addStep(
    "configure-routing",
    4,
    "Configure routing",
    "Choose simple (local-first) or premium (OAuth-capable) routing defaults.",
    routingDone,
    routingStatus === "blocked" || routingAttention?.severity === "critical",
    routingDone ? [] : [routingAttention?.cause ?? "Routing policy, budget, circuits, and queue posture must be ready."],
    "Open routing",
    CONTROL_PLANE_ROUTES.routing,
  );

  /* Step 5: Issue runtime key */
  const keyAttention = findAttentionItem(
    dashboard,
    (a) => a.title.toLowerCase().includes("key") || a.cause.toLowerCase().includes("runtime key"),
  );
  const runtimeKeyCount = dashboardKpi(dashboard, "runtime_keys");
  const runtimeKeyDone = runtimeKeyCount > 0;
  addStep(
    "issue-runtime-key",
    5,
    "Issue runtime key",
    "Create an active runtime key so the runtime can authenticate API requests.",
    runtimeKeyDone,
    keyAttention?.severity === "critical",
    runtimeKeyDone ? [] : [keyAttention?.cause ?? "Create one active runtime key before running first-success traffic."],
    "Open API keys",
    CONTROL_PLANE_ROUTES.apiKeys,
  );

  /* Step 6: Verify FQDN/TLS */
  const tlsAttention = findAttentionItem(
    dashboard,
    (a) => a.axis === "readiness" || a.title.toLowerCase().includes("tls") || a.title.toLowerCase().includes("fqdn"),
  );
  const readinessStatus = dashboardSectionStatus(dashboard, "readiness");
  const tlsDone = readinessStatus === "ready";
  addStep(
    "verify-tls",
    6,
    "Verify FQDN and TLS",
    "Confirm the public FQDN resolves, the HTTPS listener is active, and a valid certificate is installed.",
    tlsDone,
    readinessStatus === "blocked" || tlsAttention?.severity === "critical",
    tlsDone ? [] : [tlsAttention?.cause ?? "FQDN, DNS, HTTPS listener, and certificate evidence must be ready."],
    "Open ingress/TLS",
    CONTROL_PLANE_ROUTES.ingressTls,
  );

  /* Step 7: Run readiness probe */
  const runtimeStatus = dashboardSectionStatus(dashboard, "runtime");
  const runtimeAttention = findAttentionItem(
    dashboard,
    (a) => a.axis.toLowerCase().includes("runtime") || a.title.toLowerCase().includes("runtime"),
  );
  const readinessProbeDone = runtimeStatus === "ready" || dashboardKpi(dashboard, "runtime_requests_24h") > 0;
  addStep(
    "run-readiness-probe",
    7,
    "Run readiness probe",
    "Send a test request to /v1/models and /v1/chat to confirm the runtime is operational.",
    readinessProbeDone,
    runtimeAttention?.severity === "critical",
    readinessProbeDone ? [] : [runtimeAttention?.cause ?? "Run release validation or first-success traffic so runtime proof is recorded."],
    "Open release validation",
    CONTROL_PLANE_ROUTES.releaseValidation,
  );

  /* Step 8: Go-live summary */
  const allAttentionItems = dashboard?.attention ?? [];
  const goLiveBlocked = allAttentionItems.length > 0;
  addStep(
    "go-live-summary",
    8,
    "Go-live readiness",
    "All required steps are complete and the system is ready for live traffic.",
    !goLiveBlocked,
    goLiveBlocked,
    goLiveBlocked ? allAttentionItems.map((a) => a.cause) : [],
    goLiveBlocked ? "Resolve blockers" : "Open dashboard",
    goLiveBlocked
      ? detailRouteOrFallback(allAttentionItems[0]?.to, CONTROL_PLANE_ROUTES.releaseValidation)
      : CONTROL_PLANE_ROUTES.dashboard,
  );

  return steps;
}

/**
 * Hook that orchestrates the unified setup flow state.
 *
 * Combines session state, dashboard query, and instance catalog
 * to produce a unified {@link SetupState} and {@link SetupActions}.
 */
export function useSetupFlow(): {
  state: SetupState;
  actions: SetupActions;
  loading: boolean;
  error: string;
} {
  const [searchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, selectedInstance } = useInstanceCatalog(instanceId);

  const dashboardQuery = useDashboardQuery(instanceId);
  const dashboard = dashboardQuery.data ?? null;
  const dashboardError = dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "";
  const isLoading = dashboardQuery.isLoading || loadState === "loading";

  const mustRotatePassword = session?.must_rotate_password === true && sessionReady;
  const hasInstance = selectedInstance != null || instances.length > 0;

  const setupMode: SetupMode = useMemo(() => {
    if (mustRotatePassword) {
      return "password-rotation";
    }
    if (dashboard?.empty_state != null || !hasInstance) {
      return "bootstrap";
    }
    const allDone = dashboard?.attention.length === 0;
    if (allDone && dashboard?.primary_action?.kind === "all_stable") {
      return "operational";
    }
    return "bootstrap";
  }, [mustRotatePassword, dashboard, hasInstance]);

  const steps = useMemo(
    () => deriveSteps(dashboard, mustRotatePassword, hasInstance, isLoading),
    [dashboard, mustRotatePassword, hasInstance, isLoading],
  );

  const currentStepIndex = steps.findIndex(
    (s) => s.status === "current" || s.status === "blocked",
  );
  const completeCount = steps.filter((s) => s.status === "complete").length;
  const totalCount = steps.length;

  const overallStatus = useMemo(
    () => deriveOverallStatus(steps, mustRotatePassword),
    [steps, mustRotatePassword],
  );

  const primaryAction = useMemo(() => {
    if (mustRotatePassword) {
      return { label: "Rotate password", to: "/rotate-password" };
    }
    const currentStep = steps.find(
      (s) => s.status === "current" || s.status === "blocked",
    );
    if (dashboard?.primary_action && !isSetupSurfaceRoute(dashboard.primary_action.to)) {
      return {
        label: dashboard.primary_action.action_label,
        to: dashboard.primary_action.to,
      };
    }
    if (currentStep?.actionLabel && currentStep?.actionTo) {
      return { label: currentStep.actionLabel, to: currentStep.actionTo };
    }
    return null;
  }, [mustRotatePassword, dashboard, steps]);

  const instanceLabel = selectedInstance?.display_name
    ?? selectedInstance?.instance_id
    ?? (instances.length > 0 ? instances[0]?.display_name ?? null : null);

  const error = !sessionReady
    ? "Session is not ready yet."
    : dashboardError;

  const state: SetupState = {
    mode: setupMode,
    steps,
    currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : 0,
    completeCount,
    totalCount,
    overallStatus,
    primaryAction,
    instanceLabel,
  };

  const actions: SetupActions = {
    refresh: () => {
      dashboardQuery.refetch().catch(() => {});
    },
    navigateToStep: (_stepId: string) => {
      /* Navigation is handled declaratively by the step card links. */
    },
  };

  return { state, actions, loading: isLoading, error };
}
