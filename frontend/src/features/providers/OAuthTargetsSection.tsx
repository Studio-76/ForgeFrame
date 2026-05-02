import { useState, useMemo, type ReactNode } from "react";

import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import type { ProvidersPageActions, ProvidersPageData } from "./providersShared";
import { formatMetric, formatTimestamp, toStringValue } from "./providersShared";
import {
  contractStatusFromOauthConnectionStatus,
  formatOauthConnectionStatus,
  formatOauthProviderName,
  MetricTile,
  OAUTH_TARGET_PRIORITY,
  SectionCard,
  TonePill,
  toneFromContractClassification,
  toneFromOauthConnectionStatus,
  toneFromReadinessAxis,
} from "./providersSectionUtils";

type SectionProps = {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
};

type ReadinessState = "configured" | "missing-credentials" | "external-only" | "unsupported" | "planned";

type FilterKey = "all" | "needs-attention" | "configured" | "external-only" | "unsupported-planned";

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "needs-attention", label: "Needs attention" },
  { key: "configured", label: "Configured" },
  { key: "external-only", label: "External-only" },
  { key: "unsupported-planned", label: "Unsupported/Planned" },
];

/**
 * Derive a simplified readiness state from the raw connection status,
 * contract classification, and missing credentials.
 */
function deriveReadinessState(target: ProvidersPageData["oauthTargets"][number]): ReadinessState {
  const status = target.connection_status;
  const missingCount = target.setup.missing_env_vars.length;
  const classification = target.contract_classification;

  if (status === "runtime-ready") {
    return "configured";
  }
  if (status === "oauth unsupported") {
    return "unsupported";
  }
  if (status === "bridge-only") {
    return "external-only";
  }
  if (status === "token present") {
    if (missingCount > 0) {
      return "missing-credentials";
    }
    return "external-only";
  }
  if (status === "not configured") {
    if (classification === "onboarding-only") {
      return "planned";
    }
    return "missing-credentials";
  }
  // probe failed, expired, needs refresh
  if (missingCount > 0 || status === "probe failed" || status === "expired" || status === "needs refresh") {
    return "missing-credentials";
  }
  return "planned";
}

function toneFromReadiness(state: ReadinessState): "success" | "warning" | "danger" | "neutral" {
  switch (state) {
    case "configured":
      return "success";
    case "missing-credentials":
      return "danger";
    case "external-only":
      return "warning";
    case "unsupported":
      return "neutral";
    case "planned":
      return "neutral";
  }
}

function labelForReadiness(state: ReadinessState): string {
  switch (state) {
    case "configured":
      return "Configured";
    case "missing-credentials":
      return "Missing credentials";
    case "external-only":
      return "External token only";
    case "unsupported":
      return "Unsupported";
    case "planned":
      return "Planned";
  }
}

function matchesFilter(target: ProvidersPageData["oauthTargets"][number], filter: FilterKey, search: string): boolean {
  const name = formatOauthProviderName(target).toLowerCase();
  const key = target.provider_key.toLowerCase();

  if (search.trim() && !name.includes(search.toLowerCase()) && !key.includes(search.toLowerCase())) {
    return false;
  }

  if (filter === "all") {
    return true;
  }

  const state = deriveReadinessState(target);

  switch (filter) {
    case "needs-attention":
      return state === "missing-credentials";
    case "configured":
      return state === "configured";
    case "external-only":
      return state === "external-only";
    case "unsupported-planned":
      return state === "unsupported" || state === "planned";
    default:
      return true;
  }
}

function formatLastProbeResult(target: ProvidersPageData["oauthTargets"][number]): string {
  if (!target.last_probe) {
    return "Not probed";
  }
  return `${target.last_probe.status} · ${target.last_probe.details.slice(0, 40)}`;
}

function formatMissingEnvCount(target: ProvidersPageData["oauthTargets"][number]): string {
  const count = target.setup.missing_env_vars.length;
  if (count === 0) {
    return "-";
  }
  return `${count} missing`;
}

