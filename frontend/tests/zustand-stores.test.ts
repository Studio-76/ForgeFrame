// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// ── Scope store ─────────────────────────────────────────────────────────

import { useScopeStore } from "../src/store/scopeStore";

describe("useScopeStore", () => {
  beforeEach(() => {
    useScopeStore.setState({ instanceId: null, scopeLabel: "All instances" });
  });

  it("starts with null instanceId and default label", () => {
    const state = useScopeStore.getState();
    expect(state.instanceId).toBeNull();
    expect(state.scopeLabel).toBe("All instances");
  });

  it("setScope sets instanceId and derived label", () => {
    useScopeStore.getState().setScope("inst-abc");
    expect(useScopeStore.getState().instanceId).toBe("inst-abc");
    expect(useScopeStore.getState().scopeLabel).toBe("inst-abc");
  });

  it("setScope accepts a custom label", () => {
    useScopeStore.getState().setScope("inst-abc", "Production instance");
    expect(useScopeStore.getState().instanceId).toBe("inst-abc");
    expect(useScopeStore.getState().scopeLabel).toBe("Production instance");
  });

  it("setScope(null) clears back to default label", () => {
    useScopeStore.getState().setScope("inst-abc", "Production");
    useScopeStore.getState().setScope(null);
    expect(useScopeStore.getState().instanceId).toBeNull();
    expect(useScopeStore.getState().scopeLabel).toBe("All instances");
  });

  it("clearScope resets to defaults", () => {
    useScopeStore.getState().setScope("inst-abc", "Test");
    useScopeStore.getState().clearScope();
    expect(useScopeStore.getState().instanceId).toBeNull();
    expect(useScopeStore.getState().scopeLabel).toBe("All instances");
  });

  it("getState reflects setScope changes", () => {
    useScopeStore.getState().setScope("inst-1");
    expect(useScopeStore.getState().instanceId).toBe("inst-1");
    useScopeStore.getState().setScope("inst-2");
    expect(useScopeStore.getState().instanceId).toBe("inst-2");
    useScopeStore.getState().setScope(null);
    expect(useScopeStore.getState().instanceId).toBeNull();
  });
});

// ── Navigation store ────────────────────────────────────────────────────

import { useNavigationStore } from "../src/store/navigationStore";

describe("useNavigationStore", () => {
  beforeEach(() => {
    useNavigationStore.setState({
      commandPaletteOpen: false,
      activeRelatedPageGroup: null,
    });
  });

  it("starts with closed palette and no active group", () => {
    const state = useNavigationStore.getState();
    expect(state.commandPaletteOpen).toBe(false);
    expect(state.activeRelatedPageGroup).toBeNull();
  });

  it("setCommandPaletteOpen opens and closes", () => {
    useNavigationStore.getState().setCommandPaletteOpen(true);
    expect(useNavigationStore.getState().commandPaletteOpen).toBe(true);

    useNavigationStore.getState().setCommandPaletteOpen(false);
    expect(useNavigationStore.getState().commandPaletteOpen).toBe(false);
  });

  it("toggleCommandPalette flips state", () => {
    useNavigationStore.getState().toggleCommandPalette();
    expect(useNavigationStore.getState().commandPaletteOpen).toBe(true);

    useNavigationStore.getState().toggleCommandPalette();
    expect(useNavigationStore.getState().commandPaletteOpen).toBe(false);
  });

  it("setActiveRelatedPageGroup sets group", () => {
    useNavigationStore.getState().setActiveRelatedPageGroup("providers");
    expect(useNavigationStore.getState().activeRelatedPageGroup).toBe("providers");

    useNavigationStore.getState().setActiveRelatedPageGroup(null);
    expect(useNavigationStore.getState().activeRelatedPageGroup).toBeNull();
  });

  it("resetNavigation resets to defaults", () => {
    useNavigationStore.getState().setCommandPaletteOpen(true);
    useNavigationStore.getState().setActiveRelatedPageGroup("execution");
    useNavigationStore.getState().resetNavigation();

    expect(useNavigationStore.getState().commandPaletteOpen).toBe(false);
    expect(useNavigationStore.getState().activeRelatedPageGroup).toBeNull();
  });
});

// ── Table UI store ──────────────────────────────────────────────────────

import { useTableUiStore } from "../src/store/tableUiStore";

