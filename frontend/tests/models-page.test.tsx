// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchModelRegisterMock, fetchInstancesMock } = vi.hoisted(() => ({
  fetchModelRegisterMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchModelRegister: fetchModelRegisterMock,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, InstanceRecord } from "../src/api/admin";
import { ModelsPage } from "../src/pages/ModelsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
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
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  fetchModelRegisterMock.mockResolvedValue({
    status: "ok",
    object: "model_register",
    models: [
      {
        provider: "openai_api",
        provider_label: "OpenAI",
        model_id: "gpt-4.1-mini",
        display_name: "gpt-4.1-mini",
        owned_by: "OpenAI",
        category: "general",
        routing_key: "openai_api/gpt-4.1-mini",
        capabilities: { streaming: true, tool_calling: true },
        source: "static",
        discovery_status: "catalog",
        runtime_status: "ready",
        availability_status: "healthy",
        health_status: "healthy",
        status_reason: null,
        active: true,
        target_count: 1,
        active_target_count: 1,
        target_keys: ["openai_api::gpt-4.1-mini"],
      },
    ],
    summary: {
      total_models: 1,
      active_models: 1,
      models_with_targets: 1,
      runtime_ready_models: 1,
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

describe("Models page", () => {
  it("loads the model register and renders instance-scoped model truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/models?instanceId=instance_alpha",
      element: <ModelsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchModelRegisterMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Models Register");
    expect(container.textContent).toContain("Persistent Model Register");
    expect(container.textContent).toContain("gpt-4.1-mini");
    expect(container.textContent).toContain("routing key=openai_api/gpt-4.1-mini");
    expect(container.textContent).toContain("target coverage=1/1");
  });
});
