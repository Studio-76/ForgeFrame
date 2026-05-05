import type { ReactNode } from "react";

import type { StatusTone, UxMetadata } from "./types";
import { uxAttributes } from "./types";

/**
 * A single step in a remediation or readiness checklist.
 */
export type ChecklistStep = {
  /** Unique ID for this step. */
  id: string;
  /** Display label. */
  label: string;
  /** Detailed description shown when expanded. */
  description?: string;
  /** Whether this step is complete. */
  done: boolean;
  /** Whether this step has failed. */
  failed?: boolean;
  /** Optional status override. */
  tone?: StatusTone;
  /** Optional action element. */
  action?: ReactNode;
};

export type ChecklistProps = {
  title?: ReactNode;
  steps: ChecklistStep[];
  /** Visual mode. */
  variant?: "remediation" | "readiness" | "gate";
  /** Optional UX metadata for review tooling. */
  ux?: UxMetadata;
};

/**
 * Checkbox-based checklist for remediation, readiness, and gate workflows.
 *
 * Each step shows completion status, optional failure state, and
 * an inline action for resolution.
 *
 * @example
 * ```tsx
 * <RemediationChecklist
 *   title="Pre-flight checks"
 *   steps={[
 *     { id: "1", label: "API key valid", done: true },
 *     { id: "2", label: "Quota available", done: false, failed: true, action: <Button size="sm">Increase quota</Button> },
 *   ]}
 * />
 * ```
 */
export function RemediationChecklist({
  title,
  steps,
  variant = "remediation",
  ux,
}: ChecklistProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" {...(ux ? uxAttributes(ux) : {})}>
      {title ? (
        typeof title === "string" ? (
          <strong className="text-body text-primary font-semibold">{title}</strong>
        ) : (
          title
        )
      ) : null}
      <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
        {steps.map((step) => {
          const indicator =
            step.failed ? (
              <span className="ff-check-fail text-danger flex-shrink-0" aria-label="Failed">
                ✗
              </span>
            ) : step.done ? (
              <span className="ff-check-ok text-success flex-shrink-0" aria-label="Passed">
                ✓
              </span>
            ) : (
              <span className="text-muted flex-shrink-0 opacity-40" aria-label="Pending">
                ○
              </span>
            );

          const bgClass = step.failed
            ? "bg-danger-soft/40 border-danger-border/40"
            : step.done
              ? "bg-success-soft/20 border-success-border/30"
              : "border-border";

          return (
            <li
              key={step.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-md border ${bgClass} transition-colors duration-75`}
            >
              <span className="mt-0.5">{indicator}</span>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-body font-medium ${
                    step.failed ? "text-danger" : step.done ? "text-primary" : "text-muted"
                  }`}
                >
                  {step.label}
                </span>
                {step.description ? (
                  <p className="text-meta text-muted mt-0.5">{step.description}</p>
                ) : null}
              </div>
              {step.action ? <div className="flex-shrink-0">{step.action}</div> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
