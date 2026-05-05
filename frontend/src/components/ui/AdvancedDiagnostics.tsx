/**
 * AdvancedDiagnostics — standardised collapsible container for raw / debug /
 * internal data across all ForgeFrame pages.
 *
 * ## Rules
 *
 * - Diagnostic actions are always visually secondary.
 * - Raw / internal data has one standard collapsed home.
 * - Healthy / ready / zero-count sections no longer dominate default page views.
 * - primary_blocker is always visible; diagnostic is only visible here.
 *
 * ## Sub-components
 *
 * Use the provided sub-components to render specific diagnostic data types
 * consistently: `RawJson`, `PayloadViewer`, `EvidenceBlob`, `EnvVarsList`,
 * `FilePath`, `InternalId`, `Timestamp`, `RouteKey`, `BlockerCode`, `RawLog`.
 *
 * @module
 */

import { useCallback, type ReactNode } from "react";

import type { StatusTone, UxMetadata } from "./types";
import { uxAttributes } from "./types";
import { StatusBadge } from "./StatusBadge";
import { usePanelStore } from "../../store";

// ── Main AdvancedDiagnostics ───────────────────────────────────────────

export type AdvancedDiagnosticsProps = {
  /** Section title (always visible in the summary bar). */
  title: ReactNode;
  /** Optional description below the title. */
  description?: ReactNode;
  /** Diagnostic content (use sub-components inside). */
  children: ReactNode;
  /** Start expanded. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Optional status badge label. */
  status?: ReactNode;
  /** Tone for the status badge. */
  statusTone?: StatusTone;
  /** Key for auto-resolving the status badge tone. */
  statusKey?: string | null;
  /** Compact mode reduces padding. */
  compact?: boolean;
  /**
   * Optional panel store key for cross-component expansion state.
   * When provided, expansion is synced to the shared panel store using
   * `panelId` as the key. Use this when diagnostics expansion should
   * survive re-renders from a different part of the UI.
   */
  panelId?: string;
  /** Optional UX metadata for review tooling. */
  ux?: UxMetadata;
};

/**
 * A collapsible diagnostics section for raw / internal data.
 *
 * Every raw / debug / internal data display should live inside this
 * component so that non-operator users never see internal details
 * by default.
 *
 * When `panelId` is provided, expansion state is synchronised with the
 * shared panel store so that it survives component boundaries.
 *
 * @example
 * ```tsx
 * <AdvancedDiagnostics title="Execution payload">
 *   <RawJson data={execution} />
 * </AdvancedDiagnostics>
 *
 * <AdvancedDiagnostics title="Request" panelId="exec-request">
 *   <RawJson data={request} />
 * </AdvancedDiagnostics>
 * ```
 */
export function AdvancedDiagnostics({
  title,
  description,
  children,
  defaultOpen = false,
  status,
  statusTone,
  statusKey,
  compact = false,
  panelId,
  ux,
}: AdvancedDiagnosticsProps) {
  // When panelId is provided, sync expansion with the shared panel store.
  const diagnosticsExpanded = usePanelStore(
    useCallback((s) => (panelId ? (s.diagnosticsExpanded[panelId] ?? defaultOpen) : undefined), [panelId, defaultOpen]),
  );
  const setDiagnosticsExpanded = usePanelStore((s) => s.setDiagnosticsExpanded);

  const isOpen = panelId !== undefined ? diagnosticsExpanded : defaultOpen;

  const handleToggle = useCallback(
    (e: React.SyntheticEvent<HTMLDetailsElement>) => {
      if (panelId) {
        setDiagnosticsExpanded(panelId, (e.target as HTMLDetailsElement).open);
      }
    },
    [panelId, setDiagnosticsExpanded],
  );

  return (
    <details
      className={`ff-advanced-diagnostics${compact ? " ff-advanced-diagnostics--compact" : ""}`}
      open={isOpen}
      onToggle={handleToggle}
      {...(ux ? uxAttributes(ux) : {})}
    >
      <summary>
        <span className="ff-advanced-diagnostics-copy">
          <strong>{title}</strong>
          {description ? <small>{description}</small> : null}
        </span>
        {status ? (
          <StatusBadge tone={statusTone} status={statusKey}>
            {status}
          </StatusBadge>
        ) : null}
      </summary>
      <div className="ff-advanced-diagnostics-body">{children}</div>
    </details>
  );
}

