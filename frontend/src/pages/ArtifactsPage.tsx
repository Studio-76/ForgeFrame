import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createArtifact,
  fetchArtifactDetail,
  fetchArtifacts,
  updateArtifact,
  type ArtifactAttachmentRecord,
  type ArtifactAttachmentTargetKind,
  type ArtifactRecord,
  type ArtifactStatus,
  type ArtifactType,
  type ArtifactWorkspaceRole,
} from "../api/domain/artifacts";
import { fetchInstances } from "../api/domain/instances";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { buildArtifactsPath, buildWorkspacePath } from "../app/workInteractionRoutes";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

type ArtifactEditorForm = {
  workspaceId: string;
  workspaceRole: ArtifactWorkspaceRole | "";
  linkedRunId: string;
  linkedApprovalId: string;
  linkedDecisionId: string;
  artifactType: ArtifactType;
  label: string;
  uri: string;
  mediaType: string;
  previewUrl: string;
  sizeBytes: string;
  version: string;
  checksumSha256: string;
  retentionPolicy: string;
  retainedUntil: string;
  archiveReason: string;
  status: ArtifactStatus;
  advancedMetadataJson: string;
};

type LinkedArtifactObject = {
  key: string;
  kind: ArtifactAttachmentTargetKind | "workspace";
  label: string;
  identifier: string;
  role: string | null;
  href: string | null;
};

type ArtifactAccessSummary = {
  previewUrl: string | null;
  downloadUrl: string | null;
  inlinePreviewUrl: string | null;
  previewState: "available" | "bridge-only";
  downloadState: "available" | "bridge-only";
  surfaceState: "preview-ready" | "download-ready" | "metadata-only";
  note: string;
};

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

const DEFAULT_CREATE_FORM: ArtifactEditorForm = {
  workspaceId: "",
  workspaceRole: "",
  linkedRunId: "",
  linkedApprovalId: "",
  linkedDecisionId: "",
  artifactType: "file",
  label: "",
  uri: "",
  mediaType: "",
  previewUrl: "",
  sizeBytes: "",
  version: "",
  checksumSha256: "",
  retentionPolicy: "",
  retainedUntil: "",
  archiveReason: "",
  status: "active",
  advancedMetadataJson: "{}",
};

const DEFAULT_EDIT_FORM: ArtifactEditorForm = {
  workspaceId: "",
  workspaceRole: "",
  linkedRunId: "",
  linkedApprovalId: "",
  linkedDecisionId: "",
  artifactType: "file",
  label: "",
  uri: "",
  mediaType: "",
  previewUrl: "",
  sizeBytes: "",
  version: "",
  checksumSha256: "",
  retentionPolicy: "",
  retainedUntil: "",
  archiveReason: "",
  status: "active",
  advancedMetadataJson: "{}",
};

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function parseJsonObject(rawValue: string, fieldLabel: string): Record<string, unknown> {
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

function parseSizeBytes(rawValue: string): number | null {
  const normalized = rawValue.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Size bytes must be a non-negative number.");
  }
  return parsed;
}

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not recorded";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatChecksum(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }
  return value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

function externalHttpUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function cloneArtifactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

function stripStructuredMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const advanced = cloneArtifactMetadata(metadata);
  delete advanced.version;
  delete advanced.version_label;
  delete advanced.artifact_version;
  delete advanced.checksum_sha256;
  delete advanced.sha256;
  delete advanced.checksum;
  delete advanced.archive_reason;
  delete advanced.retention_policy;
  delete advanced.retained_until;

  const retention = advanced.retention;
  if (retention && typeof retention === "object" && !Array.isArray(retention)) {
    const nextRetention = { ...(retention as Record<string, unknown>) };
    delete nextRetention.policy;
    delete nextRetention.classification;
    delete nextRetention.retained_until;
    if (Object.keys(nextRetention).length === 0) {
      delete advanced.retention;
    } else {
      advanced.retention = nextRetention;
    }
  }

  return advanced;
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

