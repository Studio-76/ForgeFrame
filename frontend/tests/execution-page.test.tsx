// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchApprovalsMock,
  fetchExecutionRunsMock,
  fetchExecutionRunDetailMock,
  replayExecutionRunMock,
} = vi.hoisted(() => ({
  fetchApprovalsMock: vi.fn(),
  fetchExecutionRunsMock: vi.fn(),
  fetchExecutionRunDetailMock: vi.fn(),
  replayExecutionRunMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchApprovals: fetchApprovalsMock,
    fetchExecutionRuns: fetchExecutionRunsMock,
    fetchExecutionRunDetail: fetchExecutionRunDetailMock,
    replayExecutionRun: replayExecutionRunMock,
  };
});

import { AdminApiError, type AdminSessionUser, type ExecutionRunDetail, type ExecutionRunSummary } from "../src/api/admin";
import { ExecutionPage } from "../src/pages/ExecutionPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

const readOnlyOperatorSession: AdminSessionUser = {
  session_id: "session-operator-read-only",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
  session_type: "impersonation",
  read_only: true,
};

const viewerSession: AdminSessionUser = {
  session_id: "session-viewer",
  user_id: "user-viewer",
  username: "viewer",
  display_name: "Viewer",
  role: "viewer",
};

function createRunSummary(overrides: Partial<ExecutionRunSummary> = {}): ExecutionRunSummary {
  return {
    run_id: "run_alpha",
    run_kind: "provider_dispatch",
    state: "dead_lettered",
    issue_id: "FOR-162",
    active_attempt_no: 1,
    failure_class: "provider_terminal",
    status_reason: "terminal_failure",
    current_attempt: {
      id: "attempt_alpha",
      attempt_no: 1,
      attempt_state: "dead_lettered",
      retry_count: 0,
      scheduled_at: "2026-04-21T21:00:00Z",
      started_at: "2026-04-21T21:01:00Z",
      finished_at: "2026-04-21T21:02:00Z",
      version: 1,
    },
    next_wakeup_at: null,
    terminal_at: "2026-04-21T21:02:00Z",
    result_summary: {
      error_code: "provider_authentication_error",
    },
    replayable: true,
    created_at: "2026-04-21T21:00:00Z",
    updated_at: "2026-04-21T21:02:00Z",
    ...overrides,
  };
}

