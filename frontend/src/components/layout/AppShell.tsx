import type { ReactNode } from "react";

import type { AdminSessionUser } from "../../api/admin";
import type { NavigationSection } from "../../app/navigation";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

type AppShellProps = {
  navigationSections: NavigationSection[];
  instanceId: string | null;
  session: AdminSessionUser | null;
  sessionError: string;
  onLogout: () => void;
  children: ReactNode;
};

function AppShellFrame({ navigationSections, instanceId, session, sessionError, onLogout, children }: AppShellProps) {
  const { isExpanded, isHovered } = useSidebar();
  const sidebarOpen = isExpanded || isHovered;

  return (
    <div className={`ff-app${sidebarOpen ? " is-sidebar-open" : " is-sidebar-collapsed"}`}>
      <AppSidebar navigationSections={navigationSections} instanceId={instanceId} />
      <div className="ff-app-content">
        <AppHeader
          navigationSections={navigationSections}
          instanceId={instanceId}
          session={session}
          sessionError={sessionError}
          onLogout={onLogout}
        />
        <main className="ff-main">{children}</main>
      </div>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <SidebarProvider>
      <AppShellFrame {...props} />
    </SidebarProvider>
  );
}
