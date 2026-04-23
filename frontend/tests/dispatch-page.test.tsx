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

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");
  return {
    ...actual,
    fetchExecutionDispatch: fetchExecutionDispatchMock,
    fetchInstances: fetchInstancesMock,
    reconcileExecutionLeases: reconcileExecutionLeasesMock,
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

async function renderDispatchPage(path: string) {
  await renderIntoDom(withAppContext({
    path,
    element: <DispatchPage />,
    session: operatorSession,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [],
  });
  fetchExecutionDispatchMock.mockResolvedValue({
    status: "ok",
    dispatch: {
      outbox_counts: { pending: 2, dead: 1 },
      event_counts: { run_dispatch: 1, dead_letter: 1 },
      leased_attempts: [
        {
          run_id: "run_alpha",
          attempt_id: "attempt_alpha",
          run_kind: "provider_dispatch",
          state: "executing",
          operator_state: "waiting_external",
          execution_lane: "background_agentic",
          worker_key: "worker_alpha",
          lease_status: "leased",
          lease_expires_at: "2026-04-23T08:10:00Z",
          last_heartbeat_at: "2026-04-23T08:09:30Z",
          next_wakeup_at: null,
          status_reason: "provider_call",
          updated_at: "2026-04-23T08:09:30Z",
        },
      ],
      stalled_attempts: [],
      workers: [
        {
          worker_key: "worker_alpha",
          worker_state: "busy",
          instance_id: "instance_alpha",
          execution_lane: "background_agentic",
          active_attempts: 1,
          leased_runs: ["run_alpha"],
          current_run_id: "run_alpha",
          current_attempt_id: "attempt_alpha",
          oldest_lease_expires_at: "2026-04-23T08:10:00Z",
          heartbeat_expires_at: "2026-04-23T08:10:30Z",
          last_heartbeat_at: "2026-04-23T08:09:30Z",
          last_claimed_at: "2026-04-23T08:09:00Z",
          last_completed_at: null,
          last_error_code: null,
          last_error_detail: null,
        },
      ],
      quarantined_runs: 1,
      paused_runs: 0,
      waiting_on_approval_runs: 0,
    },
  });
  reconcileExecutionLeasesMock.mockResolvedValue({
    status: "ok",
    reconciled: [{ run_id: "run_alpha", attempt_id: "attempt_alpha", reconciled_to_state: "quarantined", dead_letter_reason: "lease_expired" }],
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
  it("loads dispatch truth and reconciles expired leases", async () => {
    await renderDispatchPage("/dispatch?instanceId=instance_alpha");

    expect(fetchExecutionDispatchMock).toHaveBeenCalledWith({ instanceId: "instance_alpha", companyId: "" });
    expect(container.textContent).toContain("worker_alpha");
    expect(container.textContent).toContain("waiting_external");

    const reconcileButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Reconcile expired leases");
    expect(reconcileButton).not.toBeNull();

    await act(async () => {
      reconcileButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(reconcileExecutionLeasesMock).toHaveBeenCalledWith({ instanceId: "instance_alpha", companyId: "" });
    expect(container.textContent).toContain("Reconciled 1 expired lease(s).");
  });
});
