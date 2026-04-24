import type { AdminSessionUser } from "../api/admin";
import { sessionCanMutateScopedOrAnyInstance, sessionHasAnyInstancePermission } from "./adminAccess";

export const CONTROL_PLANE_ROUTES = {
  login: "/login",
  passwordRotation: "/rotate-password",
  dashboard: "/dashboard",
  onboarding: "/onboarding",
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
    description: "Bring ForgeFrame online and keep provider onboarding grounded in runtime truth.",
    links: [
      {
        label: "Bootstrap / Readiness",
        to: CONTROL_PLANE_ROUTES.onboarding,
        description: "Bootstrap readiness, next steps, and go-live handoff.",
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
        label: "Plugins",
        to: CONTROL_PLANE_ROUTES.plugins,
        description: "Persistent plugin registry with instance-scoped activation, extension slots, config contracts, and security posture.",
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
        label: "Provider Health & Runs",
        to: CONTROL_PLANE_ROUTES.providerHealthRuns,
        description: "Jump directly to the live provider inventory and run posture.",
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
        label: "Usage",
        to: CONTROL_PLANE_ROUTES.usage,
        description: "Traffic evidence, provider/client drilldowns, and historical usage pressure.",
      },
      {
        label: "Costs",
        to: CONTROL_PLANE_ROUTES.costs,
        description: "Budget posture, blocked cost classes, circuit pressure, and routing cost mix.",
      },
      {
        label: "Errors",
        to: CONTROL_PLANE_ROUTES.errors,
        description: "Alerts, error shape, blocked routing failures, and incident review.",
      },
    ],
  },
  {
    label: "Work Interaction",
    description: "Track inbound work, conversation history, triage posture, issue-linked workspaces, and artifact evidence on first-class work surfaces.",
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
      {
        label: "Assistant Profiles",
        to: CONTROL_PLANE_ROUTES.assistantProfiles,
        description: "Personal-assistant profiles with quiet hours, delivery rules, and direct-action governance.",
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
          : (
            link.to === CONTROL_PLANE_ROUTES.conversations
            || link.to === CONTROL_PLANE_ROUTES.inbox
            || link.to === CONTROL_PLANE_ROUTES.tasks
            || link.to === CONTROL_PLANE_ROUTES.reminders
            || link.to === CONTROL_PLANE_ROUTES.automations
            || link.to === CONTROL_PLANE_ROUTES.notifications
            || link.to === CONTROL_PLANE_ROUTES.agents
            || link.to === CONTROL_PLANE_ROUTES.channels
            || link.to === CONTROL_PLANE_ROUTES.contacts
            || link.to === CONTROL_PLANE_ROUTES.knowledgeSources
            || link.to === CONTROL_PLANE_ROUTES.memory
            || link.to === CONTROL_PLANE_ROUTES.learning
            || link.to === CONTROL_PLANE_ROUTES.skills
            || link.to === CONTROL_PLANE_ROUTES.assistantProfiles
            || link.to === CONTROL_PLANE_ROUTES.workspaces
            || link.to === CONTROL_PLANE_ROUTES.artifacts
          )
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
        || ((
          link.to === CONTROL_PLANE_ROUTES.conversations
          || link.to === CONTROL_PLANE_ROUTES.inbox
          || link.to === CONTROL_PLANE_ROUTES.tasks
          || link.to === CONTROL_PLANE_ROUTES.reminders
          || link.to === CONTROL_PLANE_ROUTES.automations
          || link.to === CONTROL_PLANE_ROUTES.notifications
          || link.to === CONTROL_PLANE_ROUTES.agents
          || link.to === CONTROL_PLANE_ROUTES.channels
          || link.to === CONTROL_PLANE_ROUTES.contacts
          || link.to === CONTROL_PLANE_ROUTES.knowledgeSources
          || link.to === CONTROL_PLANE_ROUTES.memory
          || link.to === CONTROL_PLANE_ROUTES.learning
          || link.to === CONTROL_PLANE_ROUTES.skills
          || link.to === CONTROL_PLANE_ROUTES.assistantProfiles
          || link.to === CONTROL_PLANE_ROUTES.workspaces
          || link.to === CONTROL_PLANE_ROUTES.artifacts
        ) && !canOpenWorkInteraction)
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
