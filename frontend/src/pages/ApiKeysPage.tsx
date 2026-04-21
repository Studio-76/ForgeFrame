import { useEffect, useState } from "react";

import {
  createRuntimeKey,
  fetchAccounts,
  fetchRuntimeKeys,
  rotateRuntimeKey,
  setRuntimeKeyStatus,
  type GatewayAccount,
  type RuntimeKey,
} from "../api/admin";

export function ApiKeysPage() {
  const [keys, setKeys] = useState<RuntimeKey[]>([]);
  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [issuedToken, setIssuedToken] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ label: "", accountId: "", scopes: "models:read,chat:write,responses:write" });

  const load = async () => {
    try {
      const [keysPayload, accountsPayload] = await Promise.all([fetchRuntimeKeys(), fetchAccounts()]);
      setKeys(keysPayload.keys);
      setAccounts(accountsPayload.accounts);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Runtime key loading failed.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    const result = await createRuntimeKey({
      label: form.label,
      account_id: form.accountId || null,
      scopes: form.scopes.split(",").map((item) => item.trim()).filter(Boolean),
    });
    setIssuedToken(result.issued.token);
    setForm({ label: "", accountId: "", scopes: "models:read,chat:write,responses:write" });
    await load();
  };

  return (
    <section>
      <h2>API Keys</h2>
      <p className="fg-muted">Runtime gateway keys with one-time display, rotation and lifecycle controls.</p>
      {error ? <p className="fg-danger">{error}</p> : null}
      <div className="fg-card" style={{ marginBottom: "1rem" }}>
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
      <div className="fg-grid">
        {keys.map((key) => (
          <article key={key.key_id} className="fg-card">
            <h3>{key.label}</h3>
            <p className="fg-muted">prefix={key.prefix} · status={key.status}</p>
            <p>account={key.account_id ?? "none"}</p>
            <p>scopes={key.scopes.join(", ")}</p>
            <div className="fg-row">
              <button type="button" onClick={() => void rotateRuntimeKey(key.key_id).then((result) => { setIssuedToken(result.issued.token); return load(); })}>Rotate</button>
              <button type="button" onClick={() => void setRuntimeKeyStatus(key.key_id, "activate").then(load)}>Activate</button>
              <button type="button" onClick={() => void setRuntimeKeyStatus(key.key_id, "disable").then(load)}>Disable</button>
              <button type="button" onClick={() => void setRuntimeKeyStatus(key.key_id, "revoke").then(load)}>Revoke</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
