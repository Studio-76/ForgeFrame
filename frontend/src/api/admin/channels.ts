/**
 * Delivery channel management API functions and types.
 *
 * @packageDocumentation
 */

import {
  type InstanceRecord,
  appendTenantScope,
  appendQueryParams,
  fetchJson,
} from "./_internal";

import type { NotificationSummary } from "./notifications";

// ---------------------------------------------------------------------------
// Channel types
// ---------------------------------------------------------------------------

/** Delivery channel kind. */
export type DeliveryChannelKind = "in_app" | "email" | "webhook" | "slack";

/** Delivery channel status. */
export type DeliveryChannelStatus = "active" | "disabled" | "degraded";

/** Delivery channel summary. */
export type DeliveryChannelSummary = {
  channel_id: string;
  instance_id: string;
  company_id: string;
  channel_kind: DeliveryChannelKind;
  label: string;
  target: string;
  status: DeliveryChannelStatus;
  fallback_channel_id?: string | null;
  metadata: Record<string, unknown>;
  scope_label: string;
  fallback_rank: number;
  notification_count: number;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
};

/** Channel credential posture. */
export type ChannelCredentialPosture = {
  storage_state: "not_applicable" | "no_secret_material" | "external_reference" | "inline_secret_redacted" | "masked_target_only";
  target_masked: boolean;
  redacted_fields: string[];
  external_reference_fields: string[];
  summary: string;
};

/** Channel detail. */
export type ChannelDetail = DeliveryChannelSummary & {
  recent_notifications: NotificationSummary[];
  credential_posture: ChannelCredentialPosture;
  advanced_metadata: Record<string, unknown>;
  scope_reference?: string | null;
  fallback_chain: DeliveryChannelSummary[];
  fallback_sources: DeliveryChannelSummary[];
  test_delivery_supported: boolean;
  test_delivery_state: string;
  test_delivery_reason: string;
};

// ---------------------------------------------------------------------------
// Channel API functions
// ---------------------------------------------------------------------------

/**
 * Fetch delivery channels for the given instance.
 * @param instanceId - Optional instance ID for scoping.
 * @param filters - Optional filters (status, kind, limit).
 * @returns Response with channels list.
 */
export function fetchChannels(
  instanceId?: string | null,
  filters: {
    status?: DeliveryChannelStatus | "all";
    kind?: DeliveryChannelKind | "all";
    limit?: number;
  } = {},
) {
  return fetchJson<{ status: string; instance?: InstanceRecord; channels: DeliveryChannelSummary[] }>(
    appendQueryParams(appendTenantScope("/admin/channels", undefined, instanceId), {
      status: filters.status && filters.status !== "all" ? filters.status : null,
      kind: filters.kind && filters.kind !== "all" ? filters.kind : null,
      limit: filters.limit ?? 100,
    }),
  );
}

/**
 * Fetch channel detail by ID.
 * @param channelId - The channel ID.
 * @param instanceId - Optional instance ID for scoping.
 * @returns Response with channel detail.
 */
export function fetchChannelDetail(channelId: string, instanceId?: string | null) {
  return fetchJson<{ status: string; channel: ChannelDetail }>(
    appendTenantScope(`/admin/channels/${encodeURIComponent(channelId)}`, undefined, instanceId),
  );
}

/**
 * Create a new delivery channel.
 * @param instanceId - The instance ID or null.
 * @param payload - Channel creation parameters.
 * @returns Response with the created channel.
 */
export function createChannel(
  instanceId: string | null | undefined,
  payload: {
    channel_id?: string | null;
    channel_kind: DeliveryChannelKind;
    label: string;
    target: string;
    status?: DeliveryChannelStatus;
    fallback_channel_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; channel: ChannelDetail }>(
    appendTenantScope("/admin/channels", undefined, instanceId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Update an existing delivery channel.
 * @param instanceId - The instance ID or null.
 * @param channelId - The channel ID.
 * @param payload - Fields to update.
 * @returns Response with the updated channel.
 */
export function updateChannel(
  instanceId: string | null | undefined,
  channelId: string,
  payload: {
    label?: string;
    target?: string;
    status?: DeliveryChannelStatus | null;
    fallback_channel_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return fetchJson<{ status: string; channel: ChannelDetail }>(
    appendTenantScope(`/admin/channels/${encodeURIComponent(channelId)}`, undefined, instanceId),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
