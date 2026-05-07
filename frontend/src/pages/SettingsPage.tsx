import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { PageIntro } from "../components/PageIntro";
import {
  ConfirmHighRiskDialog,
  SettingDetail,
  SettingsList,
  useSettings,
} from "../features/settings";

/**
 * System Settings page — review and manage environment-level configuration defaults.
 *
 * Provides a categorized settings inventory with search, filtering, and
 * an explicit edit mode for safe mutations. High-risk settings require
 * explicit confirmation before changes are applied. Audit and technical
 * metadata are hidden behind collapsible sections.
 */
export function SettingsPage() {
  const {
    session,
    sessionReady,
    canMutate,
    canManageSecurity,
    canOpenSecurity,
    accessLabel,
    accessTone,

    settings,
    loadState,
    error,
    operationMessage,

    searchText,
    setSearchText,
    categoryFilter,
    setCategoryFilter,
    showHighRisk,
    setShowHighRisk,

    groupedSettings,

    selectedKey,
    setSelectedKey,
    selectedSetting,

    drafts,
    setDraftValue,

    editMode,
    toggleEditMode,

    savingKey,
    resettingKey,

    confirmDialog,
    cancelConfirm,
    executeConfirmed,

    handleSave,
    handleReset,
  } = useSettings();

  const hiddenHighRiskCount = settings.filter(
    (item) => item.risk_level === "high" && !showHighRisk,
  ).length;

  const overriddenCount = settings.filter(
    (item) => item.source === "override" && item.overridden,
  ).length;

  const highRiskCount = settings.filter(
    (item) => item.risk_level === "high",
  ).length;

  const readOnlyDescription = !sessionReady
    ? "Checking session role before exposing configuration controls."
    : session?.role === "admin" && session?.read_only === true
      ? "Read-only session: review values, defaults, and source but cannot save overrides."
      : "Non-admin session: review-only. Admin access required to save overrides.";

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Settings"
        title="System Settings"
        description="Review and manage environment-level configuration defaults."
        question={canMutate
          ? "Review defaults before making changes. High-risk settings require confirmation."
          : "Review-only. Edit controls available to admin sessions."}
        links={[
          {
            label: "System Settings",
            to: CONTROL_PLANE_ROUTES.settings,
            description: "Grouped values, defaults, source, and override posture.",
            badge: canMutate ? undefined : "Read only",
          },
          {
            label: "Usage & Costs",
            to: CONTROL_PLANE_ROUTES.usage,
            description: "Cross-check changes with traffic, spend, or alerts.",
          },
          {
            label: "Accounts",
            to: CONTROL_PLANE_ROUTES.accounts,
            description: "Return to runtime access review when the work is identity-oriented instead of environment-oriented.",
          },
          canOpenSecurity
            ? {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: canManageSecurity
                  ? "Open policy and elevated-access posture when the change touches security controls."
                  : "Open the security review surface when the change requires operator follow-up.",
                badge: canManageSecurity ? "Admin posture" : "Review only",
              }
            : {
                label: "Security & Policies",
                to: CONTROL_PLANE_ROUTES.security,
                description: "Reserved for operators and admins who can request elevated access or inspect security posture.",
                badge: "Operator or admin",
                disabled: true,
              },
        ]}
        note="Settings stay organized by operational area. Each setting shows its current value, override status, and risk level at a glance. Audit history and technical metadata are available but collapsed by default."
      />

      {/* ── Inline status summary ── */}
      <p className="fg-muted" style={{ marginBottom: "0.75rem" }}>
        {settings.length} mutable setting{settings.length === 1 ? "" : "s"}
        {canMutate ? " · Admin mutation enabled" : " · Read only"}
      </p>

      {error ? <p className="fg-danger">{error}</p> : null}
      {operationMessage ? <p className="fg-muted">{operationMessage}</p> : null}

      {!canMutate ? (
        <div className="ff-settings-readonly-banner">
          <h4>Read-Only Review</h4>
          <p className="fg-muted">{readOnlyDescription}</p>
        </div>
      ) : null}

      <div className="ff-settings-layout">
        <SettingsList
          searchText={searchText}
          onSearchChange={setSearchText}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          showHighRisk={showHighRisk}
          onHighRiskToggle={setShowHighRisk}
          loadState={loadState}
          totalCount={settings.length}
          overriddenCount={overriddenCount}
          highRiskCount={highRiskCount}
          groupedSettings={groupedSettings}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          hiddenHighRiskCount={hiddenHighRiskCount}
        />

        <SettingDetail
          setting={selectedSetting}
          drafts={drafts}
          onDraftChange={setDraftValue}
          editMode={editMode}
          onToggleEditMode={toggleEditMode}
          canMutate={canMutate}
          saving={savingKey === selectedKey}
          resetting={resettingKey === selectedKey}
          onSave={handleSave}
          onReset={handleReset}
        />
      </div>

      <ConfirmHighRiskDialog
        visible={confirmDialog.visible}
        item={confirmDialog.item}
        action={confirmDialog.action}
        draftValue={confirmDialog.draftValue}
        onConfirm={executeConfirmed}
        onCancel={cancelConfirm}
      />
    </section>
  );
}
