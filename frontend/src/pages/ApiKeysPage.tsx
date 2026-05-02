import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createRuntimeKey,
  fetchRuntimeKeyRequestPathPolicy,
  fetchRuntimeKeys,
  rotateRuntimeKey,
  setRuntimeKeyStatus,
  updateRuntimeKeyRequestPathPolicy,
  type RuntimeKey,
  type RuntimeKeyRequestPathPolicy,
} from "../api/domain/runtime-keys";
import { fetchAccounts, type GatewayAccount } from "../api/domain/accounts";
import { buildAuditHistoryPath, resolveNewestAuditHistoryPathForSession } from "../app/auditHistory";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EntityTable, type EntityTableColumn } from "../components/ui/EntityTable";
import { EmptyState, ErrorState, LoadingState, PermissionState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";
type DrawerMode = "closed" | "issue";
type StatusFilter = RuntimeKey["status"] | "all";
type PolicyValidation = {
  valid: boolean;
  errors: string[];
  policy: RuntimeKeyRequestPathPolicy;
};

type RuntimeKeyPolicyDraft = {
  allowed_request_paths: string;
  default_request_path: RuntimeKeyRequestPathPolicy["default_request_path"];
  pinned_target_key: string;
  local_only_policy: RuntimeKeyRequestPathPolicy["local_only_policy"];
  review_required_conditions: string;
};

type RuntimeKeyIssueFormState = RuntimeKeyPolicyDraft & {
  label: string;
  accountId: string;
  scopes: string;
};

type IssuedSecretState = {
  action: "issued" | "rotated";
  key_id: string;
  label: string;
  prefix: string;
  token: string;
  account_id: string | null;
  created_at: string;
};

const REQUEST_PATH_OPTIONS: RuntimeKeyRequestPathPolicy["allowed_request_paths"] = [
  "smart_routing",
  "pinned_target",
  "local_only",
  "queue_background",
  "blocked",
  "review_required",
];

const ISSUE_DRAWER_FORM_ID = "runtime-key-issue-form";

function normalizeQueryValue(value: string | null): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value || !value.trim()) {
    return "Not recorded";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().replace(".000Z", "Z").replace("T", " ");
}

function normalizeDelimitedList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function keyPolicyDraft(key?: RuntimeKey | null): RuntimeKeyPolicyDraft {
  return {
    allowed_request_paths: (key?.allowed_request_paths ?? ["smart_routing"]).join("\n"),
    default_request_path: key?.default_request_path ?? "smart_routing",
    pinned_target_key: key?.pinned_target_key ?? "",
    local_only_policy: key?.local_only_policy ?? "require_local_target",
    review_required_conditions: (key?.review_required_conditions ?? []).join("\n"),
  };
}

function validatePolicyDraft(draft: RuntimeKeyPolicyDraft): PolicyValidation {
  const errors: string[] = [];
  const rawAllowed = draft.allowed_request_paths
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = rawAllowed.filter((item): item is RuntimeKeyRequestPathPolicy["allowed_request_paths"][number] => (
    REQUEST_PATH_OPTIONS.includes(item as RuntimeKeyRequestPathPolicy["allowed_request_paths"][number])
  ));

  if (rawAllowed.length !== allowed.length) {
    errors.push("Allowed request paths contain unsupported values.");
  }
  if (rawAllowed.length !== normalizeDelimitedList(draft.allowed_request_paths).length) {
    errors.push("Allowed request paths must be unique.");
  }
  if (allowed.length === 0) {
    errors.push("At least one allowed request path is required.");
  }
  if (!REQUEST_PATH_OPTIONS.includes(draft.default_request_path)) {
    errors.push("Default request path is invalid.");
  }
  if (!allowed.includes(draft.default_request_path)) {
    errors.push("Default request path must also be allowed.");
  }
  if (allowed.includes("pinned_target") && !draft.pinned_target_key.trim()) {
    errors.push("Pinned target key is required when the pinned_target path is allowed.");
  }

  const reviewConditions = normalizeDelimitedList(draft.review_required_conditions);
  if (allowed.includes("review_required") && reviewConditions.length === 0) {
    errors.push("Review-required conditions are required when the review_required path is allowed.");
  }

  return {
    valid: errors.length === 0,
    errors,
    policy: {
      allowed_request_paths: allowed.length > 0 ? allowed : ["smart_routing"],
      default_request_path: REQUEST_PATH_OPTIONS.includes(draft.default_request_path) ? draft.default_request_path : "smart_routing",
      pinned_target_key: draft.pinned_target_key.trim() || null,
      local_only_policy: draft.local_only_policy ?? "require_local_target",
      review_required_conditions: reviewConditions,
    },
  };
}

