/**
 * Collapsible advanced diagnostics section.
 * Shows a compact summary when collapsed, and full diagnostic cards when expanded.
 * Does not repeat the operator agent card if it is already shown as a blocker.
 *
 * @packageDocumentation
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import type { InstanceRecord } from "../../api/domain/instances";
import { buildAgentsPath } from "../../app/workInteractionRoutes";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { withInstanceScope } from "../../app/tenantScope";
import {
  toneForSetupStatus,
  formatTimestamp,
  preferredTargetsLabel,
} from "./utils";
import type { BlockerItem } from "./types";

/**
 * Props for the InstanceAdvancedDiagnostics component.
 */
export type InstanceAdvancedDiagnosticsProps = {
  /** The selected instance record. */
  instance: InstanceRecord;
  /** Current list of blocker checks (used to avoid duplicating operator agent card). */
  blockerChecks: BlockerItem[];
  /** Whether the user can open provider targets. */
  canOpenTargets: boolean;
  /** Whether the user can open routing. */
  canOpenRouting: boolean;
  /** Whether the user can open conversations. */
  canOpenConversations: boolean;
};

/**
 * Collapsible advanced diagnostics section.
 * When collapsed, shows a one-line compact summary.
 * When expanded, shows technical detail cards for subsystems
 * that are not already shown as blockers, plus technical metadata.
 */
