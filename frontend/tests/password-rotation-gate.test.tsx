import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
import {
  PasswordRotationGate,
  buildPasswordRotationRequest,
  createEmptyPasswordRotationDraft,
} from "../src/features/auth/PasswordRotationGate";

function createSession(): AdminSessionUser {
  return {
    session_id: "sess_rotation_1",
    user_id: "user_rotation_1",
    username: "rotation-admin",
    display_name: "Rotation Admin",
    role: "admin",
    session_type: "standard",
    read_only: false,
    must_rotate_password: true,
  };
}

describe("password rotation gate", () => {
  it("builds the self-rotation request from confirmed input", () => {
    const payload = buildPasswordRotationRequest({
      current_password: "Rotation-Reset-456",
      new_password: "Rotation-Admin-789",
      confirm_password: "Rotation-Admin-789",
    });

    expect(payload).toEqual({
      current_password: "Rotation-Reset-456",
      new_password: "Rotation-Admin-789",
    });
  });

  it("rejects mismatched new-password confirmation before the unlock request is sent", () => {
    expect(() =>
      buildPasswordRotationRequest({
        current_password: "Rotation-Reset-456",
        new_password: "Rotation-Admin-789",
        confirm_password: "Rotation-Admin-987",
      }),
    ).toThrow("New password confirmation does not match.");
  });

  it("renders restricted-session copy that keeps the rest of the control plane locked", () => {
    const markup = renderToStaticMarkup(
      <PasswordRotationGate
        session={createSession()}
        onRotationComplete={() => undefined}
      />,
    );

    expect(markup).toContain("Password Rotation Required");
    expect(markup).toContain("restricted session");
    expect(markup).toContain("Only self-rotation and logout remain available.");
    expect(markup).toContain("Current temporary password");
    expect(markup).toContain("Confirm new password");
    expect(markup).toContain("Rotate and unlock control plane");
  });

  it("starts from an empty draft", () => {
    expect(createEmptyPasswordRotationDraft()).toEqual({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
  });
});
