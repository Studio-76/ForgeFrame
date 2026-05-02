import { Link } from "react-router-dom";

import { StatusBadge } from "../../components/ui/StatusBadge";
import { DetailPanel } from "../../components/ui/DetailPanel";
import { EmptyState } from "../../components/ui/StateBlocks";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { ProviderTargetRecord, TargetDraft } from "./types";
import {
  capabilityList,
  contractStatusForTarget,
  executionLaneOf,
  formatRecordEntries,
  formatTimestamp,
  nextActionForTarget,
  qualityTierOf,
  reasonForTargetStatus,
  statusLabelForTarget,
  titleCase,
  toneForTargetStatus,
} from "./utils";

type TargetDetailPanelProps = {
  target: ProviderTargetRecord | null;
  draft: TargetDraft | null;
  canMutate: boolean;
  instanceId: string | null;
  otherTargets: ProviderTargetRecord[];
  message: string;
  error: string;
  draftHasChanges: boolean;
  becomesRiskyDefault: boolean;
  onUpdateDraft: (targetKey: string, updater: (current: TargetDraft) => TargetDraft) => void;
  onToggleReference: (targetKey: string, field: "fallbackTargetKeys" | "escalationTargetKeys", referenceKey: string) => void;
  onSave: () => void;
  onDismissError: () => void;
};

/**
 * Actionable detail panel for the selected provider target.
 * Leads with readiness, blocking checks, and next action —
 * advanced technical details are collapsed by default.
 */
