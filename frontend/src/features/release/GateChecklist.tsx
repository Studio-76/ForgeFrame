import type { GateRecord } from "./types";
import { GATE_PRIORITY_LABELS, sortGatesByPriority } from "./utils";
import { StatusBadge } from "../../components/ui/StatusBadge";

export type GateChecklistProps = {
  gates: GateRecord[];
  selectedGateKey: string;
  onSelectGate: (key: string) => void;
};

/**
 * Prioritized release gate checklist.
 * Blocking gates appear first, followed by manual-evidence, warning, ready, and not-required.
 * Ready and not-required gates are collapsed by default.
 */
export function GateChecklist({ gates, selectedGateKey, onSelectGate }: GateChecklistProps) {
  const sorted = sortGatesByPriority(gates);

  const blocking = sorted.filter((g) => g.priority === "blocking");
  const manualEvidence = sorted.filter((g) => g.priority === "manual-evidence");
  const warning = sorted.filter((g) => g.priority === "warning");
  const ready = sorted.filter((g) => g.priority === "ready");
  const notRequired = sorted.filter((g) => g.priority === "not-required");

  return (
    <section className="ff-release-checklist" aria-label="Release gate checklist">
      {blocking.length > 0 ? (
        <GateGroup
          label={GATE_PRIORITY_LABELS.blocking}
          count={blocking.length}
          gates={blocking}
          selectedGateKey={selectedGateKey}
          onSelectGate={onSelectGate}
          defaultOpen
        />
      ) : null}

      {manualEvidence.length > 0 ? (
        <GateGroup
          label={GATE_PRIORITY_LABELS["manual-evidence"]}
          count={manualEvidence.length}
          gates={manualEvidence}
          selectedGateKey={selectedGateKey}
          onSelectGate={onSelectGate}
          defaultOpen
        />
      ) : null}

      {warning.length > 0 ? (
        <GateGroup
          label={GATE_PRIORITY_LABELS.warning}
          count={warning.length}
          gates={warning}
          selectedGateKey={selectedGateKey}
          onSelectGate={onSelectGate}
          defaultOpen={false}
        />
      ) : null}

      <GateGroup
        label={GATE_PRIORITY_LABELS.ready}
        count={ready.length}
        gates={ready}
        selectedGateKey={selectedGateKey}
        onSelectGate={onSelectGate}
        defaultOpen={false}
      />

      <GateGroup
        label={GATE_PRIORITY_LABELS["not-required"]}
        count={notRequired.length}
        gates={notRequired}
        selectedGateKey={selectedGateKey}
        onSelectGate={onSelectGate}
        defaultOpen={false}
      />
    </section>
  );
}

/** @private */
type GateGroupProps = {
  label: string;
  count: number;
  gates: GateRecord[];
  selectedGateKey: string;
  onSelectGate: (key: string) => void;
  defaultOpen: boolean;
};

/** @private */
function GateGroup({ label, count, gates, selectedGateKey, onSelectGate, defaultOpen }: GateGroupProps) {
  if (gates.length === 0) {
    return null;
  }

  return (
    <details className="ff-release-gate-group" open={defaultOpen}>
      <summary className="ff-release-gate-group-summary">
        <span className="ff-release-gate-group-label">
          {label} <span className="ff-release-gate-group-count">({count})</span>
        </span>
      </summary>
      <div className="ff-release-gate-group-body">
        {gates.map((gate) => (
          <button
            key={gate.key}
            type="button"
            className={`ff-release-gate-item${gate.key === selectedGateKey ? " is-selected" : ""}`}
            onClick={() => onSelectGate(gate.key)}
          >
            <div className="ff-release-gate-item-left">
              <span className="ff-release-gate-item-name">{gate.category}</span>
              {gate.primaryAction ? (
                <span className="ff-release-gate-item-action">{gate.primaryAction}</span>
              ) : null}
            </div>
            <div className="ff-release-gate-item-right">
              <StatusBadge tone={gate.tone} status={gate.statusKey}>
                {gate.statusLabel}
              </StatusBadge>
            </div>
          </button>
        ))}
      </div>
    </details>
  );
}
