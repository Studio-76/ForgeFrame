/**
 * Instance creation form with latest create result display.
 *
 * @packageDocumentation
 */

import { type InstanceRecord } from "../../api/domain/instances";
import { Link } from "react-router-dom";
import { buildAgentsPath } from "../../app/workInteractionRoutes";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { CreateResult } from "./types";
import { DEFAULT_CREATE_FORM } from "./types";

/**
 * Props for the InstanceCreateForm component.
 */
export type InstanceCreateFormProps = {
  /** Whether the user can create instances. */
  canCreateInstance: boolean;
  /** Whether the create operation is in progress. */
  savingCreate: boolean;
  /** Current form state. */
  createForm: typeof DEFAULT_CREATE_FORM;
  /** Last creation result, if any. */
  lastCreateResult: CreateResult | null;
  /** Update a create form field. */
  onFormChange: (patch: Partial<typeof DEFAULT_CREATE_FORM>) => void;
  /** Submit the create form. */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /** Close the create section. */
  onClose: () => void;
};

/**
 * Instance creation form with inline latest create result.
 */
export function InstanceCreateForm({
  canCreateInstance,
  savingCreate,
  createForm,
  lastCreateResult,
  onFormChange,
  onSubmit,
  onClose,
}: InstanceCreateFormProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Create Instance</h3>
          <p className="fg-muted">
            Create the instance boundary, then continue directly into targets,
            routing, conversations, API keys, and readiness work.
          </p>
        </div>
        <span
          className="fg-pill"
          data-tone={canCreateInstance ? "success" : "warning"}
        >
          {canCreateInstance ? "Writable" : "Admin only"}
        </span>
      </div>

      {lastCreateResult ? (
        <div className="fg-subcard fg-mb-sm">
          <div className="fg-panel-heading">
            <div>
              <h4>Latest Create Result</h4>
              <p className="fg-muted">{lastCreateResult.displayName}</p>
            </div>
            <span
              className="fg-pill"
              data-tone={
                lastCreateResult.operatorCreated ? "success" : "danger"
              }
            >
              {lastCreateResult.operatorCreated
                ? "Operator created"
                : "Operator missing"}
            </span>
          </div>
          <p>
            {lastCreateResult.operatorCreated
              ? `${lastCreateResult.operatorName ?? "Operator"} was auto-created for this instance.`
              : "The Operator agent was not auto-created. Treat this as a hard blocker and repair the agent state before continuing."}
          </p>
          <div className="ff-action-controls">
            <Link
              className="fg-nav-link"
              to={buildAgentsPath({
                instanceId: lastCreateResult.instanceId,
              })}
            >
              Configure operator agent
            </Link>
            <Link
              className="fg-nav-link"
              to={withInstanceScope(
                CONTROL_PLANE_ROUTES.providerTargets,
                lastCreateResult.instanceId,
              )}
            >
              Review provider targets
            </Link>
            <Link
              className="fg-nav-link"
              to={withInstanceScope(
                CONTROL_PLANE_ROUTES.releaseValidation,
                lastCreateResult.instanceId,
              )}
            >
              Release / Validation
            </Link>
          </div>
        </div>
      ) : null}

      <form className="fg-stack" onSubmit={onSubmit}>
        <label>
          Instance ID
          <input
            value={createForm.instance_id}
            onChange={(event) =>
              onFormChange({ instance_id: event.target.value })
            }
            placeholder="customer-prod"
          />
        </label>
        <label>
          Display name
          <input
            value={createForm.display_name}
            onChange={(event) =>
              onFormChange({ display_name: event.target.value })
            }
            placeholder="Customer Production"
          />
        </label>
        <label>
          Description
          <textarea
            rows={4}
            value={createForm.description}
            onChange={(event) =>
              onFormChange({ description: event.target.value })
            }
          />
        </label>
        <label>
          Tenant / Organization scope
          <input
            value={createForm.tenant_id}
            onChange={(event) =>
              onFormChange({ tenant_id: event.target.value })
            }
            placeholder="customer-prod"
          />
        </label>
        <label>
          Execution scope
          <input
            value={createForm.company_id}
            onChange={(event) =>
              onFormChange({ company_id: event.target.value })
            }
            placeholder="customer-prod"
          />
        </label>
        <div className="fg-grid fg-grid-compact">
          <label>
            Deployment mode
            <select
              value={createForm.deployment_mode}
              onChange={(event) =>
                onFormChange({
                  deployment_mode: event.target
                    .value as InstanceRecord["deployment_mode"],
                })
              }
            >
              <option value="linux_host_native">linux_host_native</option>
              <option value="restricted_eval">restricted_eval</option>
              <option value="container_optional">container_optional</option>
            </select>
          </label>
          <label>
            Exposure mode
            <select
              value={createForm.exposure_mode}
              onChange={(event) =>
                onFormChange({
                  exposure_mode: event.target
                    .value as InstanceRecord["exposure_mode"],
                })
              }
            >
              <option value="same_origin">same_origin</option>
              <option value="local_only">local_only</option>
              <option value="edge_admission">edge_admission</option>
            </select>
          </label>
        </div>
        <div className="ff-action-controls">
          <button
            type="submit"
            disabled={!canCreateInstance || savingCreate}
          >
            {savingCreate ? "Creating instance" : "Create instance"}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}
