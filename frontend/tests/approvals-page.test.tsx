// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
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
import { describeApprovalBanner, describeApprovalMutationMessage } from "../src/features/approvals/presentation";
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

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

const viewerSession: AdminSessionUser = {
  session_id: "session-viewer",
  user_id: "user-viewer",
  username: "viewer",
  display_name: "Viewer",
  role: "viewer",
};

function createApprovalSummary(overrides: Partial<ApprovalSummary> = {}): ApprovalSummary {
  return {
    approval_id: "run:tenant-acme:approval-1",
    source_kind: "execution_run",
    native_approval_id: "approval-1",
    approval_type: "execution_run",
    status: "open",
    title: "Execution approval for provider_sync",
    opened_at: "2026-04-21T22:00:00Z",
    decided_at: null,
    expires_at: null,
    company_id: "tenant-acme",
    issue_id: "FOR-178",
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
      run_id: "run-1",
      company_id: "tenant-acme",
      issue_id: "FOR-178",
      current_step_key: "sync.providers",
    },
    actions: {
      can_approve: true,
      can_reject: true,
      decision_blocked_reason: null,
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

function setSelectValue(control: HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function findLabeledControl<T extends HTMLElement>(labelText: string, selector: string): T | null {
  const label = Array.from(container.querySelectorAll("label"))
    .find((candidate) => candidate.textContent?.includes(labelText));
  return label?.querySelector<T>(selector) ?? null;
}

function findCardByHeading(headingText: string): HTMLElement | null {
  const heading = Array.from(container.querySelectorAll("h3"))
    .find((candidate) => candidate.textContent?.trim() === headingText);
  return heading?.closest("article") as HTMLElement | null;
}

async function renderApprovalsPage(session: AdminSessionUser) {
  await renderIntoDom(withAppContext({
    path: "/approvals",
    element: <ApprovalsPage />,
    session,
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
      },
    }),
  });
  fetchAuditHistoryMock.mockImplementation(async (query?: { targetType?: string | null; targetId?: string | null }) => {
    const eventId = query?.targetType === "elevated_access_request" ? "audit_evt_elevated_request" : "audit_evt_execution_approval";
    return {
      status: "ok",
      items: [
        {
          eventId,
          createdAt: "2026-04-21T22:10:00Z",
          tenantId: null,
          companyId: "tenant-acme",
          actionKey: "execution_approval_approved",
          actionLabel: "Execution approval approved",
          status: "ok",
          statusLabel: "Succeeded",
          actor: { type: "admin_user", id: "user-admin", label: "Admin", secondary: "admin" },
          target: { type: query?.targetType ?? "execution_approval", typeLabel: "Execution approval", id: query?.targetId ?? "run:tenant-acme:approval-1", label: "Approval", secondary: null },
          summary: "Approval updated.",
          detailAvailable: true,
        },
      ],
      page: { limit: 1, nextCursor: null, hasMore: false },
      retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
      filters: { applied: { window: "all", action: null, actor: null, targetType: query?.targetType ?? null, targetId: query?.targetId ?? null, status: null }, available: { actions: [], statuses: [], targetTypes: [] } },
      summary: { totalInScope: 1, totalMatchingFilters: 1, latestEventAt: "2026-04-21T22:10:00Z" },
    };
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
  it("renders the live shared approvals queue and decision controls for admins", async () => {
    await renderApprovalsPage(adminSession);

    expect(fetchApprovalsMock).toHaveBeenCalledWith("open");
    expect(fetchApprovalDetailMock).toHaveBeenCalledWith("run:tenant-acme:approval-1");
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({ window: "all", targetType: "execution_approval", limit: 1 });
    expect(container.textContent).toContain("Admin decision mode");
    expect(container.textContent).toContain("Execution is waiting on approval");
    expect(container.textContent).toContain("Decision panel");
    expect(container.textContent).toContain("Review approval");
    expect(container.textContent).toContain("Review rejection");

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(auditLink?.getAttribute("href")).toContain("auditTargetType=execution_approval");
    expect(auditLink?.getAttribute("href")).toContain("auditEvent=audit_evt_execution_approval");

    const executionLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Open Execution Review"));
    expect(executionLink?.getAttribute("href")).toBe("/execution?companyId=tenant-acme&state=waiting_on_approval&runId=run-1");
  });

  it("groups the queue by urgency and approval type before selecting the default item", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [
        createApprovalSummary({
          approval_id: "run:tenant-acme:approval-open",
          native_approval_id: "approval-open",
          opened_at: "2026-04-22T11:30:00Z",
          title: "Execution approval for runtime_sync",
        }),
        createApprovalSummary({
          approval_id: "elevated:elev_req_expiring",
          source_kind: "elevated_access",
          native_approval_id: "elev_req_expiring",
          approval_type: "break_glass",
          title: "Break-glass approval for Runtime Operator",
          opened_at: "2026-04-22T11:55:00Z",
          expires_at: "2026-04-22T12:10:00Z",
        }),
        createApprovalSummary({
          approval_id: "elevated:elev_req_ready",
          source_kind: "elevated_access",
          native_approval_id: "elev_req_ready",
          approval_type: "impersonation",
          status: "approved",
          title: "Impersonation approval for Tenant Analyst",
          opened_at: "2026-04-22T11:10:00Z",
          ready_to_issue: true,
          session_status: "not_issued",
        }),
        createApprovalSummary({
          approval_id: "run:tenant-acme:approval-resolved",
          native_approval_id: "approval-resolved",
          status: "rejected",
          title: "Execution approval for cleanup_run",
          opened_at: "2026-04-22T09:00:00Z",
        }),
      ],
    });
    fetchApprovalDetailMock.mockImplementation(async (approvalId: string) => {
      if (approvalId === "elevated:elev_req_expiring") {
        return {
          status: "ok",
          approval: createApprovalDetail({
            approval_id: approvalId,
            source_kind: "elevated_access",
            native_approval_id: "elev_req_expiring",
            approval_type: "break_glass",
            title: "Break-glass approval for Runtime Operator",
            opened_at: "2026-04-22T11:55:00Z",
            expires_at: "2026-04-22T12:10:00Z",
          }),
        };
      }

      return {
        status: "ok",
        approval: createApprovalDetail({
          approval_id,
          native_approval_id: approvalId.replace("run:tenant-acme:", ""),
        }),
      };
    });

    await renderApprovalsPage(adminSession);

    expect(fetchApprovalDetailMock).toHaveBeenCalledWith("elevated:elev_req_expiring");
    expect(container.textContent).toContain("grouped by urgency first and approval type second");
    expect(container.textContent).toContain("Expiring soon · Break-glass");
    expect(container.textContent).toContain("Needs decision now · Execution run");
    expect(container.textContent).toContain("Requester follow-up · Impersonation");
    expect(container.textContent).toContain("Recorded outcome · Execution run");

    const queueText = container.querySelector('[aria-label="Approval queue"]')?.textContent ?? "";
    expect(queueText.indexOf("Expiring soon · Break-glass")).toBeGreaterThan(-1);
    expect(queueText.indexOf("Needs decision now · Execution run")).toBeGreaterThan(queueText.indexOf("Expiring soon · Break-glass"));
    expect(queueText.indexOf("Requester follow-up · Impersonation")).toBeGreaterThan(queueText.indexOf("Needs decision now · Execution run"));
  });

  it("keeps request evidence first and demotes raw ids into secondary metadata", async () => {
    await renderApprovalsPage(adminSession);

    const headings = Array.from(container.querySelectorAll("h3"))
      .map((heading) => heading.textContent?.trim() ?? "");
    const evidenceIndex = headings.indexOf("Evidence");
    const auditIndex = headings.indexOf("Audit history");
    const metadataIndex = headings.indexOf("Secondary metadata");
    const evidenceCard = findCardByHeading("Evidence");
    const metadataCard = findCardByHeading("Secondary metadata");
    const detailHeaderCard = findCardByHeading("Execution approval for provider_sync");

    expect(evidenceIndex).toBeGreaterThan(-1);
    expect(auditIndex).toBeGreaterThan(evidenceIndex);
    expect(metadataIndex).toBeGreaterThan(auditIndex);

    expect(detailHeaderCard?.textContent).not.toContain("Approval ID");
    expect(evidenceCard?.textContent).toContain("Request Time");
    expect(evidenceCard?.textContent).toContain("Requester");
    expect(evidenceCard?.textContent).toContain("Ops Admin (ops-admin)");
    expect(evidenceCard?.textContent).toContain("Target");
    expect(evidenceCard?.textContent).toContain("Runtime Service (runtime-service)");
    expect(evidenceCard?.textContent).toContain("Impact");
    expect(metadataCard?.textContent).toContain("Approval Id");
  });

  it("submits approval decisions from the shared queue for admins only after confirmation", async () => {
    fetchApprovalsMock
      .mockResolvedValueOnce({
        status: "ok",
        approvals: [createApprovalSummary()],
      })
      .mockResolvedValueOnce({
        status: "ok",
        approvals: [],
      });

    await renderApprovalsPage(adminSession);

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

    expect(approveApprovalMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Approve execution request?");

    const confirmApproveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Approve request"));
    expect(confirmApproveButton).not.toBeNull();

    await act(async () => {
      confirmApproveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(approveApprovalMock).toHaveBeenCalledWith(
      "run:tenant-acme:approval-1",
      "Approve the waiting provider sync after reviewing the recorded evidence.",
    );
    expect(container.textContent).toContain("Execution run queued to resume");
  });

  it("maps execution approval copy to the queued resume transition", () => {
    const detail = createApprovalDetail({
      status: "approved",
      actions: {
        can_approve: false,
        can_reject: false,
        decision_blocked_reason: "approval_not_open",
      },
      evidence: {
        gate_key: "provider.sync.approval",
        resume_disposition: "resume",
        run_state: "queued",
        run_kind: "provider_sync",
      },
    });

    expect(describeApprovalBanner(detail)).toMatchObject({
      tone: "success",
      title: "Execution run queued to resume",
    });
    expect(describeApprovalMutationMessage(detail)).toBe("Execution run queued to resume.");
  });

  it("distinguishes failed, cancel, and compensating execution outcomes after rejection", () => {
    const failedDetail = createApprovalDetail({
      status: "rejected",
      actions: {
        can_approve: false,
        can_reject: false,
        decision_blocked_reason: "approval_not_open",
      },
      evidence: {
        gate_key: "provider.sync.approval",
        resume_disposition: "fail",
        run_state: "failed",
        run_kind: "provider_sync",
      },
    });
    const cancelDetail = createApprovalDetail({
      status: "rejected",
      actions: {
        can_approve: false,
        can_reject: false,
        decision_blocked_reason: "approval_not_open",
      },
      evidence: {
        gate_key: "provider.sync.approval",
        resume_disposition: "cancel",
        run_state: "cancel_requested",
        run_kind: "provider_sync",
      },
    });
    const compensatingDetail = createApprovalDetail({
      status: "rejected",
      actions: {
        can_approve: false,
        can_reject: false,
        decision_blocked_reason: "approval_not_open",
      },
      evidence: {
        gate_key: "provider.sync.approval",
        resume_disposition: "compensate",
        run_state: "compensating",
        run_kind: "provider_sync",
      },
    });

    expect(describeApprovalBanner(failedDetail)).toMatchObject({
      tone: "danger",
      title: "Execution run moved to failed",
    });
    expect(describeApprovalMutationMessage(failedDetail)).toBe("Execution run moved to failed.");

    expect(describeApprovalBanner(cancelDetail)).toMatchObject({
      tone: "warning",
      title: "Execution run entered cancel flow",
    });
    expect(describeApprovalMutationMessage(cancelDetail)).toBe("Execution run entered cancel flow.");

    expect(describeApprovalBanner(compensatingDetail)).toMatchObject({
      tone: "warning",
      title: "Execution run entered compensating flow",
    });
    expect(describeApprovalMutationMessage(compensatingDetail)).toBe("Execution run entered compensating flow.");
  });

  it("keeps operator sessions in review-only mode", async () => {
    fetchApprovalDetailMock.mockResolvedValueOnce({
      status: "ok",
      approval: createApprovalDetail({
        actions: {
          can_approve: false,
          can_reject: false,
          decision_blocked_reason: "admin_role_required",
        },
      }),
    });

    await renderApprovalsPage(operatorSession);

    expect(container.textContent).toContain("Review only");
    expect(container.textContent).toContain("do not have permission to approve or reject");
    expect(container.textContent).not.toContain("Review approval");
  });

  it("uses elevated-access confirmation copy before approving access", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [
        createApprovalSummary({
          approval_id: "elevated:elev_req_alpha",
          source_kind: "elevated_access",
          native_approval_id: "elev_req_alpha",
          approval_type: "break_glass",
          title: "Break-glass approval for Operator",
        }),
      ],
    });
    fetchApprovalDetailMock.mockResolvedValueOnce({
      status: "ok",
      approval: createApprovalDetail({
        approval_id: "elevated:elev_req_alpha",
        source_kind: "elevated_access",
        native_approval_id: "elev_req_alpha",
        approval_type: "break_glass",
        title: "Break-glass approval for Operator",
      }),
    });
    approveApprovalMock.mockResolvedValueOnce({
      status: "ok",
      approval: createApprovalDetail({
        approval_id: "elevated:elev_req_alpha",
        source_kind: "elevated_access",
        native_approval_id: "elev_req_alpha",
        approval_type: "break_glass",
        title: "Break-glass approval for Operator",
        status: "approved",
        ready_to_issue: true,
        actions: {
          can_approve: false,
          can_reject: false,
          decision_blocked_reason: "approval_not_open",
          approve_blocked_reason: "approval_not_open",
          reject_blocked_reason: "approval_not_open",
        },
      }),
    });

    await renderApprovalsPage(adminSession);

    const noteField = container.querySelector<HTMLTextAreaElement>("textarea");
    const reviewApproveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Review access approval"));

    expect(noteField).not.toBeNull();
    expect(reviewApproveButton).not.toBeNull();

    await act(async () => {
      setControlValue(noteField!, "Approve because the elevated-access evidence and requester identity are verified.");
    });

    await act(async () => {
      reviewApproveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(approveApprovalMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Approve access request?");
    expect(container.textContent).toContain("The requester must start the elevated session separately from Security & Policies");

    const confirmApproveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Approve access"));
    expect(confirmApproveButton).not.toBeNull();

    await act(async () => {
      confirmApproveButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(approveApprovalMock).toHaveBeenCalledWith(
      "elevated:elev_req_alpha",
      "Approve because the elevated-access evidence and requester identity are verified.",
    );
  });

  it("keeps reject available and shows conflict truth when approval is approve-blocked by an active session", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [
        createApprovalSummary({
          approval_id: "elevated:elev_req_conflict",
          source_kind: "elevated_access",
          native_approval_id: "elev_req_conflict",
          approval_type: "impersonation",
          title: "Impersonation approval for Conflict Target",
        }),
      ],
    });
    fetchApprovalDetailMock.mockResolvedValueOnce({
      status: "ok",
      approval: createApprovalDetail({
        approval_id: "elevated:elev_req_conflict",
        source_kind: "elevated_access",
        native_approval_id: "elev_req_conflict",
        approval_type: "impersonation",
        title: "Impersonation approval for Conflict Target",
        source: {
          request_id: "elev_req_conflict",
          request_type: "impersonation",
          issued_session_id: null,
          issued_at: null,
          issued_by_user_id: null,
          issued_by_username: null,
          active_session_conflict: true,
          conflicting_session_id: "session-conflict",
          conflicting_session_type: "break_glass",
          conflicting_subject_user_id: "user-target",
          conflicting_session_expires_at: "2026-04-21T23:30:00Z",
        },
        actions: {
          can_approve: false,
          can_reject: true,
          decision_blocked_reason: "elevated_access_active_session_conflict",
          approve_blocked_reason: "elevated_access_active_session_conflict",
          reject_blocked_reason: null,
        },
      }),
    });
    rejectApprovalMock.mockResolvedValueOnce({
      status: "ok",
      approval: createApprovalDetail({
        approval_id: "elevated:elev_req_conflict",
        source_kind: "elevated_access",
        native_approval_id: "elev_req_conflict",
        approval_type: "impersonation",
        title: "Impersonation approval for Conflict Target",
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

    await renderApprovalsPage(adminSession);

    const noteField = container.querySelector<HTMLTextAreaElement>("textarea");
    const approveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Review access approval"));
    const rejectButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Review rejection"));

    expect(container.textContent).toContain("Active elevated session already exists");
    expect(container.textContent).toContain("Approve stays blocked until that session ends or is revoked.");
    expect(container.textContent).toContain("You can still reject this request from the shared queue");
    expect(noteField).not.toBeNull();
    expect(approveButton).not.toBeNull();
    expect(rejectButton).not.toBeNull();

    await act(async () => {
      setControlValue(noteField!, "Reject because the requester already has an active elevated session.");
    });

    expect((approveButton as HTMLButtonElement).disabled).toBe(true);
    expect((rejectButton as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      rejectButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(rejectApprovalMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Reject request?");

    const confirmRejectButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Reject request");
    expect(confirmRejectButton).not.toBeNull();

    await act(async () => {
      confirmRejectButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(rejectApprovalMock).toHaveBeenCalledWith(
      "elevated:elev_req_conflict",
      "Reject because the requester already has an active elevated session.",
    );
  });

  it("accepts request-scoped deep links into approval detail", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [
        createApprovalSummary({
          approval_id: "elevated:elev_req_alpha",
          source_kind: "elevated_access",
          native_approval_id: "elev_req_alpha",
          approval_type: "break_glass",
          title: "Break-glass approval for Operator",
        }),
      ],
    });
    fetchApprovalDetailMock.mockResolvedValueOnce({
      status: "ok",
      approval: createApprovalDetail({
        approval_id: "elevated:elev_req_alpha",
        source_kind: "elevated_access",
        native_approval_id: "elev_req_alpha",
        approval_type: "break_glass",
        title: "Break-glass approval for Operator",
      }),
    });

    await renderIntoDom(withAppContext({
      path: "/approvals?status=all&approvalId=elevated%3Aelev_req_alpha",
      element: <ApprovalsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchApprovalsMock).toHaveBeenCalledWith("all");
    expect(fetchApprovalDetailMock).toHaveBeenCalledWith("elevated:elev_req_alpha");
    expect(container.textContent).toContain("Break-glass approval for Operator");
  });

  it("exposes the request-scoped audit history route for elevated-access approvals", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [
        createApprovalSummary({
          approval_id: "elevated:elev_req_alpha",
          source_kind: "elevated_access",
          native_approval_id: "elev_req_alpha",
          approval_type: "break_glass",
          title: "Break-glass approval for Operator",
        }),
      ],
    });
    fetchApprovalDetailMock.mockResolvedValueOnce({
      status: "ok",
      approval: createApprovalDetail({
        approval_id: "elevated:elev_req_alpha",
        source_kind: "elevated_access",
        native_approval_id: "elev_req_alpha",
        approval_type: "break_glass",
        title: "Break-glass approval for Operator",
      }),
    });

    await renderApprovalsPage(adminSession);

    const auditLinks = Array.from(container.querySelectorAll("a"))
      .filter((link) => link.textContent === "Open Audit History")
      .map((link) => link.getAttribute("href"));

    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      window: "all",
      targetType: "elevated_access_request",
      targetId: "elev_req_alpha",
      limit: 1,
    });
    expect(auditLinks).toContain(
      "/logs?auditWindow=all&auditTargetType=elevated_access_request&auditTargetId=elev_req_alpha&auditEvent=audit_evt_elevated_request#audit-history",
    );
  });

  it("preserves the elevated-access request scope when no newest audit event resolves", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [
        createApprovalSummary({
          approval_id: "elevated:elev_req_alpha",
          source_kind: "elevated_access",
          native_approval_id: "elev_req_alpha",
          approval_type: "break_glass",
          title: "Break-glass approval for Operator",
        }),
      ],
    });
    fetchApprovalDetailMock.mockResolvedValueOnce({
      status: "ok",
      approval: createApprovalDetail({
        approval_id: "elevated:elev_req_alpha",
        source_kind: "elevated_access",
        native_approval_id: "elev_req_alpha",
        approval_type: "break_glass",
        title: "Break-glass approval for Operator",
      }),
    });
    fetchAuditHistoryMock.mockImplementation(async (query?: { targetType?: string | null; targetId?: string | null }) => {
      if (query?.targetType === "elevated_access_request" && query?.targetId === "elev_req_alpha") {
        return {
          status: "ok",
          items: [],
          page: { limit: 1, nextCursor: null, hasMore: false },
          retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
          filters: {
            applied: {
              window: "all",
              action: null,
              actor: null,
              targetType: "elevated_access_request",
              targetId: "elev_req_alpha",
              status: null,
            },
            available: { actions: [], statuses: [], targetTypes: [] },
          },
          summary: { totalInScope: 0, totalMatchingFilters: 0, latestEventAt: null },
        };
      }

      const eventId = query?.targetType === "elevated_access_request" ? "audit_evt_elevated_request" : "audit_evt_execution_approval";
      return {
        status: "ok",
        items: [
          {
            eventId,
            createdAt: "2026-04-21T22:10:00Z",
            tenantId: null,
            companyId: "tenant-acme",
            actionKey: "execution_approval_approved",
            actionLabel: "Execution approval approved",
            status: "ok",
            statusLabel: "Succeeded",
            actor: { type: "admin_user", id: "user-admin", label: "Admin", secondary: "admin" },
            target: { type: query?.targetType ?? "execution_approval", typeLabel: "Execution approval", id: query?.targetId ?? "run:tenant-acme:approval-1", label: "Approval", secondary: null },
            summary: "Approval updated.",
            detailAvailable: true,
          },
        ],
        page: { limit: 1, nextCursor: null, hasMore: false },
        retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
        filters: { applied: { window: "all", action: null, actor: null, targetType: query?.targetType ?? null, targetId: query?.targetId ?? null, status: null }, available: { actions: [], statuses: [], targetTypes: [] } },
        summary: { totalInScope: 1, totalMatchingFilters: 1, latestEventAt: "2026-04-21T22:10:00Z" },
      };
    });

    await renderApprovalsPage(adminSession);

    const auditLinks = Array.from(container.querySelectorAll("a"))
      .filter((link) => link.textContent === "Open Audit History")
      .map((link) => link.getAttribute("href"));

    expect(auditLinks).toContain(
      "/logs?auditWindow=all&auditTargetType=elevated_access_request&auditTargetId=elev_req_alpha#audit-history",
    );
  });

  it("keeps a deep-linked approval detail pinned when the queue payload omits it", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [createApprovalSummary()],
    });
    fetchApprovalDetailMock.mockResolvedValueOnce({
      status: "ok",
      approval: createApprovalDetail({
        approval_id: "elevated:elev_req_archived",
        source_kind: "elevated_access",
        native_approval_id: "elev_req_archived",
        approval_type: "break_glass",
        title: "Break-glass approval for Archived Request",
      }),
    });

    await renderIntoDom(withAppContext({
      path: "/approvals?status=all&approvalId=elevated%3Aelev_req_archived",
      element: <ApprovalsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchApprovalsMock).toHaveBeenCalledWith("all");
    expect(fetchApprovalDetailMock).toHaveBeenCalledTimes(1);
    expect(fetchApprovalDetailMock).toHaveBeenCalledWith("elevated:elev_req_archived");
    expect(container.textContent).toContain("Break-glass approval for Archived Request");
  });

  it("adds an explicit requester filter to the shared queue", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [
        createApprovalSummary(),
        createApprovalSummary({
          approval_id: "elevated:elev_req_beta",
          source_kind: "elevated_access",
          native_approval_id: "elev_req_beta",
          approval_type: "impersonation",
          title: "Impersonation approval for Security Target",
          opened_at: "2026-04-22T08:30:00Z",
          requester: {
            user_id: "requester-2",
            username: "security-reviewer",
            display_name: "Security Reviewer",
          },
          target: {
            user_id: "target-2",
            username: "security-target",
            display_name: "Security Target",
            role: "operator",
          },
        }),
      ],
    });

    await renderApprovalsPage(adminSession);

    const requesterSelect = findLabeledControl<HTMLSelectElement>("Requester", "select");
    expect(requesterSelect).not.toBeNull();

    await act(async () => {
      setSelectValue(requesterSelect!, "user:requester-2");
    });
    await flushEffects();

    const queueText = container.querySelector("[aria-label='Approval queue']")?.textContent ?? "";
    expect(queueText).toContain("Impersonation approval for Security Target");
    expect(queueText).not.toContain("Execution approval for provider_sync");
    expect(container.textContent).toContain("Reviewing 1 matching item in this queue slice.");
    expect(container.textContent).toContain("Requester: Security Reviewer (security-reviewer)");
  });

  it("adds an explicit opened-at window filter to the shared queue", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [
        createApprovalSummary({
          approval_id: "run:tenant-acme:approval-recent",
          native_approval_id: "approval-recent",
          title: "Execution approval for recent provider sync",
          opened_at: "2026-04-22T06:00:00Z",
        }),
        createApprovalSummary({
          approval_id: "elevated:elev_req_old",
          source_kind: "elevated_access",
          native_approval_id: "elev_req_old",
          approval_type: "break_glass",
          title: "Break-glass approval for Older Request",
          opened_at: "2026-04-18T09:00:00Z",
        }),
      ],
    });

    await renderApprovalsPage(adminSession);

    const openedAtSelect = findLabeledControl<HTMLSelectElement>("Opened at", "select");
    expect(openedAtSelect).not.toBeNull();

    await act(async () => {
      setSelectValue(openedAtSelect!, "24h");
    });
    await flushEffects();

    const queueText = container.querySelector("[aria-label='Approval queue']")?.textContent ?? "";
    expect(queueText).toContain("Execution approval for recent provider sync");
    expect(queueText).not.toContain("Break-glass approval for Older Request");
    expect(container.textContent).toContain("Reviewing 1 matching item in this queue slice.");
    expect(container.textContent).toContain("Opened at: Last 24 hours");
  });

  it("keeps an empty non-open status slice honest about the current queue view", async () => {
    fetchApprovalsMock.mockResolvedValueOnce({
      status: "ok",
      approvals: [],
    });

    await renderIntoDom(withAppContext({
      path: "/approvals?status=approved",
      element: <ApprovalsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchApprovalsMock).toHaveBeenCalledWith("approved");
    expect(container.textContent).toContain("Approved slice is empty right now.");
    expect(container.textContent).toContain("Status: Approved");
    expect(container.textContent).not.toContain("No approvals waiting.");
  });

  it("keeps viewers on the fallback instead of opening the queue", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/approvals",
        element: <ApprovalsPage />,
        session: viewerSession,
      }),
    );

    expect(markup).toContain("This route is reserved for operators and admins");
    expect(markup).toContain("Operator or admin required");
    expect(markup).toContain("Runtime Access Review");
  });
});
