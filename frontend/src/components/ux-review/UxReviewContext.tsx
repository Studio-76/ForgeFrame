/**
 * Context and provider for the UX Review Mode overlay system.
 *
 * UX Review Mode is a dev-only inspection and annotation tool for
 * reviewers. It is gated behind a triple-gate activation:
 *   1. `import.meta.env.DEV` — compile-time dev build
 *   2. `import.meta.env.VITE_ENABLE_UX_REVIEW === "true"` — explicit opt-in
 *   3. `?uxReview=1` query parameter or Ctrl+Shift+U keyboard shortcut
 *
 * In production builds, `UX_REVIEW_AVAILABLE` is `false` and the overlay
 * and panel are never rendered. The provider passes children through
 * with no runtime overhead.
 *
 * **Production bundle note:** The overlay and panel modules are statically
 * imported, but their `createElement` calls are guarded by the compile-time
 * constant `UX_REVIEW_AVAILABLE`. Vite's minifier eliminates these branches
 * when `import.meta.env.DEV` is `false`. The CSS (~30 bytes) is the only
 * dead code that reaches production, and its selectors never match without
 * the `.ux-review-*` classes.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CapturedElement,
  UxAnnotation,
  UxAnnotationSeverity,
  UxIssueType,
  UxReviewContextValue,
} from "./types";
import { UxReviewOverlay } from "./UxReviewOverlay";
import { UxReviewPanel } from "./UxReviewPanel";

/**
 * Whether UX Review Mode is available in this build environment.
 * This is a static constant — in production builds Vite's tree-shaker
 * eliminates all code conditioned on this being `true`.
 */
const UX_REVIEW_AVAILABLE: boolean =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_UX_REVIEW === "true";

/** Default context value when UX Review is unavailable or no provider is found. */
const NULL_CONTEXT: UxReviewContextValue = {
  isEnabled: false,
  selectedElement: null,
  hoveredElement: null,
  annotations: [],
  selectElement: () => { /* noop */ },
  setHoveredElement: () => { /* noop */ },
  addAnnotation: (
    _issueType: UxIssueType,
    _severity: UxAnnotationSeverity,
    _comment: string,
    _expectedChange?: string,
    _screenshotNote?: string,
  ) => { /* noop */ },
  removeAnnotation: () => { /* noop */ },
  clearSelection: () => { /* noop */ },
  exportAnnotations: () => "[]",
  annotationCount: 0,
};

/**
 * Context for UX Review Mode. The default value is `null` so that
 * `useUxReview()` can provide a real runtime guard against missing provider.
 */
export const UxReviewContext = createContext<UxReviewContextValue | null>(null);

// ── Activation logic ────────────────────────────────────

/**
 * Checks whether the user has activated UX Review Mode.
 * Called once on mount and again when the keyboard shortcut fires.
 * @returns true if review mode is active.
 */
function isUxReviewActive(): boolean {
  if (!UX_REVIEW_AVAILABLE) return false;
  return new URLSearchParams(window.location.search).has("uxReview");
}

/**
 * Checks for the Ctrl+Shift+U keyboard shortcut to toggle UX Review Mode.
 * @param event - The keyboard event.
 * @returns true if the shortcut was pressed.
 */
function isToggleShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    event.code === "KeyU"
  );
}

// ── Provider ────────────────────────────────────────────

/**
 * Provides UX Review Mode state to the entire application tree.
 *
 * When UX Review Mode is not available or not activated, this provider
 * renders children directly with no overhead.
 *
 * When activated, it:
 * - Tracks the currently hovered and selected DOM elements (with data-ux-* attributes)
 * - Stores session annotations in local state
 * - Provides export and clear controls
 * - Supports Ctrl+Shift+U keyboard shortcut
 */
export function UxReviewProvider({ children }: { readonly children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(() => isUxReviewActive());
  const [selectedElement, setSelectedElement] = useState<CapturedElement | null>(null);
  const [hoveredElement, setHoveredElement] = useState<CapturedElement | null>(null);
  const [annotations, setAnnotations] = useState<UxAnnotation[]>([]);
  /** Ref used to track if annotations have been initialised for this session. */
  const hasShownBanner = useRef(false);

  /* Keyboard shortcut: Ctrl+Shift+U to toggle UX Review Mode */
  useEffect(() => {
    if (!UX_REVIEW_AVAILABLE) return;
    const handler = (event: KeyboardEvent) => {
      if (isToggleShortcut(event)) {
        event.preventDefault();
        setEnabled((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Banner on first activation */
  useEffect(() => {
    if (enabled && !hasShownBanner.current) {
      hasShownBanner.current = true;
      console.info(
        "[UX Review] Mode activated. Hover elements with data-ux-* attributes to inspect. " +
        "Click to annotate. Ctrl+Shift+U to toggle.",
      );
    }
  }, [enabled]);

  const selectElement = useCallback((element: CapturedElement | null) => {
    setSelectedElement(element);
  }, []);

  const setHovered = useCallback((element: CapturedElement | null) => {
    setHoveredElement(element);
  }, []);

  const addAnnotation = useCallback(
    (
      issueType: UxIssueType,
      severity: UxAnnotationSeverity,
      comment: string,
      expectedChange?: string,
      screenshotNote?: string,
    ) => {
      if (!selectedElement) return;
      const annotation: UxAnnotation = {
        id: `ux-ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        element: selectedElement,
        issueType,
        severity,
        comment,
        expectedChange,
        screenshotNote,
        timestamp: new Date().toISOString(),
        viewportSize: { width: window.innerWidth, height: window.innerHeight },
        route: window.location.pathname,
        pageTitle: document.title,
      };
      setAnnotations((prev) => [...prev, annotation]);
    },
    [selectedElement],
  );

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedElement(null);
  }, []);

  const exportAnnotations = useCallback((): string => {
    return JSON.stringify(annotations, null, 2);
  }, [annotations]);

  const contextValue = useMemo<UxReviewContextValue>(
    () => ({
      isEnabled: enabled,
      selectedElement,
      hoveredElement,
      annotations,
      annotationCount: annotations.length,
      selectElement,
      setHoveredElement: setHovered,
      addAnnotation,
      removeAnnotation,
      clearSelection,
      exportAnnotations,
    }),
    [
      enabled,
      selectedElement,
      hoveredElement,
      annotations,
      selectElement,
      setHovered,
      addAnnotation,
      removeAnnotation,
      clearSelection,
      exportAnnotations,
    ],
  );

  return (
    <UxReviewContext.Provider value={contextValue}>
      {children}
      {UX_REVIEW_AVAILABLE && (
        <UxReviewOverlay
          isEnabled={enabled}
          hoveredElement={hoveredElement}
          setHoveredElement={setHovered}
          selectElement={selectElement}
          clearSelection={clearSelection}
        />
      )}
      {UX_REVIEW_AVAILABLE && <UxReviewPanel context={contextValue} />}
    </UxReviewContext.Provider>
  );
}
