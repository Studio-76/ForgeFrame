import { Link } from "react-router-dom";

import type {
  AdminSecuritySession,
  AdminUser,
  ElevatedAccessApproverPosture,
  ElevatedAccessRequest,
  SecurityCredentialPolicy,
} from "../../api/admin";
import { revokeAdminSession } from "../../api/admin";
import {
  formatApprovalStatus,
  formatApprovalType,
  formatSessionStatus,
  formatTimestamp,
} from "../approvals/presentation";
import {
  AdminPasswordResetForm,
  type AdminPasswordResetDraft,
} from "./AdminPasswordResetForm";
import type { ElevatedAccessRequestDraft } from "./elevatedAccess";
import { OwnPasswordRotationForm, type OwnPasswordRotationDraft } from "./OwnPasswordRotationForm";
import {
  approvalTone,
  buildApprovalDetailPath,
  buildRequestAuditHistoryPath,
  describeRequestBanner,
  formatRequestActor,
  formatRequestTarget,
  type Tone,
} from "./helpers";

type SecurityOverviewSectionProps = {
  openRequestCount: number;
  readyToStartCount: number;
  activeRequestCount: number;
  approverPosture: ElevatedAccessApproverPosture | null;
  policyTone: Tone;
  policyBadge: string;
  credentialPolicy: SecurityCredentialPolicy | null;
  breakGlassMaxMinutes: number;
  impersonationMaxMinutes: number;
  canRequestBreakGlass: boolean;
  accessDraft: ElevatedAccessRequestDraft;
  canRequestImpersonation: boolean;
  impersonationTargets: AdminUser[];
  recoveryRequired: boolean;
  accessPending: boolean;
  submittedRequest: ElevatedAccessRequest | null;
  onElevatedRequestTypeChange: (value: ElevatedAccessRequestDraft["request_type"]) => void;
  onElevatedAccessDraftChange: (field: keyof ElevatedAccessRequestDraft, value: string) => void;
  onSubmitElevatedAccessRequest: () => void;
};

