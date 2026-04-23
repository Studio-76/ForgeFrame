// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchDashboardMock, fetchAuditHistoryMock, fetchInstancesMock } = vi.hoisted(() => ({
  fetchDashboardMock: vi.fn(),
  fetchAuditHistoryMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchDashboard: fetchDashboardMock,
    fetchAuditHistory: fetchAuditHistoryMock,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, DashboardResponse, InstanceRecord } from "../src/api/admin";
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

function createInstance(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Alpha Instance",
    description: "Alpha instance for dashboard coverage.",
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

function createDashboardResponse(): DashboardResponse {
  return {
    status: "ok",
    kpis: {
      providers: 3,
      active_models: 12,
      runtime_requests_24h: 24,
      errors_24h: 0,
      needs_attention_count: 0,
      runtime_keys: 2,
      accounts: 2,
    },
    alerts: [],
    needs_attention: [],
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
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstance()],
  });
  fetchDashboardMock.mockResolvedValue(createDashboardResponse());
  fetchAuditHistoryMock.mockResolvedValue({
    status: "ok",
    items: [
      {
        eventId: "audit_evt_dashboard_latest",
        createdAt: "2026-04-21T21:45:00Z",
        tenantId: "tenant_alpha",
        companyId: "company_alpha",
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

describe("dashboard instance scope", () => {
  it("loads dashboard and audit truth against the selected instance", async () => {
    await renderDashboardPage(operatorSession, "/dashboard?instanceId=instance_alpha");

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchDashboardMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({ instanceId: "instance_alpha", window: "all", limit: 1 });
    expect(container.textContent).toContain("Instance scope: Alpha Instance");

    const accountsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Policy Review") || link.textContent?.includes("Runtime Access Review"));
    expect(accountsLink?.getAttribute("href")).toBe("/accounts?instanceId=instance_alpha");

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(auditLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=all&auditEvent=audit_evt_dashboard_latest#audit-history");
  });

  it("keeps viewers on the static audit fallback without probing audit history", async () => {
    await renderDashboardPage(viewerSession, "/dashboard?instanceId=instance_alpha");

    expect(fetchDashboardMock).toHaveBeenCalledWith("instance_alpha");
    expect(fetchAuditHistoryMock).not.toHaveBeenCalled();

    const auditLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Audit History"));
    expect(auditLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=all#audit-history");
  });
});