// ── DiagnosticSection ──────────────────────────────────────────────────

export type DiagnosticSectionProps = {
  /** Section label. */
  label: string;
  /** Content for this section. */
  children: ReactNode;
  /** Optional status summary. */
  summary?: string;
  /** Default expanded. */
  defaultOpen?: boolean;
};

/**
 * A labelled sub-section within AdvancedDiagnostics.
 *
 * Use to group related diagnostic data (e.g. "Request payload",
 * "Response headers", "Blocker codes").
 *
 * @example
 * ```tsx
 * <DiagnosticSection label="Request payload">
 *   <RawJson data={requestBody} />
 * </DiagnosticSection>
 * ```
 */
export function DiagnosticSection({
  label,
  children,
  summary,
  defaultOpen = false,
}: DiagnosticSectionProps) {
  return (
    <details
      className="ff-diagnostic-section"
      open={defaultOpen}
    >
      <summary>
        <span className="font-mono text-meta text-muted font-semibold">{label}</span>
        {summary ? (
          <span className="text-meta text-muted ml-2">{summary}</span>
        ) : null}
      </summary>
      <div className="ff-diagnostic-section-body pt-2">{children}</div>
    </details>
  );
}

// ── RawJson ────────────────────────────────────────────────────────────

export type RawJsonProps = {
  /** The data to render as formatted JSON. */
  data: unknown;
  /** Optional label shown before the block. */
  label?: string;
  /** Max initial height before collapsing (0 = no limit). */
  maxHeight?: number;
};

/**
 * Renders a JSON value in a formatted, monospaced pre block.
 *
 * Safely handles `undefined`, `Error`, and cyclic objects.
 *
 * @example
 * ```tsx
 * <RawJson data={executionPayload} label="Execution" />
 * ```
 */
export function RawJson({ data, label, maxHeight = 0 }: RawJsonProps) {
  let formatted: string;
  try {
    formatted = JSON.stringify(data, null, 2);
  } catch {
    formatted = String(data);
  }

  return (
    <div className="ff-diagnostic-block">
      {label ? (
        <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
          {label}
        </span>
      ) : null}
      <pre
        className="ff-diagnostic-code"
        style={maxHeight > 0 ? { maxHeight, overflowY: "auto" } : undefined}
      >
        <code>{formatted}</code>
      </pre>
    </div>
  );
}

// ── PayloadViewer ──────────────────────────────────────────────────────

export type PayloadViewerProps = {
  /** The payload object to display. */
  payload: Record<string, unknown>;
  /** Optional label. */
  label?: string;
  /** Keys to show (if not set, shows all). */
  keys?: string[];
  /** Keys to redact (shown as "••••••••"). */
  redactedKeys?: string[];
};

/**
 * Displays an API payload as a labelled key-value list.
 *
 * More readable than RawJson for flat payloads. Redacts sensitive keys.
 *
 * @example
 * ```tsx
 * <PayloadViewer
 *   payload={requestPayload}
 *   label="Request payload"
 *   redactedKeys={["api_key", "secret"]}
 * />
 * ```
 */
