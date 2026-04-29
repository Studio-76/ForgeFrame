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

function createAgentSummary(overrides: Record<string, unknown> = {}) {
  return {
    agent_id: "agent_operator",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    display_name: "Operator",
    default_name: "Operator",
    role_kind: "operator",
    status: "active",
    participation_mode: "direct",
    allowed_targets: ["conversation", "task"],
    assistant_profile_id: null,
    is_default_operator: true,
    conversation_count: 1,
    mention_count: 1,
    last_activity_at: "2026-04-22T08:30:00Z",
    addressable_in_conversations: true,
    addressability_reason: "Addressable for assignment, mentions, and active conversation participation.",
    metadata: {},
    created_at: "2026-04-22T08:00:00Z",
    updated_at: "2026-04-22T08:30:00Z",
    ...overrides,
  };
}

function createAgentDetail(overrides: Record<string, unknown> = {}) {
  return {
    ...createAgentSummary(),
    assistant_profile: null,
    ...overrides,
  };
}

function getButtonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((item) => item.textContent?.includes(text));
  if (!button) {
    throw new Error(`Button containing '${text}' not found.`);
  }
  return button as HTMLButtonElement;
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

  it("surfaces a missing Operator defect and restores it only through the explicit repair path", async () => {
    let operatorRestored = false;
    fetchAgentsMock.mockImplementation(async (_instanceId: string, filters?: { ensureDefaultOperator?: boolean }) => {
      if (filters?.ensureDefaultOperator) {
        operatorRestored = true;
      }
      return {
        status: "ok",
        instance: createInstanceRecord(),
        agents: operatorRestored
          ? [
            createAgentSummary(),
            createAgentSummary({
              agent_id: "agent_reviewer",
              display_name: "Reviewer",
              default_name: "Reviewer",
              role_kind: "reviewer",
              is_default_operator: false,
              conversation_count: 0,
              mention_count: 0,
            }),
          ]
          : [
            createAgentSummary({
              agent_id: "agent_reviewer",
              display_name: "Reviewer",
              default_name: "Reviewer",
              role_kind: "reviewer",
              is_default_operator: false,
              conversation_count: 0,
              mention_count: 0,
            }),
          ],
      };
    });
    fetchAgentDetailMock.mockImplementation(async (agentId: string) => ({
      status: "ok",
      agent: agentId === "agent_operator"
        ? createAgentDetail()
        : createAgentDetail({
          ...createAgentSummary({
            agent_id: "agent_reviewer",
            display_name: "Reviewer",
            default_name: "Reviewer",
            role_kind: "reviewer",
            is_default_operator: false,
            conversation_count: 0,
            mention_count: 0,
          }),
        }),
    }));

    await renderIntoDom(withAppContext({
      path: "/agents?instanceId=instance_alpha",
      element: <AgentsPage />,
      session: adminSession,
    }));
    await flushEffects();
    await flushEffects();

    expect(container.textContent).toContain("Operator missing");

    await act(async () => {
      getButtonByText(container, "Restore required Operator").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    await flushEffects();

    expect(fetchAgentsMock.mock.calls.some(([, filters]) => filters?.ensureDefaultOperator === true)).toBe(true);
    expect(fetchAgentDetailMock).toHaveBeenCalledWith("agent_operator", "instance_alpha");
    expect(container.textContent).toContain("Required Operator Operator restored.");
    expect(container.textContent).toContain("Coordinator / lead Operator");
    expect(container.textContent).toContain("Unsupported backend modes: silent, subscribed");
    expect(Array.from(container.querySelectorAll("a")).some((link) => link.getAttribute("href") === "/conversations?instanceId=instance_alpha&agentId=agent_operator")).toBe(true);
  });

  it("does not report a missing Operator when the current filter hides an existing active coordinator", async () => {
    fetchAgentsMock.mockImplementation(async (_instanceId: string, filters?: { status?: string }) => ({
      status: "ok",
      instance: createInstanceRecord(),
      agents: filters?.status === "paused"
        ? [
          createAgentSummary({
            agent_id: "agent_paused",
            display_name: "Paused Specialist",
            default_name: "Paused Specialist",
            role_kind: "specialist",
            status: "paused",
            is_default_operator: false,
            conversation_count: 0,
            mention_count: 0,
            addressable_in_conversations: false,
            addressability_reason: "Paused or archived agents stay visible in history but are not offered for active conversation routing.",
          }),
        ]
        : [
          createAgentSummary(),
          createAgentSummary({
            agent_id: "agent_paused",
            display_name: "Paused Specialist",
            default_name: "Paused Specialist",
            role_kind: "specialist",
            status: "paused",
            is_default_operator: false,
            conversation_count: 0,
            mention_count: 0,
            addressable_in_conversations: false,
            addressability_reason: "Paused or archived agents stay visible in history but are not offered for active conversation routing.",
          }),
        ],
    }));
    fetchAgentDetailMock.mockImplementation(async (agentId: string) => ({
      status: "ok",
      agent: agentId === "agent_paused"
        ? createAgentDetail({
          ...createAgentSummary({
            agent_id: "agent_paused",
            display_name: "Paused Specialist",
            default_name: "Paused Specialist",
            role_kind: "specialist",
            status: "paused",
            is_default_operator: false,
            conversation_count: 0,
            mention_count: 0,
            addressable_in_conversations: false,
            addressability_reason: "Paused or archived agents stay visible in history but are not offered for active conversation routing.",
          }),
        })
        : createAgentDetail(),
    }));

    await renderIntoDom(withAppContext({
      path: "/agents?instanceId=instance_alpha&status=paused",
      element: <AgentsPage />,
      session: adminSession,
    }));
    await flushEffects();
    await flushEffects();

    expect(container.textContent).not.toContain("Operator missing");
    expect(container.textContent).toContain("Required Operator");
    expect(container.textContent).toContain("The current status filter hides the active Operator.");

    await act(async () => {
      getButtonByText(container, "Show Operator in table").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    await flushEffects();

    expect(fetchAgentDetailMock).toHaveBeenCalledWith("agent_operator", "instance_alpha");
    expect(container.textContent).toContain("Coordinator / lead Operator");
  });
});
