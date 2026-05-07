/**
 * Learning page — review learning events and decide promotion outcomes.
 *
 * Conforms to the Review Queue pattern using the ReviewQueuePage template.
 *
 * @packageDocumentation
 */

import { useState } from "react";

import { useAppSession } from "../app/session";
import { ReviewQueuePage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import type { AttentionPayload } from "../components/ui/models/attention";
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
  const showInstanceSelector = page.instances.length > 1;
  const activeInstance = page.instances.find(
    (instance) => instance.instance_id === page.instanceId,
  );

  // ── Attention items ────────────────────────────────────────
  const attentionItems: AttentionPayload[] = [];
  if (page.error) {
    attentionItems.push({
      key: "learning-error",
      level: "primary_blocker",
      title: page.error,
    });
  }
  if (page.message) {
    attentionItems.push({
      key: "learning-message",
      level: "informational",
      title: page.message,
    });
  }

  // ── Summary items (non-zero only) ──────────────────────────
  const summaryItems = hasEvents
    ? [
        ...(suggestedCount > 0 ? [{ key: "suggested" as const, label: "Suggested" as const, value: suggestedCount, tone: "warning" as const }] : []),
        ...(reviewRequiredCount > 0 ? [{ key: "review" as const, label: "Review required" as const, value: reviewRequiredCount, tone: "warning" as const }] : []),
        ...(promotedCount > 0 ? [{ key: "promoted" as const, label: "Promoted" as const, value: promotedCount, tone: "success" as const }] : []),
        ...(rejectedCount > 0 ? [{ key: "rejected" as const, label: "Rejected" as const, value: rejectedCount, tone: "neutral" as const }] : []),
      ]
    : undefined;

  // ── Actions ────────────────────────────────────────────────
  const actions: Action[] = [];
  if (canMutate && page.instanceId) {
    actions.push({
      label: "Scan patterns",
      kind: "primary",
      intent: "run" as const,
      onClick: () => void page.handlePatternScan(),
    });
  }

  // Not ready
  if (!sessionReady) {
    return (
      <ReviewQueuePage
        eyebrow="Work Interaction"
        title="Learning"
        description="Restoring learning-review state."
        isEmpty
        emptyTitle="Checking access"
        emptyDescription="Waiting for session state before opening learning review."
      />
    );
  }

  // No read access
  if (!canRead) {
    return (
      <ReviewQueuePage
        eyebrow="Work Interaction"
        title="Learning"
        description="Operator or admin access required to inspect learning truth."
        isEmpty
        emptyTitle="Operator or admin required"
        emptyDescription="Learning suggestions require scoped access."
      />
    );
  }

  return (
    <>
      <ReviewQueuePage
        eyebrow="Work Interaction"
        title="Learning"
        description="Review suggestions before they become memory, skills, or records."
        attentionItems={attentionItems}
        summaryItems={summaryItems}
        actions={actions}
        hasSelection={page.selectedEventId != null}
        selectedItemContent={
          page.detail ? (
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
          ) : undefined
        }
        emptyDetailHint="Select an event from the queue to inspect promotion options."
        density="compact"
      >
        {/* Instance scope selector */}
        <article className="ff-learning-scope-status" aria-label="Learning scope status">
          {showInstanceSelector ? (
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
                    {instance.display_name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span>
              Scope: {(activeInstance?.display_name ?? page.instanceId) || "Resolving"}
            </span>
          )}
          <span>{canMutate ? "Admin mutations available" : "Read only"}</span>
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
          lastScanCompletedAt={page.lastScanCompletedAt}
          listState={page.listState}
          showScanInfo={showScanInfo}
          onToggleScanInfo={() => setShowScanInfo((prev) => !prev)}
        />

        {/* Main content: empty state or event list */}
        {!hasEvents && page.listState === "success" ? (
          <EmptyState
            canMutate={canMutate}
            hasInstance={!!page.instanceId}
            scanningPatterns={page.scanningPatterns}
            onScan={() => void page.handlePatternScan()}
            onCreateManual={() => setShowManualForm(true)}
          />
        ) : (
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
        )}
      </ReviewQueuePage>

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
    </>
  );
}
