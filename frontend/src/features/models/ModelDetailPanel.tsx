import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { AdminModelRegisterRecord } from "../../api/admin";
import { StatusBadge, type StatusTone } from "../../components/ui/StatusBadge";
import {
  buildNextStep,
  deriveNextAction,
  deriveUsabilityState,
  formatTimestamp,
  isPlaceholderModel,
  modelKey,
  nextStepTone,
  titleCase,
  toneForUsability,
} from "./utils";
import {
  NEXT_ACTION_LABELS,
  USABILITY_EXPLANATIONS,
  USABILITY_LABELS,
  type LoadState,
  type SyncState,
} from "./types";

/**
 * Props for the {@link ModelDetailPanel} component.
 */
export interface ModelDetailPanelProps {
  /** Currently selected model, or null. */
  readonly model: AdminModelRegisterRecord | null;
  /** Load state (for loading/empty states). */
  readonly state: LoadState;
  /** Sync action state. */
  readonly syncState: SyncState;
  /** Sync action result message. */
  readonly syncMessage: string;
  /** Whether the current session can mutate provider discovery. */
  readonly canMutateProviderDiscovery: boolean;
  /** Called when the user clicks the sync button. */
  readonly onSync: () => void;
  /** Instance-scoped link targets. */
  readonly providerRoute: string;
  readonly providerTargetsRoute: string;
  readonly routingRoute: string;
}

/**
 * Evidence status renderer component.
 */
interface EvidenceBadgeProps {
  label: string;
  status: string;
}

function evidenceTone(status: string): StatusTone {
  switch (status) {
    case "observed":
      return "success";
    case "failed":
      return "danger";
    case "not_applicable":
      return "neutral";
    default:
      return "warning";
  }
}

function EvidenceBadge({ label, status }: EvidenceBadgeProps) {
  return (
    <StatusBadge tone={evidenceTone(status)} status={status}>
      {label}
    </StatusBadge>
  );
}

/**
 * Detail panel for the selected model.
 *
 * Shows the current usability state, why the model is in that state,
 * what's blocking it, and what the operator should do next. Advanced
 * technical details (routing keys, sync metadata, provider identifiers)
 * are hidden behind a collapsible section.
 */
