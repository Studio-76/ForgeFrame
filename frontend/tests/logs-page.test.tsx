// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchAccountsMock,
  fetchAuditHistoryDetailMock,
  fetchAuditHistoryMock,
  fetchLogsMock,
  generateAuditExportMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchAccountsMock: vi.fn(),
  fetchAuditHistoryDetailMock: vi.fn(),
  fetchAuditHistoryMock: vi.fn(),
  fetchLogsMock: vi.fn(),
  generateAuditExportMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchAccounts: fetchAccountsMock,
    fetchAuditHistory: fetchAuditHistoryMock,
    fetchAuditHistoryDetail: fetchAuditHistoryDetailMock,
    fetchLogs: fetchLogsMock,
    generateAuditExport: generateAuditExportMock,
  };
});

import { LogsPage } from "../src/pages/LogsPage";
import type {
  AdminSessionUser,
  AuditHistoryDetailResponse,
  AuditHistoryResponse,
  InstanceRecord,
  LogsResponse,
} from "../src/api/admin";
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

function createInstanceRecord(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Alpha Instance",
    description: "Alpha log scope",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "linux_host_native",
    exposure_mode: "same_origin",
    is_default: true,
    metadata: {},
    created_at: "2026-04-21T09:40:00Z",
    updated_at: "2026-04-21T09:40:00Z",
    ...overrides,
  };
}

function createLogsResponse(): LogsResponse {
  return {
    status: "ok",
    audit_preview: [
      {
        eventId: "audit_evt_1",
        createdAt: "2026-04-21T21:45:00Z",
        tenantId: "acct_alpha",
        companyId: null,
        actionKey: "runtime_key_issue",
        actionLabel: "Runtime key issued",
        status: "ok",
        statusLabel: "Succeeded",
        actor: { type: "admin_user", id: "admin_1", label: "Ops Admin", secondary: "ops-admin" },
        target: { type: "runtime_key", typeLabel: "Runtime key", id: "key_alpha", label: "Primary Runtime Key", secondary: "sk-live" },
        summary: "Runtime key 'Primary Runtime Key' issued.",
        detailAvailable: true,
      },
    ],
    audit_retention: {
      eventLimit: 1000,
      oldestAvailableAt: "2026-04-20T10:00:00Z",
      retentionLimited: true,
      latestEventAt: "2026-04-21T21:45:00Z",
    },
    alerts: [],
    error_summary: {
      errors_24h: 1,
      errors_by_provider: [{ provider: "openai_api", errors: 1 }],
      errors_by_type: [{ error_key: "provider_error", errors: 1 }],
    },
    operability: {
      ready: true,
      checks: [
        { id: "runtime_signal_path", ok: true, details: "requests_24h=4" },
        { id: "audit_signal_path", ok: true, details: "audit_events=3" },
      ],
      metrics: { runtime_requests: 4 },
      logging: { audit_event_count: 3 },
      tracing: { release_scope: "non_release" },
    },
  };
}

function createAuditHistoryResponse({
  items,
  totalInScope,
  totalMatchingFilters,
}: {
  items?: AuditHistoryResponse["items"];
  totalInScope?: number;
  totalMatchingFilters?: number;
} = {}): AuditHistoryResponse {
  const rows = items
    ? items
    : [
        {
          eventId: "audit_evt_1",
          createdAt: "2026-04-21T21:45:00Z",
          tenantId: "acct_alpha",
          companyId: null,
          actionKey: "execution_run_replay",
          actionLabel: "Execution replay admitted",
          status: "warning",
          statusLabel: "Needs attention",
          actor: { type: "admin_user", id: "admin_1", label: "Ops Admin", secondary: "ops-admin" },
          target: { type: "execution_run", typeLabel: "Execution run", id: "run_123", label: "run_123", secondary: "run_123" },
          summary: "Replay admitted for run 'run_123'.",
          detailAvailable: true,
        },
      ];

  return {
    status: "ok",
    items: rows,
    page: {
      limit: 25,
      nextCursor: null,
      hasMore: false,
    },
    retention: {
      eventLimit: 1000,
      oldestAvailableAt: "2026-04-20T10:00:00Z",
      retentionLimited: true,
    },
    filters: {
      applied: {
        window: "7d",
        action: null,
        actor: null,
        targetType: null,
        targetId: null,
        status: null,
      },
      available: {
        actions: [
          { value: "execution_run_replay", label: "Execution replay admitted" },
          { value: "runtime_key_issue", label: "Runtime key issued" },
        ],
        statuses: [
          { value: "ok", label: "Succeeded" },
          { value: "warning", label: "Needs attention" },
        ],
        targetTypes: [
          { value: "execution_run", label: "Execution run" },
          { value: "runtime_key", label: "Runtime key" },
        ],
      },
    },
    summary: {
      totalInScope: totalInScope ?? rows.length,
      totalMatchingFilters: totalMatchingFilters ?? rows.length,
      latestEventAt: rows[0]?.createdAt ?? null,
    },
  };
}

