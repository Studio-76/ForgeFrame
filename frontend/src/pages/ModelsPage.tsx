import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchModelRegister, syncProviders, type AdminModelRegisterRecord } from "../api/admin";
import { getScopedAdminInstanceId, sessionCanMutateScopedOrAnyInstance } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withQueryParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EntityTable, type EntityTableColumn } from "../components/ui/EntityTable";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip } from "../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";
type SyncState = "idle" | "submitting" | "success" | "error";
type StatusFilter = "all" | AdminModelRegisterRecord["routing_status"];
type TrustFilter = "all" | AdminModelRegisterRecord["trust_status"];

function modelKey(model: AdminModelRegisterRecord): string {
  return `${model.provider}:${model.model_id}`;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().replace(".000Z", "Z").replace("T", " ");
}

function humanize(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  return value.replace(/[_-]+/g, " ");
}

function titleCase(value: string | null | undefined): string {
  return humanize(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function capabilityLabel(value: string): string {
  return {
    tool_calling: "Tool calling",
    queue_eligible: "Queue eligible",
    discovery_support: "Discovery support",
  }[value] ?? titleCase(value);
}

function formatCapabilityList(values: string[]): string {
  return values.length > 0 ? values.map(capabilityLabel).join(", ") : "Declared profile missing";
}

function formatRecordEntries(values: Record<string, unknown>): string {
  const entries = Object.entries(values ?? {});
  return entries.length > 0
    ? entries.map(([key, value]) => `${key}=${String(value)}`).join(" · ")
    : "none";
}

function toneFromRoutingStatus(status: AdminModelRegisterRecord["routing_status"]): StatusTone {
  switch (status) {
    case "routable":
      return "success";
    case "degraded":
    case "no_target_coverage":
      return "warning";
    case "stale":
    case "removed":
    case "disabled":
      return "danger";
    default:
      return "neutral";
  }
}

function contractStatusFromRoutingStatus(status: AdminModelRegisterRecord["routing_status"]): string {
  switch (status) {
    case "routable":
      return "ready";
    case "degraded":
      return "degraded";
    case "stale":
      return "partial";
    case "removed":
      return "unsupported";
    case "disabled":
    case "no_target_coverage":
    default:
      return "blocked";
  }
}

function toneFromTrustStatus(status: AdminModelRegisterRecord["trust_status"]): StatusTone {
  switch (status) {
    case "tested":
      return "success";
    case "observed":
      return "info";
    case "verification_failed":
      return "danger";
    default:
      return "warning";
  }
}

function toneFromEvidenceStatus(status: string): StatusTone {
  switch (status) {
    case "observed":
      return "success";
    case "failed":
      return "danger";
    case "not_applicable":
      return "neutral";
    default:
      return "warning";
  }
}

function renderEvidenceBadge(label: string, status: string) {
  return (
    <StatusBadge tone={toneFromEvidenceStatus(status)} status={status}>
      {label}
    </StatusBadge>
  );
}

export function ModelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [models, setModels] = useState<AdminModelRegisterRecord[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [trustFilter, setTrustFilter] = useState<TrustFilter>("all");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");

  const canMutateProviderDiscovery = sessionCanMutateScopedOrAnyInstance(session, scopedInstanceId, "providers.write");

  const load = async () => {
    setState("loading");
    setError("");
    try {
      const payload = await fetchModelRegister(instanceId);
      setModels(payload.models);
      setSummary(payload.summary ?? {});
      setState("success");
    } catch (loadError: unknown) {
      setModels([]);
      setSummary({});
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Model register could not be loaded.");
    }
  };

  useEffect(() => {
    void load();
  }, [instanceId]);

  useEffect(() => {
    if (models.length === 0) {
      setSelectedModelKey(null);
      return;
    }
    if (!selectedModelKey || !models.some((item) => modelKey(item) === selectedModelKey)) {
      setSelectedModelKey(modelKey(models[0]));
    }
  }, [models, selectedModelKey]);

  const providerOptions = useMemo(
    () => ["all", ...Array.from(new Set(models.map((item) => item.provider))).sort()],
    [models],
  );
  const capabilityOptions = useMemo(
    () => ["all", ...Array.from(new Set(models.flatMap((item) => item.declared_capability_keys))).sort()],
    [models],
  );

  const filteredModels = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return models.filter((model) => {
      if (providerFilter !== "all" && model.provider !== providerFilter) {
        return false;
      }
      if (capabilityFilter !== "all" && !model.declared_capability_keys.includes(capabilityFilter)) {
        return false;
      }
      if (statusFilter !== "all" && model.routing_status !== statusFilter) {
        return false;
      }
      if (trustFilter !== "all" && model.trust_status !== trustFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        model.display_name,
        model.model_id,
        model.provider,
        model.provider_label,
        model.routing_key,
        model.owned_by,
      ].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [capabilityFilter, models, providerFilter, searchValue, statusFilter, trustFilter]);

  useEffect(() => {
    if (filteredModels.length === 0) {
      return;
    }
    if (!selectedModelKey || !filteredModels.some((item) => modelKey(item) === selectedModelKey)) {
      setSelectedModelKey(modelKey(filteredModels[0]));
    }
  }, [filteredModels, selectedModelKey]);

  const selectedModel = useMemo(
    () => filteredModels.find((item) => modelKey(item) === selectedModelKey) ?? filteredModels[0] ?? null,
    [filteredModels, selectedModelKey],
  );

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const handleSyncSelectedProvider = async () => {
    if (!selectedModel || !selectedModel.sync.available || !canMutateProviderDiscovery) {
      return;
    }
    setSyncState("submitting");
    setSyncMessage("");
    try {
      const payload = await syncProviders(selectedModel.provider, instanceId);
      setSyncState("success");
      setSyncMessage(`Synced ${payload.synced_providers.join(", ")} at ${formatTimestamp(payload.sync_at)}.`);
      await load();
    } catch (actionError: unknown) {
      setSyncState("error");
      setSyncMessage(actionError instanceof Error ? actionError.message : "Provider model sync failed.");
    }
  };

  const tableColumns = useMemo<EntityTableColumn<AdminModelRegisterRecord>[]>(() => [
    {
      key: "model",
      header: "Model",
      render: (model) => (
        <div>
          <button className="fg-table-trigger" type="button" onClick={() => setSelectedModelKey(modelKey(model))}>
            {model.display_name}
          </button>
          <p className="fg-muted">{model.model_id} · {model.owned_by}</p>
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (model) => (
        <div>
          <Link to={withQueryParams(CONTROL_PLANE_ROUTES.providers, { instanceId })}>{model.provider_label}</Link>
          <p className="fg-muted">{titleCase(model.provider_integration_class)}</p>
        </div>
      ),
    },
    {
      key: "routing",
      header: "Routing key",
      render: (model) => (
        <div>
          <code>{model.routing_key}</code>
          <p className="fg-muted">
            {model.routing_policy_classes.length > 0
              ? `Policies: ${model.routing_policy_classes.map(titleCase).join(", ")}`
              : "No explicit routing policy references"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (model) => (
        <div>
          <div className="fg-actions">
            <StatusBadge tone={toneFromRoutingStatus(model.routing_status)} status={model.routing_status}>
              {titleCase(model.routing_status)}
            </StatusBadge>
            <StatusBadge tone={toneFromTrustStatus(model.trust_status)} status={model.trust_status}>
              {titleCase(model.trust_status)}
            </StatusBadge>
          </div>
          <p className="fg-muted">{model.routing_reason}</p>
        </div>
      ),
    },
    {
      key: "capability_profile",
      header: "Capability profile",
      render: (model) => (
        <div>
          <p>{formatCapabilityList(model.declared_capability_keys)}</p>
          <p className="fg-muted">
            runtime={model.runtime_status} · health={model.health_status}
          </p>
        </div>
      ),
    },
    {
      key: "trust",
      header: "Source / trust",
      render: (model) => (
        <div>
          <p>
            {titleCase(model.source)} · {titleCase(model.discovery_status)}
          </p>
          <p className="fg-muted">
            sync={titleCase(model.provider_last_sync_status)} · last discovery {formatTimestamp(model.last_seen_at)}
          </p>
        </div>
      ),
    },
    {
      key: "coverage",
      header: "Target coverage",
      render: (model) => (
        <div>
          <p>{model.routing_target_count}/{model.target_count} routable targets</p>
          <p className="fg-muted">
            {model.routing_ready
              ? `${model.active_target_count} enabled targets`
              : "Model is not routing-capable on this instance"}
          </p>
        </div>
      ),
    },
  ], [instanceId]);

  const providerRoute = withQueryParams(CONTROL_PLANE_ROUTES.providers, { instanceId });
  const providerTargetsRoute = withQueryParams(CONTROL_PLANE_ROUTES.providerTargets, { instanceId });
  const routingRoute = withQueryParams(CONTROL_PLANE_ROUTES.routing, { instanceId });

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Models Register"
        description="Models are the routing and target truth for the selected instance. This register separates declared catalog metadata from observed runtime evidence and from test-verified provider checks."
        question="Which model entries are genuinely routable right now, which are stale or removed, and what capability trust backs each one?"
        badges={[
          { label: `${summary.routable_models ?? 0} routable`, tone: (summary.routable_models ?? 0) > 0 ? "success" : "warning" },
          { label: `${summary.tested_models ?? 0} tested`, tone: (summary.tested_models ?? 0) > 0 ? "success" : "warning" },
          { label: `${summary.uncovered_models ?? 0} uncovered`, tone: (summary.uncovered_models ?? 0) === 0 ? "success" : "warning" },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
          ...(session ? [{ label: canMutateProviderDiscovery ? `${session.role} provider sync enabled` : "Read-only model review", tone: canMutateProviderDiscovery ? "success" as const : "warning" as const }] : []),
        ]}
        note="A model without routing-capable targets, observed runtime evidence, or verified provider checks is kept visible as register truth, but not presented as healthy routing inventory."
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
      <ActionBar
        title="Adjacent model surfaces"
        description="Open another setup route only when the next question leaves the model register itself."
      >
        <div className="fg-actions">
          <Link className="fg-nav-link" to={providerRoute}>Providers</Link>
          <Link className="fg-nav-link" to={providerTargetsRoute}>Provider Targets</Link>
          <Link className="fg-nav-link" to={routingRoute}>Routing</Link>
        </div>
      </ActionBar>

      <SummaryStrip
        items={[
          {
            key: "total",
            label: "Total models",
            value: summary.total_models ?? models.length,
            meta: "Persisted register entries for the selected instance scope.",
          },
          {
            key: "routable",
            label: "Routing-ready",
            value: summary.routable_models ?? models.filter((item) => item.routing_ready).length,
            status: (summary.routable_models ?? 0) > 0 ? "ready" : "degraded",
            meta: "Models with at least one currently routing-eligible provider target.",
          },
          {
            key: "tested",
            label: "Test-verified",
            value: summary.tested_models ?? models.filter((item) => item.trust_status === "tested").length,
            status: (summary.tested_models ?? 0) > 0 ? "ready" : "partial",
            meta: "Backed by sync, health, or live probe evidence instead of declaration alone.",
          },
          {
            key: "uncovered",
            label: "No routing coverage",
            value: summary.uncovered_models ?? models.filter((item) => item.routing_target_count === 0).length,
            status: (summary.uncovered_models ?? 0) === 0 ? "ready" : "degraded",
            meta: "Models that exist in the register but currently have no routing-capable target.",
          },
        ]}
      />

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Filter register truth</h3>
            <p className="fg-muted">Search by model, provider, owner, or routing key. Narrow the surface by capability, routing status, and trust depth.</p>
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
        <div className="fg-inline-form" aria-label="Models register filters">
          <label>
            Search models
            <input
              aria-label="Search models"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="gpt-4.1, shared-model, openai_api/..."
            />
          </label>
          <label>
            Filter by provider
            <select aria-label="Filter by provider" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
              {providerOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All providers" : item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter by capability
            <select aria-label="Filter by capability" value={capabilityFilter} onChange={(event) => setCapabilityFilter(event.target.value)}>
              {capabilityOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All capabilities" : capabilityLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter by routing status
            <select
              aria-label="Filter by routing status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All routing states</option>
              <option value="routable">Routable</option>
              <option value="degraded">Degraded</option>
              <option value="no_target_coverage">No target coverage</option>
              <option value="stale">Stale</option>
              <option value="removed">Removed</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label>
            Filter by trust
            <select aria-label="Filter by trust" value={trustFilter} onChange={(event) => setTrustFilter(event.target.value as TrustFilter)}>
              <option value="all">All trust states</option>
              <option value="tested">Tested</option>
              <option value="observed">Observed</option>
              <option value="declared_only">Declared only</option>
              <option value="verification_failed">Verification failed</option>
            </select>
          </label>
        </div>
      </article>

      <div className="ff-operator-layout">
        <div className="ff-operator-main">
          {state === "loading" ? (
            <LoadingState title="Loading model register" description="Fetching the latest routing, target, sync, and evidence truth for this instance." />
          ) : null}
          {state === "error" ? (
            <ErrorState title="Model register failed to load" description={error || "Model register could not be loaded."} action={<button type="button" onClick={() => void load()}>Retry</button>} />
          ) : null}
          {state === "success" ? (
            <EntityTable
              title="Persistent model register"
              description="Each row combines catalog declaration, routing posture, trust depth, discovery sync, and target coverage."
              columns={tableColumns}
              rows={filteredModels}
              rowKey={modelKey}
              getRowClassName={(row) => (selectedModel && modelKey(row) === modelKey(selectedModel) ? "is-selected" : undefined)}
              emptyTitle="No models match the current filters"
              emptyDescription="Adjust provider, capability, status, or trust filters to bring matching register entries back into view."
              tableLabel="Models register table"
              footer={(
                <p className="fg-muted">
                  Showing {filteredModels.length} of {models.length} persisted model records for the selected instance.
                </p>
              )}
            />
          ) : null}
        </div>

        <div className="ff-operator-sidebar">
          {selectedModel ? (
            <DetailPanel
              title={selectedModel.display_name}
              description={`${selectedModel.provider_label} · ${selectedModel.routing_key}`}
              status={titleCase(selectedModel.routing_status)}
              statusTone={toneFromRoutingStatus(selectedModel.routing_status)}
              statusKey={contractStatusFromRoutingStatus(selectedModel.routing_status)}
              sticky
              actions={(
                <div className="fg-actions">
                  <Link to={providerRoute}>Provider</Link>
                  <Link to={providerTargetsRoute}>Provider Targets</Link>
                  <Link to={routingRoute}>Routing Policy</Link>
                </div>
              )}
            >
              <dl>
                <div>
                  <dt>Trust</dt>
                  <dd>
                    <div className="fg-actions">
                      <StatusBadge tone={toneFromTrustStatus(selectedModel.trust_status)} status={selectedModel.trust_status}>
                        {titleCase(selectedModel.trust_status)}
                      </StatusBadge>
                    </div>
                    <p className="fg-muted">{selectedModel.trust_reason}</p>
                  </dd>
                </div>
                <div>
                  <dt>Routing coverage</dt>
                  <dd>
                    {selectedModel.routing_target_count}/{selectedModel.target_count} routing-eligible targets
                    <p className="fg-muted">{selectedModel.routing_reason}</p>
                  </dd>
                </div>
                <div>
                  <dt>Discovery / sync</dt>
                  <dd>
                    {titleCase(selectedModel.source)} · {titleCase(selectedModel.discovery_status)} · sync {titleCase(selectedModel.provider_last_sync_status)}
                    <p className="fg-muted">{selectedModel.provider_last_sync_error ?? selectedModel.sync.detail}</p>
                  </dd>
                </div>
                <div>
                  <dt>Last discovery</dt>
                  <dd>{formatTimestamp(selectedModel.last_seen_at)}</dd>
                </div>
                <div>
                  <dt>Last probe</dt>
                  <dd>{formatTimestamp(selectedModel.last_probe_at)}</dd>
                </div>
              </dl>

              <h4>Declared capability profile</h4>
              <dl>
                <div>
                  <dt>Declared capabilities</dt>
                  <dd>{formatCapabilityList(selectedModel.declared_capability_keys)}</dd>
                </div>
                <div>
                  <dt>Execution traits</dt>
                  <dd>{formatRecordEntries(selectedModel.execution_traits)}</dd>
                </div>
                <div>
                  <dt>Policy flags</dt>
                  <dd>{formatRecordEntries(selectedModel.policy_flags)}</dd>
                </div>
                <div>
                  <dt>Economic profile</dt>
                  <dd>{formatRecordEntries(selectedModel.economic_profile)}</dd>
                </div>
              </dl>

              <h4>Observed runtime evidence</h4>
              <dl>
                <div>
                  <dt>Runtime</dt>
                  <dd>
                    {renderEvidenceBadge("Runtime", selectedModel.evidence.runtime.status)}
                    <p className="fg-muted">{selectedModel.evidence.runtime.details}</p>
                  </dd>
                </div>
                <div>
                  <dt>Streaming</dt>
                  <dd>
                    {renderEvidenceBadge("Streaming", selectedModel.evidence.streaming.status)}
                    <p className="fg-muted">{selectedModel.evidence.streaming.details}</p>
                  </dd>
                </div>
                <div>
                  <dt>Tool calling</dt>
                  <dd>
                    {renderEvidenceBadge("Tool calling", selectedModel.evidence.tool_calling.status)}
                    <p className="fg-muted">{selectedModel.evidence.tool_calling.details}</p>
                  </dd>
                </div>
              </dl>

              <h4>Test-verified evidence</h4>
              <dl>
                {Object.entries(selectedModel.tested_evidence).map(([key, value]) => (
                  <div key={key}>
                    <dt>{titleCase(key)}</dt>
                    <dd>
                      {renderEvidenceBadge(titleCase(value.status), value.status)}
                      <p className="fg-muted">{value.details}</p>
                      <p className="fg-muted">{formatTimestamp(value.recorded_at)}</p>
                    </dd>
                  </div>
                ))}
              </dl>

              <h4>Linked targets</h4>
              {selectedModel.linked_targets.length > 0 ? (
                <ul>
                  {selectedModel.linked_targets.map((target) => (
                    <li key={target.target_key}>
                      <strong>{target.label}</strong> ({target.target_key}) - priority {target.priority}
                      <div className="fg-actions">
                        <StatusBadge tone={target.routing_eligible ? "success" : "warning"} status={target.routing_eligible ? "ready" : "partial"}>
                          {target.routing_eligible ? "routing eligible" : "not routing eligible"}
                        </StatusBadge>
                        <StatusBadge tone={target.enabled ? "success" : "warning"} status={target.enabled ? "ready" : "blocked"}>
                          {target.enabled ? "enabled" : "disabled"}
                        </StatusBadge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No target coverage"
                  description="This model has no instance-bound provider target. It stays visible as register truth but is not routing-capable."
                />
              )}

              <h4>Routing policy references</h4>
              {selectedModel.routing_policy_classes.length > 0 ? (
                <ul>
                  {selectedModel.routing_policy_classes.map((item) => (
                    <li key={item}>{titleCase(item)}</li>
                  ))}
                </ul>
              ) : (
                <p className="fg-muted">No simple or non-simple routing policy currently references this model's targets explicitly.</p>
              )}

              <h4>Discovery sync action</h4>
              {selectedModel.sync.available ? (
                <div className="fg-actions">
                  {canMutateProviderDiscovery ? (
                    <button type="button" disabled={syncState === "submitting"} onClick={() => void handleSyncSelectedProvider()}>
                      {syncState === "submitting" ? "Syncing provider inventory" : "Sync provider inventory"}
                    </button>
                  ) : null}
                  <p className="fg-muted">{selectedModel.sync.detail}</p>
                </div>
              ) : (
                <p className="fg-muted">{selectedModel.sync.detail}</p>
              )}
              {!canMutateProviderDiscovery ? (
                <p className="fg-note">Provider discovery sync requires `providers.write` on the selected instance.</p>
              ) : null}
              {syncMessage ? <p className={syncState === "error" ? "fg-danger" : "fg-note"}>{syncMessage}</p> : null}
            </DetailPanel>
          ) : state === "loading" ? (
            <LoadingState title="Preparing model detail" description="Waiting for model register rows before rendering the detail surface." />
          ) : (
            <EmptyState title="No model selected" description="Pick a register row to inspect declared profile, observed runtime evidence, verified checks, and linked routing targets." />
          )}
        </div>
      </div>
    </section>
  );
}
