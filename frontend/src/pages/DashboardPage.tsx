import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  AdminApiError,
  fetchDashboard,
  type DashboardResponse,
} from "../api/admin";
import { buildAuditHistoryPath, resolveNewestAuditHistoryPathForSession } from "../app/auditHistory";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type PrimaryAction = {
  title: string;
  description: string;
  to: string;
};

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

function hasSecurityAttention(security?: Record<string, string | number | boolean>): boolean {
  if (!security) {
    return false;
  }
  return Boolean(security.default_password_in_use) || Boolean(security.must_rotate_password) || !Boolean(security.admin_auth_enabled);
}

function getPrimaryAction(dashboard: DashboardResponse, isAdmin: boolean): PrimaryAction {
  if (dashboard.needs_attention.length > 0) {
    return {
      title: "Review provider health and readiness",
      description: `${dashboard.needs_attention.length} provider routes need attention, so the fastest next check is the live provider health surface.`,
      to: CONTROL_PLANE_ROUTES.providerHealthRuns,
    };
  }

  if (dashboard.alerts.length > 0) {
    return {
      title: "Work the active runtime alerts",
      description: `${dashboard.alerts.length} alert signals are active. Start on the shared errors and activity surface before narrowing further.`,
      to: CONTROL_PLANE_ROUTES.logs,
    };
  }

  if (isAdmin && hasSecurityAttention(dashboard.security)) {
    return {
      title: "Tighten governance posture",
      description: "Security bootstrap still has open posture work. Admin review belongs in Security & Policies before the next operating cycle.",
      to: CONTROL_PLANE_ROUTES.security,
    };
  }

  return {
    title: "Confirm go-live readiness",
    description: "No active alert pressure is visible, so the next check is whether onboarding and provider verification are still aligned for runtime traffic.",
    to: CONTROL_PLANE_ROUTES.onboarding,
  };
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [auditHistoryRoute, setAuditHistoryRoute] = useState<string>(() => buildAuditHistoryPath({ window: "all" }));
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const instanceScopeLabel = selectedInstance?.display_name ?? selectedInstance?.instance_id ?? "Default instance path";
  const canManageSecurity = sessionHasAnyInstancePermission(session, "security.write");
  const isAdmin = roleAllows(session?.role, "admin");
  const canReviewApprovals = sessionHasAnyInstancePermission(session, "approvals.read");
  const governanceRoute = canManageSecurity ? CONTROL_PLANE_ROUTES.security : CONTROL_PLANE_ROUTES.accounts;
  const governanceLabel = canManageSecurity ? "Policy Review" : "Runtime Access Review";
  const governanceDescription = canManageSecurity
    ? "Admin posture, sessions, bootstrap controls, and provider secret policy."
    : "Operator-safe governance path for accounts, keys, and downstream access posture.";
  const primaryAction = dashboard ? getPrimaryAction(dashboard, canManageSecurity) : null;
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

  useEffect(() => {
    let mounted = true;

    void resolveNewestAuditHistoryPathForSession(
      session,
      sessionReady,
      [{ query: { instanceId, window: "all" } }],
      { instanceId, window: "all" },
    ).then((route) => {
      if (mounted) {
        setAuditHistoryRoute(route);
      }
    });

    return () => {
      mounted = false;
    };
  }, [session, sessionReady, instanceId]);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Home"
        title="ForgeFrame Control Plane Dashboard"
        description="KPIs, alerts, governance posture, and needs-attention signals on the command-center route."
        question="What needs attention first, and which route should you open next?"
        links={[
          {
            label: "Onboarding",
            to: CONTROL_PLANE_ROUTES.onboarding,
            description: "Go-live readiness, bootstrap steps, and provider verification.",
          },
          {
            label: governanceLabel,
            to: governanceRoute,
            description: governanceDescription,
            badge: canManageSecurity ? "Admin only" : "Operator safe",
          },
          {
            label: "Approvals",
            to: CONTROL_PLANE_ROUTES.approvals,
            description: "Shared queue for execution-run and elevated-access approval review.",
            badge: canReviewApprovals ? (canManageSecurity ? undefined : "Review only") : "Operator or admin",
            disabled: !canReviewApprovals,
          },
          {
            label: "Operations Triage",
            to: CONTROL_PLANE_ROUTES.logs,
            description: "Current alerts, error shape, and runtime activity.",
          },
          {
            label: "Audit History",
            to: auditHistoryRoute,
            description: "Recent evidence and audit history on the shared logs route.",
          },
        ]}
        badges={[{ label: selectedInstance ? `Instance scope: ${instanceScopeLabel}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" }]}
        note="The dashboard stays the command center. Deep links fan out by operator intent instead of forcing every alert into the same backend module."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="dashboard truth"
        onInstanceChange={onInstanceChange}
      />

      {error && !instanceFilterRequired ? <p className="fg-danger">{error}</p> : null}
      {dashboard ? (
        <div className="fg-stack">
          {primaryAction ? (
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Primary Next Action</h3>
                  <p className="fg-muted">{primaryAction.description}</p>
                </div>
                <Link className="fg-nav-link" to={withInstanceScope(primaryAction.to, instanceId)}>
                  Open route
                </Link>
              </div>
              <p>
                <strong>{primaryAction.title}</strong>
              </p>
            </article>
          ) : null}
          <div className="fg-grid fg-grid-compact">
            {Object.entries(dashboard.kpis).map(([key, value]) => (
              <article key={key} className="fg-kpi">
                <span className="fg-muted">{key}</span>
                <strong className="fg-kpi-value">{value}</strong>
              </article>
            ))}
          </div>
          <div className="fg-grid">
            <article className="fg-card">
              <h3>Alerts</h3>
              <ul className="fg-list">
                {dashboard.alerts.length === 0 ? <li>No active alerts.</li> : null}
                {dashboard.alerts.map((item, index) => (
                  <li key={`${String(item.type)}-${index}`}>
                    {String(item.severity)} · {String(item.type)} · {String(item.message)}
                  </li>
                ))}
              </ul>
            </article>
            <article className="fg-card">
              <h3>Needs Attention</h3>
              <ul className="fg-list">
                {dashboard.needs_attention.length === 0 ? <li>No provider flagged.</li> : null}
                {dashboard.needs_attention.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          </div>
          {canManageSecurity && dashboard.security ? (
            <article className="fg-card">
              <h3>Security Bootstrap</h3>
              <ul className="fg-list">
                {Object.entries(dashboard.security).map(([key, value]) => (
                  <li key={key}>
                    {key}: {String(value)}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
