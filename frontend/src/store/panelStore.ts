/**
 * usePanelStore — shared panel/drawer/diagnostics state.
 *
 * Manages which detail drawer is open, which entity is being inspected,
 * and which diagnostics panels are expanded. This allows a detail drawer
 * opened from a table row to remain open even when the table re-renders
 * or navigates within the same page.
 *
 * **Ownership rules:**
 * - Drawer open/close is cross-component state — belongs in a store.
 * - Diagnostics expanded state per panel ID allows remembering which
 *   diagnostics sections the user has opened during a session.
 * - Inspected entity ID survives page-level re-renders.
 *
 * @module
 */

import { create } from "zustand";

// ── State shape ─────────────────────────────────────────────────────────

export type PanelState = {
  /**
   * The currently open drawer ID, or null if no drawer is open.
   * Typically matches the page or entity type (e.g. `"skill-detail"`,
   * `"execution-detail"`).
   */
  activeDrawer: string | null;

  /**
   * Optional extra data associated with the open drawer.
   * Useful for passing context without prop drilling.
   * Not a cache — never holds server response data.
   */
  drawerData: Record<string, unknown> | null;

  /**
   * Expanded state for diagnostics panels, keyed by panel ID.
   * Tracks which diagnostics sections the user has expanded so the
   * UI can restore them on re-render.
   */
  diagnosticsExpanded: Record<string, boolean>;

  /**
   * The ID of the currently inspected entity (shown in the detail
   * drawer or panel). Null when nothing is being inspected.
   */
  inspectedEntityId: string | null;
};

export type PanelActions = {
  /**
   * Open a drawer with optional context data.
   * @param drawerId - Identifier for the drawer type.
   * @param data - Optional extra context (not server data).
   */
  openDrawer: (drawerId: string, data?: Record<string, unknown> | null) => void;

  /** Close the currently open drawer and clear inspected entity. */
  closeDrawer: () => void;

  /**
   * Set the expanded state of a diagnostics panel.
   * @param panelId - Unique diagnostics panel identifier.
   * @param expanded - Whether the panel should be expanded.
   */
  setDiagnosticsExpanded: (panelId: string, expanded: boolean) => void;

  /** Toggle diagnostics panel expanded state. */
  toggleDiagnosticsExpanded: (panelId: string) => void;

  /**
   * Set the entity currently being inspected.
   * @param entityId - Entity ID to inspect, or null to clear.
   */
  setInspectedEntity: (entityId: string | null) => void;

  /** Reset all panel state to defaults. */
  resetPanels: () => void;
};

export type PanelStore = PanelState & PanelActions;

// ── Default state ───────────────────────────────────────────────────────

const defaultPanelState: PanelState = {
  activeDrawer: null,
  drawerData: null,
  diagnosticsExpanded: {},
  inspectedEntityId: null,
};

// ── Store ───────────────────────────────────────────────────────────────

/**
 * Shared store for panel, drawer, and diagnostics expansion state.
 *
 * @example
 * ```tsx
 * // Open a detail drawer
 * const openDrawer = usePanelStore((s) => s.openDrawer);
 * openDrawer("skill-detail", { skillId: "sk-abc" });
 *
 * // Check if drawer is open
 * const isOpen = usePanelStore((s) => s.activeDrawer === "skill-detail");
 *
 * // Read diagnostics expansion for a panel
 * const expanded = usePanelStore((s) => s.diagnosticsExpanded["execution-payload"] ?? false);
 * ```
 */
export const usePanelStore = create<PanelStore>((set) => ({
  ...defaultPanelState,

  openDrawer: (drawerId: string, data?: Record<string, unknown> | null) =>
    set({
      activeDrawer: drawerId,
      drawerData: data ?? null,
    }),

  closeDrawer: () =>
    set({
      activeDrawer: null,
      drawerData: null,
      inspectedEntityId: null,
    }),

  setDiagnosticsExpanded: (panelId: string, expanded: boolean) =>
    set((state) => ({
      diagnosticsExpanded: {
        ...state.diagnosticsExpanded,
        [panelId]: expanded,
      },
    })),

  toggleDiagnosticsExpanded: (panelId: string) =>
    set((state) => ({
      diagnosticsExpanded: {
        ...state.diagnosticsExpanded,
        [panelId]: !(state.diagnosticsExpanded[panelId] ?? false),
      },
    })),

  setInspectedEntity: (entityId: string | null) =>
    set({ inspectedEntityId: entityId }),

  resetPanels: () => set({ ...defaultPanelState }),
}));
