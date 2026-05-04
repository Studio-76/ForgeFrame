/**
 * Plugin edit/manifest form — edit selected plugin manifest contract.
 *
 * Includes basic info fields, security posture, config contract, and advanced JSON editors.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import { AdvancedDiagnostics } from "../../../components/ui/AdvancedDiagnostics";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { PluginCatalogEntry } from "../../../api/admin/plugins";
import { STATUS_OPTIONS, CONFIG_SCHEMA_TYPES, type EditPluginForm } from "../types";
import { securityTone, securityLabel, schemaRawFromFields, updateConfigRaw } from "../helpers";
import { PluginSecurityPosture } from "./PluginSecurityPosture";
import type { SchemaFieldDraft, ConfigEntryDraft } from "../types";

/** Props for PluginEditForm. */
export interface PluginEditFormProps {
  detail: PluginCatalogEntry | null;
  form: EditPluginForm;
  onChange: React.Dispatch<React.SetStateAction<EditPluginForm>>;
  canMutate: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  securityPosture: import("../../../api/admin/plugins").PluginSecurityPosture;
  editConfigSchemaError: string | null;
  editDefaultConfigError: string | null;
  editSecurityPostureError: string | null;
  editMetadataError: string | null;
  schemaFields: SchemaFieldDraft[];
  configEntries: ConfigEntryDraft[];
  unsupportedConfigKeys: string[];
  missingRequiredKeys: string[];
  hasJsonErrors: boolean;
}

/**
 * Plugin manifest edit form with structured fields and advanced JSON editors.
 */
export function PluginEditForm({
  detail,
  form,
  onChange,
  canMutate,
  saving,
  onSubmit,
  securityPosture,
  editConfigSchemaError,
  editDefaultConfigError,
  editSecurityPostureError,
  editMetadataError,
  schemaFields,
  configEntries,
  unsupportedConfigKeys,
  missingRequiredKeys,
  hasJsonErrors,
}: PluginEditFormProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Save plugin manifest</h3>
          <p className="fg-muted">Edit the selected manifest contract without blurring it into per-instance activation state.</p>
        </div>
        <StatusBadge tone={detail ? securityTone(detail) : "warning"}>
          {detail ? securityLabel(detail) : "Select plugin"}
        </StatusBadge>
      </div>
      {detail ? (
        <form className="fg-stack" onSubmit={onSubmit}>
          <div className="fg-grid fg-grid-compact">
            <label>
              Display name
              <input value={form.displayName} onChange={(event) => onChange((current) => ({ ...current, displayName: event.target.value }))} />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => onChange((current) => ({ ...current, status: event.target.value as PluginCatalogEntry["status"] }))}>
                {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Version
              <input value={form.version} onChange={(event) => onChange((current) => ({ ...current, version: event.target.value }))} />
            </label>
          </div>
          <label>
            Summary
            <textarea rows={3} value={form.summary} onChange={(event) => onChange((current) => ({ ...current, summary: event.target.value }))} />
          </label>
          <label>
            Vendor
            <input value={form.vendor} onChange={(event) => onChange((current) => ({ ...current, vendor: event.target.value }))} />
          </label>
          <label>
            Capabilities
            <input value={form.capabilities} onChange={(event) => onChange((current) => ({ ...current, capabilities: event.target.value }))} />
          </label>
          <label>
            UI slots
            <input value={form.uiSlots} onChange={(event) => onChange((current) => ({ ...current, uiSlots: event.target.value }))} />
          </label>
          <label>
            API mounts
            <input value={form.apiMounts} onChange={(event) => onChange((current) => ({ ...current, apiMounts: event.target.value }))} />
          </label>
          <label>
            Runtime surfaces
            <input value={form.runtimeSurfaces} onChange={(event) => onChange((current) => ({ ...current, runtimeSurfaces: event.target.value }))} />
          </label>

          {/* ── Security posture ── */}
          <PluginSecurityPosture
            prefix="edit"
            posture={securityPosture}
            postureJson={form.securityPostureJson}
            onPostureJsonChange={(json) => onChange((current) => ({ ...current, securityPostureJson: json }))}
          />

          {/* ── Config contract ── */}
          <section className="fg-subcard">
            <h4>Config contract</h4>
            <div className="fg-stack">
              {schemaFields.map((field, index) => (
                <div key={`edit-schema-${index}`} className="fg-inline-form">
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
              {configEntries.map((entry, index) => (
                <div key={`edit-config-${index}`} className="fg-inline-form">
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
                <p className="fg-muted">Advanced JSON still carries non-scalar default config keys: {unsupportedConfigKeys.join(", ")}.</p>
              ) : (
                <p className="fg-muted">Persisted default config stays aligned with the structured scalar editor above.</p>
              )}
              {missingRequiredKeys.length > 0 ? (
                <ul className="fg-list">
                  {missingRequiredKeys.map((key) => (
                    <li key={`edit-required-${key}`}>Required default config key missing: {key}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          {/* ── Advanced JSON ── */}
          <AdvancedDiagnostics title="Advanced manifest JSON" description="Optional raw JSON for schema, default config, security posture, or metadata." status="advanced" statusTone="neutral">
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
              {editConfigSchemaError ? <p className="fg-danger">{editConfigSchemaError}</p> : null}
              {editDefaultConfigError ? <p className="fg-danger">{editDefaultConfigError}</p> : null}
              {editSecurityPostureError ? <p className="fg-danger">{editSecurityPostureError}</p> : null}
              {editMetadataError ? <p className="fg-danger">{editMetadataError}</p> : null}
            </div>
          </AdvancedDiagnostics>

          <div className="fg-actions">
            <button
              type="submit"
              disabled={!canMutate || saving || hasJsonErrors || missingRequiredKeys.length > 0}
            >
              {saving ? "Saving plugin manifest" : "Save plugin manifest"}
            </button>
          </div>
        </form>
      ) : (
        <EmptyState title="No plugin selected" description="Pick a catalog row before editing a manifest contract." />
      )}
    </article>
  );
}
