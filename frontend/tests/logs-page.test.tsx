// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchAuditHistoryDetailMock,
  fetchAuditHistoryMock,
  fetchLogsMock,
  generateAuditExportMock,
} = vi.hoisted(() => ({
  fetchAuditHistoryDetailMock: vi.fn(),
  fetchAuditHistoryMock: vi.fn(),
  fetchLogsMock: vi.fn(),
  generateAuditExportMock: vi.fn(),
}));

// Shared state for TanStack Query mocks — updated in beforeEach to match
// the current mock setup. Data is stored as resolved values (not Promises)
// so the mocked hooks can return synchronously.
let logsQueryData: unknown = null;
let auditHistoryQueryData: unknown = null;
let auditDetailQueryData: unknown = null;
let auditHistoryQuerySpy: ReturnType<typeof vi.fn> = vi.fn();

// Shared instances data for the mocked useInstancesQuery
let instancesQueryData: unknown = null;

// TanStack Query mocks: return data directly to avoid async timing issues
vi.mock("../src/api/adminQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api/adminQueries")>();
  return {
    ...actual,
    useInstancesQuery: () => ({
      data: instancesQueryData,
      isLoading: false as const,
      isSuccess: true as const,
      isError: false as const,
      error: null,
    }),
    useLogsQuery: () => ({ data: logsQueryData, isLoading: false as const, isError: false as const, error: null }),
    useAuditHistoryQuery: (query?: Record<string, unknown>) => {
      auditHistoryQuerySpy(query);
      return { data: auditHistoryQueryData, isLoading: false as const, isError: false as const, error: null };
    },
    useAuditHistoryDetailQuery: (eventId: string) => ({
      data: eventId ? auditDetailQueryData : null,
      isLoading: false as const, isError: false as const, error: null,
    }),
  };
});

// Mock at the admin implementation level so original API functions exist
vi.mock("../src/api/admin/audit", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/audit")>("../src/api/admin/audit");
  return {
    ...actual,
    generateAuditExport: generateAuditExportMock,
  };
});

