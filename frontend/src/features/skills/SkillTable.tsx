/**
 * Skills registry table — compact list of skills with lifecycle state.
 *
 * Shows name, version, status, scope, last used, and outcome for each skill.
 * Clicking a row selects the skill for detail inspection.
 *
 * @packageDocumentation
 */

import type { SkillSummary } from "../../api/domain";
import type { LoadState } from "../../pages/workInteractionPageSupport";
import { formatTimestamp, outcomeLabel, outcomeTone, statusLabel, statusTone } from "./utils";

/** Props for SkillTable. */
export interface SkillTableProps {
  /** Loaded skill summaries matching the current filters. */
  skills: SkillSummary[];
  /** Currently selected skill ID (highlighted in the table). */
  selectedSkillId: string;
  /** Load state for the skills list. */
  listState: LoadState;
  /** Update URL search params. */
  updateRoute: (mutate: (next: URLSearchParams) => void) => void;
}

/**
 * Registry table listing all skills with lifecycle state at a glance.
 */
export function SkillTable({
  skills,
  selectedSkillId,
  listState,
  updateRoute,
}: SkillTableProps) {
  if (listState === "loading") {
    return (
      <div className="ff-skills-table-container">
        <p className="ff-skills-table-status">Loading skills\u2026</p>
      </div>
    );
  }

  if (listState === "error") {
    return (
      <div className="ff-skills-table-container">
        <p className="ff-skills-table-status ff-skills-table-status-error">
          Failed to load skills. Try adjusting filters.
        </p>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="ff-skills-table-container">
        <p className="ff-skills-table-status">No skills match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="ff-skills-table-container">
      <table className="ff-skills-table" aria-label="Skill registry">
        <thead>
          <tr>
            <th>Name</th>
            <th>Version</th>
            <th>Status</th>
            <th>Scope</th>
            <th>Last used</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => (
            <tr
              key={skill.skill_id}
              className={skill.skill_id === selectedSkillId ? "ff-skills-table-row-selected" : ""}
            >
              <td>
                <button
                  type="button"
                  className="ff-skills-table-trigger"
                  onClick={() =>
                    updateRoute((next) =>
                      next.set("skillId", skill.skill_id),
                    )
                  }
                >
                  {skill.display_name}
                </button>
                <div className="ff-skills-table-meta">
                  {skill.provenance_summary.label}
                </div>
              </td>
              <td>
                <div>v{skill.current_version_number}</div>
                <div className="ff-skills-table-meta">
                  {formatTimestamp(skill.updated_at)}
                </div>
              </td>
              <td>
                <span className="ff-skills-pill" data-tone={statusTone(skill.status)}>
                  {statusLabel(skill.status)}
                </span>
                <div className="ff-skills-table-meta">{skill.approval.label}</div>
              </td>
              <td>
                <div>{skill.scope_label}</div>
                <div className="ff-skills-table-meta">
                  {skill.active_activation_count} activation{skill.active_activation_count === 1 ? "" : "s"}
                </div>
              </td>
              <td>
                <div>{formatTimestamp(skill.last_used_at, "Never used")}</div>
                <div className="ff-skills-table-meta">
                  {skill.telemetry_summary.usage_count} use{skill.telemetry_summary.usage_count === 1 ? "" : "s"}
                </div>
              </td>
              <td>
                <span
                  className="ff-skills-pill"
                  data-tone={outcomeTone(skill.last_outcome)}
                >
                  {outcomeLabel(skill.last_outcome)}
                </span>
                <div className="ff-skills-table-meta">
                  {skill.telemetry_summary.success_count} ok /{" "}
                  {skill.telemetry_summary.blocked_count} blocked /{" "}
                  {skill.telemetry_summary.error_count} err
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
