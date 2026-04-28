import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import type {
  CapabilityEvidenceRecord,
  HarnessProfile,
  HealthConfig,
  OpenAICompatibilityStatus,
  ProviderClassDescriptor,
  ProviderClassKey,
  ProviderCatalogEntry,
  ProviderCapabilityEvidenceRecord,
} from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import type { HarnessDraft, ProvidersPageActions, ProvidersPageData } from "./providersShared";
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

function toneFromCatalogMaturity(
  status: ProviderCatalogEntry["maturity_status"],
): Tone {
  if (status === "runtime-ready" || status === "fully-integrated") {
    return "success";
  }
  if (status === "partial-runtime" || status === "contract-ready" || status === "adapter-ready-without-live-proof") {
    return "warning";
  }
  if (status === "documented-only" || status === "bridge-only" || status === "onboarding-only") {
    return "neutral";
  }
  return "neutral";
}

function toneFromCatalogSignoff(
  status: ProviderCatalogEntry["live_signoff_status"],
): Tone {
  if (status === "signed-off") {
    return "success";
  }
  if (status === "pending-review") {
    return "warning";
  }
  if (status === "blocked-by-live-evidence") {
    return "danger";
  }
  return "neutral";
}

function toneFromOpenAICompatibilityStatus(status: OpenAICompatibilityStatus): Tone {
  if (status === "supported") {
    return "success";
  }
  if (status === "partial") {
    return "warning";
  }
  if (status === "unsupported" || status === "blocked-by-live-evidence") {
    return "danger";
  }
  return "neutral";
}

function formatCatalogLabel(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function formatProviderClassLabel(value: string): string {
  if (value === "local_ollama") {
    return "local / ollama";
  }
  if (value === "oauth_account") {
    return "oauth / account-backed";
  }
  return formatCatalogLabel(value);
}

function toneFromHealthStatus(status: string | null | undefined): Tone {
  if (!status) {
    return "neutral";
  }
  if (status === "healthy") {
    return "success";
  }
  if (status === "error") {
    return "danger";
  }
  if (status === "attention" || status === "not-run") {
    return "warning";
  }
  return "neutral";
}

function formatHealthLabel(status: string | null | undefined): string {
  if (!status) {
    return "unknown";
  }
  if (status === "not-run") {
    return "not run";
  }
  return status.replaceAll("_", " ");
}

function authTypeLabel(provider: ProvidersPageData["providers"][number]): string {
  if (provider.oauth_connect_required) {
    return "oauth / connect required";
  }
  if (provider.oauth_required) {
    return `oauth / ${provider.oauth_mode ?? "account bridge"}`;
  }
  if (provider.auth_mechanism) {
    return provider.auth_mechanism.replaceAll("_", " ");
  }
  return "unknown";
}

function currentProviderClassDescriptor(
  providerClass: ProviderClassKey,
  supportedProviderClasses: ProviderClassDescriptor[] | undefined,
): ProviderClassDescriptor {
  return supportedProviderClasses?.find((item) => item.key === providerClass) ?? supportedProviderClasses?.[0] ?? {
    key: "openai_compatible",
    label: "OpenAI-compatible",
    description: "",
    integration_class: "openai_compatible",
    template_id: "openai_compatible",
    default_config: {
      provider_class: "openai_compatible",
      endpoint_base_url: "https://example.invalid/v1",
      auth_scheme: "bearer",
    },
  };
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

function formatHarnessMode(mode: string | null | undefined): string {
  if (!mode) {
    return "unknown";
  }
  return mode.replaceAll("_", " ");
}

function formatHarnessScope(profile: HarnessProfile): string {
  return profile.instance_id?.trim() ? profile.instance_id : "global";
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "";
}

const OAUTH_TARGET_PRIORITY: Record<string, number> = {
  openai_codex: 0,
  github_copilot: 1,
  claude_code: 2,
  antigravity: 3,
  gemini: 4,
  nous_oauth: 5,
  qwen_oauth: 6,
};

function toneFromOauthConnectionStatus(
  status: ProvidersPageData["oauthTargets"][number]["connection_status"],
): Tone {
  if (status === "runtime-ready") {
    return "success";
  }
  if (status === "probe failed" || status === "expired" || status === "needs refresh") {
    return "danger";
  }
  if (status === "token present") {
    return "warning";
  }
  return "neutral";
}

function formatOauthConnectionStatus(status: ProvidersPageData["oauthTargets"][number]["connection_status"]): string {
  return status;
}

function formatOauthActionMode(mode: ProvidersPageData["oauthTargets"][number]["actions"][number]["mode"]): string {
  if (mode === "api") {
    return "live action";
  }
  if (mode === "manual") {
    return "manual";
  }
  return "unsupported";
}

function formatOauthProviderName(target: ProvidersPageData["oauthTargets"][number]): string {
  return target.provider_label || target.provider_key;
}

function buildDraftFromProfile(profile: HarnessProfile): HarnessDraft {
  return {
    provider_key: profile.provider_key,
    label: profile.label,
    template_id: profile.template_id ?? "",
    integration_class: profile.integration_class,
    endpoint_base_url: profile.endpoint_base_url,
    auth_scheme: profile.auth_scheme,
    auth_value: "",
    auth_header: profile.auth_header,
    models: profile.models.join(", "),
    stream_enabled: Boolean(profile.stream_mapping?.enabled ?? profile.capabilities?.streaming),
  };
}

function buildDraftFromTemplate(template: ProvidersPageData["templates"][number], current: HarnessDraft): HarnessDraft {
  const defaults = template.profile_defaults;
  if (!defaults) {
    return { ...current, template_id: template.id, integration_class: template.integration_class as HarnessDraft["integration_class"] };
  }
  return {
    provider_key: defaults.provider_key || current.provider_key,
    label: defaults.label || current.label,
    template_id: template.id,
    integration_class: defaults.integration_class,
    endpoint_base_url: defaults.endpoint_base_url || current.endpoint_base_url,
    auth_scheme: defaults.auth_scheme,
    auth_value: "",
    auth_header: defaults.auth_header || current.auth_header,
    models: defaults.models.join(", "),
    stream_enabled: Boolean(defaults.capabilities?.streaming),
  };
}

function getRollbackRevisions(profile: HarnessProfile): number[] {
  return (profile.config_history ?? [])
    .map((entry) => (typeof entry.revision === "number" ? entry.revision : Number(entry.revision)))
    .filter((revision): revision is number => Number.isFinite(revision))
    .sort((left, right) => right - left);
}

function latestRunForProfile(
  profileKey: string,
  runs: ProvidersPageData["runs"],
  runOps: ProvidersPageData["runOps"],
) {
  const directMatch = runs.find((run) => run.provider_key === profileKey);
  if (directMatch) {
    return directMatch;
  }
  const runMap = asRecord(runOps.last_runs_by_provider);
  return asRecord(runMap?.[profileKey]) as ProvidersPageData["runs"][number] | null;
}

function profileProofState(
  profile: HarnessProfile,
  providers: ProvidersPageData["providers"],
) {
  const proofCarrier = providers.find((provider) => provider.harness_proven_profile_keys.includes(profile.provider_key));
  if (proofCarrier) {
    return {
      status: "proven" as const,
      note: `${proofCarrier.label} carries runtime proof for this profile.`,
    };
  }
  if (profile.last_probe_status === "ok" || profile.last_verify_status === "ok" || profile.last_used_at) {
    return {
      status: "partial" as const,
      note: "Verification or probe evidence exists, but no runtime proof carrier is attached yet.",
    };
  }
  return {
    status: "none" as const,
    note: "No runtime proof carrier has been recorded for this profile yet.",
  };
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

type ProvidersManagementSectionProps = SectionProps & {
  instanceId?: string | null;
};

function ProviderClassFields({
  prefix,
  providerClass,
  integrationClass,
  templateId,
  endpointBaseUrl,
  authScheme,
  oauthMode,
  supportedProviderClasses,
  disabled,
  onProviderClassChange,
  onFieldChange,
}: {
  prefix: string;
  providerClass: ProviderClassKey;
  integrationClass: string;
  templateId: string;
  endpointBaseUrl: string;
  authScheme: string;
  oauthMode: string;
  supportedProviderClasses: ProviderClassDescriptor[];
  disabled?: boolean;
  onProviderClassChange: (providerClass: ProviderClassKey) => void;
  onFieldChange: (field: "integrationClass" | "templateId" | "endpointBaseUrl" | "authScheme" | "oauthMode", value: string) => void;
}) {
  const descriptor = currentProviderClassDescriptor(providerClass, supportedProviderClasses);
  const isOauth = providerClass === "oauth_account";

  return (
    <>
      <label>
        {prefix}klasse
        <select
          value={providerClass}
          disabled={disabled}
          onChange={(event) => onProviderClassChange(event.target.value as ProviderClassKey)}
        >
          {supportedProviderClasses.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Integration class
        <input
          value={integrationClass}
          disabled={disabled}
          onChange={(event) => onFieldChange("integrationClass", event.target.value)}
          placeholder={descriptor.integration_class}
        />
      </label>
      <label>
        Template
        <input
          value={templateId}
          disabled={disabled}
          onChange={(event) => onFieldChange("templateId", event.target.value)}
          placeholder={descriptor.template_id ?? "none"}
        />
      </label>
      {!isOauth ? (
        <label>
          Endpoint
          <input
            value={endpointBaseUrl}
            disabled={disabled}
            onChange={(event) => onFieldChange("endpointBaseUrl", event.target.value)}
            placeholder={descriptor.default_config.endpoint_base_url ?? "https://example.invalid/v1"}
          />
        </label>
      ) : (
        <label>
          OAuth mode
          <select value={oauthMode} disabled={disabled} onChange={(event) => onFieldChange("oauthMode", event.target.value)}>
            <option value="account_portal">account portal</option>
            <option value="device_code">device code</option>
            <option value="pkce">pkce</option>
            <option value="service_session">service session</option>
          </select>
        </label>
      )}
      {!isOauth ? (
        <label>
          Auth type
          <select value={authScheme} disabled={disabled} onChange={(event) => onFieldChange("authScheme", event.target.value)}>
            <option value="bearer">bearer</option>
            <option value="api_key_header">api key header</option>
            <option value="none">none</option>
          </select>
        </label>
      ) : null}
    </>
  );
}

export function ProvidersManagementOverviewSection({ data, actions, instanceId }: ProvidersManagementSectionProps) {
  const enabledProviders = data.providers.filter((provider) => provider.enabled).length;
  const readyProviders = data.providers.filter((provider) => provider.ready).length;
  const connectRequired = data.providers.filter((provider) => provider.oauth_connect_required).length;
  const healthAttention = data.providers.filter((provider) => provider.health_status !== "healthy").length;

  return (
    <SectionCard
      title="Provider Runtime Inventory"
      description="This route now stays focused on live provider management: inventory, configuration, enablement, sync, compatibility short status, and health."
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
        <MetricTile label="Providers" value={formatMetric(data.providers.length)} note={`${formatMetric(enabledProviders)} enabled`} />
        <MetricTile label="Runtime ready" value={formatMetric(readyProviders)} note={`${formatMetric(connectRequired)} connect required`} />
        <MetricTile label="Health attention" value={formatMetric(healthAttention)} note={data.healthConfig ? `probe mode ${data.healthConfig.probe_mode}` : "health config unavailable"} />
        <MetricTile
          label="Cross-reference"
          value="Harness + OAuth"
          note={instanceId ? `instance ${instanceId}` : "current control-plane scope"}
        />
      </div>

      {!data.access.canMutate ? (
        <p className="fg-note fg-mt-md">
          {data.access.summaryTitle}: {data.access.summaryDetail}
        </p>
      ) : null}

      <div className="fg-actions fg-mt-md">
        <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.harness, instanceId)}>
          Open Harness
        </Link>
        <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>
          Open OAuth Targets
        </Link>
        <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerTargets, instanceId)}>
          Open Provider Targets
        </Link>
      </div>

      {data.error ? <p className="fg-danger fg-mt-md">{data.error}</p> : null}
    </SectionCard>
  );
}

