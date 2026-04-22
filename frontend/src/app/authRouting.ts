import { redirect, type LoaderFunctionArgs } from "react-router-dom";

import { clearAdminToken, fetchAdminSession, getAdminToken, type AdminSessionUser } from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "./navigation";

export type SessionShellMode = "signed_out" | "password_rotation" | "control_plane";

type SessionRouteStateArgs = {
  pathname: string;
  hasToken: boolean;
  session: AdminSessionUser | null;
  sessionReady: boolean;
};

export type SessionRouteState = {
  shellMode: SessionShellMode;
  redirectTo: string | null;
  loading: boolean;
};

async function loadSessionFromToken(): Promise<AdminSessionUser | null> {
  if (!getAdminToken()) {
    return null;
  }

  try {
    const payload = await fetchAdminSession();
    return payload.user;
  } catch {
    clearAdminToken();
    return null;
  }
}

export function normalizeNextPath(rawPath: string | null | undefined): string {
  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return CONTROL_PLANE_ROUTES.dashboard;
  }

  if (
    rawPath === CONTROL_PLANE_ROUTES.login
    || rawPath.startsWith(`${CONTROL_PLANE_ROUTES.login}?`)
    || rawPath.startsWith(`${CONTROL_PLANE_ROUTES.login}#`)
    || rawPath === CONTROL_PLANE_ROUTES.passwordRotation
    || rawPath.startsWith(`${CONTROL_PLANE_ROUTES.passwordRotation}?`)
    || rawPath.startsWith(`${CONTROL_PLANE_ROUTES.passwordRotation}#`)
  ) {
    return CONTROL_PLANE_ROUTES.dashboard;
  }

  return rawPath;
}

export function getPostLoginDestination(user: AdminSessionUser, requestedNextPath: string | null | undefined): string {
  if (user.must_rotate_password) {
    return CONTROL_PLANE_ROUTES.passwordRotation;
  }

  return normalizeNextPath(requestedNextPath);
}

export function getSessionRouteState({
  pathname,
  hasToken,
  session,
  sessionReady,
}: SessionRouteStateArgs): SessionRouteState {
  const isLoginRoute = pathname === CONTROL_PLANE_ROUTES.login;
  const isPasswordRotationRoute = pathname === CONTROL_PLANE_ROUTES.passwordRotation;

  if (hasToken && !sessionReady) {
    return {
      shellMode: "signed_out",
      redirectTo: null,
      loading: true,
    };
  }

  if (!session) {
    return {
      shellMode: "signed_out",
      redirectTo: isLoginRoute ? null : CONTROL_PLANE_ROUTES.login,
      loading: false,
    };
  }

  if (session.must_rotate_password) {
    return {
      shellMode: "password_rotation",
      redirectTo: isPasswordRotationRoute ? null : CONTROL_PLANE_ROUTES.passwordRotation,
      loading: false,
    };
  }

  return {
    shellMode: "control_plane",
    redirectTo: isLoginRoute || isPasswordRotationRoute ? CONTROL_PLANE_ROUTES.dashboard : null,
    loading: false,
  };
}

function buildLoginRedirect(url: URL): string {
  const nextPath = normalizeNextPath(`${url.pathname}${url.search}${url.hash}`);
  return `${CONTROL_PLANE_ROUTES.login}?next=${encodeURIComponent(nextPath)}`;
}

export async function loginRouteLoader(): Promise<null> {
  const session = await loadSessionFromToken();
  if (session) {
    throw redirect(getPostLoginDestination(session, null));
  }
  return null;
}

export async function protectedRouteLoader({ request }: LoaderFunctionArgs): Promise<null> {
  const session = await loadSessionFromToken();
  if (!session) {
    throw redirect(buildLoginRedirect(new URL(request.url)));
  }
  return null;
}
