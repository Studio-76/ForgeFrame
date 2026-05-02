// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createRuntimeKeyMock,
  fetchAccountsMock,
  fetchAuditHistoryMock,
  fetchInstancesMock,
  fetchRuntimeKeyRequestPathPolicyMock,
  fetchRuntimeKeysMock,
  rotateRuntimeKeyMock,
  setRuntimeKeyStatusMock,
  updateRuntimeKeyRequestPathPolicyMock,
} = vi.hoisted(() => ({
  createRuntimeKeyMock: vi.fn(),
  fetchAccountsMock: vi.fn(),
  fetchAuditHistoryMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
  fetchRuntimeKeyRequestPathPolicyMock: vi.fn(),
  fetchRuntimeKeysMock: vi.fn(),
  rotateRuntimeKeyMock: vi.fn(),
  setRuntimeKeyStatusMock: vi.fn(),
  updateRuntimeKeyRequestPathPolicyMock: vi.fn(),
}));

vi.mock("../src/api/admin/runtime-keys", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/runtime-keys")>("../src/api/admin/runtime-keys");
  return {
    ...actual,
    createRuntimeKey: createRuntimeKeyMock,
    fetchRuntimeKeyRequestPathPolicy: fetchRuntimeKeyRequestPathPolicyMock,
    fetchRuntimeKeys: fetchRuntimeKeysMock,
    rotateRuntimeKey: rotateRuntimeKeyMock,
    setRuntimeKeyStatus: setRuntimeKeyStatusMock,
    updateRuntimeKeyRequestPathPolicy: updateRuntimeKeyRequestPathPolicyMock,
  };
});

vi.mock("../src/api/admin/accounts", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/accounts")>("../src/api/admin/accounts");
  return {
    ...actual,
    fetchAccounts: fetchAccountsMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");
  return {
    ...actual,
    fetchAuditHistory: fetchAuditHistoryMock,
  };
});

import type { AdminSessionUser, GatewayAccount, InstanceRecord, RuntimeKey } from "../src/api/admin";
import { ApiKeysPage } from "../src/pages/ApiKeysPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

function createInstance(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Alpha Instance",
    description: "Primary runtime scope",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "restricted_eval",
    exposure_mode: "local_only",
    is_default: true,
    metadata: {},
    created_at: "2026-04-22T08:00:00Z",
    updated_at: "2026-04-22T08:00:00Z",
    ...overrides,
  };
}

function createAccount(overrides: Partial<GatewayAccount> = {}): GatewayAccount {
  return {
    account_id: "acct_alpha",
    instance_id: "instance_alpha",
    tenant_id: "tenant_alpha",
    label: "Tenant Alpha Runtime",
    status: "active",
    provider_bindings: ["openai_codex"],
    notes: "Primary account",
    created_at: "2026-04-21T10:00:00Z",
    updated_at: "2026-04-21T10:00:00Z",
    runtime_key_count: 1,
    last_activity_at: "2026-04-21T11:00:00Z",
    ...overrides,
  };
}