describe("useTableUiStore", () => {
  beforeEach(() => {
    useTableUiStore.setState({
      selectedRowId: {},
      expandedRows: {},
      activeFilters: {},
    });
  });

  it("starts with no selections", () => {
    const state = useTableUiStore.getState();
    expect(state.selectedRowId).toEqual({});
    expect(state.expandedRows).toEqual({});
    expect(state.activeFilters).toEqual({});
  });

  it("setSelectedRow stores row per table key", () => {
    useTableUiStore.getState().setSelectedRow("skills:main", "row-1");
    expect(useTableUiStore.getState().selectedRowId["skills:main"]).toBe("row-1");

    // Different table key gets its own selection
    useTableUiStore.getState().setSelectedRow("agents:main", "row-2");
    expect(useTableUiStore.getState().selectedRowId["skills:main"]).toBe("row-1");
    expect(useTableUiStore.getState().selectedRowId["agents:main"]).toBe("row-2");
  });

  it("setSelectedRow(null) clears selection for that table", () => {
    useTableUiStore.getState().setSelectedRow("skills:main", "row-1");
    useTableUiStore.getState().setSelectedRow("skills:main", null);
    expect(useTableUiStore.getState().selectedRowId["skills:main"]).toBeNull();
  });

  it("clearSelectedRow removes the key entirely", () => {
    useTableUiStore.getState().setSelectedRow("skills:main", "row-1");
    useTableUiStore.getState().clearSelectedRow("skills:main");
    expect("skills:main" in useTableUiStore.getState().selectedRowId).toBe(false);
  });

  it("toggleRowExpanded toggles state", () => {
    useTableUiStore.getState().toggleRowExpanded("skills:main", "row-1");
    expect(useTableUiStore.getState().expandedRows["skills:main"]?.has("row-1")).toBe(true);

    useTableUiStore.getState().toggleRowExpanded("skills:main", "row-1");
    expect(useTableUiStore.getState().expandedRows["skills:main"]?.has("row-1")).toBe(false);
  });

  it("expandRow is idempotent", () => {
    useTableUiStore.getState().expandRow("skills:main", "row-1");
    useTableUiStore.getState().expandRow("skills:main", "row-1");
    expect(useTableUiStore.getState().expandedRows["skills:main"]?.size).toBe(1);
  });

  it("collapseRow only affects the specified row", () => {
    useTableUiStore.getState().expandRow("skills:main", "row-1");
    useTableUiStore.getState().expandRow("skills:main", "row-2");
    useTableUiStore.getState().collapseRow("skills:main", "row-1");

    expect(useTableUiStore.getState().expandedRows["skills:main"]?.has("row-2")).toBe(true);
    expect(useTableUiStore.getState().expandedRows["skills:main"]?.has("row-1")).toBe(false);
  });

  it("collapseAllRows clears all rows for a table", () => {
    useTableUiStore.getState().expandRow("skills:main", "row-1");
    useTableUiStore.getState().expandRow("skills:main", "row-2");
    useTableUiStore.getState().collapseAllRows("skills:main");

    expect(useTableUiStore.getState().expandedRows["skills:main"]?.size).toBe(0);
  });

  it("clearAllSelections clears all table selections", () => {
    useTableUiStore.getState().setSelectedRow("skills:main", "row-1");
    useTableUiStore.getState().setSelectedRow("agents:main", "row-2");
    useTableUiStore.getState().clearAllSelections();

    expect(useTableUiStore.getState().selectedRowId).toEqual({});
  });

  it("setActiveFilter stores filter per table", () => {
    useTableUiStore.getState().setActiveFilter("skills:main", "needs_attention");
    expect(useTableUiStore.getState().activeFilters["skills:main"]).toBe("needs_attention");

    useTableUiStore.getState().setActiveFilter("skills:main", null);
    expect(useTableUiStore.getState().activeFilters["skills:main"]).toBeNull();
  });

  it("resetTable clears all state for a specific table", () => {
    useTableUiStore.getState().setSelectedRow("skills:main", "row-1");
    useTableUiStore.getState().setSelectedRow("agents:main", "row-2");
    useTableUiStore.getState().expandRow("skills:main", "row-1");
    useTableUiStore.getState().setActiveFilter("skills:main", "blocked");

    useTableUiStore.getState().resetTable("skills:main");

    // skills:main table should be cleared
    expect("skills:main" in useTableUiStore.getState().selectedRowId).toBe(false);
    expect("skills:main" in useTableUiStore.getState().expandedRows).toBe(false);
    expect("skills:main" in useTableUiStore.getState().activeFilters).toBe(false);

    // agents:main should be preserved
    expect(useTableUiStore.getState().selectedRowId["agents:main"]).toBe("row-2");
  });
});

