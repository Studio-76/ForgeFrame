import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createWorkspace,
  fetchWorkspaceDetail,
  fetchWorkspaces,
  updateWorkspace,
  type WorkspaceDetail,
  type WorkspaceHandoffStatus,
  type WorkspacePreviewStatus,
  type WorkspaceReviewStatus,
  type WorkspaceStatus,
  type WorkspaceSummary,
} from "../api/domain/workspaces";
import { fetchInstances } from "../api/domain/instances";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { buildArtifactsPath, buildConversationPath, buildTaskPath } from "../app/workInteractionRoutes";
import { PageIntro } from "../components/PageIntro";
import { DetailDrawer } from "../components/ui/DetailDrawer";

type LoadState = "idle" | "loading" | "success" | "error";
type DrawerMode = "closed" | "create" | "edit";
type WorkspaceActionState = "available" | "not_ready" | "waiting" | "done";
type WorkspaceActionKey =
  | "start_preview"
  | "request_review"
  | "prepare_handoff"
  | "review_in_progress"
  | "handoff_ready"
  | "handoff_delivered"
  | "archived";

type WorkspaceAction = {
  key: WorkspaceActionKey;
  label: string;
  state: WorkspaceActionState;
  reason: string;
  payload?: Parameters<typeof updateWorkspace>[2];
};

const DRAWER_FORM_ID = "workspace-drawer-form";

const STATUS_OPTIONS: Array<WorkspaceStatus | "all"> = [
  "all",
  "draft",
  "previewing",
  "in_review",
  "handoff_ready",
  "handed_off",
  "archived",
];

const DEFAULT_CREATE_FORM = {
  workspaceId: "",
  issueId: "",
  title: "",
  summary: "",
  ownerId: "",
  activeRunId: "",
  latestApprovalId: "",
  prReference: "",
  handoffReference: "",
  previewStatus: "draft" as WorkspacePreviewStatus,
  reviewStatus: "not_requested" as WorkspaceReviewStatus,
  handoffStatus: "not_ready" as WorkspaceHandoffStatus,
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  title: "",
  summary: "",
  issueId: "",
  ownerId: "",
  activeRunId: "",
  latestApprovalId: "",
  prReference: "",
  handoffReference: "",
  previewStatus: "draft" as WorkspacePreviewStatus,
  reviewStatus: "not_requested" as WorkspaceReviewStatus,
  handoffStatus: "not_ready" as WorkspaceHandoffStatus,
  metadataJson: "{}",
  eventNote: "",
};

function buildExecutionRoute(instanceId: string, runId: string, state?: string | null): string {
  const params = new URLSearchParams({ instanceId, runId });
  if (state?.trim()) {
    params.set("state", state.trim());
  }
  return `${CONTROL_PLANE_ROUTES.execution}?${params.toString()}`;
}

function buildApprovalRoute(instanceId: string, approvalId: string): string {
  const params = new URLSearchParams({ instanceId, approvalId, status: "all" });
  return `${CONTROL_PLANE_ROUTES.approvals}?${params.toString()}`;
}

function parseMetadata(rawValue: string, fieldLabel: string): Record<string, unknown> {
  const normalized = rawValue.trim();
  if (!normalized) {
    return {};
  }
  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "handed_off" || status === "delivered" || status === "approved" || status === "ready") {
    return "success";
  }
  if (status === "archived" || status === "done") {
    return "neutral";
  }
  if (status === "rejected" || status === "missing") {
    return "danger";
  }
  return "warning";
}

function actionTone(state: WorkspaceActionState): "success" | "warning" | "danger" | "neutral" {
  if (state === "available") {
    return "success";
  }
  if (state === "done") {
    return "neutral";
  }
  if (state === "waiting") {
    return "warning";
  }
  return "danger";
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "Not recorded";
  }
  return new Date(value).toLocaleString();
}

