// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  approveElevatedAccessRequestMock,
  cancelElevatedAccessRequestMock,
  createBreakGlassRequestMock,
  deleteAdminUserMembershipMock,
  fetchAdminUserMembershipsMock,
  fetchAdminSessionsMock,
  fetchAdminUsersMock,
  fetchElevatedAccessRequestsMock,
  fetchInstancesMock,
  fetchSecurityBootstrapMock,
  issueElevatedAccessRequestMock,
  recordSecretRotationMock,
  setAdminTokenMock,
  upsertAdminUserMembershipMock,
  updateAdminUserMock,
} = vi.hoisted(() => ({
  approveElevatedAccessRequestMock: vi.fn(),
  cancelElevatedAccessRequestMock: vi.fn(),
  createBreakGlassRequestMock: vi.fn(),
  deleteAdminUserMembershipMock: vi.fn(),
  fetchAdminUserMembershipsMock: vi.fn(),
  fetchAdminSessionsMock: vi.fn(),
  fetchAdminUsersMock: vi.fn(),
  fetchElevatedAccessRequestsMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
  fetchSecurityBootstrapMock: vi.fn(),
  issueElevatedAccessRequestMock: vi.fn(),
  recordSecretRotationMock: vi.fn(),
  setAdminTokenMock: vi.fn(),
  upsertAdminUserMembershipMock: vi.fn(),
  updateAdminUserMock: vi.fn(),
}));

vi.mock("../src/api/domain", async () => {
  const actual = await vi.importActual<typeof import("../src/api/domain")>("../src/api/domain");
  return {
    ...actual,
    approveElevatedAccessRequest: approveElevatedAccessRequestMock,
    cancelElevatedAccessRequest: cancelElevatedAccessRequestMock,
    createBreakGlassRequest: createBreakGlassRequestMock,
    deleteAdminUserMembership: deleteAdminUserMembershipMock,
    fetchAdminUserMemberships: fetchAdminUserMembershipsMock,
    fetchAdminSessions: fetchAdminSessionsMock,
    fetchAdminUsers: fetchAdminUsersMock,
    fetchElevatedAccessRequests: fetchElevatedAccessRequestsMock,
    fetchInstances: fetchInstancesMock,
    fetchSecurityBootstrap: fetchSecurityBootstrapMock,
    issueElevatedAccessRequest: issueElevatedAccessRequestMock,
    recordSecretRotation: recordSecretRotationMock,
    setAdminToken: setAdminTokenMock,
    upsertAdminUserMembership: upsertAdminUserMembershipMock,
    updateAdminUser: updateAdminUserMock,
  };
});

import type {
  AdminInstanceMembership,
  AdminSecuritySession,
  AdminSessionUser,
  AdminUser,
  ElevatedAccessRequest,
  InstanceRecord,
  SecurityBootstrapResponse,
} from "../src/api/domain";
import { SecurityPage } from "../src/pages/SecurityPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    user_id: "user-alpha",
    username: "alpha",
    display_name: "Alpha Admin",
    role: "admin",
    status: "active",
    must_rotate_password: false,
    created_at: "2026-04-21T22:00:00Z",
    updated_at: "2026-04-21T22:00:00Z",
    last_login_at: "2026-04-21T22:10:00Z",
    created_by: "user-admin",
    ...overrides,
  };
}

function createAdminSecuritySession(overrides: Partial<AdminSecuritySession> = {}): AdminSecuritySession {
  return {
    session_id: "session-alpha",
    user_id: "user-alpha",
    role: "admin",
    session_type: "standard",
    created_at: "2026-04-21T22:00:00Z",
    expires_at: "2026-04-21T23:00:00Z",
    last_used_at: "2026-04-21T22:30:00Z",
    username: "alpha",
    display_name: "Alpha Admin",
    user_status: "active",
    active: true,
    expired: false,
    elevated: false,
    read_only: false,
    ...overrides,
  };
}

function createInstance(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instance_id: "tenant_bootstrap",
    slug: "bootstrap",
    display_name: "Bootstrap Instance",
    description: "Default tenant",
    status: "active",
    tenant_id: "tenant_bootstrap",
    company_id: "tenant_bootstrap",
    deployment_mode: "linux_host_native",
    exposure_mode: "same_origin",
    is_default: true,
    metadata: {},
    created_at: "2026-04-21T20:00:00Z",
    updated_at: "2026-04-21T20:00:00Z",
    ...overrides,
  };
}

