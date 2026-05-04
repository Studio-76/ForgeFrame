/**
 * WorkspaceCreateForm — create/edit workspace form rendered inside the detail drawer.
 *
 * @packageDocumentation
 */

import type {
  CreateWorkspaceForm,
  EditWorkspaceForm,
  DrawerMode,
} from "../types";

/**
 * Props for the WorkspaceCreateForm component.
 */
export type WorkspaceCreateFormProps = {
  /** Current drawer mode. */
  drawerMode: DrawerMode;
  /** Create form state. */
  createForm: CreateWorkspaceForm;
  /** Edit form state. */
  editForm: EditWorkspaceForm;
  /** Called with an updater function to mutate create form. */
  onCreateFormChange: (updater: (current: CreateWorkspaceForm) => CreateWorkspaceForm) => void;
  /** Called with an updater function to mutate edit form. */
  onEditFormChange: (updater: (current: EditWorkspaceForm) => EditWorkspaceForm) => void;
};

/**
 * Workspace create/edit form rendered inside the detail drawer.
 */
export function WorkspaceCreateForm({
  drawerMode,
  createForm,
  editForm,
  onCreateFormChange,
  onEditFormChange,
}: WorkspaceCreateFormProps) {
  const isCreate = drawerMode === "create";

  const getValue = <T,>(createValue: T, editValue: T): T =>
    isCreate ? createValue : editValue;

  const setValue = (
    createField: keyof CreateWorkspaceForm,
    editField: keyof EditWorkspaceForm,
    value: string,
  ) => {
    if (isCreate) {
      onCreateFormChange((c) => ({ ...c, [createField]: value }));
    } else {
      onEditFormChange((c) => ({ ...c, [editField]: value }));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Workspace ID (create only) */}
      {isCreate ? (
        <label className="flex flex-col gap-1">
          <span className="text-meta text-muted">Workspace ID</span>
          <input
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
            value={createForm.workspaceId}
            onChange={(event) => onCreateFormChange((c) => ({ ...c, workspaceId: event.target.value }))}
            placeholder="ws_customer_pricing"
          />
        </label>
      ) : null}

      {/* Title */}
      <label className="flex flex-col gap-1">
        <span className="text-meta text-muted">Title</span>
        <input
          className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
          value={getValue(createForm.title, editForm.title)}
          onChange={(event) => setValue("title", "title", event.target.value)}
          placeholder="Customer pricing handoff"
        />
      </label>

      {/* Summary */}
      <label className="flex flex-col gap-1">
        <span className="text-meta text-muted">Summary</span>
        <textarea
          className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
          rows={4}
          value={getValue(createForm.summary, editForm.summary)}
          onChange={(event) => setValue("summary", "summary", event.target.value)}
        />
      </label>

      {/* Issue + Owner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-meta text-muted">Issue ID</span>
          <input
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
            value={getValue(createForm.issueId, editForm.issueId)}
            onChange={(event) => setValue("issueId", "issueId", event.target.value)}
            placeholder="FOR-178"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-meta text-muted">Owner ID</span>
          <input
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
            value={getValue(createForm.ownerId, editForm.ownerId)}
            onChange={(event) => setValue("ownerId", "ownerId", event.target.value)}
            placeholder="user-admin"
          />
        </label>
      </div>

      {/* Lifecycle controls */}
      <section className="border border-border rounded-lg p-3">
        <h4 className="text-body font-semibold mb-2">Lifecycle controls</h4>
        {isCreate ? (
          <p className="text-meta text-muted">
            New workspaces start in preview draft, review not requested, and handoff not ready.
            Move lifecycle state from the detail panel only after evidence exists.
          </p>
        ) : (
          <ul className="text-meta text-muted space-y-1">
            <li>Preview: {editForm.previewStatus}</li>
            <li>Review: {editForm.reviewStatus}</li>
            <li>Handoff: {editForm.handoffStatus}</li>
          </ul>
        )}
      </section>

      {/* Run + Approval */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-meta text-muted">Active run ID</span>
          <input
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
            value={getValue(createForm.activeRunId, editForm.activeRunId)}
            onChange={(event) => setValue("activeRunId", "activeRunId", event.target.value)}
            placeholder="run_alpha"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-meta text-muted">Latest approval ID</span>
          <input
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
            value={getValue(createForm.latestApprovalId, editForm.latestApprovalId)}
            onChange={(event) => setValue("latestApprovalId", "latestApprovalId", event.target.value)}
            placeholder="run:instance_alpha:company_alpha:approval-1"
          />
        </label>
      </div>

      {/* PR + Handoff reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-meta text-muted">PR reference</span>
          <input
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
            value={getValue(createForm.prReference, editForm.prReference)}
            onChange={(event) => setValue("prReference", "prReference", event.target.value)}
            placeholder="https://github.com/org/repo/pull/123"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-meta text-muted">Handoff reference</span>
          <input
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
            value={getValue(createForm.handoffReference, editForm.handoffReference)}
            onChange={(event) => setValue("handoffReference", "handoffReference", event.target.value)}
            placeholder="handoff://package/123"
          />
        </label>
      </div>

      {/* Metadata JSON */}
      <label className="flex flex-col gap-1">
        <span className="text-meta text-muted">Metadata JSON</span>
        <textarea
          className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary font-mono"
          rows={6}
          value={getValue(createForm.metadataJson, editForm.metadataJson)}
          onChange={(event) => setValue("metadataJson", "metadataJson", event.target.value)}
        />
      </label>

      {/* Event note (edit only) */}
      {!isCreate ? (
        <label className="flex flex-col gap-1">
          <span className="text-meta text-muted">Event note</span>
          <textarea
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
            rows={3}
            value={editForm.eventNote}
            onChange={(event) => onEditFormChange((c) => ({ ...c, eventNote: event.target.value }))}
          />
        </label>
      ) : null}
    </div>
  );
}
