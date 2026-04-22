import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AdminPasswordResetForm,
  buildAdminPasswordResetPayload,
  createEmptyAdminPasswordResetDraft,
} from "../src/features/security/AdminPasswordResetForm";
import type { AdminPasswordRotationPayload, AdminUser } from "../src/api/admin";

function createUser(): AdminUser {
  return {
    user_id: "user-admin-1",
    username: "ops-admin",
    display_name: "Ops Admin",
    role: "admin",
    status: "active",
    must_rotate_password: false,
    created_at: "2026-04-21T10:00:00Z",
    updated_at: "2026-04-21T10:00:00Z",
    last_login_at: "2026-04-21T10:30:00Z",
    created_by: "bootstrap-admin",
  };
}

describe("admin password reset workflow", () => {
  it("builds the rotation payload from confirmed operator input and keeps first-login rotation enabled", () => {
    const payload: AdminPasswordRotationPayload = buildAdminPasswordResetPayload({
      new_password: "Temp-ForgeGate-42",
      confirm_password: "Temp-ForgeGate-42",
    });

    expect(payload).toEqual({
      new_password: "Temp-ForgeGate-42",
      must_rotate_password: true,
    });
    expect(payload.new_password).not.toBe("ForgeGate-Reset-123");
  });

  it("rejects mismatched confirmation before the reset request is submitted", () => {
    expect(() =>
      buildAdminPasswordResetPayload({
        new_password: "Temp-ForgeGate-42",
        confirm_password: "Temp-ForgeGate-24",
      }),
    ).toThrow("Password confirmation does not match.");
  });

  it("renders deliberate handoff copy instead of a one-click fixed password reset", () => {
    const markup = renderToStaticMarkup(
      <AdminPasswordResetForm
        busy={false}
        draft={createEmptyAdminPasswordResetDraft()}
        user={createUser()}
        onCancel={() => undefined}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(markup).toContain("Prepare temporary password handoff");
    expect(markup).toContain("Temporary password");
    expect(markup).toContain("Confirm temporary password");
    expect(markup).toContain("trusted channel");
    expect(markup).toContain("first login must rotate");
    expect(markup).not.toContain("ForgeGate-Reset-123");
  });
});
