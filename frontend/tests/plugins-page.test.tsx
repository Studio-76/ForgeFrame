// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchPluginsMock,
  fetchPluginDetailMock,
  createPluginMock,
  updatePluginMock,
  upsertPluginBindingMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchPluginsMock: vi.fn(),
  fetchPluginDetailMock: vi.fn(),
  createPluginMock: vi.fn(),
  updatePluginMock: vi.fn(),
  upsertPluginBindingMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchPlugins: fetchPluginsMock,
    fetchPluginDetail: fetchPluginDetailMock,
    createPlugin: createPluginMock,
    updatePlugin: updatePluginMock,
    upsertPluginBinding: upsertPluginBindingMock,
  };
});

import type { AdminSessionUser, PluginCatalogEntry } from "../src/api/admin";
import { PluginsPage } from "../src/pages/PluginsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createPluginEntry(overrides: Partial<PluginCatalogEntry> = {}): PluginCatalogEntry {
  return {
    plugin_id: "plugin_review_bridge",
    display_name: "Review Bridge",
    summary: "Adds a review panel and artifact hook for human-in-the-loop analysis.",
    vendor: "customer",
    version: "1.2.3",
    status: "active",
    capabilities: ["review.panel", "artifact.render"],
    ui_slots: ["workspaces.detail", "artifacts.sidebar"],
    api_mounts: ["/plugins/review-bridge/hooks"],
    runtime_surfaces: ["workspace_artifact_pipeline"],
    config_schema: {
      type: "object",
      properties: {
        mode: { type: "string" },
        max_items: { type: "integer" },
      },
    },
    default_config: {
      mode: "preview",
      max_items: 25,
    },
    security_posture: {
      allowed_roles: ["admin", "owner"],
      admin_approval_required: true,
      network_access: false,
      writes_external_state: false,
      secret_refs: ["forgeframe/review-bridge/token"],
    },
    metadata: { category: "review" },
    binding: {
      plugin_id: "plugin_review_bridge",
      instance_id: "instance_alpha",
      company_id: "company_alpha",
      enabled: true,
      config: {
        mode: "enforce",
        max_items: 10,
      },
      enabled_capabilities: ["review.panel"],
      enabled_ui_slots: ["workspaces.detail"],
      enabled_api_mounts: ["/plugins/review-bridge/hooks"],
      notes: "Enabled for alpha instance only.",
      created_at: "2026-04-23T09:30:00Z",
      updated_at: "2026-04-23T10:30:00Z",
    },
    effective_status: "enabled",
    status_summary: "Enabled for this instance with persisted binding and config.",
    effective_config: {
      mode: "enforce",
      max_items: 10,
    },
    created_at: "2026-04-23T09:00:00Z",
    updated_at: "2026-04-23T10:30:00Z",
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

function getFormByButtonText(text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(text));
  return button?.closest("form") ?? undefined;
}

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
}

