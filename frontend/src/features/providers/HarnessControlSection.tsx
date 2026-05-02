import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { HarnessProfile } from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import { AdvancedDiagnostics } from "../../components/ui/AdvancedDiagnostics";
import type { ProvidersPageActions, ProvidersPageData } from "./providersShared";
import { asRecord, formatMetric, formatTimestamp, joinList, toStringValue } from "./providersShared";
import {
  buildDraftFromProfile,
  buildDraftFromTemplate,
  formatHarnessMode,
  formatHarnessScope,
  getRollbackRevisions,
  HarnessProfileCard,
  latestRunForProfile,
  MetricTile,
  PermissionCallout,
  profileProofState,
  renderRunFilterSelect,
  SectionCard,
  stringifyJson,
  TonePill,
  toneFromProofStatus,
  toneFromStatus,
} from "./providersSectionUtils";

type SectionProps = {
  data: ProvidersPageData;
  actions: ProvidersPageActions;
};

type HarnessControlSectionProps = SectionProps & {
  instanceId?: string | null;
};

/**
 * Group runs by mode type for scannable grouping.
 */
function groupRunsByMode(
  runs: ProvidersPageData["runs"],
): Record<string, ProvidersPageData["runs"]> {
  const groups: Record<string, ProvidersPageData["runs"]> = {};
  for (const run of runs) {
    const key = run.mode || "unknown";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(run);
  }
  return groups;
}

/**
 * Determine harness overall status and next recommended step.
 */
function deriveHarnessStatus(data: ProvidersPageData): {
  statusTone: "success" | "warning" | "danger" | "neutral";
  statusLabel: string;
  nextStep: string;
  nextStepTone: "success" | "warning" | "danger" | "neutral";
  activeProfile: string | null;
  lastVerify: string;
} {
  const activeProfiles = data.profiles.filter((p) => p.enabled);
  const attentionProfiles = data.profiles.filter((p) => p.needs_attention);
  const lastRun = data.runs[0] ?? null;

  if (data.profiles.length === 0) {
    return {
      statusTone: "neutral",
      statusLabel: "Not configured",
      nextStep: "Select a provider preset or template to create your first harness profile.",
      nextStepTone: "neutral",
      activeProfile: null,
      lastVerify: "never",
    };
  }

  if (attentionProfiles.length > 0) {
    return {
      statusTone: "warning",
      statusLabel: `${attentionProfiles.length} profile${attentionProfiles.length > 1 ? "s" : ""} need attention`,
      nextStep: `Review ${attentionProfiles[0]?.label ?? "the first attention profile"} and resolve issues.`,
      nextStepTone: "warning",
      activeProfile: activeProfiles[0]?.label ?? null,
      lastVerify: lastRun?.status ?? "unknown",
    };
  }

  if (activeProfiles.length === 0) {
    return {
      statusTone: "neutral",
      statusLabel: "No active profile",
      nextStep: "Activate a configured profile to enable harness operations.",
      nextStepTone: "neutral",
      activeProfile: null,
      lastVerify: lastRun?.status ?? "never",
    };
  }

  return {
    statusTone: "success",
    statusLabel: `${activeProfiles.length} active profile${activeProfiles.length > 1 ? "s" : ""}`,
    nextStep: lastRun
      ? "Review the latest run result or run a new verification."
      : "Run a verification to confirm harness configuration.",
    nextStepTone: "success",
    activeProfile: activeProfiles[0]?.label ?? null,
    lastVerify: lastRun?.status ?? "never",
  };
}

/**
 * Harness workspace section — guided operator workflow for integration profiles.
 *
 * Layout:
 *  1. Status hero + next-step recommendation
 *  2. 3-column workspace: Presets | Config Preview | Actions
 *  3. Run history (collapsible)
 *  4. Diagnostics (collapsible)
 */