export function InstanceAdvancedDiagnostics({
  instance,
  blockerChecks,
  canOpenTargets,
  canOpenRouting,
  canOpenConversations,
}: InstanceAdvancedDiagnosticsProps) {
  const [open, setOpen] = useState(false);
  const blockerCount = blockerChecks.length;
  const passCount = instance.readiness?.ready_check_count ?? 0;
  const totalChecks = instance.readiness?.check_count ?? 0;

  // Determine which subsystems are already shown as blockers
  const blockerIds = new Set(blockerChecks.map((b) => b.id));
  const isOperatorBlocker = blockerIds.has("operator_agent") || blockerIds.has("operator") || blockerIds.has("synthetic-blocker");

  return (
    <details
      className="ff-collapse-section ff-instance-diagnostics"
      open={open}
      onToggle={(event) =>
        setOpen((event.target as HTMLDetailsElement).open)
      }
    >
      <summary>
        <div className="ff-collapse-summary-text">
          <h3>Advanced diagnostics</h3>
          <p className="fg-muted">
            {totalChecks > 0
              ? `${passCount} passing, ${blockerCount} blocker${blockerCount !== 1 ? "s" : ""}`
              : "No readiness data"}{" "}
            &middot; technical metadata available
          </p>
        </div>
      </summary>
      <div className="ff-collapse-section-body">
        <div className="fg-stack">
          {/* Operator Agent — only if NOT already a blocker */}
          {!isOperatorBlocker ? (
            <section className="fg-subcard">
              <div className="fg-panel-heading">
                <div>
                  <h4>Operator Agent</h4>
                </div>
                <span
                  className="fg-pill"
                  data-tone={toneForSetupStatus(
                    instance.operator_agent?.status,
                  )}
                >
                  {instance.operator_agent?.status ?? "unknown"}
                </span>
              </div>
              <div className="fg-detail-grid">
                <p>
                  operator:{" "}
                  {instance.operator_agent?.display_name ?? "missing"}
                </p>
                <p>
                  agent status:{" "}
                  {instance.operator_agent?.agent_status ?? "n/a"}
                </p>
                <p>
                  agent id: {instance.operator_agent?.agent_id ?? "n/a"}
                </p>
                <p>
                  auto-created:{" "}
                  {String(instance.operator_agent?.auto_created ?? false)}
                </p>
                <p>
                  allowed targets:{" "}
                  {instance.operator_agent?.allowed_targets?.join(", ") ||
                    "none"}
                </p>
                <p>
                  {instance.operator_agent?.reason ??
                    "No operator summary is available."}
                </p>
              </div>
              <div className="ff-action-controls">
                <Link
                  className="fg-nav-link"
                  to={buildAgentsPath({
                    instanceId: instance.instance_id,
                  })}
                >
                  Configure operator agent
                </Link>
              </div>
            </section>
          ) : null}

          {/* Provider Targets */}
          <section className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>Provider Targets</h4>
              </div>
              <span
                className="fg-pill"
                data-tone={toneForSetupStatus(
                  instance.provider_targets?.status,
                )}
              >
                {instance.provider_targets?.status ?? "unknown"}
              </span>
            </div>
            <div className="fg-detail-grid">
              <p>
                configured providers:{" "}
                {String(
                  instance.provider_targets?.configured_provider_count ?? 0,
                )}
              </p>
              <p>
                targets:{" "}
                {String(instance.provider_targets?.enabled_targets ?? 0)}{" "}
                enabled /{" "}
                {String(instance.provider_targets?.ready_targets ?? 0)} ready
              </p>
              <p>
                reason:{" "}
                {instance.provider_targets?.reason ??
                  "No target summary is available."}
              </p>
              <p>
                last target activity:{" "}
                {formatTimestamp(
                  instance.provider_targets?.last_activity_at,
                )}
              </p>
              <p>
                primary targets:{" "}
                {instance.provider_targets?.primary_targets?.length
                  ? instance.provider_targets.primary_targets
                      .map(
                        (target) =>
                          `${target.label ?? target.target_key} (${target.readiness_status ?? "unknown"})`,
                      )
                      .join(", ")
                  : "none"}
              </p>
            </div>
            {canOpenTargets ? (
              <div className="ff-action-controls">
                <Link
                  className="fg-nav-link"
                  to={withInstanceScope(
                    CONTROL_PLANE_ROUTES.providerTargets,
                    instance.instance_id,
                  )}
                >
                  Review provider targets
                </Link>
              </div>
            ) : null}
          </section>

          {/* Routing Policy */}
          <section className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>Routing Policy</h4>
              </div>
              <span
                className="fg-pill"
                data-tone={toneForSetupStatus(instance.routing?.status)}
              >
                {instance.routing?.status ?? "unknown"}
              </span>
            </div>
            <div className="fg-detail-grid">
              <p>policies: {String(instance.routing?.policy_count ?? 0)}</p>
              <p>
                open circuits:{" "}
                {String(instance.routing?.open_circuits ?? 0)}
              </p>
              <p>
                hard budget blocked:{" "}
                {String(instance.routing?.hard_budget_blocked ?? false)}
              </p>
              <p>
                blocked cost classes:{" "}
                {instance.routing?.blocked_cost_classes?.join(", ") ||
                  "none"}
              </p>
              <p>
                simple preferred targets:{" "}
                {preferredTargetsLabel(
                  instance.routing?.simple_preferred_target_keys,
                )}
              </p>
              <p>
                non-simple preferred targets:{" "}
                {preferredTargetsLabel(
                  instance.routing?.non_simple_preferred_target_keys,
                )}
              </p>
              <p>
                reason:{" "}
                {instance.routing?.reason ??
                  "No routing summary is available."}
              </p>
            </div>
            {canOpenRouting ? (
              <div className="ff-action-controls">
                <Link
                  className="fg-nav-link"
                  to={withInstanceScope(
                    CONTROL_PLANE_ROUTES.routing,
                    instance.instance_id,
                  )}
                >
                  Review routing policy
                </Link>
              </div>
            ) : null}
          </section>

          {/* Work Interaction */}
          <section className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>Work Interaction</h4>
              </div>
              <span
                className="fg-pill"
                data-tone={toneForSetupStatus(
                  instance.work_interaction?.status,
                )}
              >
                {instance.work_interaction?.status ?? "unknown"}
              </span>
            </div>
            <div className="fg-detail-grid">
              <p>
                mode:{" "}
                {instance.work_interaction?.mode ?? "not-configured"}
              </p>
              <p>
                inbox/tasks/notifications:{" "}
                {String(instance.work_interaction?.inbox_enabled ?? false)}{" "}
                /{" "}
                {String(instance.work_interaction?.tasks_enabled ?? false)}{" "}
                /{" "}
                {String(
                  instance.work_interaction?.notifications_enabled ?? false,
                )}
              </p>
              <p>
                conversations:{" "}
                {String(
                  instance.work_interaction?.conversation_count ?? 0,
                )}{" "}
                total /{" "}
                {String(
                  instance.work_interaction?.open_conversation_count ?? 0,
                )}{" "}
                open
              </p>
              <p>
                latest conversation:{" "}
                {instance.work_interaction
                  ?.latest_conversation_subject ??
                  instance.work_interaction?.latest_conversation_id ??
                  "none"}
              </p>
              <p>
                latest work activity:{" "}
                {formatTimestamp(
                  instance.work_interaction?.latest_activity_at,
                )}
              </p>
              <p>
                reason:{" "}
                {instance.work_interaction?.reason ??
                  "No work-interaction summary is available."}
              </p>
            </div>
            {canOpenConversations ? (
              <div className="ff-action-controls">
                <Link
                  className="fg-nav-link"
                  to={withInstanceScope(
                    CONTROL_PLANE_ROUTES.conversations,
                    instance.instance_id,
                  )}
                >
                  Configure work interaction
                </Link>
              </div>
            ) : null}
          </section>

          {/* Technical Metadata */}
          <section className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>Technical Metadata</h4>
              </div>
            </div>
            <div className="fg-detail-grid">
              <p>tenant / organization: {instance.tenant_id}</p>
              <p>execution scope: {instance.company_id}</p>
              <p>slug: {instance.slug}</p>
              <p>description: {instance.description || "none"}</p>
              <p>created: {formatTimestamp(instance.created_at)}</p>
              <p>updated: {formatTimestamp(instance.updated_at)}</p>
            </div>
          </section>
        </div>
      </div>
    </details>
  );
}
