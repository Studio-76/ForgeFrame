import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createLearningEvent,
  decideLearningEvent,
  fetchInstances,
  fetchLearningEventDetail,
  fetchLearningEvents,
  scanLearningPatterns,
  type LearningDecision,
  type LearningEventDetail,
  type LearningStatus,
  type LearningTriggerKind,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<LearningStatus | "all"> = ["all", "pending", "applied", "discarded", "review_required"];
const TRIGGER_OPTIONS: Array<LearningTriggerKind | "all"> = ["all", "run_completion", "session_rotation", "pattern_detected", "operator_action"];
const DECISION_OPTIONS: LearningDecision[] = ["discard", "history_only", "boot_memory", "durable_memory", "skill_draft", "review_required"];

const DEFAULT_CREATE_FORM = {
  triggerKind: "operator_action" as LearningTriggerKind,
  summary: "",
  explanation: "",
  suggestedDecision: "review_required" as LearningDecision,
  agentId: "",
  runId: "",
  conversationId: "",
  evidenceJson: "{}",
  proposedMemoryJson: "{}",
  proposedSkillJson: "{}",
};

const DEFAULT_DECIDE_FORM = {
  decision: "review_required" as LearningDecision,
  decisionNote: "",
  humanOverride: "no" as "yes" | "no",
  memoryPayloadJson: "{}",
  skillPayloadJson: "{}",
};

