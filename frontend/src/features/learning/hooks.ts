/**
 * Data-fetching hook and state management for the Learning page.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createLearningEvent,
  decideLearningEvent,
  fetchLearningEventDetail,
  fetchLearningEvents,
  scanLearningPatterns,
  type LearningDecision,
  type LearningEventDetail,
  type LearningEventSummary,
  type LearningStatus,
  type LearningTriggerKind,
} from "../../api/domain/learning";
import { fetchInstances } from "../../api/domain/instances";
import type { AdminSessionUser } from "../../api/domain/auth";
import { getWorkInteractionAccess } from "../../pages/workInteractionPageSupport";
import type { LoadState } from "./types";
import {
  REVIEW_BUCKET_ORDER,
  REVIEW_BUCKET_LABELS,
  DEFAULT_CREATE_FORM,
  DEFAULT_DECIDE_FORM,
} from "./types";
import {
  isMemoryDecision,
  isSkillDecision,
  normalizeText,
  normalizeOptional,
  validateMemoryPromotion,
  createMemoryProposal,
  createSkillProposal,
  bucketTone,
} from "./utils";
import type { VisibilityScope } from "../../api/domain/contacts";
import type { MemoryKind, MemorySensitivity, MemorySourceTrustClass } from "../../api/domain/memory";
import type { SkillScope } from "../../api/domain/skills";

/** Shape returned by useLearningPage hook. */
export interface UseLearningPageReturn {
  /** Current search params. */
  searchParams: URLSearchParams;
  /** Update a search param value. */
  setParam: (key: string, value: string, replace?: boolean) => void;
  /** Delete a search param. */
  deleteParam: (key: string, replace?: boolean) => void;

  /** Resolved instance ID from URL. */
  instanceId: string;
  /** Selected event ID from URL. */
  selectedEventId: string;
  /** Active review bucket filter (from URL or default). */
  activeBucket: string;
  /** Status filter from URL. */
  statusFilter: LearningStatus | "all";
  /** Trigger filter from URL. */
  triggerFilter: LearningTriggerKind | "all";

  /** Access controls. */
  canRead: boolean;
  canMutate: boolean;

  /** Instances list. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Learning events list. */
  events: LearningEventSummary[];
  /** Selected event detail. */
  detail: LearningEventDetail | null;
  /** Last scan result. */
  scanResult: LearningEventSummary[] | null;
  /** Completion timestamp from the last pattern scan. */
  lastScanCompletedAt: string | null;

  /** Instance loading state. */
  instancesState: LoadState;
  /** Events list loading state. */
  listState: LoadState;
  /** Detail loading state. */
  detailState: LoadState;

  /** Loading flags. */
  savingCreate: boolean;
  savingDecide: boolean;
  scanningPatterns: boolean;

  /** Error message to display. */
  error: string;
  /** Success message to display. */
  message: string;

  /** Events grouped by review bucket. */
  groupedEvents: Array<{
    bucket: string;
    label: string;
    events: LearningEventSummary[];
    tone: "success" | "warning" | "danger";
  }>;

  /** Events filtered by active bucket. */
  filteredEvents: LearningEventSummary[];

  /** Select an event by ID. */
  selectEvent: (eventId: string) => void;
  /** Set the active bucket filter. */
  setActiveBucket: (bucket: string) => void;

  /** Create form state. */
  createForm: typeof DEFAULT_CREATE_FORM;
  /** Update create form field. */
  setCreateFormField: <K extends keyof typeof DEFAULT_CREATE_FORM>(
    key: K,
    value: (typeof DEFAULT_CREATE_FORM)[K],
  ) => void;
  /** Reset create form to defaults. */
  resetCreateForm: () => void;
  /** Submit create form. */
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;

