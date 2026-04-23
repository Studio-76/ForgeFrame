import { useEffect, useState } from "react";

import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import {
  sessionCanMutateScopedOrAnyInstance,
  sessionHasAnyInstancePermission,
} from "../../app/adminAccess";
import { useAppSession } from "../../app/session";
import {
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
} from "../../api/admin";
import { PageIntro } from "../../components/PageIntro";
import {
  formatApprovalStatus,
  formatApprovalType,
  formatSessionStatus,
  formatTimestamp,
} from "../approvals/presentation";
import {
  AdminPasswordResetForm,
  buildAdminPasswordResetPayload,
  createEmptyAdminPasswordResetDraft,
  type AdminPasswordResetDraft,
} from "./AdminPasswordResetForm";
import {
  buildBreakGlassRequestPayload,
  buildImpersonationRequestPayload,
  createEmptyElevatedAccessRequestDraft,
  type ElevatedAccessRequestDraft,
} from "./elevatedAccess";
import {
  OwnPasswordRotationForm,
  buildOwnPasswordRotationPayload,
  createEmptyOwnPasswordRotationDraft,
  type OwnPasswordRotationDraft,
} from "./OwnPasswordRotationForm";
import { extractApproverPosture, type Tone } from "./helpers";
import {
  SecurityAdminPostureSection,
  SecurityOverviewSection,
  SecurityRequestHistoryCard,
} from "./sections";

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
  const [createForm, setCreateForm] = useState<{ username: string; display_name: string; role: AdminUser["role"]; password: string }>({
    username: "",
    display_name: "",
    role: "operator",
    password: "",
  });
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

  const canReviewApprovals = sessionReady && sessionHasAnyInstancePermission(session, "approvals.read");
  const canViewSecurity = sessionReady && (
    sessionHasAnyInstancePermission(session, "security.read")
    || sessionHasAnyInstancePermission(session, "security.write")
  );
  const canManageAdminPosture = canViewSecurity && sessionHasAnyInstancePermission(session, "security.write");
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
  }, [canManageAdminPosture, canViewSecurity, session?.read_only, session?.session_id]);

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
          note="ForgeFrame checks the current session role before opening elevated-access controls and any admin-only posture data."
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
        `Temporary password prepared for ${user.username}. Share it through a trusted channel; ForgeFrame will require rotation on first login.`,
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
        `${formatApprovalType(response.request.request_type)} session started. ForgeFrame switched this browser into the elevated session until ${formatTimestamp(response.expires_at)}.`,
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
            badge: sessionCanMutateScopedOrAnyInstance(session, null, "approvals.decide") ? "Decision queue" : "Review only",
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

      <SecurityOverviewSection
        openRequestCount={openRequestCount}
        readyToStartCount={readyToStartCount}
        activeRequestCount={activeRequestCount}
        approverPosture={approverPosture}
        policyTone={policyTone}
        policyBadge={policyBadge}
        credentialPolicy={credentialPolicy}
        breakGlassMaxMinutes={breakGlassMaxMinutes}
        impersonationMaxMinutes={impersonationMaxMinutes}
        canRequestBreakGlass={canRequestBreakGlass}
        accessDraft={accessDraft}
        canRequestImpersonation={canRequestImpersonation}
        impersonationTargets={impersonationTargets}
        recoveryRequired={recoveryRequired}
        accessPending={accessPending}
        submittedRequest={submittedRequest}
        onElevatedRequestTypeChange={onElevatedRequestTypeChange}
        onElevatedAccessDraftChange={onElevatedAccessDraftChange}
        onSubmitElevatedAccessRequest={() => void onSubmitElevatedAccessRequest()}
      />

      <SecurityRequestHistoryCard
        requests={requests}
        sessions={sessions}
        sessionByRequestId={sessionByRequestId}
        sessionUserId={session?.user_id}
        canManageAdminPosture={canManageAdminPosture}
        canStartElevated={canStartElevated}
        cancellingRequestId={cancellingRequestId}
        issuingRequestId={issuingRequestId}
        onCancelElevatedAccessRequest={(request) => void onCancelElevatedAccessRequest(request)}
        onIssueElevatedAccess={(request) => void onIssueElevatedAccess(request)}
      />

      <SecurityAdminPostureSection
        canManageAdminPosture={canManageAdminPosture}
        bootstrap={bootstrap}
        canMutateAdminPosture={canMutateAdminPosture}
        createForm={createForm}
        selfPasswordPending={selfPasswordPending}
        selfPassword={selfPassword}
        users={users}
        activeResetUserId={activeResetUserId}
        resetPending={resetPending}
        resetDraft={resetDraft}
        sessions={sessions}
        secretPosture={secretPosture}
        onCreateFormChange={(field, value) => setCreateForm((prev) => ({ ...prev, [field]: value }))}
        onCreate={() => void onCreate()}
        onSelfPasswordChange={onSelfPasswordChange}
        onRotateOwnPassword={() => void onRotateOwnPassword()}
        onOpenResetForm={openResetForm}
        onCloseResetForm={closeResetForm}
        onResetDraftChange={onResetDraftChange}
        onResetPassword={(user) => void onResetPassword(user)}
        onRevokeSession={(sessionId) => void revokeAdminSession(sessionId).then(load)}
      />
    </section>
  );
}
