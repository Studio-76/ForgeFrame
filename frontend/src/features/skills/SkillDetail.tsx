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
  formatTimestamp,
  getLabeledAgent,
  outcomeLabel,
  outcomeTone,
  provenanceTone,
  statusTone,
  buildRunPath,
} from "./utils";

/**
 * Props for the SkillDetail component.
 */
export interface SkillDetailProps {
  /** The currently selected skill detail, or null if none selected. */
  detail: SkillDetailType | null;
  /** Available agents for agent-select dropdowns and display lookups. */
  agents: AgentSummary[];
  /** The currently selected instance ID (used for navigation links). */
  instanceId: string;
  /** Whether the current user can mutate skills. */
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
  /** Whether an update request is in progress. */
  savingUpdate: boolean;
  /** Whether an activate request is in progress. */
  savingActivate: boolean;
  /** Whether an archive request is in progress. */
  savingArchive: boolean;
  /** Whether a usage record request is in progress. */
  savingUsage: boolean;
  /** Submit handler for updating the registry entry. */
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Submit handler for activating a skill version. */
  handleActivate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Click handler for archiving the skill. */
  handleArchive: () => Promise<void>;
  /** Submit handler for recording usage telemetry. */
  handleUsage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * Right panel for the Skills page showing the selected skill detail.
 *
 * Renders the detail heading (name + ID pill), a pills row for status/provenance/
 * outcome/scope, and subcards for registry overview, provenance & boundaries,
 * versions, activations, usage telemetry, the update form, the activate form,
 * and the record-usage form.
 */
export function SkillDetail({
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
}: SkillDetailProps) {
  return (
    <article className="fg-card">
      <div className="fg-section-heading">
        <div>
          <h3>{detail ? detail.display_name : "Skill detail"}</h3>
          <p className="fg-muted">
            {detail
              ? `Skill ${detail.skill_id}`
              : "Select a skill to inspect versions, activations, provenance, and telemetry."}
          </p>
        </div>
        {detail ? <span className="fg-pill">{detail.skill_id}</span> : null}
      </div>

      {detail ? (
        <div className="fg-stack">
          {/* ── Status / provenance / outcome / scope pills ── */}
          <div className="fg-inline-form">
            <span className="fg-pill" data-tone={statusTone(detail.status)}>
              {detail.status}
            </span>
            <span
              className="fg-pill"
              data-tone={provenanceTone(detail.provenance_summary.kind)}
            >
              {detail.provenance_summary.label}
            </span>
            <span
              className="fg-pill"
              data-tone={outcomeTone(detail.last_outcome)}
            >
              {outcomeLabel(detail.last_outcome)}
            </span>
            <span className="fg-pill">{detail.scope_label}</span>
          </div>

          {/* ── Registry overview ── */}
          <article className="fg-subcard">
            <h4>Registry overview</h4>
            <div className="fg-grid fg-grid-compact">
              <div>
                <strong>Approval posture</strong>
                <p>{detail.approval.label}</p>
                <p className="fg-muted">{detail.approval.note}</p>
              </div>
              <div>
                <strong>Scope</strong>
                <p>{detail.scope_label}</p>
                <p className="fg-muted">
                  {detail.scope_agent?.label ?? "No agent pin."}
                </p>
              </div>
              <div>
                <strong>Telemetry</strong>
                <p>{detail.telemetry_summary.usage_count} recorded uses</p>
                <p className="fg-muted">
                  Last outcome: {outcomeLabel(detail.telemetry_summary.last_outcome)}
                </p>
              </div>
            </div>
          </article>

          {/* ── Provenance and boundaries ── */}
          <article className="fg-subcard">
            <h4>Provenance and boundaries</h4>
            <p>{detail.provenance_summary.label}</p>
            <p className="fg-muted">
              {detail.provenance_summary.detail ??
                "No additional provenance note was recorded."}
            </p>
            <p className="fg-muted">
              {detail.provenance_summary.kind === "plugin"
                ? "This skill is plugin-managed provenance, but still remains a registry object with versions, activations, and telemetry."
                : "This skill is distinct from plugins, harness runs, and provider targets. Those surfaces may reference the skill, but they do not replace the skill registry."}
            </p>
            <div className="fg-actions">
              {typeof detail.provenance.learning_event_id === "string" ? (
                <Link
                  className="fg-nav-link"
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
                  className="fg-nav-link"
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
                  className="fg-nav-link"
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
                  className="fg-nav-link"
                  to={buildAgentsPath({
                    instanceId,
                    agentId: detail.scope_agent.record_id,
                  })}
                >
                  Open scope agent
                </Link>
              ) : null}
            </div>
          </article>

          {/* ── Versions table ── */}
          <article className="fg-subcard">
            <h4>Versions</h4>
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Skill versions">
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
                        <span
                          className="fg-pill"
                          data-tone={statusTone(version.status)}
                        >
                          {version.status}
                        </span>
                      </td>
                      <td>{version.summary}</td>
                      <td>
                        {typeof version.provenance.learning_event_id ===
                        "string"
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
          </article>

          {/* ── Activations table ── */}
          <article className="fg-subcard">
            <h4>Activations</h4>
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Skill activations">
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
                      <td colSpan={5}>No activations recorded.</td>
                    </tr>
                  ) : (
                    detail.activations.map((activation) => (
                      <tr key={activation.activation_id}>
                        <td>
                          <span
                            className="fg-pill"
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
          </article>

          {/* ── Usage telemetry ── */}
          <article className="fg-subcard">
            <h4>Usage telemetry</h4>
            <div className="fg-grid fg-grid-compact">
              <div>
                <strong>Usage count</strong>
                <p>{detail.telemetry_summary.usage_count}</p>
              </div>
              <div>
                <strong>Last outcome</strong>
                <p>{outcomeLabel(detail.telemetry_summary.last_outcome)}</p>
              </div>
              <div>
                <strong>Outcome mix</strong>
                <p>
                  {detail.telemetry_summary.success_count} success /{" "}
                  {detail.telemetry_summary.blocked_count} blocked /{" "}
                  {detail.telemetry_summary.error_count} error
                </p>
              </div>
            </div>
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Recent skill usage">
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
                      <td colSpan={5}>No usage recorded.</td>
                    </tr>
                  ) : (
                    detail.recent_usage.map((usage) => (
                      <tr key={usage.usage_event_id}>
                        <td>{formatTimestamp(usage.created_at)}</td>
                        <td>v{usage.version_number ?? "?"}</td>
                        <td>
                          <span
                            className="fg-pill"
                            data-tone={outcomeTone(usage.outcome)}
                          >
                            {usage.outcome}
                          </span>
                        </td>
                        <td>
                          {usage.run_id ? (
                            <Link to={buildRunPath(instanceId, usage.run_id)}>
                              run {usage.run_id}
                            </Link>
                          ) : (
                            "no run"
                          )}
                          {usage.conversation_id ? (
                            <>
                              <br />
                              <Link
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
          </article>

          {/* ── Update registry entry form ── */}
          <form className="fg-stack" onSubmit={handleUpdate}>
            <article className="fg-subcard">
              <h4>Update registry entry</h4>
              <div className="fg-grid fg-grid-compact">
                <label>
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
                <label>
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
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
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
                          {option}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
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
                    <option value="">none</option>
                    {agents.map((agent) => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Summary
                  <textarea
                    rows={3}
                    value={editForm.summary}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                Instruction core
                <textarea
                  rows={6}
                  value={editForm.instructionCore}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      instructionCore: event.target.value,
                    }))
                  }
                />
              </label>
            </article>

            <article className="fg-subcard">
              <h4>Provenance</h4>
              <div className="fg-grid fg-grid-compact">
                <label>
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
                <label>
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
                <label>
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
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
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
                <label>
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
                <label>
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
                <summary>Additional provenance JSON</summary>
                <textarea
                  rows={6}
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
            </article>

            <article className="fg-subcard">
              <h4>Default activation posture</h4>
              <div className="fg-grid fg-grid-compact">
                <label>
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
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </select>
                </label>
                <label>
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
                <label>
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
                <summary>Additional activation JSON</summary>
                <textarea
                  rows={6}
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
            </article>

            <details>
              <summary>Metadata JSON</summary>
              <textarea
                rows={6}
                value={editForm.metadataJson}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    metadataJson: event.target.value,
                  }))
                }
              />
            </details>

            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingUpdate}>
                {savingUpdate ? "Saving skill" : "Save registry entry"}
              </button>
            </div>
          </form>

          {/* ── Activate version form ── */}
          <form className="fg-stack" onSubmit={handleActivate}>
            <article className="fg-subcard">
              <h4>Activate version</h4>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Version
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
                        v{version.version_number} \u00b7 {version.status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Scope
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
                          {option}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Scope agent
                  <select
                    value={activationForm.scopeAgentId}
                    onChange={(event) =>
                      setActivationForm((current) => ({
                        ...current,
                        scopeAgentId: event.target.value,
                      }))
                    }
                  >
                    <option value="">none</option>
                    {agents.map((agent) => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.display_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Preview required
                  <select
                    value={activationForm.settings.previewRequired ? "yes" : "no"}
                    onChange={(event) =>
                      setActivationForm((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          previewRequired: event.target.value === "yes",
                        },
                      }))
                    }
                  >
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </select>
                </label>
                <label>
                  Channel hint
                  <input
                    value={activationForm.settings.channelHint}
                    onChange={(event) =>
                      setActivationForm((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          channelHint: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Activation note
                  <input
                    value={activationForm.settings.note}
                    onChange={(event) =>
                      setActivationForm((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          note: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <details>
                <summary>Additional activation metadata</summary>
                <textarea
                  rows={5}
                  value={activationForm.metadataJson}
                  onChange={(event) =>
                    setActivationForm((current) => ({
                      ...current,
                      metadataJson: event.target.value,
                    }))
                  }
                />
                <textarea
                  rows={5}
                  value={activationForm.settings.extraJson}
                  onChange={(event) =>
                    setActivationForm((current) => ({
                      ...current,
                      settings: {
                        ...current.settings,
                        extraJson: event.target.value,
                      },
                    }))
                  }
                />
              </details>
            </article>

            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingActivate}>
                {savingActivate ? "Activating" : "Activate skill version"}
              </button>
              <button
                type="button"
                disabled={!canMutate || savingArchive}
                onClick={() => void handleArchive()}
              >
                {savingArchive ? "Archiving" : "Archive skill"}
              </button>
            </div>
            <p className="fg-muted">
              Archiving keeps versions, activations, and usage telemetry. It is
              not a delete action.
            </p>
          </form>

          {/* ── Record usage telemetry form ── */}
          <form className="fg-stack" onSubmit={handleUsage}>
            <article className="fg-subcard">
              <h4>Record usage telemetry</h4>
              <div className="fg-grid fg-grid-compact">
                <label>
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
                    <option value="">current</option>
                    {detail.versions.map((version) => (
                      <option key={version.version_id} value={version.version_id}>
                        v{version.version_number}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
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
                    <option value="">none</option>
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
                <label>
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
                    <option value="">none</option>
                    {agents.map((agent) => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.display_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
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
                <label>
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
                <label>
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
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
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
                <label>
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
                <summary>Additional usage details JSON</summary>
                <textarea
                  rows={5}
                  value={usageForm.detailsJson}
                  onChange={(event) =>
                    setUsageForm((current) => ({
                      ...current,
                      detailsJson: event.target.value,
                    }))
                  }
                />
              </details>
            </article>

            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingUsage}>
                {savingUsage ? "Recording usage" : "Record usage"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="fg-muted">
          Select a skill to inspect versions, activations, provenance, approval
          posture, and telemetry.
        </p>
      )}
    </article>
  );
}
