import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../../app/tenantScope";
import { PageIntro } from "../../components/PageIntro";
import { ErrorState, LoadingState } from "../../components/ui/StateBlocks";
import { PasswordRotationStep } from "./PasswordRotationStep";
import { SetupActionBar } from "./SetupActionBar";
import { SetupProgress } from "./SetupProgress";
import { SetupStepCard } from "./SetupStepCard";
import { useSetupFlow } from "./useSetupFlow";

/**
 * Unified setup and onboarding page.
 *
 * Replaces the previous fragmented DashboardPage, OnboardingPage, and
 * PasswordRotationPage flows. Renders a single guided checklist with:
 * - A progress bar showing "Step X of Y"
 * - One primary action button that is impossible to miss
 * - Separated blockers, warnings, and info hierarchy
 * - Clear English copy (no German, no internal jargon, no emojis)
 *
 * The page has three modes:
 * - `password-rotation`: Only step 1 (password rotation) is shown.
 * - `bootstrap`: Steps 2-8 are shown as a guided checklist.
 * - `operational`: All steps complete, shows a simplified status view.
 */
export function SetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, replaceSession } = useAppSession();
  const { state, loading, error } = useSetupFlow();
  const instanceId = getInstanceIdFromSearchParams(searchParams);

  const handleRotationComplete = (updatedSession: typeof session) => {
    if (updatedSession) {
      replaceSession(updatedSession);
    }
    /* After rotation, navigate back to dashboard so the full setup flow loads. */
    navigate("/dashboard", { replace: true });
  };

  if (loading) {
    return (
      <section className="fg-page">
        <LoadingState
          title="Loading setup state"
          description="ForgeFrame is checking the current system state and preparing the guided setup flow."
        />
      </section>
    );
  }

  if (error && state.mode !== "password-rotation") {
    return (
      <section className="fg-page">
        <ErrorState
          title="Setup data could not be loaded"
          description={error}
          action={(
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>
              Review diagnostics
            </Link>
          )}
        />
      </section>
    );
  }

  /* Password rotation mode: only step 1 is shown. */
  if (state.mode === "password-rotation") {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Setup"
          title="Password rotation required"
          description="The control plane will open after you replace the temporary password."
          badges={[{ label: "Step 1 of the setup flow", tone: "warning" }]}
        />
        {session ? (
          <PasswordRotationStep
            session={session}
            onRotationComplete={handleRotationComplete}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup and status"
        title="System setup"
        description="Complete the guided steps to bring the system online."
        badges={[
          ...(state.instanceLabel
            ? [{ label: `Instance: ${state.instanceLabel}`, tone: "info" as const }]
            : []),
          {
            label: `${state.completeCount} of ${state.totalCount} steps complete`,
            tone: state.overallStatus === "live" ? "success" as const : "warning" as const,
          },
        ]}
      />

      <SetupProgress
        completeCount={state.completeCount}
        totalCount={state.totalCount}
        currentStepIndex={state.currentStepIndex}
        overallStatus={state.overallStatus}
      />

      {state.primaryAction ? (
        <SetupActionBar
          label={state.primaryAction.label}
          to={state.primaryAction.to}
          description={
            state.overallStatus === "blocked"
              ? "The next step is blocked. Review the details below and resolve the blocker."
              : "This is the next required action."
          }
          instanceId={instanceId}
        />
      ) : null}

      <div className="ff-setup-steps">
        {state.steps.map((step) => (
          <SetupStepCard
            key={step.id}
            step={step}
            instanceId={instanceId}
          />
        ))}
      </div>
    </section>
  );
}