export function ModelDetailPanel({
  model,
  state,
  syncState,
  syncMessage,
  canMutateProviderDiscovery,
  onSync,
  providerRoute,
  providerTargetsRoute,
  routingRoute,
}: ModelDetailPanelProps) {
  if (state === "loading") {
    return (
      <aside className="ff-detail-panel is-sticky">
        <div className="ff-detail-panel-body" style={{ padding: "var(--fg-space-4)" }}>
          <div className="ff-state-block" data-state="loading">
            <div className="ff-skeleton-row" />
            <strong>Loading model details</strong>
          </div>
        </div>
      </aside>
    );
  }

  if (!model) {
    return (
      <aside className="ff-detail-panel is-sticky">
        <div className="ff-detail-panel-body" style={{ padding: "var(--fg-space-4)" }}>
          <div className="ff-state-block" data-state="empty">
            <strong>No model selected</strong>
            <p>Click a model row to inspect details and remediation options.</p>
          </div>
        </div>
      </aside>
    );
  }

  const usability = deriveUsabilityState(model);
  const nextAction = deriveNextAction(model);
  const nextStep = buildNextStep(model);
  const isPlaceholder = isPlaceholderModel(model);

  const isStale =
    model.routing_status === "stale" || model.health_status === "stale";
  const needsSync = model.sync.available;
  const hasAnyEvidence =
    model.evidence.runtime.status !== "missing" ||
    model.evidence.streaming.status !== "missing" ||
    model.evidence.tool_calling.status !== "missing";

  const blockingChecks: Array<{ label: string; ok: boolean; explanation: string }> = [
    {
      label: "Provider enabled",
      ok: model.provider_enabled,
      explanation: model.provider_enabled
        ? "Provider is active"
        : "Provider is disabled — enable it in the provider settings.",
    },
    {
      label: "Model active",
      ok: model.active,
      explanation: model.active
        ? "Model is marked active"
        : "Model is inactive — check provider configuration.",
    },
    {
      label: "Has targets",
      ok: model.target_count > 0,
      explanation:
        model.target_count > 0
          ? `${model.target_count} target${model.target_count !== 1 ? "s" : ""} configured`
          : "No provider targets exist for this model.",
    },
    {
      label: "Routing eligible targets",
      ok: model.routing_target_count > 0,
      explanation:
        model.routing_target_count > 0
          ? `${model.routing_target_count} target${model.routing_target_count !== 1 ? "s" : ""} can route`
          : "No targets are currently routing-eligible.",
    },
    {
      label: "Verification passed",
      ok: model.trust_status === "tested" || model.trust_status === "observed",
      explanation:
        model.trust_status === "tested"
          ? "Full verification passed"
          : model.trust_status === "observed"
            ? "Runtime evidence observed"
            : model.trust_status === "verification_failed"
              ? "Verification checks failed"
              : "No verification has been run.",
    },
  ];

  return (
    <aside className="ff-detail-panel is-sticky">
      {/* Header */}
      <div className="ff-detail-panel-header">
        <div className="ff-detail-panel-copy">
          <div className="ff-detail-panel-title-row">
            <h3>{model.display_name}</h3>
            <StatusBadge tone={toneForUsability(usability)} status={usability}>
              {USABILITY_LABELS[usability]}
            </StatusBadge>
          </div>
          <p>{model.provider_label}</p>
        </div>
        <div className="ff-detail-panel-actions">
          <Link to={providerRoute}>Provider</Link>
          <Link to={providerTargetsRoute}>Targets</Link>
          <Link to={routingRoute}>Routing</Link>
        </div>
      </div>

      <div className="ff-detail-panel-body">
        {/* Next-step recommendation */}
        {nextAction !== "none" || usability !== "ready" ? (
          <div className="ff-next-step" data-tone={nextStepTone(usability)}>
            <span className="ff-next-step-label">
              {nextAction !== "none"
                ? NEXT_ACTION_LABELS[nextAction]
                : USABILITY_LABELS[usability]}
            </span>
            <span>{USABILITY_EXPLANATIONS[usability]}</span>
          </div>
        ) : null}

        {isPlaceholder ? (
          <p
            style={{
              marginTop: "var(--fg-space-3)",
              padding: "0.7rem var(--fg-space-3)",
              border: "1px solid var(--fg-color-border-default)",
              borderRadius: "var(--fg-radius-md)",
              background: "var(--fg-color-surface-subtle)",
              fontSize: "var(--fg-type-size-meta)",
            }}
          >
            This is a generic harness placeholder model. Replace it with a real
            provider model for production use.
          </p>
        ) : null}

        {/* Blocking checks */}
        {usability !== "ready" ? (
          <section style={{ marginTop: "var(--fg-space-4)" }}>
            <h4
              style={{
                fontSize: "var(--fg-type-size-subtitle)",
                fontWeight: 600,
                marginBottom: "var(--fg-space-2)",
              }}
            >
              Blocking checks
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--fg-space-2)",
              }}
            >
              {blockingChecks
                .filter((check) => !check.ok)
                .map((check) => (
                  <div
                    key={check.label}
                    style={{
                      display: "flex",
                      gap: "var(--fg-space-2)",
                      alignItems: "flex-start",
                      fontSize: "var(--fg-type-size-meta)",
                    }}
                  >
                    <StatusBadge tone="danger" status="blocked">
                      {check.label}
                    </StatusBadge>
                    <span style={{ color: "var(--fg-color-text-secondary)" }}>
                      {check.explanation}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        {/* Quick facts section */}
        <section style={{ marginTop: "var(--fg-space-4)" }}>
          <h4
            style={{
              fontSize: "var(--fg-type-size-subtitle)",
              fontWeight: 600,
              marginBottom: "var(--fg-space-2)",
            }}
          >
            Details
          </h4>
            <dl style={{ display: "grid", gap: "var(--fg-space-2)", fontSize: "var(--fg-type-size-meta)" }}>
            <div>
              <dt>Routing coverage</dt>
              <dd>
                {model.routing_target_count}/{model.target_count} targets
                routable
                {model.target_count > 0 ? (
                  <span className="fg-muted" style={{ display: "block", fontSize: "0.85em" }}>
                    {model.routing_reason}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>
                <StatusBadge
                  tone={
                    model.trust_status === "tested"
                      ? "success"
                      : model.trust_status === "observed"
                        ? "info"
                        : model.trust_status === "verification_failed"
                          ? "danger"
                          : "warning"
                  }
                  status={model.trust_status}
                >
                  {titleCase(model.trust_status)}
                </StatusBadge>
                {model.trust_reason ? (
                  <span className="fg-muted" style={{ display: "block", fontSize: "0.85em" }}>
                    {model.trust_reason}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Capabilities</dt>
              <dd>
                {model.declared_capability_keys.length > 0
                  ? model.declared_capability_keys.map(titleCase).join(", ")
                  : "None declared"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Evidence summary */}
        {hasAnyEvidence ? (
          <section style={{ marginTop: "var(--fg-space-4)" }}>
            <h4
              style={{
                fontSize: "var(--fg-type-size-subtitle)",
                fontWeight: 600,
                marginBottom: "var(--fg-space-2)",
              }}
            >
              Runtime evidence
            </h4>
            <div
              className="fg-actions"
              style={{ flexWrap: "wrap", marginBottom: "var(--fg-space-2)" }}
            >
              <EvidenceBadge label="Runtime" status={model.evidence.runtime.status} />
              <EvidenceBadge label="Streaming" status={model.evidence.streaming.status} />
              <EvidenceBadge label="Tool calling" status={model.evidence.tool_calling.status} />
            </div>
            {Object.keys(model.tested_evidence).length > 0 ? (
              <div className="fg-actions" style={{ flexWrap: "wrap" }}>
                {Object.entries(model.tested_evidence).map(([key, value]) => (
                  <EvidenceBadge key={key} label={titleCase(key)} status={value.status} />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Linked targets */}
        {model.linked_targets.length > 0 ? (
          <section style={{ marginTop: "var(--fg-space-4)" }}>
            <h4
              style={{
                fontSize: "var(--fg-type-size-subtitle)",
                fontWeight: 600,
                marginBottom: "var(--fg-space-2)",
              }}
            >
              Targets
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--fg-space-2)",
              }}
            >
              {model.linked_targets.slice(0, 3).map((target) => (
                <div
                  key={target.target_key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "var(--fg-type-size-meta)",
                    padding: "var(--fg-space-1) 0",
                    borderBottom: "1px solid var(--fg-color-border-subtle)",
                  }}
                >
                  <span>
                    <strong>{target.label}</strong>
                  </span>
                  <div className="fg-actions" style={{ gap: "0.3rem" }}>
                    <StatusBadge
                      tone={target.routing_eligible ? "success" : "warning"}
                      status={target.routing_eligible ? "ready" : "partial"}
                    >
                      {target.routing_eligible ? "routable" : "blocked"}
                    </StatusBadge>
                    <StatusBadge
                      tone={target.enabled ? "success" : "warning"}
                      status={target.enabled ? "ready" : "blocked"}
                    >
                      {target.enabled ? "enabled" : "disabled"}
                    </StatusBadge>
                  </div>
                </div>
              ))}
              {model.linked_targets.length > 3 ? (
                <p className="fg-muted" style={{ fontSize: "0.85em" }}>
                  +{model.linked_targets.length - 3} more targets
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Sync action */}
        {needsSync && canMutateProviderDiscovery ? (
          <section style={{ marginTop: "var(--fg-space-4)" }}>
            <h4
              style={{
                fontSize: "var(--fg-type-size-subtitle)",
                fontWeight: 600,
                marginBottom: "var(--fg-space-2)",
              }}
            >
              Discovery sync
            </h4>
            <div className="fg-actions">
              <button
                type="button"
                disabled={syncState === "submitting"}
                onClick={onSync}
              >
                {syncState === "submitting"
                  ? "Syncing..."
                  : "Sync provider inventory"}
              </button>
              <p className="fg-muted">{model.sync.detail}</p>
            </div>
            {syncMessage ? (
              <p
                className={
                  syncState === "error" ? "fg-danger" : "fg-note"
                }
                style={{ marginTop: "var(--fg-space-2)" }}
              >
                {syncMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        {!canMutateProviderDiscovery ? (
          <p className="fg-note" style={{ marginTop: "var(--fg-space-3)" }}>
            Provider discovery sync requires provider write access.
          </p>
        ) : null}

        {/* Advanced technical details — collapsed by default */}
        <details
          className="ff-collapse-section"
          style={{ marginTop: "var(--fg-space-4)" }}
        >
          <summary>Advanced technical details</summary>
          <div className="ff-collapse-section-body">
          <dl style={{ display: "grid", gap: "var(--fg-space-2)", fontSize: "var(--fg-type-size-meta)" }}>
              <div>
                <dt>Model ID</dt>
                <dd>
                  <code>{model.model_id}</code>
                </dd>
              </div>
              <div>
                <dt>Routing key</dt>
                <dd>
                  <code>{model.routing_key}</code>
                </dd>
              </div>
              <div>
                <dt>Provider integration</dt>
                <dd>{titleCase(model.provider_integration_class)}</dd>
              </div>
              <div>
                <dt>Owned by</dt>
                <dd>{model.owned_by}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{titleCase(model.source)}</dd>
              </div>
              <div>
                <dt>Discovery status</dt>
                <dd>{titleCase(model.discovery_status)}</dd>
              </div>
              <div>
                <dt>Last discovery</dt>
                <dd>{formatTimestamp(model.last_seen_at)}</dd>
              </div>
              <div>
                <dt>Last probe</dt>
                <dd>{formatTimestamp(model.last_probe_at)}</dd>
              </div>
              <div>
                <dt>Sync status</dt>
                <dd>
                  {titleCase(model.provider_last_sync_status)}
                  {model.provider_last_sync_error ? (
                    <span className="fg-muted" style={{ display: "block", fontSize: "0.85em" }}>
                      {model.provider_last_sync_error}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Runtime state</dt>
                <dd>{titleCase(model.runtime_status)}</dd>
              </div>
              <div>
                <dt>Health</dt>
                <dd>{titleCase(model.health_status)}</dd>
              </div>
              <div>
                <dt>Execution traits</dt>
                <dd>
                  {Object.entries(model.execution_traits).length > 0
                    ? Object.entries(model.execution_traits)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(" · ")
                    : "None"}
                </dd>
              </div>
              <div>
                <dt>Policy flags</dt>
                <dd>
                  {Object.entries(model.policy_flags).length > 0
                    ? Object.entries(model.policy_flags)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(" · ")
                    : "None"}
                </dd>
              </div>
              <div>
                <dt>Economic profile</dt>
                <dd>
                  {Object.entries(model.economic_profile).length > 0
                    ? Object.entries(model.economic_profile)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(" · ")
                    : "None"}
                </dd>
              </div>
            </dl>

            {/* All linked targets */}
            {model.linked_targets.length > 0 ? (
              <>
                <h5 style={{ marginTop: "var(--fg-space-3)", fontWeight: 600 }}>
                  All linked targets
                </h5>
                <ul>
                  {model.linked_targets.map((target) => (
                    <li key={target.target_key}>
                      <strong>{target.label}</strong>
                      <span className="fg-muted">
                        {" "}
                        ({target.target_key}) — priority {target.priority}
                      </span>
                      <div className="fg-actions">
                        <StatusBadge
                          tone={target.routing_eligible ? "success" : "warning"}
                          status={target.routing_eligible ? "ready" : "partial"}
                        >
                          {target.routing_eligible ? "routing eligible" : "not routing eligible"}
                        </StatusBadge>
                        <StatusBadge
                          tone={target.enabled ? "success" : "warning"}
                          status={target.enabled ? "ready" : "blocked"}
                        >
                          {target.enabled ? "enabled" : "disabled"}
                        </StatusBadge>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {/* Routing policy references */}
            {model.routing_policy_classes.length > 0 ? (
              <>
                <h5 style={{ marginTop: "var(--fg-space-3)", fontWeight: 600 }}>
                  Routing policies
                </h5>
                <ul>
                  {model.routing_policy_classes.map((item) => (
                    <li key={item}>{titleCase(item)}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </details>
      </div>
    </aside>
  );
}
