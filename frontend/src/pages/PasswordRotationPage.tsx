import { useNavigate, useSearchParams } from "react-router-dom";

import { getPostRotationDestination } from "../app/authRouting";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { PasswordRotationGate } from "../features/auth/PasswordRotationGate";

/**
 * Standalone password rotation page.
 *
 * This page is used by the auth routing redirect when the session
 * requires password rotation. It shows the rotation form with
 * context that this is step 1 of the guided setup flow.
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

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Rotate password"
        description="Step 1 of the setup flow. The control plane opens after you replace the temporary password."
        badges={[{ label: "Step 1 of the setup flow", tone: "warning" }]}
        note={continueTo === CONTROL_PLANE_ROUTES.dashboard
          ? "The guided setup flow continues on the dashboard after this step."
          : `ForgeFrame will return this session to ${continueTo} after the password rotation succeeds.`}
      />
      <PasswordRotationGate
        session={session}
        onRotationComplete={(nextSession) => {
          replaceSession(nextSession);
          navigate(continueTo, { replace: true });
        }}
      />
    </section>
  );
}
