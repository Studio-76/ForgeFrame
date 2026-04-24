import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { buildAuditHistoryPath, resolveNewestAuditHistoryPathForSession } from "../app/auditHistory";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import {
  createRuntimeKey,
  fetchAccounts,
  fetchRuntimeKeys,
  rotateRuntimeKey,
  setRuntimeKeyStatus,
  updateRuntimeKeyRequestPathPolicy,
  type GatewayAccount,
  type RuntimeKey,
  type RuntimeKeyRequestPathPolicy,
} from "../api/admin";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";

const REQUEST_PATH_OPTIONS: RuntimeKeyRequestPathPolicy["allowed_request_paths"] = [
  "smart_routing",
  "pinned_target",
  "local_only",
  "queue_background",
  "blocked",
  "review_required",
];

type RuntimeKeyPolicyDraft = {
  allowed_request_paths: string;
  default_request_path: RuntimeKeyRequestPathPolicy["default_request_path"];
  pinned_target_key: string;
  local_only_policy: RuntimeKeyRequestPathPolicy["local_only_policy"];
  review_required_conditions: string;
};

function keyPolicyDraft(key?: RuntimeKey | null): RuntimeKeyPolicyDraft {
  return {
    allowed_request_paths: (key?.allowed_request_paths ?? ["smart_routing"]).join(", "),
    default_request_path: key?.default_request_path ?? "smart_routing",
    pinned_target_key: key?.pinned_target_key ?? "",
    local_only_policy: key?.local_only_policy ?? "require_local_target",
    review_required_conditions: (key?.review_required_conditions ?? []).join(", "),
  };
}

function normalizePolicyDraft(draft: RuntimeKeyPolicyDraft): RuntimeKeyRequestPathPolicy {
  const allowed = draft.allowed_request_paths
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is RuntimeKeyRequestPathPolicy["allowed_request_paths"][number] => REQUEST_PATH_OPTIONS.includes(item as RuntimeKeyRequestPathPolicy["allowed_request_paths"][number]));
  const defaultRequestPath = REQUEST_PATH_OPTIONS.includes(draft.default_request_path)
    ? draft.default_request_path
    : "smart_routing";
  const normalizedAllowed = allowed.includes(defaultRequestPath) ? allowed : [defaultRequestPath, ...allowed];
  return {
    allowed_request_paths: normalizedAllowed.length ? normalizedAllowed : ["smart_routing"],
    default_request_path: defaultRequestPath,
    pinned_target_key: draft.pinned_target_key.trim() || null,
    local_only_policy: draft.local_only_policy ?? "require_local_target",
    review_required_conditions: draft.review_required_conditions.split(",").map((item) => item.trim()).filter(Boolean),
  };
}

