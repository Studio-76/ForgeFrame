/**
 * Guided memory creation form — progressive disclosure from required to advanced fields.
 *
 * @packageDocumentation
 */

import { type FormEvent, useState } from "react";

import type {
  MemoryKind,
  MemoryLayer,
  MemorySensitivity,
  MemorySourceTrustClass,
} from "../../api/domain/memory";
import type { VisibilityScope } from "../../api/domain/contacts";
import type { LoadState } from "./types";
import {
  MEMORY_KIND_OPTIONS,
  MEMORY_LAYER_OPTIONS,
  SENSITIVITY_OPTIONS,
  SOURCE_TRUST_OPTIONS,
  VISIBILITY_OPTIONS,
  DEFAULT_CREATE_FORM,
} from "./types";

/** Guiding steps for the create flow. */
const CREATE_STEPS = [
  { id: "content", label: "Content" },
  { id: "type", label: "Type & visibility" },
  { id: "source", label: "Source & evidence" },
  { id: "review", label: "Review posture" },
  { id: "expiry", label: "Expiry & sensitivity" },
  { id: "advanced", label: "Advanced" },
] as const;

/** Props for CreateMemoryForm. */
export interface CreateMemoryFormProps {
  /** Whether the form is visible. */
  visible: boolean;
  /** Callback to close/hide the form. */
  onClose: () => void;
  /** Current form state. */
  createForm: typeof DEFAULT_CREATE_FORM;
  /** Update a form field. */
  setCreateFormField: <K extends keyof typeof DEFAULT_CREATE_FORM>(
    key: K,
    value: (typeof DEFAULT_CREATE_FORM)[K],
  ) => void;
  /** Submit handler. */
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Whether currently saving. */
  savingCreate: boolean;
  /** Whether user has mutate permission. */
  canMutate: boolean;
  /** Whether instance ID is available. */
  hasInstance: boolean;
  /** Load state for the instance. */
  instancesState: LoadState;
}

/**
 * Guided memory creation form with progressive disclosure.
 * Hidden until the operator explicitly opens it.
 */
