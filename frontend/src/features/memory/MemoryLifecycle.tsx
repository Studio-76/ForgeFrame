/**
 * Memory lifecycle explanation — collapsible, shows the memory governance flow.
 *
 * @packageDocumentation
 */

/**
 * Memory lifecycle explanation component.
 * Explains the memory governance lifecycle from proposed to retired.
 */
export function MemoryLifecycle() {
  return (
    <details className="ff-memory-lifecycle">
      <summary>Memory lifecycle and governance</summary>
      <div className="ff-memory-lifecycle-content">
        <div className="ff-memory-lifecycle-flow">
          <div className="ff-memory-lifecycle-step">
            <div className="ff-memory-lifecycle-icon">1</div>
            <div>
              <strong>Proposed</strong>
              <span>Learning event or operator action proposes a memory entry</span>
            </div>
          </div>
          <div className="ff-memory-lifecycle-arrow">&rarr;</div>
          <div className="ff-memory-lifecycle-step">
            <div className="ff-memory-lifecycle-icon">2</div>
            <div>
              <strong>Reviewed</strong>
              <span>Operator reviews and approves the proposed memory</span>
            </div>
          </div>
          <div className="ff-memory-lifecycle-arrow">&rarr;</div>
          <div className="ff-memory-lifecycle-split">
            <div className="ff-memory-lifecycle-outcomes">
              <div className="ff-memory-lifecycle-outcome ff-memory-outcome-durable">
                <strong>Durable memory</strong>
                <span>Long-term governed truth that survives context rotation</span>
              </div>
              <div className="ff-memory-lifecycle-outcome ff-memory-outcome-boot">
                <strong>Boot candidate</strong>
                <span>Promoted into bootstrap context — requires review checkpoint</span>
              </div>
              <div className="ff-memory-lifecycle-outcome ff-memory-outcome-working">
                <strong>Working context</strong>
                <span>Temporary context, not durable truth — linked to conversations/tasks</span>
              </div>
            </div>
          </div>
          <div className="ff-memory-lifecycle-arrow">&rarr;</div>
          <div className="ff-memory-lifecycle-step">
            <div className="ff-memory-lifecycle-icon">3</div>
            <div>
              <strong>Corrected / Revoked / Superseded</strong>
              <span>Governance actions that modify or retire active truth</span>
            </div>
          </div>
        </div>

        <h4>Memory type distinctions</h4>
        <dl className="ff-memory-lifecycle-defs">
          <dt>Durable memory</dt>
          <dd>Long-term truth that persists across connector drift and working-context rotation. Active until corrected, revoked, or deleted.</dd>
          <dt>Boot candidate</dt>
          <dd>Candidate for bootstrap context. Derived from learning events and requires an explicit operator review checkpoint before becoming active truth.</dd>
          <dt>Working context</dt>
          <dd>Temporary context scoped to specific conversations, tasks, notifications, or workspaces. Not durable truth — survives only as long as the linked context.</dd>
          <dt>Revoked / superseded</dt>
          <dd>Historical records that are no longer active truth. Preserved as governance evidence to maintain audit trail.</dd>
        </dl>

        <h4>Governance actions</h4>
        <dl className="ff-memory-lifecycle-defs">
          <dt>Save (edit)</dt>
          <dd>Updates the current memory entry in place. Fields change immediately. Use for adjustments that do not change the fundamental truth.</dd>
          <dt>Correct</dt>
          <dd>Creates a corrected successor entry. The current entry is superseded but preserved in revision history. The successor becomes active truth.</dd>
          <dt>Revoke</dt>
          <dd>Marks the current entry's truth as invalid. The record remains visible but is no longer treated as active truth. No successor is created.</dd>
          <dt>Delete</dt>
          <dd>Tombstones the record permanently. Preserved as a historical audit trail entry but no longer visible in active views.</dd>
        </dl>
      </div>
    </details>
  );
}
