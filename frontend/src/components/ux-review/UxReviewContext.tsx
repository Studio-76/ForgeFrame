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
 * Annotations are persisted to localStorage under the key
 * `forgeframe-ux-review-annotations` so that unfinished review sessions
 * survive page navigation and tab closure.
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
  AnnotationUpdate,
  CapturedElement,
  UxAnnotation,
  UxAnnotationSeverity,
  UxIssueType,
  UxReviewContextValue,
} from "./types";
import { UxReviewOverlay } from "./UxReviewOverlay";
import { UxReviewPanel } from "./UxReviewPanel";
import { formatAnnotationsJson, formatAnnotationsMarkdown } from "./export-utils";

/**
 * localStorage key used to persist annotations across sessions.
 */
const LOCAL_STORAGE_KEY = "forgeframe-ux-review-annotations";

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
  pageAnnotations: [],
  annotationCount: 0,
  pageAnnotationCount: 0,
  selectElement: () => { /* noop */ },
  setHoveredElement: () => { /* noop */ },
  addAnnotation: () => { /* noop */ },
  removeAnnotation: () => { /* noop */ },
  updateAnnotation: () => { /* noop */ },
  clearSelection: () => { /* noop */ },
  clearAnnotations: () => { /* noop */ },
  exportAnnotations: () => "[]",
  exportJson: () => "[]",
  exportMarkdown: () => "",
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

// ── localStorage helpers ────────────────────────────────

/**
 * Reads persisted annotations from localStorage.
 * @returns The deserialized annotation array, or empty array on failure.
 */
/**
 * Minimal runtime shape validator for persisted annotations.
 * Ensures each item has the required fields before returning.
 */
function isValidAnnotation(item: unknown): item is UxAnnotation {
  if (!item || typeof item !== "object") return false;
  const a = item as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.createdAt === "string" &&
    a.element !== null &&
    typeof a.element === "object" &&
    typeof (a.element as Record<string, unknown>).elementData === "object" &&
    typeof (a.element as Record<string, unknown>).domSelector === "string"
  );
}

function loadPersistedAnnotations(): UxAnnotation[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isValidAnnotation);
    if (valid.length !== parsed.length) {
      console.warn("[UX Review] Discarded", parsed.length - valid.length, "invalid annotation(s) from localStorage");
    }
    return valid;
  } catch {
    // Corrupted data — silently discard
    return [];
  }
}

/**
 * Writes annotations to localStorage.
 * @param annotations - The annotation array to persist.
 */
function persistAnnotations(annotations: UxAnnotation[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(annotations));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Helper to generate a unique annotation ID.
 */
function generateAnnotationId(): string {
  return `ux-ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
 * - Stores session annotations in local state with localStorage persistence
 * - Provides annotation CRUD (create, read, update, delete)
 * - Supports resolve / clear-session workflows
 * - Provides export functions (JSON and Markdown, per-page or all)
 * - Supports Ctrl+Shift+U keyboard shortcut
 */
export function UxReviewProvider({ children }: { readonly children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(() => isUxReviewActive());
  const [selectedElement, setSelectedElement] = useState<CapturedElement | null>(null);
  const [hoveredElement, setHoveredElement] = useState<CapturedElement | null>(null);
  const [annotations, setAnnotations] = useState<UxAnnotation[]>(() => {
    // Restore persisted annotations on first mount
    if (UX_REVIEW_AVAILABLE) {
      return loadPersistedAnnotations();
    }
    return [];
  });

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

  /* Persist annotations to localStorage whenever they change (in review mode) */
  useEffect(() => {
    if (UX_REVIEW_AVAILABLE) {
      persistAnnotations(annotations);
    }
  }, [annotations]);

  // ── Derived data ──────────────────────────────────────────────

  const pageAnnotations = useMemo<UxAnnotation[]>(
    () => annotations.filter((a) => a.route === window.location.pathname),
    [annotations],
  );

  // ── Actions ────────────────────────────────────────────────────

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
        id: generateAnnotationId(),
        element: selectedElement,
        issueType,
        severity,
        comment,
        expectedChange,
        screenshotNote,
        createdAt: new Date().toISOString(),
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

  const updateAnnotation = useCallback((id: string, updates: AnnotationUpdate) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedElement(null);
  }, []);

  const clearAnnotations = useCallback((route?: string) => {
    if (route) {
      setAnnotations((prev) => prev.filter((a) => a.route !== route));
    } else {
      setAnnotations([]);
    }
  }, []);

  // ── Export functions ──────────────────────────────────────────
  //
  // These are plain function declarations (not useCallback'd) that read
  // window.location.pathname / document.title at call time to avoid stale
  // closures. They capture `annotations` from the render closure, which is
  // always current when called via the context value.

  function exportAnnotationsFn(): string {
    return formatAnnotationsJson(annotations, "(all pages)", document.title);
  }

  function exportJsonFn(route?: string): string {
    const source = route
      ? annotations.filter((a) => a.route === route)
      : annotations;
    return formatAnnotationsJson(source, route ?? "", document.title);
  }

  function exportMarkdownFn(route?: string): string {
    const source = route
      ? annotations.filter((a) => a.route === route)
      : annotations;
    return formatAnnotationsMarkdown(source, route ?? "", document.title);
  }

  // ── Context value ─────────────────────────────────────────────

  const contextValue = useMemo<UxReviewContextValue>(
    () => ({
      isEnabled: enabled,
      selectedElement,
      hoveredElement,
      annotations,
      pageAnnotations,
      annotationCount: annotations.length,
      pageAnnotationCount: pageAnnotations.length,
      selectElement,
      setHoveredElement: setHovered,
      addAnnotation,
      removeAnnotation,
      updateAnnotation,
      clearSelection,
      clearAnnotations,
      exportAnnotations: exportAnnotationsFn,
      exportJson: exportJsonFn,
      exportMarkdown: exportMarkdownFn,
    }),
    [
      enabled,
      selectedElement,
      hoveredElement,
      annotations,
      pageAnnotations,
      selectElement,
      setHovered,
      addAnnotation,
      removeAnnotation,
      updateAnnotation,
      clearSelection,
      clearAnnotations,
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
