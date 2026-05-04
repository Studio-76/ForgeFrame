/**
 * Re-export of RemediationChecklist in "gate" mode.
 *
 * Semantically distinct component for workflow/gate approval checks.
 * Communicates "are all gates passed?" intent.
 *
 * @example
 * ```tsx
 * <GateChecklist
 *   title="Release gates"
 *   steps={[
 *     { id: "1", label: "QA signed off", done: true },
 *     { id: "2", label: "Security reviewed", done: false },
 *   ]}
 * />
 * ```
 */
export { RemediationChecklist as GateChecklist } from "./RemediationChecklist";