export function ProviderHealthSection({ data, actions }: SectionProps) {
  const healthyProviders = data.providers.filter((provider) => provider.health_status === "healthy").length;
  const notRunProviders = data.providers.filter((provider) => provider.health_status === "not-run").length;
  const attentionProviders = data.providers.filter((provider) => provider.health_status === "attention" || provider.health_status === "error");
  const providerHealthEnabled = data.healthConfig?.provider_health_enabled ?? false;
  const modelHealthEnabled = data.healthConfig?.model_health_enabled ?? false;

  return (
    <SectionCard
      title="Provider Health"
      description="Health runs stay direct and compact here instead of disappearing inside a wall of diagnostics cards."
      actions={
        data.access.canMutate ? (
          <button type="button" onClick={() => void actions.runHealthChecks()}>
            Run health now
          </button>
        ) : undefined
      }
    >
      <div className="fg-grid fg-grid-compact fg-mb-md">
        <MetricTile label="Healthy" value={formatMetric(healthyProviders)} note={`${formatMetric(attentionProviders.length)} need attention`} />
        <MetricTile label="Not run" value={formatMetric(notRunProviders)} note={data.healthConfig ? `${data.healthConfig.interval_seconds}s interval` : "no health config"} />
        <MetricTile label="Model checks" value={modelHealthEnabled ? "enabled" : "disabled"} note={providerHealthEnabled ? "provider checks enabled" : "provider checks disabled"} />
      </div>

      {data.access.canMutate && data.healthConfig ? (
        <div className="fg-inline-form fg-mb-md">
          <label>
            Provider checks
            <select
              value={providerHealthEnabled ? "enabled" : "disabled"}
              onChange={(event) => void actions.updateHealth({ provider_health_enabled: event.target.value === "enabled" })}
            >
              <option value="enabled">enabled</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            Model checks
            <select
              value={modelHealthEnabled ? "enabled" : "disabled"}
              onChange={(event) => void actions.updateHealth({ model_health_enabled: event.target.value === "enabled" })}
            >
              <option value="enabled">enabled</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            Probe mode
            <select value={data.healthConfig.probe_mode} onChange={(event) => void actions.updateHealth({ probe_mode: event.target.value as HealthConfig["probe_mode"] })}>
              <option value="provider">provider</option>
              <option value="discovery">discovery</option>
              <option value="synthetic_probe">synthetic probe</option>
            </select>
          </label>
          <label>
            Interval seconds
            <input
              type="number"
              min={30}
              value={data.healthConfig.interval_seconds}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (Number.isFinite(nextValue) && nextValue >= 30) {
                  void actions.updateHealth({ interval_seconds: nextValue });
                }
              }}
            />
          </label>
        </div>
      ) : null}

      <div className="fg-table-wrap">
        <table className="fg-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Health</th>
              <th>Models</th>
              <th>Last check</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map((provider) => (
              <tr key={provider.provider}>
                <td>
                  <strong>{provider.label}</strong>
                  <div className="fg-muted">{provider.provider}</div>
                </td>
                <td>
                  <TonePill label={formatHealthLabel(provider.health_status)} tone={toneFromHealthStatus(provider.health_status)} />
                </td>
                <td>
                  {formatMetric(provider.healthy_model_count)} healthy / {formatMetric(provider.attention_model_count)} attention
                </td>
                <td>{formatTimestamp(provider.last_health_check_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export function ProvidersInventoryTableSection({ data, actions, instanceId }: ProvidersManagementSectionProps) {
  const [activeProvider, setActiveProvider] = useState<string | null>(data.providers[0]?.provider ?? null);
  const selectedProvider = data.providers.find((provider) => provider.provider === activeProvider) ?? data.providers[0] ?? null;
  const selectedDraft = selectedProvider ? data.providerDrafts[selectedProvider.provider] : null;

  const applyProviderClassToCreateDraft = (providerClass: ProviderClassKey) => {
    const descriptor = currentProviderClassDescriptor(providerClass, data.supportedProviderClasses);
    actions.setNewProvider((current) => ({
      ...current,
      providerClass,
      integrationClass: descriptor.integration_class,
      templateId: descriptor.template_id ?? "",
      endpointBaseUrl: descriptor.default_config.endpoint_base_url ?? "",
      authScheme: descriptor.default_config.auth_scheme ?? (providerClass === "oauth_account" ? "oauth_account" : "bearer"),
      oauthMode: descriptor.default_config.oauth_mode ?? "account_portal",
    }));
  };

  const applyProviderClassToEditDraft = (provider: string, providerClass: ProviderClassKey) => {
    const descriptor = currentProviderClassDescriptor(providerClass, data.supportedProviderClasses);
    actions.setProviderDraftField(provider, "providerClass", providerClass);
    actions.setProviderDraftField(provider, "integrationClass", descriptor.integration_class);
    actions.setProviderDraftField(provider, "templateId", descriptor.template_id ?? "");
    actions.setProviderDraftField(provider, "endpointBaseUrl", descriptor.default_config.endpoint_base_url ?? "");
    actions.setProviderDraftField(provider, "authScheme", descriptor.default_config.auth_scheme ?? (providerClass === "oauth_account" ? "oauth_account" : "bearer"));
    actions.setProviderDraftField(provider, "oauthMode", descriptor.default_config.oauth_mode ?? "account_portal");
  };

  return (
    <>
      <SectionCard title="Provider hinzufügen" description="Create a real provider record with a supported runtime class instead of leaving placeholder onboarding controls behind.">
        {data.access.canMutate ? (
          <div className="fg-inline-form">
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
            <ProviderClassFields
              prefix="Provider "
              providerClass={data.newProvider.providerClass}
              integrationClass={data.newProvider.integrationClass}
              templateId={data.newProvider.templateId}
              endpointBaseUrl={data.newProvider.endpointBaseUrl}
              authScheme={data.newProvider.authScheme}
              oauthMode={data.newProvider.oauthMode}
              supportedProviderClasses={data.supportedProviderClasses}
              onProviderClassChange={applyProviderClassToCreateDraft}
              onFieldChange={(field, value) => actions.setNewProvider((current) => ({ ...current, [field]: value }))}
            />
            <div className="fg-actions fg-actions-end">
              <button type="button" onClick={() => void actions.createProvider()}>
                Provider hinzufügen
              </button>
            </div>
          </div>
        ) : (
          <p className="fg-note">{data.access.summaryDetail}</p>
        )}
      </SectionCard>

      <SectionCard
        title="Provider Inventory"
        description="Live provider records only. OAuth/account work and harness proof stay on their dedicated pages."
        actions={
          selectedProvider && data.access.canMutate ? (
            <div className="fg-actions">
              <button type="button" onClick={() => void actions.saveProvider(selectedProvider.provider)}>
                Save provider
              </button>
              <button type="button" onClick={() => void actions.syncProviderModels(selectedProvider.provider)}>
                Sync models
              </button>
              <button type="button" onClick={() => void actions.toggleProvider(selectedProvider.provider, selectedProvider.enabled)}>
                {selectedProvider.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="fg-table-wrap">
          <table className="fg-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Axis</th>
                <th>Auth type</th>
                <th>Runtime status</th>
                <th>Health</th>
                <th>Models</th>
                <th>Targets</th>
                <th>Last probe</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((provider) => {
                const isSelected = provider.provider === selectedProvider?.provider;
                return (
                  <tr key={provider.provider} className={isSelected ? "is-selected" : ""}>
                    <td>
                      <button className="fg-table-trigger" type="button" onClick={() => setActiveProvider(provider.provider)}>
                        <strong>{provider.label}</strong>
                      </button>
                      <div className="fg-muted">
                        <span className="fg-code">{provider.provider}</span> · {formatProviderClassLabel(String(provider.provider_class))}
                      </div>
                      <div className="fg-muted">
                        compatibility {formatContractClassification(provider.contract_classification)} · {formatCompatibilityDepth(provider.compatibility_depth ?? "none")}
                      </div>
                    </td>
                    <td>{formatProviderAxis(provider.provider_axis)}</td>
                    <td>{authTypeLabel(provider)}</td>
                    <td>
                      <div className="fg-actions">
                        <TonePill label={provider.enabled ? "enabled" : "disabled"} tone={provider.enabled ? "success" : "neutral"} />
                        <TonePill label={provider.ready ? "ready" : provider.runtime_readiness} tone={provider.ready ? "success" : toneFromReadinessAxis(provider.runtime_readiness)} />
                        {provider.oauth_connect_required ? <TonePill label="connect required" tone="warning" /> : null}
                      </div>
                    </td>
                    <td>
                      <TonePill label={formatHealthLabel(provider.health_status)} tone={toneFromHealthStatus(provider.health_status)} />
                      <div className="fg-muted">
                        {formatMetric(provider.healthy_model_count)} healthy / {formatMetric(provider.attention_model_count)} attention
                      </div>
                    </td>
                    <td>
                      {formatMetric(provider.model_count)}
                      <div className="fg-muted">{provider.models.slice(0, 2).map((model) => model.id).join(", ") || "none"}</div>
                    </td>
                    <td>
                      {formatMetric(provider.ready_target_count)} ready / {formatMetric(provider.enabled_target_count)} enabled / {formatMetric(provider.target_count)} total
                    </td>
                    <td>{formatTimestamp(provider.last_probe_at)}</td>
                    <td>
                      <div className="fg-actions">
                        {provider.next_action_kind === "connect_oauth" ? (
                          <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.oauthTargets, instanceId)}>
                            {provider.next_action}
                          </Link>
                        ) : null}
                        {provider.next_action_kind === "activate_provider" && data.access.canMutate ? (
                          <button type="button" onClick={() => void actions.toggleProvider(provider.provider, provider.enabled)}>
                            Activate
                          </button>
                        ) : null}
                        {(provider.next_action_kind === "sync_models" || provider.next_action_kind === "review_sync") && data.access.canMutate ? (
                          <button type="button" onClick={() => void actions.syncProviderModels(provider.provider)}>
                            {provider.next_action}
                          </button>
                        ) : null}
                        {provider.next_action_kind === "run_health" && data.access.canMutate ? (
                          <button type="button" onClick={() => void actions.runHealthChecks()}>
                            {provider.next_action}
                          </button>
                        ) : null}
                        {provider.next_action_kind === "edit_provider" && data.access.canMutate ? (
                          <button type="button" onClick={() => setActiveProvider(provider.provider)}>
                            {provider.next_action}
                          </button>
                        ) : null}
                        {!data.access.canMutate && provider.next_action_kind !== "connect_oauth" ? (
                          <span className="fg-muted">{provider.next_action}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selectedProvider && selectedDraft ? (
          <div className="fg-subcard fg-mt-md">
            <div className="fg-panel-heading">
              <div>
                <h4>{selectedProvider.label}</h4>
                <p className="fg-muted">
                  <span className="fg-code">{selectedProvider.provider}</span> · last sync {formatTimestamp(selectedProvider.last_sync_at)}
                </p>
              </div>
              <div className="fg-actions">
                <TonePill label={selectedProvider.next_action} tone={selectedProvider.oauth_connect_required ? "warning" : "neutral"} />
                {selectedProvider.readiness_reason ? <span className="fg-muted">{selectedProvider.readiness_reason}</span> : null}
              </div>
            </div>

            <div className="fg-inline-form">
              <label>
                Label
                <input
                  value={selectedDraft.label}
                  disabled={!data.access.canMutate}
                  onChange={(event) => actions.setProviderDraftField(selectedProvider.provider, "label", event.target.value)}
                />
              </label>
              <ProviderClassFields
                prefix="Provider "
                providerClass={selectedDraft.providerClass}
                integrationClass={selectedDraft.integrationClass}
                templateId={selectedDraft.templateId}
                endpointBaseUrl={selectedDraft.endpointBaseUrl}
                authScheme={selectedDraft.authScheme}
                oauthMode={selectedDraft.oauthMode}
                supportedProviderClasses={data.supportedProviderClasses}
                disabled={!data.access.canMutate}
                onProviderClassChange={(providerClass) => applyProviderClassToEditDraft(selectedProvider.provider, providerClass)}
                onFieldChange={(field, value) => actions.setProviderDraftField(selectedProvider.provider, field, value)}
              />
            </div>

            <div className="fg-actions fg-mt-sm">
              {data.access.canMutate ? (
                <>
                  <button type="button" onClick={() => void actions.saveProvider(selectedProvider.provider)}>
                    Save provider
                  </button>
                  <button type="button" onClick={() => void actions.syncProviderModels(selectedProvider.provider)}>
                    Sync models
                  </button>
                  <button type="button" onClick={() => void actions.toggleProvider(selectedProvider.provider, selectedProvider.enabled)}>
                    {selectedProvider.enabled ? "Disable" : "Enable"}
                  </button>
                </>
              ) : null}
            </div>

            {selectedProvider.last_sync_error ? <p className="fg-danger fg-mt-sm">Last sync error: {selectedProvider.last_sync_error}</p> : null}
          </div>
        ) : null}
      </SectionCard>
    </>
  );
}

export function ProvidersAdvancedDiagnosticsSection({ data }: { data: ProvidersPageData }) {
  const contractRows = data.providers.map((provider) => ({
    provider: provider.provider,
    label: provider.label,
    contract: formatContractClassification(provider.contract_classification),
    axis: formatProviderAxis(provider.provider_axis),
    proof: provider.harness_proof_status,
    readiness: provider.readiness_reason,
  }));

  return (
    <AdvancedDiagnostics
      title="Advanced Diagnostics"
      description="Product axis contract language and deeper compatibility proof stay collapsed here."
      status={`${data.providers.length} providers`}
      statusTone="neutral"
      statusKey="providers-advanced"
    >
      <div className="fg-stack">
        <div className="fg-subcard">
          <h4>Product axis contract</h4>
          <ul className="fg-list">
            {contractRows.map((row) => (
              <li key={row.provider}>
                {row.label} ({row.provider}) · contract={row.contract} · axis={row.axis} · proof={row.proof} · reason={row.readiness}
              </li>
            ))}
          </ul>
        </div>

        {data.openaiCompatibilitySignoff ? (
          <div className="fg-subcard">
            <h4>OpenAI compatibility signoff</h4>
            <p className="fg-muted">
              overall={formatCatalogLabel(data.openaiCompatibilitySignoff.summary.overall_status)} · supported=
              {formatMetric(data.openaiCompatibilitySignoff.summary.supported)} · partial=
              {formatMetric(data.openaiCompatibilitySignoff.summary.partial)} · blocked by live evidence=
              {formatMetric(data.openaiCompatibilitySignoff.summary.blocked_by_live_evidence)}
            </p>
          </div>
        ) : null}

        {data.operationResult ? (
          <div className="fg-subcard">
            <h4>Last control-plane payload</h4>
            <pre>{data.operationResult}</pre>
          </div>
        ) : null}
      </div>
    </AdvancedDiagnostics>
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

type HarnessControlSectionProps = SectionProps & {
  instanceId?: string | null;
};

export function HarnessControlSection({ data, actions, instanceId }: HarnessControlSectionProps) {
  const [selectedProfileKey, setSelectedProfileKey] = useState<string>(data.profiles[0]?.provider_key ?? "");
  const [actionModel, setActionModel] = useState<string>(data.profiles[0]?.models[0] ?? "model-1");
  const [actionMessage, setActionMessage] = useState<string>("Hello from ForgeFrame harness");
  const [rollbackRevision, setRollbackRevision] = useState<number | null>(null);

  useEffect(() => {
    if (!data.profiles.length) {
      if (selectedProfileKey) {
        setSelectedProfileKey("");
      }
      return;
    }
    if (!data.profiles.some((profile) => profile.provider_key === selectedProfileKey)) {
      setSelectedProfileKey(data.profiles[0].provider_key);
    }
  }, [data.profiles, selectedProfileKey]);

  const selectedProfile = useMemo(
    () => data.profiles.find((profile) => profile.provider_key === selectedProfileKey) ?? data.profiles[0] ?? null,
    [data.profiles, selectedProfileKey],
  );

  useEffect(() => {
    if (!selectedProfile) {
      return;
    }
    const nextModel = selectedProfile.models[0] ?? "model-1";
    setActionModel((current) => (selectedProfile.models.includes(current) ? current : nextModel));
  }, [selectedProfile?.provider_key, selectedProfile?.models]);

  const rollbackOptions = useMemo(() => (selectedProfile ? getRollbackRevisions(selectedProfile) : []), [selectedProfile]);

  useEffect(() => {
    if (rollbackOptions.length === 0) {
      if (rollbackRevision !== null) {
        setRollbackRevision(null);
      }
      return;
    }
    if (rollbackRevision === null || !rollbackOptions.includes(rollbackRevision)) {
      setRollbackRevision(rollbackOptions[0]);
    }
  }, [rollbackOptions, rollbackRevision]);

  useEffect(() => {
    const nextProviderFilter = selectedProfile?.provider_key ?? "all";
    if (data.runFilters.provider !== nextProviderFilter) {
      actions.setRunFilter("provider", nextProviderFilter);
    }
  }, [actions, data.runFilters.provider, selectedProfile?.provider_key]);

  const selectedTemplate = data.templates.find((template) => template.id === data.newHarness.template_id) ?? null;
  const selectedProfileLastRun = selectedProfile ? latestRunForProfile(selectedProfile.provider_key, data.runs, data.runOps) : null;
  const selectedProfileProof = selectedProfile ? profileProofState(selectedProfile, data.providers) : null;
  const selectedProfileRuns = selectedProfile ? data.runs.filter((run) => run.provider_key === selectedProfile.provider_key) : data.runs;
  const proofProviders = data.providers.filter((provider) => provider.harness_proof_status !== "none");
  const logSurfaceLink = withInstanceScope(CONTROL_PLANE_ROUTES.logs, instanceId);
  const availableDraftTemplates = data.templates.filter(
    (template) => template.integration_class === data.newHarness.integration_class || template.id === data.newHarness.template_id,
  );
  const lastFailedRun = asRecord(data.runOps.last_failed_run);

  return (
    <>
      <SectionCard
        title="Harness Workspace"
        description="Operate generic integration profiles directly from this surface: select templates and saved profiles, inspect the live config contract, run preview / verify / dry-run / probe, and manage imports, exports, and rollback."
        actions={
          <button type="button" onClick={() => void actions.load()}>
            Refresh workspace
          </button>
        }
      >
        <div className="fg-grid fg-grid-compact">
          <MetricTile label="Profiles" value={formatMetric(data.profiles.length)} note={`${formatMetric(data.runOps.profiles_needing_attention)} need attention`} />
          <MetricTile label="Templates" value={formatMetric(data.templates.length)} note={`${formatMetric(proofProviders.length)} proof carriers`} />
          <MetricTile
            label="Runs"
            value={formatMetric(data.runSummary.total)}
            note={`${formatMetric(data.runSummary.failed)} failed · ${formatMetric(data.runSummary.preview)} preview`}
          />
          <MetricTile
            label="Preview / Verify / Probe"
            value={`${formatMetric(data.runSummary.preview)} / ${formatMetric(data.runSummary.verify)} / ${formatMetric(data.runSummary.probe)}`}
            note={`dry-run ${formatMetric(data.runSummary.dry_run)}`}
          />
        </div>
      </SectionCard>

      <div className="fg-grid">
        <div className="fg-stack">
          <SectionCard
            title="Profiles & Templates"
            description="The left rail is the operator queue: pick a saved profile to work on or load a template into the editable draft."
          >
            <div className="fg-stack">
              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Saved profiles</h4>
                    <p className="fg-muted">Status, proof, and last-run cues stay visible before you open a profile.</p>
                  </div>
                </div>
                {data.profiles.length === 0 ? <p className="fg-muted">No saved harness profiles yet.</p> : null}
                <div className="fg-stack">
                  {data.profiles.map((profile) => {
                    const profileRun = latestRunForProfile(profile.provider_key, data.runs, data.runOps);
                    const proof = profileProofState(profile, data.providers);
                    const isSelected = profile.provider_key === selectedProfile?.provider_key;
                    return (
                      <button
                        key={profile.provider_key}
                        type="button"
                        className={`fg-section-link${isSelected ? " is-current" : ""}`}
                        onClick={() => setSelectedProfileKey(profile.provider_key)}
                      >
                        <span className="fg-section-link-copy">
                          <span className="fg-wayfinding-label">
                            <span className="fg-section-link-label">{profile.label}</span>
                            <span className="fg-actions">
                              <TonePill label={profile.enabled ? "active" : "inactive"} tone={profile.enabled ? "success" : "neutral"} />
                              <TonePill label={`proof ${proof.status}`} tone={toneFromProofStatus(proof.status)} />
                            </span>
                          </span>
                          <span className="fg-muted">
                            {profile.provider_key} · v{formatMetric(profile.config_revision ?? 1)} · {profile.lifecycle_status ?? "draft"}
                          </span>
                          <span className="fg-muted">
                            last run {profileRun ? `${formatHarnessMode(profileRun.mode)} / ${profileRun.status}` : "not recorded"} · scope={formatHarnessScope(profile)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Templates</h4>
                    <p className="fg-muted">Template selections feed the editable draft instead of hiding behind the providers route.</p>
                  </div>
                </div>
                <ul className="fg-list">
                  {data.templates.map((template) => (
                    <li key={template.id}>
                      <strong>{template.label}</strong> ({template.id}) · class={template.integration_class}
                      {template.profile_defaults?.models?.length ? ` · models=${template.profile_defaults.models.join(", ")}` : ""}
                      {template.description ? ` · ${template.description}` : ""}
                      {data.access.canMutate ? (
                        <>
                          {" "}
                          <button
                            type="button"
                            onClick={() => actions.setNewHarness((current) => buildDraftFromTemplate(template, current))}
                          >
                            Load into draft
                          </button>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="fg-stack">
          <SectionCard
            title="Selected Profile"
            description="The center pane keeps the selected profile readable on its own: status, version, scope, last run, last error, proof posture, and the config contract it actually persists."
            actions={
              selectedProfile && data.access.canMutate ? (
                <button type="button" onClick={() => actions.setNewHarness(buildDraftFromProfile(selectedProfile))}>
                  Load profile into draft
                </button>
              ) : undefined
            }
          >
            {selectedProfile ? (
              <div className="fg-stack">
                <div className="fg-subcard">
                  <div className="fg-panel-heading">
                    <div>
                      <h4>{selectedProfile.label}</h4>
                      <p className="fg-muted">
                        {selectedProfile.provider_key} · {selectedProfile.integration_class}
                        {selectedProfile.template_id ? ` · template=${selectedProfile.template_id}` : " · custom contract"}
                      </p>
                    </div>
                    <div className="fg-actions">
                      <TonePill label={selectedProfile.enabled ? "active" : "inactive"} tone={selectedProfile.enabled ? "success" : "neutral"} />
                      <TonePill
                        label={selectedProfile.lifecycle_status ?? "draft"}
                        tone={toneFromStatus(selectedProfile.lifecycle_status ?? "draft")}
                      />
                      {selectedProfile.needs_attention ? <TonePill label="needs attention" tone="warning" /> : null}
                      {selectedProfileProof ? (
                        <TonePill
                          label={`proof ${selectedProfileProof.status}`}
                          tone={toneFromProofStatus(selectedProfileProof.status)}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="fg-detail-grid">
                    <p>
                      status={selectedProfile.lifecycle_status ?? "draft"} · version=v{formatMetric(selectedProfile.config_revision ?? 1)} · scope=
                      {formatHarnessScope(selectedProfile)}
                    </p>
                    <p>
                      last run=
                      {selectedProfileLastRun
                        ? `${formatTimestamp(selectedProfileLastRun.executed_at)} · ${formatHarnessMode(selectedProfileLastRun.mode)} · ${selectedProfileLastRun.status}`
                        : "not recorded"}
                    </p>
                    <p>last error={toStringValue(selectedProfile.last_error, "none recorded")}</p>
                    <p>proof={selectedProfileProof?.status ?? "none"} · {selectedProfileProof?.note ?? "No proof note available."}</p>
                    <p>
                      verify={toStringValue(selectedProfile.last_verify_status, "never")} · probe={toStringValue(selectedProfile.last_probe_status, "never")} ·
                      sync={toStringValue(selectedProfile.last_sync_status, "never")}
                    </p>
                    <p>
                      last used={formatTimestamp(selectedProfile.last_used_at)} · model={toStringValue(selectedProfile.last_used_model, "-")} · requests=
                      {formatMetric(selectedProfile.request_count)} · stream={formatMetric(selectedProfile.stream_request_count)}
                    </p>
                  </div>
                </div>

                <div className="fg-subcard">
                  <h4>Config contract</h4>
                  <div className="fg-detail-grid">
                    <p>endpoint={selectedProfile.endpoint_base_url}</p>
                    <p>auth={selectedProfile.auth_scheme} · header={selectedProfile.auth_header}</p>
                    <p>models={joinList(selectedProfile.models)}</p>
                    <p>template={toStringValue(selectedProfile.template_id, "none")} · discovery={selectedProfile.discovery_enabled ? "enabled" : "disabled"}</p>
                    <p>
                      request path={toStringValue(selectedProfile.request_mapping?.path)} · method=
                      {toStringValue(selectedProfile.request_mapping?.method, "POST")}
                    </p>
                    <p>
                      response text path={toStringValue(selectedProfile.response_mapping?.text_path)} · error path=
                      {toStringValue(selectedProfile.error_mapping?.message_path)}
                    </p>
                    <p>
                      streaming={selectedProfile.stream_mapping?.enabled ? "enabled" : "disabled"} · tool calling=
                      {selectedProfile.capabilities?.tool_calling ? "enabled" : "disabled"}
                    </p>
                    <p>
                      responses={selectedProfile.capabilities?.responses ? "enabled" : "disabled"} · embeddings=
                      {selectedProfile.capabilities?.embeddings ? "enabled" : "disabled"}
                    </p>
                  </div>
                  {selectedProfile.capabilities?.unsupported_features?.length ? (
                    <p className="fg-note">Unsupported features: {selectedProfile.capabilities.unsupported_features.join(", ")}</p>
                  ) : null}
                </div>

                {selectedProfile.model_inventory?.length ? (
                  <div className="fg-subcard">
                    <h4>Model inventory</h4>
                    <ul className="fg-list">
                      {selectedProfile.model_inventory.map((item, index) => (
                        <li key={`${toStringValue(item.model, "model")}-${index}`}>
                          {item.model} · source={item.source} · status={item.status} · synced={formatTimestamp(item.synced_at)} · reason=
                          {toStringValue(item.readiness_reason, "-")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="fg-muted">Select a saved profile from the left rail to inspect its contract and history.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Editable Draft"
            description={
              data.access.canMutate
                ? "Save a new profile or update the selected one by editing the draft below."
                : "The saved draft contract stays visible, but saving or importing profiles requires a write-capable operator session."
            }
            actions={data.access.canMutate ? <button type="button" onClick={() => void actions.upsertHarness()}>Save profile</button> : undefined}
          >
            {data.access.canMutate ? (
              <div className="fg-stack">
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
                      onChange={(event) =>
                        actions.setNewHarness((current) => ({
                          ...current,
                          integration_class: event.target.value as HarnessProfile["integration_class"],
                          template_id: "",
                        }))
                      }
                    >
                      <option value="openai_compatible">openai_compatible</option>
                      <option value="templated_http">templated_http</option>
                      <option value="static_catalog">static_catalog</option>
                    </select>
                  </label>
                  <label>
                    Template
                    <select
                      value={data.newHarness.template_id}
                      onChange={(event) => {
                        const nextTemplate = data.templates.find((template) => template.id === event.target.value);
                        if (!nextTemplate) {
                          actions.setNewHarness((current) => ({ ...current, template_id: event.target.value }));
                          return;
                        }
                        actions.setNewHarness((current) => buildDraftFromTemplate(nextTemplate, current));
                      }}
                    >
                      <option value="">none</option>
                      {availableDraftTemplates.map((template) => (
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

                <label>
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

                {data.newHarness.auth_scheme !== "none" && !data.newHarness.auth_value ? (
                  <p className="fg-note">Secret-bearing profiles load into the draft with an empty auth value. Re-enter the secret before saving.</p>
                ) : null}

                {selectedTemplate?.profile_defaults?.capabilities?.unsupported_features?.length ? (
                  <p className="fg-note">
                    Selected template unsupported features: {selectedTemplate.profile_defaults.capabilities.unsupported_features.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : (
              <PermissionCallout title={data.access.summaryTitle} detail={data.access.mutationBlockedMessage} />
            )}
          </SectionCard>
        </div>

        <div className="fg-stack">
          <SectionCard
            title="Actions"
            description="Run real harness APIs against the selected profile. Preview stays read-safe; verify, dry-run, and probe require a write-capable non-impersonation session."
          >
            {selectedProfile ? (
              <div className="fg-stack">
                <div className="fg-grid fg-grid-compact">
                  <label>
                    Model
                    <select value={actionModel} onChange={(event) => setActionModel(event.target.value)}>
                      {(selectedProfile.models.length ? selectedProfile.models : [actionModel]).map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Message
                    <input value={actionMessage} onChange={(event) => setActionMessage(event.target.value)} placeholder="Hello from ForgeFrame harness" />
                  </label>
                  <label>
                    Rollback revision
                    <select
                      value={rollbackRevision === null ? "" : String(rollbackRevision)}
                      onChange={(event) => setRollbackRevision(event.target.value ? Number(event.target.value) : null)}
                      disabled={!rollbackOptions.length}
                    >
                      <option value="">no prior revision</option>
                      {rollbackOptions.map((revision) => (
                        <option key={revision} value={revision}>
                          revision {revision}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="fg-actions">
                  <button type="button" onClick={() => void actions.previewHarnessProfile(selectedProfile.provider_key, actionModel, actionMessage)}>
                    Preview
                  </button>
                  {data.access.canOperate ? (
                    <>
                      <button type="button" onClick={() => void actions.verifyHarnessProfile(selectedProfile.provider_key, actionModel, actionMessage)}>
                        Verify
                      </button>
                      <button type="button" onClick={() => void actions.dryRunHarnessProfile(selectedProfile.provider_key, actionModel, actionMessage)}>
                        Dry-run
                      </button>
                      <button type="button" onClick={() => void actions.probeHarnessProfile(selectedProfile.provider_key, actionModel)}>
                        Probe
                      </button>
                    </>
                  ) : null}
                </div>

                <div className="fg-actions">
                  {data.access.canMutate ? (
                    <>
                      <button type="button" onClick={() => void actions.toggleHarnessProfile(selectedProfile.provider_key, selectedProfile.enabled)}>
                        {selectedProfile.enabled ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => rollbackRevision !== null && void actions.rollbackHarnessProfile(selectedProfile.provider_key, rollbackRevision)}
                        disabled={rollbackRevision === null}
                      >
                        Rollback
                      </button>
                    </>
                  ) : null}
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

                {!data.access.canOperate ? <p className="fg-note">{data.access.operateBlockedMessage}</p> : null}
                {!data.access.canMutate ? <p className="fg-note">Import, activation, rollback, and save actions require `providers.write` on this instance.</p> : null}
              </div>
            ) : (
              <p className="fg-muted">Select a profile before running harness actions.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Last Action Result"
            description="The latest harness action stays summarized here with operator-facing status instead of a raw provider payload dump."
          >
            {data.lastHarnessAction ? (
              <div className="fg-stack">
                <div className="fg-panel-heading">
                  <div>
                    <h4>{data.lastHarnessAction.title}</h4>
                    <p className="fg-muted">{data.lastHarnessAction.summary}</p>
                  </div>
                  <TonePill label={data.lastHarnessAction.status} tone={toneFromStatus(data.lastHarnessAction.status)} />
                </div>
                <div className="fg-detail-grid">
                  <p>
                    provider={toStringValue(data.lastHarnessAction.providerKey)} · model={toStringValue(data.lastHarnessAction.model)}
                  </p>
                  <p>
                    captured={formatTimestamp(data.lastHarnessAction.capturedAt)} · run=
                    {data.lastHarnessAction.run?.run_id ? `${data.lastHarnessAction.run.run_id}` : "not attached"}
                  </p>
                  <p>
                    run status=
                    {data.lastHarnessAction.run
                      ? `${data.lastHarnessAction.run.status} at ${formatTimestamp(data.lastHarnessAction.run.executed_at)}`
                      : "not-ready"}
                  </p>
                  <p>error={toStringValue(data.lastHarnessAction.error, "none recorded")}</p>
                </div>
                <div className="fg-actions">
                  <Link className="fg-nav-link" to={logSurfaceLink}>
                    Open logs
                  </Link>
                  <a className="fg-nav-link" href="#harness-advanced-diagnostics">
                    Open diagnostics payload
                  </a>
                </div>
                <p className="fg-note">Log handoff is currently `bridge-only`: ForgeFrame can route you to the shared logs surface, but it does not yet deep-link a single harness run there.</p>
              </div>
            ) : (
              <p className="fg-muted">No harness action has been run from this session yet.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Run History"
            description="The right rail keeps recent runs visible with time, mode, status, error, and the log handoff link."
          >
            <div className="fg-grid fg-grid-compact fg-mb-sm">
              <MetricTile label="Preview / Dry-run" value={`${formatMetric(data.runSummary.preview)} / ${formatMetric(data.runSummary.dry_run)}`} note="request contract actions" />
              <MetricTile label="Verify / Probe" value={`${formatMetric(data.runSummary.verify)} / ${formatMetric(data.runSummary.probe)}`} note={`${formatMetric(data.runSummary.failed)} failed`} />
              <MetricTile label="Runtime" value={`${formatMetric(data.runSummary.runtime_non_stream)} / ${formatMetric(data.runSummary.runtime_stream)}`} note="non-stream / stream" />
            </div>

            <div className="fg-grid fg-grid-compact fg-mb-sm">
              {renderRunFilterSelect("Mode", data.runFilters.mode, (value) => actions.setRunFilter("mode", value), [
                { value: "all", label: "all" },
                { value: "preview", label: "preview" },
                { value: "dry_run", label: "dry run" },
                { value: "verify", label: "verify" },
                { value: "probe", label: "probe" },
                { value: "runtime_non_stream", label: "runtime non-stream" },
                { value: "runtime_stream", label: "runtime stream" },
                { value: "sync", label: "sync" },
              ])}
              {renderRunFilterSelect("Status", data.runFilters.status, (value) => actions.setRunFilter("status", value), [
                { value: "all", label: "all" },
                { value: "ok", label: "ok" },
                { value: "warning", label: "warning" },
                { value: "failed", label: "failed" },
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

            {selectedProfileRuns.length === 0 ? (
              <p className="fg-muted">No runs matched the selected profile and filters.</p>
            ) : (
              <ul className="fg-list">
                {selectedProfileRuns.map((run, index) => (
                  <li key={`${toStringValue(run.run_id, toStringValue(run.provider_key, "run"))}-${index}`}>
                    <div className="fg-panel-heading">
                      <div>
                        <strong>{formatHarnessMode(run.mode)}</strong>
                        <div className="fg-muted">
                          {formatTimestamp(run.executed_at)} · status={run.status} · model={toStringValue(run.model)}
                        </div>
                      </div>
                      <div className="fg-actions">
                        <TonePill label={run.status} tone={toneFromStatus(run.status)} />
                        <Link className="fg-nav-link" to={logSurfaceLink}>
                          Logs
                        </Link>
                      </div>
                    </div>
                    <div className="fg-detail-grid">
                      <p>run id={toStringValue(run.run_id, "pending")} · client={toStringValue(run.client_id)} · integration={toStringValue(run.integration)}</p>
                      <p>error={toStringValue(run.error, "none recorded")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <div id="harness-advanced-diagnostics">
        <AdvancedDiagnostics
          title="Advanced Diagnostics"
          description="Raw snapshots, import/export payloads, and proof carriers stay collapsed here so the main workspace remains operational."
          status={`${proofProviders.length} proof carrier${proofProviders.length === 1 ? "" : "s"}`}
          statusTone={proofProviders.length > 0 ? "success" : "neutral"}
          statusKey="harness-advanced-diagnostics"
        >
          <div className="fg-stack">
            <div className="fg-subcard">
              <h4>Diagnostics buffer</h4>
              <p className="fg-muted">Export writes the current snapshot here. Import dry-run and apply read from the same buffer.</p>
              <textarea
                value={data.importPayload}
                onChange={(event) => actions.setImportPayload(event.target.value)}
                rows={14}
                placeholder={
                  data.access.canMutate
                    ? "Harness snapshot JSON for dry-run or import"
                    : data.access.canExportRedacted
                      ? "Redacted harness snapshot export remains visible here, but import actions stay hidden for this session."
                      : "Harness snapshot export is unavailable for this session."
                }
                readOnly={!data.access.canMutate}
              />
            </div>

            <div className="fg-subcard">
              <h4>Last raw harness payload</h4>
              {data.operationResult ? <pre>{data.operationResult}</pre> : <p className="fg-muted">No raw payload captured yet.</p>}
            </div>

            <div className="fg-subcard">
              <h4>Proof carriers</h4>
              {proofProviders.length === 0 ? <p className="fg-muted">No providers carry harness proof yet.</p> : null}
              <ul className="fg-list">
                {proofProviders.map((provider) => (
                  <li key={provider.provider}>
                    {provider.label} ({provider.provider}) · proof={provider.harness_proof_status} · proven profiles=
                    {provider.harness_proven_profile_keys.length > 0 ? joinList(provider.harness_proven_profile_keys) : "-"} · runs=
                    {formatMetric(provider.harness_run_count)}
                  </li>
                ))}
              </ul>
            </div>

            {selectedProfile ? (
              <div className="fg-subcard">
                <h4>Selected profile snapshot</h4>
                <pre>{stringifyJson(selectedProfile)}</pre>
              </div>
            ) : null}
          </div>
        </AdvancedDiagnostics>
      </div>
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

export function ProviderCatalogSection({ data }: { data: ProvidersPageData }) {
  const summary = data.providerCatalogSummary;

  return (
    <SectionCard
      title="Provider Contract Catalog"
      description="This catalog is the V9 provider truth backlog: docs-declared contract rows, current repo surface, missing proof, and blocked live signoff are separated so documentation cannot masquerade as runtime support."
    >
      {summary ? (
        <div className="fg-grid fg-grid-compact fg-mb-md">
          <MetricTile label="Catalog rows" value={formatMetric(summary.total_providers)} note={`${formatMetric(summary.documented_only)} documented only`} />
          <MetricTile label="Contract ready" value={formatMetric(summary.contract_ready)} note={`${formatMetric(summary.adapter_ready_without_live_proof)} adapter ready without live proof`} />
          <MetricTile label="Runtime ready" value={formatMetric(summary.runtime_ready)} note={`${formatMetric(summary.partial_runtime)} partial runtime`} />
          <MetricTile label="Live signoff blocked" value={formatMetric(summary.blocked_live_signoffs)} note={`${formatMetric(summary.pending_live_signoffs)} pending review`} />
        </div>
      ) : null}

      <div className="fg-card-grid">
        {data.providerCatalog.map((entry) => {
          const latestEvidence = ["docs_declared", "repo_observed", "live_probe_verified", "streaming_verified", "tool_calling_verified"].map(
            (evidenceClass) => entry.evidence_log.filter((item) => item.evidence_class === evidenceClass).at(-1),
          );
          const latestSignoff = entry.signoff_history.at(-1);
          return (
            <article key={entry.provider_id} className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>
                    {entry.display_name} ({entry.provider_id})
                  </h4>
                  <p className="fg-muted">
                    class={formatCatalogLabel(entry.provider_class)} · raw={entry.raw_class} · axis={formatProviderAxis(entry.product_axis)}
                  </p>
                </div>
                <div className="fg-actions">
                  <TonePill label={`maturity ${formatCatalogLabel(entry.maturity_status)}`} tone={toneFromCatalogMaturity(entry.maturity_status)} />
                  <TonePill label={`signoff ${formatCatalogLabel(entry.live_signoff_status)}`} tone={toneFromCatalogSignoff(entry.live_signoff_status)} />
                  <TonePill label={`evidence ${formatCatalogLabel(entry.evidence_status)}`} tone={entry.evidence_status === "repo_observed" || entry.evidence_status === "live_probe_verified" ? "success" : "neutral"} />
                </div>
              </div>

              <div className="fg-detail-grid">
                <p>
                  auth modes={entry.auth_modes_supported.length > 0 ? joinList(entry.auth_modes_supported) : "none"} · api modes=
                  {entry.api_modes_supported.length > 0 ? joinList(entry.api_modes_supported) : "none"}
                </p>
                <p>
                  runtime binding={entry.runtime_provider_binding ?? "-"} · oauth binding={entry.oauth_target_binding ?? "-"} · axis binding=
                  {entry.product_axis_binding ?? "-"}
                </p>
                <p>
                  streaming claim={entry.streaming_support_claim} · tools claim={entry.tools_support_claim} · responses claim=
                  {entry.responses_support_claim}
                </p>
                <p>
                  base URL={entry.base_url_default ?? "-"} · override env={entry.base_url_override_env ?? "-"} · token env=
                  {entry.token_env_vars.length > 0 ? joinList(entry.token_env_vars) : "-"}
                </p>
                <p>
                  source docs={entry.source_docs.length > 0 ? joinList(entry.source_docs) : "-"} · local refs={formatMetric(entry.local_reference_paths.length)}
                </p>
                <p>safe next action: {entry.safe_next_action}</p>
                {entry.missing_evidence.length > 0 ? <p className="fg-note">missing evidence: {entry.missing_evidence.join(" | ")}</p> : null}
                {entry.signoff_notes ? <p className="fg-note">signoff note: {entry.signoff_notes}</p> : null}
              </div>

              <details className="fg-mt-sm">
                <summary>Current contract vs evidence</summary>
                <ul className="fg-list">
                  {latestEvidence.map((item, index) =>
                    item ? (
                      <li key={`${item.evidence_class}-${index}`}>
                        {formatCatalogLabel(item.evidence_class)} · status={formatCatalogLabel(item.status)} · source={formatCatalogLabel(item.source_kind)} · recorded=
                        {formatTimestamp(item.recorded_at)} · details={item.details}
                      </li>
                    ) : null,
                  )}
                </ul>
                {latestSignoff ? (
                  <p className="fg-note">
                    latest signoff={formatCatalogLabel(latestSignoff.status)} · recorded={formatTimestamp(latestSignoff.recorded_at)} · details=
                    {latestSignoff.details}
                  </p>
                ) : null}
              </details>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function OpenAICompatibilitySection({ data }: { data: ProvidersPageData }) {
  const signoff = data.openaiCompatibilitySignoff;

  if (!signoff) {
    return (
      <SectionCard
        title="OpenAI Compatibility Signoff"
        description="This surface stays explicit about what is verified, partial, blocked by missing live evidence, or entirely absent."
      >
        <p className="fg-muted">No compatibility signoff payload is currently available for this instance.</p>
      </SectionCard>
    );
  }

  const summary = signoff.summary;

  return (
    <SectionCard
      title="OpenAI Compatibility Signoff"
      description="This is the hard corpus-level compatibility truth for the current instance. Runtime evidence and known deviations are separated so `/v1/responses` cannot quietly borrow green status from chat-only paths."
    >
      <div className="fg-grid fg-grid-compact fg-mb-md">
        <MetricTile label="Corpus checks" value={formatMetric(summary.total_checks)} note={`${formatMetric(summary.supported)} supported`} />
        <MetricTile label="Partial" value={formatMetric(summary.partial)} note={`${formatMetric(summary.blocked_by_live_evidence)} blocked by live evidence`} />
        <MetricTile label="Unsupported" value={formatMetric(summary.unsupported)} note={`${formatMetric(summary.skipped)} skipped`} />
        <MetricTile
          label="Overall"
          value={formatCatalogLabel(summary.overall_status)}
          note={summary.signoff_claimable ? "signoff claimable" : "signoff not claimable"}
        />
      </div>

      <div className="fg-card-grid">
        {signoff.rows.map((row) => (
          <article key={row.corpus_class} className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>{row.label}</h4>
                <p className="fg-muted">
                  {row.corpus_class} · route={row.route ?? "-"} · axis={row.provider_axis ?? "-"}
                </p>
              </div>
              <div className="fg-actions">
                <TonePill label={formatCatalogLabel(row.status)} tone={toneFromOpenAICompatibilityStatus(row.status)} />
                <TonePill label={row.live_evidence_required ? "live evidence required" : "repo truth allowed"} tone={row.live_evidence_required ? "warning" : "neutral"} />
              </div>
            </div>

            <div className="fg-detail-grid">
              <p>evidence source={row.evidence_source}</p>
              <p>last verified={formatTimestamp(row.last_verified_at)} · sample request={row.sample_request_id ?? "-"}</p>
              <p>deviation reason: {row.deviation_reason ?? "none"}</p>
              <p>raw diff summary: {row.raw_diff_summary ?? "none"}</p>
              {row.notes ? <p className="fg-note">{row.notes}</p> : null}
            </div>
          </article>
        ))}
      </div>

      <div className="fg-subcard fg-mt-sm">
        <h4>Operator notes</h4>
        <ul className="fg-list">
          {signoff.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

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
                                Verbindung testen
                              </button>
                            </>
                          ) : null}
                          {canInvoke && item.action_key === "bridge_sync" ? (
                            <>
                              {" "}
                              <button type="button" onClick={() => void actions.syncOauthBridgeProfiles()}>
                                Bridge-Profil synchronisieren
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
                  statusKey={target.connection_status}
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

export const ExpansionTargetsSection = OAuthTargetsSection;
