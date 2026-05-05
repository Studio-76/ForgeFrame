/**
 * useNavigationStore — shared navigation UI state.
 *
 * Manages the command palette open/close state and which related-page
 * navigation group is currently active. Sidebar collapsed/expanded state
 * remains in the existing `SidebarContext` (which has localStorage
 * persistence and viewport-responsive behaviour).
 *
 * **Ownership rules:**
 * - Command palette open state is global and rare — belongs in a store.
 * - Active "related page" group is transient as the user browses — belongs
 *   in a store rather than being drilled as props.
 *
 * @module
 */

import { create } from "zustand";

// ── State shape ─────────────────────────────────────────────────────────

export type NavigationState = {
  /** Whether the command palette overlay is open. */
  commandPaletteOpen: boolean;

  /**
   * The ID of the currently active related-page navigation group.
   * Used to highlight which section of related pages the user is in
   * (e.g. "providers", "execution", "health"). Null when no group is
   * considered active.
   */
  activeRelatedPageGroup: string | null;
};

export type NavigationActions = {
  /** Open or close the command palette. */
  setCommandPaletteOpen: (open: boolean) => void;

  /** Toggle the command palette open/closed. */
  toggleCommandPalette: () => void;

  /**
   * Set the currently active related-page group.
   * Pass `null` to clear.
   */
  setActiveRelatedPageGroup: (groupId: string | null) => void;

  /** Reset all navigation state to defaults. */
  resetNavigation: () => void;
};

export type NavigationStore = NavigationState & NavigationActions;

// ── Default state ───────────────────────────────────────────────────────

const defaultNavigationState: NavigationState = {
  commandPaletteOpen: false,
  activeRelatedPageGroup: null,
};

// ── Store ───────────────────────────────────────────────────────────────

/**
 * Shared store for navigation-related UI state.
 *
 * @example
 * ```tsx
 * const open = useNavigationStore((s) => s.commandPaletteOpen);
 * const toggle = useNavigationStore((s) => s.toggleCommandPalette);
 *
 * return <CommandPalette open={open} onClose={() => setCommandPaletteOpen(false)} />;
 * ```
 */
export const useNavigationStore = create<NavigationStore>((set) => ({
  ...defaultNavigationState,

  setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),

  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  setActiveRelatedPageGroup: (groupId: string | null) =>
    set({ activeRelatedPageGroup: groupId }),

  resetNavigation: () => set({ ...defaultNavigationState }),
}));
