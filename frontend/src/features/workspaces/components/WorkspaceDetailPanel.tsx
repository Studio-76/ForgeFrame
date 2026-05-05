/**
 * WorkspaceDetailPanel — full detail view of a selected workspace.
 *
 * @packageDocumentation
 */

import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import type { WorkspaceDetail } from "../../../api/domain/workspaces";
import { Button } from "../../../components/ui/Button";
import { DetailPanel } from "../../../components/ui/DetailPanel";
import {
  buildConversationPath,
  buildTaskPath,
  buildArtifactsPath,
} from "../../../app/workInteractionRoutes";
import {
  buildExecutionRoute,
  buildApprovalRoute,
  statusTone,
  actionTone,
  formatTimestamp,
  getWorkspaceAction,
} from "../helpers";
import type { WorkspaceAction } from "../types";

/**
 * Props for the WorkspaceDetailPanel component.
 */
export type WorkspaceDetailPanelProps = {
  /** The workspace detail. */
  detail: WorkspaceDetail;
  /** Instance ID for link building. */
  instanceId: string;
  /** Whether mutation actions are permitted. */
  canMutate: boolean;
  /** Whether a primary action is running. */
  runningPrimaryAction: boolean;
  /** Called to execute the primary workspace action. */
  onPrimaryAction: () => void;
};

/**
 * Detail panel showing all workspace information.
 */
