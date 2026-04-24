// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchInstancesMock, createInstanceMock, updateInstanceMock } = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  createInstanceMock: vi.fn(),
  updateInstanceMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

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
    expect(container.textContent).toContain("Create Instance");
    expect(container.textContent).toContain("Edit Selected Instance");
    expect(container.textContent).toContain("Tenant / Organization scope");
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

    const inputs = Array.from(container.querySelectorAll("input"));
    const textareas = Array.from(container.querySelectorAll("textarea"));
    const selects = Array.from(container.querySelectorAll("select"));
    const forms = Array.from(container.querySelectorAll("form"));

    await act(async () => {
      setControlValue(inputs[0] as HTMLInputElement, "instance_beta");
      setControlValue(inputs[1] as HTMLInputElement, "Beta Instance");
      setControlValue(textareas[0] as HTMLTextAreaElement, "Beta instance");
      setControlValue(inputs[2] as HTMLInputElement, "tenant_beta");
      setControlValue(inputs[3] as HTMLInputElement, "company_beta");
      setControlValue(selects[0] as HTMLSelectElement, "container_optional");
      setControlValue(selects[1] as HTMLSelectElement, "edge_admission");
      forms[0]?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
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
  });

  it("updates the selected instance through the edit form", async () => {
    await renderInstancesPage();

    const inputs = Array.from(container.querySelectorAll("input"));
    const textareas = Array.from(container.querySelectorAll("textarea"));
    const selects = Array.from(container.querySelectorAll("select"));
    const forms = Array.from(container.querySelectorAll("form"));

    await act(async () => {
      setControlValue(inputs[4] as HTMLInputElement, "Alpha Instance Updated");
      setControlValue(textareas[1] as HTMLTextAreaElement, "Updated alpha instance");
      setControlValue(selects[2] as HTMLSelectElement, "disabled");
      setControlValue(selects[3] as HTMLSelectElement, "container_optional");
      setControlValue(selects[4] as HTMLSelectElement, "edge_admission");
      forms[1]?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
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
});
