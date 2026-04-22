import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { buildAuditHistoryPath, resolveNewestAuditHistoryPathForSession } from "../app/auditHistory";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getTenantIdFromSearchParams } from "../app/tenantScope";
import {
  createRuntimeKey,
  fetchAccounts,
  fetchRuntimeKeys,
  rotateRuntimeKey,
  setRuntimeKeyStatus,
  type GatewayAccount,
  type RuntimeKey,
} from "../api/admin";
import { PageIntro } from "../components/PageIntro";

export function ApiKeysPage() {
  const [keys, setKeys] = useState<RuntimeKey[]>([]);
  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [issuedToken, setIssuedToken] = useState("");
  const [error, setError] = useState("");
  const [auditHistoryRoute, setAuditHistoryRoute] = useState<string>(() => (
    buildAuditHistoryPath({ window: "all", targetType: "runtime_key" })
  ));
  const [form, setForm] = useState({ label: "", accountId: "", scopes: "models:read,chat:write,responses:write" });
  const { session, sessionReady } = useAppSession();
  const [searchParams] = useSearchParams();
  const tenantId = getTenantIdFromSearchParams(searchParams);
  const selectedAccount = accounts.find((account) => account.account_id === tenantId) ?? null;
  const tenantScopeLabel = tenantId ? selectedAccount?.label ?? tenantId : "Shared key inventory";
  const canMutate = sessionReady && session?.role === "admin" && !session.read_only;

  const load = async () => {
    try {
      const [keysPayload, accountsPayload] = await Promise.all([fetchRuntimeKeys(tenantId), fetchAccounts(tenantId)]);
      setKeys(keysPayload.keys);
      setAccounts(accountsPayload.accounts);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Runtime key loading failed.");
    }
  };

  useEffect(() => {
    void load();
  }, [tenantId]);

  const refreshAuditHistoryRoute = async (targetId?: string | null) => {
    const route = await resolveNewestAuditHistoryPathForSession(
      session,
      sessionReady,
      [{ query: { tenantId, window: "all", targetType: "runtime_key", targetId: targetId ?? null } }],
      { tenantId, window: "all", targetType: "runtime_key", targetId: targetId ?? null },
    );
    setAuditHistoryRoute(route);
  };

  useEffect(() => {
    void refreshAuditHistoryRoute();
  }, [session, sessionReady, tenantId]);

  const onCreate = async () => {
    const result = await createRuntimeKey({
      label: form.label,
      account_id: form.accountId || null,
      scopes: form.scopes.split(",").map((item) => item.trim()).filter(Boolean),
    });
    setIssuedToken(result.issued.token);
    setForm({ label: "", accountId: "", scopes: "models:read,chat:write,responses:write" });
    await Promise.all([load(), refreshAuditHistoryRoute(result.issued.key_id)]);
  };

  const onRotate = async (keyId: string) => {
    const result = await rotateRuntimeKey(keyId);
    setIssuedToken(result.issued.token);
    await Promise.all([load(), refreshAuditHistoryRoute(result.issued.key_id)]);
  };

  const onSetStatus = async (keyId: string, action: "activate" | "disable" | "revoke") => {
    const result = await setRuntimeKeyStatus(keyId, action);
    await Promise.all([load(), refreshAuditHistoryRoute(result.key.key_id)]);
  };

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Governance"
        title="API Keys"
        description="Runtime gateway keys with one-time secret display, rotation history, and lifecycle posture."
        question="Are you issuing a new runtime key, reviewing an existing secret, or tracing the audit path behind a change?"
        links={[
          {
            label: "API Keys",
            to: CONTROL_PLANE_ROUTES.apiKeys,
            description: "Review runtime key status, account linkage, and current scope.",
          },
          {
            label: "Accounts",
            to: CONTROL_PLANE_ROUTES.accounts,
            description: "Cross-check the runtime identity that owns the key.",
          },
          {
            label: "Audit History",
            to: auditHistoryRoute,
            description: "Confirm high-risk key changes against the audit trail.",
          },
          sessionReady && session && session.role !== "viewer"
            ? {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: session.role === "admin"
                  ? "Jump into elevated-access workflow plus admin posture when the issue extends beyond runtime keys."
                  : "Open the elevated-access request/start flow when the task crosses into incident or break-glass work.",
                badge: session.role === "admin" ? "Admin posture" : "Request flow",
              }
            : {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: "Security request/start flow and admin posture remain outside the viewer permission envelope.",
                badge: "Operator or admin",
                disabled: true,
              },
        ]}
        badges={[
          { label: tenantId ? `Tenant scope: ${tenantScopeLabel}` : "Shared key inventory", tone: tenantId ? "success" : "neutral" },
          { label: canMutate ? "Admin mutations enabled" : "Read only", tone: canMutate ? "success" : "warning" },
        ]}
        note="Key inventory is operator-visible, but issuance, rotation, disable, and revoke flows stay admin-only. One-time secret display is still explicit so the UI does not imply a recoverable token later."
      />
      {error ? <p className="fg-danger">{error}</p> : null}
      {canMutate ? (
        <div className="fg-card">
          <h3>Issue Runtime Key</h3>
          <div className="fg-grid fg-grid-compact">
            <input placeholder="Label" value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} />
            <select value={form.accountId} onChange={(event) => setForm((prev) => ({ ...prev, accountId: event.target.value }))}>
              <option value="">No account</option>
              {accounts.map((account) => <option key={account.account_id} value={account.account_id}>{account.label}</option>)}
            </select>
            <input placeholder="Scopes comma separated" value={form.scopes} onChange={(event) => setForm((prev) => ({ ...prev, scopes: event.target.value }))} />
            <button type="button" onClick={() => void onCreate()}>Create Key</button>
          </div>
          {issuedToken ? (
            <p className="fg-danger" style={{ marginTop: "0.75rem" }}>
              One-time token display: <code>{issuedToken}</code>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="fg-card">
          <h3>Read-Only Key Posture</h3>
          <p className="fg-muted">Read-only sessions can inspect runtime keys here, while admin users handle issuance and lifecycle mutations.</p>
          {issuedToken ? (
            <p className="fg-danger" style={{ marginTop: "0.75rem" }}>
              One-time token display: <code>{issuedToken}</code>
            </p>
          ) : null}
        </div>
      )}
      <div className="fg-grid">
        {keys.map((key) => (
          <article key={key.key_id} className="fg-card">
            <h3>{key.label}</h3>
            <p className="fg-muted">prefix={key.prefix} · status={key.status}</p>
            <p>account={key.account_id ?? "none"}</p>
            <p>scopes={key.scopes.join(", ")}</p>
            {canMutate ? (
              <div className="fg-row">
                <button type="button" onClick={() => void onRotate(key.key_id)}>Rotate</button>
                <button type="button" onClick={() => void onSetStatus(key.key_id, "activate")}>Activate</button>
                <button type="button" onClick={() => void onSetStatus(key.key_id, "disable")}>Disable</button>
                <button type="button" onClick={() => void onSetStatus(key.key_id, "revoke")}>Revoke</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
