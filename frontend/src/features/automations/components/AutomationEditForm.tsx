/**
 * Automation edit form — update cadence, targets, and preview posture.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import type { AutomationStatus } from "../../../api/domain/automations";
import { Button } from "../../../components/ui/Button";
import type { AutomationEditForm, ScheduleUnit } from "../types";
import { STATUS_OPTIONS } from "../types";
import { cadenceToStructured, structuredToCadence } from "../helpers";

/** Props for AutomationEditForm. */
export interface AutomationEditFormProps {
  /** Edit form state. */
  editForm: AutomationEditForm;
  /** Edit form setter. */
  setEditForm: React.Dispatch<React.SetStateAction<AutomationEditForm>>;
  /** Whether the save is in progress. */
  savingUpdate: boolean;
  /** Whether the user can mutate. */
  canMutate: boolean;
  /** Whether a detail is currently selected. */
  hasDetail: boolean;
  /** The selected detail's automation ID, for display. */
  detailAutomationId: string;
  /** Whether advanced schedule fields are shown. */
  showEditAdvancedSchedule: boolean;
  /** Toggle advanced schedule fields. */
  setShowEditAdvancedSchedule: React.Dispatch<React.SetStateAction<boolean>>;
  /** Submit handler. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Edit automation form with structured schedule editor and status controls.
 */
export function AutomationEditForm({
  editForm,
  setEditForm,
  savingUpdate,
  canMutate,
  hasDetail,
  detailAutomationId,
  showEditAdvancedSchedule,
  setShowEditAdvancedSchedule,
  onSubmit,
}: AutomationEditFormProps) {
  const editSchedule = cadenceToStructured(editForm.cadenceMinutes);

  if (!hasDetail) {
    return <p className="text-meta text-muted px-1 py-3">Select an automation before attempting a mutation.</p>;
  }

  return (
    <form className="fg-stack" onSubmit={onSubmit}>
      <label>
        Title
        <input
          value={editForm.title}
          onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>
      <label>
        Summary
        <textarea
          rows={3}
          value={editForm.summary}
          onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))}
        />
      </label>
      <div className="fg-grid fg-grid-compact">
        <label>
          Status
          <select
            value={editForm.status}
            onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as AutomationStatus }))}
          >
            {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <section className="fg-subcard">
        <h4>Schedule editor</h4>
        <div className="fg-grid fg-grid-compact">
          <label>
            Every
            <input
              value={editSchedule.every}
              onChange={(event) => setEditForm((current) => ({
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
              value={editSchedule.unit}
              onChange={(event) => setEditForm((current) => ({
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
              value={editForm.nextRunAt}
              onChange={(event) => setEditForm((current) => ({ ...current, nextRunAt: event.target.value }))}
            />
          </label>
        </div>
        <div className="fg-actions">
          <button type="button" className="ff-btn-secondary ff-btn-sm" onClick={() => setShowEditAdvancedSchedule((current) => !current)}>
            {showEditAdvancedSchedule ? "Hide advanced fields" : "Show advanced fields"}
          </button>
        </div>
        {showEditAdvancedSchedule ? (
          <>
            <label>
              Advanced raw cadence minutes
              <input
                value={editForm.cadenceMinutes}
                onChange={(event) => setEditForm((current) => ({ ...current, cadenceMinutes: event.target.value }))}
              />
            </label>
            <label>
              Metadata JSON
              <textarea
                rows={6}
                value={editForm.metadataJson}
                onChange={(event) => setEditForm((current) => ({ ...current, metadataJson: event.target.value }))}
              />
            </label>
          </>
        ) : null}
      </section>
      <div className="fg-grid fg-grid-compact">
        <label>
          Target task ID
          <input
            value={editForm.targetTaskId}
            onChange={(event) => setEditForm((current) => ({ ...current, targetTaskId: event.target.value }))}
          />
        </label>
        <label>
          Target conversation ID
          <input
            value={editForm.targetConversationId}
            onChange={(event) => setEditForm((current) => ({ ...current, targetConversationId: event.target.value }))}
          />
        </label>
        <label>
          Target inbox ID
          <input
            value={editForm.targetInboxId}
            onChange={(event) => setEditForm((current) => ({ ...current, targetInboxId: event.target.value }))}
          />
        </label>
      </div>
      <div className="fg-grid fg-grid-compact">
        <label>
          Target workspace ID
          <input
            value={editForm.targetWorkspaceId}
            onChange={(event) => setEditForm((current) => ({ ...current, targetWorkspaceId: event.target.value }))}
          />
        </label>
        <label>
          Channel ID
          <input
            value={editForm.channelId}
            onChange={(event) => setEditForm((current) => ({ ...current, channelId: event.target.value }))}
          />
        </label>
        <label>
          Fallback channel ID
          <input
            value={editForm.fallbackChannelId}
            onChange={(event) => setEditForm((current) => ({ ...current, fallbackChannelId: event.target.value }))}
          />
        </label>
      </div>
      <div className="fg-grid fg-grid-compact">
        <label>
          Preview required
          <select
            value={editForm.previewRequired}
            onChange={(event) => setEditForm((current) => ({ ...current, previewRequired: event.target.value as "yes" | "no" }))}
          >
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </label>
        <label>
          Task template title
          <input
            value={editForm.taskTemplateTitle}
            onChange={(event) => setEditForm((current) => ({ ...current, taskTemplateTitle: event.target.value }))}
          />
        </label>
        <label>
          Notification title
          <input
            value={editForm.notificationTitle}
            onChange={(event) => setEditForm((current) => ({ ...current, notificationTitle: event.target.value }))}
          />
        </label>
      </div>
      <label>
        Task template summary
        <textarea
          rows={3}
          value={editForm.taskTemplateSummary}
          onChange={(event) => setEditForm((current) => ({ ...current, taskTemplateSummary: event.target.value }))}
        />
      </label>
      <label>
        Notification body
        <textarea
          rows={3}
          value={editForm.notificationBody}
          onChange={(event) => setEditForm((current) => ({ ...current, notificationBody: event.target.value }))}
        />
      </label>
      <div className="fg-actions">
        <Button variant="primary" type="submit" isDisabled={!canMutate || savingUpdate}>
          {savingUpdate ? "Saving automation" : "Save automation"}
        </Button>
      </div>
    </form>
  );
}
