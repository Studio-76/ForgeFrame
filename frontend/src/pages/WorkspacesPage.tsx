import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createWorkspace,
  fetchWorkspaceDetail,
  fetchWorkspaces,
  updateWorkspace,
  type WorkspaceDetail,
  type WorkspaceSummary,
} from "../api/domain/workspaces";
import { fetchInstances } from "../api/domain/instances";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { AdvancedDiagnostics, DiagnosticSection, InternalId } from "../components/ui/AdvancedDiagnostics";
import { Button } from "../components/ui/Button";
import { RegistryManagementPage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import {
  WorkspaceList,
  WorkspaceDetailPanel,
  WorkspaceCreateForm,
  type LoadState,
  type DrawerMode,
  type CreateWorkspaceForm,
  type EditWorkspaceForm,
  DRAWER_FORM_ID,
  STATUS_OPTIONS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  parseMetadata,
  getWorkspaceAction,
} from "../features/workspaces";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";

export function WorkspacesPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedWorkspaceId = searchParams.get("workspaceId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as WorkspaceSummary["status"] | "all" | "") || "all";

  const canRead = sessionReady && (
    sessionHasAnyInstancePermission(session, "execution.read")
    || sessionHasAnyInstancePermission(session, "approvals.read")
  );
  const canMutate = sessionReady && session?.read_only !== true && roleAllows(session?.role, "admin");

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string; status: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState<CreateWorkspaceForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditWorkspaceForm>(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [runningPrimaryAction, setRunningPrimaryAction] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const selectedWorkspace = useMemo(
    () => workspaces.find((item) => item.workspace_id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );

  const currentInstanceLabel = useMemo(
    () => instances.find((inst) => inst.instance_id === instanceId)?.display_name ?? (instanceId || "No instance"),
    [instanceId, instances],
  );

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId.trim() && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Instance scope for workspaces could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setWorkspaces([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchWorkspaces(instanceId, statusFilter, 100)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setWorkspaces(payload.workspaces);
        setListState("success");
        setError("");

        const nextWorkspaceId = payload.workspaces.some((item) => item.workspace_id === selectedWorkspaceId)
          ? selectedWorkspaceId
          : payload.workspaces[0]?.workspace_id ?? "";
        if (nextWorkspaceId !== selectedWorkspaceId) {
          updateRoute((next) => {
            if (nextWorkspaceId) {
              next.set("workspaceId", nextWorkspaceId);
            } else {
              next.delete("workspaceId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setWorkspaces([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Workspace inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedWorkspaceId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedWorkspaceId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchWorkspaceDetail(selectedWorkspaceId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.workspace);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Workspace detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedWorkspaceId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    setEditForm({
      title: detail.title,
      summary: detail.summary,
      issueId: detail.issue_id ?? "",
      ownerId: detail.owner_id ?? "",
      activeRunId: detail.active_run_id ?? "",
      latestApprovalId: detail.latest_approval_id ?? "",
      prReference: detail.pr_reference ?? "",
      handoffReference: detail.handoff_reference ?? "",
      previewStatus: detail.preview_status,
      reviewStatus: detail.review_status,
      handoffStatus: detail.handoff_status,
      metadataJson: JSON.stringify(detail.metadata, null, 2),
      eventNote: "",
    });
  }, [detail]);

  const openCreateDrawer = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setDrawerMode("create");
  };

  const openEditDrawer = () => {
    if (!detail) {
      return;
    }
    setDrawerMode("edit");
  };

  const closeDrawer = () => {
    setDrawerMode("closed");
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createWorkspace(instanceId, {
        workspace_id: createForm.workspaceId.trim() || null,
        issue_id: createForm.issueId.trim() || null,
        title: createForm.title.trim(),
        summary: createForm.summary.trim(),
        preview_status: createForm.previewStatus,
        review_status: createForm.reviewStatus,
        handoff_status: createForm.handoffStatus,
        owner_type: "user",
        owner_id: createForm.ownerId.trim() || null,
        active_run_id: createForm.activeRunId.trim() || null,
        latest_approval_id: createForm.latestApprovalId.trim() || null,
        pr_reference: createForm.prReference.trim() || null,
        handoff_reference: createForm.handoffReference.trim() || null,
        metadata: parseMetadata(createForm.metadataJson, "Workspace metadata"),
      });
      closeDrawer();
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("workspaceId", payload.workspace.workspace_id);
      });
      setMessage(`Workspace ${payload.workspace.workspace_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Workspace creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      const payload = await updateWorkspace(instanceId, detail.workspace_id, {
        title: editForm.title.trim(),
        summary: editForm.summary.trim(),
        issue_id: editForm.issueId.trim() || null,
        owner_id: editForm.ownerId.trim() || null,
        active_run_id: editForm.activeRunId.trim() || null,
        latest_approval_id: editForm.latestApprovalId.trim() || null,
        pr_reference: editForm.prReference.trim() || null,
        handoff_reference: editForm.handoffReference.trim() || null,
        preview_status: editForm.previewStatus,
        review_status: editForm.reviewStatus,
        handoff_status: editForm.handoffStatus,
        metadata: parseMetadata(editForm.metadataJson, "Workspace metadata"),
        event_note: editForm.eventNote.trim() || null,
      });
      closeDrawer();
      setMessage(`Workspace ${payload.workspace.workspace_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Workspace update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    const action = getWorkspaceAction(detail);
    if (action.state !== "available" || !action.payload) {
      return;
    }

    setRunningPrimaryAction(true);
    setError("");
    setMessage("");
    try {
      await updateWorkspace(instanceId, detail.workspace_id, action.payload);
      setMessage(`Workspace action recorded: ${action.label}.`);
      setRefreshNonce((current) => current + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Workspace action failed.");
    } finally {
      setRunningPrimaryAction(false);
    }
  };

  // ── Early returns for session/permission gates ──

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Workspaces"
          description="ForgeFrame is restoring workspace scope before opening preview, review, and handoff truth."
          question="Which workspace should anchor the current run, issue, approval, and handoff evidence?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the operator dashboard while access is restored." },
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect execution truth after session state resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Workspace truth stays instance-scoped and acts as a handoff and operations object, not as a GitHub replacement."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Workspaces"
          description="This route is reserved for operators and admins who can inspect real workspace and handoff state."
          question="Which adjacent surface should you use when workspace review is outside the current permission envelope?"
          links={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect run state when workspace review is not available." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Open the shared approvals queue for decision work." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard and branch into the right surface." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewers do not get a cosmetic workspace shell. This route stays closed unless the session can inspect real execution or approval context."
        />
      </section>
    );
  }

  // ── Summary items ──

  const summaryItems: SummaryStripItem[] = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const ws of workspaces) {
      byStatus[ws.status] = (byStatus[ws.status] ?? 0) + 1;
    }
    const draftCount = byStatus.draft ?? 0;
    const inReviewCount = byStatus.in_review ?? 0;
    const handedOffCount = byStatus.handed_off ?? 0;

    return [
      {
        key: "total",
        label: "Workspaces",
        value: workspaces.length,
        meta: instanceId ? `Scoped to ${currentInstanceLabel}` : "No instance selected",
      },
      {
        key: "draft",
        label: "Draft",
        value: draftCount,
        tone: draftCount > 0 ? "warning" : "neutral",
        status: draftCount > 0 ? "partial" : "ready",
      },
      {
        key: "in_review",
        label: "In review",
        value: inReviewCount,
        tone: inReviewCount > 0 ? "info" : "neutral",
        status: inReviewCount > 0 ? "partial" : "ready",
      },
      {
        key: "handed_off",
        label: "Handed off",
        value: handedOffCount,
        tone: handedOffCount > 0 ? "success" : "neutral",
        status: handedOffCount > 0 ? "ready" : "ready",
      },
    ];
  }, [currentInstanceLabel, instanceId, workspaces]);

  // ── Page actions ──

  const pageActions: Action[] = useMemo(() => {
    const actions: Action[] = [];
    if (canMutate && instanceId) {
      actions.push({
        label: "New workspace",
        kind: "primary",
        intent: "configure",
        onClick: openCreateDrawer,
      });
    }
    return actions;
  }, [canMutate, instanceId]);

  // ── Filter content (instance selector + status filter) ──

  const filterContent = (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-meta text-muted">
        <span>Instance</span>
        <select
          className="rounded border border-border bg-surface-field px-2 py-1 text-body text-primary"
          aria-label="Workspace instance"
          value={instanceId}
          onChange={(event) => updateRoute((next) => {
            next.set("instanceId", event.target.value);
            next.delete("workspaceId");
          })}
        >
          {instances.map((instance) => (
            <option key={instance.instance_id} value={instance.instance_id}>
              {instance.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-meta text-muted">
        <span>Status</span>
        <select
          className="rounded border border-border bg-surface-field px-2 py-1 text-body text-primary"
          aria-label="Workspace status filter"
          value={statusFilter}
          onChange={(event) => updateRoute((next) => {
            if (event.target.value === "all") {
              next.delete("status");
            } else {
              next.set("status", event.target.value);
            }
            next.delete("workspaceId");
          })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <Button
        variant="secondary"
        isDisabled={!canMutate || !detail}
        onPress={openEditDrawer}
      >
        Edit selected workspace
      </Button>
    </div>
  );

  // ── Drawer form component props ──

  const drawerFormContent = drawerMode !== "closed" ? (
    <form id={DRAWER_FORM_ID} className="flex flex-col gap-4" onSubmit={drawerMode === "create" ? handleCreate : handleUpdate}>
      <WorkspaceCreateForm
        drawerMode={drawerMode}
        createForm={createForm}
        editForm={editForm}
        onCreateFormChange={setCreateForm}
        onEditFormChange={setEditForm}
      />
    </form>
  ) : null;

  return (
    <>
      {/* ── Error / message display ── */}
      {error ? <p className="fg-danger mb-4">{error}</p> : null}
      {message ? <p className="mb-4">{message}</p> : null}

      {/* ── Registry management template ── */}
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Workspaces"
        description="Operational handoff objects that connect issue and conversation context to preview evidence, review state, approvals, runs, artifacts, and downstream delivery."
        summaryItems={summaryItems}
        filterContent={filterContent}
        actions={pageActions}
        hasSelection={detail != null}
        selectedItemContent={detail ? (
          <WorkspaceDetailPanel
            key={detail.workspace_id}
            detail={detail}
            instanceId={instanceId}
            canMutate={canMutate}
            runningPrimaryAction={runningPrimaryAction}
            onPrimaryAction={handlePrimaryAction}
          />
        ) : undefined}
        emptyDetailHint="Select a workspace from the table to inspect work state and handoff posture."
        diagnostics={
          <AdvancedDiagnostics title="Workspace diagnostics" defaultOpen={false}>
            <DiagnosticSection label="Page state">
              <InternalId id={instanceId || "none"} label="Instance ID" />
              <p className="text-meta text-muted mt-2">
                Workspaces: {workspaces.length} &middot;
                Instances: {instances.length} &middot;
                Selected: {detail?.workspace_id ?? (selectedWorkspaceId || "none")}
              </p>
            </DiagnosticSection>
          </AdvancedDiagnostics>
        }
      >
        <WorkspaceList
          workspaces={workspaces}
          selectedWorkspaceId={selectedWorkspaceId}
          onSelectWorkspace={(id) => updateRoute((next) => next.set("workspaceId", id))}
          listState={listState}
          error={listState === "error" ? error : undefined}
          onRetry={() => setRefreshNonce((current) => current + 1)}
          instanceId={instanceId}
        />
      </RegistryManagementPage>

      {/* ── Create / Edit drawer ── */}
      <DetailDrawer
        open={drawerMode !== "closed"}
        title={drawerMode === "create" ? "Create Workspace" : "Edit Workspace"}
        description={drawerMode === "create"
          ? "Create a workspace as an operational handoff object with real preview, review, and downstream delivery posture."
          : "Adjust the selected workspace, links, and lifecycle posture in a focused drawer instead of treating it like a GitHub replacement."}
        status={drawerMode === "create" ? "Create" : detail?.workspace_id ?? "Edit"}
        statusTone={drawerMode === "create" ? "success" : "neutral"}
        properties={detail && drawerMode === "edit" ? [
          { label: "Current status", value: detail.status },
          { label: "Next action", value: detail.next_action_label ?? getWorkspaceAction(detail).label },
          { label: "Last activity", value: new Date(detail.last_activity_at ?? detail.latest_event_at ?? detail.updated_at).toLocaleString() },
        ] : []}
        actions={
          <>
            <Button variant="secondary" onPress={closeDrawer}>Cancel</Button>
            <Button
              variant="primary"
              type="submit"
              form={DRAWER_FORM_ID}
              isDisabled={
                !canMutate
                || (drawerMode === "create" ? savingCreate || !createForm.title.trim() : savingUpdate || !detail || !editForm.title.trim())
              }
            >
              {drawerMode === "create" ? (savingCreate ? "Creating workspace..." : "Create workspace") : (savingUpdate ? "Saving workspace..." : "Save workspace")}
            </Button>
          </>
        }
        onClose={closeDrawer}
      >
        {drawerFormContent}
      </DetailDrawer>
    </>
  );
}
