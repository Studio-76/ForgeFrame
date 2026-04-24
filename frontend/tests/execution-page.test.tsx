// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  escalateExecutionRunMock,
  fetchInstancesMock,
  fetchExecutionRunsMock,
  fetchExecutionRunDetailMock,
  interruptExecutionRunMock,
  pauseExecutionRunMock,
  quarantineExecutionRunMock,
  restartExecutionRunMock,
  replayExecutionRunMock,
  resumeExecutionRunMock,
} = vi.hoisted(() => ({
  escalateExecutionRunMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
  fetchExecutionRunsMock: vi.fn(),
  fetchExecutionRunDetailMock: vi.fn(),
  interruptExecutionRunMock: vi.fn(),
  pauseExecutionRunMock: vi.fn(),
  quarantineExecutionRunMock: vi.fn(),
  restartExecutionRunMock: vi.fn(),
  replayExecutionRunMock: vi.fn(),
  resumeExecutionRunMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    escalateExecutionRun: escalateExecutionRunMock,
    fetchInstances: fetchInstancesMock,
    fetchExecutionRuns: fetchExecutionRunsMock,
    fetchExecutionRunDetail: fetchExecutionRunDetailMock,
    interruptExecutionRun: interruptExecutionRunMock,
    pauseExecutionRun: pauseExecutionRunMock,
    quarantineExecutionRun: quarantineExecutionRunMock,
    replayExecutionRun: replayExecutionRunMock,
    restartExecutionRun: restartExecutionRunMock,
    resumeExecutionRun: resumeExecutionRunMock,
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
    instance_id: "instance_alpha",
    workspace_id: "ws_alpha",
    run_id: "run_alpha",
    run_kind: "provider_dispatch",
    state: "dead_lettered",
    operator_state: "quarantined",
    execution_lane: "background_agentic",
    issue_id: "FOR-162",
    active_attempt_no: 1,
    failure_class: "provider_terminal",
    status_reason: "terminal_failure",
    current_attempt: {
      id: "attempt_alpha",
      attempt_no: 1,
      attempt_state: "dead_lettered",
      operator_state: "quarantined",
      lease_status: "released",
      worker_key: null,
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
      routing: {
        summary: "Blocked after premium provider authentication failure.",
        decision_id: "route_alpha",
        selected_target_key: "openai_api::gpt-4.1-mini",
        classification: "non_simple",
        policy_stage: "runtime_dispatch",
        structured_details: {
          eligible_targets: ["openai_api::gpt-4.1-mini"],
          blocked_cost_classes: ["premium"],
        },
        raw_details: {
          selected_target_key: "openai_api::gpt-4.1-mini",
          provider_key: "openai_api",
        },
      },
      dispatch: {
        stage: "dead_lettered",
        execution_lane: "background_agentic",
        operator_state: "quarantined",
        attempt_id: "attempt_alpha",
        run_id: "run_alpha",
      },
      wake_gate: {
        claim_allowed: false,
        spurious_wake_blocked: false,
        next_wakeup_at: null,
        closed_at: "2026-04-21T21:02:00Z",
      },
      last_failure: {
        error_code: "provider_authentication_error",
        retryable: false,
        attempt_no: 1,
        retry_count: 0,
        max_attempts: 3,
        next_attempt_id: null,
      },
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
        operator_state: "quarantined",
        lease_status: "released",
        worker_key: null,
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
    workspace: {
      workspace_id: "ws_alpha",
      instance_id: "instance_alpha",
      company_id: "company_alpha",
      issue_id: "FOR-162",
      title: "Alpha workspace",
      summary: "Linked workspace",
      status: "previewing",
      preview_status: "ready",
      review_status: "pending",
      handoff_status: "not_ready",
      owner_type: "user",
      owner_id: "user-admin",
      active_run_id: "run_alpha",
      latest_approval_id: "run:instance_alpha:company_alpha:approval-1",
      preview_artifact_id: "artifact_preview",
      handoff_artifact_id: null,
      pr_reference: null,
      handoff_reference: null,
      metadata: {},
      run_count: 1,
      approval_count: 1,
      artifact_count: 1,
      latest_event_at: "2026-04-21T21:03:00Z",
      created_at: "2026-04-21T20:55:00Z",
      updated_at: "2026-04-21T21:03:00Z",
    },
    artifacts: [
      {
        artifact_id: "artifact_preview",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        workspace_id: "ws_alpha",
        artifact_type: "preview_link",
        label: "Preview package",
        uri: "https://forgeframe.local/previews/ws_alpha",
        media_type: "text/html",
        preview_url: "https://forgeframe.local/previews/ws_alpha",
        size_bytes: 4096,
        status: "active",
        created_by_type: "user",
        created_by_id: "user-admin",
        metadata: {},
        attachments: [],
        created_at: "2026-04-21T21:02:10Z",
        updated_at: "2026-04-21T21:02:10Z",
      },
    ],
    native_mapping: {
      object: "forgeframe.native_mapping",
      mapping_version: "2026-04-v1",
      contract_surface: "forgeframe_execution",
      request_path: "/admin/execution/runs/run_alpha",
      response_id: "resp_alpha",
      processing_mode: "background",
      stream: false,
      background: true,
      primary_native_object_kind: "run",
      objects: [
        {
          kind: "run",
          object_id: "run_alpha",
          relation: "primary_object",
          lifecycle_state: "dead_lettered",
          details: {
            operator_state: "quarantined",
            execution_lane: "background_agentic",
          },
        },
        {
          kind: "dispatch_job",
          object_id: "attempt_alpha",
          relation: "current_attempt",
          lifecycle_state: "dead_lettered",
          details: {
            operator_state: "quarantined",
            lease_status: "released",
          },
        },
      ],
      events: [
        {
          event_kind: "blocker_event",
          related_object_kind: "run",
          related_object_id: "run_alpha",
          status: "dead_lettered",
          details: {
            status_reason: "terminal_failure",
          },
        },
      ],
      commands: [
        {
          command_kind: "start_run",
          command_id: "command_alpha",
          status: "completed",
          actor_type: "agent",
          actor_id: "agent_backend",
          details: {
            raw_command_type: "create",
          },
        },
      ],
      views: [
        {
          view_kind: "action_preview",
          available: true,
          label: "Preview package",
          details: {
            artifact_id: "artifact_preview",
          },
        },
      ],
      route_context: {
        run_id: "run_alpha",
        execution_lane: "background_agentic",
      },
      notes: ["This execution run is the durable native follow-object behind a background /v1/responses request."],
    },
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
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [
      {
        instance_id: "instance_alpha",
        slug: "instance-alpha",
        display_name: "Alpha Instance",
        description: "Alpha execution scope",
        status: "active",
        tenant_id: "tenant_alpha",
        company_id: "company_alpha",
        deployment_mode: "restricted_eval",
        exposure_mode: "local_only",
        is_default: true,
        metadata: {},
        created_at: "2026-04-22T08:00:00Z",
        updated_at: "2026-04-22T08:00:00Z",
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
      operator_state: "admitted",
      execution_lane: "background_agentic",
      outbox_event: "run_dispatch",
      deduplicated: false,
      replay_reason: "Replay after provider credentials were rotated and verified.",
      audit: {
        event_id: "audit_evt_execution_replay",
        action: "execution_run_replay",
        target_type: "execution_run",
        target_id: "run_alpha",
        status: "ok",
        instance_id: "instance_alpha",
        tenant_id: "tenant_alpha",
        company_id: "company_alpha",
      },
    },
  });
  pauseExecutionRunMock.mockResolvedValue({
    status: "ok",
    action: {
      command_id: "command_pause",
      run_id: "run_alpha",
      attempt_id: "attempt_alpha",
      run_state: "dead_lettered",
      operator_state: "paused",
      execution_lane: "background_agentic",
      outbox_event: null,
      reason: "Pause while waiting for operator review.",
    },
  });
  resumeExecutionRunMock.mockResolvedValue({
    status: "ok",
    action: {
      command_id: "command_resume",
      run_id: "run_alpha",
      attempt_id: "attempt_alpha",
      run_state: "dead_lettered",
      operator_state: "quarantined",
      execution_lane: "background_agentic",
      outbox_event: null,
      reason: "Resume after operator review.",
    },
  });
  interruptExecutionRunMock.mockResolvedValue({
    status: "ok",
    action: {
      command_id: "command_interrupt",
      run_id: "run_alpha",
      attempt_id: "attempt_alpha",
      run_state: "cancel_requested",
      operator_state: "interrupted",
      execution_lane: "background_agentic",
      outbox_event: "run_cancel",
      reason: "Interrupt before upstream damage spreads.",
    },
  });
  quarantineExecutionRunMock.mockResolvedValue({
    status: "ok",
    action: {
      command_id: "command_quarantine",
      run_id: "run_alpha",
      attempt_id: "attempt_alpha",
      run_state: "dead_lettered",
      operator_state: "quarantined",
      execution_lane: "background_agentic",
      outbox_event: "dead_letter",
      reason: "Quarantine after repeated provider failures.",
    },
  });
  restartExecutionRunMock.mockResolvedValue({
    status: "ok",
    action: {
      command_id: "command_restart",
      run_id: "run_restart",
      attempt_id: "attempt_restart",
      related_run_id: "run_alpha",
      run_state: "queued",
      operator_state: "admitted",
      execution_lane: "interactive_heavy",
      outbox_event: "run_dispatch",
      reason: "Restart cleanly on a heavier lane.",
    },
  });
  escalateExecutionRunMock.mockResolvedValue({
    status: "ok",
    action: {
      command_id: "command_escalate",
      run_id: "run_alpha",
      attempt_id: "attempt_alpha",
      run_state: "dead_lettered",
      operator_state: "quarantined",
      execution_lane: "interactive_heavy",
      outbox_event: null,
      reason: "Escalate to interactive heavy for deeper inspection.",
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
  it("shows an instance-backed chooser instead of raw company-id-first routing", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/execution",
        element: <ExecutionPage />,
        session: operatorSession,
      }),
    );

    expect(markup).toContain("Instance scope required");
    expect(markup).toContain("Choose execution scope");
    expect(markup).toContain("real instance registry");
  });

  it("loads execution scope choices from the instance registry and opens the chosen instance", async () => {
    await renderExecutionPage("/execution", operatorSession);

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    const scopeButton = container.querySelector<HTMLButtonElement>("button.fg-data-row");
    expect(scopeButton).not.toBeNull();

    await act(async () => {
      scopeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(fetchExecutionRunsMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      companyId: "",
      limit: 50,
      state: "dead_lettered",
    });
    expect(container.textContent).toContain("Instance: instance_alpha");
  });

  it("loads instance-scoped list and detail state for operator sessions", async () => {
    await renderExecutionPage("/execution?instanceId=instance_alpha", operatorSession);

    expect(fetchExecutionRunsMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      companyId: "",
      limit: 50,
      state: "dead_lettered",
    });
    expect(fetchExecutionRunDetailMock).toHaveBeenCalledWith("run_alpha", { instanceId: "instance_alpha", companyId: "" });
    expect(container.textContent).toContain("run_alpha");
    expect(container.textContent).toContain("Replay ready");
    expect(container.textContent).toContain("provider_authentication_error");
    expect(container.textContent).toContain("Workspace and artifacts");
    expect(container.textContent).toContain("Preview package");
    expect(container.textContent).toContain("Run Explainability");
    expect(container.textContent).toContain("Routing decision");
    expect(container.textContent).toContain("Blocked after premium provider authentication failure.");
    expect(container.textContent).toContain("Wake gate");
    expect(container.textContent).toContain("Native runtime mapping");
    expect(container.textContent).toContain("forgeframe_execution");
    expect(container.textContent).toContain("dispatch_job");
    expect(container.textContent).toContain("blocker_event");
    expect(container.textContent).toContain("action_preview");
    expect(container.textContent).toContain("Raw result summary payload");

    const workspaceLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "ws_alpha");
    expect(workspaceLink?.getAttribute("href")).toBe("/workspaces?instanceId=instance_alpha&workspaceId=ws_alpha");
  });

  it("keeps read-only sessions on inspection while blocking replay controls", async () => {
    await renderExecutionPage("/execution?instanceId=instance_alpha", readOnlyOperatorSession);

    expect(fetchExecutionRunDetailMock).toHaveBeenCalledWith("run_alpha", { instanceId: "instance_alpha", companyId: "" });
    expect(container.textContent).toContain("Read-only execution review");
    expect(container.textContent).toContain("Replay unavailable");
    expect(container.querySelector('textarea[aria-label="Execution replay reason"]')).toBeNull();
  });

  it("keeps viewers on the fallback instead of loading execution truth", async () => {
    await renderExecutionPage("/execution?instanceId=instance_alpha", viewerSession);

    expect(fetchInstancesMock).not.toHaveBeenCalled();
    expect(fetchExecutionRunsMock).not.toHaveBeenCalled();
    expect(fetchExecutionRunDetailMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("reserved for operator and admin sessions");
    expect(container.textContent).toContain("Operator or admin required");
  });

  it("surfaces replay conflicts without hiding backend state transitions", async () => {
    replayExecutionRunMock.mockRejectedValueOnce(
      new AdminApiError("Replay already exists for this run and idempotency key.", 409, "idempotency_fingerprint_mismatch"),
    );

    await renderExecutionPage("/execution?instanceId=instance_alpha", operatorSession);

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
      instanceId: "instance_alpha",
      companyId: "",
      idempotencyKey: "",
      reason: "Replay after provider credentials were rotated and verified.",
    });
    expect(container.textContent).toContain("Reuse the same replay reason for that key or provide a new idempotency key.");
  });

  it("exposes an instance-scoped audit history return path after replay admission", async () => {
    await renderExecutionPage("/execution?instanceId=instance_alpha", operatorSession);

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
      "/logs?instanceId=instance_alpha&companyId=company_alpha&auditWindow=all&auditAction=execution_run_replay&auditTargetType=execution_run&auditTargetId=run_alpha&auditStatus=ok&auditEvent=audit_evt_execution_replay#audit-history",
    );
  });

  it("submits operator controls for pause and lane escalation", async () => {
    await renderExecutionPage("/execution?instanceId=instance_alpha", operatorSession);

    const reason = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Execution operator reason"]');
    const lane = container.querySelector<HTMLSelectElement>('select[aria-label="Execution operator lane"]');
    const pauseButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Pause");
    const escalateButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Escalate");

    expect(reason).not.toBeNull();
    expect(lane).not.toBeNull();
    expect(pauseButton).not.toBeNull();
    expect(escalateButton).not.toBeNull();

    await act(async () => {
      setInputValue(reason!, "Pause while waiting for operator review.");
    });

    await act(async () => {
      pauseButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(pauseExecutionRunMock).toHaveBeenCalledWith("run_alpha", {
      instanceId: "instance_alpha",
      companyId: "",
      reason: "Pause while waiting for operator review.",
      executionLane: "",
    });
    expect(container.textContent).toContain("Operator state: paused");

    const refreshedReason = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Execution operator reason"]');
    const refreshedLane = container.querySelector<HTMLSelectElement>('select[aria-label="Execution operator lane"]');
    const refreshedEscalateButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Escalate");

    expect(refreshedReason).not.toBeNull();
    expect(refreshedLane).not.toBeNull();
    expect(refreshedEscalateButton).not.toBeNull();

    await act(async () => {
      setInputValue(refreshedReason!, "Escalate to interactive heavy for deeper inspection.");
      refreshedLane!.value = "interactive_heavy";
      refreshedLane!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      refreshedEscalateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(escalateExecutionRunMock).toHaveBeenCalledWith("run_alpha", {
      instanceId: "instance_alpha",
      companyId: "",
      reason: "Escalate to interactive heavy for deeper inspection.",
      executionLane: "interactive_heavy",
    });
    expect(container.textContent).toContain("Execution lane: interactive_heavy");
  });
});
