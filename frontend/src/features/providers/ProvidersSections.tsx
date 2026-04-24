import type { ReactNode } from "react";

import type {
  CapabilityEvidenceRecord,
  HarnessProfile,
  HealthConfig,
  ProviderCapabilityEvidenceRecord,
} from "../../api/admin";
import type { ProvidersPageActions, ProvidersPageData } from "./providersShared";
import {
  asRecord,
  formatProviderAxis,
  formatMetric,
  formatTimestamp,
  joinList,
  toBooleanValue,
  toStringValue,
} from "./providersShared";

type SectionProps = {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
};

type SectionCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

type Tone = "success" | "warning" | "danger" | "neutral";

function SectionCard({ title, description, actions, children }: SectionCardProps) {
  return (
    <div className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>{title}</h3>
          {description ? <p className="fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="fg-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function MetricTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="fg-kpi">
      <span className="fg-muted">{label}</span>
      <strong className="fg-kpi-value">{value}</strong>
      {note ? <span className="fg-muted">{note}</span> : null}
    </div>
  );
}

function TonePill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className="fg-pill" data-tone={tone}>
      {label}
    </span>
  );
}

function PermissionCallout({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="fg-subcard">
      <h4>{title}</h4>
      <p className="fg-muted">{detail}</p>
    </div>
  );
}

function toneFromStatus(status: string | null | undefined): Tone {
  if (!status) {
    return "neutral";
  }
  const normalizedStatus = status.toLowerCase().replaceAll("_", " ");
  if (["active", "enabled", "healthy", "ok", "ready", "supported"].includes(normalizedStatus)) {
    return "success";
  }
  if (["attention", "degraded", "needs attention", "partial", "warning"].includes(normalizedStatus)) {
    return "warning";
  }
  if (["blocked", "error", "failed", "revoked"].includes(normalizedStatus)) {
    return "danger";
  }
  return "neutral";
}

function toneFromReadinessAxis(axis: "planned" | "partial" | "ready"): Tone {
  if (axis === "ready") {
    return "success";
  }
  if (axis === "partial") {
    return "warning";
  }
  return "neutral";
}

function toneFromContractClassification(
  classification: "runtime-ready" | "partial-runtime" | "bridge-only" | "onboarding-only" | "unsupported",
): Tone {
  if (classification === "runtime-ready") {
    return "success";
  }
  if (classification === "partial-runtime") {
    return "warning";
  }
  if (classification === "unsupported") {
    return "danger";
  }
  return "neutral";
}

function formatContractClassification(
  classification: "runtime-ready" | "partial-runtime" | "bridge-only" | "onboarding-only" | "unsupported",
): string {
  return classification.replaceAll("-", " ");
}

function formatCompatibilityDepth(
  depth: "none" | "limited" | "constrained" | "validated",
): string {
  return depth.replaceAll("_", " ");
}

function toneFromProofStatus(status: "none" | "partial" | "proven"): Tone {
  if (status === "proven") {
    return "success";
  }
  if (status === "partial") {
    return "warning";
  }
  return "neutral";
}

function formatEvidenceSource(source: CapabilityEvidenceRecord["source"]): string {
  return source.replaceAll("_", " ");
}

