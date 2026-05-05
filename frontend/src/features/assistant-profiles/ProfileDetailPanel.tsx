/**
 * Assistant profile detail panel.
 *
 * Displays the comprehensive governance view for a selected profile:
 * status, scope, allowed actions, external rights, quiet-hours posture,
 * approval requirements, and last policy evaluation.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type {
  AssistantActionEvaluation,
  AssistantProfileDetail,
  RecordLink,
} from "../../api/domain/assistant-profiles";
import {
  buildChannelPath,
  buildContactPath,
  buildKnowledgeSourcePath,
} from "../../app/workInteractionRoutes";
import { formatJson, summarizeEvaluation } from "./utils";
import { type LoadState } from "../../pages/workInteractionPageSupport";

/** Props for {@link ProfileDetailPanel}. */
export type ProfileDetailPanelProps = {
  /** The current instance ID for link building. */
  instanceId: string;
  /** The profile detail data. */
  detail: AssistantProfileDetail | null;
  /** Load state for the profile detail. */
  detailState: LoadState;
  /** Whether the current session can mutate. */
  canMutate: boolean;
  /** Called when the operator wants to edit the profile. */
  onEdit: () => void;
  /** Called when the operator wants to evaluate an action. */
  onEvaluate: () => void;
};

// ---------------------------------------------------------------------------
// Link rendering helpers
// ---------------------------------------------------------------------------

function renderLinkedList(items: RecordLink[], buildPath: (recordId: string) => string): ReactNode {
  if (items.length === 0) {
    return "None";
  }
  return items.map((item, index) => (
    <span key={item.record_id}>
      {index > 0 ? ", " : null}
      <Link to={buildPath(item.record_id)}>{item.label}</Link>
    </span>
  ));
}

function renderOptionalLink(item: RecordLink | null | undefined, buildPath: (recordId: string) => string) {
  if (!item) {
    return "Not linked";
  }
  return <Link to={buildPath(item.record_id)}>{item.label}</Link>;
}

// ---------------------------------------------------------------------------
// Evaluation result sub-component
// ---------------------------------------------------------------------------

/** Props for `EvaluationResult`. */
export type EvaluationResultProps = {
  evaluation: AssistantActionEvaluation;
  instanceId: string;
};

/**
 * Evaluation result card showing the last policy verdict.
 */
