/**
 * Plugin detail panel — sidebar showing selected plugin manifest truth,
 * security posture, and activation status.
 *
 * @packageDocumentation
 */

import { AdvancedDiagnostics } from "../../../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../../../components/ui/DetailPanel";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { PluginCatalogEntry } from "../../../api/admin/plugins";
import { securityWarnings, pluginStatusKey, formatJson } from "../helpers";

/** Props for PluginDetailPanel. */
export interface PluginDetailPanelProps {
  /** Currently selected plugin (detail or catalog entry). */
  selectedPlugin: PluginCatalogEntry | null;
}

/**
 * Sidebar detail panel showing plugin manifest truth, security posture,
 * and activation status for the currently selected plugin.
 */
export function PluginDetailPanel({
  selectedPlugin,
}: PluginDetailPanelProps) {
  if (!selectedPlugin) {
    return (
      <DetailPanel
        title="Selected plugin truth"
        description="Choose a catalog row to inspect manifest, activation, and security posture truth."
        status="none"
        statusTone="neutral"
        statusKey="partial"
        sticky
      >
        <EmptyState
          title="No plugin selected"
          description="Select a plugin to inspect manifest truth, security posture, and instance activation side by side."
          compact
        />
      </DetailPanel>
    );
  }

  return (
    <DetailPanel
      title={selectedPlugin.display_name}
      description={`${selectedPlugin.plugin_id} · ${selectedPlugin.vendor} · v${selectedPlugin.version}`}
      status={selectedPlugin.effective_status}
      statusTone={pluginStatusKey(selectedPlugin) === "blocked" ? "danger" : pluginStatusKey(selectedPlugin) === "ready" ? "success" : "warning"}
      statusKey={pluginStatusKey(selectedPlugin)}
      sticky
    >
      <div className="fg-stack">
        <section className="fg-subcard">
          <h4>Plugin vs skill boundary</h4>
          <p>Plugin: extends product surfaces or system functions.</p>
          <p>Skill: extends procedural behavior for an agent or workflow.</p>
        </section>
        <section className="fg-subcard">
          <h4>Registry truth</h4>
          <p>{selectedPlugin.status_summary}</p>
          <p>Capabilities: {selectedPlugin.capabilities.join(", ") || "none"}</p>
          <p>UI slots: {selectedPlugin.ui_slots.join(", ") || "none"}</p>
          <p>API mounts: {selectedPlugin.api_mounts.join(", ") || "none"}</p>
        </section>
        <section className="fg-subcard">
          <h4>Security posture</h4>
          {securityWarnings(selectedPlugin).length > 0 ? (
            <ul className="fg-list">
              {securityWarnings(selectedPlugin).map((warning) => (
                <li key={`sidebar-warning-${warning}`}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="fg-muted">No active security warning is visible for this plugin.</p>
          )}
        </section>
        <section className="fg-subcard">
          <h4>Activation truth</h4>
          <p>Bound instances: {selectedPlugin.bound_instance_ids.join(", ") || "none"}</p>
          <p>Enabled instances: {selectedPlugin.enabled_instance_ids.join(", ") || "none"}</p>
          <p>Current instance binding: {selectedPlugin.binding ? (selectedPlugin.binding.enabled ? "enabled" : "disabled") : "not bound"}</p>
        </section>
        <AdvancedDiagnostics title="Selected plugin raw truth" description="Raw effective config stays collapsed so the main panels remain operational first." status="advanced" statusTone="neutral">
          <pre>{formatJson(selectedPlugin)}</pre>
        </AdvancedDiagnostics>
      </div>
    </DetailPanel>
  );
}