function createAuditHistoryDetail(): AuditHistoryDetailResponse {
  return {
    status: "ok",
    event: {
      eventId: "audit_evt_1",
      createdAt: "2026-04-21T21:45:00Z",
      tenantId: "acct_alpha",
      companyId: "company_alpha",
      actionKey: "execution_run_replay",
      actionLabel: "Execution replay admitted",
      status: "warning",
      statusLabel: "Needs attention",
    },
    actor: {
      type: "admin_user",
      id: "admin_1",
      label: "Ops Admin",
      secondary: "ops-admin",
    },
    target: {
      type: "execution_run",
      typeLabel: "Execution run",
      id: "run_123",
      label: "run_123",
      secondary: "run_123",
    },
    summary: "Replay admitted for run 'run_123'.",
    outcome: "Needs attention",
    changeContext: [
      { label: "Reason", value: "Replay after provider credentials were rotated and verified." },
      { label: "Command", value: "cmd_123" },
    ],
    changeContextUnavailable: false,
    rawMetadata: {
      reason: "Replay after provider credentials were rotated and verified.",
      command_id: "cmd_123",
    },
    redactions: [],
    relatedLinks: [{ label: "Open Provider Health & Runs", href: "/providers#provider-health-runs", kind: "control_plane_route" }],
  };
}

