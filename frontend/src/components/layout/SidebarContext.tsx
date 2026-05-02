import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const MOBILE_BREAKPOINT = 640;
const DESKTOP_BREAKPOINT = 1024;
const SIDEBAR_EXPANDED_STORAGE_KEY = "forgeframe.sidebar.expanded";
const SIDEBAR_SECTION_STATE_STORAGE_KEY = "forgeframe.sidebar.sections";

/** Viewport size tier for responsive layout switching. */
export type ViewportTier = "mobile" | "tablet" | "desktop";

/**
 * Read sidebar expanded preference from localStorage.
 * Defaults to expanded (true) so the sidebar is functional on first visit.
 * @returns Whether the sidebar should start in expanded mode.
 */
function readStoredSidebarExpanded(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const storedValue = window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY);
  if (storedValue === null) {
    return true;
  }
  return storedValue === "true";
}

function readStoredSectionState(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  const rawValue = window.localStorage.getItem(SIDEBAR_SECTION_STATE_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsedValue).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}

/**
 * Derive the viewport tier from current window width.
 * @param width - Current window inner width.
 * @returns The matching viewport tier.
 */
function getViewportTier(width: number): ViewportTier {
  if (width < MOBILE_BREAKPOINT) return "mobile";
  if (width < DESKTOP_BREAKPOINT) return "tablet";
  return "desktop";
}

/**
 * Read initial viewport tier for the first render.
 * @returns Initial tier derived from window width when available.
 */
function getInitialViewportTier(): ViewportTier {
  if (typeof window === "undefined") {
    return "desktop";
  }
  return getViewportTier(window.innerWidth);
}

export type SidebarContextValue = {
  /** Whether the sidebar is in expanded (full) mode on tablet/desktop. */
  isExpanded: boolean;
  /** Whether the mobile sidebar overlay is open. */
  isMobileOpen: boolean;
  /** Current viewport tier. */
  viewport: ViewportTier;
  /** True when viewport is mobile (< 640px). */
  isMobile: boolean;
  /** True when viewport is tablet (640–1023px). */
  isTablet: boolean;
  /** True when viewport is desktop (>= 1024px). */
  isDesktop: boolean;
  /** Toggle sidebar expanded/collapsed state. */
  toggleSidebar: () => void;
  /** Toggle mobile sidebar overlay state. */
  toggleMobileSidebar: () => void;
  /** Close the mobile sidebar overlay. */
  closeMobileSidebar: () => void;
  /** Directly set sidebar expanded state (e.g. for X button, or programmatic collapse). */
  setSidebarExpanded: (expanded: boolean) => void;
  /** Check if a section is currently expanded. */
  isSectionOpen: (sectionId: string) => boolean;
  /** Toggle a section's expanded state. */
  toggleSection: (sectionId: string) => void;
  /** Ensure a section is open (no-op if already open). */
  openSection: (sectionId: string) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [storedExpanded, setStoredExpanded] = useState(readStoredSidebarExpanded);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(readStoredSectionState);
  const [viewportTier, setViewportTier] = useState<ViewportTier>(getInitialViewportTier);

  /* Track viewport changes for responsive breakpoints. */
  useEffect(() => {
    let frameRequestId = 0;

    const updateViewport = () => {
      if (frameRequestId !== 0) {
        window.cancelAnimationFrame(frameRequestId);
      }

      frameRequestId = window.requestAnimationFrame(() => {
        frameRequestId = 0;
        const tier = getViewportTier(window.innerWidth);
        setViewportTier(tier);
        if (tier !== "mobile") {
          setIsMobileOpen(false);
        }
      });
    };

    const syncViewportImmediately = () => {
      const tier = getViewportTier(window.innerWidth);
      setViewportTier(tier);
      if (tier !== "mobile") {
        setIsMobileOpen(false);
      }
    };

    syncViewportImmediately();
    window.addEventListener("resize", updateViewport);
    return () => {
      if (frameRequestId !== 0) {
        window.cancelAnimationFrame(frameRequestId);
      }
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  /* Persist sidebar expanded state to localStorage. */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, String(storedExpanded));
  }, [storedExpanded]);

  /* Persist open sections to localStorage. */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_SECTION_STATE_STORAGE_KEY, JSON.stringify(openSections));
  }, [openSections]);

  const isMobile = viewportTier === "mobile";
  const isTablet = viewportTier === "tablet";
  const isDesktop = viewportTier === "desktop";

  /* Force sidebar collapsed on mobile; use stored state on tablet/desktop. */
  const effectiveExpanded = isMobile ? false : storedExpanded;

  const toggleSidebar = useCallback(() => {
    setStoredExpanded((current) => !current);
  }, []);

  const setSidebarExpanded = useCallback((expanded: boolean) => {
    setStoredExpanded(expanded);
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileOpen((current) => !current);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const isSectionOpen = useCallback(
    (sectionId: string) => openSections[sectionId] === true,
    [openSections],
  );

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }, []);

  const openSection = useCallback((sectionId: string) => {
    setOpenSections((current) => {
      if (current[sectionId] === true) {
        return current;
      }
      return {
        ...current,
        [sectionId]: true,
      };
    });
  }, []);

  const value = useMemo<SidebarContextValue>(() => ({
    isExpanded: effectiveExpanded,
    isMobileOpen,
    viewport: viewportTier,
    isMobile,
    isTablet,
    isDesktop,
    toggleSidebar,
    setSidebarExpanded,
    toggleMobileSidebar,
    closeMobileSidebar,
    isSectionOpen,
    toggleSection,
    openSection,
  }), [
    effectiveExpanded,
    isMobileOpen,
    viewportTier,
    isMobile,
    isTablet,
    isDesktop,
    toggleSidebar,
    setSidebarExpanded,
    toggleMobileSidebar,
    closeMobileSidebar,
    isSectionOpen,
    toggleSection,
    openSection,
  ]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider.");
  }
  return context;
}
