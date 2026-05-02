// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchDashboardMock, fetchInstancesMock } = vi.hoisted(() => ({
  fetchDashboardMock: vi.fn(),
  fetchInstancesMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchDashboard: fetchDashboardMock,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, DashboardResponse, InstanceRecord } from "../src/api/admin";
import { SetupPage } from "../src/features/setup/SetupPage";
import { createTestQueryClient, withAppContext } from "./testContext";

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

function createDashboardResponse(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    status: "ok",
    object: "dashboard_command_center",
    generated_at: "2026-04-26T12:00:00Z",
    kpis: {
      providers: 3,
      configured_providers: 2,
      ready_providers: 1,
      active_models: 12,
      runtime_requests_24h: 24,
      errors_24h: 3,
      needs_attention_count: 2,
      runtime_keys: 2,
      accounts: 2,
      waiting_on_approval_runs: 1,
      stalled_attempts: 0,
      open_circuits: 0,
    },
    alerts: [
      {
        severity: "warning",
        type: "provider_hotspot",
        message: "Provider openai_api is the current error hotspot.",
      },
    ],
    needs_attention: [
      "Go-live readiness is blocked",
      "OpenAI API is not runtime-stable yet",
    ],
    primary_action: {
      kind: "go_live_blocker",
      title: "Fix go-live blockers",
      description: "2 bootstrap checks and 1 runtime critical check are blocking go-live.",
      status: "blocked",
      to: "/dashboard",
      action_label: "Fix go-live blockers",
    },
    attention: [
      {
        id: "readiness:go_live",
        severity: "critical",
        title: "Go-live blockers need resolution",
        cause: "2 bootstrap checks and 1 runtime critical check are blocking go-live.",
        axis: "Readiness",
        to: "/dashboard",
        action_label: "Fix go-live blockers",
        status: "blocked",
      },
      {
        id: "provider:openai_api",
        severity: "warning",
        title: "OpenAI API is not runtime-stable yet",
        cause: "OAuth probes are still failing for this provider route.",
        axis: "Provider route",
        to: "/oauth-targets",
        action_label: "Fix OAuth targets",
        status: "onboarding-only",
      },
    ],
    sections: [
      {
        key: "readiness",
        title: "Readiness",
        status: "blocked",
        reason: "2 bootstrap checks and 1 runtime critical check are blocking go-live.",
        to: "/dashboard",
        action_label: "Fix go-live blockers",
        details: [
          "2 bootstrap checks are still failing.",
          "Runtime is not accepting traffic because 1 critical check remains open.",
        ],
      },
      {
        key: "security",
        title: "Security",
        status: "degraded",
        reason: "Secret rotation evidence is incomplete for configured provider credentials.",
        to: "/security",
        action_label: "Close security posture",
        details: [
          "1 configured provider credential lacks rotation evidence.",
        ],
      },
      {
        key: "runtime",
        title: "Runtime",
        status: "degraded",
        reason: "Provider openai_api is the current error hotspot.",
        to: "/errors",
        action_label: "Investigate runtime failures",
        details: [
          "3 runtime errors were recorded in the last 24 hours.",
          "1 provider route currently requires follow-up.",
        ],
      },
      {
        key: "routing_queue",
        title: "Routing / Queue",
        status: "degraded",
        reason: "1 run is waiting on approval instead of moving through the queue.",
        to: "/approvals",
        action_label: "Clear approval queue",
        details: [
          "1 run is currently runnable across queue lanes.",
          "1 active dispatch lease is present right now.",
        ],
      },
      {
        key: "cost",
        title: "Cost",
        status: "ready",
        reason: "Spend is flowing without an active budget or probe-cost blocker.",
        to: "/costs",
        action_label: "Review cost posture",
        details: [
          "Runtime actual cost is 0.12 over the last 24 hours.",
        ],
      },
    ],
    summary: [
      {
        key: "go_live",
        label: "Go-live",
        value: "blocked",
        meta: "2 bootstrap checks and 1 runtime critical check are blocking go-live.",
        status: "blocked",
      },
      {
        key: "providers",
        label: "Provider posture",
        value: "1 ready routes",
        meta: "1 route still needs follow-up.",
        status: "degraded",
      },
      {
        key: "routing_queue",
        label: "Routing / Queue",
        value: "1 active blockers",
        meta: "1 run is waiting on approval instead of moving through the queue.",
        status: "degraded",
      },
      {
        key: "cost",
        label: "Cost guardrails",
        value: "0.12 actual / 24h",
        meta: "Spend is flowing without an active budget or probe-cost blocker.",
        status: "ready",
      },
    ],
    empty_state: null,
    instance: {
      instance_id: "instance_alpha",
      tenant_id: "tenant_alpha",
      company_id: "company_alpha",
      display_name: "Alpha Instance",
    },
    security: {
      admin_auth_enabled: true,
      default_password_in_use: false,
      must_rotate_password: false,
    },
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root | null = null;
let testQueryClient: ReturnType<typeof createTestQueryClient>;

async function renderIntoDom(element: ReactNode) {
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
  });
}

