import { Link } from "react-router-dom";

import type {
  AdminInstanceMembership,
  AdminSecuritySession,
  AdminUser,
  ElevatedAccessApproverPosture,
  ElevatedAccessRequest,
  HarnessSecretPosture,
  InstanceRecord,
  SecretStorageControl,
  SecurityBlocker,
  SecurityBootstrapStatus,
  SecurityCredentialPolicy,
  SecurityRotationEvent,
  SecuritySecretPosture,
} from "../../api/domain";
import {
  formatApprovalStatus,
  formatApprovalType,
  formatTimestamp,
} from "../approvals/presentation";
import {
  AdminPasswordResetForm,
  type AdminPasswordResetDraft,
} from "./AdminPasswordResetForm";
import type { ElevatedAccessRequestDraft } from "./elevatedAccess";
import { OwnPasswordRotationForm, type OwnPasswordRotationDraft } from "./OwnPasswordRotationForm";
import {
  adminSessionStatus,
  approvalTone,
  buildApprovalDetailPath,
  buildRequestAuditHistoryPath,
  describeRequestBanner,
  formatRequestActor,
  formatRequestTarget,
  requestStage,
  secretStateTone,
} from "./helpers";
import { Button } from "../../components/ui/Button";

export type SecurityTabId =
  | "posture"
  | "admin_users"
  | "sessions"
  | "elevated_access"
  | "provider_secrets"
  | "credential_policy";

export type RotationTargetOption = {
  target_type: "provider" | "harness_profile";
  target_id: string;
  label: string;
  recommended_kind: string;
};

export type RotationDraft = {
  target_type: "provider" | "harness_profile";
  target_id: string;
  kind: string;
  reference: string;
  notes: string;
};

export type AdminUserEditDraft = {
  display_name: string;
  role: AdminUser["role"];
  status: AdminUser["status"];
};

export type AdminUserScopeDraft = {
  instance_id: string;
  role: AdminUser["role"];
  status: "active" | "disabled";
};

/**
 * A single item in the prioritized remediation checklist.
 */
export type RemediationItem = {
  id: string;
  label: string;
  summary: string;
  detail: string;
  whyMatters: string;
  requiredFix: string;
  severity: "danger" | "warning" | "success" | "neutral";
  active: boolean;
  count?: number;
  actionLabel: string;
  actionTab?: SecurityTabId;
};

export type OverallSecurityState = "secure" | "attention" | "recovery";

export const SECURITY_TABS: Array<{
  id: SecurityTabId;
  label: string;
  adminOnly?: boolean;
}> = [
  { id: "posture", label: "Posture" },
  { id: "admin_users", label: "Admin Users", adminOnly: true },
  { id: "sessions", label: "Sessions", adminOnly: true },
  { id: "elevated_access", label: "Elevated Access" },
  { id: "provider_secrets", label: "Provider Secrets", adminOnly: true },
  { id: "credential_policy", label: "Credential Policy" },
];

function AccessBlockedCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>{title}</h3>
          <p className="fg-muted">{description}</p>
        </div>
        <span className="fg-pill" data-tone="warning">Admin session required</span>
      </div>
    </article>
  );
}

function KeyValueList({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="fg-card-grid">
      {items.map((item) => (
        <article key={item.label} className="fg-subcard">
          <span className="fg-section-label">{item.label}</span>
          <p>{item.value}</p>
        </article>
      ))}
    </div>
  );
}

/**
 * Top-level security posture summary — makes the overall state obvious in 5 seconds.
 */
export function SecurityPostureSummary({
  overallState,
  activeBlockerCount,
  highestPriorityLabel,
  recoveryLabel,
  nextAction,
}: {
  overallState: OverallSecurityState;
  activeBlockerCount: number;
  highestPriorityLabel: string;
  recoveryLabel: string | null;
  nextAction: string;
}) {
  const stateMap: Record<OverallSecurityState, { label: string; tone: "success" | "warning" | "danger" }> = {
    secure: { label: "Secure", tone: "success" },
    attention: { label: "Attention required", tone: "warning" },
    recovery: { label: "Recovery required", tone: "danger" },
  };
  const state = stateMap[overallState];
  return (
    <div className="ff-sec-hero" data-state={overallState}>
      <div className="ff-sec-hero-left">
        <span className="ff-sec-hero-status" data-tone={state.tone}>{state.label}</span>
        {activeBlockerCount > 0 ? (
          <>
            <span className="ff-sec-hero-sep" />
            <p className="ff-sec-hero-detail">
              {activeBlockerCount} active blocker{activeBlockerCount !== 1 ? "s" : ""} &mdash; {highestPriorityLabel}
            </p>
          </>
        ) : recoveryLabel ? (
          <>
            <span className="ff-sec-hero-sep" />
            <p className="ff-sec-hero-detail">{recoveryLabel}</p>
          </>
        ) : (
          <>
            <span className="ff-sec-hero-sep" />
            <p className="ff-sec-hero-detail">All checks passed</p>
          </>
        )}
      </div>
      <div className="ff-sec-hero-actions">
        <span className="ff-status-hero-actions-hint">{nextAction}</span>
      </div>
    </div>
  );
}

/**
 * Prioritized remediation checklist — replaces the old blocker card grid.
 */
