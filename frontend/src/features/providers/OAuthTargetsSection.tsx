import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import type { ProvidersPageActions, ProvidersPageData } from "./providersShared";
import { formatMetric, formatTimestamp, toStringValue } from "./providersShared";
import {
  contractStatusFromOauthConnectionStatus,
  formatContractClassification,
  formatOauthActionMode,
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

/**
 * OAuth targets section displaying provider connections with runtime-ready,
 * bridge-only, and attention statuses. Includes per-target actions like
 * probe and bridge sync, plus route diagnostics and operations history.
 */
export function OAuthTargetsSection({ data, actions }: SectionProps) {
  const integrationErrorSummary = Object.entries(data.integrationErrors)
    .map(([key, value]) => `${key}=${value}`)
    .join(" | ");
  const sortedTargets = [...data.oauthTargets].sort((left, right) => {
    const leftOrder = OAUTH_TARGET_PRIORITY[left.provider_key] ?? 99;
    const rightOrder = OAUTH_TARGET_PRIORITY[right.provider_key] ?? 99;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return formatOauthProviderName(left).localeCompare(formatOauthProviderName(right));
  });
  const runtimeReadyCount = sortedTargets.filter((target) => target.connection_status === "runtime-ready").length;
  const bridgeOnlyCount = sortedTargets.filter((target) => target.connection_status === "bridge-only").length;
  const missingSetupCount = sortedTargets.filter((target) => target.setup.missing_env_vars.length > 0).length;
  const attentionCount = sortedTargets.filter((target) =>
    target.connection_status === "probe failed" || target.connection_status === "expired" || target.connection_status === "needs refresh").length;

  return (
    <>
      <SectionCard
        title="OAuth Provider Connections"
        description="Each provider card says exactly what ForgeFrame can do today: whether the token path is externally supplied, whether probe/runtime proof exists, and which actions are real versus manual."
        actions={
          <>
            {data.access.canOperate ? (
              <button type="button" onClick={() => void actions.probeAllOauthTargets()}>
                Probe all OAuth targets
              </button>
            ) : null}
            {data.access.canMutate ? (
              <button type="button" onClick={() => void actions.syncOauthBridgeProfiles()}>
                Sync OAuth bridge profiles
              </button>
            ) : null}
          </>
        }
      >
        <div className="fg-grid fg-grid-compact fg-mb-md">
          <MetricTile label="Runtime ready" value={formatMetric(runtimeReadyCount)} note={`${formatMetric(sortedTargets.length)} tracked targets`} />
          <MetricTile label="Bridge only" value={formatMetric(bridgeOnlyCount)} note="probe truth does not equal native runtime" />
          <MetricTile label="Manual setup pending" value={formatMetric(missingSetupCount)} note="missing env or bridge toggles" />
          <MetricTile label="Needs attention" value={formatMetric(attentionCount)} note={`${formatMetric(data.oauthTotalOps)} persisted ops`} />
        </div>

        {!data.access.canOperate ? (
          <p className="fg-note fg-mb-md">
            {data.access.summaryDetail} This session can inspect the contract, but probe buttons stay blocked until a non-read-only operator session is active.
          </p>
        ) : null}
        {data.access.canOperate && !data.access.canMutate ? (
          <p className="fg-note fg-mb-md">
            Probe actions are available on this route, but bridge-profile sync remains hidden because the backend reserves that path for write-capable sessions.
          </p>
        ) : null}

        <div className="fg-card-grid">
          {sortedTargets.map((target) => {
            const setup = target.setup ?? {
              summary: "",
              required_env_vars: [],
              optional_env_vars: [],
              missing_env_vars: [],
              steps: [],
            };
            const actionList = Array.isArray(target.actions) ? target.actions : [];
            const manualAction = actionList.find((item) => item.action_key === "manual_token");
            const connectAction = actionList.find((item) => item.action_key === "connect");
            const deviceAction = actionList.find((item) => item.action_key === "device_code");
            const bridgeSyncAction = actionList.find((item) => item.action_key === "bridge_sync");
            const probeAction = actionList.find((item) => item.action_key === "probe");
            const disconnectAction = actionList.find((item) => item.action_key === "disconnect");

            return (
              <article key={target.provider_key} className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{formatOauthProviderName(target)}</h4>
                    <p className="fg-muted">
                      {target.provider_key} · {target.connection_method}
                    </p>
                  </div>
                  <div className="fg-actions">
                    <TonePill label={formatOauthConnectionStatus(target.connection_status)} tone={toneFromOauthConnectionStatus(target.connection_status)} />
                    <TonePill
                      label={`contract ${formatContractClassification(target.contract_classification)}`}
                      tone={toneFromContractClassification(target.contract_classification)}
                    />
                    <TonePill label={`readiness ${target.readiness}`} tone={toneFromReadinessAxis(target.readiness)} />
                  </div>
                </div>

                <div className="fg-detail-grid">
                  <p>{target.connection_status_reason}</p>
                  <p>Next step: {target.next_step}</p>
                  <p>{setup.summary}</p>
                  {setup.missing_env_vars.length > 0 ? (
                    <p>
                      Missing env:{" "}
                      {setup.missing_env_vars.map((item) => (
                        <span key={item} className="fg-code">
                          {item}{" "}
                        </span>
                      ))}
                    </p>
                  ) : null}
                  {manualAction ? <p>Manual setup: {manualAction.detail}</p> : null}
                  {connectAction ? <p>Connect path: {connectAction.detail}</p> : null}
                  {deviceAction ? <p>Device-code path: {deviceAction.detail}</p> : null}
                </div>

                <div className="fg-mt-sm">
                  <h5>Actions</h5>
                  <ul className="fg-list">
                    {actionList.map((item) => {
                      const requiresOperate = item.action_key === "probe";
                      const requiresMutate = item.action_key === "bridge_sync";
                      const canInvoke = item.mode === "api"
                        && item.supported
                        && ((requiresOperate && data.access.canOperate) || (requiresMutate && data.access.canMutate));
                      return (
                        <li key={item.action_key}>
                          <strong>{item.label}</strong> · {item.detail} · {formatOauthActionMode(item.mode)}
                          {canInvoke && item.action_key === "probe" ? (
                            <>
                              {" "}
                              <button type="button" onClick={() => void actions.probeOauthTarget(target.provider_key)}>
                                Test connection
                              </button>
                            </>
                          ) : null}
                          {canInvoke && item.action_key === "bridge_sync" ? (
                            <>
                              {" "}
                              <button type="button" onClick={() => void actions.syncOauthBridgeProfiles()}>
                                Sync bridge profile
                              </button>
                            </>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {bridgeSyncAction && !data.access.canMutate ? (
                    <p className="fg-muted fg-mt-sm">
                      Bridge sync is modeled per provider card, but the current backend endpoint applies the sync globally for all bridge profiles and stays write-gated.
                    </p>
                  ) : null}
                  {probeAction && !data.access.canOperate ? (
                    <p className="fg-muted fg-mt-sm">Probe actions are real backend tests, so they stay blocked for read-only sessions.</p>
                  ) : null}
                  {disconnectAction ? <p className="fg-muted fg-mt-sm">Disconnect stays external-only: {disconnectAction.detail}</p> : null}
                </div>

                <div className="fg-mt-sm">
                  <h5>Manual setup</h5>
                  <ol>
                    {setup.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {setup.required_env_vars.length > 0 ? (
                    <p>
                      Required env:{" "}
                      {setup.required_env_vars.map((item) => (
                        <span key={item} className="fg-code">
                          {item}{" "}
                        </span>
                      ))}
                    </p>
                  ) : null}
                  {setup.optional_env_vars.length > 0 ? (
                    <p>
                      Optional env:{" "}
                      {setup.optional_env_vars.map((item) => (
                        <span key={item} className="fg-code">
                          {item}{" "}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>

                <AdvancedDiagnostics
                  title={`Advanced Diagnostics — ${formatOauthProviderName(target)}`}
                  description="Session truth, runtime proof, streaming/tool evidence, and raw operator posture stay here instead of crowding the primary connection card."
                  status={formatOauthConnectionStatus(target.connection_status)}
                  statusTone={toneFromOauthConnectionStatus(target.connection_status) === "danger" ? "danger" : toneFromOauthConnectionStatus(target.connection_status) === "success" ? "success" : "warning"}
                  statusKey={contractStatusFromOauthConnectionStatus(target.connection_status)}
                >
                  <div className="fg-detail-grid">
                    <p>Auth kind: {target.auth_kind} · oauth mode={target.oauth_mode ?? "-"} · flow support={target.oauth_flow_support ?? "-"}</p>
                    <p>Queue lane: {target.queue_lane} · parallelism={target.parallelism_mode} · cost posture={target.cost_posture}</p>
                    <p>Session reuse: {target.session_reuse_strategy}</p>
                    <p>Operator truth: {target.operator_truth}</p>
                    <p>Escalation: {target.escalation_support}</p>
                    <p>
                      Probe evidence: {target.evidence.live_probe.status} ({target.evidence.live_probe.details})
                    </p>
                    <p>
                      Runtime evidence: {target.evidence.runtime.status} ({target.evidence.runtime.details})
                    </p>
                    <p>
                      Streaming evidence: {target.evidence.streaming.status} ({target.evidence.streaming.details})
                    </p>
                    <p>
                      Tool evidence: {target.evidence.tool_calling.status} ({target.evidence.tool_calling.details})
                    </p>
                    {target.last_probe ? (
                      <p>
                        Last probe: {formatTimestamp(target.last_probe.executed_at)} · {target.last_probe.status} · {target.last_probe.details}
                      </p>
                    ) : null}
                    {target.last_bridge_sync ? (
                      <p>
                        Last bridge sync: {formatTimestamp(target.last_bridge_sync.executed_at)} · {target.last_bridge_sync.status} · {target.last_bridge_sync.details}
                      </p>
                    ) : null}
                    {target.last_failed_operation ? (
                      <p>
                        Last failure: {formatTimestamp(target.last_failed_operation.executed_at)} · {target.last_failed_operation.status} · {target.last_failed_operation.details}
                      </p>
                    ) : null}
                  </div>
                </AdvancedDiagnostics>
              </article>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Route Diagnostics"
        description="The remaining contract corpus, onboarding depth, and raw operation history stay available, but they no longer replace the actual provider connection surface."
      >
        <AdvancedDiagnostics
          title="Product Axis Contracts"
          description="Axis-level contract records remain visible for audit and rollout work."
          defaultOpen={false}
        >
          <ul className="fg-list">
            {data.productAxisTargets.map((target) => (
              <li key={target.provider_key}>
                {target.provider_key} · contract={formatContractClassification(target.contract_classification)} · runtime={target.runtime_path} · auth=
                {target.auth_model} · status={target.status_summary}
              </li>
            ))}
          </ul>
        </AdvancedDiagnostics>

        <AdvancedDiagnostics
          title="OAuth Onboarding Guide"
          description="Per-target next steps derived from the backend truth model."
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
          description="Persisted provider-operation counters and the recent raw log."
          defaultOpen={false}
        >
          <p>Persisted operations: {formatMetric(data.oauthTotalOps)}</p>
          <ul className="fg-list">
            {data.oauthOperations.map((item) => (
              <li key={toStringValue(item.provider_key)}>
                {toStringValue(item.provider_key)} · failures={formatMetric(item.failures)} · failures_24h={formatMetric(item.failures_24h)} ·
                probes={formatMetric(item.probe_count)} · bridge syncs={formatMetric(item.bridge_sync_count)} · failure rate=
                {formatMetric(item.failure_rate, 2)} · needs attention={toStringValue(item.needs_attention)}
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
          description="Backend bootstrap checks that still affect the public product path."
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

/** @deprecated Use {@link OAuthTargetsSection} instead. */
export const ExpansionTargetsSection = OAuthTargetsSection;
