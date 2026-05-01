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
 * Harness workspace section for operating generic integration profiles:
 * selecting templates and saved profiles, inspecting the live config contract,
 * running preview/verify/dry-run/probe actions, and managing imports/exports/rollback.
 */
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
        description="Select templates and saved profiles, inspect config contracts, run harness actions, and manage imports, exports, and rollback."
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
            description="Operator queue: select a saved profile or load a template into the editable draft."
          >
            <div className="fg-stack">
              <div className="fg-subcard">
                <div className="fg-panel-heading">
                  <div>
                    <h4>Saved profiles</h4>
                    <p className="fg-muted">Status, proof, and last-run history visible at a glance.</p>
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
                    <p className="fg-muted">Load a template into the editable draft to populate provider defaults.</p>
                  </div>
                </div>
                <div className="fg-template-grid">
                  {data.templates.map((template) => (
                    <div key={template.id} className="fg-subcard fg-template-card">
                      <div className="fg-template-card-header">
                        <strong className="fg-section-link-label">{template.label}</strong>
                        <span className="fg-template-id">{template.id}</span>
                      </div>
                      <div className="fg-template-meta">
                        <span className="fg-muted">class={template.integration_class}</span>
                        {template.profile_defaults?.models?.length ? (
                          <span className="fg-muted">models={template.profile_defaults.models.join(", ")}</span>
                        ) : null}
                      </div>
                      {template.description ? (
                        <p className="fg-muted fg-template-desc">{template.description}</p>
                      ) : null}
                      {data.access.canMutate ? (
                        <div className="fg-template-action">
                          <button
                            type="button"
                            onClick={() => actions.setNewHarness((current) => buildDraftFromTemplate(template, current))}
                          >
                            Load into draft
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="fg-stack">
          <SectionCard
            title="Selected Profile"
            description="Status, version, scope, last run, and the persisted config contract for the selected profile."
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

                  <div className="fg-detail-grid fg-detail-grid-compact">
                    <span className="fg-detail-label">Status &amp; Identity</span>
                    <div className="fg-detail-rows">
                      <p><span className="fg-detail-key">status</span> {selectedProfile.lifecycle_status ?? "draft"}</p>
                      <p><span className="fg-detail-key">version</span> v{formatMetric(selectedProfile.config_revision ?? 1)}</p>
                      <p><span className="fg-detail-key">scope</span> {formatHarnessScope(selectedProfile)}</p>
                      <p><span className="fg-detail-key">provider</span> {selectedProfile.provider_key} · {selectedProfile.integration_class}</p>
                      <p><span className="fg-detail-key">template</span> {toStringValue(selectedProfile.template_id, "custom contract")}</p>
                    </div>
                  </div>
                  <div className="fg-detail-grid fg-detail-grid-compact">
                    <span className="fg-detail-label">Last Activity</span>
                    <div className="fg-detail-rows">
                      <p>
                        <span className="fg-detail-key">last run</span>
                        {selectedProfileLastRun
                          ? `${formatTimestamp(selectedProfileLastRun.executed_at)} · ${formatHarnessMode(selectedProfileLastRun.mode)} · ${selectedProfileLastRun.status}`
                          : "not recorded"}
                      </p>
                      <p><span className="fg-detail-key">last error</span> {toStringValue(selectedProfile.last_error, "none recorded")}</p>
                      <p>
                        <span className="fg-detail-key">proof</span> {selectedProfileProof?.status ?? "none"}
                        <span className="fg-muted"> · {selectedProfileProof?.note ?? "No proof note available."}</span>
                      </p>
                      <p>
                        <span className="fg-detail-key">verify</span> {toStringValue(selectedProfile.last_verify_status, "never")} ·
                        <span className="fg-detail-key">probe</span> {toStringValue(selectedProfile.last_probe_status, "never")} ·
                        <span className="fg-detail-key">sync</span> {toStringValue(selectedProfile.last_sync_status, "never")}
                      </p>
                      <p>
                        <span className="fg-detail-key">last used</span> {formatTimestamp(selectedProfile.last_used_at)}
                        <span className="fg-muted"> · model={toStringValue(selectedProfile.last_used_model, "-")}</span>
                        <span className="fg-muted"> · requests={formatMetric(selectedProfile.request_count)}</span>
                        <span className="fg-muted"> · stream={formatMetric(selectedProfile.stream_request_count)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="fg-subcard">
                  <h4>Config contract</h4>
                  <div className="fg-detail-grid fg-detail-grid-compact fg-mb-sm">
                    <span className="fg-detail-label">Connection</span>
                    <div className="fg-detail-rows">
                      <p><span className="fg-detail-key">endpoint</span> {selectedProfile.endpoint_base_url}</p>
                      <p><span className="fg-detail-key">auth</span> {selectedProfile.auth_scheme} · header={selectedProfile.auth_header}</p>
                      <p><span className="fg-detail-key">discovery</span> {selectedProfile.discovery_enabled ? "enabled" : "disabled"}</p>
                    </div>
                  </div>
                  <div className="fg-detail-grid fg-detail-grid-compact fg-mb-sm">
                    <span className="fg-detail-label">Capabilities</span>
                    <div className="fg-detail-rows">
                      <p><span className="fg-detail-key">models</span> {joinList(selectedProfile.models)}</p>
                      <p><span className="fg-detail-key">streaming</span> {selectedProfile.stream_mapping?.enabled ? "enabled" : "disabled"} · <span className="fg-detail-key">tool calling</span> {selectedProfile.capabilities?.tool_calling ? "enabled" : "disabled"}</p>
                      <p><span className="fg-detail-key">responses</span> {selectedProfile.capabilities?.responses ? "enabled" : "disabled"} · <span className="fg-detail-key">embeddings</span> {selectedProfile.capabilities?.embeddings ? "enabled" : "disabled"}</p>
                    </div>
                  </div>
                  <div className="fg-detail-grid fg-detail-grid-compact fg-mb-sm">
                    <span className="fg-detail-label">Mapping</span>
                    <div className="fg-detail-rows">
                      <p><span className="fg-detail-key">request path</span> {toStringValue(selectedProfile.request_mapping?.path)} · <span className="fg-detail-key">method</span> {toStringValue(selectedProfile.request_mapping?.method, "POST")}</p>
                      <p><span className="fg-detail-key">response text path</span> {toStringValue(selectedProfile.response_mapping?.text_path)} · <span className="fg-detail-key">error path</span> {toStringValue(selectedProfile.error_mapping?.message_path)}</p>
                    </div>
                  </div>
                  {selectedProfile.capabilities?.unsupported_features?.length ? (
                    <p className="fg-note">Unsupported features: {selectedProfile.capabilities.unsupported_features.join(", ")}</p>
                  ) : null}
                </div>

                {selectedProfile.model_inventory?.length ? (
                  <div className="fg-subcard">
                    <h4>Model inventory</h4>
                    <div className="fg-stack">
                      {selectedProfile.model_inventory.map((item, index) => (
                        <div key={`${toStringValue(item.model, "model")}-${index}`} className="fg-detail-rows fg-model-inv-row">
                          <strong>{item.model}</strong>
                          <span className="fg-muted">source={item.source} · status={item.status}</span>
                          <span className="fg-muted">synced={formatTimestamp(item.synced_at)} · reason={toStringValue(item.readiness_reason, "-")}</span>
                        </div>
                      ))}
                    </div>
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
            description="Test harness APIs against the selected profile. Preview is read-safe; verify, dry-run, and probe require operator access."
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

                <div className="fg-action-group">
                  <span className="fg-detail-label">Test Actions</span>
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
                    ) : (
                      <span className="fg-muted">verify, dry-run, and probe require operator access</span>
                    )}
                  </div>
                </div>

                <div className="fg-action-group">
                  <span className="fg-detail-label">Management</span>
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
                    ) : (
                      <span className="fg-muted">activation, rollback, and import require providers.write</span>
                    )}
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
                </div>
              </div>
            ) : (
              <p className="fg-muted">Select a profile before running harness actions.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Last Action Result"
            description="Summary of the most recent harness action with operator-facing status."
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
            description="Recent runs by time, mode, status, and error with log handoff links."
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
          description="Raw snapshots, import/export payloads, and proof carriers."
          status={`${proofProviders.length} proof carrier${proofProviders.length === 1 ? "" : "s"}`}
          statusTone={proofProviders.length > 0 ? "success" : "neutral"}
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
