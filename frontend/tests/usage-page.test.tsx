// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchUsageSummaryMock,
  fetchClientOperationalViewMock,
  fetchProviderDrilldownMock,
  fetchClientDrilldownMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchUsageSummaryMock: vi.fn(),
  fetchClientOperationalViewMock: vi.fn(),
  fetchProviderDrilldownMock: vi.fn(),
  fetchClientDrilldownMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchUsageSummary: fetchUsageSummaryMock,
    fetchClientOperationalView: fetchClientOperationalViewMock,
    fetchProviderDrilldown: fetchProviderDrilldownMock,
    fetchClientDrilldown: fetchClientDrilldownMock,
  };
});

import type { AdminSessionUser, InstanceRecord, UsageSummaryResponse } from "../src/api/admin";
import { UsagePage } from "../src/pages/UsagePage";
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
    description: "Alpha usage scope",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "linux_host_native",
    exposure_mode: "same_origin",
    is_default: true,
    metadata: {},
    created_at: "2026-04-22T08:00:00Z",
    updated_at: "2026-04-22T08:00:00Z",
    ...overrides,
  };
}

function createUsageSummary({
  recordedRequests = 12,
  recordedErrors = 2,
  recordedHealthEvents = 4,
  alerts = [{ severity: "warning", type: "provider_hotspot", message: "Provider openai_api is the current error hotspot.", value: 4 }],
  byProvider = [{ provider: "openai_api", requests: 12, tokens: 4500, actual_cost: 3.4, hypothetical_cost: 4.2, avoided_cost: 0.8 }],
  byClient = [{ client_id: "web-ui", requests: 8, tokens: 2000, actual_cost: 1.5 }],
  latestHealth = [{ provider: "openai_api", model: "gpt-4o-mini", status: "healthy", check_type: "probe", checked_at: "2026-04-21T21:30:00Z" }],
  timeline24h = [{ bucket_start: "2026-04-21T21:00:00Z", requests: 4, errors: 1, error_rate: 0.2, actual_cost: 1.1 }],
}: {
  recordedRequests?: number;
  recordedErrors?: number;
  recordedHealthEvents?: number;
  alerts?: Array<Record<string, string | number>>;
  byProvider?: Array<Record<string, string | number>>;
  byClient?: Array<Record<string, string | number>>;
  latestHealth?: Array<Record<string, string | number | null>>;
  timeline24h?: Array<Record<string, string | number>>;
} = {}): UsageSummaryResponse {
  return {
    status: "ok",
    object: "usage_summary",
    metrics: {
      active_model_count: 5,
      stream_capable_model_count: 3,
      recorded_request_count: recordedRequests,
      recorded_error_count: recordedErrors,
      recorded_health_event_count: recordedHealthEvents,
    },
    aggregations: {
      by_provider: byProvider,
      by_model: [{ model: "gpt-4o-mini", requests: 12, tokens: 4500, actual_cost: 3.4 }],
      by_auth: [{ auth_key: "admin-token", requests: 12, tokens: 4500 }],
      by_client: byClient,
      by_traffic_type: [
        { traffic_type: "runtime", requests: 12, tokens: 4500, actual_cost: 3.4, hypothetical_cost: 4.2, avoided_cost: 0.8 },
        { traffic_type: "health_check", requests: 4, tokens: 120, actual_cost: 0.3, hypothetical_cost: 0.3, avoided_cost: 0 },
      ],
      errors_by_provider: recordedErrors > 0 ? [{ provider: "openai_api", errors: recordedErrors }] : [],
      errors_by_model: recordedErrors > 0 ? [{ model: "gpt-4o-mini", errors: recordedErrors }] : [],
      errors_by_client: recordedErrors > 0 ? [{ client_id: "web-ui", errors: recordedErrors }] : [],
      errors_by_traffic_type: recordedErrors > 0 ? [{ traffic_type: "runtime", errors: recordedErrors }] : [],
      errors_by_type: recordedErrors > 0 ? [{ error_key: "provider_error", errors: recordedErrors }] : [],
      errors_by_integration: recordedErrors > 0 ? [{ integration_key: "pytest", errors: recordedErrors }] : [],
      errors_by_profile: recordedErrors > 0 ? [{ profile_key: "default", errors: recordedErrors }] : [],
    },
    traffic_split: {
      runtime: { traffic_type: "runtime", requests: 12, tokens: 4500, actual_cost: 3.4, hypothetical_cost: 4.2, avoided_cost: 0.8 },
      health_check: { traffic_type: "health_check", requests: 4, tokens: 120, actual_cost: 0.3, hypothetical_cost: 0.3, avoided_cost: 0 },
    },
    cost_axes: {
      actual: "tracked for metered API providers",
      hypothetical: "tracked for comparison and forecast",
      avoided: "derived from actual vs hypothetical",
    },
    window: "24h",
    latest_health: latestHealth,
    timeline_24h: timeline24h,
    alerts,
    pricing_snapshot: {
      openai_input_per_1m: 10,
      openai_output_per_1m: 30,
      codex_hyp_input_per_1m: 15,
      codex_hyp_output_per_1m: 45,
    },
  };
}

