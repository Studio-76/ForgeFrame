import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createLearningEvent,
  decideLearningEvent,
  fetchLearningEventDetail,
  fetchLearningEvents,
  scanLearningPatterns,
  type LearningDecision,
  type LearningDecisionLane,
  type LearningEventDetail,
  type LearningEventSummary,
  type LearningReviewBucket,
  type LearningRiskLevel,
  type LearningStatus,
  type LearningTriggerKind,
} from "../api/domain/learning";
import { fetchInstances } from "../api/domain/instances";
import {
  type MemoryKind,
  type MemorySensitivity,
  type MemorySourceTrustClass,
} from "../api/domain/memory";
import { type SkillScope } from "../api/domain/skills";
import { type VisibilityScope } from "../api/domain/contacts";
import { buildExecutionReviewPath } from "../app/executionReview";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { buildConversationPath, buildLearningPath, buildMemoryPath } from "../app/workInteractionRoutes";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<LearningStatus | "all"> = ["all", "pending", "applied", "discarded", "review_required"];
const TRIGGER_OPTIONS: Array<LearningTriggerKind | "all"> = ["all", "run_completion", "session_rotation", "pattern_detected", "operator_action"];
const DECISION_OPTIONS: LearningDecision[] = ["history_only", "boot_memory", "durable_memory", "skill_draft", "review_required", "discard"];
const REVIEW_BUCKET_ORDER: LearningReviewBucket[] = ["suggested", "review_required", "approved_promoted", "rejected"];
const MEMORY_KIND_OPTIONS: MemoryKind[] = ["fact", "preference", "constraint", "summary"];
const MEMORY_VISIBILITY_OPTIONS: VisibilityScope[] = ["instance", "team", "personal", "restricted"];
const MEMORY_SENSITIVITY_OPTIONS: MemorySensitivity[] = ["normal", "sensitive", "restricted"];
const MEMORY_TRUST_OPTIONS: MemorySourceTrustClass[] = ["human_verified", "runtime_inferred", "external_unverified"];
const SKILL_SCOPE_OPTIONS: SkillScope[] = ["instance", "agent"];

const DECISION_LABELS: Record<LearningDecision, string> = {
  history_only: "Approve as history only",
  boot_memory: "Promote to boot memory",
  durable_memory: "Promote to durable memory",
  skill_draft: "Promote to skill draft",
  review_required: "Require human review",
  discard: "Reject learning event",
};

const DECISION_HELP: Record<LearningDecision, string> = {
  history_only: "Record the review outcome without creating persistent memory or skill state.",
  boot_memory: "Create startup-facing memory that remains linked to the learning event.",
  durable_memory: "Promote the finding into long-term durable memory truth.",
  skill_draft: "Create a draft skill so operators can refine reusable behavior.",
  review_required: "Keep the event open for later review without promotion.",
  discard: "Reject the event and archive the suggestion.",
};

const REVIEW_BUCKET_LABELS: Record<LearningReviewBucket, string> = {
  suggested: "Suggested",
  review_required: "Review required",
  approved_promoted: "Approved / promoted",
  rejected: "Rejected",
};

const DEFAULT_CREATE_FORM = {
  triggerKind: "operator_action" as LearningTriggerKind,
  summary: "",
  explanation: "",
  suggestedDecision: "review_required" as LearningDecision,
  agentId: "",
  runId: "",
  conversationId: "",
  evidenceNote: "",
  evidenceSourceRef: "",
  memoryKind: "summary" as MemoryKind,
  memoryTitle: "",
  memoryBody: "",
  memoryVisibility: "team" as VisibilityScope,
  memorySensitivity: "normal" as MemorySensitivity,
  memoryTrust: "runtime_inferred" as MemorySourceTrustClass,
  memoryReviewAt: "",
  memoryReviewNote: "",
  skillDisplayName: "",
  skillSummary: "",
  skillScope: "instance" as SkillScope,
  skillScopeAgentId: "",
  skillInstructionCore: "",
};

const DEFAULT_DECIDE_FORM = {
  decision: "review_required" as LearningDecision,
  decisionNote: "",
  humanOverride: false,
  memoryKind: "summary" as MemoryKind,
  memoryTitle: "",
  memoryBody: "",
  memoryVisibility: "team" as VisibilityScope,
  memorySensitivity: "normal" as MemorySensitivity,
  memoryTrust: "runtime_inferred" as MemorySourceTrustClass,
  memoryReviewAt: "",
  memoryReviewNote: "",
  skillDisplayName: "",
  skillSummary: "",
  skillScope: "instance" as SkillScope,
  skillScopeAgentId: "",
  skillInstructionCore: "",
};

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

