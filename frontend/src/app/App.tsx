import { useCallback, useEffect, useMemo } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import { clearAdminToken, fetchAdminSession, getAdminToken, logoutAdmin, type AdminSessionUser } from "../api/domain";
import { adminKeys } from "../api/adminQueries";
import { AppShell } from "../components/layout/AppShell";
import { LoadingState } from "../components/ui/StateBlocks";
import { getSessionRouteState } from "./authRouting";
import { CONTROL_PLANE_ROUTES, getControlPlaneNavigation, type NavigationSection } from "./navigation";
import { queryClient } from "./queryClient";
import { getInstanceIdFromSearchParams } from "./tenantScope";
import { useScopeStore } from "../store";
import { useQuery } from "@tanstack/react-query";

/**
 * Minimal runtime validation for the admin session API response.
 * Guards against backend contract violations producing silent null/undefined cascades.
 * @param data - Raw response from fetchAdminSession.
 * @returns Validated session data or null.
 */
function validateSessionResponse(data: unknown): { status: string; user: AdminSessionUser } | null {
  if (!data || typeof data !== "object") return null;
  const response = data as Record<string, unknown>;
  if (response.status !== "ok" && response.status !== "error") return null;
  const user = response.user;
  if (!user || typeof user !== "object") return null;
  const userRecord = user as Record<string, unknown>;
  if (typeof userRecord.user_id !== "string" || typeof userRecord.role !== "string") return null;
  return data as { status: string; user: AdminSessionUser };
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const rawToken = getAdminToken();
  const hasToken = Boolean(rawToken) && rawToken.length > 0;

  const sessionQuery = useQuery({
    queryKey: adminKeys.session,
    queryFn: fetchAdminSession,
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const session: AdminSessionUser | null = sessionQuery.data
    ? (validateSessionResponse(sessionQuery.data)?.user ?? null)
    : null;
  const sessionError: string = sessionQuery.error instanceof Error ? sessionQuery.error.message : "";
  const sessionReady = !hasToken || sessionQuery.isFetched;

  /* Clear the stored token when the session check itself fails (e.g. expired). */
  useEffect(() => {
    if (sessionQuery.isError) {
      clearAdminToken();
    }
  }, [sessionQuery.isError]);

  const navigationSections = getControlPlaneNavigation(session);
  const scopeSearchParams = new URLSearchParams(location.search);
  const instanceId = getInstanceIdFromSearchParams(scopeSearchParams);
  const routeState = getSessionRouteState({
    pathname: location.pathname,
    requestedPath: `${location.pathname}${location.search}${location.hash}`,
    hasToken,
    session,
    sessionReady,
  });

  const onLogout = useCallback(async () => {
    try {
      await logoutAdmin();
    } catch {
      // noop
    }
    clearAdminToken();
    queryClient.setQueryData(adminKeys.session, undefined);
    navigate(CONTROL_PLANE_ROUTES.login, { replace: true });
  }, [navigate]);

  const markPasswordRotationComplete = useCallback(() => {
    queryClient.setQueryData(adminKeys.session, (old: { status: string; user: AdminSessionUser } | undefined) => {
      if (!old) return old;
      return { ...old, user: { ...old.user, must_rotate_password: false } };
    });
  }, []);

  const replaceSession = useCallback((updatedUser: AdminSessionUser | null) => {
    if (updatedUser) {
      queryClient.setQueryData(adminKeys.session, { status: "ok", user: updatedUser });
    } else {
      queryClient.resetQueries({ queryKey: adminKeys.session });
    }
  }, []);

  const passwordRotationNavigation: NavigationSection[] = useMemo(() => [{
    id: "system",
    label: "Session",
    description: "Temporary admin sessions can only rotate their password or log out.",
    icon: "system",
    links: [{
      label: "Rotate password",
      to: CONTROL_PLANE_ROUTES.passwordRotation,
      description: "Replace the temporary admin password before opening the full control plane.",
    }],
  }], []);

  /* Sync URL instanceId → scope store so pages read from Zustand instead of parsing URL params. */
  useEffect(() => {
    useScopeStore.getState().setScope(instanceId, instanceId ?? undefined);
  }, [instanceId]);

  const shellNavigation = routeState.shellMode === "password_rotation" ? passwordRotationNavigation : navigationSections;

  return (
    <AppShell
      navigationSections={shellNavigation}
      instanceId={instanceId}
      session={session}
      sessionError={sessionError}
      onLogout={() => void onLogout()}
    >
      {session?.must_rotate_password ? (
        <div className="ff-session-banner" data-tone="warning">
          Password rotation required. The control plane will open after you replace the temporary password.
        </div>
      ) : null}
      {sessionError ? <div className="ff-session-banner" data-tone="danger">{sessionError}</div> : null}
      {routeState.loading ? (
        <LoadingState
          title="Restoring Admin Session"
          description="Checking the current admin session and policy gates before opening the control plane."
        />
      ) : routeState.redirectTo ? (
        <Navigate replace to={routeState.redirectTo} />
      ) : (
        <Outlet context={{ session, sessionReady, markPasswordRotationComplete, replaceSession }} />
      )}
    </AppShell>
  );
}
