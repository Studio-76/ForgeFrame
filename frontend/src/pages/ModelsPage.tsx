import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { fetchModelRegister, type AdminModelRegisterRecord } from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

export function ModelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [models, setModels] = useState<AdminModelRegisterRecord[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setError("");

    void fetchModelRegister(instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setModels(payload.models);
        setState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setModels([]);
        setState("error");
        setError(loadError instanceof Error ? loadError.message : "Model register could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const readyModels = models.filter((model) => model.runtime_status === "ready").length;
  const coverageModels = models.filter((model) => model.target_count > 0).length;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Models Register"
        description="Persistent model truth stays separate from provider onboarding and from instance-bound targets. This surface shows the product model register the router can actually build on."
        question="Which model entries are truly routable for this instance, and which are just stale or partial inventory?"
        links={[
          {
            label: "Providers",
            to: CONTROL_PLANE_ROUTES.providers,
            description: "Return to provider onboarding, health, harness, and expansion truth.",
          },
          {
            label: "Provider Targets",
            to: CONTROL_PLANE_ROUTES.providerTargets,
            description: "Inspect the instance-bound targets layered on top of these models.",
          },
        ]}
        badges={[
          { label: `${readyModels} runtime-ready`, tone: readyModels > 0 ? "success" : "warning" },
          { label: `${coverageModels}/${models.length || 0} with targets`, tone: coverageModels === models.length && models.length > 0 ? "success" : "warning" },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
          ...(session ? [{ label: `Session: ${session.role}`, tone: session.read_only ? "warning" as const : "neutral" as const }] : []),
        ]}
        note="A model entry without routing key, capability profile, target coverage, or live availability truth is not treated as complete here."
      />
      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="model register truth"
        onInstanceChange={onInstanceChange}
      />

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Persistent Model Register</h3>
            <p className="fg-muted">Routing keys, capability profiles, availability, and target coverage are shown directly from the admin register.</p>
          </div>
          <span className="fg-pill" data-tone={state === "success" ? "success" : state === "error" ? "danger" : "neutral"}>
            {state}
          </span>
        </div>

        {error ? <p className="fg-danger">{error}</p> : null}
        {state === "loading" ? <p className="fg-muted">Loading model register.</p> : null}
        {state === "success" && models.length === 0 ? <p className="fg-muted">No models are persisted for this instance.</p> : null}

        {models.length > 0 ? (
          <div className="fg-card-grid">
            {models.map((model) => (
              <article key={`${model.provider}:${model.model_id}`} className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{model.display_name}</h4>
                    <p className="fg-muted">
                      {model.provider_label} ({model.provider}) · routing key={model.routing_key}
                    </p>
                  </div>
                  <div className="fg-actions">
                    <span className="fg-pill" data-tone={model.active ? "success" : "warning"}>
                      {model.active ? "active" : "inactive"}
                    </span>
                    <span className="fg-pill" data-tone={model.runtime_status === "ready" ? "success" : model.runtime_status === "partial" ? "warning" : "neutral"}>
                      runtime {model.runtime_status}
                    </span>
                  </div>
                </div>

                <div className="fg-detail-grid">
                  <p>
                    availability={model.availability_status} · health={model.health_status} · source={model.source} · discovery={model.discovery_status}
                  </p>
                  <p>
                    category={model.category} · owned_by={model.owned_by} · target coverage={model.active_target_count}/{model.target_count}
                  </p>
                  <p>capabilities={formatList(Object.keys(model.capabilities ?? {}))}</p>
                  <p>target keys={formatList(model.target_keys)}</p>
                  {model.status_reason ? <p className="fg-note">reason: {model.status_reason}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
