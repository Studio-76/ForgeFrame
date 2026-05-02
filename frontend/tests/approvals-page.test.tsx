// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchApprovalsMock,
  fetchApprovalDetailMock,
  fetchAuditHistoryMock,
  approveApprovalMock,
  rejectApprovalMock,
} = vi.hoisted(() => ({
  fetchApprovalsMock: vi.fn(),
  fetchApprovalDetailMock: vi.fn(),
  fetchAuditHistoryMock: vi.fn(),
  approveApprovalMock: vi.fn(),
  rejectApprovalMock: vi.fn(),
}));

vi.mock("../src/api/domain", async () => {
  const actual = await vi.importActual<typeof import("../src/api/domain")>("../src/api/domain");

  return {
    ...actual,
    fetchApprovals: fetchApprovalsMock,
    fetchApprovalDetail: fetchApprovalDetailMock,
    fetchAuditHistory: fetchAuditHistoryMock,
    approveApproval: approveApprovalMock,
    rejectApproval: rejectApprovalMock,
  };
});

import type { AdminSessionUser, ApprovalDetail, ApprovalSummary } from "../src/api/domain";
import { ApprovalsPage } from "../src/pages/ApprovalsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createApprovalSummary(overrides: Partial<ApprovalSummary> = {}): ApprovalSummary {
  return {
    approval_id: "run:instance_alpha:company_alpha:approval-1",
    source_kind: "execution_run",
    native_approval_id: "approval-1",
    approval_type: "execution_run",
    approval_class: "execution_control",
    status: "open",
    title: "Execution approval for provider_sync",
    opened_at: "2026-04-21T22:00:00Z",
    decided_at: null,
    expires_at: null,
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    issue_id: "FOR-178",
    workspace_id: "ws_alpha",
    requester: {
      user_id: "requester-1",
      username: "ops-admin",
      display_name: "Ops Admin",
      role: "admin",
    },
    target: {
      display_name: "Issue FOR-178 in workspace ws_alpha",
      role: "execution_scope",
    },
    decision_actor: null,
    ready_to_issue: false,
    session_status: null,
    risk_level: "medium",
    risk_label: "Queued runtime work resumes after approval",
    due_state: "no_deadline",
    next_step: "Review evidence and record approve or reject. Run pause/resume/retry stays on Execution Review.",
    consequence_summary: "Approving re-opens the paused execution path. Rejecting sends the run into its configured deny flow.",
    irreversible: false,
    ...overrides,
  };
}

function createElevatedApprovalSummary(overrides: Partial<ApprovalSummary> = {}): ApprovalSummary {
  return createApprovalSummary({
    approval_id: "elevated:req_alpha",
    source_kind: "elevated_access",
    native_approval_id: "req_alpha",
    approval_type: "break_glass",
    approval_class: "elevated_access",
    title: "Break-glass approval for Shared Target",
    expires_at: "2026-04-22T12:10:00Z",
    instance_id: null,
    company_id: null,
    issue_id: null,
    workspace_id: null,
    requester: {
      user_id: "requester-2",
      username: "sec-ops",
      display_name: "Security Ops",
      role: "operator",
    },
    target: {
      user_id: "target-2",
      username: "shared-target",
      display_name: "Shared Target",
      role: "operator",
    },
    ready_to_issue: false,
    session_status: "not_issued",
    risk_level: "critical",
    risk_label: "Break-glass admin access",
    due_state: "due_now",
    next_step: "Review access evidence and record approve or reject. Session issuance stays on Security & Policies.",
    consequence_summary: "Approving records access eligibility only. The requester must still issue the session from Security & Policies.",
    irreversible: true,
    ...overrides,
  });
}

