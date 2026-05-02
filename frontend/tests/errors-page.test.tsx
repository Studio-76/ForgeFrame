// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchLogsMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchLogsMock: vi.fn(),
}));

vi.mock("../src/api/admin/logs", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/logs")>("../src/api/admin/logs");
  return {
    ...actual,
    fetchLogs: fetchLogsMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, InstanceRecord, LogsResponse } from "../src/api/domain";
import { ErrorsPage } from "../src/pages/ErrorsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

function createInstanceRecord(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Alpha Instance",
    description: "Alpha incident scope",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "linux_host_native",
    exposure_mode: "same_origin",
    is_default: true,
    metadata: {},
    created_at: "2026-04-25T09:00:00Z",
    updated_at: "2026-04-25T09:00:00Z",
    ...overrides,
  };
}

function createLogsResponse(): LogsResponse {
  return {
    status: "ok",
    audit_preview: [],
    audit_retention: {
      eventLimit: 1000,
      oldestAvailableAt: "2026-04-24T00:00:00Z",
      retentionLimited: false,
      latestEventAt: "2026-04-25T10:30:00Z",
    },
    alerts: [
      { severity: "warning", type: "provider_hotspot", message: "Provider openai_api is degraded." },
    ],
    error_summary: {
      errors_24h: 7,
      errors_by_provider: [{ provider: "openai_api", errors: 4 }],
      errors_by_type: [{ error_key: "provider_timeout", errors: 3 }],
    },
    incident_review: {
      axes: [
        {
          incident_id: "security:clear",
          axis: "security",
          axis_label: "Security",
          title: "Security-linked failures",
          severity: "clear",
          count: 0,
          first_seen_at: null,
          last_seen_at: null,
          current_effect: "No security-linked failure is visible in the current logs scope.",
          next_step: "Monitor only.",
          summary: "No security-linked incident is currently recorded.",
          links: [{ label: "Open Security & Policies", href: "/security" }],
          raw_evidence: { top_error_types: [] },
        },
        {
          incident_id: "provider:warning",
          axis: "provider",
          axis_label: "Provider",
          title: "Provider health and dependency failures",
          severity: "warning",
          count: 2,
          first_seen_at: "2026-04-25T08:30:00Z",
          last_seen_at: "2026-04-25T10:15:00Z",
          current_effect: "Provider failures or degraded health are affecting routing candidates and runtime stability.",
          next_step: "Open Health or Provider Targets to repair provider readiness and target posture.",
          summary: "Affected providers: openai_api.",
          links: [
            { label: "Open Health", href: "/health-status" },
            { label: "Open Provider Targets", href: "/provider-targets" },
          ],
          raw_evidence: { degraded_health: [{ provider: "openai_api", status: "degraded" }] },
        },
        {
          incident_id: "runtime:critical",
          axis: "runtime",
          axis_label: "Runtime",
          title: "Runtime execution failures",
          severity: "critical",
          count: 3,
          first_seen_at: "2026-04-25T08:00:00Z",
          last_seen_at: "2026-04-25T10:30:00Z",
          current_effect: "Runtime requests are failing on the active instance scope.",
          next_step: "Open logs or execution review to inspect the active runtime failure path.",
          summary: "Most common runtime error: provider_timeout.",
          links: [
            { label: "Open Logs", href: "/logs" },
            { label: "Open Execution Review", href: "/execution" },
          ],
          raw_evidence: {
            top_error_types: [{ value: "provider_timeout", count: 3 }],
            sample_errors: [{ route: "/v1/responses", error_type: "provider_timeout" }],
          },
        },
        {
          incident_id: "tls:warning",
          axis: "tls",
          axis_label: "TLS",
          title: "TLS and ingress failures",
          severity: "warning",
          count: 1,
          first_seen_at: "2026-04-25T09:45:00Z",
          last_seen_at: "2026-04-25T09:45:00Z",
          current_effect: "Ingress or certificate failures are preventing the expected public request path from completing.",
          next_step: "Open Ingress / TLS or Health to inspect listener exposure, certificates, and public readiness.",
          summary: "Most common TLS error: tls_certificate_expired.",
          links: [
            { label: "Open Ingress / TLS", href: "/ingress-tls" },
            { label: "Open Health", href: "/health-status" },
          ],
          raw_evidence: { top_error_types: [{ value: "tls_certificate_expired", count: 1 }] },
        },
        {
          incident_id: "routing:warning",
          axis: "routing",
          axis_label: "Routing",
          title: "Routing and policy failures",
          severity: "warning",
          count: 1,
          first_seen_at: "2026-04-25T10:10:00Z",
          last_seen_at: "2026-04-25T10:10:00Z",
          current_effect: "Routing decisions are being blocked by policy, budget, circuit, or capability posture.",
          next_step: "Open Routing to inspect policy stage, budget gates, and blocked candidates.",
          summary: "Blocked decisions: 1 · open circuits: 0.",
          links: [
            { label: "Open Routing", href: "/routing" },
            { label: "Open Provider Targets", href: "/provider-targets" },
          ],
          raw_evidence: { recent_failures: [{ error_type: "routing_budget_exceeded" }] },
        },
      ],
      blocked_routing_failures: [
        {
          decision_id: "route-policy",
          error_type: "routing_policy_mismatch",
          summary: "Policy stage rejected the request shape.",
          policy_stage: "fallback",
          created_at: "2026-04-25T10:00:00Z",
          reason_category: "policy",
          current_effect: "Policy stage evaluation is blocking route admission for the current request shape.",
          next_step: "Open Routing to inspect stage eligibility, fallback, and escalation policy.",
          links: [{ label: "Open Routing", href: "/routing" }],
          raw_evidence: { decision_id: "route-policy", summary: "Policy stage rejected the request shape." },
        },
        {
          decision_id: "route-budget",
          error_type: "routing_budget_exceeded",
          summary: "Budget posture blocked all eligible premium candidates.",
          policy_stage: "blocked",
          created_at: "2026-04-25T10:20:00Z",
          reason_category: "budget",
          current_effect: "Budget posture is blocking eligible routing candidates.",
          next_step: "Open Routing or Costs to remove the blocking budget condition.",
          links: [
            { label: "Open Routing", href: "/routing" },
            { label: "Open Costs", href: "/costs" },
          ],
          raw_evidence: { decision_id: "route-budget", summary: "Budget posture blocked all eligible premium candidates." },
        },
      ],
    },
    operability: {
      ready: true,
      checks: [
        { id: "runtime_signal_path", ok: true, details: "requests_24h=14" },
        { id: "routing_explainability_path", ok: false, details: "structured=1,raw=0" },
      ],
      metrics: {
        routing_metrics: {
          blocked_decisions: 1,
        },
      },
      logging: {},
      tracing: {},
    },
  };
}

