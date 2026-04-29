import { useNavigate, useSearchParams } from "react-router-dom";

import { getPostRotationDestination } from "../app/authRouting";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { PasswordRotationGate } from "../features/auth/PasswordRotationGate";

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
        eyebrow="Auth Boundary"
        title="Complete password rotation"
        description={`This session for ${session.display_name} is limited to self-service password rotation until the temporary password is replaced.`}
        question="Can you verify the temporary password, satisfy the policy rules, and reopen the intended control-plane route?"
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
        note={continueTo === CONTROL_PLANE_ROUTES.dashboard
          ? "ForgeFrame keeps the standard control-plane shell hidden until this password rotation succeeds."
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
