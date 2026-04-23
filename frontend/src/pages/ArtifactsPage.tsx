import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createArtifact,
  fetchArtifactDetail,
  fetchArtifacts,
  fetchInstances,
  updateArtifact,
  type ArtifactAttachmentRecord,
  type ArtifactAttachmentTargetKind,
  type ArtifactRecord,
  type ArtifactStatus,
  type ArtifactType,
  type ArtifactWorkspaceRole,
} from "../api/admin";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { buildWorkspacePath, buildArtifactsPath } from "../app/workInteractionRoutes";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

const ARTIFACT_TYPE_OPTIONS: ArtifactType[] = [
  "file",
  "download",
  "preview_link",
  "log",
  "pr_link",
  "json",
  "csv",
  "pdf",
  "handoff_note",
  "external_action_preview",
];

const ARTIFACT_STATUS_OPTIONS: ArtifactStatus[] = ["active", "superseded", "archived"];
const TARGET_KIND_OPTIONS: Array<ArtifactAttachmentTargetKind | ""> = ["", "workspace", "run", "approval", "instance", "decision"];
const WORKSPACE_ROLE_OPTIONS: Array<ArtifactWorkspaceRole | ""> = ["", "artifact", "preview", "handoff"];

const DEFAULT_CREATE_FORM = {
  workspaceId: "",
  workspaceRole: "" as ArtifactWorkspaceRole | "",
  artifactType: "file" as ArtifactType,
  label: "",
  uri: "",
  mediaType: "",
  previewUrl: "",
  sizeBytes: "",
  status: "active" as ArtifactStatus,
  attachmentsJson: "[]",
  metadataJson: "{}",
};

const DEFAULT_EDIT_FORM = {
  label: "",
  uri: "",
  mediaType: "",
  previewUrl: "",
  sizeBytes: "",
  status: "active" as ArtifactStatus,
  metadataJson: "{}",
};

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

function parseAttachments(rawValue: string): Array<{ target_kind: ArtifactAttachmentTargetKind; target_id: string; role?: string }> {
  const normalized = rawValue.trim();
  if (!normalized) {
    return [];
  }
  const parsed = JSON.parse(normalized) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Artifact attachments must be a JSON array.");
  }
  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Artifact attachments must contain objects.");
    }
    const targetKind = typeof entry.target_kind === "string" ? entry.target_kind.trim() : "";
    const targetId = typeof entry.target_id === "string" ? entry.target_id.trim() : "";
    const role = typeof entry.role === "string" ? entry.role.trim() : undefined;
    if (!targetKind || !targetId) {
      throw new Error("Artifact attachments require target_kind and target_id.");
    }
    return {
      target_kind: targetKind as ArtifactAttachmentTargetKind,
      target_id: targetId,
      role,
    };
  });
}

function describeAttachmentLink(instanceId: string, attachment: ArtifactAttachmentRecord): { href: string; label: string } | null {
  if (attachment.target_kind === "workspace") {
    return {
      href: buildWorkspacePath({ instanceId, workspaceId: attachment.target_id }),
      label: "Open workspace",
    };
  }
  if (attachment.target_kind === "run") {
    return {
      href: `${CONTROL_PLANE_ROUTES.execution}?${new URLSearchParams({ instanceId, runId: attachment.target_id }).toString()}`,
      label: "Open execution review",
    };
  }
  if (attachment.target_kind === "approval") {
    return {
      href: `${CONTROL_PLANE_ROUTES.approvals}?${new URLSearchParams({ instanceId, approvalId: attachment.target_id, status: "all" }).toString()}`,
      label: "Open approval review",
    };
  }
  return null;
}

