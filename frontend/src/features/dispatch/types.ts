/**
 * Dispatch feature types — risk and lease analysis.
 *
 * @packageDocumentation
 */

/**
 * Visual tone for dispatch risk indicators.
 */
export type DispatchRiskTone = "success" | "warning" | "danger" | "neutral";

/**
 * A single dispatch risk with label, tone, and explanatory detail.
 */
export type DispatchRisk = {
  /** Short label shown in pill or badge. */
  label: string;
  /** Visual tone for the risk indicator. */
  tone: DispatchRiskTone;
  /** Longer explanation of the risk condition. */
  detail: string;
};
