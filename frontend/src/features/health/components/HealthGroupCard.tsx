/**
 * HealthGroupCard — a card displaying a single health group with evidence,
 * status, and navigation to the related operational route.
 *
 * @packageDocumentation
 */

import { useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/Button";
import type { HealthGroup } from "../types";
import { toneForStatus, labelForStatus } from "../helpers";

/** Props for HealthGroupCard. */
export type HealthGroupCardProps = {
  /** The health group to display. */
  group: HealthGroup;
  /** Optional callback when the card header area is clicked (for selection). */
  onSelect?: () => void;
};

/**
 * Displays a single health group as a card with status pill, evidence list,
 * and a navigation button to the related operational route.
 */
export function HealthGroupCard({ group, onSelect }: HealthGroupCardProps) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(group.nextRoute.to);
  };

  return (
    <article className="fg-card" onClick={onSelect} onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } } : undefined} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}>
      <div className="fg-panel-heading">
        <div>
          <h3>{group.title}</h3>
          <p className="fg-muted">{group.summary}</p>
        </div>
        <span className="fg-pill" data-tone={toneForStatus(group.status)}>
          {labelForStatus(group.status)}
        </span>
      </div>
      <div className="fg-detail-grid">
        <p>Last check: {group.lastChecked}</p>
        <p>Error: {group.error}</p>
      </div>
      <ul className="fg-list">
        {group.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Button variant="navigation" onPress={handleNavigate}>
        {group.nextRoute.label}
      </Button>
    </article>
  );
}
