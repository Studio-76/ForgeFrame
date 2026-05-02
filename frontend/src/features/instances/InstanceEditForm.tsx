/**
 * Instance edit form, visible only when edit mode is enabled.
 *
 * @packageDocumentation
 */

import type { InstanceRecord } from "../../api/domain/instances";

/**
 * Props for the InstanceEditForm component.
 */
export type InstanceEditFormProps = {
  /** The selected instance record. */
  instance: InstanceRecord;
  /** Current edit form state. */
  editForm: Partial<InstanceRecord>;
  /** Whether the user can edit the instance. */
  canEditSelectedInstance: boolean;
  /** Whether the update is in progress. */
  savingUpdate: boolean;
  /** Update form field value. */
  onFormChange: (patch: Partial<InstanceRecord>) => void;
  /** Submit the edit form. */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

/**
 * Edit form for instance configuration fields.
 * Visible only when edit mode is toggled on.
 */
export function InstanceEditForm({
  instance,
  editForm,
  canEditSelectedInstance,
  savingUpdate,
  onFormChange,
  onSubmit,
}: InstanceEditFormProps) {
  return (
    <details className="ff-collapse-section" open>
      <summary>
        <div className="ff-collapse-summary-text">
          <h3>Edit Instance</h3>
          {canEditSelectedInstance ? (
            <p>
              Update the canonical identity and operating posture for{" "}
              {instance.display_name}.
            </p>
          ) : (
            <p>
              You have read-only access to this instance's configuration.
            </p>
          )}
        </div>
        <span
          className="fg-pill"
          data-tone={canEditSelectedInstance ? "success" : "warning"}
        >
          {canEditSelectedInstance ? "Writable" : "Read only"}
        </span>
      </summary>
      <div className="ff-collapse-section-body">
        <form className="fg-stack" onSubmit={onSubmit}>
          <label>
            Display name
            <input
              value={
                typeof editForm.display_name === "string"
                  ? editForm.display_name
                  : ""
              }
              onChange={(event) =>
                onFormChange({ display_name: event.target.value })
              }
              disabled={!canEditSelectedInstance}
            />
          </label>
          <label>
            Description
            <textarea
              rows={4}
              value={
                typeof editForm.description === "string"
                  ? editForm.description
                  : ""
              }
              onChange={(event) =>
                onFormChange({ description: event.target.value })
              }
              disabled={!canEditSelectedInstance}
            />
          </label>
          <div className="fg-grid fg-grid-compact">
            <label>
              Tenant / Organization scope
              <input
                value={
                  typeof editForm.tenant_id === "string"
                    ? editForm.tenant_id
                    : ""
                }
                onChange={(event) =>
                  onFormChange({ tenant_id: event.target.value })
                }
                disabled={!canEditSelectedInstance}
              />
            </label>
            <label>
              Execution scope
              <input
                value={
                  typeof editForm.company_id === "string"
                    ? editForm.company_id
                    : ""
                }
                onChange={(event) =>
                  onFormChange({ company_id: event.target.value })
                }
                disabled={!canEditSelectedInstance}
              />
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Status
              <select
                value={editForm.status ?? instance.status}
                onChange={(event) =>
                  onFormChange({
                    status: event.target.value as InstanceRecord["status"],
                  })
                }
                disabled={!canEditSelectedInstance}
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <label>
              Deployment mode
              <select
                value={
                  editForm.deployment_mode ?? instance.deployment_mode
                }
                onChange={(event) =>
                  onFormChange({
                    deployment_mode: event.target.value as InstanceRecord["deployment_mode"],
                  })
                }
                disabled={!canEditSelectedInstance}
              >
                <option value="linux_host_native">linux_host_native</option>
                <option value="restricted_eval">restricted_eval</option>
                <option value="container_optional">container_optional</option>
              </select>
            </label>
            <label>
              Exposure mode
              <select
                value={
                  editForm.exposure_mode ?? instance.exposure_mode
                }
                onChange={(event) =>
                  onFormChange({
                    exposure_mode: event.target.value as InstanceRecord["exposure_mode"],
                  })
                }
                disabled={!canEditSelectedInstance}
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
              disabled={!canEditSelectedInstance || savingUpdate}
            >
              {savingUpdate ? "Saving instance" : "Save instance"}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
