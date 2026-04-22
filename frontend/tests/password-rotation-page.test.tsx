import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { CONTROL_PLANE_ROUTES } from "../src/app/navigation";
import { PasswordRotationPage } from "../src/pages/PasswordRotationPage";

function SessionHarness() {
  return (
    <Outlet
      context={{
        session: {
          session_id: "sess_rotation",
          user_id: "admin_rotation",
          username: "reset-admin",
          display_name: "Reset Admin",
          role: "admin",
          session_type: "standard",
          read_only: false,
          must_rotate_password: true,
        },
        sessionReady: true,
        markPasswordRotationComplete: () => undefined,
      }}
    />
  );
}

describe("PasswordRotationPage", () => {
  it("renders a restricted rotation-only control-plane boundary", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={[CONTROL_PLANE_ROUTES.passwordRotation]}>
        <Routes>
          <Route element={<SessionHarness />}>
            <Route path={CONTROL_PLANE_ROUTES.passwordRotation} element={<PasswordRotationPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain("Complete password rotation");
    expect(markup).toContain("Access restricted");
    expect(markup).toContain("Rotate password");
    expect(markup).toContain("Current temporary password");
    expect(markup).toContain("New password");
    expect(markup).toContain("standard control-plane shell hidden");
  });
});
