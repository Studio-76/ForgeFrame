/**
 * TaskTable — task inventory list component.
 *
 * Renders the filter controls and task table for the active instance scope.
 *
 * @packageDocumentation
 */

import type { TaskSummary, TaskStatus } from "../../../api/domain/tasks";
import type { LoadState } from "../../../pages/workInteractionPageSupport";
import { Button } from "../../../components/ui/Button";
import { STATUS_OPTIONS } from "../types";
import { taskStatusTone, taskQueuePosture, ownerLabel, linkedContextLabel } from "../helpers";

/**
 * Props for TaskTable.
 */
export type TaskTableProps = {
  /** Current task list state. */
  listState: LoadState;
  /** Currently loaded tasks. */
  tasks: TaskSummary[];
  /** Currently selected task ID (from URL params). */
  selectedTaskId: string;
  /** Current instance ID for scope. */
  instanceId: string;
  /** Current status filter value. */
  statusFilter: TaskStatus | "all";
  /** Instances available for scope selection. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Instances load state. */
  instancesState: LoadState;
  /** Whether mutations are allowed. */
  canMutate: boolean;
  /**
   * Callback to update route params.
   * Receives a mutate callback that modifies URLSearchParams.
   */
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
  /** Callback to open the create drawer. */
  onOpenCreate: () => void;
  /** Callback to select a task by ID. */
  onSelectTask: (taskId: string) => void;
};

/**
 * Task inventory table with instance scope and status filters.
 */
export function TaskTable({
  listState,
  tasks,
  selectedTaskId,
  instanceId,
  statusFilter,
  instances,
  instancesState,
  canMutate,
  updateRoute,
  onOpenCreate,
  onSelectTask,
}: TaskTableProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Scope and filter</h3>
          <p className="fg-muted">Pick an instance, then filter by backend task status. `blocked` includes waiting cases.</p>
        </div>
        <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>
          {instancesState}
        </span>
      </div>
      <div className="fg-inline-form">
        <label>
          Instance
          <select
            aria-label="Task instance"
            value={instanceId}
            onChange={(event) => updateRoute((next) => {
              next.set("instanceId", event.target.value);
              next.delete("taskId");
            })}
          >
            {instances.map((inst) => (
              <option key={inst.instance_id} value={inst.instance_id}>
                {inst.display_name} ({inst.instance_id})
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Task status filter"
            value={statusFilter}
            onChange={(event) => updateRoute((next) => {
              const nextValue = event.target.value;
              if (nextValue === "all") {
                next.delete("status");
              } else {
                next.set("status", nextValue);
              }
              next.delete("taskId");
            })}
          >
            {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div className="fg-panel-heading">
        <div>
          <h3>Task inventory</h3>
          <p className="fg-muted">State, owner, due date, priority, and linked context.</p>
        </div>
        <div className="fg-actions">
          <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          <Button variant="secondary" isDisabled={!canMutate} onPress={onOpenCreate}>
            New task
          </Button>
        </div>
      </div>

      {listState === "loading" ? <p className="fg-muted">Loading task inventory.</p> : null}
      {listState === "success" && tasks.length === 0 ? <p className="fg-muted">No tasks match this filter.</p> : null}

      {tasks.length > 0 ? (
        <div className="fg-table-wrap">
          <table className="fg-table" aria-label="Task inventory">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Linked context</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.task_id} className={task.task_id === selectedTaskId ? "is-selected" : undefined}>
                  <td>
                    <Button
                      className="fg-table-trigger"
                      variant="navigation"
                      onPress={() => onSelectTask(task.task_id)}
                    >
                      {task.title}
                    </Button>
                    <div className="fg-muted">{task.task_id} · {task.task_kind}</div>
                  </td>
                  <td>
                    <span className="fg-pill" data-tone={taskStatusTone(task.status)}>{task.status}</span>
                    <div className="fg-muted">{taskQueuePosture(task.status)}</div>
                  </td>
                  <td>{ownerLabel(task.owner_id)}</td>
                  <td>{task.due_at ?? "Unscheduled"}</td>
                  <td>{task.priority}</td>
                  <td>{linkedContextLabel(task)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
