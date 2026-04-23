// @vitest-environment jsdom

import { act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAccountsMock, fetchAuditHistoryMock, fetchRuntimeKeysMock, fetchInstancesMock } = vi.hoisted(() => ({
  fetchAccountsMock: vi.fn(),
  fetchAuditHistoryMock: vi.fn(),
  fetchRuntimeKeysMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchAccounts: fetchAccountsMock,
    fetchAuditHistory: fetchAuditHistoryMock,
    fetchRuntimeKeys: fetchRuntimeKeysMock,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, AuditHistoryResponse, GatewayAccount, InstanceRecord, RuntimeKey } from "../src/api/admin";
import { AccountsPage } from "../src/pages/AccountsPage";
import { ApiKeysPage } from "../src/pages/ApiKeysPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
    description: "Alpha instance",
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
    label: "Tenant Alpha",
    status: "active",
    provider_bindings: ["openai_codex"],
    notes: "",
    created_at: "2026-04-21T10:00:00Z",
    updated_at: "2026-04-21T10:00:00Z",
    runtime_key_count: 1,
    ...overrides,
  };
}

function createRuntimeKey(overrides: Partial<RuntimeKey> = {}): RuntimeKey {
  return {
    key_id: "key_alpha",
    account_id: "acct_alpha",
    instance_id: "instance_alpha",
    tenant_id: "tenant_alpha",
    label: "Tenant Alpha Key",
    prefix: "fg_live_alpha",
    scopes: ["models:read", "chat:write", "responses:write"],
    status: "active",
    created_at: "2026-04-21T10:05:00Z",
    updated_at: "2026-04-21T10:05:00Z",
    ...overrides,
  };
}

function createAuditHistoryResponse(eventId: string, targetType: string): AuditHistoryResponse {
  return {
    status: "ok",
    items: [
      {
        eventId,
        createdAt: "2026-04-21T21:45:00Z",
        tenantId: "tenant_alpha",
        companyId: "company_alpha",
        actionKey: "runtime_key_issue",
        actionLabel: "Runtime key issued",
        status: "ok",
        statusLabel: "Succeeded",
        actor: { type: "admin_user", id: "admin_1", label: "Ops Admin", secondary: "ops-admin" },
        target: { type: targetType, typeLabel: "Runtime key", id: "key_alpha", label: "Tenant Alpha Key", secondary: "fg_live_alpha" },
        summary: "Runtime key issued.",
        detailAvailable: true,
      },
    ],
    page: { limit: 1, nextCursor: null, hasMore: false },
    retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
    filters: {
      applied: { window: "all", action: null, actor: null, targetType, targetId: null, status: null },
      available: { actions: [], statuses: [], targetTypes: [] },
    },
    summary: { totalInScope: 1, totalMatchingFilters: 1, latestEventAt: "2026-04-21T21:45:00Z" },
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

async function renderPage(path: string, element: ReactElement) {
  await renderIntoDom(withAppContext({
    path,
    element,
    session: operatorSession,
  }));
  await flushEffects();
}

function collectLinkHrefs(): string[] {
  return Array.from(container.querySelectorAll("a"))
    .map((link) => link.getAttribute("href"))
    .filter((href): href is string => Boolean(href));
}

beforeEach(() => {
  vi.resetAllMocks();
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
    keys: [createRuntimeKey()],
  });
  fetchAuditHistoryMock.mockResolvedValue(createAuditHistoryResponse("audit_evt_account_scope", "gateway_account"));
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

describe("governance instance scope", () => {
  it("loads accounts and audit handoff within the active instance scope", async () => {
    await renderPage("/accounts?instanceId=instance_alpha", <AccountsPage />);

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchAccountsMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      window: "all",
      targetType: "gateway_account",
      targetId: null,
      limit: 1,
    });
    expect(container.textContent).toContain("Instance scope: Alpha Instance");

    const hrefs = collectLinkHrefs();
    expect(hrefs).toContain("/accounts?instanceId=instance_alpha");
    expect(hrefs).toContain("/api-keys?instanceId=instance_alpha");
    expect(hrefs).toContain("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=gateway_account&auditEvent=audit_evt_account_scope#audit-history");
  });

  it("loads runtime keys and account inventory within the active instance scope", async () => {
    fetchAuditHistoryMock.mockResolvedValueOnce(createAuditHistoryResponse("audit_evt_key_scope", "runtime_key"));

    await renderPage("/api-keys?instanceId=instance_alpha", <ApiKeysPage />);

    expect(fetchRuntimeKeysMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchAccountsMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      window: "all",
      targetType: "runtime_key",
      targetId: null,
      limit: 1,
    });
    expect(container.textContent).toContain("Instance scope: Alpha Instance");

    const hrefs = collectLinkHrefs();
    expect(hrefs).toContain("/api-keys?instanceId=instance_alpha");
    expect(hrefs).toContain("/accounts?instanceId=instance_alpha");
    expect(hrefs).toContain("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=runtime_key&auditEvent=audit_evt_key_scope#audit-history");
  });
});