export function TargetDetailPanel({
  target,
  draft,
  canMutate,
  instanceId,
  otherTargets,
  message,
  error,
  draftHasChanges,
  becomesRiskyDefault,
  onUpdateDraft,
  onToggleReference,
  onSave,
  onDismissError,
}: TargetDetailPanelProps) {
  if (!target || !draft) {
    return (
      <EmptyState
        title="No target selected"
        description="Pick a target row to inspect readiness, blocking checks, and recommended next actions."
      />
    );
  }

  const status = contractStatusForTarget(target);
  const action = nextActionForTarget(target);
  const reason = reasonForTargetStatus(target);
  const capabilities = capabilityList(target);
  const isRuntimeReady = status === "runtime-ready";

  return (
    <DetailPanel
      title={target.label}
      description={`${target.provider_label ?? target.provider} · ${target.model_display_name ?? target.model_id}`}
      status={statusLabelForTarget(target)}
      statusTone={toneForTargetStatus(status)}
      statusKey={status}
      sticky
    >
      <div className="fg-stack">
        {message ? <p>{message}</p> : null}
        {error ? (
          <p className="fg-danger">
            {error}
            <button type="button" onClick={onDismissError} className="fg-dismiss-button" aria-label="Dismiss error">
              ×
            </button>
          </p>
        ) : null}

        {/* Readiness & next action */}
        <section className="fg-subcard">
          <h4>Readiness</h4>
          <p>{reason}</p>
          {!isRuntimeReady ? (
            <div className="ff-blocking-check">
              <StatusBadge tone="warning" status="blocked">
                Needs attention
              </StatusBadge>
              <span>Next action: <strong>{action.label}</strong></span>
            </div>
          ) : (
            <div className="ff-blocking-check">
              <StatusBadge tone="success" status="ready">
                Ready
              </StatusBadge>
              <span>Target is dispatchable</span>
            </div>
          )}
        </section>

        {/* Blocking checks */}
        {!isRuntimeReady ? (
          <section className="fg-subcard">
            <h4>Blocking checks</h4>
            <ul className="fg-checklist">
              <li className={target.provider_enabled ? "ff-check-ok" : "ff-check-fail"}>
                {target.provider_enabled ? "✓" : "✗"} Provider enabled
              </li>
              <li className={target.model_active ? "ff-check-ok" : "ff-check-fail"}>
                {target.model_active ? "✓" : "✗"} Model active
              </li>
              <li className={target.enabled ? "ff-check-ok" : "ff-check-fail"}>
                {target.enabled ? "✓" : "✗"} Target enabled
              </li>
              <li className={target.runtime_ready ? "ff-check-ok" : "ff-check-fail"}>
                {target.runtime_ready ? "✓" : "✗"} Runtime ready
              </li>
              <li className={target.health_status === "healthy" ? "ff-check-ok" : "ff-check-fail"}>
                {target.health_status === "healthy" ? "✓" : "✗"} Health: {titleCase(target.health_status)}
              </li>
              <li className={target.availability_status === "healthy" ? "ff-check-ok" : "ff-check-fail"}>
                {target.availability_status === "healthy" ? "✓" : "✗"} Availability: {titleCase(target.availability_status)}
              </li>
            </ul>
          </section>
        ) : null}

        {/* Routing eligibility */}
        <section className="fg-subcard">
          <h4>Routing eligibility</h4>
          <p>
            {target.queue_eligible ? "Queue eligible" : "Not queue eligible"} · Priority {target.priority}
            {target.fallback_allowed ? " · Fallback allowed" : ""}
            {target.escalation_allowed ? " · Escalation allowed" : ""}
          </p>
          <div className="fg-actions">
            <Link
              className="fg-nav-link"
              to={withInstanceScope(`${CONTROL_PLANE_ROUTES.routing}#routing-dry-run`, instanceId)}
            >
              Routing Dry Run
            </Link>
            <Link
              className="fg-nav-link"
              to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}
            >
              Provider Health
            </Link>
          </div>
        </section>

        {/* Advanced technical details */}
        <details className="ff-advanced-diagnostics">
          <summary>
            <strong>Advanced technical details</strong>
          </summary>
          <div className="fg-stack">
            <section className="fg-subcard">
              <h4>Identity</h4>
              <p>Target key: <code>{target.target_key}</code></p>
              <p>Auth: {target.auth_type} · Credential: {target.credential_type}</p>
              <p>Model: {target.model_display_name ?? target.model_id} · Owner: {target.model_owned_by ?? "unknown"}</p>
              <p>Execution lane: {executionLaneOf(target)}</p>
              <p>Last probe: {formatTimestamp(target.last_probe_at)}</p>
            </section>

            {capabilities.length > 0 ? (
              <section className="fg-subcard">
                <h4>Capabilities</h4>
                <p>{capabilities.join(" · ")}</p>
                <p className="fg-muted">Profile: {formatRecordEntries(target.capability_profile)}</p>
                <p className="fg-muted">Technical: {formatRecordEntries(target.technical_capabilities)}</p>
              </section>
            ) : null}

            <section className="fg-subcard">
              <h4>Execution traits</h4>
              <p>{formatRecordEntries(target.execution_traits)}</p>
            </section>

            <section className="fg-subcard">
              <h4>Policy flags</h4>
              <p>{formatRecordEntries(target.policy_flags)}</p>
              <p className="fg-muted">
                Fallback {target.fallback_allowed ? "allowed" : "blocked"} · Escalation {target.escalation_allowed ? "allowed" : "blocked"}
              </p>
            </section>

            <section className="fg-subcard">
              <h4>Cost / quality profile</h4>
              <p>Cost class: {titleCase(target.cost_class)} · Quality tier: {titleCase(qualityTierOf(target))}</p>
              <p className="fg-muted">{formatRecordEntries(target.economic_profile)}</p>
            </section>

            {target.runtime_readiness_reason ? (
              <section className="fg-subcard">
                <h4>Runtime note</h4>
                <p>{target.runtime_readiness_reason}</p>
              </section>
            ) : null}
          </div>
        </details>

        {/* Edit target policy */}
        {canMutate ? (
          <section className="fg-subcard">
            <h4>Edit target policy</h4>
            <div className="fg-inline-form">
              <label>
                Priority
                <input
                  aria-label="Priority"
                  type="number"
                  min="0"
                  value={draft.priority}
                  onChange={(e) => onUpdateDraft(target.target_key, (c) => ({ ...c, priority: e.target.value, acknowledgeDefaultRisk: false }))}
                />
              </label>
              <label>
                <input
                  aria-label="Enable target"
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => onUpdateDraft(target.target_key, (c) => ({ ...c, enabled: e.target.checked, acknowledgeDefaultRisk: false }))}
                />
                <span>Enable target</span>
              </label>
              <label>
                <input
                  aria-label="Queue eligible"
                  type="checkbox"
                  checked={draft.queueEligible}
                  onChange={(e) => onUpdateDraft(target.target_key, (c) => ({ ...c, queueEligible: e.target.checked }))}
                />
                <span>Queue eligible</span>
              </label>
              <label>
                <input
                  aria-label="Fallback allowed"
                  type="checkbox"
                  checked={draft.fallbackAllowed}
                  onChange={(e) => onUpdateDraft(target.target_key, (c) => ({ ...c, fallbackAllowed: e.target.checked }))}
                />
                <span>Fallback allowed</span>
              </label>
              <label>
                <input
                  aria-label="Escalation allowed"
                  type="checkbox"
                  checked={draft.escalationAllowed}
                  onChange={(e) => onUpdateDraft(target.target_key, (c) => ({ ...c, escalationAllowed: e.target.checked }))}
                />
                <span>Escalation allowed</span>
              </label>
            </div>

            {otherTargets.length > 0 ? (
              <>
                <div className="fg-stack">
                  <strong>Fallback targets</strong>
                  <div className="fg-inline-form">
                    {otherTargets.map((other) => (
                      <label key={`fallback-${other.target_key}`}>
                        <input
                          type="checkbox"
                          checked={draft.fallbackTargetKeys.includes(other.target_key)}
                          onChange={() => onToggleReference(target.target_key, "fallbackTargetKeys", other.target_key)}
                        />
                        <span>{other.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="fg-stack">
                  <strong>Escalation targets</strong>
                  <div className="fg-inline-form">
                    {otherTargets.map((other) => (
                      <label key={`escalation-${other.target_key}`}>
                        <input
                          type="checkbox"
                          checked={draft.escalationTargetKeys.includes(other.target_key)}
                          onChange={() => onToggleReference(target.target_key, "escalationTargetKeys", other.target_key)}
                        />
                        <span>{other.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {becomesRiskyDefault ? (
              <div className="ff-state-block" data-state="blocked">
                <strong>Premium or OAuth target becomes the default active path</strong>
                <p>
                  This change would promote a premium-cost or OAuth-backed target into the first active routing slot. Confirm the risk before saving.
                </p>
                <label>
                  <input
                    aria-label="Confirm premium or OAuth default warning"
                    type="checkbox"
                    checked={draft.acknowledgeDefaultRisk}
                    onChange={(e) => onUpdateDraft(target.target_key, (c) => ({ ...c, acknowledgeDefaultRisk: e.target.checked }))}
                  />
                  <span>I understand and want this target to become a default active path.</span>
                </label>
              </div>
            ) : null}

            <div className="fg-actions">
              <button type="button" onClick={onSave} disabled={!draftHasChanges}>
                Save target changes
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </DetailPanel>
  );
}