/**
 * Flush the microtask queue deeply by yielding via setTimeout(fn, 0).
 * Unlike Promise.resolve() chains, this guarantees ALL cascading microtasks
 * (TanStack Query batch notifications, React concurrent renders) complete
 * before resolving.
 */
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Render the setup page and wait for TanStack Query to settle.
 */
async function renderSetupPage(session: AdminSessionUser, path = "/dashboard") {
  await renderIntoDom(withAppContext({
    path,
    element: <SetupPage />,
    session,
    queryClient: testQueryClient,
  }));

  /* Flush all cascading microtasks (TanStack Query batch scheduler,
   * React concurrent commit) inside act(). setTimeout(fn, 0) creates a
   * macrotask boundary that only fires after ALL pending microtasks drain,
   * catching deeply-nested batch notification chains. */
  await act(async () => {
    await flushMicrotasks();
    await flushMicrotasks();
  });

  /* Verify the loading state has resolved and data is rendered. */
  await vi.waitFor(async () => {
    await act(async () => {
      await flushMicrotasks();
    });
    expect(container.textContent).not.toContain("Loading setup state");
  }, { timeout: 2000, interval: 10 });
}

async function renderSetupPageWithoutFlush(session: AdminSessionUser, path = "/dashboard") {
  await renderIntoDom(withAppContext({
    path,
    element: <SetupPage />,
    session,
    queryClient: testQueryClient,
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstance()],
  });
  fetchDashboardMock.mockResolvedValue(createDashboardResponse());

  testQueryClient = createTestQueryClient();

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

describe("setup page", () => {
  it("renders the guided setup flow with steps and primary action", async () => {
    await renderSetupPage(operatorSession, "/dashboard?instanceId=instance_alpha");

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchDashboardMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("System setup");
    expect(container.textContent).toContain("Setup and status");
    /* Verify setup step card titles are rendered */
    expect(container.textContent).toContain("Configure instance and scope");
    expect(container.textContent).toContain("Connect provider");
    expect(container.textContent).toContain("Configure routing");
    expect(container.textContent).toContain("Issue runtime key");
    expect(container.textContent).toContain("Verify FQDN and TLS");
    expect(container.textContent).toContain("Run readiness probe");
    expect(container.textContent).toContain("Go-live readiness");

    /* Current step shows a primary action label */
    expect(container.textContent).toContain("Configure routing");

    const providerStepCard = Array.from(container.querySelectorAll(".ff-setup-step-card")).find(
      (card) => card.textContent?.includes("Connect provider"),
    );
    expect(providerStepCard?.textContent).toContain("complete");

    const primaryLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent?.includes("Configure routing"),
    );
    expect(primaryLink?.getAttribute("href")).toBe("/routing?instanceId=instance_alpha");

    /* Verify progress bar renders */
    expect(container.textContent).toContain("Step");
    expect(container.textContent).toContain("of");
  });

  it("shows setup steps when the scope is not fully configured", async () => {
    fetchDashboardMock.mockResolvedValue(createDashboardResponse({
      kpis: {
        providers: 3,
        configured_providers: 0,
        ready_providers: 0,
        active_models: 0,
        runtime_requests_24h: 0,
        errors_24h: 0,
        needs_attention_count: 1,
        runtime_keys: 0,
        accounts: 0,
        waiting_on_approval_runs: 0,
        stalled_attempts: 0,
        open_circuits: 0,
      },
      primary_action: {
        kind: "provider_configuration",
        title: "Configure providers",
        description: "No configured provider, runtime key, account, or runtime traffic is active in this scope yet.",
        status: "onboarding-only",
        to: "/dashboard",
        action_label: "Configure providers",
      },
      attention: [
        {
          id: "setup:not_configured",
          severity: "critical",
          title: "This scope is still in onboarding",
          cause: "No configured provider, runtime key, account, or runtime traffic is active in this scope yet.",
          axis: "Readiness",
          to: "/dashboard",
          action_label: "Configure providers",
          status: "onboarding-only",
        },
      ],
      empty_state: {
        status: "onboarding-only",
        title: "Command center is not configured yet",
        description: "No configured provider, runtime key, account, or runtime traffic is active in this scope yet.",
        action_label: "Configure providers",
        to: "/dashboard",
      },
    }));

    await renderSetupPage(operatorSession, "/dashboard?instanceId=instance_alpha");

    /* Setup steps should be visible even when the dashboard returns empty_state */
    expect(container.textContent).toContain("System setup");
    expect(container.textContent).toContain("Configure instance and scope");
    expect(container.textContent).toContain("Configure providers");

    const providerLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent?.includes("Configure providers"),
    );
    expect(providerLink?.getAttribute("href")).toBe("/providers?instanceId=instance_alpha");
    expect(container.innerHTML).not.toContain("/onboarding?instanceId=instance_alpha");
  });

  it("keeps the primary action aligned with the backend choice", async () => {
    fetchDashboardMock.mockResolvedValue(createDashboardResponse({
      primary_action: {
        kind: "routing_queue_pressure",
        title: "Clear routing and queue pressure",
        description: "Budget guardrails are hard-blocking routing decisions.",
        status: "blocked",
        to: "/routing",
        action_label: "Unblock routing budget",
      },
      attention: [
        {
          id: "routing_queue:pressure",
          severity: "critical",
          title: "Routing or queue pressure needs intervention",
          cause: "Budget guardrails are hard-blocking routing decisions.",
          axis: "Routing / Queue",
          to: "/routing",
          action_label: "Unblock routing budget",
          status: "blocked",
        },
      ],
      sections: [
        {
          key: "readiness",
          title: "Readiness",
          status: "ready",
          reason: "No readiness blocker is active.",
          to: "/release-validation",
          action_label: "Review release validation",
          details: [],
        },
        {
          key: "security",
          title: "Security",
          status: "ready",
          reason: "Security posture is closed.",
          to: "/security",
          action_label: "Review security posture",
          details: [],
        },
        {
          key: "runtime",
          title: "Runtime",
          status: "ready",
          reason: "Runtime is stable.",
          to: "/errors",
          action_label: "Investigate runtime failures",
          details: [],
        },
        {
          key: "routing_queue",
          title: "Routing / Queue",
          status: "blocked",
          reason: "Budget guardrails are hard-blocking routing decisions.",
          to: "/routing",
          action_label: "Unblock routing budget",
          details: [],
        },
        {
          key: "cost",
          title: "Cost",
          status: "ready",
          reason: "Cost posture is stable.",
          to: "/costs",
          action_label: "Review cost posture",
          details: [],
        },
      ],
    }));

    await renderSetupPage(operatorSession, "/dashboard?instanceId=instance_alpha");

    /* The primary action bar should show the backend primary action */
    expect(container.textContent).toContain("Unblock routing budget");

    const primaryLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent?.includes("Unblock routing budget"),
    );
    expect(primaryLink?.getAttribute("href")).toBe("/routing?instanceId=instance_alpha");
  });

  it("shows a readable error state when dashboard loading fails", async () => {
    fetchDashboardMock.mockRejectedValue(new Error("Dashboard loading failed for the selected scope."));

    await renderSetupPage(operatorSession, "/dashboard?instanceId=instance_alpha");

    expect(container.textContent).toContain("Setup data could not be loaded");
    expect(container.textContent).toContain("Dashboard loading failed for the selected scope.");

    const diagnosticsLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent?.includes("Review diagnostics"),
    );
    expect(diagnosticsLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha");
  });

  it("shows the loading state before dashboard data resolves", async () => {
    fetchDashboardMock.mockImplementation(() => new Promise(() => {}));

    await renderSetupPageWithoutFlush(operatorSession, "/dashboard?instanceId=instance_alpha");

    expect(container.textContent).toContain("Loading setup state");
  });
});
