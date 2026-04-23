import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createWorkspace,
  fetchInstances,
  fetchWorkspaceDetail,
  fetchWorkspaces,
  updateWorkspace,
  type WorkspaceDetail,
  type WorkspaceHandoffStatus,
  type WorkspacePreviewStatus,
  type WorkspaceReviewStatus,
  type WorkspaceStatus,
  type WorkspaceSummary,
} from "../api/admin";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { buildArtifactsPath } from "../app/workInteractionRoutes";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

const STATUS_OPTIONS: Array<WorkspaceStatus | "all"> = [
  "all",
  "draft",
  "previewing",
  "in_review",
  "handoff_ready",
  "handed_off",
  "archived",
];

const PREVIEW_STATUS_OPTIONS: WorkspacePreviewStatus[] = ["draft", "ready", "approved", "rejected"];
const REVIEW_STATUS_OPTIONS: WorkspaceReviewStatus[] = ["not_requested", "pending", "approved", "rejected"];
const HANDOFF_STATUS_OPTIONS: WorkspaceHandoffStatus[] = ["not_ready", "ready", "delivered"];

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
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
      setMessage(`Workspace ${payload.workspace.workspace_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Workspace update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Workspaces"
          description="ForgeFrame is restoring workspace scope before opening preview, review, and handoff truth."
          question="Which issue-linked workspace should anchor the current run, approval, and handoff review?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the operator dashboard while access is restored." },
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect execution truth after session state resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Workspace truth stays instance-scoped. ForgeFrame waits for the current session before opening read or mutation paths."
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
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect run state when work-interaction review is not available." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Open the shared approvals queue for decision work." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard and branch into the right surface." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewers do not get a cosmetic workspace shell. This route stays closed unless the session can inspect real execution or approval context."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Workspaces"
        description="Issue-linked workspaces with preview, review, handoff, and cross-links back to execution, approvals, and artifacts."
        question="Does the current workspace carry real preview, review, and handoff truth, or is downstream work still floating as loose IDs?"
        links={[
          { label: "Workspaces", to: CONTROL_PLANE_ROUTES.workspaces, description: "Stay on the workspace inventory and detail surface." },
          { label: "Artifacts", to: buildArtifactsPath({ instanceId, workspaceId: selectedWorkspaceId || undefined }), description: "Open the artifact inventory for this workspace scope." },
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect run truth linked from the selected workspace." },
          { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Inspect approval truth linked from the selected workspace." },
        ]}
        badges={[
          { label: `${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}`, tone: workspaces.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Workspaces are not cosmetic wrappers. Preview, review, handoff, runs, approvals, and artifacts must reconcile on this surface."
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
                const nextStatus = event.target.value;
                if (nextStatus === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextStatus);
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
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Workspace Inventory</h3>
              <p className="fg-muted">Every row is a durable workspace object, not a loose run or issue string.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>
              {listState}
            </span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading workspace inventory.</p> : null}
          {listState === "success" && workspaces.length === 0 ? (
            <p className="fg-muted">No workspaces matched the selected instance and status filter.</p>
          ) : null}

          {workspaces.length > 0 ? (
            <div className="fg-stack">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.workspace_id}
                  type="button"
                  className={`fg-data-row${workspace.workspace_id === selectedWorkspaceId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("workspaceId", workspace.workspace_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{workspace.workspace_id}</span>
                      <strong>{workspace.title}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={workspace.status === "handed_off" ? "success" : workspace.status === "archived" ? "neutral" : "warning"}>
                        {workspace.status}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">
                      preview {workspace.preview_status} · review {workspace.review_status} · handoff {workspace.handoff_status}
                    </span>
                    <span className="fg-muted">
                      runs {workspace.run_count} · approvals {workspace.approval_count} · artifacts {workspace.artifact_count}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Workspace Detail</h3>
              <p className="fg-muted">Preview, review, handoff, event history, and linked runtime objects converge here.</p>
            </div>
            {selectedWorkspace ? <span className="fg-pill">{selectedWorkspace.workspace_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a workspace to inspect preview, review, handoff, runs, approvals, artifacts, and events.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading workspace detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Workspace ID: <span className="fg-code">{detail.workspace_id}</span></li>
                    <li>Instance scope: <span className="fg-code">{detail.instance_id}</span></li>
                    <li>Execution scope: <span className="fg-code">{detail.company_id}</span></li>
                    <li>Issue link: {detail.issue_id ?? "Not linked"}</li>
                    <li>Owner: {detail.owner_id ?? "Not recorded"}</li>
                    <li>Created at: {detail.created_at}</li>
                    <li>Updated at: {detail.updated_at}</li>
                  </ul>
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
                    <li>Latest event: {detail.latest_event_at ?? "Not recorded"}</li>
                  </ul>
                </article>
                <article className="fg-subcard">
                  <h4>References</h4>
                  <ul className="fg-list">
                    <li>Active run: {detail.active_run_id ?? "None"}</li>
                    <li>Latest approval: {detail.latest_approval_id ?? "None"}</li>
                    <li>PR reference: {detail.pr_reference ?? "None"}</li>
                    <li>Handoff reference: {detail.handoff_reference ?? "None"}</li>
                  </ul>
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, workspaceId: detail.workspace_id })}>
                      Open Workspace Artifacts
                    </Link>
                    {detail.active_run_id ? (
                      <Link className="fg-nav-link" to={buildExecutionRoute(instanceId, detail.active_run_id)}>
                        Open Execution Review
                      </Link>
                    ) : null}
                    {detail.latest_approval_id ? (
                      <Link className="fg-nav-link" to={buildApprovalRoute(instanceId, detail.latest_approval_id)}>
                        Open Approval Review
                      </Link>
                    ) : null}
                  </div>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Description</h4>
                <p>{detail.summary || "No workspace summary was recorded."}</p>
              </article>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Runs</h4>
                  {detail.runs.length === 0 ? <p className="fg-muted">No runs are linked to this workspace.</p> : (
                    <ul className="fg-list">
                      {detail.runs.map((run) => (
                        <li key={run.run_id}>
                          <Link to={buildExecutionRoute(instanceId, run.run_id, run.state)}>{run.run_id}</Link>
                          {" · "}{run.run_kind}{" · "}{run.state}{" · "}{run.execution_lane}
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
                          {" · "}{approval.gate_status}{" · "}{approval.gate_key}
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
                          {" · "}{artifact.artifact_type}{" · "}{artifact.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Event history</h4>
                {detail.events.length === 0 ? <p className="fg-muted">No workspace events were recorded.</p> : (
                  <ul className="fg-list">
                    {detail.events.map((event) => (
                      <li key={event.event_id}>
                        {event.event_kind} · {event.created_at} · {event.note ?? "No note"}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create Workspace</h3>
              <p className="fg-muted">Create a real workspace object instead of leaving preview and handoff state implicit.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <label>
              Workspace ID
              <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} placeholder="ws_customer_pricing" />
            </label>
            <label>
              Title
              <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Customer pricing handoff" />
            </label>
            <label>
              Summary
              <textarea rows={4} value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Issue ID
                <input value={createForm.issueId} onChange={(event) => setCreateForm((current) => ({ ...current, issueId: event.target.value }))} placeholder="FOR-178" />
              </label>
              <label>
                Owner ID
                <input value={createForm.ownerId} onChange={(event) => setCreateForm((current) => ({ ...current, ownerId: event.target.value }))} placeholder="user-admin" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Preview
                <select value={createForm.previewStatus} onChange={(event) => setCreateForm((current) => ({ ...current, previewStatus: event.target.value as WorkspacePreviewStatus }))}>
                  {PREVIEW_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Review
                <select value={createForm.reviewStatus} onChange={(event) => setCreateForm((current) => ({ ...current, reviewStatus: event.target.value as WorkspaceReviewStatus }))}>
                  {REVIEW_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Handoff
                <select value={createForm.handoffStatus} onChange={(event) => setCreateForm((current) => ({ ...current, handoffStatus: event.target.value as WorkspaceHandoffStatus }))}>
                  {HANDOFF_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Active run ID
                <input value={createForm.activeRunId} onChange={(event) => setCreateForm((current) => ({ ...current, activeRunId: event.target.value }))} placeholder="run_alpha" />
              </label>
              <label>
                Latest approval ID
                <input value={createForm.latestApprovalId} onChange={(event) => setCreateForm((current) => ({ ...current, latestApprovalId: event.target.value }))} placeholder="run:instance_alpha:company_alpha:approval-1" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                PR reference
                <input value={createForm.prReference} onChange={(event) => setCreateForm((current) => ({ ...current, prReference: event.target.value }))} placeholder="https://github.com/org/repo/pull/123" />
              </label>
              <label>
                Handoff reference
                <input value={createForm.handoffReference} onChange={(event) => setCreateForm((current) => ({ ...current, handoffReference: event.target.value }))} placeholder="handoff://package/123" />
              </label>
            </div>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim()}>
                {savingCreate ? "Creating workspace" : "Create workspace"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit Workspace</h3>
              <p className="fg-muted">Mutations must keep preview, review, and handoff truth coherent with linked runs, approvals, and artifacts.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>
              {detail ? detail.workspace_id : "Select a workspace"}
            </span>
          </div>
          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <label>
                Title
                <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label>
                Summary
                <textarea rows={4} value={editForm.summary} onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} />
              </label>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Issue ID
                  <input value={editForm.issueId} onChange={(event) => setEditForm((current) => ({ ...current, issueId: event.target.value }))} />
                </label>
                <label>
                  Owner ID
                  <input value={editForm.ownerId} onChange={(event) => setEditForm((current) => ({ ...current, ownerId: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Preview
                  <select value={editForm.previewStatus} onChange={(event) => setEditForm((current) => ({ ...current, previewStatus: event.target.value as WorkspacePreviewStatus }))}>
                    {PREVIEW_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Review
                  <select value={editForm.reviewStatus} onChange={(event) => setEditForm((current) => ({ ...current, reviewStatus: event.target.value as WorkspaceReviewStatus }))}>
                    {REVIEW_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Handoff
                  <select value={editForm.handoffStatus} onChange={(event) => setEditForm((current) => ({ ...current, handoffStatus: event.target.value as WorkspaceHandoffStatus }))}>
                    {HANDOFF_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Active run ID
                  <input value={editForm.activeRunId} onChange={(event) => setEditForm((current) => ({ ...current, activeRunId: event.target.value }))} />
                </label>
                <label>
                  Latest approval ID
                  <input value={editForm.latestApprovalId} onChange={(event) => setEditForm((current) => ({ ...current, latestApprovalId: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  PR reference
                  <input value={editForm.prReference} onChange={(event) => setEditForm((current) => ({ ...current, prReference: event.target.value }))} />
                </label>
                <label>
                  Handoff reference
                  <input value={editForm.handoffReference} onChange={(event) => setEditForm((current) => ({ ...current, handoffReference: event.target.value }))} />
                </label>
              </div>
              <label>
                Metadata JSON
                <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
              </label>
              <label>
                Event note
                <textarea rows={3} value={editForm.eventNote} onChange={(event) => setEditForm((current) => ({ ...current, eventNote: event.target.value }))} placeholder="Why did this workspace state change?" />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate}>
                  {savingUpdate ? "Saving workspace" : "Save workspace"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select a workspace before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
