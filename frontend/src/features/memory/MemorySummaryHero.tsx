/**
 * Top-level memory summary hero — shows memory category counts and next action.
 *
 * @packageDocumentation
 */

import type { LoadState } from "./types";

/** Props for MemorySummaryHero. */
export interface MemorySummaryHeroProps {
  /** Total memory entries. */
  totalCount: number;
  /** Durable memory count. */
  durableCount: number;
  /** Boot memory count. */
  bootCount: number;
  /** Working context count. */
  workingCount: number;
  /** Revoked/superseded count. */
  revokedCount: number;
  /** Whether the user has mutate permission. */
  canMutate: boolean;
  /** Whether instance ID is available. */
  hasInstance: boolean;
  /** Active category filter. */
  activeCategory: string;
  /** Callback to change active category. */
  onCategoryChange: (category: string) => void;
  /** Load state for memory list. */
  listState: LoadState;
}

/**
 * Summary hero banner showing memory counts and next action recommendation.
 */
export function MemorySummaryHero({
  totalCount,
  durableCount,
  bootCount,
  workingCount,
  revokedCount,
  canMutate,
  hasInstance,
  activeCategory,
  onCategoryChange,
  listState,
}: MemorySummaryHeroProps) {
  const isLoading = listState === "loading";
  const hasEntries = totalCount > 0;

  const needsReview = bootCount > 0;

  const nextAction = !hasInstance
    ? "Select an instance to view memory records"
    : isLoading
      ? "Loading memory records…"
      : !hasEntries
        ? "No memory records — create one to start"
        : needsReview
          ? "Review boot candidates requiring explicit approval"
          : durableCount > 0
            ? "Memory governance current — inspect detail or create new entries"
            : `${totalCount} record${totalCount === 1 ? "" : "s"} — inspect or create`;

  return (
    <article className="fg-card ff-memory-hero ff-memory-tron-frame">
      <div className="ff-memory-hero-header">
        <div>
          <p className="ff-memory-kicker">Memory governance</p>
          <h3>
            {hasEntries
              ? `${totalCount} memory record${totalCount === 1 ? "" : "s"}`
              : "No memory records"}
          </h3>
        </div>
        <span
          className="ff-memory-status-led"
          data-state={hasEntries ? "success" : "idle"}
        >
          {hasEntries ? "Records loaded" : "Empty"}
        </span>
      </div>

      <div className="ff-memory-summary-strip" aria-label="Memory category counts">
        <button
          type="button"
          className={`ff-memory-stat${activeCategory === "durable" ? " ff-memory-stat-active" : ""}`}
          onClick={() => onCategoryChange("durable")}
        >
          <span className="ff-memory-stat-value">
            {isLoading ? "—" : durableCount}
          </span>
          <span className="ff-memory-stat-label">Durable</span>
        </button>
        <button
          type="button"
          className={`ff-memory-stat${activeCategory === "boot" ? " ff-memory-stat-active" : ""}`}
          onClick={() => onCategoryChange("boot")}
        >
          <span
            className={`ff-memory-stat-value${bootCount > 0 ? " ff-memory-stat-warning" : ""}`}
          >
            {isLoading ? "—" : bootCount}
          </span>
          <span className="ff-memory-stat-label">Boot candidates</span>
        </button>
        <button
          type="button"
          className={`ff-memory-stat${activeCategory === "working" ? " ff-memory-stat-active" : ""}`}
          onClick={() => onCategoryChange("working")}
        >
          <span className="ff-memory-stat-value">
            {isLoading ? "—" : workingCount}
          </span>
          <span className="ff-memory-stat-label">Working context</span>
        </button>
        <button
          type="button"
          className={`ff-memory-stat${activeCategory === "revoked" ? " ff-memory-stat-active" : ""}`}
          onClick={() => onCategoryChange("revoked")}
        >
          <span className="ff-memory-stat-value ff-memory-stat-muted">
            {isLoading ? "—" : revokedCount}
          </span>
          <span className="ff-memory-stat-label">Revoked / superseded</span>
        </button>
      </div>

      <div className="ff-memory-hero-actions">
        <p className="ff-memory-next-action">
          Next: {nextAction}
        </p>

        <div className="ff-memory-hero-buttons">
          <span className="ff-memory-admin-status">
            {canMutate ? "Admin mutations available" : "Read-only access"}
          </span>
          {!hasInstance ? (
            <span className="ff-memory-admin-status">Select an instance</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