export function HarnessControlSection({ data, actions, instanceId }: HarnessControlSectionProps) {
  const [selectedProfileKey, setSelectedProfileKey] = useState<string>(data.profiles[0]?.provider_key ?? "");
  const [actionModel, setActionModel] = useState<string>(data.profiles[0]?.models[0] ?? "model-1");
  const [actionMessage, setActionMessage] = useState<string>("Hello from ForgeFrame harness");
  const [rollbackRevision, setRollbackRevision] = useState<number | null>(null);
  const [showRunDetails, setShowRunDetails] = useState(false);

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

  const harnessStatus = deriveHarnessStatus(data);
  const groupedRuns = useMemo(() => groupRunsByMode(selectedProfileRuns), [selectedProfileRuns]);

  return (
    <>
      {/* ─── Status Hero ─── */}
      <div className="ff-status-hero">
        <div className="ff-status-hero-top">
          <div>
            <h2 className="ff-status-hero-label">Harness Status</h2>
            <p className="ff-status-hero-line">
              {harnessStatus.activeProfile
                ? `Active: ${harnessStatus.activeProfile} · Last verify: ${harnessStatus.lastVerify}`
                : "No harness profiles configured yet"}
            </p>
          </div>
          <div className="ff-status-hero-stats">
            <span>{formatMetric(data.profiles.length)} profile{data.profiles.length !== 1 ? "s" : ""}</span>
            <span>{formatMetric(data.runSummary.total)} run{data.runSummary.total !== 1 ? "s" : ""}</span>
            <span>{formatMetric(data.templates.length)} template{data.templates.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="ff-next-step" data-tone={harnessStatus.nextStepTone}>
          <span className="ff-next-step-label">Next step:</span>
          <span>{harnessStatus.nextStep}</span>
        </div>
      </div>

      {/* ─── 3-Column Workspace ─── */}
      <div className="ff-harness-layout">
        {/* ── Left Column: Provider Presets ── */}
        <div className="fg-stack">
          <SectionCard title="Provider Presets" description="Select a saved profile to inspect and operate. Choose a template to create a new one.">
            {data.profiles.length === 0 ? (
              <p className="fg-muted">No saved harness profiles yet. Use a template below to create one.</p>
            ) : (
              <div className="ff-harness-presets" role="listbox" aria-label="Harness profiles">
                {data.profiles.map((profile) => {
                  const profileRun = latestRunForProfile(profile.provider_key, data.runs, data.runOps);
                  const proof = profileProofState(profile, data.providers);
                  const isSelected = profile.provider_key === selectedProfile?.provider_key;
                  return (
                    <button
                      key={profile.provider_key}
                      type="button"
                      className={`ff-harness-preset${isSelected ? " is-selected" : ""}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelectedProfileKey(profile.provider_key)}
                    >
                      <div className="ff-harness-preset-meta">
                        <span className="ff-harness-preset-name">{profile.label}</span>
                        <span className="ff-harness-preset-detail">
                          {profile.provider_key} · {profile.integration_class}
                          {profile.lifecycle_status ? ` · ${profile.lifecycle_status}` : ""}
                        </span>
                        <span className="ff-harness-preset-detail">
                          Models: {joinList(profile.models.slice(0, 3))}
                          {profile.models.length > 3 ? ` +${profile.models.length - 3}` : ""}
                        </span>
                      </div>
                      <div className="ff-harness-preset-action">
                        <TonePill label={profile.enabled ? "active" : "inactive"} tone={profile.enabled ? "success" : "neutral"} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {data.templates.length > 0 ? (
              <details className="ff-collapse-section fg-mt-sm" style={{ borderRadius: "var(--fg-radius-md)" }}>
                <summary>
                  <div className="ff-collapse-summary-text">
                    <h3>Templates ({data.templates.length})</h3>
                    <p>Load a template into the draft to populate provider defaults.</p>
                  </div>
                </summary>
                <div className="ff-collapse-section-body">
                  <div className="fg-stack fg-mt-sm">
                    {data.templates.map((template) => (
                      <div key={template.id} className="fg-subcard">
                        <div className="fg-template-card-header">
                          <strong className="fg-section-link-label">{template.label}</strong>
                          <span className="fg-template-id">{template.id}</span>
                        </div>
                        <div className="ff-harness-detail-row">
                          <span>class={template.integration_class}</span>
                          {template.profile_defaults?.models?.length ? (
                            <span>models={joinList(template.profile_defaults.models)}</span>
                          ) : null}
                        </div>
                        {template.description ? <p className="fg-muted fg-template-desc">{template.description}</p> : null}
                        {data.access.canMutate ? (
                          <div className="ff-harness-preset-action fg-mt-sm">
                            <button
                              type="button"
                              onClick={() => actions.setNewHarness((current) => buildDraftFromTemplate(template, current))}
                            >
                              Use template
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </SectionCard>
        </div>

        {/* ── Center Column: Config Preview / Draft ── */}
        <div className="fg-stack">
          <SectionCard
            title={selectedProfile ? selectedProfile.label : "Configuration Preview"}
            description={
              selectedProfile
                ? `Contract details for ${selectedProfile.provider_key} — click "Use this preset" below actions to load into editable draft.`
                : "Select a profile from the left panel to inspect its configuration here."
            }
          >
            {selectedProfile ? (
              <div className="fg-stack">
                {/* Status badges row */}
                <div className="ff-harness-detail-row">
                  <TonePill label={selectedProfile.enabled ? "active" : "inactive"} tone={selectedProfile.enabled ? "success" : "neutral"} />
                  <TonePill
                    label={selectedProfile.lifecycle_status ?? "draft"}
                    tone={toneFromStatus(selectedProfile.lifecycle_status ?? "draft")}
                  />
                  {selectedProfile.needs_attention ? <TonePill label="needs attention" tone="warning" /> : null}
                  {selectedProfileProof ? (
                    <TonePill label={`proof ${selectedProfileProof.status}`} tone={toneFromProofStatus(selectedProfileProof.status)} />
                  ) : null}
                  <span>v{formatMetric(selectedProfile.config_revision ?? 1)}</span>
                  <span>scope={formatHarnessScope(selectedProfile)}</span>
                </div>

                {/* Compact detail grid */}
                <div className="fg-detail-grid fg-detail-grid-compact">
                  <div className="fg-detail-rows">
                    <p><span className="fg-detail-key">endpoint</span> {selectedProfile.endpoint_base_url}</p>
                    <p><span className="fg-detail-key">auth</span> {selectedProfile.auth_scheme} · header={selectedProfile.auth_header}</p>
                    <p><span className="fg-detail-key">models</span> {joinList(selectedProfile.models)}</p>
                    <p>
                      <span className="fg-detail-key">capabilities</span>
                      {" "}streaming={selectedProfile.stream_mapping?.enabled ? "yes" : "no"}
                      {" · "}tools={selectedProfile.capabilities?.tool_calling ? "yes" : "no"}
                      {" · "}responses={selectedProfile.capabilities?.responses ? "yes" : "no"}
                    </p>
                  </div>
                </div>

                {/* Last activity row */}
                <div className="ff-harness-detail-row">
                  <span>last run: {selectedProfileLastRun ? `${formatHarnessMode(selectedProfileLastRun.mode)} · ${selectedProfileLastRun.status}` : "not recorded"}</span>
                  <span>verify: {toStringValue(selectedProfile.last_verify_status, "never")}</span>
                  <span>probe: {toStringValue(selectedProfile.last_probe_status, "never")}</span>
                  <span>sync: {toStringValue(selectedProfile.last_sync_status, "never")}</span>
                </div>

                {selectedProfile.last_error ? <p className="fg-note">Last error: {selectedProfile.last_error}</p> : null}

                {/* Model inventory (collapsible) */}
                {selectedProfile.model_inventory?.length ? (
                  <details className="fg-mt-sm">
                    <summary style={{ fontSize: "var(--fg-type-size-meta)", cursor: "pointer" }}>
                      Model inventory ({selectedProfile.model_inventory.length})
                    </summary>
                    <div className="fg-stack fg-mt-sm">
                      {selectedProfile.model_inventory.map((item, index) => (
                        <div key={`${toStringValue(item.model, "model")}-${index}`} className="fg-detail-rows fg-model-inv-row">
                          <strong>{item.model}</strong>
                          <span className="fg-muted">source={item.source} · status={item.status}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                {/* Mapping details (collapsible) */}
                {selectedProfile.request_mapping?.path ? (
                  <details className="fg-mt-sm">
                    <summary style={{ fontSize: "var(--fg-type-size-meta)", cursor: "pointer" }}>Mapping details</summary>
                    <div className="fg-detail-rows fg-mt-sm">
                      <p><span className="fg-detail-key">request</span> {selectedProfile.request_mapping.method ?? "POST"} {selectedProfile.request_mapping.path}</p>
                      <p><span className="fg-detail-key">response</span> path={toStringValue(selectedProfile.response_mapping?.text_path)}</p>
                      <p><span className="fg-detail-key">error</span> path={toStringValue(selectedProfile.error_mapping?.message_path)}</p>
                    </div>
                  </details>
                ) : null}
              </div>
            ) : (
              <div className="ff-harness-empty">
                <strong>No profile selected</strong>
                <p>Choose a provider preset from the left panel to inspect its configuration, run actions, and manage its lifecycle.</p>
                {data.templates.length > 0 ? (
                  <p>Or use a template to create a new profile from scratch.</p>
                ) : null}
              </div>
            )}
          </SectionCard>

          {/* Editable Draft */}
          <SectionCard
            title="Editable Draft"
            description={
              data.access.canMutate
                ? 'Edit the draft below then click "Save profile". Using a preset or template fills in defaults without saving.'
                : "Viewing the current draft — editing requires write access."
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
                  <span className="fg-row">
                    <input
                      type="checkbox"
                      checked={data.newHarness.stream_enabled}
                      onChange={(event) => actions.setNewHarness((current) => ({ ...current, stream_enabled: event.target.checked }))}
                      className="fg-control-auto"
                    />
                    <span>{data.newHarness.stream_enabled ? "Streaming enabled" : "Streaming disabled"}</span>
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

        {/* ── Right Column: Actions ── */}
        <div className="fg-stack">
          <SectionCard
            title="Actions"
            description="Preview is read-safe. Verify, dry-run, and probe require operator access."
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
                    <input value={actionMessage} onChange={(event) => setActionMessage(event.target.value)} placeholder="Test message" />
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

                <div className="ff-action-controls">
                  <span className="fg-detail-label">Test</span>
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
                  ) : (
                    <span className="fg-muted">verify, dry-run, probe require operator access</span>
                  )}
                </div>

                <div className="ff-action-controls">
                  <span className="fg-detail-label">Manage</span>
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
                  ) : (
                    <span className="fg-muted">activation, rollback require providers.write</span>
                  )}
                </div>

                <div className="ff-action-controls">
                  <span className="fg-detail-label">Profile</span>
                  {data.access.canMutate ? (
                    <button type="button" onClick={() => actions.setNewHarness(buildDraftFromProfile(selectedProfile))}>
                      Use this preset
                    </button>
                  ) : null}
                  {data.access.canExportRedacted ? (
                    <button type="button" onClick={() => void actions.exportHarness(true)}>
                      Export (redacted)
                    </button>
                  ) : null}
                  {data.access.canExportFull ? (
                    <button type="button" onClick={() => void actions.exportHarness(false)}>
                      Export (full)
                    </button>
                  ) : null}
                </div>

                {data.access.canMutate ? (
                  <div className="ff-nav-links">
                    <button type="button" onClick={() => void actions.importHarness(true)}>
                      Dry-run import
                    </button>
                    <button type="button" onClick={() => void actions.importHarness(false)}>
                      Apply import
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="ff-harness-empty">
                <strong>Select a profile first</strong>
                <p>Choose a profile from the presets panel to run harness actions, view results, and manage lifecycle.</p>
              </div>
            )}
          </SectionCard>

          {/* Last Action Result */}
          <SectionCard title="Last Result" description="Outcome of the most recent harness action.">
            {data.lastHarnessAction ? (
              <div className="fg-stack">
                <div className="ff-harness-detail-row">
                  <strong>{data.lastHarnessAction.title}</strong>
                  <TonePill label={data.lastHarnessAction.status} tone={toneFromStatus(data.lastHarnessAction.status)} />
                </div>
                <p className="fg-muted" style={{ fontSize: "var(--fg-type-size-meta)", margin: 0 }}>
                  {data.lastHarnessAction.summary}
                </p>
                <div className="ff-harness-detail-row">
                  <span>provider={toStringValue(data.lastHarnessAction.providerKey)}</span>
                  <span>model={toStringValue(data.lastHarnessAction.model)}</span>
                  {data.lastHarnessAction.run?.status ? <span>status={data.lastHarnessAction.run.status}</span> : null}
                </div>
                {data.lastHarnessAction.error ? <p className="fg-note">Error: {data.lastHarnessAction.error}</p> : null}
                <div className="ff-nav-links">
                  <Link className="fg-nav-link" to={logSurfaceLink}>
                    View logs
                  </Link>
                  <a className="fg-nav-link" href="#harness-advanced-diagnostics">
                    Diagnostics
                  </a>
                </div>
              </div>
            ) : (
              <p className="fg-muted">No action has been run from this session yet.</p>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ─── Run History (Collapsible) ─── */}
      <details className="ff-collapse-section" open={selectedProfileRuns.length > 0 && showRunDetails}>
        <summary onClick={() => setShowRunDetails(!showRunDetails)}>
          <div className="ff-collapse-summary-text">
            <h3>Run History</h3>
            <p>
              {selectedProfileRuns.length} run{selectedProfileRuns.length !== 1 ? "s" : ""}
              {selectedProfile ? ` for ${selectedProfile.label}` : ""}
              {" · "}Filter by mode, status, or client below.
            </p>
          </div>
        </summary>
        <div className="ff-collapse-section-body">
          <div className="fg-stack">
            {/* Filters */}
            <div className="fg-grid fg-grid-compact">
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
                Last failed: {formatTimestamp(lastFailedRun.executed_at)} · {toStringValue(lastFailedRun.provider_key)} · {toStringValue(lastFailedRun.mode)} · status={toStringValue(lastFailedRun.status)}
              </p>
            ) : null}

            {selectedProfileRuns.length === 0 ? (
              <p className="fg-muted">No runs matched the current profile and filters.</p>
            ) : (
              <div className="fg-stack">
                {Object.entries(groupedRuns).map(([mode, runs]) => (
                  <div key={mode} className="ff-harness-run-group">
                    <div className="ff-harness-run-group-header">
                      <span>{formatHarnessMode(mode)}</span>
                      <span>{runs.length} run{runs.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="ff-harness-run-group-body">
                      {runs.slice(0, 3).map((run, index) => (
                        <div key={`${toStringValue(run.run_id, "run")}-${index}`} className="ff-harness-run-item">
                          <div className="ff-harness-detail-row">
                            <TonePill label={run.status} tone={toneFromStatus(run.status)} />
                            <span>{formatTimestamp(run.executed_at)}</span>
                            <span>model={toStringValue(run.model)}</span>
                          </div>
                          <div className="ff-nav-links" style={{ border: 0, padding: 0 }}>
                            <Link className="fg-nav-link" to={logSurfaceLink}>
                              View logs
                            </Link>
                            {run.run_id ? <span className="fg-muted">id: {run.run_id.slice(0, 12)}...</span> : null}
                          </div>
                          {run.error ? <span className="fg-note">Error: {run.error}</span> : null}
                        </div>
                      ))}
                      {runs.length > 3 ? (
                        <details className="ff-harness-run-item">
                          <summary style={{ cursor: "pointer", fontSize: "var(--fg-type-size-meta)", color: "var(--fg-color-text-secondary)" }}>
                            Show {runs.length - 3} more
                          </summary>
                          <div className="fg-stack fg-mt-sm">
                            {runs.slice(3).map((run, index) => (
                              <div key={`${toStringValue(run.run_id, "run")}-${index + 3}`} className="ff-harness-run-item" style={{ border: 0, paddingLeft: 0 }}>
                                <div className="ff-harness-detail-row">
                                  <TonePill label={run.status} tone={toneFromStatus(run.status)} />
                                  <span>{formatTimestamp(run.executed_at)}</span>
                                  <span>model={toStringValue(run.model)}</span>
                                </div>
                                <div className="ff-nav-links" style={{ border: 0, padding: 0 }}>
                                  <Link className="fg-nav-link" to={logSurfaceLink}>
                                    View logs
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </details>

      {/* ─── Diagnostics (Collapsible) ─── */}
      <details className="ff-collapse-section" id="harness-advanced-diagnostics">
        <summary>
          <div className="ff-collapse-summary-text">
            <h3>Advanced Diagnostics</h3>
            <p>
              Raw snapshots, import/export payloads, and proof carriers.
              {proofProviders.length > 0 ? ` ${proofProviders.length} proof carrier${proofProviders.length > 1 ? "s" : ""}.` : ""}
            </p>
          </div>
        </summary>
        <div className="ff-collapse-section-body">
          <div className="fg-stack fg-mt-sm">
            <div className="fg-subcard">
              <h4>Diagnostics buffer</h4>
              <p className="fg-muted">Export writes the current snapshot here. Import dry-run and apply read from the same buffer.</p>
              <textarea
                value={data.importPayload}
                onChange={(event) => actions.setImportPayload(event.target.value)}
                rows={10}
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
        </div>
      </details>
    </>
  );
}
