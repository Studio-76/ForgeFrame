import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const DESKTOP_BREAKPOINT = 1024;
const SIDEBAR_EXPANDED_STORAGE_KEY = "forgeframe.sidebar.expanded";
const SIDEBAR_SECTION_STATE_STORAGE_KEY = "forgeframe.sidebar.sections";

function readStoredSidebarExpanded(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY) === "true";
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

type SidebarContextValue = {
  isExpanded: boolean;
  isMobileOpen: boolean;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  isSectionOpen: (sectionId: string) => boolean;
  toggleSection: (sectionId: string) => void;
  openSection: (sectionId: string) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(readStoredSidebarExpanded);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(readStoredSectionState);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewport = () => {
      const mobile = window.innerWidth < DESKTOP_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileOpen(false);
      }
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, String(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_SECTION_STATE_STORAGE_KEY, JSON.stringify(openSections));
  }, [openSections]);

  const value = useMemo<SidebarContextValue>(() => ({
    isExpanded: isMobile ? false : isExpanded,
    isMobileOpen,
    toggleSidebar: () => setIsExpanded((current) => !current),
    toggleMobileSidebar: () => setIsMobileOpen((current) => !current),
    closeMobileSidebar: () => setIsMobileOpen(false),
    isSectionOpen: (sectionId: string) => openSections[sectionId] === true,
    toggleSection: (sectionId: string) => {
      setOpenSections((current) => ({
        ...current,
        [sectionId]: !current[sectionId],
      }));
    },
    openSection: (sectionId: string) => {
      setOpenSections((current) => {
        if (current[sectionId] === true) {
          return current;
        }
        return {
          ...current,
          [sectionId]: true,
        };
      });
    },
  }), [isExpanded, isMobile, isMobileOpen, openSections]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider.");
  }
  return context;
}
