/**
 * ChannelList — the delivery channel inventory table.
 *
 * Shows all channels for the current scope, with status pill, fallback rank,
 * and last-success / last-error columns.
 *
 * @packageDocumentation
 */

import type { DeliveryChannelSummary } from "../../../api/domain/channels";
import type { LoadState } from "../../../pages/workInteractionPageSupport";

import { channelStatusTone, fallbackRankLabel, formatTimestamp } from "../helpers";

/**
 * Props for ChannelList.
 */
export type ChannelListProps = {
  /** Channel summaries to display. */
  channels: DeliveryChannelSummary[];
  /** Current load state. */
  listState: LoadState;
  /** Currently selected channel ID. */
  selectedChannelId: string;
  /** Called when a channel row is clicked. */
  onSelectChannel: (channelId: string) => void;
};

/**
 * Channel inventory table — lists all delivery channels with status,
 * type, scope, fallback rank, and recent delivery outcomes.
 */
export function ChannelList({ channels, listState, selectedChannelId, onSelectChannel }: ChannelListProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Channel inventory</h3>
          <p className="fg-muted">Each row is a persisted delivery endpoint with explicit status, scope, fallback rank, and recent outcome truth.</p>
        </div>
        <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
      </div>

      {listState === "loading" ? <p className="fg-muted">Loading channel inventory.</p> : null}
      {listState === "success" && channels.length === 0 ? <p className="fg-muted">No channels matched the selected status and type filters.</p> : null}

      {channels.length > 0 ? (
        <div className="fg-table-wrap">
          <table className="fg-table" aria-label="Channel inventory">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Type</th>
                <th>Status</th>
                <th>Scope</th>
                <th>Fallback rank</th>
                <th>Last success</th>
                <th>Last error</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.channel_id} className={channel.channel_id === selectedChannelId ? "is-selected" : undefined}>
                  <td>
                    <button
                      className="fg-table-trigger"
                      type="button"
                      onClick={() => onSelectChannel(channel.channel_id)}
                    >
                      {channel.label}
                    </button>
                    <div className="fg-muted">{channel.channel_id}</div>
                    <div className="fg-muted">{channel.target}</div>
                  </td>
                  <td>{channel.channel_kind}</td>
                  <td><span className="fg-pill" data-tone={channelStatusTone(channel.status)}>{channel.status}</span></td>
                  <td>{channel.scope_label}</td>
                  <td>{fallbackRankLabel(channel.fallback_rank)}</td>
                  <td>{formatTimestamp(channel.last_success_at, "Never delivered")}</td>
                  <td>
                    {channel.last_error ?? "No recent delivery error"}
                    <div className="fg-muted">{formatTimestamp(channel.last_failure_at, "No failure recorded")}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
