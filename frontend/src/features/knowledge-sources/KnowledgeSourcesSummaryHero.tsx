/**
 * Top-level knowledge sources summary hero — shows total sources, status
 * breakdown, indexed objects, and the most important next action.
 *
 * @packageDocumentation
 */

/** Props for KnowledgeSourcesSummaryHero. */
export interface KnowledgeSourcesSummaryHeroProps {
  /** Total number of knowledge sources. */
  totalSources: number;
  /** Number of active sources. */
  activeCount: number;
  /** Number of paused sources. */
  pausedCount: number;
  /** Number of sources with sync errors. */
  errorCount: number;
  /** Total indexed objects across all sources. */
  indexedObjects: number;
  /** Number of sources requiring attention. */
  attentionCount: number;
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Whether an instance is selected. */
  hasInstance: boolean;
  /** Whether the sources list is loading. */
  loading: boolean;
  /** Handler to open the create source form. */
  onCreateSource: () => void;
}

/**
 * Summary hero banner showing knowledge source KPIs and recommended next action.
 */
export function KnowledgeSourcesSummaryHero({
  totalSources,
  activeCount,
  pausedCount,
  errorCount,
  indexedObjects,
  attentionCount,
  canMutate,
  hasInstance,
  loading,
  onCreateSource,
}: KnowledgeSourcesSummaryHeroProps) {
  const hasSources = totalSources > 0;

  const nextAction = !hasSources
    ? "Create your first knowledge source to get started"
    : attentionCount > 0
      ? `${attentionCount} source${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} attention`
      : errorCount > 0
        ? `${errorCount} source${errorCount === 1 ? "" : "s"} with sync errors`
        : "All sources are in good shape";

  return (
    <article className="fg-card ff-sources-hero ff-sources-tron-frame">
      <div className="ff-sources-hero-header">
        <div>
          <p className="ff-sources-kicker">Knowledge sources</p>
          <h3>
            {loading
              ? "Loading sources\u2026"
              : hasSources
                ? `${totalSources} source${totalSources === 1 ? "" : "s"} registered`
                : "No knowledge sources configured"}
          </h3>
        </div>
        <span
          className="ff-sources-status-led"
          data-state={attentionCount > 0 ? "warning" : "success"}
        >
          {attentionCount > 0 ? "Attention required" : "All sources healthy"}
        </span>
      </div>

      {hasSources && !loading && (
        <div className="ff-sources-hero-strip" aria-label="Source status breakdown">
          <div className="ff-sources-stat">
            <span className="ff-sources-stat-value">{totalSources}</span>
            <span className="ff-sources-stat-label">Total</span>
          </div>
          <div className="ff-sources-stat">
            <span className="ff-sources-stat-value ff-sources-stat-success">{activeCount}</span>
            <span className="ff-sources-stat-label">Active</span>
          </div>
          <div className="ff-sources-stat">
            <span className="ff-sources-stat-value ff-sources-stat-warning">{pausedCount}</span>
            <span className="ff-sources-stat-label">Paused</span>
          </div>
          <div className="ff-sources-stat">
            <span className="ff-sources-stat-value ff-sources-stat-danger">{errorCount}</span>
            <span className="ff-sources-stat-label">Errors</span>
          </div>
          <div className="ff-sources-stat">
            <span className="ff-sources-stat-value">{indexedObjects}</span>
            <span className="ff-sources-stat-label">Indexed objects</span>
          </div>
        </div>
      )}

      <div className="ff-sources-hero-footer">
        <p className="ff-sources-next-action">
          Next action: {nextAction}
        </p>
        <div className="ff-sources-hero-buttons">
          <span className="ff-sources-admin-status">
            {canMutate ? "Admin mutations available" : "Read-only access"}
          </span>
          {!hasInstance ? (
            <span className="ff-sources-admin-status">Select an instance</span>
          ) : null}
          {canMutate && hasInstance && (
            <button
              type="button"
              className="ff-sources-primary-action"
              onClick={onCreateSource}
            >
              Create knowledge source
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