export function SecurityOverviewSection({
  openRequestCount,
  readyToStartCount,
  activeRequestCount,
  approverPosture,
  policyTone,
  policyBadge,
  credentialPolicy,
  breakGlassMaxMinutes,
  impersonationMaxMinutes,
  canRequestBreakGlass,
  accessDraft,
  canRequestImpersonation,
  impersonationTargets,
  recoveryRequired,
  accessPending,
  submittedRequest,
  onElevatedRequestTypeChange,
  onElevatedAccessDraftChange,
  onSubmitElevatedAccessRequest,
}: SecurityOverviewSectionProps) {
  return (
    <>
      <div className="fg-card-grid">
        <article className="fg-kpi">
          <span className="fg-muted">Pending approvals</span>
          <strong className="fg-kpi-value">{openRequestCount}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Ready to start</span>
          <strong className="fg-kpi-value">{readyToStartCount}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Active elevated sessions</span>
          <strong className="fg-kpi-value">{activeRequestCount}</strong>
        </article>
        <article className="fg-kpi">
          <span className="fg-muted">Eligible approvers</span>
          <strong className="fg-kpi-value">{approverPosture?.eligible_admin_approver_count ?? 0}</strong>
        </article>
      </div>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Elevated Access Policy</h3>
            <p className="fg-muted">
              Request approval first, then let the original requester start the resulting session from this Security surface.
            </p>
          </div>
          <div className="fg-actions">
            <span className="fg-pill" data-tone={policyTone}>
              {policyBadge}
            </span>
            <span className="fg-pill">Distinct admin approval required</span>
          </div>
        </div>

        {approverPosture ? (
          <div className="fg-approval-banner" data-tone={policyTone}>
            <strong>{approverPosture.label}</strong>
            <p>{approverPosture.primary_message}</p>
            <p>{approverPosture.secondary_message}</p>
          </div>
        ) : (
          <p className="fg-muted">Loading the current approval posture and policy limits…</p>
        )}

        <div className="fg-card-grid">
          <article className="fg-subcard">
            <span className="fg-section-label">Approval request TTL</span>
            <p>{credentialPolicy?.elevated_access_requests?.approval_ttl_minutes ?? "Not recorded"} minutes</p>
          </article>
          <article className="fg-subcard">
            <span className="fg-section-label">Break-glass limit</span>
            <p>{breakGlassMaxMinutes} minutes</p>
          </article>
          <article className="fg-subcard">
            <span className="fg-section-label">Impersonation limit</span>
            <p>{impersonationMaxMinutes} minutes</p>
          </article>
          <article className="fg-subcard">
            <span className="fg-section-label">Session consequences</span>
            <p>
              Break-glass stays write-capable. Impersonation is{" "}
              {credentialPolicy?.impersonation_sessions?.read_only ? "read-only" : "not recorded"}.
            </p>
          </article>
        </div>
      </article>

      {canRequestBreakGlass ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Request elevated access</h3>
              <p className="fg-muted">
                Request first. Approval and a live elevated session are separate states, and only the original requester can start the session later.
              </p>
            </div>
            <span className="fg-pill" data-tone={recoveryRequired ? "warning" : "success"}>
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
                placeholder="15"
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

          {accessDraft.request_type === "impersonation" && impersonationTargets.length === 0 ? (
            <p className="fg-danger fg-mt-sm">
              No eligible impersonation targets are available. Add or restore another user before submitting this request.
            </p>
          ) : null}

          {!canRequestImpersonation ? (
            <p className="fg-muted fg-mt-sm">
              This session can request break-glass only. Impersonation requests require a standard admin session.
            </p>
          ) : null}

          {recoveryRequired ? (
            <p className="fg-muted fg-mt-sm">
              ForgeFrame will not create a pending approval item or issue elevated access while no eligible second admin approver exists.
            </p>
          ) : (
            <p className="fg-muted fg-mt-sm">
              Approval request submitted. No elevated session is active until this request is approved.
            </p>
          )}

          <div className="fg-actions fg-mt-sm">
            <button
              disabled={accessPending || recoveryRequired || (accessDraft.request_type === "impersonation" && impersonationTargets.length === 0)}
              type="button"
              onClick={() => void onSubmitElevatedAccessRequest()}
            >
              {accessDraft.request_type === "impersonation" ? "Request impersonation" : "Request break-glass access"}
            </button>
          </div>
        </article>
      ) : (
        <article className="fg-card">
          <h3>Read-only elevated-access review</h3>
          <p className="fg-muted">
            This session can inspect policy posture and request history, but a standard admin or operator session is required to submit or start elevated access.
          </p>
        </article>
      )}

      {submittedRequest ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Pending approval confirmation</h3>
              <p className="fg-muted">
                Security keeps approval review and live session start separate. Use the request-scoped links below instead of searching the queue or audit history manually.
              </p>
            </div>
            <span className="fg-pill" data-tone="warning">
              {formatApprovalStatus(submittedRequest.gate_status)}
            </span>
          </div>
          <div className="fg-approval-banner" data-tone="warning">
            <strong>Approval request submitted</strong>
            <p>Approval request submitted. No elevated session is active until this request is approved.</p>
            <p>
              Request ID <code>{submittedRequest.request_id}</code> routes to approval <code>{submittedRequest.approval_id}</code>.
            </p>
          </div>
          <div className="fg-actions fg-mt-sm">
            <Link className="fg-nav-link" to={buildApprovalDetailPath(submittedRequest.approval_id)}>
              Open approval detail
            </Link>
            <Link className="fg-nav-link" to={buildRequestAuditHistoryPath(submittedRequest.request_id)}>
              Open audit history
            </Link>
          </div>
        </article>
      ) : null}
    </>
  );
}