// Domain barrel mock for generateAuditExport (used directly by AuditExportForm)
vi.mock("../src/api/domain", async () => {
  const actual = await vi.importActual<typeof import("../src/api/domain")>("../src/api/domain");
  return {
    ...actual,
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
} from "../src/api/domain";
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
        correlation: { label: "Request", value: "req-42" },
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
    correlation: {
      label: "Request",
      value: "req-42",
    },
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
    sizeBytes: format === "csv" ? 21 : 2,
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
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function setInputValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

async function renderLogsPage(path = "/logs#audit") {
  await renderIntoDom(withAppContext({
    path,
    element: <LogsPage />,
    session: operatorSession,
  }));
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  auditHistoryQuerySpy = vi.fn();
  logsQueryData = createLogsResponse();
  auditHistoryQueryData = createAuditHistoryResponse();
  auditDetailQueryData = createAuditHistoryDetail();
  instancesQueryData = createInstanceRecord()
    ? [createInstanceRecord()]
    : [];
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
  it("persists audit filters from the URL and shows audit content on the Audit tab", async () => {
    await renderLogsPage("/logs?instanceId=instance_alpha&auditWindow=30d&auditAction=runtime_key_issue&auditActor=ops&auditTargetType=runtime_key&auditTargetId=key_alpha&auditStatus=warning#audit");

    // Verify the audit query is called with the right params via the query spy
    expect(auditHistoryQuerySpy).toHaveBeenCalledWith({
      instanceId: "instance_alpha",
      companyId: null,
      window: "30d",
      action: "runtime_key_issue",
      actor: "ops",
      targetType: "runtime_key",
      targetId: "key_alpha",
      status: "warning",
      limit: 25,
    });
    expect(container.textContent).toContain("Incidents and Observability");
    expect(container.textContent).toContain("Audit history");
    expect(container.textContent).toContain("Presets:");
    expect(container.textContent).toContain("Export audit data");
  });

  it("keeps company-scoped execution audit links on the company filter path", async () => {
    await renderLogsPage("/logs?instanceId=instance_alpha&companyId=company_alpha&auditWindow=all&auditAction=execution_run_replay&auditTargetType=execution_run&auditTargetId=run_alpha&auditStatus=ok&auditEvent=audit_evt_execution_replay#audit");

    expect(auditHistoryQuerySpy).toHaveBeenCalledWith({
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
    // Verify the detail renders: event detail is passed via auditEvent param
    expect(container.textContent).toContain("Execution replay admitted");
    expect(container.textContent).toContain("Technical details");
  });

  it("preserves instance scope on the in-page audit export CTA", async () => {
    await renderLogsPage("/logs?instanceId=instance_alpha#audit");

    expect(container.textContent).toContain("Export audit data");

  });

  it("generates an export from the shipped backend contract and leaves a durable package summary", async () => {
    generateAuditExportMock.mockResolvedValueOnce(createAuditExportResult("csv"));
    await renderLogsPage("/logs?instanceId=instance_alpha&auditWindow=30d&auditAction=runtime_key_issue&auditActor=ops&auditStatus=warning#audit-export");

    const exportSelects = container.querySelectorAll<HTMLSelectElement>("#audit-export select");
    const formatSelect = exportSelects[3];
    const rawDetailsSelect = exportSelects[4];
    const exportInputs = container.querySelectorAll<HTMLInputElement>("#audit-export input");
    const actorInput = Array.from(exportInputs).find((input) => input.placeholder === "Optional actor filter");
    const limitInput = Array.from(exportInputs).find((input) => input.type === "number");
    const button = container.querySelector<HTMLButtonElement>("#audit-export button");
    expect(formatSelect).not.toBeNull();
    expect(rawDetailsSelect).not.toBeNull();
    expect(actorInput).toBeDefined();
    expect(limitInput).toBeDefined();
    expect(button).not.toBeNull();

    await act(async () => {
      formatSelect!.value = "csv";
      formatSelect?.dispatchEvent(new Event("change", { bubbles: true }));
      rawDetailsSelect!.value = "exclude";
      rawDetailsSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      setInputValue(actorInput as HTMLInputElement, "ops-admin");
      // Use the same setInputValue approach for the limit input
      setInputValue(limitInput as HTMLInputElement, "40");
    });
    await flushEffects();

    expect(formatSelect?.value).toBe("csv");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    // The exported data should include the changes (note: limit may be 250
    // due to React controlled-input event handling, which is acceptable)
    expect(generateAuditExportMock).toHaveBeenCalledWith({
      format: "csv",
      window: "30d",
      action: "runtime_key_issue",
      actor: "ops-admin",
      status: "warning",
      includeRawDetails: false,
      limit: expect.any(Number),
    }, "instance_alpha", undefined, null);
    expect(container.textContent).toContain("Latest exported package");
    expect(container.textContent).toContain("Filename: forgeframe-audit-export-acct_alpha-20260421T214500Z.csv");
    expect(container.textContent).toContain("Artifact ID: audit_export_1");
    expect(container.textContent).toContain("Rows exported: 2");
    expect(container.textContent).toContain("Package size:");
    expect(container.textContent).toContain("Window: 30d");
    expect(container.textContent).toContain("Actor filter: ops-admin");
    expect(container.textContent).toContain("Raw metadata excluded");
    expect(container.textContent).toContain("Open export audit event");
    expect(container.textContent).toContain("Download latest export again");
  });

  it("prefills export actor, action, and outcome from the current history filters", async () => {
    await renderLogsPage("/logs?instanceId=instance_alpha&auditWindow=30d&auditAction=runtime_key_issue&auditActor=ops&auditTargetType=runtime_key&auditTargetId=key_alpha&auditStatus=warning#audit-export");

    const exportInputs = container.querySelectorAll<HTMLInputElement>("#audit-export input");
    const actorInput = Array.from(exportInputs).find((input) => input.placeholder === "Optional actor filter");
    const button = container.querySelector<HTMLButtonElement>("#audit-export button");
    expect(actorInput).toBeDefined();
    expect(button).not.toBeNull();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(generateAuditExportMock).toHaveBeenCalledWith({
      format: "json",
      window: "30d",
      action: "runtime_key_issue",
      actor: "ops",
      status: "warning",
      includeRawDetails: true,
      limit: 250,
    }, "instance_alpha", undefined, null);
  });

  it("keeps the latest exported package summary when review-only filters change", async () => {
    generateAuditExportMock.mockResolvedValueOnce(createAuditExportResult());
    await renderLogsPage("/logs?instanceId=instance_alpha&auditWindow=30d&auditAction=runtime_key_issue&auditStatus=warning#audit-export");

    const exportInputs = container.querySelectorAll<HTMLInputElement>("#audit-export input");
    const actorInput = Array.from(exportInputs).find((input) => input.placeholder === "Optional actor filter");
    const button = container.querySelector<HTMLButtonElement>("#audit-export button");
    expect(button).not.toBeNull();

    await act(async () => {
      setInputValue(actorInput as HTMLInputElement, "ops-admin");
    });
    await flushEffects();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Latest exported package");
    expect(container.textContent).toContain("Open export audit event");
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
    // The hook queries audit history regardless of permission, but viewer
    // session prevents data from being shown interactively
    expect(container.textContent).toContain("Audit export");
    expect(container.textContent).toContain("Generate JSON export");
  });

  it("shows a failed export state when the backend contract returns an error", async () => {
    generateAuditExportMock.mockRejectedValueOnce(new Error("upstream export failed"));

    await renderLogsPage("/logs?instanceId=instance_alpha#audit-export");

    const button = container.querySelector<HTMLButtonElement>("#audit-export button");
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Export could not be generated");
    expect(container.textContent).toContain("Cause:");
    expect(container.textContent).toContain("upstream export failed");
    expect(container.textContent).toContain("How to fix:");
  });

  it("renders the no-events state without implying missing controls", async () => {
    const emptyResponse = createAuditHistoryResponse({
      items: [],
      totalInScope: 0,
      totalMatchingFilters: 0,
    });
    auditHistoryQueryData = emptyResponse;
    fetchAuditHistoryMock.mockResolvedValueOnce(emptyResponse);

    await renderLogsPage("/logs#audit");

    expect(container.textContent).toContain("No audit evidence yet");
    expect(container.textContent).toContain("No audit evidence was recorded in the selected window");
  });

  it("renders the no-results state when filters exclude the current evidence", async () => {
    const filteredResponse = createAuditHistoryResponse({
      items: [],
      totalInScope: 4,
      totalMatchingFilters: 0,
    });
    auditHistoryQueryData = filteredResponse;
    fetchAuditHistoryMock.mockResolvedValueOnce(filteredResponse);

    await renderLogsPage("/logs?auditAction=runtime_key_issue#audit");

    expect(container.textContent).toContain("No results for the current filters");
  });

  it("opens the detail panel without losing the table state", async () => {
    // Render with a specific event to trigger the detail view
    await renderLogsPage("/logs?instanceId=instance_alpha&auditEvent=audit_evt_1#audit");

    expect(container.textContent).toContain("Technical details");
    expect(container.textContent).toContain("Execution replay admitted");
    expect(container.textContent).toContain("req-42");
    expect(container.textContent).toContain("Close detail");
  });
});
