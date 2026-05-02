// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchClientDrilldownMock,
  fetchProviderDrilldownMock,
  fetchUsageSummaryMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchClientDrilldownMock: vi.fn(),
  fetchProviderDrilldownMock: vi.fn(),
  fetchUsageSummaryMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchUsageSummary: fetchUsageSummaryMock,
    fetchClientDrilldown: fetchClientDrilldownMock,
    fetchProviderDrilldown: fetchProviderDrilldownMock,
  };
});

vi.mock("../src/api/domain", async () => {
  const actual = await vi.importActual<typeof import("../src/api/domain")>("../src/api/domain");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchUsageSummary: fetchUsageSummaryMock,
    fetchClientDrilldown: fetchClientDrilldownMock,
    fetchProviderDrilldown: fetchProviderDrilldownMock,
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
  byProvider = [{ provider: "openai_api", requests: 12, tokens: 4500, actual_cost: 3.4, hypothetical_cost: 4.2, avoided_cost: 0.8 }],
  byClient = [{ client_id: "web-ui", requests: 8, tokens: 2000, actual_cost: 1.5 }],
  byModel = [{ model: "gpt-4o-mini", requests: 12, tokens: 4500 }],
  byAuth = [{ auth_key: "api_key:runtime", requests: 12, tokens: 4500 }],
  latestHealth = [{ provider: "openai_api", model: "gpt-4o-mini", status: "healthy", check_type: "probe", checked_at: "2026-04-21T21:30:00Z" }],
  timeline24h = [{ bucket_start: "2026-04-21T21:00:00Z", requests: 4, errors: 1, error_rate: 0.2, actual_cost: 1.1 }],
  streamModeCounts = { stream: 3, non_stream: 9, runtime_request_count: 12 },
  runtimeDuration = { sample_count: 6, avg: 180, p50: 150, p95: 320, max: 400 },
}: {
  recordedRequests?: number;
  recordedErrors?: number;
  recordedHealthEvents?: number;
  byProvider?: Array<Record<string, string | number>>;
  byClient?: Array<Record<string, string | number>>;
  byModel?: Array<Record<string, string | number>>;
  byAuth?: Array<Record<string, string | number>>;
  latestHealth?: Array<Record<string, string | number | null>>;
  timeline24h?: Array<Record<string, string | number>>;
  streamModeCounts?: { stream: number; non_stream: number; runtime_request_count: number };
  runtimeDuration?: { sample_count: number; avg: number | null; p50: number | null; p95: number | null; max: number | null };
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
      by_model: byModel,
      by_auth: byAuth,
      by_client: byClient,
      by_traffic_type: [
        { traffic_type: "runtime", requests: recordedRequests, tokens: 4500, actual_cost: 3.4, hypothetical_cost: 4.2, avoided_cost: 0.8 },
        { traffic_type: "health_check", requests: recordedHealthEvents, tokens: 120, actual_cost: 0.3, hypothetical_cost: 0.3, avoided_cost: 0 },
      ],
      errors_by_provider: recordedErrors > 0 ? [{ provider: "openai_api", errors: recordedErrors }] : [],
      errors_by_model: recordedErrors > 0 ? [{ model: "gpt-4o-mini", errors: recordedErrors }] : [],
      errors_by_client: recordedErrors > 0 ? [{ client_id: "web-ui", errors: recordedErrors }] : [],
      errors_by_traffic_type: recordedErrors > 0 ? [{ traffic_type: "runtime", errors: recordedErrors }] : [],
      errors_by_type: recordedErrors > 0 ? [{ error_key: "provider_error:502", errors: recordedErrors }] : [],
      errors_by_integration: recordedErrors > 0 ? [{ integration_key: "runtime:none:none", errors: recordedErrors }] : [],
      errors_by_profile: recordedErrors > 0 ? [{ profile_key: "default", errors: recordedErrors }] : [],
    },
    traffic_split: {
      runtime: { traffic_type: "runtime", requests: recordedRequests, tokens: 4500, actual_cost: 3.4, hypothetical_cost: 4.2, avoided_cost: 0.8 },
      health_check: { traffic_type: "health_check", requests: recordedHealthEvents, tokens: 120, actual_cost: 0.3, hypothetical_cost: 0.3, avoided_cost: 0 },
    },
    cost_truths: {
      actual: {
        label: "Actual",
        status: "tracked",
        billing_truth: true,
        description: "Persisted runtime and health costs when ForgeFrame is the direct metering path.",
        runtime_cost: 3.4,
        health_check_cost: 0.3,
        total_cost: 3.7,
      },
      provider_reported: {
        label: "Provider reported",
        status: "unsupported",
        billing_truth: true,
        description: "ForgeFrame does not ingest provider invoices or billing exports on this host.",
        runtime_cost: null,
        health_check_cost: null,
        total_cost: null,
      },
      estimated: {
        label: "Estimated",
        status: "derived",
        billing_truth: false,
        description: "Configured price-card estimate across recorded traffic. Useful for forecast, not billing truth.",
        runtime_cost: 4.2,
        health_check_cost: 0.3,
        total_cost: 4.5,
      },
      modeled: {
        label: "Modeled",
        status: "derived",
        billing_truth: false,
        description: "Estimated cost exposure that is not directly metered by ForgeFrame actual-cost records.",
        runtime_cost: 0.8,
        health_check_cost: 0,
        total_cost: 0.8,
      },
      avoided: {
        label: "Avoided",
        status: "derived",
        billing_truth: false,
        description: "Estimated spend avoided when traffic would have been billable under a metered equivalent.",
        runtime_cost: 0.8,
        health_check_cost: 0,
        total_cost: 0.8,
      },
    },
    cost_axes: {
      actual: "tracked for metered API providers",
      provider_reported: "unsupported in the current control plane",
      estimated: "derived from configured pricing, never billing truth",
      modeled: "derived gap between estimated and metered actual cost",
      avoided: "derived from actual vs hypothetical",
    },
    window: "24h",
    latest_health: latestHealth,
    timeline_24h: timeline24h,
    alerts: [],
    runtime_duration_ms: runtimeDuration,
    stream_mode_counts: streamModeCounts,
    selected_filters: {
      provider: null,
      client_id: null,
      model: null,
    },
    pricing_snapshot: {
      openai_input_per_1m: 10,
      openai_output_per_1m: 30,
      codex_hyp_input_per_1m: 15,
      codex_hyp_output_per_1m: 45,
    },
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
  fetchProviderDrilldownMock.mockResolvedValue({
    status: "ok",
    window: "24h",
    drilldown: {
      provider: "openai_api",
      requests: 12,
      errors: 2,
      latest_health: [{ provider: "openai_api", model: "gpt-4o-mini", status: "healthy", check_type: "probe", checked_at: "2026-04-21T21:30:00Z" }],
      models: [{ model: "gpt-4o-mini", requests: 12, tokens: 4500, actual_cost: 3.4, errors: 2 }],
      clients: [{ client_id: "web-ui", requests: 8, tokens: 2000, actual_cost: 1.5, errors: 2 }],
    },
  });
  fetchClientDrilldownMock.mockResolvedValue({
    status: "ok",
    window: "24h",
    drilldown: {
      client_id: "web-ui",
      requests: 8,
      errors: 2,
      providers: [{ provider: "openai_api", requests: 8, tokens: 2000, actual_cost: 1.5, errors: 2 }],
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

describe("Usage page analysis surface", () => {
  it("shows explicit viewer framing and the blocked API-key axis", async () => {
    await renderUsagePage(viewerSession);

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchUsageSummaryMock).toHaveBeenCalledWith("24h", null);
    expect(container.textContent).toContain("Usage Analysis");
    expect(container.textContent).toContain("Viewer read-only usage drilldown");
    expect(container.textContent).toContain("Usage filters");
    expect(container.textContent).toContain("API-key filtering is currently blocked");
    expect(container.textContent).toContain("Open Costs");
    expect(container.textContent).toContain("Open Errors");
  });

  it("preserves instance scope across fetches and primary navigation links", async () => {
    await renderUsagePage(operatorSession, "/usage?instanceId=instance_alpha");

    expect(fetchUsageSummaryMock).toHaveBeenCalledWith("24h", "instance_alpha");
    expect(container.textContent).toContain("Instance scope: Alpha Instance");

    const hrefs = collectLinkHrefs();
    expect(hrefs).toContain("/costs?instanceId=instance_alpha");
    expect(hrefs).toContain("/errors?instanceId=instance_alpha");
    expect(hrefs).toContain("/providers?instanceId=instance_alpha#provider-health-runs");
    expect(hrefs).not.toContain("/costs");
    expect(hrefs).not.toContain("/errors");
  });

  it("renders the honest no-traffic state instead of treating it as an error", async () => {
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary({
      recordedRequests: 0,
      recordedErrors: 0,
      recordedHealthEvents: 0,
      byProvider: [],
      byClient: [],
      byModel: [],
      byAuth: [],
      latestHealth: [],
      timeline24h: [{ bucket_start: "2026-04-21T21:00:00Z", requests: 0, errors: 0, error_rate: 0, actual_cost: 0 }],
      streamModeCounts: { stream: 0, non_stream: 0, runtime_request_count: 0 },
      runtimeDuration: { sample_count: 0, avg: null, p50: null, p95: null, max: null },
    }));

    await renderUsagePage(operatorSession);

    expect(container.textContent).toContain("No traffic in selected window");
    expect(container.textContent).toContain("No provider traffic in selected window");
    expect(container.textContent).toContain("No client traffic in selected window");
    expect(container.textContent).not.toContain("Usage analysis loading failed");
  });

  it("applies provider filters through the summary endpoint and keeps the unfiltered catalog request", async () => {
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary());
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary({
      recordedRequests: 7,
      recordedErrors: 1,
      byProvider: [{ provider: "openai_api", requests: 7, tokens: 2800, actual_cost: 2.1, hypothetical_cost: 2.7, avoided_cost: 0.6 }],
      byClient: [{ client_id: "billing-sync", requests: 7, tokens: 2800, actual_cost: 2.1 }],
      byModel: [{ model: "gpt-4o-mini", requests: 7, tokens: 2800 }],
    }));
    fetchUsageSummaryMock.mockResolvedValueOnce(createUsageSummary());

    await renderUsagePage(operatorSession);

    const providerSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Usage provider filter"]');
    expect(providerSelect).not.toBeNull();

    await act(async () => {
      providerSelect!.value = "openai_api";
      providerSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();

    expect(fetchUsageSummaryMock).toHaveBeenCalledWith("24h", null, { provider: "openai_api", clientId: null, model: null });
    expect(fetchUsageSummaryMock).toHaveBeenCalledWith("24h", null);
    expect(fetchProviderDrilldownMock).toHaveBeenCalledWith("openai_api", "24h", null);
    expect(container.textContent).toContain("Provider drilldown");
    expect(container.textContent).toContain("Client drilldown");
    expect(container.textContent).toContain("Model concentration");
    expect(container.textContent).toContain("Provider detail");
  });

  it("surfaces row-specific usage deep-links plus separated Errors and Costs routes", async () => {
    await renderUsagePage(operatorSession, "/usage?instanceId=instance_alpha");

    expect(container.textContent).toContain("Provider drilldown");
    expect(container.textContent).toContain("Client drilldown");
    expect(container.textContent).toContain("API key / auth hotspots");

    const hrefs = collectLinkHrefs();
    expect(hrefs).toContain("/usage?instanceId=instance_alpha&usageWindow=24h&provider=openai_api#provider-detail");
    expect(hrefs).toContain("/usage?instanceId=instance_alpha&usageWindow=24h&client=web-ui#client-detail");
    expect(hrefs).toContain("/errors?instanceId=instance_alpha");
    expect(hrefs).toContain("/costs?instanceId=instance_alpha");
    expect(hrefs).toContain("/providers?instanceId=instance_alpha#provider-health-runs");
  });
});
