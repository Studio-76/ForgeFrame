// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchInstancesMock, createInstanceMock, updateInstanceMock } = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  createInstanceMock: vi.fn(),
  updateInstanceMock: vi.fn(),
}));

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    createInstance: createInstanceMock,
    updateInstance: updateInstanceMock,
  };
});

import type { AdminSessionUser, InstanceRecord } from "../src/api/admin";
import { InstancesPage } from "../src/pages/InstancesPage";
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
    operator_agent: {
      status: "ready",
      reason: "Default Operator agent is active.",
      agent_id: "agent_operator_alpha",
      display_name: "Operator",
      role_kind: "operator",
      agent_status: "active",
      auto_created: true,
      allowed_targets: [],
      updated_at: "2026-04-22T08:00:00Z",
    },
    provider_targets: {
      status: "ready",
      reason: "1 ready provider target is available.",
      configured_provider_count: 1,
      total_targets: 1,
      enabled_targets: 1,
      ready_targets: 1,
      primary_targets: [
        {
          target_key: "target_alpha",
          label: "Alpha Target",
          provider: "OpenAI",
          readiness_status: "ready",
          priority: 10,
        },
      ],
      last_activity_at: "2026-04-22T08:15:00Z",
    },
    routing: {
      status: "ready",
      reason: "Routing policies are persisted and have ready targets.",
      policy_count: 2,
      open_circuits: 0,
      hard_budget_blocked: false,
      blocked_cost_classes: [],
      simple_preferred_target_keys: ["target_alpha"],
      non_simple_preferred_target_keys: ["target_alpha"],
      last_activity_at: "2026-04-22T08:30:00Z",
    },
    runtime_access: {
      status: "onboarding-only",
      reason: "No runtime key has been issued for this instance yet.",
      total_accounts: 0,
      active_accounts: 0,
      total_keys: 0,
      active_keys: 0,
      last_activity_at: null,
    },
    work_interaction: {
      status: "ready",
      reason: "Mode 'ops_assistant' is configured for this instance.",
      mode: "ops_assistant",
      inbox_enabled: true,
      tasks_enabled: true,
      notifications_enabled: true,
      conversation_count: 1,
      open_conversation_count: 1,
      latest_conversation_id: "conversation_alpha",
      latest_conversation_subject: "Alpha conversation",
      latest_activity_at: "2026-04-22T08:45:00Z",
    },
    readiness: {
      status: "onboarding-only",
      reason: "No runtime key has been issued for this instance yet.",
      ready_check_count: 4,
      check_count: 5,
      checks: [
        { id: "operator_agent", label: "Operator agent", status: "ready", detail: "Default Operator agent is active." },
        { id: "provider_targets", label: "Provider targets", status: "ready", detail: "1 ready provider target is available." },
        { id: "routing", label: "Routing policy", status: "ready", detail: "Routing policies are persisted and have ready targets." },
        { id: "runtime_access", label: "Runtime access", status: "onboarding-only", detail: "No runtime key has been issued for this instance yet." },
        { id: "work_interaction", label: "Work interaction", status: "ready", detail: "Mode 'ops_assistant' is configured for this instance." },
      ],
    },
    last_activity_at: "2026-04-22T08:45:00Z",
    ...overrides,
  };
}

function LocationSearchEcho() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
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

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

