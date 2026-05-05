/**
 * Assistant Profiles page.
 *
 * Orchestrates the profile governance workflow with distinct view modes:
 * - browse:  summary + filter + inventory + detail panel
 * - create:  sectioned editor for creating a new profile
 * - edit:    sectioned editor pre-filled from the selected profile
 *
 * Create and edit forms are NEVER visible at the same time. The evaluation
 * tool appears as a modal contextual to the selected profile.
 *
 * Rendered inside RegistryManagementPage template.
 *
 * @packageDocumentation
 */

import {
  startTransition,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";

import {
  createAssistantProfile,
  evaluateAssistantAction,
  fetchAssistantProfileDetail,
  fetchAssistantProfiles,
  updateAssistantProfile,
} from "../api/domain/assistant-profiles";
import type {
  AssistantActionEvaluation,
  AssistantProfileDetail,
  AssistantProfileStatus,
  AssistantProfileSummary,
} from "../api/domain/assistant-profiles";
import { fetchInstances } from "../api/domain/instances";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getWorkInteractionAccess, parseJsonObject, normalizeOptional, type LoadState } from "./workInteractionPageSupport";

import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import type { Action } from "../components/ui/models/action";
import { Button } from "../components/ui/Button";

import {
  ProfileSummary,
  ProfileEmptyState,
  ProfileInventory,
  ProfileDetailPanel,
  SectionedEditor,
  EvaluationModal,
  DEFAULT_PROFILE_FORM,
  DEFAULT_EVALUATION_FORM,
  buildProfilePayload,
  hydrateProfileForm,
  type ProfileFormState,
  type EvaluationFormState,
  type ViewMode,
} from "../features/assistant-profiles";

// ---------------------------------------------------------------------------
// Route param helpers
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: Array<AssistantProfileStatus | "all"> = ["all", "active", "paused"];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * Assistant Profiles page — governed assistant profile management.
 *
 * Uses a view-mode state machine to ensure create and edit forms are never
 * visible simultaneously. The evaluation tool appears as a modal.
 */
