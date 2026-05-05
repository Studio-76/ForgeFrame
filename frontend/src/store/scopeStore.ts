/**
 * useScopeStore — shared instance/scope selection state.
 *
 * Stores the currently selected instance ID and a human-readable scope
 * label. The initial value is typically read from URL search params by
 * the caller and seeded via `setScope`.
 *
 * **Ownership rules:**
 * - The scope store owns the "which instance am I looking at" question.
 * - The URL still provides the initial value and supports bookmarking.
 * - Pages read `instanceId` from this store instead of parsing URL params.
 * - Scope changes update both the store and the URL.
 *
 * @module
 */

import { create } from "zustand";

// ── State shape ─────────────────────────────────────────────────────────

export type ScopeState = {
  /** The currently selected instance ID, or null for un-scoped. */
  instanceId: string | null;

  /** Human-readable label for the current scope (e.g. "prod-instance"). */
  scopeLabel: string;
};

export type ScopeActions = {
  /**
   * Set the current scope.
   * @param instanceId - The new instance ID, or null to clear scope.
   * @param label - Optional human-readable label. Defaults to the instanceId.
   */
  setScope: (instanceId: string | null, label?: string) => void;

  /** Clear the current scope back to un-scoped. */
  clearScope: () => void;
};

export type ScopeStore = ScopeState & ScopeActions;

// ── Default state ───────────────────────────────────────────────────────

const DEFAULT_SCOPE_LABEL = "All instances";

const defaultScopeState: ScopeState = {
  instanceId: null,
  scopeLabel: DEFAULT_SCOPE_LABEL,
};

// ── Store ───────────────────────────────────────────────────────────────

/**
 * Shared store for the currently selected instance scope.
 *
 * @example
 * ```tsx
 * // Read scope
 * const instanceId = useScopeStore((s) => s.instanceId);
 *
 * // Set scope
 * const setScope = useScopeStore((s) => s.setScope);
 * setScope("inst-abc123");
 *
 * // Reactively get scope label
 * const label = useScopeStore((s) => s.scopeLabel);
 * ```
 */
export const useScopeStore = create<ScopeStore>((set) => ({
  ...defaultScopeState,

  setScope: (instanceId: string | null, label?: string) =>
    set({
      instanceId,
      scopeLabel: label ?? instanceId ?? DEFAULT_SCOPE_LABEL,
    }),

  clearScope: () => set({ ...defaultScopeState }),
}));
