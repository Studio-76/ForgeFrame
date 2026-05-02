/**
 * Instances management page.
 * Delegates to the features/instances module for all UI sections.
 * Acts as a thin delegate composing the feature components with app state.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createInstance,
  fetchInstances,
  updateInstance,
  type InstanceRecord,
} from "../api/domain/instances";
import {
  sessionCanMutateInstance,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasInstancePermission,
} from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { PageIntro } from "../components/PageIntro";

import {
  InstanceReadinessHero,
  InstanceRemediationChecklist,
  InstancePassedChecks,
  InstanceActionBar,
  InstanceAdvancedDiagnostics,
  InstanceEditForm,
  InstanceInventoryTable,
  InstanceCreateForm,
  type CreateResult,
  type LoadState,
  type ModeFilter,
  type ReadinessFilter,
  type StatusFilter,
  buildBlockerChecklist,
  getInstanceBlocker,
  DEFAULT_CREATE_FORM,
  scopeMatches,
  searchMatches,
} from "../features/instances";

export function InstancesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { session, sessionReady } = useAppSession();
  const canCreateInstance = sessionCanMutateScopedOrAnyInstance(
    session,
    null,
    "instance.write",
  );

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
  const [readinessFilter, setReadinessFilter] =
    useState<ReadinessFilter>("all");
  const [lastCreateResult, setLastCreateResult] =
    useState<CreateResult | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] =
    useState(false);

  const setScopedInstance = (
    nextInstanceId: string | null,
    replace = false,
  ) => {
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
    const targetInstanceId =
      preferredInstanceId ??
      instanceId ??
      payload.instances[0]?.instance_id ??
      null;
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
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Instance inventory could not be loaded.",
        );
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
      if (
        readinessFilter !== "all" &&
        item.readiness?.status !== readinessFilter
      ) {
        return false;
      }
      if (!scopeMatches(item, scopeFilter)) {
        return false;
      }
      return searchMatches(item, searchValue);
    });
  }, [instances, modeFilter, readinessFilter, scopeFilter, searchValue, statusFilter]);

  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    scopeFilter.trim().length > 0 ||
    statusFilter !== "all" ||
    modeFilter !== "all" ||
    readinessFilter !== "all";

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
    instanceId &&
      selectedInstance &&
      !filteredInstances.some(
        (item) => item.instance_id === selectedInstance.instance_id,
      ),
  );

  useEffect(() => {
    if (!selectedInstance) {
      setEditForm({});
      setEditMode(false);
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
    setEditMode(false);
  }, [selectedInstance]);

  const canEditSelectedInstance = selectedInstance
    ? sessionCanMutateInstance(session, selectedInstance.instance_id, "instance.write")
    : false;
  const canOpenTargets = selectedInstance
    ? sessionHasInstancePermission(
        session,
        selectedInstance.instance_id,
        "provider_targets.read",
      )
    : false;
  const canOpenRouting = selectedInstance
    ? sessionHasInstancePermission(
        session,
        selectedInstance.instance_id,
        "routing.read",
      )
    : false;
  const canOpenConversations = selectedInstance
    ? sessionHasInstancePermission(
        session,
        selectedInstance.instance_id,
        "execution.read",
      ) || sessionHasInstancePermission(session, selectedInstance.instance_id, "approvals.read")
    : false;
  const canOpenApiKeys = selectedInstance
    ? sessionHasInstancePermission(
        session,
        selectedInstance.instance_id,
        "security.read",
      ) || sessionHasInstancePermission(session, selectedInstance.instance_id, "security.write")
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
      setError(
        createError instanceof Error
          ? createError.message
          : "Instance creation failed.",
      );
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
        display_name:
          typeof editForm.display_name === "string"
            ? editForm.display_name
            : undefined,
        description:
          typeof editForm.description === "string"
            ? editForm.description
            : undefined,
        tenant_id:
          typeof editForm.tenant_id === "string"
            ? editForm.tenant_id
            : undefined,
        company_id:
          typeof editForm.company_id === "string"
            ? editForm.company_id
            : undefined,
        status: editForm.status,
        deployment_mode: editForm.deployment_mode,
        exposure_mode: editForm.exposure_mode,
      });
      await refreshInstances(payload.instance.instance_id);
      setMessage(`Instance ${payload.instance.display_name} updated.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Instance update failed.",
      );
    } finally {
      setSavingUpdate(false);
    }
  };

  const readyInstances = instances.filter(
    (item) => item.readiness?.status === "ready",
  ).length;
  const defectiveInstances = instances.filter(
    (item) => item.operator_agent?.status !== "ready",
  ).length;

  const { blockers: blockerChecks, passed: passedChecks } =
    selectedInstance
      ? buildBlockerChecklist(selectedInstance)
      : { blockers: [], passed: [] };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Setup"
          title="Instances"
          description="Loading the instance registry before exposing setup and mutation paths."
          links={[
            {
              label: "Command Center",
              to: CONTROL_PLANE_ROUTES.dashboard,
              description:
                "Return to the command surface while access is restored.",
            },
            {
              label: "Release / Validation",
              to: CONTROL_PLANE_ROUTES.releaseValidation,
              description:
                "Check readiness gates once scope is available.",
            },
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
          {
            label: "Provider Targets",
            to: CONTROL_PLANE_ROUTES.providerTargets,
            description:
              "Open target configuration for the selected instance.",
          },
          {
            label: "Routing",
            to: CONTROL_PLANE_ROUTES.routing,
            description:
              "Open routing policy and budget state for the selected instance.",
          },
          {
            label: "Conversations",
            to: CONTROL_PLANE_ROUTES.conversations,
            description:
              "Open work interaction state for the selected instance.",
          },
          {
            label: "Release / Validation",
            to: CONTROL_PLANE_ROUTES.releaseValidation,
            description: "Check readiness gates before go-live.",
          },
        ]}
        badges={[
          {
            label: `${instances.length} instance${instances.length === 1 ? "" : "s"}`,
            tone: instances.length > 0 ? "success" : "warning",
          },
          {
            label: `${readyInstances} ready`,
            tone: readyInstances > 0 ? "success" : "warning",
          },
          {
            label:
              defectiveInstances > 0
                ? `${defectiveInstances} operator defect${defectiveInstances === 1 ? "" : "s"}`
                : "Operators intact",
            tone: defectiveInstances > 0 ? "danger" : "success",
          },
          {
            label: canCreateInstance ? "Admin mutation enabled" : "Read only",
            tone: canCreateInstance ? "success" : "neutral",
          },
        ]}
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      {/* ── Instance Inventory ── */}
      <InstanceInventoryTable
        loadState={loadState}
        instances={instances}
        filteredInstances={filteredInstances}
        selectedInstance={selectedInstance}
        searchValue={searchValue}
        statusFilter={statusFilter}
        modeFilter={modeFilter}
        readinessFilter={readinessFilter}
        scopeFilter={scopeFilter}
        scopedInstanceFilteredOut={scopedInstanceFilteredOut}
        onRefresh={() =>
          void refreshInstances(selectedInstance?.instance_id ?? instanceId)
        }
        onSelectInstance={(id) => setScopedInstance(id)}
        onSearchChange={setSearchValue}
        onStatusFilterChange={setStatusFilter}
        onModeFilterChange={setModeFilter}
        onReadinessFilterChange={setReadinessFilter}
        onScopeFilterChange={setScopeFilter}
      />

      {/* ── Create Instance Button ── */}
      <div className="ff-action-controls fg-mb-sm">
        {canCreateInstance ? (
          <button
            type="button"
            onClick={() => setShowCreateSection((current) => !current)}
          >
            {showCreateSection ? "Close create form" : "Create Instance"}
          </button>
        ) : null}
      </div>

      {/* ── Selected Instance Details ── */}
      {selectedInstance ? (
        <>
          {/* Readiness Hero */}
          <InstanceReadinessHero instance={selectedInstance} />

          {/* Remediation Checklist */}
          {blockerChecks.length > 0 ? (
            <>
              <InstanceRemediationChecklist blockers={blockerChecks} />

              {/* Passed Checks (collapsed by default) */}
              <InstancePassedChecks passed={passedChecks} />
            </>
          ) : null}

          {/* Action Bar */}
          <InstanceActionBar
            instance={selectedInstance}
            canEditSelectedInstance={canEditSelectedInstance}
            canOpenTargets={canOpenTargets}
            canOpenRouting={canOpenRouting}
            canOpenConversations={canOpenConversations}
            canOpenApiKeys={canOpenApiKeys}
            editMode={editMode}
            onToggleEditMode={() => setEditMode((current) => !current)}
            onToggleDiagnostics={() =>
              setShowAdvancedDiagnostics((current) => !current)
            }
            showDiagnostics={showAdvancedDiagnostics}
          />

          {/* Edit Form */}
          {editMode ? (
            <InstanceEditForm
              instance={selectedInstance}
              editForm={editForm}
              canEditSelectedInstance={canEditSelectedInstance}
              savingUpdate={savingUpdate}
              onFormChange={(patch) =>
                setEditForm((current) => ({ ...current, ...patch }))
              }
              onSubmit={handleUpdate}
            />
          ) : null}

          {/* Advanced Diagnostics (collapsed by default) */}
          <InstanceAdvancedDiagnostics
            instance={selectedInstance}
            blockerChecks={blockerChecks}
            canOpenTargets={canOpenTargets}
            canOpenRouting={canOpenRouting}
            canOpenConversations={canOpenConversations}
          />
        </>
      ) : (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Selected Instance</h3>
              <p className="fg-muted">
                Select an instance from the inventory table to inspect its
                readiness state and configuration.
              </p>
            </div>
          </div>
        </article>
      )}

      {/* ── Create Instance ── */}
      {showCreateSection ? (
        <InstanceCreateForm
          canCreateInstance={canCreateInstance}
          savingCreate={savingCreate}
          createForm={createForm}
          lastCreateResult={lastCreateResult}
          onFormChange={(patch) =>
            setCreateForm((current) => ({ ...current, ...patch }))
          }
          onSubmit={handleCreate}
          onClose={() => setShowCreateSection(false)}
        />
      ) : null}
    </section>
  );
}
