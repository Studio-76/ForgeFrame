import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { buildAuditHistoryPath } from "../app/auditHistory";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import {
  AdminApiError,
  cancelElevatedAccessRequest,
  createAdminUser,
  createBreakGlassRequest,
  createImpersonationRequest,
  fetchAdminSessions,
  fetchAdminUsers,
  fetchElevatedAccessRequests,
  fetchSecurityBootstrap,
  issueElevatedAccessRequest,
  revokeAdminSession,
  rotateAdminPassword,
  rotateOwnPassword,
  setAdminToken,
  type AdminSecuritySession,
  type AdminUser,
  type ElevatedAccessApproverPosture,
  type ElevatedAccessRequest,
  type SecurityCredentialPolicy,
} from "../api/admin";
import { PageIntro } from "../components/PageIntro";
import {
  formatApprovalStatus,
  formatApprovalType,
  formatSessionStatus,
  formatTimestamp,
} from "../features/approvals/presentation";
import {
  AdminPasswordResetForm,
  buildAdminPasswordResetPayload,
  createEmptyAdminPasswordResetDraft,
  type AdminPasswordResetDraft,
} from "../features/security/AdminPasswordResetForm";
import {
  buildBreakGlassRequestPayload,
  buildImpersonationRequestPayload,
  createEmptyElevatedAccessRequestDraft,
  type ElevatedAccessRequestDraft,
} from "../features/security/elevatedAccess";
import {
  OwnPasswordRotationForm,
  buildOwnPasswordRotationPayload,
  createEmptyOwnPasswordRotationDraft,
  type OwnPasswordRotationDraft,
} from "../features/security/OwnPasswordRotationForm";

type Tone = "success" | "warning" | "danger" | "neutral";

type RequestBanner = {
  tone: Tone;
  title: string;
  body: string;
};

function buildApprovalDetailPath(approvalId: string): string {
  const searchParams = new URLSearchParams({
    status: "all",
    approvalId,
  });
  return `${CONTROL_PLANE_ROUTES.approvals}?${searchParams.toString()}`;
}

function buildRequestAuditHistoryPath(requestId: string): string {
  return buildAuditHistoryPath({
    window: "all",
    targetType: "elevated_access_request",
    targetId: requestId,
  });
}