function createRunDetail(overrides: Partial<ExecutionRunDetail> = {}): ExecutionRunDetail {
  return {
    ...createRunSummary(),
    attempts: [
      {
        id: "attempt_alpha",
        attempt_no: 1,
        attempt_state: "dead_lettered",
        retry_count: 0,
        scheduled_at: "2026-04-21T21:00:00Z",
        started_at: "2026-04-21T21:01:00Z",
        finished_at: "2026-04-21T21:02:00Z",
        last_error_code: "provider_authentication_error",
        last_error_detail: "credentials rejected by upstream",
        version: 1,
      },
    ],
    commands: [
      {
        id: "command_alpha",
        command_type: "create",
        command_status: "completed",
        actor_type: "agent",
        actor_id: "agent_backend",
        idempotency_key: "idem_seed_dead_letter",
        accepted_transition: "queued",
        response_snapshot: { replay_reason: null },
        issued_at: "2026-04-21T21:00:00Z",
        completed_at: "2026-04-21T21:00:01Z",
      },
    ],
    outbox: [
      {
        id: "outbox_alpha",
        event_type: "dead_letter",
        publish_state: "published",
        available_at: "2026-04-21T21:02:00Z",
        publish_attempts: 1,
        published_at: "2026-04-21T21:02:05Z",
        dead_lettered_at: null,
        last_publish_error: null,
        payload: { run_id: "run_alpha" },
      },
    ],
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root | null = null;

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement | HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

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

async function renderExecutionPage(path: string, session: AdminSessionUser) {
  await renderIntoDom(withAppContext({
    path,
    element: <ExecutionPage />,
    session,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchApprovalsMock.mockResolvedValue({
    status: "ok",
    approvals: [
      {
        approval_id: "run:company_alpha:approval-1",
        source_kind: "execution_run",
        native_approval_id: "approval-1",
        approval_type: "execution_run",
        status: "open",
        title: "Execution approval for company alpha",
        opened_at: "2026-04-21T22:00:00Z",
        decided_at: null,
        expires_at: null,
        company_id: "company_alpha",
        issue_id: "FOR-183",
        requester: null,
        target: null,
        decision_actor: null,
        ready_to_issue: false,
        session_status: null,
      },
    ],
  });
  fetchExecutionRunsMock.mockResolvedValue({
    status: "ok",
    runs: [createRunSummary()],
  });
  fetchExecutionRunDetailMock.mockResolvedValue({
    status: "ok",
    run: createRunDetail(),
  });
  replayExecutionRunMock.mockResolvedValue({
    status: "ok",
    replay: {
      command_id: "command_retry",
      run_id: "run_alpha",
      attempt_id: "attempt_retry",
      run_state: "queued",
      outbox_event: "run_dispatch",
      deduplicated: false,
      replay_reason: "Replay after provider credentials were rotated and verified.",
      audit: {
        event_id: "audit_evt_execution_replay",
        action: "execution_run_replay",
        target_type: "execution_run",
        target_id: "run_alpha",
        status: "ok",
        tenant_id: "tenant_default",
        company_id: "company_alpha",
      },
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

describe("Execution page operator workflow", () => {
  it("shows a scoped chooser instead of locking the default route into an unavailable baseline", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/execution",
        element: <ExecutionPage />,
        session: operatorSession,
      }),
    );

    expect(markup).toContain("Company scope required");
    expect(markup).toContain("Choose execution scope");
    expect(markup).toContain("route no longer assumes operators must hand-type raw query params");
  });

  it("loads approval-backed execution scope choices and opens the selected scope without manual typing", async () => {
    await renderExecutionPage("/execution", operatorSession);

    expect(fetchApprovalsMock).toHaveBeenCalledWith("all");
    await flushEffects();

    const scopeButton = container.querySelector<HTMLButtonElement>("button.fg-data-row");
    expect(scopeButton).not.toBeNull();

    await act(async () => {
      scopeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(fetchExecutionRunsMock).toHaveBeenCalledWith({
      companyId: "company_alpha",
      limit: 50,
      state: undefined,
    });
    expect(container.textContent).toContain("Scope: company_alpha");
  });

  it("loads company-scoped list and detail state for operator sessions", async () => {
    await renderExecutionPage("/execution?companyId=company_alpha", operatorSession);

    expect(fetchExecutionRunsMock).toHaveBeenCalledWith({
      companyId: "company_alpha",
      limit: 50,
      state: "dead_lettered",
    });
    expect(fetchExecutionRunDetailMock).toHaveBeenCalledWith("run_alpha", { companyId: "company_alpha" });
    expect(container.textContent).toContain("run_alpha");
    expect(container.textContent).toContain("Replay ready");
    expect(container.textContent).toContain("provider_authentication_error");
  });

  it("keeps read-only sessions on execution inspection while blocking replay controls", async () => {
    await renderExecutionPage("/execution?companyId=company_alpha", readOnlyOperatorSession);

    expect(fetchExecutionRunsMock).toHaveBeenCalledWith({
      companyId: "company_alpha",
      limit: 50,
      state: "dead_lettered",
    });
    expect(fetchExecutionRunDetailMock).toHaveBeenCalledWith("run_alpha", { companyId: "company_alpha" });
    expect(container.textContent).toContain("Read-only execution review");
    expect(container.textContent).toContain("Replay unavailable");
    expect(container.textContent).toContain("inspect-only");
    expect(container.querySelector('textarea[aria-label="Execution replay reason"]')).toBeNull();
  });

  it("keeps viewers on the operator/admin fallback instead of loading company-scoped execution truth", async () => {
    await renderExecutionPage("/execution?companyId=company_alpha", viewerSession);

    expect(fetchApprovalsMock).not.toHaveBeenCalled();
    expect(fetchExecutionRunsMock).not.toHaveBeenCalled();
    expect(fetchExecutionRunDetailMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("reserved for operator and admin sessions");
    expect(container.textContent).toContain("Operator or admin required");
    expect(container.textContent).toContain("blocks company-scoped execution list/detail APIs and replay on this route");
  });

  it("surfaces replay conflicts without hiding backend state transitions", async () => {
    replayExecutionRunMock.mockRejectedValueOnce(
      new AdminApiError("Replay already exists for this run and idempotency key.", 409, "idempotency_fingerprint_mismatch"),
    );

    await renderExecutionPage("/execution?companyId=company_alpha", operatorSession);

    const reason = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Execution replay reason"]');
    const form = container.querySelector<HTMLFormElement>("form.fg-stack");

    expect(reason).not.toBeNull();
    expect(form).not.toBeNull();

    await act(async () => {
      setInputValue(reason!, "Replay after provider credentials were rotated and verified.");
    });

    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(replayExecutionRunMock).toHaveBeenCalledWith("run_alpha", {
      companyId: "company_alpha",
      idempotencyKey: "",
      reason: "Replay after provider credentials were rotated and verified.",
    });
    expect(container.textContent).toContain("Reuse the same replay reason for that key or provide a new idempotency key.");
  });

  it("exposes a one-click audit history return path after replay admission", async () => {
    await renderExecutionPage("/execution?companyId=company_alpha", operatorSession);

    const reason = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Execution replay reason"]');
    const form = container.querySelector<HTMLFormElement>("form.fg-stack");

    expect(reason).not.toBeNull();
    expect(form).not.toBeNull();

    await act(async () => {
      setInputValue(reason!, "Replay after provider credentials were rotated and verified.");
    });

    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Audit History");
    expect(container.textContent).toContain("Audit event: audit_evt_execution_replay");
    expect(auditLink?.getAttribute("href")).toBe(
      "/logs?companyId=company_alpha&auditWindow=all&auditAction=execution_run_replay&auditTargetType=execution_run&auditTargetId=run_alpha&auditStatus=ok&auditEvent=audit_evt_execution_replay#audit-history",
    );
  });
});
