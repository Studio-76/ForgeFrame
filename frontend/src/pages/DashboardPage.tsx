import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  AdminApiError,
  fetchDashboard,
  type DashboardAttentionItem,
  type DashboardPrimaryAction,
  type DashboardResponse,
} from "../api/admin";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { StatusBadge } from "../components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState, PermissionState, BlockedState } from "../components/ui/StateBlocks";

function getErrorCode(error: unknown): string | null {
  if (error instanceof AdminApiError) {
    return error.code ?? null;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function severityTone(severity: DashboardAttentionItem["severity"]): "danger" | "warning" | "info" {
  if (severity === "critical") {
    return "danger";
  }
  if (severity === "warning") {
    return "warning";
  }
  return "info";
}

function primaryActionHint(primaryActionKind: DashboardPrimaryAction["kind"]): string {
  switch (primaryActionKind) {
    case "go_live_blocker":
      return "Release remains blocked until this route is resolved.";
    case "provider_configuration":
      return "No stable runtime path exists yet for this scope.";
    case "security_closure":
      return "Security posture needs closure before the stack is stable.";
    case "runtime_stability":
      return "Runtime signals need follow-up before trusting production traffic.";
    case "routing_queue_pressure":
      return "Routing and queue pressure is delaying normal flow.";
    case "cost_pressure":
      return "Cost guardrails are currently shaping runtime behavior.";
    case "all_stable":
    default:
      return "No active blocker is currently detected.";
  }
}

function buildPermissionMessage({
  sessionReady,
  isViewer,
  isReadOnly,
  canReadExecution,
  canReadRouting,
  canOpenSecurity,
}: {
  sessionReady: boolean;
  isViewer: boolean;
  isReadOnly: boolean;
  canReadExecution: boolean;
  canReadRouting: boolean;
  canOpenSecurity: boolean;
}): string | null {
  if (!sessionReady) {
    return null;
  }

  const messages: string[] = [];
  if (isViewer) {
    messages.push("Viewer sessions can read the command center, but repair routes may stop on permission gates.");
  }
  if (isReadOnly) {
    messages.push("This session is read-only, so corrective flows stay review-only.");
  }
  if (!canReadExecution) {
    messages.push("Queue and dispatch repair routes require operator or admin execution access.");
  }
  if (!canReadRouting) {
    messages.push("Routing controls are not available on this session.");
  }
  if (!canOpenSecurity) {
    messages.push("Security closure remains outside the current session scope.");
  }
  return messages.length > 0 ? messages.join(" ") : null;
}

function buildPermissionActions({
  canManageSecurity,
  canOpenSecurity,
}: {
  canManageSecurity: boolean;
  canOpenSecurity: boolean;
}) {
  return [
    {
      to: CONTROL_PLANE_ROUTES.accounts,
      label: "Review runtime access",
    },
    {
      to: canManageSecurity || canOpenSecurity ? CONTROL_PLANE_ROUTES.security : CONTROL_PLANE_ROUTES.logs,
      label: canManageSecurity ? "Close security posture" : canOpenSecurity ? "Review security posture" : "Review live evidence",
    },
  ];
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const instanceScopeLabel = selectedInstance?.display_name ?? selectedInstance?.instance_id ?? "Default instance path";
  const canManageSecurity = sessionHasAnyInstancePermission(session, "security.write");
  const canOpenSecurity = canManageSecurity || sessionHasAnyInstancePermission(session, "security.read") || roleAllows(session?.role, "admin");
  const canReadExecution = sessionHasAnyInstancePermission(session, "execution.read");
  const canReadRouting = sessionHasAnyInstancePermission(session, "routing.read");
  const isViewer = session?.role === "viewer";
  const permissionActions = buildPermissionActions({ canManageSecurity, canOpenSecurity });
  const permissionMessage = buildPermissionMessage({
    sessionReady,
    isViewer,
    isReadOnly: session?.read_only === true,
    canReadExecution,
    canReadRouting,
    canOpenSecurity,
  });
  const instanceFilterRequired = errorCode === "instance_scope_not_found";

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
    let mounted = true;
    const load = async () => {
      try {
        const payload = instanceId ? await fetchDashboard(instanceId) : await fetchDashboard();
        if (!mounted) {
          return;
        }
        setDashboard(payload);
        setError("");
        setErrorCode(null);
      } catch (err) {
        if (!mounted) {
          return;
        }
        setDashboard(null);
        setErrorCode(getErrorCode(err));
        setError(err instanceof Error ? err.message : "Dashboard loading failed.");
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Home"
        title="Command Center"
        description="Critical state, next action, and release posture for the selected scope."
        question="What blocks go-live right now, and which route should open next?"
      />

      {error && instanceFilterRequired ? (
        <BlockedState
          title="Selected instance is outside the current dashboard scope"
          description={error}
          status="blocked"
          action={(
            <div className="fg-actions">
              <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.dashboard}>
                Reset to default scope
              </Link>
              <Link className="fg-nav-link" to={CONTROL_PLANE_ROUTES.instances}>
                Review instance inventory
              </Link>
            </div>
          )}
        />
      ) : null}
      {error && !instanceFilterRequired ? (
        <ErrorState
          title="Dashboard loading failed"
          description={error}
          action={(
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>
              Review diagnostics
            </Link>
          )}
        />
      ) : null}
      {!dashboard && !error ? (
        <LoadingState
          title="Loading command-center truth"
          description="ForgeFrame is restoring the current next action, blockers, and release posture for the selected scope."
        />
      ) : null}

      {dashboard ? (
        <div className="fg-stack">
          <ActionBar
            title="Primary next action"
            description={dashboard.primary_action.description}
            actions={(
              <Link className="fg-nav-link" to={withInstanceScope(dashboard.primary_action.to, instanceId)}>
                {dashboard.primary_action.action_label}
              </Link>
            )}
          >
            <div className="ff-dashboard-primary">
              <span className="ff-dashboard-primary-label">Do this now</span>
              <div className="ff-dashboard-inline-status">
                <StatusBadge status={dashboard.primary_action.status}>
                  {formatStatusLabel(dashboard.primary_action.status)}
                </StatusBadge>
                <strong>{dashboard.primary_action.title}</strong>
              </div>
              <p>{primaryActionHint(dashboard.primary_action.kind)}</p>
            </div>
          </ActionBar>

          <section className="ff-dashboard-scope-bar" aria-label="Dashboard scope">
            <div className="ff-dashboard-scope-copy">
              <span className="ff-dashboard-scope-label">Instance scope</span>
              <strong>{instanceScopeLabel}</strong>
              <p>
                {selectedInstance
                  ? `Tenant ${selectedInstance.tenant_id} · execution ${selectedInstance.company_id} · deployment ${selectedInstance.deployment_mode} · exposure ${selectedInstance.exposure_mode}.`
                  : "Dashboard is following the default instance path until a concrete instance is selected."}
              </p>
            </div>
            <div className="ff-dashboard-scope-controls">
              <label>
                <span>Instance</span>
                <select
                  value={instanceId ?? ""}
                  disabled={loadState === "loading" && instances.length === 0}
                  onChange={(event) => onInstanceChange(event.target.value || null)}
                >
                  <option value="">Default instance path</option>
                  {instances.map((instance) => (
                    <option key={instance.instance_id} value={instance.instance_id}>
                      {instance.display_name} ({instance.instance_id})
                    </option>
                  ))}
                </select>
              </label>
              {instanceId ? (
                <button type="button" onClick={() => onInstanceChange(null)}>
                  Clear scope
                </button>
              ) : null}
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.instances, instanceId)}>
                Manage instances
              </Link>
            </div>
            {loadState === "loading" && instances.length === 0 ? <p className="fg-muted">Loading instance inventory.</p> : null}
            {loadState === "success" && instances.length === 0 ? <p className="fg-muted">No instances are registered yet.</p> : null}
            {instancesError ? <p className="fg-danger">{instancesError}</p> : null}
            {instanceId && !selectedInstance ? (
              <p className="fg-danger">
                The selected instance is not present in the current registry. Open the instance inventory or clear the scope before trusting this view.
              </p>
            ) : null}
          </section>

          {permissionMessage ? (
            <PermissionState
              title="Some repair routes are permission-limited"
              description={permissionMessage}
              action={(
                <div className="fg-actions">
                  {permissionActions.map((action) => (
                    <Link key={`${action.to}-${action.label}`} className="fg-nav-link" to={withInstanceScope(action.to, instanceId)}>
                      {action.label}
                    </Link>
                  ))}
                </div>
              )}
            />
          ) : null}

          {dashboard.empty_state ? (
            <EmptyState
              title={dashboard.empty_state.title}
              description={dashboard.empty_state.description}
              action={(
                <Link className="fg-nav-link" to={withInstanceScope(dashboard.empty_state.to, instanceId)}>
                  {dashboard.empty_state.action_label}
                </Link>
              )}
            />
          ) : (
            <div className="ff-dashboard-layout">
              <article className="ff-dashboard-attention">
                <div className="ff-dashboard-section-header">
                  <div>
                    <h3>Priority attention list</h3>
                    <p>Each item includes severity, cause, affected axis, and one direct repair route.</p>
                  </div>
                  <StatusBadge status={dashboard.attention.length > 0 ? "degraded" : "ready"}>
                    {dashboard.attention.length > 0 ? `${dashboard.attention.length} active` : "all stable"}
                  </StatusBadge>
                </div>

                {dashboard.attention.length === 0 ? (
                  <div className="ff-dashboard-attention-empty">
                    <strong>No blocking attention item is active.</strong>
                    <p>The command center is not seeing a current go-live, runtime, routing, or cost blocker for this scope.</p>
                  </div>
                ) : (
                  <ol className="ff-dashboard-attention-list">
                    {dashboard.attention.map((item, index) => (
                      <li key={item.id} className="ff-dashboard-attention-item">
                        <div className="ff-dashboard-attention-rank" aria-hidden="true">{index + 1}</div>
                        <div className="ff-dashboard-attention-content">
                          <div className="ff-dashboard-attention-meta">
                            <div className="ff-dashboard-attention-title-row">
                              <span className="fg-pill" data-tone={severityTone(item.severity)}>
                                {item.severity}
                              </span>
                              <StatusBadge status={item.status}>
                                {formatStatusLabel(item.status)}
                              </StatusBadge>
                            </div>
                            <span className="ff-dashboard-axis">{item.axis}</span>
                          </div>
                          <strong>{item.title}</strong>
                          <p>
                            <span className="ff-dashboard-cause-label">Cause:</span> {item.cause}
                          </p>
                          <Link className="fg-nav-link" to={withInstanceScope(item.to, instanceId)}>
                            {item.action_label}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </article>

              <section className="ff-dashboard-status-board" aria-label="Command center status areas">
                <div className="ff-dashboard-section-header">
                  <div>
                    <h3>Operational posture</h3>
                    <p>Readiness, Security, Runtime, Routing/Queue, and Cost with next action per area.</p>
                  </div>
                  <StatusBadge status={dashboard.attention.length > 0 ? "degraded" : "ready"}>
                    {dashboard.sections.length} areas
                  </StatusBadge>
                </div>
                <ul className="ff-dashboard-status-list">
                  {dashboard.sections.map((section) => (
                    <li key={section.key} className="ff-dashboard-status-item">
                      <div className="ff-dashboard-status-topline">
                        <h4>{section.title}</h4>
                        <StatusBadge status={section.status}>
                          {formatStatusLabel(section.status)}
                        </StatusBadge>
                      </div>
                      <p>{section.reason}</p>
                      <p className="ff-dashboard-next-action">
                        Next action:{" "}
                        <Link className="fg-nav-link" to={withInstanceScope(section.to, instanceId)}>
                          {section.action_label}
                        </Link>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          <AdvancedDiagnostics
            title="Advanced diagnostics"
            description="Raw command-center payload for operator troubleshooting and handoff."
            status={dashboard.attention.length > 0 ? "degraded" : "ready"}
            statusKey={dashboard.attention.length > 0 ? "degraded" : "ready"}
          >
            <pre>{JSON.stringify(dashboard, null, 2)}</pre>
          </AdvancedDiagnostics>
        </div>
      ) : null}
    </section>
  );
}
