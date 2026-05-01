import type { ReactNode, Ref } from "react";

import type {
  CapabilityEvidenceRecord,
  HarnessProfile,
  OpenAICompatibilityStatus,
  ProviderClassDescriptor,
  ProviderClassKey,
  ProviderCatalogEntry,
  ProviderCapabilityEvidenceRecord,
} from "../../api/admin";
import type { HarnessDraft, ProvidersActionFeedback, ProvidersPageData } from "./providersShared";
import { asRecord, formatTimestamp, formatMetric, joinList, toStringValue } from "./providersShared";

export type SectionCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  tabIndex?: number;
  cardRef?: Ref<HTMLDivElement>;
};

export type Tone = "success" | "warning" | "danger" | "neutral";

export function SectionCard({ title, description, actions, children, id, className, tabIndex, cardRef }: SectionCardProps) {
  return (
    <div id={id} ref={cardRef} tabIndex={tabIndex} className={`fg-card${className ? ` ${className}` : ""}`}>
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

export function MetricTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="fg-kpi">
      <span className="fg-muted">{label}</span>
      <strong className="fg-kpi-value">{value}</strong>
      {note ? <span className="fg-muted">{note}</span> : null}
    </div>
  );
}

export function TonePill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className="fg-pill" data-tone={tone}>
      {label}
    </span>
  );
}

/**
 * Announces the last provider action outcome next to the controls that caused it.
 * @param feedback - Action result returned by the providers control-plane hook.
 * @returns Accessible status or error markup when feedback exists.
 */
export function ActionFeedbackNotice({ feedback }: { feedback: ProvidersActionFeedback | null }) {
  if (!feedback) {
    return <div className="fg-action-feedback" role="status" aria-live="polite" aria-atomic="true" />;
  }

  return (
    <div
      className={`fg-action-feedback${feedback.tone === "error" ? " is-error" : " is-success"}`}
      role={feedback.tone === "error" ? "alert" : "status"}
      aria-live={feedback.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <strong>{feedback.message}</strong>
      {feedback.detail ? <span>{feedback.detail}</span> : null}
    </div>
  );
}

export function PermissionCallout({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="fg-subcard">
      <h4>{title}</h4>
      <p className="fg-muted">{detail}</p>
    </div>
  );
}

export function toneFromStatus(status: string | null | undefined): Tone {
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

export function toneFromReadinessAxis(axis: "planned" | "partial" | "ready"): Tone {
  if (axis === "ready") {
    return "success";
  }
  if (axis === "partial") {
    return "warning";
  }
  return "neutral";
}

export function toneFromContractClassification(
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

export function formatContractClassification(
  classification: "runtime-ready" | "partial-runtime" | "bridge-only" | "onboarding-only" | "unsupported",
): string {
  return classification.replaceAll("-", " ");
}

export function formatCompatibilityDepth(
  depth: "none" | "limited" | "constrained" | "validated",
): string {
  return depth.replaceAll("_", " ");
}

export function toneFromProofStatus(status: "none" | "partial" | "proven"): Tone {
  if (status === "proven") {
    return "success";
  }
  if (status === "partial") {
    return "warning";
  }
  return "neutral";
}

export function toneFromCatalogMaturity(
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

export function toneFromCatalogSignoff(
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

export function toneFromOpenAICompatibilityStatus(status: OpenAICompatibilityStatus): Tone {
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

export function formatCatalogLabel(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function formatProviderClassLabel(value: string): string {
  if (value === "local_ollama") {
    return "local / ollama";
  }
  if (value === "oauth_account") {
    return "oauth / account-backed";
  }
  return formatCatalogLabel(value);
}

export function toneFromHealthStatus(status: string | null | undefined): Tone {
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

export function formatHealthLabel(status: string | null | undefined): string {
  if (!status) {
    return "unknown";
  }
  if (status === "not-run") {
    return "not run";
  }
  return status.replaceAll("_", " ");
}

export function authTypeLabel(provider: ProvidersPageData["providers"][number]): string {
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

export function currentProviderClassDescriptor(
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

export function formatEvidenceSource(source: CapabilityEvidenceRecord["source"]): string {
  return source.replaceAll("_", " ");
}

export function EvidenceSummary({
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

export function ReadinessAxisPills({
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

export function renderRunFilterSelect(
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

export function formatHarnessMode(mode: string | null | undefined): string {
  if (!mode) {
    return "unknown";
  }
  return mode.replaceAll("_", " ");
}

export function formatHarnessScope(profile: HarnessProfile): string {
  return profile.instance_id?.trim() ? profile.instance_id : "global";
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "";
}

export const OAUTH_TARGET_PRIORITY: Record<string, number> = {
  openai_codex: 0,
  github_copilot: 1,
  claude_code: 2,
  antigravity: 3,
  gemini: 4,
  nous_oauth: 5,
  qwen_oauth: 6,
};

export function toneFromOauthConnectionStatus(
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

export function formatOauthConnectionStatus(status: ProvidersPageData["oauthTargets"][number]["connection_status"]): string {
  return status;
}

export function contractStatusFromOauthConnectionStatus(
  status: ProvidersPageData["oauthTargets"][number]["connection_status"],
): string {
  switch (status) {
    case "runtime-ready":
      return "runtime-ready";
    case "bridge-only":
      return "bridge-only";
    case "oauth unsupported":
      return "unsupported";
    case "token present":
      return "partial";
    case "needs refresh":
    case "expired":
      return "degraded";
    case "probe failed":
      return "blocked";
    case "not configured":
    default:
      return "onboarding-only";
  }
}

export function formatOauthActionMode(mode: ProvidersPageData["oauthTargets"][number]["actions"][number]["mode"]): string {
  if (mode === "api") {
    return "live action";
  }
  if (mode === "manual") {
    return "manual";
  }
  return "unsupported";
}

export function formatOauthProviderName(target: ProvidersPageData["oauthTargets"][number]): string {
  return target.provider_label || target.provider_key;
}

export function buildDraftFromProfile(profile: HarnessProfile): HarnessDraft {
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

export function buildDraftFromTemplate(template: ProvidersPageData["templates"][number], current: HarnessDraft): HarnessDraft {
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

export function getRollbackRevisions(profile: HarnessProfile): number[] {
  return (profile.config_history ?? [])
    .map((entry) => (typeof entry.revision === "number" ? entry.revision : Number(entry.revision)))
    .filter((revision): revision is number => Number.isFinite(revision))
    .sort((left, right) => right - left);
}

export function latestRunForProfile(
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

export function profileProofState(
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

export function HarnessProfileCard({
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

export type ProvidersManagementSectionProps = {
  data: ProvidersPageData;
  actions: import("./providersShared").ProvidersPageActions;
  instanceId?: string | null;
};

export function ProviderClassFields({
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
