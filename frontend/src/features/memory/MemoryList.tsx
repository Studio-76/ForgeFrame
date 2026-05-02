/**
 * Memory entries table filtered by active category.
 *
 * @packageDocumentation
 */

import type { MemorySummary } from "../../api/domain/memory";
import type { LoadState } from "./types";
import { MEMORY_CATEGORIES, TRUST_LABELS, VISIBILITY_LABELS } from "./types";
import { formatTimestamp, lifecycleTone, reviewTone, usageSummary } from "./utils";

/** Props for MemoryList. */
export interface MemoryListProps {
  /** All memory entries. */
  entries: MemorySummary[];
  /** Currently selected memory ID. */
  selectedMemoryId: string;
  /** Active category filter. */
  activeCategory: string;
  /** Load state. */
  listState: LoadState;
  /** Whether instance is available. */
  hasInstance: boolean;
  /** Callback when memory is selected. */
  onSelectMemory: (memoryId: string) => void;
}

/**
 * Memory entries table with category-based filtering.
 */
export function MemoryList({
  entries,
  selectedMemoryId,
  activeCategory,
  listState,
  hasInstance,
  onSelectMemory,
}: MemoryListProps) {
  if (listState === "loading") {
    return (
      <article className="fg-card">
        <p className="fg-muted">Loading memory records…</p>
      </article>
    );
  }

  if (listState === "error") {
    return (
      <article className="fg-card">
        <p className="fg-danger">Failed to load memory records.</p>
      </article>
    );
  }

  if (!hasInstance) {
    return (
      <article className="fg-card">
        <p className="fg-muted">Select an instance to view memory records.</p>
      </article>
    );
  }

  // Filter by active category
  const filteredEntries =
    activeCategory === "all"
      ? entries
      : entries.filter((entry) => {
          const isRetired =
            entry.status === "corrected" ||
            entry.status === "deleted" ||
            entry.truth_state === "revoked" ||
            entry.truth_state === "superseded" ||
            entry.truth_state === "deleted";

          if (activeCategory === "revoked") return isRetired;
          if (activeCategory === "boot") return !isRetired && entry.memory_layer === "boot";
          if (activeCategory === "working") return !isRetired && entry.memory_layer === "working";
          if (activeCategory === "durable")
            return !isRetired && entry.memory_layer !== "boot" && entry.memory_layer !== "working";
          return true;
        });

  if (filteredEntries.length === 0) {
    const activeLabel =
      activeCategory === "all"
        ? "memory records"
        : (MEMORY_CATEGORIES.find((c) => c.key === activeCategory)?.label ?? "records");
    return (
      <article className="fg-card">
        <div className="ff-memory-empty-list">
          <p className="fg-muted">
            {activeCategory === "all"
              ? "No memory records found."
              : `No entries in "${activeLabel}".`}
          </p>
          {activeCategory === "all" ? (
            <p className="fg-muted">
              Create a memory record or adjust the scope to get started.
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="fg-card ff-memory-list">
      <div className="fg-table-wrap">
        <table className="fg-table" aria-label="Memory records">
          <thead>
            <tr>
              <th>Content</th>
              <th>Scope</th>
              <th>Trust</th>
              <th>Status</th>
              <th>Expires / Review</th>
              <th>Last used</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((memory) => {
              const isRevoked =
                memory.truth_state === "revoked" ||
                memory.truth_state === "superseded" ||
                memory.truth_state === "deleted";
              return (
                <tr
                  key={memory.memory_id}
                  className={`${memory.memory_id === selectedMemoryId ? "is-selected" : ""}${isRevoked ? " ff-memory-row-retired" : ""}`}
                >
                  <td>
                    <button
                      className="fg-table-trigger"
                      type="button"
                      onClick={() => onSelectMemory(memory.memory_id)}
                    >
                      {memory.title}
                    </button>
                    <div className="fg-muted">{memory.body}</div>
                  </td>
                  <td>
                    <div>{memory.memory_layer_label}</div>
                    <div className="fg-muted">
                      {VISIBILITY_LABELS[memory.visibility_scope] ?? memory.visibility_scope}
                    </div>
                  </td>
                  <td>
                    <div>{TRUST_LABELS[memory.source_trust_class] ?? memory.source_trust_class}</div>
                    <div className="fg-muted">
                      {memory.human_override ? "Human override" : "No override"}
                    </div>
                  </td>
                  <td>
                    <span className="fg-pill" data-tone={lifecycleTone(memory)}>
                      {memory.status === "active" && memory.truth_state === "active"
                        ? "Active"
                        : `${memory.status} / ${memory.truth_state}`}
                    </span>
                    <div className="fg-muted">{usageSummary(memory)}</div>
                  </td>
                  <td>
                    <div>{formatTimestamp(memory.expires_at, "No expiry")}</div>
                    <div className="fg-muted">
                      <span
                        className="fg-pill"
                        data-tone={reviewTone(memory.review.state)}
                      >
                        {memory.review.state}
                      </span>
                      {memory.review.review_at
                        ? ` · ${memory.review.review_at}`
                        : ""}
                    </div>
                  </td>
                  <td>{formatTimestamp(memory.last_used_at, "Not observed")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
