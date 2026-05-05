import { Link } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { TlsSummary } from "./types";

/**
 * Task-specific action buttons for the TLS surface.
 * The primary blocker action is visually dominant; other navigation is secondary.
 */
export function TlsActionBar({
  instanceId,
  summary,
  renewalAllowed,
  renewing,
  onRenew,
  onRefresh,
}: {
  instanceId: string | null;
  summary: TlsSummary;
  renewalAllowed: boolean;
  renewing: boolean;
  onRenew: () => void;
  onRefresh: () => void;
}) {
  const onboardingLink = withInstanceScope(CONTROL_PLANE_ROUTES.onboarding, instanceId);
  const healthLink = withInstanceScope(CONTROL_PLANE_ROUTES.health, instanceId);
  const settingsLink = CONTROL_PLANE_ROUTES.settings;

  // Determine the primary action based on blockers
  const primaryBlocker = summary.primaryBlocker;
  let primaryAction: { label: string; to: string } | null = null;

  if (primaryBlocker) {
    switch (primaryBlocker) {
      case "public_fqdn_missing":
        primaryAction = { label: "Set public FQDN", to: settingsLink };
        break;
      case "public_fqdn_dns_unresolved":
        primaryAction = { label: "Verify DNS records", to: healthLink };
        break;
      case "public_https_listener_not_normative":
        primaryAction = { label: "Bind HTTPS listener", to: onboardingLink };
        break;
      case "port80_helper_not_normative":
        primaryAction = { label: "Expose port 80 helper", to: onboardingLink };
        break;
      case "tls_mode_disabled":
      case "tls_mode_not_integrated_acme":
        primaryAction = { label: "Configure TLS mode", to: settingsLink };
        break;
      case "public_tls_acme_email_missing":
        primaryAction = { label: "Set ACME email", to: settingsLink };
        break;
      case "integrated_tls_automation_missing":
        primaryAction = { label: "Restore renewal artifacts", to: onboardingLink };
        break;
      case "certificate_material_missing":
        primaryAction = { label: "Issue or import certificate", to: healthLink };
        break;
      case "root_ui_not_served_on_slash":
      case "root_surface_not_spa":
      case "runtime_api_base_not_normative":
      case "admin_api_base_not_normative":
        primaryAction = { label: "Restore same-origin contract", to: settingsLink };
        break;
    }
  }

  return (
    <section className="ff-action-bar">
      <div className="ff-action-bar-header">
        <div className="ff-action-bar-copy">
          <h3>Actions</h3>
        </div>
        <div className="ff-action-controls">
          <button type="button" onClick={onRefresh}>
            Refresh
          </button>
          <button
            type="button"
            onClick={onRenew}
            disabled={!renewalAllowed || renewing}
          >
            {renewing ? "Renewing certificates" : "Renew certificates"}
          </button>
        </div>
      </div>

      <div className="ff-action-bar-body">
        {primaryAction ? (
          <div className="ff-itt-primary-action">
            <span className="ff-itt-primary-action-label">Recommended fix</span>
            <Link className="ff-itt-primary-action-link" to={primaryAction.to}>
              {primaryAction.label}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