export function WorkspaceDetailPanel({
  detail,
  instanceId,
  canMutate,
  runningPrimaryAction,
  onPrimaryAction,
}: WorkspaceDetailPanelProps) {
  const navigate = useNavigate();
  const primaryAction: WorkspaceAction | null = detail ? getWorkspaceAction(detail) : null;

  const handoffHistory = (detail.events ?? []).filter((event) => (
    event.event_kind === "review_requested"
    || event.event_kind === "review_approved"
    || event.event_kind === "review_rejected"
    || event.event_kind === "handoff_prepared"
    || event.event_kind === "handoff_delivered"
  ));

  return (
    <DetailPanel
      title={detail.title}
      description={detail.workspace_id}
      status={detail.status}
      statusTone={statusTone(detail.status)}
      statusKey={detail.status}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="navigation"
            onPress={() => navigate(
              buildArtifactsPath({ instanceId, workspaceId: detail.workspace_id }),
            )}
          >
            Workspace artifacts
          </Button>
          {detail.active_run_id ? (
            <Button
              variant="navigation"
              onPress={() => navigate(
                buildExecutionRoute(instanceId, detail.active_run_id!),
              )}
            >
              Execution evidence
            </Button>
          ) : null}
          {detail.latest_approval_id ? (
            <Button
              variant="navigation"
              onPress={() => navigate(
                buildApprovalRoute(instanceId, detail.latest_approval_id!),
              )}
            >
              Approval gate
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Next action */}
        {primaryAction ? (
          <section className="border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-body font-semibold">Next action</h4>
              <span className="ff-pill" data-tone={actionTone(primaryAction.state)}>
                {primaryAction.state}
              </span>
            </div>
            <p className="text-body font-medium">{primaryAction.label}</p>
            <p className={`text-meta mt-1 ${primaryAction.state === "not_ready" ? "text-danger" : "text-muted"}`}>
              {primaryAction.reason}
            </p>
            {primaryAction.state === "available" ? (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="primary"
                  isDisabled={!canMutate || runningPrimaryAction}
                  onPress={onPrimaryAction}
                >
                  {runningPrimaryAction ? `${primaryAction.label}...` : primaryAction.label}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Context */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Context</h4>
          <ul className="text-meta text-muted space-y-1">
            <li>Workspace ID: <span className="font-mono text-primary">{detail.workspace_id}</span></li>
            <li>Issue link: {detail.issue_id ?? "Not linked"}</li>
            <li>Owner: {detail.owner_id ?? "Not recorded"}</li>
            <li>Conversation count: {detail.conversation_count ?? detail.conversations?.length ?? 0}</li>
            <li>Task count: {detail.task_count ?? detail.tasks?.length ?? 0}</li>
            <li>Last activity: {formatTimestamp(detail.last_activity_at ?? detail.latest_event_at ?? detail.updated_at)}</li>
          </ul>
          <p className="text-meta text-muted mt-2">{detail.summary || "No workspace summary was recorded."}</p>
        </section>

        {/* Lifecycle */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Lifecycle</h4>
          <ul className="text-meta text-muted space-y-1">
            <li>Status: {detail.status}</li>
            <li>Preview: {detail.preview_status}</li>
            <li>Review: {detail.review_status}</li>
            <li>Handoff: {detail.handoff_status}</li>
            <li>Preview artifact: {detail.preview_artifact_id ?? "None"}</li>
            <li>Handoff artifact: {detail.handoff_artifact_id ?? "None"}</li>
          </ul>
        </section>

        {/* Handoff target */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Handoff target</h4>
          <ul className="text-meta text-muted space-y-1">
            <li>PR reference: {detail.pr_reference ?? "Not linked"}</li>
            <li>Handoff reference: {detail.handoff_reference ?? "Not linked"}</li>
            <li>Active run: {detail.active_run_id ?? "None"}</li>
            <li>Latest approval: {detail.latest_approval_id ?? "None"}</li>
          </ul>
          <p className="text-meta text-muted mt-2">The workspace records handoff readiness and operating evidence. Delivery itself still happens in the external target system.</p>
        </section>

        {/* Conversations */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Conversations</h4>
          {(detail.conversations ?? []).length === 0 ? (
            <p className="text-meta text-muted">No conversations are linked to this workspace.</p>
          ) : (
            <ul className="text-meta text-muted space-y-1">
              {(detail.conversations ?? []).map((conversation) => (
                <li key={conversation.conversation_id}>
                  <Button
                    variant="navigation"
                    density="compact"
                    onPress={() => navigate(
                      buildConversationPath({ instanceId, conversationId: conversation.conversation_id }),
                    )}
                  >
                    {conversation.subject}
                  </Button>
                  {" | "}{conversation.status}{" | "}{conversation.triage_status}{" | "}{conversation.priority}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tasks */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Tasks</h4>
          {(detail.tasks ?? []).length === 0 ? (
            <p className="text-meta text-muted">No tasks are linked to this workspace.</p>
          ) : (
            <ul className="text-meta text-muted space-y-1">
              {(detail.tasks ?? []).map((task) => (
                <li key={task.task_id}>
                  <Button
                    variant="navigation"
                    density="compact"
                    onPress={() => navigate(
                      buildTaskPath({ instanceId, taskId: task.task_id }),
                    )}
                  >
                    {task.title}
                  </Button>
                  {" | "}{task.status}{" | "}{task.priority}{" | due "}{formatTimestamp(task.due_at)}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Runs */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Runs</h4>
          {detail.runs.length === 0 ? (
            <p className="text-meta text-muted">No runs are linked to this workspace.</p>
          ) : (
            <ul className="text-meta text-muted space-y-1">
              {detail.runs.map((run) => (
                <li key={run.run_id}>
                  <Button
                    variant="navigation"
                    density="compact"
                    onPress={() => navigate(
                      buildExecutionRoute(instanceId, run.run_id, run.state),
                    )}
                  >
                    {run.run_id}
                  </Button>
                  {" | "}{run.run_kind}{" | "}{run.state}{" | "}{run.execution_lane}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Approvals */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Approvals</h4>
          {detail.approvals.length === 0 ? (
            <p className="text-meta text-muted">No approvals are linked to this workspace.</p>
          ) : (
            <ul className="text-meta text-muted space-y-1">
              {detail.approvals.map((approval) => (
                <li key={approval.shared_approval_id}>
                  <Button
                    variant="navigation"
                    density="compact"
                    onPress={() => navigate(
                      buildApprovalRoute(instanceId, approval.shared_approval_id),
                    )}
                  >
                    {approval.shared_approval_id}
                  </Button>
                  {" | "}{approval.gate_status}{" | "}{approval.gate_key}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Artifacts */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Artifacts</h4>
          {detail.artifacts.length === 0 ? (
            <p className="text-meta text-muted">No artifacts are linked to this workspace.</p>
          ) : (
            <ul className="text-meta text-muted space-y-1">
              {detail.artifacts.map((artifact) => (
                <li key={artifact.artifact_id}>
                  <Button
                    variant="navigation"
                    density="compact"
                    onPress={() => navigate(
                      buildArtifactsPath({ instanceId, artifactId: artifact.artifact_id }),
                    )}
                  >
                    {artifact.label}
                  </Button>
                  {" | "}{artifact.artifact_type}{" | "}{artifact.status}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Handoff history */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Handoff history</h4>
          {handoffHistory.length === 0 ? (
            <p className="text-meta text-muted">No review or handoff transitions were recorded yet.</p>
          ) : (
            <ul className="text-meta text-muted space-y-1">
              {handoffHistory.map((event) => (
                <li key={event.event_id}>
                  {event.event_kind} | {formatTimestamp(event.created_at)} | {event.note ?? "No note"}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* All events */}
        <section className="border border-border rounded-lg p-3">
          <h4 className="text-body font-semibold mb-2">Workspace events</h4>
          {detail.events.length === 0 ? (
            <p className="text-meta text-muted">No workspace events were recorded.</p>
          ) : (
            <ul className="text-meta text-muted space-y-1">
              {detail.events.map((event) => (
                <li key={event.event_id}>
                  {event.event_kind} | {formatTimestamp(event.created_at)} | {event.note ?? "No note"}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DetailPanel>
  );
}
