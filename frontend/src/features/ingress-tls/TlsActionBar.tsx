import { Link } from "react-router-dom";

import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import type { TlsSummary } from "./types";

/**
 * Task-specific action buttons for the TLS surface.
 * The primary action is visually dominant; secondary actions remain accessible.
 * For local-only posture, setup actions are shown instead of blocker remediation.
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

  const isLocalOnly = summary.posture === "local_only";
  const primaryBlocker = summary.primaryBlocker;

  // Determine the primary (recommended fix) action
  const primaryAction = buildPrimaryAction(primaryBlocker, isLocalOnly, settingsLink, onboardingLink, healthLink);
  // Secondary setup actions shown for local-only posture
  const localOnlyActions = isLocalOnly
    ? [
        { label: "Configure TLS mode", to: settingsLink },
        { label: "Set public FQDN", to: settingsLink },
        { label: "Issue or import certificate", to: healthLink },
      ]
    : [];

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
            <span className={isLocalOnly ? "ff-itt-primary-action-label ff-itt-primary-action-label--setup" : "ff-itt-primary-action-label"}>
              {isLocalOnly ? "Setup" : "Recommended fix"}
            </span>
            <Link className="ff-itt-primary-action-link" to={primaryAction.to}>
              {primaryAction.label}
            </Link>
          </div>
        ) : null}

        {localOnlyActions.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-1">
            {localOnlyActions.map((action) => (
              <Link
                key={action.label}
                className="ff-itt-action-link"
                to={action.to}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Build the primary action based on blocker or posture.
 */
function buildPrimaryAction(
  primaryBlocker: string | null,
  isLocalOnly: boolean,
  settingsLink: string,
  onboardingLink: string,
  healthLink: string,
): { label: string; to: string } | null {
  if (isLocalOnly) {
    return { label: "Configure public HTTPS", to: settingsLink };
  }

  if (!primaryBlocker) {
    return null;
  }

  switch (primaryBlocker) {
    case "public_fqdn_missing":
      return { label: "Set public FQDN", to: settingsLink };
    case "public_fqdn_dns_unresolved":
      return { label: "Verify DNS records", to: healthLink };
    case "public_https_listener_not_normative":
      return { label: "Bind HTTPS listener", to: onboardingLink };
    case "port80_helper_not_normative":
      return { label: "Expose port 80 helper", to: onboardingLink };
    case "tls_mode_disabled":
    case "tls_mode_not_integrated_acme":
      return { label: "Configure TLS mode", to: settingsLink };
    case "public_tls_acme_email_missing":
      return { label: "Set ACME email", to: settingsLink };
    case "integrated_tls_automation_missing":
      return { label: "Restore renewal artifacts", to: onboardingLink };
    case "certificate_material_missing":
      return { label: "Issue or import certificate", to: healthLink };
    case "root_ui_not_served_on_slash":
    case "root_surface_not_spa":
    case "runtime_api_base_not_normative":
    case "admin_api_base_not_normative":
      return { label: "Restore same-origin contract", to: settingsLink };
    default:
      return null;
  }
}
