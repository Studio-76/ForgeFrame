import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
import { OAuthTargetsPage } from "../src/pages/OAuthTargetsPage";
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
    setProviderDraftField: () => undefined,
    setNewHarness: (() => undefined) as ProvidersPageActions["setNewHarness"],
    setProviderLabelDraft: () => undefined,
    runHarnessAction: noopAsync,
    previewHarnessProfile: noopAsync,
    verifyHarnessProfile: noopAsync,
    dryRunHarnessProfile: noopAsync,
    probeHarnessProfile: noopAsync,
    toggleHarnessProfile: noopAsync,
    deleteHarnessProfile: noopAsync,
    rollbackHarnessProfile: noopAsync,
    createProvider: noopAsync,
    saveProvider: noopAsync,
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

function createSession(overrides: Partial<AdminSessionUser> = {}): AdminSessionUser {
  return {
    session_id: "sess_test",
    user_id: "user_test",
    username: "ops-user",
    display_name: "Ops User",
    role: "operator",
    session_type: "standard",
    read_only: false,
    must_rotate_password: false,
    ...overrides,
  };
}

function createScopedOperatorSession(): AdminSessionUser {
  return createSession({
    active_instance_id: "instance_alpha",
    instance_permissions: {
      instance_alpha: ["providers.read", "providers.write"],
      instance_beta: ["providers.read"],
    },
  });
}

function createScopedNoReadSession(): AdminSessionUser {
  return createSession({
    active_instance_id: "instance_alpha",
    instance_permissions: {
      instance_alpha: ["providers.read", "providers.write"],
    },
  });
}

function createData(access: ProvidersAccessState): ProvidersPageData {
  return {
    state: "success",
    error: null,
    access,
    providers: [],
    supportedProviderClasses: [
      {
        key: "oauth_account",
        label: "OAuth / Account-backed",
        description: "",
        integration_class: "oauth_account",
        template_id: null,
        default_config: {
          provider_class: "oauth_account",
          auth_scheme: "oauth_account",
          oauth_mode: "account_portal",
        },
      },
    ],
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
    lastHarnessAction: null,
    syncNote: "",
    healthConfig: null,
    newProvider: {
      provider: "",
      label: "",
      providerClass: "oauth_account",
      integrationClass: "oauth_account",
      templateId: "",
      endpointBaseUrl: "",
      authScheme: "oauth_account",
      oauthMode: "account_portal",
    },
    providerDrafts: {},
    providerLabelDrafts: {},
    providerErrors: {},
    modelErrors: {},
    integrationErrors: {},
    profileErrors: {},
    providerCatalog: [],
    providerCatalogSummary: null,
    openaiCompatibilitySignoff: null,
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

vi.mock("../src/features/providers/useProvidersControlPlane", () => ({
  useProvidersControlPlane: (access: ProvidersAccessState, instanceId?: string | null) => mockedUseProvidersControlPlane(access, instanceId),
}));

describe("OAuth targets page", () => {
  beforeEach(() => {
    mockedUseProvidersControlPlane.mockImplementation((access: ProvidersAccessState) => ({
      data: createData(access),
      actions: createActions(),
    }));
  });

  it("renders the dedicated OAuth operator surface", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets",
        element: <OAuthTargetsPage />,
        session: createSession(),
      }),
    );

    expect(markup).toContain("OAuth Targets &amp; Operations");
    expect(markup).toContain("Which OAuth/account target are you classifying, probing, or de-risking right now?");
    expect(markup).toContain(">OAuth Targets<");
    expect(markup).toContain(">Product Axis Contracts</h3>");
  });

  it("forwards instance scope from the route into the shared providers hook", () => {
    renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_alpha",
        element: <OAuthTargetsPage />,
        session: createSession(),
      }),
    );

    expect(mockedUseProvidersControlPlane).toHaveBeenCalledWith(expect.any(Object), "instance_alpha");
  });

  it("preserves instance scope in the dedicated OAuth route links", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_alpha",
        element: <OAuthTargetsPage />,
        session: createSession(),
      }),
    );

    expect(markup).toContain('href="/oauth-targets?instanceId=instance_alpha"');
    expect(markup).toContain('href="/providers?instanceId=instance_alpha"');
    expect(markup).toContain('href="/harness?instanceId=instance_alpha"');
    expect(markup).toContain('href="/onboarding?instanceId=instance_alpha"');
    expect(markup).toContain('href="/usage?instanceId=instance_alpha"');
  });

  it("only shows mutating OAuth target controls on the instance that grants write access", () => {
    const alphaMarkup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_alpha",
        element: <OAuthTargetsPage />,
        session: createScopedOperatorSession(),
      }),
    );
    const betaMarkup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_beta",
        element: <OAuthTargetsPage />,
        session: createScopedOperatorSession(),
      }),
    );

    expect(alphaMarkup).toContain("Operator mutations enabled");
    expect(alphaMarkup).toContain("Probe all OAuth targets");
    expect(betaMarkup).not.toContain("Operator mutations enabled");
    expect(betaMarkup).not.toContain("Probe all OAuth targets");
    expect(betaMarkup).toContain("Operate only");
  });

  it("shows an honest blocked state when the session lacks scoped providers.read", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/oauth-targets?instanceId=instance_beta",
        element: <OAuthTargetsPage />,
        session: createScopedNoReadSession(),
      }),
    );

    expect(markup).toContain("Read access required");
    expect(markup).toContain("the backend will return 403 until providers.read is granted here");
    expect(markup).not.toContain(">Product Axis Contracts</h3>");
    expect(markup).not.toContain("Probe all OAuth targets");
  });
});
