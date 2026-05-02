/**
 * Guided creation flow for new skills.
 *
 * The form is hidden until the operator explicitly clicks "Create skill".
 * Required fields are shown first; provenance, activation, and advanced
 * metadata are progressively disclosed in collapsed sections.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";

import type {
  AgentSummary,
  SkillProvenanceKind,
  SkillScope,
  SkillStatus,
} from "../../api/domain";
import {
  CREATE_STATUS_OPTIONS,
  PROVENANCE_KIND_OPTIONS,
  SCOPE_OPTIONS,
  type CreateSkillForm,
} from "./types";
import { normalizeText } from "./utils";

/** Props for CreateSkillPanel. */
export interface CreateSkillPanelProps {
  /** Create skill form state. */
  createForm: CreateSkillForm;
  /** Create form setter. */
  setCreateForm: React.Dispatch<React.SetStateAction<CreateSkillForm>>;
  /** Available agents for the scope-agent select. */
  agents: AgentSummary[];
  /** Whether the current user can mutate. */
  canMutate: boolean;
  /** Whether a create request is in progress. */
  savingCreate: boolean;
  /** Submit handler. */
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Handler to cancel creation and return to browsing. */
  onCancel: () => void;
}

/**
 * Guided create-skill panel with progressive disclosure.
 *
 * Sections: Basic information, Scope, Instructions, Provenance,
 * Activation rules, Advanced metadata.
 */