function getWorkspaceAction(workspace: WorkspaceSummary | WorkspaceDetail): WorkspaceAction {
  const key = workspace.next_action_key;
  const state = workspace.next_action_state;
  const label = workspace.next_action_label;
  const reason = workspace.next_action_reason;

  if (key && state && label && reason) {
    const action: WorkspaceAction = {
      key,
      state,
      label,
      reason,
    };
    if (state === "available") {
      if (key === "start_preview") {
        action.payload = {
          preview_status: "ready",
          event_note: "Preview recorded from workspace surface after evidence was linked.",
        };
      } else if (key === "request_review") {
        action.payload = {
          review_status: "pending",
          event_note: "Review requested from workspace surface.",
        };
      } else if (key === "prepare_handoff") {
        action.payload = {
          handoff_status: "ready",
          event_note: "Handoff prepared from workspace surface.",
        };
      }
    }
    return action;
  }

  if (workspace.status === "archived") {
    return { key: "archived", label: "Archived", state: "done", reason: "Workspace is archived." };
  }
  if (workspace.handoff_status === "delivered") {
    return { key: "handoff_delivered", label: "Handoff delivered", state: "done", reason: "Handoff already left ForgeFrame." };
  }
  if (workspace.handoff_status === "ready") {
    return { key: "handoff_ready", label: "Handoff ready", state: "waiting", reason: "Delivery now depends on the downstream target." };
  }
  if (workspace.review_status === "pending") {
    return { key: "review_in_progress", label: "Review in progress", state: "waiting", reason: "Review is already pending." };
  }
  if (workspace.review_status === "approved") {
    if (workspace.handoff_artifact_id || workspace.handoff_reference || workspace.pr_reference) {
      return {
        key: "prepare_handoff",
        label: "Prepare handoff",
        state: "available",
        reason: "Handoff evidence is linked. Mark the workspace ready for delivery.",
        payload: {
          handoff_status: "ready",
          event_note: "Handoff prepared from workspace surface.",
        },
      };
    }
    return {
      key: "prepare_handoff",
      label: "Prepare handoff",
      state: "not_ready",
      reason: "No dedicated handoff API exists here. Link a handoff artifact, PR reference, or handoff reference first.",
    };
  }
  if (workspace.preview_status === "ready" || workspace.preview_status === "approved") {
    return {
      key: "request_review",
      label: "Request review",
      state: "available",
      reason: "Preview evidence is linked. Move the workspace into review.",
      payload: {
        review_status: "pending",
        event_note: "Review requested from workspace surface.",
      },
    };
  }
  if (workspace.active_run_id || workspace.preview_artifact_id) {
    return {
      key: "start_preview",
      label: "Start preview",
      state: "available",
      reason: "Execution or artifact evidence is linked. Record preview readiness from the workspace surface.",
      payload: {
        preview_status: "ready",
        event_note: "Preview recorded from workspace surface after evidence was linked.",
      },
    };
  }
  return {
    key: "start_preview",
    label: "Start preview",
    state: "not_ready",
    reason: "No dedicated preview-start API exists here. Link an execution run or preview artifact first.",
  };
}

