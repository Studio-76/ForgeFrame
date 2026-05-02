import type { StatusTone } from "../../components/ui/StatusBadge";

/**
 * Load states shared across the ingress/TLS remediation surface.
 */
export type LoadState = "idle" | "loading" | "success" | "error";

/**
 * Priority tier for a remediation checklist item.
 * Higher-priority items appear first.
 */
export type RemediationPriority = "blocking" | "warning" | "ready" | "not-applicable";

/**
 * A single remediation checklist item for the TLS setup workflow.
 */
export type RemediationItem = {
  /** Unique key for the item */
  key: string;
  /** Short display label */
  label: string;
  /** Current status */
  status: "completed" | "pending" | "blocked" | "not-applicable";
  /** Visual tone for the status indicator */
  tone: StatusTone;
  /** Why this item matters */
  why: string;
  /** One clear action the operator should take */
  action: string;
  /** Route for the action link */
  actionTo: string;
  /** Action button label (task-specific, not generic) */
  actionLabel: string;
  /** Human-readable detail about current state */
  detail: string;
  /** Priority for sorting */
  priority: RemediationPriority;
};

/**
 * Summary derived from ingress/TLS status for the hero panel.
 */
export type TlsSummary = {
  /** Overall label (e.g. "Production-ready", "Blocked", "Local only") */
  label: string;
  /** Detailed description */
  detail: string;
  /** Visual tone */
  tone: StatusTone;
  /** Status key for badge resolution */
  statusKey: string;
  /** Exposure mode summary */
  exposureMode: string;
  /** Public FQDN status summary */
  fqdnStatus: string;
  /** DNS resolution status summary */
  dnsStatus: string;
  /** HTTPS listener status summary */
  httpsListenerStatus: string;
  /** Certificate status summary */
  certStatus: string;
  /** Primary blocker code (null if none) */
  primaryBlocker: string | null;
  /** Next recommended action description */
  nextAction: string | null;
};

/**
 * Bootstrap check from the readiness endpoint.
 */
export type BootstrapCheck = {
  id: string;
  ok: boolean;
  details: string;
};
