import { useNavigate } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { PasswordRotationGate } from "../features/auth/PasswordRotationGate";

export function PasswordRotationPage() {
  const navigate = useNavigate();
  const { session, sessionReady, markPasswordRotationComplete } = useAppSession();

  if (!sessionReady || !session) {
    return null;
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Auth Boundary"
        title="Complete password rotation"
        description={`This session for ${session.display_name} is limited to self-service password rotation until the temporary password is replaced.`}
        question="Can you verify the temporary password and choose a permanent secret before opening the control plane?"
        links={[
          {
            label: "Rotate password",
            to: CONTROL_PLANE_ROUTES.passwordRotation,
            description: "Required first step before standard navigation and control-plane routes re-open.",
            badge: "Required",
            disabled: true,
          },
        ]}
        badges={[{ label: "Access restricted", tone: "warning" }]}
        note="ForgeGate keeps the standard control-plane shell hidden until this password rotation succeeds."
      />
      <PasswordRotationGate
        session={session}
        onRotationComplete={() => {
          markPasswordRotationComplete();
          navigate(CONTROL_PLANE_ROUTES.dashboard, { replace: true });
        }}
      />
    </section>
  );
}
