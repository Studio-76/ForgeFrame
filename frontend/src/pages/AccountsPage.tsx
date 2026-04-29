import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { createAccount, fetchAccounts, updateAccount, type GatewayAccount } from "../api/admin";
import { buildAuditHistoryPath, resolveNewestAuditHistoryPathForSession } from "../app/auditHistory";
import { roleAllows } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope, withQueryParams } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { DetailDrawer } from "../components/ui/DetailDrawer";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EntityTable, type EntityTableColumn } from "../components/ui/EntityTable";
import { BlockedState, EmptyState, ErrorState, LoadingState, PermissionState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";
type DrawerMode = "closed" | "create" | "edit";
type StatusFilter = GatewayAccount["status"] | "all";
type RiskFilter = "all" | "controlled" | "review" | "attention";

type AccountFormState = {
  label: string;
  providerBindingsText: string;
  notes: string;
};

type AccountRiskSummary = {
  level: Exclude<RiskFilter, "all">;
  label: string;
  detail: string;
  tone: StatusTone;
  statusKey: "ready" | "partial" | "blocked";
};

const EMPTY_FORM: AccountFormState = {
  label: "",
  providerBindingsText: "",
  notes: "",
};

const DRAWER_FORM_ID = "account-drawer-form";

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

function normalizeProviderBindings(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function validateForm(form: AccountFormState): { bindings: string[]; errors: string[] } {
  const bindings = normalizeProviderBindings(form.providerBindingsText);
  const errors: string[] = [];

  if (!form.label.trim()) {
    errors.push("Account label is required.");
  }

  const rawBindings = form.providerBindingsText
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (rawBindings.length !== bindings.length) {
    errors.push("Provider bindings must be unique.");
  }

  const invalidBinding = bindings.find((binding) => !/^[a-z0-9._-]+$/i.test(binding));
  if (invalidBinding) {
    errors.push(`Provider binding '${invalidBinding}' contains unsupported characters.`);
  }

  return { bindings, errors };
}

function toneForAccountStatus(status: GatewayAccount["status"]): StatusTone {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "warning";
    case "disabled":
      return "neutral";
    default:
      return "neutral";
  }
}

function statusLabel(status: GatewayAccount["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "disabled":
      return "Disabled";
    default:
      return status;
  }
}

function lifecycleSummary(account: GatewayAccount): string {
  switch (account.status) {
    case "active":
      return "Runtime identity can currently issue or serve bound access.";
    case "suspended":
      return "Identity is paused without being permanently retired.";
    case "disabled":
      return "Identity is fully deactivated for runtime use.";
    default:
      return "Lifecycle state unavailable.";
  }
}

function getAccountRisk(account: GatewayAccount): AccountRiskSummary {
  if (account.status === "active" && account.provider_bindings.length === 0) {
    return {
      level: "attention",
      label: "Unbound active identity",
      detail: "The account is active but not bound to any provider. Runtime access would resolve without provider truth.",
      tone: "danger",
      statusKey: "blocked",
    };
  }

  if (account.status === "active" && (account.runtime_key_count ?? 0) > 0 && !account.last_activity_at) {
    return {
      level: "review",
      label: "Live keys without usage evidence",
      detail: "Keys exist, but no runtime usage was recorded yet. Confirm whether issuance was expected.",
      tone: "warning",
      statusKey: "partial",
    };
  }

  if (account.status === "active" && (account.runtime_key_count ?? 0) === 0) {
    return {
      level: "review",
      label: "Ready but unissued",
      detail: "The identity is active but no runtime key is attached yet.",
      tone: "warning",
      statusKey: "partial",
    };
  }

  if (account.status === "suspended") {
    return {
      level: "review",
      label: "Temporarily paused",
      detail: "This identity is intentionally suspended and should be reviewed before reactivation.",
      tone: "warning",
      statusKey: "partial",
    };
  }

  if (account.status === "disabled") {
    return {
      level: "controlled",
      label: "Deactivated",
      detail: "The identity is disabled and not expected to serve runtime access.",
      tone: "neutral",
      statusKey: "ready",
    };
  }

  return {
    level: "controlled",
    label: "Controlled",
    detail: "Bindings, lifecycle, and runtime exposure are aligned.",
    tone: "success",
    statusKey: "ready",
  };
}

function formatBindings(account: GatewayAccount): string {
  return account.provider_bindings.length > 0 ? account.provider_bindings.join(", ") : "No provider bindings";
}

function searchMatches(account: GatewayAccount, instanceLabel: string, value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    account.account_id,
    account.label,
    account.instance_id ?? "",
    instanceLabel,
    account.tenant_id ?? "",
    account.status,
    account.provider_bindings.join(" "),
    account.notes,
  ].some((part) => part.toLowerCase().includes(normalized));
}

