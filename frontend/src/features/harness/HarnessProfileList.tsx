/**
 * Harness profile list — left panel showing saved profiles.
 *
 * Displays all saved harness profiles as a compact selectable list.
 * The operator picks a profile to inspect, test, or manage.
 */
import { joinList } from "../providers/providersShared";
import type { ProvidersPageData } from "../providers/providersShared";
import {
  TonePill,
  latestRunForProfile,
  profileProofState,
} from "../providers/providersSectionUtils";

export type HarnessProfileListProps = {
  profiles: ProvidersPageData["profiles"];
  runs: ProvidersPageData["runs"];
  runOps: ProvidersPageData["runOps"];
  providers: ProvidersPageData["providers"];
  selectedProfileKey: string;
  onSelectProfile: (key: string) => void;
};

/**
 * Selectable list of saved harness profiles.
 */
export function HarnessProfileList({
  profiles,
  runs,
  runOps,
  providers,
  selectedProfileKey,
  onSelectProfile,
}: HarnessProfileListProps) {
  if (profiles.length === 0) {
    return null;
  }

  return (
    <div className="ff-harness-presets" role="listbox" aria-label="Harness profiles">
      {profiles.map((profile) => {
        const profileRun = latestRunForProfile(profile.provider_key, runs, runOps);
        const proof = profileProofState(profile, providers);
        const isSelected = profile.provider_key === selectedProfileKey;
        return (
          <button
            key={profile.provider_key}
            type="button"
            className={`ff-harness-preset${isSelected ? " is-selected" : ""}`}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelectProfile(profile.provider_key)}
          >
            <div className="ff-harness-preset-meta">
              <span className="ff-harness-preset-name">{profile.label}</span>
              <span className="ff-harness-preset-detail">
                {profile.provider_key} \u00B7 {profile.integration_class}
                {profile.lifecycle_status ? ` \u00B7 ${profile.lifecycle_status}` : ""}
              </span>
              <span className="ff-harness-preset-detail">
                Models: {joinList(profile.models.slice(0, 3))}
                {profile.models.length > 3 ? ` +${profile.models.length - 3}` : ""}
              </span>
            </div>
            <div className="ff-harness-preset-action">
              <TonePill
                label={profile.enabled ? "active" : "inactive"}
                tone={profile.enabled ? "success" : "neutral"}
              />
              {profile.needs_attention ? (
                <TonePill label="attention" tone="warning" />
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
