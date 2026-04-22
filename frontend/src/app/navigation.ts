import type { AdminSessionUser } from "../api/admin";

export const CONTROL_PLANE_ROUTES = {
  login: "/login",
  passwordRotation: "/rotate-password",
  dashboard: "/dashboard",
  onboarding: "/onboarding",
  providers: "/providers",
  providerHealthRuns: "/providers#provider-health-runs",
  accounts: "/accounts",
  apiKeys: "/api-keys",
  approvals: "/approvals",
  execution: "/execution",
  security: "/security",
  logs: "/logs",
  auditHistory: "/logs#audit-history",
  auditExport: "/logs#audit-export",
  usage: "/usage",
  settings: "/settings",
} as const;

export type NavigationLinkItem = {
  label: string;
  to: string;
  description: string;
  badge?: string;
  adminOnly?: boolean;
  disabled?: boolean;
  nonAdminBadge?: string;
};

export type NavigationSection = {
  label: string;
  description: string;
  links: NavigationLinkItem[];
};

const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    label: "Home",
    description: "Start in the command center and fan out by operator intent.",
    links: [
      {
        label: "Command Center",
        to: CONTROL_PLANE_ROUTES.dashboard,
        description: "KPIs, alerts, security posture, and the next route to open.",
      },
    ],
  },
  {
    label: "Setup",
    description: "Bring ForgeGate online and keep provider onboarding grounded in runtime truth.",
    links: [
      {
        label: "Onboarding",
        to: CONTROL_PLANE_ROUTES.onboarding,
        description: "Bootstrap readiness, next steps, and go-live handoff.",
      },
      {
        label: "Providers & Harness",
        to: CONTROL_PLANE_ROUTES.providers,
        description: "Provider onboarding, harness profiles, and expansion targets.",
      },
    ],
  },
  {
    label: "Governance",
    description: "Review runtime access, admin posture, and audit evidence without hiding permission boundaries.",
    links: [
      {
        label: "Accounts",
        to: CONTROL_PLANE_ROUTES.accounts,
        description: "Runtime account inventory and lifecycle posture.",
        nonAdminBadge: "Read only",
      },
      {
        label: "API Keys",
        to: CONTROL_PLANE_ROUTES.apiKeys,
        description: "Runtime key issuance, rotation, and access scope review.",
        nonAdminBadge: "Read only",
      },
      {
        label: "Approvals",
        to: CONTROL_PLANE_ROUTES.approvals,
        description: "Shared queue for execution-run and elevated-access approval review.",
        nonAdminBadge: "Review only",
      },
      {
        label: "Security & Policies",
        to: CONTROL_PLANE_ROUTES.security,
        description: "Elevated-access request/start flow plus admin posture, sessions, and provider secret controls.",
      },
      {
        label: "Audit History",
        to: CONTROL_PLANE_ROUTES.auditHistory,
        description: "Governance evidence on the shared logs surface, with export anchored inside the same evidence workflow.",
      },
      {
        label: "Audit Export",
        to: CONTROL_PLANE_ROUTES.auditExport,
        description: "Generate a synchronous evidence package without collapsing export into plain history review.",
      },
    ],
  },
  {
    label: "Operations",
    description: "Monitor provider health, execution truth, usage, error shape, and current runtime attention signals.",
    links: [
      {
        label: "Execution Review",
        to: CONTROL_PLANE_ROUTES.execution,
        description: "Inspect company-scoped execution runs, approval waits, and replay outcomes on the operator/admin execution surface.",
      },
      {
        label: "Provider Health & Runs",
        to: CONTROL_PLANE_ROUTES.providerHealthRuns,
        description: "Jump directly to the live provider inventory and run posture.",
      },
      {
        label: "Usage & Costs",
        to: CONTROL_PLANE_ROUTES.usage,
        description: "Traffic, cost, provider/client drilldowns, and alert pressure.",
      },
      {
        label: "Errors & Activity",
        to: CONTROL_PLANE_ROUTES.logs,
        description: "Operational alerts, operability checks, and error summaries.",
      },
    ],
  },
  {
    label: "Settings",
    description: "Mutable environment defaults that should stay separate from daily operations.",
    links: [
      {
        label: "System Settings",
        to: CONTROL_PLANE_ROUTES.settings,
        description: "Environment-level configuration and defaults.",
        nonAdminBadge: "Read only",
      },
    ],
  },
];

export function getControlPlaneNavigation(session: AdminSessionUser | null): NavigationSection[] {
  const role = session?.role ?? null;
  const isAdmin = role === "admin";
  const canOpenSecurity = role === "admin" || role === "operator";
  const isViewer = role === "viewer";
  const executionReviewReadOnly = session?.read_only === true && !isViewer;

  return NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    links: section.links.map((link) => ({
      ...link,
      badge:
        link.to === CONTROL_PLANE_ROUTES.approvals && !isAdmin && (role === null || isViewer)
          ? "Operator or admin"
          : link.to === CONTROL_PLANE_ROUTES.execution && (role === null || isViewer)
            ? "Operator or admin"
          : link.to === CONTROL_PLANE_ROUTES.execution && executionReviewReadOnly
            ? "Read only"
          : link.to === CONTROL_PLANE_ROUTES.security
            ? isAdmin
              ? "Admin posture"
              : role === "operator"
                ? "Request only"
                : "Operator or admin"
          : link.adminOnly
            ? link.badge
            : (!isAdmin ? link.nonAdminBadge ?? link.badge : link.badge),
      disabled: Boolean(
        link.disabled
        || (link.adminOnly && !isAdmin)
        || (link.to === CONTROL_PLANE_ROUTES.approvals && (role === null || isViewer))
        || (link.to === CONTROL_PLANE_ROUTES.execution && (role === null || isViewer))
        || (link.to === CONTROL_PLANE_ROUTES.security && !canOpenSecurity),
      ),
    })),
  }));
}

export function isHrefCurrent(pathname: string, hash: string, to: string): boolean {
  const [targetPathWithSearch, rawTargetHash] = to.split("#");
  const [targetPath] = targetPathWithSearch.split("?");
  const targetHash = rawTargetHash ? `#${rawTargetHash}` : "";

  return pathname === targetPath && hash === targetHash;
}
