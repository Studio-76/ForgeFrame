/**
 * ForgeFrame Harness feature module.
 *
 * Provides a guided integration profile workflow with decomposed components
 * for the Harness page. The main entry point is HarnessControlSection.
 */
export { HarnessControlSection } from "./HarnessControlSection";
export type { HarnessControlSectionProps } from "./types";

export { HarnessStatusHero } from "./HarnessStatusHero";
export { HarnessProfileList } from "./HarnessProfileList";
export { HarnessTemplatesList } from "./HarnessTemplatesList";
export { HarnessCurrentProfile } from "./HarnessCurrentProfile";
export { HarnessDraftEditor } from "./HarnessDraftEditor";
export { HarnessActionPanel } from "./HarnessActionPanel";
export { HarnessRunHistory } from "./HarnessRunHistory";
export { HarnessDiagnostics } from "./HarnessDiagnostics";

export { useHarnessState } from "./useHarnessState";
export type { HarnessUIState } from "./useHarnessState";

export { deriveHarnessStatus } from "./utils";
export type {
  HarnessStatusSummary,
  HarnessStatusTone,
  HarnessEditMode,
  HarnessSectionProps,
} from "./types";