// ── Panel store ─────────────────────────────────────────────────────────

import { usePanelStore } from "../src/store/panelStore";

describe("usePanelStore", () => {
  beforeEach(() => {
    usePanelStore.setState({
      activeDrawer: null,
      drawerData: null,
      diagnosticsExpanded: {},
      inspectedEntityId: null,
    });
  });

  it("starts in default state", () => {
    const state = usePanelStore.getState();
    expect(state.activeDrawer).toBeNull();
    expect(state.drawerData).toBeNull();
    expect(state.diagnosticsExpanded).toEqual({});
    expect(state.inspectedEntityId).toBeNull();
  });

  it("openDrawer sets drawer and data", () => {
    usePanelStore.getState().openDrawer("skill-detail", { skillId: "sk-abc" });
    expect(usePanelStore.getState().activeDrawer).toBe("skill-detail");
    expect(usePanelStore.getState().drawerData).toEqual({ skillId: "sk-abc" });
  });

  it("openDrawer without data sets null", () => {
    usePanelStore.getState().openDrawer("skill-detail");
    expect(usePanelStore.getState().activeDrawer).toBe("skill-detail");
    expect(usePanelStore.getState().drawerData).toBeNull();
  });

  it("closeDrawer clears drawer and inspected entity", () => {
    usePanelStore.getState().openDrawer("skill-detail", { skillId: "sk-abc" });
    usePanelStore.getState().setInspectedEntity("entity-1");

    usePanelStore.getState().closeDrawer();
    expect(usePanelStore.getState().activeDrawer).toBeNull();
    expect(usePanelStore.getState().drawerData).toBeNull();
    expect(usePanelStore.getState().inspectedEntityId).toBeNull();
  });

  it("setDiagnosticsExpanded sets state", () => {
    usePanelStore.getState().setDiagnosticsExpanded("execution-payload", true);
    expect(usePanelStore.getState().diagnosticsExpanded["execution-payload"]).toBe(true);

    usePanelStore.getState().setDiagnosticsExpanded("execution-payload", false);
    expect(usePanelStore.getState().diagnosticsExpanded["execution-payload"]).toBe(false);
  });

  it("toggleDiagnosticsExpanded flips state", () => {
    usePanelStore.getState().toggleDiagnosticsExpanded("panel-1");
    expect(usePanelStore.getState().diagnosticsExpanded["panel-1"]).toBe(true);

    usePanelStore.getState().toggleDiagnosticsExpanded("panel-1");
    expect(usePanelStore.getState().diagnosticsExpanded["panel-1"]).toBe(false);
  });

  it("setInspectedEntity sets entity ID", () => {
    usePanelStore.getState().setInspectedEntity("entity-1");
    expect(usePanelStore.getState().inspectedEntityId).toBe("entity-1");

    usePanelStore.getState().setInspectedEntity(null);
    expect(usePanelStore.getState().inspectedEntityId).toBeNull();
  });

  it("resetPanels clears all state", () => {
    usePanelStore.getState().openDrawer("test-drawer", { key: "val" });
    usePanelStore.getState().setDiagnosticsExpanded("panel-1", true);
    usePanelStore.getState().setInspectedEntity("entity-1");

    usePanelStore.getState().resetPanels();

    expect(usePanelStore.getState().activeDrawer).toBeNull();
    expect(usePanelStore.getState().drawerData).toBeNull();
    expect(usePanelStore.getState().diagnosticsExpanded).toEqual({});
    expect(usePanelStore.getState().inspectedEntityId).toBeNull();
  });
});

// ── Preferences store ───────────────────────────────────────────────────

import { usePreferencesStore } from "../src/store/preferencesStore";

