import { useEffect, useState } from "react";

import {
  roleAllows,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasAnyInstancePermission,
} from "../../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import {
  deleteAdminUserMembership,
  approveElevatedAccessRequest,
  cancelElevatedAccessRequest,
  createAdminUser,
  createBreakGlassRequest,
  createImpersonationRequest,
  fetchAdminUserMemberships,
  fetchAdminSessions,
  fetchAdminUsers,
  fetchElevatedAccessRequests,
  fetchInstances,
  fetchSecurityBootstrap,
  issueElevatedAccessRequest,
  recordSecretRotation,
  rejectElevatedAccessRequest,
  revokeAdminSession,
  rotateAdminPassword,
  rotateOwnPassword,
  setAdminToken,
  updateAdminUser,
  upsertAdminUserMembership,
  type AdminInstanceMembership,
  type AdminSecuritySession,
  type AdminUser,
  type ElevatedAccessApproverPosture,
  type ElevatedAccessRequest,
  type HarnessSecretPosture,
  type InstanceRecord,
  type SecretStorageControl,
  type SecurityBlocker,
  type SecurityBootstrapStatus,
  type SecurityCredentialPolicy,
  type SecurityRotationEvent,
  type SecuritySecretPosture,
} from "../../api/admin";
import { PageIntro } from "../../components/PageIntro";
import {
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
import { extractApproverPosture, type Tone } from "./helpers";
import {
  buildEmptyRotationDraft,
  buildEmptyScopeDraft,
  buildEmptyUserEditDraft,
  buildRotationTargetOptions,
  rotationKindForTarget,
} from "./pageState";
import {
  SecurityAdminUsersSection,
  SecurityBlockerStrip,
  SecurityCredentialPolicySection,
  SecurityElevatedAccessSection,
  SecurityPostureSection,
  SecurityProviderSecretsSection,
  SecuritySessionsSection,
  SecurityTabBar,
  type AdminUserEditDraft,
  type AdminUserScopeDraft,
  type RotationDraft,
  type RotationTargetOption,
  type SecurityTabId,
} from "./sections";
import {
  buildOwnPasswordRotationPayload,
  createEmptyOwnPasswordRotationDraft,
  type OwnPasswordRotationDraft,
} from "./OwnPasswordRotationForm";

export function SecurityPage() {
  const { session, sessionReady, replaceSession } = useAppSession();

  const [activeTab, setActiveTab] = useState<SecurityTabId>("posture");
  const [bootstrap, setBootstrap] = useState<SecurityBootstrapStatus | null>(null);
  const [securityBlockers, setSecurityBlockers] = useState<SecurityBlocker[]>([]);
  const [secretPosture, setSecretPosture] = useState<SecuritySecretPosture[]>([]);
  const [harnessProfiles, setHarnessProfiles] = useState<HarnessSecretPosture[]>([]);
  const [recentRotations, setRecentRotations] = useState<SecurityRotationEvent[]>([]);
  const [secretStorageControls, setSecretStorageControls] = useState<SecretStorageControl[]>([]);
  const [credentialPolicy, setCredentialPolicy] = useState<SecurityCredentialPolicy | null>(null);
  const [approverPosture, setApproverPosture] = useState<ElevatedAccessApproverPosture | null>(null);
  const [instances, setInstances] = useState<InstanceRecord[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [memberships, setMemberships] = useState<AdminInstanceMembership[]>([]);
  const [sessions, setSessions] = useState<AdminSecuritySession[]>([]);
  const [requests, setRequests] = useState<ElevatedAccessRequest[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{ username: string; display_name: string; role: AdminUser["role"]; password: string }>({
    username: "",
    display_name: "",
    role: "operator",
    password: "",
  });
  const [editDraft, setEditDraft] = useState<AdminUserEditDraft>(buildEmptyUserEditDraft());
  const [scopeDraft, setScopeDraft] = useState<AdminUserScopeDraft>(buildEmptyScopeDraft());
  const [selfPassword, setSelfPassword] = useState<OwnPasswordRotationDraft>(createEmptyOwnPasswordRotationDraft);
  const [activeResetUserId, setActiveResetUserId] = useState<string | null>(null);
  const [resetDraft, setResetDraft] = useState<AdminPasswordResetDraft>(createEmptyAdminPasswordResetDraft);
  const [accessDraft, setAccessDraft] = useState<ElevatedAccessRequestDraft>(createEmptyElevatedAccessRequestDraft);
  const [rotationTargets, setRotationTargets] = useState<RotationTargetOption[]>([]);
  const [rotationDraft, setRotationDraft] = useState<RotationDraft>(buildEmptyRotationDraft());
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, string>>({});
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [scopePending, setScopePending] = useState(false);
  const [removingMembershipInstanceId, setRemovingMembershipInstanceId] = useState<string | null>(null);
  const [selfPasswordPending, setSelfPasswordPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [accessPending, setAccessPending] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [issuingRequestId, setIssuingRequestId] = useState<string | null>(null);
  const [decisionPendingRequestId, setDecisionPendingRequestId] = useState<string | null>(null);
  const [revokePendingSessionId, setRevokePendingSessionId] = useState<string | null>(null);
  const [rotationPending, setRotationPending] = useState(false);

  const canReviewApprovals = sessionReady && sessionHasAnyInstancePermission(session, "approvals.read");
  const canViewSecurity = sessionReady && (
    sessionHasAnyInstancePermission(session, "security.read")
    || sessionHasAnyInstancePermission(session, "security.write")
  );
  const canViewAdminTabs = canViewSecurity && roleAllows(session?.role, "admin");
  const canMutateAdminPosture = canViewAdminTabs && session?.read_only !== true;
  const canRequestBreakGlass = canViewSecurity && session?.read_only !== true;
  const canRequestImpersonation = canViewAdminTabs && session?.read_only !== true;
  const canDecideElevatedAccess = canReviewApprovals && sessionCanMutateScopedOrAnyInstance(session, null, "approvals.decide");
  const canStartElevated = canViewSecurity && session?.read_only !== true;

  const selectedUser = users.find((item) => item.user_id === selectedUserId) ?? null;
  const impersonationTargets = users.filter(
    (user) => user.status === "active" && user.user_id !== session?.user_id,
  );

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const refreshRotationTargets = (
    nextSecretPosture: SecuritySecretPosture[],
    nextHarnessProfiles: HarnessSecretPosture[],
  ) => {
    const nextTargets = buildRotationTargetOptions(nextSecretPosture, nextHarnessProfiles);
    setRotationTargets(nextTargets);
    if (nextTargets.length === 0) {
      setRotationDraft(buildEmptyRotationDraft());
      return;
    }
    const currentKey = `${rotationDraft.target_type}:${rotationDraft.target_id}`;
    const nextSelection = nextTargets.find((item) => `${item.target_type}:${item.target_id}` === currentKey) ?? nextTargets[0];
    setRotationDraft((current) => ({
      ...current,
      target_type: nextSelection.target_type,
      target_id: nextSelection.target_id,
      kind: current.kind.trim() ? current.kind : nextSelection.recommended_kind,
    }));
  };

  const load = async () => {
    try {
      const bootstrapPromise = fetchSecurityBootstrap();
      const requestsPromise = fetchElevatedAccessRequests();

      if (canViewAdminTabs) {
        const [bootstrapPayload, requestsPayload, usersPayload, sessionsPayload, instancesPayload] = await Promise.all([
          bootstrapPromise,
          requestsPromise,
          fetchAdminUsers(),
          fetchAdminSessions(),
          fetchInstances(),
        ]);
        setBootstrap(bootstrapPayload.bootstrap ?? null);
        setSecurityBlockers(bootstrapPayload.security_blockers ?? []);
        setSecretPosture(bootstrapPayload.secret_posture ?? []);
        setHarnessProfiles(bootstrapPayload.harness_profiles ?? []);
        setRecentRotations(bootstrapPayload.recent_rotations ?? []);
        setSecretStorageControls(bootstrapPayload.secret_storage_controls ?? []);
        setCredentialPolicy(bootstrapPayload.credential_policy);
        setApproverPosture(bootstrapPayload.elevated_access_approver_posture);
        setRequests(requestsPayload.requests);
        setInstances(instancesPayload.instances);
        setUsers(usersPayload.users);
        setSessions(sessionsPayload.sessions);
        refreshRotationTargets(
          bootstrapPayload.secret_posture ?? [],
          bootstrapPayload.harness_profiles ?? [],
        );
        setSelectedUserId((current) =>
          usersPayload.users.some((item) => item.user_id === current)
            ? current
            : usersPayload.users[0]?.user_id ?? null,
        );
      } else {
        const [bootstrapPayload, requestsPayload] = await Promise.all([bootstrapPromise, requestsPromise]);
        setBootstrap(bootstrapPayload.bootstrap ?? null);
        setSecurityBlockers(bootstrapPayload.security_blockers ?? []);
        setSecretPosture([]);
        setHarnessProfiles([]);
        setRecentRotations([]);
        setSecretStorageControls([]);
        setCredentialPolicy(bootstrapPayload.credential_policy);
        setApproverPosture(bootstrapPayload.elevated_access_approver_posture);
        setInstances([]);
        setRequests(requestsPayload.requests);
        setUsers([]);
        setMemberships([]);
        setSessions([]);
        setSelectedUserId(null);
        setScopeDraft(buildEmptyScopeDraft());
        setRotationTargets([]);
        setRotationDraft(buildEmptyRotationDraft());
      }

      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Security loading failed.");
    }
  };

  useEffect(() => {
    if (!canViewSecurity) {
      setBootstrap(null);
      setSecurityBlockers([]);
      setSecretPosture([]);
      setHarnessProfiles([]);
      setRecentRotations([]);
      setSecretStorageControls([]);
      setCredentialPolicy(null);
      setApproverPosture(null);
      setInstances([]);
      setUsers([]);
      setMemberships([]);
      setSessions([]);
      setRequests([]);
      setSelectedUserId(null);
      setScopeDraft(buildEmptyScopeDraft());
      setRotationTargets([]);
      setRotationDraft(buildEmptyRotationDraft());
      return;
    }
    void load();
  }, [canViewSecurity, canViewAdminTabs, session?.read_only, session?.session_id]);

  useEffect(() => {
    if (accessDraft.request_type !== "impersonation" || canRequestImpersonation) {
      return;
    }
    setAccessDraft((current) => ({ ...current, request_type: "break_glass", target_user_id: "" }));
  }, [accessDraft.request_type, canRequestImpersonation]);

  useEffect(() => {
    if (!users.length) {
      if (selectedUserId !== null) {
        setSelectedUserId(null);
      }
      setEditDraft(buildEmptyUserEditDraft());
      return;
    }
    if (!selectedUser) {
      setSelectedUserId(users[0].user_id);
    }
  }, [users, selectedUser, selectedUserId]);

  useEffect(() => {
    if (!selectedUser) {
      return;
    }
    setEditDraft((current) => {
      if (
        current.display_name === selectedUser.display_name
        && current.role === selectedUser.role
        && current.status === selectedUser.status
      ) {
        return current;
      }
      return {
        display_name: selectedUser.display_name,
        role: selectedUser.role,
        status: selectedUser.status,
      };
    });
  }, [selectedUser?.user_id, selectedUser?.display_name, selectedUser?.role, selectedUser?.status]);

  useEffect(() => {
    if (!canViewAdminTabs || !selectedUserId) {
      setMemberships([]);
      setMembershipsLoading(false);
      return;
    }

    let cancelled = false;
    setMembershipsLoading(true);
    void fetchAdminUserMemberships(selectedUserId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setMemberships(payload.memberships);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setMemberships([]);
        setError(err instanceof Error ? err.message : "Loading scoped memberships failed.");
      })
      .finally(() => {
        if (!cancelled) {
          setMembershipsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canViewAdminTabs, selectedUserId, users]);

  useEffect(() => {
    if (!selectedUser) {
      setScopeDraft(buildEmptyScopeDraft());
      return;
    }
    const selectedMembership = memberships.find((item) => item.instance_id === scopeDraft.instance_id)
      ?? memberships[0]
      ?? null;
    const defaultInstanceId = selectedMembership?.instance_id ?? instances[0]?.instance_id ?? "";
    const nextRole = selectedMembership?.role ?? selectedUser.role;
    const nextStatus = selectedMembership?.status ?? selectedUser.status;
    setScopeDraft((current) => {
      if (
        current.instance_id === defaultInstanceId
        && current.role === nextRole
        && current.status === nextStatus
      ) {
        return current;
      }
      return {
        instance_id: defaultInstanceId,
        role: nextRole,
        status: nextStatus,
      };
    });
  }, [instances, memberships, selectedUser?.user_id, selectedUser?.role, selectedUser?.status]);

  const accessBadge = canMutateAdminPosture
    ? "Admin security control"
    : canViewAdminTabs
      ? "Admin read-only"
      : canViewSecurity
        ? "Operator exception view"
        : "Restricted";
  const accessTone: Tone = canMutateAdminPosture ? "success" : canViewSecurity ? "warning" : "neutral";
  const policyTone: Tone = approverPosture?.state === "recovery_required" ? "danger" : approverPosture ? "success" : "neutral";
  const securityDescription = canViewAdminTabs
    ? "Security posture, privileged identities, live admin sessions, elevated-access exceptions, provider secret controls, and credential policy."
    : "Exception requests, approval readiness, and the credential policy behind privileged access.";
  const securityQuestion = canViewAdminTabs
    ? "Are you evaluating posture, controlling identities, managing active sessions, or handling a live elevated-access exception?"
    : "Are you requesting elevated access now, or checking whether an approved exception is ready to start?";
  const securityNote = canViewAdminTabs
    ? "Provider secret values never render here. Break-glass and impersonation remain visible as explicit, time-bounded exception states."
    : "Admin-only tabs stay visible but honestly blocked. Elevated-access request and start flow remain usable from this route.";

  const onCreate = async () => {
    try {
      clearFeedback();
      setCreatePending(true);
      await createAdminUser(createForm);
      setCreateForm({ username: "", display_name: "", role: "operator", password: "" });
      setMessage("Admin user created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin user creation failed.");
    } finally {
      setCreatePending(false);
    }
  };

  const onSaveUser = async () => {
    if (!selectedUser) {
      setError("Select a user before saving edits.");
      return;
    }
    const payload: {
      display_name?: string;
      role?: string;
      status?: string;
    } = {};
    if (editDraft.display_name.trim() !== selectedUser.display_name) {
      payload.display_name = editDraft.display_name.trim();
    }
    if (editDraft.role !== selectedUser.role) {
      payload.role = editDraft.role;
    }
    if (editDraft.status !== selectedUser.status) {
      payload.status = editDraft.status;
    }
    if (Object.keys(payload).length === 0) {
      setMessage(`No profile changes pending for ${selectedUser.username}.`);
      setError("");
      return;
    }
    try {
      clearFeedback();
      setUpdatePending(true);
      await updateAdminUser(selectedUser.user_id, payload);
      setMessage(`Updated ${selectedUser.username}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin user update failed.");
    } finally {
      setUpdatePending(false);
    }
  };

  const onFlagUserRotation = async () => {
    if (!selectedUser) {
      setError("Select a user before flagging password rotation.");
      return;
    }
    try {
      clearFeedback();
      setUpdatePending(true);
      await updateAdminUser(selectedUser.user_id, { must_rotate_password: true });
      setMessage(`Password rotation required for ${selectedUser.username}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Requiring password rotation failed.");
    } finally {
      setUpdatePending(false);
    }
  };

  const onScopeDraftChange = (field: keyof AdminUserScopeDraft, value: string) => {
    setScopeDraft((current) => ({
      ...current,
      [field]: field === "role"
        ? value as AdminUserScopeDraft["role"]
        : field === "status"
          ? value as AdminUserScopeDraft["status"]
          : value,
    }));
  };

  const onSaveScope = async () => {
    if (!selectedUser) {
      setError("Select a user before saving a scoped membership.");
      return;
    }
    if (!scopeDraft.instance_id) {
      setError("Select an instance before saving a scoped membership.");
      return;
    }
    try {
      clearFeedback();
      setScopePending(true);
      await upsertAdminUserMembership(selectedUser.user_id, scopeDraft.instance_id, {
        role: scopeDraft.role,
        status: scopeDraft.status,
      });
      setMessage(`Scoped membership saved for ${selectedUser.username}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving the scoped membership failed.");
    } finally {
      setScopePending(false);
    }
  };

  const onRemoveScope = async (instanceId: string) => {
    if (!selectedUser) {
      setError("Select a user before removing a scoped membership.");
      return;
    }
    try {
      clearFeedback();
      setRemovingMembershipInstanceId(instanceId);
      await deleteAdminUserMembership(selectedUser.user_id, instanceId);
      setMessage(`Scoped membership removed for ${selectedUser.username}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Removing the scoped membership failed.");
    } finally {
      setRemovingMembershipInstanceId(null);
    }
  };

  const onSelfPasswordChange = (field: keyof OwnPasswordRotationDraft, value: string) => {
    setSelfPassword((current) => ({ ...current, [field]: value }));
  };

  const onRotateOwnPassword = async () => {
    try {
      clearFeedback();
      setSelfPasswordPending(true);
      const payload = buildOwnPasswordRotationPayload(selfPassword);
      await rotateOwnPassword(payload);
      setSelfPassword(createEmptyOwnPasswordRotationDraft());
      setMessage("Own password rotated.");
      await load();
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
    setResetDraft((current) => ({ ...current, [field]: value }));
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

  const onElevatedAccessDraftChange = (field: keyof ElevatedAccessRequestDraft, value: string) => {
    setAccessDraft((current) => ({ ...current, [field]: value }));
  };

  const onElevatedRequestTypeChange = (value: ElevatedAccessRequestDraft["request_type"]) => {
    setAccessDraft((current) => ({
      ...current,
      request_type: value,
      target_user_id: value === "impersonation" ? current.target_user_id : "",
    }));
  };

  const onSubmitElevatedAccessRequest = async () => {
    try {
      clearFeedback();
      setAccessPending(true);
      const requestType = accessDraft.request_type;
      const response = requestType === "impersonation"
        ? await createImpersonationRequest(buildImpersonationRequestPayload(accessDraft, credentialPolicy?.impersonation_sessions?.max_ttl_minutes ?? 30))
        : await createBreakGlassRequest(buildBreakGlassRequestPayload(accessDraft, credentialPolicy?.break_glass_sessions?.max_ttl_minutes ?? 60));
      setRequests((current) => [response.request, ...current.filter((item) => item.request_id !== response.request.request_id)]);
      setAccessDraft(createEmptyElevatedAccessRequestDraft({ request_type: requestType }));
      setSubmittedRequestId(response.request.request_id);
      setMessage(`${requestType === "impersonation" ? "Impersonation" : "Break-glass"} request submitted.`);
      await load();
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

  const onDecisionDraftChange = (requestId: string, value: string) => {
    setDecisionDrafts((current) => ({ ...current, [requestId]: value }));
  };

  const replaceRequest = (nextRequest: ElevatedAccessRequest) => {
    setRequests((current) => current.map((item) => (item.request_id === nextRequest.request_id ? nextRequest : item)));
  };

  const onApproveRequest = async (request: ElevatedAccessRequest) => {
    const note = (decisionDrafts[request.request_id] ?? "").trim();
    if (note.length < 8) {
      setError("Decision note must be at least 8 characters.");
      return;
    }
    try {
      clearFeedback();
      setDecisionPendingRequestId(request.request_id);
      const response = await approveElevatedAccessRequest(request.request_id, note);
      replaceRequest(response.request);
      setDecisionDrafts((current) => ({ ...current, [request.request_id]: "" }));
      setMessage(`${request.request_type === "impersonation" ? "Impersonation" : "Break-glass"} request approved.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approving the elevated-access request failed.");
    } finally {
      setDecisionPendingRequestId(null);
    }
  };

  const onRejectRequest = async (request: ElevatedAccessRequest) => {
    const note = (decisionDrafts[request.request_id] ?? "").trim();
    if (note.length < 8) {
      setError("Decision note must be at least 8 characters.");
      return;
    }
    try {
      clearFeedback();
      setDecisionPendingRequestId(request.request_id);
      const response = await rejectElevatedAccessRequest(request.request_id, note);
      replaceRequest(response.request);
      setDecisionDrafts((current) => ({ ...current, [request.request_id]: "" }));
      setMessage(`${request.request_type === "impersonation" ? "Impersonation" : "Break-glass"} request rejected.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejecting the elevated-access request failed.");
    } finally {
      setDecisionPendingRequestId(null);
    }
  };

  const onIssueElevatedAccess = async (request: ElevatedAccessRequest) => {
    try {
      clearFeedback();
      setIssuingRequestId(request.request_id);
      const response = await issueElevatedAccessRequest(request.request_id);
      setAdminToken(response.access_token);
      replaceSession(response.user);
      replaceRequest(response.request);
      setMessage(
        `${request.request_type === "impersonation" ? "Impersonation" : "Break-glass"} session started. This browser is now running the elevated session until ${response.expires_at}.`,
      );
      await load();
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
      replaceRequest(response.request);
      if (submittedRequestId === response.request.request_id) {
        setSubmittedRequestId(null);
      }
      setMessage(`${request.request_type === "impersonation" ? "Impersonation" : "Break-glass"} request cancelled.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancelling the elevated-access request failed.");
    } finally {
      setCancellingRequestId(null);
    }
  };

  const onRevokeSession = async (sessionId: string) => {
    try {
      clearFeedback();
      setRevokePendingSessionId(sessionId);
      await revokeAdminSession(sessionId);
      setMessage(`Session ${sessionId} revoked.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoking the admin session failed.");
    } finally {
      setRevokePendingSessionId(null);
    }
  };

  const onRotationDraftChange = (field: keyof RotationDraft, value: string) => {
    setRotationDraft((current) => {
      const nextDraft = { ...current, [field]: value } as RotationDraft;
      if (field === "target_type" || field === "target_id") {
        const recommendedKind = rotationKindForTarget(rotationTargets, nextDraft.target_type, nextDraft.target_id);
        return {
          ...nextDraft,
          kind: recommendedKind ?? nextDraft.kind,
        };
      }
      return nextDraft;
    });
  };

  const onRecordRotation = async () => {
    const targetId = rotationDraft.target_id.trim();
    const kind = rotationDraft.kind.trim();
    if (!targetId || !kind) {
      setError("Select a secret control and rotation kind before recording evidence.");
      return;
    }
    try {
      clearFeedback();
      setRotationPending(true);
      await recordSecretRotation({
        target_type: rotationDraft.target_type,
        target_id: targetId,
        kind,
        reference: rotationDraft.reference.trim() || undefined,
        notes: rotationDraft.notes.trim() || undefined,
      });
      setMessage(`Rotation evidence recorded for ${rotationDraft.target_type}:${targetId}.`);
      setRotationDraft((current) => ({ ...current, reference: "", notes: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording secret rotation failed.");
    } finally {
      setRotationPending(false);
    }
  };

  const submittedRequest = submittedRequestId
    ? requests.find((request) => request.request_id === submittedRequestId) ?? null
    : null;

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Governance"
          title="Security"
          description="Privilege posture, exception workflow, session controls, provider secret governance, and credential policy."
          question="Do you need elevated access controls or broader privileged security posture once the current session is known?"
          links={[
            {
              label: "Security",
              to: CONTROL_PLANE_ROUTES.security,
              description: "Security blockers, privileged identities, sessions, exception flow, and provider secret posture.",
              disabled: true,
            },
            {
              label: "Approvals",
              to: CONTROL_PLANE_ROUTES.approvals,
              description: "Cross-check the shared approval queue while Security access is still being resolved.",
              disabled: true,
            },
            {
              label: "Audit History",
              to: CONTROL_PLANE_ROUTES.auditHistory,
              description: "Review governance evidence without opening mutable controls.",
            },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="ForgeFrame verifies the current session role before exposing privileged identity, session, and secret controls."
        />
      </section>
    );
  }

  if (!canViewSecurity) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Governance"
          title="Security"
          description="This route is reserved for operators and admins who can inspect security posture or request elevated access."
          question="Which lower-privilege governance route should you use instead?"
          links={[
            {
              label: "Accounts",
              to: CONTROL_PLANE_ROUTES.accounts,
              description: "Inspect runtime identity posture without entering privileged control surfaces.",
            },
            {
              label: "API Keys",
              to: CONTROL_PLANE_ROUTES.apiKeys,
              description: "Inspect runtime key posture and key lifecycle state.",
            },
            {
              label: "Audit History",
              to: CONTROL_PLANE_ROUTES.auditHistory,
              description: "Read cross-system governance evidence without privileged mutations.",
            },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Security keeps privileged identity, session, exception, and provider secret controls outside the viewer envelope."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Governance"
        title="Security"
        description={securityDescription}
        question={securityQuestion}
        links={[
          {
            label: "Security",
            to: CONTROL_PLANE_ROUTES.security,
            description: "Use the dedicated security center for posture, sessions, exceptions, and provider credential controls.",
            badge: activeTab.replace("_", " "),
          },
          {
            label: "Approvals",
            to: CONTROL_PLANE_ROUTES.approvals,
            description: "Open the cross-domain approval queue when you need execution and elevated-access decisions together.",
            badge: canDecideElevatedAccess ? "Decision queue" : "Review queue",
            disabled: !canReviewApprovals,
          },
          {
            label: "Audit History",
            to: CONTROL_PLANE_ROUTES.auditHistory,
            description: "Verify privileged changes against immutable audit evidence.",
          },
          {
            label: "Accounts",
            to: CONTROL_PLANE_ROUTES.accounts,
            description: "Review runtime identities separately from privileged admin accounts.",
          },
        ]}
        badges={[
          { label: accessBadge, tone: accessTone },
          { label: approverPosture?.label ?? "Policy loading", tone: policyTone },
        ]}
        note={securityNote}
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {submittedRequest ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Latest request confirmation</h3>
              <p className="fg-muted">
                Approval review, requester claim, and live elevated session remain separate states for request <code>{submittedRequest.request_id}</code>.
              </p>
            </div>
          </div>
        </article>
      ) : null}

      <SecurityBlockerStrip blockers={securityBlockers} />
      <SecurityTabBar activeTab={activeTab} canViewAdminTabs={canViewAdminTabs} onSelectTab={setActiveTab} />

      {activeTab === "posture" ? (
        <SecurityPostureSection
          approverPosture={approverPosture}
          bootstrap={bootstrap}
          canViewAdminTabs={canViewAdminTabs}
          credentialPolicy={credentialPolicy}
          requests={requests}
          sessions={sessions}
          users={users}
        />
      ) : null}

      {activeTab === "admin_users" ? (
        <SecurityAdminUsersSection
          activeResetUserId={activeResetUserId}
          canMutateAdminPosture={canMutateAdminPosture}
          canViewAdminTabs={canViewAdminTabs}
          createForm={createForm}
          createPending={createPending}
          currentUserId={session?.user_id}
          editDraft={editDraft}
          instances={instances}
          memberships={memberships}
          membershipsLoading={membershipsLoading}
          removingMembershipInstanceId={removingMembershipInstanceId}
          resetDraft={resetDraft}
          resetPending={resetPending}
          selectedUser={selectedUser}
          selectedUserId={selectedUserId}
          scopeDraft={scopeDraft}
          scopePending={scopePending}
          selfPassword={selfPassword}
          selfPasswordPending={selfPasswordPending}
          updatePending={updatePending}
          users={users}
          onCloseResetForm={closeResetForm}
          onCreate={() => void onCreate()}
          onCreateFormChange={(field, value) => setCreateForm((current) => ({
            ...current,
            [field]: field === "role" ? value as AdminUser["role"] : value,
          }))}
          onEditDraftChange={(field, value) => setEditDraft((current) => ({
            ...current,
            [field]: field === "role"
              ? value as AdminUserEditDraft["role"]
              : field === "status"
                ? value as AdminUserEditDraft["status"]
                : value,
          }))}
          onFlagUserRotation={() => void onFlagUserRotation()}
          onOpenResetForm={openResetForm}
          onRemoveScope={(instanceId) => void onRemoveScope(instanceId)}
          onResetDraftChange={onResetDraftChange}
          onResetPassword={(user) => void onResetPassword(user)}
          onRotateOwnPassword={() => void onRotateOwnPassword()}
          onSaveUser={() => void onSaveUser()}
          onSaveScope={() => void onSaveScope()}
          onSelectUser={setSelectedUserId}
          onScopeDraftChange={onScopeDraftChange}
          onSelfPasswordChange={onSelfPasswordChange}
        />
      ) : null}

      {activeTab === "sessions" ? (
        <SecuritySessionsSection
          canMutateAdminPosture={canMutateAdminPosture}
          canViewAdminTabs={canViewAdminTabs}
          currentSessionId={session?.session_id}
          revokePendingSessionId={revokePendingSessionId}
          sessions={sessions}
          onRevokeSession={(sessionId) => void onRevokeSession(sessionId)}
        />
      ) : null}

      {activeTab === "elevated_access" ? (
        <SecurityElevatedAccessSection
          accessDraft={accessDraft}
          accessPending={accessPending}
          approverPosture={approverPosture}
          canDecideElevatedAccess={canDecideElevatedAccess}
          canRequestBreakGlass={canRequestBreakGlass}
          canRequestImpersonation={canRequestImpersonation}
          canStartElevated={canStartElevated}
          cancellingRequestId={cancellingRequestId}
          credentialPolicy={credentialPolicy}
          decisionDrafts={decisionDrafts}
          decisionPendingRequestId={decisionPendingRequestId}
          impersonationTargets={impersonationTargets}
          issuingRequestId={issuingRequestId}
          requests={requests}
          sessionUserId={session?.user_id}
          sessions={sessions}
          onApproveRequest={(request) => void onApproveRequest(request)}
          onCancelElevatedAccessRequest={(request) => void onCancelElevatedAccessRequest(request)}
          onDecisionDraftChange={onDecisionDraftChange}
          onElevatedAccessDraftChange={onElevatedAccessDraftChange}
          onElevatedRequestTypeChange={onElevatedRequestTypeChange}
          onIssueElevatedAccess={(request) => void onIssueElevatedAccess(request)}
          onRejectRequest={(request) => void onRejectRequest(request)}
          onSubmitElevatedAccessRequest={() => void onSubmitElevatedAccessRequest()}
        />
      ) : null}

      {activeTab === "provider_secrets" ? (
        <SecurityProviderSecretsSection
          canMutateAdminPosture={canMutateAdminPosture}
          canViewAdminTabs={canViewAdminTabs}
          harnessProfiles={harnessProfiles}
          recentRotations={recentRotations}
          rotationDraft={rotationDraft}
          rotationPending={rotationPending}
          rotationTargets={rotationTargets}
          secretPosture={secretPosture}
          secretStorageControls={secretStorageControls}
          onRecordRotation={() => void onRecordRotation()}
          onRotationDraftChange={onRotationDraftChange}
        />
      ) : null}

      {activeTab === "credential_policy" ? (
        <SecurityCredentialPolicySection credentialPolicy={credentialPolicy} />
      ) : null}
    </section>
  );
}