function createApprovalDetail(overrides: Partial<ApprovalDetail> = {}): ApprovalDetail {
  return {
    ...createApprovalSummary(),
    evidence: {
      gate_key: "provider.sync.approval",
      resume_disposition: "resume",
      run_state: "waiting_approval",
      run_kind: "provider_sync",
    },
    source: {
      instance_id: "instance_alpha",
      tenant_id: "tenant_alpha",
      run_id: "run-1",
      company_id: "company_alpha",
      issue_id: "FOR-178",
      current_step_key: "sync.providers",
    },
    artifacts: [
      {
        artifact_id: "artifact_handoff",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        workspace_id: "ws_alpha",
        artifact_type: "handoff_note",
        label: "Handoff note",
        uri: "file:///var/lib/forgeframe/workspaces/ws_alpha/handoff.md",
        media_type: "text/markdown",
        preview_url: null,
        size_bytes: 512,
        status: "active",
        created_by_type: "user",
        created_by_id: "user-admin",
        metadata: {},
        attachments: [],
        created_at: "2026-04-21T22:01:00Z",
        updated_at: "2026-04-21T22:01:00Z",
      },
    ],
    workspace: {
      workspace_id: "ws_alpha",
      instance_id: "instance_alpha",
      company_id: "company_alpha",
      issue_id: "FOR-178",
      title: "Alpha workspace",
      summary: "Linked workspace",
      status: "in_review",
      preview_status: "ready",
      review_status: "pending",
      handoff_status: "not_ready",
      owner_type: "user",
      owner_id: "user-admin",
      active_run_id: "run-1",
      latest_approval_id: "run:instance_alpha:company_alpha:approval-1",
      preview_artifact_id: "artifact_preview",
      handoff_artifact_id: null,
      pr_reference: null,
      handoff_reference: null,
      metadata: {},
      run_count: 1,
      approval_count: 1,
      artifact_count: 1,
      latest_event_at: "2026-04-21T22:02:00Z",
      created_at: "2026-04-21T21:55:00Z",
      updated_at: "2026-04-21T22:02:00Z",
    },
    actions: {
      can_approve: true,
      can_reject: true,
      decision_blocked_reason: null,
      approve_blocked_reason: null,
      reject_blocked_reason: null,
    },
    action_preview: {
      decision_surface: "Approve or reject only",
      decision_boundary: "This page records the approval outcome. Pause, resume, retry, and replay controls remain on Execution Review.",
      approve_effect: "Approving lets the waiting execution path continue according to the stored resume disposition.",
      reject_effect: "Rejecting sends the run into its configured deny path such as failed, cancel, or compensating.",
      risk_level: "medium",
      risk_label: "Queued runtime work resumes after approval",
      irreversible: false,
    },
    affected_identity: {
      requester: { display_name: "Ops Admin", username: "ops-admin" },
      target: { display_name: "Issue FOR-178 in workspace ws_alpha" },
    },
    affected_scope: {
      instance_id: "instance_alpha",
      company_id: "company_alpha",
      workspace_id: "ws_alpha",
      issue_id: "FOR-178",
      run_id: "run-1",
    },
    consequence: {
      approve: "Paused execution becomes eligible to continue or re-queue.",
      reject: "The configured deny flow runs next and may fail, cancel, or compensate the run.",
      irreversible: false,
      follow_up_surface: "Execution Review",
    },
    audit_history: {
      target_type: "execution_approval",
      target_id: "run:instance_alpha:company_alpha:approval-1",
      native_approval_id: "approval-1",
      status: "open",
      instance_id: "instance_alpha",
      entries: [
        {
          event_id: "audit_evt_execution_approval",
          created_at: "2026-04-21T22:10:00Z",
          action: "execution_approval_opened",
          status: "ok",
          actor: "Ops Admin",
          details: "Execution approval opened.",
          decision_note: null,
        },
      ],
    },
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
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function findLabeledControl<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(labelText: string): T | null {
  const label = Array.from(container.querySelectorAll("label")).find((item) => item.textContent?.includes(labelText));
  return label?.querySelector<T>("input, select, textarea") ?? null;
}

async function renderApprovalsPage(path = "/approvals?instanceId=instance_alpha") {
  await renderIntoDom(withAppContext({
    path,
    element: <ApprovalsPage />,
    session: adminSession,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-22T12:00:00Z"));
  vi.resetAllMocks();
  fetchApprovalsMock.mockResolvedValue({
    status: "ok",
    approvals: [createApprovalSummary()],
  });
  fetchApprovalDetailMock.mockResolvedValue({
    status: "ok",
    approval: createApprovalDetail(),
  });
  approveApprovalMock.mockResolvedValue({
    status: "ok",
    approval: createApprovalDetail({
      status: "approved",
      due_state: "resolved",
      actions: {
        can_approve: false,
        can_reject: false,
        decision_blocked_reason: "approval_not_open",
        approve_blocked_reason: "approval_not_open",
        reject_blocked_reason: "approval_not_open",
      },
    }),
  });
  rejectApprovalMock.mockResolvedValue({
    status: "ok",
    approval: createApprovalDetail({
      status: "rejected",
      due_state: "resolved",
      actions: {
        can_approve: false,
        can_reject: false,
        decision_blocked_reason: "approval_not_open",
        approve_blocked_reason: "approval_not_open",
        reject_blocked_reason: "approval_not_open",
      },
    }),
  });
  fetchAuditHistoryMock.mockResolvedValue({
    status: "ok",
    items: [
      {
        eventId: "audit_evt_execution_approval",
        createdAt: "2026-04-21T22:10:00Z",
        tenantId: "tenant_alpha",
        companyId: "company_alpha",
        actionKey: "execution_approval_approved",
        actionLabel: "Execution approval approved",
        status: "ok",
        statusLabel: "Succeeded",
        actor: { type: "admin_user", id: "user-admin", label: "Admin", secondary: "admin" },
        target: { type: "execution_approval", typeLabel: "Execution approval", id: "run:instance_alpha:company_alpha:approval-1", label: "Approval", secondary: null },
        summary: "Approval updated.",
        detailAvailable: true,
      },
    ],
    page: { limit: 1, nextCursor: null, hasMore: false },
    retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
    filters: { applied: { window: "all", action: null, actor: null, targetType: "execution_approval", targetId: null, status: null }, available: { actions: [], statuses: [], targetTypes: [] } },
    summary: { totalInScope: 1, totalMatchingFilters: 1, latestEventAt: "2026-04-21T22:10:00Z" },
  });
  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  vi.useRealTimers();
});

describe("approvals page workflow", () => {
  it("loads the decision queue and detail view with action preview and audit links", async () => {
    await renderApprovalsPage();

    expect(fetchApprovalsMock).toHaveBeenCalledWith({
      status: "open",
      approvalType: "all",
      risk: "all",
      due: "all",
      approvalClass: "all",
      instanceId: "instance_alpha",
      limit: 200,
    });
    expect(fetchApprovalDetailMock).toHaveBeenCalledWith("run:instance_alpha:company_alpha:approval-1", "instance_alpha");
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      window: "all",
      targetType: "execution_approval",
      limit: 1,
    });

    expect(container.textContent).toContain("Execution control");
    expect(container.textContent).toContain("Queued runtime work resumes after approval");
    expect(container.textContent).toContain("Pause, resume, retry, and replay controls remain on Execution Review.");
    expect(container.textContent).toContain("Execution approval opened.");

    const executionLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Open Execution Review"));
    expect(executionLink?.getAttribute("href")).toBe("/execution?instanceId=instance_alpha&companyId=company_alpha&state=waiting_on_approval&runId=run-1");

    const workspaceLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Workspace");
    expect(workspaceLink?.getAttribute("href")).toBe("/workspaces?instanceId=instance_alpha&workspaceId=ws_alpha");

    const artifactsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Artifacts");
    expect(artifactsLink?.getAttribute("href")).toBe("/artifacts?instanceId=instance_alpha&workspaceId=ws_alpha&targetKind=approval&targetId=run%3Ainstance_alpha%3Acompany_alpha%3Aapproval-1");

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Audit History");
    expect(auditLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=execution_approval&auditTargetId=run%3Ainstance_alpha%3Acompany_alpha%3Aapproval-1&auditEvent=audit_evt_execution_approval#audit-history");
  });

  it("filters the queue by risk and approval class", async () => {
    fetchApprovalsMock.mockResolvedValue({
      status: "ok",
      approvals: [
        createApprovalSummary(),
        createElevatedApprovalSummary(),
      ],
    });
    fetchApprovalDetailMock.mockResolvedValue({
      status: "ok",
      approval: createApprovalDetail({
        ...createElevatedApprovalSummary(),
        action_preview: {
          decision_surface: "Approve or reject only",
          decision_boundary: "This page records the approval outcome. Session issuance, expiry review, and revocation stay on Security & Policies.",
          approve_effect: "Marks the request approved and makes the session eligible to start; it does not issue the elevated session.",
          reject_effect: "Closes the request as rejected and prevents any session issuance from this approval item.",
          risk_level: "critical",
          risk_label: "Break-glass admin access",
          irreversible: true,
        },
        affected_identity: {
          requester: { display_name: "Security Ops", username: "sec-ops" },
          target: { display_name: "Shared Target", username: "shared-target" },
        },
        affected_scope: {
          request_id: "req_alpha",
          request_type: "break_glass",
          session_role: "admin",
        },
        consequence: {
          approve: "Requester can start the approved elevated session from Security & Policies.",
          reject: "Request is denied and no elevated session can be issued from this approval item.",
          irreversible: true,
          follow_up_surface: "Security & Policies",
        },
        audit_history: {
          target_type: "elevated_access_request",
          target_id: "req_alpha",
          approval_id: "elevated:req_alpha",
          status: "open",
          entries: [
            {
              event_id: "audit_evt_elevated_open",
              created_at: "2026-04-22T11:55:00Z",
              action: "break_glass_requested",
              status: "ok",
              actor: "Security Ops",
              details: "Break-glass request created.",
              decision_note: null,
            },
          ],
        },
      }),
    });

    await renderApprovalsPage("/approvals");

    const riskSelect = findLabeledControl<HTMLSelectElement>("Risk");
    const classSelect = findLabeledControl<HTMLSelectElement>("Approval class");

    expect(riskSelect).not.toBeNull();
    expect(classSelect).not.toBeNull();

    await act(async () => {
      setControlValue(riskSelect!, "critical");
      setControlValue(classSelect!, "elevated_access");
    });
    await flushEffects();

    expect(fetchApprovalsMock).toHaveBeenLastCalledWith({
      status: "open",
      approvalType: "all",
      risk: "critical",
      due: "all",
      approvalClass: "elevated_access",
      instanceId: null,
      limit: 200,
    });

    const tableBodyText = container.querySelector("tbody")?.textContent ?? "";
    expect(tableBodyText).toContain("Break-glass");
    expect(tableBodyText).toContain("Shared Target");
    expect(tableBodyText).not.toContain("provider_sync");
  });

  it("records approval decisions without requiring a comment", async () => {
    await renderApprovalsPage();

    const reviewApproveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Review approval"));
    expect(reviewApproveButton).not.toBeNull();

    await act(async () => {
      reviewApproveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const confirmApproveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Approve request"));
    expect(confirmApproveButton).not.toBeNull();

    await act(async () => {
      confirmApproveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(approveApprovalMock).toHaveBeenCalledWith(
      "run:instance_alpha:company_alpha:approval-1",
      "",
      "instance_alpha",
    );
    expect(container.textContent).toContain("Approval recorded");
    expect(container.textContent).toContain("No comment supplied.");
  });
});
