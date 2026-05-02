/**
 * Manual review-item creation form — hidden by default, activated on demand.
 *
 * @packageDocumentation
 */

import { useState, type FormEvent } from "react";
import {
  TRIGGER_OPTIONS,
  DECISION_OPTIONS,
  DECISION_LABELS,
  MEMORY_KIND_OPTIONS,
  MEMORY_VISIBILITY_OPTIONS,
  MEMORY_SENSITIVITY_OPTIONS,
  MEMORY_TRUST_OPTIONS,
  SKILL_SCOPE_OPTIONS,
  DEFAULT_CREATE_FORM,
} from "./types";
import { isMemoryDecision, isSkillDecision } from "./utils";
import type { UseLearningPageReturn } from "./hooks";

const STEP_LABELS = [
  "Source",
  "Summary",
  "Explanation",
  "Evidence",
  "Outcome",
] as const;

/** Props for CreateManualForm. */
export interface CreateManualFormProps {
  /** Whether the form is visible. */
  visible: boolean;
  /** Callback to close the form. */
  onClose: () => void;
  /** Create form state. */
  createForm: UseLearningPageReturn["createForm"];
  /** Set a field in the create form. */
  setCreateFormField: UseLearningPageReturn["setCreateFormField"];
  /** Handle form submission for creation. */
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Whether saving is in progress. */
  savingCreate: boolean;
  /** Whether the user can mutate. */
  canMutate: boolean;
  /** Whether the instance ID is available. */
  hasInstance: boolean;
}

/**
 * Manual review-item creation form.
 * Hidden by default; operators click "Create manual review item" to reveal it.
 * Follows a guided step flow: Source → Summary → Explanation → Evidence → Outcome.
 */
