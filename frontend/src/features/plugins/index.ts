/**
 * Plugins feature module — redesigned plugin lifecycle management.
 *
 * Provides a DataTable-based plugin inventory, guided creation and editing forms,
 * instance binding form, security posture editor, and a detail panel.
 *
 * @packageDocumentation
 */

export { PluginList } from "./components/PluginList";
export type { PluginListProps } from "./components/PluginList";

export { PluginDetailPanel } from "./components/PluginDetailPanel";
export type { PluginDetailPanelProps } from "./components/PluginDetailPanel";

export { PluginCreateForm } from "./components/PluginCreateForm";
export type { PluginCreateFormProps } from "./components/PluginCreateForm";

export { PluginEditForm } from "./components/PluginEditForm";
export type { PluginEditFormProps } from "./components/PluginEditForm";

export { PluginBindForm } from "./components/PluginBindForm";
export type { PluginBindFormProps } from "./components/PluginBindForm";

export { PluginSecurityPosture } from "./components/PluginSecurityPosture";
export type { PluginSecurityPostureProps } from "./components/PluginSecurityPosture";

export { usePlugins } from "./usePlugins";
export type { UsePluginsReturn } from "./usePlugins";

export type {
  PluginPanel,
  SchemaFieldDraft,
  ConfigEntryDraft,
  CreatePluginForm,
  EditPluginForm,
  BindingPluginForm,
  PluginSummaryStats,
} from "./types";

export {
  PANEL_OPTIONS,
  SECURITY_ROLE_OPTIONS,
  CONFIG_SCHEMA_TYPES,
  STATUS_OPTIONS,
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  DEFAULT_BINDING_FORM,
  DEFAULT_SECURITY_POSTURE_VALUE,
  DEFAULT_SECURITY_POSTURE,
  DEFAULT_CONFIG_SCHEMA,
} from "./types";

export {
  formatJson,
  listToCsv,
  csvToList,
  parseSecurityPosture,
  jsonObjectError,
  safeParseSecurityPosture,
  safeParseObject,
  asStringArray,
  schemaFieldsFromRaw,
  schemaRawFromFields,
  configEntriesFromRaw,
  unsupportedConfigKeysFromRaw,
  updateConfigRaw,
  updateSecurityPostureRaw,
  securityWarnings,
  securityTone,
  securityLabel,
  pluginStatusKey,
  missingRequiredConfigKeys,
} from "./helpers";
