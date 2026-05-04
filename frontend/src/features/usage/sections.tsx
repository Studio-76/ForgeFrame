import { Link } from "react-router-dom";

import type { UsageSummaryResponse } from "../../api/domain";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope, withQueryParams } from "../../app/tenantScope";
import { ActionBar } from "../../components/ui/ActionBar";
import { DetailPanel } from "../../components/ui/DetailPanel";
import { EntityTable } from "../../components/ui/EntityTable";
import { BlockedState, EmptyState, ErrorState, LoadingState, PermissionState } from "../../components/ui/StateBlocks";
import { SummaryStrip } from "../../components/ui/SummaryStrip";
import { toNumberValue } from "./helpers";

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

type ProviderRow = {
  provider: string;
  requests: number;
  tokens: number;
  errors: number;
  actualCost: number;
};

type ClientRow = {
  clientId: string;
  requests: number;
  tokens: number;
  errors: number;
  actualCost: number;
};

type ModelRow = {
  model: string;
  requests: number;
  tokens: number;
  errors: number;
};

type AuthRow = {
  authKey: string;
  requests: number;
  tokens: number;
};

type UsageContentProps = {
  access: UsageAccessState;
  state: LoadState;
  error: string | null;
  partialMessages: string[];
  summary: UsageSummaryResponse | null;
  emptyUsage: boolean;
  latestEvidenceAt: number | null;
  freshness: FreshnessState;
  instanceId: string | null;
  window: UsageWindow;
  windowLabels: Record<UsageWindow, string>;
  windowOptions: UsageWindow[];
  providerFilter: string;
  providerOptions: string[];
  clientFilter: string;
  clientOptions: string[];
  modelFilter: string;
  modelOptions: string[];
  providerDrilldown: Record<string, unknown> | null;
  providerDrilldownState: LoadState;
  providerDrilldownError: string | null;
  clientDrilldown: Record<string, unknown> | null;
  clientDrilldownState: LoadState;
  clientDrilldownError: string | null;
  onWindowChange: (value: UsageWindow) => void;
  onProviderFilterChange: (value: string) => void;
  onClientFilterChange: (value: string) => void;
  onModelFilterChange: (value: string) => void;
  onResetFilters: () => void;
  formatMetric: (value: unknown, fractionDigits?: number) => string;
  formatPercent: (value: unknown) => string;
  formatTimestamp: (value: unknown, fallback?: string) => string;
};

function rate(errors: number, requests: number): number {
  return errors / Math.max(1, requests + errors);
}

function buildErrorLookup(items: Array<Record<string, string | number>>, keyField: string): Map<string, number> {
  return new Map(
    items.map((item) => [String(item[keyField] ?? ""), toNumberValue(item.errors)]),
  );
}

function buildProviderRows(summary: UsageSummaryResponse): ProviderRow[] {
  const errorLookup = buildErrorLookup(summary.aggregations.errors_by_provider, "provider");
  return summary.aggregations.by_provider.map((item) => {
    const provider = String(item.provider ?? "");
    return {
      provider,
      requests: toNumberValue(item.requests),
      tokens: toNumberValue(item.tokens),
      errors: errorLookup.get(provider) ?? 0,
      actualCost: toNumberValue(item.actual_cost),
    };
  });
}

function buildClientRows(summary: UsageSummaryResponse): ClientRow[] {
  const errorLookup = buildErrorLookup(summary.aggregations.errors_by_client, "client_id");
  return summary.aggregations.by_client.map((item) => {
    const clientId = String(item.client_id ?? "");
    return {
      clientId,
      requests: toNumberValue(item.requests),
      tokens: toNumberValue(item.tokens),
      errors: errorLookup.get(clientId) ?? 0,
      actualCost: toNumberValue(item.actual_cost),
    };
  });
}

function buildModelRows(summary: UsageSummaryResponse): ModelRow[] {
  const errorLookup = buildErrorLookup(summary.aggregations.errors_by_model, "model");
  return summary.aggregations.by_model.map((item) => {
    const model = String(item.model ?? "");
    return {
      model,
      requests: toNumberValue(item.requests),
      tokens: toNumberValue(item.tokens),
      errors: errorLookup.get(model) ?? 0,
    };
  });
}

