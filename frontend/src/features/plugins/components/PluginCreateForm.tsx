/**
 * Plugin create form — guided creation of new plugin manifests.
 *
 * Includes basic info, security posture, config contract, and advanced JSON editors.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import { AdvancedDiagnostics } from "../../../components/ui/AdvancedDiagnostics";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { PluginCatalogEntry } from "../../../api/admin/plugins";
import { STATUS_OPTIONS, CONFIG_SCHEMA_TYPES, type CreatePluginForm } from "../types";
import { securityTone, securityLabel } from "../helpers";
import { PluginSecurityPosture } from "./PluginSecurityPosture";
import { schemaRawFromFields, updateConfigRaw } from "../helpers";
import type { SchemaFieldDraft, ConfigEntryDraft } from "../types";

/** Props for PluginCreateForm. */
export interface PluginCreateFormProps {
  form: CreatePluginForm;
  onChange: React.Dispatch<React.SetStateAction<CreatePluginForm>>;
  canMutate: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  securityPosture: import("../../../api/admin/plugins").PluginSecurityPosture;
  createConfigSchemaError: string | null;
  createDefaultConfigError: string | null;
  createSecurityPostureError: string | null;
  createMetadataError: string | null;
  schemaFields: SchemaFieldDraft[];
  configEntries: ConfigEntryDraft[];
  unsupportedConfigKeys: string[];
  missingRequiredKeys: string[];
  hasJsonErrors: boolean;
}

/**
 * Plugin creation form with structured fields and advanced JSON editors.
 */
