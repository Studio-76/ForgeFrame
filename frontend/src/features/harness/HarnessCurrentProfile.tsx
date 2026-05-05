/**
 * Current profile panel — combines active profile details and last result.
 *
 * This is the center panel that shows the selected profile's configuration,
 * status, and recent activity. It replaces the split view where active profile
 * and last result were in separate cards.
 */
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { ProvidersPageData } from "../providers/providersShared";
import {
  formatMetric,
  formatTimestamp,
  joinList,
  toStringValue,
} from "../providers/providersShared";
import {
  TonePill,
  toneFromProofStatus,
  toneFromStatus,
  formatHarnessMode,
  formatHarnessScope,
} from "../providers/providersSectionUtils";
import type { HarnessEditMode } from "./types";

export type HarnessCurrentProfileProps = {
  profile: ProvidersPageData["profiles"][number] | null;
  lastRun: ProvidersPageData["runs"][number] | null;
  proof: { status: "none" | "partial" | "proven"; note: string } | null;
  lastHarnessAction: ProvidersPageData["lastHarnessAction"];
  logSurfaceLink: string;
  editMode: HarnessEditMode;
  canMutate: boolean;
  onEnterEditMode: () => void;
  onCreateDraft: () => void;
};

/**
 * Combined profile detail and last result panel.
 */
