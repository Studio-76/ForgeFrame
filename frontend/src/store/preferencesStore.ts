/**
 * usePreferencesStore — persisted user interface preferences.
 *
 * Stores user-configurable UI preferences such as compact mode, density,
 * and dismissed hints. Uses Zustand's `persist` middleware for
 * localStorage persistence with schema versioning.
 *
 * **Ownership rules:**
 * - Only safe, non-sensitive UI preferences are persisted.
 * - No server data, tokens, raw payloads, or backend-derived data.
 * - Persisted state is versioned to handle schema migrations.
 *
 * @module
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── State shape ─────────────────────────────────────────────────────────

export type PreferencesState = {
  /** Compact mode reduces padding and spacing across the UI. */
  compact: boolean;

  /** Display density for tables and lists. */
  density: "default" | "compact";

  /** Set of dismissed hint IDs (e.g. onboarding tooltips). */
  dismissedHints: string[];
};

export type PreferencesActions = {
  /** Toggle compact mode on/off. */
  toggleCompact: () => void;

  /** Set compact mode explicitly. */
  setCompact: (compact: boolean) => void;

  /** Set display density explicitly. */
  setDensity: (density: "default" | "compact") => void;

  /** Mark a hint as dismissed (no-op if already dismissed). */
  dismissHint: (hintId: string) => void;

  /** Reset all dismissed hints. */
  resetDismissedHints: () => void;
};

export type PreferencesStore = PreferencesState & PreferencesActions;

// ── Default state ───────────────────────────────────────────────────────

const defaultState: PreferencesState = {
  compact: false,
  density: "default",
  dismissedHints: [],
};

// ── Persistence key ─────────────────────────────────────────────────────

const STORAGE_KEY = "forgeframe.ui.preferences";
const CURRENT_VERSION = 1;

// ── Store ───────────────────────────────────────────────────────────────

/**
 * Persisted store for user UI preferences.
 *
 * Automatically persists to localStorage under the key
 * `"forgeframe.ui.preferences"`. Schema versioning is used to handle
 * future migrations.
 *
 * @example
 * ```tsx
 * const compact = usePreferencesStore((s) => s.compact);
 * const toggleCompact = usePreferencesStore((s) => s.toggleCompact);
 * const dismissHint = usePreferencesStore((s) => s.dismissHint);
 * dismissHint("skills-create-tip");
 * ```
 */
export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...defaultState,

      toggleCompact: () =>
        set((s: PreferencesStore) => ({
          compact: !s.compact,
          density: (s.compact ? "default" : "compact") as "default" | "compact",
        })),

      setCompact: (compact: boolean) =>
        set((s: PreferencesStore) => ({
          compact,
          density: compact ? "compact" : "default" as const,
        })),

      setDensity: (density: "default" | "compact") =>
        set((s: PreferencesStore) => ({
          density,
          compact: density === "compact",
        })),

      dismissHint: (hintId: string) =>
        set((s: PreferencesStore) => {
          if (s.dismissedHints.includes(hintId)) {
            return s;
          }
          return { dismissedHints: [...s.dismissedHints, hintId] };
        }),

      resetDismissedHints: () =>
        set({ dismissedHints: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: CURRENT_VERSION,
      partialize: (s: PreferencesStore) => ({
        compact: s.compact,
        density: s.density,
        dismissedHints: s.dismissedHints,
      }),
      merge: (persisted: unknown, current: PreferencesStore) => {
        const stored = persisted as Partial<PreferencesStore>;
        return {
          ...current,
          ...stored,
          dismissedHints: Array.isArray(stored.dismissedHints)
            ? stored.dismissedHints
            : current.dismissedHints,
        };
      },
    },
  ),
);
