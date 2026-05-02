/**
 * Compact event list with tab/segmented filter for review buckets.
 *
 * @packageDocumentation
 */

import type { LearningEventSummary } from "../../api/domain/learning";
import { REVIEW_BUCKET_ORDER, REVIEW_BUCKET_LABELS } from "./types";
import { bucketTone, laneTone, riskTone, formatTimestamp, describeOutcome } from "./utils";
import type { LoadState } from "./types";

/** Props for EventList. */
export interface EventListProps {
  /** All events (unfiltered). */
  events: LearningEventSummary[];
  /** Current active bucket filter. */
  activeBucket: string;
  /** Callback to change active bucket. */
  onBucketChange: (bucket: string) => void;
  /** Currently selected event ID. */
  selectedEventId: string;
  /** Callback when an event is selected. */
  onSelectEvent: (eventId: string) => void;
  /** Load state for events. */
  listState: LoadState;
  /** Whether the instance ID is available. */
  hasInstance: boolean;
}

/**
 * Event list component with segmented bucket filter.
 */
export function EventList({
  events,
  activeBucket,
  onBucketChange,
  selectedEventId,
  onSelectEvent,
  listState,
  hasInstance,
}: EventListProps) {
  if (listState === "loading") {
    return (
      <article className="fg-card">
        <p className="fg-muted">Loading learning events…</p>
      </article>
    );
  }

  if (listState === "error") {
    return (
      <article className="fg-card">
        <p className="fg-danger">Failed to load learning events.</p>
      </article>
    );
  }

  if (!hasInstance) {
    return (
      <article className="fg-card">
        <p className="fg-muted">Select an instance to view learning events.</p>
      </article>
    );
  }

  // Count events per bucket
  const bucketCounts = REVIEW_BUCKET_ORDER.reduce(
    (acc, bucket) => {
      acc[bucket] = events.filter((e) => e.review_bucket === bucket).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const filteredEvents =
    activeBucket === "all"
      ? events
      : events.filter((e) => e.review_bucket === activeBucket);

  return (
    <article className="fg-card ff-learning-event-list">
      <div className="ff-learning-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`ff-learning-tab${activeBucket === "all" ? " ff-learning-tab-active" : ""}`}
          onClick={() => onBucketChange("all")}
          aria-selected={activeBucket === "all"}
        >
          All ({events.length})
        </button>
        {REVIEW_BUCKET_ORDER.map((bucket) => (
          <button
            key={bucket}
            type="button"
            role="tab"
            className={`ff-learning-tab${activeBucket === bucket ? " ff-learning-tab-active" : ""}`}
            onClick={() => onBucketChange(bucket)}
            data-tone={bucketTone(bucket)}
            aria-selected={activeBucket === bucket}
          >
            {REVIEW_BUCKET_LABELS[bucket]} ({bucketCounts[bucket]})
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <p className="fg-muted ff-learning-empty-list">
          {activeBucket === "all"
            ? "No learning events found."
            : `No events in "${REVIEW_BUCKET_LABELS[activeBucket as keyof typeof REVIEW_BUCKET_LABELS] ?? activeBucket}".`}
        </p>
      ) : (
        <div className="fg-table-wrap">
          <table className="fg-table" aria-label="Learning events">
            <thead>
              <tr>
                <th>Event</th>
                <th>Source</th>
                <th>Path</th>
                <th>Risk</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr
                  key={event.learning_event_id}
                  className={
                    selectedEventId === event.learning_event_id
                      ? "ff-learning-row-selected"
                      : undefined
                  }
                >
                  <td>
                    <button
                      type="button"
                      className="fg-table-trigger"
                      onClick={() => onSelectEvent(event.learning_event_id)}
                    >
                      {event.summary}
                    </button>
                    <div className="fg-muted">
                      {event.trigger_kind} ·{" "}
                      {formatTimestamp(event.created_at)}
                    </div>
                  </td>
                  <td>
                    <div>{event.source.label}</div>
                    <div className="fg-muted">
                      {event.source.detail ?? ""}
                    </div>
                  </td>
                  <td>
                    <span
                      className="fg-pill"
                      data-tone={laneTone(event.suggested_lane)}
                    >
                      {event.suggested_lane_label}
                    </span>
                  </td>
                  <td>
                    <span
                      className="fg-pill"
                      data-tone={riskTone(event.risk.level)}
                    >
                      {event.risk.level}
                    </span>
                  </td>
                  <td>
                    <div>{describeOutcome(event)}</div>
                    <div className="fg-muted">
                      {event.outcome.scope_label ?? ""}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
