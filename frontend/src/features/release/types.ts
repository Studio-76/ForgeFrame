import type { StatusTone } from "../../components/ui/StatusBadge";

/**
 * Load states shared across the release validation surface.
 */
export type LoadState = "idle" | "loading" | "success" | "error";

/**
 * Payload returned by the bootstrap readiness endpoint.
 */
export type BootstrapPayload = {
  ready: boolean;
  checks: Array<Record<string, unknown>>;
  next_steps: string[];
  checked_at?: string;
};

/**
 * Priority tier for a release gate, used for sorting.
 * Higher priority gates appear first.
 */
export type GatePriority = "blocking" | "manual-evidence" | "warning" | "ready" | "not-required";

/**
 * A single release gate record combining status, evidence, blocker, and remediation.
 */
export type GateRecord = {
  key: string;
  category: string;
  statusLabel: string;
  tone: StatusTone;
  statusKey: string;
  ready: boolean;
  severity: number;
  priority: GatePriority;
  evidenceSource: string;
  evidenceAt: string | null;
  blocker: string;
  /** Primary remediation or navigation action */
  primaryAction: string;
  /** Route for the primary action */
  primaryActionTo: string;
  /** Secondary navigation routes (e.g. "View audit history") */
  secondaryActions: Array<{ label: string; to: string }>;
  notes: string[];
  /** Human-readable explanation of what evidence is needed */
  evidenceGuidance?: string;
  /** Whether this gate can accept manual evidence submission */
  acceptsManualEvidence?: boolean;
  /** Who provided the last evidence */
  evidenceProvider?: string;
};

/**
 * Summary derived from all gates for the status hero.
 */
export type ReleaseSummary = {
  status: "ready" | "blocked" | "manual-evidence";
  primaryBlocker: string | null;
  nextAction: string | null;
  blockingCount: number;
  manualEvidenceCount: number;
  totalGates: number;
};