export function CreateMemoryForm({
  visible,
  onClose,
  createForm,
  setCreateFormField,
  handleCreate,
  savingCreate,
  canMutate,
  hasInstance,
  instancesState,
}: CreateMemoryFormProps) {
  const [activeStep, setActiveStep] = useState<string>("content");

  if (!visible) {
    return null;
  }

  const isDisabled = !canMutate || savingCreate || !hasInstance;

  const handleStepClick = (stepId: string) => {
    setActiveStep(stepId);
  };

  const renderStep = (stepId: string) => {
    switch (stepId) {
      case "content":
        return (
          <div className="ff-memory-create-step">
            <label>
              Title
              <input
                value={createForm.title}
                onChange={(e) => setCreateFormField("title", e.target.value)}
                placeholder="Pricing preference"
                required
              />
            </label>
            <label>
              Body
              <textarea
                rows={4}
                value={createForm.body}
                onChange={(e) => setCreateFormField("body", e.target.value)}
                required
              />
            </label>
          </div>
        );

      case "type":
        return (
          <div className="ff-memory-create-step fg-grid fg-grid-compact">
            <label>
              Memory layer
              <select
                value={createForm.memoryLayer}
                onChange={(e) => setCreateFormField("memoryLayer", e.target.value as MemoryLayer)}
              >
                {MEMORY_LAYER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <span className="fg-muted">
                {createForm.memoryLayer === "durable"
                  ? "Long-term truth"
                  : createForm.memoryLayer === "boot"
                    ? "Candidate for bootstrap context, requires review"
                    : "Temporary context, not durable truth"}
              </span>
            </label>
            <label>
              Memory kind
              <select
                value={createForm.memoryKind}
                onChange={(e) => setCreateFormField("memoryKind", e.target.value as MemoryKind)}
              >
                {MEMORY_KIND_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <label>
              Visibility
              <select
                value={createForm.visibilityScope}
                onChange={(e) => setCreateFormField("visibilityScope", e.target.value as VisibilityScope)}
              >
                {VISIBILITY_OPTIONS.filter((o) => o !== "all").map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
          </div>
        );

      case "source":
        return (
          <div className="ff-memory-create-step">
            <div className="fg-grid fg-grid-compact">
              <label>
                Source trust
                <select
                  value={createForm.sourceTrustClass}
                  onChange={(e) => setCreateFormField("sourceTrustClass", e.target.value as MemorySourceTrustClass)}
                >
                  {SOURCE_TRUST_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <label>
                Source ID
                <input
                  value={createForm.sourceId}
                  onChange={(e) => setCreateFormField("sourceId", e.target.value)}
                  placeholder="Optional source identifier"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={createForm.humanOverride}
                  onChange={(e) => setCreateFormField("humanOverride", e.target.checked)}
                />
                {" "}Human override
              </label>
            </div>
            <details className="ff-memory-create-optional">
              <summary>Optional source linkage</summary>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Contact ID
                  <input
                    value={createForm.contactId}
                    onChange={(e) => setCreateFormField("contactId", e.target.value)}
                  />
                </label>
                <label>
                  Conversation ID
                  <input
                    value={createForm.conversationId}
                    onChange={(e) => setCreateFormField("conversationId", e.target.value)}
                  />
                </label>
                <label>
                  Task ID
                  <input
                    value={createForm.taskId}
                    onChange={(e) => setCreateFormField("taskId", e.target.value)}
                  />
                </label>
                <label>
                  Notification ID
                  <input
                    value={createForm.notificationId}
                    onChange={(e) => setCreateFormField("notificationId", e.target.value)}
                  />
                </label>
                <label>
                  Workspace ID
                  <input
                    value={createForm.workspaceId}
                    onChange={(e) => setCreateFormField("workspaceId", e.target.value)}
                  />
                </label>
                <label>
                  Learning event ID
                  <input
                    value={createForm.learnedFromEventId}
                    onChange={(e) => setCreateFormField("learnedFromEventId", e.target.value)}
                  />
                </label>
              </div>
            </details>
          </div>
        );

      case "review":
        return (
          <div className="ff-memory-create-step">
            <p className="fg-muted">
              {createForm.memoryLayer === "durable" &&
              (createForm.sourceTrustClass === "runtime_inferred" ||
                createForm.sourceTrustClass === "external_unverified")
                ? "This memory will not become active until a review date is set."
                : createForm.memoryLayer === "boot"
                  ? "Boot candidates require review before becoming active truth."
                  : "Working context is active immediately but not durable truth."}
            </p>
            <div className="fg-grid fg-grid-compact">
              <label>
                Review at
                <input
                  value={createForm.reviewAt}
                  onChange={(e) => setCreateFormField("reviewAt", e.target.value)}
                  placeholder="2026-05-02T09:00:00Z"
                />
              </label>
              <label>
                Review note
                <input
                  value={createForm.reviewNote}
                  onChange={(e) => setCreateFormField("reviewNote", e.target.value)}
                  placeholder="Optional operator note"
                />
              </label>
            </div>
          </div>
        );

      case "expiry":
        return (
          <div className="ff-memory-create-step">
            <div className="fg-grid fg-grid-compact">
              <label>
                Expires at
                <input
                  value={createForm.expiresAt}
                  onChange={(e) => setCreateFormField("expiresAt", e.target.value)}
                  placeholder="2026-05-03T09:00:00Z"
                />
              </label>
              <label>
                Sensitivity
                <select
                  value={createForm.sensitivity}
                  onChange={(e) => setCreateFormField("sensitivity", e.target.value as MemorySensitivity)}
                >
                  {SENSITIVITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <label>
                Correction note
                <input
                  value={createForm.correctionNote}
                  onChange={(e) => setCreateFormField("correctionNote", e.target.value)}
                  placeholder="Optional operator note"
                />
              </label>
            </div>
          </div>
        );

      case "advanced":
        return (
          <div className="ff-memory-create-step">
            <details className="ff-memory-create-optional">
              <summary>Advanced metadata</summary>
              <label>
                Memory ID (optional)
                <input
                  value={createForm.memoryId}
                  onChange={(e) => setCreateFormField("memoryId", e.target.value)}
                  placeholder="memory_pricing_preference"
                />
              </label>
              <label>
                Advanced metadata JSON
                <textarea
                  rows={6}
                  value={createForm.advancedMetadataJson}
                  onChange={(e) => setCreateFormField("advancedMetadataJson", e.target.value)}
                />
              </label>
            </details>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <article className="fg-card ff-memory-create-form">
      <div className="ff-memory-create-header">
        <h3>Create memory record</h3>
        <button
          type="button"
          className="ff-memory-close-btn"
          onClick={onClose}
          aria-label="Close create form"
        >
          Cancel
        </button>
      </div>

      <div className="ff-memory-create-steps">
        <p className="fg-muted ff-memory-create-hint">
          {createForm.memoryLayer === "durable"
            ? "Durable memory becomes active truth immediately and persists across context rotations."
            : createForm.memoryLayer === "boot"
              ? "Boot candidates require a review checkpoint before becoming active truth."
              : "Working context is temporary and scoped to specific conversations or tasks."}
        </p>
      </div>

      <form onSubmit={handleCreate}>
        {/* Step navigation */}
        <div className="ff-memory-step-nav" role="tablist">
          {CREATE_STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              className={`ff-memory-step-tab${activeStep === step.id ? " ff-memory-step-active" : ""}`}
              onClick={() => handleStepClick(step.id)}
              aria-selected={activeStep === step.id}
            >
              {step.label}
            </button>
          ))}
        </div>

        {/* Active step content */}
        <div className="ff-memory-step-content" role="tabpanel">
          {renderStep(activeStep)}
        </div>

        <div className="fg-actions ff-memory-create-actions">
          <button
            type="submit"
            disabled={
              isDisabled ||
              !createForm.title.trim() ||
              !createForm.body.trim()
            }
          >
            {savingCreate ? "Creating memory record…" : "Create memory record"}
          </button>
        </div>
      </form>
    </article>
  );
}