function createBudgetBlockedWithoutFailureLogsResponse(): LogsResponse {
  return {
    ...createLogsResponse(),
    incident_review: {
      axes: [
        {
          incident_id: "routing:critical-budget-gate",
          axis: "routing",
          axis_label: "Routing",
          title: "Routing and policy failures",
          severity: "critical",
          count: 0,
          first_seen_at: null,
          last_seen_at: null,
          current_effect: "Routing decisions are being blocked by policy, budget, circuit, or capability posture.",
          next_step: "Open Routing to inspect policy stage, budget gates, and blocked candidates.",
          summary: "Blocked decisions: 0 · open circuits: 0 · budget blocked: yes.",
          links: [
            { label: "Open Routing", href: "/routing" },
            { label: "Open Provider Targets", href: "/provider-targets" },
          ],
          raw_evidence: {
            routing_metrics: {
              blocked_decisions: 0,
              open_circuits: 0,
              budget_blocked: true,
            },
          },
        },
        {
          incident_id: "provider:clear",
          axis: "provider",
          axis_label: "Provider",
          title: "Provider health and dependency failures",
          severity: "clear",
          count: 0,
          first_seen_at: null,
          last_seen_at: null,
          current_effect: "No active provider-side failure signal is visible.",
          next_step: "Monitor only.",
          summary: "No provider incident is currently recorded.",
          links: [
            { label: "Open Health", href: "/health-status" },
            { label: "Open Provider Targets", href: "/provider-targets" },
          ],
          raw_evidence: { degraded_health: [] },
        },
      ],
      blocked_routing_failures: [],
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

async function click(element: Element | null) {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstanceRecord()],
  });
  fetchLogsMock.mockResolvedValue(createLogsResponse());
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

describe("ErrorsPage", () => {
  it("prioritizes incidents by severity and keeps detail handoffs scoped", async () => {
    await renderIntoDom(withAppContext({
      path: "/errors?instanceId=instance_alpha",
      element: <ErrorsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    const triageTable = container.querySelector('table[aria-label="Incident triage by axis"]');
    expect(triageTable).not.toBeNull();

    const triageRows = Array.from(triageTable?.querySelectorAll("tbody tr") ?? []);
    expect(triageRows).toHaveLength(5);
    expect(triageRows[0]?.textContent).toContain("Runtime");
    expect(triageRows[1]?.textContent).toContain("Provider");
    expect(triageRows[2]?.textContent).toContain("Routing");

    expect(container.textContent).toContain("Most common runtime error: provider_timeout.");
    expect(container.textContent).toContain("Open logs or execution review to inspect the active runtime failure path.");

    const executionLinks = Array.from(container.querySelectorAll('a[href="/execution?instanceId=instance_alpha"]'));
    const logsLinks = Array.from(container.querySelectorAll('a[href="/logs?instanceId=instance_alpha"]'));
    const routingLinks = Array.from(container.querySelectorAll('a[href="/routing?instanceId=instance_alpha"]'));
    expect(executionLinks.length).toBeGreaterThan(0);
    expect(logsLinks.length).toBeGreaterThan(0);
    expect(routingLinks.length).toBeGreaterThan(0);
  });

  it("separates blocked routing failures and switches the detail panel to the selected blocker", async () => {
    await renderIntoDom(withAppContext({
      path: "/errors?instanceId=instance_alpha",
      element: <ErrorsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    const routingTable = container.querySelector('table[aria-label="Blocked routing failures"]');
    expect(routingTable).not.toBeNull();

    const routingRows = Array.from(routingTable?.querySelectorAll("tbody tr") ?? []);
    expect(routingRows).toHaveLength(2);
    expect(routingRows[0]?.textContent).toContain("routing_budget_exceeded");
    expect(routingRows[0]?.textContent).toContain("budget");
    expect(routingRows[1]?.textContent).toContain("routing_policy_mismatch");

    await click(routingRows[0]?.querySelector("button") ?? null);
    await flushEffects();

    expect(container.textContent).toContain("Budget posture blocked all eligible premium candidates.");
    expect(container.textContent).toContain("Budget posture is blocking eligible routing candidates.");
    expect(container.textContent).toContain("Open Routing or Costs to remove the blocking budget condition.");
    expect(container.textContent).toContain("\"decision_id\": \"route-budget\"");

    const costLinks = Array.from(container.querySelectorAll('a[href="/costs?instanceId=instance_alpha"]'));
    const routingLinks = Array.from(container.querySelectorAll('a[href="/routing?instanceId=instance_alpha"]'));
    expect(costLinks.length).toBeGreaterThan(0);
    expect(routingLinks.length).toBeGreaterThan(0);
  });

  it("keeps budget-only routing gates in the incident state instead of soft-monitoring them", async () => {
    fetchLogsMock.mockResolvedValueOnce(createBudgetBlockedWithoutFailureLogsResponse());

    await renderIntoDom(withAppContext({
      path: "/errors?instanceId=instance_alpha",
      element: <ErrorsPage />,
      session: operatorSession,
    }));
    await flushEffects();

    const triageTable = container.querySelector('table[aria-label="Incident triage by axis"]');
    expect(triageTable).not.toBeNull();

    const triageRows = Array.from(triageTable?.querySelectorAll("tbody tr") ?? []);
    expect(triageRows[0]?.textContent).toContain("Routing");
    expect(triageRows[0]?.textContent).toContain("critical");
    expect(triageRows[0]?.textContent).toContain("Open Routing to inspect policy stage, budget gates, and blocked candidates.");

    const detailPanel = container.querySelector(".ff-detail-panel");
    expect(container.textContent).toContain("Blocked decisions: 0 · open circuits: 0 · budget blocked: yes.");
    expect(container.textContent).toContain("Routing decisions are being blocked by policy, budget, circuit, or capability posture.");
    expect(container.textContent).not.toContain("No blocked routing decision is currently recorded.");
    expect(container.textContent).not.toContain("No routing incident is currently recorded.");
    expect(detailPanel?.textContent).not.toContain("Monitor only.");
  });
});