type SecurityRequestHistoryCardProps = {
  requests: ElevatedAccessRequest[];
  sessions: AdminSecuritySession[];
  sessionByRequestId: Map<string, AdminSecuritySession>;
  sessionUserId: string | null | undefined;
  canManageAdminPosture: boolean;
  canStartElevated: boolean;
  cancellingRequestId: string | null;
  issuingRequestId: string | null;
  onCancelElevatedAccessRequest: (request: ElevatedAccessRequest) => void;
  onIssueElevatedAccess: (request: ElevatedAccessRequest) => void;
};

export function SecurityRequestHistoryCard({
  requests,
  sessions,
  sessionByRequestId,
  sessionUserId,
  canManageAdminPosture,
  canStartElevated,
  cancellingRequestId,
  issuingRequestId,
  onCancelElevatedAccessRequest,
  onIssueElevatedAccess,
}: SecurityRequestHistoryCardProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Request history</h3>
          <p className="fg-muted">
            {canManageAdminPosture
              ? "Admins see all elevated-access requests so approval state and live session posture stay visible in one place."
              : "Operators see only their own elevated-access requests so start and follow-up work stays grounded in the active requester context."}
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="fg-muted">
          No elevated-access requests yet. Submit a request from Security to create the first pending approval.
        </p>
      ) : (
        <div className="fg-stack">
          {requests.map((request) => {
            const linkedSession = request.issued_session_id
              ? sessions.find((item) => item.session_id === request.issued_session_id) ?? sessionByRequestId.get(request.request_id) ?? null
              : sessionByRequestId.get(request.request_id) ?? null;
            const banner = describeRequestBanner(request, linkedSession);
            const sessionLabel = formatSessionStatus(request.session_status, request.ready_to_issue);
            const isRequester = request.requested_by_user_id === sessionUserId;
            const canCancelRequest = request.gate_status === "open" && isRequester && canStartElevated;
            const canIssueRequest = request.ready_to_issue && isRequester && canStartElevated;
            const approvalDetailPath = buildApprovalDetailPath(request.approval_id);
            const auditHistoryPath = buildRequestAuditHistoryPath(request.request_id);

            return (
              <article key={request.request_id} className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{formatApprovalType(request.request_type)} request</h4>
                    <p className="fg-muted">
                      Request ID <code>{request.request_id}</code>
                    </p>
                  </div>
                  <div className="fg-actions">
                    <span className="fg-pill" data-tone={approvalTone(request.gate_status)}>
                      {formatApprovalStatus(request.gate_status)}
                    </span>
                    {sessionLabel ? <span className="fg-pill">{sessionLabel}</span> : null}
                  </div>
                </div>

                <div className="fg-approval-banner" data-tone={banner.tone}>
                  <strong>{banner.title}</strong>
                  <p>{banner.body}</p>
                </div>

                <div className="fg-card-grid">
                  <article className="fg-subcard">
                    <span className="fg-section-label">Requester</span>
                    <p>{formatRequestActor(request.requested_by_display_name, request.requested_by_username, request.requested_by_user_id)}</p>
                  </article>
                  <article className="fg-subcard">
                    <span className="fg-section-label">Target</span>
                    <p>{formatRequestTarget(request)}</p>
                  </article>
                  <article className="fg-subcard">
                    <span className="fg-section-label">Approval reference</span>
                    <p>{request.approval_reference}</p>
                  </article>
                  <article className="fg-subcard">
                    <span className="fg-section-label">Opened</span>
                    <p>{formatTimestamp(request.created_at)}</p>
                  </article>
                  <article className="fg-subcard">
                    <span className="fg-section-label">Approval window</span>
                    <p>{formatTimestamp(request.approval_expires_at)}</p>
                  </article>
                  <article className="fg-subcard">
                    <span className="fg-section-label">Duration</span>
                    <p>{request.duration_minutes} minutes</p>
                  </article>
                  <article className="fg-subcard">
                    <span className="fg-section-label">Decision</span>
                    <p>
                      {request.decided_at
                        ? `${request.decided_by_username ?? request.decided_by_user_id ?? "Unknown"} · ${formatTimestamp(request.decided_at)}`
                        : "Pending approval"}
                    </p>
                  </article>
                  <article className="fg-subcard">
                    <span className="fg-section-label">Notifications</span>
                    <p>{request.notification_targets.length > 0 ? request.notification_targets.join(", ") : "None recorded"}</p>
                  </article>
                  {linkedSession ? (
                    <article className="fg-subcard">
                      <span className="fg-section-label">Linked session</span>
                      <p>
                        {linkedSession.session_type}
                        {linkedSession.expires_at ? ` · expires ${formatTimestamp(linkedSession.expires_at)}` : ""}
                      </p>
                    </article>
                  ) : null}
                </div>

                <p className="fg-mt-sm">{request.justification}</p>
                {request.decision_note ? <p className="fg-muted">Decision note: {request.decision_note}</p> : null}

                <div className="fg-actions fg-mt-sm">
                  <Link className="fg-nav-link" to={approvalDetailPath}>
                    Open approval detail
                  </Link>
                  <Link className="fg-nav-link" to={auditHistoryPath}>
                    Open audit history
                  </Link>
                  {canCancelRequest ? (
                    <button
                      disabled={cancellingRequestId === request.request_id}
                      type="button"
                      onClick={() => void onCancelElevatedAccessRequest(request)}
                    >
                      Cancel request
                    </button>
                  ) : null}
                  {canIssueRequest ? (
                    <button
                      disabled={issuingRequestId === request.request_id}
                      type="button"
                      onClick={() => void onIssueElevatedAccess(request)}
                    >
                      {request.request_type === "impersonation" ? "Start impersonation session" : "Start break-glass session"}
                    </button>
                  ) : null}
                  {request.ready_to_issue && !isRequester ? (
                    <p className="fg-muted">Only the original requester can start this session.</p>
                  ) : null}
                  {request.ready_to_issue && isRequester && !canStartElevated ? (
                    <p className="fg-muted">Open a standard admin or operator session to start this access.</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </article>
  );
}

type SecurityAdminPostureSectionProps = {
  canManageAdminPosture: boolean;
  bootstrap: Record<string, string | number | boolean> | null;
  canMutateAdminPosture: boolean;
  createForm: { username: string; display_name: string; role: string; password: string };
  selfPasswordPending: boolean;
  selfPassword: OwnPasswordRotationDraft;
  users: AdminUser[];
  activeResetUserId: string | null;
  resetPending: boolean;
  resetDraft: AdminPasswordResetDraft;
  sessions: AdminSecuritySession[];
  secretPosture: Array<Record<string, string | number | boolean>>;
  onCreateFormChange: (field: "username" | "display_name" | "role" | "password", value: string) => void;
  onCreate: () => void;
  onSelfPasswordChange: (field: keyof OwnPasswordRotationDraft, value: string) => void;
  onRotateOwnPassword: () => void;
  onOpenResetForm: (userId: string) => void;
  onCloseResetForm: () => void;
  onResetDraftChange: (field: keyof AdminPasswordResetDraft, value: string) => void;
  onResetPassword: (user: AdminUser) => void;
  onRevokeSession: (sessionId: string) => void;
};

export function SecurityAdminPostureSection({
  canManageAdminPosture,
  bootstrap,
  canMutateAdminPosture,
  createForm,
  selfPasswordPending,
  selfPassword,
  users,
  activeResetUserId,
  resetPending,
  resetDraft,
  sessions,
  secretPosture,
  onCreateFormChange,
  onCreate,
  onSelfPasswordChange,
  onRotateOwnPassword,
  onOpenResetForm,
  onCloseResetForm,
  onResetDraftChange,
  onResetPassword,
  onRevokeSession,
}: SecurityAdminPostureSectionProps) {
  if (!canManageAdminPosture) {
    return null;
  }

  return (
    <>
      {bootstrap ? (
        <article className="fg-card">
          <h3>Bootstrap Security Status</h3>
          <ul className="fg-list">
            {Object.entries(bootstrap).map(([key, value]) => (
              <li key={key}>
                {key}: {String(value)}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {canMutateAdminPosture ? (
        <>
          <article className="fg-card">
            <h3>Create Admin User</h3>
            <div className="fg-grid fg-grid-compact">
              <input
                placeholder="username"
                value={createForm.username}
                onChange={(event) => onCreateFormChange("username", event.target.value)}
              />
              <input
                placeholder="display name"
                value={createForm.display_name}
                onChange={(event) => onCreateFormChange("display_name", event.target.value)}
              />
              <select
                value={createForm.role}
                onChange={(event) => onCreateFormChange("role", event.target.value)}
              >
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="operator">operator</option>
                <option value="viewer">viewer</option>
              </select>
              <input
                type="password"
                placeholder="initial password"
                value={createForm.password}
                onChange={(event) => onCreateFormChange("password", event.target.value)}
              />
              <button type="button" onClick={() => void onCreate()}>
                Create User
              </button>
            </div>
          </article>

          <OwnPasswordRotationForm
            busy={selfPasswordPending}
            description="Replace the current admin password without leaving the active session."
            draft={selfPassword}
            note="Self-rotation clears the forced-rotation flag and keeps the current session usable."
            submitLabel="Rotate Password"
            title="Rotate own password"
            onChange={onSelfPasswordChange}
            onSubmit={() => void onRotateOwnPassword()}
          />
        </>
      ) : (
        <article className="fg-card">
          <h3>Read-only admin posture</h3>
          <p className="fg-muted">
            Admin posture remains visible, but user, password, and session mutations stay hidden for read-only sessions.
          </p>
        </article>
      )}

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Admin Users</h3>
              <p className="fg-muted">
                Password resets require a temporary secret that the acting admin enters and confirms before handoff.
              </p>
            </div>
          </div>
          <div className="fg-stack">
            {users.map((user) => (
              <article key={user.user_id} className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{user.display_name}</h4>
                    <p className="fg-muted">
                      {user.username} · role={user.role} · status={user.status} · rotate={String(user.must_rotate_password)}
                    </p>
                  </div>
                  {canMutateAdminPosture ? (
                    <div className="fg-actions">
                      <button disabled={resetPending} type="button" onClick={() => onOpenResetForm(user.user_id)}>
                        {activeResetUserId === user.user_id ? "Reset form open" : "Prepare reset"}
                      </button>
                    </div>
                  ) : null}
                </div>
                {activeResetUserId === user.user_id ? (
                  <AdminPasswordResetForm
                    busy={resetPending}
                    draft={resetDraft}
                    user={user}
                    onCancel={onCloseResetForm}
                    onChange={onResetDraftChange}
                    onSubmit={() => void onResetPassword(user)}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <article className="fg-card">
          <h3>Active Sessions</h3>
          <ul className="fg-list">
            {sessions.map((adminSession) => (
              <li key={adminSession.session_id}>
                {adminSession.username} · role={adminSession.role} · type={adminSession.session_type} · active={String(adminSession.active)} · last_used={adminSession.last_used_at}
                {canMutateAdminPosture && adminSession.active ? (
                  <button
                    type="button"
                    style={{ marginLeft: "0.5rem" }}
                    onClick={() => void onRevokeSession(adminSession.session_id)}
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="fg-card">
        <h3>Provider Secret Posture</h3>
        <ul className="fg-list">
          {secretPosture.map((provider) => (
            <li key={String(provider.provider)}>
              {String(provider.provider)} · configured={String(provider.configured)} · auth={String(provider.auth_mode)} · rotation={String(provider.rotation_support)} · history={String(provider.history_count ?? 0)} · last={String(provider.last_rotation_at ?? "never")}
            </li>
          ))}
        </ul>
      </article>
    </>
  );
}