function formatCredentialSource(target: ProvidersPageData["oauthTargets"][number]): string {
  if (target.oauth_flow_support === "external_token_only") {
    return "External token";
  }
  if (target.connection_status === "bridge-only") {
    return "Bridge";
  }
  if (target.connection_status === "runtime-ready") {
    return "Runtime";
  }
  return target.connection_method.slice(0, 24);
}

/**
 * OAuth targets section with compact provider comparison grid and
 * expanded detail panel for the selected provider. Includes
 * filtering, search, and page-level guidance.
 */
export function OAuthTargetsSection({ data, actions }: SectionProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sortedTargets = useMemo(() => {
    return [...data.oauthTargets].sort((left, right) => {
      const leftOrder = OAUTH_TARGET_PRIORITY[left.provider_key] ?? 99;
      const rightOrder = OAUTH_TARGET_PRIORITY[right.provider_key] ?? 99;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return formatOauthProviderName(left).localeCompare(formatOauthProviderName(right));
    });
  }, [data.oauthTargets]);

  const filteredTargets = useMemo(() => {
    return sortedTargets.filter((target) => matchesFilter(target, filter, search));
  }, [sortedTargets, filter, search]);

  const runtimeReadyCount = sortedTargets.filter((t) => t.connection_status === "runtime-ready").length;
  const bridgeOnlyCount = sortedTargets.filter((t) => t.connection_status === "bridge-only").length;
  const missingSetupCount = sortedTargets.filter((t) => t.setup.missing_env_vars.length > 0).length;
  const attentionCount = sortedTargets.filter(
    (t) => t.connection_status === "probe failed" || t.connection_status === "expired" || t.connection_status === "needs refresh",
  ).length;

  const selectedTarget = selectedKey ? data.oauthTargets.find((t) => t.provider_key === selectedKey) ?? null : null;

  const handleRowClick = (providerKey: string) => {
    setSelectedKey((prev) => (prev === providerKey ? null : providerKey));
  };

  const handleFilterChange = (nextFilter: FilterKey) => {
    setFilter(nextFilter);
    setSelectedKey(null);
  };

  const integrationErrorSummary = Object.entries(data.integrationErrors)
    .map(([key, value]) => `${key}=${value}`)
    .join(" | ");

  return (
    <>
      <SectionCard
        title="OAuth Provider Targets"
        description="Account-backed provider connections, credential status, and probe actions in a single compact view."
        actions={
          <>
            {data.access.canOperate ? (
              <button type="button" onClick={() => void actions.probeAllOauthTargets()}>
                Probe all targets
              </button>
            ) : null}
            {data.access.canMutate ? (
              <button type="button" onClick={() => void actions.syncOauthBridgeProfiles()}>
                Sync bridge profiles
              </button>
            ) : null}
          </>
        }
      >
        {/* Summary metrics */}
        <div className="fg-grid fg-grid-compact fg-mb-md">
          <MetricTile label="Runtime ready" value={formatMetric(runtimeReadyCount)} note={`${formatMetric(sortedTargets.length)} total`} />
          <MetricTile label="Bridge only" value={formatMetric(bridgeOnlyCount)} note="external token path" />
          <MetricTile label="Credential issues" value={formatMetric(missingSetupCount)} note="missing env or bridge toggles" />
          <MetricTile label="Needs attention" value={formatMetric(attentionCount)} note={`${formatMetric(data.oauthTotalOps)} persisted ops`} />
        </div>

        {/* Page-level guidance banner — shown once, not repeated per card */}
        <div className="fg-oauth-banner">
          <p>
            <strong>OAuth token model:</strong> ForgeFrame does not mint or refresh upstream OAuth tokens.
            All access tokens are supplied externally and managed outside the control plane.
            Provider credential status reflects whether the required environment variables are present.
          </p>
          {data.access.canOperate && !data.access.canMutate ? (
            <p>Probe actions are available. Bridge-profile sync requires write capability.</p>
          ) : null}
          {!data.access.canOperate ? (
            <p>{data.access.summaryDetail} Probe actions blocked for read-only sessions.</p>
          ) : null}
        </div>

        {/* Toolbar: filters + search */}
        <div className="fg-oauth-toolbar">
          <div className="fg-oauth-filters">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`fg-oauth-filter-btn${filter === option.key ? " is-active" : ""}`}
                onClick={() => handleFilterChange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="fg-oauth-search"
            placeholder="Search provider name or key..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedKey(null);
            }}
            aria-label="Search OAuth providers"
          />
        </div>

        {/* Compact comparison grid */}
        {filteredTargets.length === 0 ? (
          <p className="fg-muted">No OAuth targets match the current filter or search.</p>
        ) : (
          <div className="fg-oauth-compact-grid">
            {/* Header row */}
            <div className="fg-oauth-row-header">
              <span>Provider</span>
              <span>Status</span>
              <span>Credentials</span>
              <span>Missing</span>
              <span>Actions</span>
              <span>Last probe</span>
              <span>Next step</span>
            </div>

            {filteredTargets.map((target) => {
              const state = deriveReadinessState(target);
              const isSelected = selectedKey === target.provider_key;

              return (
                <div key={target.provider_key}>
                  {/* Data row — clickable to select */}
                  <div
                    className={`fg-oauth-row${isSelected ? " is-selected" : ""}`}
                    onClick={() => handleRowClick(target.provider_key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(target.provider_key);
                      }
                    }}
                    aria-expanded={isSelected}
                    aria-label={`${formatOauthProviderName(target)} — ${labelForReadiness(state)}`}
                  >
                    <div className="fg-oauth-cell fg-oauth-cell-provider">
                      <span className="fg-oauth-provider-name">{formatOauthProviderName(target)}</span>
                      <span className="fg-oauth-provider-key">{target.provider_key}</span>
                    </div>
                    <div className="fg-oauth-cell">
                      <TonePill label={labelForReadiness(state)} tone={toneFromReadiness(state)} />
                    </div>
                    <div className="fg-oauth-cell">{formatCredentialSource(target)}</div>
                    <div className="fg-oauth-cell">{formatMissingEnvCount(target)}</div>
                    <div className="fg-oauth-cell fg-oauth-cell-actions">
                      {renderRowActions(target, data, actions)}
                    </div>
                    <div className="fg-oauth-cell">{formatLastProbeResult(target)}</div>
                    <div className="fg-oauth-cell" title={target.next_step}>
                      {target.next_step.slice(0, 24)}
                      {target.next_step.length > 24 ? "..." : ""}
                    </div>
                  </div>

                  {/* Detail panel — shown for selected provider */}
                  {isSelected && selectedTarget ? (
                    <div className="fg-oauth-detail-panel">
                      {/* Detail header */}
                      <div className="fg-oauth-detail-header">
                        <div>
                          <h4>{formatOauthProviderName(selectedTarget)}</h4>
                          <p className="fg-muted">
                            {selectedTarget.provider_key} · {selectedTarget.connection_method}
                          </p>
                        </div>
                        <div className="fg-actions">
                          <TonePill
                            label={labelForReadiness(state)}
                            tone={toneFromReadiness(state)}
                          />
                          <TonePill
                            label={`contract ${selectedTarget.contract_classification.replaceAll("-", " ")}`}
                            tone={toneFromContractClassification(selectedTarget.contract_classification)}
                          />
                          <TonePill
                            label={`readiness ${selectedTarget.readiness}`}
                            tone={toneFromReadinessAxis(selectedTarget.readiness)}
                          />
                        </div>
                      </div>

                      {/* Detail body */}
                      <div className="fg-oauth-detail-body">
                        {/* Status + next step */}
                        <div className="fg-oauth-detail-section">
                          <p>
                            <strong>Status:</strong> {selectedTarget.connection_status_reason}
                          </p>
                          <p>
                            <strong>Next step:</strong> {selectedTarget.next_step}
                          </p>
                          <p>
                            <strong>Operator truth:</strong> {selectedTarget.operator_truth}
                          </p>
                        </div>

                        {/* Setup instructions — collapsible */}
                        {selectedTarget.setup.steps.length > 0 && (
                          <details className="ff-collapse-section">
                            <summary>
                              <span className="ff-collapse-summary-text">
                                <h4>Setup instructions</h4>
                                <p>Manual configuration steps for this provider</p>
                              </span>
                            </summary>
                            <div className="ff-collapse-section-body">
                              <ol>
                                {selectedTarget.setup.steps.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          </details>
                        )}

                        {/* Technical details — collapsible */}
                        <details className="ff-collapse-section">
                          <summary>
                            <span className="ff-collapse-summary-text">
                              <h4>Technical details</h4>
                              <p>
                                {selectedTarget.setup.missing_env_vars.length > 0
                                  ? `${selectedTarget.setup.missing_env_vars.length} env vars missing`
                                  : "Environment variables and configuration"}
                              </p>
                            </span>
                          </summary>
                          <div className="ff-collapse-section-body">
                            {selectedTarget.setup.required_env_vars.length > 0 && (
                              <p>
                                <strong>Required env vars:</strong>{" "}
                                {selectedTarget.setup.required_env_vars.map((item) => (
                                  <span key={item} className="fg-code">
                                    {item}{" "}
                                  </span>
                                ))}
                              </p>
                            )}
                            {selectedTarget.setup.optional_env_vars.length > 0 && (
                              <p>
                                <strong>Optional env vars:</strong>{" "}
                                {selectedTarget.setup.optional_env_vars.map((item) => (
                                  <span key={item} className="fg-code">
                                    {item}{" "}
                                  </span>
                                ))}
                              </p>
                            )}
                            {selectedTarget.setup.missing_env_vars.length > 0 && (
                              <p>
                                <strong>Missing env vars:</strong>{" "}
                                {selectedTarget.setup.missing_env_vars.map((item) => (
                                  <span key={item} className="fg-code">
                                    {item}{" "}
                                  </span>
                                ))}
                              </p>
                            )}
                            <div className="fg-detail-grid fg-mt-sm">
                              <p>Auth kind: {selectedTarget.auth_kind} · OAuth mode: {selectedTarget.oauth_mode ?? "-"}</p>
                              <p>
                                Flow support: {selectedTarget.oauth_flow_support ?? "-"} · Session reuse:{" "}
                                {selectedTarget.session_reuse_strategy}
                              </p>
                              <p>
                                Queue: {selectedTarget.queue_lane} · Parallelism: {selectedTarget.parallelism_mode} · Cost:{" "}
                                {selectedTarget.cost_posture}
                              </p>
                              <p>Escalation: {selectedTarget.escalation_support}</p>
                            </div>
                          </div>
                        </details>

                        {/* Evidence summary */}
                        <details className="ff-collapse-section">
                          <summary>
                            <span className="ff-collapse-summary-text">
                              <h4>Proof &amp; evidence</h4>
                              <p>Runtime, streaming, tool-calling, and probe proof status</p>
                            </span>
                          </summary>
                          <div className="ff-collapse-section-body">
                            <div className="fg-oauth-detail-evidence">
                              <EvidenceItem label="Runtime" evidence={selectedTarget.evidence.runtime} />
                              <EvidenceItem label="Streaming" evidence={selectedTarget.evidence.streaming} />
                              <EvidenceItem label="Tool calling" evidence={selectedTarget.evidence.tool_calling} />
                              <EvidenceItem label="Live probe" evidence={selectedTarget.evidence.live_probe} />
                            </div>
                            {selectedTarget.last_probe ? (
                              <div className="fg-oauth-detail-section fg-mt-sm">
                                <p>
                                  <strong>Last probe:</strong> {formatTimestamp(selectedTarget.last_probe.executed_at)} ·{" "}
                                  {selectedTarget.last_probe.status} · {selectedTarget.last_probe.details}
                                </p>
                              </div>
                            ) : null}
                            {selectedTarget.last_bridge_sync ? (
                              <p>
                                <strong>Last bridge sync:</strong> {formatTimestamp(selectedTarget.last_bridge_sync.executed_at)} ·{" "}
                                {selectedTarget.last_bridge_sync.status} · {selectedTarget.last_bridge_sync.details}
                              </p>
                            ) : null}
                            {selectedTarget.last_failed_operation ? (
                              <p>
                                <strong>Last failure:</strong>{" "}
                                {formatTimestamp(selectedTarget.last_failed_operation.executed_at)} ·{" "}
                                {selectedTarget.last_failed_operation.status} · {selectedTarget.last_failed_operation.details}
                              </p>
                            ) : null}
                          </div>
                        </details>

                        {/* Action buttons */}
                        <div className="fg-oauth-detail-actions">
                          {renderDetailActions(selectedTarget, data, actions)}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Route Diagnostics — collapsed by default */}
      <SectionCard
        title="Route Diagnostics"
        description="Contract corpus, onboarding depth, and operation history."
      >
        <AdvancedDiagnostics
          title="Product Axis Contracts"
          description="Axis-level contract records for audit and rollout."
          defaultOpen={false}
        >
          <ul className="fg-list">
            {data.productAxisTargets.map((target) => (
              <li key={target.provider_key}>
                {target.provider_key} · contract={target.contract_classification.replaceAll("-", " ")} · runtime={target.runtime_path} ·
                auth={target.auth_model} · status={target.status_summary}
              </li>
            ))}
          </ul>
        </AdvancedDiagnostics>

        <AdvancedDiagnostics
          title="OAuth Onboarding Guide"
          description="Per-target next steps from backend truth model."
          defaultOpen={false}
        >
          <ul className="fg-list">
            {data.oauthOnboarding.map((target, index) => {
              const nextSteps = Array.isArray(target.next_steps) ? target.next_steps : [];
              return (
                <li key={`${toStringValue(target.provider_key, "target")}-${index}`}>
                  {toStringValue(target.provider_key)} · readiness={toStringValue(target.readiness)} · depth=
                  {toStringValue(target.operational_depth)} · reason={toStringValue(target.readiness_reason)}
                  {nextSteps.length > 0 ? ` · next=${toStringValue(nextSteps[0])}` : ""}
                </li>
              );
            })}
          </ul>
        </AdvancedDiagnostics>

        <AdvancedDiagnostics
          title="Operations History"
          description="Persisted provider-operation counters and recent raw log."
          defaultOpen={false}
        >
          <p>Persisted operations: {formatMetric(data.oauthTotalOps)}</p>
          <ul className="fg-list">
            {data.oauthOperations.map((item) => (
              <li key={toStringValue(item.provider_key)}>
                {toStringValue(item.provider_key)} · failures={formatMetric(item.failures)} · failures_24h=
                {formatMetric(item.failures_24h)} · probes={formatMetric(item.probe_count)} · bridge syncs=
                {formatMetric(item.bridge_sync_count)} · failure rate={formatMetric(item.failure_rate, 2)} · needs attention=
                {toStringValue(item.needs_attention)}
              </li>
            ))}
          </ul>
          {data.oauthRecentOps.length > 0 ? (
            <ul className="fg-list fg-mt-sm">
              {data.oauthRecentOps.slice(-10).map((item, index) => (
                <li key={`${toStringValue(item.provider_key)}-${index}`}>
                  {formatTimestamp(item.executed_at)} · {toStringValue(item.provider_key)} · {toStringValue(item.action)} ·
                  {toStringValue(item.status)} · {toStringValue(item.details)}
                </li>
              ))}
            </ul>
          ) : null}
        </AdvancedDiagnostics>

        <AdvancedDiagnostics
          title="Host / Public Bootstrap Readiness"
          description="Backend bootstrap checks affecting the public product path."
          defaultOpen={false}
        >
          {data.bootstrapReadiness ? (
            <div className="fg-detail-grid">
              <p>ready={String(data.bootstrapReadiness.ready)}</p>
              <ul className="fg-list">
                {data.bootstrapReadiness.checks.map((check, index) => (
                  <li key={`${toStringValue(check.id, "check")}-${index}`}>
                    {toStringValue(check.id)} · ok={toStringValue(check.ok)} · details={toStringValue(check.details)}
                  </li>
                ))}
              </ul>
              <ol>
                {data.bootstrapReadiness.next_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="fg-muted">Bootstrap readiness unavailable.</p>
          )}
        </AdvancedDiagnostics>

        <AdvancedDiagnostics
          title="Discovery / Sync Note"
          description="Residual integration error dimensions and sync notes."
          defaultOpen={false}
        >
          <p>{data.syncNote}</p>
          <p>integration error dimensions: {integrationErrorSummary || "none"}</p>
        </AdvancedDiagnostics>
      </SectionCard>
    </>
  );
}

/**
 * Render inline action buttons for the compact grid row.
 * Shows only the most relevant action per row.
 */
function renderRowActions(
  target: ProvidersPageData["oauthTargets"][number],
  data: ProvidersPageData,
  actions: ProvidersPageActions,
): ReactNode {
  const actionList = Array.isArray(target.actions) ? target.actions : [];
  const probeAction = actionList.find((a) => a.action_key === "probe");
  const bridgeSyncAction = actionList.find((a) => a.action_key === "bridge_sync");

  return (
    <>
      {probeAction && probeAction.supported && probeAction.mode === "api" && data.access.canOperate ? (
        <button type="button" onClick={() => void actions.probeOauthTarget(target.provider_key)}>
          Test
        </button>
      ) : null}
      {bridgeSyncAction && bridgeSyncAction.supported && bridgeSyncAction.mode === "api" && data.access.canMutate ? (
        <button type="button" onClick={() => void actions.syncOauthBridgeProfiles()}>
          Sync
        </button>
      ) : null}
    </>
  );
}

/**
 * Render action buttons for the detail panel — more contextual and complete.
 */
function renderDetailActions(
  target: ProvidersPageData["oauthTargets"][number],
  data: ProvidersPageData,
  actions: ProvidersPageActions,
): ReactNode {
  const actionList = Array.isArray(target.actions) ? target.actions : [];

  const manualTokenAction = actionList.find((a) => a.action_key === "manual_token");
  const probeAction = actionList.find((a) => a.action_key === "probe");
  const bridgeSyncAction = actionList.find((a) => a.action_key === "bridge_sync");
  const connectAction = actionList.find((a) => a.action_key === "connect");
  const deviceAction = actionList.find((a) => a.action_key === "device_code");

  return (
    <>
      {manualTokenAction && manualTokenAction.supported ? (
        <span className="fg-muted" style={{ fontSize: "var(--fg-type-size-meta)", padding: "0.4rem 0" }}>
          {manualTokenAction.detail}
        </span>
      ) : null}
      {probeAction && probeAction.supported && probeAction.mode === "api" && data.access.canOperate ? (
        <button type="button" onClick={() => void actions.probeOauthTarget(target.provider_key)}>
          Test connection
        </button>
      ) : null}
      {bridgeSyncAction && bridgeSyncAction.supported && bridgeSyncAction.mode === "api" && data.access.canMutate ? (
        <button type="button" onClick={() => void actions.syncOauthBridgeProfiles()}>
          Sync bridge profile
        </button>
      ) : null}
      {connectAction && connectAction.mode === "unsupported" ? (
        <span className="fg-muted" style={{ fontSize: "var(--fg-type-size-meta)" }}>
          Connect: {connectAction.detail}
        </span>
      ) : null}
      {deviceAction && deviceAction.mode === "unsupported" ? (
        <span className="fg-muted" style={{ fontSize: "var(--fg-type-size-meta)" }}>
          Device flow: {deviceAction.detail}
        </span>
      ) : null}
    </>
  );
}

/**
 * Compact evidence status item for the detail panel.
 */
function EvidenceItem({
  label,
  evidence,
}: {
  label: string;
  evidence: ProvidersPageData["oauthTargets"][number]["evidence"]["runtime"];
}) {
  return (
    <div className="fg-oauth-evidence-item">
      <strong>{label}</strong>
      <span>
        {evidence.status} · {evidence.source.replaceAll("_", " ")}
      </span>
      <br />
      <span className="fg-muted">{evidence.details.slice(0, 60)}</span>
    </div>
  );
}

/** @deprecated Use {@link OAuthTargetsSection} instead. */
export const ExpansionTargetsSection = OAuthTargetsSection;