export function AssistantProfilesPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  // Route-derived state
  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedAssistantProfileId = searchParams.get("assistantProfileId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as AssistantProfileStatus | "all" | "") || "all";

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [evaluationOpen, setEvaluationOpen] = useState(false);

  // Data state
  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [profiles, setProfiles] = useState<AssistantProfileSummary[]>([]);
  const [detail, setDetail] = useState<AssistantProfileDetail | null>(null);

  // Form state
  const [createForm, setCreateForm] = useState<ProfileFormState>(DEFAULT_PROFILE_FORM);
  const [editForm, setEditForm] = useState<ProfileFormState>(DEFAULT_PROFILE_FORM);
  const [evaluationForm, setEvaluationForm] = useState<EvaluationFormState>(DEFAULT_EVALUATION_FORM);

  // Action state
  const [evaluation, setEvaluation] = useState<AssistantActionEvaluation | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  // -----------------------------------------------------------------------
  // URL helpers
  // -----------------------------------------------------------------------

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

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
        setError(loadError instanceof Error ? loadError.message : "Assistant-profile instance scope could not be loaded.");
      });

    return () => { cancelled = true; };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setProfiles([]);
      setListState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchAssistantProfiles(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) return;
        setProfiles(payload.profiles);
        setListState("success");
        setError("");

        const nextAssistantProfileId = payload.profiles.some((p) => p.assistant_profile_id === selectedAssistantProfileId)
          ? selectedAssistantProfileId
          : payload.profiles[0]?.assistant_profile_id ?? "";
        if (nextAssistantProfileId !== selectedAssistantProfileId) {
          updateRoute((next) => {
            if (nextAssistantProfileId) {
              next.set("assistantProfileId", nextAssistantProfileId);
            } else {
              next.delete("assistantProfileId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setProfiles([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Assistant-profile inventory could not be loaded.");
      });

    return () => { cancelled = true; };
  }, [canRead, instanceId, refreshNonce, selectedAssistantProfileId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedAssistantProfileId) {
      setDetail(null);
      setDetailState("idle");
      setEvaluation(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchAssistantProfileDetail(selectedAssistantProfileId, instanceId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.profile);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Assistant-profile detail could not be loaded.");
      });

    return () => { cancelled = true; };
  }, [canRead, instanceId, refreshNonce, selectedAssistantProfileId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_PROFILE_FORM);
      setEvaluationForm(DEFAULT_EVALUATION_FORM);
      setEvaluation(null);
      return;
    }

    setEditForm(hydrateProfileForm(detail));
    setEvaluationForm({
      actionMode: "direct",
      actionKind: detail.action_policies.allow_mail_actions ? "send_notification" : "create_follow_up",
      priority: "normal",
      channelId: detail.delivery_preferences.primary_channel_id ?? "",
      targetContactId: detail.preferred_contact_id ?? "",
      occurredAt: "",
      requiresExternalDelivery: "yes",
      approvalReference: "",
      metadataJson: "{}",
    });
    setEvaluation(detail.last_evaluation ?? null);
  }, [detail]);

  // -----------------------------------------------------------------------
  // View mode transitions
  // -----------------------------------------------------------------------

  const handleStartCreate = () => {
    setCreateForm(DEFAULT_PROFILE_FORM);
    setViewMode("create");
    setError("");
    setMessage("");
  };

  const handleCancelCreate = () => {
    setViewMode("browse");
  };

  const handleStartEdit = () => {
    if (!detail) return;
    setViewMode("edit");
    setError("");
    setMessage("");
  };

  const handleCancelEdit = () => {
    setViewMode("browse");
  };

  const handleOpenEvaluation = () => {
    setEvaluationOpen(true);
    setError("");
    setMessage("");
  };

  const handleCloseEvaluation = () => {
    setEvaluationOpen(false);
  };

  const handleSelectProfile = (profileId: string) => {
    if (viewMode !== "browse") {
      setViewMode("browse");
    }
    updateRoute((next) => next.set("assistantProfileId", profileId));
  };

  // -----------------------------------------------------------------------
  // CRUD handlers
  // -----------------------------------------------------------------------

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) return;

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createAssistantProfile(instanceId, buildProfilePayload(createForm));
      setCreateForm(DEFAULT_PROFILE_FORM);
      const newId = payload.profile.assistant_profile_id;
      updateRoute((next) => {
        next.set("assistantProfileId", newId);
      });
      setMessage(`Assistant profile ${newId} created.`);
      setViewMode("browse");
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Assistant-profile creation failed.");
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
      await updateAssistantProfile(instanceId, detail.assistant_profile_id, buildProfilePayload(editForm));
      setMessage(`Assistant profile ${detail.assistant_profile_id} updated.`);
      setViewMode("browse");
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Assistant-profile update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleEvaluate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) return;

    setEvaluating(true);
    setError("");
    setMessage("");
    try {
      const payload = await evaluateAssistantAction(instanceId, detail.assistant_profile_id, {
        action_mode: evaluationForm.actionMode,
        action_kind: evaluationForm.actionKind,
        priority: evaluationForm.priority,
        channel_id: normalizeOptional(evaluationForm.channelId),
        target_contact_id: normalizeOptional(evaluationForm.targetContactId),
        occurred_at: normalizeOptional(evaluationForm.occurredAt),
        requires_external_delivery: evaluationForm.requiresExternalDelivery === "yes",
        approval_reference: normalizeOptional(evaluationForm.approvalReference),
        metadata: parseJsonObject(evaluationForm.metadataJson, "Evaluation metadata"),
      });
      setEvaluation(payload.evaluation);
      setMessage(`Assistant action ${payload.evaluation.decision}.`);
      setRefreshNonce((current) => current + 1);
    } catch (evaluationError) {
      setError(evaluationError instanceof Error ? evaluationError.message : "Assistant-action evaluation failed.");
    } finally {
      setEvaluating(false);
    }
  };

  // -----------------------------------------------------------------------
  // Derived template props
  // -----------------------------------------------------------------------

  // ── Scope ──
  const currentInstance = instances.find((i) => i.instance_id === instanceId);
  const scope = instanceId
    ? {
        label: currentInstance
          ? currentInstance.display_name
          : instanceId,
      }
    : undefined;

  // ── Attention items ──
  const attentionItems: AttentionPayload[] = [];
  if (error) {
    attentionItems.push({
      key: "error",
      level: "primary_blocker" as const,
      title: error,
    });
  }
  if (message) {
    attentionItems.push({
      key: "message",
      level: "informational" as const,
      title: message,
    });
  }

  // ── Actions ──
  const riskCount = profiles.filter((profile) => profile.risk_warning).length;

  const primaryAction: Action | undefined = canMutate && instanceId && viewMode === "browse"
    ? {
        label: "Create assistant profile",
        kind: "primary" as const,
        intent: "configure" as const,
        onClick: handleStartCreate,
      }
    : undefined;

  const evalAction: Action | undefined = canMutate && detail && viewMode === "browse"
    ? {
        label: "Evaluate action",
        kind: "secondary" as const,
        intent: "run" as const,
        onClick: handleOpenEvaluation,
      }
    : undefined;

  const editAction: Action | undefined = canMutate && detail && viewMode === "browse"
    ? {
        label: "Edit profile",
        kind: "secondary" as const,
        intent: "configure" as const,
        onClick: handleStartEdit,
      }
    : undefined;

  const actions: Action[] = [
    ...(primaryAction ? [primaryAction] : []),
    ...(editAction ? [editAction] : []),
    ...(evalAction ? [evalAction] : []),
  ];

  // ── Filter content (scope + status) ──
  const filterContent = viewMode === "browse" ? (
    <div className="fg-inline-form">
      <label>
        Instance
        <select
          aria-label="Assistant-profile instance"
          value={instanceId}
          onChange={(event) => updateRoute((next) => {
            next.set("instanceId", event.target.value);
            next.delete("assistantProfileId");
            setViewMode("browse");
          })}
        >
          {instances.map((instance) => (
            <option key={instance.instance_id} value={instance.instance_id}>
              {instance.display_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          aria-label="Assistant-profile status filter"
          value={statusFilter}
          onChange={(event) => updateRoute((next) => {
            if (event.target.value === "all") {
              next.delete("status");
            } else {
              next.set("status", event.target.value);
            }
            next.delete("assistantProfileId");
            setViewMode("browse");
          })}
        >
          {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    </div>
  ) : null;

  // -----------------------------------------------------------------------
  // Early returns (loading, no access)
  // -----------------------------------------------------------------------

  if (!sessionReady) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Assistant Profiles"
        description="ForgeFrame is restoring assistant-profile governance before exposing personal or team assistant rules."
      />
    );
  }

  if (!canRead) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Assistant Profiles"
        description="This route is reserved for operators and admins who can inspect real assistant-governance truth."
        isEmpty
        emptyTitle="Assistant-profile access unavailable"
        emptyDescription="This session does not hold the required permissions to inspect assistant-profile records."
      />
    );
  }

  const isBrowse = viewMode === "browse";
  const isCreate = viewMode === "create";
  const isEdit = viewMode === "edit";

  return (
    <>
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Assistant Profiles"
        description={
          isBrowse
            ? "Governed assistant behavior for personal and team profiles with scope, quiet hours, delivery rules, action permissions, memory scope, and policy evaluation."
            : isCreate
              ? "Create a governed personal or team assistant profile."
              : "Update the selected profile through structured controls."
        }
        scope={scope}
        attentionItems={attentionItems}
        actions={isBrowse ? actions : undefined}
        search={undefined}
        filterContent={filterContent}
        isEmpty={isBrowse && profiles.length === 0}
        emptyTitle="No assistant profiles found"
        emptyDescription={
          "Assistant profiles govern how your personal or team assistant communicates, schedules, delegates, and executes actions. Create your first profile to define quiet hours, delivery rules, action permissions, and approval policies."
        }
        emptyAction={
          canMutate && instanceId ? (
            <Button variant="primary" onPress={handleStartCreate}>
              Create assistant profile
            </Button>
          ) : null
        }
        selectedItemContent={
          isBrowse && detailState !== "idle" ? (
            <ProfileDetailPanel
              instanceId={instanceId}
              detail={detail}
              detailState={detailState}
              canMutate={canMutate}
              onEdit={handleStartEdit}
              onEvaluate={handleOpenEvaluation}
            />
          ) : null
        }
        hasSelection={isBrowse && detailState !== "idle"}
        emptyDetailHint="Select an assistant profile from the inventory to inspect its governance settings."
        diagnostics={
          <AdvancedDiagnostics title="Assistant-profile diagnostics">
            <div className="flex flex-col gap-1 text-meta text-muted">
              <span>List state: {listState}</span>
              <span>Detail state: {detailState}</span>
              <span>Instances state: {instancesState}</span>
              <span>View mode: {viewMode}</span>
              <span>Profiles: {profiles.length}</span>
              <span>Risk warnings: {riskCount}</span>
              <span>Evaluation open: {evaluationOpen ? "yes" : "no"}</span>
            </div>
          </AdvancedDiagnostics>
        }
        diagnosticsTitle="Assistant-profile diagnostics"
      >
        {/* ── Browse mode ── */}
        {isBrowse && profiles.length > 0 ? (
          <>
            <ProfileSummary
              profiles={profiles}
              canMutate={canMutate}
              onCreateProfile={handleStartCreate}
            />
            <div className="fg-grid">
              <article className="fg-card">
                <div className="fg-panel-heading">
                  <div>
                    <h3>Assistant-profile inventory</h3>
                    <p className="fg-muted">Profile, scope, operating mode, quiet-hour posture, direct-action rights, and the most recent evaluation all stay visible here.</p>
                  </div>
                  <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
                </div>
                <ProfileInventory
                  instanceId={instanceId}
                  profiles={profiles}
                  selectedProfileId={selectedAssistantProfileId}
                  onSelectProfile={handleSelectProfile}
                  listState={listState}
                />
              </article>
            </div>
          </>
        ) : null}

        {/* ── Create mode ── */}
        {isCreate ? (
          <SectionedEditor
            title="Create assistant profile"
            description="Create a governed personal or team assistant profile with visible scope, quiet hours, delivery rules, action permissions, and memory posture."
            showProfileId
            form={createForm}
            setForm={setCreateForm}
            onSubmit={handleCreate}
            busy={savingCreate}
            disabled={!canMutate || !instanceId}
            submitLabel="Create assistant profile"
            onCancel={handleCancelCreate}
          />
        ) : null}

        {/* ── Edit mode ── */}
        {isEdit ? (
          <SectionedEditor
            title="Edit assistant profile"
            description="Update the selected profile through structured controls first; raw policy overrides stay available only in the advanced section."
            showProfileId={false}
            form={editForm}
            setForm={setEditForm}
            onSubmit={handleUpdate}
            busy={savingUpdate}
            disabled={!canMutate || !detail}
            submitLabel="Save assistant profile"
            onCancel={handleCancelEdit}
          />
        ) : null}
      </RegistryManagementPage>

      {/* ── Evaluation modal ── */}
      <EvaluationModal
        open={evaluationOpen}
        profileName={detail?.display_name ?? ""}
        form={evaluationForm}
        setForm={setEvaluationForm}
        onSubmit={handleEvaluate}
        evaluating={evaluating}
        disabled={!canMutate || !detail}
        evaluation={evaluation}
        onClose={handleCloseEvaluation}
      />
    </>
  );
}
