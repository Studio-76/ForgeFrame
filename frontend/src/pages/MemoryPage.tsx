import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

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
  type VisibilityScope,
} from "../api/domain/memory";
import { fetchInstances } from "../api/domain/instances";
import { buildExecutionReviewPath } from "../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildContactPath,
  buildConversationPath,
  buildKnowledgeSourcePath,
  buildLearningPath,
  buildMemoryPath,
  buildNotificationPath,
  buildTaskPath,
  buildWorkspacePath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<MemoryStatus | "all"> = ["all", "active", "corrected", "deleted"];
const VISIBILITY_OPTIONS: Array<VisibilityScope | "all"> = ["all", "instance", "team", "personal", "restricted"];
const MEMORY_KIND_OPTIONS: MemoryKind[] = ["fact", "preference", "constraint", "summary"];
const SENSITIVITY_OPTIONS: MemorySensitivity[] = ["normal", "sensitive", "restricted"];
const MEMORY_LAYER_OPTIONS: MemoryLayer[] = ["durable", "boot", "working"];
const SOURCE_TRUST_OPTIONS: MemorySourceTrustClass[] = ["human_verified", "operator_verified", "runtime_inferred", "external_unverified"];

type MemorySectionKey = "durable" | "boot" | "working" | "revoked";

const MEMORY_SECTIONS: Array<{ key: MemorySectionKey; title: string; description: string }> = [
  {
    key: "durable",
    title: "Durable Memory",
    description: "Governed long-term truth that should survive connector drift and working-context rotation.",
  },
  {
    key: "boot",
    title: "Boot Memory Candidates",
    description: "Learning-linked memory promoted into bootstrapping context and still expected to carry an explicit review checkpoint.",
  },
  {
    key: "working",
    title: "Working Context References",
    description: "Conversation, task, notification, or workspace context that stays separate from durable long-term truth.",
  },
  {
    key: "revoked",
    title: "Revoked/Superseded",
    description: "Truth that was corrected, revoked, superseded, or deleted and must remain visible as historical governance evidence.",
  },
];

const DEFAULT_STRUCTURED_FIELDS = {
  sourceId: "",
  contactId: "",
  conversationId: "",
  taskId: "",
  notificationId: "",
  workspaceId: "",
  memoryKind: "fact" as MemoryKind,
  title: "",
  body: "",
  sourceTrustClass: "operator_verified" as MemorySourceTrustClass,
  visibilityScope: "team" as VisibilityScope,
  sensitivity: "normal" as MemorySensitivity,
  correctionNote: "",
  learnedFromEventId: "",
  humanOverride: false,
  expiresAt: "",
  memoryLayer: "durable" as MemoryLayer,
  reviewAt: "",
  reviewNote: "",
  advancedMetadataJson: "{}",
};

const DEFAULT_CREATE_FORM = {
  memoryId: "",
  ...DEFAULT_STRUCTURED_FIELDS,
};

const DEFAULT_EDIT_FORM = {
  ...DEFAULT_STRUCTURED_FIELDS,
};

const DEFAULT_CORRECTION_FORM = {
  title: "",
  body: "",
  correctionNote: "",
  memoryKind: "fact" as MemoryKind,
  sourceTrustClass: "human_verified" as MemorySourceTrustClass,
  visibilityScope: "team" as VisibilityScope,
  sensitivity: "normal" as MemorySensitivity,
  expiresAt: "",
  memoryLayer: "durable" as MemoryLayer,
  reviewAt: "",
  reviewNote: "",
  advancedMetadataJson: "{}",
};

const DEFAULT_DELETE_FORM = {
  deletionNote: "",
};

const DEFAULT_REVOKE_FORM = {
  revocationNote: "",
};

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

function buildInventoryPath(path: string, instanceId: string): string {
  if (!instanceId.trim()) {
    return path;
  }
  return `${path}?instanceId=${encodeURIComponent(instanceId.trim())}`;
}

function buildSkillPath(instanceId: string, skillId: string): string {
  const search = new URLSearchParams();
  if (instanceId.trim()) {
    search.set("instanceId", instanceId.trim());
  }
  search.set("skillId", skillId);
  return `${CONTROL_PLANE_ROUTES.skills}?${search.toString()}`;
}

function buildRunPath(instanceId: string, runId: string): string {
  return buildExecutionReviewPath({ instanceId, runId });
}

function sectionTone(count: number): "success" | "warning" {
  return count > 0 ? "success" : "warning";
}

function reviewTone(state: string): "success" | "warning" | "danger" {
  if (state === "scheduled") {
    return "success";
  }
  if (state === "not_required") {
    return "success";
  }
  if (state === "required") {
    return "warning";
  }
  return "danger";
}

