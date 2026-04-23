import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
import { ProvidersPage } from "../src/pages/ProvidersPage";
import type { ProvidersAccessState, ProvidersPageActions, ProvidersPageData } from "../src/features/providers/providersShared";
import { withAppContext } from "./testContext";

const mockedUseProvidersControlPlane = vi.fn();

function createActions(): ProvidersPageActions {
  const noopAsync = async () => undefined;

  return {
    load: noopAsync,
    setRunFilter: () => undefined,
    setOperationResult: () => undefined,
    setImportPayload: () => undefined,
    setNewProvider: (() => undefined) as ProvidersPageActions["setNewProvider"],
    setNewHarness: (() => undefined) as ProvidersPageActions["setNewHarness"],
    setProviderLabelDraft: () => undefined,
    runHarnessAction: noopAsync,
    probeHarnessProfile: noopAsync,
    toggleHarnessProfile: noopAsync,
    deleteHarnessProfile: noopAsync,
    rollbackHarnessProfile: noopAsync,
    createProvider: noopAsync,
    toggleProvider: noopAsync,
    syncProviderModels: noopAsync,
    saveProviderLabel: noopAsync,
    syncAllProviders: noopAsync,
    upsertHarness: noopAsync,
    updateHealth: noopAsync,
    runHealthChecks: noopAsync,
    exportHarness: noopAsync,
    importHarness: noopAsync,
    syncOauthBridgeProfiles: noopAsync,
    probeAllOauthTargets: noopAsync,
    probeOauthTarget: noopAsync,
  };
}

function createData(access: ProvidersAccessState): ProvidersPageData {
  return {
    state: "success",
    error: null,
    access,
    providers: [],
    templates: [],
    profiles: [],
    runs: [],
    runSummary: {},
    runOps: {},
    runFilters: {
      mode: "all",
      status: "all",
      provider: "all",
      client: "all",
    },
    operationResult: "",
    syncNote: "",
    healthConfig: null,
    newProvider: {
      provider: "",
      label: "",
    },
    providerLabelDrafts: {},
    providerErrors: {},
    modelErrors: {},
    integrationErrors: {},
    profileErrors: {},
    clients: [],
    productAxisTargets: [],
    oauthTargets: [],
    oauthOperations: [],
    oauthRecentOps: [],
    oauthTotalOps: 0,
    oauthOnboarding: [],
    compatibilityMatrix: [],
    bootstrapReadiness: null,
    importPayload: "",
    newHarness: {
      provider_key: "",
      label: "",
      template_id: "",
      integration_class: "openai_compatible",
      endpoint_base_url: "",
      auth_scheme: "none",
      auth_value: "",
      auth_header: "",
      models: "",
      stream_enabled: false,
    },
  };
}

function createSession(overrides: Partial<AdminSessionUser> = {}): AdminSessionUser {
  return {
    session_id: "sess_test",
    user_id: "user_test",
    username: "ops-user",
    display_name: "Ops User",
    role: "admin",
    session_type: "standard",
    read_only: false,
    must_rotate_password: false,
    ...overrides,
  };
}

vi.mock("../src/features/providers/useProvidersControlPlane", () => ({
  useProvidersControlPlane: (access: ProvidersAccessState, instanceId?: string | null) => mockedUseProvidersControlPlane(access, instanceId),
}));

describe("Providers page hierarchy", () => {
  beforeEach(() => {
    mockedUseProvidersControlPlane.mockImplementation((access: ProvidersAccessState) => ({
      data: createData(access),
      actions: createActions(),
    }));
  });

  it("renders the route-level page header before the first summary card", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/providers",
        element: <ProvidersPage />,
        session: createSession(),
      }),
    );

    expect(markup).toContain("<section class=\"fg-page\">");
    expect(markup).toContain("Which provider task are you handling right now");
    expect(markup).toContain(">Harness<");
    expect(markup).toContain("href=\"/harness\"");
    expect(markup).toContain(">Provider Health &amp; Runs<");
    expect(markup).toContain(">Control-Plane Summary</h3>");
    expect(markup).toContain("Admin mutations enabled");
    expect(markup).toContain("Sync all providers");
    expect(markup).toContain("Providers Control Plane");
    expect(markup).not.toContain("Save profile");
    expect(markup).not.toContain("Preview + Verify");
    expect(markup.indexOf("Providers Control Plane")).toBeLessThan(markup.indexOf(">Control-Plane Summary</h3>"));
  });

  it("shows permission-limited copy for viewer sessions before the page surfaces actions", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/providers",
        element: <ProvidersPage />,
        session: createSession({ role: "viewer", username: "viewer" }),
      }),
    );

    expect(markup).toContain("Viewer access");
    expect(markup).toContain("mutating provider actions stay hidden");
    expect(markup).toContain("Runtime truth stays visible here without surfacing mutations that the backend will block.");
    expect(markup).not.toContain("Sync all providers");
    expect(markup).not.toContain("Save profile");
    expect(markup).not.toContain("Preview + Verify");
  });

  it("forwards instance scope from the route into the providers hook", () => {
    renderToStaticMarkup(
      withAppContext({
        path: "/providers?instanceId=instance_alpha",
        element: <ProvidersPage />,
        session: createSession(),
      }),
    );

    expect(mockedUseProvidersControlPlane).toHaveBeenCalledWith(expect.any(Object), "instance_alpha");
  });

  it("shows read-only copy for impersonated sessions before the page surfaces actions", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/providers",
        element: <ProvidersPage />,
        session: createSession({ read_only: true, session_type: "impersonation" }),
      }),
    );

    expect(markup).toContain("Read only session");
    expect(markup).toContain("provider truth and expansion targets here");
    expect(markup).toContain("dedicated harness state, runs, and redacted harness exports on the Harness route");
    expect(markup).toContain("Runtime truth stays visible here without surfacing mutations that the backend will block.");
    expect(markup).not.toContain("Sync all providers");
    expect(markup).not.toContain("Save profile");
    expect(markup).not.toContain("Preview + Verify");
  });
});
