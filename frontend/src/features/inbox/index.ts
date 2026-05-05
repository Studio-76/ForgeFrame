/**
 * Inbox feature module — triage queue management.
 *
 * Provides the inbox inventory listing, detail panel with quick actions,
 * create/edit forms, shared types, and helper utilities.
 *
 * @packageDocumentation
 */

export { InboxList } from "./components/InboxList";
export type { InboxListProps } from "./components/InboxList";

export { InboxDetail } from "./components/InboxDetail";
export type { InboxDetailProps } from "./components/InboxDetail";

export type {
  CreateForm,
  EditForm,
  InboxSourceFilter,
} from "./types";

export {
  TRIAGE_OPTIONS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  SOURCE_OPTIONS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
} from "./types";

export {
  parseJsonObject,
  buildExecutionRoute,
  buildApprovalRoute,
  inboxSourceLabel,
  inboxQueuePosture,
} from "./helpers";