function lifecycleTone(memory: MemorySummary): "success" | "warning" | "danger" {
  if (memory.status === "deleted" || memory.truth_state === "revoked" || memory.truth_state === "deleted") {
    return "danger";
  }
  if (memory.truth_state === "superseded" || memory.status === "corrected" || memory.review.state === "required" || memory.review.state === "overdue") {
    return "warning";
  }
  return "success";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

function cleanupSection(section: Record<string, unknown>, keys: string[]) {
  keys.forEach((key) => {
    const value = section[key];
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      delete section[key];
    }
  });
}

function splitMemoryMetadata(detail: MemoryDetail) {
  const advanced = cloneMetadata(detail.metadata);
  const review = asRecord(advanced.review) ?? {};
  const memoryBlock = asRecord(advanced.memory) ?? {};

  const memoryLayer = (readString(advanced.memory_tier || memoryBlock.tier || advanced.memory_layer).trim() as MemoryLayer) || detail.memory_layer;
  const reviewAt = readString(review.review_at || review.at || advanced.review_at).trim();
  const reviewNote = readString(review.note || advanced.review_note).trim();

  delete review.review_at;
  delete review.at;
  delete review.note;
  cleanupSection(review, Object.keys(review));
  if (Object.keys(review).length === 0) {
    delete advanced.review;
  } else {
    advanced.review = review;
  }
  delete advanced.review_at;
  delete advanced.review_note;

  delete advanced.memory_tier;
  delete advanced.memory_layer;
  delete memoryBlock.tier;
  cleanupSection(memoryBlock, Object.keys(memoryBlock));
  if (Object.keys(memoryBlock).length === 0) {
    delete advanced.memory;
  } else {
    advanced.memory = memoryBlock;
  }

  return {
    memoryLayer,
    reviewAt,
    reviewNote,
    advancedMetadataJson: JSON.stringify(advanced, null, 2),
  };
}

function buildMemoryMetadata(
  form: {
    memoryLayer: MemoryLayer;
    reviewAt: string;
    reviewNote: string;
    advancedMetadataJson: string;
  },
): Record<string, unknown> {
  const metadata = parseJsonObject(form.advancedMetadataJson, "Memory advanced metadata");
  metadata.memory_tier = form.memoryLayer;

  const review = { ...(asRecord(metadata.review) ?? {}) };
  if (normalizeOptional(form.reviewAt)) {
    review.review_at = form.reviewAt.trim();
  }
  if (normalizeOptional(form.reviewNote)) {
    review.note = form.reviewNote.trim();
  }
  cleanupSection(review, Object.keys(review));
  if (Object.keys(review).length > 0) {
    metadata.review = review;
  } else {
    delete metadata.review;
  }

  return metadata;
}

function validateMemoryGovernance(form: {
  title: string;
  body: string;
  memoryLayer: MemoryLayer;
  sourceTrustClass: MemorySourceTrustClass;
  visibilityScope: VisibilityScope;
  sensitivity: MemorySensitivity;
  reviewAt: string;
  learnedFromEventId?: string;
  conversationId?: string;
  taskId?: string;
  notificationId?: string;
  workspaceId?: string;
}): string | null {
  if (!form.title.trim()) {
    return "Memory title cannot be empty.";
  }
  if (!form.body.trim()) {
    return "Memory body cannot be empty.";
  }
  if (form.visibilityScope === "restricted" && form.sensitivity === "normal") {
    return "Restricted memory must use sensitive or restricted sensitivity.";
  }
  if (
    form.memoryLayer === "working"
    && !normalizeOptional(form.conversationId ?? "")
    && !normalizeOptional(form.taskId ?? "")
    && !normalizeOptional(form.notificationId ?? "")
    && !normalizeOptional(form.workspaceId ?? "")
  ) {
    return "Working-context memory must stay linked to a conversation, task, notification, or workspace.";
  }
  if (form.memoryLayer === "boot" && !normalizeOptional(form.learnedFromEventId ?? "")) {
    return "Boot memory candidates must stay linked to a learning event.";
  }
  if (form.memoryLayer === "durable" && (form.sourceTrustClass === "runtime_inferred" || form.sourceTrustClass === "external_unverified") && !normalizeOptional(form.reviewAt)) {
    return "Durable memory with runtime-inferred or external-unverified trust requires a scheduled review date.";
  }
  return null;
}

function isRetiredMemory(memory: MemorySummary): boolean {
  return memory.status === "corrected"
    || memory.status === "deleted"
    || memory.truth_state === "revoked"
    || memory.truth_state === "superseded"
    || memory.truth_state === "deleted";
}

function classifyMemory(memory: MemorySummary): MemorySectionKey {
  if (isRetiredMemory(memory)) {
    return "revoked";
  }
  if (memory.memory_layer === "boot") {
    return "boot";
  }
  if (memory.memory_layer === "working") {
    return "working";
  }
  return "durable";
}

