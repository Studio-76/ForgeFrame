/**
 * ForgeFrame Zustand stores — shared UI/application state.
 *
 * ## State ownership rules
 *
 * - **Local component state** stays local when used by only one component.
 * - **URL state** belongs in the router/search params when shareable/bookmarkable.
 * - **Server state** stays in TanStack React Query (fetching, caching, invalidation).
 * - **Cross-page or cross-component UI state** goes into Zustand stores below.
 * - **Derived data** is computed with selectors or memoization, not synchronized
 *   with useEffect unless unavoidable.
 *
 * ## Stores
 *
 * | Store | Purpose | Persisted |
 * |-------|---------|-----------|
 * | {@link useScopeStore} | Selected instance scope | No |
 * | {@link useNavigationStore} | Command palette, active page group | No |
 * | {@link useTableUiStore} | Selected rows, expanded rows, filters | No |
 * | {@link usePanelStore} | Drawer state, diagnostics expansion | No |
 * | {@link usePreferencesStore} | Compact mode, density, dismissed hints | Yes (localStorage) |
 *
 * @module
 */

export { useScopeStore } from "./scopeStore";
export type { ScopeState, ScopeActions, ScopeStore } from "./scopeStore";

export { useNavigationStore } from "./navigationStore";
export type { NavigationState, NavigationActions, NavigationStore } from "./navigationStore";

export { useTableUiStore } from "./tableUiStore";
export type { TableUiState, TableUiActions, TableUiStore } from "./tableUiStore";

export { usePanelStore } from "./panelStore";
export type { PanelState, PanelActions, PanelStore } from "./panelStore";

export { usePreferencesStore } from "./preferencesStore";
export type { PreferencesState, PreferencesActions, PreferencesStore } from "./preferencesStore";