function createAuditExportResult(format: "json" | "csv" = "json") {
  return {
    exportId: "audit_export_1",
    filename: `forgeframe-audit-export-acct_alpha-20260421T214500Z.${format}`,
    status: "ready" as const,
    rowCount: 2,
    generatedAt: "2026-04-21T21:50:00Z",
    blob: new Blob([format === "csv" ? "event_id,action\n1,test" : "{}"], { type: format === "csv" ? "text/csv" : "application/json" }),
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

async function renderLogsPage(path = "/logs#audit-history") {
  await renderIntoDom(withAppContext({
    path,
    element: <LogsPage />,
    session: operatorSession,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
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
  fetchLogsMock.mockResolvedValue(createLogsResponse());
  fetchAuditHistoryMock.mockResolvedValue(createAuditHistoryResponse());
  fetchAuditHistoryDetailMock.mockResolvedValue(createAuditHistoryDetail());
  generateAuditExportMock.mockResolvedValue(createAuditExportResult());
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

describe("Logs page audit history workflow", () => {
  it("persists audit filters from the URL and exposes audit export as a distinct anchor on the same route", async () => {
    await renderLogsPage("/logs?instanceId=instance_alpha&auditWindow=30d&auditAction=runtime_key_issue&auditActor=ops&auditTargetType=runtime_key&auditTargetId=key_alpha&auditStatus=warning#audit-history");

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchLogsMock).toHaveBeenCalledWith("instance_alpha", undefined, null);
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      window: "30d",
      action: "runtime_key_issue",
      actor: "ops",
      targetType: "runtime_key",
      targetId: "key_alpha",
      status: "warning",
      limit: 25,
    });
    expect(container.textContent).toContain("Errors, Activity, and Audit History");
    expect(container.textContent).toContain("Export stays on this route");
    expect(container.textContent).toContain("Audit export");
    expect(container.textContent).toContain("Current export scope: Format: JSON · Instance: Alpha Instance · Window: 30d · Action: runtime_key_issue · Status: warning · Limit: 250");
    expect(container.textContent).not.toContain("Subject: ops runtime_key key_alpha");
    expect(container.querySelector<HTMLSelectElement>("#audit-history select")?.value).toBe("30d");
    expect(container.querySelector<HTMLInputElement>('input[placeholder="Search actor"]')?.value).toBe("ops");
    expect(container.querySelector<HTMLButtonElement>("#audit-export button")?.disabled).toBe(false);

    const exportLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Open Audit Export"));
    expect(exportLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=30d&auditAction=runtime_key_issue&auditStatus=warning#audit-export");
  });

  it("keeps company-scoped execution audit links on the company filter path", async () => {
    await renderLogsPage("/logs?instanceId=instance_alpha&companyId=company_alpha&auditWindow=all&auditAction=execution_run_replay&auditTargetType=execution_run&auditTargetId=run_alpha&auditStatus=ok&auditEvent=audit_evt_execution_replay#audit-history");

    expect(fetchLogsMock).toHaveBeenCalledWith("instance_alpha", undefined, "company_alpha");
    expect(fetchAuditHistoryMock).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      companyId: "company_alpha",
      window: "all",
      action: "execution_run_replay",
      actor: null,
      targetType: "execution_run",
      targetId: "run_alpha",
      status: "ok",
      limit: 25,
    });
    expect(fetchAuditHistoryDetailMock).toHaveBeenCalledWith("audit_evt_execution_replay", "instance_alpha", undefined, "company_alpha");

    const exportLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Open Audit Export"));
    expect(exportLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&companyId=company_alpha&auditWindow=all&auditAction=execution_run_replay&auditStatus=ok#audit-export");
  });

  it("preserves instance scope on the in-page audit export CTA", async () => {
    await renderLogsPage("/logs?instanceId=instance_alpha");

    const exportLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Open Audit Export"));
    expect(exportLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha&auditWindow=7d#audit-export");
  });

  it("generates an export from the shipped backend contract and leaves a durable package summary", async () => {
    generateAuditExportMock.mockResolvedValueOnce(createAuditExportResult("csv"));
    await renderLogsPage("/logs?instanceId=instance_alpha&auditWindow=30d&auditAction=runtime_key_issue&auditStatus=warning#audit-export");

    const formatSelect = container.querySelector<HTMLSelectElement>("#audit-export select");
    const exportInputs = container.querySelectorAll<HTMLInputElement>("#audit-export input");
    const subjectInput = exportInputs[0];
    const limitInput = exportInputs[1];
    const button = container.querySelector<HTMLButtonElement>("#audit-export button");
    expect(formatSelect).not.toBeNull();
    expect(subjectInput).toBeDefined();
    expect(limitInput).toBeDefined();
    expect(button).not.toBeNull();

    await act(async () => {
      formatSelect!.value = "csv";
      formatSelect?.dispatchEvent(new Event("change", { bubbles: true }));
      subjectInput!.value = "runtime key evidence";
      subjectInput!.dispatchEvent(new Event("input", { bubbles: true }));
      limitInput!.value = "40";
      limitInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flushEffects();

    expect(formatSelect?.value).toBe("csv");
    expect(button?.textContent).toContain("Generate CSV export");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(generateAuditExportMock).toHaveBeenCalledWith({
      format: "csv",
      window: "30d",
      action: "runtime_key_issue",
      status: "warning",
      subject: "runtime key evidence",
      limit: 40,
    }, "instance_alpha", undefined, null);
    expect(container.textContent).toContain("Latest exported package");
    expect(container.textContent).toContain("forgeframe-audit-export-acct_alpha-20260421T214500Z.csv");
    expect(container.textContent).toContain("Rows exported: 2");
    expect(container.textContent).toContain("Open export audit event");
    expect(container.textContent).toContain("Download latest export again");

    const auditEventLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Open export audit event"));
    expect(auditEventLink?.getAttribute("href")).toContain("instanceId=instance_alpha");
    expect(auditEventLink?.getAttribute("href")).toContain("auditAction=audit_export_generated");
    expect(auditEventLink?.getAttribute("href")).toContain("auditTargetType=audit_export");
    expect(auditEventLink?.getAttribute("href")).toContain("auditTargetId=audit_export_1");
  });

  it("does not silently derive export subject from history-only filters", async () => {
    await renderLogsPage("/logs?instanceId=instance_alpha&auditWindow=30d&auditAction=runtime_key_issue&auditActor=ops&auditTargetType=runtime_key&auditTargetId=key_alpha&auditStatus=warning#audit-export");

    const exportInputs = container.querySelectorAll<HTMLInputElement>("#audit-export input");
    const subjectInput = exportInputs[0];
    const button = container.querySelector<HTMLButtonElement>("#audit-export button");
    expect(subjectInput?.value).toBe("");
    expect(subjectInput?.getAttribute("placeholder")).toBe("ops runtime_key key_alpha");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(generateAuditExportMock).toHaveBeenCalledWith({
      format: "json",
      window: "30d",
      action: "runtime_key_issue",
      status: "warning",
      subject: null,
      limit: 250,
    }, "instance_alpha", undefined, null);
  });

  it("keeps the latest exported package summary when review-only filters change", async () => {
    generateAuditExportMock.mockResolvedValueOnce(createAuditExportResult());
    await renderLogsPage("/logs?instanceId=instance_alpha&auditWindow=30d&auditAction=runtime_key_issue&auditStatus=warning#audit-export");

    const exportInputs = container.querySelectorAll<HTMLInputElement>("#audit-export input");
    const subjectInput = exportInputs[0];
    const button = container.querySelector<HTMLButtonElement>("#audit-export button");
    const historySelects = container.querySelectorAll<HTMLSelectElement>("#audit-history select");
    const targetTypeSelect = historySelects[2];
    expect(subjectInput).toBeDefined();
    expect(button).not.toBeNull();
    expect(targetTypeSelect).toBeDefined();

    await act(async () => {
      subjectInput!.value = "runtime key evidence";
      subjectInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flushEffects();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Latest exported package");
    expect(container.textContent).toContain("Open export audit event");

    await act(async () => {
      targetTypeSelect!.value = "runtime_key";
      targetTypeSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(fetchAuditHistoryMock).toHaveBeenLastCalledWith({
      instanceId: "instance_alpha",
      window: "30d",
      action: "runtime_key_issue",
      actor: null,
      targetType: "runtime_key",
      targetId: null,
      status: "warning",
      limit: 25,
    });
    expect(container.textContent).toContain("Latest exported package");
    expect(container.textContent).toContain("Open export audit event");
    expect(container.textContent).toContain("runtime key evidence");
  });

  it("keeps export visible but disabled for viewer sessions", async () => {
    await renderIntoDom(withAppContext({
      path: "/logs?instanceId=instance_alpha#audit-export",
      element: <LogsPage />,
      session: viewerSession,
    }));
    await flushEffects();

    const button = container.querySelector<HTMLButtonElement>("#audit-export button");
    expect(button?.disabled).toBe(true);
    expect(fetchLogsMock).toHaveBeenCalledWith("instance_alpha", undefined, null);
    expect(fetchAuditHistoryMock).not.toHaveBeenCalled();
    expect(fetchAuditHistoryDetailMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Viewer read-only");
    expect(container.textContent).toContain("Audit history is permission-limited");
    expect(container.textContent).toContain("Audit history and detail require a standard operator or admin session. Viewer sessions stay on the logs overview only.");
    expect(container.textContent).toContain("Viewer sessions cannot open audit history or generate exports. Open a standard operator or admin session.");
  });

  it("shows a failed export state when the backend contract returns an error", async () => {
    generateAuditExportMock.mockRejectedValueOnce(new Error("upstream export failed"));

    await renderLogsPage("/logs?instanceId=instance_alpha#audit-export");

    const button = container.querySelector<HTMLButtonElement>("#audit-export button");
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Audit export failed");
    expect(container.textContent).toContain("upstream export failed");
  });

  it("renders the no-events state without implying missing controls", async () => {
    fetchAuditHistoryMock.mockResolvedValueOnce(createAuditHistoryResponse({
      items: [],
      totalInScope: 0,
      totalMatchingFilters: 0,
    }));

    await renderLogsPage();

    expect(container.textContent).toContain("No audit evidence yet");
    expect(container.textContent).toContain("No audit evidence was recorded in the selected window");
  });

  it("renders the no-results state when filters exclude the current evidence", async () => {
    fetchAuditHistoryMock.mockResolvedValueOnce(createAuditHistoryResponse({
      items: [],
      totalInScope: 4,
      totalMatchingFilters: 0,
    }));

    await renderLogsPage("/logs?auditAction=runtime_key_issue#audit-history");

    expect(container.textContent).toContain("No results for the current filters.");
  });

  it("opens the detail panel without losing the table state", async () => {
    await renderLogsPage("/logs?instanceId=instance_alpha#audit-history");

    const button = container.querySelector<HTMLButtonElement>("button.fg-table-trigger");
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(fetchAuditHistoryDetailMock).toHaveBeenCalledWith("audit_evt_1", "instance_alpha", undefined, null);
    expect(container.textContent).toContain("Replay after provider credentials were rotated and verified.");
    expect(container.textContent).toContain("Raw metadata");
    expect(container.textContent).toContain("Open Provider Health & Runs");
    const relatedLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open Provider Health & Runs");
    expect(relatedLink?.getAttribute("href")).toBe("/providers?instanceId=instance_alpha#provider-health-runs");
  });
});