function describeArtifactAccess(artifact: ArtifactRecord): ArtifactAccessSummary {
  const previewUrl = externalHttpUrl(artifact.preview_url)
    ?? (artifact.artifact_type === "preview_link" ? externalHttpUrl(artifact.uri) : null);
  const downloadUrl = externalHttpUrl(artifact.uri);
  const inlinePreviewUrl = previewUrl && (
    artifact.media_type?.startsWith("image/")
    || artifact.media_type === "application/pdf"
    || artifact.media_type === "text/html"
    || artifact.artifact_type === "preview_link"
  )
    ? previewUrl
    : null;

  if (previewUrl && downloadUrl) {
    return {
      previewUrl,
      downloadUrl,
      inlinePreviewUrl,
      previewState: "available",
      downloadState: "available",
      surfaceState: "preview-ready",
      note: "Preview and download both resolve through browser-reachable URLs.",
    };
  }
  if (previewUrl) {
    return {
      previewUrl,
      downloadUrl: null,
      inlinePreviewUrl,
      previewState: "available",
      downloadState: "bridge-only",
      surfaceState: "preview-ready",
      note: "Preview is available, but download still depends on a bridge or external blob store.",
    };
  }
  if (downloadUrl) {
    return {
      previewUrl: null,
      downloadUrl,
      inlinePreviewUrl: null,
      previewState: "bridge-only",
      downloadState: "available",
      surfaceState: "download-ready",
      note: "Download is browser-reachable, but no dedicated preview URL was recorded.",
    };
  }
  return {
    previewUrl: null,
    downloadUrl: null,
    inlinePreviewUrl: null,
    previewState: "bridge-only",
    downloadState: "bridge-only",
    surfaceState: "metadata-only",
    note: "ForgeFrame does not expose blob delivery for this URI on the current admin surface. The artifact remains metadata-only here.",
  };
}

