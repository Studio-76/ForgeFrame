import type { AdminSessionUser } from "../api/admin";
import { withQueryParams } from "./tenantScope";
import { sessionCanMutateScopedOrAnyInstance, sessionHasAnyInstancePermission } from "./adminAccess";

export const CONTROL_PLANE_ROUTES = {
  login: "/login",
  passwordRotation: "/rotate-password",
  dashboard: "/dashboard",
  onboarding: "/dashboard",
  instances: "/instances",
  harness: "/harness",
  providers: "/providers",
  oauthTargets: "/oauth-targets",
  models: "/models",
  providerTargets: "/provider-targets",
  routing: "/routing",
  plugins: "/plugins",
  ingressTls: "/ingress-tls",
  releaseValidation: "/release-validation",
  recovery: "/recovery",
  providerHealthRuns: "/providers#provider-health-runs",
  accounts: "/accounts",
  apiKeys: "/api-keys",
  approvals: "/approvals",
  execution: "/execution",
  queues: "/queues",
  dispatch: "/dispatch",
  conversations: "/conversations",
  inbox: "/inbox",
  tasks: "/tasks",
  reminders: "/reminders",
  automations: "/automations",
  notifications: "/notifications",
  agents: "/agents",
  channels: "/channels",
  contacts: "/contacts",
  knowledgeSources: "/knowledge-sources",
  memory: "/memory",
  learning: "/learning",
  skills: "/skills",
  assistantProfiles: "/assistant-profiles",
  workspaces: "/workspaces",
  artifacts: "/artifacts",
  security: "/security",
  health: "/health-status",
  logs: "/logs",
  errors: "/errors",
  auditHistory: "/logs#audit-history",
  auditExport: "/logs#audit-export",
  usage: "/usage",
  costs: "/costs",
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

export type NavigationSectionId =
  | "command"
  | "setup"
  | "runtime"
  | "governance"
  | "work"
  | "knowledge"
  | "extension"
  | "system";

export type NavigationSectionIcon =
  | "command"
  | "setup"
  | "runtime"
  | "governance"
  | "work"
  | "knowledge"
  | "extension"
  | "system";

export type NavigationSection = {
  id: NavigationSectionId;
  label: string;
  description: string;
  icon: NavigationSectionIcon;
  links: NavigationLinkItem[];
};

const WORKFLOW_ROUTE_SET = new Set<string>([
  CONTROL_PLANE_ROUTES.conversations,
  CONTROL_PLANE_ROUTES.inbox,
  CONTROL_PLANE_ROUTES.tasks,
  CONTROL_PLANE_ROUTES.reminders,
  CONTROL_PLANE_ROUTES.automations,
  CONTROL_PLANE_ROUTES.notifications,
  CONTROL_PLANE_ROUTES.agents,
  CONTROL_PLANE_ROUTES.channels,
  CONTROL_PLANE_ROUTES.contacts,
  CONTROL_PLANE_ROUTES.knowledgeSources,
  CONTROL_PLANE_ROUTES.memory,
  CONTROL_PLANE_ROUTES.learning,
  CONTROL_PLANE_ROUTES.skills,
  CONTROL_PLANE_ROUTES.assistantProfiles,
  CONTROL_PLANE_ROUTES.workspaces,
  CONTROL_PLANE_ROUTES.artifacts,
]);

const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: "command",
    label: "Command",
    description: "Return to the primary command surface before branching into deeper operator flows.",
    icon: "command",
    links: [
      {
        label: "Setup and status",
        to: CONTROL_PLANE_ROUTES.dashboard,
        description: "Guided setup flow with step progression, system status, and next action.",
      },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    description: "Bring ForgeFrame online and keep provider onboarding grounded in runtime truth.",
    icon: "setup",
    links: [
      {
        label: "Setup progress",
        to: "/dashboard",
        description: "Guided setup flow with step progression, blockers, and next action.",
      },
      {
        label: "Instances",
        to: CONTROL_PLANE_ROUTES.instances,
        description: "Top-level instance inventory, scope bindings, and deployment posture.",
      },
      {
        label: "Providers",
        to: CONTROL_PLANE_ROUTES.providers,
        description: "Provider onboarding, runtime proof, compatibility posture, and expansion targets.",
      },
      {
        label: "Harness",
        to: CONTROL_PLANE_ROUTES.harness,
        description: "Saved harness profiles, run history, snapshot posture, and proof inventory on a dedicated surface.",
      },
      {
        label: "OAuth Targets",
        to: CONTROL_PLANE_ROUTES.oauthTargets,
        description: "Account-backed target classification, session truth, bridge posture, and probe operations.",
      },
      {
        label: "Models",
        to: CONTROL_PLANE_ROUTES.models,
        description: "Persistent model register with routing keys, capability profile, and target coverage.",
      },
      {
        label: "Provider Targets",
        to: CONTROL_PLANE_ROUTES.providerTargets,
        description: "Instance-scoped provider targets with enablement, priority, and runtime posture.",
      },
      {
        label: "Routing",
        to: CONTROL_PLANE_ROUTES.routing,
        description: "Policy-driven simple/non-simple routing, budget and circuit posture, simulation, and decision explainability.",
      },
      {
        label: "Ingress / TLS",
        to: CONTROL_PLANE_ROUTES.ingressTls,
        description: "Public listener, root-path, same-origin, port-80 helper, and certificate automation truth.",
      },
      {
        label: "Release / Validation",
        to: CONTROL_PLANE_ROUTES.releaseValidation,
        description: "Cross-check bootstrap, health, provider, and routing gates before calling the current build release-ready.",
      },
    ],
  },
  {
    id: "runtime",
    label: "Runtime",
    description: "Monitor execution truth, health, pressure, and failure shape without leaving the control plane.",
    icon: "runtime",
    links: [
      {
        label: "Execution Review",
        to: CONTROL_PLANE_ROUTES.execution,
        description: "Inspect instance-scoped execution runs, approval waits, and replay outcomes on the operator/admin execution surface.",
      },
      {
        label: "Queues",
        to: CONTROL_PLANE_ROUTES.queues,
        description: "Lane-backed queue lengths, runnable backlog, paused runs, and quarantine posture.",
      },
      {
        label: "Dispatch",
        to: CONTROL_PLANE_ROUTES.dispatch,
        description: "Worker leases, outbox pressure, stalled attempts, and dispatch reconciliation.",
      },
      {
        label: "Recovery / Backup / Restore",
        to: CONTROL_PLANE_ROUTES.recovery,
        description: "Backup target classes, restore evidence, freshness, and source-identity truth.",
      },
      {
        label: "Health",
        to: CONTROL_PLANE_ROUTES.health,
        description: "Runtime readiness, provider health posture, and observability signal-path truth.",
      },
      {
        label: "Logs",
        to: CONTROL_PLANE_ROUTES.logs,
        description: "Shared runtime activity, audit pivots, export status, and operational event review.",
      },
      {
        label: "Errors",
        to: CONTROL_PLANE_ROUTES.errors,
        description: "Alerts, error shape, blocked routing failures, and incident review.",
      },
      {
        label: "Usage",
        to: CONTROL_PLANE_ROUTES.usage,
        description: "Traffic evidence, provider/client drilldowns, and historical usage pressure.",
      },
      {
        label: "Costs",
        to: CONTROL_PLANE_ROUTES.costs,
        description: "Budget posture, blocked cost classes, circuit pressure, and routing cost mix.",
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    description: "Review runtime access, admin posture, and audit evidence without hiding permission boundaries.",
    icon: "governance",
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
    id: "work",
    label: "Work",
    description: "Track ongoing work, inbox pressure, and the artifacts created by real operator activity.",
    icon: "work",
    links: [
      {
        label: "Conversations",
        to: CONTROL_PLANE_ROUTES.conversations,
        description: "Persistent conversations with thread/session history, runtime links, and continuation context.",
      },
      {
        label: "Inbox",
        to: CONTROL_PLANE_ROUTES.inbox,
        description: "Triage queue with status, priority, routing context, and conversation linkage.",
      },
      {
        label: "Tasks",
        to: CONTROL_PLANE_ROUTES.tasks,
        description: "Persistent task and follow-up inventory with links back to conversation, inbox, and workspace truth.",
      },
      {
        label: "Reminders",
        to: CONTROL_PLANE_ROUTES.reminders,
        description: "Due-state reminder inventory with task, notification, and automation linkage.",
      },
      {
        label: "Automations",
        to: CONTROL_PLANE_ROUTES.automations,
        description: "Recurring tasking and notification rules with real trigger history and target linkage.",
      },
      {
        label: "Notifications",
        to: CONTROL_PLANE_ROUTES.notifications,
        description: "Delivery and outbox surface with preview, retry, reject, and fallback truth.",
      },
      {
        label: "Workspaces",
        to: CONTROL_PLANE_ROUTES.workspaces,
        description: "Issue-linked workspaces with preview, review, handoff, and run/approval context.",
      },
      {
        label: "Artifacts",
        to: CONTROL_PLANE_ROUTES.artifacts,
        description: "Cross-surface artifact inventory attached to workspaces, runs, approvals, instances, and decisions.",
      },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    description: "Keep people, memory, learning, and reusable knowledge grounded in real source truth.",
    icon: "knowledge",
    links: [
      {
        label: "Contacts",
        to: CONTROL_PLANE_ROUTES.contacts,
        description: "Persistent contact records linked to conversations, source truth, and memory references.",
      },
      {
        label: "Knowledge Sources",
        to: CONTROL_PLANE_ROUTES.knowledgeSources,
        description: "Connector-backed knowledge and context sources with sync state, visibility, and linkage truth.",
      },
      {
        label: "Memory",
        to: CONTROL_PLANE_ROUTES.memory,
        description: "Correctable and deletable context records with scope, sensitivity, and work-interaction links.",
      },
      {
        label: "Learning",
        to: CONTROL_PLANE_ROUTES.learning,
        description: "Learning-event review, promotion decisions, and explainability for memory and skill promotion.",
      },
      {
        label: "Skills",
        to: CONTROL_PLANE_ROUTES.skills,
        description: "Versioned skill registry with activation state, provenance, scope, and usage telemetry.",
      },
    ],
  },
  {
    id: "extension",
    label: "Extension",
    description: "Manage plugin and agent extension surfaces without burying their operational state.",
    icon: "extension",
    links: [
      {
        label: "Plugins",
        to: CONTROL_PLANE_ROUTES.plugins,
        description: "Persistent plugin registry with instance-scoped activation, extension slots, config contracts, and security posture.",
      },
      {
        label: "Agents",
        to: CONTROL_PLANE_ROUTES.agents,
        description: "Instance-scoped agent registry with the required Operator, participation posture, and assistant-profile linkage.",
      },
      {
        label: "Channels",
        to: CONTROL_PLANE_ROUTES.channels,
        description: "Delivery channel inventory with fallback posture and recent notification linkage.",
      },
      {
        label: "Assistant Profiles",
        to: CONTROL_PLANE_ROUTES.assistantProfiles,
        description: "Personal-assistant profiles with quiet hours, delivery rules, and direct-action governance.",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    description: "Mutable environment defaults that should stay separate from daily operations.",
    icon: "system",
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
  const canReviewApprovals = sessionHasAnyInstancePermission(session, "approvals.read");
  const canDecideApprovals = sessionCanMutateScopedOrAnyInstance(session, null, "approvals.decide");
  const canReadExecution = sessionHasAnyInstancePermission(session, "execution.read");
  const canOperateExecution = sessionCanMutateScopedOrAnyInstance(session, null, "execution.operate");
  const canOpenSecurity = sessionHasAnyInstancePermission(session, "security.read")
    || sessionHasAnyInstancePermission(session, "security.write");
  const canManageSecurity = sessionCanMutateScopedOrAnyInstance(session, null, "security.write");
  const canOpenWorkInteraction = canReviewApprovals || canReadExecution;
  const canManageWorkInteraction = session?.read_only !== true && (session?.role === "admin" || session?.role === "owner");
  const executionReviewReadOnly = canReadExecution && !canOperateExecution;

  return NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    links: section.links.map((link) => ({
      ...link,
      badge:
        link.to === CONTROL_PLANE_ROUTES.approvals && !canReviewApprovals
          ? "Operator or admin"
          : link.to === CONTROL_PLANE_ROUTES.execution && !canReadExecution
            ? "Operator or admin"
          : link.to === CONTROL_PLANE_ROUTES.execution && executionReviewReadOnly
            ? "Read only"
          : link.to === CONTROL_PLANE_ROUTES.security
            ? canManageSecurity
              ? "Admin posture"
              : canOpenSecurity
                ? "Request only"
                : "Operator or admin"
          : WORKFLOW_ROUTE_SET.has(link.to)
            ? !canOpenWorkInteraction
              ? "Operator or admin"
              : !canManageWorkInteraction
                ? "Read only"
                : undefined
          : link.adminOnly
            ? link.badge
            : (!canDecideApprovals ? link.nonAdminBadge ?? link.badge : link.badge),
      disabled: Boolean(
        link.disabled
        || (link.adminOnly && !canDecideApprovals)
        || (link.to === CONTROL_PLANE_ROUTES.approvals && !canReviewApprovals)
        || (link.to === CONTROL_PLANE_ROUTES.execution && !canReadExecution)
        || (link.to === CONTROL_PLANE_ROUTES.security && !canOpenSecurity)
        || (WORKFLOW_ROUTE_SET.has(link.to) && !canOpenWorkInteraction)
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

export function findNavigationMatch(
  sections: NavigationSection[],
  pathname: string,
  hash: string,
  instanceId: string | null,
) {
  for (const section of sections) {
    for (const link of section.links) {
      const scopedTo = withQueryParams(link.to, { instanceId });
      if (isHrefCurrent(pathname, hash, scopedTo)) {
        return { section, link, to: scopedTo };
      }
    }
  }

  return null;
}
