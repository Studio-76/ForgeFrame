/**
 * Memory detail panel — shows selected memory governance posture and evidence.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";

import type { MemoryDetail } from "../../api/domain/memory";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { buildExecutionReviewPath } from "../../app/executionReview";
import {
  buildContactPath,
  buildConversationPath,
  buildKnowledgeSourcePath,
  buildLearningPath,
  buildMemoryPath,
  buildNotificationPath,
  buildTaskPath,
  buildWorkspacePath,
} from "../../app/workInteractionRoutes";
import type { LoadState } from "./types";
import { TRUST_LABELS, VISIBILITY_LABELS, SENSITIVITY_LABELS, MEMORY_KIND_LABELS } from "./types";
import { formatTimestamp } from "./utils";

/** Props for MemoryDetailPanel. */
export interface MemoryDetailPanelProps {
  /** Selected memory detail, or null if none selected. */
  detail: MemoryDetail | null;
  /** Detail load state. */
  detailState: LoadState;
  /** Current instance ID for navigation links. */
  instanceId: string;
}

/**
 * Detail panel for a selected memory entry.
 * Shows active/inactive state, content, trust, source, usage, and governance actions.
 * Hidden when no entry is selected.
 */
export function MemoryDetailPanel({
  detail,
  detailState,
  instanceId,
}: MemoryDetailPanelProps) {
  if (detailState === "idle") {
    return null;
  }

  if (detailState === "loading") {
    return (
      <article className="fg-card">
        <p className="fg-muted">Loading memory detail…</p>
      </article>
    );
  }

  if (detailState === "error") {
    return (
      <article className="fg-card">
        <p className="fg-danger">Failed to load memory detail.</p>
      </article>
    );
  }

  if (!detail) {
    return null;
  }

  const isActive =
    detail.status === "active" && detail.truth_state === "active";
  const isRevoked =
    detail.truth_state === "revoked" ||
    detail.truth_state === "superseded" ||
    detail.truth_state === "deleted";

  return (
    <article className="fg-card ff-memory-detail-panel">
      <div className="ff-memory-detail-header">
        <div>
          <h3>{detail.title}</h3>
          <span className="fg-code">{detail.memory_id}</span>
        </div>
        <span className="fg-pill" data-tone={isActive ? "success" : isRevoked ? "danger" : "warning"}>
          {isActive ? "Active" : detail.status} / {detail.truth_state}
        </span>
      </div>

      <div className="ff-memory-detail-body">
        <p>{detail.body}</p>
      </div>

      <div className="fg-grid ff-memory-detail-grid">
        {/* Governance */}
        <div className="ff-memory-detail-section">
          <h4>Governance</h4>
          <dl className="ff-memory-detail-list">
            <dt>Layer</dt>
            <dd>{detail.memory_layer_label}</dd>
            <dt>Kind</dt>
            <dd>{MEMORY_KIND_LABELS[detail.memory_kind] ?? detail.memory_kind}</dd>
            <dt>Trust</dt>
            <dd>{TRUST_LABELS[detail.source_trust_class] ?? detail.source_trust_class}</dd>
            <dt>Visibility</dt>
            <dd>{VISIBILITY_LABELS[detail.visibility_scope] ?? detail.visibility_scope}</dd>
            <dt>Sensitivity</dt>
            <dd>{SENSITIVITY_LABELS[detail.sensitivity] ?? detail.sensitivity}</dd>
            <dt>Human override</dt>
            <dd>{detail.human_override ? "Yes" : "No"}</dd>
            <dt>Expires</dt>
            <dd>{formatTimestamp(detail.expires_at, "No expiry")}</dd>
            <dt>Review state</dt>
            <dd>
              <span className="fg-pill" data-tone={
                detail.review.state === "not_required" ? "success"
                : detail.review.state === "scheduled" ? "success"
                : detail.review.state === "required" ? "warning"
                : "danger"
              }>{detail.review.state}</span>
              {detail.review.review_at ? ` · ${detail.review.review_at}` : ""}
            </dd>
          </dl>
          {detail.review.rationale ? (
            <p className="ff-memory-detail-note">{detail.review.rationale}</p>
          ) : null}
        </div>

        {/* Source and links */}
        <div className="ff-memory-detail-section">
          <h4>Source</h4>
          {detail.source ? (
            <div className="ff-memory-detail-links">
              <p><strong>{detail.source.label}</strong> · {detail.source.source_kind}</p>
              <p className="fg-muted">{detail.source.scope_label} · {detail.source.visibility_scope}</p>
              <Link
                className="fg-nav-link"
                to={buildKnowledgeSourcePath({ instanceId, sourceId: detail.source.source_id })}
              >
                Open source
              </Link>
            </div>
          ) : (
            <p className="fg-muted">No source linked.</p>
          )}

          <h4>Links</h4>
          <dl className="ff-memory-detail-list">
            {detail.contact ? (
              <>
                <dt>Contact</dt>
                <dd>
                  <Link to={buildContactPath({ instanceId, contactId: detail.contact.contact_id })}>
                    {detail.contact.display_name}
                  </Link>
                </dd>
              </>
            ) : null}
            {detail.conversation ? (
              <>
                <dt>Conversation</dt>
                <dd>
                  <Link to={buildConversationPath({ instanceId, conversationId: detail.conversation.record_id })}>
                    {detail.conversation.label}
                  </Link>
                </dd>
              </>
            ) : null}
            {detail.task ? (
              <>
                <dt>Task</dt>
                <dd>
                  <Link to={buildTaskPath({ instanceId, taskId: detail.task.record_id })}>
                    {detail.task.label}
                  </Link>
                </dd>
              </>
            ) : null}
            {detail.notification ? (
              <>
                <dt>Notification</dt>
                <dd>
                  <Link to={buildNotificationPath({ instanceId, notificationId: detail.notification.record_id })}>
                    {detail.notification.label}
                  </Link>
                </dd>
              </>
            ) : null}
            {detail.workspace ? (
              <>
                <dt>Workspace</dt>
                <dd>
                  <Link to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace.record_id })}>
                    {detail.workspace.label}
                  </Link>
                </dd>
              </>
            ) : null}
            {detail.learned_from_event_id ? (
              <>
                <dt>Learning event</dt>
                <dd>
                  <Link to={buildLearningPath({ instanceId, eventId: detail.learned_from_event_id })}>
                    {detail.learned_from_event_id}
                  </Link>
                </dd>
              </>
            ) : null}
          </dl>
        </div>

        {/* Usage evidence */}
        <div className="ff-memory-detail-section">
          <h4>Usage evidence</h4>
          <dl className="ff-memory-detail-list">
            <dt>Runs</dt>
            <dd>{detail.usage.runs}</dd>
            <dt>Conversations</dt>
            <dd>{detail.usage.conversations}</dd>
            <dt>Skills</dt>
            <dd>{detail.usage.skills}</dd>
            <dt>Last used</dt>
            <dd>{formatTimestamp(detail.last_used_at, "Not observed")}</dd>
            <dt>Correction note</dt>
            <dd>{detail.correction_note ?? "None"}</dd>
            {detail.supersedes_memory_id ? (
              <>
                <dt>Supersedes</dt>
                <dd>
                  <Link
                    to={buildMemoryPath({ instanceId, memoryId: detail.supersedes_memory_id })}
                  >
                    {detail.supersedes_memory_id}
                  </Link>
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      </div>

      {/* Usage runs */}
      {detail.usage_runs.length > 0 ? (
        <details className="ff-memory-advanced">
          <summary>Usage in execution runs ({detail.usage_runs.length})</summary>
          <ul className="ff-memory-usage-list">
            {detail.usage_runs.map((run) => (
              <li key={run.record_id}>
                <Link to={buildExecutionReviewPath({ instanceId, runId: run.record_id })}>
                  {run.label}
                </Link>
                {run.status ? ` · ${run.status}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Usage conversations */}
      {detail.usage_conversations.length > 0 ? (
        <details className="ff-memory-advanced">
          <summary>Usage in conversations ({detail.usage_conversations.length})</summary>
          <ul className="ff-memory-usage-list">
            {detail.usage_conversations.map((conv) => (
              <li key={conv.record_id}>
                <Link to={buildConversationPath({ instanceId, conversationId: conv.record_id })}>
                  {conv.label}
                </Link>
                {conv.status ? ` · ${conv.status}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Usage skills */}
      {detail.usage_skills.length > 0 ? (
        <details className="ff-memory-advanced">
          <summary>Usage in skills ({detail.usage_skills.length})</summary>
          <ul className="ff-memory-usage-list">
            {detail.usage_skills.map((skill) => (
              <li key={skill.record_id}>
                <Link to={`${CONTROL_PLANE_ROUTES.skills}?instanceId=${encodeURIComponent(instanceId)}&skillId=${encodeURIComponent(skill.record_id)}`}>
                  {skill.label}
                </Link>
                {skill.status ? ` · ${skill.status}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Revision history */}
      {detail.revision_history.length > 0 ? (
        <details className="ff-memory-advanced">
          <summary>Revision history ({detail.revision_history.length})</summary>
          <ul className="ff-memory-revision-list">
            {detail.revision_history.map((revision) => (
              <li key={revision.memory_id}>
                <Link to={buildMemoryPath({ instanceId, memoryId: revision.memory_id })}>
                  {revision.title}
                </Link>
                {" · "}{revision.status} / {revision.truth_state} · {revision.source_trust_class}
                {revision.correction_note ? ` · ${revision.correction_note}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Advanced metadata */}
      <details className="ff-memory-advanced">
        <summary>Advanced metadata</summary>
        <div className="ff-memory-advanced-content">
          <pre className="ff-memory-metadata-json">
            {JSON.stringify(detail.metadata, null, 2)}
          </pre>
        </div>
      </details>
    </article>
  );
}
