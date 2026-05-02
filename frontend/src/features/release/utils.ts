import type { GateRecord, GatePriority, ReleaseSummary } from "./types";

/**
 * Sort gates by operational priority:
 * 1. Blocking gates (severity >= 3)
 * 2. Manual evidence required (ready but no timestamp)
 * 3. Warning/degraded gates (severity === 2)
 * 4. Ready gates
 * 5. Not-required gates
 */
export function sortGatesByPriority(gates: GateRecord[]): GateRecord[] {
  return [...gates].sort((a, b) => {
    const rank = { blocking: 0, "manual-evidence": 1, warning: 2, ready: 3, "not-required": 4 };
    const aRank = rank[a.priority] ?? 5;
    const bRank = rank[b.priority] ?? 5;
    if (aRank !== bRank) return aRank - bRank;
    // Within same priority, sort by severity descending then alphabetically
    if (b.severity !== a.severity) return b.severity - a.severity;
    return a.category.localeCompare(b.category);
  });
}

/**
 * Derive the release summary from all gates.
 */
export function deriveReleaseSummary(gates: GateRecord[]): ReleaseSummary {
  const blocking = gates.filter((g) => g.priority === "blocking" || g.priority === "manual-evidence");
  const manualEvidence = gates.filter((g) => g.priority === "manual-evidence");
  // A gate is blocking if severity >= 3 and not ready, or if manual evidence required
  const primaryBlockerGate = blocking[0] ?? null;
  const releaseBlocked = blocking.length > 0;
  const allReady = gates.length > 0 && gates.every((g) => g.ready);

  let status: ReleaseSummary["status"] = "ready";
  if (!allReady && manualEvidence.length > 0 && blocking.every((g) => g.priority === "manual-evidence")) {
    status = "manual-evidence";
  } else if (releaseBlocked) {
    status = "blocked";
  }

  return {
    status,
    primaryBlocker: primaryBlockerGate?.blocker ?? null,
    nextAction: primaryBlockerGate?.primaryAction ?? null,
    blockingCount: blocking.length,
    manualEvidenceCount: manualEvidence.length,
    totalGates: gates.length,
  };
}

/**
 * Gate priority labels for display.
 */
export const GATE_PRIORITY_LABELS: Record<GatePriority, string> = {
  blocking: "Blocking",
  "manual-evidence": "Manual evidence required",
  warning: "Warning",
  ready: "Ready",
  "not-required": "Not required",
};

/**
 * Human-readable labels for the release status.
 */
export const RELEASE_STATUS_LABELS: Record<ReleaseSummary["status"], string> = {
  ready: "release-ready",
  blocked: "release blocked",
  "manual-evidence": "manual evidence required",
};
