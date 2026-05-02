// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchExecutionDispatchMock,
  fetchInstancesMock,
  reconcileExecutionLeasesMock,
} = vi.hoisted(() => ({
  fetchExecutionDispatchMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
  reconcileExecutionLeasesMock: vi.fn(),
}));

vi.mock("../src/api/admin/execution", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/execution")>("../src/api/admin/execution");
  return {
    ...actual,
    fetchExecutionDispatch: fetchExecutionDispatchMock,
    reconcileExecutionLeases: reconcileExecutionLeasesMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser } from "../src/api/admin";
import { DispatchPage } from "../src/pages/DispatchPage";
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
  ...operatorSession,
  read_only: true,
};

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
}

async function renderDispatchPage(path: string, session: AdminSessionUser = operatorSession) {
  await renderIntoDom(withAppContext({
    path,
    element: <DispatchPage />,
    session,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  const now = Date.now();
  const expiredLeaseAt = new Date(now - 2 * 60_000).toISOString();
  const staleHeartbeatAt = new Date(now - 3 * 60_000).toISOString();
  const futureWakeupAt = new Date(now + 10 * 60_000).toISOString();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [],
  });
  fetchExecutionDispatchMock.mockResolvedValue({
    status: "ok",
    dispatch: {
      outbox_counts: { pending: 2, dead: 1 },
      event_counts: { run_dispatch: 1, run_resume: 1, dead_letter: 1 },
      leased_attempts: [
        {
          run_id: "run_alpha",
          attempt_id: "attempt_alpha",
          run_kind: "provider_dispatch",
          state: "executing",
          operator_state: "waiting_external",
          execution_lane: "background_agentic",
          workspace_id: "workspace_alpha",
          issue_id: "FORGE-23",
          selected_target_key: "openai_api::gpt-4.1-mini",
          worker_key: "worker_alpha",
          lease_status: "leased",
          lease_expires_at: expiredLeaseAt,
          last_heartbeat_at: staleHeartbeatAt,
          next_wakeup_at: futureWakeupAt,
          status_reason: "provider_call",
          updated_at: staleHeartbeatAt,
        },
      ],
      stalled_attempts: [
        {
          run_id: "run_alpha",
          attempt_id: "attempt_alpha",
          run_kind: "provider_dispatch",
          state: "executing",
          operator_state: "waiting_external",
          execution_lane: "background_agentic",
          workspace_id: "workspace_alpha",
          issue_id: "FORGE-23",
          selected_target_key: "openai_api::gpt-4.1-mini",
          worker_key: "worker_alpha",
          lease_status: "leased",
          lease_expires_at: expiredLeaseAt,
          last_heartbeat_at: staleHeartbeatAt,
          next_wakeup_at: futureWakeupAt,
          status_reason: "provider_call",
          updated_at: staleHeartbeatAt,
        },
      ],
      workers: [
        {
          worker_key: "worker_alpha",
          worker_state: "stale",
          instance_id: "instance_alpha",
          execution_lane: "background_agentic",
          active_attempts: 1,
          leased_runs: ["run_alpha"],
          current_run_id: "run_alpha",
          current_attempt_id: "attempt_alpha",
          oldest_lease_expires_at: expiredLeaseAt,
          heartbeat_expires_at: expiredLeaseAt,
          last_heartbeat_at: staleHeartbeatAt,
          last_claimed_at: staleHeartbeatAt,
          last_completed_at: null,
          last_error_code: "lease_expired",
          last_error_detail: "worker stopped renewing lease",
        },
      ],
      quarantined_runs: 1,
      paused_runs: 0,
      waiting_on_approval_runs: 0,
    },
  });
  reconcileExecutionLeasesMock.mockResolvedValue({
    status: "ok",
    reconciled: [
      {
        run_id: "run_alpha",
        attempt_id: "attempt_alpha",
        reconciled_to_state: "quarantined",
        dead_letter_reason: "lease_expired",
      },
    ],
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

describe("Dispatch page", () => {
  it("loads dispatch truth, shows stale lease evidence, and reconciles expired leases", async () => {
    await renderDispatchPage("/dispatch?instanceId=instance_alpha");

    expect(fetchExecutionDispatchMock).toHaveBeenCalledWith({ instanceId: "instance_alpha", companyId: "" });
    expect(container.textContent).toContain("Worker Leases");
    expect(container.textContent).toContain("Leased Attempts");
    expect(container.textContent).toContain("Outbox Pressure");
    expect(container.textContent).toContain("Reconciliation");
    expect(container.textContent).toContain("openai_api::gpt-4.1-mini");
    expect(container.textContent).toContain("Expired lease");
    expect(container.textContent).toContain("Outbox events have dead-lettered");
    const notificationsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open notifications");
    expect(notificationsLink?.getAttribute("href")).toBe("/notifications?instanceId=instance_alpha");

    const reconcileButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Reconcile expired leases");
    expect(reconcileButton).not.toBeNull();

    await act(async () => {
      reconcileButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(reconcileExecutionLeasesMock).toHaveBeenCalledWith({ instanceId: "instance_alpha", companyId: "" });
    expect(container.textContent).toContain("Corrected leases");
    expect(container.textContent).toContain("Corrected attempts");
    expect(container.textContent).toContain("lease_expired");
    expect(container.textContent).toContain("quarantined");
  });

  it("shows a real permission blocker when dispatch mutations are read-only", async () => {
    await renderDispatchPage("/dispatch?instanceId=instance_alpha", readOnlyOperatorSession);

    const reconcileButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Reconcile expired leases");
    expect(reconcileButton).not.toBeNull();
    expect(reconcileButton?.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).toContain("Permission blocker");
    expect(container.textContent).toContain("lacks `execution.operate`");
  });
});