function EvaluationResult({ evaluation, instanceId }: EvaluationResultProps) {
  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>Last evaluation</h4>
          <p className="fg-muted">Persisted policy verdict for the most recent example action.</p>
        </div>
        <span className="fg-pill" data-tone={evaluation.decision === "blocked" ? "danger" : evaluation.decision === "allow" ? "success" : "warning"}>
          {evaluation.decision}
        </span>
      </div>
      <ul className="fg-list">
        <li>Action: {evaluation.action_mode} / {evaluation.action_kind}</li>
        <li>Priority: {evaluation.priority}</li>
        <li>Evaluated at: {new Date(evaluation.evaluated_at).toLocaleString()}</li>
        <li>Quiet hours active: {evaluation.quiet_hours_active ? "yes" : "no"}</li>
        <li>Preview required: {evaluation.preview_required ? "yes" : "no"}</li>
        <li>Approval required: {evaluation.approval_required ? "yes" : "no"}</li>
        <li>
          Effective channel:{" "}
          {evaluation.effective_channel_id
            ? <Link to={buildChannelPath({ instanceId, channelId: evaluation.effective_channel_id })}>{evaluation.effective_channel_id}</Link>
            : "none"}
        </li>
        <li>
          Fallback channel:{" "}
          {evaluation.fallback_channel_id
            ? <Link to={buildChannelPath({ instanceId, channelId: evaluation.fallback_channel_id })}>{evaluation.fallback_channel_id}</Link>
            : "none"}
        </li>
        <li>
          Delegate contact:{" "}
          {evaluation.delegate_contact_id
            ? <Link to={buildContactPath({ instanceId, contactId: evaluation.delegate_contact_id })}>{evaluation.delegate_contact_id}</Link>
            : "none"}
        </li>
      </ul>
      <p className="fg-muted">Reasons: {evaluation.reasons.join(", ") || "no additional reasons"}</p>
      {Object.keys(evaluation.metadata ?? {}).length > 0 ? <pre className="fg-code-block">{formatJson(evaluation.metadata)}</pre> : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

/**
 * Detail panel showing the full governance view for a selected profile.
 *
 * Leads with profile status, scope, allowed actions, external rights,
 * quiet-hours posture, approval requirements, and last evaluation.
 */
export function ProfileDetailPanel({
  instanceId,
  detail,
  detailState,
  canMutate,
  onEdit,
  onEvaluate,
}: ProfileDetailPanelProps) {
  if (detailState === "idle") {
    return <p className="fg-muted">Select an assistant profile to view governance details.</p>;
  }

  if (detailState === "loading") {
    return <p className="fg-muted">Loading assistant-profile detail.</p>;
  }

  if (!detail) {
    return <p className="fg-muted">Unable to load profile details.</p>;
  }

  return (
    <div className="fg-stack">
      {/* Action toolbar */}
      <div className="fg-actions-end" style={{ justifyContent: "flex-end", display: "flex", gap: "var(--space-8, 8px)", marginBottom: "var(--space-8, 8px)" }}>
        {canMutate && (
          <>
            <button type="button" className="ff-primary-action" onClick={onEdit}>
              Edit profile
            </button>
            <button type="button" className="fg-nav-link" onClick={onEvaluate}>
              Evaluate action
            </button>
          </>
        )}
      </div>

      {/* Risk warning banner */}
      {detail.risk_warning ? (
        <article className="fg-subcard">
          <h4>{detail.risk_warning.title}</h4>
          <p className={detail.risk_warning.level === "high" ? "fg-danger" : ""}>
            {detail.risk_warning.level === "high"
              ? "High-risk outward execution is enabled on this profile."
              : "Outward execution is permitted when profile gates are satisfied."}
          </p>
          <ul className={detail.risk_warning.level === "high" ? "fg-list fg-danger" : "fg-list"}>
            {detail.risk_warning.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </article>
      ) : null}

      {/* Governance detail cards */}
      <div className="fg-card-grid">
        <article className="fg-subcard">
          <h4>Scope and mode</h4>
          <ul className="fg-list">
            <li>Status: <span className="fg-pill" data-tone={detail.status === "active" && detail.assistant_mode_enabled ? "success" : "warning"}>{detail.status}</span></li>
            <li>Assistant mode: {detail.assistant_mode_enabled ? "Enabled" : "Disabled"}</li>
            <li>Default profile: {detail.is_default ? "Yes" : "No"}</li>
            <li>Profile scope: {detail.profile_scope_label}</li>
            <li>Memory scope: {detail.memory_scope_label}</li>
            <li>Operating mode: {detail.operating_mode_label}</li>
          </ul>
          <p style={{ marginTop: "var(--space-8, 8px)", fontSize: "0.875rem" }}>{detail.summary || "No profile summary was recorded."}</p>
        </article>

        <article className="fg-subcard">
          <h4>Quiet hours and communication</h4>
          <ul className="fg-list">
            <li>Timezone: {detail.timezone}</li>
            <li>Locale: {detail.locale}</li>
            <li>Tone: {detail.tone}</li>
            <li>Signature: {detail.communication_rules.signature ?? "none"}</li>
            <li>Style notes: {detail.communication_rules.style_notes ?? "none"}</li>
            <li>Quiet hours: {detail.quiet_hours_summary}</li>
            <li>Quiet override: {detail.quiet_hours.allow_priority_override ? detail.quiet_hours.override_min_priority : "Disabled"}</li>
          </ul>
        </article>

        <article className="fg-subcard">
          <h4>Delivery and channels</h4>
          <ul className="fg-list">
            <li>Primary channel: {renderOptionalLink(detail.primary_channel, (recordId) => buildChannelPath({ instanceId, channelId: recordId }))}</li>
            <li>Fallback channel: {renderOptionalLink(detail.fallback_channel, (recordId) => buildChannelPath({ instanceId, channelId: recordId }))}</li>
            <li>Allowed channels: {renderLinkedList(detail.allowed_channels, (recordId) => buildChannelPath({ instanceId, channelId: recordId }))}</li>
            <li>Direct channels: {renderLinkedList(detail.direct_channels, (recordId) => buildChannelPath({ instanceId, channelId: recordId }))}</li>
            <li>Preview by default: {detail.delivery_preferences.preview_by_default ? "Enabled" : "Disabled"}</li>
            <li>Mute during quiet hours: {detail.delivery_preferences.mute_during_quiet_hours ? "Enabled" : "Disabled"}</li>
          </ul>
        </article>

        <article className="fg-subcard">
          <h4>Contacts and sources</h4>
          <ul className="fg-list">
            <li>Preferred contact: {renderOptionalLink(detail.preferred_contact, (recordId) => buildContactPath({ instanceId, contactId: recordId }))}</li>
            <li>Delegate contact: {renderOptionalLink(detail.delegate_contact, (recordId) => buildContactPath({ instanceId, contactId: recordId }))}</li>
            <li>Escalation contact: {renderOptionalLink(detail.escalation_contact, (recordId) => buildContactPath({ instanceId, contactId: recordId }))}</li>
            <li>Mail source: {renderOptionalLink(detail.mail_source, (recordId) => buildKnowledgeSourcePath({ instanceId, sourceId: recordId }))}</li>
            <li>Calendar source: {renderOptionalLink(detail.calendar_source, (recordId) => buildKnowledgeSourcePath({ instanceId, sourceId: recordId }))}</li>
          </ul>
        </article>

        <article className="fg-subcard">
          <h4>Action governance</h4>
          <ul className="fg-list">
            <li>Suggestions: {detail.action_policies.suggestions_enabled ? "Enabled" : "Disabled"}</li>
            <li>Questions: {detail.action_policies.questions_enabled ? "Enabled" : "Disabled"}</li>
            <li>Direct-action policy: {detail.direct_action_policy_label}</li>
            <li>Approval reference: {detail.action_policies.require_approval_reference ? "Required" : "Not required"}</li>
            <li>Allowed actions: {detail.allowed_action_kinds.join(", ") || "none"}</li>
            <li>Blocked actions: {detail.blocked_action_kinds.join(", ") || "none"}</li>
          </ul>
        </article>

        <article className="fg-subcard">
          <h4>External delegation</h4>
          <ul className="fg-list">
            <li>External delegation: {detail.delegation_rules.allow_external_delegation ? "Allowed" : "Blocked"}</li>
            <li>Auto follow-ups: {detail.delegation_rules.allow_auto_followups ? "Allowed" : "Blocked"}</li>
            <li>Delegate: {renderOptionalLink(detail.delegate_contact, (recordId) => buildContactPath({ instanceId, contactId: recordId }))}</li>
            <li>Escalation: {renderOptionalLink(detail.escalation_contact, (recordId) => buildContactPath({ instanceId, contactId: recordId }))}</li>
          </ul>
        </article>
      </div>

      {/* Actions and evaluation */}
      <div className="fg-card-grid">
        <article className="fg-subcard">
          <h4>Allowed action kinds</h4>
          {detail.allowed_action_kinds.length > 0
            ? <p>{detail.allowed_action_kinds.join(", ")}</p>
            : <p className="fg-muted">No action kinds explicitly allowed.</p>}
        </article>

        <article className="fg-subcard">
          <h4>Policy snapshot</h4>
          <pre className="fg-code-block" style={{ maxHeight: "200px", overflow: "auto" }}>{formatJson({
            communication_rules: detail.communication_rules,
            quiet_hours: detail.quiet_hours,
            delivery_preferences: detail.delivery_preferences,
            action_policies: detail.action_policies,
            delegation_rules: detail.delegation_rules,
          })}</pre>
        </article>
      </div>

      {/* Evaluation result */}
      {detail.last_evaluation ? <EvaluationResult evaluation={detail.last_evaluation} instanceId={instanceId} /> : null}

      {/* Related links */}
      <div className="ff-nav-links">
        <span className="fg-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", padding: "var(--space-8, 8px) 0" }}>
          Related resources
        </span>
        <div style={{ display: "flex", gap: "var(--space-12, 12px)" }}>
          <Link to={buildContactPath({ instanceId })} className="fg-nav-link">Contacts</Link>
          <Link to={buildChannelPath({ instanceId })} className="fg-nav-link">Channels</Link>
          <Link to={buildKnowledgeSourcePath({ instanceId })} className="fg-nav-link">Knowledge sources</Link>
        </div>
      </div>
    </div>
  );
}
