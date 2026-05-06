/**
 * Top-level skills summary hero — shows total skills, status breakdown,
 * and the most important next action for the operator.
 *
 * @packageDocumentation
 */

import { Button } from "../../components/ui";
import { StatusBadge } from "../../components/ui";

/** Props for SkillsSummaryHero. */
export interface SkillsSummaryHeroProps {
  /** Total number of skills in the registry. */
  totalSkills: number;
  /** Number of skills in draft status. */
  draftCount: number;
  /** Number of skills in active status. */
  activeCount: number;
  /** Number of skills pending review. */
  reviewCount: number;
  /** Number of skills requiring attention (e.g. review needed). */
  attentionCount: number;
  /** Number of archived skills. */
  archivedCount: number;
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Whether an instance is selected. */
  hasInstance: boolean;
  /** Whether the skills list is currently loading. */
  loading: boolean;
  /** Handler to open the create skill form. */
  onCreateSkill: () => void;
}

/**
 * Summary hero banner showing skill registry KPIs and next action.
 */
export function SkillsSummaryHero({
  totalSkills,
  draftCount,
  activeCount,
  reviewCount,
  attentionCount,
  archivedCount,
  canMutate,
  hasInstance,
  loading,
  onCreateSkill,
}: SkillsSummaryHeroProps) {
  const hasSkills = totalSkills > 0;
  const nextAction = hasSkills && attentionCount > 0
    ? `${attentionCount} skill${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} attention`
    : !hasSkills
      ? "Create your first skill to get started"
      : "All skills are in good shape";

  return (
    <article className="fg-card ff-skills-hero ff-frame-accent">
      <div className="ff-skills-hero-header">
        <div>
          <p className="fg-muted text-meta font-bold uppercase tracking-widest">Skill registry</p>
          <h3>
            {loading
              ? "Loading skills\u2026"
              : hasSkills
                ? `${totalSkills} skill${totalSkills === 1 ? "" : "s"} registered`
                : "No skills registered"}
          </h3>
        </div>
        <StatusBadge
          tone={attentionCount > 0 ? "warning" : "success"}
        >
          {attentionCount > 0 ? "Attention required" : "Registry clear"}
        </StatusBadge>
      </div>

      {hasSkills && !loading && (
        <div className="ff-skills-hero-strip" aria-label="Skill status breakdown">
          <div className="ff-skills-stat">
            <span className="ff-skills-stat-value">{totalSkills}</span>
            <span className="ff-skills-stat-label">Total</span>
          </div>
          <div className="ff-skills-stat">
            <span className="ff-skills-stat-value">{draftCount}</span>
            <span className="ff-skills-stat-label">Draft</span>
          </div>
          <div className="ff-skills-stat">
            <span className="ff-skills-stat-value ff-skills-stat-success">{activeCount}</span>
            <span className="ff-skills-stat-label">Active</span>
          </div>
          <div className="ff-skills-stat">
            <span className="ff-skills-stat-value ff-skills-stat-warning">{reviewCount}</span>
            <span className="ff-skills-stat-label">Pending review</span>
          </div>
          <div className="ff-skills-stat">
            <span className="ff-skills-stat-value ff-skills-stat-danger">{attentionCount}</span>
            <span className="ff-skills-stat-label">Needs attention</span>
          </div>
          <div className="ff-skills-stat">
            <span className="ff-skills-stat-value ff-skills-stat-muted">{archivedCount}</span>
            <span className="ff-skills-stat-label">Archived</span>
          </div>
        </div>
      )}

      <div className="ff-skills-hero-footer">
        <p className="ff-skills-next-action">
          Next action: {nextAction}
        </p>
        <div className="ff-skills-hero-buttons">
          <span className="ff-skills-admin-status">
            {canMutate ? "Admin mutations available" : "Read-only access"}
          </span>
          {!hasInstance ? (
            <span className="ff-skills-admin-status">Select an instance</span>
          ) : null}
          {canMutate && hasInstance && (
            <Button variant="primary" size="sm" onPress={onCreateSkill}>
              Create skill
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
