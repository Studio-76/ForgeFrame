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

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");
  return {
    ...actual,
    fetchExecutionQueues: fetchExecutionQueuesMock,
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
    expect(markup).toContain("Queue Scope");
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
    expect(container.textContent).toContain("quarantined");
    const reviewLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open execution review");
    expect(reviewLink?.getAttribute("href")).toBe("/execution?instanceId=instance_alpha&runId=run_alpha");
  });
});
