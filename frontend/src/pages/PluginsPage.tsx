/**
 * Plugins page — extension registry with catalog, manifest editing,
 * and per-instance activation.
 *
 * Uses the RegistryManagementPage template for consistent page structure
 * and delegates to the plugins feature module for all components and logic.
 *
 * @packageDocumentation
 */

import { useState } from "react";

import { RegistryManagementPage } from "../components/page-templates";
import { LoadingState, ErrorState } from "../components/ui/StateBlocks";
import { Button } from "../components/ui/Button";
import {
  usePlugins,
  PluginList,
  PluginCreateForm,
  PluginEditForm,
  PluginBindForm,
  PluginDetailPanel,
  PANEL_OPTIONS,
  formatJson,
} from "../features/plugins";

/**
 * Plugins page component — catalog, manifest editing, and instance activation.
 */
export function PluginsPage() {
  const {
    sessionReady,
    canRead,
    canMutate,
    instanceId,
    selectedPluginId,
    instancesState,
    pluginsState,
    detailState,
    instances,
    plugins,
    detail,
    selectedInstance,
    selectedPlugin,
    summaryItems,
    error,
    message,
    activePanel,
    setActivePanel,
    createForm,
    setCreateForm,
    savingCreate,
    createSecurity,
    createConfigSchemaError,
    createDefaultConfigError,
    createSecurityPostureError,
    createMetadataError,
    createSchemaFields,
    createDefaultConfigEntries,
    createUnsupportedConfigKeys,
    createMissingRequiredDefaultConfigKeys,
    createFormHasJsonErrors,
    editForm,
    setEditForm,
    savingManifest,
    manifestSecurityPosture,
    editConfigSchemaError,
    editDefaultConfigError,
    editSecurityPostureError,
    editMetadataError,
    editSchemaFields,
    editDefaultConfigEntries,
    editUnsupportedConfigKeys,
    editMissingRequiredDefaultConfigKeys,
    editFormHasJsonErrors,
    bindingForm,
    setBindingForm,
    savingBinding,
    bindingSchemaJson,
    bindingConfigError,
    bindingConfigEntries,
    bindingUnsupportedConfigKeys,
    bindingMissingRequiredKeys,
    handleCreate,
    handleUpdateManifest,
    handleSaveBinding,
    updateRoute,
    handleRefresh,
  } = usePlugins();

  // ── Session guard ──
  if (!sessionReady) {
    return (
      <RegistryManagementPage
        title="Plugins"
        description="Extension registry and instance activation"
      >
        <LoadingState title="Loading plugin control plane" description="Restoring instance scope, plugin catalog, manifest truth, and activation posture." />
      </RegistryManagementPage>
    );
  }

  if (!canRead) {
    return (
      <RegistryManagementPage
        eyebrow="Extensions"
        title="Plugins"
        description="This route stays closed until the session can inspect real instance-scoped plugin registry truth."
      >
        <div className="ff-state-block" data-state="permission">
          <strong className="text-body text-primary font-semibold">Plugin registry unavailable</strong>
          <p className="text-meta text-muted mt-1">Instance read permission is required before ForgeFrame will expose extension registry, manifest, or binding controls.</p>
        </div>
      </RegistryManagementPage>
    );
  }

  // ── Scope indicator and selector ──
  const [showScopeSelector, setShowScopeSelector] = useState(false);

  const scopeConfig = instanceId && selectedInstance
    ? {
        label: selectedInstance.display_name,
        onChange: () => setShowScopeSelector(true),
      }
    : undefined;

  // ── Loading / Error states for the main content ──
  const showLoading = instancesState === "loading" && instances.length === 0 && pluginsState === "loading" && plugins.length === 0;
  const showError = instancesState === "error" || pluginsState === "error";

  // ── Scope selector dialog ──
  const scopeSelectorContent = showScopeSelector ? (
    <div className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>Active instance scope</h3>
          <p className="fg-muted">Instance activation is separate from registry truth. Choose the scope first, then decide whether to review catalog, manifest, or binding.</p>
        </div>
      </div>
      <div className="fg-inline-form">
        <label>
          Plugin instance
          <select
            aria-label="Plugin instance"
            value={instanceId}
            onChange={(event) => {
              updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("pluginId");
              });
              setShowScopeSelector(false);
            }}
          >
            {instances.map((inst) => (
              <option key={inst.instance_id} value={inst.instance_id}>
                {inst.display_name} ({inst.instance_id})
              </option>
            ))}
          </select>
        </label>
        <Button variant="tertiary" onPress={() => setShowScopeSelector(false)}>
          Close
        </Button>
      </div>
    </div>
  ) : null;

  // ── Panel tab buttons ──
  const panelTabs = (
    <div className="fg-actions">
      {PANEL_OPTIONS.map((panel) => (
        <Button
          key={panel.key}
          variant={activePanel === panel.key ? "primary" : "secondary"}
          onPress={() => setActivePanel(panel.key)}
        >
          {panel.label}
        </Button>
      ))}
    </div>
  );

  // ── Main content ──
  const mainContent = (
    <>
      {showScopeSelector ? scopeSelectorContent : null}

      {message ? <p>{message}</p> : null}
      {error && !showError ? <p className="fg-danger">{error}</p> : null}

      {showLoading ? (
        <LoadingState title="Loading instance scope" description="Restoring the instance list before plugin activation or binding changes can be trusted." />
      ) : null}

      {showError ? (
        <ErrorState
          title="Plugin control plane failed to load"
          description={error || "Plugin registry or instance scope could not be restored."}
          action={<Button variant="secondary" onPress={handleRefresh}>Retry</Button>}
        />
      ) : null}

      {!showLoading && !showError ? (
        <>
          {panelTabs}

          <div className="ff-operator-layout">
            <div className="ff-operator-main">
              {activePanel === "catalog" ? (
                <PluginList
                  plugins={plugins}
                  selectedPluginId={selectedPluginId}
                  onSelectPlugin={(pluginId) => updateRoute((next) => next.set("pluginId", pluginId))}
                  loading={pluginsState === "loading"}
                  error={pluginsState !== "success" && pluginsState !== "loading" ? (error || "Plugin registry could not be loaded.") : null}
                  onRetry={handleRefresh}
                />
              ) : null}

              {activePanel === "manifest" ? (
                <div className="fg-stack">
                  <PluginCreateForm
                    form={createForm}
                    onChange={setCreateForm}
                    canMutate={canMutate}
                    saving={savingCreate}
                    onSubmit={handleCreate}
                    securityPosture={createSecurity}
                    createConfigSchemaError={createConfigSchemaError}
                    createDefaultConfigError={createDefaultConfigError}
                    createSecurityPostureError={createSecurityPostureError}
                    createMetadataError={createMetadataError}
                    schemaFields={createSchemaFields}
                    configEntries={createDefaultConfigEntries}
                    unsupportedConfigKeys={createUnsupportedConfigKeys}
                    missingRequiredKeys={createMissingRequiredDefaultConfigKeys}
                    hasJsonErrors={createFormHasJsonErrors}
                  />
                  <PluginEditForm
                    detail={detail}
                    form={editForm}
                    onChange={setEditForm}
                    canMutate={canMutate}
                    saving={savingManifest}
                    onSubmit={handleUpdateManifest}
                    securityPosture={manifestSecurityPosture}
                    editConfigSchemaError={editConfigSchemaError}
                    editDefaultConfigError={editDefaultConfigError}
                    editSecurityPostureError={editSecurityPostureError}
                    editMetadataError={editMetadataError}
                    schemaFields={editSchemaFields}
                    configEntries={editDefaultConfigEntries}
                    unsupportedConfigKeys={editUnsupportedConfigKeys}
                    missingRequiredKeys={editMissingRequiredDefaultConfigKeys}
                    hasJsonErrors={editFormHasJsonErrors}
                  />
                </div>
              ) : null}

              {activePanel === "binding" ? (
                <PluginBindForm
                  detail={detail}
                  instanceId={instanceId}
                  selectedInstance={selectedInstance}
                  form={bindingForm}
                  onChange={setBindingForm}
                  canMutate={canMutate}
                  saving={savingBinding}
                  onSubmit={handleSaveBinding}
                  configEntries={bindingConfigEntries}
                  configError={bindingConfigError}
                  unsupportedConfigKeys={bindingUnsupportedConfigKeys}
                  missingRequiredKeys={bindingMissingRequiredKeys}
                  hasJsonErrors={Boolean(bindingConfigError)}
                />
              ) : null}
            </div>

            <div className="ff-operator-sidebar">
              <PluginDetailPanel selectedPlugin={selectedPlugin} />
            </div>
          </div>
        </>
      ) : null}
    </>
  );

  // ── Diagnostics content ──
  const diagnosticsContent = selectedPlugin ? (
    <pre>{formatJson(selectedPlugin)}</pre>
  ) : null;

  return (
    <RegistryManagementPage
      eyebrow="Extensions"
      title="Plugins"
      description="Plugins are ForgeFrame's extension registry: catalog, manifest contract, per-instance activation, config contract, extension slots, audit posture, and security review."
      scope={scopeConfig}
      summaryItems={summaryItems}
      actions={[
        { label: "Refresh", kind: "secondary", intent: "run", onClick: handleRefresh, disabled: !instanceId },
      ]}
      diagnostics={diagnosticsContent}
      diagnosticsTitle="Selected plugin raw truth"
    >
      {mainContent}
    </RegistryManagementPage>
  );
}