function validateIssueForm(form: RuntimeKeyIssueFormState): PolicyValidation & { scopes: string[]; errors: string[] } {
  const policyValidation = validatePolicyDraft(form);
  const scopes = normalizeDelimitedList(form.scopes);
  const errors = [...policyValidation.errors];

  if (!form.label.trim()) {
    errors.push("Key label is required.");
  }
  if (scopes.length === 0) {
    errors.push("At least one runtime scope is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    policy: policyValidation.policy,
    scopes,
  };
}

function createIssueFormState(accountId?: string | null): RuntimeKeyIssueFormState {
  return {
    label: "",
    accountId: accountId ?? "",
    scopes: "models:read\nchat:write\nresponses:write",
    allowed_request_paths: "smart_routing",
    default_request_path: "smart_routing",
    pinned_target_key: "",
    local_only_policy: "require_local_target",
    review_required_conditions: "",
  };
}

function toneForKeyStatus(status: RuntimeKey["status"]): StatusTone {
  switch (status) {
    case "active":
      return "success";
    case "disabled":
      return "warning";
    case "revoked":
      return "danger";
    default:
      return "neutral";
  }
}

function statusLabel(status: RuntimeKey["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "disabled":
      return "Disabled";
    case "revoked":
      return "Revoked";
    default:
      return status;
  }
}

function rotationLabel(key: RuntimeKey): string {
  return key.rotated_from ? `Rotated from ${key.rotated_from}` : "Original issue";
}

function formatAllowedPaths(key: RuntimeKey): string {
  return (key.allowed_request_paths ?? ["smart_routing"]).join(", ");
}

function searchMatches(key: RuntimeKey, accountLabel: string, instanceLabel: string, value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    key.key_id,
    key.label,
    key.prefix,
    key.account_id ?? "",
    accountLabel,
    key.instance_id ?? "",
    instanceLabel,
    key.status,
    key.scopes.join(" "),
    formatAllowedPaths(key),
  ].some((item) => item.toLowerCase().includes(normalized));
}

