import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createInstance,
  fetchInstances,
  updateInstance,
  type InstanceReadinessSummary,
  type InstanceRecord,
  type InstanceSetupStatus,
} from "../api/admin";
import {
  sessionCanMutateInstance,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasInstancePermission,
} from "../app/adminAccess";
import { buildAgentsPath, buildConversationPath } from "../app/workInteractionRoutes";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";
type StatusFilter = InstanceRecord["status"] | "all";
type ModeFilter = InstanceRecord["deployment_mode"] | "all";
type ReadinessFilter = InstanceSetupStatus | "all";

type CreateResult = {
  instanceId: string;
  displayName: string;
  operatorCreated: boolean;
  operatorName: string | null;
};

const DEFAULT_CREATE_FORM = {
  instance_id: "",
  display_name: "",
  description: "",
  tenant_id: "",
  company_id: "",
  deployment_mode: "linux_host_native" as InstanceRecord["deployment_mode"],
  exposure_mode: "same_origin" as InstanceRecord["exposure_mode"],
};

function toneForSetupStatus(status: InstanceSetupStatus | null | undefined): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "ready":
      return "success";
    case "bridge-only":
    case "onboarding-only":
      return "warning";
    case "not-ready":
    case "unsupported":
      return "danger";
    default:
      return "neutral";
  }
}

function formatTimestamp(value: string | null | undefined): string {
  return value && value.trim() ? value : "n/a";
}

function scopeMatches(instance: InstanceRecord, filterValue: string): boolean {
  const normalized = filterValue.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return [instance.tenant_id, instance.company_id].some((value) => value.toLowerCase().includes(normalized));
}

function searchMatches(instance: InstanceRecord, searchValue: string): boolean {
  const normalized = searchValue.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return [
    instance.instance_id,
    instance.display_name,
    instance.description,
    instance.slug,
    instance.tenant_id,
    instance.company_id,
    instance.operator_agent?.display_name ?? "",
    instance.readiness?.reason ?? "",
  ].some((value) => value.toLowerCase().includes(normalized));
}

function formatReadinessSummary(readiness: InstanceReadinessSummary | null | undefined): string {
  if (!readiness) {
    return "Readiness unavailable.";
  }
  return `${readiness.ready_check_count}/${readiness.check_count} checks ready`;
}

function preferredTargetsLabel(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join(", ") : "none";
}

