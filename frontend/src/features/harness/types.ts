/**
 * Types for the ForgeFrame Harness feature module.
 *
 * These types decouple the harness UI from the broader providers control-plane
 * surface and define local state contracts for the guided integration workflow.
 */
import type {
  HarnessProfile,
  HarnessRun,
} from "../../api/domain";
import type {
  HarnessActionResult,
  ProvidersPageActions,
  ProvidersPageData,
} from "../providers/providersShared";

/** Re-export harness-relevant data types from the providers domain. */
export type {
  HarnessProfile,
  HarnessRun,
  HarnessActionResult,
  ProvidersPageData,
  ProvidersPageActions,
};

/** Overall harness status tone for the hero summary. */
export type HarnessStatusTone = "success" | "warning" | "danger" | "neutral";

/** Derived harness health summary shown in the top hero bar. */
export type HarnessStatusSummary = {
  statusTone: HarnessStatusTone;
  statusLabel: string;
  nextStep: string;
  nextStepTone: HarnessStatusTone;
  activeProfile: string | null;
  activeProfileKey: string | null;
  lastVerify: string;
  primaryIssue: string | null;
};

/** Grouped action categories for the action panel. */
export type ActionCategory = "primary" | "safe-test" | "lifecycle" | "advanced";

/** Edit mode for the harness UI. */
export type HarnessEditMode = "view" | "editing" | "creating";

/** Props shared by all harness section components. */
export type HarnessSectionProps = {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
  instanceId?: string | null;
};

/** Props for the main control section. */
export type HarnessControlSectionProps = HarnessSectionProps;
