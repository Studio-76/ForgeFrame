/**
 * Reusable plugin security posture editor.
 *
 * Renders allowed-role checkboxes, admin approval toggle, network access,
 * external writes toggle, and secret refs input.
 *
 * @packageDocumentation
 */

import type { PluginSecurityPosture } from "../../../api/admin/plugins";
import { SECURITY_ROLE_OPTIONS } from "../types";
import { csvToList, securityWarnings, updateSecurityPostureRaw } from "../helpers";

/** Props for PluginSecurityPosture. */
export interface PluginSecurityPostureProps {
  /** Current posture prefix for form keys. */
  prefix?: string;
  /** The parsed security posture object. */
  posture: PluginSecurityPosture;
  /** Current raw JSON string of the posture. */
  postureJson: string;
  /** Called when the posture JSON changes. */
  onPostureJsonChange: (json: string) => void;
}

/**
 * Plugin security posture editor with checkboxes for roles and toggles.
 */
export function PluginSecurityPosture({
  prefix = "",
  posture,
  postureJson,
  onPostureJsonChange,
}: PluginSecurityPostureProps) {
  const itemPrefix = prefix ? `${prefix}-` : "";
  const roleValues = SECURITY_ROLE_OPTIONS as readonly string[];

  return (
    <section className="fg-subcard">
      <h4>Security posture</h4>
      <div className="fg-inline-form">
        {roleValues.map((role) => (
          <label key={`${itemPrefix}role-${role}`} className="fg-checkbox">
            <input
              type="checkbox"
              checked={posture.allowed_roles.includes(role as "viewer" | "operator" | "admin" | "owner")}
              onChange={(event) =>
                onPostureJsonChange(
                  updateSecurityPostureRaw(postureJson, (security) => ({
                    ...security,
                    allowed_roles: event.target.checked
                      ? Array.from(new Set([...security.allowed_roles, role as "viewer" | "operator" | "admin" | "owner"]))
                      : security.allowed_roles.filter((item) => item !== role),
                  })),
                )
              }
            />
            {role}
          </label>
        ))}
        <label className="fg-checkbox">
          <input
            type="checkbox"
            checked={posture.admin_approval_required}
            onChange={(event) =>
              onPostureJsonChange(
                updateSecurityPostureRaw(postureJson, (security) => ({
                  ...security,
                  admin_approval_required: event.target.checked,
                })),
              )
            }
          />
          Admin approval required
        </label>
        <label className="fg-checkbox">
          <input
            type="checkbox"
            checked={posture.network_access}
            onChange={(event) =>
              onPostureJsonChange(
                updateSecurityPostureRaw(postureJson, (security) => ({
                  ...security,
                  network_access: event.target.checked,
                })),
              )
            }
          />
          Network access
        </label>
        <label className="fg-checkbox">
          <input
            type="checkbox"
            checked={posture.writes_external_state}
            onChange={(event) =>
              onPostureJsonChange(
                updateSecurityPostureRaw(postureJson, (security) => ({
                  ...security,
                  writes_external_state: event.target.checked,
                })),
              )
            }
          />
          Writes external state
        </label>
        <label>
          Secret refs
          <input
            value={posture.secret_refs.join(", ")}
            onChange={(event) =>
              onPostureJsonChange(
                updateSecurityPostureRaw(postureJson, (security) => ({
                  ...security,
                  secret_refs: csvToList(event.target.value),
                })),
              )
            }
          />
        </label>
      </div>
      {securityWarnings({ security_posture: posture }).length > 0 ? (
        <ul className="fg-list">
          {securityWarnings({ security_posture: posture }).map((warning) => (
            <li key={`${itemPrefix}warning-${warning}`}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p className="fg-muted">
          Current posture is restricted: no network access, no external writes, and admin approval stays required.
        </p>
      )}
    </section>
  );
}