export function PayloadViewer({
  payload,
  label,
  keys,
  redactedKeys = [],
}: PayloadViewerProps) {
  const entries = (keys ?? Object.keys(payload)).map((key) => {
    const raw = payload[key];
    const isRedacted = redactedKeys.some((k) => k.toLowerCase() === key.toLowerCase());
    return { key, value: isRedacted ? "••••••••" : formatPayloadValue(raw) };
  });

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="ff-diagnostic-block">
      {label ? (
        <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
          {label}
        </span>
      ) : null}
      <div className="ff-diagnostic-payload">
        {entries.map(({ key, value }) => (
          <div key={key} className="ff-diagnostic-payload-row flex gap-2 py-0.5">
            <span className="ff-diagnostic-payload-key font-mono text-meta text-muted flex-shrink-0 min-w-[120px]">
              {key}
            </span>
            <span className="ff-diagnostic-payload-value font-mono text-meta text-primary break-all">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Formats a single payload value for display. */
function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 1);
  } catch {
    return String(value);
  }
}

// ── EvidenceBlob ───────────────────────────────────────────────────────

export type EvidenceBlobProps = {
  /** Label describing the evidence. */
  label?: string;
  /** The evidence content. */
  children: ReactNode;
};

/**
 * Displays an evidence blob — a block of data that supports a diagnostic
 * finding, incident, or assertion.
 *
 * @example
 * ```tsx
 * <EvidenceBlob label="Alert payload">
 *   {alertBody}
 * </EvidenceBlob>
 * ```
 */
export function EvidenceBlob({ label, children }: EvidenceBlobProps) {
  return (
    <div className="ff-diagnostic-block">
      {label ? (
        <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
          {label}
        </span>
      ) : null}
      <div className="ff-diagnostic-evidence border border-border rounded p-2 bg-surface-subtle font-mono text-meta text-primary whitespace-pre-wrap break-all">
        {children}
      </div>
    </div>
  );
}

// ── EnvVarsList ────────────────────────────────────────────────────────

export type EnvVarsListProps = {
  /** Environment variables to display. */
  vars: Record<string, string | undefined>;
  /** Variable names whose values should be redacted. */
  redacted?: string[];
  /** Label for the section. */
  label?: string;
};

/**
 * Displays a list of environment variables with optional redaction.
 *
 * @example
 * ```tsx
 * <EnvVarsList
 *   vars={{ NODE_ENV: "production", API_KEY: "sk-..." }}
 *   redacted={["API_KEY"]}
 * />
 * ```
 */
export function EnvVarsList({ vars, redacted = [], label = "Environment" }: EnvVarsListProps) {
  const entries = Object.entries(vars).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="ff-diagnostic-block">
      <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
        {label}
      </span>
      <div className="ff-diagnostic-payload">
        {entries.map(([key, value]) => (
          <div key={key} className="ff-diagnostic-payload-row flex gap-2 py-0.5">
            <span className="ff-diagnostic-payload-key font-mono text-meta text-muted flex-shrink-0 min-w-[120px]">
              {key}
            </span>
            <span className="ff-diagnostic-payload-value font-mono text-meta text-primary break-all">
              {redacted.some((k) => k.toLowerCase() === key.toLowerCase()) ? "••••••••" : value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FilePath ───────────────────────────────────────────────────────────

export type FilePathProps = {
  /** The file path to display. */
  path: string;
  /** Optional label. */
  label?: string;
};

/**
 * Displays a file path in monospace with optional label.
 *
 * @example
 * ```tsx
 * <FilePath path="/var/log/forgeframe/execution.log" label="Log path" />
 * ```
 */
export function FilePath({ path, label }: FilePathProps) {
  return (
    <div className="ff-diagnostic-block">
      {label ? (
        <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
          {label}
        </span>
      ) : null}
      <code className="ff-diagnostic-inline-code text-meta text-accent font-mono break-all">
        {path}
      </code>
    </div>
  );
}

// ── InternalId ─────────────────────────────────────────────────────────

export type InternalIdProps = {
  /** The ID value. */
  id: string;
  /** Optional label. */
  label?: string;
};

/**
 * Displays an internal ID in monospace, truncated for readability.
 *
 * @example
 * ```tsx
 * <InternalId id="exec-01JAN88K7X7Z3KZ9QY8X2V6W5P" label="Execution ID" />
 * ```
 */
export function InternalId({ id, label }: InternalIdProps) {
  return (
    <div className="ff-diagnostic-block">
      {label ? (
        <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
          {label}
        </span>
      ) : null}
      <code className="ff-diagnostic-inline-code text-meta text-primary font-mono break-all">
        {id}
      </code>
    </div>
  );
}

// ── Timestamp ──────────────────────────────────────────────────────────

export type TimestampProps = {
  /** ISO 8601 or Unix timestamp. */
  timestamp: string | number;
  /** Optional label. */
  label?: string;
  /** Show relative time. */
  relative?: boolean;
};

/**
 * Formats a relative time from a timestamp string or number.
 */
function formatRelativeTime(timestamp: string | number): string {
  const date = typeof timestamp === "number"
    ? new Date(timestamp * 1000)
    : new Date(timestamp);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) {
    return "just now";
  }
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Displays a timestamp in a standardised format.
 *
 * @example
 * ```tsx
 * <Timestamp timestamp="2026-05-04T12:00:00Z" label="Started" />
 * <Timestamp timestamp={1714838400} label="Created" relative />
 * ```
 */
export function Timestamp({ timestamp, label, relative = false }: TimestampProps) {
  const display = relative
    ? formatRelativeTime(timestamp)
    : typeof timestamp === "number"
      ? new Date(timestamp * 1000).toISOString()
      : timestamp;

  return (
    <div className="ff-diagnostic-block">
      {label ? (
        <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
          {label}
        </span>
      ) : null}
      <code className="ff-diagnostic-inline-code text-meta text-muted font-mono">
        {display}
      </code>
    </div>
  );
}

// ── RouteKey ───────────────────────────────────────────────────────────

export type RouteKeyProps = {
  /** The route key or path. */
  route: string;
  /** Optional label. */
  label?: string;
};

/**
 * Displays a route key in monospace.
 *
 * @example
 * ```tsx
 * <RouteKey route="/api/v1/executions/{id}" label="API route" />
 * ```
 */
export function RouteKey({ route, label }: RouteKeyProps) {
  return (
    <div className="ff-diagnostic-block">
      {label ? (
        <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
          {label}
        </span>
      ) : null}
      <code className="ff-diagnostic-inline-code text-meta text-accent font-mono break-all">
        {route}
      </code>
    </div>
  );
}

// ── BlockerCode ────────────────────────────────────────────────────────

export type BlockerCodeProps = {
  /** The blocker code. */
  code: string;
  /** Human-readable description of the blocker. */
  description?: string;
  /** Optional action reference. */
  actionRef?: string;
};

/**
 * Displays a blocker code with description.
 *
 * @example
 * ```tsx
 * <BlockerCode code="BLOCKER_001" description="Certificate expired" actionRef="Renew at /settings/certs" />
 * ```
 */
export function BlockerCode({ code, description, actionRef }: BlockerCodeProps) {
  return (
    <div className="ff-diagnostic-block flex items-start gap-3 p-2 rounded border border-danger-border bg-danger-soft">
      <span className="font-mono text-danger text-xs font-bold uppercase">{code}</span>
      <div className="flex flex-col gap-0.5">
        {description ? (
          <span className="text-meta text-primary font-medium">{description}</span>
        ) : null}
        {actionRef ? (
          <span className="text-meta text-muted">{actionRef}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── RawLog ─────────────────────────────────────────────────────────────

export type RawLogProps = {
  /** Log entries (each entry is one line). */
  entries: string[];
  /** Optional label. */
  label?: string;
  /** Max visible lines before truncation. */
  maxLines?: number;
};

/**
 * Displays raw log entries in a monospace block.
 *
 * @example
 * ```tsx
 * <RawLog
 *   entries={["2026-05-04T12:00:00Z [INFO] Starting worker", "2026-05-04T12:00:01Z [ERROR] Connection refused"]}
 *   label="Worker logs"
 * />
 * ```
 */
export function RawLog({ entries, label, maxLines = 50 }: RawLogProps) {
  if (entries.length === 0) {
    return (
      <div className="ff-diagnostic-block">
        {label ? (
          <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
            {label}
          </span>
        ) : null}
        <span className="text-meta text-muted italic">No log entries.</span>
      </div>
    );
  }

  const displayed = maxLines > 0 ? entries.slice(0, maxLines) : entries;
  const truncated = entries.length > maxLines;

  return (
    <div className="ff-diagnostic-block">
      {label ? (
        <span className="ff-diagnostic-block-label text-meta text-muted font-mono font-semibold block mb-1">
          {label}
        </span>
      ) : null}
      <pre className="ff-diagnostic-code max-h-[400px] overflow-y-auto">
        <code>{displayed.join("\n")}</code>
      </pre>
      {truncated ? (
        <span className="text-meta text-muted italic mt-1 block">
          … {entries.length - maxLines} more entries (truncated)
        </span>
      ) : null}
    </div>
  );
}
