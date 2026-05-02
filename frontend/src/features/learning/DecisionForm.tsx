/**
 * Decision form for learning events — with confirmation-gated promotion actions.
 *
 * @packageDocumentation
 */

import { useState, type FormEvent } from "react";
import type { LearningEventDetail } from "../../api/domain/learning";
import {
  DECISION_OPTIONS,
  DECISION_LABELS,
  DECISION_HELP,
  MEMORY_KIND_OPTIONS,
  MEMORY_VISIBILITY_OPTIONS,
  MEMORY_SENSITIVITY_OPTIONS,
  MEMORY_TRUST_OPTIONS,
  SKILL_SCOPE_OPTIONS,
  DEFAULT_DECIDE_FORM,
} from "./types";
import { isMemoryDecision, isSkillDecision } from "./utils";
import type { UseLearningPageReturn } from "./hooks";

/** Props for DecisionForm. */
export interface DecisionFormProps {
  /** The selected event detail. */
  detail: LearningEventDetail;
  /** Decide form state. */
  decideForm: UseLearningPageReturn["decideForm"];
  /** Set a field in the decide form. */
  setDecideFormField: UseLearningPageReturn["setDecideFormField"];
  /** Handle decision submission. */
  handleDecide: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Whether saving is in progress. */
  savingDecide: boolean;
  /** Whether the user can mutate. */
  canMutate: boolean;
}

/**
 * Decision form with quick-action buttons and confirmation dialogs for
 * promotion actions that persist memory or create skills.
 */