async function renderInstancesPage() {
  await renderIntoDom(withAppContext({
    path: "/instances",
    element: <InstancesPage />,
    session: adminSession,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  createInstanceMock.mockResolvedValue({
    status: "ok",
    instance: createInstanceRecord({
      instance_id: "instance_beta",
      slug: "instance-beta",
      display_name: "Beta Instance",
      tenant_id: "tenant_beta",
      company_id: "company_beta",
      is_default: false,
    }),
    operator_agent: {
      agent_id: "agent_operator_beta",
      instance_id: "instance_beta",
      company_id: "company_beta",
      display_name: "Operator",
      default_name: "Operator",
      role_kind: "operator",
      status: "active",
      participation_mode: "direct",
      allowed_targets: [],
      assistant_profile_id: null,
      is_default_operator: true,
      metadata: { autocreated: true },
      created_at: "2026-04-22T08:00:00Z",
      updated_at: "2026-04-22T08:00:00Z",
    },
    operator_agent_created: true,
  });
  updateInstanceMock.mockResolvedValue({
    status: "ok",
    instance: createInstanceRecord({
      display_name: "Alpha Instance Updated",
      description: "Updated alpha instance",
      status: "disabled",
      deployment_mode: "container_optional",
      exposure_mode: "edge_admission",
    }),
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

describe("Instances page", () => {
  it("loads instance inventory and exposes instance CRUD forms", async () => {
    await renderInstancesPage();

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Instance Inventory");
    expect(container.textContent).toContain("Alpha Instance");

    // New UX shows "Create Instance" button in the inventory toolbar
    expect(container.textContent).toContain("Create Instance");

    // The status hero replaces the old "Selected Instance" card
    expect(container.textContent).toContain("onboarding-only");
    expect(container.textContent).toContain("Next: No runtime key has been issued");

    // Blocker checklist is shown
    expect(container.textContent).toContain("Readiness Blockers");
    expect(container.textContent).toContain("Runtime access");

    // Passed checks section is present but collapsed
    expect(container.textContent).toContain("Passed checks (4)");

    // Controls section replaces old "Quick Actions"
    expect(container.textContent).toContain("Instance controls");

    // Edit form is NOT visible until toggled
    expect(container.textContent).not.toContain("Display name");
  });

  it("creates a new instance and refreshes the inventory around the new selection", async () => {
    fetchInstancesMock
      .mockResolvedValueOnce({
        status: "ok",
        instances: [createInstanceRecord()],
      })
      .mockResolvedValueOnce({
        status: "ok",
        instances: [
          createInstanceRecord(),
          createInstanceRecord({
            instance_id: "instance_beta",
            slug: "instance-beta",
            display_name: "Beta Instance",
            tenant_id: "tenant_beta",
            company_id: "company_beta",
            is_default: false,
          }),
        ],
      });

    await renderInstancesPage();

    // Click "Create Instance" button to reveal the form
    const createBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Create Instance",
    );
    expect(createBtn).not.toBeUndefined();
    await act(async () => {
      createBtn!.click();
    });
    await flushEffects();

    const forms = Array.from(container.querySelectorAll("form"));
    const createForm = forms[0] as HTMLFormElement;
    const inputs = Array.from(createForm.querySelectorAll("input"));
    const textareas = Array.from(createForm.querySelectorAll("textarea"));
    const selects = Array.from(createForm.querySelectorAll("select"));

    await act(async () => {
      setControlValue(inputs[0] as HTMLInputElement, "instance_beta");
      setControlValue(inputs[1] as HTMLInputElement, "Beta Instance");
      setControlValue(textareas[0] as HTMLTextAreaElement, "Beta instance");
      setControlValue(inputs[2] as HTMLInputElement, "tenant_beta");
      setControlValue(inputs[3] as HTMLInputElement, "company_beta");
      setControlValue(selects[0] as HTMLSelectElement, "container_optional");
      setControlValue(selects[1] as HTMLSelectElement, "edge_admission");
      createForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(createInstanceMock).toHaveBeenCalledWith({
      instance_id: "instance_beta",
      display_name: "Beta Instance",
      description: "Beta instance",
      tenant_id: "tenant_beta",
      company_id: "company_beta",
      deployment_mode: "container_optional",
      exposure_mode: "edge_admission",
    });
    expect(fetchInstancesMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Instance Beta Instance created.");
    expect(container.textContent).toContain("Operator agent Operator was auto-created.");
    expect(container.textContent).toContain("Latest Create Result");
  });

  it("updates the selected instance through the edit form", async () => {
    await renderInstancesPage();

    // Click "Edit instance" button to reveal the edit form
    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Edit instance",
    );
    expect(editBtn).not.toBeUndefined();
    await act(async () => {
      editBtn!.click();
    });
    await flushEffects();

    const forms = Array.from(container.querySelectorAll("form"));
    const editForm = forms[0] as HTMLFormElement;
    const inputs = Array.from(editForm.querySelectorAll("input"));
    const textareas = Array.from(editForm.querySelectorAll("textarea"));
    const selects = Array.from(editForm.querySelectorAll("select"));

    await act(async () => {
      setControlValue(inputs[0] as HTMLInputElement, "Alpha Instance Updated");
      setControlValue(textareas[0] as HTMLTextAreaElement, "Updated alpha instance");
      setControlValue(selects[0] as HTMLSelectElement, "disabled");
      setControlValue(selects[1] as HTMLSelectElement, "container_optional");
      setControlValue(selects[2] as HTMLSelectElement, "edge_admission");
      editForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(updateInstanceMock).toHaveBeenCalledWith("instance_alpha", {
      display_name: "Alpha Instance Updated",
      description: "Updated alpha instance",
      tenant_id: "tenant_alpha",
      company_id: "company_alpha",
      status: "disabled",
      deployment_mode: "container_optional",
      exposure_mode: "edge_admission",
    });
    expect(container.textContent).toContain("Instance Alpha Instance Updated updated.");
  });

  it("keeps the scoped instanceId in the URL when filters exclude the selected instance", async () => {
    fetchInstancesMock.mockResolvedValue({
      status: "ok",
      instances: [
        createInstanceRecord(),
        createInstanceRecord({
          instance_id: "instance_beta",
          slug: "instance-beta",
          display_name: "Beta Instance",
          tenant_id: "tenant_beta",
          company_id: "company_beta",
          is_default: false,
        }),
      ],
    });

    await renderIntoDom(withAppContext({
      path: "/instances?instanceId=instance_alpha",
      element: (
        <>
          <InstancesPage />
          <LocationSearchEcho />
        </>
      ),
      session: adminSession,
    }));
    await flushEffects();

    const searchInput = container.querySelector('input[placeholder="ID, name, operator, reason"]') as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();

    await act(async () => {
      setControlValue(searchInput as HTMLInputElement, "Beta");
    });
    await flushEffects();

    expect(container.textContent).toContain("The current scoped instance");
    expect(container.textContent).toContain("outside the filtered table");
    expect(container.textContent).toContain("Alpha Instance");
    expect(container.querySelector('[data-testid="location-search"]')?.textContent).toBe("?instanceId=instance_alpha");

    const openAgentsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Agents");
    expect(openAgentsLink?.getAttribute("href")).toBe("/agents?instanceId=instance_alpha");
  });
});
