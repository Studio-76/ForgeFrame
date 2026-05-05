/**
 * Shared types for ForgeFrame UI primitives.
 *
 * Status tones, density levels, and size variants used across all components.
 */

/** Semantic status tones matching the ForgeFrame design tokens. */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

/** Density variant for compact or comfortable layouts. */
export type Density = "default" | "compact";

/** Size variant for buttons, inputs, and other scaled primitives. */
export type Size = "sm" | "md" | "lg";

/** Severity levels for diagnostics, incidents, and audit events. */
export type Severity = "critical" | "high" | "medium" | "low" | "info";

/** Priority levels for workflow items and remediations. */
export type Priority = "critical" | "high" | "medium" | "low";

/** Standard async load state. */
export type LoadState = "idle" | "loading" | "success" | "error";

// ── UX Metadata ─────────────────────────────────────────

/**
 * Dev-only UX metadata payload for review tooling.
 *
 * Each field maps to a `data-ux-*` attribute on the component's root
 * element so that UX reviewers can identify elements on real pages
 * and map annotations back to components or source areas.
 *
 * **Naming rules:**
 * - `uxId` must be stable, human-readable, and include page/feature context.
 * - Avoid generated random IDs.
 * - Example: `"providers-related-pages"`, `"queues-primary-summary"`,
 *   `"ingress-tls-diagnostics"`.
 *
 * **Safety constraint:**
 * - Never expose secrets, tokens, raw payloads, customer data, logs,
 *   evidence blobs, or sensitive backend values in UX metadata.
 * - Metadata must remain safe for dev and review environments.
 */
export interface UxMetadata {
  /** Stable, human-readable identifier. Must include page/feature context. */
  uxId?: string;
  /** Component type label (e.g. "PageHeader", "DataTable", "Button"). */
  uxComponent?: string;
  /** Semantic role within the page layout. */
  uxRole?: string;
  /** Page or feature identifier (e.g. "providers", "skills", "ingress-tls"). */
  uxPage?: string;
  /** Attention level for review prioritisation. */
  uxAttention?: string;
  /** Action category for this element. */
  uxActionKind?: string;
  /** Display density hint. */
  uxDensity?: string;
  /** Source file or area reference for traceability. */
  uxSource?: string;
}

/**
 * Converts a UxMetadata payload into a flat record of `data-ux-*`
 * attributes suitable for spreading onto a DOM element.
 *
 * Only non-undefined fields are included — no empty attributes are emitted.
 *
 * @param ux - The metadata payload.
 * @returns Record of `data-ux-*` attributes (keys only present when value
 *          is defined).
 */
export function uxAttributes(
  ux: UxMetadata,
): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (ux.uxId !== undefined) attrs["data-ux-id"] = ux.uxId;
  if (ux.uxComponent !== undefined) attrs["data-ux-component"] = ux.uxComponent;
  if (ux.uxRole !== undefined) attrs["data-ux-role"] = ux.uxRole;
  if (ux.uxPage !== undefined) attrs["data-ux-page"] = ux.uxPage;
  if (ux.uxAttention !== undefined) attrs["data-ux-attention"] = ux.uxAttention;
  if (ux.uxActionKind !== undefined) attrs["data-ux-action-kind"] = ux.uxActionKind;
  if (ux.uxDensity !== undefined) attrs["data-ux-density"] = ux.uxDensity;
  if (ux.uxSource !== undefined) attrs["data-ux-source"] = ux.uxSource;
  return attrs;
}

// SystemStatus and AttentionLevel are defined in models/status.ts and
// models/attention.ts respectively. Import from "./models" or the ui barrel.

/**
 * Maps a StatusTone to the appropriate Tailwind utility classes.
 * @param tone - The status tone.
 * @returns Record of class names for bg, text, border, and ring.
 */
export function toneToTailwind(tone: StatusTone): {
  bg: string;
  text: string;
  border: string;
  ring: string;
  soft: string;
  pill: string;
} {
  switch (tone) {
    case "success":
      return {
        bg: "bg-success",
        text: "text-success",
        border: "border-success-border",
        ring: "focus:ring-success/30",
        soft: "bg-success-soft",
        pill: "bg-success/15 text-success",
      };
    case "warning":
      return {
        bg: "bg-warning",
        text: "text-warning",
        border: "border-warning-border",
        ring: "focus:ring-warning/30",
        soft: "bg-warning-soft",
        pill: "bg-warning/15 text-warning",
      };
    case "danger":
      return {
        bg: "bg-danger",
        text: "text-danger",
        border: "border-danger-border",
        ring: "focus:ring-danger/30",
        soft: "bg-danger-soft",
        pill: "bg-danger/15 text-danger",
      };
    case "info":
      return {
        bg: "bg-info",
        text: "text-info",
        border: "border-info-border",
        ring: "focus:ring-info/30",
        soft: "bg-info-soft",
        pill: "bg-info/15 text-info",
      };
    case "neutral":
      return {
        bg: "bg-surface-subtle",
        text: "text-muted",
        border: "border-border",
        ring: "focus:ring-accent/30",
        soft: "bg-surface-subtle",
        pill: "bg-surface-subtle text-muted",
      };
  }
}
