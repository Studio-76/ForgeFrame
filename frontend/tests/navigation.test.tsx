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
    const governance = navigation.find((section) => section.label === "Governance");
    const operations = navigation.find((section) => section.label === "Operations");
    const approvalsLink = governance?.links.find((link) => link.label === "Approvals");
    const auditExportLink = governance?.links.find((link) => link.label === "Audit Export");
    const executionLink = operations?.links.find((link) => link.label === "Execution Review");
    const securityLink = governance?.links.find((link) => link.label === "Security & Policies");

    expect(approvalsLink?.to).toBe("/approvals");
    expect(approvalsLink?.badge).toBe("Operator or admin");
    expect(approvalsLink?.disabled).toBe(true);
    expect(executionLink?.to).toBe("/execution");
    expect(executionLink?.badge).toBe("Operator or admin");
    expect(executionLink?.disabled).toBe(true);
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
    const approvalsLink = governance?.links.find((link) => link.label === "Approvals");
    const executionLink = operations?.links.find((link) => link.label === "Execution Review");
    const securityLink = governance?.links.find((link) => link.label === "Security & Policies");

    expect(approvalsLink?.disabled).toBe(false);
    expect(approvalsLink?.badge).toBe("Review only");
    expect(executionLink?.disabled).toBe(false);
    expect(executionLink?.badge).toBeUndefined();
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
    const approvalsLink = governance?.links.find((link) => link.label === "Approvals");
    const executionLink = operations?.links.find((link) => link.label === "Execution Review");
    const securityLink = governance?.links.find((link) => link.label === "Security & Policies");

    expect(approvalsLink?.badge).toBe("Operator or admin");
    expect(approvalsLink?.disabled).toBe(true);
    expect(executionLink?.badge).toBe("Operator or admin");
    expect(executionLink?.disabled).toBe(true);
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
