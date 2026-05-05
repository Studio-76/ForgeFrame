/**
 * Grouped instance action controls.
 * Separates primary remediation actions from related pages and advanced actions.
 *
 * @packageDocumentation
 */

import type { InstanceRecord } from "../../api/domain/instances";
import { buildAgentsPath } from "../../app/workInteractionRoutes";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import { ContextNavStrip } from "../../components/ui";
import { getInstanceRelatedLinks } from "./utils";

/**
 * Props for the InstanceActionBar component.
 */
export type InstanceActionBarProps = {
  /** The selected instance record. */
  instance: InstanceRecord;
  /** Whether the user can edit the instance. */
  canEditSelectedInstance: boolean;
  /** Whether the user can open provider targets. */
  canOpenTargets: boolean;
  /** Whether the user can open routing. */
  canOpenRouting: boolean;
  /** Whether the user can open conversations. */
  canOpenConversations: boolean;
  /** Whether the user can open API keys. */
  canOpenApiKeys: boolean;
  /** Current edit mode state. */
  editMode: boolean;
  /** Toggle edit mode. */
  onToggleEditMode: () => void;
  /** Toggle advanced diagnostics. */
  onToggleDiagnostics: () => void;
  /** Whether advanced diagnostics are shown. */
  showDiagnostics: boolean;
};

/**
 * Action bar rendering instance controls in clearly labeled groups:
 * primary remediation, related pages, and advanced actions.
 */
export function InstanceActionBar({
  instance,
  canEditSelectedInstance,
  canOpenTargets,
  canOpenRouting,
  canOpenConversations,
  canOpenApiKeys,
  editMode,
  onToggleEditMode,
  onToggleDiagnostics,
  showDiagnostics,
}: InstanceActionBarProps) {
  const links = getInstanceRelatedLinks(instance, {
    canOpenTargets,
    canOpenRouting,
    canOpenConversations,
    canOpenApiKeys,
  });

  const primaryLinks = links.filter((l) => l.group === "primary");
  const relatedLinks = links.filter((l) => l.group === "related");

  return (
    <section className="ff-action-bar">
      <div className="ff-action-bar-header">
        <div className="ff-action-bar-copy">
          <h2>Instance controls</h2>
          <p>
            Configure, edit, or navigate to related surfaces for{" "}
            {instance.display_name}.
          </p>
        </div>
        <div className="ff-action-controls">
          {canEditSelectedInstance ? (
            <button type="button" onClick={onToggleEditMode}>
              {editMode ? "Exit edit mode" : "Edit instance"}
            </button>
          ) : null}
          <button type="button" onClick={onToggleDiagnostics}>
            {showDiagnostics ? "Hide diagnostics" : "Advanced diagnostics"}
          </button>
        </div>
      </div>

      {/* Primary remediation actions */}
      {primaryLinks.length > 0 ? (
        <ContextNavStrip
          label="Remediation"
          items={primaryLinks.map((link) => ({ label: link.label, to: link.path }))}
        />
      ) : null}

      {/* Related pages */}
      {relatedLinks.length > 0 ? (
        <ContextNavStrip
          label="Related pages"
          items={relatedLinks.map((link) => ({ label: link.label, to: link.path }))}
        />
      ) : null}

      {/* Always-available links */}
      <ContextNavStrip
        label="System"
        items={[
          { label: "Agents", to: buildAgentsPath({ instanceId: instance.instance_id }) },
        ]}
      />
    </section>
  );
}
