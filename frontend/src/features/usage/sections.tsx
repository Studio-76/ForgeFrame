import { Link } from "react-router-dom";

import type { UsageSummaryResponse } from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import { ActionBar } from "../../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../../components/ui/DetailPanel";
import { EntityTable } from "../../components/ui/EntityTable";
import { BlockedState, EmptyState, ErrorState, LoadingState, PermissionState } from "../../components/ui/StateBlocks";
import { SummaryStrip } from "../../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";
type UsageWindow = "1h" | "24h" | "7d" | "all";
type BadgeTone = "success" | "warning" | "neutral";

type UsageAccessState = {
  noticeTitle: string | null;
  noticeDetail: string | null;
};

type FreshnessState = {
  label: string;
  tone: BadgeTone;
  detail: string;
};

type Recommendation = {
  title: string;
  description: string;
  linkLabel: string;
  to: string;
} | null;

type UsageContentProps = {
  access: UsageAccessState;
  window: UsageWindow;
  windowLabels: Record<UsageWindow, string>;
  windowOptions: UsageWindow[];
  state: LoadState;
  error: string | null;
  partialMessages: string[];
  summary: UsageSummaryResponse | null;
  recommendation: Recommendation;
  freshness: FreshnessState;
  latestEvidenceAt: number | null;
  attentionClients: Array<Record<string, string | number | boolean>>;
  emptyUsage: boolean;
  selectedProvider: string;
  providerDrilldownState: LoadState;
  providerDrilldownError: string | null;
  providerDrilldown: Record<string, unknown> | null;
  providerModels: Array<Record<string, unknown>>;
  providerClients: Array<Record<string, unknown>>;
  providerHealth: Array<Record<string, unknown>>;
  selectedClient: string;
  clientDrilldownState: LoadState;
  clientDrilldownError: string | null;
  clientDrilldown: Record<string, unknown> | null;
  clientOps: Array<Record<string, string | number | boolean>>;
  clientProviders: Array<Record<string, unknown>>;
  clientErrors: Array<Record<string, unknown>>;
  clientUsage: Array<Record<string, unknown>>;
  instanceId: string | null;
  onWindowChange: (value: UsageWindow) => void;
  onSelectedProviderChange: (value: string) => void;
  onSelectedClientChange: (value: string) => void;
  formatMetric: (value: unknown, fractionDigits?: number) => string;
  formatPercent: (value: unknown) => string;
  formatTimestamp: (value: unknown, fallback?: string) => string;
  toStringValue: (value: unknown, fallback?: string) => string;
};

function diagnosticsStatus(state: LoadState, partialMessages: string[], summary: UsageSummaryResponse | null, freshnessTone: BadgeTone) {
  if (state === "error") {
    return "blocked";
  }
  if (!summary) {
    return partialMessages.length > 0 ? "partial" : "onboarding-only";
  }
  if (partialMessages.length > 0) {
    return "partial";
  }
  if (freshnessTone === "warning") {
    return "degraded";
  }
  return "ready";
}