function buildLinkedObjects(instanceId: string, artifact: ArtifactRecord): LinkedArtifactObject[] {
  const objects: LinkedArtifactObject[] = [];
  const seen = new Set<string>();
  const priority: Record<LinkedArtifactObject["kind"], number> = {
    workspace: 0,
    run: 1,
    approval: 2,
    instance: 3,
    decision: 4,
  };

  if (artifact.workspace_id) {
    const key = `workspace:${artifact.workspace_id}`;
    seen.add(key);
    objects.push({
      key,
      kind: "workspace",
      label: "Workspace",
      identifier: artifact.workspace_id,
      role: artifact.workspace_role ?? "artifact",
      href: buildWorkspacePath({ instanceId, workspaceId: artifact.workspace_id }),
    });
  }

  artifact.attachments.forEach((attachment) => {
    const key = `${attachment.target_kind}:${attachment.target_id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const link = describeAttachmentLink(instanceId, attachment);
    objects.push({
      key,
      kind: attachment.target_kind,
      label: attachment.target_kind === "run"
        ? "Run"
        : attachment.target_kind === "approval"
          ? "Approval"
          : attachment.target_kind === "instance"
            ? "Instance"
            : attachment.target_kind === "decision"
              ? "Decision"
              : "Workspace",
      identifier: attachment.target_id,
      role: attachment.role,
      href: link?.href ?? null,
    });
  });

  return objects.sort((left, right) => (
    priority[left.kind] - priority[right.kind]
    || left.identifier.localeCompare(right.identifier)
    || (left.role ?? "").localeCompare(right.role ?? "")
  ));
}

function buildArtifactMetadata(form: ArtifactEditorForm): Record<string, unknown> {
  return parseJsonObject(form.advancedMetadataJson, "Artifact advanced metadata");
}

function buildCreateAttachments(form: ArtifactEditorForm, instanceId: string): Array<{
  target_kind: ArtifactAttachmentTargetKind;
  target_id: string;
  role?: string;
}> {
  const attachments: Array<{
    target_kind: ArtifactAttachmentTargetKind;
    target_id: string;
    role?: string;
  }> = [];
  const runId = normalizeOptionalText(form.linkedRunId);
  const approvalId = normalizeOptionalText(form.linkedApprovalId);
  const decisionId = normalizeOptionalText(form.linkedDecisionId);

  if (runId) {
    attachments.push({ target_kind: "run", target_id: runId, role: "run_output" });
  }
  if (approvalId) {
    attachments.push({ target_kind: "approval", target_id: approvalId, role: "approval_evidence" });
  }
  if (decisionId) {
    attachments.push({ target_kind: "decision", target_id: decisionId, role: "decision_context" });
  }

  if (!normalizeOptionalText(form.workspaceId) && attachments.length === 0) {
    attachments.push({ target_kind: "instance", target_id: instanceId, role: "instance_scope" });
  }

  return attachments;
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

  const linkedObjects = useMemo(
    () => (detail && instanceId ? buildLinkedObjects(instanceId, detail) : []),
    [detail, instanceId],
  );
  const accessSummary = useMemo(() => (detail ? describeArtifactAccess(detail) : null), [detail]);

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

    const advancedMetadata = stripStructuredMetadata(detail.metadata ?? {});
    setEditForm({
      workspaceId: detail.workspace_id ?? "",
      workspaceRole: detail.workspace_role ?? "",
      linkedRunId: "",
      linkedApprovalId: "",
      linkedDecisionId: "",
      artifactType: detail.artifact_type,
      label: detail.label,
      uri: detail.uri,
      mediaType: detail.media_type ?? "",
      previewUrl: detail.preview_url ?? "",
      sizeBytes: detail.size_bytes === null || detail.size_bytes === undefined ? "" : String(detail.size_bytes),
      version: detail.version ?? "",
      checksumSha256: detail.checksum_sha256 ?? "",
      retentionPolicy: detail.retention_policy ?? "",
      retainedUntil: detail.retained_until ?? "",
      archiveReason: detail.archive_reason ?? "",
      status: detail.status,
      advancedMetadataJson: JSON.stringify(advancedMetadata, null, 2),
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
        workspace_id: normalizeOptionalText(createForm.workspaceId),
        workspace_role: createForm.workspaceRole || null,
        artifact_type: createForm.artifactType,
        label: createForm.label.trim(),
        uri: createForm.uri.trim(),
        media_type: normalizeOptionalText(createForm.mediaType),
        preview_url: normalizeOptionalText(createForm.previewUrl),
        size_bytes: parseSizeBytes(createForm.sizeBytes),
        version: normalizeOptionalText(createForm.version),
        checksum_sha256: normalizeOptionalText(createForm.checksumSha256),
        retention_policy: normalizeOptionalText(createForm.retentionPolicy),
        retained_until: normalizeOptionalText(createForm.retainedUntil),
        archive_reason: normalizeOptionalText(createForm.archiveReason),
        status: createForm.status,
        attachments: buildCreateAttachments(createForm, instanceId),
        metadata: buildArtifactMetadata(createForm),
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
        media_type: normalizeOptionalText(editForm.mediaType),
        preview_url: normalizeOptionalText(editForm.previewUrl),
        size_bytes: parseSizeBytes(editForm.sizeBytes),
        version: normalizeOptionalText(editForm.version),
        checksum_sha256: normalizeOptionalText(editForm.checksumSha256),
        retention_policy: normalizeOptionalText(editForm.retentionPolicy),
        retained_until: normalizeOptionalText(editForm.retainedUntil),
        archive_reason: normalizeOptionalText(editForm.archiveReason),
        status: editForm.status,
        metadata: buildArtifactMetadata(editForm),
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
          description="ForgeFrame is restoring artifact scope before exposing preview, retention, and handoff evidence."
          question="Which artifact inventory should anchor the current review?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while access is restored." },
            { label: "Workspaces", to: CONTROL_PLANE_ROUTES.workspaces, description: "Open workspace truth after session state resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Artifacts stay instance-scoped and attachment-backed. ForgeFrame waits for session state before opening preview or download truth."
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
        description="Artifact inventory for preview, download, linked runtime objects, checksums, versions, and retention posture."
        question="Is each artifact reviewable and downloadable from real storage, or is the surface still exposing metadata-only evidence without pretending blob support exists?"
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
        note="Upload is intentionally absent here because the current backend persists artifact metadata and URIs, but does not provide blob ingestion or signed delivery endpoints."
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
              <p className="fg-muted">Type, scope, checksum, version, linked workspace/run/approval truth, and creation time stay visible in one inventory.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>
              {listState}
            </span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading artifact inventory.</p> : null}
          {listState === "success" && artifacts.length === 0 ? <p className="fg-muted">No artifacts matched the selected filters.</p> : null}

          {artifacts.length > 0 ? (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Artifact inventory">
                <thead>
                  <tr>
                    <th>Artifact</th>
                    <th>Type</th>
                    <th>Scope</th>
                    <th>Size / checksum</th>
                    <th>Version</th>
                    <th>Linked objects</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.map((artifact) => {
                    const rowLinks = buildLinkedObjects(instanceId, artifact);
                    const rowAccess = describeArtifactAccess(artifact);
                    return (
                      <tr key={artifact.artifact_id}>
                        <td>
                          <button
                            className="fg-table-trigger"
                            type="button"
                            onClick={() => updateRoute((next) => {
                              next.set("artifactId", artifact.artifact_id);
                            })}
                          >
                            {artifact.label}
                          </button>
                          <div className="fg-code">{artifact.artifact_id}</div>
                          <div className="fg-muted">{rowAccess.surfaceState === "metadata-only" ? "metadata-only on this surface" : rowAccess.surfaceState}</div>
                        </td>
                        <td>
                          <div>{artifact.artifact_type}</div>
                          <span className="fg-pill" data-tone={artifact.status === "active" ? "success" : artifact.status === "superseded" ? "warning" : "neutral"}>
                            {artifact.status}
                          </span>
                        </td>
                        <td>
                          <div>{artifact.scope_label ?? (artifact.workspace_id ? "Workspace" : "Instance")}</div>
                          <div className="fg-muted">{artifact.workspace_id ?? artifact.instance_id}</div>
                        </td>
                        <td>
                          <div>{formatBytes(artifact.size_bytes)}</div>
                          <div className="fg-muted">{formatChecksum(artifact.checksum_sha256)}</div>
                        </td>
                        <td>{artifact.version ?? "Not recorded"}</td>
                        <td>
                          {rowLinks.length === 0 ? (
                            <span className="fg-muted">No explicit links</span>
                          ) : (
                            <ul className="fg-list">
                              {rowLinks.slice(0, 3).map((item) => (
                                <li key={item.key}>
                                  {item.href ? <Link to={item.href}>{item.label}: {item.identifier}</Link> : <span>{item.label}: <span className="fg-code">{item.identifier}</span></span>}
                                </li>
                              ))}
                              {rowLinks.length > 3 ? <li className="fg-muted">+{rowLinks.length - 3} more linked objects</li> : null}
                            </ul>
                          )}
                        </td>
                        <td>{formatTimestamp(artifact.created_at)}</td>
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
              <h3>Artifact detail</h3>
              <p className="fg-muted">Preview, download posture, linked runtime objects, versioning, retention, and advanced metadata converge here.</p>
            </div>
            {selectedArtifact ? <span className="fg-pill">{selectedArtifact.artifact_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select an artifact to inspect access posture and linked runtime truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading artifact detail.</p> : null}

          {detail && accessSummary ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <div className="fg-panel-heading">
                    <div>
                      <h4>Preview and download</h4>
                      <p className="fg-muted">The surface only exposes real browser-reachable links. File and opaque storage URIs stay clearly blocked instead of faking download buttons.</p>
                    </div>
                    <span className="fg-pill" data-tone={accessSummary.surfaceState === "metadata-only" ? "warning" : "success"}>
                      {accessSummary.surfaceState}
                    </span>
                  </div>
                  <ul className="fg-list">
                    <li>Preview: {accessSummary.previewUrl ? "available" : "bridge-only"}</li>
                    <li>Download: {accessSummary.downloadUrl ? "available" : "bridge-only"}</li>
                    <li>URI: <span className="fg-code">{detail.uri}</span></li>
                    <li>Preview URL: {detail.preview_url ? <span className="fg-code">{detail.preview_url}</span> : "Not recorded"}</li>
                  </ul>
                  <p className={accessSummary.surfaceState === "metadata-only" ? "fg-danger" : "fg-muted"}>{accessSummary.note}</p>
                  <div className="fg-actions">
                    {accessSummary.previewUrl ? <a className="fg-nav-link" href={accessSummary.previewUrl} target="_blank" rel="noreferrer">Open preview</a> : null}
                    {accessSummary.downloadUrl ? <a className="fg-nav-link" href={accessSummary.downloadUrl} target="_blank" rel="noreferrer">Download artifact</a> : null}
                  </div>
                  {accessSummary.inlinePreviewUrl ? (
                    detail.media_type?.startsWith("image/") ? (
                      <img src={accessSummary.inlinePreviewUrl} alt={detail.label} style={{ width: "100%", borderRadius: "12px" }} />
                    ) : (
                      <iframe title={`Preview ${detail.label}`} src={accessSummary.inlinePreviewUrl} style={{ width: "100%", minHeight: "320px", border: "1px solid rgba(148, 163, 184, 0.35)", borderRadius: "12px" }} />
                    )
                  ) : null}
                </article>

                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Artifact ID: <span className="fg-code">{detail.artifact_id}</span></li>
                    <li>Scope: {detail.scope_label ?? (detail.workspace_id ? "Workspace" : "Instance")}</li>
                    <li>Workspace: {detail.workspace_id ?? "Instance-scoped only"}</li>
                    <li>Workspace role: {detail.workspace_role ?? "Not recorded"}</li>
                    <li>Created by: {detail.created_by_type} · {detail.created_by_id ?? "system"}</li>
                    <li>Created at: {formatTimestamp(detail.created_at)}</li>
                    <li>Updated at: {formatTimestamp(detail.updated_at)}</li>
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

                <article className="fg-subcard">
                  <h4>Version and retention</h4>
                  <ul className="fg-list">
                    <li>Version: {detail.version ?? "Not recorded"}</li>
                    <li>Checksum (SHA-256): {detail.checksum_sha256 ? <span className="fg-code">{detail.checksum_sha256}</span> : "Not recorded"}</li>
                    <li>Size: {formatBytes(detail.size_bytes)}</li>
                    <li>Retention policy: {detail.retention_policy ?? "Not recorded"}</li>
                    <li>Retained until: {formatTimestamp(detail.retained_until, "Not recorded")}</li>
                    <li>Archive reason: {detail.archive_reason ?? "Not recorded"}</li>
                    <li>Status: {detail.status}</li>
                  </ul>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Linked objects</h4>
                {linkedObjects.length === 0 ? (
                  <p className="fg-muted">No workspace, run, approval, instance, or decision links were recorded for this artifact.</p>
                ) : (
                  <ul className="fg-list">
                    {linkedObjects.map((item) => (
                      <li key={item.key}>
                        <span className="fg-pill" data-tone="neutral">{item.label}</span>
                        {" "}
                        {item.href ? <Link to={item.href}>{item.identifier}</Link> : <span className="fg-code">{item.identifier}</span>}
                        {item.role ? <span className="fg-muted"> · role {item.role}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="fg-subcard">
                <h4>Advanced metadata</h4>
                <details>
                  <summary>Structured fields are primary. Raw metadata stays advanced.</summary>
                  <pre>{JSON.stringify(stripStructuredMetadata(detail.metadata ?? {}), null, 2)}</pre>
                </details>
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
              <p className="fg-muted">Create artifact metadata with explicit scope, linked runtime objects, version, checksum, and retention. Upload remains unsupported on this surface.</p>
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
              <label>
                Type
                <select value={createForm.artifactType} onChange={(event) => setCreateForm((current) => ({ ...current, artifactType: event.target.value as ArtifactType }))}>
                  {ARTIFACT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Linked run ID
                <input value={createForm.linkedRunId} onChange={(event) => setCreateForm((current) => ({ ...current, linkedRunId: event.target.value }))} placeholder="run_alpha" />
              </label>
              <label>
                Linked approval ID
                <input value={createForm.linkedApprovalId} onChange={(event) => setCreateForm((current) => ({ ...current, linkedApprovalId: event.target.value }))} placeholder="run:instance_alpha:company_alpha:approval-1" />
              </label>
              <label>
                Linked decision ID
                <input value={createForm.linkedDecisionId} onChange={(event) => setCreateForm((current) => ({ ...current, linkedDecisionId: event.target.value }))} placeholder="decision_alpha" />
              </label>
            </div>
            <label>
              Label
              <input value={createForm.label} onChange={(event) => setCreateForm((current) => ({ ...current, label: event.target.value }))} placeholder="Preview package" />
            </label>
            <label>
              URI
              <input value={createForm.uri} onChange={(event) => setCreateForm((current) => ({ ...current, uri: event.target.value }))} placeholder="https://forgeframe.local/previews/ws_customer_pricing" />
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
            <div className="fg-grid fg-grid-compact">
              <label>
                Version
                <input value={createForm.version} onChange={(event) => setCreateForm((current) => ({ ...current, version: event.target.value }))} placeholder="2026.04.29-1" />
              </label>
              <label>
                Checksum (SHA-256)
                <input value={createForm.checksumSha256} onChange={(event) => setCreateForm((current) => ({ ...current, checksumSha256: event.target.value }))} placeholder="ab12cd34..." />
              </label>
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ArtifactStatus }))}>
                  {ARTIFACT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Retention policy
                <input value={createForm.retentionPolicy} onChange={(event) => setCreateForm((current) => ({ ...current, retentionPolicy: event.target.value }))} placeholder="workspace_review_30d" />
              </label>
              <label>
                Retained until
                <input value={createForm.retainedUntil} onChange={(event) => setCreateForm((current) => ({ ...current, retainedUntil: event.target.value }))} placeholder="2026-05-30T12:00:00Z" />
              </label>
              <label>
                Archive reason
                <input value={createForm.archiveReason} onChange={(event) => setCreateForm((current) => ({ ...current, archiveReason: event.target.value }))} placeholder="Awaiting release sign-off" />
              </label>
            </div>
            <details>
              <summary>Advanced metadata</summary>
              <label>
                Advanced metadata JSON
                <textarea rows={6} value={createForm.advancedMetadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))} />
              </label>
            </details>
            <p className="fg-muted">If no workspace, run, approval, or decision link is supplied, ForgeFrame records this artifact as instance-scoped so it does not float without ownership.</p>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.label.trim() || !createForm.uri.trim()}>
                {savingCreate ? "Creating artifact..." : "Create artifact"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit artifact</h3>
              <p className="fg-muted">Update metadata, access URLs, versioning, retention, and archive posture without pretending this route can relink runtime objects.</p>
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
              <div className="fg-grid fg-grid-compact">
                <label>
                  Version
                  <input value={editForm.version} onChange={(event) => setEditForm((current) => ({ ...current, version: event.target.value }))} />
                </label>
                <label>
                  Checksum (SHA-256)
                  <input value={editForm.checksumSha256} onChange={(event) => setEditForm((current) => ({ ...current, checksumSha256: event.target.value }))} />
                </label>
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as ArtifactStatus }))}>
                    {ARTIFACT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Retention policy
                  <input value={editForm.retentionPolicy} onChange={(event) => setEditForm((current) => ({ ...current, retentionPolicy: event.target.value }))} />
                </label>
                <label>
                  Retained until
                  <input value={editForm.retainedUntil} onChange={(event) => setEditForm((current) => ({ ...current, retainedUntil: event.target.value }))} />
                </label>
                <label>
                  Archive reason
                  <input value={editForm.archiveReason} onChange={(event) => setEditForm((current) => ({ ...current, archiveReason: event.target.value }))} />
                </label>
              </div>
              <details>
                <summary>Advanced metadata</summary>
                <label>
                  Advanced metadata JSON
                  <textarea rows={6} value={editForm.advancedMetadataJson} onChange={(event) => setEditForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))} />
                </label>
              </details>
              <p className="fg-muted">Linked objects stay read-only in this form because the current patch endpoint only updates artifact metadata. Change workspace, run, or approval linkage from the originating surface instead of faking attachment edits here.</p>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate || !editForm.label.trim() || !editForm.uri.trim()}>
                  {savingUpdate ? "Saving artifact..." : "Save artifact"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select an artifact before attempting a metadata mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
