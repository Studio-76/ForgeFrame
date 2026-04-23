// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  cancelElevatedAccessRequestMock,
  fetchSecurityBootstrapMock,
  fetchElevatedAccessRequestsMock,
  fetchAdminUsersMock,
  fetchAdminSessionsMock,
  createBreakGlassRequestMock,
  issueElevatedAccessRequestMock,
} = vi.hoisted(() => ({
  cancelElevatedAccessRequestMock: vi.fn(),
  fetchSecurityBootstrapMock: vi.fn(),
  fetchElevatedAccessRequestsMock: vi.fn(),
  fetchAdminUsersMock: vi.fn(),
  fetchAdminSessionsMock: vi.fn(),
  createBreakGlassRequestMock: vi.fn(),
  issueElevatedAccessRequestMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    cancelElevatedAccessRequest: cancelElevatedAccessRequestMock,
    fetchSecurityBootstrap: fetchSecurityBootstrapMock,
    fetchElevatedAccessRequests: fetchElevatedAccessRequestsMock,
    fetchAdminUsers: fetchAdminUsersMock,
    fetchAdminSessions: fetchAdminSessionsMock,
    createBreakGlassRequest: createBreakGlassRequestMock,
    issueElevatedAccessRequest: issueElevatedAccessRequestMock,
  };
});

import type {
  AdminSessionUser,
  ElevatedAccessRequest,
  SecurityBootstrapResponse,
} from "../src/api/admin";
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

function createBootstrap(): SecurityBootstrapResponse {
  return {
    status: "ok",
    credential_policy: {
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

function setControlValue(control: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLTextAreaElement | HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
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
    users: [],
  });
  fetchAdminSessionsMock.mockResolvedValue({
    status: "ok",
    sessions: [],
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
  cancelElevatedAccessRequestMock.mockResolvedValue({
    status: "ok",
    request: createRequest({
      gate_status: "cancelled",
      ready_to_issue: false,
      session_status: "not_issued",
      decided_at: "2026-04-21T23:04:00Z",
      decided_by_user_id: operatorSession.user_id,
      decided_by_username: operatorSession.username,
      updated_at: "2026-04-21T23:04:00Z",
    }),
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

describe("Security page elevated-access workflow", () => {
  it("keeps operator access on the elevated-access request surface without loading admin-only posture APIs", async () => {
    await renderSecurityPage(operatorSession);

    expect(fetchSecurityBootstrapMock).toHaveBeenCalledTimes(1);
    expect(fetchElevatedAccessRequestsMock).toHaveBeenCalledTimes(1);
    expect(fetchAdminUsersMock).not.toHaveBeenCalled();
    expect(fetchAdminSessionsMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Request elevated access");
    expect(container.textContent).toContain("Request break-glass access");
    expect(container.textContent).toContain("Ready to start");
    expect(container.textContent).not.toContain("Create Admin User");
  });

  it("keeps the shared approvals path visible from Security for operators", async () => {
    await renderSecurityPage(operatorSession);

    const approvalsIntroLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent?.includes("Approvals"),
    );

    expect(approvalsIntroLink?.getAttribute("href")).toBe("/approvals");
    expect(container.textContent).not.toContain("Not available yet");
  });

  it("adds approval-detail and audit handoff links after request submission", async () => {
    await renderSecurityPage(operatorSession);

    const approvalReferenceField = container.querySelector<HTMLInputElement>('input[placeholder="INC-1245"]');
    const notificationTargetsField = container.querySelector<HTMLInputElement>('input[placeholder="incident-channel, oncall@example.com"]');
    const justificationField = container.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="Describe why elevated access is required and what outcome you need."]',
    );
    const requestButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Request break-glass access",
    );

    expect(approvalReferenceField).not.toBeNull();
    expect(notificationTargetsField).not.toBeNull();
    expect(justificationField).not.toBeNull();
    expect(requestButton).not.toBeNull();

    await act(async () => {
      setControlValue(approvalReferenceField!, "INC-99");
      setControlValue(notificationTargetsField!, "incident-room");
      setControlValue(justificationField!, "Need elevated access to inspect runtime drift.");
    });

    await act(async () => {
      requestButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createBreakGlassRequestMock).toHaveBeenCalledWith({
      approval_reference: "INC-99",
      justification: "Need elevated access to inspect runtime drift.",
      notification_targets: ["incident-room"],
      duration_minutes: 15,
    });
    expect(container.textContent).toContain("Pending approval confirmation");

    const approvalDetailLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "Open approval detail",
    );
    const auditHistoryLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "Open audit history",
    );

    expect(approvalDetailLink?.getAttribute("href")).toBe("/approvals?status=all&approvalId=elevated%3Aelev_req_alpha");
    expect(auditHistoryLink?.getAttribute("href")).toBe(
      "/logs?auditWindow=all&auditTargetType=elevated_access_request&auditTargetId=elev_req_alpha#audit-history",
    );
  });

  it("lets the requester cancel a pending elevated-access request from Security", async () => {
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
      })],
    });

    await renderSecurityPage(operatorSession);

    const cancelButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Cancel request",
    );
    expect(cancelButton).not.toBeUndefined();

    await act(async () => {
      cancelButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(cancelElevatedAccessRequestMock).toHaveBeenCalledWith("elev_req_alpha");
    expect(container.textContent).toContain("Break-glass request cancelled.");
    expect(container.textContent).toContain("Request cancelled");
  });

  it("lets the requester start an approved elevated-access session from Security", async () => {
    await renderSecurityPage(operatorSession);

    const startButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Start break-glass session",
    );
    expect(startButton).not.toBeUndefined();

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(issueElevatedAccessRequestMock).toHaveBeenCalledWith("elev_req_alpha");
    expect(container.textContent).toContain("Break-glass session started.");
  });
});