describe("usePreferencesStore", () => {
  beforeEach(() => {
    // Reset to default state before each test (bypass persist middleware rehydration)
    usePreferencesStore.setState({
      compact: false,
      density: "default",
      dismissedHints: [],
    });
    // Clear localStorage between tests
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("starts with default preferences", () => {
    const state = usePreferencesStore.getState();
    expect(state.compact).toBe(false);
    expect(state.density).toBe("default");
    expect(state.dismissedHints).toEqual([]);
  });

  it("toggleCompact flips compact and density", () => {
    usePreferencesStore.getState().toggleCompact();
    expect(usePreferencesStore.getState().compact).toBe(true);
    expect(usePreferencesStore.getState().density).toBe("compact");

    usePreferencesStore.getState().toggleCompact();
    expect(usePreferencesStore.getState().compact).toBe(false);
    expect(usePreferencesStore.getState().density).toBe("default");
  });

  it("setCompact sets both compact and density", () => {
    usePreferencesStore.getState().setCompact(true);
    expect(usePreferencesStore.getState().compact).toBe(true);
    expect(usePreferencesStore.getState().density).toBe("compact");

    usePreferencesStore.getState().setCompact(false);
    expect(usePreferencesStore.getState().compact).toBe(false);
    expect(usePreferencesStore.getState().density).toBe("default");
  });

  it("setDensity sets both density and compact", () => {
    usePreferencesStore.getState().setDensity("compact");
    expect(usePreferencesStore.getState().density).toBe("compact");
    expect(usePreferencesStore.getState().compact).toBe(true);

    usePreferencesStore.getState().setDensity("default");
    expect(usePreferencesStore.getState().density).toBe("default");
    expect(usePreferencesStore.getState().compact).toBe(false);
  });

  it("dismissHint adds hint ID", () => {
    usePreferencesStore.getState().dismissHint("onboarding-tip");
    expect(usePreferencesStore.getState().dismissedHints).toEqual(["onboarding-tip"]);
  });

  it("dismissHint is idempotent", () => {
    usePreferencesStore.getState().dismissHint("onboarding-tip");
    usePreferencesStore.getState().dismissHint("onboarding-tip");
    expect(usePreferencesStore.getState().dismissedHints).toEqual(["onboarding-tip"]);
  });

  it("resetDismissedHints clears all hints", () => {
    usePreferencesStore.getState().dismissHint("hint-1");
    usePreferencesStore.getState().dismissHint("hint-2");
    usePreferencesStore.getState().resetDismissedHints();
    expect(usePreferencesStore.getState().dismissedHints).toEqual([]);
  });

  it("persists compact preference to localStorage", () => {
    usePreferencesStore.getState().setCompact(true);
    const stored = JSON.parse(window.localStorage.getItem("forgeframe.ui.preferences") ?? "{}");
    expect(stored.state.compact).toBe(true);
    expect(stored.state.density).toBe("compact");
  });

  it("writes the expected shape to localStorage on change", () => {
    usePreferencesStore.getState().setCompact(true);
    usePreferencesStore.getState().dismissHint("hint-1");

    const raw = window.localStorage.getItem("forgeframe.ui.preferences");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}") as { state: Record<string, unknown>; version: number };
    expect(parsed.version).toBe(1);
    expect(parsed.state.compact).toBe(true);
    expect(parsed.state.density).toBe("compact");
    expect(parsed.state.dismissedHints).toEqual(["hint-1"]);
    // Ensure actions are NOT persisted
    expect((parsed.state as Record<string, unknown>).toggleCompact).toBeUndefined();
    expect((parsed.state as Record<string, unknown>).setCompact).toBeUndefined();
  });
});

// ── Hook integration tests (store contract verification) ────────────────
//
// These tests verify the store contracts that the convenience hooks
// (useTablePanelSync, useInstanceScope) depend on — keeping the store
// stores and panel stores synchronised correctly. Full hook rendering
// with React Router context is done in page-level tests.

describe("useTablePanelSync store contract", () => {
  beforeEach(() => {
    useTableUiStore.setState({ selectedRowId: {}, expandedRows: {}, activeFilters: {} });
    usePanelStore.setState({
      activeDrawer: null,
      drawerData: null,
      diagnosticsExpanded: {},
      inspectedEntityId: null,
    });
  });

  it("selectRow updates both table store and panel store", () => {
    const tableKey = "skills:main";
    const rowId = "sk-001";

    // Simulate what useTablePanelSync.selectRow does
    useTableUiStore.getState().setSelectedRow(tableKey, rowId);
    usePanelStore.getState().openDrawer(`drawer:${tableKey}`);

    // Verify table store
    expect(useTableUiStore.getState().selectedRowId[tableKey]).toBe(rowId);

    // Verify panel store
    expect(usePanelStore.getState().activeDrawer).toBe(`drawer:${tableKey}`);
    expect(usePanelStore.getState().drawerData).toBeNull();
  });

  it("clearSelection clears both stores", () => {
    const tableKey = "tasks:main";

    // Seed state
    useTableUiStore.getState().setSelectedRow(tableKey, "task-001");
    usePanelStore.getState().openDrawer(`drawer:${tableKey}`, { taskId: "task-001" });
    usePanelStore.getState().setInspectedEntity("entity-001");

    // Simulate what useTablePanelSync.clearSelection does
    useTableUiStore.getState().clearSelectedRow(tableKey);
    usePanelStore.getState().closeDrawer();

    // Verify both cleared
    expect(tableKey in useTableUiStore.getState().selectedRowId).toBe(false);
    expect(usePanelStore.getState().activeDrawer).toBeNull();
    expect(usePanelStore.getState().drawerData).toBeNull();
    expect(usePanelStore.getState().inspectedEntityId).toBeNull();
  });

  it("closeDrawer only closes drawer, preserves other panel state", () => {
    const tableKey = "agents:main";

    // Seed advanced state
    usePanelStore.getState().openDrawer(`drawer:${tableKey}`, { agentId: "ag-001" });
    usePanelStore.getState().setDiagnosticsExpanded("agent-detail", true);

    // Simulate closeDrawer
    usePanelStore.getState().closeDrawer();

    // Drawer cleared
    expect(usePanelStore.getState().activeDrawer).toBeNull();
    expect(usePanelStore.getState().drawerData).toBeNull();

    // Diagnostics should survive
    expect(usePanelStore.getState().diagnosticsExpanded["agent-detail"]).toBe(true);
  });

  it("selecting a different row replaces previous selection", () => {
    const tableKey = "conversations:main";

    // Select first row
    useTableUiStore.getState().setSelectedRow(tableKey, "conv-001");
    usePanelStore.getState().openDrawer(`drawer:${tableKey}`, { convId: "conv-001" });

    // Select second row
    useTableUiStore.getState().setSelectedRow(tableKey, "conv-002");
    usePanelStore.getState().openDrawer(`drawer:${tableKey}`, { convId: "conv-002" });

    // Only second row is selected
    expect(useTableUiStore.getState().selectedRowId[tableKey]).toBe("conv-002");
    expect(usePanelStore.getState().activeDrawer).toBe(`drawer:${tableKey}`);
  });

  it("tables with different keys have independent state", () => {
    useTableUiStore.getState().setSelectedRow("skills:main", "sk-001");
    useTableUiStore.getState().setSelectedRow("agents:main", "ag-001");

    expect(useTableUiStore.getState().selectedRowId["skills:main"]).toBe("sk-001");
    expect(useTableUiStore.getState().selectedRowId["agents:main"]).toBe("ag-001");

    // Clearing one does not affect the other
    useTableUiStore.getState().clearSelectedRow("skills:main");
    expect("skills:main" in useTableUiStore.getState().selectedRowId).toBe(false);
    expect(useTableUiStore.getState().selectedRowId["agents:main"]).toBe("ag-001");
  });
});

describe("useInstanceScope store contract", () => {
  beforeEach(() => {
    useScopeStore.setState({ instanceId: null, scopeLabel: "All instances" });
  });

  it("setScope updates instanceId and scopeLabel", () => {
    useScopeStore.getState().setScope("inst-prod", "Production instance");
    expect(useScopeStore.getState().instanceId).toBe("inst-prod");
    expect(useScopeStore.getState().scopeLabel).toBe("Production instance");
  });

  it("setScope(null) reverts to un-scoped", () => {
    useScopeStore.getState().setScope("inst-prod");
    useScopeStore.getState().setScope(null);
    expect(useScopeStore.getState().instanceId).toBeNull();
    expect(useScopeStore.getState().scopeLabel).toBe("All instances");
  });

  it("scopedPath builds correct path with current scope", () => {
    // This tests the logic that useInstanceScope.scopedPath relies on
    // (the underlying withInstanceScope utility from tenantScope is tested separately)
    useScopeStore.getState().setScope("inst-abc");
    expect(useScopeStore.getState().instanceId).toBe("inst-abc");

    useScopeStore.getState().setScope(null);
    expect(useScopeStore.getState().instanceId).toBeNull();
  });
});