function createMembership(overrides: Partial<AdminInstanceMembership> = {}): AdminInstanceMembership {
  return {
    membership_id: "membership-alpha",
    user_id: "user-alpha",
    instance_id: "tenant_bootstrap",
    tenant_id: "tenant_bootstrap",
    company_id: "tenant_bootstrap",
    role: "admin",
    status: "active",
    created_at: "2026-04-21T20:00:00Z",
    updated_at: "2026-04-21T20:00:00Z",
    created_by: "user-admin",
    ...overrides,
  };
}

function createRequest(overrides: Partial<ElevatedAccessRequest> = {}): ElevatedAccessRequest {
  return {
    request_id: "elev_req_alpha",
    request_type: "break_glass",
    gate_status: "approved",
    issuance_status: "pending",
    requested_by_user_id: operatorSession.user_id,
    target_user_id: operatorSession.user_id,
    target_role: "operator",
    session_role: "admin",
    approval_reference: "INC-42",
    justification: "Need privileged access to inspect live tenant policy drift.",
    notification_targets: ["incident-room", "oncall@example.com"],
    duration_minutes: 20,
    approval_expires_at: "2026-04-21T23:30:00Z",
    decision_note: "Approved for live investigation.",
    decided_at: "2026-04-21T23:05:00Z",
    decided_by_user_id: "user-admin",
    decided_by_username: "ops-admin",
    issued_at: null,
    issued_by_user_id: null,
    issued_by_username: null,
    issued_session_id: null,
    created_at: "2026-04-21T23:00:00Z",
    updated_at: "2026-04-21T23:05:00Z",
    approval_id: "elevated:elev_req_alpha",
    requested_by_username: operatorSession.username,
    requested_by_display_name: operatorSession.display_name,
    target_username: operatorSession.username,
    target_display_name: operatorSession.display_name,
    ready_to_issue: true,
    session_status: "not_issued",
    ...overrides,
  };
}