export function HarnessCurrentProfile({
  profile,
  lastRun,
  proof,
  lastHarnessAction,
  logSurfaceLink,
  editMode,
  canMutate,
  onEnterEditMode,
  onCreateDraft,
}: HarnessCurrentProfileProps) {
  if (!profile) {
    return (
      <div className="ff-harness-empty">
        <strong>No profile selected</strong>
        <p>
          Choose a profile from the list to inspect its configuration,
          run actions, and manage lifecycle.
        </p>
      </div>
    );
  }

  return (
    <div className="fg-stack">
      {/* Config card */}
      <div className="ff-harness-current-profile">
        <div className="ff-harness-current-profile-header">
          <div>
            <h3 className="ff-harness-current-profile-title">
              {profile.label}
            </h3>
            <p className="ff-harness-current-profile-subtitle">
              {profile.provider_key} \u00B7 v{formatMetric(profile.config_revision ?? 1)}
              {" \u00B7 "}scope={formatHarnessScope(profile)}
            </p>
          </div>
          {canMutate && editMode === "view" ? (
            <div className="fg-actions">
              <button
                type="button"
                className="fg-button-secondary"
                onClick={onEnterEditMode}
              >
                Edit profile
              </button>
              <button
                type="button"
                className="fg-button-secondary"
                onClick={onCreateDraft}
              >
                Create draft from preset
              </button>
            </div>
          ) : null}
        </div>

        {/* Status badges */}
        <div className="ff-harness-detail-row">
          <TonePill
            label={profile.enabled ? "active" : "inactive"}
            tone={profile.enabled ? "success" : "neutral"}
          />
          <TonePill
            label={profile.lifecycle_status ?? "draft"}
            tone={toneFromStatus(profile.lifecycle_status ?? "draft")}
          />
          {profile.needs_attention ? (
            <TonePill label="needs attention" tone="warning" />
          ) : null}
          {proof ? (
            <TonePill
              label={`proof ${proof.status}`}
              tone={toneFromProofStatus(proof.status)}
            />
          ) : null}
        </div>

        {/* Detail grid */}
        <div className="fg-detail-grid fg-detail-grid-compact">
          <div className="fg-detail-rows">
            <p>
              <span className="fg-detail-key">endpoint</span>{" "}
              {profile.endpoint_base_url}
            </p>
            <p>
              <span className="fg-detail-key">auth</span>{" "}
              {profile.auth_scheme} \u00B7 header={profile.auth_header}
            </p>
            <p>
              <span className="fg-detail-key">models</span>{" "}
              {joinList(profile.models)}
            </p>
            <p>
              <span className="fg-detail-key">capabilities</span>{" "}
              streaming={profile.stream_mapping?.enabled ? "yes" : "no"}
              {" \u00B7 "}tools={profile.capabilities?.tool_calling ? "yes" : "no"}
              {" \u00B7 "}responses={profile.capabilities?.responses ? "yes" : "no"}
            </p>
          </div>
        </div>

        {/* Last activity row */}
        <div className="ff-harness-detail-row">
          <span>
            last run:{" "}
            {lastRun
              ? `${formatHarnessMode(lastRun.mode)} \u00B7 ${lastRun.status}`
              : "not recorded"}
          </span>
          <span>
            verify: {toStringValue(profile.last_verify_status, "never")}
          </span>
          <span>
            probe: {toStringValue(profile.last_probe_status, "never")}
          </span>
          <span>
            sync: {toStringValue(profile.last_sync_status, "never")}
          </span>
        </div>

        {profile.last_error ? (
          <p className="fg-note">Last error: {profile.last_error}</p>
        ) : null}

        {/* Model inventory (collapsible) */}
        {profile.model_inventory?.length ? (
          <details className="fg-mt-sm">
            <summary
              style={{
                fontSize: "var(--fg-type-size-meta)",
                cursor: "pointer",
              }}
            >
              Model inventory ({profile.model_inventory.length})
            </summary>
            <div className="fg-stack fg-mt-sm">
              {profile.model_inventory.map((item, index) => (
                <div
                  key={`${toStringValue(item.model, "model")}-${index}`}
                  className="fg-detail-rows fg-model-inv-row"
                >
                  <strong>{item.model}</strong>
                  <span className="fg-muted">
                    source={item.source} \u00B7 status={item.status}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {/* Mapping details (collapsible) */}
        {profile.request_mapping?.path ? (
          <details className="fg-mt-sm">
            <summary
              style={{
                fontSize: "var(--fg-type-size-meta)",
                cursor: "pointer",
              }}
            >
              Mapping details
            </summary>
            <div className="fg-detail-rows fg-mt-sm">
              <p>
                <span className="fg-detail-key">request</span>{" "}
                {profile.request_mapping.method ?? "POST"}{" "}
                {profile.request_mapping.path}
              </p>
              <p>
                <span className="fg-detail-key">response</span>{" "}
                path={toStringValue(profile.response_mapping?.text_path)}
              </p>
              <p>
                <span className="fg-detail-key">error</span>{" "}
                path={toStringValue(profile.error_mapping?.message_path)}
              </p>
            </div>
          </details>
        ) : null}
      </div>

      {/* Last Result card */}
      {lastHarnessAction ? (
        <div className="ff-harness-last-result">
          <div className="ff-harness-last-result-header">
            <h4>Last result</h4>
            <TonePill
              label={lastHarnessAction.status}
              tone={toneFromStatus(lastHarnessAction.status)}
            />
          </div>
          <p className="fg-muted ff-harness-last-result-summary">
            {lastHarnessAction.summary}
          </p>
          <div className="ff-harness-detail-row">
            <span>
              provider={toStringValue(lastHarnessAction.providerKey)}
            </span>
            <span>model={toStringValue(lastHarnessAction.model)}</span>
            {lastHarnessAction.run?.status ? (
              <span>status={lastHarnessAction.run.status}</span>
            ) : null}
          </div>
          {lastHarnessAction.error ? (
            <p className="fg-note">Error: {lastHarnessAction.error}</p>
          ) : null}
          <div className="ff-nav-links">
            <a className="fg-nav-link" href={logSurfaceLink}>
              View logs
            </a>
          </div>
        </div>
      ) : null}

      {!lastHarnessAction && lastRun ? (
        <div className="ff-harness-last-result">
          <div className="ff-harness-last-result-header">
            <h4>Last run</h4>
            <TonePill
              label={lastRun.status}
              tone={toneFromStatus(lastRun.status)}
            />
          </div>
          <div className="ff-harness-detail-row">
            <span>{formatTimestamp(lastRun.executed_at)}</span>
            <span>mode={formatHarnessMode(lastRun.mode)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
