/**
 * Account detail panel — lifecycle, bindings, risk, and actions.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import type { GatewayAccount } from "../../../api/domain/accounts";
import {
  formatBindings,
  formatTimestamp,
  getAccountRisk,
  lifecycleSummary,
  statusLabel,
  toneForAccountStatus,
} from "../helpers";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Button } from "../../../components/ui/Button";

/** Props for {@link AccountDetailPanel}. */
export type AccountDetailPanelProps = {
  /** The selected account. */
  account: GatewayAccount;
  /** Resolved instance label for the account. */
  instanceLabel: string;
  /** Whether the current session can mutate. */
  canMutate: boolean;
  /** Whether a save operation is in progress. */
  saving: boolean;
  /** Called to edit the account. */
  onEdit: () => void;
  /** Called to change the account lifecycle status. */
  onLifecycleChange: (status: GatewayAccount["status"]) => void;
  /** Route to the API keys page for this account. */
  keysRoute: string;
  /** Route to the audit history for this account. */
  auditRoute: string;
  /** Route to the affected instance. */
  instanceRoute: string;
};

/**
 * Detail panel showing identity, bindings, lifecycle, and actions.
 */
export function AccountDetailPanel({
  account,
  instanceLabel,
  canMutate,
  saving,
  onEdit,
  onLifecycleChange,
  keysRoute,
  auditRoute,
  instanceRoute,
}: AccountDetailPanelProps) {
  const risk = getAccountRisk(account);

  return (
    <div className="fg-stack">
      <div className="flex items-center gap-2 mb-2">
        <Link className="fg-nav-link" to={keysRoute}>API Keys</Link>
        <Link className="fg-nav-link" to={auditRoute}>Audit History</Link>
        <Link className="fg-nav-link" to={instanceRoute}>Affected Instance</Link>
        {canMutate ? (
          <Button variant="secondary" density="compact" onPress={onEdit} className="ml-auto">
            Edit account
          </Button>
        ) : null}
      </div>

      {/* ── Identity and scope ── */}
      <section className="fg-subcard">
        <h4>Identity and scope</h4>
        <p>Instance: {instanceLabel}</p>
        <p>Tenant: {account.tenant_id ?? "unknown"}</p>
        <p>Lifecycle: {statusLabel(account.status)}</p>
        <p>Last runtime usage: {formatTimestamp(account.last_activity_at)}</p>
      </section>

      {/* ── Provider bindings and keys ── */}
      <section className="fg-subcard">
        <h4>Provider bindings and keys</h4>
        <p>Bindings: {formatBindings(account)}</p>
        <p>Runtime keys: {account.runtime_key_count ?? 0}</p>
        <p className="text-meta text-muted">{risk.detail}</p>
      </section>

      {/* ── Lifecycle actions ── */}
      <section className="fg-subcard">
        <h4>Lifecycle actions</h4>
        <p className="text-meta text-muted">{lifecycleSummary(account)}</p>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge tone={toneForAccountStatus(account.status)} status={account.status}>
            {statusLabel(account.status)}
          </StatusBadge>
        </div>
        {canMutate ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {account.status !== "active" ? (
              <Button
                variant="secondary"
                density="compact"
                isDisabled={saving}
                onPress={() => onLifecycleChange("active")}
              >
                Activate account
              </Button>
            ) : null}
            {account.status !== "suspended" ? (
              <Button
                variant="secondary"
                density="compact"
                isDisabled={saving}
                onPress={() => onLifecycleChange("suspended")}
              >
                Suspend temporarily
              </Button>
            ) : null}
            {account.status !== "disabled" ? (
              <Button
                variant="secondary"
                density="compact"
                isDisabled={saving}
                onPress={() => onLifecycleChange("disabled")}
              >
                Deactivate account
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-meta text-muted mt-2">
            Lifecycle mutations are hidden in read-only sessions so the page does not imply unavailable actions.
          </p>
        )}
      </section>

      {/* ── Archive unsupported notice ── */}
      <div className="ff-state-block" data-state="unsupported">
        <strong>Archive lifecycle unsupported</strong>
        <p>
          The backend currently persists `active`, `suspended`, and `disabled` only.
          Archiving is therefore shown as unsupported rather than as a dead button.
        </p>
        <span className="fg-pill" data-tone="neutral">unsupported</span>
      </div>

      {/* ── Notes ── */}
      <section className="fg-subcard">
        <h4>Notes</h4>
        <p>{account.notes || "No operator notes recorded for this identity."}</p>
      </section>
    </div>
  );
}
