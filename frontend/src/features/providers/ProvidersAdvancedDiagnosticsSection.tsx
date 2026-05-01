import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import type { ProvidersPageData } from "./providersShared";
import { formatMetric, formatProviderAxis } from "./providersShared";
import {
  formatCatalogLabel,
  formatContractClassification,
} from "./providersSectionUtils";

/**
 * Advanced diagnostics section displaying product axis contract language,
 * OpenAI compatibility signoff, and last control-plane payload.
 */
export function ProvidersAdvancedDiagnosticsSection({ data }: { data: ProvidersPageData }) {
  const contractRows = data.providers.map((provider) => ({
    provider: provider.provider,
    label: provider.label,
    contract: formatContractClassification(provider.contract_classification),
    axis: formatProviderAxis(provider.provider_axis),
    proof: provider.harness_proof_status,
    readiness: provider.readiness_reason,
  }));

  return (
    <AdvancedDiagnostics
      title="Advanced Diagnostics"
      description="Product axis contract language and deeper compatibility proof stay collapsed here."
      status={`${data.providers.length} providers`}
      statusTone="neutral"
    >
      <div className="fg-stack">
        <div className="fg-subcard">
          <h4>Product axis contract</h4>
          <ul className="fg-list">
            {contractRows.map((row) => (
              <li key={row.provider}>
                {row.label} ({row.provider}) · contract={row.contract} · axis={row.axis} · proof={row.proof} · reason={row.readiness}
              </li>
            ))}
          </ul>
        </div>

        {data.openaiCompatibilitySignoff ? (
          <div className="fg-subcard">
            <h4>OpenAI compatibility signoff</h4>
            <p className="fg-muted">
              overall={formatCatalogLabel(data.openaiCompatibilitySignoff.summary.overall_status)} · supported=
              {formatMetric(data.openaiCompatibilitySignoff.summary.supported)} · partial=
              {formatMetric(data.openaiCompatibilitySignoff.summary.partial)} · blocked by live evidence=
              {formatMetric(data.openaiCompatibilitySignoff.summary.blocked_by_live_evidence)}
            </p>
          </div>
        ) : null}

        {data.operationResult ? (
          <div className="fg-subcard">
            <h4>Last control-plane payload</h4>
            <pre>{data.operationResult}</pre>
          </div>
        ) : null}
      </div>
    </AdvancedDiagnostics>
  );
}
