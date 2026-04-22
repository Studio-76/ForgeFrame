// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchMutableSettingsMock,
  patchMutableSettingsMock,
  resetMutableSettingMock,
} = vi.hoisted(() => ({
  fetchMutableSettingsMock: vi.fn(),
  patchMutableSettingsMock: vi.fn(),
  resetMutableSettingMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchMutableSettings: fetchMutableSettingsMock,
    patchMutableSettings: patchMutableSettingsMock,
    resetMutableSetting: resetMutableSettingMock,
  };
});

import type { AdminSessionUser, MutableSettingEntry } from "../src/api/admin";
import { SettingsPage } from "../src/pages/SettingsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

const readOnlyAdminSession: AdminSessionUser = {
  session_id: "session-admin-read-only",
  user_id: "user-admin-read-only",
  username: "admin-read-only",
  display_name: "Read-Only Admin",
  role: "admin",
  read_only: true,
  session_type: "impersonation",
};

function createSetting(): MutableSettingEntry {
  return {
    key: "routing_require_healthy",
    label: "Require healthy providers",
    category: "routing",
    value_type: "bool",
    description: "Only route to healthy providers when the runtime selects a default target.",
    default_value: false,
    effective_value: true,
    overridden: true,
    updated_at: "2026-04-21T21:00:00Z",
    updated_by: "ops-admin",
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

async function renderSettingsPage(session: AdminSessionUser) {
  await renderIntoDom(withAppContext({
    path: "/settings",
    element: <SettingsPage />,
    session,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchMutableSettingsMock.mockResolvedValue({
    status: "ok",
    settings: [createSetting()],
  });
  patchMutableSettingsMock.mockResolvedValue({
    status: "ok",
    updated: ["routing_require_healthy"],
    settings: [createSetting()],
  });
  resetMutableSettingMock.mockResolvedValue({
    status: "ok",
    reset: "routing_require_healthy",
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

describe("Settings page role-aware controls", () => {
  it("keeps settings in read-only mode for operators", async () => {
    await renderSettingsPage(operatorSession);

    expect(fetchMutableSettingsMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Read-Only Settings Review");
    expect(container.textContent).toContain("Authenticated non-admin sessions can inspect effective settings here");
    expect(container.textContent).toContain("Read only");
    expect(container.querySelectorAll("button")).toHaveLength(0);

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Require healthy providers effective value"]');
    expect(select).not.toBeNull();
    expect(select?.disabled).toBe(true);
  });

  it("keeps mutation controls available for admin sessions", async () => {
    await renderSettingsPage(adminSession);

    expect(fetchMutableSettingsMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Admin mutations enabled");

    const buttonLabels = Array.from(container.querySelectorAll("button")).map((button) => button.textContent);
    expect(buttonLabels).toContain("Save");
    expect(buttonLabels).toContain("Reset");

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Require healthy providers effective value"]');
    expect(select).not.toBeNull();
    expect(select?.disabled).toBe(false);
  });

  it("keeps impersonation admin sessions read-only", async () => {
    await renderSettingsPage(readOnlyAdminSession);

    expect(fetchMutableSettingsMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Read-Only Settings Review");
    expect(container.textContent).toContain("This admin session is read-only");
    expect(container.textContent).toContain("Read only");
    expect(container.querySelectorAll("button")).toHaveLength(0);

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Require healthy providers effective value"]');
    expect(select).not.toBeNull();
    expect(select?.disabled).toBe(true);
  });
});