function getLabeledControl(scope: ParentNode, labelText: string) {
  const label = Array.from(scope.querySelectorAll("label")).find((candidate) => candidate.textContent?.includes(labelText));
  if (!label) {
    throw new Error(`Label not found: ${labelText}`);
  }
  const control = label.querySelector("input, textarea, select");
  if (!control) {
    throw new Error(`Control not found for label: ${labelText}`);
  }
  return control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
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
        description: "Alpha",
        status: "active",
        tenant_id: "tenant_alpha",
        company_id: "company_alpha",
        deployment_mode: "linux_host_native",
        exposure_mode: "same_origin",
        is_default: true,
        metadata: {},
        created_at: "2026-04-23T09:00:00Z",
        updated_at: "2026-04-23T09:00:00Z",
      },
    ],
  });

  fetchPluginsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    summary: {
      registered_plugins: 1,
      active_plugins: 1,
      disabled_plugins: 0,
      bound_plugins: 1,
      enabled_bindings: 1,
      capability_keys: ["review.panel", "artifact.render"],
      ui_slots: ["workspaces.detail", "artifacts.sidebar"],
      api_mounts: ["/plugins/review-bridge/hooks"],
    },
    plugins: [createPluginEntry()],
  });

  fetchPluginDetailMock.mockResolvedValue({
    status: "ok",
    instance: null,
    plugin: createPluginEntry(),
  });

  createPluginMock.mockResolvedValue({
    status: "ok",
    plugin: createPluginEntry({
      plugin_id: "plugin_contract_guard",
      display_name: "Contract Guard",
      capabilities: ["dispatch.audit"],
      ui_slots: ["dispatch.panel"],
      api_mounts: ["/plugins/contract-guard/checks"],
      runtime_surfaces: ["dispatch_review"],
      binding: null,
      effective_status: "available",
      status_summary: "Registered but not yet activated for this instance.",
      effective_config: { mode: "preview" },
    }),
  });

  updatePluginMock.mockResolvedValue({
    status: "ok",
    plugin: createPluginEntry({
      display_name: "Review Bridge Updated",
      version: "1.2.4",
      status: "disabled",
    }),
  });

  upsertPluginBindingMock.mockResolvedValue({
    status: "ok",
    instance: null,
    plugin: createPluginEntry({
      binding: {
        plugin_id: "plugin_review_bridge",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        enabled: false,
        config: { mode: "preview", max_items: 8 },
        enabled_capabilities: ["artifact.render"],
        enabled_ui_slots: ["artifacts.sidebar"],
        enabled_api_mounts: ["/plugins/review-bridge/hooks"],
        notes: "Disabled during audit.",
        created_at: "2026-04-23T09:30:00Z",
        updated_at: "2026-04-23T11:00:00Z",
      },
      effective_status: "disabled",
      status_summary: "Binding persisted for this instance but currently disabled.",
      effective_config: { mode: "preview", max_items: 8 },
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

describe("plugins page", () => {
  it("renders plugin discovery and selected instance binding truth", async () => {
    await renderIntoDom(withAppContext({
      path: "/plugins?instanceId=instance_alpha&pluginId=plugin_review_bridge",
      element: <PluginsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchPluginsMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchPluginDetailMock).toHaveBeenCalledWith("plugin_review_bridge", "instance_alpha");
    expect(container.textContent).toContain("Plugin registry");
    expect(container.textContent).toContain("Review Bridge");
    expect(container.textContent).toContain("Enabled for this instance with persisted binding and config.");
    expect(container.textContent).toContain("forgeframe/review-bridge/token");
  });

  it("creates plugins and updates manifest plus instance binding", async () => {
    await renderIntoDom(withAppContext({
      path: "/plugins?instanceId=instance_alpha&pluginId=plugin_review_bridge",
      element: <PluginsPage />,
      session: adminSession,
    }));
    await flushEffects();

    const createForm = getFormByButtonText("Create plugin");
    const manifestForm = getFormByButtonText("Save plugin manifest");
    const bindingForm = getFormByButtonText("Save instance binding");

    const createButton = getButtonByText(createForm!, "Create plugin");
    await act(async () => {
      setControlValue(getLabeledControl(createForm!, "Plugin ID"), "plugin_contract_guard");
      setControlValue(getLabeledControl(createForm!, "Display name"), "Contract Guard");
      setControlValue(getLabeledControl(createForm!, "Status"), "active");
      setControlValue(getLabeledControl(createForm!, "Summary"), "Guards dispatch contracts.");
      setControlValue(getLabeledControl(createForm!, "Vendor"), "customer");
      setControlValue(getLabeledControl(createForm!, "Version"), "0.9.0");
      setControlValue(getLabeledControl(createForm!, "Capabilities"), "dispatch.audit");
      setControlValue(getLabeledControl(createForm!, "UI slots"), "dispatch.panel");
      setControlValue(getLabeledControl(createForm!, "API mounts"), "/plugins/contract-guard/checks");
      setControlValue(getLabeledControl(createForm!, "Runtime surfaces"), "dispatch_review");
      setControlValue(getLabeledControl(createForm!, "Config schema JSON"), "{\"type\":\"object\",\"properties\":{\"mode\":{\"type\":\"string\"}}}");
      setControlValue(getLabeledControl(createForm!, "Default config JSON"), "{\"mode\":\"preview\"}");
      setControlValue(getLabeledControl(createForm!, "Security posture JSON"), "{\"allowed_roles\":[\"admin\"],\"admin_approval_required\":true,\"network_access\":false,\"writes_external_state\":false,\"secret_refs\":[]}");
      setControlValue(getLabeledControl(createForm!, "Metadata JSON"), "{\"category\":\"dispatch\"}");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createPluginMock).toHaveBeenCalledWith(expect.objectContaining({
      plugin_id: "plugin_contract_guard",
      display_name: "Contract Guard",
      summary: "Guards dispatch contracts.",
      version: "0.9.0",
      capabilities: ["dispatch.audit"],
      ui_slots: ["dispatch.panel"],
      api_mounts: ["/plugins/contract-guard/checks"],
      runtime_surfaces: ["dispatch_review"],
      default_config: { mode: "preview" },
      metadata: { category: "dispatch" },
    }));

    const saveManifestButton = getButtonByText(manifestForm!, "Save plugin manifest");
    await act(async () => {
      setControlValue(getLabeledControl(manifestForm!, "Display name"), "Review Bridge Updated");
      setControlValue(getLabeledControl(manifestForm!, "Status"), "disabled");
      setControlValue(getLabeledControl(manifestForm!, "Version"), "1.2.4");
      setControlValue(getLabeledControl(manifestForm!, "Summary"), "Updated after audit.");
      setControlValue(getLabeledControl(manifestForm!, "Vendor"), "customer");
      setControlValue(getLabeledControl(manifestForm!, "Capabilities"), "review.panel, artifact.render");
      setControlValue(getLabeledControl(manifestForm!, "UI slots"), "workspaces.detail, artifacts.sidebar");
      setControlValue(getLabeledControl(manifestForm!, "API mounts"), "/plugins/review-bridge/hooks");
      setControlValue(getLabeledControl(manifestForm!, "Runtime surfaces"), "workspace_artifact_pipeline");
      setControlValue(getLabeledControl(manifestForm!, "Default config JSON"), "{\"mode\":\"preview\",\"max_items\":12}");
      saveManifestButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updatePluginMock).toHaveBeenCalledWith("plugin_review_bridge", expect.objectContaining({
      display_name: "Review Bridge Updated",
      summary: "Updated after audit.",
      version: "1.2.4",
      status: "disabled",
      default_config: { mode: "preview", max_items: 12 },
    }));

    const saveBindingButton = getButtonByText(bindingForm!, "Save instance binding");
    await act(async () => {
      setControlValue(getLabeledControl(bindingForm!, "Binding enabled"), "no");
      setControlValue(getLabeledControl(bindingForm!, "Binding config JSON"), "{\"mode\":\"preview\",\"max_items\":8}");
      setControlValue(getLabeledControl(bindingForm!, "Enabled capabilities"), "artifact.render");
      setControlValue(getLabeledControl(bindingForm!, "Enabled UI slots"), "artifacts.sidebar");
      setControlValue(getLabeledControl(bindingForm!, "Enabled API mounts"), "/plugins/review-bridge/hooks");
      setControlValue(getLabeledControl(bindingForm!, "Binding notes"), "Disabled during audit.");
      saveBindingButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(upsertPluginBindingMock).toHaveBeenCalledWith("instance_alpha", "plugin_review_bridge", expect.objectContaining({
      enabled: false,
      config: { mode: "preview", max_items: 8 },
      enabled_capabilities: ["artifact.render"],
      enabled_ui_slots: ["artifacts.sidebar"],
      enabled_api_mounts: ["/plugins/review-bridge/hooks"],
      notes: "Disabled during audit.",
    }));
    expect(container.textContent).toContain("saved");
  });
});
