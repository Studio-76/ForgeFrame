import { Link } from "react-router-dom";

import type { InstanceRecord } from "../api/domain/instances";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { withInstanceScope } from "../app/tenantScope";
import type { InstanceCatalogLoadState } from "../app/useInstanceCatalog";
import { Button } from "./ui/Button";

export type InstanceScopeCardProps = {
  instanceId: string | null;
  selectedInstance: InstanceRecord | null;
  instances: InstanceRecord[];
  loadState: InstanceCatalogLoadState;
  error: string;
  surfaceLabel: string;
  onInstanceChange: (instanceId: string | null) => void;
};

function getScopeTone(loadState: InstanceCatalogLoadState, selectedInstance: InstanceRecord | null): "success" | "warning" | "neutral" {
  if (loadState === "error") {
    return "warning";
  }
  if (selectedInstance) {
    return "success";
  }
  return "neutral";
}

export function InstanceScopeCard({
  instanceId,
  selectedInstance,
  instances,
  loadState,
  error,
  surfaceLabel,
  onInstanceChange,
}: InstanceScopeCardProps) {
  const scopeTone = getScopeTone(loadState, selectedInstance);
  const selectedLabel = selectedInstance?.display_name ?? selectedInstance?.instance_id ?? "Default instance path";

  return (
    <article className="fg-card fg-instance-scope-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Instance Scope</h3>
          <p className="fg-muted">
            Choose which instance this page controls.
          </p>
        </div>
        <span className="fg-pill" data-tone={scopeTone}>
          {selectedInstance ? `Scoped to ${selectedLabel}` : "Default instance scope"}
        </span>
      </div>

      <div className="fg-inline-form fg-instance-scope-layout">
        <label>
          Instance
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
        <div className="fg-actions fg-instance-scope-actions">
          {instanceId ? (
            <Button onPress={() => onInstanceChange(null)}>
              Clear
            </Button>
          ) : null}
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.instances, instanceId)}>
            Instances
          </Link>
          {instanceId ? (
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>
              Targets
            </Link>
          ) : null}
          {instanceId ? (
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.routing, instanceId)}>
              Routing
            </Link>
          ) : null}
        </div>
      </div>

      {selectedInstance ? (
        <p className="fg-note fg-mt-sm">
          Bound: tenant {selectedInstance.tenant_id} · execution {selectedInstance.company_id} · deployment {selectedInstance.deployment_mode}
          {" "}· exposure {selectedInstance.exposure_mode}.
        </p>
      ) : (
        <p className="fg-note fg-mt-sm">
          No instance pinned yet. Choose one when you need scoped control-plane actions.
        </p>
      )}

      {loadState === "loading" && instances.length === 0 ? <p className="fg-muted">Loading instance inventory.</p> : null}
      {loadState === "success" && instances.length === 0 ? <p className="fg-muted">No instances are registered yet.</p> : null}
      {error ? <p className="fg-danger">{error}</p> : null}
      {instanceId && !selectedInstance ? (
        <p className="fg-danger">
          Selected instance is missing from the registry. Clear scope or repair instance inventory.
        </p>
      ) : null}
    </article>
  );
}
