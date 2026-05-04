/**
 * Artifacts feature module — artifact registry management.
 *
 * Provides types, helpers, and components for browsing, creating,
 * editing, and inspecting artifact records on the ForgeFrame
 * control plane surface.
 *
 * @packageDocumentation
 */

export { ArtifactList } from "./components/ArtifactList";
export type { ArtifactListProps } from "./components/ArtifactList";

export { ArtifactDetailPanel } from "./components/ArtifactDetailPanel";
export type { ArtifactDetailPanelProps } from "./components/ArtifactDetailPanel";

export { ArtifactCreateForm } from "./components/ArtifactCreateForm";
export type { ArtifactCreateFormProps } from "./components/ArtifactCreateForm";

export { ArtifactEditForm } from "./components/ArtifactEditForm";
export type { ArtifactEditFormProps } from "./components/ArtifactEditForm";

export type {
  ArtifactEditorForm,
  LinkedArtifactObject,
  ArtifactAccessSummary,
  LoadState,
} from "./types";

export {
  ARTIFACT_TYPE_OPTIONS,
  ARTIFACT_STATUS_OPTIONS,
  TARGET_KIND_OPTIONS,
  WORKSPACE_ROLE_OPTIONS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
} from "./types";

export {
  normalizeOptionalText,
  parseJsonObject,
  parseSizeBytes,
  formatTimestamp,
  formatBytes,
  formatChecksum,
  externalHttpUrl,
  cloneArtifactMetadata,
  stripStructuredMetadata,
  describeAttachmentLink,
  describeArtifactAccess,
  buildLinkedObjects,
  buildArtifactMetadata,
  buildCreateAttachments,
} from "./helpers";