function buildAuthRows(summary: UsageSummaryResponse): AuthRow[] {
  return summary.aggregations.by_auth.map((item) => ({
    authKey: String(item.auth_key ?? ""),
    requests: toNumberValue(item.requests),
    tokens: toNumberValue(item.tokens),
  }));
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
}

export function UsageContent({
  access,
  state,
  error,
  partialMessages,
  summary,
  emptyUsage,
  latestEvidenceAt,
  freshness,
  instanceId,
  window,
  windowLabels,
  windowOptions,
  providerFilter,
  providerOptions,
  clientFilter,
  clientOptions,
  modelFilter,
  modelOptions,
  providerDrilldown,
  providerDrilldownState,
  providerDrilldownError,
  clientDrilldown,
  clientDrilldownState,
  clientDrilldownError,
  onWindowChange,
  onProviderFilterChange,
  onClientFilterChange,
  onModelFilterChange,
  onResetFilters,
  formatMetric,
  formatPercent,
  formatTimestamp,
}: UsageContentProps) {
  const providerRows = summary ? buildProviderRows(summary) : [];
  const clientRows = summary ? buildClientRows(summary) : [];
  const modelRows = summary ? buildModelRows(summary) : [];
  const authRows = summary ? buildAuthRows(summary) : [];
  const topProvider = providerRows[0]?.provider ?? "No provider traffic";
  const topClient = clientRows[0]?.clientId ?? "No client traffic";
  const runtimeRequests = toNumberValue(summary?.traffic_split.runtime.requests);
  const totalTokens = toNumberValue(summary?.traffic_split.runtime.tokens) + toNumberValue(summary?.traffic_split.health_check.tokens);
  const recordedErrors = toNumberValue(summary?.metrics.recorded_error_count);
  const streamRequests = toNumberValue(summary?.stream_mode_counts?.stream);
  const runtimeRequestCount = toNumberValue(summary?.stream_mode_counts?.runtime_request_count);
  const filtersActive = Boolean(providerFilter || clientFilter || modelFilter);
  const providerModels = asRecordArray(providerDrilldown?.models);
  const providerClients = asRecordArray(providerDrilldown?.clients);
  const providerHealth = asRecordArray(providerDrilldown?.latest_health);
  const clientProviders = asRecordArray(clientDrilldown?.providers);
  const clientRecentErrors = asRecordArray(clientDrilldown?.recent_errors);
  const clientRecentUsage = asRecordArray(clientDrilldown?.recent_usage);
  const providerDetailLink = (provider: string) => withQueryParams(`${CONTROL_PLANE_ROUTES.usage}#provider-detail`, {
    instanceId,
    usageWindow: window,
    provider,
    client: null,
    model: modelFilter || null,
  });
  const clientDetailLink = (clientId: string) => withQueryParams(`${CONTROL_PLANE_ROUTES.usage}#client-detail`, {
    instanceId,
    usageWindow: window,
    provider: null,
    client: clientId,
    model: modelFilter || null,
  });

  return (
    <>
      {access.noticeTitle && access.noticeDetail ? (
        <PermissionState title={access.noticeTitle} description={access.noticeDetail} />
      ) : null}

      <ActionBar
        title="Usage filters"
        description="Filter the analysis by selected window, provider, client, and model. Costs and Errors stay separate operational routes."
        actions={(
          <div className="fg-actions">
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.costs, instanceId)}>
              Open Costs
            </Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId)}>
              Open Errors
            </Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}>
              Provider Health &amp; Runs
            </Link>
          </div>
        )}
      >
        <div className="fg-inline-form">
          <label>
            Time window
            <select aria-label="Usage window" value={window} onChange={(event) => onWindowChange(event.target.value as UsageWindow)}>
              {windowOptions.map((option) => (
                <option key={option} value={option}>
                  {windowLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Provider
            <select aria-label="Usage provider filter" value={providerFilter} onChange={(event) => onProviderFilterChange(event.target.value)}>
              <option value="">All providers</option>
              {providerOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Client
            <select aria-label="Usage client filter" value={clientFilter} onChange={(event) => onClientFilterChange(event.target.value)}>
              <option value="">All clients</option>
              {clientOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model
            <select aria-label="Usage model filter" value={modelFilter} onChange={(event) => onModelFilterChange(event.target.value)}>
              <option value="">All models</option>
              {modelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            API key
            <select aria-label="Usage API key filter" disabled value="">
              <option value="">Unsupported</option>
            </select>
          </label>
          {filtersActive ? (
            <button type="button" className="fg-button" onClick={onResetFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
        <p className="fg-muted">
          API-key filtering is currently blocked. Runtime error events do not yet persist auth attribution, so ForgeFrame keeps that axis honest and routes spend review to Costs instead of faking a partial filter.
        </p>
        <p className="fg-muted">
          Latest evidence: {formatTimestamp(latestEvidenceAt ? new Date(latestEvidenceAt).toISOString() : null, "No recent evidence")} · {freshness.detail}
        </p>
      </ActionBar>

      {error ? (
        <ErrorState
          title="Usage analysis loading failed"
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
          title="Loading usage analysis"
          description="ForgeFrame is refreshing traffic, hotspot, and model concentration evidence for the selected window."
        />
      ) : null}

      {summary ? (
        <SummaryStrip
          items={[
            {
              key: "requests",
              label: "Requests",
              value: formatMetric(summary.metrics.recorded_request_count),
            },
            {
              key: "tokens",
              label: "Tokens",
              value: formatMetric(totalTokens),
            },
            {
              key: "streaming-share",
              label: "Streaming share",
              value: runtimeRequestCount > 0 ? formatPercent(streamRequests / runtimeRequestCount) : "0.0%",
              meta: `${formatMetric(streamRequests)} of ${formatMetric(runtimeRequestCount)} runtime requests streamed.`,
            },
            {
              key: "error-rate",
              label: "Error rate",
              value: formatPercent(rate(recordedErrors, runtimeRequests)),
              status: recordedErrors > 0 ? "degraded" : "ready",
            },
            {
              key: "latency-p95",
              label: "Latency p95",
              value: summary.runtime_duration_ms?.p95 !== null && summary.runtime_duration_ms?.p95 !== undefined ? `${formatMetric(summary.runtime_duration_ms.p95)} ms` : "n/a",
              meta: summary.runtime_duration_ms?.sample_count ? `${formatMetric(summary.runtime_duration_ms.sample_count)} runtime samples` : "No runtime latency samples",
            },
            {
              key: "top-provider",
              label: "Top provider",
              value: topProvider,
            },
            {
              key: "top-client",
              label: "Top client",
              value: topClient,
            },
          ]}
        />
      ) : null}

      {emptyUsage ? (
        <EmptyState
          title="No traffic in selected window"
          description="ForgeFrame found no runtime or health traffic for the selected instance and time window. This is an honest empty state, not an operational failure."
        />
      ) : null}

      {summary ? (
        <div className="fg-stack">
          <EntityTable
            title="Provider drilldown"
            description="Use provider rows to identify traffic concentration, then branch to Provider Health, Errors, or Costs instead of mixing those controls into this page."
            tableLabel="Provider drilldown"
            columns={[
              { key: "provider", header: "Provider", render: (row: ProviderRow) => row.provider },
              { key: "requests", header: "Requests", render: (row: ProviderRow) => formatMetric(row.requests) },
              { key: "tokens", header: "Tokens", render: (row: ProviderRow) => formatMetric(row.tokens) },
              { key: "errors", header: "Errors", render: (row: ProviderRow) => formatMetric(row.errors) },
              { key: "errorRate", header: "Error rate", render: (row: ProviderRow) => formatPercent(rate(row.errors, row.requests)) },
              {
                key: "nextRoute",
                header: "Next route",
                render: (row: ProviderRow) => (
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={providerDetailLink(row.provider)}>Usage detail</Link>
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}>Provider Health</Link>
                    {row.errors > 0 ? <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId)}>Errors</Link> : null}
                    {row.actualCost > 0 ? <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.costs, instanceId)}>Costs</Link> : null}
                  </div>
                ),
              },
            ]}
            rows={providerRows}
            rowKey={(row) => row.provider}
            emptyTitle="No provider traffic in selected window"
            emptyDescription="No provider-level usage evidence matches the selected filters."
          />

          <EntityTable
            title="Client drilldown"
            description="Client rows expose blast radius, error concentration, and the next honest route for investigation."
            tableLabel="Client drilldown"
            columns={[
              { key: "client", header: "Client", render: (row: ClientRow) => row.clientId },
              { key: "requests", header: "Requests", render: (row: ClientRow) => formatMetric(row.requests) },
              { key: "tokens", header: "Tokens", render: (row: ClientRow) => formatMetric(row.tokens) },
              { key: "errors", header: "Errors", render: (row: ClientRow) => formatMetric(row.errors) },
              { key: "errorRate", header: "Error rate", render: (row: ClientRow) => formatPercent(rate(row.errors, row.requests)) },
              {
                key: "nextRoute",
                header: "Next route",
                render: (row: ClientRow) => (
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={clientDetailLink(row.clientId)}>Usage detail</Link>
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId)}>Errors</Link>
                    {row.actualCost > 0 ? <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.costs, instanceId)}>Costs</Link> : null}
                  </div>
                ),
              },
            ]}
            rows={clientRows}
            rowKey={(row) => row.clientId}
            emptyTitle="No client traffic in selected window"
            emptyDescription="No client-level usage evidence matches the selected filters."
          />

          <EntityTable
            title="Model concentration"
            description="Models stay visible as a runtime pressure axis, but follow-up still happens on Errors or Provider Health instead of here."
            tableLabel="Model concentration"
            columns={[
              { key: "model", header: "Model", render: (row: ModelRow) => row.model },
              { key: "requests", header: "Requests", render: (row: ModelRow) => formatMetric(row.requests) },
              { key: "tokens", header: "Tokens", render: (row: ModelRow) => formatMetric(row.tokens) },
              { key: "errors", header: "Errors", render: (row: ModelRow) => formatMetric(row.errors) },
              {
                key: "nextRoute",
                header: "Next route",
                render: (row: ModelRow) => (
                  <div className="fg-actions">
                    {row.errors > 0 ? <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId)}>Errors</Link> : null}
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}>Provider Health</Link>
                  </div>
                ),
              },
            ]}
            rows={modelRows}
            rowKey={(row) => row.model}
            emptyTitle="No model traffic in selected window"
            emptyDescription="No model-level usage evidence matches the selected filters."
          />

          <EntityTable
            title="API key / auth hotspots"
            description="Auth usage is visible here, but filter-level auth attribution is still blocked until runtime errors persist the same axis."
            tableLabel="API key auth hotspots"
            columns={[
              { key: "authKey", header: "Auth source", render: (row: AuthRow) => row.authKey },
              { key: "requests", header: "Requests", render: (row: AuthRow) => formatMetric(row.requests) },
              { key: "tokens", header: "Tokens", render: (row: AuthRow) => formatMetric(row.tokens) },
              {
                key: "nextRoute",
                header: "Next route",
                render: () => (
                  <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.costs, instanceId)}>
                    Costs
                  </Link>
                ),
              },
            ]}
            rows={authRows}
            rowKey={(row) => row.authKey}
            emptyTitle="No auth-attributed traffic in selected window"
            emptyDescription="No auth-attributed usage evidence matches the selected filters."
          />

          {providerFilter ? (
            <div id="provider-detail">
              <DetailPanel
                title="Provider detail"
                description="This drilldown is row-specific and backed by the provider usage endpoint instead of generic routing links."
                status={providerFilter}
                statusKey="ready"
                actions={(
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}>Provider Health</Link>
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId)}>Errors</Link>
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.costs, instanceId)}>Costs</Link>
                  </div>
                )}
              >
                {providerDrilldownError ? <ErrorState title="Provider drilldown unavailable" description={providerDrilldownError} /> : null}
                {providerDrilldownState === "loading" ? (
                  <LoadingState title="Loading provider detail" description="ForgeFrame is restoring the selected provider usage drilldown." />
                ) : null}
                {providerDrilldown ? (
                  <>
                    <dl>
                      <div>
                        <dt>Provider</dt>
                        <dd>{providerFilter}</dd>
                      </div>
                      <div>
                        <dt>Requests</dt>
                        <dd>{formatMetric(providerDrilldown.requests)}</dd>
                      </div>
                      <div>
                        <dt>Errors</dt>
                        <dd>{formatMetric(providerDrilldown.errors)}</dd>
                      </div>
                    </dl>
                    <h4>Models</h4>
                    <ul className="fg-list">
                      {providerModels.length === 0 ? <li>No model detail recorded for this provider.</li> : null}
                      {providerModels.slice(0, 5).map((item) => (
                        <li key={String(item.model ?? "unknown")}>
                          {String(item.model ?? "unknown")} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · errors={formatMetric(item.errors)}
                        </li>
                      ))}
                    </ul>
                    <h4>Clients</h4>
                    <ul className="fg-list">
                      {providerClients.length === 0 ? <li>No client detail recorded for this provider.</li> : null}
                      {providerClients.slice(0, 5).map((item) => (
                        <li key={String(item.client_id ?? "unknown")}>
                          {String(item.client_id ?? "unknown")} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · errors={formatMetric(item.errors)}
                        </li>
                      ))}
                    </ul>
                    <h4>Recent health</h4>
                    <ul className="fg-list">
                      {providerHealth.length === 0 ? <li>No provider health evidence recorded.</li> : null}
                      {providerHealth.slice(0, 5).map((item) => (
                        <li key={`${String(item.provider ?? "unknown")}:${String(item.model ?? "unknown")}:${String(item.checked_at ?? "unknown")}`}>
                          {String(item.model ?? "unknown")} · status={String(item.status ?? "unknown")} · check={String(item.check_type ?? "unknown")} · at={formatTimestamp(item.checked_at)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </DetailPanel>
            </div>
          ) : null}

          {clientFilter ? (
            <div id="client-detail">
              <DetailPanel
                title="Client detail"
                description="This drilldown is row-specific and backed by the client usage endpoint instead of a generic incident link."
                status={clientFilter}
                statusKey="ready"
                actions={(
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.errors, instanceId)}>Errors</Link>
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.costs, instanceId)}>Costs</Link>
                  </div>
                )}
              >
                {clientDrilldownError ? <ErrorState title="Client drilldown unavailable" description={clientDrilldownError} /> : null}
                {clientDrilldownState === "loading" ? (
                  <LoadingState title="Loading client detail" description="ForgeFrame is restoring the selected client usage drilldown." />
                ) : null}
                {clientDrilldown ? (
                  <>
                    <dl>
                      <div>
                        <dt>Client</dt>
                        <dd>{clientFilter}</dd>
                      </div>
                      <div>
                        <dt>Requests</dt>
                        <dd>{formatMetric(clientDrilldown.requests)}</dd>
                      </div>
                      <div>
                        <dt>Errors</dt>
                        <dd>{formatMetric(clientDrilldown.errors)}</dd>
                      </div>
                    </dl>
                    <h4>Providers</h4>
                    <ul className="fg-list">
                      {clientProviders.length === 0 ? <li>No provider detail recorded for this client.</li> : null}
                      {clientProviders.slice(0, 5).map((item) => (
                        <li key={String(item.provider ?? "unknown")}>
                          {String(item.provider ?? "unknown")} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · errors={formatMetric(item.errors)}
                        </li>
                      ))}
                    </ul>
                    <h4>Recent errors</h4>
                    <ul className="fg-list">
                      {clientRecentErrors.length === 0 ? <li>No recent errors recorded for this client.</li> : null}
                      {clientRecentErrors.slice(0, 5).map((item, index) => (
                        <li key={`${String(item.provider ?? "unknown")}-${index}`}>
                          {formatTimestamp(item.created_at)} · provider={String(item.provider ?? "unknown")} · model={String(item.model ?? "unknown")} · type={String(item.error_type ?? "unknown")}
                        </li>
                      ))}
                    </ul>
                    <h4>Recent usage</h4>
                    <ul className="fg-list">
                      {clientRecentUsage.length === 0 ? <li>No recent usage recorded for this client.</li> : null}
                      {clientRecentUsage.slice(0, 5).map((item, index) => (
                        <li key={`${String(item.provider ?? "unknown")}-${index}`}>
                          {formatTimestamp(item.created_at)} · provider={String(item.provider ?? "unknown")} · model={String(item.model ?? "unknown")} · tokens={formatMetric(item.total_tokens)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </DetailPanel>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
