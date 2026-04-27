// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchInstancesMock, fetchAgentsMock, fetchAgentDetailMock } = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchAgentsMock: vi.fn(),
  fetchAgentDetailMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchAgents: fetchAgentsMock,
    fetchAgentDetail: fetchAgentDetailMock,
  };
});

import type { AdminSessionUser, InstanceRecord } from "../src/api/admin";
import { AgentsPage } from "../src/pages/AgentsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "owner",
  display_name: "Owner",
  role: "owner",
};

function createInstanceRecord(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Alpha Instance",
    description: "Alpha instance",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "linux_host_native",
    exposure_mode: "same_origin",
    is_default: true,
    metadata: {},
    created_at: "2026-04-22T08:00:00Z",
    updated_at: "2026-04-22T08:00:00Z",
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

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  fetchAgentsMock.mockResolvedValue({
    status: "ok",
    instance: createInstanceRecord(),
    agents: [],
  });
  fetchAgentDetailMock.mockResolvedValue({
    status: "ok",
    agent: null,
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

describe("agents page truth-preserving reads", () => {
  it("opens agents with non-healing list reads so a missing Operator defect is not cleared by inspection", async () => {
    await renderIntoDom(withAppContext({
      path: "/agents?instanceId=instance_alpha",
      element: <AgentsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchAgentsMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      limit: 100,
      ensureDefaultOperator: false,
    });
    expect(fetchAgentDetailMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("No agents found for this instance.");
  });
});
