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
      to: "/onboarding",
      action_label: "Fix go-live blockers",
    },
    attention: [
      {
        id: "readiness:go_live",
        severity: "critical",
        title: "Go-live blockers need resolution",
        cause: "2 bootstrap checks and 1 runtime critical check are blocking go-live.",
        axis: "Readiness",
        to: "/onboarding",
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
        to: "/onboarding",
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

async function renderDashboardPageWithoutFlush(session: AdminSessionUser, path = "/dashboard") {
  await renderIntoDom(withAppContext({
    path,
    element: <DashboardPage />,
    session,
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [createInstance()],
  });
  fetchDashboardMock.mockResolvedValue(createDashboardResponse());
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

describe("dashboard command center", () => {
  it("renders the command-center contract with scoped deep links", async () => {
    await renderDashboardPage(operatorSession, "/dashboard?instanceId=instance_alpha");

    expect(fetchInstancesMock).toHaveBeenCalledTimes(1);
    expect(fetchDashboardMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Primary next action");
    expect(container.textContent).toContain("Fix go-live blockers");
    expect(container.textContent).toContain("Instance scope");
    expect(container.textContent).toContain("Priority attention list");
    expect(container.textContent).toContain("Operational posture");
    expect(container.textContent).toContain("Readiness");
    expect(container.textContent).toContain("Cause:");

    const onboardingLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Fix go-live blockers"));
    expect(onboardingLink?.getAttribute("href")).toBe("/onboarding?instanceId=instance_alpha");

    const oauthTargetsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Fix OAuth targets"));
    expect(oauthTargetsLink?.getAttribute("href")).toBe("/oauth-targets?instanceId=instance_alpha");
  });

  it("shows a real empty state with onboarding link when the scope is not configured", async () => {
    fetchDashboardMock.mockResolvedValue(createDashboardResponse({
      primary_action: {
        kind: "provider_configuration",
        title: "Configure providers",
        description: "No configured provider, runtime key, account, or runtime traffic is active in this scope yet.",
        status: "onboarding-only",
        to: "/onboarding",
        action_label: "Configure providers",
      },
      attention: [
        {
          id: "setup:not_configured",
          severity: "critical",
          title: "This scope is still in onboarding",
          cause: "No configured provider, runtime key, account, or runtime traffic is active in this scope yet.",
          axis: "Readiness",
          to: "/onboarding",
          action_label: "Configure providers",
          status: "onboarding-only",
        },
      ],
      empty_state: {
        status: "onboarding-only",
        title: "Command center is not configured yet",
        description: "No configured provider, runtime key, account, or runtime traffic is active in this scope yet.",
        action_label: "Configure providers",
        to: "/onboarding",
      },
    }));

    await renderDashboardPage(operatorSession, "/dashboard?instanceId=instance_alpha");

    expect(container.textContent).toContain("Command center is not configured yet");
    expect(container.textContent).not.toContain("Priority attention list");

    const onboardingLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Configure providers"));
    expect(onboardingLink?.getAttribute("href")).toBe("/onboarding?instanceId=instance_alpha");
  });

  it("makes the permission-limited state explicit for viewer sessions", async () => {
    await renderDashboardPage(viewerSession, "/dashboard?instanceId=instance_alpha");

    expect(fetchDashboardMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Some repair routes are permission-limited");
    expect(container.textContent).toContain("Viewer sessions can read the command center");

    const permissionLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Review runtime access"));
    expect(permissionLink?.getAttribute("href")).toBe("/accounts?instanceId=instance_alpha");

    const evidenceLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Review live evidence"));
    expect(evidenceLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha");
  });

  it("keeps the primary action aligned with the highest-priority backend choice", async () => {
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
          id: "alert:provider_hotspot",
          severity: "warning",
          title: "Runtime failures are climbing",
          cause: "Provider openai_api is the current error hotspot.",
          axis: "Runtime",
          to: "/errors",
          action_label: "Investigate runtime failures",
          status: "degraded",
        },
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
          status: "degraded",
          reason: "Provider openai_api is the current error hotspot.",
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

    await renderDashboardPage(operatorSession, "/dashboard?instanceId=instance_alpha");

    expect(container.textContent).toContain("Clear routing and queue pressure");
    const primaryLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Unblock routing budget"));
    expect(primaryLink?.getAttribute("href")).toBe("/routing?instanceId=instance_alpha");
  });

  it("shows a concrete recovery link when the scoped instance is missing", async () => {
    fetchDashboardMock.mockRejectedValue(Object.assign(new Error("Instance scope is missing."), { code: "instance_scope_not_found" }));

    await renderDashboardPage(operatorSession, "/dashboard?instanceId=instance_missing");

    expect(container.textContent).toContain("Selected instance is outside the current dashboard scope");
    expect(container.textContent).toContain("Reset to default scope");
    expect(container.textContent).toContain("Review instance inventory");

    const hrefs = Array.from(container.querySelectorAll("a"))
      .map((link) => link.getAttribute("href"))
      .filter((value): value is string => Boolean(value));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/instances");
  });

  it("shows a readable error state when dashboard loading fails", async () => {
    fetchDashboardMock.mockRejectedValue(new Error("Dashboard loading failed for the selected scope."));

    await renderDashboardPage(operatorSession, "/dashboard?instanceId=instance_alpha");

    expect(container.textContent).toContain("Dashboard loading failed");
    expect(container.textContent).toContain("Dashboard loading failed for the selected scope.");

    const diagnosticsLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Review diagnostics"));
    expect(diagnosticsLink?.getAttribute("href")).toBe("/logs?instanceId=instance_alpha");
  });

  it("shows the loading state before dashboard data resolves", async () => {
    fetchDashboardMock.mockImplementation(() => new Promise(() => {}));

    await renderDashboardPageWithoutFlush(operatorSession, "/dashboard?instanceId=instance_alpha");

    expect(container.textContent).toContain("Loading command-center truth");
  });
});
