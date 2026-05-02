/**
 * Collapsible passed-checks section.
 * Shows passed checks as compact rows rather than full cards,
 * and is collapsed by default.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import type { BlockerItem } from "./types";

/**
 * Props for the InstancePassedChecks component.
 */
export type InstancePassedChecksProps = {
  /** List of passed (ready) checks. */
  passed: BlockerItem[];
};

/**
 * Collapsible passed-checks section.
 * Shows passed checks as compact rows collapsed by default.
 */
export function InstancePassedChecks({ passed }: InstancePassedChecksProps) {
  const [showPassed, setShowPassed] = useState(false);

  if (passed.length === 0) {
    return null;
  }

  return (
    <details
      className="ff-collapse-section"
      open={showPassed}
      onToggle={(event) =>
        setShowPassed((event.target as HTMLDetailsElement).open)
      }
    >
      <summary>
        <div className="ff-collapse-summary-text">
          <h3>{passed.length} check{passed.length !== 1 ? "s" : ""} passing</h3>
          <p>Readiness checks that are already passing. Expand to inspect.</p>
        </div>
      </summary>
      <div className="ff-collapse-section-body">
        <div className="fg-stack ff-instance-passed-rows">
          {passed.map((check) => (
            <div key={check.id} className="ff-instance-passed-row">
              <span className="ff-instance-passed-badge" data-tone="success" />
              <span className="ff-instance-passed-label">{check.label}</span>
              <span className="fg-muted ff-instance-passed-detail">
                {check.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
