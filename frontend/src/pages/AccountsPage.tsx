import { useEffect, useState } from "react";

import { createAccount, fetchAccounts, updateAccount, type GatewayAccount } from "../api/admin";

export function AccountsPage() {
  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ label: "", provider_bindings: "", notes: "" });

  const load = async () => {
    try {
      const payload = await fetchAccounts();
      setAccounts(payload.accounts);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accounts loading failed.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    await createAccount({
      label: form.label,
      provider_bindings: form.provider_bindings.split(",").map((item) => item.trim()).filter(Boolean),
      notes: form.notes,
    });
    setForm({ label: "", provider_bindings: "", notes: "" });
    await load();
  };

  return (
    <section>
      <h2>Accounts</h2>
      <p className="fg-muted">Runtime accounts, provider bindings and status for client identities.</p>
      {error ? <p className="fg-danger">{error}</p> : null}
      <div className="fg-card" style={{ marginBottom: "1rem" }}>
        <h3>Create Account</h3>
        <div className="fg-grid fg-grid-compact">
          <input placeholder="Account label" value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} />
          <input placeholder="Provider bindings (comma separated)" value={form.provider_bindings} onChange={(event) => setForm((prev) => ({ ...prev, provider_bindings: event.target.value }))} />
          <input placeholder="Notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          <button type="button" onClick={() => void onCreate()}>Create Account</button>
        </div>
      </div>
      <div className="fg-grid">
        {accounts.map((account) => (
          <article key={account.account_id} className="fg-card">
            <h3>{account.label}</h3>
            <p className="fg-muted">status={account.status} · runtime_keys={account.runtime_key_count ?? 0}</p>
            <p>providers: {account.provider_bindings.join(", ") || "none"}</p>
            <p>notes: {account.notes || "none"}</p>
            <div className="fg-row">
              <button type="button" onClick={() => void updateAccount(account.account_id, { status: "active" }).then(load)}>Activate</button>
              <button type="button" onClick={() => void updateAccount(account.account_id, { status: "suspended" }).then(load)}>Suspend</button>
              <button type="button" onClick={() => void updateAccount(account.account_id, { status: "disabled" }).then(load)}>Disable</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
