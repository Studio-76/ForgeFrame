/**
 * ApiKeyDetailPanel — detailed view of a selected runtime key.
 *
 * @packageDocumentation
 */

import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import type { RuntimeKey, RuntimeKeyRequestPathPolicy } from "../../../api/domain/runtime-keys";
import type { GatewayAccount } from "../../../api/domain/accounts";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { DetailPanel } from "../../../components/ui/DetailPanel";
import { LoadingState, ErrorState } from "../../../components/ui/StateBlocks";
import { CONTROL_PLANE_ROUTES } from "../../../app/navigation";
import { withInstanceScope } from "../../../app/tenantScope";
import {
  formatTimestamp,
  formatAllowedPaths,
  rotationLabel,
  toneForKeyStatus,
  statusLabel,
} from "../helpers";
import type { LoadState, RuntimeKeyPolicyDraft, PolicyValidation } from "../types";
import { REQUEST_PATH_OPTIONS } from "../types";

/**
 * Props for the ApiKeyDetailPanel component.
 */
export type ApiKeyDetailPanelProps = {
  /** The selected runtime key. */
  runtimeKey: RuntimeKey;
  /** Instance ID for link building. */
  instanceId: string | null;
  /** Instance label. */
  instanceLabel: string;
  /** Owning account, if any. */
  account: GatewayAccount | null;
  /** Current policy draft. */
  policyDraft: RuntimeKeyPolicyDraft | null;
  /** Policy validation result. */
  policyValidation: PolicyValidation | null;
  /** Policy load state. */
  policyState: LoadState;
  /** Policy error message. */
  policyError: string;
  /** Audit history route for the selected key. */
  auditHistoryRoute: string;
  /** Whether mutation actions are permitted. */
  canMutate: boolean;
  /** Whether a save operation is in progress. */
  saving: boolean;
  /** Called to update the policy draft for a field. */
  onPolicyDraftChange: (draft: RuntimeKeyPolicyDraft) => void;
  /** Called to save the policy. */
  onPolicySave: () => void;
  /** Called to rotate the key. */
  onRotate: () => void;
  /** Called to change status. */
  onStatusChange: (action: "activate" | "disable" | "revoke") => void;
};

/**
 * Detail panel showing all runtime key information and controls.
 */
