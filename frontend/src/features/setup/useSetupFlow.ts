import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  type DashboardAttentionItem,
  type DashboardResponse,
} from "../../api/admin";
import { useDashboardQuery } from "../../api/adminQueries";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import type { OverallStatus, SetupActions, SetupMode, SetupState, SetupStep, SetupStepStatus } from "./types";

/**
 * Map a dashboard attention item severity to a setup step status.
 */
function severityToSetupStatus(severity: DashboardAttentionItem["severity"]): SetupStepStatus {
  if (severity === "critical") {
    return "blocked";
  }
  if (severity === "warning") {
    return "current";
  }
  return "upcoming";
}

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

  /* Step 2: Configure instance & scope (from dashboard empty_state / attention) */
  const needsInstance = !hasInstance || dashboard?.empty_state != null;
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
  const providerAttention = dashboard?.attention.find(
    (a) => a.axis === "provider" || a.title.toLowerCase().includes("provider"),
  );
  const providerBlockers: string[] = [];
  if (providerAttention) {
    providerBlockers.push(providerAttention.cause);
  }
  const hasProvider = dashboard?.attention.some(
    (a) => a.axis === "provider" && a.severity !== "critical",
  );
  addStep(
    "connect-provider",
    3,
    "Connect provider",
    "Connect a provider target so live traffic can flow through the runtime.",
    false,
    providerAttention?.severity === "critical",
    providerBlockers.length > 0
      ? providerBlockers
      : ["A provider must be connected before live traffic can flow."],
    "Open providers",
    "/providers",
  );

  /* Step 4: Configure routing */
  const routingAttention = dashboard?.attention.find(
    (a) => a.axis === "routing" || a.axis === "routing_queue",
  );
  addStep(
    "configure-routing",
    4,
    "Configure routing",
    "Choose simple (local-first) or premium (OAuth-capable) routing defaults.",
    false,
    routingAttention?.severity === "critical",
    routingAttention ? [routingAttention.cause] : [],
    "Open routing",
    "/routing",
  );

  /* Step 5: Issue runtime key */
  const keyAttention = dashboard?.attention.find(
    (a) => a.title.toLowerCase().includes("key") || a.axis === "security",
  );
  addStep(
    "issue-runtime-key",
    5,
    "Issue runtime key",
    "Create an active runtime key so the runtime can authenticate API requests.",
    false,
    keyAttention?.severity === "critical",
    keyAttention ? [keyAttention.cause] : [],
    "Open API keys",
    "/api-keys",
  );

  /* Step 6: Verify FQDN/TLS */
  const tlsAttention = dashboard?.attention.find(
    (a) => a.axis === "readiness" || a.title.toLowerCase().includes("tls") || a.title.toLowerCase().includes("fqdn"),
  );
  addStep(
    "verify-tls",
    6,
    "Verify FQDN and TLS",
    "Confirm the public FQDN resolves, the HTTPS listener is active, and a valid certificate is installed.",
    false,
    tlsAttention?.severity === "critical",
    tlsAttention ? [tlsAttention.cause] : [],
    "Open ingress/TLS",
    "/ingress-tls",
  );

  /* Step 7: Run readiness probe */
  addStep(
    "run-readiness-probe",
    7,
    "Run readiness probe",
    "Send a test request to /v1/models and /v1/chat to confirm the runtime is operational.",
    false,
    false,
    [],
    "Run probe",
    "/release-validation",
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
    goLiveBlocked ? allAttentionItems[0]?.to ?? "/dashboard" : "/dashboard",
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
    if (dashboard?.primary_action) {
      return {
        label: dashboard.primary_action.action_label,
        to: dashboard.primary_action.to,
      };
    }
    const currentStep = steps.find(
      (s) => s.status === "current" || s.status === "blocked",
    );
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
