import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createRuntimeKey,
  fetchRuntimeKeyRequestPathPolicy,
  fetchRuntimeKeys,
  rotateRuntimeKey,
  setRuntimeKeyStatus,
  updateRuntimeKeyRequestPathPolicy,
  type RuntimeKey,
} from "../api/domain/runtime-keys";
import { fetchAccounts, type GatewayAccount } from "../api/domain/accounts";
import { buildAuditHistoryPath, resolveNewestAuditHistoryPathForSession } from "../app/auditHistory";
import { roleAllows } from "../app/adminAccess";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { AdvancedDiagnostics, DiagnosticSection, InternalId } from "../components/ui/AdvancedDiagnostics";
import { PermissionState } from "../components/ui/StateBlocks";
import { Button } from "../components/ui/Button";
import { RegistryManagementPage } from "../components/page-templates";
import type { Action } from "../components/ui/models/action";
import {
  ApiKeyList,
  ApiKeyDetailPanel,
  ApiKeyCreateForm,
  type IssuedSecretState,
  type LoadState,
  type DrawerMode,
  type StatusFilter,
  type RuntimeKeyPolicyDraft,
  type RuntimeKeyIssueFormState,
  normalizeQueryValue,
  keyPolicyDraft,
  validatePolicyDraft,
  validateIssueForm,
  createIssueFormState,
  searchMatches,
  ISSUE_DRAWER_FORM_ID,
} from "../features/api-keys";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";

export function ApiKeysPage() {
  const { session, sessionReady } = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const handlePolicyDraftChange = (draft: RuntimeKeyPolicyDraft) => {
    if (!selectedKey) return;
    setPolicyDrafts((current) => ({
      ...current,
      [selectedKey.key_id]: draft,
    }));
  };

  const pageActions: Action[] = useMemo(() => {
    if (!canMutate) return [];
    return [
      {
        label: "Issue runtime key",
        kind: "primary",
        intent: "configure",
        onClick: openIssueDrawer,
      },
    ];
  }, [canMutate, openIssueDrawer]);

  return (
    <>
      {/* ── Extra page-level elements outside the template ── */}

      {/* ── Scope selector (hidden when scoped via template prop) ── */}
      <div hidden={!!selectedInstance}>
        <InstanceScopeCard
          instanceId={instanceId}
          selectedInstance={selectedInstance}
          instances={instances}
          loadState={instanceCatalogState}
          error={instancesError}
          surfaceLabel="runtime key governance"
          onInstanceChange={onInstanceChange}
        />
      </div>

      {focusedAccountId ? (
        <div className="fg-card mb-4">
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
        <div className="fg-card mb-4">
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
            <Button variant="secondary" onPress={() => void handleCopySecret()}>Copy secret</Button>
            <Button variant="tertiary" onPress={() => setLatestIssuedSecret(null)}>Dismiss secret</Button>
          </div>
          {secretCopyMessage ? <p className="fg-note">{secretCopyMessage}</p> : null}
        </div>
      ) : null}

      {!canMutate ? (
        <div className="mb-4">
          <PermissionState
            title="Read-only key review"
            description="This session can inspect key scope, request-path policy, lifecycle truth, and audit links, but it cannot issue, rotate, or change key status."
          />
        </div>
      ) : null}

      {message ? <p className="fg-note mb-4">{message}</p> : null}
      {error ? <p className="fg-danger mb-4">{error}</p> : null}

      {/* ── Registry management template ── */}
      <RegistryManagementPage
        eyebrow="Governance"
        title="API Keys"
        description="Secure runtime-key issuance, rotation, status control, and request-path policy truth without reconstructing stored secrets."
        scope={selectedInstance ? {
          label: instanceScopeLabel,
          onChange: () => onInstanceChange(null),
        } : undefined}
        summaryItems={summaryItems}
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: "Label, prefix, account, scope",
        }}
        filterContent={
          <label className="flex items-center gap-2 text-meta text-muted">
            <span>Status</span>
            <select
              className="rounded border border-border bg-surface-field px-2 py-1 text-body text-primary"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">all</option>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
              <option value="revoked">revoked</option>
            </select>
            <Button variant="tertiary" density="compact" onPress={() => void load(selectedKey?.key_id ?? null)}>
              Refresh
            </Button>
          </label>
        }
        actions={pageActions}
        hasSelection={selectedKey != null}
        selectedItemContent={selectedKey ? (
          <ApiKeyDetailPanel
            runtimeKey={selectedKey}
            instanceId={instanceId}
            instanceLabel={selectedInstanceLabel}
            account={selectedAccount}
            policyDraft={selectedPolicyDraft}
            policyValidation={selectedPolicyValidation}
            policyState={policyState}
            policyError={policyError}
            auditHistoryRoute={selectedAuditHistoryRoute}
            canMutate={canMutate}
            saving={saving}
            onPolicyDraftChange={handlePolicyDraftChange}
            onPolicySave={handlePolicySave}
            onRotate={handleRotate}
            onStatusChange={handleStatusChange}
          />
        ) : undefined}
        emptyDetailHint="Select a runtime key row to inspect scope, rotation lineage, status controls, and request-path policy."
        diagnostics={
          <AdvancedDiagnostics title="API Key diagnostics" defaultOpen={false}>
            <DiagnosticSection label="Page state">
              <InternalId id={instanceId ?? "none"} label="Instance ID" />
              <p className="text-meta text-muted mt-2">
                Keys: {keys.length} total, {visibleKeys.length} visible &middot;
                Accounts: {accounts.length} &middot;
                Selected: {selectedKey?.key_id ?? "none"}
              </p>
            </DiagnosticSection>
          </AdvancedDiagnostics>
        }
      >
        <ApiKeyList
          keys={visibleKeys}
          selectedKeyId={selectedKeyId}
          onSelectedKeyChange={setSelectedKeyId}
          loadState={loadState}
          error={loadState === "error" ? error : undefined}
          onRetry={() => void load(selectedKey?.key_id ?? null)}
          accountsById={accountsById}
          instanceLabels={instanceLabels}
          totalKeys={keys.length}
          focusedAccountId={focusedAccountId}
        />
      </RegistryManagementPage>

      {/* ── Issue key drawer ── */}
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
        actions={
          <>
            <Button variant="secondary" onPress={closeDrawer}>Cancel</Button>
            <Button variant="primary" type="submit" form={ISSUE_DRAWER_FORM_ID} isDisabled={saving || !issueValidation.valid}>
              Issue key
            </Button>
          </>
        }
        onClose={closeDrawer}
      >
        <form id={ISSUE_DRAWER_FORM_ID} className="flex flex-col gap-4" onSubmit={handleIssueKey}>
          <ApiKeyCreateForm
            form={issueForm}
            onFormChange={setIssueForm}
            accounts={accounts}
            errors={issueValidation.errors}
            isValid={issueValidation.valid}
          />
        </form>
      </DetailDrawer>
    </>
  );
}
