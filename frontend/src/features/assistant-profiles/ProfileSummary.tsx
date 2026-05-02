/**
 * Top-level assistant profile health summary bar.
 *
 * Shows profile counts, external-rights indicators, and the next recommended
 * action so operators know immediately where they stand.
 *
 * @packageDocumentation
 */

import type { AssistantProfileSummary } from "../../api/domain/assistant-profiles";

/** Props for {@link ProfileSummary}. */
export type ProfileSummaryProps = {
  /** All profiles in the current scope. */
  profiles: AssistantProfileSummary[];
  /** Whether the current session can mutate. */
  canMutate: boolean;
  /** Called when the operator wants to create a new profile. */
  onCreateProfile: () => void;
};

/**
 * Health summary bar showing profile counts and next action.
 */
export function ProfileSummary({ profiles, canMutate, onCreateProfile }: ProfileSummaryProps) {
  const totalCount = profiles.length;
  const activeCount = profiles.filter((p) => p.status === "active" && p.assistant_mode_enabled).length;
  const externalRightsCount = profiles.filter((p) => p.risk_warning).length;
  const attentionCount = profiles.filter((p) => p.status === "paused" || (p.risk_warning?.level === "high")).length;

  const nextAction = totalCount === 0
    ? "No profiles exist. Create your first assistant profile."
    : externalRightsCount > 0
      ? `${externalRightsCount} profile${externalRightsCount === 1 ? " has" : "s have"} external rights — review action permissions.`
      : attentionCount > 0
        ? `${attentionCount} profile${attentionCount === 1 ? " needs" : "s need"} attention.`
        : "All profiles running normally.";

  const nextActionTone = totalCount === 0
    ? "danger"
    : externalRightsCount > 0 || attentionCount > 0
      ? "warning"
      : "success";

  return (
    <article className="ff-status-hero" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1px" }}>
      <div className="fg-card" style={{ padding: "var(--space-16, 16px)" }}>
        <div className="fg-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Profiles</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{totalCount}</div>
      </div>
      <div className="fg-card" style={{ padding: "var(--space-16, 16px)" }}>
        <div className="fg-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Active</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{activeCount}</div>
      </div>
      <div className="fg-card" style={{ padding: "var(--space-16, 16px)" }}>
        <div className="fg-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>External rights</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 600, color: externalRightsCount > 0 ? "var(--color-warning, #eab308)" : undefined }}>
          {externalRightsCount}
        </div>
      </div>
      <div className="fg-card" style={{ padding: "var(--space-16, 16px)" }}>
        <div className="fg-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Requires attention</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 600, color: attentionCount > 0 ? "var(--color-danger, #ef4444)" : undefined }}>
          {attentionCount}
        </div>
      </div>
      <div className="fg-card" style={{ padding: "var(--space-16, 16px)", gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-12, 12px)" }}>
          <div>
            <span className="fg-muted" style={{ fontSize: "0.875rem" }}>Next action: </span>
            <span style={{ fontSize: "0.875rem", color: `var(--color-${nextActionTone}, inherit)` }}>{nextAction}</span>
          </div>
          {canMutate && (
            <button type="button" className="ff-primary-action" onClick={onCreateProfile}>
              Create assistant profile
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
