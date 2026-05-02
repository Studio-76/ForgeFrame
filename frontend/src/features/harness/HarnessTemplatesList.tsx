/**
 * Harness templates list — collapsible template browser.
 *
 * Templates are collapsed by default. The operator can expand to browse
 * available templates and create a draft from one.
 */
import { joinList } from "../providers/providersShared";
import type { ProvidersPageData } from "../providers/providersShared";
import {
  buildDraftFromTemplate,
} from "../providers/providersSectionUtils";

type HarnessTemplatesListProps = {
  templates: ProvidersPageData["templates"];
  canMutate: boolean;
  newHarness: ProvidersPageData["newHarness"];
  setNewHarness: ProvidersPageData["newHarness"] extends Record<string, unknown>
    ? (updater: (current: ProvidersPageData["newHarness"]) => ProvidersPageData["newHarness"]) => void
    : never;
};

/**
 * Collapsible list of harness templates.
 */
export function HarnessTemplatesList({
  templates,
  canMutate,
  newHarness,
  setNewHarness,
}: HarnessTemplatesListProps) {
  if (templates.length === 0) {
    return null;
  }

  return (
    <details className="ff-collapse-section fg-mt-sm">
      <summary>
        <div className="ff-collapse-summary-text">
          <h3>Templates ({templates.length})</h3>
          <p>Load a template into the draft to populate provider defaults.</p>
        </div>
      </summary>
      <div className="ff-collapse-section-body">
        <div className="fg-stack fg-mt-sm">
          {templates.map((template) => (
            <div key={template.id} className="fg-subcard">
              <div className="fg-template-card-header">
                <strong className="fg-section-link-label">{template.label}</strong>
                <span className="fg-template-id">{template.id}</span>
              </div>
              <div className="ff-harness-detail-row">
                <span>class={template.integration_class}</span>
                {template.profile_defaults?.models?.length ? (
                  <span>models={joinList(template.profile_defaults.models)}</span>
                ) : null}
              </div>
              {template.description ? (
                <p className="fg-muted fg-template-desc">{template.description}</p>
              ) : null}
              {canMutate ? (
                <div className="ff-harness-preset-action fg-mt-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setNewHarness((current) =>
                        buildDraftFromTemplate(template, current),
                      )
                    }
                  >
                    Use template
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
