import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
import { AccountsPage } from "../src/pages/AccountsPage";
import { SecurityPage } from "../src/pages/SecurityPage";
import { withAppContext } from "./testContext";

const operatorSession: AdminSessionUser = {
  session_id: "session-operator",
  user_id: "user-operator",
  username: "operator",
  display_name: "Operator",
  role: "operator",
};

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

describe("governance page role cues", () => {
  it("keeps accounts in read-only mode for operators", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/accounts",
        element: <AccountsPage />,
        session: operatorSession,
      }),
    );

    expect(markup).toContain("Read-Only Runtime Access Review");
    expect(markup).toContain("Request break-glass access or review your elevated-access history");
    expect(markup).not.toContain(">Create Account<");
  });

  it("opens security as the elevated-access request surface for operators", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/security",
        element: <SecurityPage />,
        session: operatorSession,
      }),
    );

    expect(markup).toContain("Elevated-access requester");
    expect(markup).toContain("Request elevated access");
    expect(markup).toContain("Request history");
    expect(markup).toContain("Audit History");
    expect(markup).not.toContain("Audit &amp; Export");
    expect(markup).not.toContain(">Create Admin User</h3>");
  });

  it("surfaces admin mutation status on security for admins", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/security",
        element: <SecurityPage />,
        session: adminSession,
      }),
    );

    expect(markup).toContain("Admin posture + requests");
    expect(markup).toContain("Audit History");
    expect(markup).not.toContain("Audit &amp; Export");
    expect(markup).toContain(">Create Admin User</h3>");
  });
});
