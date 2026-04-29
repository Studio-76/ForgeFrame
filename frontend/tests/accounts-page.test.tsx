// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchAccountsMock,
  createAccountMock,
  updateAccountMock,
  fetchInstancesMock,
  fetchAuditHistoryMock,
} = vi.hoisted(() => ({
  fetchAccountsMock: vi.fn(),
  createAccountMock: vi.fn(),
  updateAccountMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
  fetchAuditHistoryMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchAccounts: fetchAccountsMock,
    createAccount: createAccountMock,
    updateAccount: updateAccountMock,
    fetchInstances: fetchInstancesMock,
    fetchAuditHistory: fetchAuditHistoryMock,
  };
});

import type { AdminSessionUser, GatewayAccount, InstanceRecord } from "../src/api/admin";
import { AccountsPage } from "../src/pages/AccountsPage";
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
    description: "Primary customer instance",
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

function createGatewayAccount(overrides: Partial<GatewayAccount> = {}): GatewayAccount {
  return {
    account_id: "acct_alpha",
    instance_id: "instance_alpha",
    tenant_id: "tenant_alpha",
    label: "Tenant Alpha Runtime",
    status: "active",
    provider_bindings: ["openai_codex"],
    notes: "Owned by customer success.",
    created_at: "2026-04-21T10:00:00Z",
    updated_at: "2026-04-21T10:00:00Z",
    runtime_key_count: 1,
    last_activity_at: null,
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

async function renderAccountsPage(session: AdminSessionUser = adminSession) {
  await renderIntoDom(withAppContext({
    path: "/accounts?instanceId=instance_alpha",
    element: <AccountsPage />,
    session,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstance()],
  });
  fetchAccountsMock.mockResolvedValue({
    status: "ok",
    accounts: [createGatewayAccount()],
  });
  createAccountMock.mockResolvedValue({
    status: "ok",
    account: createGatewayAccount({
      account_id: "acct_beta",
      label: "Beta Runtime",
      provider_bindings: ["openai_codex", "local_ollama"],
      notes: "Created from drawer.",
      runtime_key_count: 0,
    }),
  });
  updateAccountMock.mockResolvedValue({
    status: "ok",
    account: createGatewayAccount({
      label: "Tenant Alpha Runtime Updated",
      provider_bindings: ["local_ollama"],
      notes: "Updated profile.",
    }),
  });
  fetchAuditHistoryMock.mockResolvedValue({
    status: "ok",
    items: [
      {
        eventId: "audit_evt_account_latest",
        createdAt: "2026-04-21T21:45:00Z",
        tenantId: "tenant_alpha",
        companyId: "company_alpha",
        actionKey: "account_update",
        actionLabel: "Account updated",
        status: "ok",
        statusLabel: "Succeeded",
        actor: { type: "admin_user", id: "admin_1", label: "Ops Admin", secondary: "ops-admin" },
        target: { type: "gateway_account", typeLabel: "Account", id: "acct_alpha", label: "Tenant Alpha Runtime", secondary: null },
        summary: "Account updated.",
        detailAvailable: true,
      },
    ],
    page: { limit: 1, nextCursor: null, hasMore: false },
    retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
    filters: {
      applied: { window: "all", action: null, actor: null, targetType: "gateway_account", targetId: null, status: null },
      available: { actions: [], statuses: [], targetTypes: [] },
    },
    summary: { totalInScope: 1, totalMatchingFilters: 1, latestEventAt: "2026-04-21T21:45:00Z" },
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

describe("AccountsPage", () => {
  it("renders inventory, scoped links, and honest archive support status", async () => {
    await renderAccountsPage();

    expect(fetchAccountsMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      window: "all",
      targetType: "gateway_account",
      targetId: null,
      limit: 1,
    });
    expect(container.textContent).toContain("Runtime identity inventory");
    expect(container.textContent).toContain("Tenant Alpha Runtime");
    expect(container.textContent).toContain("Live keys without usage evidence");
    expect(container.textContent).toContain("Archive lifecycle unsupported");

    const hrefs = Array.from(container.querySelectorAll("a"))
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => Boolean(href));
    expect(hrefs).toContain("/accounts?instanceId=instance_alpha");
    expect(hrefs).toContain("/api-keys?instanceId=instance_alpha");
    expect(hrefs).toContain("/api-keys?instanceId=instance_alpha&accountId=acct_alpha");
    expect(hrefs).toContain("/instances?instanceId=instance_alpha");
    expect(hrefs).toContain("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=gateway_account&auditEvent=audit_evt_account_latest#audit-history");
    expect(hrefs).toContain("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=gateway_account&auditTargetId=acct_alpha#audit-history");
  });

  it("creates a new account from the drawer with validated provider bindings", async () => {
    fetchAccountsMock
      .mockResolvedValueOnce({
        status: "ok",
        accounts: [createGatewayAccount()],
      })
      .mockResolvedValueOnce({
        status: "ok",
        accounts: [
          createGatewayAccount(),
          createGatewayAccount({
            account_id: "acct_beta",
            label: "Beta Runtime",
            provider_bindings: ["openai_codex", "local_ollama"],
            notes: "Created from drawer.",
            runtime_key_count: 0,
          }),
        ],
      });

    await renderAccountsPage();

    await act(async () => {
      getButtonByText(container, "Create account").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const drawer = getDrawerByTitle("Create Account");
    await setControlValue(getLabeledControl(drawer, "Account label"), "Beta Runtime");
    await setControlValue(getLabeledControl(drawer, "Provider bindings"), "openai_codex\nlocal_ollama\nopenai_codex");
    await setControlValue(getLabeledControl(drawer, "Notes"), "Created from drawer.");

    expect(drawer.textContent).toContain("Provider bindings must be unique.");

    await setControlValue(getLabeledControl(drawer, "Provider bindings"), "openai_codex\nlocal_ollama");

    await act(async () => {
      getButtonByText(drawer, "Create account").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(createAccountMock).toHaveBeenCalledWith("instance_alpha", {
      label: "Beta Runtime",
      provider_bindings: ["openai_codex", "local_ollama"],
      notes: "Created from drawer.",
    });
    expect(container.textContent).toContain("Account 'Beta Runtime' created.");
  });

  it("updates the selected account profile and lifecycle through real mutations", async () => {
    fetchAccountsMock
      .mockResolvedValueOnce({
        status: "ok",
        accounts: [createGatewayAccount()],
      })
      .mockResolvedValueOnce({
        status: "ok",
        accounts: [
          createGatewayAccount({
            label: "Tenant Alpha Runtime Updated",
            provider_bindings: ["local_ollama"],
            notes: "Updated profile.",
          }),
        ],
      })
      .mockResolvedValueOnce({
        status: "ok",
        accounts: [
          createGatewayAccount({
            status: "disabled",
            label: "Tenant Alpha Runtime Updated",
            provider_bindings: ["local_ollama"],
            notes: "Updated profile.",
          }),
        ],
      });

    updateAccountMock
      .mockResolvedValueOnce({
        status: "ok",
        account: createGatewayAccount({
          label: "Tenant Alpha Runtime Updated",
          provider_bindings: ["local_ollama"],
          notes: "Updated profile.",
        }),
      })
      .mockResolvedValueOnce({
        status: "ok",
        account: createGatewayAccount({
          status: "disabled",
          label: "Tenant Alpha Runtime Updated",
          provider_bindings: ["local_ollama"],
          notes: "Updated profile.",
        }),
      });

    await renderAccountsPage();

    await act(async () => {
      getButtonByText(container, "Edit selected account").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const drawer = getDrawerByTitle("Edit Account");
    await setControlValue(getLabeledControl(drawer, "Account label"), "Tenant Alpha Runtime Updated");
    await setControlValue(getLabeledControl(drawer, "Provider bindings"), "local_ollama");
    await setControlValue(getLabeledControl(drawer, "Notes"), "Updated profile.");

    await act(async () => {
      getButtonByText(drawer, "Save account changes").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(updateAccountMock).toHaveBeenNthCalledWith(1, "instance_alpha", "acct_alpha", {
      label: "Tenant Alpha Runtime Updated",
      provider_bindings: ["local_ollama"],
      notes: "Updated profile.",
    });
    expect(container.textContent).toContain("Account 'Tenant Alpha Runtime Updated' updated.");

    await act(async () => {
      getButtonByText(container, "Deactivate account").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(updateAccountMock).toHaveBeenNthCalledWith(2, "instance_alpha", "acct_alpha", { status: "disabled" });
    expect(container.textContent).toContain("set to disabled");
  });

  it("hides create, edit, and lifecycle mutation controls for read-only review sessions", async () => {
    await renderAccountsPage(operatorSession);

    expect(container.textContent).toContain("Read-only account review");
    expect(container.textContent).toContain("cannot mutate account profile or lifecycle");
    expect(container.textContent).toContain("Lifecycle mutations are hidden in read-only sessions");
    expect(container.textContent).not.toContain("Create account");
    expect(container.textContent).not.toContain("Edit selected account");
    expect(container.textContent).not.toContain("Activate account");
    expect(container.textContent).not.toContain("Deactivate account");
  });
});