function createRuntimeKeyRecord(overrides: Partial<RuntimeKey> = {}): RuntimeKey {
  return {
    key_id: "key_alpha",
    account_id: "acct_alpha",
    instance_id: "instance_alpha",
    tenant_id: "tenant_alpha",
    label: "Primary Runtime Key",
    prefix: "fgk_alpha",
    scopes: ["models:read", "chat:write", "responses:write"],
    status: "active",
    created_at: "2026-04-21T10:05:00Z",
    updated_at: "2026-04-21T10:05:00Z",
    last_used_at: "2026-04-21T11:05:00Z",
    allowed_request_paths: ["smart_routing"],
    default_request_path: "smart_routing",
    pinned_target_key: null,
    local_only_policy: "require_local_target",
    review_required_conditions: [],
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root | null = null;
let clipboardWriteTextMock: ReturnType<typeof vi.fn>;

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

async function setControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = Object.getPrototypeOf(control) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(control, value);
    control.dispatchEvent(new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}

function getButtonByText(scope: ParentNode, text: string) {
  const button = Array.from(scope.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(text));
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  return button as HTMLButtonElement;
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

function getDrawerByTitle(title: string) {
  const drawer = container.querySelector(`aside[aria-label="${title}"]`);
  if (!drawer) {
    throw new Error(`Drawer not found: ${title}`);
  }
  return drawer;
}

async function renderApiKeysPage(session: AdminSessionUser = adminSession, path = "/api-keys?instanceId=instance_alpha") {
  await renderIntoDom(withAppContext({
    path,
    element: <ApiKeysPage />,
    session,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  clipboardWriteTextMock = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWriteTextMock },
  });

  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstance()],
  });
  fetchAccountsMock.mockResolvedValue({
    status: "ok",
    accounts: [createAccount()],
  });
  fetchRuntimeKeysMock.mockResolvedValue({
    status: "ok",
    keys: [createRuntimeKeyRecord()],
  });
  fetchRuntimeKeyRequestPathPolicyMock.mockResolvedValue({
    status: "ok",
    policy: {
      allowed_request_paths: ["smart_routing"],
      default_request_path: "smart_routing",
      pinned_target_key: null,
      local_only_policy: "require_local_target",
      review_required_conditions: [],
    },
  });
  fetchAuditHistoryMock.mockResolvedValue({
    status: "ok",
    items: [
      {
        eventId: "audit_evt_key_latest",
        createdAt: "2026-04-21T21:45:00Z",
        tenantId: "tenant_alpha",
        companyId: "company_alpha",
        actionKey: "runtime_key_issue",
        actionLabel: "Runtime key issued",
        status: "ok",
        statusLabel: "Succeeded",
        actor: { type: "admin_user", id: "admin_1", label: "Ops Admin", secondary: "ops-admin" },
        target: { type: "runtime_key", typeLabel: "Runtime key", id: "key_alpha", label: "Primary Runtime Key", secondary: "fgk_alpha" },
        summary: "Runtime key issued.",
        detailAvailable: true,
      },
    ],
    page: { limit: 1, nextCursor: null, hasMore: false },
    retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
    filters: {
      applied: { window: "all", action: null, actor: null, targetType: "runtime_key", targetId: null, status: null },
      available: { actions: [], statuses: [], targetTypes: [] },
    },
    summary: { totalInScope: 1, totalMatchingFilters: 1, latestEventAt: "2026-04-21T21:45:00Z" },
  });
  createRuntimeKeyMock.mockResolvedValue({
    status: "ok",
    issued: {
      key_id: "key_beta",
      instance_id: "instance_alpha",
      tenant_id: "tenant_alpha",
      token: "fg_live_secret_beta",
      prefix: "fgk_beta",
      account_id: "acct_alpha",
      label: "Beta Runtime Key",
      scopes: ["models:read", "chat:write", "responses:write"],
      created_at: "2026-04-21T12:00:00Z",
      allowed_request_paths: ["smart_routing"],
      default_request_path: "smart_routing",
      pinned_target_key: null,
      local_only_policy: "require_local_target",
      review_required_conditions: [],
    },
  });
  rotateRuntimeKeyMock.mockResolvedValue({
    status: "ok",
    issued: {
      key_id: "key_rotated",
      instance_id: "instance_alpha",
      tenant_id: "tenant_alpha",
      token: "fg_live_secret_rotated",
      prefix: "fgk_rotated",
      account_id: "acct_alpha",
      label: "Primary Runtime Key",
      scopes: ["models:read", "chat:write", "responses:write"],
      created_at: "2026-04-21T12:10:00Z",
    },
  });
  setRuntimeKeyStatusMock.mockResolvedValue({
    status: "ok",
    key: createRuntimeKeyRecord({ status: "disabled" }),
  });
  updateRuntimeKeyRequestPathPolicyMock.mockResolvedValue({
    status: "ok",
    key: createRuntimeKeyRecord({
      allowed_request_paths: ["smart_routing", "review_required"],
      review_required_conditions: ["budget_exceeded"],
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

describe("ApiKeysPage", () => {
  it("renders inventory truth and account-focused handoff without exposing stored secrets", async () => {
    await renderApiKeysPage(adminSession, "/api-keys?instanceId=instance_alpha&accountId=acct_alpha");

    expect(fetchRuntimeKeysMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchRuntimeKeyRequestPathPolicyMock).toHaveBeenCalledWith("instance_alpha", "key_alpha");
    expect(container.textContent).toContain("Runtime key inventory");
    expect(container.textContent).toContain("Focused account: Tenant Alpha Runtime");
    expect(container.textContent).toContain("Primary Runtime Key");
    expect(container.textContent).toContain("fgk_alpha");
    expect(container.textContent).not.toContain("fg_live_secret");
    expect(container.textContent).toContain("Original issue");
  });

  it("issues a key through the drawer and shows the secret exactly once with copy support", async () => {
    fetchRuntimeKeysMock
      .mockResolvedValueOnce({
        status: "ok",
        keys: [createRuntimeKeyRecord()],
      })
      .mockResolvedValueOnce({
        status: "ok",
        keys: [
          createRuntimeKeyRecord(),
          createRuntimeKeyRecord({
            key_id: "key_beta",
            label: "Beta Runtime Key",
            prefix: "fgk_beta",
            created_at: "2026-04-21T12:00:00Z",
            last_used_at: null,
          }),
        ],
      });

    await renderApiKeysPage();

    await act(async () => {
      getButtonByText(container, "Issue runtime key").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const drawer = getDrawerByTitle("Issue Runtime Key");
    await setControlValue(getLabeledControl(drawer, "Key label"), "Beta Runtime Key");
    await setControlValue(getLabeledControl(drawer, "Account"), "acct_alpha");

    await act(async () => {
      getButtonByText(drawer, "Issue key").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(createRuntimeKeyMock).toHaveBeenCalledWith("instance_alpha", {
      label: "Beta Runtime Key",
      account_id: "acct_alpha",
      scopes: ["models:read", "chat:write", "responses:write"],
      allowed_request_paths: ["smart_routing"],
      default_request_path: "smart_routing",
      pinned_target_key: null,
      local_only_policy: "require_local_target",
      review_required_conditions: [],
    });
    expect(container.textContent).toContain("One-time secret: newly issued key");
    expect(container.textContent).toContain("fg_live_secret_beta");

    await act(async () => {
      getButtonByText(container, "Copy secret").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(clipboardWriteTextMock).toHaveBeenCalledWith("fg_live_secret_beta");
    expect(container.textContent).toContain("Secret copied");
  });

  it("keeps rotation separate from disable/revoke lifecycle actions", async () => {
    fetchRuntimeKeysMock
      .mockResolvedValueOnce({
        status: "ok",
        keys: [createRuntimeKeyRecord()],
      })
      .mockResolvedValueOnce({
        status: "ok",
        keys: [
          createRuntimeKeyRecord({
            key_id: "key_rotated",
            prefix: "fgk_rotated",
            rotated_from: "key_alpha",
            created_at: "2026-04-21T12:10:00Z",
          }),
        ],
      })
      .mockResolvedValueOnce({
        status: "ok",
        keys: [
          createRuntimeKeyRecord({
            key_id: "key_rotated",
            prefix: "fgk_rotated",
            rotated_from: "key_alpha",
            status: "disabled",
            created_at: "2026-04-21T12:10:00Z",
          }),
        ],
      });

    await renderApiKeysPage();

    await act(async () => {
      getButtonByText(container, "Rotate key").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(rotateRuntimeKeyMock).toHaveBeenCalledWith("instance_alpha", "key_alpha");
    expect(container.textContent).toContain("One-time secret: rotated key");
    expect(container.textContent).toContain("fg_live_secret_rotated");

    await act(async () => {
      getButtonByText(container, "Disable key").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(setRuntimeKeyStatusMock).toHaveBeenCalledWith("instance_alpha", "key_rotated", "disable");
    expect(container.textContent).toContain("Runtime key 'Primary Runtime Key' disabled.");
    expect(container.textContent).toContain("fg_live_secret_rotated");
  });

  it("saves the request-path policy from its dedicated section", async () => {
    fetchRuntimeKeysMock
      .mockResolvedValueOnce({
        status: "ok",
        keys: [createRuntimeKeyRecord()],
      })
      .mockResolvedValueOnce({
        status: "ok",
        keys: [
          createRuntimeKeyRecord({
            allowed_request_paths: ["smart_routing", "review_required"],
            review_required_conditions: ["budget_exceeded"],
          }),
        ],
      });
    fetchRuntimeKeyRequestPathPolicyMock
      .mockResolvedValueOnce({
        status: "ok",
        policy: {
          allowed_request_paths: ["smart_routing"],
          default_request_path: "smart_routing",
          pinned_target_key: null,
          local_only_policy: "require_local_target",
          review_required_conditions: [],
        },
      })
      .mockResolvedValue({
        status: "ok",
        policy: {
          allowed_request_paths: ["smart_routing", "review_required"],
          default_request_path: "smart_routing",
          pinned_target_key: null,
          local_only_policy: "require_local_target",
          review_required_conditions: ["budget_exceeded"],
        },
      });

    await renderApiKeysPage();

    await setControlValue(getLabeledControl(container, "Allowed request paths"), "smart_routing\nreview_required");
    await setControlValue(getLabeledControl(container, "Review-required conditions"), "budget_exceeded");

    await act(async () => {
      getButtonByText(container, "Save policy").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(updateRuntimeKeyRequestPathPolicyMock).toHaveBeenCalledWith("instance_alpha", "key_alpha", {
      allowed_request_paths: ["smart_routing", "review_required"],
      default_request_path: "smart_routing",
      pinned_target_key: null,
      local_only_policy: "require_local_target",
      review_required_conditions: ["budget_exceeded"],
    });
    expect(container.textContent).toContain("Request-path policy for 'Primary Runtime Key' saved.");
  });

  it("keeps mutation controls out of read-only sessions", async () => {
    await renderApiKeysPage(operatorSession);

    expect(container.textContent).toContain("Read-only key review");
    expect(container.textContent).toContain("cannot issue, rotate, or change key status");
    expect(container.textContent).not.toContain("Issue runtime key");
    expect(container.textContent).not.toContain("Rotate key");
    expect(container.textContent).not.toContain("Disable key");
    expect(container.textContent).not.toContain("Save policy");
  });
});