  /** Decide form state (populated from detail). */
  decideForm: typeof DEFAULT_DECIDE_FORM;
  /** Update decide form field. */
  setDecideFormField: <K extends keyof typeof DEFAULT_DECIDE_FORM>(
    key: K,
    value: (typeof DEFAULT_DECIDE_FORM)[K],
  ) => void;
  /** Submit decide form. */
  handleDecide: (event: FormEvent<HTMLFormElement>) => Promise<void>;

  /** Run pattern scan. */
  handlePatternScan: () => Promise<void>;
  /** Clear messages. */
  clearMessages: () => void;
}

/**
 * Hook managing all Learning page state, data fetching, and mutations.
 * @param session - Current admin session user.
 * @param sessionReady - Whether session is ready.
 * @returns All state and handlers needed by Learning components.
 */
export function useLearningPage(
  session: AdminSessionUser | null,
  sessionReady: boolean,
): UseLearningPageReturn {
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Derived URL state ---
  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedEventId = searchParams.get("eventId")?.trim() ?? "";
  const activeBucket = searchParams.get("bucket")?.trim() || "all";
  const statusFilter =
    (searchParams.get("status")?.trim() as LearningStatus | "all" | "") || "all";
  const triggerFilter =
    (searchParams.get("triggerKind")?.trim() as LearningTriggerKind | "all" | "") ||
    "all";

  // --- Local state ---
  const [instances, setInstances] = useState<
    Array<{ instance_id: string; display_name: string }>
  >([]);
  const [events, setEvents] = useState<LearningEventSummary[]>([]);
  const [detail, setDetail] = useState<LearningEventDetail | null>(null);
  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [decideForm, setDecideForm] = useState(DEFAULT_DECIDE_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingDecide, setSavingDecide] = useState(false);
  const [scanningPatterns, setScanningPatterns] = useState(false);
  const [scanResult, setScanResult] = useState<LearningEventSummary[] | null>(
    null,
  );
  const [lastScanCompletedAt, setLastScanCompletedAt] = useState<string | null>(
    null,
  );
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
        setInstancesState("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Learning instance scope could not be loaded.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  // --- Fetch events ---
  useEffect(() => {
    if (!canRead || !instanceId) {
      setEvents([]);
      setScanResult(null);
      setLastScanCompletedAt(null);
      return;
    }
    let cancelled = false;
    setListState("loading");
    void fetchLearningEvents(instanceId, {
      status: statusFilter,
      triggerKind: triggerFilter,
      limit: 100,
    })
      .then((payload) => {
        if (cancelled) return;
        setEvents(payload.events);
        setListState("success");
        const currentEventId = searchParams.get("eventId")?.trim() ?? "";
        const nextEventId = payload.events.some(
          (item) => item.learning_event_id === currentEventId,
        )
          ? currentEventId
          : payload.events[0]?.learning_event_id ?? "";
        if (nextEventId !== currentEventId) {
          const next = new URLSearchParams(searchParams);
          if (nextEventId) {
            next.set("eventId", nextEventId);
          } else {
            next.delete("eventId");
          }
          setSearchParams(next, { replace: true });
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setListState("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Learning inventory could not be loaded.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, statusFilter, triggerFilter]);

  // --- Fetch detail ---
  useEffect(() => {
    if (!canRead || !instanceId || !selectedEventId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailState("loading");
    void fetchLearningEventDetail(selectedEventId, instanceId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.event);
        setDetailState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetailState("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Learning detail could not be loaded.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, selectedEventId, refreshNonce]);

  // --- Populate decide form from detail ---
  useEffect(() => {
    if (!detail) {
      setDecideForm(DEFAULT_DECIDE_FORM);
      return;
    }

    const memorySeed = detail.proposed_memory;
    const skillSeed = detail.proposed_skill;

    function proposalText(
      record: Record<string, unknown>,
      keys: string[],
      fallback: string,
    ): string {
      for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
          return value;
        }
      }
      return fallback;
    }

    function textFromRecord(
      record: Record<string, unknown>,
      key: string,
      fallback = "",
    ): string {
      const value = record[key];
      return typeof value === "string" ? value : fallback;
    }

    function nestedTextFromRecord(
      record: Record<string, unknown>,
      path: string[],
      fallback = "",
    ): string {
      let current: unknown = record;
      for (const segment of path) {
        if (!current || typeof current !== "object" || !(segment in current)) {
          return fallback;
        }
        current = (current as Record<string, unknown>)[segment];
      }
      return typeof current === "string" ? current : fallback;
    }

    setDecideForm({
      decision:
        detail.outcome.target_kind ?? detail.suggested_decision,
      decisionNote: detail.decision_note ?? "",
      humanOverride: detail.human_override,
      memoryKind:
        (textFromRecord(memorySeed, "memory_kind", "summary") as MemoryKind) ||
        "summary",
      memoryTitle:
        proposalText(memorySeed, ["title"], detail.summary),
      memoryBody:
        proposalText(
          memorySeed,
          ["body"],
          detail.explanation || detail.summary,
        ),
      memoryVisibility:
        (textFromRecord(
          memorySeed,
          "visibility_scope",
          "team",
        ) as VisibilityScope) || "team",
      memorySensitivity:
        (textFromRecord(memorySeed, "sensitivity", "normal") as MemorySensitivity) ||
        "normal",
      memoryTrust:
        (textFromRecord(
          memorySeed,
          "source_trust_class",
          "runtime_inferred",
        ) as MemorySourceTrustClass) || "runtime_inferred",
      memoryReviewAt: nestedTextFromRecord(memorySeed, [
        "metadata",
        "review",
        "review_at",
      ]),
      memoryReviewNote: nestedTextFromRecord(memorySeed, [
        "metadata",
        "review",
        "note",
      ]),
      skillDisplayName:
        proposalText(skillSeed, ["display_name"], detail.summary),
      skillSummary:
        proposalText(
          skillSeed,
          ["summary"],
          detail.explanation || detail.summary,
        ),
      skillScope:
        (textFromRecord(skillSeed, "scope", "instance") as SkillScope) ||
        "instance",
      skillScopeAgentId: textFromRecord(skillSeed, "scope_agent_id"),
      skillInstructionCore:
        proposalText(
          skillSeed,
          ["instruction_core"],
          detail.explanation || detail.summary,
        ),
    });
  }, [detail]);

  // --- Derived data ---
  const groupedEvents = REVIEW_BUCKET_ORDER.map((bucket) => ({
    bucket,
    label: REVIEW_BUCKET_LABELS[bucket],
    events: events.filter((evt) => evt.review_bucket === bucket),
    tone: bucketTone(bucket),
  }));

  const filteredEvents =
    activeBucket === "all"
      ? events
      : events.filter((evt) => evt.review_bucket === activeBucket);

  // --- Actions ---
  const selectEvent = useCallback(
    (eventId: string) => {
      setParam("eventId", eventId);
    },
    [setParam],
  );

  const setActiveBucket = useCallback(
    (bucket: string) => {
      if (bucket === "all") {
        deleteParam("bucket");
      } else {
        setParam("bucket", bucket);
      }
    },
    [setParam, deleteParam],
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

  const setDecideFormField = useCallback(
    <K extends keyof typeof DEFAULT_DECIDE_FORM>(
      key: K,
      value: (typeof DEFAULT_DECIDE_FORM)[K],
    ) => {
      setDecideForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setError("");
    setMessage("");
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) return;

    const summary = normalizeText(createForm.summary);
    const explanation = normalizeText(createForm.explanation);
    if (!summary) {
      setError("Learning summary is required.");
      return;
    }
    const createMemoryError = validateMemoryPromotion(
      createForm.suggestedDecision,
      createForm.memoryVisibility,
      createForm.memorySensitivity,
      createForm.memoryTrust,
      createForm.memoryReviewAt,
    );
    if (createMemoryError) {
      setError(createMemoryError);
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const proposedMemory = isMemoryDecision(createForm.suggestedDecision)
        ? createMemoryProposal(createForm, summary, explanation)
        : {};
      const proposedSkill = isSkillDecision(createForm.suggestedDecision)
        ? createSkillProposal(createForm, summary, explanation)
        : {};

      const payload = await createLearningEvent(instanceId, {
        trigger_kind: createForm.triggerKind,
        summary,
        explanation,
        suggested_decision: createForm.suggestedDecision,
        agent_id: normalizeOptional(createForm.agentId),
        run_id: normalizeOptional(createForm.runId),
        conversation_id: normalizeOptional(createForm.conversationId),
        evidence: {
          note: normalizeOptional(createForm.evidenceNote),
          source_ref: normalizeOptional(createForm.evidenceSourceRef),
          created_from_console: true,
        },
        proposed_memory: proposedMemory,
        proposed_skill: proposedSkill,
      });

      setCreateForm(DEFAULT_CREATE_FORM);
      setMessage(
        `Learning event ${payload.event.learning_event_id} created.`,
      );
      setParam("eventId", payload.event.learning_event_id);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Learning event creation failed.",
      );
    } finally {
      setSavingCreate(false);
    }
  };

  const handleDecide = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) return;

    setSavingDecide(true);
    setError("");
    setMessage("");
    try {
      const decideMemoryError = validateMemoryPromotion(
        decideForm.decision,
        decideForm.memoryVisibility,
        decideForm.memorySensitivity,
        decideForm.memoryTrust,
        decideForm.memoryReviewAt,
      );
      if (decideMemoryError) {
        throw new Error(decideMemoryError);
      }
      const payload = await decideLearningEvent(
        instanceId,
        detail.learning_event_id,
        {
          decision: decideForm.decision,
          decision_note: normalizeOptional(decideForm.decisionNote),
          human_override: decideForm.humanOverride,
          memory_payload: isMemoryDecision(decideForm.decision)
            ? createMemoryProposal(
                decideForm,
                detail.summary,
                detail.explanation,
              )
            : {},
          skill_payload: isSkillDecision(decideForm.decision)
            ? createSkillProposal(
                decideForm,
                detail.summary,
                detail.explanation,
              )
            : {},
        },
      );

      setMessage(
        `Learning event ${payload.event.learning_event_id} decided.`,
      );
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Learning decision failed.",
      );
    } finally {
      setSavingDecide(false);
    }
  };

  const handlePatternScan = async () => {
    if (!canMutate || !instanceId) return;
    setScanningPatterns(true);
    setError("");
    setMessage("");
    try {
      const payload = await scanLearningPatterns(instanceId);
      setScanResult(payload.events);
      setLastScanCompletedAt(new Date().toISOString());
      setMessage(
        `Pattern scan created ${payload.events.length} learning event(s).`,
      );
      if (payload.events[0]?.learning_event_id) {
        setParam("eventId", payload.events[0].learning_event_id);
      }
      setRefreshNonce((current) => current + 1);
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Pattern scan failed.",
      );
    } finally {
      setScanningPatterns(false);
    }
  };

  return {
    searchParams,
    setParam,
    deleteParam,
    instanceId,
    selectedEventId,
    activeBucket,
    statusFilter,
    triggerFilter,
    canRead,
    canMutate,
    instances,
    events,
    detail,
    scanResult,
    lastScanCompletedAt,
    instancesState,
    listState,
    detailState,
    savingCreate,
    savingDecide,
    scanningPatterns,
    error,
    message,
    groupedEvents,
    filteredEvents,
    selectEvent,
    setActiveBucket,
    createForm,
    setCreateFormField,
    resetCreateForm,
    handleCreate,
    decideForm,
    setDecideFormField,
    handleDecide,
    handlePatternScan,
    clearMessages,
  };
}
