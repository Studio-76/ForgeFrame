/**
 * Master hook for the Knowledge Sources page.
 *
 * Manages session access, URL state, data fetching, form state,
 * CRUD handlers, and visibility toggles.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createKnowledgeSource,
  fetchInstances,
  fetchKnowledgeSourceDetail,
  fetchKnowledgeSources,
  updateKnowledgeSource,
  type KnowledgeSourceDetail,
  type KnowledgeSourceKind,
  type KnowledgeSourceStatus,
  type KnowledgeSourceSummary,
} from "../../api/domain";
import { useAppSession } from "../../app/session";
import {
  getWorkInteractionAccess,
  normalizeOptional,
  type LoadState,
} from "../../pages/workInteractionPageSupport";
import {
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  type CreateKnowledgeSourceForm,
  type EditKnowledgeSourceForm,
  type KnowledgeSourceSummaryCounts,
} from "./types";
import { buildSourceMetadata, computeSummaryCounts, splitSourceMetadata } from "./utils";

/**
 * Return value of the useKnowledgeSources() hook.
 */
export interface UseKnowledgeSourcesReturn {
  session: ReturnType<typeof useAppSession>["session"];
  sessionReady: boolean;
  canRead: boolean;
  canMutate: boolean;
  instanceId: string;
  sourceId: string;
  sourceKindFilter: string;
  statusFilter: string;
  instances: Array<{ instance_id: string; display_name: string }>;
  sources: KnowledgeSourceSummary[];
  detail: KnowledgeSourceDetail | null;
  summaryCounts: KnowledgeSourceSummaryCounts;
  showCreateForm: boolean;
  showEditForm: boolean;
  instancesState: LoadState;
  listState: LoadState;
  detailState: LoadState;
  createForm: CreateKnowledgeSourceForm;
  editForm: EditKnowledgeSourceForm;
  savingCreate: boolean;
  savingUpdate: boolean;
  error: string;
  message: string;
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateKnowledgeSourceForm>>;
  setEditForm: React.Dispatch<React.SetStateAction<EditKnowledgeSourceForm>>;
  setShowCreateForm: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEditForm: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Master hook for the Knowledge Sources page.
 *
 * Centralises all data fetching, form state, CRUD operations, and UI
 * visibility toggles for the decomposed feature components.
 */
export function useKnowledgeSources(): UseKnowledgeSourcesReturn {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const sourceId = searchParams.get("sourceId")?.trim() ?? "";
  const sourceKindFilter = (searchParams.get("sourceKind")?.trim() as KnowledgeSourceKind | "all" | "") || "all";
  const statusFilter = (searchParams.get("status")?.trim() as KnowledgeSourceStatus | "all" | "") || "all";

  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [sources, setSources] = useState<KnowledgeSourceSummary[]>([]);
  const [detail, setDetail] = useState<KnowledgeSourceDetail | null>(null);
  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateKnowledgeSourceForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditKnowledgeSourceForm>(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => setSearchParams(next, { replace }));
  };

  // Fetch instances
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
          updateRoute((next) => next.set("instanceId", payload.instances[0].instance_id), true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Knowledge-source instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  // Fetch sources list
  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setSources([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchKnowledgeSources(instanceId, { sourceKind: sourceKindFilter, status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) return;
        setSources(payload.sources);
        setListState("success");
        setError("");

        const nextSourceId = payload.sources.some((s) => s.source_id === sourceId)
          ? sourceId
          : payload.sources[0]?.source_id ?? "";
        if (nextSourceId !== sourceId) {
          updateRoute((next) => {
            if (nextSourceId) {
              next.set("sourceId", nextSourceId);
            } else {
              next.delete("sourceId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setSources([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Knowledge-source inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, sourceId, sourceKindFilter, statusFilter]);

  // Fetch detail
  useEffect(() => {
    if (!canRead || !instanceId || !sourceId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchKnowledgeSourceDetail(sourceId, instanceId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.source);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Knowledge-source detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, sourceId]);

  // Sync edit form when detail changes
  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setShowEditForm(false);
      return;
    }

    const structuredMetadata = splitSourceMetadata(detail);
    setEditForm({
      sourceKind: detail.source_kind,
      label: detail.label,
      description: detail.description,
      connectionTarget: detail.connection_target,
      status: detail.status,
      visibilityScope: detail.visibility_scope,
      lastSyncedAt: detail.last_synced_at ?? "",
      lastError: detail.last_error ?? "",
      connectorAccount: structuredMetadata.connectorAccount,
      connectorCollection: structuredMetadata.connectorCollection,
      indexMode: structuredMetadata.indexMode,
      recallClass: structuredMetadata.recallClass,
      scopeNote: structuredMetadata.scopeNote,
      errorNextStep: structuredMetadata.errorNextStep,
      advancedMetadataJson: structuredMetadata.advancedMetadataJson,
    });
  }, [detail]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) return;

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createKnowledgeSource(instanceId, {
        source_id: normalizeOptional(createForm.sourceId),
        source_kind: createForm.sourceKind,
        label: createForm.label.trim(),
        description: createForm.description.trim(),
        connection_target: createForm.connectionTarget.trim(),
        status: createForm.status,
        visibility_scope: createForm.visibilityScope,
        last_synced_at: normalizeOptional(createForm.lastSyncedAt),
        last_error: normalizeOptional(createForm.lastError),
        metadata: buildSourceMetadata(createForm),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      setShowCreateForm(false);
      updateRoute((next) => next.set("sourceId", payload.source.source_id));
      setMessage(`Knowledge source ${payload.source.source_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Knowledge-source creation failed.");
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
      const payload = await updateKnowledgeSource(instanceId, detail.source_id, {
        label: editForm.label.trim(),
        description: editForm.description.trim(),
        connection_target: editForm.connectionTarget.trim(),
        status: editForm.status,
        visibility_scope: editForm.visibilityScope,
        last_synced_at: normalizeOptional(editForm.lastSyncedAt),
        last_error: normalizeOptional(editForm.lastError),
        metadata: buildSourceMetadata(editForm),
      });
      setMessage(`Knowledge source ${payload.source.source_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Knowledge-source update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const summaryCounts = computeSummaryCounts(sources);

  return {
    session,
    sessionReady,
    canRead,
    canMutate,
    instanceId,
    sourceId,
    sourceKindFilter,
    statusFilter,
    instances,
    sources,
    detail,
    summaryCounts,
    showCreateForm,
    showEditForm,
    instancesState,
    listState,
    detailState,
    createForm,
    editForm,
    savingCreate,
    savingUpdate,
    error,
    message,
    updateRoute,
    handleCreate,
    handleUpdate,
    setCreateForm,
    setEditForm,
    setShowCreateForm,
    setShowEditForm,
  };
}
