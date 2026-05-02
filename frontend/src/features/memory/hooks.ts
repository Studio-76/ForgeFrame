/**
 * Data-fetching hook and state management for the Memory page.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  correctMemoryEntry,
  createMemoryEntry,
  deleteMemoryEntry,
  fetchMemoryDetail,
  fetchMemoryEntries,
  revokeMemoryEntry,
  updateMemoryEntry,
  type MemoryDetail,
  type MemoryKind,
  type MemoryLayer,
  type MemorySensitivity,
  type MemorySourceTrustClass,
  type MemoryStatus,
  type MemorySummary,
} from "../../api/domain/memory";
import { fetchInstances } from "../../api/domain/instances";
import type { AdminSessionUser } from "../../api/domain/auth";
import { getWorkInteractionAccess } from "../../pages/workInteractionPageSupport";
import type { VisibilityScope } from "../../api/domain/contacts";
import type { LoadState } from "./types";
import {
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  DEFAULT_CORRECTION_FORM,
  DEFAULT_DELETE_FORM,
  DEFAULT_REVOKE_FORM,
} from "./types";
import {
  buildMemoryMetadata,
  classifyMemory,
  normalizeOptional,
  splitMemoryMetadata,
  validateMemoryGovernance,
} from "./utils";

/** Shape returned by useMemoryPage hook. */
export interface UseMemoryPageReturn {
  /** Whether the current user has read access. */
  canRead: boolean;
  /** Whether the current user has mutate access. */
  canMutate: boolean;

  /** Resolved instance ID from URL. */
  instanceId: string;
  /** Selected memory ID from URL. */
  selectedMemoryId: string;

  /** Instances list. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Instance loading state. */
  instancesState: LoadState;

  /** All memory entries (unfiltered from API). */
  memoryEntries: MemorySummary[];
  /** Loading state for memory list. */
  listState: LoadState;
  /** Selected memory detail. */
  detail: MemoryDetail | null;
  /** Loading state for memory detail. */
  detailState: LoadState;

  /** Memory entries grouped by category. */
  groupedEntries: Record<string, MemorySummary[]>;

  /** Error message. */
  error: string;
  /** Success message. */
  message: string;

  /** Create form state. */
  createForm: typeof DEFAULT_CREATE_FORM;
  /** Update create form field. */
  setCreateFormField: <K extends keyof typeof DEFAULT_CREATE_FORM>(
    key: K,
    value: (typeof DEFAULT_CREATE_FORM)[K],
  ) => void;
  /** Reset create form. */
  resetCreateForm: () => void;

  /** Edit form state. */
  editForm: typeof DEFAULT_EDIT_FORM;
  /** Update edit form field. */
  setEditFormField: <K extends keyof typeof DEFAULT_EDIT_FORM>(
    key: K,
    value: (typeof DEFAULT_EDIT_FORM)[K],
  ) => void;

  /** Correction form state. */
  correctionForm: typeof DEFAULT_CORRECTION_FORM;
  /** Update correction form field. */
  setCorrectionFormField: <K extends keyof typeof DEFAULT_CORRECTION_FORM>(
    key: K,
    value: (typeof DEFAULT_CORRECTION_FORM)[K],
  ) => void;

  /** Delete form state. */
  deleteForm: typeof DEFAULT_DELETE_FORM;
  /** Update delete form field. */
  setDeleteFormField: <K extends keyof typeof DEFAULT_DELETE_FORM>(
    key: K,
    value: (typeof DEFAULT_DELETE_FORM)[K],
  ) => void;

  /** Revoke form state. */
  revokeForm: typeof DEFAULT_REVOKE_FORM;
  /** Update revoke form field. */
  setRevokeFormField: <K extends keyof typeof DEFAULT_REVOKE_FORM>(
    key: K,
    value: (typeof DEFAULT_REVOKE_FORM)[K],
  ) => void;

  /** Saving flags. */
  savingCreate: boolean;
  savingUpdate: boolean;
  savingCorrection: boolean;
  savingDelete: boolean;
  savingRevoke: boolean;

  /** Select a memory entry. */
  selectMemory: (memoryId: string) => void;

  /** Submit create form. */
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Submit update form. */
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Submit correction form. */
  handleCorrect: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Submit delete form. */
  handleDelete: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Submit revoke form. */
  handleRevoke: (event: FormEvent<HTMLFormElement>) => Promise<void>;

