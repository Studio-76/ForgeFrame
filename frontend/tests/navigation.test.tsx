import { describe, expect, it } from "vitest";

import { getControlPlaneNavigation, isHrefCurrent } from "../src/app/navigation";
import type { AdminSessionUser } from "../src/api/admin";

const adminSession: AdminSessionUser = {
  session_id: "session-1",
  user_id: "user-1",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

const operatorSession: AdminSessionUser = {
  session_id: "session-2",
  user_id: "user-2",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

const readOnlyOperatorSession: AdminSessionUser = {
  session_id: "session-2-read-only",
  user_id: "user-2",
  username: "operator",
  display_name: "Operator",
  role: "operator",
  read_only: true,
};

const viewerSession: AdminSessionUser = {
  session_id: "session-3",
  user_id: "user-3",
  username: "viewer",
  display_name: "Viewer",
  role: "viewer",
};

describe("control-plane navigation", () => {
  it("keeps governance security disabled until an operator or admin session exists", () => {
    const navigation = getControlPlaneNavigation(null);
    const setup = navigation.find((section) => section.label === "Setup");
    const governance = navigation.find((section) => section.label === "Governance");
    const operations = navigation.find((section) => section.label === "Operations");
    const workInteraction = navigation.find((section) => section.label === "Work Interaction");
    const modelsLink = setup?.links.find((link) => link.label === "Models");
    const targetsLink = setup?.links.find((link) => link.label === "Provider Targets");
    const routingLink = setup?.links.find((link) => link.label === "Routing");
    const pluginsLink = setup?.links.find((link) => link.label === "Plugins");
    const harnessLink = setup?.links.find((link) => link.label === "Harness");
    const ingressTlsLink = setup?.links.find((link) => link.label === "Ingress / TLS");
    const releaseValidationLink = setup?.links.find((link) => link.label === "Release / Validation");
    const approvalsLink = governance?.links.find((link) => link.label === "Approvals");
    const auditExportLink = governance?.links.find((link) => link.label === "Audit Export");
    const executionLink = operations?.links.find((link) => link.label === "Execution Review");
    const queuesLink = operations?.links.find((link) => link.label === "Queues");
    const dispatchLink = operations?.links.find((link) => link.label === "Dispatch");
    const recoveryLink = operations?.links.find((link) => link.label === "Recovery / Backup / Restore");
    const healthLink = operations?.links.find((link) => link.label === "Health");
    const usageLink = operations?.links.find((link) => link.label === "Usage");
    const costsLink = operations?.links.find((link) => link.label === "Costs");
    const errorsLink = operations?.links.find((link) => link.label === "Errors");
    const securityLink = governance?.links.find((link) => link.label === "Security & Policies");
    const conversationsLink = workInteraction?.links.find((link) => link.label === "Conversations");
    const inboxLink = workInteraction?.links.find((link) => link.label === "Inbox");
    const tasksLink = workInteraction?.links.find((link) => link.label === "Tasks");
    const remindersLink = workInteraction?.links.find((link) => link.label === "Reminders");
    const automationsLink = workInteraction?.links.find((link) => link.label === "Automations");
    const notificationsLink = workInteraction?.links.find((link) => link.label === "Notifications");
    const channelsLink = workInteraction?.links.find((link) => link.label === "Channels");
    const contactsLink = workInteraction?.links.find((link) => link.label === "Contacts");
    const knowledgeSourcesLink = workInteraction?.links.find((link) => link.label === "Knowledge Sources");
    const memoryLink = workInteraction?.links.find((link) => link.label === "Memory");
    const assistantProfilesLink = workInteraction?.links.find((link) => link.label === "Assistant Profiles");
    const workspacesLink = workInteraction?.links.find((link) => link.label === "Workspaces");
    const artifactsLink = workInteraction?.links.find((link) => link.label === "Artifacts");

    expect(approvalsLink?.to).toBe("/approvals");
    expect(modelsLink?.to).toBe("/models");
    expect(targetsLink?.to).toBe("/provider-targets");
    expect(routingLink?.to).toBe("/routing");
    expect(pluginsLink?.to).toBe("/plugins");
    expect(harnessLink?.to).toBe("/harness");
    expect(ingressTlsLink?.to).toBe("/ingress-tls");
    expect(releaseValidationLink?.to).toBe("/release-validation");
    expect(approvalsLink?.badge).toBe("Operator or admin");
    expect(approvalsLink?.disabled).toBe(true);
    expect(executionLink?.to).toBe("/execution");
    expect(executionLink?.badge).toBe("Operator or admin");
    expect(executionLink?.disabled).toBe(true);
    expect(queuesLink?.to).toBe("/queues");
    expect(queuesLink?.badge).toBeUndefined();
    expect(dispatchLink?.to).toBe("/dispatch");
    expect(dispatchLink?.badge).toBeUndefined();
    expect(recoveryLink?.to).toBe("/recovery");
    expect(recoveryLink?.badge).toBeUndefined();
    expect(healthLink?.to).toBe("/health-status");
    expect(usageLink?.to).toBe("/usage");
    expect(costsLink?.to).toBe("/costs");
    expect(errorsLink?.to).toBe("/errors");
    expect(conversationsLink?.to).toBe("/conversations");
    expect(conversationsLink?.badge).toBe("Operator or admin");
    expect(conversationsLink?.disabled).toBe(true);
    expect(inboxLink?.to).toBe("/inbox");
    expect(inboxLink?.badge).toBe("Operator or admin");
    expect(inboxLink?.disabled).toBe(true);
    expect(tasksLink?.to).toBe("/tasks");
    expect(tasksLink?.badge).toBe("Operator or admin");
    expect(tasksLink?.disabled).toBe(true);
    expect(remindersLink?.to).toBe("/reminders");
    expect(remindersLink?.badge).toBe("Operator or admin");
    expect(remindersLink?.disabled).toBe(true);
    expect(automationsLink?.to).toBe("/automations");
    expect(automationsLink?.badge).toBe("Operator or admin");
    expect(automationsLink?.disabled).toBe(true);
    expect(notificationsLink?.to).toBe("/notifications");
    expect(notificationsLink?.badge).toBe("Operator or admin");
    expect(notificationsLink?.disabled).toBe(true);
    expect(channelsLink?.to).toBe("/channels");
    expect(channelsLink?.badge).toBe("Operator or admin");
    expect(channelsLink?.disabled).toBe(true);
    expect(contactsLink?.to).toBe("/contacts");
    expect(contactsLink?.badge).toBe("Operator or admin");
    expect(contactsLink?.disabled).toBe(true);
    expect(knowledgeSourcesLink?.to).toBe("/knowledge-sources");
    expect(knowledgeSourcesLink?.badge).toBe("Operator or admin");
    expect(knowledgeSourcesLink?.disabled).toBe(true);
    expect(memoryLink?.to).toBe("/memory");
    expect(memoryLink?.badge).toBe("Operator or admin");
    expect(memoryLink?.disabled).toBe(true);
    expect(assistantProfilesLink?.to).toBe("/assistant-profiles");
    expect(assistantProfilesLink?.badge).toBe("Operator or admin");
    expect(assistantProfilesLink?.disabled).toBe(true);
    expect(workspacesLink?.to).toBe("/workspaces");
    expect(workspacesLink?.badge).toBe("Operator or admin");
    expect(workspacesLink?.disabled).toBe(true);
    expect(artifactsLink?.to).toBe("/artifacts");
    expect(artifactsLink?.badge).toBe("Operator or admin");
    expect(artifactsLink?.disabled).toBe(true);
    expect(securityLink?.badge).toBe("Operator or admin");
    expect(securityLink?.disabled).toBe(true);
    expect(governance?.links.some((link) => link.label === "Audit History")).toBe(true);
    expect(auditExportLink?.to).toBe("/logs#audit-export");
    expect(operations?.links.some((link) => link.label === "Execution Review")).toBe(true);
  });

  it("keeps approvals available for admin sessions", () => {
    const navigation = getControlPlaneNavigation(adminSession);
    const governance = navigation.find((section) => section.label === "Governance");
    const approvalsLink = governance?.links.find((link) => link.label === "Approvals");
    const securityLink = governance?.links.find((link) => link.label === "Security & Policies");

    expect(approvalsLink?.disabled).toBe(false);
    expect(approvalsLink?.badge).toBeUndefined();
    expect(securityLink?.disabled).toBe(false);
    expect(securityLink?.badge).toBe("Admin posture");
  });

  it("keeps approvals visible in review-only mode for operators", () => {
    const navigation = getControlPlaneNavigation(operatorSession);
    const governance = navigation.find((section) => section.label === "Governance");
    const operations = navigation.find((section) => section.label === "Operations");
    const workInteraction = navigation.find((section) => section.label === "Work Interaction");
    const approvalsLink = governance?.links.find((link) => link.label === "Approvals");
    const executionLink = operations?.links.find((link) => link.label === "Execution Review");
    const securityLink = governance?.links.find((link) => link.label === "Security & Policies");
    const conversationsLink = workInteraction?.links.find((link) => link.label === "Conversations");
    const tasksLink = workInteraction?.links.find((link) => link.label === "Tasks");
    const notificationsLink = workInteraction?.links.find((link) => link.label === "Notifications");
    const contactsLink = workInteraction?.links.find((link) => link.label === "Contacts");
    const knowledgeSourcesLink = workInteraction?.links.find((link) => link.label === "Knowledge Sources");
    const memoryLink = workInteraction?.links.find((link) => link.label === "Memory");
    const assistantProfilesLink = workInteraction?.links.find((link) => link.label === "Assistant Profiles");
    const workspacesLink = workInteraction?.links.find((link) => link.label === "Workspaces");

    expect(approvalsLink?.disabled).toBe(false);
    expect(approvalsLink?.badge).toBe("Review only");
    expect(executionLink?.disabled).toBe(false);
    expect(executionLink?.badge).toBeUndefined();
    expect(conversationsLink?.disabled).toBe(false);
    expect(conversationsLink?.badge).toBe("Read only");
    expect(tasksLink?.disabled).toBe(false);
    expect(tasksLink?.badge).toBe("Read only");
    expect(notificationsLink?.disabled).toBe(false);
    expect(notificationsLink?.badge).toBe("Read only");
    expect(contactsLink?.disabled).toBe(false);
    expect(contactsLink?.badge).toBe("Read only");
    expect(knowledgeSourcesLink?.disabled).toBe(false);
    expect(knowledgeSourcesLink?.badge).toBe("Read only");
    expect(memoryLink?.disabled).toBe(false);
    expect(memoryLink?.badge).toBe("Read only");
    expect(assistantProfilesLink?.disabled).toBe(false);
    expect(assistantProfilesLink?.badge).toBe("Read only");
    expect(workspacesLink?.disabled).toBe(false);
    expect(workspacesLink?.badge).toBe("Read only");
    expect(securityLink?.disabled).toBe(false);
    expect(securityLink?.badge).toBe("Request only");
  });

  it("labels execution review as read-only when the session can inspect but not replay", () => {
    const navigation = getControlPlaneNavigation(readOnlyOperatorSession);
    const operations = navigation.find((section) => section.label === "Operations");
    const executionLink = operations?.links.find((link) => link.label === "Execution Review");

    expect(executionLink?.disabled).toBe(false);
    expect(executionLink?.badge).toBe("Read only");
  });

  it("keeps execution review and approvals disabled for viewers", () => {
    const navigation = getControlPlaneNavigation(viewerSession);
    const governance = navigation.find((section) => section.label === "Governance");
    const operations = navigation.find((section) => section.label === "Operations");
    const workInteraction = navigation.find((section) => section.label === "Work Interaction");
    const approvalsLink = governance?.links.find((link) => link.label === "Approvals");
    const executionLink = operations?.links.find((link) => link.label === "Execution Review");
    const securityLink = governance?.links.find((link) => link.label === "Security & Policies");
    const conversationsLink = workInteraction?.links.find((link) => link.label === "Conversations");
    const remindersLink = workInteraction?.links.find((link) => link.label === "Reminders");
    const automationsLink = workInteraction?.links.find((link) => link.label === "Automations");
    const contactsLink = workInteraction?.links.find((link) => link.label === "Contacts");
    const knowledgeSourcesLink = workInteraction?.links.find((link) => link.label === "Knowledge Sources");
    const memoryLink = workInteraction?.links.find((link) => link.label === "Memory");
    const assistantProfilesLink = workInteraction?.links.find((link) => link.label === "Assistant Profiles");
    const workspacesLink = workInteraction?.links.find((link) => link.label === "Workspaces");

    expect(approvalsLink?.badge).toBe("Operator or admin");
    expect(approvalsLink?.disabled).toBe(true);
    expect(executionLink?.badge).toBe("Operator or admin");
    expect(executionLink?.disabled).toBe(true);
    expect(conversationsLink?.badge).toBe("Operator or admin");
    expect(conversationsLink?.disabled).toBe(true);
    expect(remindersLink?.badge).toBe("Operator or admin");
    expect(remindersLink?.disabled).toBe(true);
    expect(automationsLink?.badge).toBe("Operator or admin");
    expect(automationsLink?.disabled).toBe(true);
    expect(contactsLink?.badge).toBe("Operator or admin");
    expect(contactsLink?.disabled).toBe(true);
    expect(knowledgeSourcesLink?.badge).toBe("Operator or admin");
    expect(knowledgeSourcesLink?.disabled).toBe(true);
    expect(memoryLink?.badge).toBe("Operator or admin");
    expect(memoryLink?.disabled).toBe(true);
    expect(assistantProfilesLink?.badge).toBe("Operator or admin");
    expect(assistantProfilesLink?.disabled).toBe(true);
    expect(workspacesLink?.badge).toBe("Operator or admin");
    expect(workspacesLink?.disabled).toBe(true);
    expect(securityLink?.badge).toBe("Operator or admin");
    expect(securityLink?.disabled).toBe(true);
  });

  it("treats anchor-based provider and audit links as distinct targets", () => {
    expect(isHrefCurrent("/providers", "", "/providers")).toBe(true);
    expect(isHrefCurrent("/providers", "", "/providers#provider-health-runs")).toBe(false);
    expect(isHrefCurrent("/providers", "#provider-health-runs", "/providers#provider-health-runs")).toBe(true);
    expect(isHrefCurrent("/execution", "", "/execution")).toBe(true);
    expect(isHrefCurrent("/logs", "", "/logs#audit-history")).toBe(false);
    expect(isHrefCurrent("/logs", "#audit-history", "/logs#audit-history")).toBe(true);
    expect(isHrefCurrent("/logs", "#audit-history", "/logs?tenantId=acct_alpha#audit-history")).toBe(true);
    expect(isHrefCurrent("/logs", "#audit-export", "/logs#audit-export")).toBe(true);
    expect(isHrefCurrent("/logs", "#audit-history", "/logs#audit-export")).toBe(false);
  });
});
