import { Link } from "react-router-dom";

import type { GatewayAccount } from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { withTenantScope } from "../app/tenantScope";

type TenantScopeCardProps = {
  tenantId: string | null;
  accounts: GatewayAccount[];
  accountsLoaded: boolean;
  accountsError: string;
  tenantFilterRequired: boolean;
  surfaceLabel: string;
  onTenantChange: (tenantId: string | null) => void;
};

function getScopeTone(tenantId: string | null, tenantFilterRequired: boolean): "success" | "warning" | "neutral" {
  if (tenantFilterRequired) {
    return "warning";
  }
  if (tenantId) {
    return "success";
  }
  return "neutral";
}

export function TenantScopeCard({
  tenantId,
  accounts,
  accountsLoaded,
  accountsError,
  tenantFilterRequired,
  surfaceLabel,
  onTenantChange,
}: TenantScopeCardProps) {
  const selectedAccount = accounts.find((account) => account.account_id === tenantId) ?? null;
  const selectedLabel = selectedAccount?.label ?? tenantId ?? "All runtime tenants";
  const scopeTone = getScopeTone(tenantId, tenantFilterRequired);
  const hasAccountOptions = accounts.length > 0;

  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Runtime Tenant Scope</h3>
          <p className="fg-muted">
            ForgeGate keys tenant-scoped observability to runtime accounts. Pick the account scope when mixed tenant history makes the shared
            {` ${surfaceLabel} `}view ambiguous.
          </p>
        </div>
        <span className="fg-pill" data-tone={scopeTone}>
          {tenantId ? `Scoped to ${selectedLabel}` : "Global scope"}
        </span>
      </div>

      <div className="fg-inline-form">
        <label>
          Runtime account
          <select
            value={tenantId ?? ""}
            disabled={!accountsLoaded && !hasAccountOptions}
            onChange={(event) => onTenantChange(event.target.value || null)}
          >
            <option value="">All runtime tenants</option>
            {accounts.map((account) => (
              <option key={account.account_id} value={account.account_id}>
                {account.label} ({account.account_id})
              </option>
            ))}
          </select>
        </label>
        {tenantId ? (
          <button type="button" onClick={() => onTenantChange(null)}>
            Clear scope
          </button>
        ) : null}
        <Link className="fg-nav-link" to={withTenantScope(CONTROL_PLANE_ROUTES.accounts, tenantId)}>
          Open Accounts
        </Link>
      </div>

      {tenantFilterRequired ? (
        <p className="fg-note fg-mt-md">
          Mixed runtime history spans multiple tenants, so ForgeGate will not invent a global {surfaceLabel} snapshot. Select a runtime account
          scope to continue.
        </p>
      ) : tenantId ? (
        <p className="fg-note fg-mt-md">
          This {surfaceLabel} view is filtered to the selected runtime tenant. Shared provider, error, and audit evidence should now match that
          account boundary.
        </p>
      ) : (
        <p className="fg-note fg-mt-md">
          Global scope stays available when the recorded history is unambiguous. Switch to a runtime account scope when you need tenant-specific
          KPIs, alerts, or audit evidence.
        </p>
      )}

      {!accountsLoaded && !hasAccountOptions ? <p className="fg-muted">Loading runtime account inventory for the tenant scope selector.</p> : null}
      {accountsLoaded && !hasAccountOptions ? (
        <p className="fg-muted">
          No runtime accounts exist yet, so there is no tenant-specific scope to select. Create one on Accounts if this environment needs
          per-tenant observability slices.
        </p>
      ) : null}
      {accountsError ? <p className="fg-danger">{accountsError}</p> : null}
      {tenantId && !selectedAccount ? (
        <p className="fg-danger">
          The selected tenant scope is not present in the current runtime account inventory. Clear the scope or confirm the account still exists.
        </p>
      ) : null}
    </article>
  );
}
