/**
 * Plugin inventory table — DataTable-based list of plugin catalog entries.
 *
 * Shows name, status, version/provenance, security posture, extension slots,
 * and activation counts. Clicking a row selects the plugin for detail inspection.
 *
 * @packageDocumentation
 */

import { useMemo, type ReactNode } from "react";

import { DataTable, type DataTableColumn } from "../../../components/ui/DataTable";
import { StatusBadge, type StatusTone } from "../../../components/ui/StatusBadge";
import type { PluginCatalogEntry } from "../../../api/admin/plugins";
import { securityTone, securityLabel, securityWarnings, pluginStatusKey } from "../helpers";

/** Props for PluginList. */
export interface PluginListProps {
  /** All plugin catalog entries. */
  plugins: PluginCatalogEntry[];
  /** Currently selected plugin ID. */
  selectedPluginId: string;
  /** Called when a row is clicked. */
  onSelectPlugin: (pluginId: string) => void;
  /** Whether the table is in a loading state. */
  loading: boolean;
  /** Error message if loading failed. */
  error: string | null;
  /** Retry callback. */
  onRetry?: () => void;
}

/**
 * Plugin inventory table using the ForgeFrame DataTable component.
 */
export function PluginList({
  plugins,
  selectedPluginId,
  onSelectPlugin,
  loading,
  error,
  onRetry,
}: PluginListProps) {
  const columns = useMemo<DataTableColumn<PluginCatalogEntry>[]>(() => [
    {
      id: "plugin",
      header: "Plugin",
      accessorFn: (plugin) => (
        <div>
          <strong>{plugin.display_name}</strong>
          <div className="fg-muted">{plugin.plugin_id}</div>
        </div>
      ) as ReactNode,
      enableSorting: true,
      sortingKey: (plugin) => plugin.display_name,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (plugin) => (
        <div className="fg-stack">
          <StatusBadge tone={pluginStatusKey(plugin) === "blocked" ? "danger" : pluginStatusKey(plugin) === "ready" ? "success" : "warning"} status={pluginStatusKey(plugin)}>
            {plugin.effective_status}
          </StatusBadge>
          <StatusBadge tone={plugin.status === "active" ? "success" : "warning"} status={plugin.status === "active" ? "ready" : "blocked"}>
            manifest {plugin.status}
          </StatusBadge>
        </div>
      ) as ReactNode,
      sortingKey: (plugin) => plugin.effective_status,
    },
    {
      id: "version",
      header: "Version / provenance",
      accessorFn: (plugin) => (
        <div>
          <div>v{plugin.version}</div>
          <div className="fg-muted">{plugin.vendor}</div>
        </div>
      ) as ReactNode,
      sortingKey: (plugin) => plugin.version,
    },
    {
      id: "security",
      header: "Security posture",
      accessorFn: (plugin) => (
        <div>
          <StatusBadge tone={securityTone(plugin)}>{securityLabel(plugin)}</StatusBadge>
          <div className="fg-muted">{securityWarnings(plugin)[0] ?? "No active security warning."}</div>
        </div>
      ) as ReactNode,
    },
    {
      id: "slots",
      header: "Extension slots",
      accessorFn: (plugin) => (
        <div>
          <div>UI {plugin.ui_slots.length} · API {plugin.api_mounts.length}</div>
          <div className="fg-muted">{plugin.runtime_surfaces.join(", ") || "No runtime surface declared"}</div>
        </div>
      ) as ReactNode,
      sortingKey: (plugin) => plugin.ui_slots.length + plugin.api_mounts.length,
    },
    {
      id: "bindings",
      header: "Activated in instances",
      accessorFn: (plugin) => (
        <div>
          <div>{plugin.enabled_binding_count}/{plugin.binding_count}</div>
          <div className="fg-muted">{plugin.enabled_instance_ids.join(", ") || "No enabled instance binding"}</div>
        </div>
      ) as ReactNode,
      sortingKey: (plugin) => plugin.enabled_binding_count,
    },
  ], []);

  return (
    <DataTable
      data={plugins}
      columns={columns}
      rowKey={(plugin) => plugin.plugin_id}
      selectedRowId={selectedPluginId || null}
      onSelectedRowChange={(rowId) => {
        if (rowId) onSelectPlugin(rowId);
      }}
      onRowClick={(plugin) => onSelectPlugin(plugin.plugin_id)}
      loading={loading}
      error={error}
      onRetry={onRetry}
      title="Extension catalog"
      description="Catalog truth separates registry status, provenance, security posture, extension slots, and multi-instance activation counts."
      emptyTitle="No plugins registered"
      emptyDescription="Register the first plugin manifest before instance activation can happen."
      showSearch={false}
      showPresets={false}
      enableColumnVisibility={true}
    />
  );
}
