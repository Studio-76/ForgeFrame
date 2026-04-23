import { useEffect, useState } from "react";

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

export function SettingsPage() {
  const [settings, setSettings] = useState<MutableSettingEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const { session, sessionReady } = useAppSession();
  const canMutate = sessionReady && roleAllows(session?.role, "admin") && session?.read_only !== true;
  const canManageSecurity = sessionReady && sessionHasAnyInstancePermission(session, "security.write");
  const canOpenSecurity = sessionReady && (
    sessionHasAnyInstancePermission(session, "security.read")
    || sessionHasAnyInstancePermission(session, "security.write")
  );
  const accessLabel = canMutate ? "Admin mutations enabled" : sessionReady ? "Read only" : "Checking access";
  const accessTone = canMutate ? "success" : sessionReady ? "warning" : "neutral";
  const readOnlyDescription = !sessionReady
    ? "The page is checking the current session role before exposing admin-only settings controls."
    : roleAllows(session?.role, "admin") && session?.read_only === true
      ? "This admin session is read-only. Open a standard admin session to save overrides or reset defaults."
      : "Authenticated non-admin sessions can inspect effective settings here, while admin users perform override and reset actions.";

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
    setDrafts(Object.fromEntries(response.settings.map((entry) => [entry.key, String(entry.effective_value)])));
  };

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Settings"
        title="System Settings"
        description="Mutable environment defaults, effective values, and reset-to-default support for the control plane."
        question="Are you reviewing the current operating defaults or applying an admin-only configuration change?"
        links={[
          {
            label: "System Settings",
            to: CONTROL_PLANE_ROUTES.settings,
            description: "Inspect current effective values and override posture.",
            badge: canMutate ? undefined : "Read only",
          },
          {
            label: "Usage & Costs",
            to: CONTROL_PLANE_ROUTES.usage,
            description: "Cross-check whether the change is tied to runtime traffic, cost, or alert pressure.",
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
                  ? "Open elevated-access workflow plus admin posture when the change touches access or security controls."
                  : "Open the elevated-access request/start flow when the change requires operator security follow-up.",
                badge: canManageSecurity ? "Admin posture" : "Request flow",
              }
            : {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: "Reserved for operators and admins who can request elevated access or inspect security posture.",
                badge: "Operator or admin",
                disabled: true,
              },
        ]}
        badges={[{ label: accessLabel, tone: accessTone }]}
        note="Settings stay visible to authenticated roles, but save and reset actions remain admin-only so the page does not imply a broader mutation envelope than the backend exposes."
      />
      {error ? <p className="fg-danger">{error}</p> : null}
      {!canMutate ? (
        <article className="fg-card">
          <h3>Read-Only Settings Review</h3>
          <p className="fg-muted">{readOnlyDescription}</p>
        </article>
      ) : null}
      <div className="fg-grid">
        {settings.map((item) => (
          <article key={item.key} className="fg-card">
            <h3>{item.label}</h3>
            <p className="fg-muted">{item.category} · {item.value_type} · overridden={String(item.overridden)}</p>
            <p>{item.description}</p>
            {item.value_type === "bool" ? (
              <select
                aria-label={`${item.label} effective value`}
                disabled={!canMutate}
                value={drafts[item.key] ?? String(item.effective_value)}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [item.key]: event.target.value }))}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                aria-label={`${item.label} effective value`}
                disabled={!canMutate}
                value={drafts[item.key] ?? String(item.effective_value)}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [item.key]: event.target.value }))}
              />
            )}
            {canMutate ? (
              <div className="fg-row" style={{ marginTop: "0.75rem" }}>
                <button type="button" onClick={() => void onSave(item)}>Save</button>
                <button type="button" onClick={() => void resetMutableSetting(item.key).then(load)}>Reset</button>
              </div>
            ) : (
              <p className="fg-muted fg-mt-sm">Admin access is required to save or reset this setting.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