export function ApiKeyDetailPanel({
  runtimeKey: selectedKey,
  instanceId,
  instanceLabel,
  account: selectedAccount,
  policyDraft,
  policyValidation,
  policyState,
  policyError,
  auditHistoryRoute,
  canMutate,
  saving,
  onPolicyDraftChange,
  onPolicySave,
  onRotate,
  onStatusChange,
}: ApiKeyDetailPanelProps) {
  const navigate = useNavigate();

  return (
    <DetailPanel
      title={selectedKey.label}
      description={`${selectedKey.prefix} · ${instanceLabel}`}
      status={statusLabel(selectedKey.status)}
      statusTone={toneForKeyStatus(selectedKey.status)}
      statusKey={selectedKey.status}
      sticky
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="navigation"
            onPress={() => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.accounts, selectedKey.instance_id ?? instanceId))}
          >
            Accounts
          </Button>
          <Button
            variant="navigation"
            onPress={() => navigate(auditHistoryRoute)}
          >
            Audit History
          </Button>
          <Button
            variant="navigation"
            onPress={() => navigate(withInstanceScope(CONTROL_PLANE_ROUTES.instances, selectedKey.instance_id ?? instanceId))}
          >
            Affected Instance
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Scope and exposure */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Scope and exposure</h4>
          <div className="text-meta text-muted space-y-1">
            <p>Account: {selectedAccount?.label ?? selectedKey.account_id ?? "No bound account"}</p>
            <p>Instance: {instanceLabel}</p>
            <p>Tenant: {selectedKey.tenant_id ?? "unknown"}</p>
            <p>Scopes: {selectedKey.scopes.join(", ")}</p>
            <p>Allowed request paths: {formatAllowedPaths(selectedKey)}</p>
            <p>Default request path: {selectedKey.default_request_path ?? "smart_routing"}</p>
            <p>Created: {formatTimestamp(selectedKey.created_at)}</p>
            <p>Last used: {formatTimestamp(selectedKey.last_used_at)}</p>
          </div>
        </section>

        {/* Rotation */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Rotation</h4>
          <p className="text-meta text-muted">{rotationLabel(selectedKey)}</p>
          <p className="text-meta text-muted mt-1">The full secret is never derived from stored key rows. Only issue/rotation responses reveal it once.</p>
          {canMutate ? (
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" isDisabled={saving} onPress={onRotate}>
                Rotate key
              </Button>
            </div>
          ) : (
            <p className="text-meta text-muted mt-1">Rotation controls are hidden in read-only sessions.</p>
          )}
        </section>

        {/* Status controls */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Status controls</h4>
          <p className="text-meta text-muted">Current lifecycle: {statusLabel(selectedKey.status)}</p>
          {canMutate ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedKey.status !== "active" ? (
                <Button variant="secondary" isDisabled={saving} onPress={() => onStatusChange("activate")}>
                  Activate key
                </Button>
              ) : null}
              {selectedKey.status !== "disabled" ? (
                <Button variant="secondary" isDisabled={saving} onPress={() => onStatusChange("disable")}>
                  Disable key
                </Button>
              ) : null}
              {selectedKey.status !== "revoked" ? (
                <Button variant="destructive" isDisabled={saving} onPress={() => onStatusChange("revoke")}>
                  Revoke key
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-meta text-muted mt-1">Lifecycle mutations are hidden in read-only sessions so the UI never implies unavailable controls.</p>
          )}
        </section>

        {/* Request-path policy */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Request-path policy</h4>
          <p className="text-meta text-muted mb-2">Policy editing is separated from rotation and status so path changes never masquerade as credential lifecycle work.</p>
          {policyState === "loading" ? (
            <LoadingState title="Loading request-path policy" description="Fetching the persisted allowlist for the selected key." />
          ) : null}
          {policyState === "error" ? (
            <ErrorState title="Request-path policy unavailable" description={policyError} />
          ) : null}
          {policyDraft && policyState !== "loading" ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-meta text-muted">Allowed request paths</span>
                <textarea
                  className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
                  rows={6}
                  value={policyDraft.allowed_request_paths}
                  onChange={(event) => onPolicyDraftChange({ ...policyDraft, allowed_request_paths: event.target.value })}
                  disabled={!canMutate}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-meta text-muted">Default request path</span>
                <select
                  className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
                  value={policyDraft.default_request_path}
                  onChange={(event) => onPolicyDraftChange({
                    ...policyDraft,
                    default_request_path: event.target.value as RuntimeKeyRequestPathPolicy["default_request_path"],
                  })}
                  disabled={!canMutate}
                >
                  {REQUEST_PATH_OPTIONS.map((path) => (
                    <option key={`${selectedKey.key_id}-${path}`} value={path}>{path}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-meta text-muted">Pinned target key</span>
                <input
                  className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
                  value={policyDraft.pinned_target_key}
                  onChange={(event) => onPolicyDraftChange({ ...policyDraft, pinned_target_key: event.target.value })}
                  disabled={!canMutate}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-meta text-muted">Local-only policy</span>
                <select
                  className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
                  value={policyDraft.local_only_policy}
                  onChange={(event) => onPolicyDraftChange({
                    ...policyDraft,
                    local_only_policy: event.target.value as RuntimeKey["local_only_policy"],
                  })}
                  disabled={!canMutate}
                >
                  <option value="require_local_target">require_local_target</option>
                  <option value="prefer_local">prefer_local</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-meta text-muted">Review-required conditions</span>
                <textarea
                  className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
                  rows={4}
                  value={policyDraft.review_required_conditions}
                  onChange={(event) => onPolicyDraftChange({ ...policyDraft, review_required_conditions: event.target.value })}
                  disabled={!canMutate}
                />
              </label>
              {policyValidation && policyValidation.errors.length > 0 ? (
                <ul className="text-danger text-sm space-y-1">
                  {policyValidation.errors.map((item, index) => (
                    <li key={`key-policy-error-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-meta text-muted">Request-path policy is valid and ready to save.</p>
              )}
              {canMutate ? (
                <div className="flex gap-2">
                  <Button variant="primary" isDisabled={saving || !policyValidation?.valid} onPress={onPolicySave}>
                    Save policy
                  </Button>
                </div>
              ) : (
                <p className="text-meta text-muted">Read-only sessions can inspect the persisted request-path policy but cannot change it.</p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </DetailPanel>
  );
}
