/**
 * Channels feature types — delivery channel management.
 *
 * @packageDocumentation
 */

import type { DeliveryChannelKind, DeliveryChannelStatus } from "../../api/domain/channels";

// ─── Form types ───────────────────────────────────────────────────────────

/** Create channel form values. */
export interface CreateChannelForm {
  channelId: string;
  channelKind: DeliveryChannelKind;
  label: string;
  target: string;
  status: DeliveryChannelStatus;
  fallbackChannelId: string;
  metadataJson: string;
}

/** Edit channel form values. */
export interface EditChannelForm {
  label: string;
  target: string;
  status: DeliveryChannelStatus;
  fallbackChannelId: string;
  metadataJson: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Status filter options including "all". */
export const STATUS_OPTIONS: readonly (DeliveryChannelStatus | "all")[] = [
  "all", "active", "disabled", "degraded",
] as const;

/** Channel kind options. */
export const KIND_OPTIONS: readonly DeliveryChannelKind[] = [
  "in_app", "email", "webhook", "slack",
] as const;

/** Kind filter options including "all". */
export const KIND_FILTER_OPTIONS: readonly (DeliveryChannelKind | "all")[] = [
  "all", ...KIND_OPTIONS,
] as const;

/** Per-kind configuration for form rendering. */
export const CHANNEL_KIND_CONFIG: Record<DeliveryChannelKind, {
  title: string;
  hint: string;
  placeholder: string;
}> = {
  email: {
    title: "Mailbox target",
    hint: "Use a real mailbox or distribution list. ForgeFrame shows the destination but never renders credential material.",
    placeholder: "ops@example.com",
  },
  slack: {
    title: "Slack destination",
    hint: "Persist the channel or handle here. Secret webhook or app credentials stay outside the visible form fields.",
    placeholder: "#ops-alerts",
  },
  webhook: {
    title: "Webhook endpoint",
    hint: "Stored webhook targets are masked after save. Enter a new endpoint only when rotating the integration.",
    placeholder: "https://hooks.example.com/services/...",
  },
  in_app: {
    title: "In-app destination",
    hint: "Use the in-product route or queue target for delivery that stays inside ForgeFrame.",
    placeholder: "operator://inbox/primary",
  },
};

// ─── Default form values ──────────────────────────────────────────────────

/** Default empty create form. */
export const DEFAULT_CREATE_FORM: CreateChannelForm = {
  channelId: "",
  channelKind: "email",
  label: "",
  target: "",
  status: "active",
  fallbackChannelId: "",
  metadataJson: "{}",
};

/** Default empty edit form. */
export const DEFAULT_EDIT_FORM: EditChannelForm = {
  label: "",
  target: "",
  status: "active",
  fallbackChannelId: "",
  metadataJson: "{}",
};