function usageSummary(memory: MemorySummary): string {
  return `${memory.usage.runs} run${memory.usage.runs === 1 ? "" : "s"} · ${memory.usage.conversations} conversation${memory.usage.conversations === 1 ? "" : "s"} · ${memory.usage.skills} skill${memory.usage.skills === 1 ? "" : "s"}`;
}

export function MemoryPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedMemoryId = searchParams.get("memoryId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as MemoryStatus | "all" | "") || "all";
  const visibilityFilter = (searchParams.get("visibilityScope")?.trim() as VisibilityScope | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
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
        setError(loadError instanceof Error ? loadError.message : "Memory instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setMemoryEntries([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchMemoryEntries(instanceId, { status: statusFilter, visibilityScope: visibilityFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setMemoryEntries(payload.memory);
        setListState("success");
        setError("");

        const nextMemoryId = payload.memory.some((entry) => entry.memory_id === selectedMemoryId)
          ? selectedMemoryId
          : payload.memory[0]?.memory_id ?? "";
        if (nextMemoryId !== selectedMemoryId) {
          updateRoute((next) => {
            if (nextMemoryId) {
              next.set("memoryId", nextMemoryId);
            } else {
              next.delete("memoryId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setMemoryEntries([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Memory inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedMemoryId, statusFilter, visibilityFilter]);

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
        if (cancelled) {
          return;
        }
        setDetail(payload.memory);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Memory detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedMemoryId]);

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

  const groupedEntries = MEMORY_SECTIONS.reduce<Record<MemorySectionKey, MemorySummary[]>>((groups, section) => {
    groups[section.key] = [];
    return groups;
  }, {
    durable: [],
    boot: [],
    working: [],
    revoked: [],
  });

  memoryEntries.forEach((memory) => {
    groupedEntries[classifyMemory(memory)].push(memory);
  });

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

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
      updateRoute((next) => {
        next.set("memoryId", payload.memory.memory_id);
      });
      setMessage(`Memory entry ${payload.memory.memory_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

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
      setMessage(`Memory entry ${payload.memory.memory_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleCorrect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

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
      const payload = await correctMemoryEntry(instanceId, detail.memory_id, {
        title: correctionForm.title.trim(),
        body: correctionForm.body.trim(),
        correction_note: correctionForm.correctionNote.trim(),
        memory_kind: correctionForm.memoryKind,
        source_trust_class: correctionForm.sourceTrustClass,
        visibility_scope: correctionForm.visibilityScope,
        sensitivity: correctionForm.sensitivity,
        expires_at: normalizeOptional(correctionForm.expiresAt),
        metadata: buildMemoryMetadata(correctionForm),
      });
      updateRoute((next) => {
        next.set("memoryId", payload.memory.memory_id);
      });
      setMessage(`Memory entry ${payload.memory.memory_id} corrected.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory correction failed.");
    } finally {
      setSavingCorrection(false);
    }
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingDelete(true);
    setError("");
    setMessage("");
    try {
      const payload = await deleteMemoryEntry(instanceId, detail.memory_id, {
        deletion_note: normalizeOptional(deleteForm.deletionNote),
      });
      setMessage(`Memory entry ${payload.memory.memory_id} deleted.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory deletion failed.");
    } finally {
      setSavingDelete(false);
    }
  };

  const handleRevoke = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingRevoke(true);
    setError("");
    setMessage("");
    try {
      const payload = await revokeMemoryEntry(instanceId, detail.memory_id, {
        revocation_note: revokeForm.revocationNote.trim(),
      });
      setMessage(`Memory entry ${payload.memory.memory_id} revoked.`);
      setRefreshNonce((current) => current + 1);
      setRevokeForm(DEFAULT_REVOKE_FORM);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Memory revocation failed.");
    } finally {
      setSavingRevoke(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Memory"
          description="ForgeFrame is restoring governed memory truth before exposing long-term, boot, working, and retired context layers."
          question="Which context surface should open once the active session is restored?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect linked contacts after scope resolves." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Memory must distinguish durable truth, boot candidates, working context, and retired records instead of flattening everything into one bucket."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Memory"
          description="This route is reserved for operators and admins who can inspect real context and memory governance."
          question="Which adjacent surface should remain open while memory access is outside the current permission envelope?"
          links={[
            { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Inspect contact posture without opening memory records." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approvals while memory truth remains closed." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic memory shell when the session cannot inspect real context state."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Memory"
        description="Governed long-term truth with explicit scope, trust, review posture, correction history, usage evidence, and strict separation between durable memory, boot candidates, working context, and retired records."
        question="Is this context actually governed and revisable, or is memory still hiding as an undifferentiated bucket of prompt residue?"
        links={[
          { label: "Memory", to: buildInventoryPath(CONTROL_PLANE_ROUTES.memory, instanceId), description: "Stay on the memory governance surface." },
          { label: "Contacts", to: buildInventoryPath(CONTROL_PLANE_ROUTES.contacts, instanceId), description: "Inspect contacts linked to the selected memory entry." },
          { label: "Knowledge Sources", to: buildInventoryPath(CONTROL_PLANE_ROUTES.knowledgeSources, instanceId), description: "Inspect source truth behind the selected memory entry." },
          { label: "Learning", to: buildInventoryPath(CONTROL_PLANE_ROUTES.learning, instanceId), description: "Review learning events feeding boot memory candidates." },
          { label: "Skills", to: buildInventoryPath(CONTROL_PLANE_ROUTES.skills, instanceId), description: "Inspect skill usage linked back to the selected memory record." },
        ]}
        badges={[
          { label: `${memoryEntries.length} memory entr${memoryEntries.length === 1 ? "y" : "ies"}`, tone: memoryEntries.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Working context references stay separate from durable truth. Correct, revoke, and delete are different governance actions and must remain visibly distinct."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain memory by lifecycle status and visibility before the page separates it into durable, boot, working, and retired views.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Memory instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("memoryId");
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
              aria-label="Memory status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("memoryId");
              })}
            >
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Visibility
            <select
              aria-label="Memory visibility filter"
              value={visibilityFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("visibilityScope");
                } else {
                  next.set("visibilityScope", nextValue);
                }
                next.delete("memoryId");
              })}
            >
              {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Memory inventory</h3>
              <p className="fg-muted">The inventory is split into explicit governance views so working context never masquerades as durable memory.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading memory inventory.</p> : null}
          {listState === "success" && memoryEntries.length === 0 ? <p className="fg-muted">No memory entries matched the selected filters.</p> : null}

          {MEMORY_SECTIONS.map((section) => {
            const entries = groupedEntries[section.key];
            return (
              <article key={section.key} className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{section.title}</h4>
                    <p className="fg-muted">{section.description}</p>
                  </div>
                  <span className="fg-pill" data-tone={sectionTone(entries.length)}>{entries.length}</span>
                </div>
                {entries.length === 0 ? (
                  <p className="fg-muted">No records are currently in this view.</p>
                ) : (
                  <div className="fg-table-wrap">
                    <table className="fg-table" aria-label={`${section.title} inventory`}>
                      <thead>
                        <tr>
                          <th>Content</th>
                          <th>Scope</th>
                          <th>Source</th>
                          <th>Trust</th>
                          <th>Status</th>
                          <th>Expires / Review</th>
                          <th>Last used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((memory) => (
                          <tr key={memory.memory_id} className={memory.memory_id === selectedMemoryId ? "is-selected" : undefined}>
                            <td>
                              <button
                                className="fg-table-trigger"
                                type="button"
                                onClick={() => updateRoute((next) => {
                                  next.set("memoryId", memory.memory_id);
                                })}
                              >
                                {memory.title}
                              </button>
                              <div className="fg-muted">
                                <span className="fg-code">{memory.memory_id}</span>
                              </div>
                              <div className="fg-muted">{memory.body}</div>
                            </td>
                            <td>
                              <div>{memory.memory_layer_label}</div>
                              <div className="fg-muted">{memory.visibility_scope}</div>
                            </td>
                            <td>
                              <div>{memory.source_label ?? "No source"}</div>
                              <div className="fg-muted">{memory.source_kind ?? "unlinked"}</div>
                            </td>
                            <td>
                              <div>{memory.source_trust_class}</div>
                              <div className="fg-muted">{memory.human_override ? "human override" : "no override"}</div>
                            </td>
                            <td>
                              <span className="fg-pill" data-tone={lifecycleTone(memory)}>
                                {memory.status} / {memory.truth_state}
                              </span>
                              <div className="fg-muted">{usageSummary(memory)}</div>
                            </td>
                            <td>
                              <div>{formatTimestamp(memory.expires_at, "No expiry")}</div>
                              <div className="fg-muted">
                                <span className="fg-pill" data-tone={reviewTone(memory.review.state)}>{memory.review.state}</span>
                                {memory.review.review_at ? ` · ${memory.review.review_at}` : ""}
                              </div>
                            </td>
                            <td>{formatTimestamp(memory.last_used_at, "Not observed")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Memory detail</h3>
              <p className="fg-muted">Governance posture, revision history, and real usage evidence converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.memory_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a memory entry to inspect source, revision, and usage truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading memory detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Governance</h4>
                  <ul className="fg-list">
                    <li>Layer: {detail.memory_layer_label}</li>
                    <li>Status: {detail.status}</li>
                    <li>Truth state: {detail.truth_state}</li>
                    <li>Trust: {detail.source_trust_class}</li>
                    <li>Visibility: {detail.visibility_scope}</li>
                    <li>Sensitivity: {detail.sensitivity}</li>
                    <li>Human override: {detail.human_override ? "yes" : "no"}</li>
                    <li>Expires at: {formatTimestamp(detail.expires_at, "No expiry")}</li>
                    <li>Last used: {formatTimestamp(detail.last_used_at, "Not observed")}</li>
                    <li>Review state: {detail.review.state}</li>
                    <li>Review at: {formatTimestamp(detail.review.review_at, "Not scheduled")}</li>
                  </ul>
                  <p>{detail.review.rationale ?? "No additional review rationale was recorded."}</p>
                </article>

                <article className="fg-subcard">
                  <h4>Content</h4>
                  <ul className="fg-list">
                    <li>Kind: {detail.memory_kind}</li>
                    <li>Correction note: {detail.correction_note ?? "None"}</li>
                    <li>Supersedes: {detail.supersedes_memory_id ?? "None"}</li>
                    <li>Learned from event: {detail.learned_from_event_id ?? "None"}</li>
                  </ul>
                  <p><strong>{detail.title}</strong></p>
                  <p>{detail.body}</p>
                </article>

                <article className="fg-subcard">
                  <h4>Usage evidence</h4>
                  <ul className="fg-list">
                    <li>Runs: {detail.usage.runs}</li>
                    <li>Conversations: {detail.usage.conversations}</li>
                    <li>Skills: {detail.usage.skills}</li>
                  </ul>
                  <p className="fg-muted">Usage is derived from explicit conversation links, skill-usage records, and execution run references rather than cosmetic counters.</p>
                </article>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Source</h4>
                  {detail.source ? (
                    <div className="fg-stack">
                      <p><strong>{detail.source.label}</strong>{" · "}{detail.source.source_kind}</p>
                      <p className="fg-muted">{detail.source.scope_label} · {detail.source.visibility_scope}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildKnowledgeSourcePath({ instanceId, sourceId: detail.source.source_id })}>Open source</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No source is linked to this memory entry.</p>}
                </article>

                <article className="fg-subcard">
                  <h4>Contact</h4>
                  {detail.contact ? (
                    <div className="fg-stack">
                      <p><strong>{detail.contact.display_name}</strong>{" · "}{detail.contact.status}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildContactPath({ instanceId, contactId: detail.contact.contact_id })}>Open contact</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No contact is linked to this memory entry.</p>}
                </article>

                <article className="fg-subcard">
                  <h4>Learning</h4>
                  {detail.learned_from_event_id ? (
                    <div className="fg-stack">
                      <p>Learning event <span className="fg-code">{detail.learned_from_event_id}</span></p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildLearningPath({ instanceId, eventId: detail.learned_from_event_id })}>Open learning event</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No learning event is linked to this memory entry.</p>}
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Revision history</h4>
                {detail.revision_history.length === 0 ? (
                  <p className="fg-muted">No revisions were recorded for this memory entry.</p>
                ) : (
                  <ul className="fg-list">
                    {detail.revision_history.map((revision) => (
                      <li key={revision.memory_id}>
                        <Link to={buildMemoryPath({ instanceId, memoryId: revision.memory_id })}>{revision.title}</Link>
                        {" · "}{revision.status}{" / "}{revision.truth_state}{" · "}{revision.source_trust_class}
                        {revision.correction_note ? ` · ${revision.correction_note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Usage in runs</h4>
                  {detail.usage_runs.length === 0 ? <p className="fg-muted">No execution runs are linked to this memory entry.</p> : (
                    <ul className="fg-list">
                      {detail.usage_runs.map((run) => (
                        <li key={run.record_id}>
                          <Link to={buildRunPath(instanceId, run.record_id)}>{run.label}</Link>
                          {run.status ? ` · ${run.status}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Usage in conversations</h4>
                  {detail.usage_conversations.length === 0 ? <p className="fg-muted">No conversation usage is linked to this memory entry.</p> : (
                    <ul className="fg-list">
                      {detail.usage_conversations.map((conversation) => (
                        <li key={conversation.record_id}>
                          <Link to={buildConversationPath({ instanceId, conversationId: conversation.record_id })}>{conversation.label}</Link>
                          {conversation.status ? ` · ${conversation.status}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Usage in skills</h4>
                  {detail.usage_skills.length === 0 ? <p className="fg-muted">No skill usage points back to this memory entry.</p> : (
                    <ul className="fg-list">
                      {detail.usage_skills.map((skill) => (
                        <li key={skill.record_id}>
                          <Link to={buildSkillPath(instanceId, skill.record_id)}>{skill.label}</Link>
                          {skill.status ? ` · ${skill.status}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Primary conversation link</h4>
                  {detail.conversation ? (
                    <div className="fg-stack">
                      <p><strong>{detail.conversation.label}</strong>{detail.conversation.status ? ` · ${detail.conversation.status}` : ""}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.conversation.record_id })}>Open conversation</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No primary conversation link is recorded.</p>}
                </article>

                <article className="fg-subcard">
                  <h4>Task link</h4>
                  {detail.task ? (
                    <div className="fg-stack">
                      <p><strong>{detail.task.label}</strong>{detail.task.status ? ` · ${detail.task.status}` : ""}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildTaskPath({ instanceId, taskId: detail.task.record_id })}>Open task</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No task is linked to this memory entry.</p>}
                </article>

                <article className="fg-subcard">
                  <h4>Notification link</h4>
                  {detail.notification ? (
                    <div className="fg-stack">
                      <p><strong>{detail.notification.label}</strong>{detail.notification.status ? ` · ${detail.notification.status}` : ""}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildNotificationPath({ instanceId, notificationId: detail.notification.record_id })}>Open notification</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No notification is linked to this memory entry.</p>}
                </article>

                <article className="fg-subcard">
                  <h4>Workspace link</h4>
                  {detail.workspace ? (
                    <div className="fg-stack">
                      <p><strong>{detail.workspace.label}</strong>{detail.workspace.status ? ` · ${detail.workspace.status}` : ""}</p>
                      <div className="fg-actions">
                        <Link className="fg-nav-link" to={buildWorkspacePath({ instanceId, workspaceId: detail.workspace.record_id })}>Open workspace</Link>
                      </div>
                    </div>
                  ) : <p className="fg-muted">No workspace is linked to this memory entry.</p>}
                </article>
              </div>
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create memory entry</h3>
              <p className="fg-muted">Create a memory record with explicit scope, trust, layer, review posture, and concrete linkages instead of dumping raw context into one bucket.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Memory ID
                <input value={createForm.memoryId} onChange={(event) => setCreateForm((current) => ({ ...current, memoryId: event.target.value }))} placeholder="memory_pricing_preference" />
              </label>
              <label>
                Memory layer
                <select value={createForm.memoryLayer} onChange={(event) => setCreateForm((current) => ({ ...current, memoryLayer: event.target.value as MemoryLayer }))}>
                  {MEMORY_LAYER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Source trust
                <select value={createForm.sourceTrustClass} onChange={(event) => setCreateForm((current) => ({ ...current, sourceTrustClass: event.target.value as MemorySourceTrustClass }))}>
                  {SOURCE_TRUST_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>

            <div className="fg-grid fg-grid-compact">
              <label>
                Memory kind
                <select value={createForm.memoryKind} onChange={(event) => setCreateForm((current) => ({ ...current, memoryKind: event.target.value as MemoryKind }))}>
                  {MEMORY_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Visibility
                <select value={createForm.visibilityScope} onChange={(event) => setCreateForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                  {VISIBILITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Sensitivity
                <select value={createForm.sensitivity} onChange={(event) => setCreateForm((current) => ({ ...current, sensitivity: event.target.value as MemorySensitivity }))}>
                  {SENSITIVITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>

            <div className="fg-grid fg-grid-compact">
              <label>
                Review at
                <input value={createForm.reviewAt} onChange={(event) => setCreateForm((current) => ({ ...current, reviewAt: event.target.value }))} placeholder="2026-05-02T09:00:00Z" />
              </label>
              <label>
                Review note
                <input value={createForm.reviewNote} onChange={(event) => setCreateForm((current) => ({ ...current, reviewNote: event.target.value }))} placeholder="Review runtime-inferred truth after approval review." />
              </label>
              <label>
                Learning event ID
                <input value={createForm.learnedFromEventId} onChange={(event) => setCreateForm((current) => ({ ...current, learnedFromEventId: event.target.value }))} placeholder="learning_alpha" />
              </label>
            </div>

            <label>
              <input
                type="checkbox"
                checked={createForm.humanOverride}
                onChange={(event) => setCreateForm((current) => ({ ...current, humanOverride: event.target.checked }))}
              />
              {" "}Human override
            </label>

            <div className="fg-grid fg-grid-compact">
              <label>
                Source ID
                <input value={createForm.sourceId} onChange={(event) => setCreateForm((current) => ({ ...current, sourceId: event.target.value }))} />
              </label>
              <label>
                Contact ID
                <input value={createForm.contactId} onChange={(event) => setCreateForm((current) => ({ ...current, contactId: event.target.value }))} />
              </label>
              <label>
                Conversation ID
                <input value={createForm.conversationId} onChange={(event) => setCreateForm((current) => ({ ...current, conversationId: event.target.value }))} />
              </label>
            </div>

            <div className="fg-grid fg-grid-compact">
              <label>
                Task ID
                <input value={createForm.taskId} onChange={(event) => setCreateForm((current) => ({ ...current, taskId: event.target.value }))} />
              </label>
              <label>
                Notification ID
                <input value={createForm.notificationId} onChange={(event) => setCreateForm((current) => ({ ...current, notificationId: event.target.value }))} />
              </label>
              <label>
                Workspace ID
                <input value={createForm.workspaceId} onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))} />
              </label>
            </div>

            <div className="fg-grid fg-grid-compact">
              <label>
                Expires at
                <input value={createForm.expiresAt} onChange={(event) => setCreateForm((current) => ({ ...current, expiresAt: event.target.value }))} placeholder="2026-05-03T09:00:00Z" />
              </label>
              <label>
                Correction note
                <input value={createForm.correctionNote} onChange={(event) => setCreateForm((current) => ({ ...current, correctionNote: event.target.value }))} placeholder="Optional operator note" />
              </label>
            </div>

            <label>
              Title
              <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Pricing preference" />
            </label>
            <label>
              Body
              <textarea rows={4} value={createForm.body} onChange={(event) => setCreateForm((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <details>
              <summary>Advanced metadata</summary>
              <label>
                Advanced metadata JSON
                <textarea rows={6} value={createForm.advancedMetadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))} />
              </label>
            </details>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim() || !createForm.body.trim()}>
                {savingCreate ? "Creating memory entry" : "Create memory entry"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit and govern memory</h3>
              <p className="fg-muted">Save, correct, revoke, and delete stay visibly separate because they have different persistence and truth effects.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.memory_id : "Select a memory entry"}</span>
          </div>

          {detail ? (
            <div className="fg-stack">
              <form className="fg-stack" onSubmit={handleUpdate}>
                <h4>Save memory</h4>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Memory layer
                    <select value={editForm.memoryLayer} onChange={(event) => setEditForm((current) => ({ ...current, memoryLayer: event.target.value as MemoryLayer }))}>
                      {MEMORY_LAYER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Source trust
                    <select value={editForm.sourceTrustClass} onChange={(event) => setEditForm((current) => ({ ...current, sourceTrustClass: event.target.value as MemorySourceTrustClass }))}>
                      {SOURCE_TRUST_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Memory kind
                    <select value={editForm.memoryKind} onChange={(event) => setEditForm((current) => ({ ...current, memoryKind: event.target.value as MemoryKind }))}>
                      {MEMORY_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>

                <div className="fg-grid fg-grid-compact">
                  <label>
                    Visibility
                    <select value={editForm.visibilityScope} onChange={(event) => setEditForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                      {VISIBILITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Sensitivity
                    <select value={editForm.sensitivity} onChange={(event) => setEditForm((current) => ({ ...current, sensitivity: event.target.value as MemorySensitivity }))}>
                      {SENSITIVITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Learning event ID
                    <input value={editForm.learnedFromEventId} onChange={(event) => setEditForm((current) => ({ ...current, learnedFromEventId: event.target.value }))} />
                  </label>
                </div>

                <div className="fg-grid fg-grid-compact">
                  <label>
                    Review at
                    <input value={editForm.reviewAt} onChange={(event) => setEditForm((current) => ({ ...current, reviewAt: event.target.value }))} />
                  </label>
                  <label>
                    Review note
                    <input value={editForm.reviewNote} onChange={(event) => setEditForm((current) => ({ ...current, reviewNote: event.target.value }))} />
                  </label>
                  <label>
                    Expires at
                    <input value={editForm.expiresAt} onChange={(event) => setEditForm((current) => ({ ...current, expiresAt: event.target.value }))} />
                  </label>
                </div>

                <label>
                  <input
                    type="checkbox"
                    checked={editForm.humanOverride}
                    onChange={(event) => setEditForm((current) => ({ ...current, humanOverride: event.target.checked }))}
                  />
                  {" "}Human override
                </label>

                <div className="fg-grid fg-grid-compact">
                  <label>
                    Source ID
                    <input value={editForm.sourceId} onChange={(event) => setEditForm((current) => ({ ...current, sourceId: event.target.value }))} />
                  </label>
                  <label>
                    Contact ID
                    <input value={editForm.contactId} onChange={(event) => setEditForm((current) => ({ ...current, contactId: event.target.value }))} />
                  </label>
                  <label>
                    Conversation ID
                    <input value={editForm.conversationId} onChange={(event) => setEditForm((current) => ({ ...current, conversationId: event.target.value }))} />
                  </label>
                </div>

                <div className="fg-grid fg-grid-compact">
                  <label>
                    Task ID
                    <input value={editForm.taskId} onChange={(event) => setEditForm((current) => ({ ...current, taskId: event.target.value }))} />
                  </label>
                  <label>
                    Notification ID
                    <input value={editForm.notificationId} onChange={(event) => setEditForm((current) => ({ ...current, notificationId: event.target.value }))} />
                  </label>
                  <label>
                    Workspace ID
                    <input value={editForm.workspaceId} onChange={(event) => setEditForm((current) => ({ ...current, workspaceId: event.target.value }))} />
                  </label>
                </div>

                <label>
                  Title
                  <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>
                  Body
                  <textarea rows={4} value={editForm.body} onChange={(event) => setEditForm((current) => ({ ...current, body: event.target.value }))} />
                </label>
                <label>
                  Correction note
                  <input value={editForm.correctionNote} onChange={(event) => setEditForm((current) => ({ ...current, correctionNote: event.target.value }))} />
                </label>
                <details>
                  <summary>Advanced metadata</summary>
                  <label>
                    Advanced metadata JSON
                    <textarea rows={6} value={editForm.advancedMetadataJson} onChange={(event) => setEditForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))} />
                  </label>
                </details>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingUpdate || !editForm.title.trim() || !editForm.body.trim()}>
                    {savingUpdate ? "Saving memory" : "Save memory"}
                  </button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleCorrect}>
                <h4>Correct memory</h4>
                <p className="fg-muted">Correction creates a new active successor, supersedes the current truth, and preserves revision history.</p>
                <label>
                  Title
                  <input value={correctionForm.title} onChange={(event) => setCorrectionForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>
                  Body
                  <textarea rows={4} value={correctionForm.body} onChange={(event) => setCorrectionForm((current) => ({ ...current, body: event.target.value }))} />
                </label>
                <label>
                  Correction note
                  <input value={correctionForm.correctionNote} onChange={(event) => setCorrectionForm((current) => ({ ...current, correctionNote: event.target.value }))} placeholder="Reason for correction" />
                </label>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Memory layer
                    <select value={correctionForm.memoryLayer} onChange={(event) => setCorrectionForm((current) => ({ ...current, memoryLayer: event.target.value as MemoryLayer }))}>
                      {MEMORY_LAYER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Source trust
                    <select value={correctionForm.sourceTrustClass} onChange={(event) => setCorrectionForm((current) => ({ ...current, sourceTrustClass: event.target.value as MemorySourceTrustClass }))}>
                      {SOURCE_TRUST_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Memory kind
                    <select value={correctionForm.memoryKind} onChange={(event) => setCorrectionForm((current) => ({ ...current, memoryKind: event.target.value as MemoryKind }))}>
                      {MEMORY_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Visibility
                    <select value={correctionForm.visibilityScope} onChange={(event) => setCorrectionForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                      {VISIBILITY_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Sensitivity
                    <select value={correctionForm.sensitivity} onChange={(event) => setCorrectionForm((current) => ({ ...current, sensitivity: event.target.value as MemorySensitivity }))}>
                      {SENSITIVITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    Expires at
                    <input value={correctionForm.expiresAt} onChange={(event) => setCorrectionForm((current) => ({ ...current, expiresAt: event.target.value }))} />
                  </label>
                </div>
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Review at
                    <input value={correctionForm.reviewAt} onChange={(event) => setCorrectionForm((current) => ({ ...current, reviewAt: event.target.value }))} />
                  </label>
                  <label>
                    Review note
                    <input value={correctionForm.reviewNote} onChange={(event) => setCorrectionForm((current) => ({ ...current, reviewNote: event.target.value }))} />
                  </label>
                </div>
                <details>
                  <summary>Advanced metadata</summary>
                  <label>
                    Advanced metadata JSON
                    <textarea rows={6} value={correctionForm.advancedMetadataJson} onChange={(event) => setCorrectionForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))} />
                  </label>
                </details>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingCorrection || !correctionForm.title.trim() || !correctionForm.body.trim() || !correctionForm.correctionNote.trim()}>
                    {savingCorrection ? "Correcting memory" : "Correct memory"}
                  </button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleRevoke}>
                <h4>Revoke memory</h4>
                <p className="fg-muted">Revocation keeps the current record in place but marks its truth invalid. It does not create a successor and it is not deletion.</p>
                <label>
                  Revocation note
                  <input
                    value={revokeForm.revocationNote}
                    onChange={(event) => setRevokeForm({ revocationNote: event.target.value })}
                    placeholder="Reason for revocation"
                  />
                </label>
                <div className="fg-actions">
                  <button
                    type="submit"
                    disabled={!canMutate || savingRevoke || !revokeForm.revocationNote.trim() || detail.status === "deleted"}
                  >
                    {savingRevoke ? "Revoking memory" : "Revoke memory"}
                  </button>
                </div>
              </form>

              <form className="fg-stack" onSubmit={handleDelete}>
                <h4>Delete memory</h4>
                <p className="fg-muted">Deletion tombstones the record and preserves a historical audit trail. It is not the same as revocation or correction.</p>
                <label>
                  Deletion note
                  <input value={deleteForm.deletionNote} onChange={(event) => setDeleteForm({ deletionNote: event.target.value })} placeholder="Reason for deletion" />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingDelete}>
                    {savingDelete ? "Deleting memory" : "Delete memory"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="fg-muted">Select a memory entry before attempting a mutation, correction, revocation, or deletion.</p>
          )}
        </article>
      </div>
    </section>
  );
}
