import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { buildAuditHistoryPath, resolveNewestAuditHistoryPathForSession } from "../app/auditHistory";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { createAccount, fetchAccounts, updateAccount, type GatewayAccount } from "../api/admin";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

export function AccountsPage() {
  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [error, setError] = useState("");
  const [auditHistoryRoute, setAuditHistoryRoute] = useState<string>(() => (
    buildAuditHistoryPath({ window: "all", targetType: "gateway_account" })
  ));
  const [form, setForm] = useState({ label: "", provider_bindings: "", notes: "" });
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const instanceScopeLabel = selectedInstance?.display_name ?? selectedInstance?.instance_id ?? "Default instance path";
  const canMutate = sessionReady && roleAllows(session?.role, "admin") && session?.read_only !== true;
  const canOpenSecurity = sessionReady && (
    sessionHasAnyInstancePermission(session, "security.read")
    || sessionHasAnyInstancePermission(session, "security.write")
  );
  const canManageSecurity = sessionReady && sessionHasAnyInstancePermission(session, "security.write");

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const load = async () => {
    try {
      const payload = await fetchAccounts(instanceId);
      setAccounts(payload.accounts);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accounts loading failed.");
    }
  };

  useEffect(() => {
    void load();
  }, [instanceId]);

  const refreshAuditHistoryRoute = async (targetId?: string | null) => {
    const route = await resolveNewestAuditHistoryPathForSession(
      session,
      sessionReady,
      [{ query: { instanceId, window: "all", targetType: "gateway_account", targetId: targetId ?? null } }],
      { instanceId, window: "all", targetType: "gateway_account", targetId: targetId ?? null },
    );
    setAuditHistoryRoute(route);
  };

  useEffect(() => {
    void refreshAuditHistoryRoute();
  }, [session, sessionReady, instanceId]);

  const onCreate = async () => {
    const result = await createAccount(instanceId, {
      label: form.label,
      provider_bindings: form.provider_bindings.split(",").map((item) => item.trim()).filter(Boolean),
      notes: form.notes,
    });
    setForm({ label: "", provider_bindings: "", notes: "" });
    await Promise.all([load(), refreshAuditHistoryRoute(result.account.account_id)]);
  };

  const onUpdateStatus = async (accountId: string, status: string) => {
    await updateAccount(instanceId, accountId, { status });
    await Promise.all([load(), refreshAuditHistoryRoute(accountId)]);
  };

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Governance"
        title="Accounts"
        description="Runtime account inventory, provider bindings, and downstream access posture for client identities."
        question="Are you reviewing runtime identities, issuing related keys, or cross-checking the audit trail?"
        links={[
          {
            label: "Accounts",
            to: CONTROL_PLANE_ROUTES.accounts,
            description: "Review runtime account posture and linked provider bindings.",
          },
          {
            label: "API Keys",
            to: CONTROL_PLANE_ROUTES.apiKeys,
            description: "Move from account review to key issuance or lifecycle checks.",
          },
          {
            label: "Audit History",
            to: auditHistoryRoute,
            description: "Confirm runtime access changes against the audit trail.",
          },
          canOpenSecurity
            ? {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: canManageSecurity
                  ? "Jump to elevated-access workflow plus admin bootstrap and session posture."
                  : "Request break-glass access or review your elevated-access history when the task exceeds runtime identities.",
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
        badges={[
          { label: selectedInstance ? `Instance scope: ${instanceScopeLabel}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: canMutate ? "Admin mutations enabled" : "Read only", tone: canMutate ? "success" : "warning" },
        ]}
        note="Runtime account inventory stays operator-visible. Lifecycle mutations remain admin-only so the page does not imply a broader permission envelope than the backend provides."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="runtime account governance"
        onInstanceChange={onInstanceChange}
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {canMutate ? (
        <div className="fg-card">
          <h3>Create Account</h3>
          <div className="fg-grid fg-grid-compact">
            <input placeholder="Account label" value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} />
            <input placeholder="Provider bindings (comma separated)" value={form.provider_bindings} onChange={(event) => setForm((prev) => ({ ...prev, provider_bindings: event.target.value }))} />
            <input placeholder="Notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            <button type="button" onClick={() => void onCreate()}>Create Account</button>
          </div>
        </div>
      ) : (
        <div className="fg-card">
          <h3>Read-Only Runtime Access Review</h3>
          <p className="fg-muted">Operators and read-only sessions can inspect account posture here, while admin users perform lifecycle changes.</p>
        </div>
      )}
      <div className="fg-grid">
        {accounts.map((account) => (
          <article key={account.account_id} className="fg-card">
            <h3>{account.label}</h3>
            <p className="fg-muted">
              instance={account.instance_id ?? "unknown"} · tenant={account.tenant_id ?? "unknown"} · status={account.status} · runtime_keys={account.runtime_key_count ?? 0}
            </p>
            <p>providers: {account.provider_bindings.join(", ") || "none"}</p>
            <p>notes: {account.notes || "none"}</p>
            {canMutate ? (
              <div className="fg-row">
                <button type="button" onClick={() => void onUpdateStatus(account.account_id, "active")}>Activate</button>
                <button type="button" onClick={() => void onUpdateStatus(account.account_id, "suspended")}>Suspend</button>
                <button type="button" onClick={() => void onUpdateStatus(account.account_id, "disabled")}>Disable</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
