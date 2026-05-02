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

function createSettings(): MutableSettingEntry[] {
  return [
    {
      key: "routing_require_healthy",
      label: "Require Healthy Route",
      group: "routing",
      group_label: "Routing",
      category: "routing",
      value_type: "bool",
      description: "Require healthy models for implicit routing when possible.",
      default_value: false,
      effective_value: true,
      source: "override",
      source_label: "Persisted override",
      mutable: true,
      risk_level: "medium",
      risk_label: "Moderate risk",
      risk_note: "Can block degraded providers from being selected by default routes.",
      confirmation_required: false,
      allowed_values: [],
      overridden: true,
      updated_at: "2026-04-21T21:00:00Z",
      updated_by: "ops-admin",
    },
    {
      key: "public_tls_mode",
      label: "TLS Mode",
      group: "tls",
      group_label: "TLS",
      category: "tls",
      value_type: "str",
      description: "Controls whether public TLS is disabled, manual, or managed by integrated ACME.",
      default_value: "disabled",
      effective_value: "disabled",
      source: "default",
      source_label: "Environment default",
      mutable: true,
      risk_level: "high",
      risk_label: "High risk",
      risk_note: "Can immediately change public TLS posture and ingress expectations.",
      confirmation_required: true,
      allowed_values: ["disabled", "manual", "integrated_acme"],
      overridden: false,
      updated_at: null,
      updated_by: null,
    },
    {
      key: "app_name",
      label: "App Name",
      group: "ui",
      group_label: "UI",
      category: "ui",
      value_type: "str",
      description: "Visible product name in the admin shell.",
      default_value: "ForgeFrame",
      effective_value: "ForgeFrame",
      source: "default",
      source_label: "Environment default",
      mutable: true,
      risk_level: "low",
      risk_label: "Low risk",
      risk_note: "Changes operator-facing product labeling but does not alter runtime execution.",
      confirmation_required: false,
      allowed_values: [],
      overridden: false,
      updated_at: null,
      updated_by: null,
    },
  ];
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

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
}

