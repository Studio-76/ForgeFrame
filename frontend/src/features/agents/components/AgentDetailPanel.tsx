/**
 * Agent detail panel — shows registry posture, conversation addressability,
 * profile linkage, participation rights, and archive controls.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AgentDetail, AgentSummary } from "../../../api/domain/agents";
import type { LoadState } from "../../../pages/workInteractionPageSupport";
import { addressabilityTone, agentStatusTone, formatTimestamp, participationDescription, participationLabel } from "../helpers";
import { UNSUPPORTED_PARTICIPATION_MODES } from "../types";

/** Props for AgentDetailPanel. */
export interface AgentDetailPanelProps {
  /** The currently selected agent detail, or null. */
  detail: AgentDetail | null;
  /** The current instance ID. */
  instanceId: string;
  /** Detail loading state. */
  detailState: LoadState;
  /** Whether the user can mutate. */
  canMutate: boolean;
  /** All agents for archive replacement selector. */
  agents: AgentSummary[];
  /** Archive replacement agent ID. */
  archiveReplacement: string;
  /** Archive reason. */
  archiveReason: string;
  /** Whether archive is in progress. */
  savingArchive: boolean;
  /** Archive replacement setter. */
  setArchiveReplacement: React.Dispatch<React.SetStateAction<string>>;
  /** Archive reason setter. */
  setArchiveReason: React.Dispatch<React.SetStateAction<string>>;
  /** Handler for archiving. */
  onArchive: () => void;
  /** Open edit drawer handler. */
  onOpenEdit: () => void;
}

/**
 * Detail panel for a selected agent — shows coordinator posture,
 * profile links, and conversation effect.
 */
export function AgentDetailPanel({
  detail,
  instanceId,
  detailState,
  canMutate,
  agents,
  archiveReplacement,
  archiveReason,
  savingArchive,
  setArchiveReplacement,
  setArchiveReason,
  onArchive,
  onOpenEdit,
}: AgentDetailPanelProps) {
  if (detailState === "idle") {
    return (
      <p className="text-meta text-muted px-1 py-3">
        Select an agent to inspect coordinator posture, profile links, and conversation effect.
      </p>
    );
  }

  if (detailState === "loading") {
    return <p className="text-meta text-muted px-1 py-3">Loading agent detail.</p>;
  }

  if (!detail) {
    return null;
  }

  const linkStyles = "fg-nav-link";

  return (
    <div className="fg-stack">
      {/* ── Status pills row ── */}
      <div className="fg-actions flex-wrap">
        <span className="fg-pill" data-tone={detail.is_default_operator ? "success" : "neutral"}>
          {detail.is_default_operator ? "Coordinator / lead Operator" : detail.role_kind}
        </span>
        <span className="fg-pill" data-tone={agentStatusTone(detail.status)}>
          {detail.status}
        </span>
        <span className="fg-pill" data-tone={addressabilityTone(detail.addressable_in_conversations, detail.status)}>
          {detail.addressable_in_conversations ? "conversation-addressable" : "not addressable"}
        </span>
        <span className="fg-pill">{participationLabel(detail.participation_mode)}</span>
      </div>

      {/* ── Registry posture ── */}
      <article className="fg-subcard">
        <h4>Registry posture</h4>
        <ul className="fg-list">
          <li>Display name: {detail.display_name}</li>
          <li>Default name: {detail.default_name}</li>
          <li>Role kind: {detail.role_kind}</li>
          <li>Required Operator: {detail.is_default_operator ? "yes" : "no"}</li>
          <li>Last activity: {formatTimestamp(detail.last_activity_at, detail.updated_at)}</li>
        </ul>
      </article>

      {/* ── Conversation addressability ── */}
      <article className="fg-subcard">
        <h4>Conversation addressability</h4>
        <ul className="fg-list">
          <li>Addressable: {detail.addressable_in_conversations ? "yes" : "no"}</li>
          <li>Reason: {detail.addressability_reason}</li>
          <li>Conversation participation: {detail.conversation_count}</li>
          <li>Mentions recorded: {detail.mention_count}</li>
        </ul>
        <div className="fg-actions">
          <Link className={linkStyles} to={`/conversations?instanceId=${instanceId}&agentId=${detail.agent_id}`}>
            Open conversations
          </Link>
        </div>
      </article>

      {/* ── Profile and rights ── */}
      <article className="fg-subcard">
        <h4>Profile and rights</h4>
        <ul className="fg-list">
          <li>
            Assistant profile:{" "}
            {detail.assistant_profile
              ? detail.assistant_profile.label
              : detail.assistant_profile_id ?? "Not linked"}
          </li>
          <li>
            Allowed targets:{" "}
            {detail.allowed_targets.length > 0 ? detail.allowed_targets.join(", ") : "none"}
          </li>
          <li>Participation mode meaning: {participationDescription(detail.participation_mode)}</li>
          <li>Unsupported backend modes: {UNSUPPORTED_PARTICIPATION_MODES.join(", ")}</li>
        </ul>
        <div className="fg-actions">
          {detail.assistant_profile ? (
            <Link
              className={linkStyles}
              to={`/assistant-profiles?instanceId=${instanceId}&assistantProfileId=${detail.assistant_profile.record_id}`}
            >
              Open assistant profile
            </Link>
          ) : null}
          <button type="button" className="ff-btn-secondary ff-btn-sm" disabled={!canMutate} onClick={onOpenEdit}>
            Edit selected agent
          </button>
        </div>
        <p className="text-meta text-muted">
          ForgeFrame does not invent unsupported participation modes. `silent` and `subscribed` are displayed as backend gaps instead of being faked as writable values.
        </p>
      </article>

      {/* ── Archive and replacement ── */}
      <article className="fg-subcard">
        <h4>Archive and replacement</h4>
        <p className="text-meta text-muted">
          Archiving the required Operator is blocked until another real agent is named as replacement.
        </p>
        <div className="fg-grid fg-grid-compact">
          <label>
            Replacement agent
            <select
              value={archiveReplacement}
              onChange={(event) => setArchiveReplacement(event.target.value)}
            >
              <option value="">none</option>
              {agents
                .filter((agent) => agent.agent_id !== detail.agent_id && agent.status !== "archived")
                .map((agent) => (
                  <option key={agent.agent_id} value={agent.agent_id}>
                    {agent.display_name} ({agent.agent_id})
                  </option>
                ))}
            </select>
          </label>
          <label>
            Archive reason
            <input
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
            />
          </label>
        </div>
        <div className="fg-actions">
          <button
            type="button"
            className="ff-btn-destructive ff-btn-sm"
            disabled={!canMutate || savingArchive || (detail.is_default_operator && !archiveReplacement)}
            onClick={onArchive}
          >
            {savingArchive ? "Archiving agent" : "Archive agent"}
          </button>
        </div>
      </article>
    </div>
  );
}
