/**
 * Learning page — review learning events and decide promotion outcomes.
 *
 * Delegates to decomposed feature components in features/learning/.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import { Link } from "react-router-dom";

import { fetchInstances } from "../api/domain/instances";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { buildMemoryPath, buildLearningPath } from "../app/workInteractionRoutes";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess } from "./workInteractionPageSupport";

import {
  useLearningPage,
  LearningSummaryHero,
  EmptyState,
  LearningLifecycle,
  EventList,
  EventDetail,
  CreateManualForm,
} from "../features/learning";

/**
 * Learning page component.
 */
export function LearningPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);

  const page = useLearningPage(session, sessionReady);

  const [showManualForm, setShowManualForm] = useState(false);
  const [showScanInfo, setShowScanInfo] = useState(false);

  const hasEvents = page.events.length > 0;
  const suggestedCount = page.groupedEvents.find((g) => g.bucket === "suggested")?.events.length ?? 0;
  const reviewRequiredCount = page.groupedEvents.find((g) => g.bucket === "review_required")?.events.length ?? 0;
  const promotedCount = page.groupedEvents.find((g) => g.bucket === "approved_promoted")?.events.length ?? 0;
  const rejectedCount = page.groupedEvents.find((g) => g.bucket === "rejected")?.events.length ?? 0;

  // Not ready
  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Learning"
          description="ForgeFrame is restoring learning-review state."
          question="Which learning surface should open once scope resolves?"
          links={[
            {
              label: "Command Center",
              to: CONTROL_PLANE_ROUTES.dashboard,
              description: "Return to the dashboard while session scope resolves.",
            },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Learning events persist review truth, promotion decisions, and explainability."
        />
      </section>
    );
  }

  // No read access
  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Learning"
          description="This route is reserved for operators and admins who can inspect real learning and memory-promotion truth."
          question="Which adjacent surface should remain open while learning access is outside the current permission envelope?"
          links={[
            {
              label: "Memory",
              to: CONTROL_PLANE_ROUTES.memory,
              description: "Inspect existing memory truth while learning review remains closed.",
            },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render cosmetic learning suggestions without scoped access."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Learning"
        description="Review learning events as explicit persistence proposals, inspect explainability, and decide whether the result should stay as history, become memory, or become a draft skill."
        question="Does automatic learning stay under review control, or is ForgeFrame still promoting memory and skill state without a visible decision trail?"
        links={[
          {
            label: "Memory",
            to: buildMemoryPath({ instanceId: page.instanceId }),
            description: "Inspect durable or boot memory created from learning decisions.",
          },
          {
            label: "Skills",
            to: `${CONTROL_PLANE_ROUTES.skills}?instanceId=${encodeURIComponent(page.instanceId)}`,
            description: "Inspect draft skills created from approved learning events.",
          },
        ]}
        badges={[
          {
            label: `${page.events.length} event${page.events.length === 1 ? "" : "s"}`,
            tone: page.events.length > 0 ? "success" : "warning",
          },
          {
            label: canMutate ? "Admin mutation enabled" : "Read only",
            tone: canMutate ? "success" : "neutral",
          },
        ]}
        note="Pattern scans, session rotations, operator actions, and runtime signals land here as reviewable objects with visible source, proposal, risk, and outcome truth."
      />

      {/* Messages */}
      {page.error ? <p className="fg-danger">{page.error}</p> : null}
      {page.message ? <p>{page.message}</p> : null}

      {/* Instance selector */}
      <article className="fg-card ff-learning-instance-bar">
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              value={page.instanceId}
              onChange={(event) => {
                page.setParam("instanceId", event.target.value);
                page.deleteParam("eventId");
              }}
            >
              {page.instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
          <span
            className="fg-pill"
            data-tone={
              page.instancesState === "success" && page.listState === "success"
                ? "success"
                : page.listState === "error" || page.detailState === "error"
                  ? "danger"
                  : "neutral"
            }
          >
            {page.instancesState}/{page.listState}/{page.detailState}
          </span>
        </div>
      </article>

      {/* Summary hero */}
      <LearningSummaryHero
        totalEvents={page.events.length}
        suggestedCount={suggestedCount}
        reviewRequiredCount={reviewRequiredCount}
        promotedCount={promotedCount}
        rejectedCount={rejectedCount}
        canMutate={canMutate}
        hasInstance={!!page.instanceId}
        scanningPatterns={page.scanningPatterns}
        scanResult={page.scanResult}
        listState={page.listState}
        onScan={() => void page.handlePatternScan()}
        onCreateManual={() => setShowManualForm(true)}
        showScanInfo={showScanInfo}
        onToggleScanInfo={() => setShowScanInfo((prev) => !prev)}
      />

      {/* Main content: empty state or event list + detail */}
      {!hasEvents && page.listState === "success" ? (
        <>
          <EmptyState
            canMutate={canMutate}
            hasInstance={!!page.instanceId}
            scanningPatterns={page.scanningPatterns}
            onScan={() => void page.handlePatternScan()}
            onCreateManual={() => setShowManualForm(true)}
          />
          <LearningLifecycle />
        </>
      ) : (
        <div className="fg-grid ff-learning-main-grid">
          <div className="fg-stack">
            <EventList
              events={page.events}
              activeBucket={page.activeBucket}
              onBucketChange={page.setActiveBucket}
              selectedEventId={page.selectedEventId}
              onSelectEvent={page.selectEvent}
              listState={page.listState}
              hasInstance={!!page.instanceId}
            />
          </div>

          <EventDetail
            detail={page.detail}
            instanceId={page.instanceId}
            detailState={page.detailState}
            decideForm={page.decideForm}
            setDecideFormField={page.setDecideFormField}
            handleDecide={page.handleDecide}
            savingDecide={page.savingDecide}
            canMutate={canMutate}
          />
        </div>
      )}

      {/* Learning lifecycle explanation */}
      <LearningLifecycle />

      {/* Manual creation form — hidden until explicitly opened */}
      <CreateManualForm
        visible={showManualForm}
        onClose={() => setShowManualForm(false)}
        createForm={page.createForm}
        setCreateFormField={page.setCreateFormField}
        handleCreate={page.handleCreate}
        savingCreate={page.savingCreate}
        canMutate={canMutate}
        hasInstance={!!page.instanceId}
      />
    </section>
  );
}
