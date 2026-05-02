/**
 * Learning event detail panel — shown only when an event is selected.
 *
 * @packageDocumentation
 */

import type { LearningEventDetail } from "../../api/domain/learning";
import { Link } from "react-router-dom";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import {
  buildConversationPath,
  buildMemoryPath,
} from "../../app/workInteractionRoutes";
import { buildExecutionReviewPath } from "../../app/executionReview";
import {
  bucketTone,
  laneTone,
  riskTone,
  formatTimestamp,
  evidenceEntries,
  proposalText,
  textFromRecord,
  nestedTextFromRecord,
} from "./utils";
import type { LoadState } from "./types";
import { DecisionForm } from "./DecisionForm";
import type { UseLearningPageReturn } from "./hooks";

/** Props for EventDetail. */
export interface EventDetailProps {
  /** The selected event detail, or null if none selected. */
  detail: LearningEventDetail | null;
  /** The instance ID for building links. */
  instanceId: string;
  /** Detail loading state. */
  detailState: LoadState;
  /** Decide form state from the parent hook. */
  decideForm: UseLearningPageReturn["decideForm"];
  /** Set a field in the decide form. */
  setDecideFormField: UseLearningPageReturn["setDecideFormField"];
  /** Handle decision submission. */
  handleDecide: UseLearningPageReturn["handleDecide"];
  /** Whether saving is in progress. */
  savingDecide: boolean;
  /** Whether the user can mutate. */
  canMutate: boolean;
}

/**
 * Detail panel for a selected learning event.
 * Shows trigger information, risk, evidence, and the decision form.
 */
