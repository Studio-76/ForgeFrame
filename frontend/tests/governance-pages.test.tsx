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

    expect(markup).toContain("Read-only account review");
    expect(markup).toContain("it cannot mutate account profile or lifecycle");
    expect(markup).not.toContain(">Create account<");
  });

  it("opens security as the elevated-access request surface for operators", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/security",
        element: <SecurityPage />,
        session: operatorSession,
      }),
    );

    expect(markup).toContain("Operator exception view");
    expect(markup).toContain("Critical security blockers");
    expect(markup).toContain("Admin Users (Restricted)");
    expect(markup).toContain("Audit History");
    expect(markup).not.toContain("Audit &amp; Export");
    expect(markup).not.toContain(">Create admin user</h3>");
  });

  it("surfaces admin mutation status on security for admins", () => {
    const markup = renderToStaticMarkup(
      withAppContext({
        path: "/security",
        element: <SecurityPage />,
        session: adminSession,
      }),
    );

    expect(markup).toContain("Admin security control");
    expect(markup).toContain("Audit History");
    expect(markup).not.toContain("Audit &amp; Export");
    expect(markup).toContain("Provider Secrets");
  });
});