export function UsageContent({
  access,
  window,
  windowLabels,
  windowOptions,
  state,
  error,
  partialMessages,
  summary,
  recommendation,
  freshness,
  latestEvidenceAt,
  attentionClients,
  emptyUsage,
  selectedProvider,
  providerDrilldownState,
  providerDrilldownError,
  providerDrilldown,
  providerModels,
  providerClients,
  providerHealth,
  selectedClient,
  clientDrilldownState,
  clientDrilldownError,
  clientDrilldown,
  clientOps,
  clientProviders,
  clientErrors,
  clientUsage,
  instanceId,
  onWindowChange,
  onSelectedProviderChange,
  onSelectedClientChange,
  formatMetric,
  formatPercent,
  formatTimestamp,
  toStringValue,
}: UsageContentProps) {
  const latestEvidenceLabel = latestEvidenceAt ? new Date(latestEvidenceAt).toISOString() : "No recent evidence";
  const currentAlertRows = summary
    ? summary.alerts.map((item, index) => ({
        rowKey: `${toStringValue(item.type)}-${index}`,
        severity: toStringValue(item.severity),
        type: toStringValue(item.type),
        message: toStringValue(item.message),
        value: toStringValue(item.value),
      }))
    : [];
  const providerTrafficRows = summary
    ? summary.aggregations.by_provider.slice(0, 5).map((item) => ({
        rowKey: toStringValue(item.provider),
        provider: toStringValue(item.provider),
        requests: formatMetric(item.requests),
        tokens: formatMetric(item.tokens),
        actualCost: formatMetric(item.actual_cost, 2),
      }))
    : [];
  const clientHotspotRows = clientOps.slice(0, 5).map((item) => ({
    rowKey: toStringValue(item.client_id),
    clientId: toStringValue(item.client_id),
    requests: formatMetric(item.requests),
    errors: formatMetric(item.errors),
    errorRate: formatPercent(item.error_rate),
    needsAttention: toStringValue(item.needs_attention),
  }));
  const providerName = providerDrilldown ? toStringValue(providerDrilldown.provider, selectedProvider) : selectedProvider || "No provider selected";
  const clientName = clientDrilldown ? toStringValue(clientDrilldown.client_id, selectedClient) : selectedClient || "No client selected";
  const advancedStatus = diagnosticsStatus(state, partialMessages, summary, freshness.tone);

  return (
    <>
      {access.noticeTitle && access.noticeDetail ? (
        <PermissionState title={access.noticeTitle} description={access.noticeDetail} />
      ) : null}

      <div id="usage-overview">
        <ActionBar
          title="Monitoring overview"
          description="Window changes should preserve focus and make it clear whether the evidence is fresh, partial, or empty."
          actions={recommendation ? (
            <Link className="fg-nav-link" to={withInstanceScope(recommendation.to, instanceId)}>
              {recommendation.linkLabel}
            </Link>
          ) : null}
        >
          <div className="fg-inline-form">
            <label>
              Usage window
              <select aria-label="Usage window" value={window} onChange={(event) => onWindowChange(event.target.value as UsageWindow)}>
                {windowOptions.map((option) => (
                  <option key={option} value={option}>
                    {windowLabels[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="fg-actions">
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.usage, instanceId)}>
              Usage Overview
            </Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}>
              Provider Health &amp; Runs
            </Link>
            <Link className="fg-nav-link" to={withInstanceScope(`${CONTROL_PLANE_ROUTES.usage}#client-investigation`, instanceId)}>
              Client Investigation
            </Link>
          </div>
          {recommendation ? (
            <div className="fg-stack">
              <strong>{recommendation.title}</strong>
              <p className="fg-muted">{recommendation.description}</p>
            </div>
          ) : null}
        </ActionBar>
      </div>

      {error ? (
        <ErrorState
          title="Usage drilldown loading failed"
          description={error}
        />
      ) : null}

      {partialMessages.length > 0 ? (
        <BlockedState
          title="Partial data"
          description={partialMessages.join(" ")}
          status="partial"
          badgeLabel="Partial data"
        />
      ) : null}

      {state === "loading" ? (
        <LoadingState
          title="Loading usage drilldown"
          description="ForgeFrame is refreshing summary monitoring, client hotspot ranking, and the currently selected drilldowns."
        />
      ) : null}

      {summary ? (
        <SummaryStrip
          items={[
            {
              key: "active-models",
              label: "Active models",
              value: formatMetric(summary.metrics.active_model_count),
            },
            {
              key: "recorded-requests",
              label: "Recorded requests",
              value: formatMetric(summary.metrics.recorded_request_count),
            },
            {
              key: "recorded-errors",
              label: "Recorded errors",
              value: formatMetric(summary.metrics.recorded_error_count),
              status: summary.metrics.recorded_error_count ? "degraded" : "ready",
            },
            {
              key: "health-events",
              label: "Health events",
              value: formatMetric(summary.metrics.recorded_health_event_count),
            },
            {
              key: "freshness",
              label: "Freshness",
              value: freshness.label,
              meta: freshness.detail,
              tone: freshness.tone,
            },
            {
              key: "client-hotspots",
              label: "Client hotspots",
              value: attentionClients.length > 0 ? "Needs attention" : "No client flagged",
              meta: `${attentionClients.length} hotspot${attentionClients.length === 1 ? "" : "s"} in the current ranking.`,
              status: attentionClients.length > 0 ? "degraded" : "ready",
            },
          ]}
        />
      ) : null}

      {emptyUsage ? (
        <EmptyState
          title="No recent runtime or health traffic was recorded in this window"
          description="This is the expected empty state for a pre-launch or low-traffic installation. Keep the route honest by treating it as monitoring with no evidence rather than implying missing configuration controls."
        />
      ) : null}

      <div className="ff-operator-layout">
        <div className="ff-operator-main">
          {summary ? (
            <EntityTable
              title="Current alert pressure"
              description="Last-hour alert indicators stay separate from the historical window below so the route does not overstate what the selector controls."
              tableLabel="Current alert pressure"
              columns={[
                { key: "severity", header: "Severity", render: (row) => row.severity },
                { key: "type", header: "Type", render: (row) => row.type },
                { key: "message", header: "Message", render: (row) => row.message },
                { key: "value", header: "Value", render: (row) => row.value },
              ]}
              rows={currentAlertRows}
              rowKey={(row) => row.rowKey}
              emptyTitle="No active last-hour alert indicators."
              emptyDescription="Alert posture is clear right now. Historical evidence still stays visible on the monitoring surface."
            />
          ) : (
            <BlockedState
              title="Summary monitoring unavailable"
              description="Summary monitoring is unavailable for this scope, so provider-facing traffic evidence is reduced to the remaining client hotspot and drilldown signals."
              status="partial"
              badgeLabel="Summary unavailable"
            />
          )}

          <div id="client-investigation">
            <EntityTable
              title="Client investigation"
              description="Use this when the question is client blast radius, error concentration, or cost concentration rather than provider readiness."
              actions={(
                <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>
                  Open Errors & Activity
                </Link>
              )}
              tableLabel="Client investigation"
              columns={[
                { key: "clientId", header: "Client", render: (row) => row.clientId },
                { key: "requests", header: "Requests", render: (row) => row.requests },
                { key: "errors", header: "Errors", render: (row) => row.errors },
                { key: "errorRate", header: "Error rate", render: (row) => row.errorRate },
                { key: "needsAttention", header: "Needs attention", render: (row) => row.needsAttention },
              ]}
              rows={clientHotspotRows}
              rowKey={(row) => row.rowKey}
              emptyTitle="No client activity recorded in this window."
              emptyDescription="No client activity was recorded for the selected monitoring window."
            />
          </div>
        </div>

        <div className="ff-operator-sidebar">
          <DetailPanel
            title="Provider investigation"
            description="Use this after the summary points to a provider hotspot. Live readiness and control actions stay on Provider Health & Runs."
            status={providerName}
            statusKey={selectedProvider ? "runtime-ready" : "onboarding-only"}
            actions={(
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}>
                Open Provider Health & Runs
              </Link>
            )}
            sticky
          >
            {summary?.aggregations.by_provider.length ? (
              <>
                <div className="fg-inline-form">
                  <label>
                    Provider drilldown
                    <select value={selectedProvider} onChange={(event) => onSelectedProviderChange(event.target.value)}>
                      {summary.aggregations.by_provider.map((item) => {
                        const provider = toStringValue(item.provider, "");
                        return (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                {providerDrilldownError ? (
                  <ErrorState title="Provider drilldown unavailable" description={providerDrilldownError} />
                ) : null}
                {providerDrilldownState === "loading" ? (
                  <LoadingState title="Loading provider drilldown." description="ForgeFrame is restoring the selected provider detail view." />
                ) : null}

                {providerDrilldown ? (
                  <>
                    <dl>
                      <div>
                        <dt>Provider</dt>
                        <dd>{providerName}</dd>
                      </div>
                      <div>
                        <dt>Requests</dt>
                        <dd>{formatMetric(providerDrilldown.requests)}</dd>
                      </div>
                      <div>
                        <dt>Errors</dt>
                        <dd>{formatMetric(providerDrilldown.errors)}</dd>
                      </div>
                      <div>
                        <dt>Models with evidence</dt>
                        <dd>{formatMetric(providerModels.length)}</dd>
                      </div>
                      <div>
                        <dt>Clients with evidence</dt>
                        <dd>{formatMetric(providerClients.length)}</dd>
                      </div>
                    </dl>
                    <h4>Model concentration</h4>
                    <ul className="fg-list">
                      {providerModels.length === 0 ? <li>No model evidence recorded for this provider.</li> : null}
                      {providerModels.slice(0, 5).map((item) => (
                        <li key={toStringValue(item.model)}>
                          {toStringValue(item.model)} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · actual=
                          {formatMetric(item.actual_cost, 2)} · errors={formatMetric(item.errors)}
                        </li>
                      ))}
                    </ul>
                    <h4>Client concentration</h4>
                    <ul className="fg-list">
                      {providerClients.length === 0 ? <li>No client evidence recorded for this provider.</li> : null}
                      {providerClients.slice(0, 5).map((item) => (
                        <li key={toStringValue(item.client_id)}>
                          {toStringValue(item.client_id)} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · actual=
                          {formatMetric(item.actual_cost, 2)} · errors={formatMetric(item.errors)}
                        </li>
                      ))}
                    </ul>
                    <h4>Recent provider health evidence</h4>
                    <ul className="fg-list">
                      {providerHealth.length === 0 ? <li>No recent health checks recorded for this provider.</li> : null}
                      {providerHealth.slice(0, 5).map((item) => (
                        <li key={`${toStringValue(item.provider)}:${toStringValue(item.model)}:${toStringValue(item.checked_at)}`}>
                          {toStringValue(item.model)} · status={toStringValue(item.status)} · check={toStringValue(item.check_type)} · at=
                          {formatTimestamp(item.checked_at)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="No provider activity recorded in this window."
                description="Provider investigation opens once the selected monitoring window has provider-level traffic evidence."
              />
            )}
          </DetailPanel>

          <DetailPanel
            title="Client detail"
            description="Selected client summary and recent error or usage evidence for the active monitoring window."
            status={clientName}
            statusKey={selectedClient ? "ready" : "onboarding-only"}
          >
            {clientOps.length > 0 ? (
              <>
                <div className="fg-inline-form">
                  <label>
                    Client drilldown
                    <select value={selectedClient} onChange={(event) => onSelectedClientChange(event.target.value)}>
                      {clientOps.map((item) => {
                        const clientId = toStringValue(item.client_id, "");
                        return (
                          <option key={clientId} value={clientId}>
                            {clientId}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                {clientDrilldownError ? (
                  <ErrorState title="Client drilldown unavailable" description={clientDrilldownError} />
                ) : null}
                {clientDrilldownState === "loading" ? (
                  <LoadingState title="Loading client drilldown." description="ForgeFrame is restoring the selected client detail view." />
                ) : null}

                {clientDrilldown ? (
                  <>
                    <dl>
                      <div>
                        <dt>Client</dt>
                        <dd>{clientName}</dd>
                      </div>
                      <div>
                        <dt>Requests</dt>
                        <dd>{formatMetric(clientDrilldown.requests)}</dd>
                      </div>
                      <div>
                        <dt>Errors</dt>
                        <dd>{formatMetric(clientDrilldown.errors)}</dd>
                      </div>
                      <div>
                        <dt>Providers touched</dt>
                        <dd>{formatMetric(clientProviders.length)}</dd>
                      </div>
                    </dl>
                    <h4>Provider spread</h4>
                    <ul className="fg-list">
                      {clientProviders.length === 0 ? <li>No provider evidence recorded for this client.</li> : null}
                      {clientProviders.slice(0, 5).map((item) => (
                        <li key={toStringValue(item.provider)}>
                          {toStringValue(item.provider)} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · actual=
                          {formatMetric(item.actual_cost, 2)} · errors={formatMetric(item.errors)}
                        </li>
                      ))}
                    </ul>
                    <h4>Recent client errors</h4>
                    <ul className="fg-list">
                      {clientErrors.length === 0 ? <li>No recent errors recorded for this client.</li> : null}
                      {clientErrors.slice(0, 5).map((item, index) => (
                        <li key={`${toStringValue(item.provider)}-${index}`}>
                          {formatTimestamp(item.created_at ?? item.checked_at)} · provider={toStringValue(item.provider)} · model=
                          {toStringValue(item.model)} · type={toStringValue(item.error_type ?? item.status)}
                        </li>
                      ))}
                    </ul>
                    <h4>Recent client usage</h4>
                    <ul className="fg-list">
                      {clientUsage.length === 0 ? <li>No recent usage events recorded for this client.</li> : null}
                      {clientUsage.slice(0, 5).map((item, index) => (
                        <li key={`${toStringValue(item.provider)}-${index}`}>
                          {formatTimestamp(item.created_at)} · provider={toStringValue(item.provider)} · model={toStringValue(item.model)} ·
                          tokens={formatMetric(item.total_tokens)} · actual={formatMetric(item.actual_cost, 2)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="No client activity recorded in this window."
                description="Client detail opens once the selected monitoring window has client-level evidence."
              />
            )}
          </DetailPanel>
        </div>
      </div>

      {summary ? (
        <AdvancedDiagnostics
          title="Advanced diagnostics"
          description="Historical traffic, cost posture, and raw timeline evidence for deeper operator review."
          status={advancedStatus.replace(/_/g, " ")}
          statusKey={advancedStatus}
        >
          <div className="fg-card-grid">
            <article className="fg-subcard">
              <h4>Traffic split</h4>
              <ul className="fg-list">
                <li>
                  Runtime · requests={formatMetric(summary.traffic_split.runtime.requests)} · tokens=
                  {formatMetric(summary.traffic_split.runtime.tokens)} · actual={formatMetric(summary.traffic_split.runtime.actual_cost, 2)}
                </li>
                <li>
                  Health checks · requests={formatMetric(summary.traffic_split.health_check.requests)} · tokens=
                  {formatMetric(summary.traffic_split.health_check.tokens)} · actual={formatMetric(summary.traffic_split.health_check.actual_cost, 2)}
                </li>
              </ul>
            </article>

            <article className="fg-subcard">
              <h4>Top providers</h4>
              <ul className="fg-list">
                {providerTrafficRows.length === 0 ? <li>No provider traffic recorded.</li> : null}
                {providerTrafficRows.map((row) => (
                  <li key={row.rowKey}>
                    {row.provider} · requests={row.requests} · tokens={row.tokens} · actual={row.actualCost}
                  </li>
                ))}
              </ul>
            </article>

            <article className="fg-subcard">
              <h4>Error shape</h4>
              <ul className="fg-list">
                {summary.aggregations.errors_by_provider.slice(0, 3).map((item) => (
                  <li key={`provider-${toStringValue(item.provider)}`}>
                    Provider {toStringValue(item.provider)}: {formatMetric(item.errors)} errors
                  </li>
                ))}
                {summary.aggregations.errors_by_client.slice(0, 3).map((item) => (
                  <li key={`client-${toStringValue(item.client_id)}`}>
                    Client {toStringValue(item.client_id)}: {formatMetric(item.errors)} errors
                  </li>
                ))}
                {summary.aggregations.errors_by_type.slice(0, 3).map((item) => (
                  <li key={`type-${toStringValue(item.error_key)}`}>
                    {toStringValue(item.error_key)}: {formatMetric(item.errors)} errors
                  </li>
                ))}
                {summary.aggregations.errors_by_provider.length === 0 &&
                summary.aggregations.errors_by_client.length === 0 &&
                summary.aggregations.errors_by_type.length === 0 ? <li>No recorded error hotspots.</li> : null}
              </ul>
            </article>

            <article className="fg-subcard">
              <h4>Timeline</h4>
              <ul className="fg-list">
                {summary.timeline_24h.slice(-8).map((item) => (
                  <li key={toStringValue(item.bucket_start)}>
                    {toStringValue(item.bucket_start)} · req={formatMetric(item.requests)} · err={formatMetric(item.errors)} · rate=
                    {formatPercent(item.error_rate)} · actual={formatMetric(item.actual_cost, 2)}
                  </li>
                ))}
              </ul>
            </article>

            <article className="fg-subcard">
              <h4>Latest health evidence</h4>
              <ul className="fg-list">
                {summary.latest_health.length === 0 ? <li>No recent health evidence recorded.</li> : null}
                {summary.latest_health.slice(0, 5).map((item) => (
                  <li key={`${toStringValue(item.provider)}:${toStringValue(item.model)}:${toStringValue(item.checked_at)}`}>
                    {toStringValue(item.provider)} / {toStringValue(item.model)} · status={toStringValue(item.status)} · check=
                    {toStringValue(item.check_type)} · at={formatTimestamp(item.checked_at)}
                  </li>
                ))}
              </ul>
            </article>

            <article className="fg-subcard">
              <h4>Cost posture</h4>
              <ul className="fg-list">
                <li>Actual: {toStringValue(summary.cost_axes.actual)}</li>
                <li>Hypothetical: {toStringValue(summary.cost_axes.hypothetical)}</li>
                <li>Avoided: {toStringValue(summary.cost_axes.avoided)}</li>
                <li>Latest evidence: {latestEvidenceLabel}</li>
                {Object.entries(summary.pricing_snapshot).map(([key, value]) => (
                  <li key={key}>
                    {key}: {formatMetric(value, 2)}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </AdvancedDiagnostics>
      ) : null}
    </>
  );
}
