// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchExecutionQueuesMock,
  fetchInstancesMock,
} = vi.hoisted(() => ({
  fetchExecutionQueuesMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
}));

vi.mock("../src/api/admin/execution", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/execution")>("../src/api/admin/execution");
  return {
    ...actual,
    fetchExecutionQueues: fetchExecutionQueuesMock,
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
import { QueuesPage } from "../src/pages/QueuesPage";
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

async function renderQueuesPage(path: string) {
  await renderIntoDom(withAppContext({
    path,
    element: <QueuesPage />,
    session: operatorSession,
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
  fetchExecutionQueuesMock.mockResolvedValue({
    status: "ok",
    lanes: [
      {
        execution_lane: "background_agentic",
        display_name: "Background Agentic",
        total_runs: 2,
        runnable_runs: 1,
        running_runs: 0,
        paused_runs: 0,
        waiting_on_approval_runs: 0,
        retry_scheduled_runs: 1,
        quarantined_runs: 1,
        oldest_scheduled_at: "2026-04-22T08:00:00Z",
        longest_wait_seconds: 90,
      },
    ],
    runs: [
      {
        run_id: "run_alpha",
        run_kind: "provider_dispatch",
        state: "dead_lettered",
        operator_state: "quarantined",
        execution_lane: "background_agentic",
        attempt_id: "attempt_alpha",
        attempt_state: "dead_lettered",
        lease_status: "released",
        selected_target_key: "openai_api::gpt-4.1-mini",
        current_approval_id: null,
        wait_reason: "Quarantined after a terminal or operator-forced failure.",
        next_allowed_action: "Replay or restart on Execution Review",
        wait_age_seconds: 3600,
        scheduled_at: "2026-04-22T08:00:00Z",
        next_wakeup_at: null,
        status_reason: "terminal_failure",
        updated_at: "2026-04-22T08:10:00Z",
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

describe("Queues page", () => {
  it("shows instance-scoped queue posture instead of a flat execution list", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/queues",
        element: <QueuesPage />,
        session: operatorSession,
      }),
    );
    expect(markup).toContain("Instance scope required");
    expect(markup).toContain("queue truth");
  });

  it("loads queue truth for the chosen instance", async () => {
    await renderQueuesPage("/queues");

    const scopeButton = container.querySelector<HTMLButtonElement>("button.fg-data-row");
    expect(scopeButton).not.toBeNull();

    await act(async () => {
      scopeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(fetchExecutionQueuesMock).toHaveBeenCalledWith({ instanceId: "instance_alpha", companyId: "", limit: 100 });
    expect(container.textContent).toContain("Background Agentic");
    expect(container.textContent).toContain("Capacity starved");
    expect(container.textContent).toContain("Replay or restart on Execution Review");
    expect(container.textContent).toContain("openai_api::gpt-4.1-mini");
    const reviewLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open execution review");
    expect(reviewLink?.getAttribute("href")).toBe("/execution?instanceId=instance_alpha&state=dead_lettered&runId=run_alpha");
  });

  it("submits lane, state, target, and age filters to the queue API", async () => {
    await renderQueuesPage("/queues?instanceId=instance_alpha");

    const laneSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Queue lane filter"]');
    const stateSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Queue state filter"]');
    const targetInput = container.querySelector<HTMLInputElement>('input[aria-label="Queue target filter"]');
    const ageSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Queue age filter"]');
    const form = targetInput?.closest("form");

    expect(laneSelect).not.toBeNull();
    expect(stateSelect).not.toBeNull();
    expect(targetInput).not.toBeNull();
    expect(ageSelect).not.toBeNull();
    expect(form).not.toBeNull();

    await act(async () => {
      laneSelect!.value = "background_agentic";
      laneSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      stateSelect!.value = "quarantined";
      stateSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      const prototype = Object.getPrototypeOf(targetInput!) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(targetInput!, "openai_api::gpt-4.1-mini");
      targetInput!.dispatchEvent(new Event("input", { bubbles: true }));
      ageSelect!.value = "24h";
      ageSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(fetchExecutionQueuesMock).toHaveBeenLastCalledWith({
      instanceId: "instance_alpha",
      companyId: "",
      executionLane: "background_agentic",
      state: "quarantined",
      target: "openai_api::gpt-4.1-mini",
      age: "24h",
      limit: 100,
    });
  });

  it("treats an empty backlog as a healthy no-backlog state", async () => {
    fetchExecutionQueuesMock.mockResolvedValueOnce({
      status: "ok",
      lanes: [
        {
          execution_lane: "background_agentic",
          display_name: "Background Agentic",
          total_runs: 0,
          runnable_runs: 0,
          running_runs: 0,
          paused_runs: 0,
          waiting_on_approval_runs: 0,
          retry_scheduled_runs: 0,
          quarantined_runs: 0,
          oldest_scheduled_at: null,
          longest_wait_seconds: null,
        },
      ],
      runs: [],
    });

    await renderQueuesPage("/queues?instanceId=instance_alpha");

    expect(container.textContent).toContain("no backlog");
    expect(container.textContent).toContain("healthy outcome");
  });

  it("shows the oldest queue age even when backlog is blocked instead of runnable", async () => {
    fetchExecutionQueuesMock.mockResolvedValueOnce({
      status: "ok",
      lanes: [
        {
          execution_lane: "background_agentic",
          display_name: "Background Agentic",
          total_runs: 1,
          runnable_runs: 0,
          running_runs: 0,
          paused_runs: 1,
          waiting_on_approval_runs: 0,
          retry_scheduled_runs: 0,
          quarantined_runs: 0,
          oldest_scheduled_at: "2026-04-20T08:00:00Z",
          longest_wait_seconds: 172800,
        },
      ],
      runs: [
        {
          run_id: "run_paused",
          run_kind: "provider_dispatch",
          state: "paused",
          operator_state: "paused",
          execution_lane: "background_agentic",
          attempt_id: "attempt_paused",
          attempt_state: "paused",
          lease_status: "released",
          selected_target_key: "workspace::paused-tenant",
          current_approval_id: null,
          wait_reason: "Paused by an operator command.",
          next_allowed_action: "Resume on Execution Review",
          wait_age_seconds: 172800,
          scheduled_at: "2026-04-20T08:00:00Z",
          next_wakeup_at: null,
          status_reason: "operator_pause",
          updated_at: "2026-04-20T08:00:00Z",
        },
      ],
    });

    await renderQueuesPage("/queues?instanceId=instance_alpha");

    expect(container.textContent).toContain("Oldest age: 2d");
    expect(container.textContent).not.toContain("No queued work");
    expect(container.textContent).toContain("Paused by an operator command.");
  });
});
