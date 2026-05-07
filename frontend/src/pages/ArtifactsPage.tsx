/**
 * Artifacts page — artifact registry management.
 *
 * Conforms to the Registry Management pattern. Uses the
 * RegistryManagementPage template with scope indicator, attention items,
 * summary metrics, inline filters, artifact DataTable, detail panel,
 * and collapsed diagnostics. Create and edit forms are always visible
 * as secondary controls below the registry.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createArtifact,
  fetchArtifactDetail,
  fetchArtifacts,
  updateArtifact,
  type ArtifactAttachmentTargetKind,
  type ArtifactRecord,
} from "../api/domain/artifacts";
import { fetchInstances } from "../api/domain/instances";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { withInstanceScope } from "../app/tenantScope";
import { buildWorkspacePath } from "../app/workInteractionRoutes";
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";
import { AdvancedDiagnostics, RawJson } from "../components/ui/AdvancedDiagnostics";
import { Button, ContextNavStrip } from "../components/ui";

import {
  ArtifactList,
  ArtifactDetailPanel,
  ArtifactCreateForm,
  ArtifactEditForm,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
} from "../features/artifacts";
import type { ArtifactEditorForm, LoadState } from "../features/artifacts";
import {
  buildLinkedObjects,
  describeArtifactAccess,
  stripStructuredMetadata,
  parseSizeBytes,
  normalizeOptionalText,
  buildArtifactMetadata,
  buildCreateAttachments,
} from "../features/artifacts";
import {
  TARGET_KIND_OPTIONS,
} from "../features/artifacts";

/**
 * Artifacts page — browse, filter, create, and edit artifact metadata.
 */
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
  const [createForm, setCreateForm] = useState<ArtifactEditorForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<ArtifactEditorForm>(DEFAULT_EDIT_FORM);
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

  const selectedInstance = useMemo(
    () => instances.find((inst) => inst.instance_id === instanceId) ?? null,
    [instances, instanceId],
  );

  // ── Summary counts ────────────────────────────────────
  const activeCount = artifacts.filter((a) => a.status === "active").length;
  const archivedCount = artifacts.filter((a) => a.status !== "active").length;

  const summaryItems: SummaryStripItem[] = [
    {
      key: "total",
      label: "Artifacts",
      value: artifacts.length,
      tone: artifacts.length > 0 ? "success" : undefined,
    },
    ...(activeCount > 0 ? [{
      key: "active" as const,
      label: "Active" as const,
      value: activeCount,
      tone: "success" as const,
    }] : []),
    ...(archivedCount > 0 ? [{
      key: "archived" as const,
      label: "Superseded / archived" as const,
      value: archivedCount,
      tone: "warning" as const,
    }] : []),
  ];

  // ── Attention items ───────────────────────────────────
  const attentionItems: AttentionPayload[] = [];
  if (error) {
    attentionItems.push({
      key: "artifacts-error",
      level: "primary_blocker",
      title: "Operation failed",
      description: error,
    });
  }
  if (message) {
    attentionItems.push({
      key: "artifacts-message",
      level: "informational",
      title: message,
    });
  }
  if (!canMutate && canRead) {
    attentionItems.push({
      key: "read-only",
      level: "informational",
      title: "Read only — mutation not available",
    });
  }

  // ── Route helpers ─────────────────────────────────────
  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  // ── Draft sync with URL params ────────────────────────
  useEffect(() => { setWorkspaceDraft(workspaceIdFilter); }, [workspaceIdFilter]);
  useEffect(() => { setTargetKindDraft(targetKindFilter); }, [targetKindFilter]);
  useEffect(() => { setTargetIdDraft(targetIdFilter); }, [targetIdFilter]);

  // ── Load instances ────────────────────────────────────
  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) return;
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Instance scope for artifacts could not be loaded.");
      });

    return () => { cancelled = true; };
  }, [canRead, instanceId]);

  // ── Load artifacts ────────────────────────────────────
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
        if (cancelled) return;
        setArtifacts(payload.artifacts);
        setListState("success");
        setError("");

        const nextArtifactId = payload.artifacts.some((art) => art.artifact_id === selectedArtifactId)
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
        if (cancelled) return;
        setArtifacts([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Artifact inventory could not be loaded.");
      });

    return () => { cancelled = true; };
  }, [canRead, instanceId, refreshNonce, selectedArtifactId, targetIdFilter, targetKindFilter, workspaceIdFilter]);

  // ── Load artifact detail ──────────────────────────────
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
        if (cancelled) return;
        setDetail(payload.artifact);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Artifact detail could not be loaded.");
      });

    return () => { cancelled = true; };
  }, [canRead, instanceId, refreshNonce, selectedArtifactId]);

  // ── Sync edit form from detail ────────────────────────
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

  // ── Handlers ──────────────────────────────────────────
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
    if (!canMutate || !instanceId) return;

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
    if (!canMutate || !instanceId || !detail) return;

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

  // ── Scope config ──────────────────────────────────────
  const scopeConfig = selectedInstance
    ? { label: selectedInstance.display_name }
    : instanceId
      ? { label: instanceId }
      : undefined;

  // ── Filter content ────────────────────────────────────
  const filterContent = (
    <form className="flex flex-wrap items-end gap-3" onSubmit={handleFilterSubmit}>
      <label className="flex flex-col gap-0.5 text-meta">
        Instance
        <select
          value={instanceId}
          onChange={(e) => updateRoute((next) => {
            next.set("instanceId", e.target.value);
            next.delete("artifactId");
          })}
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-primary"
        >
          {instances.map((inst) => (
            <option key={inst.instance_id} value={inst.instance_id}>
              {inst.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-meta">
        Workspace
        <input
          value={workspaceDraft}
          onChange={(e) => setWorkspaceDraft(e.target.value)}
          placeholder="ws_customer_pricing"
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-primary"
        />
      </label>
      <label className="flex flex-col gap-0.5 text-meta">
        Target kind
        <select
          value={targetKindDraft}
          onChange={(e) => setTargetKindDraft(e.target.value as ArtifactAttachmentTargetKind | "")}
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-primary"
        >
          {TARGET_KIND_OPTIONS.map((option) => (
            <option key={option || "all"} value={option}>{option || "all"}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-meta">
        Target ID
        <input
          value={targetIdDraft}
          onChange={(e) => setTargetIdDraft(e.target.value)}
          placeholder="run_alpha"
          className="bg-surface border border-border rounded px-2 py-1 text-sm text-primary"
        />
      </label>
      <Button variant="secondary" type="submit" density="compact">
        Apply filter
      </Button>
    </form>
  );

  // ── Instance load state pill ──────────────────────────
  const instanceLoadPill = (
    <span
      className="ff-status-badge"
      data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}
    >
      {instancesState}
    </span>
  );

  // ── Access gates ──────────────────────────────────────
  if (!sessionReady) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Artifacts"
        description="Restoring artifact scope before exposing preview and retention."
        isEmpty
        emptyTitle="Checking access"
        emptyDescription="Waiting for session state before opening artifact preview."
      />
    );
  }

  if (!canRead) {
    return (
      <>
        <RegistryManagementPage
          eyebrow="Work Interaction"
          title="Artifacts"
          description="Operator or admin access required to inspect runtime evidence."
          isEmpty
          emptyTitle="Operator or admin required"
          emptyDescription="This route is closed unless the session can inspect attached evidence."
        />
        <ContextNavStrip
          compact
          className="mt-3"
          items={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard },
          ]}
        />
      </>
    );
  }

  return (
    <RegistryManagementPage
      eyebrow="Work Interaction"
      title="Artifacts"
      description="Artifact inventory: preview, download, checksums, versions, and retention."
      scope={scopeConfig}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      filterContent={filterContent}
      actions={
        canMutate && instanceId
          ? [
              {
                label: "Create artifact",
                kind: "primary",
                intent: "configure",
                onClick: () => {
                  setError("");
                  setMessage("");
                },
                disabled: !canMutate || !instanceId,
              },
            ]
          : undefined
      }
      actionBarTitle="Artifact inventory"
      selectedItemContent={
        <ArtifactDetailPanel
          detail={detail}
          detailState={detailState}
          instanceId={instanceId}
          linkedObjects={linkedObjects}
          accessSummary={accessSummary}
        />
      }
      hasSelection={Boolean(selectedArtifactId)}
      emptyDetailHint="Select an artifact from the table to inspect access posture and linked runtime truth."
      diagnostics={
        <AdvancedDiagnostics title="Artifact diagnostics">
          <div className="fg-stack">
            <p className="text-meta text-muted">Instance scope: {instanceId || "Not selected"}</p>
            <p className="text-meta text-muted">Artifacts loaded: {artifacts.length}</p>
            {selectedArtifact
              ? (
                <RawJson
                  data={stripStructuredMetadata(selectedArtifact.metadata ?? {})}
                  label="Raw metadata"
                />
              )
              : null}
            <ContextNavStrip
              compact
              items={[
                { label: "Workspaces", to: buildWorkspacePath({ instanceId: instanceId || undefined }) },
                { label: "Execution Review", to: withInstanceScope(CONTROL_PLANE_ROUTES.execution, instanceId) },
                { label: "Approvals", to: withInstanceScope(CONTROL_PLANE_ROUTES.approvals, instanceId) },
              ]}
            />
          </div>
        </AdvancedDiagnostics>
      }
      diagnosticsTitle="Artifact diagnostics"
    >
      {instanceLoadPill}

      <ArtifactList
        artifacts={artifacts}
        instanceId={instanceId}
        selectedArtifactId={selectedArtifactId}
        listState={listState}
        onSelectArtifact={(artifactId) => {
          updateRoute((next) => {
            next.set("artifactId", artifactId);
          });
        }}
        error={listState === "error" ? error : undefined}
        onRetry={() => setRefreshNonce((c) => c + 1)}
      />

      <div className="fg-grid mt-4">
        <ArtifactCreateForm
          form={createForm}
          setForm={setCreateForm}
          canMutate={canMutate}
          saving={savingCreate}
          instanceId={instanceId}
          onSubmit={handleCreate}
        />

        <ArtifactEditForm
          detail={detail}
          form={editForm}
          setForm={setEditForm}
          canMutate={canMutate}
          saving={savingUpdate}
          onSubmit={handleUpdate}
        />
      </div>
    </RegistryManagementPage>
  );
}
