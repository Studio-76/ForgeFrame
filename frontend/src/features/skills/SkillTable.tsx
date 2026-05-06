/**
 * Skills registry table — compact list of skills with lifecycle state.
 *
 * Shows name, version, status, scope, last used, and outcome for each skill.
 * Clicking a row selects the skill for detail inspection.
 *
 * @packageDocumentation
 */

import { StatusBadge } from "../../components/ui";
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
      <div className="overflow-x-auto">
        <p className="p-4 text-muted text-meta">Loading skills\u2026</p>
      </div>
    );
  }

  if (listState === "error") {
    return (
      <div className="overflow-x-auto">
        <p className="p-4 text-muted text-meta text-danger">
          Failed to load skills. Try adjusting filters.
        </p>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="overflow-x-auto">
        <p className="p-4 text-muted text-meta">No skills match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-body" aria-label="Skill registry">
        <thead>
          <tr className="border-b border-border">
            <th className="p-2 text-left text-meta font-bold uppercase tracking-wider text-muted whitespace-nowrap">Name</th>
            <th className="p-2 text-left text-meta font-bold uppercase tracking-wider text-muted whitespace-nowrap">Version</th>
            <th className="p-2 text-left text-meta font-bold uppercase tracking-wider text-muted whitespace-nowrap">Status</th>
            <th className="p-2 text-left text-meta font-bold uppercase tracking-wider text-muted whitespace-nowrap">Scope</th>
            <th className="p-2 text-left text-meta font-bold uppercase tracking-wider text-muted whitespace-nowrap">Last used</th>
            <th className="p-2 text-left text-meta font-bold uppercase tracking-wider text-muted whitespace-nowrap">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => (
            <tr
              key={skill.skill_id}
              className={`cursor-pointer transition-colors duration-100 hover:bg-accent/5 ${
                skill.skill_id === selectedSkillId
                  ? "bg-accent/10 outline outline-1 outline-accent -outline-offset-1"
                  : ""
              }`}
            >
              <td className="p-2 border-b border-border-subtle align-top">
                <button
                  type="button"
                  className="border-0 p-0 bg-transparent text-accent text-body font-semibold cursor-pointer text-left hover:underline"
                  onClick={() =>
                    updateRoute((next) =>
                      next.set("skillId", skill.skill_id),
                    )
                  }
                >
                  {skill.display_name}
                </button>
                <div className="text-tertiary text-micro leading-relaxed">
                  {skill.provenance_summary.label}
                </div>
              </td>
              <td className="p-2 border-b border-border-subtle align-top">
                <div>v{skill.current_version_number}</div>
                <div className="text-tertiary text-micro leading-relaxed">
                  {formatTimestamp(skill.updated_at)}
                </div>
              </td>
              <td className="p-2 border-b border-border-subtle align-top">
                <StatusBadge tone={statusTone(skill.status)}>
                  {statusLabel(skill.status)}
                </StatusBadge>
                <div className="text-tertiary text-micro leading-relaxed">{skill.approval.label}</div>
              </td>
              <td className="p-2 border-b border-border-subtle align-top">
                <div>{skill.scope_label}</div>
                <div className="text-tertiary text-micro leading-relaxed">
                  {skill.active_activation_count} activation{skill.active_activation_count === 1 ? "" : "s"}
                </div>
              </td>
              <td className="p-2 border-b border-border-subtle align-top">
                <div>{formatTimestamp(skill.last_used_at, "Never used")}</div>
                <div className="text-tertiary text-micro leading-relaxed">
                  {skill.telemetry_summary.usage_count} use{skill.telemetry_summary.usage_count === 1 ? "" : "s"}
                </div>
              </td>
              <td className="p-2 border-b border-border-subtle align-top">
                <StatusBadge tone={outcomeTone(skill.last_outcome)}>
                  {outcomeLabel(skill.last_outcome)}
                </StatusBadge>
                <div className="text-tertiary text-micro leading-relaxed">
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