export function WorkspacesPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedWorkspaceId = searchParams.get("workspaceId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as WorkspaceStatus | "all" | "") || "all";

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
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [runningPrimaryAction, setRunningPrimaryAction] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const selectedWorkspace = useMemo(
    () => workspaces.find((item) => item.workspace_id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
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

  const primaryAction = detail ? getWorkspaceAction(detail) : null;
  const handoffHistory = (detail?.events ?? []).filter((event) => (
    event.event_kind === "review_requested"
    || event.event_kind === "review_approved"
    || event.event_kind === "review_rejected"
    || event.event_kind === "handoff_prepared"
    || event.event_kind === "handoff_delivered"
  ));

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Workspaces"
        description="Operational handoff objects that connect issue and conversation context to preview evidence, review state, approvals, runs, artifacts, and downstream delivery."
        question="Does the selected workspace show a real next action with real blockers, or are preview and handoff still implied somewhere else?"
        links={[
          { label: "Artifacts", to: buildArtifactsPath({ instanceId, workspaceId: selectedWorkspaceId || undefined }), description: "Inspect artifacts linked to the current workspace." },
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect the runtime evidence linked from the workspace." },
          { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Inspect approval gates linked from the workspace." },
          { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Inspect conversation context connected to workspace work." },
        ]}
        badges={[
          { label: `${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}`, tone: workspaces.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Workspaces stay an execution and handoff surface. They should never pretend to replace GitHub or any external delivery system."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope</h3>
            <p className="fg-muted">Choose the instance boundary first, then filter the workspace inventory by current status.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>
            {instancesState}
          </span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Workspace instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("workspaceId");
              })}
            >
              {instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
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
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="fg-actions">
            <button type="button" onClick={openCreateDrawer} disabled={!canMutate || !instanceId}>New workspace</button>
            <button type="button" onClick={openEditDrawer} disabled={!canMutate || !detail}>Edit selected workspace</button>
          </div>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Workspace inventory</h3>
              <p className="fg-muted">Workspace owner, linked issue or conversation, preview/review/handoff posture, next action, and latest activity all stay visible.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>
              {listState}
            </span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading workspace inventory.</p> : null}
          {listState === "success" && workspaces.length === 0 ? <p className="fg-muted">No workspaces matched the selected instance and status filter.</p> : null}

          {workspaces.length > 0 ? (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Workspace inventory">
                <thead>
                  <tr>
                    <th>Workspace</th>
                    <th>Owner</th>
                    <th>Issue / conversation</th>
                    <th>Preview / review / handoff</th>
                    <th>Next action</th>
                    <th>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((workspace) => {
                    const action = getWorkspaceAction(workspace);
                    return (
                      <tr key={workspace.workspace_id}>
                        <td>
                          <button className="fg-table-trigger" type="button" onClick={() => updateRoute((next) => next.set("workspaceId", workspace.workspace_id))}>
                            {workspace.title}
                          </button>
                          <div className="fg-code">{workspace.workspace_id}</div>
                          <div className="fg-muted">{workspace.summary || "No summary"}</div>
                        </td>
                        <td>
                          <span className="fg-pill" data-tone={statusTone(workspace.status)}>{workspace.status}</span>
                          <div>{workspace.owner_id ?? "No owner"}</div>
                        </td>
                        <td>
                          <div>Issue: {workspace.issue_id ?? "Not linked"}</div>
                          <div>
                            Conversation:{" "}
                            {workspace.latest_conversation_id ? (
                              <Link to={buildConversationPath({ instanceId, conversationId: workspace.latest_conversation_id })}>
                                {workspace.latest_conversation_subject ?? workspace.latest_conversation_id}
                              </Link>
                            ) : "Not linked"}
                          </div>
                        </td>
                        <td>
                          <div>Preview: {workspace.preview_status}</div>
                          <div>Review: {workspace.review_status}</div>
                          <div>Handoff: {workspace.handoff_status}</div>
                        </td>
                        <td>
                          <span className="fg-pill" data-tone={actionTone(action.state)}>{action.state}</span>
                          <div>{action.label}</div>
                          <div className="fg-muted">{action.reason}</div>
                        </td>
                        <td>{formatTimestamp(workspace.last_activity_at ?? workspace.latest_event_at ?? workspace.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Workspace detail</h3>
              <p className="fg-muted">Context, conversations, tasks, runs, approvals, artifacts, and handoff history converge here.</p>
            </div>
            {selectedWorkspace ? <span className="fg-pill">{selectedWorkspace.workspace_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a workspace to inspect work state and handoff posture.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading workspace detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              {primaryAction ? (
                <article className="fg-subcard">
                  <div className="fg-panel-heading">
                    <div>
                      <h4>Next action</h4>
                      <p className="fg-muted">The workspace surface stays honest about what can run here and what remains blocked by missing preview or handoff APIs.</p>
                    </div>
                    <span className="fg-pill" data-tone={actionTone(primaryAction.state)}>{primaryAction.state}</span>
                  </div>
                  <p><strong>{primaryAction.label}</strong></p>
                  <p className={primaryAction.state === "not_ready" ? "fg-danger" : "fg-muted"}>{primaryAction.reason}</p>
                  <div className="fg-actions">
                    {primaryAction.state === "available" ? (
                      <button type="button" onClick={handlePrimaryAction} disabled={!canMutate || runningPrimaryAction}>
                        {runningPrimaryAction ? `${primaryAction.label}...` : primaryAction.label}
                      </button>
                    ) : null}
                    <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, workspaceId: detail.workspace_id })}>Workspace artifacts</Link>
                    {detail.active_run_id ? <Link className="fg-nav-link" to={buildExecutionRoute(instanceId, detail.active_run_id)}>Execution evidence</Link> : null}
                    {detail.latest_approval_id ? <Link className="fg-nav-link" to={buildApprovalRoute(instanceId, detail.latest_approval_id)}>Approval gate</Link> : null}
                  </div>
                </article>
              ) : null}

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Context</h4>
                  <ul className="fg-list">
                    <li>Workspace ID: <span className="fg-code">{detail.workspace_id}</span></li>
                    <li>Issue link: {detail.issue_id ?? "Not linked"}</li>
                    <li>Owner: {detail.owner_id ?? "Not recorded"}</li>
                    <li>Conversation count: {detail.conversation_count ?? detail.conversations?.length ?? 0}</li>
                    <li>Task count: {detail.task_count ?? detail.tasks?.length ?? 0}</li>
                    <li>Last activity: {formatTimestamp(detail.last_activity_at ?? detail.latest_event_at ?? detail.updated_at)}</li>
                  </ul>
                  <p>{detail.summary || "No workspace summary was recorded."}</p>
                </article>

                <article className="fg-subcard">
                  <h4>Lifecycle</h4>
                  <ul className="fg-list">
                    <li>Status: {detail.status}</li>
                    <li>Preview: {detail.preview_status}</li>
                    <li>Review: {detail.review_status}</li>
                    <li>Handoff: {detail.handoff_status}</li>
                    <li>Preview artifact: {detail.preview_artifact_id ?? "None"}</li>
                    <li>Handoff artifact: {detail.handoff_artifact_id ?? "None"}</li>
                  </ul>
                </article>

                <article className="fg-subcard">
                  <h4>Handoff target</h4>
                  <ul className="fg-list">
                    <li>PR reference: {detail.pr_reference ?? "Not linked"}</li>
                    <li>Handoff reference: {detail.handoff_reference ?? "Not linked"}</li>
                    <li>Active run: {detail.active_run_id ?? "None"}</li>
                    <li>Latest approval: {detail.latest_approval_id ?? "None"}</li>
                  </ul>
                  <p className="fg-muted">The workspace records handoff readiness and operating evidence. Delivery itself still happens in the external target system.</p>
                </article>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Conversations</h4>
                  {(detail.conversations ?? []).length === 0 ? <p className="fg-muted">No conversations are linked to this workspace.</p> : (
                    <ul className="fg-list">
                      {(detail.conversations ?? []).map((conversation) => (
                        <li key={conversation.conversation_id}>
                          <Link to={buildConversationPath({ instanceId, conversationId: conversation.conversation_id })}>{conversation.subject}</Link>
                          {" | "}{conversation.status}{" | "}{conversation.triage_status}{" | "}{conversation.priority}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Tasks</h4>
                  {(detail.tasks ?? []).length === 0 ? <p className="fg-muted">No tasks are linked to this workspace.</p> : (
                    <ul className="fg-list">
                      {(detail.tasks ?? []).map((task) => (
                        <li key={task.task_id}>
                          <Link to={buildTaskPath({ instanceId, taskId: task.task_id })}>{task.title}</Link>
                          {" | "}{task.status}{" | "}{task.priority}{" | due "}{formatTimestamp(task.due_at)}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Runs</h4>
                  {detail.runs.length === 0 ? <p className="fg-muted">No runs are linked to this workspace.</p> : (
                    <ul className="fg-list">
                      {detail.runs.map((run) => (
                        <li key={run.run_id}>
                          <Link to={buildExecutionRoute(instanceId, run.run_id, run.state)}>{run.run_id}</Link>
                          {" | "}{run.run_kind}{" | "}{run.state}{" | "}{run.execution_lane}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Approvals</h4>
                  {detail.approvals.length === 0 ? <p className="fg-muted">No approvals are linked to this workspace.</p> : (
                    <ul className="fg-list">
                      {detail.approvals.map((approval) => (
                        <li key={approval.shared_approval_id}>
                          <Link to={buildApprovalRoute(instanceId, approval.shared_approval_id)}>{approval.shared_approval_id}</Link>
                          {" | "}{approval.gate_status}{" | "}{approval.gate_key}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Artifacts</h4>
                  {detail.artifacts.length === 0 ? <p className="fg-muted">No artifacts are linked to this workspace.</p> : (
                    <ul className="fg-list">
                      {detail.artifacts.map((artifact) => (
                        <li key={artifact.artifact_id}>
                          <Link to={buildArtifactsPath({ instanceId, artifactId: artifact.artifact_id })}>{artifact.label}</Link>
                          {" | "}{artifact.artifact_type}{" | "}{artifact.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Handoff history</h4>
                {handoffHistory.length === 0 ? <p className="fg-muted">No review or handoff transitions were recorded yet.</p> : (
                  <ul className="fg-list">
                    {handoffHistory.map((event) => (
                      <li key={event.event_id}>
                        {event.event_kind} | {formatTimestamp(event.created_at)} | {event.note ?? "No note"}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="fg-subcard">
                <h4>Workspace events</h4>
                {detail.events.length === 0 ? <p className="fg-muted">No workspace events were recorded.</p> : (
                  <ul className="fg-list">
                    {detail.events.map((event) => (
                      <li key={event.event_id}>
                        {event.event_kind} | {formatTimestamp(event.created_at)} | {event.note ?? "No note"}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          ) : null}
        </article>
      </div>

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
          { label: "Last activity", value: formatTimestamp(detail.last_activity_at ?? detail.latest_event_at ?? detail.updated_at) },
        ] : []}
        actions={(
          <>
            <button type="button" onClick={closeDrawer}>Cancel</button>
            <button
              type="submit"
              form={DRAWER_FORM_ID}
              disabled={
                !canMutate
                || (drawerMode === "create" ? savingCreate || !createForm.title.trim() : savingUpdate || !detail || !editForm.title.trim())
              }
            >
              {drawerMode === "create" ? (savingCreate ? "Creating workspace..." : "Create workspace") : (savingUpdate ? "Saving workspace..." : "Save workspace")}
            </button>
          </>
        )}
        onClose={closeDrawer}
      >
        <form id={DRAWER_FORM_ID} className="fg-stack" onSubmit={drawerMode === "create" ? handleCreate : handleUpdate}>
          {drawerMode === "create" ? (
            <label>
              Workspace ID
              <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} placeholder="ws_customer_pricing" />
            </label>
          ) : null}
          <label>
            Title
            <input
              value={drawerMode === "create" ? createForm.title : editForm.title}
              onChange={(event) => {
                if (drawerMode === "create") {
                  setCreateForm((current) => ({ ...current, title: event.target.value }));
                } else {
                  setEditForm((current) => ({ ...current, title: event.target.value }));
                }
              }}
              placeholder="Customer pricing handoff"
            />
          </label>
          <label>
            Summary
            <textarea
              rows={4}
              value={drawerMode === "create" ? createForm.summary : editForm.summary}
              onChange={(event) => {
                if (drawerMode === "create") {
                  setCreateForm((current) => ({ ...current, summary: event.target.value }));
                } else {
                  setEditForm((current) => ({ ...current, summary: event.target.value }));
                }
              }}
            />
          </label>
          <div className="fg-grid fg-grid-compact">
            <label>
              Issue ID
              <input
                value={drawerMode === "create" ? createForm.issueId : editForm.issueId}
                onChange={(event) => {
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, issueId: event.target.value }));
                  } else {
                    setEditForm((current) => ({ ...current, issueId: event.target.value }));
                  }
                }}
                placeholder="FOR-178"
              />
            </label>
            <label>
              Owner ID
              <input
                value={drawerMode === "create" ? createForm.ownerId : editForm.ownerId}
                onChange={(event) => {
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, ownerId: event.target.value }));
                  } else {
                    setEditForm((current) => ({ ...current, ownerId: event.target.value }));
                  }
                }}
                placeholder="user-admin"
              />
            </label>
          </div>
          <div className="fg-card-grid">
            <article className="fg-subcard">
              <h4>Lifecycle controls</h4>
              {drawerMode === "create" ? (
                <p className="fg-muted">New workspaces start in preview draft, review not requested, and handoff not ready. Move lifecycle state from the detail panel only after evidence exists.</p>
              ) : (
                <ul className="fg-list">
                  <li>Preview: {editForm.previewStatus}</li>
                  <li>Review: {editForm.reviewStatus}</li>
                  <li>Handoff: {editForm.handoffStatus}</li>
                </ul>
              )}
            </article>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              Active run ID
              <input
                value={drawerMode === "create" ? createForm.activeRunId : editForm.activeRunId}
                onChange={(event) => {
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, activeRunId: event.target.value }));
                  } else {
                    setEditForm((current) => ({ ...current, activeRunId: event.target.value }));
                  }
                }}
                placeholder="run_alpha"
              />
            </label>
            <label>
              Latest approval ID
              <input
                value={drawerMode === "create" ? createForm.latestApprovalId : editForm.latestApprovalId}
                onChange={(event) => {
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, latestApprovalId: event.target.value }));
                  } else {
                    setEditForm((current) => ({ ...current, latestApprovalId: event.target.value }));
                  }
                }}
                placeholder="run:instance_alpha:company_alpha:approval-1"
              />
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
            <label>
              PR reference
              <input
                value={drawerMode === "create" ? createForm.prReference : editForm.prReference}
                onChange={(event) => {
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, prReference: event.target.value }));
                  } else {
                    setEditForm((current) => ({ ...current, prReference: event.target.value }));
                  }
                }}
                placeholder="https://github.com/org/repo/pull/123"
              />
            </label>
            <label>
              Handoff reference
              <input
                value={drawerMode === "create" ? createForm.handoffReference : editForm.handoffReference}
                onChange={(event) => {
                  if (drawerMode === "create") {
                    setCreateForm((current) => ({ ...current, handoffReference: event.target.value }));
                  } else {
                    setEditForm((current) => ({ ...current, handoffReference: event.target.value }));
                  }
                }}
                placeholder="handoff://package/123"
              />
            </label>
          </div>
          <label>
            Metadata JSON
            <textarea
              rows={6}
              value={drawerMode === "create" ? createForm.metadataJson : editForm.metadataJson}
              onChange={(event) => {
                if (drawerMode === "create") {
                  setCreateForm((current) => ({ ...current, metadataJson: event.target.value }));
                } else {
                  setEditForm((current) => ({ ...current, metadataJson: event.target.value }));
                }
              }}
            />
          </label>
          {drawerMode === "edit" ? (
            <label>
              Event note
              <textarea rows={3} value={editForm.eventNote} onChange={(event) => setEditForm((current) => ({ ...current, eventNote: event.target.value }))} />
            </label>
          ) : null}
        </form>
      </DetailDrawer>
    </section>
  );
}
