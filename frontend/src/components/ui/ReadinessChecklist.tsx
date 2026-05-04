/**
 * Re-export of RemediationChecklist in "readiness" mode.
 *
 * Semantically distinct component for readiness checks.
 * Uses the same checklist rendering but communicates "is the system
 * ready?" intent rather than "fix this problem".
 *
 * @example
 * ```tsx
 * <ReadinessChecklist
 *   title="Deployment readiness"
 *   steps={[
 *     { id: "1", label: "Build passes", done: true },
 *     { id: "2", label: "Tests pass", done: true },
 *     { id: "3", label: "Approval granted", done: false },
 *   ]}
 * />
 * ```
 */
export { RemediationChecklist as ReadinessChecklist } from "./RemediationChecklist";
