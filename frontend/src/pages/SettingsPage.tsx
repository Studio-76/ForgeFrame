import { useEffect, useState } from "react";

import {
  fetchMutableSettings,
  patchMutableSettings,
  resetMutableSetting,
  type MutableSettingEntry,
} from "../api/admin";

export function SettingsPage() {
  const [settings, setSettings] = useState<MutableSettingEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const payload = await fetchMutableSettings();
      setSettings(payload.settings);
      setDrafts(Object.fromEntries(payload.settings.map((item) => [item.key, String(item.effective_value)])));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settings loading failed.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async (item: MutableSettingEntry) => {
    const rawValue = drafts[item.key];
    const value = item.value_type === "bool"
      ? rawValue === "true"
      : item.value_type === "float"
        ? Number(rawValue)
        : rawValue;
    const response = await patchMutableSettings({ [item.key]: value });
    setSettings(response.settings);
  };

  return (
    <section>
      <h2>Settings</h2>
      <p className="fg-muted">Mutable operational settings with persisted overrides and reset-to-default support.</p>
      {error ? <p className="fg-danger">{error}</p> : null}
      <div className="fg-grid">
        {settings.map((item) => (
          <article key={item.key} className="fg-card">
            <h3>{item.label}</h3>
            <p className="fg-muted">{item.category} · {item.value_type} · overridden={String(item.overridden)}</p>
            <p>{item.description}</p>
            {item.value_type === "bool" ? (
              <select value={drafts[item.key] ?? String(item.effective_value)} onChange={(event) => setDrafts((prev) => ({ ...prev, [item.key]: event.target.value }))}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input value={drafts[item.key] ?? String(item.effective_value)} onChange={(event) => setDrafts((prev) => ({ ...prev, [item.key]: event.target.value }))} />
            )}
            <div className="fg-row" style={{ marginTop: "0.75rem" }}>
              <button type="button" onClick={() => void onSave(item)}>Save</button>
              <button type="button" onClick={() => void resetMutableSetting(item.key).then(load)}>Reset</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
