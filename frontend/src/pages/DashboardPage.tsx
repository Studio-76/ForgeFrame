import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  AdminApiError,
  fetchAccounts,
  fetchDashboard,
  type DashboardResponse,
  type GatewayAccount,
} from "../api/admin";
import { buildAuditHistoryPath, resolveNewestAuditHistoryPathForSession } from "../app/auditHistory";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getTenantIdFromSearchParams, withTenantScope } from "../app/tenantScope";
import { PageIntro } from "../components/PageIntro";
import { TenantScopeCard } from "../components/TenantScopeCard";

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
  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState<boolean>(false);
  const [accountsError, setAccountsError] = useState<string>("");
  const [auditHistoryRoute, setAuditHistoryRoute] = useState<string>(() => buildAuditHistoryPath({ window: "all" }));
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const tenantId = getTenantIdFromSearchParams(searchParams);
  const selectedAccount = accounts.find((account) => account.account_id === tenantId) ?? null;
  const tenantScopeLabel = tenantId ? selectedAccount?.label ?? tenantId : "Global dashboard";
  const isAdmin = session?.role === "admin";
  const canReviewApprovals = session?.role === "admin" || session?.role === "operator";
  const governanceRoute = isAdmin ? CONTROL_PLANE_ROUTES.security : CONTROL_PLANE_ROUTES.accounts;
  const governanceLabel = isAdmin ? "Policy Review" : "Runtime Access Review";
  const governanceDescription = isAdmin
    ? "Admin posture, sessions, bootstrap controls, and provider secret policy."
    : "Operator-safe governance path for accounts, keys, and downstream access posture.";
  const primaryAction = dashboard ? getPrimaryAction(dashboard, isAdmin) : null;
  const tenantFilterRequired = errorCode === "tenant_filter_required";

  const onTenantChange = (nextTenantId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextTenantId) {
      nextSearchParams.set("tenantId", nextTenantId);
    } else {
      nextSearchParams.delete("tenantId");
    }
    setSearchParams(nextSearchParams);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const payload = tenantId ? await fetchDashboard(tenantId) : await fetchDashboard();
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
  }, [tenantId]);

  useEffect(() => {
    let mounted = true;

    void resolveNewestAuditHistoryPathForSession(
      session,
      sessionReady,
      [{ query: { tenantId, window: "all" } }],
      { tenantId, window: "all" },
    ).then((route) => {
      if (mounted) {
        setAuditHistoryRoute(route);
      }
    });

    return () => {
      mounted = false;
    };
  }, [session, sessionReady, tenantId]);

  useEffect(() => {
    let mounted = true;
    const loadAccounts = async () => {
      try {
        const payload = await fetchAccounts();
        if (!mounted) {
          return;
        }
        setAccounts(payload.accounts);
        setAccountsError("");
      } catch (err) {
        if (!mounted) {
          return;
        }
        setAccountsError(err instanceof Error ? err.message : "Runtime account inventory failed to load.");
      } finally {
        if (mounted) {
          setAccountsLoaded(true);
        }
      }
    };

    void loadAccounts();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Home"
        title="ForgeGate Control Plane Dashboard"
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
            badge: isAdmin ? "Admin only" : "Operator safe",
          },
          {
            label: "Approvals",
            to: CONTROL_PLANE_ROUTES.approvals,
            description: "Shared queue for execution-run and elevated-access approval review.",
            badge: canReviewApprovals ? (isAdmin ? undefined : "Review only") : "Operator or admin",
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
        badges={[{ label: tenantId ? `Tenant scope: ${tenantScopeLabel}` : "Global dashboard", tone: tenantId ? "success" : "neutral" }]}
        note="The dashboard stays the command center. Deep links fan out by operator intent instead of forcing every alert into the same backend module."
      />
      <TenantScopeCard
        tenantId={tenantId}
        accounts={accounts}
        accountsLoaded={accountsLoaded}
        accountsError={accountsError}
        tenantFilterRequired={tenantFilterRequired}
        surfaceLabel="dashboard"
        onTenantChange={onTenantChange}
      />
      {error ? <p className="fg-danger">{error}</p> : null}
      {dashboard ? (
        <div className="fg-stack">
          {primaryAction ? (
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Primary Next Action</h3>
                  <p className="fg-muted">{primaryAction.description}</p>
                </div>
                <Link className="fg-nav-link" to={withTenantScope(primaryAction.to, tenantId)}>
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
          {isAdmin && dashboard.security ? (
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