export function InstancesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { session, sessionReady } = useAppSession();
  const canCreateInstance = sessionCanMutateScopedOrAnyInstance(session, null, "instance.write");

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [instances, setInstances] = useState<InstanceRecord[]>([]);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<Partial<InstanceRecord>>({});
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [lastCreateResult, setLastCreateResult] = useState<CreateResult | null>(null);

  const setScopedInstance = (nextInstanceId: string | null, replace = false) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams, { replace });
  };

  const refreshInstances = async (preferredInstanceId?: string | null) => {
    const payload = await fetchInstances();
    setInstances(payload.instances);
    const targetInstanceId = preferredInstanceId ?? instanceId ?? payload.instances[0]?.instance_id ?? null;
    if (targetInstanceId) {
      setScopedInstance(targetInstanceId, true);
    }
    return payload.instances;
  };

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setError("");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setLoadState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          setScopedInstance(payload.instances[0].instance_id, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstances([]);
        setLoadState("error");
        setError(loadError instanceof Error ? loadError.message : "Instance inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredInstances = useMemo(() => {
    return instances.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (modeFilter !== "all" && item.deployment_mode !== modeFilter) {
        return false;
      }
      if (readinessFilter !== "all" && item.readiness?.status !== readinessFilter) {
        return false;
      }
      if (!scopeMatches(item, scopeFilter)) {
        return false;
      }
      return searchMatches(item, searchValue);
    });
  }, [instances, modeFilter, readinessFilter, scopeFilter, searchValue, statusFilter]);

  const hasActiveFilters = searchValue.trim().length > 0
    || scopeFilter.trim().length > 0
    || statusFilter !== "all"
    || modeFilter !== "all"
    || readinessFilter !== "all";

  const selectedInstance = useMemo(() => {
    if (instanceId) {
      return instances.find((item) => item.instance_id === instanceId) ?? null;
    }
    if (hasActiveFilters && filteredInstances.length === 0) {
      return null;
    }
    return filteredInstances[0] ?? instances[0] ?? null;
  }, [filteredInstances, hasActiveFilters, instanceId, instances]);

  const scopedInstanceFilteredOut = Boolean(
    instanceId
      && selectedInstance
      && !filteredInstances.some((item) => item.instance_id === selectedInstance.instance_id),
  );

  useEffect(() => {
    if (!selectedInstance) {
      setEditForm({});
      return;
    }
    setEditForm({
      display_name: selectedInstance.display_name,
      description: selectedInstance.description,
      status: selectedInstance.status,
      deployment_mode: selectedInstance.deployment_mode,
      exposure_mode: selectedInstance.exposure_mode,
      tenant_id: selectedInstance.tenant_id,
      company_id: selectedInstance.company_id,
    });
  }, [selectedInstance]);

  const canEditSelectedInstance = selectedInstance
    ? sessionCanMutateInstance(session, selectedInstance.instance_id, "instance.write")
    : false;
  const canOpenTargets = selectedInstance
    ? sessionHasInstancePermission(session, selectedInstance.instance_id, "provider_targets.read")
    : false;
  const canOpenRouting = selectedInstance
    ? sessionHasInstancePermission(session, selectedInstance.instance_id, "routing.read")
    : false;
  const canOpenConversations = selectedInstance
    ? (
      sessionHasInstancePermission(session, selectedInstance.instance_id, "execution.read")
      || sessionHasInstancePermission(session, selectedInstance.instance_id, "approvals.read")
    )
    : false;
  const canOpenApiKeys = selectedInstance
    ? (
      sessionHasInstancePermission(session, selectedInstance.instance_id, "security.read")
      || sessionHasInstancePermission(session, selectedInstance.instance_id, "security.write")
    )
    : false;

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateInstance) {
      return;
    }
    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createInstance({
        instance_id: createForm.instance_id || null,
        display_name: createForm.display_name,
        description: createForm.description,
        tenant_id: createForm.tenant_id || null,
        company_id: createForm.company_id || null,
        deployment_mode: createForm.deployment_mode,
        exposure_mode: createForm.exposure_mode,
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      setLastCreateResult({
        instanceId: payload.instance.instance_id,
        displayName: payload.instance.display_name,
        operatorCreated: payload.operator_agent_created,
        operatorName: payload.operator_agent.display_name,
      });
      await refreshInstances(payload.instance.instance_id);
      setMessage(
        payload.operator_agent_created
          ? `Instance ${payload.instance.display_name} created. Operator agent ${payload.operator_agent.display_name ?? "Operator"} was auto-created.`
          : `Instance ${payload.instance.display_name} created, but the Operator agent was not auto-created. This instance remains blocked until the agent exists.`,
      );
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Instance creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditSelectedInstance || !selectedInstance) {
      return;
    }
    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      const payload = await updateInstance(selectedInstance.instance_id, {
        display_name: typeof editForm.display_name === "string" ? editForm.display_name : undefined,
        description: typeof editForm.description === "string" ? editForm.description : undefined,
        tenant_id: typeof editForm.tenant_id === "string" ? editForm.tenant_id : undefined,
        company_id: typeof editForm.company_id === "string" ? editForm.company_id : undefined,
        status: editForm.status,
        deployment_mode: editForm.deployment_mode,
        exposure_mode: editForm.exposure_mode,
      });
      await refreshInstances(payload.instance.instance_id);
      setMessage(`Instance ${payload.instance.display_name} updated.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Instance update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const readyInstances = instances.filter((item) => item.readiness?.status === "ready").length;
  const defectiveInstances = instances.filter((item) => item.operator_agent?.status !== "ready").length;
  const selectedConversationRoute = selectedInstance
    ? buildConversationPath({
      instanceId: selectedInstance.instance_id,
      conversationId: selectedInstance.work_interaction?.latest_conversation_id ?? undefined,
    })
    : CONTROL_PLANE_ROUTES.conversations;

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Setup"
          title="Instances"
          description="Loading the instance registry before exposing setup and mutation paths."
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the command surface while access is restored." },
            { label: "Release / Validation", to: CONTROL_PLANE_ROUTES.releaseValidation, description: "Check readiness gates once scope is available." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Instances"
        description="Central instance management for setup state, operator ownership, and the next real actions after creation."
        question="Which instance is actually ready to operate, and what is still missing on the ones that are not?"
        links={[
          { label: "Provider Targets", to: CONTROL_PLANE_ROUTES.providerTargets, description: "Open target configuration for the selected instance." },
          { label: "Routing", to: CONTROL_PLANE_ROUTES.routing, description: "Open routing policy and budget state for the selected instance." },
          { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Open work interaction state for the selected instance." },
          { label: "Release / Validation", to: CONTROL_PLANE_ROUTES.releaseValidation, description: "Check readiness gates before go-live." },
        ]}
        badges={[
          { label: `${instances.length} instance${instances.length === 1 ? "" : "s"}`, tone: instances.length > 0 ? "success" : "warning" },
          { label: `${readyInstances} ready`, tone: readyInstances > 0 ? "success" : "warning" },
          { label: defectiveInstances > 0 ? `${defectiveInstances} operator defect${defectiveInstances === 1 ? "" : "s"}` : "Operators intact", tone: defectiveInstances > 0 ? "danger" : "success" },
          { label: canCreateInstance ? "Admin mutation enabled" : "Read only", tone: canCreateInstance ? "success" : "neutral" },
        ]}
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Instance Inventory</h3>
            <p className="fg-muted">Filter the real registry, select an instance, and branch into the next concrete setup action from the detail panel.</p>
          </div>
          <div className="fg-actions">
            <span className="fg-pill" data-tone={loadState === "success" ? "success" : loadState === "error" ? "danger" : "neutral"}>
              {loadState}
            </span>
            <button type="button" onClick={() => void refreshInstances(selectedInstance?.instance_id ?? instanceId)}>
              Refresh
            </button>
          </div>
        </div>

        <div className="fg-inline-form fg-mb-sm">
          <label>
            Search
            <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="ID, name, operator, reason" />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">all</option>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            Betriebsmodus
            <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value as ModeFilter)}>
              <option value="all">all</option>
              <option value="linux_host_native">linux_host_native</option>
              <option value="restricted_eval">restricted_eval</option>
              <option value="container_optional">container_optional</option>
            </select>
          </label>
          <label>
            Tenant / Organization
            <input value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)} placeholder="tenant or execution scope" />
          </label>
          <label>
            Readiness
            <select value={readinessFilter} onChange={(event) => setReadinessFilter(event.target.value as ReadinessFilter)}>
              <option value="all">all</option>
              <option value="ready">ready</option>
              <option value="not-ready">not-ready</option>
              <option value="bridge-only">bridge-only</option>
              <option value="onboarding-only">onboarding-only</option>
              <option value="unsupported">unsupported</option>
            </select>
          </label>
        </div>

        {loadState === "loading" ? <p className="fg-muted">Loading instance inventory.</p> : null}
        {loadState === "success" && instances.length === 0 ? <p className="fg-muted">No instances are recorded yet. Use the create form below to add the first one.</p> : null}
        {loadState === "success" && instances.length > 0 && filteredInstances.length === 0 ? <p className="fg-muted">No instances match the current filters.</p> : null}
        {scopedInstanceFilteredOut ? (
          <p className="fg-note">
            The current scoped instance <span className="fg-code">{selectedInstance?.instance_id}</span> is outside the filtered table. Clear or change filters to bring it back into the inventory list.
          </p>
        ) : null}

        {filteredInstances.length > 0 ? (
          <div className="fg-table-wrap">
            <table className="fg-table">
              <thead>
                <tr>
                  <th>Instance</th>
                  <th>Tenant / Execution</th>
                  <th>Mode</th>
                  <th>Readiness</th>
                  <th>Operator</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {filteredInstances.map((item) => {
                  const isSelected = item.instance_id === selectedInstance?.instance_id;
                  return (
                    <tr key={item.instance_id} className={isSelected ? "is-selected" : ""}>
                      <td>
                        <button className="fg-table-trigger" type="button" onClick={() => setScopedInstance(item.instance_id)}>
                          <strong>{item.display_name}</strong>
                        </button>
                        <div className="fg-muted">
                          <span className="fg-code">{item.instance_id}</span>
                          {item.is_default ? " · default" : ""}
                          {item.status === "disabled" ? " · disabled" : ""}
                        </div>
                      </td>
                      <td>
                        <div>{item.tenant_id}</div>
                        <div className="fg-muted">{item.company_id}</div>
                      </td>
                      <td>
                        <div>{item.deployment_mode}</div>
                        <div className="fg-muted">{item.exposure_mode}</div>
                      </td>
                      <td>
                        <span className="fg-pill" data-tone={toneForSetupStatus(item.readiness?.status)}>
                          {item.readiness?.status ?? "unknown"}
                        </span>
                        <div className="fg-muted">{formatReadinessSummary(item.readiness)}</div>
                      </td>
                      <td>
                        {item.operator_agent?.display_name ? <div>{item.operator_agent.display_name}</div> : <div className="fg-danger">Missing Operator</div>}
                        <div className="fg-muted">{item.operator_agent?.reason ?? "No operator detail."}</div>
                      </td>
                      <td>{formatTimestamp(item.last_activity_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Selected Instance</h3>
              <p className="fg-muted">Core identity, readiness checks, operator ownership, provider targets, routing, and work interaction status for the current scope.</p>
            </div>
            <span className="fg-pill" data-tone={toneForSetupStatus(selectedInstance?.readiness?.status)}>
              {selectedInstance?.readiness?.status ?? "No selection"}
            </span>
          </div>

          {!selectedInstance ? <p className="fg-muted">Select an instance from the table to inspect and update it.</p> : null}

          {selectedInstance ? (
            <div className="fg-stack">
              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{selectedInstance.display_name}</h4>
                    <p className="fg-muted"><span className="fg-code">{selectedInstance.instance_id}</span> · last activity {formatTimestamp(selectedInstance.last_activity_at)}</p>
                  </div>
                  <div className="fg-actions">
                    <span className="fg-pill" data-tone={selectedInstance.status === "active" ? "success" : "warning"}>{selectedInstance.status}</span>
                    {selectedInstance.is_default ? <span className="fg-pill" data-tone="neutral">default</span> : null}
                  </div>
                </div>
                <div className="fg-detail-grid">
                  <p>tenant / organization: {selectedInstance.tenant_id}</p>
                  <p>execution scope: {selectedInstance.company_id}</p>
                  <p>deployment mode: {selectedInstance.deployment_mode}</p>
                  <p>exposure mode: {selectedInstance.exposure_mode}</p>
                  <p>slug: {selectedInstance.slug}</p>
                  <p>description: {selectedInstance.description || "none"}</p>
                </div>
              </div>

              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Quick Actions</h4>
                    <p className="fg-muted">These links carry the selected instance in the URL so setup continues in the correct scope.</p>
                  </div>
                </div>
                <div className="fg-actions">
                  {canOpenTargets ? <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, selectedInstance.instance_id)}>Targets konfigurieren</Link> : null}
                  {canOpenRouting ? <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.routing, selectedInstance.instance_id)}>Edit routing</Link> : null}
                  {canOpenConversations ? <Link className="fg-nav-link" to={selectedConversationRoute}>Conversation öffnen</Link> : null}
                  {canOpenApiKeys ? <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.apiKeys, selectedInstance.instance_id)}>API-Key ausstellen</Link> : null}
                  <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.releaseValidation, selectedInstance.instance_id)}>Readiness prüfen</Link>
                  <Link className="fg-nav-link" to={buildAgentsPath({ instanceId: selectedInstance.instance_id })}>Open Agents</Link>
                </div>
              </div>

              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Readiness</h4>
                    <p className="fg-muted">This instance is scored from real operator, target, routing, runtime-access, and work-interaction state.</p>
                  </div>
                  <span className="fg-pill" data-tone={toneForSetupStatus(selectedInstance.readiness?.status)}>
                    {selectedInstance.readiness?.status ?? "unknown"}
                  </span>
                </div>
                <p>{selectedInstance.readiness?.reason ?? "No readiness summary is available."}</p>
                <ul className="fg-list">
                  {(selectedInstance.readiness?.checks ?? []).map((check) => (
                    <li key={check.id}>
                      {check.label} · {check.status} · {check.detail}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Operator Agent</h4>
                    <p className="fg-muted">An instance without the default Operator agent is a defective state and is called out here directly.</p>
                  </div>
                  <span className="fg-pill" data-tone={toneForSetupStatus(selectedInstance.operator_agent?.status)}>
                    {selectedInstance.operator_agent?.status ?? "unknown"}
                  </span>
                </div>
                <div className="fg-detail-grid">
                  <p>operator: {selectedInstance.operator_agent?.display_name ?? "missing"}</p>
                  <p>agent status: {selectedInstance.operator_agent?.agent_status ?? "n/a"}</p>
                  <p>agent id: {selectedInstance.operator_agent?.agent_id ?? "n/a"}</p>
                  <p>auto-created: {String(selectedInstance.operator_agent?.auto_created ?? false)}</p>
                  <p>allowed targets: {selectedInstance.operator_agent?.allowed_targets?.join(", ") || "none"}</p>
                  <p>{selectedInstance.operator_agent?.reason ?? "No operator summary is available."}</p>
                </div>
              </div>

              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Provider Targets</h4>
                    <p className="fg-muted">Ready targets and the current target leaders for this instance.</p>
                  </div>
                  <span className="fg-pill" data-tone={toneForSetupStatus(selectedInstance.provider_targets?.status)}>
                    {selectedInstance.provider_targets?.status ?? "unknown"}
                  </span>
                </div>
                <div className="fg-detail-grid">
                  <p>configured providers: {String(selectedInstance.provider_targets?.configured_provider_count ?? 0)}</p>
                  <p>targets: {String(selectedInstance.provider_targets?.enabled_targets ?? 0)} enabled / {String(selectedInstance.provider_targets?.ready_targets ?? 0)} ready</p>
                  <p>reason: {selectedInstance.provider_targets?.reason ?? "No target summary is available."}</p>
                  <p>last target activity: {formatTimestamp(selectedInstance.provider_targets?.last_activity_at)}</p>
                  <p>
                    primary targets: {selectedInstance.provider_targets?.primary_targets?.length
                      ? selectedInstance.provider_targets.primary_targets.map((target) => `${target.label ?? target.target_key} (${target.readiness_status ?? "unknown"})`).join(", ")
                      : "none"}
                  </p>
                </div>
              </div>

              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Routing Policy</h4>
                    <p className="fg-muted">Policy count, budget pressure, circuit state, and preferred targets remain visible here.</p>
                  </div>
                  <span className="fg-pill" data-tone={toneForSetupStatus(selectedInstance.routing?.status)}>
                    {selectedInstance.routing?.status ?? "unknown"}
                  </span>
                </div>
                <div className="fg-detail-grid">
                  <p>policies: {String(selectedInstance.routing?.policy_count ?? 0)}</p>
                  <p>open circuits: {String(selectedInstance.routing?.open_circuits ?? 0)}</p>
                  <p>hard budget blocked: {String(selectedInstance.routing?.hard_budget_blocked ?? false)}</p>
                  <p>blocked cost classes: {selectedInstance.routing?.blocked_cost_classes?.join(", ") || "none"}</p>
                  <p>simple preferred targets: {preferredTargetsLabel(selectedInstance.routing?.simple_preferred_target_keys)}</p>
                  <p>non-simple preferred targets: {preferredTargetsLabel(selectedInstance.routing?.non_simple_preferred_target_keys)}</p>
                  <p>reason: {selectedInstance.routing?.reason ?? "No routing summary is available."}</p>
                </div>
              </div>

              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Work Interaction</h4>
                    <p className="fg-muted">Mode, enabled lanes, and the latest conversation signal stay attached to the instance boundary.</p>
                  </div>
                  <span className="fg-pill" data-tone={toneForSetupStatus(selectedInstance.work_interaction?.status)}>
                    {selectedInstance.work_interaction?.status ?? "unknown"}
                  </span>
                </div>
                <div className="fg-detail-grid">
                  <p>mode: {selectedInstance.work_interaction?.mode ?? "not-configured"}</p>
                  <p>inbox/tasks/notifications: {String(selectedInstance.work_interaction?.inbox_enabled ?? false)} / {String(selectedInstance.work_interaction?.tasks_enabled ?? false)} / {String(selectedInstance.work_interaction?.notifications_enabled ?? false)}</p>
                  <p>conversations: {String(selectedInstance.work_interaction?.conversation_count ?? 0)} total / {String(selectedInstance.work_interaction?.open_conversation_count ?? 0)} open</p>
                  <p>latest conversation: {selectedInstance.work_interaction?.latest_conversation_subject ?? selectedInstance.work_interaction?.latest_conversation_id ?? "none"}</p>
                  <p>latest work activity: {formatTimestamp(selectedInstance.work_interaction?.latest_activity_at)}</p>
                  <p>reason: {selectedInstance.work_interaction?.reason ?? "No work-interaction summary is available."}</p>
                </div>
              </div>

              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Edit Instance</h4>
                    <p className="fg-muted">Update the canonical identity and operating posture for the selected instance.</p>
                  </div>
                  <span className="fg-pill" data-tone={canEditSelectedInstance ? "success" : "warning"}>
                    {canEditSelectedInstance ? "Writable" : "Read only"}
                  </span>
                </div>
                <form className="fg-stack" onSubmit={handleUpdate}>
                  <label>
                    Display name
                    <input value={typeof editForm.display_name === "string" ? editForm.display_name : ""} onChange={(event) => setEditForm((current) => ({ ...current, display_name: event.target.value }))} />
                  </label>
                  <label>
                    Description
                    <textarea rows={4} value={typeof editForm.description === "string" ? editForm.description : ""} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} />
                  </label>
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Tenant / Organization scope
                      <input value={typeof editForm.tenant_id === "string" ? editForm.tenant_id : ""} onChange={(event) => setEditForm((current) => ({ ...current, tenant_id: event.target.value }))} />
                    </label>
                    <label>
                      Execution scope
                      <input value={typeof editForm.company_id === "string" ? editForm.company_id : ""} onChange={(event) => setEditForm((current) => ({ ...current, company_id: event.target.value }))} />
                    </label>
                  </div>
                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Status
                      <select value={editForm.status ?? selectedInstance.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as InstanceRecord["status"] }))}>
                        <option value="active">active</option>
                        <option value="disabled">disabled</option>
                      </select>
                    </label>
                    <label>
                      Deployment mode
                      <select value={editForm.deployment_mode ?? selectedInstance.deployment_mode} onChange={(event) => setEditForm((current) => ({ ...current, deployment_mode: event.target.value as InstanceRecord["deployment_mode"] }))}>
                        <option value="linux_host_native">linux_host_native</option>
                        <option value="restricted_eval">restricted_eval</option>
                        <option value="container_optional">container_optional</option>
                      </select>
                    </label>
                    <label>
                      Exposure mode
                      <select value={editForm.exposure_mode ?? selectedInstance.exposure_mode} onChange={(event) => setEditForm((current) => ({ ...current, exposure_mode: event.target.value as InstanceRecord["exposure_mode"] }))}>
                        <option value="same_origin">same_origin</option>
                        <option value="local_only">local_only</option>
                        <option value="edge_admission">edge_admission</option>
                      </select>
                    </label>
                  </div>
                  <div className="fg-actions">
                    <button type="submit" disabled={!canEditSelectedInstance || savingUpdate}>
                      {savingUpdate ? "Saving instance" : "Save instance"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create Instance</h3>
              <p className="fg-muted">Create the instance boundary, then continue directly into targets, routing, conversations, API keys, and readiness work.</p>
            </div>
            <span className="fg-pill" data-tone={canCreateInstance ? "success" : "warning"}>{canCreateInstance ? "Writable" : "Admin only"}</span>
          </div>

          {lastCreateResult ? (
            <div className="fg-subcard fg-mb-sm">
              <div className="fg-panel-heading">
                <div>
                  <h4>Latest Create Result</h4>
                  <p className="fg-muted">{lastCreateResult.displayName}</p>
                </div>
                <span className="fg-pill" data-tone={lastCreateResult.operatorCreated ? "success" : "danger"}>
                  {lastCreateResult.operatorCreated ? "Operator created" : "Operator missing"}
                </span>
              </div>
              <p>
                {lastCreateResult.operatorCreated
                  ? `${lastCreateResult.operatorName ?? "Operator"} was auto-created for this instance.`
                  : "The Operator agent was not auto-created. Treat this as a hard blocker and repair the agent state before continuing."}
              </p>
              <div className="fg-actions">
                <Link className="fg-nav-link" to={buildAgentsPath({ instanceId: lastCreateResult.instanceId })}>Open Agents</Link>
                <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, lastCreateResult.instanceId)}>Targets konfigurieren</Link>
                <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.releaseValidation, lastCreateResult.instanceId)}>Readiness prüfen</Link>
              </div>
            </div>
          ) : null}

          <form className="fg-stack" onSubmit={handleCreate}>
            <label>
              Instance ID
              <input value={createForm.instance_id} onChange={(event) => setCreateForm((current) => ({ ...current, instance_id: event.target.value }))} placeholder="customer-prod" />
            </label>
            <label>
              Display name
              <input value={createForm.display_name} onChange={(event) => setCreateForm((current) => ({ ...current, display_name: event.target.value }))} placeholder="Customer Production" />
            </label>
            <label>
              Description
              <textarea rows={4} value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label>
              Tenant / Organization scope
              <input value={createForm.tenant_id} onChange={(event) => setCreateForm((current) => ({ ...current, tenant_id: event.target.value }))} placeholder="customer-prod" />
            </label>
            <label>
              Execution scope
              <input value={createForm.company_id} onChange={(event) => setCreateForm((current) => ({ ...current, company_id: event.target.value }))} placeholder="customer-prod" />
            </label>
            <label>
              Deployment mode
              <select value={createForm.deployment_mode} onChange={(event) => setCreateForm((current) => ({ ...current, deployment_mode: event.target.value as InstanceRecord["deployment_mode"] }))}>
                <option value="linux_host_native">linux_host_native</option>
                <option value="restricted_eval">restricted_eval</option>
                <option value="container_optional">container_optional</option>
              </select>
            </label>
            <label>
              Exposure mode
              <select value={createForm.exposure_mode} onChange={(event) => setCreateForm((current) => ({ ...current, exposure_mode: event.target.value as InstanceRecord["exposure_mode"] }))}>
                <option value="same_origin">same_origin</option>
                <option value="local_only">local_only</option>
                <option value="edge_admission">edge_admission</option>
              </select>
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canCreateInstance || savingCreate}>
                {savingCreate ? "Creating instance" : "Create instance"}
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
}