export function PluginCreateForm({
  form,
  onChange,
  canMutate,
  saving,
  onSubmit,
  securityPosture,
  createConfigSchemaError,
  createDefaultConfigError,
  createSecurityPostureError,
  createMetadataError,
  schemaFields,
  configEntries,
  unsupportedConfigKeys,
  missingRequiredKeys,
  hasJsonErrors,
}: PluginCreateFormProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Create plugin manifest</h3>
          <p className="fg-muted">Register a plugin as a durable extension object. Raw JSON stays optional and advanced; the primary editor stays structured.</p>
        </div>
        <StatusBadge tone={securityTone({ security_posture: securityPosture })}>
          {securityLabel({ security_posture: securityPosture })}
        </StatusBadge>
      </div>
      <form className="fg-stack" onSubmit={onSubmit}>
        {/* ── Basic info ── */}
        <div className="fg-grid fg-grid-compact">
          <label>
            Plugin ID
            <input value={form.pluginId} onChange={(event) => onChange((current) => ({ ...current, pluginId: event.target.value }))} placeholder="plugin_review_bridge" />
          </label>
          <label>
            Display name
            <input value={form.displayName} onChange={(event) => onChange((current) => ({ ...current, displayName: event.target.value }))} placeholder="Review Bridge" />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value as PluginCatalogEntry["status"] }))}>
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <label>
          Summary
          <textarea rows={3} value={form.summary} onChange={(event) => onChange((current) => ({ ...current, summary: event.target.value }))} />
        </label>
        <div className="fg-grid fg-grid-compact">
          <label>
            Vendor
            <input value={form.vendor} onChange={(event) => onChange((current) => ({ ...current, vendor: event.target.value }))} />
          </label>
          <label>
            Version
            <input value={form.version} onChange={(event) => onChange((current) => ({ ...current, version: event.target.value }))} />
          </label>
        </div>
        <label>
          Capabilities
          <input value={form.capabilities} onChange={(event) => onChange((current) => ({ ...current, capabilities: event.target.value }))} placeholder="review.panel, artifact.render" />
        </label>
        <label>
          UI slots
          <input value={form.uiSlots} onChange={(event) => onChange((current) => ({ ...current, uiSlots: event.target.value }))} placeholder="workspaces.detail, artifacts.sidebar" />
        </label>
        <label>
          API mounts
          <input value={form.apiMounts} onChange={(event) => onChange((current) => ({ ...current, apiMounts: event.target.value }))} placeholder="/plugins/review-bridge/hooks" />
        </label>
        <label>
          Runtime surfaces
          <input value={form.runtimeSurfaces} onChange={(event) => onChange((current) => ({ ...current, runtimeSurfaces: event.target.value }))} placeholder="workspace_artifact_pipeline" />
        </label>

        {/* ── Security posture ── */}
        <PluginSecurityPosture
          prefix="create"
          posture={securityPosture}
          postureJson={form.securityPostureJson}
          onPostureJsonChange={(json) => onChange((current) => ({ ...current, securityPostureJson: json }))}
        />

        {/* ── Config contract ── */}
        <section className="fg-subcard">
          <h4>Config contract</h4>
          <p className="fg-muted">Edit contract fields and scalar default config values directly. Advanced JSON stays optional below for complex schema details.</p>
          <div className="fg-stack">
            {schemaFields.map((field, index) => (
              <div key={`create-schema-${index}`} className="fg-inline-form">
                <label>
                  Field key
                  <input
                    value={field.key}
                    onChange={(event) => onChange((current) => {
                      const nextFields = schemaFields.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, key: event.target.value } : item
                      ));
                      return { ...current, configSchemaJson: schemaRawFromFields(current.configSchemaJson, nextFields) };
                    })}
                  />
                </label>
                <label>
                  Field type
                  <select
                    value={field.type}
                    onChange={(event) => onChange((current) => {
                      const nextFields = schemaFields.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, type: event.target.value } : item
                      ));
                      return { ...current, configSchemaJson: schemaRawFromFields(current.configSchemaJson, nextFields) };
                    })}
                  >
                    {CONFIG_SCHEMA_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="fg-checkbox">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) => onChange((current) => {
                      const nextFields = schemaFields.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, required: event.target.checked } : item
                      ));
                      return { ...current, configSchemaJson: schemaRawFromFields(current.configSchemaJson, nextFields) };
                    })}
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => onChange((current) => ({
                    ...current,
                    configSchemaJson: schemaRawFromFields(current.configSchemaJson, schemaFields.filter((_, itemIndex) => itemIndex !== index)),
                  }))}
                >
                  Remove field
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange((current) => ({
                ...current,
                configSchemaJson: schemaRawFromFields(current.configSchemaJson, [...schemaFields, { key: "", type: "string", required: false }]),
              }))}
            >
              Add config field
            </button>
          </div>
          <div className="fg-stack">
            {configEntries.map((entry, index) => (
              <div key={`create-config-${index}`} className="fg-inline-form">
                <label>
                  Config key
                  <input
                    value={entry.key}
                    onChange={(event) => onChange((current) => {
                      const nextEntries = configEntries.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, key: event.target.value } : item
                      ));
                      return { ...current, defaultConfigJson: updateConfigRaw(current.defaultConfigJson, nextEntries) };
                    })}
                  />
                </label>
                <label>
                  Value type
                  <select
                    value={entry.valueType}
                    onChange={(event) => onChange((current) => {
                      const nextEntries = configEntries.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, valueType: event.target.value as "string" | "number" | "boolean" } : item
                      ));
                      return { ...current, defaultConfigJson: updateConfigRaw(current.defaultConfigJson, nextEntries) };
                    })}
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                  </select>
                </label>
                <label>
                  Value
                  <input
                    value={entry.value}
                    onChange={(event) => onChange((current) => {
                      const nextEntries = configEntries.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, value: event.target.value } : item
                      ));
                      return { ...current, defaultConfigJson: updateConfigRaw(current.defaultConfigJson, nextEntries) };
                    })}
                  />
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange((current) => ({
                ...current,
                defaultConfigJson: updateConfigRaw(current.defaultConfigJson, [...configEntries, { key: "", valueType: "string", value: "" }]),
              }))}
            >
              Add default config value
            </button>
            {unsupportedConfigKeys.length > 0 ? (
              <p className="fg-muted">Advanced JSON still carries non-scalar keys: {unsupportedConfigKeys.join(", ")}.</p>
            ) : (
              <p className="fg-muted">Default config currently stays aligned with the scalar fields above.</p>
            )}
            {missingRequiredKeys.length > 0 ? (
              <ul className="fg-list">
                {missingRequiredKeys.map((key) => (
                  <li key={`create-required-${key}`}>Required default config key missing: {key}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        {/* ── Advanced JSON (collapsible) ── */}
        <AdvancedDiagnostics title="Advanced manifest JSON" description="Optional raw JSON for complex schema or metadata cases. It is not the primary editing path." status="advanced" statusTone="neutral">
          <div className="fg-stack">
            <label>
              Config schema JSON
              <textarea rows={5} value={form.configSchemaJson} onChange={(event) => onChange((current) => ({ ...current, configSchemaJson: event.target.value }))} />
            </label>
            <label>
              Default config JSON
              <textarea rows={4} value={form.defaultConfigJson} onChange={(event) => onChange((current) => ({ ...current, defaultConfigJson: event.target.value }))} />
            </label>
            <label>
              Security posture JSON
              <textarea rows={5} value={form.securityPostureJson} onChange={(event) => onChange((current) => ({ ...current, securityPostureJson: event.target.value }))} />
            </label>
            <label>
              Metadata JSON
              <textarea rows={4} value={form.metadataJson} onChange={(event) => onChange((current) => ({ ...current, metadataJson: event.target.value }))} />
            </label>
            {createConfigSchemaError ? <p className="fg-danger">{createConfigSchemaError}</p> : null}
            {createDefaultConfigError ? <p className="fg-danger">{createDefaultConfigError}</p> : null}
            {createSecurityPostureError ? <p className="fg-danger">{createSecurityPostureError}</p> : null}
            {createMetadataError ? <p className="fg-danger">{createMetadataError}</p> : null}
          </div>
        </AdvancedDiagnostics>

        <div className="fg-actions">
          <button
            type="submit"
            disabled={!canMutate || saving || !form.displayName.trim() || hasJsonErrors || missingRequiredKeys.length > 0}
          >
            {saving ? "Creating plugin" : "Create plugin"}
          </button>
        </div>
      </form>
    </article>
  );
}