export function ApiKeysPage() {
  const [keys, setKeys] = useState<RuntimeKey[]>([]);
  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, RuntimeKeyPolicyDraft>>({});
  const [issuedToken, setIssuedToken] = useState("");
  const [error, setError] = useState("");
  const [auditHistoryRoute, setAuditHistoryRoute] = useState<string>(() => (
    buildAuditHistoryPath({ window: "all", targetType: "runtime_key" })
  ));
  const [form, setForm] = useState({
    label: "",
    accountId: "",
    scopes: "models:read,chat:write,responses:write",
    allowed_request_paths: "smart_routing",
    default_request_path: "smart_routing" as RuntimeKeyRequestPathPolicy["default_request_path"],
    pinned_target_key: "",
    local_only_policy: "require_local_target" as RuntimeKeyRequestPathPolicy["local_only_policy"],
    review_required_conditions: "",
  });
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
      const [keysPayload, accountsPayload] = await Promise.all([fetchRuntimeKeys(instanceId), fetchAccounts(instanceId)]);
      setKeys(keysPayload.keys);
      setAccounts(accountsPayload.accounts);
      setPolicyDrafts(
        Object.fromEntries(keysPayload.keys.map((key) => [key.key_id, keyPolicyDraft(key)])),
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Runtime key loading failed.");
    }
  };

  useEffect(() => {
    void load();
  }, [instanceId]);

  const refreshAuditHistoryRoute = async (targetId?: string | null) => {
    const route = await resolveNewestAuditHistoryPathForSession(
      session,
      sessionReady,
      [{ query: { instanceId, window: "all", targetType: "runtime_key", targetId: targetId ?? null } }],
      { instanceId, window: "all", targetType: "runtime_key", targetId: targetId ?? null },
    );
    setAuditHistoryRoute(route);
  };

  useEffect(() => {
    void refreshAuditHistoryRoute();
  }, [session, sessionReady, instanceId]);

  const onCreate = async () => {
    const policy = normalizePolicyDraft({
      allowed_request_paths: form.allowed_request_paths,
      default_request_path: form.default_request_path,
      pinned_target_key: form.pinned_target_key,
      local_only_policy: form.local_only_policy,
      review_required_conditions: form.review_required_conditions,
    });
    const result = await createRuntimeKey(instanceId, {
      label: form.label,
      account_id: form.accountId || null,
      scopes: form.scopes.split(",").map((item) => item.trim()).filter(Boolean),
      allowed_request_paths: policy.allowed_request_paths,
      default_request_path: policy.default_request_path,
      pinned_target_key: policy.pinned_target_key ?? null,
      local_only_policy: policy.local_only_policy,
      review_required_conditions: policy.review_required_conditions ?? [],
    });
    setIssuedToken(result.issued.token);
    setForm({
      label: "",
      accountId: "",
      scopes: "models:read,chat:write,responses:write",
      allowed_request_paths: "smart_routing",
      default_request_path: "smart_routing",
      pinned_target_key: "",
      local_only_policy: "require_local_target",
      review_required_conditions: "",
    });
    await Promise.all([load(), refreshAuditHistoryRoute(result.issued.key_id)]);
  };

  const onRotate = async (keyId: string) => {
    const result = await rotateRuntimeKey(instanceId, keyId);
    setIssuedToken(result.issued.token);
    await Promise.all([load(), refreshAuditHistoryRoute(result.issued.key_id)]);
  };

  const onSetStatus = async (keyId: string, action: "activate" | "disable" | "revoke") => {
    const result = await setRuntimeKeyStatus(instanceId, keyId, action);
    await Promise.all([load(), refreshAuditHistoryRoute(result.key.key_id)]);
  };

  const onPolicySave = async (keyId: string) => {
    const draft = policyDrafts[keyId];
    if (!draft) {
      return;
    }
    const result = await updateRuntimeKeyRequestPathPolicy(instanceId, keyId, normalizePolicyDraft(draft));
    setPolicyDrafts((prev) => ({ ...prev, [keyId]: keyPolicyDraft(result.key) }));
    await Promise.all([load(), refreshAuditHistoryRoute(keyId)]);
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
          canOpenSecurity
            ? {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: canManageSecurity
                  ? "Jump into elevated-access workflow plus admin posture when the issue extends beyond runtime keys."
                  : "Open the elevated-access request/start flow when the task crosses into incident or break-glass work.",
                badge: canManageSecurity ? "Admin posture" : "Request flow",
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
          { label: selectedInstance ? `Instance scope: ${instanceScopeLabel}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: canMutate ? "Admin mutations enabled" : "Read only", tone: canMutate ? "success" : "warning" },
        ]}
        note="Key inventory is operator-visible, but issuance, rotation, disable, and revoke flows stay admin-only. One-time secret display is still explicit so the UI does not imply a recoverable token later."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="runtime key governance"
        onInstanceChange={onInstanceChange}
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
            <input
              placeholder="Allowed request paths"
              value={form.allowed_request_paths}
              onChange={(event) => setForm((prev) => ({ ...prev, allowed_request_paths: event.target.value }))}
            />
            <select
              value={form.default_request_path}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                default_request_path: event.target.value as RuntimeKeyRequestPathPolicy["default_request_path"],
              }))}
            >
              {REQUEST_PATH_OPTIONS.map((path) => <option key={path} value={path}>{path}</option>)}
            </select>
            <input
              placeholder="Pinned target key"
              value={form.pinned_target_key}
              onChange={(event) => setForm((prev) => ({ ...prev, pinned_target_key: event.target.value }))}
            />
            <select
              value={form.local_only_policy}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                local_only_policy: event.target.value as RuntimeKeyRequestPathPolicy["local_only_policy"],
              }))}
            >
              <option value="require_local_target">require_local_target</option>
              <option value="prefer_local">prefer_local</option>
            </select>
            <input
              placeholder="Review-required conditions"
              value={form.review_required_conditions}
              onChange={(event) => setForm((prev) => ({ ...prev, review_required_conditions: event.target.value }))}
            />
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
            <p className="fg-muted">
              instance={key.instance_id ?? "unknown"} · tenant={key.tenant_id ?? "unknown"} · prefix={key.prefix} · status={key.status}
            </p>
            <p>account={key.account_id ?? "none"}</p>
            <p>scopes={key.scopes.join(", ")}</p>
            <p>request path default={key.default_request_path ?? "smart_routing"}</p>
            <p>allowed paths={(key.allowed_request_paths ?? ["smart_routing"]).join(", ")}</p>
            <p>pinned target={key.pinned_target_key ?? "none"}</p>
            <p>local-only policy={key.local_only_policy ?? "require_local_target"}</p>
            <p>review conditions={(key.review_required_conditions ?? []).join(", ") || "none"}</p>
            {canMutate ? (
              <>
                <div className="fg-grid fg-grid-compact" style={{ marginTop: "0.75rem" }}>
                  <input
                    placeholder="Allowed request paths"
                    value={policyDrafts[key.key_id]?.allowed_request_paths ?? keyPolicyDraft(key).allowed_request_paths}
                    onChange={(event) => setPolicyDrafts((prev) => ({
                      ...prev,
                      [key.key_id]: {
                        ...(prev[key.key_id] ?? keyPolicyDraft(key)),
                        allowed_request_paths: event.target.value,
                      },
                    }))}
                  />
                  <select
                    value={policyDrafts[key.key_id]?.default_request_path ?? key.default_request_path ?? "smart_routing"}
                    onChange={(event) => setPolicyDrafts((prev) => ({
                      ...prev,
                      [key.key_id]: {
                        ...(prev[key.key_id] ?? keyPolicyDraft(key)),
                        default_request_path: event.target.value as RuntimeKeyRequestPathPolicy["default_request_path"],
                      },
                    }))}
                  >
                    {REQUEST_PATH_OPTIONS.map((path) => <option key={path} value={path}>{path}</option>)}
                  </select>
                  <input
                    placeholder="Pinned target key"
                    value={policyDrafts[key.key_id]?.pinned_target_key ?? key.pinned_target_key ?? ""}
                    onChange={(event) => setPolicyDrafts((prev) => ({
                      ...prev,
                      [key.key_id]: {
                        ...(prev[key.key_id] ?? keyPolicyDraft(key)),
                        pinned_target_key: event.target.value,
                      },
                    }))}
                  />
                  <select
                    value={policyDrafts[key.key_id]?.local_only_policy ?? key.local_only_policy ?? "require_local_target"}
                    onChange={(event) => setPolicyDrafts((prev) => ({
                      ...prev,
                      [key.key_id]: {
                        ...(prev[key.key_id] ?? keyPolicyDraft(key)),
                        local_only_policy: event.target.value as RuntimeKeyRequestPathPolicy["local_only_policy"],
                      },
                    }))}
                  >
                    <option value="require_local_target">require_local_target</option>
                    <option value="prefer_local">prefer_local</option>
                  </select>
                  <input
                    placeholder="Review-required conditions"
                    value={policyDrafts[key.key_id]?.review_required_conditions ?? (key.review_required_conditions ?? []).join(", ")}
                    onChange={(event) => setPolicyDrafts((prev) => ({
                      ...prev,
                      [key.key_id]: {
                        ...(prev[key.key_id] ?? keyPolicyDraft(key)),
                        review_required_conditions: event.target.value,
                      },
                    }))}
                  />
                </div>
                <div className="fg-row">
                  <button type="button" onClick={() => void onRotate(key.key_id)}>Rotate</button>
                  <button type="button" onClick={() => void onSetStatus(key.key_id, "activate")}>Activate</button>
                  <button type="button" onClick={() => void onSetStatus(key.key_id, "disable")}>Disable</button>
                  <button type="button" onClick={() => void onSetStatus(key.key_id, "revoke")}>Revoke</button>
                  <button type="button" onClick={() => void onPolicySave(key.key_id)}>Save Policy</button>
                </div>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
