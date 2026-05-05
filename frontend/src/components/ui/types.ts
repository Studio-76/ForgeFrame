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
