import { useState } from "react";

export type ManualEvidenceFlowProps = {
  gateKey: string;
  gateCategory: string;
  evidenceGuidance?: string;
  evidenceProvider?: string;
  evidenceAt?: string | null;
};

/**
 * Dedicated manual evidence flow for release gates that need
 * operator attestation. Explains what evidence is required,
 * accepted types, and provides an explicit "Add evidence" action.
 */
export function ManualEvidenceFlow({
  gateKey,
  gateCategory,
  evidenceGuidance,
  evidenceProvider,
  evidenceAt,
}: ManualEvidenceFlowProps) {
  const [attested, setAttested] = useState(false);
  const [providerName, setProviderName] = useState(evidenceProvider ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleAttest = async () => {
    setSubmitting(true);
    // In a real implementation this would POST to an API endpoint.
    // For now we simulate a successful attestation.
    await new Promise((resolve) => setTimeout(resolve, 600));
    setAttested(true);
    setSubmitting(false);
  };

  if (attested) {
    return (
      <div className="ff-release-evidence" data-state="attested">
        <p className="ff-release-evidence-success">
          Evidence recorded for <strong>{gateCategory}</strong>.
        </p>
        {providerName ? (
          <p className="ff-release-evidence-meta">Provided by: {providerName}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="ff-release-evidence">
      {evidenceGuidance ? (
        <p className="ff-release-evidence-guidance">{evidenceGuidance}</p>
      ) : null}

      <p className="ff-release-evidence-hint">
        Acceptable evidence: signed build output, test run report, pipeline
        attestation, or operator confirmation.
      </p>

      <div className="ff-release-evidence-form">
        <label className="ff-release-evidence-label" htmlFor={`provider-${gateKey}`}>
          Provided by
        </label>
        <input
          id={`provider-${gateKey}`}
          className="ff-release-evidence-input"
          type="text"
          value={providerName}
          onChange={(e) => setProviderName(e.target.value)}
          placeholder="Your name or system identifier"
          disabled={submitting}
        />
      </div>

      <button
        type="button"
        className="ff-release-evidence-submit"
        onClick={() => void handleAttest()}
        disabled={submitting || providerName.trim().length === 0}
      >
        {submitting ? "Recording..." : "Record attestation"}
      </button>

      {evidenceAt ? (
        <p className="ff-release-evidence-meta">
          Previous evidence: {evidenceAt}
          {evidenceProvider ? ` by ${evidenceProvider}` : ""}
        </p>
      ) : null}
    </div>
  );
}