function createClientOps(clients?: Array<Record<string, string | number | boolean>>) {
  return {
    status: "ok",
    window: "24h",
    clients: clients
      ? clients
      : [
          { client_id: "billing-sync", requests: 6, errors: 2, error_rate: 0.25, needs_attention: true },
          { client_id: "web-ui", requests: 8, errors: 0, error_rate: 0, needs_attention: false },
        ],
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

async function renderUsagePage(session: AdminSessionUser, path = "/usage") {
  await renderIntoDom(withAppContext({
    path,
    element: <UsagePage />,
    session,
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
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-21T22:00:00Z"));
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  fetchUsageSummaryMock.mockResolvedValue(createUsageSummary());
  fetchClientOperationalViewMock.mockResolvedValue(createClientOps());
  fetchProviderDrilldownMock.mockResolvedValue({
    status: "ok",
    window: "24h",
    drilldown: {
      provider: "openai_api",
      requests: 12,
      errors: 2,
      latest_health: [{ provider: "openai_api", model: "gpt-4o-mini", status: "healthy", check_type: "probe", checked_at: "2026-04-21T21:30:00Z" }],
      models: [{ model: "gpt-4o-mini", requests: 12, tokens: 4500, actual_cost: 3.4, errors: 2 }],
      clients: [{ client_id: "billing-sync", requests: 6, tokens: 2200, actual_cost: 1.8, errors: 2 }],
    },
  });
  fetchClientDrilldownMock.mockResolvedValue({
    status: "ok",
    window: "24h",
    drilldown: {
      client_id: "billing-sync",
      requests: 6,
      errors: 2,
      providers: [{ provider: "openai_api", requests: 6, tokens: 2200, actual_cost: 1.8, errors: 2 }],
      recent_errors: [{ created_at: "2026-04-21T21:40:00Z", provider: "openai_api", model: "gpt-4o-mini", error_type: "provider_error" }],
      recent_usage: [{ created_at: "2026-04-21T21:38:00Z", provider: "openai_api", model: "gpt-4o-mini", total_tokens: 420, actual_cost: 0.32 }],
    },
  });
  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
});

afterEach(() => {
  vi.useRealTimers();

  if (!root) {
    return;
  }

  act(() => {
    root?.unmount();
  });
  root = null;
});

describe("Usage page operations drilldown", () => {
  it("shows explicit viewer read-only framing", async () => {
    await renderUsagePage(viewerSession);

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchUsageSummaryMock).toHaveBeenCalledWith("24h", null);
    expect(container.textContent).toContain("What needs operational attention?");
    expect(container.textContent).toContain("Viewer read-only");
    expect(container.textContent).toContain("Viewer read-only usage drilldown");
    expect(container.textContent).toContain("Provider Health & Runs");
    expect(container.textContent).toContain("Client investigation");
  });

  it("preserves instance scope across usage fetches and secondary CTAs", async () => {
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary({
      recordedErrors: 0,
      alerts: [],
    }));
    fetchClientOperationalViewMock.mockResolvedValueOnce(createClientOps([
      { client_id: "billing-sync", requests: 6, errors: 0, error_rate: 0, needs_attention: false },
      { client_id: "web-ui", requests: 8, errors: 0, error_rate: 0, needs_attention: false },
    ]));

    await renderUsagePage(operatorSession, "/usage?instanceId=instance_alpha");

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchUsageSummaryMock).toHaveBeenCalledWith("24h", "instance_alpha");
    expect(fetchClientOperationalViewMock).toHaveBeenCalledWith("24h", "instance_alpha");
    expect(fetchProviderDrilldownMock).toHaveBeenCalledWith("openai_api", "24h", "instance_alpha");
    expect(fetchClientDrilldownMock).toHaveBeenCalledWith("billing-sync", "24h", "instance_alpha");
    expect(container.textContent).toContain("Instance scope: Alpha Instance");

    const hrefs = collectLinkHrefs();
    expect(hrefs).toContain("/usage?instanceId=instance_alpha");
    expect(hrefs).toContain("/usage?instanceId=instance_alpha#client-investigation");
    expect(hrefs).toContain("/providers?instanceId=instance_alpha#provider-health-runs");
    expect(hrefs).toContain("/logs?instanceId=instance_alpha");
    expect(hrefs).toContain("/dashboard?instanceId=instance_alpha");
    expect(hrefs).not.toContain("/providers#provider-health-runs");
    expect(hrefs).not.toContain("/logs");
    expect(hrefs).not.toContain("/dashboard");
  });

  it("renders the empty-state drilldown without implying missing controls", async () => {
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary({
      recordedRequests: 0,
      recordedErrors: 0,
      recordedHealthEvents: 0,
      alerts: [],
      byProvider: [],
      byClient: [],
      latestHealth: [],
      timeline24h: [{ bucket_start: "2026-04-21T21:00:00Z", requests: 0, errors: 0, error_rate: 0, actual_cost: 0 }],
    }));
    fetchClientOperationalViewMock.mockResolvedValueOnce(createClientOps([]));

    await renderUsagePage(operatorSession);

    expect(container.textContent).toContain("No recent runtime or health traffic was recorded in this window");
    expect(container.textContent).toContain("No provider activity recorded in this window.");
    expect(container.textContent).toContain("No client activity recorded in this window.");
    expect(fetchProviderDrilldownMock).not.toHaveBeenCalled();
  });

  it("surfaces partial and stale-data states while keeping summary monitoring visible", async () => {
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary({
      latestHealth: [{ provider: "openai_api", model: "gpt-4o-mini", status: "healthy", check_type: "probe", checked_at: "2026-04-18T08:00:00Z" }],
      timeline24h: [{ bucket_start: "2026-04-18T08:00:00Z", requests: 2, errors: 0, error_rate: 0, actual_cost: 0.8 }],
    }));
    fetchClientOperationalViewMock.mockRejectedValueOnce(new Error("client feed unavailable"));

    await renderUsagePage(operatorSession);

    expect(container.textContent).toContain("Partial data");
    expect(container.textContent).toContain("Client hotspot ranking is unavailable: client feed unavailable");
    expect(container.textContent).toContain("Recent evidence stale");
    expect(container.textContent).toContain("Recent health checks and 24h timeline evidence are older than this window.");
    expect(container.textContent).toContain("Monitoring overview");
  });

  it("does not overclaim selected-window freshness on 7d history", async () => {
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary());
    fetchClientOperationalViewMock.mockResolvedValueOnce(createClientOps());
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary({
      recordedRequests: 24,
      recordedErrors: 1,
      alerts: [],
      latestHealth: [],
      timeline24h: [{ bucket_start: "2026-04-22T03:00:00Z", requests: 0, errors: 0, error_rate: 0, actual_cost: 0 }],
    }));
    fetchClientOperationalViewMock.mockResolvedValueOnce(createClientOps([]));

    await renderUsagePage(operatorSession);

    const windowSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Usage window"]');
    expect(windowSelect).not.toBeNull();

    await act(async () => {
      windowSelect!.value = "7d";
      windowSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(fetchUsageSummaryMock).toHaveBeenLastCalledWith("7d", null);
    expect(fetchClientOperationalViewMock).toHaveBeenLastCalledWith("7d", null);
    expect(container.textContent).toContain("Recent evidence unavailable");
    expect(container.textContent).toContain("Freshness is based on recent health checks and the fixed 24h timeline only, not the entire selected history.");
    expect(container.textContent).not.toContain("The selected window has no recorded runtime or health evidence yet.");
  });

  it("labels alerts as current pressure instead of selected-window truth", async () => {
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary());
    fetchClientOperationalViewMock.mockResolvedValueOnce(createClientOps());
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary({
      alerts: [{ severity: "warning", type: "error_rate_rising", message: "Error rate exceeded 10% in last hour.", value: 0.12 }],
    }));
    fetchClientOperationalViewMock.mockResolvedValueOnce(createClientOps());

    await renderUsagePage(operatorSession);

    const windowSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Usage window"]');
    expect(windowSelect).not.toBeNull();

    await act(async () => {
      windowSelect!.value = "7d";
      windowSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Current alert pressure");
    expect(container.textContent).toContain("Last-hour alert indicators stay separate from the historical window below so the route does not overstate what the selector controls.");
    expect(container.textContent).not.toContain("Alert indicators from the selected window.");
  });

  it("keeps the alert empty state honest when the selected window is wider than last-hour alerts", async () => {
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary());
    fetchClientOperationalViewMock.mockResolvedValueOnce(createClientOps());
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary({
      alerts: [],
    }));
    fetchClientOperationalViewMock.mockResolvedValueOnce(createClientOps());

    await renderUsagePage(operatorSession);

    const windowSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Usage window"]');
    expect(windowSelect).not.toBeNull();

    await act(async () => {
      windowSelect!.value = "7d";
      windowSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("No active last-hour alert indicators.");
    expect(container.textContent).not.toContain("No active alert indicators in this window.");
  });
});
