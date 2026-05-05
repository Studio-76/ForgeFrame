/**
 * Harness diagnostics — advanced diagnostics drawer.
 *
 * Contains raw snapshots, import/export payloads, proof carriers,
 * and selected profile snapshot. Collapsed by default under
 * "Advanced Diagnostics" in a single section.
 */
import {
  formatMetric,
  joinList,
} from "../providers/providersShared";
import type { ProvidersPageData } from "../providers/providersShared";
import {
  stringifyJson,
} from "../providers/providersSectionUtils";

export type HarnessDiagnosticsProps = {
  importPayload: ProvidersPageData["importPayload"];
  operationResult: ProvidersPageData["operationResult"];
  lastHarnessAction: ProvidersPageData["lastHarnessAction"];
  canMutate: boolean;
  canExportRedacted: boolean;
  onImportPayloadChange: (value: string) => void;
  proofProviders: ProvidersPageData["providers"];
  selectedProfile: ProvidersPageData["profiles"][number] | null;
};

/**
 * Collapsible advanced diagnostics panel.
 */
export function HarnessDiagnostics({
  importPayload,
  operationResult,
  lastHarnessAction,
  canMutate,
  canExportRedacted,
  onImportPayloadChange,
  proofProviders,
  selectedProfile,
}: HarnessDiagnosticsProps) {
  return (
    <details className="ff-collapse-section" id="harness-advanced-diagnostics">
      <summary>
        <div className="ff-collapse-summary-text">
          <h3>Advanced Diagnostics</h3>
          <p>
            Raw snapshots, import/export payloads, and proof carriers.
            {proofProviders.length > 0
              ? ` ${proofProviders.length} proof carrier${proofProviders.length > 1 ? "s" : ""}.`
              : ""}
          </p>
        </div>
      </summary>
      <div className="ff-collapse-section-body">
        <div className="fg-stack fg-mt-sm">
          <div className="fg-subcard">
            <h4>Diagnostics buffer</h4>
            <p className="fg-muted">
              Export writes the current snapshot here. Import dry-run and apply
              read from the same buffer.
            </p>
            <textarea
              value={importPayload}
              onChange={(e) => onImportPayloadChange(e.target.value)}
              rows={10}
              placeholder={
                canMutate
                  ? "Harness snapshot JSON for dry-run or import"
                  : canExportRedacted
                    ? "Redacted harness snapshot export remains visible here, but import actions stay hidden for this session."
                    : "Harness snapshot export is unavailable for this session."
              }
              readOnly={!canMutate}
            />
          </div>

          <div className="fg-subcard">
            <h4>Last raw harness payload</h4>
            {operationResult ? (
              <pre>{operationResult}</pre>
            ) : (
              <p className="fg-muted">No raw payload captured yet.</p>
            )}
          </div>

          <div className="fg-subcard">
            <h4>Proof carriers</h4>
            {proofProviders.length === 0 ? (
              <p className="fg-muted">
                No providers carry harness proof yet.
              </p>
            ) : null}
            <ul className="fg-list">
              {proofProviders.map((provider) => (
                <li key={provider.provider}>
                  {provider.label} ({provider.provider}) \u00B7 proof=
                  {provider.harness_proof_status} \u00B7 proven profiles=
                  {provider.harness_proven_profile_keys.length > 0
                    ? joinList(provider.harness_proven_profile_keys)
                    : "-"}{" "}
                  \u00B7 runs={formatMetric(provider.harness_run_count)}
                </li>
              ))}
            </ul>
          </div>

          {selectedProfile ? (
            <div className="fg-subcard">
              <h4>Selected profile snapshot</h4>
              <pre>{stringifyJson(selectedProfile)}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}
