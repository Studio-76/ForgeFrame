import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { createAccount, fetchAccounts, updateAccount, type GatewayAccount } from "../api/domain/accounts";
import { buildAuditHistoryPath, resolveNewestAuditHistoryPathForSession } from "../app/auditHistory";
import { roleAllows } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope, withQueryParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";

import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { AdvancedDiagnostics, RawJson } from "../components/ui/AdvancedDiagnostics";
import type { Action } from "../components/ui/models/action";

import {
  AccountList,
  AccountDetailPanel,
  AccountFormDrawer,
  EMPTY_FORM,
  createFormState,
  getAccountRisk,
  searchMatches,
  validateForm,
} from "../features/accounts";

/**
 * Accounts page — runtime and client identities with lifecycle truth,
 * provider bindings, instance scope, and linked key exposure.
 *
 * Rendered inside RegistryManagementPage template with DataTable,
 * detail panel, and create/edit drawer.
 */
export function AccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState: instanceCatalogState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);

  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<GatewayAccount["status"] | "all">("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "controlled" | "review" | "attention">("all");
  const [drawerMode, setDrawerMode] = useState<"closed" | "create" | "edit">("closed");
  const [drawerForm, setDrawerForm] = useState({ label: "", providerBindingsText: "", notes: "" });
  const [auditHistoryRoute, setAuditHistoryRoute] = useState<string>(() => (
    buildAuditHistoryPath({ instanceId, window: "all", targetType: "gateway_account" })
  ));

  const canMutate = sessionReady && roleAllows(session?.role, "admin") && session?.read_only !== true;
  const instanceScopeLabel = selectedInstance?.display_name ?? selectedInstance?.instance_id ?? "Default instance path";
  const formValidation = useMemo(() => validateForm(drawerForm), [drawerForm]);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const refreshAuditHistoryRoute = async (targetId?: string | null) => {
    const route = await resolveNewestAuditHistoryPathForSession(
      session,
      sessionReady,
      [{ query: { instanceId, window: "all", targetType: "gateway_account", targetId: targetId ?? null } }],
      { instanceId, window: "all", targetType: "gateway_account", targetId: targetId ?? null },
    );
    setAuditHistoryRoute(route);
  };

  const load = async (preferredAccountId?: string | null) => {
    setLoadState("loading");
    setError("");
    try {
      const payload = await fetchAccounts(instanceId);
      setAccounts(payload.accounts);
      setLoadState("success");
      setSelectedAccountId((current) => {
        const nextId = preferredAccountId ?? current;
        if (nextId && payload.accounts.some((account) => account.account_id === nextId)) {
          return nextId;
        }
        return payload.accounts[0]?.account_id ?? null;
      });
    } catch (loadError: unknown) {
      setAccounts([]);
      setLoadState("error");
      setSelectedAccountId(null);
      setError(loadError instanceof Error ? loadError.message : "Account inventory could not be loaded.");
    }
  };

  useEffect(() => {
    void load();
  }, [instanceId]);

  useEffect(() => {
    void refreshAuditHistoryRoute();
  }, [instanceId, session, sessionReady]);

  const instanceLabels = useMemo(
    () => Object.fromEntries(instances.map((item) => [item.instance_id, item.display_name || item.instance_id])),
    [instances],
  );

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (statusFilter !== "all" && account.status !== statusFilter) {
        return false;
      }
      const risk = getAccountRisk(account);
      if (riskFilter !== "all" && risk.level !== riskFilter) {
        return false;
      }
      return searchMatches(account, instanceLabels[account.instance_id ?? ""] ?? account.instance_id ?? "", searchValue);
    });
  }, [accounts, instanceLabels, riskFilter, searchValue, statusFilter]);

  useEffect(() => {
    if (filteredAccounts.length === 0) {
      setSelectedAccountId((current) => (current && accounts.some((item) => item.account_id === current) ? current : null));
      return;
    }

    if (!selectedAccountId || !filteredAccounts.some((account) => account.account_id === selectedAccountId)) {
      setSelectedAccountId(filteredAccounts[0].account_id);
    }
  }, [accounts, filteredAccounts, selectedAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.account_id === selectedAccountId)
      ?? filteredAccounts.find((account) => account.account_id === selectedAccountId)
      ?? filteredAccounts[0]
      ?? accounts[0]
      ?? null,
    [accounts, filteredAccounts, selectedAccountId],
  );

  const selectedRisk = selectedAccount ? getAccountRisk(selectedAccount) : null;
  const selectedAccountInstanceId = selectedAccount?.instance_id ?? instanceId ?? null;
  const selectedAccountInstanceLabel = selectedAccountInstanceId
    ? (instanceLabels[selectedAccountInstanceId] ?? selectedAccountInstanceId)
    : "Default instance path";

  const selectedAccountAuditRoute = selectedAccount
    ? buildAuditHistoryPath({
        instanceId: selectedAccountInstanceId,
        window: "all",
        targetType: "gateway_account",
        targetId: selectedAccount.account_id,
      })
    : auditHistoryRoute;
  const selectedAccountKeysRoute = selectedAccount
    ? withQueryParams(CONTROL_PLANE_ROUTES.apiKeys, {
        instanceId: selectedAccountInstanceId,
        accountId: selectedAccount.account_id,
      })
    : withInstanceScope(CONTROL_PLANE_ROUTES.apiKeys, selectedAccountInstanceId);

  const isLoading = loadState === "loading" && accounts.length === 0;
  const hasError = loadState === "error";

  // ── Scope config ─────────────────────────────────────────
  const scope = instanceId
    ? {
        label: instanceScopeLabel,
        onChange: () => {
          onInstanceChange(null);
        },
      }
    : undefined;

  // ── Summary items ────────────────────────────────────────
  const summaryItems = useMemo(() => {
    const activeCount = accounts.filter((a) => a.status === "active").length;
    const riskyCount = accounts.filter((a) => getAccountRisk(a).level !== "controlled").length;
    const runtimeKeyCount = accounts.reduce((total, a) => total + (a.runtime_key_count ?? 0), 0);
    const unboundCount = accounts.filter((a) => a.provider_bindings.length === 0).length;

    return [
      {
        key: "total",
        label: "Accounts",
        value: accounts.length,
        meta: selectedInstance ? `Scoped to ${instanceScopeLabel}` : "Default account path",
      },
      {
        key: "active",
        label: "Active identities",
        value: activeCount,
        meta: `${accounts.length - activeCount} paused or disabled`,
        tone: activeCount > 0 ? ("success" as const) : ("neutral" as const),
        status: activeCount > 0 ? "ready" : "partial",
      },
      {
        key: "keys",
        label: "Runtime keys",
        value: runtimeKeyCount,
        meta: "Issued keys linked to this account inventory",
      },
      {
        key: "risk",
        label: "Needs review",
        value: riskyCount,
        meta: `${unboundCount} unbound identities`,
        tone: riskyCount > 0 ? ("warning" as const) : ("success" as const),
        status: riskyCount > 0 ? "partial" : "ready",
      },
    ];
  }, [accounts, instanceScopeLabel, selectedInstance]);

  // ── Attention items ──────────────────────────────────────
  const attentionItems: AttentionPayload[] = [];

  if (hasError && error) {
    attentionItems.push({
      key: "load-error",
      level: "primary_blocker",
      title: error,
    });
  }

  if (message) {
    attentionItems.push({
      key: "message",
      level: "informational",
      title: message,
    });
  }

  if (!canMutate) {
    attentionItems.push({
      key: "read-only",
      level: "warning",
      title: "Read-only account review",
      description: "This session can inspect identity scope, bindings, key exposure, and audit links, but it cannot mutate account profile or lifecycle.",
    });
  }

  if (instanceCatalogState === "error" && instancesError) {
    attentionItems.push({
      key: "instance-catalog-error",
      level: "diagnostic",
      title: "Instance catalog error",
      description: instancesError,
    });
  }

  // ── Page actions ─────────────────────────────────────────
  const openCreateDrawer = () => {
    setMessage("");
    setDrawerForm(EMPTY_FORM);
    setDrawerMode("create");
  };

  const openEditDrawer = () => {
    if (!selectedAccount) return;
    setMessage("");
    setDrawerForm(createFormState(selectedAccount));
    setDrawerMode("edit");
  };

  const closeDrawer = () => {
    setDrawerMode("closed");
    setDrawerForm(EMPTY_FORM);
  };

  const pageActions = useMemo<Action[] | undefined>(() => {
    if (!canMutate) return undefined;
    const actions: Action[] = [
      {
        label: "Create account",
        kind: "primary",
        intent: "configure",
        onClick: openCreateDrawer,
      },
    ];
    if (selectedAccount) {
      actions.push({
        label: "Edit selected account",
        kind: "secondary",
        intent: "configure",
        onClick: openEditDrawer,
        disabled: false,
      });
    }
    return actions;
  }, [canMutate, selectedAccount]);

  // ── Filter content ───────────────────────────────────────
  const filterContent = (
    <div className="fg-inline-form" aria-label="Account inventory filters">
      <label>
        Status
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as GatewayAccount["status"] | "all")}>
          <option value="all">all</option>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
          <option value="disabled">disabled</option>
        </select>
      </label>
      <label>
        Risk
        <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as "all" | "controlled" | "review" | "attention")}>
          <option value="all">all</option>
          <option value="controlled">controlled</option>
          <option value="review">review</option>
          <option value="attention">attention</option>
        </select>
      </label>
      <button type="button" onClick={() => void load(selectedAccount?.account_id ?? null)}>
        Refresh inventory
      </button>
    </div>
  );

  // ── CRUD handlers ────────────────────────────────────────
  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formValidation.errors.length > 0) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await createAccount(instanceId, {
        label: drawerForm.label.trim(),
        provider_bindings: formValidation.bindings,
        notes: drawerForm.notes.trim(),
      });
      closeDrawer();
      await Promise.all([load(result.account.account_id), refreshAuditHistoryRoute(result.account.account_id)]);
      setMessage(`Account '${result.account.label}' created.`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Account creation failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAccount || formValidation.errors.length > 0) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await updateAccount(instanceId, selectedAccount.account_id, {
        label: drawerForm.label.trim(),
        provider_bindings: formValidation.bindings,
        notes: drawerForm.notes.trim(),
      });
      closeDrawer();
      await Promise.all([load(result.account.account_id), refreshAuditHistoryRoute(result.account.account_id)]);
      setMessage(`Account '${result.account.label}' updated.`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Account update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleLifecycleChange = async (status: GatewayAccount["status"]) => {
    if (!selectedAccount || selectedAccount.status === status) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await updateAccount(instanceId, selectedAccount.account_id, { status });
      await Promise.all([load(result.account.account_id), refreshAuditHistoryRoute(result.account.account_id)]);
      setMessage(`Account '${result.account.label}' set to ${status.toLowerCase()}.`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Account lifecycle update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <RegistryManagementPage
        eyebrow="Governance"
        title="Accounts"
        description="Runtime and client identities with lifecycle truth, provider bindings, and scope."
        scope={scope}
        attentionItems={attentionItems}
        summaryItems={summaryItems}
        search={{
          value: searchValue,
          onChange: setSearchValue,
          placeholder: "Label, account ID, tenant, provider",
        }}
        filterContent={filterContent}
        actions={pageActions}
        selectedItemContent={
          selectedAccount ? (
            <AccountDetailPanel
              account={selectedAccount}
              instanceLabel={selectedAccountInstanceLabel}
              canMutate={canMutate}
              saving={saving}
              onEdit={openEditDrawer}
              onLifecycleChange={handleLifecycleChange}
              keysRoute={selectedAccountKeysRoute}
              auditRoute={selectedAccountAuditRoute}
              instanceRoute={withInstanceScope(CONTROL_PLANE_ROUTES.instances, selectedAccountInstanceId)}
            />
          ) : null
        }
        hasSelection={selectedAccountId != null}
        emptyDetailHint="Select an account from the table to inspect lifecycle actions, linked keys, scope, and audit history."
        diagnostics={
          <AdvancedDiagnostics title="Account diagnostics">
            <RawJson
              data={{
                loading: loadState,
                error: error || undefined,
                message: message || undefined,
                instancesLoadState: instanceCatalogState,
                instancesError: instancesError || undefined,
                instanceId: instanceId || undefined,
                totalAccounts: accounts.length,
                filteredCount: filteredAccounts.length,
                selectedAccountId,
                drawerMode,
              }}
              label="State snapshot"
            />
            <div className="fg-nav-links mt-2">
              <span
                className="fg-nav-link"
                onClick={() => void load(selectedAccount?.account_id ?? null)}
                onKeyDown={() => {}}
                role="button"
                tabIndex={0}
              >
                Refresh inventory
              </span>
              <span
                className="fg-nav-link"
                onClick={() => window.location.assign(auditHistoryRoute)}
                onKeyDown={() => {}}
                role="button"
                tabIndex={0}
              >
                Audit History
              </span>
            </div>
          </AdvancedDiagnostics>
        }
        diagnosticsTitle="Account diagnostics"
      >
        {/* Loading state */}
        {isLoading ? (
          <div className="ff-state-block" data-state="loading">
            <div className="ff-skeleton-row" />
            <strong>Loading account inventory</strong>
            <p>Fetching runtime identities, bindings, and key counts.</p>
          </div>
        ) : null}

        {/* Error state */}
        {hasError ? (
          <div className="ff-state-block" data-state="error">
            <strong>Account inventory failed to load</strong>
            <p>{error || "The account inventory request failed."}</p>
            <div className="ff-state-actions">
              <button type="button" onClick={() => void load()}>
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {/* Read-only notice */}
        {!canMutate ? (
          <div className="ff-state-block" data-state="info">
            <strong>Read-only account review</strong>
            <p>This session can inspect identity scope, bindings, key exposure, and audit links, but it cannot mutate account profile or lifecycle.</p>
          </div>
        ) : null}

        {/* Navigation links (replacing PageIntro links) */}
        <div className="flex flex-wrap gap-3 px-1 py-2 text-sm">
          <Link
            className="fg-nav-link"
            to={withQueryParams(CONTROL_PLANE_ROUTES.accounts, { instanceId })}
          >
            Accounts
          </Link>
          <Link
            className="fg-nav-link"
            to={withQueryParams(CONTROL_PLANE_ROUTES.apiKeys, { instanceId })}
          >
            API Keys
          </Link>
          <Link
            className="fg-nav-link"
            to={withInstanceScope(CONTROL_PLANE_ROUTES.instances, instanceId)}
          >
            Instances
          </Link>
          <Link
            className="fg-nav-link"
            to={auditHistoryRoute}
          >
            Audit History
          </Link>
        </div>

        {/* Edit selected account action (secondary, rendered alongside primary) */}
        {canMutate && selectedAccount ? (
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={openEditDrawer}>
              Edit selected account
            </button>
          </div>
        ) : null}

        {/* Account table */}
        {loadState === "success" ? (
          <AccountList
            accounts={accounts}
            filteredAccounts={filteredAccounts}
            selectedAccountId={selectedAccountId}
            onSelectAccount={setSelectedAccountId}
            instanceLabels={instanceLabels}
            loading={false}
            error={null}
            onRetry={() => void load()}
          />
        ) : null}

        {/* Footer note */}
        {loadState === "success" ? (
          <p className="fg-muted text-sm mt-2">
            Showing {filteredAccounts.length} of {accounts.length} runtime identities in the current instance scope.
          </p>
        ) : null}
      </RegistryManagementPage>

      {/* ── Create / Edit drawer ── */}
      <AccountFormDrawer
        mode={drawerMode}
        form={drawerForm}
        onFormChange={setDrawerForm}
        onClose={closeDrawer}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        saving={saving}
        validationErrors={formValidation.errors}
        validationPassed={formValidation.errors.length === 0}
        scopeLabel={instanceScopeLabel}
        instanceIdDisplay={selectedInstance ? `${instanceScopeLabel} (${selectedInstance.instance_id})` : "Default instance path"}
        hasSelectedAccount={selectedAccount != null}
      />
    </>
  );
}
