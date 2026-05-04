/**
 * Automation create form — guided creation of recurring rules.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import type { AutomationActionKind } from "../../../api/domain/automations";
import { Button } from "../../../components/ui/Button";
import type { AutomationCreateForm, ScheduleUnit } from "../types";
import { ACTION_KIND_OPTIONS } from "../types";
import { cadenceToStructured, structuredToCadence } from "../helpers";

/** Props for AutomationCreateForm. */
export interface AutomationCreateFormProps {
  /** Create form state. */
  createForm: AutomationCreateForm;
  /** Create form setter. */
  setCreateForm: React.Dispatch<React.SetStateAction<AutomationCreateForm>>;
  /** Whether the save is in progress. */
  savingCreate: boolean;
  /** Whether the user can mutate. */
  canMutate: boolean;
  /** Current instance ID. */
  instanceId: string;
  /** Whether advanced schedule fields are shown. */
  showCreateAdvancedSchedule: boolean;
  /** Toggle advanced schedule fields. */
  setShowCreateAdvancedSchedule: React.Dispatch<React.SetStateAction<boolean>>;
  /** Submit handler. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Create automation form with structured schedule editor.
 */
export function AutomationCreateForm({
  createForm,
  setCreateForm,
  savingCreate,
  canMutate,
  instanceId,
  showCreateAdvancedSchedule,
  setShowCreateAdvancedSchedule,
  onSubmit,
}: AutomationCreateFormProps) {
  const createSchedule = cadenceToStructured(createForm.cadenceMinutes);

  return (
    <form className="fg-stack" onSubmit={onSubmit}>
      <div className="fg-grid fg-grid-compact">
        <label>
          Automation ID
          <input
            value={createForm.automationId}
            onChange={(event) => setCreateForm((current) => ({ ...current, automationId: event.target.value }))}
            placeholder="automation_follow_up_alpha"
          />
        </label>
        <label>
          Action kind
          <select
            value={createForm.actionKind}
            onChange={(event) => setCreateForm((current) => ({ ...current, actionKind: event.target.value as AutomationActionKind }))}
          >
            {ACTION_KIND_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Title
        <input
          value={createForm.title}
          onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
          placeholder="Create follow-up"
        />
      </label>
      <label>
        Summary
        <textarea
          rows={3}
          value={createForm.summary}
          onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))}
        />
      </label>

      <section className="fg-subcard">
        <h4>Schedule editor</h4>
        <div className="fg-grid fg-grid-compact">
          <label>
            Every
            <input
              value={createSchedule.every}
              onChange={(event) => setCreateForm((current) => ({
                ...current,
                cadenceMinutes: structuredToCadence(
                  event.target.value,
                  cadenceToStructured(current.cadenceMinutes).unit,
                ),
              }))}
            />
          </label>
          <label>
            Unit
            <select
              value={createSchedule.unit}
              onChange={(event) => setCreateForm((current) => ({
                ...current,
                cadenceMinutes: structuredToCadence(
                  cadenceToStructured(current.cadenceMinutes).every,
                  event.target.value as ScheduleUnit,
                ),
              }))}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </label>
          <label>
            Next run at
            <input
              value={createForm.nextRunAt}
              onChange={(event) => setCreateForm((current) => ({ ...current, nextRunAt: event.target.value }))}
              placeholder="2026-04-23T10:30:00Z"
            />
          </label>
        </div>
        <div className="fg-actions">
          <button type="button" className="ff-btn-secondary ff-btn-sm" onClick={() => setShowCreateAdvancedSchedule((current) => !current)}>
            {showCreateAdvancedSchedule ? "Hide advanced fields" : "Show advanced fields"}
          </button>
        </div>
        {showCreateAdvancedSchedule ? (
          <>
            <label>
              Advanced raw cadence minutes
              <input
                value={createForm.cadenceMinutes}
                onChange={(event) => setCreateForm((current) => ({ ...current, cadenceMinutes: event.target.value }))}
              />
            </label>
            <label>
              Metadata JSON
              <textarea
                rows={6}
                value={createForm.metadataJson}
                onChange={(event) => setCreateForm((current) => ({ ...current, metadataJson: event.target.value }))}
              />
            </label>
          </>
        ) : null}
      </section>

      <div className="fg-grid fg-grid-compact">
        <label>
          Target task ID
          <input
            value={createForm.targetTaskId}
            onChange={(event) => setCreateForm((current) => ({ ...current, targetTaskId: event.target.value }))}
          />
        </label>
        <label>
          Target conversation ID
          <input
            value={createForm.targetConversationId}
            onChange={(event) => setCreateForm((current) => ({ ...current, targetConversationId: event.target.value }))}
          />
        </label>
        <label>
          Target inbox ID
          <input
            value={createForm.targetInboxId}
            onChange={(event) => setCreateForm((current) => ({ ...current, targetInboxId: event.target.value }))}
          />
        </label>
      </div>
      <div className="fg-grid fg-grid-compact">
        <label>
          Target workspace ID
          <input
            value={createForm.targetWorkspaceId}
            onChange={(event) => setCreateForm((current) => ({ ...current, targetWorkspaceId: event.target.value }))}
          />
        </label>
        <label>
          Channel ID
          <input
            value={createForm.channelId}
            onChange={(event) => setCreateForm((current) => ({ ...current, channelId: event.target.value }))}
          />
        </label>
        <label>
          Fallback channel ID
          <input
            value={createForm.fallbackChannelId}
            onChange={(event) => setCreateForm((current) => ({ ...current, fallbackChannelId: event.target.value }))}
          />
        </label>
      </div>
      <div className="fg-grid fg-grid-compact">
        <label>
          Preview required
          <select
            value={createForm.previewRequired}
            onChange={(event) => setCreateForm((current) => ({ ...current, previewRequired: event.target.value as "yes" | "no" }))}
          >
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </label>
        <label>
          Task template title
          <input
            value={createForm.taskTemplateTitle}
            onChange={(event) => setCreateForm((current) => ({ ...current, taskTemplateTitle: event.target.value }))}
          />
        </label>
        <label>
          Notification title
          <input
            value={createForm.notificationTitle}
            onChange={(event) => setCreateForm((current) => ({ ...current, notificationTitle: event.target.value }))}
          />
        </label>
      </div>
      <label>
        Task template summary
        <textarea
          rows={3}
          value={createForm.taskTemplateSummary}
          onChange={(event) => setCreateForm((current) => ({ ...current, taskTemplateSummary: event.target.value }))}
        />
      </label>
      <label>
        Notification body
        <textarea
          rows={3}
          value={createForm.notificationBody}
          onChange={(event) => setCreateForm((current) => ({ ...current, notificationBody: event.target.value }))}
        />
      </label>
      <div className="fg-actions">
        <Button
          variant="primary"
          type="submit"
          isDisabled={!canMutate || savingCreate || !instanceId || !createForm.title.trim() || !createForm.nextRunAt.trim()}
        >
          {savingCreate ? "Creating automation" : "Create automation"}
        </Button>
      </div>
    </form>
  );
}
