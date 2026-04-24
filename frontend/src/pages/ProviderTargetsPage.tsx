import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { fetchProviderTargets, updateProviderTarget, type ProviderTargetRecord } from "../api/admin";
import {
  getScopedAdminInstanceId,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

function formatRecordEntries(values: Record<string, unknown>): string {
  const entries = Object.entries(values ?? {});
  return entries.length > 0
    ? entries.map(([key, value]) => `${key}=${String(value)}`).join(" · ")
    : "none";
}

export function ProviderTargetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [targets, setTargets] = useState<ProviderTargetRecord[]>([]);
  const [priorityDrafts, setPriorityDrafts] = useState<Record<string, string>>({});
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");

  const canReadTargets = sessionReady && sessionHasScopedOrAnyInstancePermission(session, scopedInstanceId, "provider_targets.read");
  const canMutate = sessionCanMutateScopedOrAnyInstance(session, scopedInstanceId, "provider_targets.write");

  const load = async () => {
    setState("loading");
    setError("");
    try {
      const payload = await fetchProviderTargets(instanceId);
      setTargets(payload.targets);
      setPriorityDrafts(Object.fromEntries(payload.targets.map((target) => [target.target_key, String(target.priority)])));
      setState("success");
    } catch (loadError) {
      setTargets([]);
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Provider target register could not be loaded.");
    }
  };

  useEffect(() => {
    if (!canReadTargets) {
      setTargets([]);
      setPriorityDrafts({});
      setState("idle");
      setError("");
      return;
    }
    void load();
  }, [canReadTargets, instanceId]);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const saveTarget = async (target: ProviderTargetRecord, updates: Parameters<typeof updateProviderTarget>[1]) => {
    if (!canMutate) {
      setError("This session cannot change provider-target state.");
      return;
    }
    setError("");
    try {
      await updateProviderTarget(target.target_key, updates, instanceId);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Provider target update failed.");
    }
  };

  const enabledTargets = targets.filter((target) => target.enabled).length;
  const readyTargets = targets.filter((target) => target.readiness_status === "ready").length;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Routing"
        title="Provider Targets"
        description="Instance-bound provider targets are the real routing objects. This surface keeps target enablement, priority, technical capabilities, execution traits, policy flags, and economic posture explicit."
        question="Which targets are actually eligible for this instance right now, and in what order will routing consider them?"
        links={[
          {
            label: "Models",
            to: CONTROL_PLANE_ROUTES.models,
            description: "Inspect the persistent model register behind these targets.",
          },
          {
            label: "Providers",
            to: CONTROL_PLANE_ROUTES.providers,
            description: "Return to provider onboarding, health, harness, and compatibility truth.",
          },
        ]}
        badges={[
          { label: `${enabledTargets}/${targets.length || 0} enabled`, tone: enabledTargets > 0 ? "success" : "warning" },
          { label: `${readyTargets} ready`, tone: readyTargets > 0 ? "success" : "warning" },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
          ...(session ? [{ label: canMutate ? `${session.role} mutations enabled` : "Read only target view", tone: canMutate ? "success" as const : "warning" as const }] : []),
        ]}
        note="This register is instance-scoped product truth. Beta target projections on the providers surface do not replace it."
      />
      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="provider target truth"
        onInstanceChange={onInstanceChange}
      />

      {!canReadTargets ? (
        <article className="fg-card">
          <h3>Provider target review unavailable</h3>
          <p className="fg-muted">This session does not hold provider_targets.read on the active instance scope, so ForgeFrame keeps the target register closed here.</p>
        </article>
      ) : null}

      {canReadTargets ? (
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Instance-Bound Target Register</h3>
            <p className="fg-muted">Targets are listed with runtime posture, priority, separated capability/trait/policy/economic axes, and fallback/escalation shape.</p>
          </div>
          <div className="fg-actions">
            <span className="fg-pill" data-tone={state === "success" ? "success" : state === "error" ? "danger" : "neutral"}>
              {state}
            </span>
            <button type="button" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>

        {!canMutate ? (
          <p className="fg-note fg-mb-sm">
            Target mutations stay hidden for viewer and read-only sessions. Runtime truth remains visible.
          </p>
        ) : null}
        {error ? <p className="fg-danger">{error}</p> : null}
        {state === "loading" ? <p className="fg-muted">Loading provider targets.</p> : null}
        {state === "success" && targets.length === 0 ? <p className="fg-muted">No provider targets are persisted for this instance.</p> : null}

        {targets.length > 0 ? (
          <div className="fg-card-grid">
            {targets.map((target) => (
              <article key={target.target_key} className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{target.label}</h4>
                    <p className="fg-muted">
                      {target.target_key} · model={target.model_display_name ?? target.model_id} · axis={target.product_axis}
                    </p>
                  </div>
                  <div className="fg-actions">
                    <span className="fg-pill" data-tone={target.enabled ? "success" : "warning"}>
                      {target.enabled ? "enabled" : "disabled"}
                    </span>
                    <span
                      className="fg-pill"
                      data-tone={target.readiness_status === "ready" ? "success" : target.readiness_status === "partial" ? "warning" : "neutral"}
                    >
                      {target.readiness_status}
                    </span>
                  </div>
                </div>

                <div className="fg-detail-grid">
                  <p>
                    provider={target.provider_label ?? target.provider} · auth={target.auth_type} · credential={target.credential_type}
                  </p>
                  <p>
                    priority={target.priority} · cost={target.cost_class} · latency={target.latency_class} · queue eligible={String(target.queue_eligible)}
                  </p>
                  <p>
                    stream={String(target.stream_capable)} · tools={String(target.tool_capable)} · vision={String(target.vision_capable)}
                  </p>
                  <p>technical capabilities={formatRecordEntries(target.technical_capabilities ?? {})}</p>
                  <p>execution traits={formatRecordEntries(target.execution_traits ?? {})}</p>
                  <p>policy flags={formatRecordEntries(target.policy_flags ?? {})}</p>
                  <p>economic profile={formatRecordEntries(target.economic_profile ?? {})}</p>
                  <p>
                    health={target.health_status} · availability={target.availability_status} · provider enabled={String(target.provider_enabled)} · model active={String(target.model_active)}
                  </p>
                  <p>
                    fallback={target.fallback_allowed ? target.fallback_target_keys.join(", ") || "allowed" : "blocked"} · escalation=
                    {target.escalation_allowed ? target.escalation_target_keys.join(", ") || "allowed" : "blocked"}
                  </p>
                  {target.status_reason ? <p className="fg-note">reason: {target.status_reason}</p> : null}
                  {target.runtime_readiness_reason ? <p className="fg-muted">runtime: {target.runtime_readiness_reason}</p> : null}
                </div>

                {canMutate ? (
                  <div className="fg-inline-form fg-mt-sm">
                    <label>
                      Priority
                      <input
                        value={priorityDrafts[target.target_key] ?? String(target.priority)}
                        onChange={(event) =>
                          setPriorityDrafts((current) => ({ ...current, [target.target_key]: event.target.value }))
                        }
                      />
                    </label>
                    <div className="fg-actions fg-actions-end">
                      <button
                        type="button"
                        onClick={() =>
                          void saveTarget(target, {
                            priority: Number(priorityDrafts[target.target_key] ?? target.priority),
                          })
                        }
                      >
                        Save priority
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void saveTarget(target, {
                            enabled: !target.enabled,
                          })
                        }
                      >
                        {target.enabled ? "Disable target" : "Enable target"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </article>
      ) : null}
    </section>
  );
}
