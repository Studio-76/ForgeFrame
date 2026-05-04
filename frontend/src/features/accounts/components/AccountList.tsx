/**
 * Account inventory table using ForgeFrame DataTable.
 *
 * @packageDocumentation
 */

import { useMemo } from "react";
import type { DataTableColumn } from "../../../components/ui/DataTable/types";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { GatewayAccount } from "../../../api/domain/accounts";
import { formatBindings, formatTimestamp, getAccountRisk, toneForAccountStatus, statusLabel } from "../helpers";

/** Props for {@link AccountList}. */
export type AccountListProps = {
  /** All accounts in the current scope. */
  accounts: GatewayAccount[];
  /** Filtered accounts to display. */
  filteredAccounts: GatewayAccount[];
  /** The currently selected account ID. */
  selectedAccountId: string | null;
  /** Called when a row is selected. */
  onSelectAccount: (accountId: string | null) => void;
  /** Instance label lookup. */
  instanceLabels: Record<string, string>;
  /** Whether the data is loading. */
  loading: boolean;
  /** Error message if data loading failed. */
  error: string | null;
  /** Called to retry loading. */
  onRetry: () => void;
};

/**
 * Account inventory table with sort, search, and selection.
 */
export function AccountList({
  accounts,
  filteredAccounts,
  selectedAccountId,
  onSelectAccount,
  instanceLabels,
  loading,
  error,
  onRetry,
}: AccountListProps) {
  const columns = useMemo<DataTableColumn<GatewayAccount>[]>(
    () => [
      {
        id: "account",
        header: "Account",
        accessorFn: (account) => (
          <div>
            <span className="font-medium text-primary">{account.label}</span>
            <div className="text-meta text-muted">{account.account_id}</div>
          </div>
        ),
        sortingKey: (account) => account.label,
        alwaysVisible: true,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (account) => (
          <StatusBadge tone={toneForAccountStatus(account.status)} status={account.status}>
            {statusLabel(account.status)}
          </StatusBadge>
        ),
        sortingKey: (account) => account.status,
      },
      {
        id: "scope",
        header: "Scope",
        accessorFn: (account) => (
          <div>
            <span className="text-primary">
              {instanceLabels[account.instance_id ?? ""] ?? account.instance_id ?? "Default instance"}
            </span>
            <div className="text-meta text-muted">tenant {account.tenant_id ?? "unknown"}</div>
          </div>
        ),
        sortingKey: (account) => instanceLabels[account.instance_id ?? ""] ?? account.instance_id ?? "",
      },
      {
        id: "bindings",
        header: "Provider bindings",
        accessorFn: (account) => (
          <div>
            <span>{formatBindings(account)}</span>
            <div className="text-meta text-muted">{account.provider_bindings.length} bound provider(s)</div>
          </div>
        ),
        sortingKey: (account) => account.provider_bindings.length,
      },
      {
        id: "keys",
        header: "Key-Anzahl",
        accessorFn: (account) => account.runtime_key_count ?? 0,
        sortingKey: (account) => account.runtime_key_count ?? 0,
        className: "ff-data-table-cell-numeric text-right",
      },
      {
        id: "activity",
        header: "Letzter Nutzung",
        accessorFn: (account) => formatTimestamp(account.last_activity_at),
        sortingKey: (account) => account.last_activity_at ?? "",
      },
      {
        id: "risk",
        header: "Risiko",
        accessorFn: (account) => {
          const risk = getAccountRisk(account);
          return (
            <div>
              <StatusBadge tone={risk.tone} status={risk.statusKey}>
                {risk.label}
              </StatusBadge>
              <div className="text-meta text-muted">{risk.detail}</div>
            </div>
          );
        },
        sortingKey: (account) => {
          const risk = getAccountRisk(account);
          return risk.level;
        },
      },
    ],
    [instanceLabels],
  );

  return (
    <DataTable
      data={filteredAccounts}
      columns={columns}
      rowKey={(account) => account.account_id}
      selectedRowId={selectedAccountId}
      onSelectedRowChange={onSelectAccount}
      onRowClick={(account) => onSelectAccount(account.account_id)}
      loading={loading}
      error={error}
      onRetry={onRetry}
      title="Runtime identity inventory"
      description="Each row captures account scope, provider bindings, key exposure, last activity, and the current operational risk."
      emptyTitle="No accounts match the current filters"
      emptyDescription="Adjust search, lifecycle, or risk filters to bring matching identities back into view."
      density="default"
      showPresets={false}
    />
  );
}