function getLabeledControl(scope: ParentNode, labelText: string) {
  const label = Array.from(scope.querySelectorAll("label")).find((candidate) => candidate.textContent?.includes(labelText));
  const control = label?.querySelector("input, textarea, select");
  if (!control) {
    throw new Error(`Missing labeled control: ${labelText}`);
  }
  return control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

async function renderSettingsPage(session: AdminSessionUser) {
  await renderIntoDom(withAppContext({
    path: "/settings",
    element: <SettingsPage />,
    session,
  }));
  await flushEffects();
}

/** Flush microtasks and pending state updates multiple times. */
async function deepSettle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchMutableSettingsMock.mockResolvedValue({
    status: "ok",
    settings: createSettings(),
  });
  patchMutableSettingsMock.mockResolvedValue({
    status: "ok",
    updated: ["public_tls_mode"],
    operation: {
      kind: "patch",
      keys: ["public_tls_mode"],
      summary: "Updated 1 setting.",
      highest_risk: "high",
      requires_confirmation: true,
    },
    settings: createSettings().map((item) => item.key === "public_tls_mode"
      ? {
          ...item,
          effective_value: "manual",
          source: "override",
          source_label: "Persisted override",
          overridden: true,
          updated_at: "2026-04-29T20:15:00Z",
          updated_by: "user-admin",
        }
      : item),
  });
  resetMutableSettingMock.mockResolvedValue({
    status: "ok",
    reset: "public_tls_mode",
    operation: {
      kind: "reset",
      keys: ["public_tls_mode"],
      summary: "Reset TLS Mode to its environment default.",
      highest_risk: "high",
      requires_confirmation: true,
    },
    settings: createSettings(),
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
  it("keeps grouped settings in review mode for operators without rendering a disabled editor", async () => {
    await renderSettingsPage(operatorSession);

    expect(fetchMutableSettingsMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Read-Only Review");
    expect(container.textContent).toContain("Authenticated non-admin sessions can review grouped system defaults here");
    expect(container.textContent).toContain("Routing defaults");
    expect(container.textContent).toContain("TLS / Public access");

    // Operators should not see edit controls
    expect(getButtonByText(container, "Save override")).toBeUndefined();
    expect(getButtonByText(container, "Reset to default")).toBeUndefined();
    expect(getButtonByText(container, "Edit setting")).toBeUndefined();
    expect(container.querySelector('select[aria-label="TLS Mode effective value"]')).toBeNull();
  });

  it("groups, searches, edits with explicit edit mode, and confirms high-risk changes for admins", async () => {
    await renderSettingsPage(adminSession);

    expect(fetchMutableSettingsMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Admin mutations enabled");
    expect(container.textContent).toContain("General");
    expect(container.textContent).toContain("Routing defaults");
    expect(container.textContent).toContain("TLS / Public access");

    // High-risk settings are hidden by default; enable them
    expect(container.textContent).toContain("Show 1 high-risk setting");
    const highRiskLabel = Array.from(container.querySelectorAll("label"))
      .find((l) => l.textContent?.includes("Show 1 high-risk setting"));
    expect(highRiskLabel).toBeTruthy();
    const highRiskCheckbox = highRiskLabel!.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(highRiskCheckbox).toBeTruthy();

    // Click the checkbox to check it. This fires a click event;
    // React reads event.target.checked (which jsdom toggles on click()) and calls onChange.
    await act(async () => {
      highRiskCheckbox.click();
    });
    await flushEffects();

    // Verify all 3 settings are now visible
    expect(container.textContent).toContain("3 of 3 settings shown");

    // Search for "tls mode" to narrow down
    await act(async () => {
      setControlValue(getLabeledControl(container, "Search settings"), "tls mode");
    });
    await flushEffects();
    expect(container.textContent).toContain("1 of 3 settings shown");

    // Select the TLS Mode setting by clicking its button
    const tlsItem = getButtonByText(container, "TLS Mode");
    expect(tlsItem).toBeTruthy();
    await act(async () => {
      tlsItem!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    // Detail panel should show the setting description
    expect(container.textContent).toContain("Controls whether public TLS is disabled");

    // Enter edit mode
    const editBtn = getButtonByText(container, "Edit setting");
    expect(editBtn).toBeTruthy();
    await act(async () => {
      editBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    // Change value via the select control
    const valueControl = getLabeledControl(container, "New effective value");
    expect(valueControl).toBeTruthy();
    await act(async () => {
      setControlValue(valueControl, "manual");
    });
    await flushEffects();

    // Click "Save override" — this opens the confirmation dialog
    await act(async () => {
      getButtonByText(container, "Save override")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    // Confirmation dialog should be visible for high-risk setting
    expect(getLabeledControl(container, "I understand the operational impact and want to proceed")).toBeTruthy();

    // Check the acknowledgment by clicking the checkbox inside the dialog
    const confirmCheckbox = container.querySelector(".ff-dialog-panel input[type='checkbox']") as HTMLInputElement;
    expect(confirmCheckbox).toBeTruthy();
    await act(async () => {
      confirmCheckbox.click();
    });
    await flushEffects();

    // Click the dialog confirm button
    await act(async () => {
      const confirmBtn = container.querySelector(".ff-settings-confirm-btn") as HTMLButtonElement;
      expect(confirmBtn).toBeTruthy();
      expect(confirmBtn.textContent).toBe("Apply override");
      confirmBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await deepSettle();

    // Verify save was called with correct payload
    expect(patchMutableSettingsMock).toHaveBeenCalledWith({ public_tls_mode: "manual" });
    expect(container.textContent).toContain("Updated 1 setting.");
    expect(container.textContent).toContain("Persisted override");

    // Edit mode was exited after save; verify by checking "Edit setting" is present
    expect(getButtonByText(container, "Edit setting")).toBeTruthy();

    // Verify the updated setting source is reflected in the detail panel
    expect(container.textContent).toContain("Overridden");
    // And the audit section shows the last updated timestamp
    expect(container.textContent).toContain("Apr 29, 2026");
  });

  it("keeps impersonation admin sessions in read-only review mode", async () => {
    await renderSettingsPage(readOnlyAdminSession);

    expect(fetchMutableSettingsMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Read-Only Review");
    expect(container.textContent).toContain("This admin session is read-only");
    expect(container.textContent).toContain("Read-only review");
    expect(getButtonByText(container, "Save override")).toBeUndefined();
    expect(getButtonByText(container, "Reset to default")).toBeUndefined();
    expect(getButtonByText(container, "Edit setting")).toBeUndefined();
    expect(container.querySelector('select[aria-label="TLS Mode effective value"]')).toBeNull();
  });
});
