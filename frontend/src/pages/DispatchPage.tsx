/**
 * DispatchPage — worker lease monitoring, outbox pressure analysis,
 * and lease reconciliation surface.
 *
 * Migrated to use the IncidentResponsePage template with summary KPIs,
 * inline attention warnings, and collapsible diagnostics.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AdminApiError } from "../api/domain";
import {
  fetchExecutionDispatch,
  reconcileExecutionLeases,
  type ExecutionDispatchSnapshot,
  type ExecutionLeaseReconcileResult,
} from "../api/domain/execution";
import { fetchInstances } from "../api/domain/instances";
import {
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../app/adminAccess";
import { buildExecutionReviewPath, normalizeExecutionCompanyId, normalizeExecutionInstanceId } from "../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { IncidentResponsePage, type IncidentResponsePageProps } from "../components/page-templates";
import { Button, DiagnosticSection, RawJson } from "../components/ui";
import {
  buildExecutionScopeOptions,
  describeExecutionScopeOption,
} from "../features/execution/helpers";
import type { ExecutionScopeOption, LoadState } from "../features/execution/helpers";
import {
  DispatchAttemptTable,
  DispatchWorkerTable,
  describeOutboxCause,
  buildScopedRoute,
  summarizeReconcileResults,
} from "../features/dispatch";

/**
 * Dispatch page — incident response surface for the worker lease layer.
 */
