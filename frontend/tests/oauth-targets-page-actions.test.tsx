// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchProviderControlPlaneMock,
  fetchProductAxisTargetsMock,
  fetchOauthAccountTargetsMock,
  fetchOauthAccountOperationsMock,
  fetchOauthOnboardingMock,
  syncOauthAccountBridgeProfilesMock,
  probeAllOauthAccountProvidersMock,
  probeOauthAccountProviderMock,
} = vi.hoisted(() => ({
  fetchProviderControlPlaneMock: vi.fn(),
  fetchProductAxisTargetsMock: vi.fn(),
  fetchOauthAccountTargetsMock: vi.fn(),
  fetchOauthAccountOperationsMock: vi.fn(),
  fetchOauthOnboardingMock: vi.fn(),
  syncOauthAccountBridgeProfilesMock: vi.fn(),
  probeAllOauthAccountProvidersMock: vi.fn(),
  probeOauthAccountProviderMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchProviderControlPlane: fetchProviderControlPlaneMock,
    fetchProductAxisTargets: fetchProductAxisTargetsMock,
    fetchOauthAccountTargets: fetchOauthAccountTargetsMock,
    fetchOauthAccountOperations: fetchOauthAccountOperationsMock,
    fetchOauthOnboarding: fetchOauthOnboardingMock,
    syncOauthAccountBridgeProfiles: syncOauthAccountBridgeProfilesMock,
    probeAllOauthAccountProviders: probeAllOauthAccountProvidersMock,
    probeOauthAccountProvider: probeOauthAccountProviderMock,
  };
});

import type { ProvidersAccessState, ProvidersPageActions } from "../src/features/providers/providersShared";
import { useProvidersControlPlane } from "../src/features/providers/useProvidersControlPlane";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const operatorAccess: ProvidersAccessState = {
  canRead: true,
  canOperate: true,
  canExportRedacted: true,
  canExportFull: false,
  canMutate: true,
  isBlocked: false,
  isReadOnly: false,
  isCheckingAccess: false,
  badgeLabel: "Operator mutations enabled",
  badgeTone: "success",
  summaryTitle: "Provider mutations enabled",
  summaryDetail: "",
  exportBlockedMessage: "",
  fullExportBlockedMessage: "",
  mutationBlockedMessage: "",
};

let container: HTMLDivElement;
let root: Root | null = null;
let capturedActions: ProvidersPageActions | null = null;

function HookProbe() {
  const { actions } = useProvidersControlPlane(operatorAccess, "instance_alpha", {
    includeUsageSummary: false,
    includeHarness: false,
    includeOauthTargets: true,
    includeCompatibilityMatrix: false,
    includeBootstrapReadiness: false,
    includeClientView: false,
  });

  capturedActions = actions;
  return null;
}

async function renderIntoDom() {
  root = createRoot(container);
  await act(async () => {
    root?.render(<HookProbe />);
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  capturedActions = null;
  container = document.createElement("div");
  document.body.appendChild(container);

  fetchProviderControlPlaneMock.mockResolvedValue({
    status: "ok",
    object: "provider_control_plane",
    providers: [],
    supported_provider_classes: [],
    notes: {},
    health_config: null,
    provider_catalog: [],
    provider_catalog_summary: null,
    openai_compatibility_signoff: null,
  });
  fetchProductAxisTargetsMock.mockResolvedValue({ status: "ok", targets: [] });
  fetchOauthAccountTargetsMock.mockResolvedValue({ status: "ok", targets: [] });
  fetchOauthAccountOperationsMock.mockResolvedValue({ status: "ok", operations: [], recent: [], total_operations: 0 });
  fetchOauthOnboardingMock.mockResolvedValue({ status: "ok", targets: [] });
  syncOauthAccountBridgeProfilesMock.mockResolvedValue({ status: "ok", upserted_profiles: [], skipped: [] });
  probeAllOauthAccountProvidersMock.mockResolvedValue({ status: "ok", probes: [] });
  probeOauthAccountProviderMock.mockResolvedValue({ status: "ok", probe: {} });
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  container.remove();
});

describe("OAuth target actions", () => {
  it("passes the active instance scope into OAuth mutation helpers", async () => {
    await renderIntoDom();
    await flushEffects();

    expect(capturedActions).not.toBeNull();

    await act(async () => {
      await capturedActions?.syncOauthBridgeProfiles();
    });
    await act(async () => {
      await capturedActions?.probeAllOauthTargets();
    });
    await act(async () => {
      await capturedActions?.probeOauthTarget("google_workspace");
    });

    expect(syncOauthAccountBridgeProfilesMock).toHaveBeenCalledWith("instance_alpha");
    expect(probeAllOauthAccountProvidersMock).toHaveBeenCalledWith("instance_alpha");
    expect(probeOauthAccountProviderMock).toHaveBeenCalledWith("google_workspace", "instance_alpha");
  });
});
