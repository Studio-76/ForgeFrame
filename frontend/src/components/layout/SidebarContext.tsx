import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type SidebarContextValue = {
  isExpanded: boolean;
  isHovered: boolean;
  isMobileOpen: boolean;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  setIsHovered: (value: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewport = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileOpen(false);
      }
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const value = useMemo<SidebarContextValue>(() => ({
    isExpanded: isMobile ? false : isExpanded,
    isHovered,
    isMobileOpen,
    toggleSidebar: () => setIsExpanded((current) => !current),
    toggleMobileSidebar: () => setIsMobileOpen((current) => !current),
    closeMobileSidebar: () => setIsMobileOpen(false),
    setIsHovered,
  }), [isExpanded, isHovered, isMobile, isMobileOpen]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider.");
  }
  return context;
}