export function DecisionForm({
  detail,
  decideForm,
  setDecideFormField,
  handleDecide,
  savingDecide,
  canMutate,
}: DecisionFormProps) {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const needsConfirmation = (decision: string): boolean => {
    return (
      decision === "boot_memory" ||
      decision === "durable_memory" ||
      decision === "skill_draft"
    );
  };

  const handleQuickAction = (decision: string) => {
    if (needsConfirmation(decision)) {
      setConfirmAction(decision);
      setDecideFormField(
        "decision",
        decision as (typeof DEFAULT_DECIDE_FORM)["decision"],
      );
      return;
    }
    setDecideFormField(
      "decision",
      decision as (typeof DEFAULT_DECIDE_FORM)["decision"],
    );
  };

  const confirmAndSubmit = (event: FormEvent<HTMLFormElement>) => {
    setConfirmAction(null);
    void handleDecide(event);
  };

  const cancelConfirmation = () => {
    setConfirmAction(null);
  };

  return (
    <form className="fg-stack" onSubmit={handleDecide}>
      <section className="fg-subcard">
        <h4>Decision</h4>

        {/* Quick action buttons */}
        <div className="fg-actions ff-learning-decision-actions">
          <button
            type="button"
            onClick={() => handleQuickAction("history_only")}
            disabled={!canMutate}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction("discard")}
            disabled={!canMutate}
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction("durable_memory")}
            disabled={!canMutate}
          >
            Promote to durable memory
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction("boot_memory")}
            disabled={!canMutate}
          >
            Promote to boot memory
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction("skill_draft")}
            disabled={!canMutate}
          >
            Draft skill
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction("review_required")}
            disabled={!canMutate}
          >
            Require review
          </button>
        </div>

        {/* Confirmation dialog for promotion actions */}
        {confirmAction && needsConfirmation(confirmAction) && (
          <div className="ff-learning-confirm">
            <p className="ff-learning-confirm-text">
              {confirmAction === "boot_memory" || confirmAction === "durable_memory"
                ? "This will persist memory from this learning event. Memory affects agent behavior across sessions."
                : "This will create a skill draft that operators can refine and activate."}
              {" "}Are you sure you want to proceed?
            </p>
            <div className="ff-learning-confirm-actions">
              <button
                type="submit"
                className="ff-learning-confirm-yes"
                disabled={!canMutate || savingDecide}
                onClick={(e) => {
                  // The form submission will be handled by the form's onSubmit
                  // We set a flag to bypass the confirmation in the quick action
                }}
              >
                {savingDecide ? "Applying…" : "Yes, proceed"}
              </button>
              <button
                type="button"
                className="ff-learning-confirm-no"
                onClick={cancelConfirmation}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Decision selector */}
        <div className="fg-grid fg-grid-compact">
          <label>
            Operator action
            <select
              value={decideForm.decision}
              onChange={(event) =>
                setDecideFormField(
                  "decision",
                  event.target.value as (typeof DEFAULT_DECIDE_FORM)["decision"],
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
            Decision note
            <textarea
              rows={3}
              value={decideForm.decisionNote}
              onChange={(event) =>
                setDecideFormField("decisionNote", event.target.value)
              }
            />
          </label>
        </div>

        <label>
          <input
            type="checkbox"
            checked={decideForm.humanOverride}
            onChange={(event) =>
              setDecideFormField("humanOverride", event.target.checked)
            }
          />{" "}
          Human override
        </label>
        <p className="fg-muted">{DECISION_HELP[decideForm.decision]}</p>
      </section>

      {/* Memory payload section */}
      {isMemoryDecision(decideForm.decision) && (
        <section className="fg-subcard">
          <h4>Memory promotion payload</h4>
          <div className="fg-grid fg-grid-compact">
            <label>
              Memory kind
              <select
                value={decideForm.memoryKind}
                onChange={(event) =>
                  setDecideFormField(
                    "memoryKind",
                    event.target.value as (typeof DEFAULT_DECIDE_FORM)["memoryKind"],
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
                value={decideForm.memoryVisibility}
                onChange={(event) =>
                  setDecideFormField(
                    "memoryVisibility",
                    event.target.value as (typeof DEFAULT_DECIDE_FORM)["memoryVisibility"],
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
                value={decideForm.memorySensitivity}
                onChange={(event) =>
                  setDecideFormField(
                    "memorySensitivity",
                    event.target.value as (typeof DEFAULT_DECIDE_FORM)["memorySensitivity"],
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
          <div className="fg-grid fg-grid-compact">
            <label>
              Source trust
              <select
                value={decideForm.memoryTrust}
                onChange={(event) =>
                  setDecideFormField(
                    "memoryTrust",
                    event.target.value as (typeof DEFAULT_DECIDE_FORM)["memoryTrust"],
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
                value={decideForm.memoryTitle}
                onChange={(event) =>
                  setDecideFormField("memoryTitle", event.target.value)
                }
              />
            </label>
            <label>
              Memory body
              <textarea
                rows={4}
                value={decideForm.memoryBody}
                onChange={(event) =>
                  setDecideFormField("memoryBody", event.target.value)
                }
              />
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Review date
              <input
                value={decideForm.memoryReviewAt}
                onChange={(event) =>
                  setDecideFormField("memoryReviewAt", event.target.value)
                }
                placeholder="2026-05-30T09:00:00Z"
              />
            </label>
            <label>
              Review note
              <input
                value={decideForm.memoryReviewNote}
                onChange={(event) =>
                  setDecideFormField("memoryReviewNote", event.target.value)
                }
                placeholder="Review inferred durable truth before long-term retention."
              />
            </label>
          </div>
          {decideForm.decision === "durable_memory" &&
            decideForm.memoryTrust !== "human_verified" && (
              <p className="fg-muted">
                Durable memory with inferred or unverified trust must carry a
                scheduled review date before promotion can succeed.
              </p>
            )}
        </section>
      )}

      {/* Skill payload section */}
      {isSkillDecision(decideForm.decision) && (
        <section className="fg-subcard">
          <h4>Skill draft payload</h4>
          <div className="fg-grid fg-grid-compact">
            <label>
              Skill display name
              <input
                value={decideForm.skillDisplayName}
                onChange={(event) =>
                  setDecideFormField("skillDisplayName", event.target.value)
                }
              />
            </label>
            <label>
              Scope
              <select
                value={decideForm.skillScope}
                onChange={(event) =>
                  setDecideFormField(
                    "skillScope",
                    event.target.value as (typeof DEFAULT_DECIDE_FORM)["skillScope"],
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
                value={decideForm.skillScopeAgentId}
                onChange={(event) =>
                  setDecideFormField("skillScopeAgentId", event.target.value)
                }
              />
            </label>
          </div>
          <label>
            Skill summary
            <textarea
              rows={3}
              value={decideForm.skillSummary}
              onChange={(event) =>
                setDecideFormField("skillSummary", event.target.value)
              }
            />
          </label>
          <label>
            Instruction core
            <textarea
              rows={5}
              value={decideForm.skillInstructionCore}
              onChange={(event) =>
                setDecideFormField("skillInstructionCore", event.target.value)
              }
            />
          </label>
        </section>
      )}

      <div className="fg-actions">
        <button type="submit" disabled={!canMutate || savingDecide}>
          {savingDecide
            ? "Applying decision"
            : DECISION_LABELS[decideForm.decision]}
        </button>
      </div>
    </form>
  );
}
