/**
 * Plugin binding form — activate or deactivate a plugin for the current instance.
 *
 * Includes scope check, binding enabled toggle, config contract values,
 * enabled extension surfaces checkboxes, and notes.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import { AdvancedDiagnostics } from "../../../components/ui/AdvancedDiagnostics";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { PluginCatalogEntry } from "../../../api/admin/plugins";
import { type BindingPluginForm } from "../types";
import { csvToList, securityWarnings, updateConfigRaw } from "../helpers";
import type { ConfigEntryDraft } from "../types";

/** Props for PluginBindForm. */
export interface PluginBindFormProps {
  detail: PluginCatalogEntry | null;
  instanceId: string;
  selectedInstance: { instance_id: string; display_name: string } | null;
  form: BindingPluginForm;
  onChange: React.Dispatch<React.SetStateAction<BindingPluginForm>>;
  canMutate: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  configEntries: ConfigEntryDraft[];
  configError: string | null;
  unsupportedConfigKeys: string[];
  missingRequiredKeys: string[];
  hasJsonErrors: boolean;
}

/**
 * Plugin instance binding form with config editors and extension surface toggles.
 */
export function PluginBindForm({
  detail,
  instanceId,
  selectedInstance,
  form,
  onChange,
  canMutate,
  saving,
  onSubmit,
  configEntries,
  configError,
  unsupportedConfigKeys,
  missingRequiredKeys,
  hasJsonErrors,
}: PluginBindFormProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Save instance binding</h3>
          <p className="fg-muted">Binding is a distinct action: activate or deactivate the selected plugin for the current instance, fulfil the config contract, and keep scope truth visible.</p>
        </div>
        <StatusBadge tone={detail?.binding?.enabled ? "success" : "warning"} status={detail?.binding?.enabled ? "ready" : "partial"}>
          {detail?.binding ? "Binding exists" : "No binding yet"}
        </StatusBadge>
      </div>
      {detail ? (
        <form className="fg-stack" onSubmit={onSubmit}>
          {/* ── Scope check ── */}
          <section className="fg-subcard">
            <h4>Scope check</h4>
            <ul className="fg-list">
              <li>Selected instance: {selectedInstance?.display_name ?? instanceId}</li>
              <li>Selected plugin: {detail.display_name} ({detail.plugin_id})</li>
              <li>Manifest status: {detail.status}</li>
              <li>Activated in instances: {detail.enabled_instance_ids.join(", ") || "none"}</li>
            </ul>
            {missingRequiredKeys.length > 0 ? (
              <ul className="fg-list">
                {missingRequiredKeys.map((key) => (
                  <li key={`missing-${key}`}>Missing required config key: {key}</li>
                ))}
              </ul>
            ) : (
              <p className="fg-muted">Current binding config satisfies the required manifest keys visible from this schema.</p>
            )}
            {securityWarnings(detail).length > 0 ? (
              <p className="fg-muted">Security posture warnings stay visible here because activation is where the current instance actually picks up the plugin contract.</p>
            ) : null}
          </section>

          {detail.status !== "active" ? (
            <div
              className="ff-state-block"
              data-state="blocked"
            >
              <strong className="text-body text-primary font-semibold">Manifest is disabled</strong>
              <p className="text-meta text-muted mt-1">
                This binding can still be persisted for scope planning, but the plugin will stay runtime-blocked until the manifest is re-enabled.
              </p>
            </div>
          ) : null}

          <label>
            Binding enabled
            <select value={form.enabled} onChange={(event) => onChange((current) => ({ ...current, enabled: event.target.value as "yes" | "no" }))}>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </label>

          {/* ── Config contract values ── */}
          <section className="fg-subcard">
            <h4>Config contract values</h4>
            <div className="fg-stack">
              {configEntries.map((entry, index) => (
                <div key={`binding-config-${index}`} className="fg-inline-form">
                  <label>
                    Config key
                    <input
                      value={entry.key}
                      onChange={(event) => onChange((current) => {
                        const nextEntries = configEntries.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, key: event.target.value } : item
                        ));
                        return { ...current, configJson: updateConfigRaw(current.configJson, nextEntries) };
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
                        return { ...current, configJson: updateConfigRaw(current.configJson, nextEntries) };
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
                        return { ...current, configJson: updateConfigRaw(current.configJson, nextEntries) };
                      })}
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onChange((current) => ({
                  ...current,
                  configJson: updateConfigRaw(current.configJson, [...configEntries, { key: "", valueType: "string", value: "" }]),
                }))}
              >
                Add binding config value
              </button>
              {unsupportedConfigKeys.length > 0 ? (
                <p className="fg-muted">Advanced JSON still carries non-scalar binding config keys: {unsupportedConfigKeys.join(", ")}.</p>
              ) : (
                <p className="fg-muted">Binding config currently stays aligned with the structured scalar editor above.</p>
              )}
              {configError ? <p className="fg-danger">{configError}</p> : null}
            </div>
          </section>

          {/* ── Enabled extension surfaces ── */}
          <section className="fg-subcard">
            <h4>Enabled extension surfaces</h4>
            <div className="fg-inline-form">
              {detail.capabilities.map((capability) => {
                const currentValues = csvToList(form.enabledCapabilities);
                return (
                  <label key={`binding-capability-${capability}`} className="fg-checkbox">
                    <input
                      type="checkbox"
                      checked={currentValues.includes(capability)}
                      onChange={(event) => onChange((current) => {
                        const nextValues = event.target.checked
                          ? Array.from(new Set([...csvToList(current.enabledCapabilities), capability]))
                          : csvToList(current.enabledCapabilities).filter((item) => item !== capability);
                        return { ...current, enabledCapabilities: nextValues.join(", ") };
                      })}
                    />
                    {capability}
                  </label>
                );
              })}
            </div>
            <div className="fg-inline-form">
              {detail.ui_slots.map((slot) => {
                const currentValues = csvToList(form.enabledUiSlots);
                return (
                  <label key={`binding-slot-${slot}`} className="fg-checkbox">
                    <input
                      type="checkbox"
                      checked={currentValues.includes(slot)}
                      onChange={(event) => onChange((current) => {
                        const nextValues = event.target.checked
                          ? Array.from(new Set([...csvToList(current.enabledUiSlots), slot]))
                          : csvToList(current.enabledUiSlots).filter((item) => item !== slot);
                        return { ...current, enabledUiSlots: nextValues.join(", ") };
                      })}
                    />
                    {slot}
                  </label>
                );
              })}
            </div>
            <div className="fg-inline-form">
              {detail.api_mounts.map((mount) => {
                const currentValues = csvToList(form.enabledApiMounts);
                return (
                  <label key={`binding-mount-${mount}`} className="fg-checkbox">
                    <input
                      type="checkbox"
                      checked={currentValues.includes(mount)}
                      onChange={(event) => onChange((current) => {
                        const nextValues = event.target.checked
                          ? Array.from(new Set([...csvToList(current.enabledApiMounts), mount]))
                          : csvToList(current.enabledApiMounts).filter((item) => item !== mount);
                        return { ...current, enabledApiMounts: nextValues.join(", ") };
                      })}
                    />
                    {mount}
                  </label>
                );
              })}
            </div>
          </section>

          <label>
            Binding notes
            <textarea rows={3} value={form.notes} onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))} />
          </label>

          {/* ── Advanced JSON ── */}
          <AdvancedDiagnostics title="Advanced binding JSON" description="Optional raw JSON and CSV fallbacks for complex edits. They are not the primary activation workflow." status="advanced" statusTone="neutral">
            <div className="fg-stack">
              <label>
                Binding config JSON
                <textarea rows={5} value={form.configJson} onChange={(event) => onChange((current) => ({ ...current, configJson: event.target.value }))} />
              </label>
              <label>
                Enabled capabilities
                <input value={form.enabledCapabilities} onChange={(event) => onChange((current) => ({ ...current, enabledCapabilities: event.target.value }))} />
              </label>
              <label>
                Enabled UI slots
                <input value={form.enabledUiSlots} onChange={(event) => onChange((current) => ({ ...current, enabledUiSlots: event.target.value }))} />
              </label>
              <label>
                Enabled API mounts
                <input value={form.enabledApiMounts} onChange={(event) => onChange((current) => ({ ...current, enabledApiMounts: event.target.value }))} />
              </label>
            </div>
          </AdvancedDiagnostics>

          <div className="fg-actions">
            <button
              type="submit"
              disabled={!canMutate || saving || !instanceId || hasJsonErrors || missingRequiredKeys.length > 0}
            >
              {saving ? "Saving instance binding" : "Save instance binding"}
            </button>
          </div>
        </form>
      ) : (
        <EmptyState title="No plugin selected" description="Pick a catalog row before activating or deactivating a plugin for this instance." />
      )}
    </article>
  );
}
