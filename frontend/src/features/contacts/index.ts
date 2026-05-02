/**
 * Contacts feature module — redesigned contact management UX.
 *
 * Provides a summary hero, empty state, compact filter bar, inventory table,
 * guided creation flow, and a detail panel with route truth, consent posture,
 * provenance, and linked work records.
 *
 * @packageDocumentation
 */

export { ContactsSummaryHero } from "./ContactsSummaryHero";
export type { ContactsSummaryHeroProps } from "./ContactsSummaryHero";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { ContactFilters } from "./ContactFilters";
export type { ContactFiltersProps } from "./ContactFilters";

export { ContactTable } from "./ContactTable";
export type { ContactTableProps } from "./ContactTable";

export { ContactDetailPanel } from "./ContactDetailPanel";
export type { ContactDetailPanelProps } from "./ContactDetailPanel";

export { CreateContactPanel } from "./CreateContactPanel";
export type { CreateContactPanelProps } from "./CreateContactPanel";

export { useContacts } from "./useContacts";
export type { UseContactsReturn } from "./useContacts";

export type {
  CreateContactForm,
  EditContactForm,
  ContactSummaryCounts,
} from "./types";

export {
  STATUS_OPTIONS,
  CREATE_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  STATUS_LABELS,
  VISIBILITY_LABELS,
  ROUTE_STATUS_LABELS,
  CONSENT_LABELS,
  CREATE_STEP_LABELS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  DEFAULT_STRUCTURED_FIELDS,
} from "./types";

export {
  formatTimestamp,
  normalizeText,
  buildInventoryPath,
  buildContactPath,
  computeSummaryCounts,
  statusTone,
  routeStatusTone,
  consentTone,
  channelInventoryLabel,
  splitContactMetadata,
  buildContactMetadata,
} from "./utils";