function normalizeText(value: string): string {
  return value.trim();
}

function isMemoryDecision(decision: LearningDecision): decision is "boot_memory" | "durable_memory" {
  return decision === "boot_memory" || decision === "durable_memory";
}

function isSkillDecision(decision: LearningDecision): decision is "skill_draft" {
  return decision === "skill_draft";
}

function bucketTone(bucket: LearningReviewBucket): "success" | "warning" | "danger" {
  if (bucket === "approved_promoted") {
    return "success";
  }
  if (bucket === "rejected") {
    return "danger";
  }
  return "warning";
}

function laneTone(lane: LearningDecisionLane): "success" | "warning" | "danger" {
  if (lane === "auto_promote" || lane === "auto_draft") {
    return "success";
  }
  if (lane === "auto_reject") {
    return "danger";
  }
  return "warning";
}

function riskTone(level: LearningRiskLevel): "success" | "warning" | "danger" {
  if (level === "low") {
    return "success";
  }
  if (level === "medium") {
    return "warning";
  }
  return "danger";
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

function textFromRecord(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function nestedTextFromRecord(record: Record<string, unknown>, path: string[], fallback = ""): string {
  let current: unknown = record;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return fallback;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : fallback;
}

function proposalText(record: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
}

function createMemoryProposal(form: typeof DEFAULT_CREATE_FORM | typeof DEFAULT_DECIDE_FORM, summary: string, explanation: string) {
  const reviewAt = normalizeText(form.memoryReviewAt);
  const reviewNote = normalizeText(form.memoryReviewNote);
  const metadata: Record<string, unknown> = {};
  if (reviewAt || reviewNote) {
    metadata.review = {
      ...(reviewAt ? { review_at: reviewAt } : {}),
      ...(reviewNote ? { note: reviewNote } : {}),
    };
  }
  return {
    memory_kind: form.memoryKind,
    title: normalizeText(form.memoryTitle) || summary,
    body: normalizeText(form.memoryBody) || explanation || summary,
    visibility_scope: form.memoryVisibility,
    sensitivity: form.memorySensitivity,
    source_trust_class: form.memoryTrust,
    metadata,
  };
}

function createSkillProposal(form: typeof DEFAULT_CREATE_FORM | typeof DEFAULT_DECIDE_FORM, summary: string, explanation: string) {
  return {
    display_name: normalizeText(form.skillDisplayName) || summary,
    summary: normalizeText(form.skillSummary) || explanation || summary,
    scope: form.skillScope,
    scope_agent_id: normalizeOptional(form.skillScopeAgentId),
    instruction_core: normalizeText(form.skillInstructionCore) || explanation || summary,
  };
}

function evidenceEntries(evidence: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(evidence)
    .map(([key, value]) => {
      if (value == null) {
        return { key, value: "not recorded" };
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return { key, value: String(value) };
      }
      return { key, value: JSON.stringify(value) };
    });
}

function describeOutcome(event: LearningEventSummary): string {
  if (event.outcome.surface === "pending") {
    return "Pending review";
  }
  return event.outcome.target_label;
}

function validateMemoryPromotion(
  decision: LearningDecision,
  visibility: VisibilityScope,
  sensitivity: MemorySensitivity,
  trust: MemorySourceTrustClass,
  reviewAt: string,
): string | null {
  if (!isMemoryDecision(decision)) {
    return null;
  }
  if (visibility === "restricted" && sensitivity === "normal") {
    return "Restricted memory promotion requires sensitive or restricted sensitivity.";
  }
  if (decision === "durable_memory" && trust !== "human_verified" && !normalizeText(reviewAt)) {
    return "Durable memory promoted from runtime-inferred or external-unverified trust requires a review date.";
  }
  return null;
}

export function LearningPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const eventId = searchParams.get("eventId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as LearningStatus | "all" | "") || "all";
  const triggerFilter = (searchParams.get("triggerKind")?.trim() as LearningTriggerKind | "all" | "") || "all";

  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
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
  const [scanResult, setScanResult] = useState<LearningEventSummary[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => setSearchParams(next, { replace }));
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
          updateRoute((next) => next.set("instanceId", payload.instances[0].instance_id), true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Learning instance scope could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setEvents([]);
      setScanResult(null);
      return;
    }
    let cancelled = false;
    setListState("loading");
    void fetchLearningEvents(instanceId, { status: statusFilter, triggerKind: triggerFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setEvents(payload.events);
        setListState("success");
        const nextEventId = payload.events.some((item) => item.learning_event_id === eventId)
          ? eventId
          : payload.events[0]?.learning_event_id ?? "";
        if (nextEventId !== eventId) {
          updateRoute((next) => {
            if (nextEventId) {
              next.set("eventId", nextEventId);
            } else {
              next.delete("eventId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Learning inventory could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, eventId, instanceId, refreshNonce, statusFilter, triggerFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !eventId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailState("loading");
    void fetchLearningEventDetail(eventId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.event);
        setDetailState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Learning detail could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, eventId, instanceId, refreshNonce]);

  useEffect(() => {
    if (!detail) {
      setDecideForm(DEFAULT_DECIDE_FORM);
      return;
    }

    const memorySeed = detail.proposed_memory;
    const skillSeed = detail.proposed_skill;
    setDecideForm({
      decision: detail.outcome.target_kind ?? detail.suggested_decision,
      decisionNote: detail.decision_note ?? "",
      humanOverride: detail.human_override,
      memoryKind: (textFromRecord(memorySeed, "memory_kind", "summary") as MemoryKind) || "summary",
      memoryTitle: proposalText(memorySeed, ["title"], detail.summary),
      memoryBody: proposalText(memorySeed, ["body"], detail.explanation || detail.summary),
      memoryVisibility: (textFromRecord(memorySeed, "visibility_scope", "team") as VisibilityScope) || "team",
      memorySensitivity: (textFromRecord(memorySeed, "sensitivity", "normal") as MemorySensitivity) || "normal",
      memoryTrust: (textFromRecord(memorySeed, "source_trust_class", "runtime_inferred") as MemorySourceTrustClass) || "runtime_inferred",
      memoryReviewAt: nestedTextFromRecord(memorySeed, ["metadata", "review", "review_at"]),
      memoryReviewNote: nestedTextFromRecord(memorySeed, ["metadata", "review", "note"]),
      skillDisplayName: proposalText(skillSeed, ["display_name"], detail.summary),
      skillSummary: proposalText(skillSeed, ["summary"], detail.explanation || detail.summary),
      skillScope: (textFromRecord(skillSeed, "scope", "instance") as SkillScope) || "instance",
      skillScopeAgentId: textFromRecord(skillSeed, "scope_agent_id"),
      skillInstructionCore: proposalText(skillSeed, ["instruction_core"], detail.explanation || detail.summary),
    });
  }, [detail]);

  const groupedEvents = REVIEW_BUCKET_ORDER.map((bucket) => ({
    bucket,
    label: REVIEW_BUCKET_LABELS[bucket],
    events: events.filter((event) => event.review_bucket === bucket),
  }));

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

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
      setMessage(`Learning event ${payload.event.learning_event_id} created.`);
      updateRoute((next) => next.set("eventId", payload.event.learning_event_id));
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Learning event creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleDecide = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

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
      const payload = await decideLearningEvent(instanceId, detail.learning_event_id, {
        decision: decideForm.decision,
        decision_note: normalizeOptional(decideForm.decisionNote),
        human_override: decideForm.humanOverride,
        memory_payload: isMemoryDecision(decideForm.decision)
          ? createMemoryProposal(decideForm, detail.summary, detail.explanation)
          : {},
        skill_payload: isSkillDecision(decideForm.decision)
          ? createSkillProposal(decideForm, detail.summary, detail.explanation)
          : {},
      });

      setMessage(`Learning event ${payload.event.learning_event_id} decided.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Learning decision failed.");
    } finally {
      setSavingDecide(false);
    }
  };

  const handlePatternScan = async () => {
    if (!canMutate || !instanceId) {
      return;
    }
    setScanningPatterns(true);
    setError("");
    setMessage("");
    try {
      const payload = await scanLearningPatterns(instanceId);
      setScanResult(payload.events);
      setMessage(`Pattern scan created ${payload.events.length} learning event(s).`);
      if (payload.events[0]?.learning_event_id) {
        updateRoute((next) => next.set("eventId", payload.events[0].learning_event_id));
      }
      setRefreshNonce((current) => current + 1);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Pattern scan failed.");
    } finally {
      setScanningPatterns(false);
    }
  };

  if (!sessionReady) {
    return <section className="fg-page"><PageIntro eyebrow="Work Interaction" title="Learning" description="ForgeFrame is restoring learning-review state." question="Which learning surface should open once scope resolves?" links={[{ label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while session scope resolves." }]} badges={[{ label: "Checking access", tone: "neutral" }]} note="Learning events persist review truth, promotion decisions, and explainability." /></section>;
  }

  if (!canRead) {
    return <section className="fg-page"><PageIntro eyebrow="Work Interaction" title="Learning" description="This route is reserved for operators and admins who can inspect real learning and memory-promotion truth." question="Which adjacent surface should remain open while learning access is outside the current permission envelope?" links={[{ label: "Memory", to: CONTROL_PLANE_ROUTES.memory, description: "Inspect existing memory truth while learning review remains closed." }]} badges={[{ label: "Operator or admin required", tone: "warning" }]} note="ForgeFrame does not render cosmetic learning suggestions without scoped access." /></section>;
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Learning"
        description="Review learning events as explicit persistence proposals, inspect explainability, and decide whether the result should stay as history, become memory, or become a draft skill."
        question="Does automatic learning stay under review control, or is ForgeFrame still promoting memory and skill state without a visible decision trail?"
        links={[
          { label: "Memory", to: buildMemoryPath({ instanceId }), description: "Inspect durable or boot memory created from learning decisions." },
          { label: "Skills", to: buildInventoryPath(CONTROL_PLANE_ROUTES.skills, instanceId), description: "Inspect draft skills created from approved learning events." },
        ]}
        badges={[
          { label: `${events.length} event${events.length === 1 ? "" : "s"}`, tone: events.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Pattern scans, session rotations, operator actions, and runtime signals land here as reviewable objects with visible source, proposal, risk, and outcome truth."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-inline-form">
          <label>
            Instance
            <select value={instanceId} onChange={(event) => updateRoute((next) => { next.set("instanceId", event.target.value); next.delete("eventId"); })}>
              {instances.map((instance) => <option key={instance.instance_id} value={instance.instance_id}>{instance.display_name} ({instance.instance_id})</option>)}
            </select>
          </label>
          <label>
            Backend status
            <select value={statusFilter} onChange={(event) => updateRoute((next) => { const value = event.target.value; if (value === "all") next.delete("status"); else next.set("status", value); })}>
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Trigger
            <select value={triggerFilter} onChange={(event) => updateRoute((next) => { const value = event.target.value; if (value === "all") next.delete("triggerKind"); else next.set("triggerKind", value); })}>
              {TRIGGER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button type="button" disabled={!canMutate || scanningPatterns || !instanceId} onClick={() => void handlePatternScan()}>
            {scanningPatterns ? "Scanning patterns" : "Run pattern scan"}
          </button>
          <span className="fg-pill" data-tone={instancesState === "success" && listState === "success" ? "success" : listState === "error" || detailState === "error" ? "danger" : "neutral"}>
            {instancesState}/{listState}/{detailState}
          </span>
        </div>
      </article>

      {scanResult ? (
        <article className="fg-card">
          <h3>Last pattern scan result</h3>
          {scanResult.length === 0 ? (
            <p className="fg-muted">No new review items were created. ForgeFrame did not detect a repeated pattern that required another persistence proposal.</p>
          ) : (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Pattern scan results">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Suggested path</th>
                    <th>Target</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResult.map((event) => (
                    <tr key={event.learning_event_id}>
                      <td>
                        <Link to={buildLearningPath({ instanceId, eventId: event.learning_event_id })}>{event.summary}</Link>
                        <div className="fg-muted">{event.source.label}</div>
                      </td>
                      <td><span className="fg-pill" data-tone={laneTone(event.suggested_lane)}>{event.suggested_lane_label}</span></td>
                      <td>{event.proposal.target_label}</td>
                      <td><span className="fg-pill" data-tone={riskTone(event.risk.level)}>{event.risk.level}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : null}

      <div className="fg-grid">
        <div className="fg-stack">
          {groupedEvents.map((group) => (
            <article className="fg-card" key={group.bucket}>
              <div className="fg-section-heading">
                <div>
                  <h3>{group.label}</h3>
                  <p className="fg-muted">Grouped by review bucket so suggested, held-for-review, promoted, and rejected events do not collapse into one flat queue.</p>
                </div>
                <span className="fg-pill" data-tone={bucketTone(group.bucket)}>{group.events.length}</span>
              </div>

              {group.events.length === 0 ? (
                <p className="fg-muted">No learning events are currently classified as {group.label.toLowerCase()}.</p>
              ) : (
                <div className="fg-table-wrap">
                  <table className="fg-table" aria-label={`${group.label} learning events`}>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Source</th>
                        <th>Suggested path</th>
                        <th>Target / Scope</th>
                        <th>Risk</th>
                        <th>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.events.map((event) => (
                        <tr key={event.learning_event_id}>
                          <td>
                            <button type="button" className="fg-table-trigger" onClick={() => updateRoute((next) => next.set("eventId", event.learning_event_id))}>
                              {event.summary}
                            </button>
                            <div className="fg-muted">{event.trigger_kind} · {formatTimestamp(event.created_at)}</div>
                          </td>
                          <td>
                            <div>{event.source.label}</div>
                            <div className="fg-muted">{event.source.detail ?? "No additional source detail."}</div>
                          </td>
                          <td><span className="fg-pill" data-tone={laneTone(event.suggested_lane)}>{event.suggested_lane_label}</span></td>
                          <td>
                            <div>{event.proposal.target_label}</div>
                            <div className="fg-muted">{event.proposal.scope_label}</div>
                          </td>
                          <td><span className="fg-pill" data-tone={riskTone(event.risk.level)}>{event.risk.level}</span></td>
                          <td>
                            <div>{describeOutcome(event)}</div>
                            <div className="fg-muted">{event.outcome.scope_label ?? "No outcome scope yet."}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ))}
        </div>

        <article className="fg-card">
          <div className="fg-section-heading">
            <div>
              <h3>{detail ? detail.summary : "Learning detail"}</h3>
              <p className="fg-muted">{detail ? `Learning event ${detail.learning_event_id}` : "Select a learning event to inspect explainability, proposal scope, and decision effect."}</p>
            </div>
            {detail ? <span className="fg-pill">{detail.learning_event_id}</span> : null}
          </div>

          {detail ? (
            <div className="fg-stack">
              <div className="fg-inline-form">
                <span className="fg-pill" data-tone={bucketTone(detail.review_bucket)}>{detail.review_bucket_label}</span>
                <span className="fg-pill" data-tone={laneTone(detail.suggested_lane)}>{detail.suggested_lane_label}</span>
                <span className="fg-pill" data-tone={riskTone(detail.risk.level)}>{detail.risk.level} risk</span>
                <span className="fg-pill">{detail.trigger_kind}</span>
              </div>

              <article className="fg-subcard">
                <h4>Trigger and source</h4>
                <div className="fg-grid fg-grid-compact">
                  <div>
                    <strong>Source</strong>
                    <p>{detail.source.label}</p>
                    <p className="fg-muted">{detail.source.detail ?? "No additional source context was recorded."}</p>
                  </div>
                  <div>
                    <strong>Timing</strong>
                    <p>{formatTimestamp(detail.created_at)}</p>
                    <p className="fg-muted">Decided: {formatTimestamp(detail.decided_at)}</p>
                  </div>
                  <div>
                    <strong>Current outcome</strong>
                    <p>{detail.outcome.target_label}</p>
                    <p className="fg-muted">{detail.outcome.scope_label ?? "No persistent target recorded yet."}</p>
                  </div>
                </div>
                <div className="fg-actions">
                  {detail.conversation ? <Link className="fg-nav-link" to={buildConversationPath({ instanceId, conversationId: detail.conversation.record_id })}>Open conversation</Link> : null}
                  {detail.run ? <Link className="fg-nav-link" to={buildRunPath(instanceId, detail.run.record_id)}>Open execution review</Link> : null}
                  {detail.promoted_memory ? <Link className="fg-nav-link" to={buildMemoryPath({ instanceId, memoryId: detail.promoted_memory.record_id })}>Open promoted memory</Link> : null}
                  {detail.promoted_skill ? <Link className="fg-nav-link" to={buildSkillPath(instanceId, detail.promoted_skill.record_id)}>Open promoted skill</Link> : null}
                </div>
              </article>

              <article className="fg-subcard">
                <h4>Proposed promotion</h4>
                <div className="fg-grid fg-grid-compact">
                  <div>
                    <strong>Suggested path</strong>
                    <p>{detail.proposal.target_label}</p>
                    <p className="fg-muted">{detail.proposal.scope_label}</p>
                  </div>
                  <div>
                    <strong>Target surface</strong>
                    <p>{detail.proposal.surface}</p>
                    <p className="fg-muted">{detail.proposal.trust_label ?? "No trust override recorded."}</p>
                  </div>
                  <div>
                    <strong>Content summary</strong>
                    <p>{detail.proposal.content_summary}</p>
                    <p className="fg-muted">{detail.outcome.target_label}</p>
                  </div>
                </div>

                {detail.proposal.surface === "memory" ? (
                  <div className="fg-grid fg-grid-compact">
                    <div>
                      <strong>Memory title</strong>
                      <p>{proposalText(detail.proposed_memory, ["title"], detail.summary)}</p>
                    </div>
                    <div>
                      <strong>Memory kind</strong>
                      <p>{textFromRecord(detail.proposed_memory, "memory_kind", "summary")}</p>
                    </div>
                    <div>
                      <strong>Visibility / sensitivity</strong>
                      <p>{textFromRecord(detail.proposed_memory, "visibility_scope", "team")} / {textFromRecord(detail.proposed_memory, "sensitivity", "normal")}</p>
                    </div>
                    <div>
                      <strong>Review schedule</strong>
                      <p>{nestedTextFromRecord(detail.proposed_memory, ["metadata", "review", "review_at"], "No review date proposed.")}</p>
                      <p className="fg-muted">{nestedTextFromRecord(detail.proposed_memory, ["metadata", "review", "note"], "No review note proposed.")}</p>
                    </div>
                  </div>
                ) : null}

                {detail.proposal.surface === "skill" ? (
                  <div className="fg-grid fg-grid-compact">
                    <div>
                      <strong>Skill display name</strong>
                      <p>{proposalText(detail.proposed_skill, ["display_name"], detail.summary)}</p>
                    </div>
                    <div>
                      <strong>Skill scope</strong>
                      <p>{textFromRecord(detail.proposed_skill, "scope", "instance")}</p>
                    </div>
                    <div>
                      <strong>Instruction core</strong>
                      <p>{proposalText(detail.proposed_skill, ["instruction_core"], detail.explanation || detail.summary)}</p>
                    </div>
                  </div>
                ) : null}
              </article>

              <article className="fg-subcard">
                <h4>Risk and explainability</h4>
                <p>{detail.explanation || "No explanation was recorded for this learning event."}</p>
                <ul className="fg-list">
                  {detail.risk.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <div className="fg-grid fg-grid-compact">
                  {evidenceEntries(detail.evidence).map((entry) => (
                    <div key={entry.key}>
                      <strong>{entry.key}</strong>
                      <p>{entry.value}</p>
                    </div>
                  ))}
                </div>
                <details>
                  <summary>Structured payload evidence</summary>
                  <pre>{JSON.stringify({ evidence: detail.evidence, proposed_memory: detail.proposed_memory, proposed_skill: detail.proposed_skill }, null, 2)}</pre>
                </details>
              </article>

              <form className="fg-stack" onSubmit={handleDecide}>
                <article className="fg-subcard">
                  <h4>Decision</h4>
                  <div className="fg-actions">
                    <button type="button" onClick={() => setDecideForm((current) => ({ ...current, decision: "history_only" }))}>Approve</button>
                    <button type="button" onClick={() => setDecideForm((current) => ({ ...current, decision: "discard" }))}>Reject</button>
                    <button type="button" onClick={() => setDecideForm((current) => ({ ...current, decision: "durable_memory" }))}>Promote durable memory</button>
                    <button type="button" onClick={() => setDecideForm((current) => ({ ...current, decision: "boot_memory" }))}>Promote boot memory</button>
                    <button type="button" onClick={() => setDecideForm((current) => ({ ...current, decision: "skill_draft" }))}>Draft skill</button>
                    <button type="button" onClick={() => setDecideForm((current) => ({ ...current, decision: "review_required" }))}>Require review</button>
                  </div>

                  <div className="fg-grid fg-grid-compact">
                    <label>
                      Decision path
                      <select value={decideForm.decision} onChange={(event) => setDecideForm((current) => ({ ...current, decision: event.target.value as LearningDecision }))}>
                        {DECISION_OPTIONS.map((option) => <option key={option} value={option}>{DECISION_LABELS[option]}</option>)}
                      </select>
                    </label>
                    <label>
                      Decision note
                      <textarea rows={3} value={decideForm.decisionNote} onChange={(event) => setDecideForm((current) => ({ ...current, decisionNote: event.target.value }))} />
                    </label>
                  </div>

                  <label>
                    <input
                      type="checkbox"
                      checked={decideForm.humanOverride}
                      onChange={(event) => setDecideForm((current) => ({ ...current, humanOverride: event.target.checked }))}
                    />
                    {" "}Human override
                  </label>
                  <p className="fg-muted">{DECISION_HELP[decideForm.decision]}</p>
                </article>

                {isMemoryDecision(decideForm.decision) ? (
                  <article className="fg-subcard">
                    <h4>Memory promotion payload</h4>
                    <div className="fg-grid fg-grid-compact">
                      <label>
                        Memory kind
                        <select value={decideForm.memoryKind} onChange={(event) => setDecideForm((current) => ({ ...current, memoryKind: event.target.value as MemoryKind }))}>
                          {MEMORY_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <label>
                        Visibility
                        <select value={decideForm.memoryVisibility} onChange={(event) => setDecideForm((current) => ({ ...current, memoryVisibility: event.target.value as VisibilityScope }))}>
                          {MEMORY_VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <label>
                        Sensitivity
                        <select value={decideForm.memorySensitivity} onChange={(event) => setDecideForm((current) => ({ ...current, memorySensitivity: event.target.value as MemorySensitivity }))}>
                          {MEMORY_SENSITIVITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="fg-grid fg-grid-compact">
                      <label>
                        Source trust
                        <select value={decideForm.memoryTrust} onChange={(event) => setDecideForm((current) => ({ ...current, memoryTrust: event.target.value as MemorySourceTrustClass }))}>
                          {MEMORY_TRUST_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <label>
                        Memory title
                        <input value={decideForm.memoryTitle} onChange={(event) => setDecideForm((current) => ({ ...current, memoryTitle: event.target.value }))} />
                      </label>
                      <label>
                        Memory body
                        <textarea rows={4} value={decideForm.memoryBody} onChange={(event) => setDecideForm((current) => ({ ...current, memoryBody: event.target.value }))} />
                      </label>
                    </div>
                    <div className="fg-grid fg-grid-compact">
                      <label>
                        Review date
                        <input value={decideForm.memoryReviewAt} onChange={(event) => setDecideForm((current) => ({ ...current, memoryReviewAt: event.target.value }))} placeholder="2026-05-30T09:00:00Z" />
                      </label>
                      <label>
                        Review note
                        <input value={decideForm.memoryReviewNote} onChange={(event) => setDecideForm((current) => ({ ...current, memoryReviewNote: event.target.value }))} placeholder="Review inferred durable truth before long-term retention." />
                      </label>
                    </div>
                    {decideForm.decision === "durable_memory" && decideForm.memoryTrust !== "human_verified" ? (
                      <p className="fg-muted">Durable memory with inferred or unverified trust must carry a scheduled review date before promotion can succeed.</p>
                    ) : null}
                  </article>
                ) : null}

                {isSkillDecision(decideForm.decision) ? (
                  <article className="fg-subcard">
                    <h4>Skill draft payload</h4>
                    <div className="fg-grid fg-grid-compact">
                      <label>
                        Skill display name
                        <input value={decideForm.skillDisplayName} onChange={(event) => setDecideForm((current) => ({ ...current, skillDisplayName: event.target.value }))} />
                      </label>
                      <label>
                        Scope
                        <select value={decideForm.skillScope} onChange={(event) => setDecideForm((current) => ({ ...current, skillScope: event.target.value as SkillScope }))}>
                          {SKILL_SCOPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <label>
                        Scope agent ID
                        <input value={decideForm.skillScopeAgentId} onChange={(event) => setDecideForm((current) => ({ ...current, skillScopeAgentId: event.target.value }))} />
                      </label>
                    </div>
                    <label>
                      Skill summary
                      <textarea rows={3} value={decideForm.skillSummary} onChange={(event) => setDecideForm((current) => ({ ...current, skillSummary: event.target.value }))} />
                    </label>
                    <label>
                      Instruction core
                      <textarea rows={5} value={decideForm.skillInstructionCore} onChange={(event) => setDecideForm((current) => ({ ...current, skillInstructionCore: event.target.value }))} />
                    </label>
                  </article>
                ) : null}

                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingDecide}>
                    {savingDecide ? "Applying decision" : DECISION_LABELS[decideForm.decision]}
                  </button>
                </div>
              </form>
            </div>
          ) : <p className="fg-muted">Select a learning event to inspect explainability, source scope, and the real decision path.</p>}
        </article>
      </div>

      <article className="fg-card">
        <h3>Record manual learning review item</h3>
        <p className="fg-muted">Use this only when operators need to persist a real review item that does not already exist from runtime evidence. The main path remains pattern scan and explicit decision review, not ad-hoc event CRUD.</p>
        <form className="fg-stack" onSubmit={handleCreate}>
          <div className="fg-grid fg-grid-compact">
            <label>
              Trigger
              <select value={createForm.triggerKind} onChange={(event) => setCreateForm((current) => ({ ...current, triggerKind: event.target.value as LearningTriggerKind }))}>
                {TRIGGER_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Suggested path
              <select value={createForm.suggestedDecision} onChange={(event) => setCreateForm((current) => ({ ...current, suggestedDecision: event.target.value as LearningDecision }))}>
                {DECISION_OPTIONS.map((option) => <option key={option} value={option}>{DECISION_LABELS[option]}</option>)}
              </select>
            </label>
            <label>
              Source note
              <input value={createForm.evidenceSourceRef} onChange={(event) => setCreateForm((current) => ({ ...current, evidenceSourceRef: event.target.value }))} placeholder="thread-7 / incident-42 / operator handoff" />
            </label>
          </div>

          <div className="fg-grid fg-grid-compact">
            <label>
              Agent ID
              <input value={createForm.agentId} onChange={(event) => setCreateForm((current) => ({ ...current, agentId: event.target.value }))} />
            </label>
            <label>
              Run ID
              <input value={createForm.runId} onChange={(event) => setCreateForm((current) => ({ ...current, runId: event.target.value }))} />
            </label>
            <label>
              Conversation ID
              <input value={createForm.conversationId} onChange={(event) => setCreateForm((current) => ({ ...current, conversationId: event.target.value }))} />
            </label>
          </div>

          <label>
            Summary
            <input value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} />
          </label>
          <label>
            Explanation
            <textarea rows={4} value={createForm.explanation} onChange={(event) => setCreateForm((current) => ({ ...current, explanation: event.target.value }))} />
          </label>
          <label>
            Evidence note
            <textarea rows={3} value={createForm.evidenceNote} onChange={(event) => setCreateForm((current) => ({ ...current, evidenceNote: event.target.value }))} />
          </label>

          {isMemoryDecision(createForm.suggestedDecision) ? (
            <section className="fg-subcard">
              <h4>Memory proposal</h4>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Memory kind
                  <select value={createForm.memoryKind} onChange={(event) => setCreateForm((current) => ({ ...current, memoryKind: event.target.value as MemoryKind }))}>
                    {MEMORY_KIND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Visibility
                  <select value={createForm.memoryVisibility} onChange={(event) => setCreateForm((current) => ({ ...current, memoryVisibility: event.target.value as VisibilityScope }))}>
                    {MEMORY_VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Sensitivity
                  <select value={createForm.memorySensitivity} onChange={(event) => setCreateForm((current) => ({ ...current, memorySensitivity: event.target.value as MemorySensitivity }))}>
                    {MEMORY_SENSITIVITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Source trust
                  <select value={createForm.memoryTrust} onChange={(event) => setCreateForm((current) => ({ ...current, memoryTrust: event.target.value as MemorySourceTrustClass }))}>
                    {MEMORY_TRUST_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Memory title
                  <input value={createForm.memoryTitle} onChange={(event) => setCreateForm((current) => ({ ...current, memoryTitle: event.target.value }))} />
                </label>
                <label>
                  Memory body
                  <textarea rows={4} value={createForm.memoryBody} onChange={(event) => setCreateForm((current) => ({ ...current, memoryBody: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Review date
                  <input value={createForm.memoryReviewAt} onChange={(event) => setCreateForm((current) => ({ ...current, memoryReviewAt: event.target.value }))} placeholder="2026-05-30T09:00:00Z" />
                </label>
                <label>
                  Review note
                  <input value={createForm.memoryReviewNote} onChange={(event) => setCreateForm((current) => ({ ...current, memoryReviewNote: event.target.value }))} placeholder="Schedule review for inferred durable truth." />
                </label>
              </div>
              {createForm.suggestedDecision === "durable_memory" && createForm.memoryTrust !== "human_verified" ? (
                <p className="fg-muted">If this event recommends durable memory from inferred or unverified trust, record a review date up front so the later promotion path stays valid.</p>
              ) : null}
            </section>
          ) : null}

          {isSkillDecision(createForm.suggestedDecision) ? (
            <section className="fg-subcard">
              <h4>Skill draft proposal</h4>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Skill display name
                  <input value={createForm.skillDisplayName} onChange={(event) => setCreateForm((current) => ({ ...current, skillDisplayName: event.target.value }))} />
                </label>
                <label>
                  Skill scope
                  <select value={createForm.skillScope} onChange={(event) => setCreateForm((current) => ({ ...current, skillScope: event.target.value as SkillScope }))}>
                    {SKILL_SCOPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Scope agent ID
                  <input value={createForm.skillScopeAgentId} onChange={(event) => setCreateForm((current) => ({ ...current, skillScopeAgentId: event.target.value }))} />
                </label>
              </div>
              <label>
                Skill summary
                <textarea rows={3} value={createForm.skillSummary} onChange={(event) => setCreateForm((current) => ({ ...current, skillSummary: event.target.value }))} />
              </label>
              <label>
                Instruction core
                <textarea rows={5} value={createForm.skillInstructionCore} onChange={(event) => setCreateForm((current) => ({ ...current, skillInstructionCore: event.target.value }))} />
              </label>
            </section>
          ) : null}

          <div className="fg-actions">
            <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !normalizeText(createForm.summary)}>
              {savingCreate ? "Creating learning event" : "Create learning review item"}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