export function ApiKeysPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const focusedAccountId = normalizeQueryValue(searchParams.get("accountId"));
  const { instances, loadState: instanceCatalogState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);

  const [keys, setKeys] = useState<RuntimeKey[]>([]);
  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [issueForm, setIssueForm] = useState<RuntimeKeyIssueFormState>(createIssueFormState());
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, RuntimeKeyPolicyDraft>>({});
  const [policyState, setPolicyState] = useState<LoadState>("idle");
  const [policyError, setPolicyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [latestIssuedSecret, setLatestIssuedSecret] = useState<IssuedSecretState | null>(null);
  const [secretCopyMessage, setSecretCopyMessage] = useState("");
  const [auditHistoryRoute, setAuditHistoryRoute] = useState<string>(() => (
    buildAuditHistoryPath({ instanceId, window: "all", targetType: "runtime_key" })
  ));

  const canMutate = sessionReady && roleAllows(session?.role, "admin") && session?.read_only !== true;
  const canOpenSecurity = sessionReady && (
    sessionHasAnyInstancePermission(session, "security.read")
    || sessionHasAnyInstancePermission(session, "security.write")
  );
  const canManageSecurity = sessionReady && sessionHasAnyInstancePermission(session, "security.write");
  const instanceScopeLabel = selectedInstance?.display_name ?? selectedInstance?.instance_id ?? "Default instance path";
  const issueValidation = useMemo(() => validateIssueForm(issueForm), [issueForm]);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    nextSearchParams.delete("accountId");
    setSearchParams(nextSearchParams);
    setLatestIssuedSecret(null);
    setSecretCopyMessage("");
  };

  const refreshAuditHistoryRoute = async (targetId?: string | null) => {
    const route = await resolveNewestAuditHistoryPathForSession(
      session,
      sessionReady,
      [{ query: { instanceId, window: "all", targetType: "runtime_key", targetId: targetId ?? null } }],
      { instanceId, window: "all", targetType: "runtime_key", targetId: targetId ?? null },
    );
    setAuditHistoryRoute(route);
  };

  const load = async (preferredKeyId?: string | null) => {
    setLoadState("loading");
    setError("");
    try {
      const [keysPayload, accountsPayload] = await Promise.all([fetchRuntimeKeys(instanceId), fetchAccounts(instanceId)]);
      setKeys(keysPayload.keys);
      setAccounts(accountsPayload.accounts);
      setLoadState("success");
      setSelectedKeyId((current) => {
        const nextId = preferredKeyId ?? current;
        if (nextId && keysPayload.keys.some((key) => key.key_id === nextId)) {
          return nextId;
        }
        return keysPayload.keys[0]?.key_id ?? null;
      });
    } catch (loadError: unknown) {
      setKeys([]);
      setAccounts([]);
      setLoadState("error");
      setSelectedKeyId(null);
      setError(loadError instanceof Error ? loadError.message : "Runtime key loading failed.");
    }
  };

  useEffect(() => {
    void load();
  }, [instanceId]);

  useEffect(() => {
    if (!focusedAccountId || !accounts.some((account) => account.account_id === focusedAccountId)) {
      return;
    }
    setIssueForm((current) => (current.accountId === focusedAccountId ? current : { ...current, accountId: focusedAccountId }));
  }, [accounts, focusedAccountId]);

  useEffect(() => {
    void refreshAuditHistoryRoute();
  }, [instanceId, session, sessionReady]);

  const accountsById = useMemo(
    () => Object.fromEntries(accounts.map((account) => [account.account_id, account])),
    [accounts],
  );
  const instanceLabels = useMemo(
    () => Object.fromEntries(instances.map((item) => [item.instance_id, item.display_name || item.instance_id])),
    [instances],
  );
  const focusedAccount = useMemo(
    () => (focusedAccountId ? accounts.find((account) => account.account_id === focusedAccountId) ?? null : null),
    [accounts, focusedAccountId],
  );
  const visibleKeys = useMemo(() => {
    const filteredByAccount = focusedAccountId ? keys.filter((key) => key.account_id === focusedAccountId) : keys;
    return filteredByAccount.filter((key) => {
      if (statusFilter !== "all" && key.status !== statusFilter) {
        return false;
      }
      const accountLabel = key.account_id ? (accountsById[key.account_id]?.label ?? key.account_id) : "Unbound";
      const keyInstanceLabel = key.instance_id ? (instanceLabels[key.instance_id] ?? key.instance_id) : "Default instance path";
      return searchMatches(key, accountLabel, keyInstanceLabel, searchValue);
    });
  }, [accountsById, focusedAccountId, instanceLabels, keys, searchValue, statusFilter]);

  useEffect(() => {
    if (visibleKeys.length === 0) {
      setSelectedKeyId((current) => (current && keys.some((item) => item.key_id === current) ? current : null));
      return;
    }
    if (!selectedKeyId || !visibleKeys.some((key) => key.key_id === selectedKeyId)) {
      setSelectedKeyId(visibleKeys[0].key_id);
    }
  }, [keys, selectedKeyId, visibleKeys]);

  const selectedKey = useMemo(
    () => keys.find((key) => key.key_id === selectedKeyId)
      ?? visibleKeys.find((key) => key.key_id === selectedKeyId)
      ?? visibleKeys[0]
      ?? keys[0]
      ?? null,
    [keys, selectedKeyId, visibleKeys],
  );

  useEffect(() => {
    let cancelled = false;

    if (!selectedKey) {
      setPolicyState("idle");
      setPolicyError("");
      return () => {
        cancelled = true;
      };
    }

    setPolicyState("loading");
    setPolicyError("");

    void fetchRuntimeKeyRequestPathPolicy(instanceId, selectedKey.key_id)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setPolicyDrafts((current) => ({
          ...current,
          [selectedKey.key_id]: {
            allowed_request_paths: payload.policy.allowed_request_paths.join("\n"),
            default_request_path: payload.policy.default_request_path,
            pinned_target_key: payload.policy.pinned_target_key ?? "",
            local_only_policy: payload.policy.local_only_policy ?? "require_local_target",
            review_required_conditions: (payload.policy.review_required_conditions ?? []).join("\n"),
          },
        }));
        setPolicyState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setPolicyState("error");
        setPolicyError(loadError instanceof Error ? loadError.message : "Request-path policy loading failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [instanceId, selectedKey]);

  const selectedAccount = selectedKey?.account_id ? (accountsById[selectedKey.account_id] ?? null) : null;
  const selectedInstanceLabel = selectedKey?.instance_id
    ? (instanceLabels[selectedKey.instance_id] ?? selectedKey.instance_id)
    : "Default instance path";
  const selectedPolicyDraft = selectedKey ? (policyDrafts[selectedKey.key_id] ?? keyPolicyDraft(selectedKey)) : null;
  const selectedPolicyValidation = selectedPolicyDraft ? validatePolicyDraft(selectedPolicyDraft) : null;
  const selectedAuditHistoryRoute = selectedKey
    ? buildAuditHistoryPath({
        instanceId: selectedKey.instance_id ?? instanceId,
        window: "all",
        targetType: "runtime_key",
        targetId: selectedKey.key_id,
      })
    : auditHistoryRoute;

  const summaryItems = useMemo<SummaryStripItem[]>(() => {
    const activeKeys = keys.filter((key) => key.status === "active").length;
    const rotatedKeys = keys.filter((key) => Boolean(key.rotated_from)).length;
    const lastUsedCount = keys.filter((key) => Boolean(key.last_used_at)).length;

    return [
      {
        key: "total",
        label: "Runtime keys",
        value: keys.length,
        meta: selectedInstance ? `Scoped to ${instanceScopeLabel}` : "Default instance path",
      },
      {
        key: "active",
        label: "Active keys",
        value: activeKeys,
        meta: `${keys.length - activeKeys} disabled or revoked`,
        tone: activeKeys > 0 ? "success" : "neutral",
        status: activeKeys > 0 ? "ready" : "partial",
      },
      {
        key: "rotated",
        label: "Rotated lineage",
        value: rotatedKeys,
        meta: "Keys carrying explicit rotation provenance",
      },
      {
        key: "used",
        label: "Used at runtime",
        value: lastUsedCount,
        meta: `${keys.length - lastUsedCount} never used`,
        tone: lastUsedCount > 0 ? "info" : "warning",
        status: lastUsedCount > 0 ? "partial" : "blocked",
      },
    ];
  }, [instanceScopeLabel, keys, selectedInstance]);

  const tableColumns = useMemo<EntityTableColumn<RuntimeKey>[]>(() => [
    {
      key: "label",
      header: "Label",
      render: (key) => (
        <div>
          <button
            type="button"
            aria-pressed={selectedKey?.key_id === key.key_id}
            onClick={() => setSelectedKeyId(key.key_id)}
          >
            {key.label}
          </button>
          <div className="fg-muted">{key.prefix}</div>
        </div>
      ),
    },
    {
      key: "account",
      header: "Account",
      render: (key) => {
        const account = key.account_id ? accountsById[key.account_id] : null;
        return (
          <div>
            <div>{account?.label ?? key.account_id ?? "No account"}</div>
            <div className="fg-muted">{key.account_id ?? "unbound"}</div>
          </div>
        );
      },
    },
    {
      key: "scope",
      header: "Instance Scope",
      render: (key) => (
        <div>
          <div>{key.instance_id ? (instanceLabels[key.instance_id] ?? key.instance_id) : "Default instance path"}</div>
          <div className="fg-muted">tenant {key.tenant_id ?? "unknown"}</div>
        </div>
      ),
    },
    {
      key: "paths",
      header: "Erlaubte Pfade",
      render: (key) => (
        <div>
          <div>{formatAllowedPaths(key)}</div>
          <div className="fg-muted">default {key.default_request_path ?? "smart_routing"}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (key) => (
        <StatusBadge tone={toneForKeyStatus(key.status)} status={key.status}>
          {statusLabel(key.status)}
        </StatusBadge>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (key) => formatTimestamp(key.created_at),
    },
    {
      key: "lastUsed",
      header: "Last Used",
      render: (key) => formatTimestamp(key.last_used_at),
    },
    {
      key: "rotation",
      header: "Rotation",
      render: (key) => rotationLabel(key),
    },
  ], [accountsById, instanceLabels, selectedKey]);

  const openIssueDrawer = () => {
    setIssueForm(createIssueFormState(focusedAccountId));
    setDrawerMode("issue");
    setMessage("");
  };

  const closeDrawer = () => {
    setDrawerMode("closed");
    setIssueForm(createIssueFormState(focusedAccountId));
  };

  const handleIssueKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!issueValidation.valid) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await createRuntimeKey(instanceId, {
        label: issueForm.label.trim(),
        account_id: issueForm.accountId || null,
        scopes: issueValidation.scopes,
        allowed_request_paths: issueValidation.policy.allowed_request_paths,
        default_request_path: issueValidation.policy.default_request_path,
        pinned_target_key: issueValidation.policy.pinned_target_key ?? null,
        local_only_policy: issueValidation.policy.local_only_policy,
        review_required_conditions: issueValidation.policy.review_required_conditions ?? [],
      });
      setLatestIssuedSecret({
        action: "issued",
        key_id: result.issued.key_id,
        label: result.issued.label,
        prefix: result.issued.prefix,
        token: result.issued.token,
        account_id: result.issued.account_id,
        created_at: result.issued.created_at,
      });
      setSecretCopyMessage("");
      closeDrawer();
      await Promise.all([load(result.issued.key_id), refreshAuditHistoryRoute(result.issued.key_id)]);
      setMessage(`Runtime key '${result.issued.label}' issued.`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Runtime key issuance failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    if (!selectedKey) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await rotateRuntimeKey(instanceId, selectedKey.key_id);
      setLatestIssuedSecret({
        action: "rotated",
        key_id: result.issued.key_id,
        label: result.issued.label,
        prefix: result.issued.prefix,
        token: result.issued.token,
        account_id: result.issued.account_id,
        created_at: result.issued.created_at,
      });
      setSecretCopyMessage("");
      await Promise.all([load(result.issued.key_id), refreshAuditHistoryRoute(result.issued.key_id)]);
      setMessage(`Runtime key '${result.issued.label}' rotated.`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Runtime key rotation failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (action: "activate" | "disable" | "revoke") => {
    if (!selectedKey) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await setRuntimeKeyStatus(instanceId, selectedKey.key_id, action);
      await Promise.all([load(result.key.key_id), refreshAuditHistoryRoute(result.key.key_id)]);
      setMessage(`Runtime key '${result.key.label}' ${action}d.`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Runtime key status update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handlePolicySave = async () => {
    if (!selectedKey || !selectedPolicyDraft || !selectedPolicyValidation?.valid) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await updateRuntimeKeyRequestPathPolicy(instanceId, selectedKey.key_id, selectedPolicyValidation.policy);
      setPolicyDrafts((current) => ({ ...current, [result.key.key_id]: keyPolicyDraft(result.key) }));
      await Promise.all([load(result.key.key_id), refreshAuditHistoryRoute(result.key.key_id)]);
      setMessage(`Request-path policy for '${result.key.label}' saved.`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Request-path policy update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopySecret = async () => {
    if (!latestIssuedSecret) {
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setSecretCopyMessage("Clipboard API unavailable in this session. Store the token securely now.");
      return;
    }
    try {
      await navigator.clipboard.writeText(latestIssuedSecret.token);
      setSecretCopyMessage("Secret copied. It will not be shown again after you leave this page state.");
    } catch (copyError: unknown) {
      setSecretCopyMessage(copyError instanceof Error ? copyError.message : "Secret copy failed.");
    }
  };

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Governance"
        title="API Keys"
        description="Secure runtime-key issuance, rotation, status control, and request-path policy truth without reconstructing stored secrets."
        question="Are you issuing a new key, rotating a live credential, or auditing runtime path scope on an existing key?"
        links={[
          {
            label: "API Keys",
            to: CONTROL_PLANE_ROUTES.apiKeys,
            description: "Review runtime key scope, lifecycle, and one-time secret events.",
          },
          {
            label: "Accounts",
            to: CONTROL_PLANE_ROUTES.accounts,
            description: "Cross-check the owning runtime identity and provider bindings.",
          },
          {
            label: "Audit History",
            to: auditHistoryRoute,
            description: "Confirm key issuance, rotation, and revocation events against the audit trail.",
          },
          canOpenSecurity
            ? {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: canManageSecurity
                  ? "Open the broader security surface when the issue exceeds runtime key lifecycle."
                  : "Request or review elevated access when runtime-key work crosses into security operations.",
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
          { label: canMutate ? "Admin mutations enabled" : "Read-only review", tone: canMutate ? "success" : "warning" },
        ]}
        note="ForgeFrame only reveals a full secret immediately after issue or rotation. Existing rows show prefix, scope, and policy truth only."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={instanceCatalogState}
        error={instancesError}
        surfaceLabel="runtime key governance"
        onInstanceChange={onInstanceChange}
      />

      <SummaryStrip items={summaryItems} />

      {focusedAccountId ? (
        <div className="fg-card">
          <h3>Focused Account Handoff</h3>
          {focusedAccount ? (
            <>
              <p>Focused account: {focusedAccount.label} ({focusedAccount.account_id}).</p>
              <p className="fg-muted">
                Filtering the runtime-key inventory to the affected account so the handoff from Accounts lands on the correct keys.
              </p>
              <p className="fg-muted">Bound providers: {focusedAccount.provider_bindings.join(", ") || "none"}.</p>
              <p className="fg-muted">{visibleKeys.length > 0 ? `${visibleKeys.length} linked key(s) currently match this account focus.` : "No keys are currently linked to this account."}</p>
            </>
          ) : (
            <p className="fg-danger">
              Focused account {focusedAccountId} is not present in the current instance scope. Clear the handoff or repair account inventory before trusting key linkage.
            </p>
          )}
        </div>
      ) : null}

      {latestIssuedSecret ? (
        <div className="fg-card">
          <h3>{latestIssuedSecret.action === "issued" ? "One-time secret: newly issued key" : "One-time secret: rotated key"}</h3>
          <p>
            Secret for <strong>{latestIssuedSecret.label}</strong> ({latestIssuedSecret.prefix}) is available exactly once from the
            {latestIssuedSecret.action === "issued" ? " issuance" : " rotation"} response.
          </p>
          <p className="fg-danger">Store this token securely now. ForgeFrame does not reconstruct or reveal it again from inventory data.</p>
          <div className="fg-subcard">
            <code>{latestIssuedSecret.token}</code>
          </div>
          <div className="fg-actions">
            <button type="button" onClick={() => void handleCopySecret()}>Copy secret</button>
            <button type="button" onClick={() => setLatestIssuedSecret(null)}>Dismiss secret</button>
          </div>
          {secretCopyMessage ? <p className="fg-note">{secretCopyMessage}</p> : null}
        </div>
      ) : null}

      {!canMutate ? (
        <PermissionState
          title="Read-only key review"
          description="This session can inspect key scope, request-path policy, lifecycle truth, and audit links, but it cannot issue, rotate, or change key status."
        />
      ) : null}

      {message ? <p className="fg-note">{message}</p> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      <ActionBar
        title="Inventory filters"
        description="Review scope, lifecycle, and request-path exposure before touching rotation or status."
        actions={canMutate ? <button type="button" onClick={openIssueDrawer}>Issue runtime key</button> : undefined}
      >
        <div className="fg-inline-form" aria-label="Runtime key inventory filters">
          <label>
            Search
            <input
              placeholder="Label, prefix, account, scope"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">all</option>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
              <option value="revoked">revoked</option>
            </select>
          </label>
          <button type="button" onClick={() => void load(selectedKey?.key_id ?? null)}>Refresh inventory</button>
        </div>
      </ActionBar>

      <div className="ff-operator-layout">
        <div className="ff-operator-main">
          {loadState === "loading" ? (
            <LoadingState title="Loading runtime keys" description="Fetching key inventory, account links, and runtime path posture." />
          ) : null}
          {loadState === "error" ? (
            <ErrorState title="Runtime key inventory failed to load" description={error || "The runtime key request failed."} action={<button type="button" onClick={() => void load()}>Retry</button>} />
          ) : null}
          {loadState === "success" ? (
            <EntityTable
              title="Runtime key inventory"
              description="Each row keeps label, owning account, instance scope, request-path allowlist, lifecycle status, timestamps, and rotation provenance visible."
              columns={tableColumns}
              rows={visibleKeys}
              rowKey={(key) => key.key_id}
              tableLabel="Runtime key inventory table"
              emptyTitle={focusedAccountId ? "No keys match the focused account" : "No keys match the current filters"}
              emptyDescription={focusedAccountId
                ? "This account currently has no runtime keys inside the selected instance scope."
                : "Adjust search or lifecycle filters to bring matching keys back into view."}
              getRowClassName={(key) => (selectedKey?.key_id === key.key_id ? "is-selected" : undefined)}
              footer={<p className="fg-muted">Showing {visibleKeys.length} of {keys.length} runtime keys in the current instance scope.</p>}
            />
          ) : null}
        </div>

        <div className="ff-operator-sidebar">
          {selectedKey ? (
            <DetailPanel
              title={selectedKey.label}
              description={`${selectedKey.prefix} · ${selectedInstanceLabel}`}
              status={statusLabel(selectedKey.status)}
              statusTone={toneForKeyStatus(selectedKey.status)}
              statusKey={selectedKey.status}
              sticky
              actions={(
                <div className="fg-actions">
                  <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.accounts, selectedKey.instance_id ?? instanceId)}>Accounts</Link>
                  <Link className="fg-nav-link" to={selectedAuditHistoryRoute}>Audit History</Link>
                  <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.instances, selectedKey.instance_id ?? instanceId)}>Affected Instance</Link>
                </div>
              )}
            >
              <div className="fg-stack">
                <section className="fg-subcard">
                  <h4>Scope and exposure</h4>
                  <p>Account: {selectedAccount?.label ?? selectedKey.account_id ?? "No bound account"}</p>
                  <p>Instance: {selectedInstanceLabel}</p>
                  <p>Tenant: {selectedKey.tenant_id ?? "unknown"}</p>
                  <p>Scopes: {selectedKey.scopes.join(", ")}</p>
                  <p>Allowed request paths: {formatAllowedPaths(selectedKey)}</p>
                  <p>Default request path: {selectedKey.default_request_path ?? "smart_routing"}</p>
                  <p>Created: {formatTimestamp(selectedKey.created_at)}</p>
                  <p>Last used: {formatTimestamp(selectedKey.last_used_at)}</p>
                </section>

                <section className="fg-subcard">
                  <h4>Rotation</h4>
                  <p>{rotationLabel(selectedKey)}</p>
                  <p>The full secret is never derived from stored key rows. Only issue/rotation responses reveal it once.</p>
                  {canMutate ? (
                    <div className="fg-actions">
                      <button type="button" disabled={saving} onClick={() => void handleRotate()}>Rotate key</button>
                    </div>
                  ) : (
                    <p className="fg-muted">Rotation controls are hidden in read-only sessions.</p>
                  )}
                </section>

                <section className="fg-subcard">
                  <h4>Status controls</h4>
                  <p>Current lifecycle: {statusLabel(selectedKey.status)}</p>
                  {canMutate ? (
                    <div className="fg-actions">
                      {selectedKey.status !== "active" ? <button type="button" disabled={saving} onClick={() => void handleStatusChange("activate")}>Activate key</button> : null}
                      {selectedKey.status !== "disabled" ? <button type="button" disabled={saving} onClick={() => void handleStatusChange("disable")}>Disable key</button> : null}
                      {selectedKey.status !== "revoked" ? <button type="button" disabled={saving} onClick={() => void handleStatusChange("revoke")}>Revoke key</button> : null}
                    </div>
                  ) : (
                    <p className="fg-muted">Lifecycle mutations are hidden in read-only sessions so the UI never implies unavailable controls.</p>
                  )}
                </section>

                <section className="fg-subcard">
                  <h4>Request-path policy</h4>
                  <p>Policy editing is separated from rotation and status so path changes never masquerade as credential lifecycle work.</p>
                  {policyState === "loading" ? <LoadingState title="Loading request-path policy" description="Fetching the persisted allowlist for the selected key." /> : null}
                  {policyState === "error" ? <ErrorState title="Request-path policy unavailable" description={policyError} /> : null}
                  {selectedPolicyDraft && policyState !== "loading" ? (
                    <div className="fg-stack">
                      <label>
                        Allowed request paths
                        <textarea
                          rows={6}
                          value={selectedPolicyDraft.allowed_request_paths}
                          onChange={(event) => setPolicyDrafts((current) => ({
                            ...current,
                            [selectedKey.key_id]: {
                              ...selectedPolicyDraft,
                              allowed_request_paths: event.target.value,
                            },
                          }))}
                          disabled={!canMutate}
                        />
                      </label>
                      <label>
                        Default request path
                        <select
                          value={selectedPolicyDraft.default_request_path}
                          onChange={(event) => setPolicyDrafts((current) => ({
                            ...current,
                            [selectedKey.key_id]: {
                              ...selectedPolicyDraft,
                              default_request_path: event.target.value as RuntimeKeyRequestPathPolicy["default_request_path"],
                            },
                          }))}
                          disabled={!canMutate}
                        >
                          {REQUEST_PATH_OPTIONS.map((path) => <option key={`${selectedKey.key_id}-${path}`} value={path}>{path}</option>)}
                        </select>
                      </label>
                      <label>
                        Pinned target key
                        <input
                          value={selectedPolicyDraft.pinned_target_key}
                          onChange={(event) => setPolicyDrafts((current) => ({
                            ...current,
                            [selectedKey.key_id]: {
                              ...selectedPolicyDraft,
                              pinned_target_key: event.target.value,
                            },
                          }))}
                          disabled={!canMutate}
                        />
                      </label>
                      <label>
                        Local-only policy
                        <select
                          value={selectedPolicyDraft.local_only_policy}
                          onChange={(event) => setPolicyDrafts((current) => ({
                            ...current,
                            [selectedKey.key_id]: {
                              ...selectedPolicyDraft,
                              local_only_policy: event.target.value as RuntimeKeyRequestPathPolicy["local_only_policy"],
                            },
                          }))}
                          disabled={!canMutate}
                        >
                          <option value="require_local_target">require_local_target</option>
                          <option value="prefer_local">prefer_local</option>
                        </select>
                      </label>
                      <label>
                        Review-required conditions
                        <textarea
                          rows={4}
                          value={selectedPolicyDraft.review_required_conditions}
                          onChange={(event) => setPolicyDrafts((current) => ({
                            ...current,
                            [selectedKey.key_id]: {
                              ...selectedPolicyDraft,
                              review_required_conditions: event.target.value,
                            },
                          }))}
                          disabled={!canMutate}
                        />
                      </label>
                      {selectedPolicyValidation && selectedPolicyValidation.errors.length > 0 ? (
                        <ul className="fg-list fg-danger">
                          {selectedPolicyValidation.errors.map((item, index) => <li key={`key-policy-error-${index}`}>{item}</li>)}
                        </ul>
                      ) : (
                        <p className="fg-muted">Request-path policy is valid and ready to save.</p>
                      )}
                      {canMutate ? (
                        <div className="fg-actions">
                          <button type="button" disabled={saving || !selectedPolicyValidation?.valid} onClick={() => void handlePolicySave()}>Save policy</button>
                        </div>
                      ) : (
                        <p className="fg-muted">Read-only sessions can inspect the persisted request-path policy but cannot change it.</p>
                      )}
                    </div>
                  ) : null}
                </section>
              </div>
            </DetailPanel>
          ) : loadState === "loading" ? (
            <LoadingState title="Preparing key detail" description="Waiting for the runtime key inventory before showing lifecycle and policy truth." />
          ) : (
            <EmptyState title="No key selected" description="Choose a runtime key row to inspect scope, rotation lineage, status controls, and request-path policy." />
          )}
        </div>
      </div>

      <DetailDrawer
        open={drawerMode === "issue"}
        title="Issue Runtime Key"
        description="Issue a new key inside the current instance scope and define its request-path policy before the secret is revealed once."
        status={issueValidation.valid ? "form ready" : "validation required"}
        statusTone={issueValidation.valid ? "success" : "danger"}
        properties={[
          { label: "Scope", value: selectedInstance ? `${instanceScopeLabel} (${selectedInstance.instance_id})` : "Default instance path" },
          { label: "Secret handling", value: "Create/rotate response only" },
        ]}
        actions={(
          <>
            <button type="button" onClick={closeDrawer}>Cancel</button>
            <button type="submit" form={ISSUE_DRAWER_FORM_ID} disabled={saving || !issueValidation.valid}>Issue key</button>
          </>
        )}
        onClose={closeDrawer}
      >
        <form id={ISSUE_DRAWER_FORM_ID} className="fg-stack" onSubmit={handleIssueKey}>
          {issueValidation.errors.length > 0 ? (
            <ul className="fg-list fg-danger">
              {issueValidation.errors.map((item, index) => <li key={`issue-key-error-${index}`}>{item}</li>)}
            </ul>
          ) : (
            <p className="fg-muted">The key-issue form passed validation and is ready to submit.</p>
          )}

          <section className="fg-subcard">
            <h4>Identity and scope</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Key label
                <input
                  value={issueForm.label}
                  onChange={(event) => setIssueForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="Primary runtime key"
                />
              </label>
              <label>
                Account
                <select value={issueForm.accountId} onChange={(event) => setIssueForm((current) => ({ ...current, accountId: event.target.value }))}>
                  <option value="">No account</option>
                  {accounts.map((account) => <option key={`issue-account-${account.account_id}`} value={account.account_id}>{account.label}</option>)}
                </select>
              </label>
              <label>
                Runtime scopes
                <textarea
                  rows={5}
                  value={issueForm.scopes}
                  onChange={(event) => setIssueForm((current) => ({ ...current, scopes: event.target.value }))}
                  placeholder={"models:read\nchat:write\nresponses:write"}
                />
              </label>
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Request-path policy</h4>
            <label>
              Allowed request paths
              <textarea
                rows={6}
                value={issueForm.allowed_request_paths}
                onChange={(event) => setIssueForm((current) => ({ ...current, allowed_request_paths: event.target.value }))}
                placeholder={"smart_routing\nlocal_only"}
              />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Default request path
                <select
                  value={issueForm.default_request_path}
                  onChange={(event) => setIssueForm((current) => ({
                    ...current,
                    default_request_path: event.target.value as RuntimeKeyRequestPathPolicy["default_request_path"],
                  }))}
                >
                  {REQUEST_PATH_OPTIONS.map((path) => <option key={`issue-default-${path}`} value={path}>{path}</option>)}
                </select>
              </label>
              <label>
                Pinned target key
                <input
                  value={issueForm.pinned_target_key}
                  onChange={(event) => setIssueForm((current) => ({ ...current, pinned_target_key: event.target.value }))}
                  placeholder="target_primary"
                />
              </label>
              <label>
                Local-only policy
                <select
                  value={issueForm.local_only_policy}
                  onChange={(event) => setIssueForm((current) => ({
                    ...current,
                    local_only_policy: event.target.value as RuntimeKeyRequestPathPolicy["local_only_policy"],
                  }))}
                >
                  <option value="require_local_target">require_local_target</option>
                  <option value="prefer_local">prefer_local</option>
                </select>
              </label>
            </div>
            <label>
              Review-required conditions
              <textarea
                rows={4}
                value={issueForm.review_required_conditions}
                onChange={(event) => setIssueForm((current) => ({ ...current, review_required_conditions: event.target.value }))}
                placeholder={"budget_exceeded\nmanual_approval"}
              />
            </label>
          </section>
        </form>
      </DetailDrawer>
    </section>
  );
}
