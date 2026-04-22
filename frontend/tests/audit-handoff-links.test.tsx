// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchAccountsMock,
  fetchAuditHistoryMock,
  fetchRuntimeKeysMock,
} = vi.hoisted(() => ({
  fetchAccountsMock: vi.fn(),
  fetchAuditHistoryMock: vi.fn(),
  fetchRuntimeKeysMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchAccounts: fetchAccountsMock,
    fetchAuditHistory: fetchAuditHistoryMock,
    fetchRuntimeKeys: fetchRuntimeKeysMock,
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
  await renderIntoDom(withAppContext({
    path,
    element: element as JSX.Element,
    session,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchAccountsMock.mockResolvedValue({
    status: "ok",
    accounts: [
      {
        account_id: "acct_alpha",
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
        prefix: "fgk_alpha",
        label: "Primary Runtime Key",
        account_id: "acct_alpha",
        scopes: ["models:read", "chat:write"],
        status: "active",
        created_at: "2026-04-21T10:05:00Z",
        updated_at: "2026-04-21T10:05:00Z",
        expires_at: null,
        last_used_at: null,
        secret_hash: "hash",
      },
    ],
  });
  fetchAuditHistoryMock.mockImplementation(async (query?: { targetType?: string | null }) => {
    if (query?.targetType === "runtime_key") {
      return {
        status: "ok",
        items: [
          {
            eventId: "audit_evt_key_latest",
            createdAt: "2026-04-21T21:46:00Z",
            tenantId: "acct_alpha",
            companyId: null,
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
        filters: { applied: { window: "all", action: null, actor: null, targetType: "runtime_key", targetId: null, status: null }, available: { actions: [], statuses: [], targetTypes: [] } },
        summary: { totalInScope: 1, totalMatchingFilters: 1, latestEventAt: "2026-04-21T21:46:00Z" },
      };
    }

    return {
      status: "ok",
      items: [
        {
          eventId: "audit_evt_account_latest",
          createdAt: "2026-04-21T21:45:00Z",
          tenantId: "acct_alpha",
          companyId: null,
          actionKey: "account_update",
          actionLabel: "Account updated",
          status: "ok",
          statusLabel: "Succeeded",
          actor: { type: "admin_user", id: "admin_1", label: "Ops Admin", secondary: "ops-admin" },
          target: { type: "gateway_account", typeLabel: "Gateway account", id: "acct_alpha", label: "Tenant Alpha", secondary: "acct_alpha" },
          summary: "Account updated.",
          detailAvailable: true,
        },
      ],
      page: { limit: 1, nextCursor: null, hasMore: false },
      retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
      filters: { applied: { window: "all", action: null, actor: null, targetType: "gateway_account", targetId: null, status: null }, available: { actions: [], statuses: [], targetTypes: [] } },
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
  it("routes Accounts to the newest account-related audit event", async () => {
    await renderPage("/accounts", <AccountsPage />);

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      tenantId: null,
      window: "all",
      targetType: "gateway_account",
      targetId: null,
      limit: 1,
    });
    expect(auditLink?.getAttribute("href")).toContain("auditTargetType=gateway_account");
    expect(auditLink?.getAttribute("href")).toContain("auditEvent=audit_evt_account_latest");
  });

  it("routes API Keys to the newest runtime-key audit event", async () => {
    await renderPage("/api-keys", <ApiKeysPage />);

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      tenantId: null,
      window: "all",
      targetType: "runtime_key",
      targetId: null,
      limit: 1,
    });
    expect(auditLink?.getAttribute("href")).toContain("auditTargetType=runtime_key");
    expect(auditLink?.getAttribute("href")).toContain("auditEvent=audit_evt_key_latest");
  });

  it("keeps Accounts on a static audit-history fallback for viewer sessions", async () => {
    await renderPage("/accounts?tenantId=acct_alpha", <AccountsPage />, viewerSession);

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(fetchAuditHistoryMock).not.toHaveBeenCalled();
    expect(auditLink?.getAttribute("href")).toBe(
      "/logs?tenantId=acct_alpha&auditWindow=all&auditTargetType=gateway_account#audit-history",
    );
  });

  it("keeps API Keys on a static audit-history fallback for viewer sessions", async () => {
    await renderPage("/api-keys?tenantId=acct_alpha", <ApiKeysPage />, viewerSession);

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(fetchAuditHistoryMock).not.toHaveBeenCalled();
    expect(auditLink?.getAttribute("href")).toBe(
      "/logs?tenantId=acct_alpha&auditWindow=all&auditTargetType=runtime_key#audit-history",
    );
  });
});