export function CreateManualForm({
  visible,
  onClose,
  createForm,
  setCreateFormField,
  handleCreate,
  savingCreate,
  canMutate,
  hasInstance,
}: CreateManualFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  if (!visible) {
    return null;
  }

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    setCurrentStep(1);
    void handleCreate(event);
  };

  return (
    <article className="fg-card ff-learning-manual-form ff-learning-tron-frame">
      <div className="fg-section-heading ff-learning-manual-header">
        <div>
          <p className="ff-learning-kicker">Manual learning intake</p>
          <h3>Create manual review item</h3>
          <p className="fg-muted">
            Capture an operator-supplied learning candidate when runtime
            evidence did not create one. It still enters the same review queue
            before memory or skill state changes.
          </p>
        </div>
        <div className="ff-learning-manual-header-actions">
          <span className="ff-learning-status-led" data-state="warning">
            Draft intake
          </span>
          <button
            type="button"
            className="ff-learning-secondary-action"
            onClick={onClose}
            aria-label="Close manual review form"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="ff-learning-steps" aria-label="Manual review item steps">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const isActive = currentStep === stepNumber;
          const isDone = stepNumber < currentStep;

          return (
            <div
              key={label}
              className={`ff-learning-step${isActive ? " ff-learning-step-active" : ""}${isDone ? " ff-learning-step-done" : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="ff-learning-step-num">{stepNumber}</span>
              <span className="ff-learning-step-label">{label}</span>
            </div>
          );
        })}
      </div>

      <form className="fg-stack ff-learning-manual-stack" onSubmit={handleFormSubmit}>
        {/* Step 1: Source */}
        {currentStep === 1 && (
          <div className="ff-learning-step-content">
            <h4>Step 1: Source</h4>
            <div className="fg-grid fg-grid-compact ff-learning-form-grid">
              <label>
                Trigger
                <select
                  value={createForm.triggerKind}
                  onChange={(event) =>
                    setCreateFormField(
                      "triggerKind",
                      event.target.value as (typeof DEFAULT_CREATE_FORM)["triggerKind"],
                    )
                  }
                >
                  {TRIGGER_OPTIONS.filter((option) => option !== "all").map(
                    (option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Suggested path
                <select
                  value={createForm.suggestedDecision}
                  onChange={(event) =>
                    setCreateFormField(
                      "suggestedDecision",
                      event.target.value as (typeof DEFAULT_CREATE_FORM)["suggestedDecision"],
                    )
                  }
                >
                  {DECISION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {DECISION_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Source note
                <input
                  value={createForm.evidenceSourceRef}
                  onChange={(event) =>
                    setCreateFormField("evidenceSourceRef", event.target.value)
                  }
                  placeholder="thread-7 / incident-42 / operator handoff"
                />
              </label>
            </div>

            {/* Backend identifiers (collapsible advanced) */}
            <details className="ff-learning-advanced">
              <summary>Backend identifiers (optional)</summary>
              <div className="fg-grid fg-grid-compact ff-learning-form-grid">
                <label>
                  Agent ID
                  <input
                    value={createForm.agentId}
                    onChange={(event) =>
                      setCreateFormField("agentId", event.target.value)
                    }
                  />
                </label>
                <label>
                  Run ID
                  <input
                    value={createForm.runId}
                    onChange={(event) =>
                      setCreateFormField("runId", event.target.value)
                    }
                  />
                </label>
                <label>
                  Conversation ID
                  <input
                    value={createForm.conversationId}
                    onChange={(event) =>
                      setCreateFormField("conversationId", event.target.value)
                    }
                  />
                </label>
              </div>
            </details>
          </div>
        )}

        {/* Step 2: Summary */}
        {currentStep === 2 && (
          <div className="ff-learning-step-content">
            <h4>Step 2: Summary</h4>
            <label>
              Summary
              <input
                value={createForm.summary}
                onChange={(event) =>
                  setCreateFormField("summary", event.target.value)
                }
                placeholder="Brief title for this learning event"
                required
              />
            </label>
          </div>
        )}

        {/* Step 3: Explanation */}
        {currentStep === 3 && (
          <div className="ff-learning-step-content">
            <h4>Step 3: Explanation</h4>
            <label>
              Explanation
              <textarea
                rows={4}
                value={createForm.explanation}
                onChange={(event) =>
                  setCreateFormField("explanation", event.target.value)
                }
                placeholder="Why this event matters and what it describes"
              />
            </label>
          </div>
        )}

        {/* Step 4: Evidence */}
        {currentStep === 4 && (
          <div className="ff-learning-step-content">
            <h4>Step 4: Evidence</h4>
            <label>
              Evidence note
              <textarea
                rows={3}
                value={createForm.evidenceNote}
                onChange={(event) =>
                  setCreateFormField("evidenceNote", event.target.value)
                }
                placeholder="Supporting context for this learning event"
              />
            </label>

            {isMemoryDecision(createForm.suggestedDecision) && (
              <section className="fg-subcard">
                <h4>Memory proposal</h4>
                <div className="fg-grid fg-grid-compact ff-learning-form-grid">
                  <label>
                    Memory kind
                    <select
                      value={createForm.memoryKind}
                      onChange={(event) =>
                        setCreateFormField(
                          "memoryKind",
                          event.target.value as (typeof DEFAULT_CREATE_FORM)["memoryKind"],
                        )
                      }
                    >
                      {MEMORY_KIND_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Visibility
                    <select
                      value={createForm.memoryVisibility}
                      onChange={(event) =>
                        setCreateFormField(
                          "memoryVisibility",
                          event.target.value as (typeof DEFAULT_CREATE_FORM)["memoryVisibility"],
                        )
                      }
                    >
                      {MEMORY_VISIBILITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sensitivity
                    <select
                      value={createForm.memorySensitivity}
                      onChange={(event) =>
                        setCreateFormField(
                          "memorySensitivity",
                          event.target.value as (typeof DEFAULT_CREATE_FORM)["memorySensitivity"],
                        )
                      }
                    >
                      {MEMORY_SENSITIVITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact ff-learning-form-grid">
                  <label>
                    Source trust
                    <select
                      value={createForm.memoryTrust}
                      onChange={(event) =>
                        setCreateFormField(
                          "memoryTrust",
                          event.target.value as (typeof DEFAULT_CREATE_FORM)["memoryTrust"],
                        )
                      }
                    >
                      {MEMORY_TRUST_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Memory title
                    <input
                      value={createForm.memoryTitle}
                      onChange={(event) =>
                        setCreateFormField("memoryTitle", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Memory body
                    <textarea
                      rows={4}
                      value={createForm.memoryBody}
                      onChange={(event) =>
                        setCreateFormField("memoryBody", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact ff-learning-form-grid">
                  <label>
                    Review date
                    <input
                      value={createForm.memoryReviewAt}
                      onChange={(event) =>
                        setCreateFormField("memoryReviewAt", event.target.value)
                      }
                      placeholder="2026-05-30T09:00:00Z"
                    />
                  </label>
                  <label>
                    Review note
                    <input
                      value={createForm.memoryReviewNote}
                      onChange={(event) =>
                        setCreateFormField("memoryReviewNote", event.target.value)
                      }
                      placeholder="Schedule review for inferred durable truth."
                    />
                  </label>
                </div>
              </section>
            )}

            {isSkillDecision(createForm.suggestedDecision) && (
              <section className="fg-subcard">
                <h4>Skill draft proposal</h4>
                <div className="fg-grid fg-grid-compact ff-learning-form-grid">
                  <label>
                    Skill display name
                    <input
                      value={createForm.skillDisplayName}
                      onChange={(event) =>
                        setCreateFormField("skillDisplayName", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Skill scope
                    <select
                      value={createForm.skillScope}
                      onChange={(event) =>
                        setCreateFormField(
                          "skillScope",
                          event.target.value as (typeof DEFAULT_CREATE_FORM)["skillScope"],
                        )
                      }
                    >
                      {SKILL_SCOPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Scope agent ID
                    <input
                      value={createForm.skillScopeAgentId}
                      onChange={(event) =>
                        setCreateFormField("skillScopeAgentId", event.target.value)
                      }
                    />
                  </label>
                </div>
                <label>
                  Skill summary
                  <textarea
                    rows={3}
                    value={createForm.skillSummary}
                    onChange={(event) =>
                      setCreateFormField("skillSummary", event.target.value)
                    }
                  />
                </label>
                <label>
                  Instruction core
                  <textarea
                    rows={5}
                    value={createForm.skillInstructionCore}
                    onChange={(event) =>
                      setCreateFormField("skillInstructionCore", event.target.value)
                    }
                  />
                </label>
              </section>
            )}
          </div>
        )}

        {/* Step 5: Outcome */}
        {currentStep === 5 && (
          <div className="ff-learning-step-content">
            <h4>Step 5: Review and submit</h4>
            <div className="fg-subcard">
              <div className="fg-grid fg-grid-compact ff-learning-form-grid">
                <div>
                  <strong>Trigger</strong>
                  <p>{createForm.triggerKind}</p>
                </div>
                <div>
                  <strong>Suggested path</strong>
                  <p>
                    {
                      DECISION_LABELS[
                        createForm.suggestedDecision
                      ]
                    }
                  </p>
                </div>
                <div>
                  <strong>Source note</strong>
                  <p>{createForm.evidenceSourceRef || "Not provided"}</p>
                </div>
              </div>
              <div>
                <strong>Summary</strong>
                <p>{createForm.summary || "Not provided"}</p>
              </div>
              <div>
                <strong>Explanation</strong>
                <p>{createForm.explanation || "Not provided"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="fg-actions ff-learning-manual-footer">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
            >
              Previous
            </button>
          )}
          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              disabled={
                (currentStep === 2 && !createForm.summary.trim()) ||
                !hasInstance
              }
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={
                !canMutate ||
                savingCreate ||
                !hasInstance ||
                !createForm.summary.trim()
              }
            >
              {savingCreate
                ? "Creating learning event"
                : "Create learning review item"}
            </button>
          )}
        </div>
      </form>
    </article>
  );
}
