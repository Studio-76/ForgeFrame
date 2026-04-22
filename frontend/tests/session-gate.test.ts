import { describe, expect, it } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
import { getSessionRouteState } from "../src/app/authRouting";
import { CONTROL_PLANE_ROUTES } from "../src/app/navigation";

function createSession(overrides: Partial<AdminSessionUser> = {}): AdminSessionUser {
  return {
    session_id: "sess_test",
    user_id: "admin_test",
    username: "ops-admin",
    display_name: "Ops Admin",
    role: "admin",
    session_type: "standard",
    read_only: false,
    must_rotate_password: false,
    ...overrides,
  };
}

describe("session route gate", () => {
  it("redirects signed-out traffic to the login route", () => {
    expect(
      getSessionRouteState({
        pathname: CONTROL_PLANE_ROUTES.dashboard,
        hasToken: false,
        session: null,
        sessionReady: true,
      }),
    ).toEqual({
      shellMode: "signed_out",
      redirectTo: CONTROL_PLANE_ROUTES.login,
      loading: false,
    });
  });

  it("keeps password-rotation sessions off the standard control-plane routes", () => {
    expect(
      getSessionRouteState({
        pathname: CONTROL_PLANE_ROUTES.providers,
        hasToken: true,
        session: createSession({ must_rotate_password: true }),
        sessionReady: true,
      }),
    ).toEqual({
      shellMode: "password_rotation",
      redirectTo: CONTROL_PLANE_ROUTES.passwordRotation,
      loading: false,
    });
  });

  it("lets password-rotation sessions stay on the forced-rotation route", () => {
    expect(
      getSessionRouteState({
        pathname: CONTROL_PLANE_ROUTES.passwordRotation,
        hasToken: true,
        session: createSession({ must_rotate_password: true }),
        sessionReady: true,
      }),
    ).toEqual({
      shellMode: "password_rotation",
      redirectTo: null,
      loading: false,
    });
  });

  it("redirects authenticated sessions away from auth-boundary routes once access is restored", () => {
    expect(
      getSessionRouteState({
        pathname: CONTROL_PLANE_ROUTES.login,
        hasToken: true,
        session: createSession(),
        sessionReady: true,
      }),
    ).toEqual({
      shellMode: "control_plane",
      redirectTo: CONTROL_PLANE_ROUTES.dashboard,
      loading: false,
    });
  });

  it("holds the shell in a loading state while a token is being checked", () => {
    expect(
      getSessionRouteState({
        pathname: CONTROL_PLANE_ROUTES.dashboard,
        hasToken: true,
        session: null,
        sessionReady: false,
      }),
    ).toEqual({
      shellMode: "signed_out",
      redirectTo: null,
      loading: true,
    });
  });
});