export function DispatchPage() {
  const navigate = useNavigate();
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = normalizeExecutionInstanceId(searchParams.get("instanceId")) ?? "";
  const companyId = normalizeExecutionCompanyId(searchParams.get("companyId")) ?? "";
  const canReviewDispatch = sessionReady && sessionHasScopedOrAnyInstancePermission(session, instanceId, "execution.read");
  const canMutate = sessionCanMutateScopedOrAnyInstance(session, instanceId, "execution.operate");
  const [instanceDraft, setInstanceDraft] = useState(instanceId);
  const [scopeState, setScopeState] = useState<LoadState>("idle");
  const [scopeOptions, setScopeOptions] = useState<ExecutionScopeOption[]>([]);
  const [scopeError, setScopeError] = useState("");
  const [dispatchState, setDispatchState] = useState<LoadState>(instanceId ? "loading" : "idle");
  const [snapshot, setSnapshot] = useState<ExecutionDispatchSnapshot | null>(null);
  const [dispatchError, setDispatchError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [reconcileState, setReconcileState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reconcileResults, setReconcileResults] = useState<ExecutionLeaseReconcileResult[]>([]);
  const [reconcileErrors, setReconcileErrors] = useState<string[]>([]);
  const now = Date.now();

  /** Navigate to execution review for a specific run. */
  const openExecutionReview = (runId: string) => {
    navigate(buildExecutionReviewPath({ instanceId, companyId, runId }));
  };

  useEffect(() => {
    setInstanceDraft(instanceId);
  }, [instanceId]);

  useEffect(() => {
    if (!canReviewDispatch || instanceId) {
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
        setScopeError(error instanceof Error ? error.message : "Execution dispatch could not load active instances.");
        setScopeState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewDispatch, instanceId]);

  useEffect(() => {
    if (!canReviewDispatch || !instanceId) {
      setDispatchState("idle");
      setSnapshot(null);
      setDispatchError("");
      return;
    }

    let cancelled = false;
    setDispatchState("loading");
    setDispatchError("");

    void fetchExecutionDispatch({ instanceId, companyId })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setSnapshot(payload.dispatch);
        setDispatchState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setSnapshot(null);
        setDispatchError(error instanceof Error ? error.message : "Dispatch truth could not be loaded.");
        setDispatchState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReviewDispatch, companyId, instanceId, refreshNonce]);

  const updateSearchParams = (nextInstanceId: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      next.set("instanceId", nextInstanceId);
    } else {
      next.delete("instanceId");
    }
    startTransition(() => {
      setSearchParams(next);
    });
  };

  const outboxStates = useMemo(
    () => Object.entries(snapshot?.outbox_counts ?? {}).filter(([, count]) => count > 0).sort((left, right) => right[1] - left[1]),
    [snapshot],
  );
  const reconcileSummary = summarizeReconcileResults(reconcileResults);

  // ── Template props ──────────────────────────────────────────────────

  const summaryItems: IncidentResponsePageProps["summaryItems"] = snapshot
    ? [
        { key: "active-leases", label: "Active leases", value: snapshot.leased_attempts.length, tone: snapshot.leased_attempts.length > 0 ? "warning" : "success" },
        { key: "stalled", label: "Stalled / expired", value: snapshot.stalled_attempts.length, tone: snapshot.stalled_attempts.length > 0 ? "danger" : "success" },
        { key: "outbox", label: "Outbox pressure states", value: outboxStates.length, tone: outboxStates.length > 0 ? "warning" : "success" },
        { key: "workers", label: "Workers observed", value: snapshot.workers.length },
      ]
    : [];

  const diagnosticsContent = snapshot ? (
    <>
      <DiagnosticSection label="Worker registry payload">
        <RawJson data={snapshot.workers} />
      </DiagnosticSection>
      <DiagnosticSection label="Outbox event counts">
        <RawJson data={snapshot.event_counts} />
      </DiagnosticSection>
      <DiagnosticSection label="Lease reconciliation payload">
        <RawJson data={{ results: reconcileResults, errors: reconcileErrors }} />
      </DiagnosticSection>
      <DiagnosticSection label="Full dispatch snapshot">
        <RawJson data={snapshot} />
      </DiagnosticSection>
    </>
  ) : undefined;

  return (
    <IncidentResponsePage
      eyebrow="Operations"
      title="Dispatch"
      description="Inspect the technical worker and lease layer below runs and queues: active leases, stalled attempts, outbox pressure, and lease reconciliation."
      summaryItems={summaryItems}
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Dispatch diagnostics"
    >
      {/* ── Scope selection ── */}
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Dispatch Scope</h3>
          </div>
        </div>
        {!instanceId ? (
          <div className="fg-stack">
            {scopeState === "loading" ? <p className="fg-muted">Loading instances.</p> : null}
            {scopeState === "error" ? <p className="fg-danger">{scopeError}</p> : null}
            {scopeOptions.map((option) => (
              <button key={option.instanceId} type="button" className="fg-data-row" onClick={() => updateSearchParams(option.instanceId)}>
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
        ) : null}
        <form
          className="fg-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            updateSearchParams(instanceDraft.trim());
          }}
        >
          <label>
            Exact instance ID
            <input aria-label="Dispatch instance ID" value={instanceDraft} onChange={(event) => setInstanceDraft(event.target.value)} />
          </label>
          <div className="fg-actions fg-actions-end">
            <Button type="submit" variant="secondary">Load dispatch</Button>
            <Button variant="navigation" onPress={() => updateSearchParams("")}>Clear scope</Button>
          </div>
        </form>
      </article>

      {/* ── Loading state ── */}
      {dispatchState === "loading" ? (
        <p className="fg-muted">Loading dispatch truth.</p>
      ) : null}

      {/* ── Error state ── */}
      {dispatchState === "error" ? (
        <p className="fg-danger">{dispatchError}</p>
      ) : null}

      {/* ── Main content when snapshot available ── */}
      {snapshot ? (
        <>
          <DispatchWorkerTable
            snapshot={snapshot}
            instanceId={instanceId}
            onNavigateExecutionReview={openExecutionReview}
          />

          <DispatchAttemptTable
            snapshot={snapshot}
            onNavigateExecutionReview={openExecutionReview}
          />

          {/* ── Outbox Pressure ── */}
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Outbox Pressure</h3>
                <p className="fg-muted">Outbox pressure comes from persisted publish-state truth, not inferred runtime logs.</p>
              </div>
            </div>
            {outboxStates.length === 0 ? (
              <p className="fg-muted">No outbox rows are currently accumulating on this instance scope.</p>
            ) : (
              <div className="fg-grid fg-grid-compact">
                {outboxStates.map(([state, count]) => {
                  const cause = describeOutboxCause(state);
                  return (
                    <article key={state} className="fg-outline-row">
                      <div className="fg-panel-heading fg-data-row-heading">
                        <div className="fg-page-header">
                          <strong>{state}</strong>
                          <span className="fg-pill" data-tone={cause.tone}>{count}</span>
                        </div>
                        <span className="fg-muted fg-type-xs">{cause.detail}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </article>

          {/* ── Reconciliation ── */}
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Reconciliation</h3>
                <p className="fg-muted">Lease reconciliation turns expired dispatch leases into explicit quarantined or timed-out run truth.</p>
              </div>
              <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>
                {canMutate ? "Mutations enabled" : "Permission blocker"}
              </span>
            </div>
            {!canMutate ? (
              <p className="fg-danger">Reconcile is blocked because this session lacks `execution.operate` on the selected instance.</p>
            ) : null}
            <div className="fg-grid fg-grid-compact">
              <article className="fg-kpi">
                <span className="fg-muted">Expired leases visible now</span>
                <strong className="fg-kpi-value">{snapshot.stalled_attempts.length}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Corrected leases</span>
                <strong className="fg-kpi-value">{reconcileSummary.correctedLeases}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Corrected attempts</span>
                <strong className="fg-kpi-value">{reconcileSummary.correctedAttempts}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Errors</span>
                <strong className="fg-kpi-value">{reconcileErrors.length}</strong>
              </article>
            </div>
            <div className="fg-actions">
              <Button
                variant="secondary"
                isDisabled={!canMutate || reconcileState === "submitting"}
                onPress={() => {
                  setReconcileState("submitting");
                  setReconcileResults([]);
                  setReconcileErrors([]);
                  void reconcileExecutionLeases({ instanceId, companyId })
                    .then((payload) => {
                      setReconcileResults(payload.reconciled);
                      setReconcileErrors([]);
                      setReconcileState("success");
                      setRefreshNonce((value) => value + 1);
                    })
                    .catch((error: unknown) => {
                      const message =
                        error instanceof AdminApiError
                          ? error.message
                          : error instanceof Error
                            ? error.message
                            : "Lease reconciliation failed.";
                      setReconcileResults([]);
                      setReconcileErrors([message]);
                      setReconcileState("error");
                    });
                }}
              >
                {reconcileState === "submitting" ? "Reconciling leases" : "Reconcile expired leases"}
              </Button>
            </div>
            {reconcileState === "success" ? (
              reconcileResults.length === 0 ? (
                <p className="fg-note">Reconciliation completed, but no expired leases required correction.</p>
              ) : (
                <>
                  <p className="fg-note">
                    Reconciliation completed. Corrected {reconcileSummary.correctedLeases} lease(s) across {reconcileSummary.correctedAttempts} attempt(s).
                  </p>
                  <div className="fg-table-wrap">
                    <table className="fg-table" aria-label="Lease reconciliation results">
                      <thead>
                        <tr>
                          <th>Run</th>
                          <th>Attempt</th>
                          <th>Result state</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconcileResults.map((item) => (
                          <tr key={`${item.run_id}:${item.attempt_id}`}>
                            <td>{item.run_id}</td>
                            <td>{item.attempt_id}</td>
                            <td>{item.reconciled_to_state}</td>
                            <td>{item.dead_letter_reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            ) : null}
            {reconcileState === "error" ? (
              <div className="fg-stack">
                {reconcileErrors.map((message) => (
                  <p key={message} className="fg-danger">{message}</p>
                ))}
              </div>
            ) : null}
          </article>
        </>
      ) : null}
    </IncidentResponsePage>
  );
}
