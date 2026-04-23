import { Link } from "react-router-dom";

import type { UsageSummaryResponse } from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";

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
  return (
    <>
      {access.noticeTitle && access.noticeDetail ? (
        <article className="fg-card">
          <h3>{access.noticeTitle}</h3>
          <p className="fg-muted">{access.noticeDetail}</p>
        </article>
      ) : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Monitoring window</h3>
            <p className="fg-muted">Window changes should preserve focus and make it clear whether the evidence is fresh, partial, or empty.</p>
          </div>
          <span className="fg-pill" data-tone={state === "loading" ? "neutral" : "success"}>
            {state === "loading" ? "Refreshing data" : windowLabels[window]}
          </span>
        </div>
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
      </article>

      {error ? <p className="fg-danger">{error}</p> : null}

      {partialMessages.length > 0 ? (
        <article className="fg-card">
          <h3>Partial data</h3>
          <ul className="fg-list">
            {partialMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </article>
      ) : null}

      {state === "loading" ? (
        <article className="fg-card">
          <h3>Loading usage drilldown</h3>
          <p className="fg-muted">ForgeFrame is refreshing summary monitoring, client hotspot ranking, and the currently selected drilldowns.</p>
        </article>
      ) : null}

      {summary ? (
        <>
          <div className="fg-grid">
            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Current alert pressure</h3>
                  <p className="fg-muted">Last-hour alert indicators stay separate from the historical window below so the route does not overstate what the selector controls.</p>
                </div>
                <span className="fg-pill" data-tone={summary.alerts.length > 0 ? "warning" : "success"}>
                  {summary.alerts.length > 0 ? `${summary.alerts.length} active signal${summary.alerts.length === 1 ? "" : "s"}` : "No current alert pressure"}
                </span>
              </div>
              <ul className="fg-list">
                {summary.alerts.length === 0 ? <li>No active last-hour alert indicators.</li> : null}
                {summary.alerts.map((item, index) => (
                  <li key={`${toStringValue(item.type)}-${index}`}>
                    {toStringValue(item.severity)} · {toStringValue(item.type)} · {toStringValue(item.message)} · value={toStringValue(item.value)}
                  </li>
                ))}
              </ul>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Recommended next route</h3>
                  <p className="fg-muted">{recommendation?.description}</p>
                </div>
                {recommendation ? (
                  <Link className="fg-nav-link" to={withInstanceScope(recommendation.to, instanceId)}>
                    {recommendation.linkLabel}
                  </Link>
                ) : null}
              </div>
              <p>
                <strong>{recommendation?.title}</strong>
              </p>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Recent evidence freshness</h3>
                  <p className="fg-muted">Keep recent evidence truth separate from the wider historical window.</p>
                </div>
                <span className="fg-pill" data-tone={freshness.tone}>
                  {freshness.label}
                </span>
              </div>
              <ul className="fg-list">
                <li>Historical window: {windowLabels[window]}</li>
                <li>Latest evidence: {latestEvidenceAt ? new Date(latestEvidenceAt).toISOString() : "No recent evidence"}</li>
                <li>Freshness source: latest health checks plus the fixed 24h timeline.</li>
                <li>{freshness.detail}</li>
              </ul>
            </article>

            <article className="fg-card">
              <div className="fg-panel-heading">
                <div>
                  <h3>Client hotspots</h3>
                  <p className="fg-muted">Use this ranking to decide whether the blast radius is client-specific before opening deeper investigation.</p>
                </div>
                <span className="fg-pill" data-tone={attentionClients.length > 0 ? "warning" : "success"}>
                  {attentionClients.length > 0 ? "Needs attention" : "No client flagged"}
                </span>
              </div>
              <ul className="fg-list">
                {attentionClients.length === 0 ? <li>No client exceeded the current needs-attention threshold.</li> : null}
                {attentionClients.map((item) => (
                  <li key={toStringValue(item.client_id)}>
                    {toStringValue(item.client_id)} · requests={formatMetric(item.requests)} · errors={formatMetric(item.errors)} · error rate=
                    {formatPercent(item.error_rate)}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          {emptyUsage ? (
            <article className="fg-card">
              <h3>No recent runtime or health traffic was recorded in this window</h3>
              <p className="fg-muted">
                This is the expected empty state for a pre-launch or low-traffic installation. Keep the route honest by treating it as monitoring with no evidence rather than implying missing configuration controls.
              </p>
            </article>
          ) : null}

          <article id="usage-overview" className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Monitoring overview</h3>
                <p className="fg-muted">Summary monitoring stays here. Use the provider and client sections below only after the blast radius is clear.</p>
              </div>
              <span className="fg-pill" data-tone="neutral">
                Historical evidence
              </span>
            </div>

            <div className="fg-grid fg-grid-compact">
              <article className="fg-kpi">
                <span className="fg-muted">Active models</span>
                <strong className="fg-kpi-value">{formatMetric(summary.metrics.active_model_count)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Recorded requests</span>
                <strong className="fg-kpi-value">{formatMetric(summary.metrics.recorded_request_count)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Recorded errors</span>
                <strong className="fg-kpi-value">{formatMetric(summary.metrics.recorded_error_count)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Health events</span>
                <strong className="fg-kpi-value">{formatMetric(summary.metrics.recorded_health_event_count)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Runtime actual cost</span>
                <strong className="fg-kpi-value">{formatMetric(summary.traffic_split.runtime.actual_cost, 2)}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Health actual cost</span>
                <strong className="fg-kpi-value">{formatMetric(summary.traffic_split.health_check.actual_cost, 2)}</strong>
              </article>
            </div>

            <div className="fg-card-grid fg-mt-md">
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
                  {summary.aggregations.by_provider.length === 0 ? <li>No provider traffic recorded.</li> : null}
                  {summary.aggregations.by_provider.slice(0, 5).map((item) => (
                    <li key={toStringValue(item.provider)}>
                      {toStringValue(item.provider)} · requests={formatMetric(item.requests)} · tokens={formatMetric(item.tokens)} · actual=
                      {formatMetric(item.actual_cost, 2)}
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
                  {Object.entries(summary.pricing_snapshot).map(([key, value]) => (
                    <li key={key}>
                      {key}: {formatMetric(value, 2)}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </article>

          <article id="provider-investigation" className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Provider investigation</h3>
                <p className="fg-muted">Use this after the summary points to a provider hotspot. Live readiness and control actions stay on Provider Health & Runs.</p>
              </div>
              <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}>
                Open Provider Health & Runs
              </Link>
            </div>

            {summary.aggregations.by_provider.length === 0 ? (
              <p className="fg-muted">No provider activity recorded in this window.</p>
            ) : (
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

                {providerDrilldownError ? <p className="fg-danger">{providerDrilldownError}</p> : null}
                {providerDrilldownState === "loading" ? <p className="fg-muted">Loading provider drilldown.</p> : null}

                {providerDrilldown ? (
                  <div className="fg-card-grid fg-mt-md">
                    <article className="fg-subcard">
                      <h4>Selected provider summary</h4>
                      <ul className="fg-list">
                        <li>Provider: {toStringValue(providerDrilldown.provider, selectedProvider)}</li>
                        <li>Requests: {formatMetric(providerDrilldown.requests)}</li>
                        <li>Errors: {formatMetric(providerDrilldown.errors)}</li>
                        <li>Models with evidence: {formatMetric(providerModels.length)}</li>
                        <li>Clients with evidence: {formatMetric(providerClients.length)}</li>
                      </ul>
                    </article>

                    <article className="fg-subcard">
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
                    </article>

                    <article className="fg-subcard">
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
                    </article>

                    <article className="fg-subcard">
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
                    </article>
                  </div>
                ) : null}
              </>
            )}
          </article>
        </>
      ) : null}

      <article id="client-investigation" className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Client investigation</h3>
            <p className="fg-muted">Use this when the question is client blast radius, error concentration, or cost concentration rather than provider readiness.</p>
          </div>
          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId)}>
            Open Errors & Activity
          </Link>
        </div>

        {clientOps.length === 0 ? (
          <p className="fg-muted">No client activity recorded in this window.</p>
        ) : (
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

            <div className="fg-card-grid fg-mt-md">
              <article className="fg-subcard">
                <h4>Hotspot ranking</h4>
                <ul className="fg-list">
                  {clientOps.slice(0, 5).map((item) => (
                    <li key={toStringValue(item.client_id)}>
                      {toStringValue(item.client_id)} · requests={formatMetric(item.requests)} · errors={formatMetric(item.errors)} · rate=
                      {formatPercent(item.error_rate)} · needs attention={toStringValue(item.needs_attention)}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="fg-subcard">
                <h4>Selected client summary</h4>
                {clientDrilldownError ? <p className="fg-danger">{clientDrilldownError}</p> : null}
                {clientDrilldownState === "loading" ? <p className="fg-muted">Loading client drilldown.</p> : null}
                {clientDrilldown ? (
                  <ul className="fg-list">
                    <li>Client: {toStringValue(clientDrilldown.client_id, selectedClient)}</li>
                    <li>Requests: {formatMetric(clientDrilldown.requests)}</li>
                    <li>Errors: {formatMetric(clientDrilldown.errors)}</li>
                    <li>Providers touched: {formatMetric(clientProviders.length)}</li>
                  </ul>
                ) : null}
              </article>

              <article className="fg-subcard">
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
              </article>

              <article className="fg-subcard">
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
              </article>

              <article className="fg-subcard">
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
              </article>
            </div>
          </>
        )}
      </article>
    </>
  );
}
