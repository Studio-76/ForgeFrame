/**
 * Type definitions for the unified setup flow.
 *
 * The setup flow combines password rotation, bootstrap onboarding,
 * and operational status into a single guided experience replacing
 * the separate DashboardPage, OnboardingPage, and PasswordRotationPage.
 */

/** Top-level mode the setup page renders in. */
export type SetupMode = "password-rotation" | "bootstrap" | "operational";

/** Status of an individual setup step. */
export type SetupStepStatus = "complete" | "current" | "blocked" | "upcoming";

/** Overall system setup status. */
export type OverallStatus =
  | "restricted"
  | "not-started"
  | "in-progress"
  | "blocked"
  | "ready"
  | "live";

/** A single step in the guided setup flow. */
export type SetupStep = {
  /** Stable step identifier. */
  id: string;
  /** Display order number. */
  stepNumber: number;
  /** Short action-oriented title. */
  title: string;
  /** One-line description of what this step achieves. */
  description: string;
  /** Current progress status. */
  status: SetupStepStatus;
  /** Human-readable blockers if the step cannot proceed. */
  blockers: string[];
  /** Label for the primary action button, or null if no action applies. */
  actionLabel: string | null;
  /** Route for the primary action button, or null. */
  actionTo: string | null;
};

/** Complete state for the setup page. */
export type SetupState = {
  /** Which rendering mode the page should use. */
  mode: SetupMode;
  /** All setup steps with their current status. */
  steps: SetupStep[];
  /** Index of the current (active) step. */
  currentStepIndex: number;
  /** Number of completed steps. */
  completeCount: number;
  /** Total number of steps visible. */
  totalCount: number;
  /** Overall system setup status description. */
  overallStatus: OverallStatus;
  /** Single primary action the user should take next, or null if none. */
  primaryAction: { label: string; to: string } | null;
  /** Human-readable label for the current instance scope. */
  instanceLabel: string | null;
};

/** Actions exposed by the useSetupFlow hook. */
export type SetupActions = {
  /** Refresh all setup data from the server. */
  refresh: () => void;
  /** Navigate to a specific step's action route. */
  navigateToStep: (stepId: string) => void;
};
