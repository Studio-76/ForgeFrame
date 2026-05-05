/**
 * Detail panel content for a selected incident or routing failure.
 *
 * Renders the DetailPanel wrapper with interpretation summary, current
 * effect, next step, and scoped remediation links. Raw evidence is
 * rendered separately via the template-level diagnostics prop.
 *
 * @packageDocumentation
 */

import { Link } from "react-router-dom";

import { DetailPanel } from "../../../components/ui/DetailPanel";
import type { StatusTone } from "../../../components/ui/types";
import type { BlockedRoutingFailureRow, IncidentAxisRow } from "../types";
import { severityTone, severityStatusKey } from "../helpers";

/**
 * A resolved route link with label and scoped target.
 */
export type ResolvedRouteLink = {
  label: string;
  to: string;
};

/**
 * Props for the IncidentDetailContent component.
 */
export type IncidentDetailContentProps = {
  /** The selected incident axis, if any. */
  selectedAxis: IncidentAxisRow | null;
  /** The selected routing failure, if any. */
  selectedRoutingFailure: BlockedRoutingFailureRow | null;
  /** Display title for the detail panel. */
  detailTitle: string;
  /** Detail-level status badge value. */
  detailStatus: string;
  /** Detail-level status tone. */
  detailTone: StatusTone;
  /** Detail-level status key for badge rendering. */
  detailStatusKey: string;
  /** Short summary text. */
  detailSummary: string;
  /** Current effect description. */
  detailEffect: string;
  /** Next step instruction. */
  detailNextStep: string;
  /** Scoped route links. */
  detailLinks: ResolvedRouteLink[];
  /**
   * Whether the inner DetailPanel should be sticky.
   * Set to false when already inside a sticky sidebar (e.g., useTwoPaneLayout).
   * Default: true
   */
  sticky?: boolean;
};

/**
 * Renders the incident detail panel content for a selected axis or routing
 * failure, including interpretation summary, current effect, next step,
 * and operator-facing navigation links.
 */
export function IncidentDetailContent({
  selectedAxis,
  selectedRoutingFailure,
  detailTitle,
  detailStatus,
  detailTone,
  detailStatusKey,
  detailSummary,
  detailEffect,
  detailNextStep,
  detailLinks,
  sticky = true,
}: IncidentDetailContentProps) {
  return (
    <DetailPanel
      title={detailTitle}
      description="Short interpretation stays above raw evidence so this route remains triage-first instead of turning into an undifferentiated log dump."
      status={detailStatus}
      statusTone={detailTone}
      statusKey={detailStatusKey}
      sticky={sticky}
      actions={
        <div className="fg-actions">
          {detailLinks.map((link) => (
            <Link key={`${detailTitle}-${link.label}`} className="fg-nav-link" to={link.to}>
              {link.label}
            </Link>
          ))}
        </div>
      }
    >
      <div className="fg-stack">
        <section className="fg-subcard">
          <h4>Interpretation</h4>
          <p>{detailSummary}</p>
          <p className="fg-muted">{detailEffect}</p>
        </section>

        <section className="fg-subcard">
          <h4>Next step</h4>
          <p>{detailNextStep}</p>
        </section>
      </div>
    </DetailPanel>
  );
}