export function ArtifactsPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const workspaceIdFilter = searchParams.get("workspaceId")?.trim() ?? "";
  const targetKindFilter = (searchParams.get("targetKind")?.trim() as ArtifactAttachmentTargetKind | "") ?? "";
  const targetIdFilter = searchParams.get("targetId")?.trim() ?? "";
  const selectedArtifactId = searchParams.get("artifactId")?.trim() ?? "";

  const canRead = sessionReady && (
    sessionHasAnyInstancePermission(session, "execution.read")
    || sessionHasAnyInstancePermission(session, "approvals.read")
  );
  const canMutate = sessionReady && session?.read_only !== true && roleAllows(session?.role, "admin");

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [detail, setDetail] = useState<ArtifactRecord | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [workspaceDraft, setWorkspaceDraft] = useState(workspaceIdFilter);
  const [targetKindDraft, setTargetKindDraft] = useState<ArtifactAttachmentTargetKind | "">(targetKindFilter);
  const [targetIdDraft, setTargetIdDraft] = useState(targetIdFilter);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const selectedArtifact = useMemo(
    () => artifacts.find((item) => item.artifact_id === selectedArtifactId) ?? null,
    [artifacts, selectedArtifactId],
  );

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  useEffect(() => {
    setWorkspaceDraft(workspaceIdFilter);
  }, [workspaceIdFilter]);

  useEffect(() => {
    setTargetKindDraft(targetKindFilter);
  }, [targetKindFilter]);

  useEffect(() => {
    setTargetIdDraft(targetIdFilter);
  }, [targetIdFilter]);

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
        if (!instanceId && payload.instances[0]?.instance_id) {
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
        setError(loadError instanceof Error ? loadError.message : "Instance scope for artifacts could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setArtifacts([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchArtifacts({
      instanceId,
      workspaceId: workspaceIdFilter || undefined,
      targetKind: targetKindFilter || undefined,
      targetId: targetIdFilter || undefined,
      limit: 100,
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setArtifacts(payload.artifacts);
        setListState("success");
        setError("");

        const nextArtifactId = payload.artifacts.some((artifact) => artifact.artifact_id === selectedArtifactId)
          ? selectedArtifactId
          : payload.artifacts[0]?.artifact_id ?? "";
        if (nextArtifactId !== selectedArtifactId) {
          updateRoute((next) => {
            if (nextArtifactId) {
              next.set("artifactId", nextArtifactId);
            } else {
              next.delete("artifactId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setArtifacts([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Artifact inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedArtifactId, targetIdFilter, targetKindFilter, workspaceIdFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedArtifactId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchArtifactDetail(selectedArtifactId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.artifact);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Artifact detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedArtifactId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }
    setEditForm({
      label: detail.label,
      uri: detail.uri,
      mediaType: detail.media_type ?? "",
      previewUrl: detail.preview_url ?? "",
      sizeBytes: detail.size_bytes === null || detail.size_bytes === undefined ? "" : String(detail.size_bytes),
      status: detail.status,
      metadataJson: JSON.stringify(detail.metadata, null, 2),
    });
  }, [detail]);

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateRoute((next) => {
      if (workspaceDraft.trim()) {
        next.set("workspaceId", workspaceDraft.trim());
      } else {
        next.delete("workspaceId");
      }
      if (targetKindDraft) {
        next.set("targetKind", targetKindDraft);
      } else {
        next.delete("targetKind");
      }
      if (targetIdDraft.trim()) {
        next.set("targetId", targetIdDraft.trim());
      } else {
        next.delete("targetId");
      }
      next.delete("artifactId");
    });
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
      const payload = await createArtifact(instanceId, {
        workspace_id: createForm.workspaceId.trim() || null,
        workspace_role: createForm.workspaceRole || null,
        artifact_type: createForm.artifactType,
        label: createForm.label.trim(),
        uri: createForm.uri.trim(),
        media_type: createForm.mediaType.trim() || null,
        preview_url: createForm.previewUrl.trim() || null,
        size_bytes: createForm.sizeBytes.trim() ? Number(createForm.sizeBytes) : null,
        status: createForm.status,
        attachments: parseAttachments(createForm.attachmentsJson),
        metadata: parseMetadata(createForm.metadataJson, "Artifact metadata"),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("artifactId", payload.artifact.artifact_id);
      });
      setMessage(`Artifact ${payload.artifact.artifact_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Artifact creation failed.");
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
      const payload = await updateArtifact(instanceId, detail.artifact_id, {
        label: editForm.label.trim(),
        uri: editForm.uri.trim(),
        media_type: editForm.mediaType.trim() || null,
        preview_url: editForm.previewUrl.trim() || null,
        size_bytes: editForm.sizeBytes.trim() ? Number(editForm.sizeBytes) : null,
        status: editForm.status,
        metadata: parseMetadata(editForm.metadataJson, "Artifact metadata"),
      });
      setMessage(`Artifact ${payload.artifact.artifact_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Artifact update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Artifacts"
          description="ForgeFrame is restoring artifact scope before exposing cross-surface attachments and preview/handoff evidence."
          question="Which artifact inventory should anchor the current review?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while access is restored." },
            { label: "Workspaces", to: CONTROL_PLANE_ROUTES.workspaces, description: "Open workspace truth after session state resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Artifact truth stays instance-scoped and attachment-backed. ForgeFrame waits for session state before opening the inventory."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Artifacts"
          description="This route is reserved for operators and admins who can inspect attached runtime evidence."
          question="Which adjacent surface should you use when artifact review is outside the current permission envelope?"
          links={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect run state without the cross-surface artifact inventory." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Inspect approval decisions without the artifact inventory." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard and branch into the correct surface." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewers do not get a cosmetic artifact shell. This route stays closed unless the session can inspect real attached evidence."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Artifacts"
        description="Cross-surface artifact inventory attached to workspaces, runs, approvals, instances, and decision evidence."
        question="Are preview, review, and handoff artifacts attached to real runtime objects, or are they still floating outside product truth?"
        links={[
          { label: "Artifacts", to: CONTROL_PLANE_ROUTES.artifacts, description: "Stay on the artifact inventory and detail surface." },
          { label: "Workspaces", to: buildWorkspacePath({ instanceId, workspaceId: workspaceIdFilter || undefined }), description: "Open the linked workspace surface." },
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect run truth linked from artifact attachments." },
          { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Inspect approval truth linked from artifact attachments." },
        ]}
        badges={[
          { label: `${artifacts.length} artifact${artifacts.length === 1 ? "" : "s"}`, tone: artifacts.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Artifacts are first-class objects. This surface must expose where they live, what they point to, and whether preview or handoff state is real."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then narrow the artifact inventory by workspace or target attachment.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>
            {instancesState}
          </span>
        </div>
        <form className="fg-inline-form" onSubmit={handleFilterSubmit}>
          <label>
            Instance
            <select value={instanceId} onChange={(event) => updateRoute((next) => {
              next.set("instanceId", event.target.value);
              next.delete("artifactId");
            })}>
              {instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Workspace
            <input value={workspaceDraft} onChange={(event) => setWorkspaceDraft(event.target.value)} placeholder="ws_customer_pricing" />
          </label>
          <label>
            Target kind
            <select value={targetKindDraft} onChange={(event) => setTargetKindDraft(event.target.value as ArtifactAttachmentTargetKind | "")}>
              {TARGET_KIND_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "all"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target ID
            <input value={targetIdDraft} onChange={(event) => setTargetIdDraft(event.target.value)} placeholder="run_alpha" />
          </label>
          <div className="fg-actions fg-actions-end">
            <button type="submit">Apply filter</button>
          </div>
        </form>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Artifact inventory</h3>
              <p className="fg-muted">Each row is a durable artifact record with attachment truth, not an implicit blob hidden behind a run or approval.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>
              {listState}
            </span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading artifact inventory.</p> : null}
          {listState === "success" && artifacts.length === 0 ? <p className="fg-muted">No artifacts matched the selected filters.</p> : null}

          {artifacts.length > 0 ? (
            <div className="fg-stack">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.artifact_id}
                  type="button"
                  className={`fg-data-row${artifact.artifact_id === selectedArtifactId ? " is-current" : ""}`}
                  onClick={() => updateRoute((next) => {
                    next.set("artifactId", artifact.artifact_id);
                  })}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{artifact.artifact_id}</span>
                      <strong>{artifact.label}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={artifact.status === "active" ? "success" : artifact.status === "superseded" ? "warning" : "neutral"}>
                        {artifact.status}
                      </span>
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">{artifact.artifact_type} · workspace {artifact.workspace_id ?? "none"}</span>
                    <span className="fg-muted">{artifact.attachments.length} attachment{artifact.attachments.length === 1 ? "" : "s"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Artifact detail</h3>
              <p className="fg-muted">Attachment truth, workspace context, and preview/handoff references converge here.</p>
            </div>
            {selectedArtifact ? <span className="fg-pill">{selectedArtifact.artifact_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select an artifact to inspect attachment truth and linked workspace state.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading artifact detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Artifact ID: <span className="fg-code">{detail.artifact_id}</span></li>
                    <li>Type: {detail.artifact_type}</li>
                    <li>Status: {detail.status}</li>
                    <li>Workspace: {detail.workspace_id ?? "None"}</li>
                    <li>Media type: {detail.media_type ?? "Not recorded"}</li>
                    <li>Size bytes: {detail.size_bytes ?? "Not recorded"}</li>
                    <li>Created at: {detail.created_at}</li>
                  </ul>
                </article>
                <article className="fg-subcard">
                  <h4>References</h4>
                  <ul className="fg-list">
                    <li>URI: {detail.uri}</li>
                    <li>Preview URL: {detail.preview_url ?? "Not recorded"}</li>
                    <li>Created by: {detail.created_by_type} · {detail.created_by_id ?? "system"}</li>
                  </ul>
                  <div className="fg-actions">
                    {detail.workspace_id ? (
                      <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace_id })}>
                        Open workspace
                      </Link>
                    ) : null}
                    <Link className="fg-nav-link" to={buildArtifactsPath({ instanceId, artifactId: detail.artifact_id })}>
                      Direct artifact link
                    </Link>
                  </div>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Metadata</h4>
                <pre>{JSON.stringify(detail.metadata, null, 2)}</pre>
              </article>

              <article className="fg-subcard">
                <h4>Attachments</h4>
                {detail.attachments.length === 0 ? <p className="fg-muted">No attachments were recorded for this artifact.</p> : (
                  <ul className="fg-list">
                    {detail.attachments.map((attachment) => {
                      const link = describeAttachmentLink(instanceId, attachment);
                      return (
                        <li key={attachment.attachment_id}>
                          <span className="fg-code">{attachment.target_kind}:{attachment.target_id}</span>
                          {" · role "}{attachment.role}
                          {link ? <> · <Link to={link.href}>{link.label}</Link></> : null}
                        </li>
                      );
                    })}
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
              <h3>Create artifact</h3>
              <p className="fg-muted">Create a durable artifact and attach it to real workspace, run, approval, instance, or decision truth.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Workspace ID
                <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} placeholder="ws_customer_pricing" />
              </label>
              <label>
                Workspace role
                <select value={createForm.workspaceRole} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceRole: event.target.value as ArtifactWorkspaceRole | "" }))}>
                  {WORKSPACE_ROLE_OPTIONS.map((option) => (
                    <option key={option || "none"} value={option}>
                      {option || "none"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Type
                <select value={createForm.artifactType} onChange={(event) => setCreateForm((current) => ({ ...current, artifactType: event.target.value as ArtifactType }))}>
                  {ARTIFACT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ArtifactStatus }))}>
                  {ARTIFACT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>
              Label
              <input value={createForm.label} onChange={(event) => setCreateForm((current) => ({ ...current, label: event.target.value }))} placeholder="Preview package" />
            </label>
            <label>
              URI
              <input value={createForm.uri} onChange={(event) => setCreateForm((current) => ({ ...current, uri: event.target.value }))} placeholder="file:///var/lib/forgeframe/workspaces/ws_customer_pricing/preview.pdf" />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Media type
                <input value={createForm.mediaType} onChange={(event) => setCreateForm((current) => ({ ...current, mediaType: event.target.value }))} placeholder="application/pdf" />
              </label>
              <label>
                Preview URL
                <input value={createForm.previewUrl} onChange={(event) => setCreateForm((current) => ({ ...current, previewUrl: event.target.value }))} placeholder="https://forgeframe.local/previews/ws_customer_pricing" />
              </label>
              <label>
                Size bytes
                <input value={createForm.sizeBytes} onChange={(event) => setCreateForm((current) => ({ ...current, sizeBytes: event.target.value }))} placeholder="4096" />
              </label>
            </div>
            <label>
              Attachments JSON
              <textarea rows={6} value={createForm.attachmentsJson} onChange={(event) => setCreateForm((current) => ({ ...current, attachmentsJson: event.target.value }))} />
            </label>
            <label>
              Metadata JSON
              <textarea rows={6} value={createForm.metadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.label.trim() || !createForm.uri.trim()}>
                {savingCreate ? "Creating artifact" : "Create artifact"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit artifact</h3>
              <p className="fg-muted">Mutate the selected artifact without losing attachment truth or metadata context.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>
              {detail ? detail.artifact_id : "Select an artifact"}
            </span>
          </div>
          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <label>
                Label
                <input value={editForm.label} onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} />
              </label>
              <label>
                URI
                <input value={editForm.uri} onChange={(event) => setEditForm((current) => ({ ...current, uri: event.target.value }))} />
              </label>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Media type
                  <input value={editForm.mediaType} onChange={(event) => setEditForm((current) => ({ ...current, mediaType: event.target.value }))} />
                </label>
                <label>
                  Preview URL
                  <input value={editForm.previewUrl} onChange={(event) => setEditForm((current) => ({ ...current, previewUrl: event.target.value }))} />
                </label>
                <label>
                  Size bytes
                  <input value={editForm.sizeBytes} onChange={(event) => setEditForm((current) => ({ ...current, sizeBytes: event.target.value }))} />
                </label>
              </div>
              <label>
                Status
                <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as ArtifactStatus }))}>
                  {ARTIFACT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Metadata JSON
                <textarea rows={6} value={editForm.metadataJson} onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))} />
              </label>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate}>
                  {savingUpdate ? "Saving artifact" : "Save artifact"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select an artifact before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