  /** Build a skill path with scope. */
  buildSkillPath: (skillId: string) => string;

  /** Computed category counts. */
  durableCount: number;
  bootCount: number;
  workingCount: number;
  revokedCount: number;
  totalCount: number;

  /** Update a URL search param. */
  setParam: (key: string, value: string, replace?: boolean) => void;
  /** Delete a URL search param. */
  deleteParam: (key: string, replace?: boolean) => void;
}

/**
 * Hook managing all Memory page state, data fetching, and mutations.
 * @param session - Current admin session user.
 * @param sessionReady - Whether session is ready.
 * @returns All state and handlers needed by Memory components.
 */
export function useMemoryPage(
  session: AdminSessionUser | null,
  sessionReady: boolean,
): UseMemoryPageReturn {
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Derived URL state ---
  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedMemoryId = searchParams.get("memoryId")?.trim() ?? "";

  // --- Local state ---
  const [instances, setInstances] = useState<
    Array<{ instance_id: string; display_name: string }>
  >([]);
  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [memoryEntries, setMemoryEntries] = useState<MemorySummary[]>([]);
  const [detail, setDetail] = useState<MemoryDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [correctionForm, setCorrectionForm] = useState(DEFAULT_CORRECTION_FORM);
  const [deleteForm, setDeleteForm] = useState(DEFAULT_DELETE_FORM);
  const [revokeForm, setRevokeForm] = useState(DEFAULT_REVOKE_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [savingDelete, setSavingDelete] = useState(false);
  const [savingRevoke, setSavingRevoke] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  // --- URL helpers ---
  const setParam = useCallback(
    (key: string, value: string, replace = false) => {
      const next = new URLSearchParams(searchParams);
      next.set(key, value);
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams],
  );

  const deleteParam = useCallback(
    (key: string, replace = false) => {
      const next = new URLSearchParams(searchParams);
      next.delete(key);
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams],
  );

  // --- Fetch instances ---
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
          const next = new URLSearchParams(searchParams);
          next.set("instanceId", payload.instances[0].instance_id);
          setSearchParams(next, { replace: true });
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setInstances([]);
        setInstancesState("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Memory instance scope could not be loaded.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  // --- Fetch memory entries ---
  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setMemoryEntries([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchMemoryEntries(instanceId, { limit: 100 })
      .then((payload) => {
        if (cancelled) return;
        setMemoryEntries(payload.memory);
        setListState("success");
        setError("");

        const nextMemoryId = payload.memory.some(
          (entry) => entry.memory_id === selectedMemoryId,
        )
          ? selectedMemoryId
          : payload.memory[0]?.memory_id ?? "";
        if (nextMemoryId !== selectedMemoryId) {
          const next = new URLSearchParams(searchParams);
          if (nextMemoryId) {
            next.set("memoryId", nextMemoryId);
          } else {
            next.delete("memoryId");
          }
          setSearchParams(next, { replace: true });
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setMemoryEntries([]);
        setDetail(null);
        setListState("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Memory inventory could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce]);

  // --- Fetch detail ---
  useEffect(() => {
    if (!canRead || !instanceId || !selectedMemoryId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchMemoryDetail(selectedMemoryId, instanceId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.memory);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailState("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Memory detail could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, selectedMemoryId, refreshNonce]);

  // --- Populate edit/correction forms from detail ---
  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      setCorrectionForm(DEFAULT_CORRECTION_FORM);
      setDeleteForm(DEFAULT_DELETE_FORM);
      setRevokeForm(DEFAULT_REVOKE_FORM);
      return;
    }

    const structuredMetadata = splitMemoryMetadata(detail);
    setEditForm({
      sourceId: detail.source_id ?? "",
      contactId: detail.contact_id ?? "",
      conversationId: detail.conversation_id ?? "",
      taskId: detail.task_id ?? "",
      notificationId: detail.notification_id ?? "",
      workspaceId: detail.workspace_id ?? "",
      memoryKind: detail.memory_kind,
      title: detail.title,
      body: detail.body,
      sourceTrustClass: detail.source_trust_class,
      visibilityScope: detail.visibility_scope,
      sensitivity: detail.sensitivity,
      correctionNote: detail.correction_note ?? "",
      learnedFromEventId: detail.learned_from_event_id ?? "",
      humanOverride: detail.human_override,
      expiresAt: detail.expires_at ?? "",
      memoryLayer: structuredMetadata.memoryLayer,
      reviewAt: structuredMetadata.reviewAt,
      reviewNote: structuredMetadata.reviewNote,
      advancedMetadataJson: structuredMetadata.advancedMetadataJson,
    });
    setCorrectionForm({
      title: detail.title,
      body: detail.body,
      correctionNote: "",
      memoryKind: detail.memory_kind,
      sourceTrustClass: "human_verified",
      visibilityScope: detail.visibility_scope,
      sensitivity: detail.sensitivity,
      expiresAt: detail.expires_at ?? "",
      memoryLayer: structuredMetadata.memoryLayer,
      reviewAt: structuredMetadata.reviewAt,
      reviewNote: structuredMetadata.reviewNote,
      advancedMetadataJson: structuredMetadata.advancedMetadataJson,
    });
    setDeleteForm(DEFAULT_DELETE_FORM);
    setRevokeForm(DEFAULT_REVOKE_FORM);
  }, [detail]);

  // --- Derived data ---
  const groupedEntries = memoryEntries.reduce<Record<string, MemorySummary[]>>(
    (groups, memory) => {
      const category = classifyMemory(memory);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(memory);
      return groups;
    },
    {} as Record<string, MemorySummary[]>,
  );

  const durableCount = groupedEntries.durable?.length ?? 0;
  const bootCount = groupedEntries.boot?.length ?? 0;
  const workingCount = groupedEntries.working?.length ?? 0;
  const revokedCount = groupedEntries.revoked?.length ?? 0;
  const totalCount = memoryEntries.length;

  // --- Actions ---
  const selectMemory = useCallback(
    (memoryId: string) => {
      setParam("memoryId", memoryId);
    },
    [setParam],
  );

  const setCreateFormField = useCallback(
    <K extends keyof typeof DEFAULT_CREATE_FORM>(
      key: K,
      value: (typeof DEFAULT_CREATE_FORM)[K],
    ) => {
      setCreateForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetCreateForm = useCallback(() => {
    setCreateForm(DEFAULT_CREATE_FORM);
  }, []);

  const setEditFormField = useCallback(
    <K extends keyof typeof DEFAULT_EDIT_FORM>(
      key: K,
      value: (typeof DEFAULT_EDIT_FORM)[K],
    ) => {
      setEditForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setCorrectionFormField = useCallback(
    <K extends keyof typeof DEFAULT_CORRECTION_FORM>(
      key: K,
      value: (typeof DEFAULT_CORRECTION_FORM)[K],
    ) => {
      setCorrectionForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setDeleteFormField = useCallback(
    <K extends keyof typeof DEFAULT_DELETE_FORM>(
      key: K,
      value: (typeof DEFAULT_DELETE_FORM)[K],
    ) => {
      setDeleteForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setRevokeFormField = useCallback(
    <K extends keyof typeof DEFAULT_REVOKE_FORM>(
      key: K,
      value: (typeof DEFAULT_REVOKE_FORM)[K],
    ) => {
      setRevokeForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) return;

    const validationError = validateMemoryGovernance(createForm);
    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createMemoryEntry(instanceId, {
        memory_id: normalizeOptional(createForm.memoryId),
        source_id: normalizeOptional(createForm.sourceId),
        contact_id: normalizeOptional(createForm.contactId),
        conversation_id: normalizeOptional(createForm.conversationId),
        task_id: normalizeOptional(createForm.taskId),
        notification_id: normalizeOptional(createForm.notificationId),
        workspace_id: normalizeOptional(createForm.workspaceId),
        memory_kind: createForm.memoryKind,
        title: createForm.title.trim(),
        body: createForm.body.trim(),
        source_trust_class: createForm.sourceTrustClass,
        visibility_scope: createForm.visibilityScope,
        sensitivity: createForm.sensitivity,
        correction_note: normalizeOptional(createForm.correctionNote),
        learned_from_event_id: normalizeOptional(createForm.learnedFromEventId),
        human_override: createForm.humanOverride,
        expires_at: normalizeOptional(createForm.expiresAt),
        metadata: buildMemoryMetadata(createForm),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      setParam("memoryId", payload.memory.memory_id);
      setMessage(`Memory entry created successfully.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Memory creation failed.",
      );
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) return;

    const validationError = validateMemoryGovernance(editForm);
    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      const payload = await updateMemoryEntry(instanceId, detail.memory_id, {
        source_id: normalizeOptional(editForm.sourceId),
        contact_id: normalizeOptional(editForm.contactId),
        conversation_id: normalizeOptional(editForm.conversationId),
        task_id: normalizeOptional(editForm.taskId),
        notification_id: normalizeOptional(editForm.notificationId),
        workspace_id: normalizeOptional(editForm.workspaceId),
        memory_kind: editForm.memoryKind,
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        source_trust_class: editForm.sourceTrustClass,
        visibility_scope: editForm.visibilityScope,
        sensitivity: editForm.sensitivity,
        correction_note: normalizeOptional(editForm.correctionNote),
        learned_from_event_id: normalizeOptional(editForm.learnedFromEventId),
        human_override: editForm.humanOverride,
        expires_at: normalizeOptional(editForm.expiresAt),
        metadata: buildMemoryMetadata(editForm),
      });
      setMessage(`Memory entry updated successfully.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Memory update failed.",
      );
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleCorrect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) return;

    const validationError = validateMemoryGovernance({
      ...correctionForm,
      learnedFromEventId: detail.learned_from_event_id ?? "",
      conversationId: detail.conversation_id ?? "",
      taskId: detail.task_id ?? "",
      notificationId: detail.notification_id ?? "",
      workspaceId: detail.workspace_id ?? "",
    });
    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    setSavingCorrection(true);
    setError("");
    setMessage("");
    try {
      const payload = await correctMemoryEntry(
        instanceId,
        detail.memory_id,
        {
          title: correctionForm.title.trim(),
          body: correctionForm.body.trim(),
          correction_note: correctionForm.correctionNote.trim(),
          memory_kind: correctionForm.memoryKind,
          source_trust_class: correctionForm.sourceTrustClass,
          visibility_scope: correctionForm.visibilityScope,
          sensitivity: correctionForm.sensitivity,
          expires_at: normalizeOptional(correctionForm.expiresAt),
          metadata: buildMemoryMetadata(correctionForm),
        },
      );
      setParam("memoryId", payload.memory.memory_id);
      setMessage(`Memory entry corrected successfully.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Memory correction failed.",
      );
    } finally {
      setSavingCorrection(false);
    }
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) return;

    setSavingDelete(true);
    setError("");
    setMessage("");
    try {
      const payload = await deleteMemoryEntry(instanceId, detail.memory_id, {
        deletion_note: normalizeOptional(deleteForm.deletionNote),
      });
      setMessage(`Memory entry deleted.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Memory deletion failed.",
      );
    } finally {
      setSavingDelete(false);
    }
  };

  const handleRevoke = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) return;

    setSavingRevoke(true);
    setError("");
    setMessage("");
    try {
      await revokeMemoryEntry(instanceId, detail.memory_id, {
        revocation_note: revokeForm.revocationNote.trim(),
      });
      setMessage(`Memory entry revoked.`);
      setRefreshNonce((current) => current + 1);
      setRevokeForm(DEFAULT_REVOKE_FORM);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Memory revocation failed.",
      );
    } finally {
      setSavingRevoke(false);
    }
  };

  const buildSkillPathLocal = useCallback(
    (skillId: string): string => {
      const search = new URLSearchParams();
      if (instanceId.trim()) {
        search.set("instanceId", instanceId.trim());
      }
      search.set("skillId", skillId);
      return `/skills?${search.toString()}`;
    },
    [instanceId],
  );

  return {
    canRead,
    canMutate,
    instanceId,
    selectedMemoryId,
    instances,
    instancesState,
    memoryEntries,
    listState,
    detail,
    detailState,
    groupedEntries,
    error,
    message,
    createForm,
    setCreateFormField,
    resetCreateForm,
    editForm,
    setEditFormField,
    correctionForm,
    setCorrectionFormField,
    deleteForm,
    setDeleteFormField,
    revokeForm,
    setRevokeFormField,
    savingCreate,
    savingUpdate,
    savingCorrection,
    savingDelete,
    savingRevoke,
    selectMemory,
    handleCreate,
    handleUpdate,
    handleCorrect,
    handleDelete,
    handleRevoke,
    buildSkillPath: buildSkillPathLocal,
    setParam,
    deleteParam,
    // Expose computed counts for the summary hero
    durableCount,
    bootCount,
    workingCount,
    revokedCount,
    totalCount,
  };
}