export function EventDetail({
  detail,
  instanceId,
  detailState,
  decideForm,
  setDecideFormField,
  handleDecide,
  savingDecide,
  canMutate,
}: EventDetailProps) {
  if (detailState === "loading") {
    return (
      <article className="fg-card ff-learning-detail">
        <h3>Learning detail</h3>
        <p className="fg-muted">Loading event detail…</p>
      </article>
    );
  }

  if (!detail) {
    return (
      <article className="fg-card ff-learning-detail ff-learning-detail-empty">
        <h3>Learning detail</h3>
        <p className="fg-muted">
          Select a learning event to inspect context, risk, and make a
          decision.
        </p>
      </article>
    );
  }

  const runPath = detail.run
    ? buildExecutionReviewPath({ instanceId, runId: detail.run.record_id })
    : null;
  const skillPath =
    detail.promoted_skill && instanceId
      ? `${CONTROL_PLANE_ROUTES.skills}?instanceId=${encodeURIComponent(instanceId)}&skillId=${encodeURIComponent(detail.promoted_skill.record_id)}`
      : null;

  return (
    <article className="fg-card ff-learning-detail">
      <div className="fg-section-heading">
        <div>
          <h3>{detail.summary}</h3>
          <p className="fg-muted">
            Learning event {detail.learning_event_id}
          </p>
        </div>
        <span className="fg-pill" data-tone={bucketTone(detail.review_bucket)}>
          {detail.review_bucket_label}
        </span>
      </div>

      {/* Status badges */}
      <div className="ff-learning-detail-badges">
        <span
          className="fg-pill"
          data-tone={laneTone(detail.suggested_lane)}
        >
          {detail.suggested_lane_label}
        </span>
        <span className="fg-pill" data-tone={riskTone(detail.risk.level)}>
          {detail.risk.level} risk
        </span>
        <span className="fg-pill">{detail.trigger_kind}</span>
      </div>

      {/* Trigger and source */}
      <section className="fg-subcard">
        <h4>Trigger and source</h4>
        <div className="fg-grid fg-grid-compact">
          <div>
            <strong>Source</strong>
            <p>{detail.source.label}</p>
            <p className="fg-muted">
              {detail.source.detail ?? "No additional source context."}
            </p>
          </div>
          <div>
            <strong>Timing</strong>
            <p>{formatTimestamp(detail.created_at)}</p>
            <p className="fg-muted">
              Decided: {formatTimestamp(detail.decided_at)}
            </p>
          </div>
          <div>
            <strong>Current outcome</strong>
            <p>{detail.outcome.target_label}</p>
            <p className="fg-muted">
              {detail.outcome.scope_label ?? "No target recorded yet."}
            </p>
          </div>
        </div>
        <div className="fg-actions">
          {detail.conversation ? (
            <Link
              className="fg-nav-link"
              to={buildConversationPath({
                instanceId,
                conversationId: detail.conversation.record_id,
              })}
            >
              Open conversation
            </Link>
          ) : null}
          {runPath ? (
            <Link className="fg-nav-link" to={runPath}>
              Open execution review
            </Link>
          ) : null}
          {detail.promoted_memory ? (
            <Link
              className="fg-nav-link"
              to={buildMemoryPath({
                instanceId,
                memoryId: detail.promoted_memory.record_id,
              })}
            >
              Open promoted memory
            </Link>
          ) : null}
          {skillPath ? (
            <Link className="fg-nav-link" to={skillPath}>
              Open promoted skill
            </Link>
          ) : null}
        </div>
      </section>

      {/* Advanced details (collapsible backend fields) */}
      <details className="ff-learning-advanced">
        <summary>Advanced details</summary>
        <div className="fg-grid fg-grid-compact">
          <div>
            <strong>Backend status</strong>
            <p>{detail.status}</p>
          </div>
          <div>
            <strong>Trigger</strong>
            <p>{detail.trigger_kind}</p>
          </div>
          {detail.agent_id ? (
            <div>
              <strong>Agent ID</strong>
              <p>{detail.agent_id}</p>
            </div>
          ) : null}
          {detail.run_id ? (
            <div>
              <strong>Run ID</strong>
              <p>{detail.run_id}</p>
            </div>
          ) : null}
          {detail.conversation_id ? (
            <div>
              <strong>Conversation ID</strong>
              <p>{detail.conversation_id}</p>
            </div>
          ) : null}
          {detail.evidence?.source_note ? (
            <div>
              <strong>Source note</strong>
              <p>{String(detail.evidence.source_note)}</p>
            </div>
          ) : null}
        </div>
      </details>

      {/* Proposed promotion */}
      <section className="fg-subcard">
          <h4>
            {detail.proposal.surface === "memory"
              ? "Proposed memory"
              : detail.proposal.surface === "skill"
                ? "Proposed skill draft"
                : "Proposed outcome"}
          </h4>
          <div className="fg-grid fg-grid-compact">
            <div>
              <strong>Target</strong>
              <p>{detail.proposal.target_label}</p>
              <p className="fg-muted">{detail.proposal.scope_label}</p>
            </div>
            <div>
              <strong>Surface</strong>
              <p>{detail.proposal.surface}</p>
              <p className="fg-muted">
                {detail.proposal.trust_label ?? ""}
              </p>
            </div>
            <div>
              <strong>Summary</strong>
              <p>{detail.proposal.content_summary}</p>
            </div>
          </div>

          {detail.proposal.surface === "memory" && (
            <div className="fg-grid fg-grid-compact">
              <div>
                <strong>Memory title</strong>
                <p>
                  {proposalText(
                    detail.proposed_memory,
                    ["title"],
                    detail.summary,
                  )}
                </p>
              </div>
              <div>
                <strong>Memory kind</strong>
                <p>
                  {textFromRecord(
                    detail.proposed_memory,
                    "memory_kind",
                    "summary",
                  )}
                </p>
              </div>
              <div>
                <strong>Visibility / sensitivity</strong>
                <p>
                  {textFromRecord(
                    detail.proposed_memory,
                    "visibility_scope",
                    "team",
                  )}{" "}
                  /{" "}
                  {textFromRecord(
                    detail.proposed_memory,
                    "sensitivity",
                    "normal",
                  )}
                </p>
              </div>
              <div>
                <strong>Review schedule</strong>
                <p>
                  {nestedTextFromRecord(
                    detail.proposed_memory,
                    ["metadata", "review", "review_at"],
                    "No review date proposed.",
                  )}
                </p>
                <p className="fg-muted">
                  {nestedTextFromRecord(
                    detail.proposed_memory,
                    ["metadata", "review", "note"],
                    "",
                  )}
                </p>
              </div>
            </div>
          )}

          {detail.proposal.surface === "skill" && (
            <div className="fg-grid fg-grid-compact">
              <div>
                <strong>Skill name</strong>
                <p>
                  {proposalText(
                    detail.proposed_skill,
                    ["display_name"],
                    detail.summary,
                  )}
                </p>
              </div>
              <div>
                <strong>Scope</strong>
                <p>
                  {textFromRecord(
                    detail.proposed_skill,
                    "scope",
                    "instance",
                  )}
                </p>
              </div>
              <div>
                <strong>Instruction core</strong>
                <p>
                  {proposalText(
                    detail.proposed_skill,
                    ["instruction_core"],
                    detail.explanation || detail.summary,
                  )}
                </p>
              </div>
            </div>
          )}
        </section>

      {/* Risk and explainability */}
      <section className="fg-subcard">
        <h4>Risk and explainability</h4>
        <p>
          {detail.explanation ||
            "No explanation was recorded for this learning event."}
        </p>
        {detail.risk.reasons.length > 0 && (
          <ul className="fg-list">
            {detail.risk.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <div className="fg-grid fg-grid-compact">
          {evidenceEntries(detail.evidence).map((entry) => (
            <div key={entry.key}>
              <strong>{entry.key}</strong>
              <p>{entry.value}</p>
            </div>
          ))}
        </div>
        <details>
          <summary>Structured payload evidence</summary>
          <pre>
            {JSON.stringify(
              {
                evidence: detail.evidence,
                proposed_memory: detail.proposed_memory,
                proposed_skill: detail.proposed_skill,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </section>

      {/* Decision form */}
      <DecisionForm
        detail={detail}
        decideForm={decideForm}
        setDecideFormField={setDecideFormField}
        handleDecide={handleDecide}
        savingDecide={savingDecide}
        canMutate={canMutate}
      />
    </article>
  );
}
