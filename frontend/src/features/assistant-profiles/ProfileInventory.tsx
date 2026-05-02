/**
 * Assistant profile inventory table.
 *
 * Lists all profiles with scope, mode, status, quiet hours, direct-action
 * policy, and last evaluation. Rows are selectable to view detail.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";
import type { AssistantProfileSummary } from "../../api/domain/assistant-profiles";
import { buildChannelPath } from "../../app/workInteractionRoutes";
import { summarizeEvaluation } from "./utils";
import { type LoadState } from "../../pages/workInteractionPageSupport";

/** Props for {@link ProfileInventory}. */
export type ProfileInventoryProps = {
  /** The current instance ID for link building. */
  instanceId: string;
  /** Array of profile summaries. */
  profiles: AssistantProfileSummary[];
  /** The currently selected profile ID (highlighted in table). */
  selectedProfileId: string;
  /** Called when a profile row is clicked. */
  onSelectProfile: (profileId: string) => void;
  /** Load state for the profile list. */
  listState: LoadState;
};

/**
 * Inventory table of assistant profiles.
 *
 * Displays a compact table with key governance fields. Clicking a row
 * selects that profile and triggers the detail view.
 */
export function ProfileInventory({
  instanceId,
  profiles,
  selectedProfileId,
  onSelectProfile,
  listState,
}: ProfileInventoryProps) {
  if (listState === "loading") {
    return <p className="fg-muted">Loading assistant-profile inventory.</p>;
  }

  if (listState === "error") {
    return <p className="fg-danger">Failed to load assistant-profile inventory.</p>;
  }

  return (
    <div className="fg-table-wrap">
      <table className="fg-table" aria-label="Assistant profile inventory">
        <thead>
          <tr>
            <th>Profile</th>
            <th>Scope</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Quiet hours</th>
            <th>Direct actions</th>
            <th>Last evaluation</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => (
            <tr
              key={profile.assistant_profile_id}
              className={profile.assistant_profile_id === selectedProfileId ? "is-selected" : undefined}
            >
              <td>
                <button
                  className="fg-table-trigger"
                  type="button"
                  onClick={() => onSelectProfile(profile.assistant_profile_id)}
                >
                  {profile.display_name}
                </button>
                <div className="fg-code">{profile.assistant_profile_id}</div>
                {profile.risk_warning ? (
                  <span className="fg-pill" data-tone={profile.risk_warning.level === "high" ? "danger" : "warning"}>
                    {profile.risk_warning.title}
                  </span>
                ) : null}
              </td>
              <td>
                <div>{profile.profile_scope_label}</div>
                <div className="fg-muted">{profile.memory_scope_label}</div>
              </td>
              <td>
                <div>{profile.operating_mode_label}</div>
                <div className="fg-muted">{profile.direct_action_policy_label}</div>
              </td>
              <td>
                <span className="fg-pill" data-tone={profile.status === "active" && profile.assistant_mode_enabled ? "success" : "warning"}>
                  {profile.status}
                </span>
                <div className="fg-muted">{profile.assistant_mode_enabled ? "assistant mode enabled" : "assistant mode disabled"}</div>
              </td>
              <td>{profile.quiet_hours_summary}</td>
              <td>
                <div>{profile.direct_action_policy_label}</div>
                <div className="fg-muted">
                  {profile.primary_channel_id
                    ? <Link to={buildChannelPath({ instanceId, channelId: profile.primary_channel_id })} onClick={(e) => e.stopPropagation()}>{profile.primary_channel_id}</Link>
                    : "no primary channel"}
                </div>
              </td>
              <td>{summarizeEvaluation(profile.last_evaluation)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