export function LearningPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const eventId = searchParams.get("eventId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as LearningStatus | "all" | "") || "all";
  const triggerFilter = (searchParams.get("triggerKind")?.trim() as LearningTriggerKind | "all" | "") || "all";

  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [events, setEvents] = useState<LearningEventDetail[]>([]);
  const [detail, setDetail] = useState<LearningEventDetail | null>(null);
  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [decideForm, setDecideForm] = useState(DEFAULT_DECIDE_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingDecide, setSavingDecide] = useState(false);
  const [scanningPatterns, setScanningPatterns] = useState(false);
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
        if (cancelled) return;
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => next.set("instanceId", payload.instances[0].instance_id), true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
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
      return;
    }
    let cancelled = false;
    setListState("loading");
    void fetchLearningEvents(instanceId, { status: statusFilter, triggerKind: triggerFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) return;
        setEvents(payload.events);
        setListState("success");
        const nextEventId = payload.events.some((item) => item.learning_event_id === eventId) ? eventId : payload.events[0]?.learning_event_id ?? "";
        if (nextEventId !== eventId) {
          updateRoute((next) => {
            if (nextEventId) next.set("eventId", nextEventId);
            else next.delete("eventId");
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
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
        if (cancelled) return;
        setDetail(payload.event);
        setDetailState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
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
    setDecideForm({
      decision: detail.suggested_decision,
      decisionNote: detail.decision_note ?? "",
      humanOverride: detail.human_override ? "yes" : "no",
      memoryPayloadJson: JSON.stringify(detail.proposed_memory, null, 2),
      skillPayloadJson: JSON.stringify(detail.proposed_skill, null, 2),
    });
  }, [detail]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) return;
    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createLearningEvent(instanceId, {
        trigger_kind: createForm.triggerKind,
        summary: createForm.summary.trim(),
        explanation: createForm.explanation.trim(),
        suggested_decision: createForm.suggestedDecision,
        agent_id: normalizeOptional(createForm.agentId),
        run_id: normalizeOptional(createForm.runId),
        conversation_id: normalizeOptional(createForm.conversationId),
        evidence: parseJsonObject(createForm.evidenceJson, "Learning evidence"),
        proposed_memory: parseJsonObject(createForm.proposedMemoryJson, "Proposed memory"),
        proposed_skill: parseJsonObject(createForm.proposedSkillJson, "Proposed skill"),
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
    if (!canMutate || !instanceId || !detail) return;
    setSavingDecide(true);
    setError("");
    setMessage("");
    try {
      const payload = await decideLearningEvent(instanceId, detail.learning_event_id, {
        decision: decideForm.decision,
        decision_note: normalizeOptional(decideForm.decisionNote),
        human_override: decideForm.humanOverride === "yes",
        memory_payload: parseJsonObject(decideForm.memoryPayloadJson, "Memory payload"),
        skill_payload: parseJsonObject(decideForm.skillPayloadJson, "Skill payload"),
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
    if (!canMutate || !instanceId) return;
    setScanningPatterns(true);
    setError("");
    setMessage("");
    try {
      const payload = await scanLearningPatterns(instanceId);
      setMessage(`Pattern scan created ${payload.events.length} learning event(s).`);
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
        description="Review learning events, run pattern scans, and promote review items into memory or draft skills with explicit explainability."
        question="Is long-term learning governed and reversible, or are memory and skills still being created without traceable review truth?"
        links={[
          { label: "Memory", to: CONTROL_PLANE_ROUTES.memory, description: "Inspect promoted memory entries." },
          { label: "Skills", to: CONTROL_PLANE_ROUTES.skills, description: "Inspect promoted skill drafts and activations." },
        ]}
        badges={[
          { label: `${events.length} event${events.length === 1 ? "" : "s"}`, tone: events.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Session rotation, run completion, pattern detection, and operator actions all land here as explicit reviewable objects."
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
            Status
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
          <span className="fg-pill" data-tone={instancesState === "success" && listState === "success" ? "success" : "neutral"}>{instancesState}/{listState}/{detailState}</span>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <h3>Learning events</h3>
          {events.length === 0 ? <p className="fg-muted">No learning events recorded for this instance.</p> : (
            <ul className="fg-list">
              {events.map((learningEvent) => (
                <li key={learningEvent.learning_event_id}>
                  <button type="button" className="fg-linklike" onClick={() => updateRoute((next) => next.set("eventId", learningEvent.learning_event_id))}>
                    {learningEvent.summary}
                  </button>
                  {" · "}{learningEvent.trigger_kind}{" · "}{learningEvent.status}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="fg-card">
          <h3>{detail ? `Learning event ${detail.learning_event_id}` : "Learning detail"}</h3>
          {detail ? (
            <div className="fg-stack">
              <ul className="fg-list">
                <li>Trigger: {detail.trigger_kind}</li>
                <li>Status: {detail.status}</li>
                <li>Suggested decision: {detail.suggested_decision}</li>
                <li>Agent: {detail.agent?.label ?? "none"}</li>
                <li>Run: {detail.run?.record_id ?? "none"}</li>
                <li>Conversation: {detail.conversation?.label ?? "none"}</li>
                <li>Promoted memory: {detail.promoted_memory?.label ?? "none"}</li>
                <li>Promoted skill: {detail.promoted_skill?.label ?? "none"}</li>
              </ul>

              <article className="fg-subcard">
                <h4>Explanation</h4>
                <p>{detail.explanation || "No explanation was recorded."}</p>
              </article>

              <article className="fg-subcard">
                <h4>Evidence</h4>
                <pre>{JSON.stringify(detail.evidence, null, 2)}</pre>
              </article>

              <article className="fg-subcard">
                <h4>Proposed memory</h4>
                <pre>{JSON.stringify(detail.proposed_memory, null, 2)}</pre>
              </article>

              <article className="fg-subcard">
                <h4>Proposed skill</h4>
                <pre>{JSON.stringify(detail.proposed_skill, null, 2)}</pre>
              </article>

              <form className="fg-stack" onSubmit={handleDecide}>
                <label>
                  Decision
                  <select value={decideForm.decision} onChange={(event) => setDecideForm((current) => ({ ...current, decision: event.target.value as LearningDecision }))}>
                    {DECISION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Decision note
                  <textarea rows={3} value={decideForm.decisionNote} onChange={(event) => setDecideForm((current) => ({ ...current, decisionNote: event.target.value }))} />
                </label>
                <label>
                  Human override
                  <select value={decideForm.humanOverride} onChange={(event) => setDecideForm((current) => ({ ...current, humanOverride: event.target.value as "yes" | "no" }))}>
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </select>
                </label>
                <label>
                  Memory payload JSON
                  <textarea rows={6} value={decideForm.memoryPayloadJson} onChange={(event) => setDecideForm((current) => ({ ...current, memoryPayloadJson: event.target.value }))} />
                </label>
                <label>
                  Skill payload JSON
                  <textarea rows={6} value={decideForm.skillPayloadJson} onChange={(event) => setDecideForm((current) => ({ ...current, skillPayloadJson: event.target.value }))} />
                </label>
                <div className="fg-actions">
                  <button type="submit" disabled={!canMutate || savingDecide}>{savingDecide ? "Applying decision" : "Apply decision"}</button>
                </div>
              </form>
            </div>
          ) : <p className="fg-muted">Select a learning event to inspect its explainability and apply a decision.</p>}
        </article>
      </div>

      <article className="fg-card">
        <h3>Create manual learning event</h3>
        <form className="fg-stack" onSubmit={handleCreate}>
          <div className="fg-grid fg-grid-compact">
            <label>
              Trigger
              <select value={createForm.triggerKind} onChange={(event) => setCreateForm((current) => ({ ...current, triggerKind: event.target.value as LearningTriggerKind }))}>
                {TRIGGER_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Suggested decision
              <select value={createForm.suggestedDecision} onChange={(event) => setCreateForm((current) => ({ ...current, suggestedDecision: event.target.value as LearningDecision }))}>
                {DECISION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Agent ID
              <input value={createForm.agentId} onChange={(event) => setCreateForm((current) => ({ ...current, agentId: event.target.value }))} />
            </label>
          </div>
          <div className="fg-grid fg-grid-compact">
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
            Evidence JSON
            <textarea rows={4} value={createForm.evidenceJson} onChange={(event) => setCreateForm((current) => ({ ...current, evidenceJson: event.target.value }))} />
          </label>
          <label>
            Proposed memory JSON
            <textarea rows={4} value={createForm.proposedMemoryJson} onChange={(event) => setCreateForm((current) => ({ ...current, proposedMemoryJson: event.target.value }))} />
          </label>
          <label>
            Proposed skill JSON
            <textarea rows={4} value={createForm.proposedSkillJson} onChange={(event) => setCreateForm((current) => ({ ...current, proposedSkillJson: event.target.value }))} />
          </label>
          <div className="fg-actions">
            <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.summary.trim()}>
              {savingCreate ? "Creating learning event" : "Create learning event"}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
