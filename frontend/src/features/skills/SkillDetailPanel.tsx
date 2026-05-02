/**
 * Selected-skill detail panel — shows skill status, what it does, scope,
 * activation state, provenance summary, recent usage, and lifecycle actions.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import { Link } from "react-router-dom";

import type {
  AgentSummary,
  SkillDetail as SkillDetailType,
  SkillProvenanceKind,
  SkillScope,
  SkillStatus,
  SkillUsageOutcome,
} from "../../api/domain";
import {
  buildAgentsPath,
  buildConversationPath,
  buildKnowledgeSourcePath,
  buildLearningPath,
  buildMemoryPath,
} from "../../app/workInteractionRoutes";
import {
  MUTABLE_STATUS_OPTIONS,
  PROVENANCE_KIND_OPTIONS,
  SCOPE_OPTIONS,
  USAGE_OUTCOME_OPTIONS,
  type ActivationForm,
  type EditSkillForm,
  type UsageForm,
} from "./types";
import {
  activationLabel,
  approvalLabel,
  buildRunPath,
  formatTimestamp,
  getLabeledAgent,
  outcomeLabel,
  outcomeTone,
  provenanceKindLabel,
  provenanceTone,
  statusLabel,
  statusTone,
} from "./utils";

/** Props for SkillDetailPanel. */
export interface SkillDetailPanelProps {
  /** The currently selected skill detail, or null if none selected. */
  detail: SkillDetailType | null;
  /** Available agents for agent-select dropdowns. */
  agents: AgentSummary[];
  /** The currently selected instance ID. */
  instanceId: string;
  /** Whether the current user can mutate. */
  canMutate: boolean;
  /** Edit form state. */
  editForm: EditSkillForm;
  /** Edit form setter. */
  setEditForm: React.Dispatch<React.SetStateAction<EditSkillForm>>;
  /** Activation form state. */
  activationForm: ActivationForm;
  /** Activation form setter. */
  setActivationForm: React.Dispatch<React.SetStateAction<ActivationForm>>;
  /** Usage form state. */
  usageForm: UsageForm;
  /** Usage form setter. */
  setUsageForm: React.Dispatch<React.SetStateAction<UsageForm>>;
  /** Whether an update is in progress. */
  savingUpdate: boolean;
  /** Whether an activate is in progress. */
  savingActivate: boolean;
  /** Whether an archive is in progress. */
  savingArchive: boolean;
  /** Whether a usage record is in progress. */
  savingUsage: boolean;
  /** Submit handler for updating. */
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Submit handler for activating. */
  handleActivate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Click handler for archiving. */
  handleArchive: () => Promise<void>;
  /** Submit handler for recording usage. */
  handleUsage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * Detail panel for a selected skill — leads with lifecycle state, what the
 * skill does, provenance summary, activation state, recent telemetry,
 * and explicit lifecycle actions.
 */
export function SkillDetailPanel({
  detail,
  agents,
  instanceId,
  canMutate,
  editForm,
  setEditForm,
  activationForm,
  setActivationForm,
  usageForm,
  setUsageForm,
  savingUpdate,
  savingActivate,
  savingArchive,
  savingUsage,
  handleUpdate,
  handleActivate,
  handleArchive,
  handleUsage,
}: SkillDetailPanelProps) {
  if (!detail) {
    return (
      <article className="fg-card ff-skills-detail-panel ff-skills-tron-frame">
        <div className="ff-skills-detail-placeholder">
          <span className="ff-skills-kicker">Skill detail</span>
          <p className="ff-skills-detail-placeholder-text">
            Select a skill from the registry to inspect its status, instructions,
            provenance, activations, and usage telemetry.
          </p>
        </div>
      </article>
    );
  }

  const needsReview = detail.approval.posture === "review_required";
  const isActive = detail.status === "active";
  const isDraft = detail.status === "draft";
  const isArchived = detail.status === "archived";

  return (
    <article className="fg-card ff-skills-detail-panel ff-skills-tron-frame">
      {/* ── Header ── */}
      <div className="ff-skills-detail-header">
        <div>
          <p className="ff-skills-kicker">Skill</p>
          <h3>{detail.display_name}</h3>
        </div>
        <span className="ff-skills-pill ff-skills-pill-id">{detail.skill_id}</span>
      </div>

      {/* ── Status row ── */}
      <div className="ff-skills-detail-status-row">
        <span className="ff-skills-pill" data-tone={statusTone(detail.status)}>
          {statusLabel(detail.status)}
        </span>
        <span
          className="ff-skills-pill"
          data-tone={provenanceTone(detail.provenance_summary.kind)}
        >
          {detail.provenance_summary.label}
        </span>
        <span className="ff-skills-pill" data-tone="neutral">{detail.scope_label}</span>
        <span
          className="ff-skills-pill"
          data-tone={outcomeTone(detail.last_outcome)}
        >
          Last: {outcomeLabel(detail.last_outcome)}
        </span>
      </div>

      {/* ── Approval / lifecycle info ── */}
      <div className="ff-skills-detail-approval">
        <span
          className="ff-skills-status-led"
          data-state={needsReview ? "warning" : isActive ? "success" : "idle"}
        >
          {approvalLabel(detail.approval.posture)}
        </span>
      </div>

      {/* ── Summary ── */}
      <div className="ff-skills-detail-summary">
        <p>{detail.summary}</p>
      </div>

      {/* ── Recommended next action ── */}
      <div className="ff-skills-detail-next-action">
        {needsReview && (
          <span>Review and approve before activation</span>
        )}
        {isDraft && !needsReview && (
          <span>Submit for review when ready</span>
        )}
        {isActive && (
          <span>Active \u2014 monitor usage and outcomes</span>
        )}
        {isArchived && (
          <span>Archived \u2014 no longer in use</span>
        )}
      </div>

      <div className="ff-skills-detail-body">
        {/* ── Instruction core ── */}
        <details className="ff-skills-detail-details" open>
          <summary>What it does</summary>
          <pre className="ff-skills-detail-instruction">{detail.instruction_core}</pre>
        </details>

        {/* ── Provenance ── */}
        <details className="ff-skills-detail-details">
          <summary>Provenance</summary>
          <div className="ff-skills-detail-provenance">
            <p>
              <strong>Origin:</strong> {provenanceKindLabel(detail.provenance_summary.kind)}
            </p>
            <p className="ff-skills-table-meta">
              {detail.provenance_summary.detail ?? "No additional detail recorded."}
            </p>
            <div className="ff-skills-detail-links">
              {typeof detail.provenance.learning_event_id === "string" ? (
                <Link
                  className="ff-skills-nav-link"
                  to={buildLearningPath({
                    instanceId,
                    eventId: detail.provenance.learning_event_id,
                  })}
                >
                  Open learning event
                </Link>
              ) : null}
              {typeof detail.provenance.memory_id === "string" ? (
                <Link
                  className="ff-skills-nav-link"
                  to={buildMemoryPath({
                    instanceId,
                    memoryId: detail.provenance.memory_id,
                  })}
                >
                  Open source memory
                </Link>
              ) : null}
              {typeof detail.provenance.source_id === "string" ? (
                <Link
                  className="ff-skills-nav-link"
                  to={buildKnowledgeSourcePath({
                    instanceId,
                    sourceId: detail.provenance.source_id,
                  })}
                >
                  Open knowledge source
                </Link>
              ) : null}
              {detail.scope_agent ? (
                <Link
                  className="ff-skills-nav-link"
                  to={buildAgentsPath({
                    instanceId,
                    agentId: detail.scope_agent.record_id,
                  })}
                >
                  Open scope agent
                </Link>
              ) : null}
            </div>
          </div>
        </details>

        {/* ── Versions ── */}
        <details className="ff-skills-detail-details">
          <summary>Versions ({detail.versions.length})</summary>
          <div className="ff-skills-table-container">
            <table className="ff-skills-table" aria-label="Skill versions">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Summary</th>
                  <th>Provenance</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {detail.versions.map((version) => (
                  <tr key={version.version_id}>
                    <td>v{version.version_number}</td>
                    <td>
                      <span className="ff-skills-pill" data-tone={statusTone(version.status)}>
                        {statusLabel(version.status)}
                      </span>
                    </td>
                    <td>{version.summary}</td>
                    <td>
                      {typeof version.provenance.learning_event_id === "string"
                        ? `learning ${version.provenance.learning_event_id}`
                        : typeof version.provenance.memory_id === "string"
                          ? `memory ${version.provenance.memory_id}`
                          : typeof version.provenance.source_id === "string"
                            ? `source ${version.provenance.source_id}`
                            : typeof version.provenance.source === "string"
                              ? String(version.provenance.source)
                              : "registry"}
                    </td>
                    <td>{formatTimestamp(version.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {/* ── Activations ── */}
        <details className="ff-skills-detail-details">
          <summary>Activations ({detail.activations.length})</summary>
          <div className="ff-skills-table-container">
            <table className="ff-skills-table" aria-label="Skill activations">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Scope</th>
                  <th>Version</th>
                  <th>Activated</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {detail.activations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ff-skills-table-empty">
                      No activations recorded.
                    </td>
                  </tr>
                ) : (
                  detail.activations.map((activation) => (
                    <tr key={activation.activation_id}>
                      <td>
                        <span
                          className="ff-skills-pill"
                          data-tone={
                            activation.status === "active"
                              ? "success"
                              : activation.status === "inactive"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {activation.status}
                        </span>
                      </td>
                      <td>{activation.scope_label}</td>
                      <td>{activation.version_id}</td>
                      <td>{formatTimestamp(activation.activated_at)}</td>
                      <td>
                        {activation.activated_by_type}
                        {activation.activated_by_id
                          ? ` \u00b7 ${activation.activated_by_id}`
                          : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </details>

        {/* ── Usage telemetry ── */}
        <details className="ff-skills-detail-details">
          <summary>Usage telemetry</summary>
          <div className="ff-skills-detail-telemetry-strip">
            <div>
              <strong>{detail.telemetry_summary.usage_count}</strong>
              <span className="ff-skills-table-meta">Total uses</span>
            </div>
            <div>
              <strong className="ff-skills-stat-success">{detail.telemetry_summary.success_count}</strong>
              <span className="ff-skills-table-meta">Success</span>
            </div>
            <div>
              <strong className="ff-skills-stat-warning">{detail.telemetry_summary.blocked_count}</strong>
              <span className="ff-skills-table-meta">Blocked</span>
            </div>
            <div>
              <strong className="ff-skills-stat-danger">{detail.telemetry_summary.error_count}</strong>
              <span className="ff-skills-table-meta">Errors</span>
            </div>
          </div>
          <div className="ff-skills-table-container">
            <table className="ff-skills-table" aria-label="Recent skill usage">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Version</th>
                  <th>Outcome</th>
                  <th>Run / conversation</th>
                  <th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {detail.recent_usage.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ff-skills-table-empty">
                      No usage recorded.
                    </td>
                  </tr>
                ) : (
                  detail.recent_usage.map((usage) => (
                    <tr key={usage.usage_event_id}>
                      <td>{formatTimestamp(usage.created_at)}</td>
                      <td>v{usage.version_number ?? "?"}</td>
                      <td>
                        <span
                          className="ff-skills-pill"
                          data-tone={outcomeTone(usage.outcome)}
                        >
                          {outcomeLabel(usage.outcome)}
                        </span>
                      </td>
                      <td>
                        {usage.run_id ? (
                          <Link className="ff-skills-nav-link" to={buildRunPath(instanceId, usage.run_id)}>
                            run {usage.run_id}
                          </Link>
                        ) : (
                          "no run"
                        )}
                        {usage.conversation_id ? (
                          <>
                            <br />
                            <Link
                              className="ff-skills-nav-link"
                              to={buildConversationPath({
                                instanceId,
                                conversationId: usage.conversation_id,
                              })}
                            >
                              conversation {usage.conversation_id}
                            </Link>
                          </>
                        ) : null}
                      </td>
                      <td>
                        {getLabeledAgent(agents, usage.agent_id) ??
                          usage.agent_id ??
                          "none"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </details>

        {/* ── Edit form ── */}
        <details className="ff-skills-detail-details">
          <summary>Edit skill</summary>
          <form className="ff-skills-detail-form" onSubmit={handleUpdate}>
            <div className="ff-skills-create-grid">
              <label className="ff-skills-field">
                Display name
                <input
                  value={editForm.displayName}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="ff-skills-field">
                Status
                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      status: event.target.value as SkillStatus,
                    }))
                  }
                >
                  {MUTABLE_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "draft" ? "Draft" : option === "review" ? "Pending review" : "Active"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ff-skills-field">
                Scope
                <select
                  value={editForm.scope}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      scope: event.target.value as SkillScope,
                    }))
                  }
                >
                  {SCOPE_OPTIONS.filter((option) => option !== "all").map(
                    (option) => (
                      <option key={option} value={option}>
                        {option === "instance" ? "Instance scope" : "Agent scope"}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="ff-skills-field">
                Scope agent
                <select
                  value={editForm.scopeAgentId}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      scopeAgentId: event.target.value,
                    }))
                  }
                >
                  <option value="">None</option>
                  {agents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="ff-skills-field">
              Summary
              <textarea
                rows={2}
                value={editForm.summary}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
              />
            </label>
            <label className="ff-skills-field">
              Instruction core
              <textarea
                rows={4}
                value={editForm.instructionCore}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    instructionCore: event.target.value,
                  }))
                }
              />
            </label>

            <details>
              <summary>Provenance</summary>
              <div className="ff-skills-create-grid">
                <label className="ff-skills-field">
                  Origin
                  <select
                    value={editForm.provenance.originKind}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        provenance: {
                          ...current.provenance,
                          originKind: event.target.value as SkillProvenanceKind,
                        },
                      }))
                    }
                  >
                    {PROVENANCE_KIND_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ff-skills-field">
                  Learning event ID
                  <input
                    value={editForm.provenance.learningEventId}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        provenance: {
                          ...current.provenance,
                          learningEventId: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="ff-skills-field">
                  Memory ID
                  <input
                    value={editForm.provenance.memoryId}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        provenance: {
                          ...current.provenance,
                          memoryId: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="ff-skills-field">
                  Source ID
                  <input
                    value={editForm.provenance.sourceId}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        provenance: {
                          ...current.provenance,
                          sourceId: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="ff-skills-field">
                  Plugin name
                  <input
                    value={editForm.provenance.pluginName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        provenance: {
                          ...current.provenance,
                          pluginName: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="ff-skills-field">
                  Note
                  <input
                    value={editForm.provenance.note}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        provenance: {
                          ...current.provenance,
                          note: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <details>
                <summary>Raw JSON</summary>
                <textarea
                  className="ff-skills-json-field"
                  rows={4}
                  value={editForm.provenance.extraJson}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      provenance: {
                        ...current.provenance,
                        extraJson: event.target.value,
                      },
                    }))
                  }
                />
              </details>
            </details>

            <details>
              <summary>Activation policy</summary>
              <div className="ff-skills-create-grid">
                <label className="ff-skills-field">
                  Preview required
                  <select
                    value={editForm.activationSettings.previewRequired ? "yes" : "no"}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        activationSettings: {
                          ...current.activationSettings,
                          previewRequired: event.target.value === "yes",
                        },
                      }))
                    }
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label className="ff-skills-field">
                  Channel hint
                  <input
                    value={editForm.activationSettings.channelHint}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        activationSettings: {
                          ...current.activationSettings,
                          channelHint: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="ff-skills-field">
                  Activation note
                  <input
                    value={editForm.activationSettings.note}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        activationSettings: {
                          ...current.activationSettings,
                          note: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <details>
                <summary>Raw JSON</summary>
                <textarea
                  className="ff-skills-json-field"
                  rows={4}
                  value={editForm.activationSettings.extraJson}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      activationSettings: {
                        ...current.activationSettings,
                        extraJson: event.target.value,
                      },
                    }))
                  }
                />
              </details>
            </details>

            <details>
              <summary>Metadata JSON</summary>
              <textarea
                className="ff-skills-json-field"
                rows={4}
                value={editForm.metadataJson}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    metadataJson: event.target.value,
                  }))
                }
              />
            </details>

            <div className="ff-skills-create-actions">
              <button type="submit" disabled={!canMutate || savingUpdate}>
                {savingUpdate ? "Saving\u2026" : "Save changes"}
              </button>
            </div>
          </form>
        </details>

        {/* ── Lifecycle actions ── */}
        <div className="ff-skills-lifecycle-actions">
          <h4>Lifecycle actions</h4>
          <div className="ff-skills-lifecycle-buttons">
            <button
              type="button"
              className="ff-skills-lifecycle-btn"
              disabled={!canMutate || isArchived || isActive}
              onClick={() => {
                setEditForm((current) => ({ ...current, status: "review" }));
                // Programmatically submit the edit form to trigger handleUpdate
                const editFormElement = document.querySelector<HTMLFormElement>(".ff-skills-detail-form");
                if (editFormElement) editFormElement.requestSubmit();
              }}
            >
              Submit for review
            </button>

            <form className="ff-skills-lifecycle-form" onSubmit={handleActivate}>
              <div className="ff-skills-lifecycle-activate-fields">
                <select
                  value={activationForm.versionId}
                  onChange={(event) =>
                    setActivationForm((current) => ({
                      ...current,
                      versionId: event.target.value,
                    }))
                  }
                >
                  {detail.versions.map((version) => (
                    <option key={version.version_id} value={version.version_id}>
                      v{version.version_number} \u00b7 {statusLabel(version.status)}
                    </option>
                  ))}
                </select>
                <select
                  value={activationForm.scope}
                  onChange={(event) =>
                    setActivationForm((current) => ({
                      ...current,
                      scope: event.target.value as SkillScope,
                    }))
                  }
                >
                  {SCOPE_OPTIONS.filter((option) => option !== "all").map(
                    (option) => (
                      <option key={option} value={option}>
                        {option === "instance" ? "Instance" : "Agent"}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <button
                type="submit"
                className="ff-skills-lifecycle-btn ff-skills-lifecycle-btn-primary"
                disabled={!canMutate || isArchived || savingActivate}
              >
                {savingActivate ? "Activating\u2026" : "Activate skill"}
              </button>
            </form>

            <button
              type="button"
              className="ff-skills-lifecycle-btn ff-skills-lifecycle-btn-danger"
              disabled={!canMutate || savingArchive}
              onClick={() => void handleArchive()}
            >
              {savingArchive ? "Archiving\u2026" : "Archive skill"}
            </button>
          </div>
          <p className="ff-skills-table-meta">
            Archiving keeps versions, activations, and telemetry. It is not a delete action.
          </p>
        </div>

        {/* ── Record usage form ── */}
        <details className="ff-skills-detail-details">
          <summary>Record usage event</summary>
          <form className="ff-skills-detail-form" onSubmit={handleUsage}>
            <div className="ff-skills-create-grid">
              <label className="ff-skills-field">
                Version
                <select
                  value={usageForm.versionId}
                  onChange={(event) =>
                    setUsageForm((current) => ({
                      ...current,
                      versionId: event.target.value,
                    }))
                  }
                >
                  <option value="">Current</option>
                  {detail.versions.map((version) => (
                    <option key={version.version_id} value={version.version_id}>
                      v{version.version_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ff-skills-field">
                Activation
                <select
                  value={usageForm.activationId}
                  onChange={(event) =>
                    setUsageForm((current) => ({
                      ...current,
                      activationId: event.target.value,
                    }))
                  }
                >
                  <option value="">None</option>
                  {detail.activations.map((activation) => (
                    <option
                      key={activation.activation_id}
                      value={activation.activation_id}
                    >
                      {activationLabel(activation)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ff-skills-field">
                Agent
                <select
                  value={usageForm.agentId}
                  onChange={(event) =>
                    setUsageForm((current) => ({
                      ...current,
                      agentId: event.target.value,
                    }))
                  }
                >
                  <option value="">None</option>
                  {agents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ff-skills-field">
                Outcome
                <select
                  value={usageForm.outcome}
                  onChange={(event) =>
                    setUsageForm((current) => ({
                      ...current,
                      outcome: event.target.value as SkillUsageOutcome,
                    }))
                  }
                >
                  {USAGE_OUTCOME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "success" ? "Success" : option === "blocked" ? "Blocked" : "Error"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="ff-skills-create-grid">
              <label className="ff-skills-field">
                Run ID
                <input
                  value={usageForm.runId}
                  onChange={(event) =>
                    setUsageForm((current) => ({
                      ...current,
                      runId: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="ff-skills-field">
                Conversation ID
                <input
                  value={usageForm.conversationId}
                  onChange={(event) =>
                    setUsageForm((current) => ({
                      ...current,
                      conversationId: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="ff-skills-field">
                Decision
                <input
                  value={usageForm.decision}
                  onChange={(event) =>
                    setUsageForm((current) => ({
                      ...current,
                      decision: event.target.value,
                    }))
                  }
                  placeholder="allow / block / escalate"
                />
              </label>
              <label className="ff-skills-field">
                Usage note
                <input
                  value={usageForm.note}
                  onChange={(event) =>
                    setUsageForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <details>
              <summary>Raw details JSON</summary>
              <textarea
                className="ff-skills-json-field"
                rows={4}
                value={usageForm.detailsJson}
                onChange={(event) =>
                  setUsageForm((current) => ({
                    ...current,
                    detailsJson: event.target.value,
                  }))
                }
              />
            </details>
            <div className="ff-skills-create-actions">
              <button type="submit" disabled={!canMutate || savingUsage}>
                {savingUsage ? "Recording\u2026" : "Record usage"}
              </button>
            </div>
          </form>
        </details>
      </div>
    </article>
  );
}
