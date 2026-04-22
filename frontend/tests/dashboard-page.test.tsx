// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchDashboardMock } = vi.hoisted(() => ({
  fetchDashboardMock: vi.fn(),
}));

const { fetchAccountsMock, fetchAuditHistoryMock } = vi.hoisted(() => ({
  fetchAccountsMock: vi.fn(),
  fetchAuditHistoryMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchAccounts: fetchAccountsMock,
    fetchAuditHistory: fetchAuditHistoryMock,
    fetchDashboard: fetchDashboardMock,
  };
});

import type { AdminSessionUser, DashboardResponse } from "../src/api/admin";
import { DashboardPage } from "../src/pages/DashboardPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

const viewerSession: AdminSessionUser = {
  session_id: "session-viewer",
  user_id: "user-viewer",
  username: "viewer",
  display_name: "Viewer",
  role: "viewer",
};

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createDashboardResponse({
  alerts = [],
  needsAttention = [],
  security,
}: {
  alerts?: Array<Record<string, string | number>>;
  needsAttention?: string[];
  security?: Record<string, string | number | boolean>;
} = {}): DashboardResponse {
  return {
    status: "ok",
    kpis: {
      providers: 3,
      active_models: 12,
      runtime_requests_24h: 24,
      errors_24h: 0,
      needs_attention_count: needsAttention.length,
      runtime_keys: 2,
      accounts: 2,
    },
    alerts,
    needs_attention: needsAttention,
    security,
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

async function renderDashboardPage(session: AdminSessionUser, path = "/dashboard") {
  await renderIntoDom(withAppContext({
    path,
    element: <DashboardPage />,
    session,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchDashboardMock.mockResolvedValue(createDashboardResponse());
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
  fetchAuditHistoryMock.mockResolvedValue({
    status: "ok",
    items: [
      {
        eventId: "audit_evt_dashboard_latest",
        createdAt: "2026-04-21T21:45:00Z",
        tenantId: "acct_alpha",
        companyId: null,
        actionKey: "runtime_key_issue",
        actionLabel: "Runtime key issued",
        status: "ok",
        statusLabel: "Succeeded",
        actor: { type: "admin_user", id: "admin_1", label: "Ops Admin", secondary: "ops-admin" },
        target: { type: "runtime_key", typeLabel: "Runtime key", id: "key_alpha", label: "Primary Runtime Key", secondary: "sk-live" },
        summary: "Runtime key issued.",
        detailAvailable: true,
      },
    ],
    page: { limit: 1, nextCursor: null, hasMore: false },
    retention: { eventLimit: 1000, oldestAvailableAt: "2026-04-20T10:00:00Z", retentionLimited: true },
    filters: {
      applied: { window: "all", action: null, actor: null, targetType: null, targetId: null, status: null },
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

describe("dashboard wayfinding", () => {
  it("uses the operator-safe governance label for non-admin users", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/dashboard",
        element: <DashboardPage />,
        session: operatorSession,
      }),
    );

    expect(markup).toContain(">Runtime Access Review<");
    expect(markup).toContain(">Operator safe<");
  });

  it("uses the admin governance label for admin users", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/dashboard",
        element: <DashboardPage />,
        session: adminSession,
      }),
    );

    expect(markup).toContain(">Policy Review<");
    expect(markup).toContain(">Admin only<");
  });

  it("renders admin-only bootstrap posture and governance action for admins", async () => {
    fetchDashboardMock.mockResolvedValueOnce(
      createDashboardResponse({
        security: {
          default_password_in_use: true,
          must_rotate_password: false,
          admin_auth_enabled: true,
        },
      }),
    );

    await renderDashboardPage(adminSession);

    expect(fetchDashboardMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Tighten governance posture");
    expect(container.textContent).toContain("Security Bootstrap");
  });

  it("keeps operator primary actions on shared operator-safe signals", async () => {
    fetchDashboardMock.mockResolvedValueOnce(createDashboardResponse());

    await renderDashboardPage(operatorSession);

    expect(fetchDashboardMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Confirm go-live readiness");
    expect(container.textContent).not.toContain("Security Bootstrap");
    expect(container.textContent).not.toContain("Review runtime access posture");
  });

  it("does not render admin-only bootstrap posture for viewers", async () => {
    fetchDashboardMock.mockResolvedValueOnce(createDashboardResponse());

    await renderDashboardPage(viewerSession);

    expect(fetchDashboardMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Confirm go-live readiness");
    expect(container.textContent).not.toContain("Security Bootstrap");
  });

  it("passes tenant scope from the URL into the dashboard fetch and renders the scope state", async () => {
    fetchDashboardMock.mockResolvedValueOnce(createDashboardResponse());

    await renderDashboardPage(operatorSession, "/dashboard?tenantId=acct_alpha");

    expect(fetchDashboardMock).toHaveBeenCalledWith("acct_alpha");
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({ tenantId: "acct_alpha", window: "all", limit: 1 });
    expect(container.textContent).toContain("Tenant scope: Tenant Alpha");
    expect(container.textContent).toContain("Scoped to Tenant Alpha");
  });

  it("preserves tenant scope on the shared accounts helper CTA", async () => {
    await renderDashboardPage(operatorSession, "/dashboard?tenantId=acct_alpha");

    const accountsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Open Accounts"));
    expect(accountsLink?.getAttribute("href")).toBe("/accounts?tenantId=acct_alpha");
  });

  it("deep-links the audit wayfinding card to the newest audit event in scope", async () => {
    await renderDashboardPage(operatorSession, "/dashboard?tenantId=acct_alpha");

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(auditLink?.getAttribute("href")).toBe("/logs?tenantId=acct_alpha&auditWindow=all&auditEvent=audit_evt_dashboard_latest#audit-history");
  });

  it("keeps viewer audit wayfinding on a static logs fallback without probing audit history", async () => {
    await renderDashboardPage(viewerSession, "/dashboard?tenantId=acct_alpha");

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(fetchAuditHistoryMock).not.toHaveBeenCalled();
    expect(auditLink?.getAttribute("href")).toBe("/logs?tenantId=acct_alpha&auditWindow=all#audit-history");
  });

  it("explains when the global dashboard view requires an explicit tenant scope", async () => {
    const error = Object.assign(new Error("Select a runtime account to continue."), { code: "tenant_filter_required", status: 400 });
    fetchDashboardMock.mockRejectedValueOnce(error);

    await renderDashboardPage(operatorSession);

    expect(container.textContent).toContain("Select a runtime account to continue.");
    expect(container.textContent).toContain("Mixed runtime history spans multiple tenants");
    expect(container.textContent).toContain("Runtime Tenant Scope");
  });
});