function EvidenceSummary({
  evidence,
  title = "Evidence & Proof",
  description,
}: {
  evidence: ProviderCapabilityEvidenceRecord;
  title?: string;
  description?: string;
}) {
  const entries: Array<{ label: string; value: CapabilityEvidenceRecord }> = [
    { label: "runtime", value: evidence.runtime },
    { label: "streaming", value: evidence.streaming },
    { label: "tool calling", value: evidence.tool_calling },
    { label: "live probe", value: evidence.live_probe },
  ];

  return (
    <div className="fg-subcard fg-mt-sm">
      <h4>{title}</h4>
      {description ? <p className="fg-muted">{description}</p> : null}
      <ul className="fg-list">
        {entries.map((entry) => (
          <li key={entry.label}>
            {entry.label} · status={entry.value.status} · source={formatEvidenceSource(entry.value.source)} · recorded=
            {formatTimestamp(entry.value.recorded_at)} · details={entry.value.details}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReadinessAxisPills({
  runtimeReadiness,
  streamingReadiness,
}: {
  runtimeReadiness: "planned" | "partial" | "ready";
  streamingReadiness: "planned" | "partial" | "ready";
}) {
  return (
    <>
      <TonePill label={`runtime ${runtimeReadiness}`} tone={toneFromReadinessAxis(runtimeReadiness)} />
      <TonePill label={`streaming ${streamingReadiness}`} tone={toneFromReadinessAxis(streamingReadiness)} />
    </>
  );
}

function renderRunFilterSelect(
  label: string,
  value: string,
  onChange: (value: string) => void,
  options: Array<{ value: string; label: string }>,
) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function HarnessProfileCard({
  profile,
  profileErrors,
  canMutate,
  onPreviewAndVerify,
  onProbe,
  onToggle,
  onRollback,
  onDelete,
}: {
  profile: HarnessProfile;
  profileErrors: number;
  canMutate: boolean;
  onPreviewAndVerify: () => void;
  onProbe: () => void;
  onToggle: () => void;
  onRollback: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="fg-subcard">
      <div className="fg-panel-heading">
        <div>
          <h4>
            {profile.label} ({profile.provider_key})
          </h4>
          <p className="fg-muted">
            {profile.integration_class} {profile.template_id ? `· template=${profile.template_id}` : "· no template override"}
          </p>
        </div>
        <div className="fg-actions">
          <TonePill label={profile.enabled ? "enabled" : "disabled"} tone={profile.enabled ? "success" : "neutral"} />
          <TonePill label={profile.lifecycle_status ?? "draft"} tone={toneFromStatus(profile.lifecycle_status ?? "draft")} />
          {profile.needs_attention ? <TonePill label="needs attention" tone="warning" /> : null}
        </div>
      </div>

      <div className="fg-detail-grid">
        <p>
          models={joinList(profile.models)} · revision={formatMetric(profile.config_revision)} · parent={toStringValue(profile.config_revision_parent, "-")}
        </p>
        <p>
          verify={toStringValue(profile.last_verify_status, "never")} · probe={toStringValue(profile.last_probe_status, "never")} · sync=
          {toStringValue(profile.last_sync_status, "never")}
        </p>
        <p>
          last_used={formatTimestamp(profile.last_used_at)} · last_model={toStringValue(profile.last_used_model, "-")} · requests=
          {formatMetric(profile.request_count)} · stream_requests={formatMetric(profile.stream_request_count)} · tokens={formatMetric(profile.total_tokens)}
        </p>
        <p>control-plane profile errors: {formatMetric(profileErrors)}</p>
        {profile.last_sync_error ? <p className="fg-danger">last sync error: {profile.last_sync_error}</p> : null}
      </div>

      {canMutate ? (
        <div className="fg-actions fg-mt-sm">
          <button type="button" onClick={onPreviewAndVerify}>
            Preview + Verify
          </button>
          <button type="button" onClick={onProbe}>
            Probe
          </button>
          <button type="button" onClick={onToggle}>
            {profile.enabled ? "Deactivate" : "Activate"}
          </button>
          {(profile.config_revision ?? 1) > 1 ? (
            <button type="button" onClick={onRollback}>
              Rollback
            </button>
          ) : null}
          <button type="button" onClick={onDelete}>
            Delete
          </button>
        </div>
      ) : null}

      {profile.model_inventory && profile.model_inventory.length > 0 ? (
        <details className="fg-mt-sm">
          <summary>Model inventory</summary>
          <ul className="fg-list">
            {profile.model_inventory.map((item, index) => (
              <li key={`${toStringValue(item.model, "model")}-${index}`}>
                {item.model} · source={item.source} · status={item.status} · synced={formatTimestamp(item.synced_at)} · reason=
                {toStringValue(item.readiness_reason, "-")}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

export function ProvidersOverviewSection({ data, actions }: SectionProps) {
  const enabledProviders = data.providers.filter((provider) => provider.enabled).length;
  const readyProviders = data.providers.filter((provider) => provider.ready).length;
  const attentionProfiles = data.profiles.filter((profile) => profile.needs_attention).length;
  const readyCompatibilityRows = data.compatibilityMatrix.filter((row) => row.ready).length;
  const clientsNeedingAttention = data.clients.filter((client) => toBooleanValue(client.needs_attention)).length;
  const configuredOauthTargets = data.oauthTargets.filter((target) => toBooleanValue(target.configured)).length;

  return (
    <SectionCard
      title="Control-Plane Summary"
      description="Current runtime truth is separated from roadmap and onboarding targets. Live provider inventory and compatibility stay below, while harness profiles now live on the dedicated Harness route."
      actions={
        <>
          <button type="button" onClick={() => void actions.load()}>
            Refresh
          </button>
          {data.access.canMutate ? (
            <button type="button" onClick={() => void actions.syncAllProviders()}>
              Sync all providers
            </button>
          ) : null}
        </>
      }
    >
      <div className="fg-grid fg-grid-compact">
        <MetricTile label="Load state" value={data.state} note={data.state === "loading" ? "refresh in progress" : "last control-plane snapshot"} />
        <MetricTile label="Enabled providers" value={formatMetric(enabledProviders)} note={`${formatMetric(readyProviders)} ready for runtime use`} />
        <MetricTile label="Harness profiles" value={formatMetric(data.profiles.length)} note={`${formatMetric(attentionProfiles)} need operator attention`} />
        <MetricTile label="Compatibility rows" value={formatMetric(data.compatibilityMatrix.length)} note={`${formatMetric(readyCompatibilityRows)} ready now`} />
        <MetricTile label="OAuth targets configured" value={formatMetric(configuredOauthTargets)} note={`${formatMetric(data.oauthTotalOps)} persisted operations`} />
        <MetricTile label="Clients needing attention" value={formatMetric(clientsNeedingAttention)} note={`${formatMetric(data.clients.length)} client records loaded`} />
      </div>

      {!data.access.canMutate ? (
        <p className="fg-note fg-mt-md">
          {data.access.summaryTitle}: {data.access.summaryDetail}
        </p>
      ) : null}

      <p className="fg-note fg-mt-md">
        Runtime truth: provider cards, client view, and the compatibility matrix describe what the backend currently exposes here. Saved harness profiles and proof actions moved to the dedicated Harness module so this route no longer acts as the primary harness surface.
      </p>

      {data.error ? <p className="fg-danger">{data.error}</p> : null}
    </SectionCard>
  );
}

export function OperationResultSection({ data, actions }: SectionProps) {
  if (!data.operationResult) {
    return null;
  }

  return (
    <SectionCard
      title="Last Control-Plane Action"
      description="Raw JSON from the most recent harness or provider operation."
      actions={
        <button type="button" onClick={() => actions.setOperationResult("")}>
          Clear result
        </button>
      }
    >
      <pre>{data.operationResult}</pre>
    </SectionCard>
  );
}

export function HarnessControlSection({ data, actions }: SectionProps) {
  const availableTemplates = data.templates.filter((template) => template.integration_class === data.newHarness.integration_class);
  const selectedTemplateValue = availableTemplates.some((template) => template.id === data.newHarness.template_id) ? data.newHarness.template_id : "";
  const lastFailedRun = asRecord(data.runOps.last_failed_run);

  return (
    <>
      <SectionCard
        title="Harness Onboarding"
        description={
          data.access.canMutate
            ? "Profile creation now exposes the backend-supported auth and template fields instead of faking a shallow onboarding flow."
            : "Template inventory and saved harness truth stay visible here, while onboarding mutations remain hidden for permission-limited sessions."
        }
        actions={data.access.canMutate ? <button type="button" onClick={() => void actions.upsertHarness()}>Save profile</button> : undefined}
      >
        <div className="fg-grid">
          <div className="fg-subcard">
            <h4>Available templates</h4>
            <ul className="fg-list">
              {data.templates.map((template) => (
                <li key={template.id}>
                  {template.label} ({template.id}) · class={template.integration_class} · {template.description}
                </li>
              ))}
            </ul>
          </div>

          {data.access.canMutate ? (
            <div className="fg-subcard">
              <h4>New profile</h4>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Provider key
                  <input
                    value={data.newHarness.provider_key}
                    onChange={(event) => actions.setNewHarness((current) => ({ ...current, provider_key: event.target.value }))}
                    placeholder="provider_key"
                  />
                </label>
                <label>
                  Label
                  <input
                    value={data.newHarness.label}
                    onChange={(event) => actions.setNewHarness((current) => ({ ...current, label: event.target.value }))}
                    placeholder="Provider label"
                  />
                </label>
                <label>
                  Integration class
                  <select
                    value={data.newHarness.integration_class}
                    onChange={(event) => {
                      const integrationClass = event.target.value as HarnessProfile["integration_class"];
                      const fallbackTemplate = data.templates.find((template) => template.integration_class === integrationClass)?.id ?? "";
                      actions.setNewHarness((current) => ({
                        ...current,
                        integration_class: integrationClass,
                        template_id: fallbackTemplate,
                      }));
                    }}
                  >
                    <option value="openai_compatible">openai_compatible</option>
                    <option value="templated_http">templated_http</option>
                    <option value="static_catalog">static_catalog</option>
                  </select>
                </label>
                <label>
                  Template
                  <select
                    value={selectedTemplateValue}
                    onChange={(event) => actions.setNewHarness((current) => ({ ...current, template_id: event.target.value }))}
                  >
                    <option value="">none</option>
                    {availableTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Endpoint base URL
                  <input
                    value={data.newHarness.endpoint_base_url}
                    onChange={(event) => actions.setNewHarness((current) => ({ ...current, endpoint_base_url: event.target.value }))}
                    placeholder="https://example.invalid/v1"
                  />
                </label>
                <label>
                  Models
                  <input
                    value={data.newHarness.models}
                    onChange={(event) => actions.setNewHarness((current) => ({ ...current, models: event.target.value }))}
                    placeholder="model-1, model-2"
                  />
                </label>
                <label>
                  Auth scheme
                  <select
                    value={data.newHarness.auth_scheme}
                    onChange={(event) =>
                      actions.setNewHarness((current) => ({
                        ...current,
                        auth_scheme: event.target.value as HarnessProfile["auth_scheme"],
                      }))
                    }
                  >
                    <option value="none">none</option>
                    <option value="bearer">bearer</option>
                    <option value="api_key_header">api_key_header</option>
                  </select>
                </label>
                <label>
                  Auth header
                  <input
                    value={data.newHarness.auth_header}
                    onChange={(event) => actions.setNewHarness((current) => ({ ...current, auth_header: event.target.value }))}
                    placeholder="Authorization"
                    disabled={data.newHarness.auth_scheme === "none"}
                  />
                </label>
                <label>
                  Auth value
                  <input
                    type="password"
                    value={data.newHarness.auth_value}
                    onChange={(event) => actions.setNewHarness((current) => ({ ...current, auth_value: event.target.value }))}
                    placeholder={data.newHarness.auth_scheme === "none" ? "Not required" : "Secret token or API key"}
                    disabled={data.newHarness.auth_scheme === "none"}
                  />
                </label>
              </div>

              <label className="fg-mt-sm">
                <span>Streaming</span>
                <span className="fg-row">
                  <input
                    type="checkbox"
                    checked={data.newHarness.stream_enabled}
                    onChange={(event) => actions.setNewHarness((current) => ({ ...current, stream_enabled: event.target.checked }))}
                    className="fg-control-auto"
                  />
                  <span>{data.newHarness.stream_enabled ? "stream enabled" : "stream disabled"}</span>
                </span>
              </label>
            </div>
          ) : (
            <PermissionCallout
              title={data.access.summaryTitle}
              detail={`${data.access.summaryDetail} Standard operator/admin sessions can save harness profiles, run verify and probe actions, import snapshots, and change health controls here.`}
            />
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Saved Harness Profiles"
        description="These cards represent persisted control-plane profiles and show live verify, probe, sync, and revision state."
      >
        {!data.access.canMutate ? (
          <p className="fg-note fg-mb-sm">
            {data.access.summaryDetail}
          </p>
        ) : null}

        {data.profiles.length === 0 ? (
          <p className="fg-muted">No harness profiles saved yet.</p>
        ) : (
          <div className="fg-card-grid">
            {data.profiles.map((profile) => (
              <HarnessProfileCard
                key={profile.provider_key}
                profile={profile}
                profileErrors={data.profileErrors[profile.provider_key] ?? 0}
                canMutate={data.access.canMutate}
                onPreviewAndVerify={() => void actions.runHarnessAction(profile.provider_key)}
                onProbe={() => void actions.probeHarnessProfile(profile.provider_key)}
                onToggle={() => void actions.toggleHarnessProfile(profile.provider_key, profile.enabled)}
                onRollback={() => void actions.rollbackHarnessProfile(profile.provider_key, (profile.config_revision ?? 1) - 1)}
                onDelete={() => void actions.deleteHarnessProfile(profile.provider_key)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Harness Import / Export" description="Full snapshot export is explicit so operators can distinguish redacted backups from secret-bearing payloads.">
        <div className="fg-actions fg-mb-sm">
          {data.access.canExportRedacted ? (
            <button type="button" onClick={() => void actions.exportHarness(true)}>
              Export redacted
            </button>
          ) : null}
          {data.access.canExportFull ? (
            <button type="button" onClick={() => void actions.exportHarness(false)}>
              Export full snapshot
            </button>
          ) : null}
          {data.access.canMutate ? (
            <>
              <button type="button" onClick={() => void actions.importHarness(true)}>
                Dry-run import
              </button>
              <button type="button" onClick={() => void actions.importHarness(false)}>
                Apply import
              </button>
            </>
          ) : null}
        </div>
        {!data.access.canExportRedacted ? (
          <p className="fg-note fg-mb-sm">
            Harness export and import actions stay hidden for viewer sessions. Inspect saved profile truth and recent runs elsewhere on this page.
          </p>
        ) : !data.access.canExportFull ? (
          <p className="fg-note fg-mb-sm">
            {data.access.canMutate
              ? "Redacted harness export stays available here, but full secret-bearing snapshot stays admin-only on the dedicated Harness surface."
              : "Redacted harness export stays available for inspection, but full secret-bearing snapshot remains admin-only and import/apply actions stay hidden for this session."}
          </p>
        ) : !data.access.canMutate ? (
          <p className="fg-note fg-mb-sm">
            Redacted and full export stay available for inspection, but import and apply actions require a standard operator/admin session.
          </p>
        ) : null}
        <textarea
          value={data.importPayload}
          onChange={(event) => actions.setImportPayload(event.target.value)}
          rows={14}
          placeholder={
            data.access.canMutate
              ? "Harness snapshot JSON for dry-run or import"
              : data.access.canExportRedacted
                ? "Redacted harness snapshot export remains visible here, but import actions and full secret-bearing export are hidden for this session."
                : "Viewer sessions cannot export or import harness snapshots from this route."
          }
          readOnly={!data.access.canMutate}
        />
      </SectionCard>

      <SectionCard title="Recent Harness Runs" description="Run history stays filterable by provider, mode, status, and client so operators can focus on the real control-plane trail.">
        <div className="fg-grid fg-grid-compact fg-mb-sm">
          <MetricTile label="Total runs" value={formatMetric(data.runSummary.total)} note={`${formatMetric(data.runSummary.failed)} failed`} />
          <MetricTile label="Verify / probe" value={`${formatMetric(data.runSummary.verify)} / ${formatMetric(data.runSummary.probe)}`} note={`sync=${formatMetric(data.runSummary.sync)}`} />
          <MetricTile
            label="Runtime requests"
            value={`${formatMetric(data.runSummary.runtime_non_stream)} / ${formatMetric(data.runSummary.runtime_stream)}`}
            note="non-stream / stream"
          />
          <MetricTile
            label="Profiles loaded"
            value={formatMetric(data.runOps.profile_count)}
            note={`${formatMetric(data.runOps.profiles_needing_attention)} need attention`}
          />
        </div>

        <div className="fg-grid fg-grid-compact fg-mb-sm">
          {renderRunFilterSelect("Mode", data.runFilters.mode, (value) => actions.setRunFilter("mode", value), [
            { value: "all", label: "all" },
            { value: "verify", label: "verify" },
            { value: "probe", label: "probe" },
            { value: "sync", label: "sync" },
          ])}
          {renderRunFilterSelect("Status", data.runFilters.status, (value) => actions.setRunFilter("status", value), [
            { value: "all", label: "all" },
            { value: "ok", label: "ok" },
            { value: "warning", label: "warning" },
            { value: "failed", label: "failed" },
          ])}
          {renderRunFilterSelect("Provider", data.runFilters.provider, (value) => actions.setRunFilter("provider", value), [
            { value: "all", label: "all" },
            ...data.profiles.map((profile) => ({ value: profile.provider_key, label: profile.provider_key })),
          ])}
          {renderRunFilterSelect("Client", data.runFilters.client, (value) => actions.setRunFilter("client", value), [
            { value: "all", label: "all" },
            { value: "runtime", label: "runtime" },
            { value: "control_plane", label: "control_plane" },
          ])}
        </div>

        {lastFailedRun ? (
          <p className="fg-note">
            Last failed run: {formatTimestamp(lastFailedRun.executed_at)} · {toStringValue(lastFailedRun.provider_key)} · {toStringValue(lastFailedRun.mode)} ·
            status={toStringValue(lastFailedRun.status)}
          </p>
        ) : null}

        <ul className="fg-list">
          {data.runs.map((run, index) => (
            <li key={`${toStringValue(run.run_id, toStringValue(run.provider_key, "run"))}-${index}`}>
              {formatTimestamp(run.executed_at)} · {toStringValue(run.provider_key)} · {toStringValue(run.mode)} · status={toStringValue(run.status)} ·
              success={toStringValue(run.success)} · client={toStringValue(run.client_id)} · integration={toStringValue(run.integration)}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Model Health Controls" description="Provider and model health toggles stay coupled to the live backend probe mode and a real run action.">
        {data.healthConfig ? (
          data.access.canMutate ? (
            <div className="fg-grid fg-grid-compact">
              <label>
                <span>Provider health</span>
                <span className="fg-row">
                  <input
                    type="checkbox"
                    checked={data.healthConfig.provider_health_enabled}
                    onChange={(event) => void actions.updateHealth({ provider_health_enabled: event.target.checked })}
                    className="fg-control-auto"
                  />
                  <span>{data.healthConfig.provider_health_enabled ? "enabled" : "disabled"}</span>
                </span>
              </label>
              <label>
                <span>Model health</span>
                <span className="fg-row">
                  <input
                    type="checkbox"
                    checked={data.healthConfig.model_health_enabled}
                    onChange={(event) => void actions.updateHealth({ model_health_enabled: event.target.checked })}
                    className="fg-control-auto"
                  />
                  <span>{data.healthConfig.model_health_enabled ? "enabled" : "disabled"}</span>
                </span>
              </label>
              <label>
                Probe mode
                <select
                  value={data.healthConfig.probe_mode}
                  onChange={(event) =>
                    void actions.updateHealth({
                      probe_mode: event.target.value as HealthConfig["probe_mode"],
                    })
                  }
                >
                  <option value="provider">provider</option>
                  <option value="discovery">discovery</option>
                  <option value="synthetic_probe">synthetic_probe</option>
                </select>
              </label>
              <div className="fg-actions fg-actions-end">
                <button type="button" onClick={() => data.healthConfig && void actions.updateHealth({ ...data.healthConfig })}>
                  Save current config
                </button>
                <button type="button" onClick={() => void actions.runHealthChecks()}>
                  Run health checks
                </button>
              </div>
            </div>
          ) : (
            <PermissionCallout
              title={data.access.summaryTitle}
              detail={`Provider health=${data.healthConfig.provider_health_enabled ? "enabled" : "disabled"} · model health=${data.healthConfig.model_health_enabled ? "enabled" : "disabled"} · probe mode=${data.healthConfig.probe_mode}. Health mutations and manual runs require a standard operator/admin session.`}
            />
          )
        ) : (
          <p className="fg-muted">Health config unavailable.</p>
        )}
      </SectionCard>
    </>
  );
}

export function ProviderInventorySection({ data, actions }: SectionProps) {
  return (
    <>
      <SectionCard
        title="Live Provider Inventory"
        description={
          data.access.canMutate
            ? "These records reflect current control-plane/runtime provider state, not future onboarding targets. Runtime and streaming readiness stay visible as separate axes."
            : "These records reflect current control-plane/runtime provider state, not future onboarding targets. Create, label, lifecycle, and sync controls stay hidden for permission-limited sessions."
        }
      >
        {data.access.canMutate ? (
          <div className="fg-inline-form fg-mb-md">
            <label>
              Provider key
              <input
                value={data.newProvider.provider}
                onChange={(event) => actions.setNewProvider((current) => ({ ...current, provider: event.target.value }))}
                placeholder="provider_key"
              />
            </label>
            <label>
              Label
              <input
                value={data.newProvider.label}
                onChange={(event) => actions.setNewProvider((current) => ({ ...current, label: event.target.value }))}
                placeholder="Provider label"
              />
            </label>
            <div className="fg-actions fg-actions-end">
              <button type="button" onClick={() => void actions.createProvider()}>
                Create provider
              </button>
            </div>
          </div>
        ) : (
          <p className="fg-note fg-mb-md">{data.access.summaryDetail}</p>
        )}

        <div className="fg-card-grid">
          {data.providers.map((provider) => (
            <article key={provider.provider} className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>
                    {provider.label} ({provider.provider})
                  </h4>
                  <p className="fg-muted">
                    {provider.integration_class} · template={provider.template_id ?? "-"} · last sync={formatTimestamp(provider.last_sync_at)}
                  </p>
                </div>
                <div className="fg-actions">
                  <TonePill
                    label={`contract ${formatContractClassification(provider.contract_classification)}`}
                    tone={toneFromContractClassification(provider.contract_classification)}
                  />
                  <TonePill label={provider.enabled ? "enabled" : "disabled"} tone={provider.enabled ? "success" : "neutral"} />
                  <TonePill
                    label={provider.ready ? "ready" : "not ready"}
                    tone={provider.ready ? "success" : toneFromReadinessAxis(provider.runtime_readiness === "partial" || provider.streaming_readiness === "partial" ? "partial" : "planned")}
                  />
                  <TonePill label={`harness ${provider.harness_proof_status}`} tone={toneFromProofStatus(provider.harness_proof_status)} />
                  <ReadinessAxisPills
                    runtimeReadiness={provider.runtime_readiness}
                    streamingReadiness={provider.streaming_readiness}
                  />
                </div>
              </div>

              <div className="fg-detail-grid">
                <p>
                  contract={formatContractClassification(provider.contract_classification)} · runtime axis={provider.runtime_readiness} · streaming axis={provider.streaming_readiness} · provider axis=
                  {formatProviderAxis(provider.provider_axis)} · compatibility depth={formatCompatibilityDepth(provider.compatibility_depth ?? "none")}
                </p>
                <p>
                  auth={provider.auth_mechanism ?? "unknown"} · tool calling={provider.tool_calling_level ?? "none"} · oauth required=
                  {String(provider.oauth_required)} · oauth mode={provider.oauth_mode ?? "-"} · discovery supported={String(provider.discovery_supported)}
                </p>
                <p>
                  models={formatMetric(provider.model_count)} · provider errors={formatMetric(data.providerErrors[provider.provider] ?? 0)} · harness profiles=
                  {formatMetric(provider.harness_profile_count)} · harness runs={formatMetric(provider.harness_run_count)}
                </p>
                <p>
                  harness needs attention={formatMetric(provider.harness_needs_attention_count)} · oauth failures=
                  {formatMetric(provider.oauth_failure_count)} · sync status={provider.last_sync_status}
                </p>
                <p>
                  harness proof={provider.harness_proof_status} · proven profiles=
                  {provider.harness_proven_profile_keys.length > 0 ? joinList(provider.harness_proven_profile_keys) : "-"}
                </p>
                {provider.readiness_reason ? <p className="fg-note">readiness reason: {provider.readiness_reason}</p> : null}
                {provider.last_sync_error ? <p className="fg-danger">last sync error: {provider.last_sync_error}</p> : null}
              </div>

              {data.access.canMutate ? (
                <div className="fg-inline-form fg-mt-sm">
                  <label>
                    Label
                    <input
                      value={data.providerLabelDrafts[provider.provider] ?? provider.label}
                      onChange={(event) => actions.setProviderLabelDraft(provider.provider, event.target.value)}
                    />
                  </label>
                  <div className="fg-actions fg-actions-end">
                    <button type="button" onClick={() => void actions.saveProviderLabel(provider.provider)}>
                      Save label
                    </button>
                    <button type="button" onClick={() => void actions.toggleProvider(provider.provider, provider.enabled)}>
                      {provider.enabled ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" onClick={() => void actions.syncProviderModels(provider.provider)}>
                      Sync models
                    </button>
                  </div>
                </div>
              ) : null}

              {provider.models.length > 0 ? (
                <details className="fg-mt-sm">
                  <summary>Model truth</summary>
                  <ul className="fg-list">
                    {provider.models.map((model) => (
                      <li key={model.id}>
                        {model.id} · source={model.source} · discovery={model.discovery_status} · runtime={model.runtime_status ?? "unknown"} · availability=
                        {model.availability_status ?? "unknown"} · health={model.health_status} · active={String(model.active)} · errors=
                        {formatMetric(data.modelErrors[model.id] ?? 0)}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="fg-muted fg-mt-sm">
                  No models currently indexed for this provider.
                </p>
              )}
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Compatibility Matrix" description="This matrix is runtime/control-plane truth for wired providers, not the expansion backlog.">
        <div className="fg-card-grid">
          {data.compatibilityMatrix.map((row) => (
            <article key={row.provider} className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>{row.label}</h4>
                  <p className="fg-muted">{row.provider}</p>
                </div>
                <div className="fg-actions">
                  <TonePill
                    label={`contract ${formatContractClassification(row.contract_classification)}`}
                    tone={toneFromContractClassification(row.contract_classification)}
                  />
                  <TonePill
                    label={row.ready ? "ready" : "not ready"}
                    tone={row.ready ? "success" : toneFromReadinessAxis(row.runtime_readiness === "partial" || row.streaming_readiness === "partial" ? "partial" : "planned")}
                  />
                  <TonePill label={`proof ${row.proof_status}`} tone={toneFromProofStatus(row.proof_status)} />
                  <ReadinessAxisPills runtimeReadiness={row.runtime_readiness} streamingReadiness={row.streaming_readiness} />
                </div>
              </div>
              <div className="fg-detail-grid">
                <p>
                  compatibility depth={formatCompatibilityDepth(row.compatibility_depth)} · contract={formatContractClassification(row.contract_classification)} · runtime axis={row.runtime_readiness} · streaming axis={row.streaming_readiness} · provider axis=
                  {formatProviderAxis(row.provider_axis)}
                </p>
                <p>
                  oauth required={String(row.oauth_required)} · ui models={formatMetric(row.ui_models)} · streaming={row.streaming} · tool calling=
                  {row.tool_calling} · vision={row.vision} · discovery={row.discovery}
                </p>
                <p>
                  proof={row.proof_status} · proven profiles={row.proven_profile_keys.length > 0 ? joinList(row.proven_profile_keys) : "-"}
                </p>
                <p>typed deviations / unsupported notes: {row.notes}</p>
              </div>
              <EvidenceSummary
                evidence={row.evidence}
                title="Compatibility evidence"
                description="The public OpenAI-compatible contract stays partial until these proof axes are observed instead of merely configured."
              />
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Client / Consumer Operational View" description="Operator-facing client state stays close to provider truth so attention items are visible without implying deeper workflow automation.">
        <ul className="fg-list">
          {data.clients.slice(0, 15).map((client) => (
            <li key={toStringValue(client.client_id)}>
              {toStringValue(client.client_id)} · requests={formatMetric(client.requests)} · errors={formatMetric(client.errors)} · error rate=
              {formatMetric(client.error_rate, 2)} · actual cost={formatMetric(client.actual_cost, 4)} · needs attention={toStringValue(client.needs_attention)}
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}

export function ExpansionTargetsSection({ data, actions }: SectionProps) {
  const integrationErrorSummary = Object.entries(data.integrationErrors)
    .map(([key, value]) => `${key}=${value}`)
    .join(" | ");

  return (
    <>
      <SectionCard
        title="Product Axis Contracts"
        description="These records carry the explicit product contract for each non-core axis. They stay separated from live runtime truth so onboarding or bridge depth cannot masquerade as shipped runtime coverage."
        actions={
          data.access.canMutate ? (
            <>
              <button type="button" onClick={() => void actions.syncOauthBridgeProfiles()}>
                Sync OAuth bridge profiles
              </button>
              <button type="button" onClick={() => void actions.probeAllOauthTargets()}>
                Probe all OAuth targets
              </button>
            </>
          ) : undefined
        }
      >
        {!data.access.canMutate ? (
          <p className="fg-note fg-mb-sm">
            {data.access.summaryDetail} OAuth bridge sync and probe actions stay hidden until a standard operator/admin session is active.
          </p>
        ) : null}

        <div className="fg-card-grid">
          {data.productAxisTargets.map((target) => (
            <article key={target.provider_key} className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>{target.provider_key}</h4>
                  <p className="fg-muted">
                    axis={target.product_axis} · type={target.provider_type} · operator surface={target.operator_surface}
                  </p>
                </div>
                <div className="fg-actions">
                  <TonePill
                    label={`contract ${formatContractClassification(target.contract_classification)}`}
                    tone={toneFromContractClassification(target.contract_classification)}
                  />
                  <TonePill label={`onboarding ${target.readiness}`} tone={toneFromReadinessAxis(target.readiness)} />
                </div>
              </div>
              <div className="fg-detail-grid">
                <p>
                  contract={formatContractClassification(target.contract_classification)} · runtime={target.runtime_path} · auth={target.auth_model} · score=
                  {formatMetric(target.readiness_score)}
                </p>
                <p>
                  runtime axis={target.runtime_readiness} · stream axis={target.streaming_readiness} · verify axis=
                  {target.verify_probe_readiness} · ui axis={target.ui_readiness}
                </p>
                <p>classification reason: {target.classification_reason}</p>
                <p>onboarding status: {target.status_summary}</p>
                <p>
                  health semantics={target.health_semantics} · verify/probe contract={target.verify_probe_axis}
                </p>
                <p>
                  observability axis={target.observability_axis} · ui coverage={target.ui_axis}
                </p>
                {target.technical_requirements.length > 0 ? (
                  <p>technical requirements: {target.technical_requirements.join(" | ")}</p>
                ) : null}
                <p className="fg-muted">{target.notes}</p>
              </div>
              <EvidenceSummary
                evidence={target.evidence}
                description="Configured onboarding is not enough. These recorded proof axes decide whether a premium or compatibility slice can claim runtime depth."
              />
              {target.provider_type === "oauth_account" && data.access.canMutate ? (
                <div className="fg-actions fg-mt-sm">
                  <button type="button" onClick={() => void actions.probeOauthTarget(target.provider_key)}>
                    Probe OAuth target
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="OAuth Operational Status" description="Configured targets expose contract classification, lane posture, session truth, and cost posture so account-backed slices cannot hide behind generic bridge wording.">
        <div className="fg-grid">
          <div className="fg-subcard">
            <h4>Current target posture</h4>
            <ul className="fg-list">
              {data.oauthTargets.map((target) => (
                <li key={toStringValue(target.provider_key)}>
                  {toStringValue(target.provider_key)} · contract={formatContractClassification(target.contract_classification)} · configured=
                  {toStringValue(target.configured)} · bridge={toStringValue(target.runtime_bridge_enabled)} · probe=
                  {toStringValue(target.probe_enabled)} · lane={toStringValue(target.queue_lane)} · parallelism=
                  {toStringValue(target.parallelism_mode)} · cost={toStringValue(target.cost_posture)}
                </li>
              ))}
            </ul>
          </div>

          <div className="fg-subcard">
            <h4>Session and escalation truth</h4>
            <ul className="fg-list">
              {data.oauthTargets.map((target) => (
                <li key={`${toStringValue(target.provider_key)}-truth`}>
                  {toStringValue(target.provider_key)} · auth={toStringValue(target.auth_kind)} · session reuse=
                  {toStringValue(target.session_reuse_strategy)} · escalation={toStringValue(target.escalation_support)} · truth=
                  {toStringValue(target.operator_truth)}
                </li>
              ))}
            </ul>
          </div>

          <div className="fg-subcard">
            <h4>Probe and runtime evidence</h4>
            <ul className="fg-list">
              {data.oauthTargets.map((target) => (
                <li key={`${toStringValue(target.provider_key)}-evidence`}>
                  {toStringValue(target.provider_key)} · probe={target.evidence.live_probe.status} ({target.evidence.live_probe.details}) · runtime=
                  {target.evidence.runtime.status} ({target.evidence.runtime.details}) · streaming={target.evidence.streaming.status} (
                  {target.evidence.streaming.details}) · tool={target.evidence.tool_calling.status} ({target.evidence.tool_calling.details})
                </li>
              ))}
            </ul>
          </div>

          <div className="fg-subcard">
            <h4>Failure and operations summary</h4>
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
              <details className="fg-mt-sm">
                <summary>Recent OAuth operations log</summary>
                <ul className="fg-list">
                  {data.oauthRecentOps.slice(-10).map((item, index) => (
                    <li key={`${toStringValue(item.provider_key)}-${index}`}>
                      {formatTimestamp(item.executed_at)} · {toStringValue(item.provider_key)} · {toStringValue(item.action)} ·
                      {toStringValue(item.status)} · {toStringValue(item.details)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="OAuth Onboarding Guide" description="Guide rows capture what remains before a target can be treated as operational depth.">
        <ul className="fg-list">
          {data.oauthOnboarding.map((target, index) => {
            const nextSteps = Array.isArray(target.next_steps) ? target.next_steps : [];
            return (
              <li key={`${toStringValue(target.provider_key, "target")}-${index}`}>
                {toStringValue(target.provider_key)} · contract={formatContractClassification(target.contract_classification)} · onboarding status=
                {toStringValue(target.readiness)} · depth={toStringValue(target.operational_depth)} · lane={toStringValue(target.queue_lane)} ·
                reason={toStringValue(target.readiness_reason)}{nextSteps.length > 0 ? ` · next=${toStringValue(nextSteps[0])}` : ""}
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard
        title="Host / Public Bootstrap Readiness"
        description="Bootstrap checks show what the backend currently verifies for the host-native and public HTTPS product path before operators assume the environment is usable."
      >
        {data.bootstrapReadiness ? (
          <div className="fg-grid">
            <div className="fg-subcard">
              <h4>Readiness checks</h4>
              <p>ready={String(data.bootstrapReadiness.ready)}</p>
              <ul className="fg-list">
                {data.bootstrapReadiness.checks.map((check, index) => (
                  <li key={`${toStringValue(check.id, "check")}-${index}`}>
                    {toStringValue(check.id)} · ok={toStringValue(check.ok)} · details={toStringValue(check.details)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="fg-subcard">
              <h4>Next steps</h4>
              <ol>
                {data.bootstrapReadiness.next_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <p className="fg-muted">Bootstrap readiness unavailable.</p>
        )}
      </SectionCard>

      <SectionCard title="Discovery / Sync Note" description="Integration error dimensions remain explicit here so operators can see the extra harness error axes without pretending they are provider-specific truth.">
        <p>{data.syncNote}</p>
        <p>integration error dimensions: {integrationErrorSummary || "none"}</p>
      </SectionCard>
    </>
  );
}
