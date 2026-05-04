import { useNavigate, useSearchParams } from "react-router-dom";

import { getPostRotationDestination } from "../app/authRouting";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { SetupWorkflowPage } from "../components/page-templates";
import { PasswordRotationGate } from "../features/auth/PasswordRotationGate";

/**
 * Standalone password rotation page.
 *
 * This page is used by the auth routing redirect when the session
 * requires password rotation. It shows the rotation form within
 * a single-step SetupWorkflowPage template.
 * After successful rotation, the user is redirected to /dashboard
 * where the full setup flow becomes visible.
 */
export function PasswordRotationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, sessionReady, replaceSession } = useAppSession();
  const continueTo = getPostRotationDestination(searchParams.get("next"));

  if (!sessionReady || !session) {
    return null;
  }

  const note =
    continueTo === CONTROL_PLANE_ROUTES.dashboard
      ? "The guided setup flow continues on the dashboard after this step."
      : `ForgeFrame will return this session to ${continueTo} after the password rotation succeeds.`;

  return (
    <SetupWorkflowPage
      eyebrow="Setup"
      title="Rotate password"
      description="Step 1 of the setup flow. The control plane opens after you replace the temporary password."
      currentStep={1}
      totalSteps={1}
      stepLabel="Rotate password"
    >
      <p className="text-meta text-muted mb-3">{note}</p>
      <PasswordRotationGate
        session={session}
        onRotationComplete={(nextSession) => {
          replaceSession(nextSession);
          navigate(continueTo, { replace: true });
        }}
      />
    </SetupWorkflowPage>
  );
}
