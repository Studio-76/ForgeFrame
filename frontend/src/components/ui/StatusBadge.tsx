import type { StatusTone } from "./types";

/** Re-exported for backward compatibility. Prefer importing from `"./types"` or the UI barrel. */
export type { StatusTone };

const STATUS_TONE_BY_STATE = {
  ready: "success",
  "runtime-ready": "success",
  partial: "warning",
  degraded: "warning",
  blocked: "danger",
  unsupported: "info",
  "bridge-only": "info",
  "onboarding-only": "info",
  waiting_approval: "warning",
  budget_blocked: "danger",
  circuit_open: "danger",
} as const satisfies Record<string, StatusTone>;

type StatusBadgeProps = {
  children: React.ReactNode;
  tone?: StatusTone;
  status?: string | null;
};

function normalizeStatus(status: string | null | undefined): string | null {
  if (!status) {
    return null;
  }
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

export function resolveStatusTone(status: string | null | undefined, fallback: StatusTone = "neutral"): StatusTone {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return fallback;
  }
  return STATUS_TONE_BY_STATE[normalized as keyof typeof STATUS_TONE_BY_STATE] ?? fallback;
}

export function StatusBadge({ children, tone, status }: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const resolvedTone = tone ?? resolveStatusTone(normalizedStatus);

  return (
    <span
      className="ff-status-badge"
      data-tone={resolvedTone}
      {...(normalizedStatus ? { "data-state": normalizedStatus.replace(/_/g, "-") } : {})}
    >
      {children}
    </span>
  );
}
