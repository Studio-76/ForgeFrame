// @vitest-environment jsdom

import { act, type ReactNode } from "react";
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

import type { AdminSessionUser } from "../src/api/admin";
import { AccountsPage } from "../src/pages/AccountsPage";
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

const viewerSession: AdminSessionUser = {
  session_id: "session-viewer",
  user_id: "user-viewer",
  username: "viewer",
  display_name: "Viewer",
  role: "viewer",
};

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

async function renderPage(path: string, element: ReactNode, session: AdminSessionUser = adminSession) {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  await renderIntoDom(withAppContext({
    path,
    element: element as JSX.Element,
    session,
  }));
  await flushEffects();
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
      },
    ],
  });
  fetchAccountsMock.mockResolvedValue({
    status: "ok",
    accounts: [
      {
        account_id: "acct_alpha",
        instance_id: "instance_alpha",
        tenant_id: "tenant_alpha",
        label: "Tenant Alpha",
        status: "active",
        provider_bindings: [],
        notes: "",
        created_at: "2026-04-21T10:00:00Z",
        updated_at: "2026-04-21T10:00:00Z",
        runtime_key_count: 1,
      },
    ],
  });
  fetchRuntimeKeysMock.mockResolvedValue({
    status: "ok",
    keys: [
      {
        key_id: "key_alpha",
        account_id: "acct_alpha",
        instance_id: "instance_alpha",
        tenant_id: "tenant_alpha",
        prefix: "fgk_alpha",
        label: "Primary Runtime Key",
        scopes: ["models:read", "chat:write"],
        status: "active",
        created_at: "2026-04-21T10:05:00Z",
        updated_at: "2026-04-21T10:05:00Z",
      },
    ],
  });
  fetchAuditHistoryMock.mockImplementation(async (query?: { targetType?: string | null }) => {
    const eventId = query?.targetType === "runtime_key" ? "audit_evt_key_latest" : "audit_evt_account_latest";
    return {
      status: "ok",
      items: [
        {
          eventId,
          createdAt: "2026-04-21T21:45:00Z",
          tenantId: "tenant_alpha",
          companyId: "company_alpha",
          actionKey: "account_update",
          actionLabel: "Account updated",
          status: "ok",
          statusLabel: "Succeeded",
          actor: { type: "admin_user", id: "admin_1", label: "Ops Admin", secondary: "ops-admin" },
          target: { type: query?.targetType ?? "gateway_account", typeLabel: "Target", id: "target-alpha", label: "Target", secondary: null },
          summary: "Account updated.",
          detailAvailable: true,
        },
      ],
      page: { limit: 1, nextCursor: null, hasMore: false },
      retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
      filters: { applied: { window: "all", action: null, actor: null, targetType: query?.targetType ?? null, targetId: null, status: null }, available: { actions: [], statuses: [], targetTypes: [] } },
      summary: { totalInScope: 1, totalMatchingFilters: 1, latestEventAt: "2026-04-21T21:45:00Z" },
    };
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

describe("governance audit handoff links", () => {
  it("routes Accounts to the newest account-related audit event inside the active instance", async () => {
    await renderPage("/accounts?instanceId=instance_alpha", <AccountsPage />);

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      window: "all",
      targetType: "gateway_account",
      targetId: null,
      limit: 1,
    });
    expect(auditLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=gateway_account&auditEvent=audit_evt_account_latest#audit-history");
  });

  it("routes API Keys to the newest runtime-key audit event inside the active instance", async () => {
    await renderPage("/api-keys?instanceId=instance_alpha", <ApiKeysPage />);

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      window: "all",
      targetType: "runtime_key",
      targetId: null,
      limit: 1,
    });
    expect(auditLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=runtime_key&auditEvent=audit_evt_key_latest#audit-history");
  });

  it("keeps viewer fallbacks on instance-scoped static audit history links", async () => {
    await renderPage("/accounts?instanceId=instance_alpha", <AccountsPage />, viewerSession);
    let auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(fetchAuditHistoryMock).not.toHaveBeenCalled();
    expect(auditLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=gateway_account#audit-history");

    await renderPage("/api-keys?instanceId=instance_alpha", <ApiKeysPage />, viewerSession);
    auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(auditLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=all&auditTargetType=runtime_key#audit-history");
  });
});
