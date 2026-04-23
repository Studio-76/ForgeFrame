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

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchApprovals: fetchApprovalsMock,
    fetchApprovalDetail: fetchApprovalDetailMock,
    fetchAuditHistory: fetchAuditHistoryMock,
    approveApproval: approveApprovalMock,
    rejectApproval: rejectApprovalMock,
  };
});

import type { AdminSessionUser, ApprovalDetail, ApprovalSummary } from "../src/api/admin";
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
    },
    target: {
      user_id: "target-1",
      username: "runtime-service",
      display_name: "Runtime Service",
      role: "operator",
    },
    decision_actor: null,
    ready_to_issue: false,
    session_status: null,
    ...overrides,
  };
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
  if (!root) {
    vi.useRealTimers();
    return;
  }

  act(() => {
    root?.unmount();
  });
  root = null;
  vi.useRealTimers();
});

describe("approvals page workflow", () => {
  it("loads the shared approvals queue inside the selected instance slice", async () => {
    await renderApprovalsPage();

    expect(fetchApprovalsMock).toHaveBeenCalledWith("open", "instance_alpha");
    expect(fetchApprovalDetailMock).toHaveBeenCalledWith("run:instance_alpha:company_alpha:approval-1", "instance_alpha");
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      window: "all",
      targetType: "execution_approval",
      limit: 1,
    });
    expect(container.textContent).toContain("Instance instance_alpha");

    const executionLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Open Execution Review"));
    expect(executionLink?.getAttribute("href")).toBe("/execution?instanceId=instance_alpha&companyId=company_alpha&state=waiting_on_approval&runId=run-1");

    const workspaceLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Workspace");
    expect(workspaceLink?.getAttribute("href")).toBe("/workspaces?instanceId=instance_alpha&workspaceId=ws_alpha");

    const artifactsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Artifacts");
    expect(artifactsLink?.getAttribute("href")).toBe("/artifacts?instanceId=instance_alpha&workspaceId=ws_alpha&targetKind=approval&targetId=run%3Ainstance_alpha%3Acompany_alpha%3Aapproval-1");

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Audit History");
    expect(auditLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=execution_approval&auditTargetId=run%3Ainstance_alpha%3Acompany_alpha%3Aapproval-1&auditEvent=audit_evt_execution_approval#audit-history");
  });

  it("submits approval decisions with the active instance scope preserved", async () => {
    await renderApprovalsPage();

    const noteField = container.querySelector<HTMLTextAreaElement>("textarea");
    const reviewApproveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Review approval"));

    expect(noteField).not.toBeNull();
    expect(reviewApproveButton).not.toBeNull();

    await act(async () => {
      setControlValue(noteField!, "Approve the waiting provider sync after reviewing the recorded evidence.");
    });

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
      "Approve the waiting provider sync after reviewing the recorded evidence.",
      "instance_alpha",
    );
  });
});
