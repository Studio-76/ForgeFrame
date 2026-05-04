/**
 * Agent create/edit drawer form — shared form for both create and edit modes.
 *
 * Renders inside a DetailDrawer with identity, role, participation,
 * profile, and metadata sections.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import type {
  AgentParticipationMode,
  AgentRoleKind,
  AgentStatus,
} from "../../../api/domain/agents";
import { DetailDrawer } from "../../../components/ui/DetailDrawer";
import {
  DRAWER_FORM_ID,
  PARTICIPATION_OPTIONS,
  ROLE_OPTIONS,
  UNSUPPORTED_PARTICIPATION_MODES,
  type AgentCreateForm,
  type AgentEditForm,
  type DrawerMode,
} from "../types";
import { agentStatusTone } from "../helpers";

/** Props for AgentCreateForm. */
export interface AgentCreateFormProps {
  /** Drawer mode: "create", "edit", or "closed". */
  drawerMode: DrawerMode;
  /** Close the drawer. */
  onClose: () => void;
  /** Create form state (used when drawerMode === "create"). */
  createForm: AgentCreateForm;
  /** Create form setter. */
  setCreateForm: React.Dispatch<React.SetStateAction<AgentCreateForm>>;
  /** Edit form state (used when drawerMode === "edit"). */
  editForm: AgentEditForm;
  /** Edit form setter. */
  setEditForm: React.Dispatch<React.SetStateAction<AgentEditForm>>;
  /** Whether save is in progress (create mode). */
  savingCreate: boolean;
  /** Whether save is in progress (edit mode). */
  savingUpdate: boolean;
  /** Whether the user can mutate. */
  canMutate: boolean;
  /** Current instance ID. */
  instanceId: string;
  /** Whether a detail is selected (for edit mode). */
  hasDetail: boolean;
  /** Selected detail status tone (for edit mode status badge). */
  detailStatusTone: "success" | "warning" | "neutral";
  /** Submit handler. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Drawer form for creating or editing an agent, with identity,
 * role/participation, profile/routing, and metadata sections.
 */
export function AgentCreateForm({
  drawerMode,
  onClose,
  createForm,
  setCreateForm,
  editForm,
  setEditForm,
  savingCreate,
  savingUpdate,
  canMutate,
  instanceId,
  hasDetail,
  detailStatusTone,
  onSubmit,
}: AgentCreateFormProps) {
  if (drawerMode === "closed") return null;

  const isCreate = drawerMode === "create";
  const drawerModeLabel = isCreate ? "Create agent" : "Edit agent";

  const drawerStatus = isCreate ? "secondary create path" : "Edit agent";
  const drawerStatusTone = isCreate ? "neutral" : detailStatusTone;

  const currentFormValue = <K extends keyof AgentCreateForm>(key: K): AgentCreateForm[K] =>
    isCreate ? createForm[key] : (editForm as unknown as AgentCreateForm)[key];

  const updateField = (field: string, value: string) => {
    if (isCreate) {
      setCreateForm((current) => ({ ...current, [field]: value }));
    } else {
      setEditForm((current) => ({ ...current, [field]: value }));
    }
  };

  return (
    <DetailDrawer
      open={true}
      title={drawerModeLabel}
      description={
        isCreate
          ? "Create remains available, but the registry now centers on real operator and participation truth."
          : "Adjust display name, participation posture, role, and profile linkage in a focused drawer."
      }
      status={drawerStatus}
      statusTone={drawerStatusTone}
      properties={[
        { label: "Supported participation", value: "assigned/owner, mentioned-only, broadcast participant, handoff-only" },
        { label: "Unsupported modes", value: UNSUPPORTED_PARTICIPATION_MODES.join(", ") },
        { label: "Conversation effect", value: "Conversations only offer agents where the participation mode actually permits the control." },
      ]}
      actions={
        <>
          <button type="button" className="ff-btn-secondary ff-btn-sm" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form={DRAWER_FORM_ID}
            className="ff-btn-primary ff-btn-sm"
            disabled={
              !canMutate
              || (isCreate
                ? savingCreate || !instanceId || !createForm.displayName.trim()
                : savingUpdate || !hasDetail)
            }
          >
            {isCreate
              ? (savingCreate ? "Creating agent" : "Create agent")
              : (savingUpdate ? "Saving agent" : "Save agent")}
          </button>
        </>
      }
      onClose={onClose}
    >
      <form id={DRAWER_FORM_ID} className="fg-stack" onSubmit={onSubmit}>
        <section className="fg-subcard">
          <h4>Identity</h4>
          <div className="fg-grid fg-grid-compact">
            {isCreate ? (
              <label>
                Agent ID
                <input
                  value={createForm.agentId}
                  onChange={(event) => setCreateForm((current) => ({ ...current, agentId: event.target.value }))}
                  placeholder="agent_pricing"
                />
              </label>
            ) : null}
            <label>
              Display name
              <input
                value={currentFormValue("displayName")}
                onChange={(event) => updateField("displayName", event.target.value)}
              />
            </label>
            <label>
              Default name
              <input
                value={currentFormValue("defaultName")}
                onChange={(event) => updateField("defaultName", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="fg-subcard">
          <h4>Role and participation</h4>
          <div className="fg-grid fg-grid-compact">
            <label>
              Role kind
              <select
                value={currentFormValue("roleKind")}
                onChange={(event) => updateField("roleKind", event.target.value)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={currentFormValue("status")}
                onChange={(event) => updateField("status", event.target.value)}
              >
                {(["active", "paused", "archived"] as const).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Default Operator
              <select
                value={currentFormValue("isDefaultOperator")}
                onChange={(event) => updateField("isDefaultOperator", event.target.value)}
              >
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
            </label>
          </div>
          <label>
            Participation mode
            <select
              value={currentFormValue("participationMode")}
              onChange={(event) => updateField("participationMode", event.target.value)}
            >
              {PARTICIPATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-meta text-muted">
            Unsupported registry modes stay explicit: `silent` and `subscribed` are not persisted by the current backend and are therefore not shown as editable options.
          </p>
        </section>

        <section className="fg-subcard">
          <h4>Profile and routing</h4>
          <div className="fg-grid fg-grid-compact">
            <label>
              Assistant profile ID
              <input
                value={currentFormValue("assistantProfileId")}
                onChange={(event) => updateField("assistantProfileId", event.target.value)}
              />
            </label>
            <label>
              Allowed targets (CSV)
              <input
                value={currentFormValue("allowedTargets")}
                onChange={(event) => updateField("allowedTargets", event.target.value)}
                placeholder="conversation, review"
              />
            </label>
          </div>
          <label>
            Metadata JSON
            <textarea
              rows={6}
              value={currentFormValue("metadataJson")}
              onChange={(event) => updateField("metadataJson", event.target.value)}
            />
          </label>
        </section>
      </form>
    </DetailDrawer>
  );
}
