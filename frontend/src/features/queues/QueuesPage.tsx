import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { fetchExecutionQueues, type ExecutionQueueLaneSummary, type ExecutionQueueRunView } from "../../api/domain/execution";
import { fetchInstances } from "../../api/domain/instances";
import { normalizeExecutionCompanyId, normalizeExecutionInstanceId } from "../../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { sessionHasScopedOrAnyInstancePermission } from "../../app/adminAccess";
import { PageIntro } from "../../components/PageIntro";
import {
  buildExecutionScopeOptions,
  describeExecutionScopeOption,
  getExecutionAccess,
  type ExecutionScopeOption,
  type LoadState,
} from "../execution/helpers";
import { QueueHealthSummary } from "./QueueHealthSummary";
import { QueueLaneStatus } from "./QueueLaneStatus";
import { QueueFilters } from "./QueueFilters";
import { QueueBacklog } from "./QueueBacklog";

/**
 * Queues page — lane-backed queue health monitor.
 * Shows a top-level health summary, compact lane status strip,
 * operator-friendly filters with advanced toggle, and a focused
 * backlog table with item detail panel.
 */
export function QueuesPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = normalizeExecutionInstanceId(searchParams.get("instanceId")) ?? "";
  const companyId = normalizeExecutionCompanyId(searchParams.get("companyId")) ?? "";
  const laneFilter = searchParams.get("lane")?.trim() ?? "";
  const stateFilter = searchParams.get("state")?.trim() || "all";
  const targetFilter = searchParams.get("target")?.trim() ?? "";
  const ageFilter = searchParams.get("age")?.trim() || "all";
  const canReviewQueues = sessionReady && sessionHasScopedOrAnyInstancePermission(session, instanceId, "execution.read");
  const access = getExecutionAccess(session, sessionReady, instanceId);

  const [instanceDraft, setInstanceDraft] = useState(instanceId);
  const [laneDraft, setLaneDraft] = useState(laneFilter);
  const [stateDraft, setStateDraft] = useState(stateFilter);
  const [targetDraft, setTargetDraft] = useState(targetFilter);
  const [ageDraft, setAgeDraft] = useState(ageFilter);
  const [scopeState, setScopeState] = useState<LoadState>("idle");
  const [scopeOptions, setScopeOptions] = useState<ExecutionScopeOption[]>([]);
  const [scopeError, setScopeError] = useState("");
  const [queueState, setQueueState] = useState<LoadState>(instanceId ? "loading" : "idle");
  const [laneSummaries, setLaneSummaries] = useState<ExecutionQueueLaneSummary[]>([]);
  const [runs, setRuns] = useState<ExecutionQueueRunView[]>([]);
  const [queueError, setQueueError] = useState("");

  useEffect(() => {
    setInstanceDraft(instanceId);
  }, [instanceId]);

  useEffect(() => {
    setLaneDraft(laneFilter);
  }, [laneFilter]);

  useEffect(() => {
    setStateDraft(stateFilter);
  }, [stateFilter]);

  useEffect(() => {
    setTargetDraft(targetFilter);
  }, [targetFilter]);

  useEffect(() => {
    setAgeDraft(ageFilter);
  }, [ageFilter]);

  useEffect(() => {
    if (!canReviewQueues || instanceId) {
      return;
    }

    let cancelled = false;
    setScopeState("loading");
    setScopeError("");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setScopeOptions(buildExecutionScopeOptions(payload.instances));
        setScopeState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setScopeOptions([]);
        setScopeError(error instanceof Error ? error.message : "Execution queues could not load active instances.");
        setScopeState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewQueues, instanceId]);

  useEffect(() => {
    if (!canReviewQueues || !instanceId) {
      setQueueState("idle");
      setLaneSummaries([]);
      setRuns([]);
      setQueueError("");
      return;
    }

    let cancelled = false;
    setQueueState("loading");
    setQueueError("");

    const query = {
      instanceId,
      companyId,
      limit: 100,
      ...(laneFilter ? { executionLane: laneFilter } : {}),
      ...(stateFilter !== "all" ? { state: stateFilter } : {}),
      ...(targetFilter ? { target: targetFilter } : {}),
      ...(ageFilter !== "all" ? { age: ageFilter } : {}),
    };

    void fetchExecutionQueues(query)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setLaneSummaries(payload.lanes);
        setRuns(payload.runs);
        setQueueState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLaneSummaries([]);
        setRuns([]);
        setQueueError(error instanceof Error ? error.message : "Queue truth could not be loaded.");
        setQueueState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewQueues, companyId, instanceId, laneFilter, stateFilter, targetFilter, ageFilter]);

  const updateSearchParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next);
    });
  };

  const handleScopeChoice = (nextInstanceId: string) => {
    updateSearchParams((next) => {
      next.set("instanceId", nextInstanceId);
      next.delete("companyId");
      next.delete("lane");
      next.delete("state");
      next.delete("target");
      next.delete("age");
    });
  };

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateSearchParams((next) => {
      const normalizedInstance = instanceDraft.trim();
      const normalizedLane = laneDraft.trim();
      const normalizedState = stateDraft.trim();
      const normalizedTarget = targetDraft.trim();
      const normalizedAge = ageDraft.trim();

      if (normalizedInstance) {
        next.set("instanceId", normalizedInstance);
      } else {
        next.delete("instanceId");
      }
      if (normalizedLane) {
        next.set("lane", normalizedLane);
      } else {
        next.delete("lane");
      }
      if (normalizedState && normalizedState !== "all") {
        next.set("state", normalizedState);
      } else {
        next.delete("state");
      }
      if (normalizedTarget) {
        next.set("target", normalizedTarget);
      } else {
        next.delete("target");
      }
      if (normalizedAge && normalizedAge !== "all") {
        next.set("age", normalizedAge);
      } else {
        next.delete("age");
      }
    });
  };

  const handleFilterClear = () => {
    setInstanceDraft("");
    setLaneDraft("");
    setStateDraft("all");
    setTargetDraft("");
    setAgeDraft("all");
    updateSearchParams((next) => {
      next.delete("instanceId");
      next.delete("companyId");
      next.delete("lane");
      next.delete("state");
      next.delete("target");
      next.delete("age");
    });
  };

  // ── Compute health summary from lane data ──
  const totalBacklog = laneSummaries.reduce((sum, l) => sum + l.total_runs, 0);
  const blockedItems = laneSummaries.reduce(
    (sum, l) => sum + l.paused_runs + l.quarantined_runs + l.waiting_on_approval_runs,
    0,
  );
  const oldestWaitSeconds = laneSummaries.reduce(
    (max, l) => Math.max(max, l.longest_wait_seconds ?? 0),
    0,
  ) || null;
  const pressureLanes = laneSummaries
    .filter((l) => l.total_runs > 0 || l.paused_runs > 0 || l.quarantined_runs > 0)
    .map((l) => l.execution_lane);

  let nextAction = "All queues are clear";
  if (totalBacklog > 0) {
    if (blockedItems > 0) {
      nextAction = `Review ${blockedItems} blocked item${blockedItems > 1 ? "s" : ""}`;
    } else {
      nextAction = "Monitor runnable backlog";
    }
  }

  // ── Session not ready ──
  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Operations"
          title="Queues"
          description="ForgeFrame is still checking the current session before it opens lane-backed queue truth."
          question="Which execution surface should you keep open while queue access is being resolved?"
          links={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Run detail and operator actions on the scoped execution surface." },
            { label: "Dispatch", to: CONTROL_PLANE_ROUTES.dispatch, description: "Worker leases and outbox pressure once access is confirmed." },
            { label: "Errors & Activity", to: CONTROL_PLANE_ROUTES.logs, description: "Operational evidence while queue access stays gated." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Queue truth stays instance-scoped and operator-facing."
        />
      </section>
    );
  }

  // ── No queue read access ──
  if (!canReviewQueues) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Operations"
          title="Queues"
          description="Queue truth is reserved for operator and admin sessions because the backend does not expose execution orchestration to viewers."
          question="Which read-safe surface should you use instead?"
          links={[
            { label: "Errors & Activity", to: CONTROL_PLANE_ROUTES.logs, description: "Shared operational evidence without queue mutation or queue truth." },
            { label: "Usage & Costs", to: CONTROL_PLANE_ROUTES.usage, description: "Traffic and cost pressure while queue review stays blocked." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard and choose a viewer-safe route." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewer sessions cannot open queue lane truth."
        />
      </section>
    );
  }

  // ── Main page content ──
  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Queues"
        description="Monitor queue health, lane pressure, and backlog across instances. Queue inspection is separate from run mutation — replay lives on Execution Review."
        question="Which instance and lane own the backlog you are trying to explain?"
        links={[
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Run detail and operator controls for a selected execution run." },
          { label: "Dispatch", to: CONTROL_PLANE_ROUTES.dispatch, description: "Worker lease and outbox posture for the same execution fabric." },
          { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Approval backlog when runs are waiting on governance instead of queue capacity." },
          { label: "Errors & Activity", to: CONTROL_PLANE_ROUTES.logs, description: "Operational evidence next to queue truth." },
        ]}
        badges={[{ label: access.badgeLabel, tone: access.badgeTone }]}
        note="Queue health monitors lane and backlog truth. Full run mutation lives on Execution Review."
      />

      {/* ── Instance scope selector ── */}
      {!instanceId ? (
        <div className="ff-queue-scope-selector">
          <div className="ff-queue-scope-header">
            <span className="fg-pill" data-tone="warning">Instance scope required</span>
            <p className="fg-muted">Select an instance to inspect queue health.</p>
          </div>
          {scopeState === "loading" ? <p className="fg-muted">Loading active instances from the registry.</p> : null}
          {scopeState === "error" ? <p className="fg-danger">{scopeError}</p> : null}
          {scopeState === "success" && scopeOptions.length === 0 ? <p className="fg-muted">No active instances are available for queue review.</p> : null}
          {scopeOptions.map((option) => (
            <button
              key={option.instanceId}
              type="button"
              className="fg-data-row"
              onClick={() => handleScopeChoice(option.instanceId)}
            >
              <div className="fg-panel-heading fg-data-row-heading">
                <div className="fg-page-header">
                  <span className="fg-code">{option.instanceId}</span>
                  <strong>{option.displayName}</strong>
                </div>
                <span className="fg-pill" data-tone="neutral">{option.status}</span>
              </div>
              <span className="fg-muted">{describeExecutionScopeOption(option)}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* ── Filters ── */}
          <QueueFilters
            laneDraft={laneDraft}
            stateDraft={stateDraft}
            targetDraft={targetDraft}
            ageDraft={ageDraft}
            instanceDraft={instanceDraft}
            onLaneChange={setLaneDraft}
            onStateChange={setStateDraft}
            onTargetChange={setTargetDraft}
            onAgeChange={setAgeDraft}
            onInstanceDraftChange={setInstanceDraft}
            onSubmit={handleFilterSubmit}
            onClear={handleFilterClear}
          />

          {/* ── Loading state ── */}
          {queueState === "loading" ? (
            <div className="ff-queue-loading">
              <p className="fg-muted">Loading queue data...</p>
            </div>
          ) : null}

          {/* ── Error state ── */}
          {queueState === "error" ? (
            <div className="ff-queue-error">
              <p className="fg-danger">{queueError}</p>
            </div>
          ) : null}

          {/* ── Queue data ── */}
          {queueState === "success" ? (
            <>
              <QueueHealthSummary
                laneSummaries={laneSummaries}
                totalBacklog={totalBacklog}
                blockedItems={blockedItems}
                oldestWaitSeconds={oldestWaitSeconds}
                pressureLanes={pressureLanes}
                nextAction={nextAction}
              />
              <QueueLaneStatus laneSummaries={laneSummaries} />
              <QueueBacklog
                runs={runs}
                instanceId={instanceId}
                companyId={companyId}
              />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