export function CreateSkillPanel({
  createForm,
  setCreateForm,
  agents,
  canMutate,
  savingCreate,
  handleCreate,
  onCancel,
}: CreateSkillPanelProps) {
  return (
    <article className="fg-card ff-skills-create-panel ff-skills-tron-frame">
      <div className="ff-skills-create-header">
        <div>
          <p className="ff-skills-kicker">Create skill</p>
          <h3>New skill</h3>
        </div>
        <span className="ff-skills-status-led" data-state="success">
          Draft
        </span>
      </div>
      <p className="ff-skills-create-note">
        Creating a skill saves it as a draft. Activation is a separate review
        step \u2014 creation does not make the skill live.
      </p>

      <form className="ff-skills-create-form" onSubmit={handleCreate}>
        {/* ── Section 1: Basic information ── */}
        <section className="ff-skills-create-section">
          <h4>Basic information</h4>
          <div className="ff-skills-create-grid">
            <label className="ff-skills-field ff-skills-field-required">
              Skill name
              <input
                value={createForm.displayName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="Pricing Review"
              />
            </label>
            <label className="ff-skills-field">
              Skill ID
              <input
                value={createForm.skillId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    skillId: event.target.value,
                  }))
                }
                placeholder="skill_pricing_review (auto if empty)"
              />
            </label>
            <label className="ff-skills-field">
              Initial status
              <select
                value={createForm.status}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    status: event.target.value as SkillStatus,
                  }))
                }
              >
                {CREATE_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "draft" ? "Draft" : "Submit for review"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="ff-skills-field ff-skills-field-required">
            Summary
            <textarea
              rows={2}
              value={createForm.summary}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  summary: event.target.value,
                }))
              }
              placeholder="What this skill does in one or two sentences."
            />
          </label>
        </section>

        {/* ── Section 2: Scope ── */}
        <section className="ff-skills-create-section">
          <h4>Scope</h4>
          <div className="ff-skills-create-grid">
            <label className="ff-skills-field ff-skills-field-required">
              Scope
              <select
                value={createForm.scope}
                onChange={(event) =>
                  setCreateForm((current) => ({
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
            {createForm.scope === "agent" && (
              <label className="ff-skills-field ff-skills-field-required">
                Scope agent
                <select
                  value={createForm.scopeAgentId}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      scopeAgentId: event.target.value,
                    }))
                  }
                >
                  <option value="">Select an agent\u2026</option>
                  {agents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.display_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        {/* ── Section 3: Instructions ── */}
        <section className="ff-skills-create-section">
          <h4>Instructions</h4>
          <label className="ff-skills-field ff-skills-field-required">
            Instruction core
            <textarea
              rows={5}
              value={createForm.instructionCore}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  instructionCore: event.target.value,
                }))
              }
              placeholder="Define the core instruction the agent will execute. Be specific about the behavior, constraints, and expected output."
            />
          </label>
        </section>

        {/* ── Section 4: Provenance ── */}
        <details className="ff-skills-create-details">
          <summary>Provenance (optional)</summary>
          <section className="ff-skills-create-section">
            <p className="ff-skills-create-note">
              Provenance tracks where this skill originated \u2014 from an
              operator, a learning event, memory, a knowledge source, or a plugin.
            </p>
            <div className="ff-skills-create-grid">
              <label className="ff-skills-field">
                Origin
                <select
                  value={createForm.provenance.originKind}
                  onChange={(event) =>
                    setCreateForm((current) => ({
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
                      {option === "operator"
                        ? "Created by operator"
                        : option === "learning"
                          ? "Promoted from learning"
                          : option === "memory"
                            ? "Derived from memory"
                            : option === "knowledge_source"
                              ? "From knowledge source"
                              : option === "plugin"
                                ? "Plugin-managed"
                                : "Unknown origin"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ff-skills-field">
                Learning event ID
                <input
                  value={createForm.provenance.learningEventId}
                  onChange={(event) =>
                    setCreateForm((current) => ({
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
                  value={createForm.provenance.memoryId}
                  onChange={(event) =>
                    setCreateForm((current) => ({
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
                  value={createForm.provenance.sourceId}
                  onChange={(event) =>
                    setCreateForm((current) => ({
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
                  value={createForm.provenance.pluginName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
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
                  value={createForm.provenance.note}
                  onChange={(event) =>
                    setCreateForm((current) => ({
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
              <summary>Raw provenance JSON</summary>
              <textarea
                className="ff-skills-json-field"
                rows={4}
                value={createForm.provenance.extraJson}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    provenance: {
                      ...current.provenance,
                      extraJson: event.target.value,
                    },
                  }))
                }
              />
            </details>
          </section>
        </details>

        {/* ── Section 5: Activation rules ── */}
        <details className="ff-skills-create-details">
          <summary>Activation rules (optional)</summary>
          <section className="ff-skills-create-section">
            <p className="ff-skills-create-note">
              These are default activation policy settings. They can be
              overridden when the skill is explicitly activated.
            </p>
            <div className="ff-skills-create-grid">
              <label className="ff-skills-field">
                Preview required
                <select
                  value={createForm.activationSettings.previewRequired ? "yes" : "no"}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      activationSettings: {
                        ...current.activationSettings,
                        previewRequired: event.target.value === "yes",
                      },
                    }))
                  }
                >
                  <option value="no">No (run immediately)</option>
                  <option value="yes">Yes (preview before run)</option>
                </select>
              </label>
              <label className="ff-skills-field">
                Preferred channel
                <input
                  value={createForm.activationSettings.channelHint}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      activationSettings: {
                        ...current.activationSettings,
                        channelHint: event.target.value,
                      },
                    }))
                  }
                  placeholder="email, slack, api, etc."
                />
              </label>
              <label className="ff-skills-field">
                Activation note
                <input
                  value={createForm.activationSettings.note}
                  onChange={(event) =>
                    setCreateForm((current) => ({
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
              <summary>Raw activation JSON</summary>
              <textarea
                className="ff-skills-json-field"
                rows={4}
                value={createForm.activationSettings.extraJson}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    activationSettings: {
                      ...current.activationSettings,
                      extraJson: event.target.value,
                    },
                  }))
                }
              />
            </details>
          </section>
        </details>

        {/* ── Section 6: Advanced metadata ── */}
        <details className="ff-skills-create-details">
          <summary>Advanced metadata (JSON)</summary>
          <section className="ff-skills-create-section">
            <p className="ff-skills-create-note">
              Arbitrary metadata stored with the skill. This is typically
              consumed by integrations or automated tooling.
            </p>
            <textarea
              className="ff-skills-json-field"
              rows={5}
              value={createForm.metadataJson}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  metadataJson: event.target.value,
                }))
              }
            />
          </section>
        </details>

        {/* ── Actions ── */}
        <div className="ff-skills-create-actions">
          <button
            type="submit"
            className="ff-skills-primary-action"
            disabled={
              !canMutate ||
              savingCreate ||
              !normalizeText(createForm.displayName) ||
              !normalizeText(createForm.instructionCore)
            }
          >
            {savingCreate ? "Creating skill\u2026" : "Save draft"}
          </button>
          <button
            type="button"
            className="ff-skills-secondary-action"
            onClick={onCancel}
            disabled={savingCreate}
          >
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}
