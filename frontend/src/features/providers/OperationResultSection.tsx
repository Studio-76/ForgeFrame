import type { ProvidersPageActions, ProvidersPageData } from "./providersShared";
import { SectionCard } from "./providersSectionUtils";

type SectionProps = {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
};

/**
 * Section displaying the raw JSON result from the most recent harness or
 * provider operation, with a clear button to dismiss it.
 */
export function OperationResultSection({ data, actions }: SectionProps) {
  if (!data.operationResult) {
    return null;
  }

  return (
    <SectionCard
      title="Last Control-Plane Action"
      description="Raw JSON from the most recent harness or provider operation."
      actions={
        <button type="button" onClick={() => actions.setOperationResult("")}>
          Clear result
        </button>
      }
    >
      <pre>{data.operationResult}</pre>
    </SectionCard>
  );
}
