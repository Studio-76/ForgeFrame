/**
 * ApiKeyList — DataTable-based runtime key inventory.
 *
 * @packageDocumentation
 */

import { useMemo, type ReactNode } from "react";

import type { RuntimeKey } from "../../../api/domain/runtime-keys";
import type { GatewayAccount } from "../../../api/domain/accounts";
import { DataTable } from "../../../components/ui/DataTable";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { DataTableColumn } from "../../../components/ui/DataTable";
import {
  formatTimestamp,
  formatAllowedPaths,
  rotationLabel,
  toneForKeyStatus,
  statusLabel,
} from "../helpers";
import type { LoadState } from "../types";

/**
 * Props for the ApiKeyList component.
 */
export type ApiKeyListProps = {
  /** Visible keys after filtering. */
  keys: RuntimeKey[];
  /** Currently selected key ID. */
  selectedKeyId: string | null;
  /** Called when selection changes. */
  onSelectedKeyChange: (keyId: string | null) => void;
  /** Data load state. */
  loadState: LoadState;
  /** Error message when load failed. */
  error?: string;
  /** Retry callback. */
  onRetry?: () => void;
  /** Accounts by ID lookup. */
  accountsById: Record<string, GatewayAccount>;
  /** Instance labels by ID lookup. */
  instanceLabels: Record<string, string>;
  /** Total key count before filtering. */
  totalKeys: number;
  /** Whether a focused account is active. */
  focusedAccountId?: string | null;
};

/**
 * Runtime key inventory table using DataTable.
 */
export function ApiKeyList({
  keys,
  selectedKeyId,
  onSelectedKeyChange,
  loadState,
  error,
  onRetry,
  accountsById,
  instanceLabels,
  totalKeys,
  focusedAccountId,
}: ApiKeyListProps) {
  const columns = useMemo<DataTableColumn<RuntimeKey>[]>(() => [
    {
      id: "label",
      header: "Label",
      accessorFn: (key: RuntimeKey): ReactNode => (
        <div>
          <div className="font-medium">{key.label}</div>
          <div className="text-meta text-muted">{key.prefix}</div>
        </div>
      ),
      sortingKey: (key: RuntimeKey) => key.label,
    },
    {
      id: "account",
      header: "Account",
      accessorFn: (key: RuntimeKey): ReactNode => {
        const account = key.account_id ? accountsById[key.account_id] : null;
        return (
          <div>
            <div>{account?.label ?? key.account_id ?? "No account"}</div>
            <div className="text-meta text-muted">{key.account_id ?? "unbound"}</div>
          </div>
        );
      },
      sortingKey: (key: RuntimeKey) => {
        const account = key.account_id ? accountsById[key.account_id] : null;
        return account?.label ?? key.account_id ?? "";
      },
    },
    {
      id: "scope",
      header: "Instance Scope",
      accessorFn: (key: RuntimeKey): ReactNode => (
        <div>
          <div>{key.instance_id ? (instanceLabels[key.instance_id] ?? key.instance_id) : "Default instance path"}</div>
          <div className="text-meta text-muted">tenant {key.tenant_id ?? "unknown"}</div>
        </div>
      ),
      sortingKey: (key: RuntimeKey) => key.instance_id ?? "",
    },
    {
      id: "paths",
      header: "Erlaubte Pfade",
      accessorFn: (key: RuntimeKey): ReactNode => (
        <div>
          <div>{formatAllowedPaths(key)}</div>
          <div className="text-meta text-muted">default {key.default_request_path ?? "smart_routing"}</div>
        </div>
      ),
      sortingKey: (key: RuntimeKey) => formatAllowedPaths(key),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (key: RuntimeKey): ReactNode => (
        <StatusBadge tone={toneForKeyStatus(key.status)} status={key.status}>
          {statusLabel(key.status)}
        </StatusBadge>
      ),
      sortingKey: (key: RuntimeKey) => key.status,
    },
    {
      id: "created",
      header: "Created",
      accessorFn: (key: RuntimeKey): ReactNode => formatTimestamp(key.created_at),
      sortingKey: (key: RuntimeKey) => key.created_at,
    },
    {
      id: "lastUsed",
      header: "Last Used",
      accessorFn: (key: RuntimeKey): ReactNode => formatTimestamp(key.last_used_at),
      sortingKey: (key: RuntimeKey) => key.last_used_at ?? "",
    },
    {
      id: "rotation",
      header: "Rotation",
      accessorFn: (key: RuntimeKey): ReactNode => rotationLabel(key),
      sortingKey: (key: RuntimeKey) => key.rotated_from ?? "",
    },
  ], [accountsById, instanceLabels]);

  return (
    <DataTable<RuntimeKey>
      title="Runtime key inventory"
      data={keys}
      columns={columns}
      rowKey={(row) => row.key_id}
      selectedRowId={selectedKeyId}
      onSelectedRowChange={(id) => onSelectedKeyChange(id)}
      onRowClick={(row) => onSelectedKeyChange(row.key_id)}
      loading={loadState === "loading"}
      error={error ?? null}
      onRetry={onRetry}
      emptyTitle={focusedAccountId ? "No keys match the focused account" : "No keys match the current filters"}
      emptyDescription={focusedAccountId
        ? "This account currently has no runtime keys inside the selected instance scope."
        : "Adjust search or lifecycle filters to bring matching keys back into view."}
      showSearch={false}
      showPresets={false}
      enableColumnVisibility={false}
      enablePagination={keys.length > 10}
    />
  );
}
