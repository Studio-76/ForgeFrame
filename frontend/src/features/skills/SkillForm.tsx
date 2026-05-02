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

/**
 * Props for the SkillForm component.
 */
export interface SkillFormProps {
  /** Create skill form state. */
  createForm: CreateSkillForm;
  /** Create form setter. */
  setCreateForm: React.Dispatch<React.SetStateAction<CreateSkillForm>>;
  /** Available agents for the scope-agent select dropdown. */
  agents: AgentSummary[];
  /** The currently selected instance ID (used to gate the submit button). */
  instanceId: string;
  /** Whether the current user can mutate skills. */
  canMutate: boolean;
  /** Whether a create request is in progress. */
  savingCreate: boolean;
  /** Submit handler for creating a new skill registry entry. */
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * Create skill registry entry form (bottom card) for the Skills page.
 *
 * Renders all provenance, activation posture, and metadata fields for
 * creating a new draft or review-stage skill registry object.
 */
export function SkillForm({
  createForm,
  setCreateForm,
  agents,
  instanceId,
  canMutate,
  savingCreate,
  handleCreate,
}: SkillFormProps) {
  return (
    <article className="fg-card">
      <h3>Create skill registry entry</h3>
      <p className="fg-muted">
        Create a draft or review-stage registry object. Activation is a separate
        explicit step, so creation does not silently make the skill live.
      </p>
      <form className="fg-stack" onSubmit={handleCreate}>
        <div className="fg-grid fg-grid-compact">
          <label>
            Skill ID
            <input
              value={createForm.skillId}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  skillId: event.target.value,
                }))
              }
              placeholder="skill_pricing_review"
            />
          </label>
          <label>
            Display name
            <input
              value={createForm.displayName}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Status
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
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="fg-grid fg-grid-compact">
          <label>
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
                    {option}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
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
              <option value="">none</option>
              {agents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {agent.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Summary
          <textarea
            rows={3}
            value={createForm.summary}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                summary: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Instruction core
          <textarea
            rows={6}
            value={createForm.instructionCore}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                instructionCore: event.target.value,
              }))
            }
          />
        </label>

        <section className="fg-subcard">
          <h4>Provenance</h4>
          <div className="fg-grid fg-grid-compact">
            <label>
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
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
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
            <label>
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
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
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
            <label>
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
            <label>
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
            <summary>Additional provenance JSON</summary>
            <textarea
              rows={6}
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

        <section className="fg-subcard">
          <h4>Default activation posture</h4>
          <div className="fg-grid fg-grid-compact">
            <label>
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
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
            </label>
            <label>
              Channel hint
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
              />
            </label>
            <label>
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
            <summary>Additional activation JSON</summary>
            <textarea
              rows={6}
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

        <details>
          <summary>Metadata JSON</summary>
          <textarea
            rows={6}
            value={createForm.metadataJson}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                metadataJson: event.target.value,
              }))
            }
          />
        </details>

        <div className="fg-actions">
          <button
            type="submit"
            disabled={
              !canMutate ||
              savingCreate ||
              !instanceId ||
              !normalizeText(createForm.displayName) ||
              !normalizeText(createForm.instructionCore)
            }
          >
            {savingCreate ? "Creating skill" : "Create registry entry"}
          </button>
        </div>
      </form>
    </article>
  );
}
