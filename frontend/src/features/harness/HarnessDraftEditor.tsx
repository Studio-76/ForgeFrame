/**
 * Harness draft editor — editable profile form.
 *
 * Hidden by default. Appears when the operator clicks "Edit profile" or
 * "Create draft from preset". Secret/auth fields are clearly marked as
 * draft-only and require explicit save.
 */
import type { HarnessProfile } from "../../api/domain";
import type { ProvidersPageData } from "../providers/providersShared";
import {
  PermissionCallout,
  buildDraftFromTemplate,
} from "../providers/providersSectionUtils";

export type HarnessDraftEditorProps = {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
  onSave: () => void;
  onCancel: () => void;
};

import type { ProvidersPageActions } from "../providers/providersShared";

/**
 * Editable harness draft form. Only rendered when edit mode is active.
 */
export function HarnessDraftEditor({
  data,
  actions,
  onSave,
  onCancel,
}: HarnessDraftEditorProps) {
  const selectedTemplate =
    data.templates.find(
      (t) => t.id === data.newHarness.template_id,
    ) ?? null;

  const availableDraftTemplates = data.templates.filter(
    (t) =>
      t.integration_class === data.newHarness.integration_class
      || t.id === data.newHarness.template_id,
  );

  if (!data.access.canMutate) {
    return (
      <PermissionCallout
        title={data.access.summaryTitle}
        detail={data.access.mutationBlockedMessage}
      />
    );
  }

  return (
    <div className="ff-harness-draft-editor">
      <div className="ff-harness-draft-editor-header">
        <h3>Edit draft</h3>
        <p className="fg-muted">
          Changes below are draft-only. Click "Save harness profile" to persist.
        </p>
      </div>

      <div className="fg-grid fg-grid-compact">
        <label>
          Provider key
          <input
            value={data.newHarness.provider_key}
            onChange={(e) =>
              actions.setNewHarness((current) => ({
                ...current,
                provider_key: e.target.value,
              }))
            }
            placeholder="provider_key"
          />
        </label>
        <label>
          Label
          <input
            value={data.newHarness.label}
            onChange={(e) =>
              actions.setNewHarness((current) => ({
                ...current,
                label: e.target.value,
              }))
            }
            placeholder="Provider label"
          />
        </label>
        <label>
          Integration class
          <select
            value={data.newHarness.integration_class}
            onChange={(e) =>
              actions.setNewHarness((current) => ({
                ...current,
                integration_class: e.target
                  .value as HarnessProfile["integration_class"],
                template_id: "",
              }))
            }
          >
            <option value="openai_compatible">openai_compatible</option>
            <option value="templated_http">templated_http</option>
            <option value="static_catalog">static_catalog</option>
          </select>
        </label>
        <label>
          Template
          <select
            value={data.newHarness.template_id}
            onChange={(e) => {
              const nextTemplate = data.templates.find(
                (t) => t.id === e.target.value,
              );
              if (!nextTemplate) {
                actions.setNewHarness((current) => ({
                  ...current,
                  template_id: e.target.value,
                }));
                return;
              }
              actions.setNewHarness((current) =>
                buildDraftFromTemplate(nextTemplate, current),
              );
            }}
          >
            <option value="">none</option>
            {availableDraftTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Endpoint base URL
          <input
            value={data.newHarness.endpoint_base_url}
            onChange={(e) =>
              actions.setNewHarness((current) => ({
                ...current,
                endpoint_base_url: e.target.value,
              }))
            }
            placeholder="https://example.invalid/v1"
          />
        </label>
        <label>
          Models
          <input
            value={data.newHarness.models}
            onChange={(e) =>
              actions.setNewHarness((current) => ({
                ...current,
                models: e.target.value,
              }))
            }
            placeholder="model-1, model-2"
          />
        </label>
        <label>
          Auth scheme
          <select
            value={data.newHarness.auth_scheme}
            onChange={(e) =>
              actions.setNewHarness((current) => ({
                ...current,
                auth_scheme: e.target
                  .value as HarnessProfile["auth_scheme"],
              }))
            }
          >
            <option value="none">none</option>
            <option value="bearer">bearer</option>
            <option value="api_key_header">api_key_header</option>
          </select>
        </label>
        <label>
          Auth header
          <input
            value={data.newHarness.auth_header}
            onChange={(e) =>
              actions.setNewHarness((current) => ({
                ...current,
                auth_header: e.target.value,
              }))
            }
            placeholder="Authorization"
            disabled={data.newHarness.auth_scheme === "none"}
          />
        </label>
        <label>
          Auth value
          <input
            type="password"
            value={data.newHarness.auth_value}
            onChange={(e) =>
              actions.setNewHarness((current) => ({
                ...current,
                auth_value: e.target.value,
              }))
            }
            placeholder={
              data.newHarness.auth_scheme === "none"
                ? "Not required"
                : "Secret token or API key"
            }
            disabled={data.newHarness.auth_scheme === "none"}
          />
        </label>
      </div>

      <label className="fg-mt-sm">
        <span className="fg-row">
          <input
            type="checkbox"
            checked={data.newHarness.stream_enabled}
            onChange={(e) =>
              actions.setNewHarness((current) => ({
                ...current,
                stream_enabled: e.target.checked,
              }))
            }
            className="fg-control-auto"
          />
          <span>
            {data.newHarness.stream_enabled
              ? "Streaming enabled"
              : "Streaming disabled"}
          </span>
        </span>
      </label>

      {data.newHarness.auth_scheme !== "none" && !data.newHarness.auth_value ? (
        <p className="fg-note">
          Secret-bearing profiles load into the draft with an empty auth value.
          Re-enter the secret before saving.
        </p>
      ) : null}

      {selectedTemplate?.profile_defaults?.capabilities?.unsupported_features
        ?.length ? (
        <p className="fg-note">
          Selected template unsupported features:{" "}
          {selectedTemplate.profile_defaults.capabilities.unsupported_features.join(
            ", ",
          )}
        </p>
      ) : null}

      <div className="fg-actions fg-mt-sm">
        <button
          type="button"
          className="ff-primary-action"
          onClick={onSave}
        >
          Save harness profile
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
