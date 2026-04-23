import { Link } from "react-router-dom";

import type { InstanceRecord } from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { withInstanceScope } from "../app/tenantScope";
import type { InstanceCatalogLoadState } from "../app/useInstanceCatalog";

type InstanceScopeCardProps = {
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
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Instance Scope</h3>
          <p className="fg-muted">
            ForgeFrame routes {surfaceLabel} through the top-level instance registry. Pick the real instance boundary instead of pretending
            tenant or company IDs are the primary control-plane key.
          </p>
        </div>
        <span className="fg-pill" data-tone={scopeTone}>
          {selectedInstance ? `Scoped to ${selectedLabel}` : "Default instance scope"}
        </span>
      </div>

      <div className="fg-inline-form">
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
        {instanceId ? (
          <button type="button" onClick={() => onInstanceChange(null)}>
            Clear scope
          </button>
        ) : null}
        <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.instances, instanceId)}>
          Open Instances
        </Link>
      </div>

      {selectedInstance ? (
        <p className="fg-note fg-mt-md">
          Current binding: tenant {selectedInstance.tenant_id} · execution {selectedInstance.company_id} · deployment {selectedInstance.deployment_mode}
          {" "}· exposure {selectedInstance.exposure_mode}.
        </p>
      ) : (
        <p className="fg-note fg-mt-md">
          No explicit instance is pinned in the URL. ForgeFrame will fall back to the default instance path until you choose a concrete boundary.
        </p>
      )}

      {loadState === "loading" && instances.length === 0 ? <p className="fg-muted">Loading instance inventory.</p> : null}
      {loadState === "success" && instances.length === 0 ? <p className="fg-muted">No instances are registered yet.</p> : null}
      {error ? <p className="fg-danger">{error}</p> : null}
      {instanceId && !selectedInstance ? (
        <p className="fg-danger">
          The selected instance is not present in the current registry. Clear the scope or repair the instance inventory before trusting this view.
        </p>
      ) : null}
    </article>
  );
}