export function BlockersRemediationChecklist({
  items,
  selectedId,
  onSelect,
}: {
  items: RemediationItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const activeItems = items.filter((item) => item.active);
  const passedItems = items.filter((item) => !item.active);

  return (
    <div className="ff-sec-checklist">
      {activeItems.map((item) => (
        <div
          key={item.id}
          className={"ff-sec-checklist-item" + (selectedId === item.id ? " is-selected" : "")}
          data-passed="false"
          onClick={() => onSelect(selectedId === item.id ? null : item.id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(selectedId === item.id ? null : item.id); } }}
          role="button"
          tabIndex={0}
          aria-expanded={selectedId === item.id}
        >
          <div className="ff-sec-checklist-left">
            <span className="ff-sec-checklist-label">
              {item.count !== undefined && item.count > 0 ? (
                <span className="ff-sec-count" data-tone={item.severity}>{item.count}</span>
              ) : null}
              {item.label}
            </span>
            <span className="ff-sec-checklist-summary">{item.summary}</span>
          </div>
          <div className="ff-sec-checklist-badges">
            <span className="fg-pill" data-tone={item.severity}>
              {item.severity === "danger" ? "Critical" : item.severity === "warning" ? "Warning" : "Info"}
            </span>
          </div>
          <div className="ff-sec-checklist-action">
            <span className="fg-pill" data-tone="neutral">{item.actionLabel}</span>
          </div>
        </div>
      ))}
      {passedItems.length > 0 ? (
        <details className="ff-sec-checklist-item" data-passed="true" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <summary className="ff-sec-checklist-label" style={{ cursor: "pointer", padding: "var(--fg-space-2) 0", fontWeight: 600, fontSize: "var(--fg-type-size-meta)", color: "var(--fg-color-text-secondary)" }}>
            {passedItems.length} passed check{passedItems.length !== 1 ? "s" : ""}
          </summary>
          <div style={{ display: "grid", gap: "1px" }}>
            {passedItems.map((item) => (
              <div key={item.id} className="ff-sec-checklist-item" data-passed="true"
                onClick={() => onSelect(selectedId === item.id ? null : item.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(selectedId === item.id ? null : item.id); } }}
                role="button"
                tabIndex={0}
                aria-expanded={selectedId === item.id}
                style={{ borderTop: "1px solid var(--fg-color-border-default)" }}
              >
                <div className="ff-sec-checklist-left">
                  <span className="ff-sec-checklist-label">{item.label}</span>
                  <span className="ff-sec-checklist-summary">{item.summary}</span>
                </div>
                <div className="ff-sec-checklist-badges">
                  <span className="fg-pill" data-tone="success">Clear</span>
                </div>
                <div className="ff-sec-checklist-action">
                  <span className="fg-pill" data-tone="neutral">{item.actionLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Detail panel shown when a blocker item is selected for deeper review.
 */
export function ActiveBlockerDetail({
  item,
  onDismiss,
}: {
  item: RemediationItem;
  onDismiss: () => void;
}) {
  return (
    <article className="ff-sec-detail">
      <div className="ff-sec-detail-header">
        <div>
          <div className="ff-sec-detail-label">{item.label}</div>
        </div>
        <button className="fg-nav-link" onClick={onDismiss} type="button" aria-label="Dismiss detail">
          Dismiss
        </button>
      </div>
      <div className="ff-sec-detail-body">
        <div className="ff-sec-detail-field">
          <span className="ff-sec-detail-field-label">What is wrong</span>
          <span className="ff-sec-detail-field-value">{item.detail}</span>
        </div>
        <div className="ff-sec-detail-field">
          <span className="ff-sec-detail-field-label">Why it matters</span>
          <span className="ff-sec-detail-field-value">{item.whyMatters}</span>
        </div>
        <div className="ff-sec-detail-field">
          <span className="ff-sec-detail-field-label">Required fix</span>
          <span className="ff-sec-detail-field-value">{item.requiredFix}</span>
        </div>
        <div className="ff-sec-detail-field">
          <span className="ff-sec-detail-field-label">Next action</span>
          <span className="ff-sec-detail-field-value">{item.actionLabel}</span>
        </div>
      </div>
    </article>
  );
}

/**
 * Compact related-pages strip — replaces the old "Security control planes" heading.
 */
export function RelatedPagesStrip({
  activeTab,
  canViewAdminTabs,
  onSelectTab,
}: {
  activeTab: SecurityTabId;
  canViewAdminTabs: boolean;
  onSelectTab: (tab: SecurityTabId) => void;
}) {
  return (
    <div className="ff-sec-related">
      <span className="ff-sec-related-label">Sections</span>
      {SECURITY_TABS.map((tab) => (
        <button
          key={tab.id}
          className={"ff-sec-related-link" + (activeTab === tab.id ? " is-active" : "")}
          aria-selected={activeTab === tab.id}
          role="tab"
          onClick={() => onSelectTab(tab.id)}
          type="button"
        >
          {tab.label}
          {tab.adminOnly && !canViewAdminTabs ? " (Restricted)" : ""}
        </button>
      ))}
    </div>
  );
}

export function SecurityTabBar({
  activeTab,
  canViewAdminTabs,
  onSelectTab,
}: {
  activeTab: SecurityTabId;
  canViewAdminTabs: boolean;
  onSelectTab: (tab: SecurityTabId) => void;
}) {
  return (
    <div className="fg-actions" aria-label="Security tabs" role="tablist">
      {SECURITY_TABS.map((tab) => (
        <Button
          key={tab.id}
          aria-selected={activeTab === tab.id}
          role="tab"
          onPress={() => onSelectTab(tab.id)}
        >
          {tab.label}
          {tab.adminOnly && !canViewAdminTabs ? " (Restricted)" : ""}
        </Button>
      ))}
    </div>
  );
}

export function SecurityPostureSection({
  bootstrap,
  approverPosture,
  credentialPolicy,
  requests,
  sessions,
  users,
  canViewAdminTabs,
}: {
  bootstrap: SecurityBootstrapStatus | null;
  approverPosture: ElevatedAccessApproverPosture | null;
  credentialPolicy: SecurityCredentialPolicy | null;
  requests: ElevatedAccessRequest[];
  sessions: AdminSecuritySession[];
  users: AdminUser[];
  canViewAdminTabs: boolean;
}) {
  const openRequests = requests.filter((item) => item.gate_status === "open").length;
  const readyRequests = requests.filter((item) => item.ready_to_issue).length;
  const activeElevated = requests.filter((item) => item.session_status === "active").length;
  const forcedRotationUsers = users.filter((item) => item.must_rotate_password).length;
  const activeSessions = sessions.filter((item) => item.active).length;
  const breakGlassSessions = sessions.filter((item) => item.active && item.session_type === "break_glass").length;
  const hasAbnormalPressure = forcedRotationUsers > 0 || breakGlassSessions > 0;

  return (
    <div className="fg-stack">
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Security overview</h3>
            <p className="fg-muted">
              Exception pressure, approver availability, and credential remediation status.
            </p>
          </div>
          <span className="ff-sec-strip">
            <span className="ff-sec-strip-item">
              Open approvals: <span className="ff-sec-strip-value">{openRequests}</span>
            </span>
            <span className="ff-sec-strip-sep" />
            <span className="ff-sec-strip-item">
              Ready to start: <span className="ff-sec-strip-value">{readyRequests}</span>
            </span>
            <span className="ff-sec-strip-sep" />
            <span className="ff-sec-strip-item">
              Active elevated: <span className="ff-sec-strip-value">{activeElevated}</span>
            </span>
            {canViewAdminTabs ? (
              <>
                <span className="ff-sec-strip-sep" />
                <span className="ff-sec-strip-item">
                  Forced rotations: <span className="ff-sec-strip-value">{forcedRotationUsers}</span>
                </span>
              </>
            ) : null}
          </span>
        </div>
      </article>

      {approverPosture ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Elevated-access posture</h3>
              <p className="fg-muted">
                Break-glass and impersonation are time-bounded exceptions. Approval and session start remain separate actions.
              </p>
            </div>
            <span className="fg-pill" data-tone={approverPosture.state === "recovery_required" ? "danger" : "success"}>
              {approverPosture.eligible_admin_approver_count} eligibile approver{approverPosture.eligible_admin_approver_count !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="fg-approval-banner" data-tone={approverPosture.state === "recovery_required" ? "danger" : "success"}>
            <strong>{approverPosture.primary_message}</strong>
            <p>{approverPosture.secondary_message}</p>
          </div>
        </article>
      ) : (
        <AccessBlockedCard
          title="Elevated-access posture"
          description="Approval posture is loading."
        />
      )}

      {bootstrap ? (
        <article className="ff-sec-collapse">
          <details>
            <summary className="ff-sec-collapse-trigger">
              <span>
                Bootstrap baseline
                <span className="fg-pill" style={{ marginLeft: "0.5rem" }} data-tone={bootstrap.default_password_in_use ? "danger" : "success"}>
                  {bootstrap.default_password_in_use ? "Default password active" : "Bootstrap rotated"}
                </span>
              </span>
            </summary>
            <div className="ff-sec-collapse-body">
              <KeyValueList
                items={[
                  { label: "Bootstrap account", value: bootstrap.bootstrap_username },
                  { label: "Default password", value: bootstrap.default_password_in_use ? "Still in use" : "Rotated" },
                  { label: "Must rotate", value: bootstrap.must_rotate_password ? "Yes" : "No" },
                  { label: "Admin users", value: String(bootstrap.admin_user_count) },
                  { label: "Active sessions", value: String(bootstrap.active_session_count) },
                  { label: "Governance storage", value: bootstrap.governance_storage_backend },
                ]}
              />
            </div>
          </details>
        </article>
      ) : null}

      {canViewAdminTabs && (hasAbnormalPressure || users.length > 0) ? (
        <article className="ff-sec-collapse">
          <details>
            <summary className="ff-sec-collapse-trigger">
              <span>
                Privileged identity pressure
                {forcedRotationUsers > 0 ? (
                  <span className="fg-pill" style={{ marginLeft: "0.5rem" }} data-tone="warning">{forcedRotationUsers} forced rotations</span>
                ) : null}
              </span>
            </summary>
            <div className="ff-sec-collapse-body">
              <KeyValueList
                items={[
                  { label: "Admin users", value: String(users.length) },
                  { label: "Active sessions", value: String(activeSessions) },
                  { label: "Break-glass sessions", value: String(breakGlassSessions) },
                  { label: "Password reset pressure", value: `${forcedRotationUsers} users must rotate` },
                ]}
              />
            </div>
          </details>
        </article>
      ) : null}

      {credentialPolicy ? (
        <article className="ff-sec-collapse">
          <details>
            <summary className="ff-sec-collapse-trigger">
              Credential policy details &mdash; TTLs, impersonation limits, service account key rules
            </summary>
            <div className="ff-sec-collapse-body">
              <article className="fg-card" style={{ border: "none", padding: 0, background: "transparent" }}>
                <h4>Human sessions</h4>
                <KeyValueList
                  items={[
                    { label: "TTL", value: `${credentialPolicy.human_sessions?.ttl_hours ?? "Not recorded"} hours` },
                    { label: "Rotation trigger", value: String(credentialPolicy.human_sessions?.rotation_trigger ?? "Not recorded") },
                  ]}
                />
              </article>
              <article className="fg-card" style={{ border: "none", padding: 0, background: "transparent", marginTop: "var(--fg-space-3)" }}>
                <h4>Exception session policies</h4>
                <KeyValueList
                  items={[
                    {
                      label: "Approval TTL",
                      value: credentialPolicy.elevated_access_requests
                        ? `${credentialPolicy.elevated_access_requests.approval_ttl_minutes} minutes`
                        : "Not recorded",
                    },
                    {
                      label: "Break-glass max TTL",
                      value: credentialPolicy.break_glass_sessions
                        ? `${credentialPolicy.break_glass_sessions.max_ttl_minutes} minutes`
                        : "Not recorded",
                    },
                    {
                      label: "Impersonation max TTL",
                      value: credentialPolicy.impersonation_sessions
                        ? `${credentialPolicy.impersonation_sessions.max_ttl_minutes} minutes`
                        : "Not recorded",
                    },
                    {
                      label: "Impersonation write posture",
                      value: credentialPolicy.impersonation_sessions
                        ? credentialPolicy.impersonation_sessions.read_only
                          ? "Read-only"
                          : "Writable"
                        : "Not recorded",
                    },
                  ]}
                />
              </article>
            </div>
          </details>
        </article>
      ) : null}
    </div>
  );
}

export function SecurityAdminUsersSection({
  canViewAdminTabs,
  canMutateAdminPosture,
  users,
  instances,
  memberships,
  currentUserId,
  selectedUser,
  selectedUserId,
  createForm,
  editDraft,
  scopeDraft,
  selfPassword,
  selfPasswordPending,
  activeResetUserId,
  resetDraft,
  resetPending,
  createPending,
  updatePending,
  membershipsLoading,
  scopePending,
  removingMembershipInstanceId,
  onSelectUser,
  onCreateFormChange,
  onCreate,
  onEditDraftChange,
  onSaveUser,
  onFlagUserRotation,
  onScopeDraftChange,
  onSaveScope,
  onRemoveScope,
  onSelfPasswordChange,
  onRotateOwnPassword,
  onOpenResetForm,
  onCloseResetForm,
  onResetDraftChange,
  onResetPassword,
}: {
  canViewAdminTabs: boolean;
  canMutateAdminPosture: boolean;
  users: AdminUser[];
  instances: InstanceRecord[];
  memberships: AdminInstanceMembership[];
  currentUserId: string | null | undefined;
  selectedUser: AdminUser | null;
  selectedUserId: string | null;
  createForm: { username: string; display_name: string; role: AdminUser["role"]; password: string };
  editDraft: AdminUserEditDraft;
  scopeDraft: AdminUserScopeDraft;
  selfPassword: OwnPasswordRotationDraft;
  selfPasswordPending: boolean;
  activeResetUserId: string | null;
  resetDraft: AdminPasswordResetDraft;
  resetPending: boolean;
  createPending: boolean;
  updatePending: boolean;
  membershipsLoading: boolean;
  scopePending: boolean;
  removingMembershipInstanceId: string | null;
  onSelectUser: (userId: string) => void;
  onCreateFormChange: (field: "username" | "display_name" | "role" | "password", value: string) => void;
  onCreate: () => void;
  onEditDraftChange: (field: keyof AdminUserEditDraft, value: string) => void;
  onSaveUser: () => void;
  onFlagUserRotation: () => void;
  onScopeDraftChange: (field: keyof AdminUserScopeDraft, value: string) => void;
  onSaveScope: () => void;
  onRemoveScope: (instanceId: string) => void;
  onSelfPasswordChange: (field: keyof OwnPasswordRotationDraft, value: string) => void;
  onRotateOwnPassword: () => void;
  onOpenResetForm: (userId: string) => void;
  onCloseResetForm: () => void;
  onResetDraftChange: (field: keyof AdminPasswordResetDraft, value: string) => void;
  onResetPassword: (user: AdminUser) => void;
}) {
  if (!canViewAdminTabs) {
    return (
      <AccessBlockedCard
        title="Admin users"
        description="Only admin-role sessions can inspect or mutate the privileged user directory."
      />
    );
  }

  return (
    <div className="fg-stack">
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Privileged user directory</h3>
            <p className="fg-muted">
              Create, edit, and rotate admin identities as separate actions so role changes never get mixed with password handoffs.
            </p>
          </div>
          <span className="fg-pill" data-tone={canMutateAdminPosture ? "success" : "warning"}>
            {canMutateAdminPosture ? "Writable" : "Read only"}
          </span>
        </div>
        {users.length === 0 ? (
          <p className="fg-muted">No admin users recorded.</p>
        ) : (
          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Admin users">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Password</th>
                  <th>Last login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id} className={selectedUserId === user.user_id ? "is-selected" : undefined}>
                    <td>
                      <Button className="fg-table-trigger" onPress={() => onSelectUser(user.user_id)}>
                        {user.display_name}
                      </Button>
                      <div className="fg-muted">{user.username}</div>
                    </td>
                    <td>{user.role}</td>
                    <td>
                      <span className="fg-pill" data-tone={user.status === "active" ? "success" : "warning"}>{user.status}</span>
                      {user.user_id === currentUserId ? <span className="fg-pill">You</span> : null}
                    </td>
                    <td>
                      <span className="fg-pill" data-tone={user.must_rotate_password ? "warning" : "success"}>
                        {user.must_rotate_password ? "Rotation required" : "Rotated"}
                      </span>
                    </td>
                    <td>{user.last_login_at ? formatTimestamp(user.last_login_at) : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {canMutateAdminPosture ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create admin user</h3>
              <p className="fg-muted">Initial password handoff is separate from later edits and later rotation evidence.</p>
            </div>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label className="fg-stack">
              <span className="fg-muted">Username</span>
              <input value={createForm.username} onChange={(event) => onCreateFormChange("username", event.target.value)} />
            </label>
            <label className="fg-stack">
              <span className="fg-muted">Display name</span>
              <input value={createForm.display_name} onChange={(event) => onCreateFormChange("display_name", event.target.value)} />
            </label>
            <label className="fg-stack">
              <span className="fg-muted">Role</span>
              <select value={createForm.role} onChange={(event) => onCreateFormChange("role", event.target.value)}>
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="operator">operator</option>
                <option value="viewer">viewer</option>
              </select>
            </label>
            <label className="fg-stack">
              <span className="fg-muted">Initial password</span>
              <input
                autoComplete="new-password"
                type="password"
                value={createForm.password}
                onChange={(event) => onCreateFormChange("password", event.target.value)}
              />
            </label>
          </div>
          <div className="fg-actions fg-mt-sm">
            <Button isDisabled={createPending} onPress={onCreate}>Create user</Button>
          </div>
        </article>
      ) : null}

      {selectedUser ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit selected user</h3>
              <p className="fg-muted">
                Role, display name, and account status mutate the selected identity only. Password changes stay on the separate rotation action.
              </p>
            </div>
            <div className="fg-actions">
              <span className="fg-pill">{selectedUser.username}</span>
              <span className="fg-pill" data-tone={selectedUser.must_rotate_password ? "warning" : "success"}>
                {selectedUser.must_rotate_password ? "Rotation required" : "Rotation clear"}
              </span>
            </div>
          </div>
          {canMutateAdminPosture ? (
            <>
              <div className="fg-grid fg-grid-compact">
                <label className="fg-stack">
                  <span className="fg-muted">Display name</span>
                  <input
                    value={editDraft.display_name}
                    onChange={(event) => onEditDraftChange("display_name", event.target.value)}
                  />
                </label>
                <label className="fg-stack">
                  <span className="fg-muted">Role</span>
                  <select value={editDraft.role} onChange={(event) => onEditDraftChange("role", event.target.value)}>
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="operator">operator</option>
                    <option value="viewer">viewer</option>
                  </select>
                </label>
                <label className="fg-stack">
                  <span className="fg-muted">Status</span>
                  <select value={editDraft.status} onChange={(event) => onEditDraftChange("status", event.target.value)}>
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>
              </div>
              <div className="fg-actions fg-mt-sm">
                <Button isDisabled={updatePending} onPress={onSaveUser}>Save profile changes</Button>
                {!selectedUser.must_rotate_password ? (
                  <Button isDisabled={updatePending} onPress={onFlagUserRotation}>
                    Require password rotation
                  </Button>
                ) : null}
                <Button isDisabled={resetPending} onPress={() => onOpenResetForm(selectedUser.user_id)}>
                  Prepare password reset
                </Button>
              </div>
              {activeResetUserId === selectedUser.user_id ? (
                <AdminPasswordResetForm
                  busy={resetPending}
                  draft={resetDraft}
                  user={selectedUser}
                  onCancel={onCloseResetForm}
                  onChange={onResetDraftChange}
                  onSubmit={() => onResetPassword(selectedUser)}
                />
              ) : null}
            </>
          ) : (
            <p className="fg-muted">This session can inspect the selected user, but only a write-capable admin session can change it.</p>
          )}
        </article>
      ) : null}

      {selectedUser ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Roles & scopes</h3>
              <p className="fg-muted">
                Global role and per-instance memberships stay explicit. Scoped memberships drive where this user can actually operate.
              </p>
            </div>
            <div className="fg-actions">
              <span className="fg-pill">{selectedUser.role}</span>
              <span className="fg-pill">{memberships.length} scopes</span>
            </div>
          </div>

          {membershipsLoading ? (
            <p className="fg-muted">Loading scoped memberships.</p>
          ) : memberships.length === 0 ? (
            <p className="fg-muted">No instance-scoped memberships are recorded for this user.</p>
          ) : (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Admin user scoped memberships">
                <thead>
                  <tr>
                    <th>Instance</th>
                    <th>Tenant</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((membership) => {
                    const instance = instances.find((item) => item.instance_id === membership.instance_id) ?? null;
                    return (
                      <tr key={membership.membership_id}>
                        <td>
                          {instance?.display_name ?? membership.instance_id}
                          <div className="fg-muted">{membership.instance_id}</div>
                        </td>
                        <td>{membership.tenant_id}</td>
                        <td>{membership.role}</td>
                        <td>
                          <span className="fg-pill" data-tone={membership.status === "active" ? "success" : "warning"}>
                            {membership.status}
                          </span>
                        </td>
                        <td>
                          {canMutateAdminPosture ? (
                            <Button
                              isDisabled={removingMembershipInstanceId === membership.instance_id}
                              onPress={() => onRemoveScope(membership.instance_id)}
                            >
                              Remove scope
                            </Button>
                          ) : (
                            <span className="fg-muted">No action</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {canMutateAdminPosture ? (
            <>
              <div className="fg-grid fg-grid-compact fg-mt-sm">
                <label className="fg-stack">
                  <span className="fg-muted">Instance scope</span>
                  <select value={scopeDraft.instance_id} onChange={(event) => onScopeDraftChange("instance_id", event.target.value)}>
                    {instances.map((instance) => (
                      <option key={instance.instance_id} value={instance.instance_id}>
                        {instance.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fg-stack">
                  <span className="fg-muted">Scoped role</span>
                  <select value={scopeDraft.role} onChange={(event) => onScopeDraftChange("role", event.target.value)}>
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="operator">operator</option>
                    <option value="viewer">viewer</option>
                  </select>
                </label>
                <label className="fg-stack">
                  <span className="fg-muted">Scoped status</span>
                  <select value={scopeDraft.status} onChange={(event) => onScopeDraftChange("status", event.target.value)}>
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>
              </div>
              <div className="fg-actions fg-mt-sm">
                <Button isDisabled={scopePending || instances.length === 0} onPress={onSaveScope}>
                  Save scope mapping
                </Button>
              </div>
            </>
          ) : (
            <p className="fg-muted fg-mt-sm">A write-capable admin session is required to upsert or remove scoped memberships.</p>
          )}
        </article>
      ) : null}

      {canMutateAdminPosture ? (
        <OwnPasswordRotationForm
          busy={selfPasswordPending}
          description="Rotate the current admin password without leaving the active browser session."
          draft={selfPassword}
          note="Own-password rotation clears the forced-rotation flag and preserves accountability for the acting session."
          submitLabel="Rotate own password"
          title="Rotate own password"
          onChange={onSelfPasswordChange}
          onSubmit={onRotateOwnPassword}
        />
      ) : null}
    </div>
  );
}

export function SecuritySessionsSection({
  canViewAdminTabs,
  canMutateAdminPosture,
  sessions,
  currentSessionId,
  revokePendingSessionId,
  onRevokeSession,
}: {
  canViewAdminTabs: boolean;
  canMutateAdminPosture: boolean;
  sessions: AdminSecuritySession[];
  currentSessionId: string | null | undefined;
  revokePendingSessionId: string | null;
  onRevokeSession: (sessionId: string) => void;
}) {
  if (!canViewAdminTabs) {
    return (
      <AccessBlockedCard
        title="Sessions"
        description="Only admin-role sessions can review global admin session inventory and revoke other sessions."
      />
    );
  }

  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Admin sessions</h3>
          <p className="fg-muted">
            Distinguish active, expired, revoked, and elevated sessions. Mark the current browser session so revocation is deliberate.
          </p>
        </div>
        <span className="fg-pill" data-tone={sessions.some((item) => item.active) ? "warning" : "success"}>
          {sessions.filter((item) => item.active).length} active
        </span>
      </div>
      {sessions.length === 0 ? (
        <p className="fg-muted">No admin sessions recorded.</p>
      ) : (
        <div className="fg-table-wrap">
          <table className="fg-table" aria-label="Admin sessions">
            <thead>
              <tr>
                <th>Session</th>
                <th>User</th>
                <th>Type</th>
                <th>Status</th>
                <th>Last used</th>
                <th>Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((adminSession) => {
                const status = adminSessionStatus(adminSession);
                const isCurrent = adminSession.session_id === currentSessionId;
                return (
                  <tr key={adminSession.session_id}>
                    <td>
                      <code>{adminSession.session_id}</code>
                      <div className="fg-muted">
                        {adminSession.approval_reference ? `approval ${adminSession.approval_reference}` : "standard login"}
                      </div>
                    </td>
                    <td>
                      {adminSession.display_name} ({adminSession.username})
                      <div className="fg-muted">{adminSession.role}</div>
                    </td>
                    <td>
                      <span className="fg-pill" data-tone={adminSession.session_type === "break_glass" ? "danger" : adminSession.session_type === "impersonation" ? "warning" : "neutral"}>
                        {adminSession.session_type}
                      </span>
                      {isCurrent ? <span className="fg-pill">This browser</span> : null}
                    </td>
                    <td><span className="fg-pill" data-tone={status.tone}>{status.label}</span></td>
                    <td>{formatTimestamp(adminSession.last_used_at)}</td>
                    <td>{formatTimestamp(adminSession.expires_at)}</td>
                    <td>
                      {canMutateAdminPosture && adminSession.active ? (
                        <Button
                          isDisabled={revokePendingSessionId === adminSession.session_id}
                          onPress={() => onRevokeSession(adminSession.session_id)}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <span className="fg-muted">No action</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function SecurityElevatedAccessSection({
  requests,
  sessions,
  sessionUserId,
  canRequestBreakGlass,
  canRequestImpersonation,
  canDecideElevatedAccess,
  canStartElevated,
  credentialPolicy,
  approverPosture,
  accessDraft,
  accessPending,
  impersonationTargets,
  cancellingRequestId,
  issuingRequestId,
  decisionPendingRequestId,
  decisionDrafts,
  onElevatedRequestTypeChange,
  onElevatedAccessDraftChange,
  onSubmitElevatedAccessRequest,
  onDecisionDraftChange,
  onApproveRequest,
  onRejectRequest,
  onCancelElevatedAccessRequest,
  onIssueElevatedAccess,
}: {
  requests: ElevatedAccessRequest[];
  sessions: AdminSecuritySession[];
  sessionUserId: string | null | undefined;
  canRequestBreakGlass: boolean;
  canRequestImpersonation: boolean;
  canDecideElevatedAccess: boolean;
  canStartElevated: boolean;
  credentialPolicy: SecurityCredentialPolicy | null;
  approverPosture: ElevatedAccessApproverPosture | null;
  accessDraft: ElevatedAccessRequestDraft;
  accessPending: boolean;
  impersonationTargets: AdminUser[];
  cancellingRequestId: string | null;
  issuingRequestId: string | null;
  decisionPendingRequestId: string | null;
  decisionDrafts: Record<string, string>;
  onElevatedRequestTypeChange: (value: ElevatedAccessRequestDraft["request_type"]) => void;
  onElevatedAccessDraftChange: (field: keyof ElevatedAccessRequestDraft, value: string) => void;
  onSubmitElevatedAccessRequest: () => void;
  onDecisionDraftChange: (requestId: string, value: string) => void;
  onApproveRequest: (request: ElevatedAccessRequest) => void;
  onRejectRequest: (request: ElevatedAccessRequest) => void;
  onCancelElevatedAccessRequest: (request: ElevatedAccessRequest) => void;
  onIssueElevatedAccess: (request: ElevatedAccessRequest) => void;
}) {
  const openRequests = requests.filter((item) => item.gate_status === "open");
  const readyRequests = requests.filter((item) => item.ready_to_issue);
  const activeRequests = requests.filter((item) => item.session_status === "active");
  const closedRequests = requests.filter((item) =>
    item.gate_status === "rejected"
    || item.gate_status === "cancelled"
    || item.gate_status === "timed_out"
    || item.session_status === "expired"
    || item.session_status === "revoked",
  );
  const breakGlassMaxMinutes = credentialPolicy?.break_glass_sessions?.max_ttl_minutes ?? 60;
  const impersonationMaxMinutes = credentialPolicy?.impersonation_sessions?.max_ttl_minutes ?? 30;

  return (
    <div className="fg-stack">
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Exception lifecycle</h3>
            <p className="fg-muted">
              Request, approval, session start, and expiry/cancellation stay separate, visible states.
            </p>
          </div>
          {approverPosture ? (
            <span className="fg-pill" data-tone={approverPosture.state === "recovery_required" ? "danger" : "success"}>
              {approverPosture.label}
            </span>
          ) : null}
        </div>
        <div className="fg-card-grid">
          <article className="fg-kpi">
            <span className="fg-muted">Requested</span>
            <strong className="fg-kpi-value">{openRequests.length}</strong>
          </article>
          <article className="fg-kpi">
            <span className="fg-muted">Approved</span>
            <strong className="fg-kpi-value">{readyRequests.length}</strong>
          </article>
          <article className="fg-kpi">
            <span className="fg-muted">Active</span>
            <strong className="fg-kpi-value">{activeRequests.length}</strong>
          </article>
          <article className="fg-kpi">
            <span className="fg-muted">Ended</span>
            <strong className="fg-kpi-value">{closedRequests.length}</strong>
          </article>
        </div>
      </article>

      {canRequestBreakGlass ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Request elevated access</h3>
              <p className="fg-muted">
                Start with a request. The requester must later claim the approved session from the same Security surface.
              </p>
            </div>
            <span className="fg-pill" data-tone={accessDraft.request_type === "impersonation" ? "warning" : "danger"}>
              {accessDraft.request_type === "impersonation" ? "Impersonation" : "Break-glass"}
            </span>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label className="fg-stack">
              <span className="fg-muted">Request type</span>
              <select
                value={accessDraft.request_type}
                onChange={(event) => onElevatedRequestTypeChange(event.target.value as ElevatedAccessRequestDraft["request_type"])}
              >
                <option value="break_glass">Break-glass</option>
                {canRequestImpersonation ? <option value="impersonation">Impersonation</option> : null}
              </select>
            </label>
            {accessDraft.request_type === "impersonation" ? (
              <label className="fg-stack">
                <span className="fg-muted">Target user</span>
                <select
                  value={accessDraft.target_user_id}
                  onChange={(event) => onElevatedAccessDraftChange("target_user_id", event.target.value)}
                >
                  <option value="">Select a target</option>
                  {impersonationTargets.map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.display_name} ({user.username}) · {user.role}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="fg-stack">
              <span className="fg-muted">Approval reference</span>
              <input
                placeholder="INC-1245"
                value={accessDraft.approval_reference}
                onChange={(event) => onElevatedAccessDraftChange("approval_reference", event.target.value)}
              />
            </label>
            <label className="fg-stack">
              <span className="fg-muted">Duration (minutes)</span>
              <input
                max={accessDraft.request_type === "impersonation" ? impersonationMaxMinutes : breakGlassMaxMinutes}
                min={1}
                type="number"
                value={accessDraft.duration_minutes}
                onChange={(event) => onElevatedAccessDraftChange("duration_minutes", event.target.value)}
              />
            </label>
            <label className="fg-stack">
              <span className="fg-muted">Notification targets</span>
              <input
                placeholder="incident-channel, oncall@example.com"
                value={accessDraft.notification_targets}
                onChange={(event) => onElevatedAccessDraftChange("notification_targets", event.target.value)}
              />
            </label>
          </div>
          <label className="fg-stack fg-mt-sm">
            <span className="fg-muted">Justification</span>
            <textarea
              placeholder="Describe why elevated access is required and what outcome you need."
              rows={4}
              value={accessDraft.justification}
              onChange={(event) => onElevatedAccessDraftChange("justification", event.target.value)}
            />
          </label>
          {approverPosture?.state === "recovery_required" ? (
            <p className="fg-danger fg-mt-sm">
              ForgeFrame will not open elevated access until a second admin approver is restored.
            </p>
          ) : null}
          <div className="fg-actions fg-mt-sm">
            <Button
              isDisabled={
                accessPending
                || approverPosture?.state === "recovery_required"
                || (accessDraft.request_type === "impersonation" && impersonationTargets.length === 0)
              }
              onPress={onSubmitElevatedAccessRequest}
            >
              {accessDraft.request_type === "impersonation" ? "Request impersonation" : "Request break-glass access"}
            </Button>
          </div>
        </article>
      ) : (
        <article className="fg-card">
          <h3>Read-only exception review</h3>
          <p className="fg-muted">
            This session can inspect the exception lifecycle, but a write-capable operator or admin session is required to request or start elevated access.
          </p>
        </article>
      )}

      {canDecideElevatedAccess ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Approval queue</h3>
              <p className="fg-muted">
                Distinct admins decide open elevated-access requests here instead of forcing reviewers back into a generic mixed queue.
              </p>
            </div>
            <span className="fg-pill" data-tone={openRequests.length > 0 ? "warning" : "success"}>
              {openRequests.length} open
            </span>
          </div>
          {openRequests.length === 0 ? (
            <p className="fg-muted">No open elevated-access approvals are waiting for decision.</p>
          ) : (
            <div className="fg-stack">
              {openRequests.map((request) => {
                const note = decisionDrafts[request.request_id] ?? "";
                const canSelfApprove = request.requested_by_user_id !== sessionUserId;
                return (
                  <article key={`review-${request.request_id}`} className="fg-subcard">
                    <div className="fg-panel-heading">
                      <div>
                        <h4>{formatApprovalType(request.request_type)} approval</h4>
                        <p className="fg-muted">
                          {formatRequestActor(request.requested_by_display_name, request.requested_by_username, request.requested_by_user_id)}
                          {" -> "}
                          {formatRequestTarget(request)}
                        </p>
                      </div>
                      <div className="fg-actions">
                        <span className="fg-pill" data-tone={approvalTone(request.gate_status)}>
                          {formatApprovalStatus(request.gate_status)}
                        </span>
                        <span className="fg-pill">{formatTimestamp(request.approval_expires_at)}</span>
                      </div>
                    </div>
                    <p>{request.justification}</p>
                    <label className="fg-stack fg-mt-sm">
                      <span className="fg-muted">Decision note</span>
                      <textarea
                        placeholder="Explain why this exception is approved or rejected."
                        rows={3}
                        value={note}
                        onChange={(event) => onDecisionDraftChange(request.request_id, event.target.value)}
                      />
                    </label>
                    <div className="fg-actions fg-mt-sm">
                      <Button
                        isDisabled={!canSelfApprove || note.trim().length < 8 || decisionPendingRequestId === request.request_id}
                        onPress={() => onApproveRequest(request)}
                      >
                        Approve
                      </Button>
                      <Button
                        isDisabled={!canSelfApprove || note.trim().length < 8 || decisionPendingRequestId === request.request_id}
                        onPress={() => onRejectRequest(request)}
                      >
                        Reject
                      </Button>
                      {!canSelfApprove ? <span className="fg-muted">Requesters cannot approve their own exception.</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      ) : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Lifecycle status</h3>
            <p className="fg-muted">
              Each request keeps its own request, approval, start, and expiry trail with direct links to approvals and audit history.
            </p>
          </div>
        </div>
        {requests.length === 0 ? (
          <p className="fg-muted">No elevated-access requests recorded.</p>
        ) : (
          <div className="fg-stack">
            {requests.map((request) => {
              const linkedSession = request.issued_session_id
                ? sessions.find((item) => item.session_id === request.issued_session_id) ?? null
                : null;
              const banner = describeRequestBanner(request, linkedSession);
              const stage = requestStage(request);
              const isRequester = request.requested_by_user_id === sessionUserId;
              const canCancelRequest = request.gate_status === "open" && isRequester && canStartElevated;
              const canIssueRequest = request.ready_to_issue && isRequester && canStartElevated;
              return (
                <article key={request.request_id} className="fg-subcard">
                  <div className="fg-panel-heading">
                    <div>
                      <h4>{formatApprovalType(request.request_type)} request</h4>
                      <p className="fg-muted">
                        {formatRequestActor(request.requested_by_display_name, request.requested_by_username, request.requested_by_user_id)}
                      </p>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={stage.tone}>{stage.label}</span>
                      <span className="fg-pill" data-tone={approvalTone(request.gate_status)}>
                        {formatApprovalStatus(request.gate_status)}
                      </span>
                    </div>
                  </div>
                  <div className="fg-approval-banner" data-tone={banner.tone}>
                    <strong>{banner.title}</strong>
                    <p>{banner.body}</p>
                  </div>
                  <KeyValueList
                    items={[
                      { label: "Target", value: formatRequestTarget(request) },
                      { label: "Approval reference", value: request.approval_reference },
                      { label: "Requested", value: formatTimestamp(request.created_at) },
                      { label: "Approval expires", value: formatTimestamp(request.approval_expires_at) },
                      { label: "Duration", value: `${request.duration_minutes} minutes` },
                      {
                        label: "Decision",
                        value: request.decided_at
                          ? `${request.decided_by_username ?? request.decided_by_user_id ?? "Unknown"} · ${formatTimestamp(request.decided_at)}`
                          : "Pending approval",
                      },
                    ]}
                  />
                  <p className="fg-mt-sm">{request.justification}</p>
                  {request.decision_note ? <p className="fg-muted">Decision note: {request.decision_note}</p> : null}
                  <div className="fg-actions fg-mt-sm">
                    <Link className="fg-nav-link" to={buildApprovalDetailPath(request.approval_id)}>
                      Open approval detail
                    </Link>
                    <Link className="fg-nav-link" to={buildRequestAuditHistoryPath(request.request_id)}>
                      Open audit history
                    </Link>
                    {canCancelRequest ? (
                      <Button
                        isDisabled={cancellingRequestId === request.request_id}
                        onPress={() => onCancelElevatedAccessRequest(request)}
                      >
                        Cancel request
                      </Button>
                    ) : null}
                    {canIssueRequest ? (
                      <Button
                        isDisabled={issuingRequestId === request.request_id}
                        onPress={() => onIssueElevatedAccess(request)}
                      >
                        {request.request_type === "impersonation" ? "Start impersonation session" : "Start break-glass session"}
                      </Button>
                    ) : null}
                    {request.ready_to_issue && !isRequester ? <span className="fg-muted">Only the original requester can start this session.</span> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </article>
    </div>
  );
}

export function SecurityProviderSecretsSection({
  canViewAdminTabs,
  canMutateAdminPosture,
  secretPosture,
  harnessProfiles,
  recentRotations,
  secretStorageControls,
  rotationTargets,
  rotationDraft,
  rotationPending,
  onRotationDraftChange,
  onRecordRotation,
}: {
  canViewAdminTabs: boolean;
  canMutateAdminPosture: boolean;
  secretPosture: SecuritySecretPosture[];
  harnessProfiles: HarnessSecretPosture[];
  recentRotations: SecurityRotationEvent[];
  secretStorageControls: SecretStorageControl[];
  rotationTargets: RotationTargetOption[];
  rotationDraft: RotationDraft;
  rotationPending: boolean;
  onRotationDraftChange: (field: keyof RotationDraft, value: string) => void;
  onRecordRotation: () => void;
}) {
  if (!canViewAdminTabs) {
    return (
      <AccessBlockedCard
        title="Provider secrets"
        description="Credential references, rotation evidence, and storage controls stay reserved for admin-role sessions."
      />
    );
  }

  const providerMissing = secretPosture.filter((item) => item.state === "missing").length;
  const providerBlocked = secretPosture.filter((item) => item.state === "blocked").length;
  const providerRotatable = secretPosture.filter((item) => item.state === "rotatable").length;

  return (
    <div className="fg-stack">
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Provider secret controls</h3>
            <p className="fg-muted">
              ForgeFrame shows control state, rotation evidence, and credential references only. Secret values never appear here.
            </p>
          </div>
          <span className="fg-pill" data-tone={providerMissing > 0 || providerBlocked > 0 ? "danger" : "success"}>
            {providerMissing + providerBlocked} require action
          </span>
        </div>
        <div className="fg-card-grid">
          <article className="fg-kpi">
            <span className="fg-muted">Missing</span>
            <strong className="fg-kpi-value">{providerMissing}</strong>
          </article>
          <article className="fg-kpi">
            <span className="fg-muted">Blocked</span>
            <strong className="fg-kpi-value">{providerBlocked}</strong>
          </article>
          <article className="fg-kpi">
            <span className="fg-muted">Rotatable</span>
            <strong className="fg-kpi-value">{providerRotatable}</strong>
          </article>
          <article className="fg-kpi">
            <span className="fg-muted">Harness profiles</span>
            <strong className="fg-kpi-value">{harnessProfiles.length}</strong>
          </article>
        </div>
      </article>

      <article className="fg-card">
        <h3>Provider posture</h3>
        {secretPosture.length === 0 ? (
          <p className="fg-muted">No provider secret posture recorded.</p>
        ) : (
          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Provider secret posture">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>State</th>
                  <th>Auth mode</th>
                  <th>Rotation support</th>
                  <th>Last rotation</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {secretPosture.map((provider) => (
                  <tr key={provider.provider}>
                    <td>
                      {provider.provider}
                      <div className="fg-muted">{provider.state_reason}</div>
                    </td>
                    <td><span className="fg-pill" data-tone={secretStateTone(provider.state)}>{provider.state_label}</span></td>
                    <td>{provider.auth_mode}</td>
                    <td>{provider.rotation_support}</td>
                    <td>{provider.last_rotation_at ? formatTimestamp(provider.last_rotation_at) : "Never"}</td>
                    <td><code>{provider.credential_reference}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="fg-card">
        <h3>Harness secret posture</h3>
        {harnessProfiles.length === 0 ? (
          <p className="fg-muted">No harness-backed secret profiles recorded.</p>
        ) : (
          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Harness secret posture">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>State</th>
                  <th>Auth mode</th>
                  <th>Config revision</th>
                  <th>Last rotation</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {harnessProfiles.map((profile) => (
                  <tr key={profile.provider_key}>
                    <td>
                      {profile.label}
                      <div className="fg-muted">{profile.provider_key}</div>
                    </td>
                    <td><span className="fg-pill" data-tone={secretStateTone(profile.state)}>{profile.state_label}</span></td>
                    <td>{profile.auth_mode}</td>
                    <td>{profile.config_revision}</td>
                    <td>{profile.last_rotation_at ? formatTimestamp(profile.last_rotation_at) : "Never"}</td>
                    <td><code>{profile.credential_reference}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {canMutateAdminPosture ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Record rotation evidence</h3>
              <p className="fg-muted">
                Recording rotation evidence updates blocker posture without ever collecting or echoing the rotated secret value.
              </p>
            </div>
          </div>
          {rotationTargets.length === 0 ? (
            <p className="fg-muted">No provider or harness control is available for rotation evidence recording.</p>
          ) : (
            <>
              <div className="fg-grid fg-grid-compact">
                <label className="fg-stack">
                  <span className="fg-muted">Control</span>
                  <select
                    value={`${rotationDraft.target_type}:${rotationDraft.target_id}`}
                    onChange={(event) => {
                      const [targetType, targetId] = event.target.value.split(":");
                      onRotationDraftChange("target_type", targetType);
                      onRotationDraftChange("target_id", targetId);
                    }}
                  >
                    {rotationTargets.map((target) => (
                      <option key={`${target.target_type}:${target.target_id}`} value={`${target.target_type}:${target.target_id}`}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fg-stack">
                  <span className="fg-muted">Rotation kind</span>
                  <input value={rotationDraft.kind} onChange={(event) => onRotationDraftChange("kind", event.target.value)} />
                </label>
                <label className="fg-stack">
                  <span className="fg-muted">Reference</span>
                  <input
                    placeholder="INC-202 / vault-change-ticket"
                    value={rotationDraft.reference}
                    onChange={(event) => onRotationDraftChange("reference", event.target.value)}
                  />
                </label>
              </div>
              <label className="fg-stack fg-mt-sm">
                <span className="fg-muted">Notes</span>
                <textarea rows={3} value={rotationDraft.notes} onChange={(event) => onRotationDraftChange("notes", event.target.value)} />
              </label>
              <div className="fg-actions fg-mt-sm">
                <Button isDisabled={rotationPending} onPress={onRecordRotation}>Record rotation evidence</Button>
              </div>
            </>
          )}
        </article>
      ) : null}

      <article className="fg-card">
        <h3>Recent rotation events</h3>
        {recentRotations.length === 0 ? (
          <p className="fg-muted">No rotation events recorded.</p>
        ) : (
          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Recent secret rotation events">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Target</th>
                  <th>Kind</th>
                  <th>Reference</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {recentRotations.map((event) => (
                  <tr key={event.event_id}>
                    <td>{formatTimestamp(event.recorded_at)}</td>
                    <td>{event.target_type}:{event.target_id}</td>
                    <td>{event.kind}</td>
                    <td>{event.reference ?? "Not recorded"}</td>
                    <td>{event.history_source ?? "Not recorded"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="fg-card">
        <h3>Storage controls</h3>
        <div className="fg-card-grid">
          {secretStorageControls.map((control) => (
            <article key={control.credential_class} className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>{control.credential_class}</h4>
                  <p className="fg-muted">{control.storage}</p>
                </div>
                <span className="fg-pill" data-tone={control.plaintext_persisted ? "warning" : "success"}>
                  {control.plaintext_persisted ? "Plaintext persists" : "Plaintext blocked"}
                </span>
              </div>
              <p>{control.notes}</p>
            </article>
          ))}
        </div>
      </article>
    </div>
  );
}

export function SecurityCredentialPolicySection({
  credentialPolicy,
}: {
  credentialPolicy: SecurityCredentialPolicy | null;
}) {
  if (!credentialPolicy) {
    return (
      <article className="fg-card">
        <h3>Credential policy</h3>
        <p className="fg-muted">Credential lifecycle policy is loading.</p>
      </article>
    );
  }

  return (
    <div className="fg-stack">
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Human sessions</h3>
            <p className="fg-muted">Session TTL and rotation triggers define how long privileged browsers can stay active.</p>
          </div>
        </div>
        <KeyValueList
          items={[
            { label: "TTL", value: `${credentialPolicy.human_sessions?.ttl_hours ?? "Not recorded"} hours` },
            { label: "Rotation trigger", value: String(credentialPolicy.human_sessions?.rotation_trigger ?? "Not recorded") },
            {
              label: "Session types",
              value: Array.isArray(credentialPolicy.human_sessions?.session_types)
                ? credentialPolicy.human_sessions?.session_types.join(", ")
                : "Not recorded",
            },
          ]}
        />
      </article>

      <article className="fg-card">
        <h3>Elevated access approvals</h3>
        <KeyValueList
          items={[
            {
              label: "Approval TTL",
              value: credentialPolicy.elevated_access_requests
                ? `${credentialPolicy.elevated_access_requests.approval_ttl_minutes} minutes`
                : "Not recorded",
            },
            {
              label: "Requester must claim session",
              value: credentialPolicy.elevated_access_requests?.requester_claim_required ? "Yes" : "No",
            },
            {
              label: "Self-approval allowed",
              value: credentialPolicy.elevated_access_requests?.self_approval_allowed ? "Yes" : "No",
            },
            {
              label: "Approver posture",
              value: credentialPolicy.elevated_access_requests?.approver_availability?.label ?? "Not recorded",
            },
          ]}
        />
      </article>

      <article className="fg-card">
        <h3>Exception session policies</h3>
        <KeyValueList
          items={[
            {
              label: "Impersonation max TTL",
              value: credentialPolicy.impersonation_sessions
                ? `${credentialPolicy.impersonation_sessions.max_ttl_minutes} minutes`
                : "Not recorded",
            },
            {
              label: "Impersonation read-only",
              value: credentialPolicy.impersonation_sessions?.read_only ? "Yes" : "No",
            },
            {
              label: "Break-glass max TTL",
              value: credentialPolicy.break_glass_sessions
                ? `${credentialPolicy.break_glass_sessions.max_ttl_minutes} minutes`
                : "Not recorded",
            },
            {
              label: "Break-glass eligible roles",
              value: credentialPolicy.break_glass_sessions?.eligible_roles.join(", ") ?? "Not recorded",
            },
          ]}
        />
      </article>

      <article className="fg-card">
        <h3>Service account key policy</h3>
        <KeyValueList
          items={[
            { label: "TTL", value: `${credentialPolicy.service_account_keys?.ttl_days ?? "Not recorded"} days` },
            {
              label: "Rotation warning",
              value: `${credentialPolicy.service_account_keys?.rotation_warning_days ?? "Not recorded"} days`,
            },
            {
              label: "Revocation modes",
              value: Array.isArray(credentialPolicy.service_account_keys?.revocation_modes)
                ? credentialPolicy.service_account_keys?.revocation_modes.join(", ")
                : "Not recorded",
            },
            { label: "Hashing", value: String(credentialPolicy.service_account_keys?.hashing ?? "Not recorded") },
          ]}
        />
      </article>
    </div>
  );
}