function approvalTone(status: ElevatedAccessRequest["gate_status"]): Tone {
  switch (status) {
    case "approved":
      return "success";
    case "open":
    case "timed_out":
      return "warning";
    case "rejected":
      return "danger";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatRequestActor(
  displayName?: string | null,
  username?: string | null,
  fallbackId?: string | null,
): string {
  if (displayName && username) {
    return `${displayName} (${username})`;
  }
  return displayName ?? username ?? fallbackId ?? "Not recorded";
}

function formatRequestTarget(request: ElevatedAccessRequest): string {
  if (request.request_type === "break_glass") {
    return "Self";
  }
  return formatRequestActor(
    request.target_display_name,
    request.target_username,
    request.target_user_id,
  );
}

function describeRequestBanner(
  request: ElevatedAccessRequest,
  linkedSession: AdminSecuritySession | null,
): RequestBanner {
  if (request.session_status === "active") {
    return {
      tone: "success",
      title: "Elevated session active",
      body: linkedSession?.expires_at
        ? `Elevated session active until ${formatTimestamp(linkedSession.expires_at)}.`
        : "An elevated session is active for this request.",
    };
  }

  if (request.ready_to_issue) {
    return {
      tone: "success",
      title: "Access approved and ready to start",
      body: "Access approved. Start the elevated session to receive the temporary token.",
    };
  }

  if (request.session_status === "expired") {
    return {
      tone: "warning",
      title: "Elevated session expired",
      body: "Approval completed, but the elevated session has expired.",
    };
  }

  if (request.session_status === "revoked") {
    return {
      tone: "neutral",
      title: "Elevated session revoked",
      body: "Approval completed, but the elevated session was revoked.",
    };
  }

  switch (request.gate_status) {
    case "open":
      return {
        tone: "warning",
        title: "Approval request submitted",
        body: "Approval request submitted. No elevated session is active until this request is approved.",
      };
    case "approved":
      return {
        tone: "success",
        title: "Access approved",
        body: "The approval decision is recorded. Review whether the requester still needs to issue the session.",
      };
    case "rejected":
      return {
        tone: "danger",
        title: "Request rejected",
        body: "Request rejected. No elevated session was issued.",
      };
    case "timed_out":
      return {
        tone: "warning",
        title: "Request expired before approval",
        body: "Request expired before approval. Submit a new request if elevated access is still required.",
      };
    case "cancelled":
      return {
        tone: "neutral",
        title: "Request cancelled",
        body: "Request cancelled. No elevated session will be issued.",
      };
    default:
      return {
        tone: "neutral",
        title: "Request recorded",
        body: "Review the linked approval and session state for the latest status.",
      };
  }
}

function extractApproverPosture(error: unknown): ElevatedAccessApproverPosture | null {
  if (!(error instanceof AdminApiError) || !error.details || typeof error.details !== "object") {
    return null;
  }

  const details = error.details as Partial<ElevatedAccessApproverPosture>;
  if (
    typeof details.state !== "string"
    || typeof details.label !== "string"
    || typeof details.primary_message !== "string"
    || typeof details.secondary_message !== "string"
    || typeof details.approval_requires_distinct_admin !== "boolean"
    || typeof details.eligible_admin_approver_count !== "number"
  ) {
    return null;
  }

  return {
    state: details.state,
    label: details.label,
    primary_message: details.primary_message,
    secondary_message: details.secondary_message,
    approval_requires_distinct_admin: details.approval_requires_distinct_admin,
    eligible_admin_approver_count: details.eligible_admin_approver_count,
    blocked_reason: typeof details.blocked_reason === "string" ? details.blocked_reason : null,
  };
}

export function SecurityPage() {
  const [bootstrap, setBootstrap] = useState<Record<string, string | number | boolean> | null>(null);
  const [secretPosture, setSecretPosture] = useState<Array<Record<string, string | number | boolean>>>([]);
  const [credentialPolicy, setCredentialPolicy] = useState<SecurityCredentialPolicy | null>(null);
  const [approverPosture, setApproverPosture] = useState<ElevatedAccessApproverPosture | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<AdminSecuritySession[]>([]);
  const [requests, setRequests] = useState<ElevatedAccessRequest[]>([]);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState({ username: "", display_name: "", role: "operator", password: "" });
  const [accessDraft, setAccessDraft] = useState<ElevatedAccessRequestDraft>(createEmptyElevatedAccessRequestDraft);
  const [accessPending, setAccessPending] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [issuingRequestId, setIssuingRequestId] = useState<string | null>(null);
  const [selfPassword, setSelfPassword] = useState<OwnPasswordRotationDraft>(createEmptyOwnPasswordRotationDraft);
  const [selfPasswordPending, setSelfPasswordPending] = useState(false);
  const [activeResetUserId, setActiveResetUserId] = useState<string | null>(null);
  const [resetDraft, setResetDraft] = useState<AdminPasswordResetDraft>(createEmptyAdminPasswordResetDraft);
  const [resetPending, setResetPending] = useState(false);
  const { session, sessionReady, replaceSession } = useAppSession();

  const canReviewApprovals = sessionReady && (session?.role === "admin" || session?.role === "operator");
  const canViewSecurity = sessionReady && session !== null && session.role !== "viewer";
  const canManageAdminPosture = canViewSecurity && session?.role === "admin";
  const canMutateAdminPosture = canManageAdminPosture && !session?.read_only;
  const canRequestBreakGlass = canViewSecurity && !session?.read_only;
  const canRequestImpersonation = canManageAdminPosture && !session?.read_only;
  const canStartElevated = canViewSecurity && !session?.read_only;
  const recoveryRequired = approverPosture?.state === "recovery_required";
  const openRequestCount = requests.filter((item) => item.gate_status === "open").length;
  const readyToStartCount = requests.filter((item) => item.ready_to_issue).length;
  const activeRequestCount = requests.filter((item) => item.session_status === "active").length;
  const breakGlassMaxMinutes = credentialPolicy?.break_glass_sessions?.max_ttl_minutes ?? 60;
  const impersonationMaxMinutes = credentialPolicy?.impersonation_sessions?.max_ttl_minutes ?? 30;
  const impersonationTargets = users.filter(
    (user) => user.status === "active" && user.user_id !== session?.user_id,
  );

  const sessionByRequestId = new Map<string, AdminSecuritySession>();
  sessions.forEach((adminSession) => {
    if (adminSession.approval_request_id) {
      sessionByRequestId.set(adminSession.approval_request_id, adminSession);
    }
  });
  const submittedRequest = submittedRequestId
    ? requests.find((request) => request.request_id === submittedRequestId) ?? null
    : null;

  const load = async () => {
    try {
      const bootstrapPromise = fetchSecurityBootstrap();
      const requestsPromise = fetchElevatedAccessRequests();

      if (canManageAdminPosture) {
        const [bootstrapPayload, requestsPayload, usersPayload, sessionsPayload] = await Promise.all([
          bootstrapPromise,
          requestsPromise,
          fetchAdminUsers(),
          fetchAdminSessions(),
        ]);
        setUsers(usersPayload.users);
        setSessions(sessionsPayload.sessions);
        setBootstrap(bootstrapPayload.bootstrap ?? null);
        setSecretPosture(bootstrapPayload.secret_posture ?? []);
        setCredentialPolicy(bootstrapPayload.credential_policy);
        setApproverPosture(bootstrapPayload.elevated_access_approver_posture);
        setRequests(requestsPayload.requests);
      } else {
        const [bootstrapPayload, requestsPayload] = await Promise.all([bootstrapPromise, requestsPromise]);
        setUsers([]);
        setSessions([]);
        setBootstrap(null);
        setSecretPosture([]);
        setCredentialPolicy(bootstrapPayload.credential_policy);
        setApproverPosture(bootstrapPayload.elevated_access_approver_posture);
        setRequests(requestsPayload.requests);
      }

      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Security loading failed.");
    }
  };

  useEffect(() => {
    if (!canViewSecurity) {
      setUsers([]);
      setSessions([]);
      setRequests([]);
      setBootstrap(null);
      setSecretPosture([]);
      setCredentialPolicy(null);
      setApproverPosture(null);
      return;
    }
    void load();
  }, [canManageAdminPosture, canViewSecurity, session?.read_only, session?.role, session?.session_id]);

  useEffect(() => {
    if (canRequestImpersonation || accessDraft.request_type !== "impersonation") {
      return;
    }
    setAccessDraft((current) => ({ ...current, request_type: "break_glass", target_user_id: "" }));
  }, [accessDraft.request_type, canRequestImpersonation]);

  const clearFeedback = () => {
    setError("");
    setMessage("");
    setSubmittedRequestId(null);
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Governance"
          title="Security & Policies"
          description="Elevated-access requests, start flow, admin posture, session controls, and provider secret governance."
          question="Do you need request/start access controls or deeper admin posture once the current session is known?"
          links={[
            {
              label: "Security & Policies",
              to: CONTROL_PLANE_ROUTES.security,
              description: "Elevated-access request/start flow and admin-only posture modules live here.",
              disabled: true,
            },
            {
              label: "Accounts",
              to: CONTROL_PLANE_ROUTES.accounts,
              description: "Runtime identity posture while the security route access is still being checked.",
            },
            {
              label: "API Keys",
              to: CONTROL_PLANE_ROUTES.apiKeys,
              description: "Runtime key posture and issuance lifecycle review.",
            },
            {
              label: "Audit History",
              to: CONTROL_PLANE_ROUTES.auditHistory,
              description: "Cross-check governance evidence without opening mutable controls.",
            },
            {
              label: "Approvals",
              to: CONTROL_PLANE_ROUTES.approvals,
              description: "Shared approval review stays separate from requester-issued session start.",
              badge: "Checking access",
              disabled: true,
            },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="ForgeGate checks the current session role before opening elevated-access controls and any admin-only posture data."
        />
      </section>
    );
  }

  if (!canViewSecurity) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Governance"
          title="Security & Policies"
          description="This route is reserved for operators and admins who can request elevated access or inspect security posture."
          question="Which operator-safe governance route should you open instead?"
          links={[
            {
              label: "Accounts",
              to: CONTROL_PLANE_ROUTES.accounts,
              description: "Review runtime account posture without entering elevated-access or admin posture state.",
            },
            {
              label: "API Keys",
              to: CONTROL_PLANE_ROUTES.apiKeys,
              description: "Inspect runtime key posture and current access scope.",
            },
            {
              label: "Audit History",
              to: CONTROL_PLANE_ROUTES.auditHistory,
              description: "Pull shared governance evidence from the audit surface.",
            },
            {
              label: "Approvals",
              to: CONTROL_PLANE_ROUTES.approvals,
              description: "Use the shared approval surface when your role can review it.",
              badge: "Operator or admin",
              disabled: !canReviewApprovals,
            },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewers stay on audit and runtime-access routes. Elevated-access request/start flow and mutable security posture remain outside this permission envelope."
        />
      </section>
    );
  }

  const accessBadge = canMutateAdminPosture
    ? "Admin posture + requests"
    : canStartElevated
      ? "Elevated-access requester"
      : "Read only session";
  const accessTone: Tone = canMutateAdminPosture ? "success" : canStartElevated ? "success" : "warning";
  const policyTone: Tone = recoveryRequired ? "warning" : approverPosture ? "success" : "neutral";
  const policyBadge = approverPosture
    ? approverPosture.state === "approval_available"
      ? "Approval path available"
      : "Recovery required"
    : "Policy loading";
  const securityDescription = canManageAdminPosture
    ? "Elevated-access request/start flow, admin users, active sessions, bootstrap posture, and provider secret governance."
    : "Elevated-access request/start flow, your request history, and the approval posture behind security-sensitive access.";
  const securityQuestion = canManageAdminPosture
    ? "Are you requesting elevated access, starting an approved session, or reviewing admin-only posture?"
    : "Do you need break-glass access now, or are you checking whether an approved request is ready to start?";
  const securityNote = canManageAdminPosture
    ? "Security now carries the request-first elevated-access flow alongside admin-only posture modules. Approval state and live session state stay separate."
    : "Security shows your elevated-access workflow here, while bootstrap, admin user, session, and provider secret controls stay hidden until you hold an admin session.";

  const onCreate = async () => {
    try {
      clearFeedback();
      await createAdminUser(createForm);
      setCreateForm({ username: "", display_name: "", role: "operator", password: "" });
      setMessage("Admin user created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin user creation failed.");
    }
  };

  const onSelfPasswordChange = (field: keyof OwnPasswordRotationDraft, value: string) => {
    setSelfPassword((prev) => ({ ...prev, [field]: value }));
  };

  const onRotateOwnPassword = async () => {
    try {
      clearFeedback();
      setSelfPasswordPending(true);
      const payload = buildOwnPasswordRotationPayload(selfPassword);
      await rotateOwnPassword(payload);
      setSelfPassword(createEmptyOwnPasswordRotationDraft());
      setMessage("Own password rotated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Own password rotation failed.");
    } finally {
      setSelfPasswordPending(false);
    }
  };

  const openResetForm = (userId: string) => {
    clearFeedback();
    setActiveResetUserId(userId);
    setResetDraft(createEmptyAdminPasswordResetDraft());
  };

  const closeResetForm = () => {
    setActiveResetUserId(null);
    setResetDraft(createEmptyAdminPasswordResetDraft());
  };

  const onResetDraftChange = (field: keyof AdminPasswordResetDraft, value: string) => {
    setResetDraft((prev) => ({ ...prev, [field]: value }));
  };

  const onResetPassword = async (user: AdminUser) => {
    try {
      clearFeedback();
      setResetPending(true);
      const payload = buildAdminPasswordResetPayload(resetDraft);
      await rotateAdminPassword(user.user_id, payload);
      closeResetForm();
      setMessage(
        `Temporary password prepared for ${user.username}. Share it through a trusted channel; ForgeGate will require rotation on first login.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin password reset failed.");
    } finally {
      setResetPending(false);
    }
  };

  const onElevatedAccessDraftChange = (
    field: keyof ElevatedAccessRequestDraft,
    value: string,
  ) => {
    setAccessDraft((prev) => ({ ...prev, [field]: value }));
  };

  const onElevatedRequestTypeChange = (value: ElevatedAccessRequestDraft["request_type"]) => {
    setAccessDraft((prev) => ({
      ...prev,
      request_type: value,
      target_user_id: value === "impersonation" ? prev.target_user_id : "",
    }));
  };

  const onSubmitElevatedAccessRequest = async () => {
    try {
      clearFeedback();
      setAccessPending(true);
      const requestType = accessDraft.request_type;
      const response = requestType === "impersonation"
        ? await createImpersonationRequest(buildImpersonationRequestPayload(accessDraft, impersonationMaxMinutes))
        : await createBreakGlassRequest(buildBreakGlassRequestPayload(accessDraft, breakGlassMaxMinutes));

      setRequests((current) => [response.request, ...current.filter((item) => item.request_id !== response.request.request_id)]);
      setAccessDraft(createEmptyElevatedAccessRequestDraft({ request_type: requestType }));
      setSubmittedRequestId(response.request.request_id);
    } catch (err) {
      const nextApproverPosture = extractApproverPosture(err);
      if (nextApproverPosture) {
        setApproverPosture(nextApproverPosture);
      }
      setError(err instanceof Error ? err.message : "Elevated-access request failed.");
    } finally {
      setAccessPending(false);
    }
  };

  const onIssueElevatedAccess = async (request: ElevatedAccessRequest) => {
    try {
      clearFeedback();
      setIssuingRequestId(request.request_id);
      const response = await issueElevatedAccessRequest(request.request_id);
      setAdminToken(response.access_token);
      replaceSession(response.user);
      setRequests((current) =>
        current.map((item) => (item.request_id === response.request.request_id ? response.request : item)),
      );
      setMessage(
        `${formatApprovalType(response.request.request_type)} session started. ForgeGate switched this browser into the elevated session until ${formatTimestamp(response.expires_at)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Starting the elevated session failed.");
    } finally {
      setIssuingRequestId(null);
    }
  };

  const onCancelElevatedAccessRequest = async (request: ElevatedAccessRequest) => {
    try {
      clearFeedback();
      setCancellingRequestId(request.request_id);
      const response = await cancelElevatedAccessRequest(request.request_id);
      setRequests((current) =>
        current.map((item) => (item.request_id === response.request.request_id ? response.request : item)),
      );
      if (submittedRequestId === response.request.request_id) {
        setSubmittedRequestId(null);
      }
      setMessage(`${formatApprovalType(response.request.request_type)} request cancelled.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancelling the elevated-access request failed.");
    } finally {
      setCancellingRequestId(null);
    }
  };

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Governance"
        title="Security & Policies"
        description={securityDescription}
        question={securityQuestion}
        links={[
          {
            label: "Security & Policies",
            to: CONTROL_PLANE_ROUTES.security,
            description: canManageAdminPosture
              ? "Elevated-access workflow plus admin-only bootstrap, user, session, and secret posture."
              : "Request break-glass access, review request history, and start approved sessions.",
            badge: canManageAdminPosture ? "Admin posture" : "Request flow",
          },
          {
            label: "Accounts",
            to: CONTROL_PLANE_ROUTES.accounts,
            description: "Runtime identity review and downstream access inventory.",
          },
          {
            label: "API Keys",
            to: CONTROL_PLANE_ROUTES.apiKeys,
            description: "Runtime key posture and one-time secret lifecycle review.",
          },
          {
            label: "Audit History",
            to: CONTROL_PLANE_ROUTES.auditHistory,
            description: "Cross-check elevated-access events against the audit trail.",
          },
          {
            label: "Approvals",
            to: CONTROL_PLANE_ROUTES.approvals,
            description: "Shared approval review stays separate from requester-issued session start.",
            badge: session?.role === "admin" ? "Decision queue" : "Review only",
            disabled: !canReviewApprovals,
          },
        ]}
        badges={[
          { label: accessBadge, tone: accessTone },
          { label: policyBadge, tone: policyTone },
        ]}
        note={securityNote}
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

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
              Break-glass stays write-capable. Impersonation is
              {" "}
              {credentialPolicy?.impersonation_sessions?.read_only ? "read-only" : "not recorded"}
              .
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
              ForgeGate will not create a pending approval item or issue elevated access while no eligible second admin approver exists.
            </p>
          ) : (
            <p className="fg-muted fg-mt-sm">
              Approval request submitted. No elevated session is active until this request is approved.
            </p>
          )}

          <div className="fg-actions fg-mt-sm">
            <button
              disabled={
                accessPending
                || recoveryRequired
                || (accessDraft.request_type === "impersonation" && impersonationTargets.length === 0)
              }
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
              const isRequester = request.requested_by_user_id === session?.user_id;
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

      {canManageAdminPosture ? (
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
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
                  />
                  <input
                    placeholder="display name"
                    value={createForm.display_name}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, display_name: event.target.value }))}
                  />
                  <select
                    value={createForm.role}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value }))}
                  >
                    <option value="admin">admin</option>
                    <option value="operator">operator</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <input
                    type="password"
                    placeholder="initial password"
                    value={createForm.password}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
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
                          <button disabled={resetPending} type="button" onClick={() => openResetForm(user.user_id)}>
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
                        onCancel={closeResetForm}
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
                        onClick={() => void revokeAdminSession(adminSession.session_id).then(load)}
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
      ) : null}
    </section>
  );
}
