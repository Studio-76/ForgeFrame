import { useEffect, useMemo, useState } from "react";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { useAppSession } from "../app/session";
import {
  fetchMutableSettings,
  patchMutableSettings,
  resetMutableSetting,
  type MutableSettingEntry,
} from "../api/admin";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

const GROUP_ORDER: MutableSettingEntry["group"][] = [
  "runtime",
  "security",
  "providers",
  "routing",
  "tls",
  "observability",
  "ui",
];

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatSettingValue(value: string | number | boolean): string {
  return typeof value === "boolean" ? String(value) : String(value);
}

function normalizeSettingDraft(item: MutableSettingEntry, draftValue: string): string | number | boolean {
  if (item.value_type === "bool") {
    return draftValue === "true";
  }
  if (item.value_type === "float") {
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${item.label} expects a numeric value.`);
    }
    return parsed;
  }
  if (item.value_type === "int") {
    const parsed = Number(draftValue);
    if (!Number.isInteger(parsed)) {
      throw new Error(`${item.label} expects a whole-number value.`);
    }
    return parsed;
  }
  return draftValue.trim();
}

function riskTone(riskLevel: MutableSettingEntry["risk_level"]): "success" | "warning" | "danger" {
  if (riskLevel === "high") {
    return "danger";
  }
  if (riskLevel === "medium") {
    return "warning";
  }
  return "success";
}

function sourceTone(source: MutableSettingEntry["source"]): "success" | "neutral" {
  return source === "override" ? "success" : "neutral";
}

export function SettingsPage() {
  const [settings, setSettings] = useState<MutableSettingEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [selectedKey, setSelectedKey] = useState("");
  const [searchText, setSearchText] = useState("");
  const [groupFilter, setGroupFilter] = useState<MutableSettingEntry["group"] | "all">("all");
  const [operationMessage, setOperationMessage] = useState("");
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [resettingKey, setResettingKey] = useState("");
  const { session, sessionReady } = useAppSession();
  const canMutate = sessionReady && roleAllows(session?.role, "admin") && session?.read_only !== true;
  const canManageSecurity = sessionReady && sessionHasAnyInstancePermission(session, "security.write");
  const canOpenSecurity = sessionReady && (
    sessionHasAnyInstancePermission(session, "security.read")
    || sessionHasAnyInstancePermission(session, "security.write")
  );
  const accessLabel = canMutate ? "Admin mutations enabled" : sessionReady ? "Read-only review" : "Checking access";
  const accessTone = canMutate ? "success" : sessionReady ? "warning" : "neutral";
  const readOnlyDescription = !sessionReady
    ? "The page is checking the current session role before exposing any mutable system configuration controls."
    : roleAllows(session?.role, "admin") && session?.read_only === true
      ? "This admin session is read-only. You can review effective values, defaults, source, and risk, but you cannot save overrides or reset defaults."
      : "Authenticated non-admin sessions can review grouped system defaults here. Saving overrides and resetting defaults remain admin-only operations.";

  const load = async () => {
    setLoadState("loading");
    try {
      const payload = await fetchMutableSettings();
      setSettings(payload.settings);
      setDrafts(Object.fromEntries(payload.settings.map((item) => [item.key, formatSettingValue(item.effective_value)])));
      setLoadState("success");
      setError("");
    } catch (err) {
      setLoadState("error");
      setError(err instanceof Error ? err.message : "Settings loading failed.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredSettings = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return settings.filter((item) => {
      if (groupFilter !== "all" && item.group !== groupFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        item.key,
        item.label,
        item.description,
        item.group,
        item.group_label,
        item.source_label,
        item.risk_label,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [groupFilter, searchText, settings]);

  const groupedSettings = useMemo(() => {
    return GROUP_ORDER.map((group) => {
      const items = filteredSettings.filter((item) => item.group === group);
      return {
        group,
        label: settings.find((item) => item.group === group)?.group_label
          ?? group.charAt(0).toUpperCase() + group.slice(1),
        items,
      };
    });
  }, [filteredSettings, settings]);

  useEffect(() => {
    if (!filteredSettings.length) {
      setSelectedKey("");
      return;
    }
    if (!filteredSettings.some((item) => item.key === selectedKey)) {
      setSelectedKey(filteredSettings[0].key);
    }
  }, [filteredSettings, selectedKey]);

  const selectedSetting = useMemo(
    () => filteredSettings.find((item) => item.key === selectedKey) ?? settings.find((item) => item.key === selectedKey) ?? null,
    [filteredSettings, selectedKey, settings],
  );

  const handleSave = async (item: MutableSettingEntry) => {
    try {
      const nextValue = normalizeSettingDraft(item, drafts[item.key] ?? formatSettingValue(item.effective_value));
      if (item.confirmation_required) {
        const confirmed = globalThis.confirm?.(
          `${item.label} is marked ${item.risk_label.toLowerCase()}. ${item.risk_note}\n\nApply the new effective value now?`,
        );
        if (!confirmed) {
          return;
        }
      }
      setSavingKey(item.key);
      const response = await patchMutableSettings({ [item.key]: nextValue });
      setSettings(response.settings);
      setDrafts(Object.fromEntries(response.settings.map((entry) => [entry.key, formatSettingValue(entry.effective_value)])));
      setOperationMessage(response.operation.summary);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setting update failed.");
    } finally {
      setSavingKey("");
    }
  };

  const handleReset = async (item: MutableSettingEntry) => {
    try {
      if (item.confirmation_required) {
        const confirmed = globalThis.confirm?.(
          `${item.label} is marked ${item.risk_label.toLowerCase()}. ${item.risk_note}\n\nReset this setting back to its environment default?`,
        );
        if (!confirmed) {
          return;
        }
      }
      setResettingKey(item.key);
      const response = await resetMutableSetting(item.key);
      setSettings(response.settings);
      setDrafts(Object.fromEntries(response.settings.map((entry) => [entry.key, formatSettingValue(entry.effective_value)])));
      setOperationMessage(response.operation.summary);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setting reset failed.");
    } finally {
      setResettingKey("");
    }
  };

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Settings"
        title="System Settings"
        description="Grouped system defaults with effective values, environment defaults, source, mutability, risk, and reset-to-default posture."
        question="Are you reviewing the current operating defaults, or intentionally changing a risky runtime, security, TLS, or provider setting?"
        links={[
          {
            label: "System Settings",
            to: CONTROL_PLANE_ROUTES.settings,
            description: "Inspect grouped effective values, defaults, source, and override posture.",
            badge: canMutate ? undefined : "Read only",
          },
          {
            label: "Usage & Costs",
            to: CONTROL_PLANE_ROUTES.usage,
            description: "Cross-check whether a runtime or routing change is reacting to traffic, spend, or alerts.",
          },
          {
            label: "Accounts",
            to: CONTROL_PLANE_ROUTES.accounts,
            description: "Return to runtime access review when the work is identity-oriented instead of environment-oriented.",
          },
          canOpenSecurity
            ? {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: canManageSecurity
                  ? "Open policy and elevated-access posture when the change touches security controls."
                  : "Open the security review surface when the change requires operator follow-up.",
                badge: canManageSecurity ? "Admin posture" : "Review only",
              }
            : {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: "Reserved for operators and admins who can request elevated access or inspect security posture.",
                badge: "Operator or admin",
                disabled: true,
              },
        ]}
        badges={[
          { label: accessLabel, tone: accessTone },
          { label: `${settings.length} mutable settings`, tone: settings.length > 0 ? "success" : "warning" },
        ]}
        note="Settings stay grouped by operational area. Risky changes require explicit confirmation, and read-only sessions get review surfaces instead of disabled editor controls."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {operationMessage ? <p>{operationMessage}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Filter and scope</h3>
            <p className="fg-muted">Search across key, label, group, source, or risk, then narrow the review to one operational group if needed.</p>
          </div>
          <span className="fg-pill" data-tone={loadState === "success" ? "success" : loadState === "error" ? "danger" : "neutral"}>
            {loadState}
          </span>
        </div>
        <div className="fg-inline-form">
          <label>
            Search settings
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="tls mode, default provider, retention..." />
          </label>
          <label>
            Group
            <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value as MutableSettingEntry["group"] | "all")}>
              <option value="all">all groups</option>
              {GROUP_ORDER.map((group) => (
                <option key={group} value={group}>
                  {settings.find((item) => item.group === group)?.group_label ?? group}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      {!canMutate ? (
        <article className="fg-card">
          <h3>Read-Only Review</h3>
          <p className="fg-muted">{readOnlyDescription}</p>
        </article>
      ) : null}

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Settings inventory</h3>
              <p className="fg-muted">Each group shows key, effective value, default, source, mutability, and change risk without collapsing everything into an undifferentiated key-value list.</p>
            </div>
            <span className="fg-pill" data-tone={filteredSettings.length > 0 ? "success" : "warning"}>
              {filteredSettings.length} matching
            </span>
          </div>

          {loadState === "loading" ? <p className="fg-muted">Loading mutable settings.</p> : null}
          {loadState === "success" && filteredSettings.length === 0 ? <p className="fg-muted">No settings matched the current search and group filter.</p> : null}

          <div className="fg-stack">
            {groupedSettings.filter((group) => group.items.length > 0).map((group) => (
              <article key={group.group} className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{group.label}</h4>
                    <p className="fg-muted">{group.items.length} setting{group.items.length === 1 ? "" : "s"} in this group.</p>
                  </div>
                </div>
                <div className="fg-table-wrap">
                  <table className="fg-table" aria-label={`${group.label} settings`}>
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Label</th>
                        <th>Effective value</th>
                        <th>Default</th>
                        <th>Source</th>
                        <th>Mutable</th>
                        <th>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.key}>
                          <td>
                            <button className="fg-table-trigger" type="button" onClick={() => setSelectedKey(item.key)}>
                              {item.key}
                            </button>
                          </td>
                          <td>
                            <div>{item.label}</div>
                            <div className="fg-muted">{item.description}</div>
                          </td>
                          <td>{formatSettingValue(item.effective_value)}</td>
                          <td>{formatSettingValue(item.default_value)}</td>
                          <td>
                            <span className="fg-pill" data-tone={sourceTone(item.source)}>
                              {item.source_label}
                            </span>
                          </td>
                          <td>{item.mutable ? "yes" : "no"}</td>
                          <td>
                            <span className="fg-pill" data-tone={riskTone(item.risk_level)}>
                              {item.risk_label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Setting detail</h3>
              <p className="fg-muted">Review source, default, risk, and override history before applying a mutation or reset.</p>
            </div>
            {selectedSetting ? <span className="fg-pill">{selectedSetting.key}</span> : null}
          </div>

          {!selectedSetting ? (
            <p className="fg-muted">Select a setting from the grouped inventory to inspect its default, source, risk, and mutation posture.</p>
          ) : (
            <div className="fg-stack">
              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Label: {selectedSetting.label}</li>
                    <li>Group: {selectedSetting.group_label}</li>
                    <li>Value type: {selectedSetting.value_type}</li>
                    <li>Effective value: <span className="fg-code">{formatSettingValue(selectedSetting.effective_value)}</span></li>
                    <li>Default value: <span className="fg-code">{formatSettingValue(selectedSetting.default_value)}</span></li>
                    <li>Source: {selectedSetting.source_label}</li>
                    <li>Mutable: {selectedSetting.mutable ? "yes" : "no"}</li>
                  </ul>
                  <p>{selectedSetting.description}</p>
                </article>

                <article className="fg-subcard">
                  <h4>Risk and audit</h4>
                  <ul className="fg-list">
                    <li>Risk: {selectedSetting.risk_label}</li>
                    <li>Confirmation required: {selectedSetting.confirmation_required ? "yes" : "no"}</li>
                    <li>Updated at: {formatTimestamp(selectedSetting.updated_at)}</li>
                    <li>Updated by: {selectedSetting.updated_by ?? "Environment default"}</li>
                  </ul>
                  <p className={selectedSetting.risk_level === "high" ? "fg-danger" : "fg-muted"}>{selectedSetting.risk_note}</p>
                </article>
              </div>

              {canMutate ? (
                <article className="fg-subcard">
                  <div className="fg-panel-heading">
                    <div>
                      <h4>Edit and reset</h4>
                      <p className="fg-muted">Apply one override at a time and immediately refresh the effective value set after save or reset.</p>
                    </div>
                    <span className="fg-pill" data-tone={selectedSetting.overridden ? "success" : "neutral"}>
                      {selectedSetting.overridden ? "Override active" : "Using default"}
                    </span>
                  </div>

                  {selectedSetting.allowed_values.length > 0 || selectedSetting.value_type === "bool" ? (
                    <label>
                      New effective value
                      <select
                        aria-label={`${selectedSetting.label} effective value`}
                        value={drafts[selectedSetting.key] ?? formatSettingValue(selectedSetting.effective_value)}
                        onChange={(event) => setDrafts((current) => ({ ...current, [selectedSetting.key]: event.target.value }))}
                      >
                        {selectedSetting.value_type === "bool"
                          ? (
                            <>
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </>
                          )
                          : selectedSetting.allowed_values.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label>
                      New effective value
                      <input
                        aria-label={`${selectedSetting.label} effective value`}
                        value={drafts[selectedSetting.key] ?? formatSettingValue(selectedSetting.effective_value)}
                        onChange={(event) => setDrafts((current) => ({ ...current, [selectedSetting.key]: event.target.value }))}
                      />
                    </label>
                  )}

                  <p className="fg-muted">Source after save becomes a persisted override. Reset drops the override and restores the environment default shown above.</p>
                  {selectedSetting.confirmation_required ? (
                    <p className="fg-danger">This setting is marked risky. ForgeFrame will require confirmation before save or reset.</p>
                  ) : null}
                  <div className="fg-actions">
                    <button type="button" onClick={() => void handleSave(selectedSetting)} disabled={savingKey === selectedSetting.key}>
                      {savingKey === selectedSetting.key ? "Saving setting..." : "Save override"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReset(selectedSetting)}
                      disabled={!selectedSetting.overridden || resettingKey === selectedSetting.key}
                    >
                      {resettingKey === selectedSetting.key ? "Resetting..." : "Reset to default"}
                    </button>
                  </div>
                </article>
              ) : (
                <article className="fg-subcard">
                  <h4>Review only</h4>
                  <p className="fg-muted">This session can inspect grouped configuration truth, but save and reset remain unavailable. The page avoids rendering disabled edit controls when mutation permission is absent.</p>
                  {selectedSetting.overridden ? (
                    <p className="fg-muted">An override is currently active for this setting. Review `updated_by` and `updated_at` above before requesting a privileged change.</p>
                  ) : (
                    <p className="fg-muted">This setting is currently using its environment default.</p>
                  )}
                </article>
              )}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