function createBootstrap(overrides: Partial<SecurityBootstrapResponse> = {}): SecurityBootstrapResponse {
  return {
    status: "ok",
    security_blockers: [
      {
        blocker_id: "default_password",
        label: "Default password",
        active: false,
        tone: "success",
        count: 0,
        summary: "Bootstrap password has been rotated.",
        detail: "No insecure bootstrap password is currently active.",
      },
      {
        blocker_id: "missing_rotation",
        label: "Missing rotation evidence",
        active: true,
        tone: "danger",
        count: 1,
        summary: "1 secret controls lack rotation evidence.",
        detail: "Configured provider or harness credentials exist without recorded rotation evidence.",
      },
      {
        blocker_id: "open_sessions",
        label: "Open sessions",
        active: true,
        tone: "warning",
        count: 2,
        summary: "2 admin sessions are active.",
        detail: "Review active sessions and revoke anything that no longer needs control-plane access.",
      },
      {
        blocker_id: "secrets_missing",
        label: "Secrets missing",
        active: true,
        tone: "danger",
        count: 1,
        summary: "1 provider controls are not configured.",
        detail: "One or more provider integrations cannot authenticate because no credential is configured.",
      },
      {
        blocker_id: "break_glass_active",
        label: "Break-glass active",
        active: false,
        tone: "success",
        count: 0,
        summary: "No break-glass sessions are active.",
        detail: "No emergency break-glass exceptions are currently running.",
      },
    ],
    credential_policy: {
      human_sessions: {
        ttl_hours: 8,
        rotation_trigger: "password_rotation_or_admin_revocation",
        session_types: ["standard", "impersonation", "break_glass"],
      },
      elevated_access_requests: {
        approval_ttl_minutes: 30,
        gate_statuses: ["open", "approved", "rejected", "timed_out", "cancelled"],
        issuance_states: ["pending", "issued"],
        requester_claim_required: true,
        self_approval_allowed: false,
        approver_availability: {
          state: "approval_available",
          label: "Approval available",
          approval_requires_distinct_admin: true,
          eligible_admin_approver_count: 2,
          blocked_reason: null,
          primary_message: "A different admin can review elevated-access requests in this environment.",
          secondary_message: "ForgeFrame keeps elevated-access requests pending until a different admin approves them.",
        },
      },
      impersonation_sessions: {
        max_ttl_minutes: 30,
        approval_reference_required: true,
        notification_targets_required: true,
        approval_required_before_issue: true,
        read_only: true,
        write_capable_admin_routes: false,
      },
      break_glass_sessions: {
        max_ttl_minutes: 60,
        approval_reference_required: true,
        notification_targets_required: true,
        approval_required_before_issue: true,
        eligible_roles: ["admin", "operator"],
      },
      service_account_keys: {
        ttl_days: 30,
        rotation_warning_days: 7,
        revocation_modes: ["disable", "revoke", "rotate"],
        hashing: "sha256",
      },
    },
    elevated_access_approver_posture: {
      state: "approval_available",
      label: "Approval available",
      approval_requires_distinct_admin: true,
      eligible_admin_approver_count: 2,
      blocked_reason: null,
      primary_message: "A different admin can review elevated-access requests in this environment.",
      secondary_message: "ForgeFrame keeps elevated-access requests pending until a different admin approves them.",
    },
    bootstrap: {
      admin_auth_enabled: true,
      bootstrap_username: "admin",
      must_rotate_password: false,
      default_password_in_use: false,
      admin_user_count: 2,
      active_session_count: 2,
      governance_storage_backend: "sqlite",
    },
    secret_posture: [
      {
        provider: "openai_api",
        configured: true,
        auth_mode: "api_key",
        rotation_support: "manual_env_rotation",
        secret_storage: "environment_variable",
        credential_reference: "FORGEFRAME_OPENAI_API_KEY",
        history_source: "governance_recorded_event",
        needs_rotation_evidence: false,
        state: "rotatable",
        state_label: "Rotatable",
        state_reason: "Credential is configured and ForgeFrame has recorded rotation evidence for it.",
        history_count: 1,
        last_rotation_at: "2026-04-20T10:00:00Z",
        last_rotation_reference: "SEC-10",
        last_rotation_kind: "manual_env_rotation",
      },
      {
        provider: "gemini",
        configured: false,
        auth_mode: "api_key",
        rotation_support: "manual_env_rotation",
        secret_storage: "environment_variable",
        credential_reference: "FORGEFRAME_GEMINI_API_KEY",
        history_source: "governance_recorded_event",
        needs_rotation_evidence: false,
        state: "missing",
        state_label: "Missing",
        state_reason: "No credential is configured for this control path.",
        history_count: 0,
        last_rotation_at: null,
        last_rotation_reference: null,
        last_rotation_kind: null,
      },
    ],
    harness_profiles: [
      {
        provider_key: "rotation_profile",
        label: "Rotation Profile",
        configured: true,
        auth_mode: "bearer",
        rotation_support: "harness_profile_rotation",
        secret_storage: "repository_backed_configuration",
        credential_reference: "harness_profile:rotation_profile",
        config_revision: 3,
        history_source: "harness_config_history",
        needs_rotation_evidence: true,
        state: "blocked",
        state_label: "Blocked",
        state_reason: "Credential exists, but ForgeFrame has no recorded rotation evidence for it.",
        history_count: 0,
        last_rotation_at: null,
        last_rotation_reference: null,
        last_rotation_kind: null,
      },
    ],
    recent_rotations: [
      {
        event_id: "rotate_1",
        target_type: "provider",
        target_id: "openai_api",
        kind: "manual_env_rotation",
        recorded_at: "2026-04-20T10:00:00Z",
        reference: "SEC-10",
        notes: "Rotated in vault",
        metadata: {},
        history_source: "governance_recorded_event",
      },
    ],
    secret_storage_controls: [
      {
        credential_class: "provider_secret",
        storage: "environment_variable",
        plaintext_persisted: true,
        notes: "Provider credentials remain operator-managed env/OAuth material.",
      },
    ],
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root | null = null;

async function renderIntoDom(element: ReactNode) {
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function setControlValue(control: HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent?.trim() === label);
  expect(button).toBeDefined();
  return act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function renderSecurityPage(session: AdminSessionUser) {
  await renderIntoDom(withAppContext({
    path: "/security",
    element: <SecurityPage />,
    session,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchSecurityBootstrapMock.mockResolvedValue(createBootstrap());
  fetchElevatedAccessRequestsMock.mockResolvedValue({
    status: "ok",
    requests: [createRequest()],
  });
  fetchAdminUsersMock.mockResolvedValue({
    status: "ok",
    users: [
      createUser(),
      createUser({
        user_id: "user-operator",
        username: "operator",
        display_name: "Operator",
        role: "operator",
      }),
    ],
  });
  fetchAdminUserMembershipsMock.mockResolvedValue({
    status: "ok",
    memberships: [createMembership()],
  });
  fetchAdminSessionsMock.mockResolvedValue({
    status: "ok",
    sessions: [
      createAdminSecuritySession({
        session_id: adminSession.session_id,
        user_id: adminSession.user_id,
        username: adminSession.username,
        display_name: adminSession.display_name,
      }),
      createAdminSecuritySession({
        session_id: "session-break-glass",
        user_id: "user-operator",
        role: "admin",
        username: "operator",
        display_name: "Operator",
        session_type: "break_glass",
        approval_reference: "INC-42",
      }),
    ],
  });
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstance()],
  });
  createBreakGlassRequestMock.mockResolvedValue({
    status: "ok",
    request: createRequest({
      gate_status: "open",
      ready_to_issue: false,
      session_status: "not_issued",
      decision_note: null,
      decided_at: null,
      decided_by_user_id: null,
      decided_by_username: null,
    }),
  });
  approveElevatedAccessRequestMock.mockResolvedValue({
    status: "ok",
    request: createRequest({
      gate_status: "approved",
      ready_to_issue: true,
    }),
  });
  updateAdminUserMock.mockResolvedValue({
    status: "ok",
    user: createUser({
      display_name: "Alpha Platform Admin",
    }),
  });
  upsertAdminUserMembershipMock.mockResolvedValue({
    status: "ok",
    membership: createMembership({
      role: "viewer",
      status: "disabled",
    }),
  });
  deleteAdminUserMembershipMock.mockResolvedValue({
    status: "ok",
    deleted: {
      user_id: "user-alpha",
      instance_id: "tenant_bootstrap",
    },
  });
  recordSecretRotationMock.mockResolvedValue({
    status: "ok",
    rotation: createBootstrap().recent_rotations![0],
  });
  issueElevatedAccessRequestMock.mockResolvedValue({
    status: "ok",
    request: createRequest({
      issuance_status: "issued",
      ready_to_issue: false,
      session_status: "active",
      issued_at: "2026-04-21T23:06:00Z",
      issued_by_user_id: operatorSession.user_id,
      issued_by_username: operatorSession.username,
      issued_session_id: "session-break-glass",
    }),
    access_token: "fg_admin_break_glass_token",
    token_type: "bearer",
    expires_at: "2026-04-21T23:26:00Z",
    user: {
      ...operatorSession,
      role: "admin",
      session_id: "session-break-glass",
      session_type: "break_glass",
    },
  });

  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
});

afterEach(() => {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  root = null;
});

describe("Security page security center", () => {
  it("keeps operator access on elevated-access and blocker visibility without loading admin-only posture APIs", async () => {
    await renderSecurityPage(operatorSession);

    expect(fetchSecurityBootstrapMock).toHaveBeenCalledTimes(1);
    expect(fetchElevatedAccessRequestsMock).toHaveBeenCalledTimes(1);
    expect(fetchAdminUsersMock).not.toHaveBeenCalled();
    expect(fetchAdminSessionsMock).not.toHaveBeenCalled();
    // Posture summary should show attention state with active blockers
    expect(container.textContent).toContain("Attention required");
    // Checklist should show active blockers (mapped from API)
    expect(container.textContent).toContain("Missing provider secrets");
    expect(container.textContent).toContain("Secret rotation evidence");
    // Tab labels still shown with restriction indicator
    expect(container.textContent).toContain("Admin Users");
    expect(container.textContent).toContain("Restricted");

    await clickButton("Elevated Access");
    await flushEffects();

    expect(container.textContent).toContain("Request elevated access");
  });

  it("submits a break-glass request from the elevated-access tab", async () => {
    await renderSecurityPage(operatorSession);
    await clickButton("Elevated Access");
    await flushEffects();

    const approvalReferenceField = container.querySelector<HTMLInputElement>('input[placeholder="INC-1245"]');
    const notificationTargetsField = container.querySelector<HTMLInputElement>('input[placeholder="incident-channel, oncall@example.com"]');
    const justificationField = container.querySelector<HTMLTextAreaElement>('textarea[placeholder="Describe why elevated access is required and what outcome you need."]');

    expect(approvalReferenceField).not.toBeNull();
    expect(notificationTargetsField).not.toBeNull();
    expect(justificationField).not.toBeNull();

    await act(async () => {
      setControlValue(approvalReferenceField!, "INC-99");
      setControlValue(notificationTargetsField!, "incident-room");
      setControlValue(justificationField!, "Need elevated access to inspect runtime drift.");
    });

    await clickButton("Request break-glass access");
    await flushEffects();

    expect(createBreakGlassRequestMock).toHaveBeenCalledWith({
      approval_reference: "INC-99",
      justification: "Need elevated access to inspect runtime drift.",
      notification_targets: ["incident-room"],
      duration_minutes: 15,
    });
  });

  it("marks the current admin session and keeps provider secret controls metadata-only", async () => {
    await renderSecurityPage(adminSession);

    expect(fetchAdminUsersMock).toHaveBeenCalledTimes(1);
    expect(fetchAdminSessionsMock).toHaveBeenCalledTimes(1);

    await clickButton("Sessions");
    await flushEffects();
    expect(container.textContent).toContain("This browser");

    await clickButton("Provider Secrets");
    await flushEffects();
    expect(container.textContent).toContain("Provider secret values never render here.");
    expect(container.textContent).toContain("FORGEFRAME_OPENAI_API_KEY");
    expect(container.textContent).not.toContain("super-secret-value");
  });

  it("lets an admin approve an elevated-access request from the dedicated approval queue", async () => {
    fetchElevatedAccessRequestsMock.mockResolvedValueOnce({
      status: "ok",
      requests: [createRequest({
        gate_status: "open",
        ready_to_issue: false,
        session_status: "not_issued",
        decision_note: null,
        decided_at: null,
        decided_by_user_id: null,
        decided_by_username: null,
        requested_by_user_id: "user-operator",
        requested_by_username: "operator",
        requested_by_display_name: "Operator",
      })],
    });

    await renderSecurityPage(adminSession);
    await clickButton("Elevated Access");
    await flushEffects();

    const decisionField = container.querySelector<HTMLTextAreaElement>('textarea[placeholder="Explain why this exception is approved or rejected."]');
    expect(decisionField).not.toBeNull();

    await act(async () => {
      setControlValue(decisionField!, "Approved because incident response needs temporary control-plane access.");
    });

    await clickButton("Approve");
    await flushEffects();

    expect(approveElevatedAccessRequestMock).toHaveBeenCalledWith(
      "elev_req_alpha",
      "Approved because incident response needs temporary control-plane access.",
    );
  });

  it("lets an admin edit the selected privileged user profile", async () => {
    await renderSecurityPage(adminSession);
    await clickButton("Admin Users");
    await flushEffects();

    const displayNameField = Array.from(container.querySelectorAll("input")).find((input) => input.value === "Alpha Admin");
    expect(displayNameField).toBeDefined();

    await act(async () => {
      setControlValue(displayNameField as HTMLInputElement, "Alpha Platform Admin");
    });

    await clickButton("Save profile changes");
    await flushEffects();

    expect(updateAdminUserMock).toHaveBeenCalledWith("user-alpha", {
      display_name: "Alpha Platform Admin",
    });
  });

  it("lets an admin upsert a scoped membership for the selected user", async () => {
    await renderSecurityPage(adminSession);
    await clickButton("Admin Users");
    await flushEffects();

    const selects = Array.from(container.querySelectorAll("select"));
    const scopedRoleSelect = selects.find((select) => select.value === "admin" && select.parentElement?.textContent?.includes("Scoped role"));
    const scopedStatusSelect = selects.find((select) => select.value === "active" && select.parentElement?.textContent?.includes("Scoped status"));
    expect(scopedRoleSelect).toBeDefined();
    expect(scopedStatusSelect).toBeDefined();

    await act(async () => {
      setControlValue(scopedRoleSelect as HTMLSelectElement, "viewer");
      setControlValue(scopedStatusSelect as HTMLSelectElement, "disabled");
    });

    await clickButton("Save scope mapping");
    await flushEffects();

    expect(upsertAdminUserMembershipMock).toHaveBeenCalledWith("user-alpha", "tenant_bootstrap", {
      role: "viewer",
      status: "disabled",
    });
  });

  it("records secret rotation evidence without collecting a secret value", async () => {
    await renderSecurityPage(adminSession);
    await clickButton("Provider Secrets");
    await flushEffects();

    const referenceField = container.querySelector<HTMLInputElement>('input[placeholder="INC-202 / vault-change-ticket"]');
    expect(referenceField).not.toBeNull();

    await act(async () => {
      setControlValue(referenceField!, "SEC-221");
    });

    await clickButton("Record rotation evidence");
    await flushEffects();

    expect(recordSecretRotationMock).toHaveBeenCalledWith({
      target_type: "provider",
      target_id: "openai_api",
      kind: "manual_env_rotation",
      reference: "SEC-221",
      notes: undefined,
    });
  });

  it("lets the original requester start an approved elevated session from the security surface", async () => {
    await renderSecurityPage(operatorSession);
    await clickButton("Elevated Access");
    await flushEffects();

    await clickButton("Start break-glass session");
    await flushEffects();

    expect(issueElevatedAccessRequestMock).toHaveBeenCalledWith("elev_req_alpha");
    expect(setAdminTokenMock).toHaveBeenCalledWith("fg_admin_break_glass_token");
  });
});
