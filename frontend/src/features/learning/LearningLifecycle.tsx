/**
 * Visual explanation of the learning lifecycle.
 *
 * @packageDocumentation
 */

/**
 * Lifecycle diagram showing how learning events flow through review to outcome.
 */
export function LearningLifecycle() {
  return (
    <details className="ff-learning-lifecycle">
      <summary>How learning review works</summary>
      <div className="ff-learning-lifecycle-flow">
        <div className="ff-learning-lifecycle-step">
          <span className="ff-learning-lifecycle-icon">1</span>
          <div>
            <strong>Event detected</strong>
            <span>Pattern scan, session rotation, or manual entry</span>
          </div>
        </div>
        <div className="ff-learning-lifecycle-arrow">&rarr;</div>
        <div className="ff-learning-lifecycle-step">
          <span className="ff-learning-lifecycle-icon">2</span>
          <div>
            <strong>Review</strong>
            <span>Inspect context, risk, and proposed outcome</span>
          </div>
        </div>
        <div className="ff-learning-lifecycle-arrow">&rarr;</div>
        <div className="ff-learning-lifecycle-step">
          <span className="ff-learning-lifecycle-icon ff-learning-lifecycle-split">3</span>
          <div>
            <strong>Decide</strong>
            <span>Choose one of four outcomes</span>
          </div>
        </div>
      </div>
      <div className="ff-learning-lifecycle-outcomes">
        <div className="ff-learning-lifecycle-outcome ff-learning-outcome-memory">
          <strong>Promote to memory</strong>
          <span>Persist as boot or durable memory</span>
        </div>
        <div className="ff-learning-lifecycle-outcome ff-learning-outcome-skill">
          <strong>Draft skill</strong>
          <span>Create reusable behavior from the pattern</span>
        </div>
        <div className="ff-learning-lifecycle-outcome ff-learning-outcome-history">
          <strong>Keep as history</strong>
          <span>Record the outcome without persistence</span>
        </div>
        <div className="ff-learning-lifecycle-outcome ff-learning-outcome-reject">
          <strong>Reject</strong>
          <span>Archive the suggestion</span>
        </div>
      </div>
    </details>
  );
}
