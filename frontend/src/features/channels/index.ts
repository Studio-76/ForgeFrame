/**
 * Channels feature module — delivery channel management.
 *
 * Provides the channel inventory table, detail panel with inline edit form,
 * guided creation flow, types, helpers, and constants.
 *
 * @packageDocumentation
 */

export { ChannelList } from "./components/ChannelList";
export type { ChannelListProps } from "./components/ChannelList";

export { ChannelDetail } from "./components/ChannelDetail";
export type { ChannelDetailProps } from "./components/ChannelDetail";

export { ChannelCreateForm } from "./components/ChannelCreateForm";
export type { ChannelCreateFormProps } from "./components/ChannelCreateForm";

export type { CreateChannelForm, EditChannelForm } from "./types";

export {
  STATUS_OPTIONS,
  KIND_OPTIONS,
  KIND_FILTER_OPTIONS,
  CHANNEL_KIND_CONFIG,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
} from "./types";

export {
  formatTimestamp,
  channelStatusTone,
  fallbackRankLabel,
} from "./helpers";
