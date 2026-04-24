import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { clearAdminToken, fetchAdminSession, getAdminToken, logoutAdmin, type AdminSessionUser } from "../api/admin";
import { AppShell } from "../components/layout/AppShell";
import { LoadingState } from "../components/ui/StateBlocks";
import { getSessionRouteState } from "./authRouting";
import { CONTROL_PLANE_ROUTES, getControlPlaneNavigation } from "./navigation";
import { getInstanceIdFromSearchParams } from "./tenantScope";

export function App() {
  const location = useLocation();
  const [session, setSession] = useState<AdminSessionUser | null>(null);
  const [sessionError, setSessionError] = useState<string>("");
  const [sessionReady, setSessionReady] = useState<boolean>(false);

  const navigationSections = getControlPlaneNavigation(session);
  const scopeSearchParams = new URLSearchParams(location.search);
  const instanceId = getInstanceIdFromSearchParams(scopeSearchParams);
  const routeState = getSessionRouteState({
    pathname: location.pathname,
    hasToken: Boolean(getAdminToken()),
    session,
    sessionReady,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setSessionReady(false);
      if (!getAdminToken()) {
        setSession(null);
        setSessionReady(true);
        return;
      }
      try {
        const payload = await fetchAdminSession();
        if (!mounted) {
          return;
        }
        setSession(payload.user);
        setSessionError("");
        setSessionReady(true);
      } catch (error) {
        clearAdminToken();
        if (!mounted) {
          return;
        }
        setSession(null);
        setSessionError(error instanceof Error ? error.message : "Session check failed.");
        setSessionReady(true);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  const onLogout = async () => {
    try {
      await logoutAdmin();
    } catch {
      // noop
    }
    clearAdminToken();
    setSession(null);
  };

  const markPasswordRotationComplete = () => {
    setSession((current) => (current ? { ...current, must_rotate_password: false } : current));
  };

  const passwordRotationNavigation = [{
    label: "Session",
    description: "Temporary admin sessions can only rotate their password or log out.",
    links: [{
      label: "Rotate password",
      to: CONTROL_PLANE_ROUTES.passwordRotation,
      description: "Replace the temporary admin password before opening the full control plane.",
    }],
  }];

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
          Password rotation required before ForgeFrame will open the standard control-plane routes.
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
        <Outlet context={{ session, sessionReady, markPasswordRotationComplete, replaceSession: setSession }} />
      )}
    </AppShell>
  );
}