function createFormState(account?: GatewayAccount | null): AccountFormState {
  if (!account) {
    return EMPTY_FORM;
  }
  return {
    label: account.label,
    providerBindingsText: account.provider_bindings.join("\n"),
    notes: account.notes,
  };
}

export function AccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState: instanceCatalogState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);

  const [accounts, setAccounts] = useState<GatewayAccount[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [drawerForm, setDrawerForm] = useState<AccountFormState>(EMPTY_FORM);
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

  const summaryItems = useMemo<SummaryStripItem[]>(() => {
    const activeCount = accounts.filter((account) => account.status === "active").length;
    const riskyCount = accounts.filter((account) => getAccountRisk(account).level !== "controlled").length;
    const runtimeKeyCount = accounts.reduce((total, account) => total + (account.runtime_key_count ?? 0), 0);
    const unboundCount = accounts.filter((account) => account.provider_bindings.length === 0).length;

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
        tone: activeCount > 0 ? "success" : "neutral",
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
        tone: riskyCount > 0 ? "warning" : "success",
        status: riskyCount > 0 ? "partial" : "ready",
      },
    ];
  }, [accounts, instanceScopeLabel, selectedInstance]);

  const tableColumns = useMemo<EntityTableColumn<GatewayAccount>[]>(() => [
    {
      key: "account",
      header: "Account",
      render: (account) => (
        <div>
          <button
            type="button"
            aria-pressed={selectedAccount?.account_id === account.account_id}
            onClick={() => setSelectedAccountId(account.account_id)}
          >
            {account.label}
          </button>
          <div className="fg-muted">{account.account_id}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (account) => (
        <StatusBadge tone={toneForAccountStatus(account.status)} status={account.status}>
          {statusLabel(account.status)}
        </StatusBadge>
      ),
    },
    {
      key: "scope",
      header: "Scope",
      render: (account) => (
        <div>
          <strong>{instanceLabels[account.instance_id ?? ""] ?? account.instance_id ?? "Default instance"}</strong>
          <div className="fg-muted">tenant {account.tenant_id ?? "unknown"}</div>
        </div>
      ),
    },
    {
      key: "bindings",
      header: "Provider bindings",
      render: (account) => (
        <div>
          <div>{formatBindings(account)}</div>
          <div className="fg-muted">{account.provider_bindings.length} bound provider(s)</div>
        </div>
      ),
    },
    {
      key: "keys",
      header: "Key-Anzahl",
      render: (account) => account.runtime_key_count ?? 0,
      className: "ff-data-table-cell-numeric",
    },
    {
      key: "activity",
      header: "Letzter Nutzung",
      render: (account) => formatTimestamp(account.last_activity_at),
    },
    {
      key: "risk",
      header: "Risiko",
      render: (account) => {
        const risk = getAccountRisk(account);
        return (
          <div>
            <StatusBadge tone={risk.tone} status={risk.statusKey}>
              {risk.label}
            </StatusBadge>
            <div className="fg-muted">{risk.detail}</div>
          </div>
        );
      },
    },
  ], [instanceLabels, selectedAccount]);

  const openCreateDrawer = () => {
    setMessage("");
    setDrawerForm(EMPTY_FORM);
    setDrawerMode("create");
  };

  const openEditDrawer = () => {
    if (!selectedAccount) {
      return;
    }
    setMessage("");
    setDrawerForm(createFormState(selectedAccount));
    setDrawerMode("edit");
  };

  const closeDrawer = () => {
    setDrawerMode("closed");
    setDrawerForm(EMPTY_FORM);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formValidation.errors.length > 0) {
      return;
    }

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
    if (!selectedAccount || formValidation.errors.length > 0) {
      return;
    }

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
    if (!selectedAccount || selectedAccount.status === status) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await updateAccount(instanceId, selectedAccount.account_id, { status });
      await Promise.all([load(result.account.account_id), refreshAuditHistoryRoute(result.account.account_id)]);
      setMessage(`Account '${result.account.label}' set to ${statusLabel(status).toLowerCase()}.`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Account lifecycle update failed.");
    } finally {
      setSaving(false);
    }
  };

  const tableFooter = (
    <p className="fg-muted">
      Showing {filteredAccounts.length} of {accounts.length} runtime identities in the current instance scope.
    </p>
  );

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Governance"
        title="Accounts"
        description="Runtime and client identities with lifecycle truth, provider bindings, instance scope, and linked key exposure."
        question="Are you reviewing runtime identity posture, editing bindings, or tracing a live account back to keys and audit history?"
        links={[
          {
            label: "Accounts",
            to: CONTROL_PLANE_ROUTES.accounts,
            description: "Review runtime identity inventory and current lifecycle posture.",
          },
          {
            label: "API Keys",
            to: CONTROL_PLANE_ROUTES.apiKeys,
            description: "Cross-check which runtime keys expose the selected account.",
          },
          {
            label: "Instances",
            to: CONTROL_PLANE_ROUTES.instances,
            description: "Return to the affected instance and inspect broader readiness.",
          },
          {
            label: "Audit History",
            to: auditHistoryRoute,
            description: "Open the newest audit event touching account inventory in this scope.",
          },
        ]}
        badges={[
          { label: selectedInstance ? `Instance scope: ${instanceScopeLabel}` : "Default instance path", tone: selectedInstance ? "success" : "neutral" },
          { label: canMutate ? "Admin mutations enabled" : "Read-only review", tone: canMutate ? "success" : "warning" },
        ]}
        note="Archiving is not exposed as a fake control. The current backend persists active, suspended, and disabled states only."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={instanceCatalogState}
        error={instancesError}
        surfaceLabel="runtime account governance"
        onInstanceChange={onInstanceChange}
      />

      <SummaryStrip items={summaryItems} />

      {!canMutate ? (
        <PermissionState
          title="Read-only account review"
          description="This session can inspect identity scope, bindings, key exposure, and audit links, but it cannot mutate account profile or lifecycle."
        />
      ) : null}

      {message ? <p className="fg-note">{message}</p> : null}
      {error ? <p className="fg-danger">{error}</p> : null}

      <ActionBar
        title="Inventory filters"
        description="Keep identity search, lifecycle status, and review pressure visible while you move between account detail and linked routes."
        actions={canMutate ? (
          <>
            <button type="button" onClick={openCreateDrawer}>Create account</button>
            {selectedAccount ? <button type="button" onClick={openEditDrawer}>Edit selected account</button> : null}
          </>
        ) : undefined}
      >
        <div className="fg-inline-form" aria-label="Account inventory filters">
          <label>
            Search
            <input
              placeholder="Label, account ID, tenant, provider"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">all</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            Risk
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}>
              <option value="all">all</option>
              <option value="controlled">controlled</option>
              <option value="review">review</option>
              <option value="attention">attention</option>
            </select>
          </label>
          <button type="button" onClick={() => void load(selectedAccount?.account_id ?? null)}>Refresh inventory</button>
        </div>
      </ActionBar>

      <div className="ff-operator-layout">
        <div className="ff-operator-main">
          {loadState === "loading" ? (
            <LoadingState title="Loading account inventory" description="Fetching runtime identities, bindings, and key counts." />
          ) : null}
          {loadState === "error" ? (
            <ErrorState title="Account inventory failed to load" description={error || "The account inventory request failed."} action={<button type="button" onClick={() => void load()}>Retry</button>} />
          ) : null}
          {loadState === "success" ? (
            <EntityTable
              title="Runtime identity inventory"
              description="Each row captures account scope, provider bindings, key exposure, last activity, and the current operational risk."
              columns={tableColumns}
              rows={filteredAccounts}
              rowKey={(account) => account.account_id}
              tableLabel="Accounts inventory table"
              emptyTitle="No accounts match the current filters"
              emptyDescription="Adjust search, lifecycle, or risk filters to bring matching identities back into view."
              getRowClassName={(account) => (selectedAccount?.account_id === account.account_id ? "is-selected" : undefined)}
              footer={tableFooter}
            />
          ) : null}
        </div>

        <div className="ff-operator-sidebar">
          {selectedAccount ? (
            <DetailPanel
              title={selectedAccount.label}
              description={`${selectedAccount.account_id} · ${selectedAccountInstanceLabel}`}
              status={selectedRisk?.label}
              statusTone={selectedRisk?.tone}
              statusKey={selectedRisk?.statusKey}
              sticky
              actions={(
                <div className="fg-actions">
                  <Link className="fg-nav-link" to={selectedAccountKeysRoute}>API Keys</Link>
                  <Link className="fg-nav-link" to={selectedAccountAuditRoute}>Audit History</Link>
                  <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.instances, selectedAccountInstanceId)}>Affected Instance</Link>
                </div>
              )}
            >
              <div className="fg-stack">
                <section className="fg-subcard">
                  <h4>Identity and scope</h4>
                  <p>Instance: {selectedAccountInstanceLabel}</p>
                  <p>Tenant: {selectedAccount.tenant_id ?? "unknown"}</p>
                  <p>Lifecycle: {statusLabel(selectedAccount.status)}</p>
                  <p>Last runtime usage: {formatTimestamp(selectedAccount.last_activity_at)}</p>
                </section>

                <section className="fg-subcard">
                  <h4>Provider bindings and keys</h4>
                  <p>Bindings: {formatBindings(selectedAccount)}</p>
                  <p>Runtime keys: {selectedAccount.runtime_key_count ?? 0}</p>
                  <p>{selectedRisk?.detail}</p>
                </section>

                <section className="fg-subcard">
                  <h4>Lifecycle actions</h4>
                  <p>{lifecycleSummary(selectedAccount)}</p>
                  <div className="fg-actions">
                    <StatusBadge tone={toneForAccountStatus(selectedAccount.status)} status={selectedAccount.status}>
                      {statusLabel(selectedAccount.status)}
                    </StatusBadge>
                  </div>
                  {canMutate ? (
                    <div className="fg-actions">
                      {selectedAccount.status !== "active" ? (
                        <button type="button" disabled={saving} onClick={() => void handleLifecycleChange("active")}>Activate account</button>
                      ) : null}
                      {selectedAccount.status !== "suspended" ? (
                        <button type="button" disabled={saving} onClick={() => void handleLifecycleChange("suspended")}>Suspend temporarily</button>
                      ) : null}
                      {selectedAccount.status !== "disabled" ? (
                        <button type="button" disabled={saving} onClick={() => void handleLifecycleChange("disabled")}>Deactivate account</button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="fg-muted">Lifecycle mutations are hidden in read-only sessions so the page does not imply unavailable actions.</p>
                  )}
                </section>

                <BlockedState
                  title="Archive lifecycle unsupported"
                  description="The backend currently persists `active`, `suspended`, and `disabled` only. Archiving is therefore shown as unsupported rather than as a dead button."
                  status="unsupported"
                  badgeLabel="unsupported"
                />

                <section className="fg-subcard">
                  <h4>Notes</h4>
                  <p>{selectedAccount.notes || "No operator notes recorded for this identity."}</p>
                </section>
              </div>
            </DetailPanel>
          ) : loadState === "loading" ? (
            <LoadingState title="Preparing account detail" description="Waiting for the account inventory before rendering lifecycle and binding truth." />
          ) : loadState === "error" ? (
            <ErrorState title="Account detail unavailable" description="Repair the inventory request before trusting lifecycle or binding posture." />
          ) : (
            <EmptyState title="No account selected" description="Choose an account row to inspect lifecycle actions, linked keys, scope, and audit history." />
          )}
        </div>
      </div>

      <DetailDrawer
        open={drawerMode !== "closed"}
        title={drawerMode === "create" ? "Create Account" : "Edit Account"}
        description={drawerMode === "create"
          ? "Create a runtime identity inside the current instance scope."
          : "Update label, provider bindings, and notes without mixing lifecycle with profile edits."}
        status={formValidation.errors.length === 0 ? "form ready" : "validation required"}
        statusTone={formValidation.errors.length === 0 ? "success" : "danger"}
        properties={[
          { label: "Scope", value: selectedInstance ? `${instanceScopeLabel} (${selectedInstance.instance_id})` : "Default instance path" },
          { label: "Lifecycle support", value: "active, suspended, disabled" },
        ]}
        actions={(
          <>
            <button type="button" onClick={closeDrawer}>Cancel</button>
            <button
              type="submit"
              form={DRAWER_FORM_ID}
              disabled={saving || formValidation.errors.length > 0 || (drawerMode === "edit" && !selectedAccount)}
            >
              {drawerMode === "create" ? "Create account" : "Save account changes"}
            </button>
          </>
        )}
        onClose={closeDrawer}
      >
        <form id={DRAWER_FORM_ID} className="fg-stack" onSubmit={drawerMode === "create" ? handleCreate : handleUpdate}>
          {formValidation.errors.length > 0 ? (
            <ul className="fg-list fg-danger">
              {formValidation.errors.map((item, index) => <li key={`account-form-error-${index}`}>{item}</li>)}
            </ul>
          ) : (
            <p className="fg-muted">The account form passed validation and is ready to submit.</p>
          )}

          <section className="fg-subcard">
            <h4>Identity</h4>
            <div className="fg-grid fg-grid-compact">
              <label>
                Account label
                <input
                  value={drawerForm.label}
                  onChange={(event) => setDrawerForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="Customer Success Runtime"
                />
              </label>
              <label>
                Scope
                <input value={selectedInstance ? `${instanceScopeLabel} (${selectedInstance.instance_id})` : "Default instance path"} disabled />
              </label>
            </div>
          </section>

          <section className="fg-subcard">
            <h4>Provider bindings</h4>
            <label>
              Provider bindings
              <textarea
                rows={6}
                value={drawerForm.providerBindingsText}
                onChange={(event) => setDrawerForm((current) => ({ ...current, providerBindingsText: event.target.value }))}
                placeholder={"openai_codex\nlocal_ollama"}
              />
            </label>
            <p className="fg-muted">Enter one provider binding per line. Empty bindings stay allowed, but the account will surface as higher risk.</p>
          </section>

          <section className="fg-subcard">
            <h4>Operator notes</h4>
            <label>
              Notes
              <textarea
                rows={5}
                value={drawerForm.notes}
                onChange={(event) => setDrawerForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Why this identity exists, who owns it, and when it should be reviewed."
              />
            </label>
          </section>
        </form>
      </DetailDrawer>
    </section>
  );
}
