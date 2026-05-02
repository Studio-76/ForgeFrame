import type { FormEvent } from "react";

import type { AgentSummary, SkillSummary } from "../../api/domain";
import type { LoadState } from "../../pages/workInteractionPageSupport";
import { SCOPE_OPTIONS, STATUS_OPTIONS } from "./types";
import {
  formatTimestamp,
  outcomeLabel,
  outcomeTone,
  statusTone,
} from "./utils";

/**
 * Props for the SkillList component.
 */
export interface SkillListProps {
  /** Available instances for the instance selector. */
  instances: Array<{ instance_id: string; display_name: string }>;
  /** Currently selected instance ID. */
  instanceId: string;
  /** Loaded skill summaries matching the current filters. */
  skills: SkillSummary[];
  /** Available agents for reference in filter display (not used directly in filters). */
  agents: AgentSummary[];
  /** Current status filter value. */
  statusFilter: string;
  /** Current scope filter value. */
  scopeFilter: string;
  /** Load state for the skills list fetch. */
  listState: LoadState;
  /** Load state for the instances fetch. */
  instancesState: LoadState;
  /** Load state for the skill detail fetch (shown in combined status pill). */
  detailState: LoadState;
  /** Whether the current user can mutate skills. */
  canMutate: boolean;
  /** Update URL search params (used for filter selects and row selection). */
  updateRoute: (mutate: (next: URLSearchParams) => void) => void;
  /**
   * Optional setter for status filter (used if external form state management is preferred
   * over direct URL updates).
   */
  setStatusFilter?: (value: string) => void;
  /**
   * Optional setter for scope filter (used if external form state management is preferred
   * over direct URL updates).
   */
  setScopeFilter?: (value: string) => void;
}

/**
 * Filter bar and skill registry table (left panel) for the Skills page.
 *
 * Renders the instance/status/scope filter controls with a combined load-state pill,
 * followed by the skill registry table with columns for Name, Version, Status/Approval,
 * Scope, Active in scope, Last used, and Outcome.
 */
export function SkillList({
  instances,
  instanceId,
  skills,
  statusFilter,
  scopeFilter,
  listState,
  instancesState,
  detailState,
  updateRoute,
}: SkillListProps) {
  return (
    <>
      {/* ── Filter bar ── */}
      <article className="fg-card">
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              value={instanceId}
              onChange={(event) =>
                updateRoute((next) => {
                  next.set("instanceId", event.target.value);
                  next.delete("skillId");
                })
              }
            >
              {instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) =>
                updateRoute((next) => {
                  const value = event.target.value;
                  if (value === "all") next.delete("status");
                  else next.set("status", value);
                })
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scope
            <select
              value={scopeFilter}
              onChange={(event) =>
                updateRoute((next) => {
                  const value = event.target.value;
                  if (value === "all") next.delete("scope");
                  else next.set("scope", value);
                })
              }
            >
              {SCOPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <span
            className="fg-pill"
            data-tone={
              instancesState === "success" && listState === "success"
                ? "success"
                : listState === "error" || detailState === "error"
                  ? "danger"
                  : "neutral"
            }
          >
            {instancesState}/{listState}/{detailState}
          </span>
        </div>
      </article>

      {/* ── Skill registry table ── */}
      <article className="fg-card">
        <div className="fg-section-heading">
          <div>
            <h3>Skill registry</h3>
            <p className="fg-muted">
              Version, approval, scope, activation, and recent outcomes.
            </p>
          </div>
          <span
            className="fg-pill"
            data-tone={
              listState === "success"
                ? "success"
                : listState === "error"
                  ? "danger"
                  : "neutral"
            }
          >
            {listState}
          </span>
        </div>

        {skills.length === 0 ? (
          <p className="fg-muted">No skills match this scope and filter.</p>
        ) : (
          <div className="fg-table-wrap">
            <table className="fg-table" aria-label="Skill registry">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Version</th>
                  <th>Status / Approval</th>
                  <th>Scope</th>
                  <th>Active in scope</th>
                  <th>Last used</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((skill) => (
                  <tr key={skill.skill_id}>
                    <td>
                      <button
                        type="button"
                        className="fg-table-trigger"
                        onClick={() =>
                          updateRoute((next) =>
                            next.set("skillId", skill.skill_id),
                          )
                        }
                      >
                        {skill.display_name}
                      </button>
                      <div className="fg-muted">
                        {skill.provenance_summary.label}
                      </div>
                    </td>
                    <td>
                      <div>v{skill.current_version_number}</div>
                      <div className="fg-muted">
                        {formatTimestamp(skill.updated_at)}
                      </div>
                    </td>
                    <td>
                      <span className="fg-pill" data-tone={statusTone(skill.status)}>
                        {skill.status}
                      </span>
                      <div className="fg-muted">{skill.approval.label}</div>
                    </td>
                    <td>
                      <div>{skill.scope_label}</div>
                      <div className="fg-muted">
                        {skill.active_activation_count} active
                      </div>
                    </td>
                    <td>
                      <div>{skill.active_scope_labels[0] ?? "No active scope"}</div>
                      <div className="fg-muted">
                        {skill.active_scope_labels.slice(1).join(" \u00b7") ||
                          "No additional activations."}
                      </div>
                    </td>
                    <td>
                      <div>{formatTimestamp(skill.last_used_at, "Never used")}</div>
                      <div className="fg-muted">
                        {skill.telemetry_summary.usage_count} recorded uses
                      </div>
                    </td>
                    <td>
                      <span
                        className="fg-pill"
                        data-tone={outcomeTone(skill.last_outcome)}
                      >
                        {outcomeLabel(skill.last_outcome)}
                      </span>
                      <div className="fg-muted">
                        {skill.telemetry_summary.success_count} success /{" "}
                        {skill.telemetry_summary.blocked_count} blocked /{" "}
                        {skill.telemetry_summary.error_count} error
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  );
}
