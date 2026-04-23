import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { withInstanceScope } from "../../app/tenantScope";
import type {
  ChecklistLink,
  ChecklistStep,
  ChecklistTone,
  OnboardingInterviewEvaluation,
  OnboardingInterviewState,
} from "./helpers";

type OnboardingContentProps = {
  error: string;
  loading: boolean;
  liveTrafficReady: boolean;
  completedSteps: number;
  overallTone: ChecklistTone;
  goLiveLinks: ChecklistLink[];
  runtimeReadyProviderCount: number | string;
  activeRuntimeKeyCount: number | string;
  currentSessionLabel: string;
  steps: ChecklistStep[];
  instanceId: string | null;
  interview: OnboardingInterviewState;
  interviewEvaluation: OnboardingInterviewEvaluation;
  canPersistOnboarding: boolean;
  hasSelectedInstance: boolean;
  savePending: boolean;
  saveError: string;
  saveMessage: string;
  onInterviewSave: (event: FormEvent<HTMLFormElement>) => void;
  onInterviewFieldChange: <K extends keyof OnboardingInterviewState>(field: K, value: OnboardingInterviewState[K]) => void;
  firstSuccessTone: ChecklistTone;
  firstSuccessLabel: string;
  firstSuccessSummary: string;
  firstSuccessDetail: string;
  firstSuccessLinks: ChecklistLink[];
};

type InterviewFieldProps = {
  disabled: boolean;
  hasSelectedInstance: boolean;
  interview: OnboardingInterviewState;
  onInterviewFieldChange: <K extends keyof OnboardingInterviewState>(field: K, value: OnboardingInterviewState[K]) => void;
};

function InterviewFields({ disabled, hasSelectedInstance, interview, onInterviewFieldChange }: InterviewFieldProps) {
  return (
    <>
      <article className="fg-subcard">
        <h4>1. Instance boundary</h4>
        <p className="fg-muted">Record the first real instance instead of leaving onboarding as an unbound checklist.</p>
        <div className="fg-grid fg-grid-compact">
          <label>
            Instance ID
            <input
              name="instanceId"
              value={interview.instanceId}
              disabled={disabled || hasSelectedInstance}
              onChange={(event) => onInterviewFieldChange("instanceId", event.target.value)}
              placeholder="customer-prod"
            />
          </label>
          <label>
            Display name
            <input
              name="displayName"
              value={interview.displayName}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("displayName", event.target.value)}
              placeholder="Customer Production"
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            name="description"
            rows={3}
            value={interview.description}
            disabled={disabled}
            onChange={(event) => onInterviewFieldChange("description", event.target.value)}
          />
        </label>
        <div className="fg-grid fg-grid-compact">
          <label>
            Tenant scope
            <input
              name="tenantId"
              value={interview.tenantId}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("tenantId", event.target.value)}
              placeholder="customer-prod"
            />
          </label>
          <label>
            Execution scope
            <input
              name="companyId"
              value={interview.companyId}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("companyId", event.target.value)}
              placeholder="customer-prod"
            />
          </label>
        </div>
      </article>

      <article className="fg-subcard">
        <h4>2. Linux / HTTPS operating posture</h4>
        <p className="fg-muted">Capture whether this stack is on the normative public HTTPS path or a visibly limited evaluation posture.</p>
        <div className="fg-grid fg-grid-compact">
          <label>
            Operating mode
            <select
              name="operatingMode"
              value={interview.operatingMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("operatingMode", event.target.value as OnboardingInterviewState["operatingMode"])}
            >
              <option value="normative_public_https">normative_public_https</option>
              <option value="limited_evaluation">limited_evaluation</option>
            </select>
          </label>
          <label>
            Deployment mode
            <select
              name="deploymentMode"
              value={interview.deploymentMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("deploymentMode", event.target.value as OnboardingInterviewState["deploymentMode"])}
            >
              <option value="linux_host_native">linux_host_native</option>
              <option value="container_optional">container_optional</option>
              <option value="restricted_eval">restricted_eval</option>
            </select>
          </label>
          <label>
            Exposure mode
            <select
              name="exposureMode"
              value={interview.exposureMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("exposureMode", event.target.value as OnboardingInterviewState["exposureMode"])}
            >
              <option value="same_origin">same_origin</option>
              <option value="edge_admission">edge_admission</option>
              <option value="local_only">local_only</option>
            </select>
          </label>
          <label>
            PostgreSQL mode
            <select
              name="postgresMode"
              value={interview.postgresMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("postgresMode", event.target.value as OnboardingInterviewState["postgresMode"])}
            >
              <option value="native_host">native_host</option>
              <option value="dedicated_container">dedicated_container</option>
              <option value="external_managed">external_managed</option>
            </select>
          </label>
        </div>
        <div className="fg-grid fg-grid-compact">
          <label>
            Public FQDN
            <input
              name="fqdn"
              value={interview.fqdn}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("fqdn", event.target.value)}
              placeholder="forgeframe.example.com"
            />
          </label>
          <label>
            TLS mode
            <select
              name="tlsMode"
              value={interview.tlsMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("tlsMode", event.target.value as OnboardingInterviewState["tlsMode"])}
            >
              <option value="lets_encrypt">lets_encrypt</option>
              <option value="manual">manual</option>
              <option value="self_signed">self_signed</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            Certificate status
            <select
              name="certificateStatus"
              value={interview.certificateStatus}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("certificateStatus", event.target.value as OnboardingInterviewState["certificateStatus"])}
            >
              <option value="not_started">not_started</option>
              <option value="pending">pending</option>
              <option value="issued">issued</option>
              <option value="renewal_blocked">renewal_blocked</option>
              <option value="failed">failed</option>
              <option value="manual">manual</option>
            </select>
          </label>
          <label>
            Port 80 helper
            <select
              name="helperPort80Mode"
              value={interview.helperPort80Mode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("helperPort80Mode", event.target.value as OnboardingInterviewState["helperPort80Mode"])}
            >
              <option value="acme_redirect_only">acme_redirect_only</option>
              <option value="minimal_redirect_only">minimal_redirect_only</option>
              <option value="not_available">not_available</option>
              <option value="unrestricted_http">unrestricted_http</option>
            </select>
          </label>
        </div>
        <div className="fg-grid fg-grid-compact">
          <label>
            <input
              type="checkbox"
              name="dnsReady"
              checked={interview.dnsReady}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("dnsReady", event.target.checked)}
            />
            DNS is ready for the recorded FQDN
          </label>
          <label>
            <input
              type="checkbox"
              name="port80Ready"
              checked={interview.port80Ready}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("port80Ready", event.target.checked)}
            />
            Port 80 is reachable for ACME / redirect only
          </label>
          <label>
            <input
              type="checkbox"
              name="port443Ready"
              checked={interview.port443Ready}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("port443Ready", event.target.checked)}
            />
            Port 443 is reachable for the primary HTTPS listener
          </label>
          <label>
            <input
              type="checkbox"
              name="certificateAutoRenew"
              checked={interview.certificateAutoRenew}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("certificateAutoRenew", event.target.checked)}
            />
            Automatic certificate renewal is enabled
          </label>
        </div>
      </article>

      <article className="fg-subcard">
        <h4>3. Runtime direction and routing defaults</h4>
        <p className="fg-muted">Persist the initial execution posture instead of leaving provider direction, autonomy, and lane preference implicit.</p>
        <div className="fg-grid fg-grid-compact">
          <label>
            Provider / client direction
            <select
              name="providerDirection"
              value={interview.providerDirection}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("providerDirection", event.target.value as OnboardingInterviewState["providerDirection"])}
            >
              <option value="mixed_control_plane">mixed_control_plane</option>
              <option value="oauth_account_providers">oauth_account_providers</option>
              <option value="openai_compatible_clients">openai_compatible_clients</option>
              <option value="local_first">local_first</option>
            </select>
          </label>
          <label>
            Autonomy mode
            <select
              name="autonomyMode"
              value={interview.autonomyMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("autonomyMode", event.target.value as OnboardingInterviewState["autonomyMode"])}
            >
              <option value="operator_assist">operator_assist</option>
              <option value="bounded_autonomy">bounded_autonomy</option>
              <option value="autonomous_worker">autonomous_worker</option>
            </select>
          </label>
          <label>
            Routing default
            <select
              name="routingDefault"
              value={interview.routingDefault}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("routingDefault", event.target.value as OnboardingInterviewState["routingDefault"])}
            >
              <option value="local_first">local_first</option>
              <option value="balanced">balanced</option>
              <option value="premium_capable">premium_capable</option>
            </select>
          </label>
          <label>
            Runtime driver mode
            <select
              name="runtimeDriverMode"
              value={interview.runtimeDriverMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("runtimeDriverMode", event.target.value as OnboardingInterviewState["runtimeDriverMode"])}
            >
              <option value="embedded_control_plane">embedded_control_plane</option>
              <option value="remote_runtime_driver">remote_runtime_driver</option>
            </select>
          </label>
          <label>
            Edge admission mode
            <select
              name="edgeAdmissionMode"
              value={interview.edgeAdmissionMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("edgeAdmissionMode", event.target.value as OnboardingInterviewState["edgeAdmissionMode"])}
            >
              <option value="disabled">disabled</option>
              <option value="enabled">enabled</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              name="allowPremiumEscalation"
              checked={interview.allowPremiumEscalation}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("allowPremiumEscalation", event.target.checked)}
            />
            Premium escalation is allowed
          </label>
        </div>
      </article>

      <article className="fg-subcard">
        <h4>4. Work interaction and first-success plan</h4>
        <p className="fg-muted">Record how the first productive interaction should happen instead of pushing work interaction into hidden follow-up settings.</p>
        <div className="fg-grid fg-grid-compact">
          <label>
            Work-interaction mode
            <select
              name="workInteractionMode"
              value={interview.workInteractionMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("workInteractionMode", event.target.value as OnboardingInterviewState["workInteractionMode"])}
            >
              <option value="control_plane_only">control_plane_only</option>
              <option value="ops_assistant">ops_assistant</option>
              <option value="team_assistant">team_assistant</option>
              <option value="personal_assistant">personal_assistant</option>
            </select>
          </label>
          <label>
            Assistant specialization
            <select
              name="assistantMode"
              value={interview.assistantMode}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("assistantMode", event.target.value as OnboardingInterviewState["assistantMode"])}
            >
              <option value="none">none</option>
              <option value="ops">ops</option>
              <option value="team">team</option>
              <option value="personal">personal</option>
            </select>
          </label>
          <label>
            First success action
            <select
              name="firstSuccessAction"
              value={interview.firstSuccessAction}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("firstSuccessAction", event.target.value as OnboardingInterviewState["firstSuccessAction"])}
            >
              <option value="provider_verification">provider_verification</option>
              <option value="runtime_request">runtime_request</option>
              <option value="artifact_review">artifact_review</option>
              <option value="operator_handoff">operator_handoff</option>
            </select>
          </label>
          <label>
            First artifact
            <select
              name="firstArtifact"
              value={interview.firstArtifact}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("firstArtifact", event.target.value as OnboardingInterviewState["firstArtifact"])}
            >
              <option value="provider_preview">provider_preview</option>
              <option value="runtime_response">runtime_response</option>
              <option value="execution_trace">execution_trace</option>
              <option value="audit_evidence">audit_evidence</option>
            </select>
          </label>
          <label>
            Operator surface
            <select
              name="operatorSurface"
              value={interview.operatorSurface}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("operatorSurface", event.target.value as OnboardingInterviewState["operatorSurface"])}
            >
              <option value="providers">providers</option>
              <option value="dashboard">dashboard</option>
              <option value="usage">usage</option>
              <option value="logs">logs</option>
            </select>
          </label>
        </div>
        <div className="fg-grid fg-grid-compact">
          <label>
            <input
              type="checkbox"
              name="inboxEnabled"
              checked={interview.inboxEnabled}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("inboxEnabled", event.target.checked)}
            />
            Inbox / triage path enabled
          </label>
          <label>
            <input
              type="checkbox"
              name="tasksEnabled"
              checked={interview.tasksEnabled}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("tasksEnabled", event.target.checked)}
            />
            Tasks / follow-ups enabled
          </label>
          <label>
            <input
              type="checkbox"
              name="notificationsEnabled"
              checked={interview.notificationsEnabled}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("notificationsEnabled", event.target.checked)}
            />
            Notifications / outbox expectation enabled
          </label>
        </div>
      </article>
    </>
  );
}

export function OnboardingContent({
  error,
  loading,
  liveTrafficReady,
  completedSteps,
  overallTone,
  goLiveLinks,
  runtimeReadyProviderCount,
  activeRuntimeKeyCount,
  currentSessionLabel,
  steps,
  instanceId,
  interview,
  interviewEvaluation,
  canPersistOnboarding,
  hasSelectedInstance,
  savePending,
  saveError,
  saveMessage,
  onInterviewSave,
  onInterviewFieldChange,
  firstSuccessTone,
  firstSuccessLabel,
  firstSuccessSummary,
  firstSuccessDetail,
  firstSuccessLinks,
}: OnboardingContentProps) {
  const totalSteps = steps.length;

  return (
    <>
      {error ? <p className="fg-danger">{error}</p> : null}

      {loading ? (
        <article className="fg-card">
          <h3>Loading setup signals</h3>
          <p className="fg-muted">ForgeFrame is checking bootstrap readiness, provider verification, runtime access inventory, and the current session scope.</p>
        </article>
      ) : null}

      {!loading ? (
        <>
          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Guided onboarding interview</h3>
                <p className="fg-muted">
                  Persist the first instance, operating mode, TLS posture, routing defaults, and work-interaction intent instead of leaving setup as a read-only checklist.
                </p>
              </div>
              <div className="fg-actions">
                <span className="fg-pill" data-tone={interviewEvaluation.tone}>
                  {interviewEvaluation.statusLabel}
                </span>
                <span className="fg-pill" data-tone={canPersistOnboarding ? "success" : "warning"}>
                  {canPersistOnboarding ? "Writable" : "Admin handoff"}
                </span>
              </div>
            </div>

            <p className="fg-muted">{interviewEvaluation.summary}</p>
            <p className="fg-muted">{interviewEvaluation.detail}</p>

            {saveError ? <p className="fg-danger">{saveError}</p> : null}
            {saveMessage ? <p>{saveMessage}</p> : null}

            {interviewEvaluation.blockers.length > 0 ? (
              <ul className="fg-list">
                {interviewEvaluation.blockers.map((blocker) => (
                  <li key={blocker.code}>
                    <strong>{blocker.code}</strong>: {blocker.message}
                  </li>
                ))}
              </ul>
            ) : null}

            <form className="fg-stack" onSubmit={onInterviewSave}>
              <InterviewFields
                disabled={!canPersistOnboarding}
                hasSelectedInstance={hasSelectedInstance}
                interview={interview}
                onInterviewFieldChange={onInterviewFieldChange}
              />
              <div className="fg-actions">
                <button type="submit" disabled={!canPersistOnboarding || savePending}>
                  {savePending
                    ? (hasSelectedInstance ? "Saving onboarding truth" : "Creating first instance")
                    : (hasSelectedInstance ? "Save onboarding truth" : "Create first instance")}
                </button>
              </div>
            </form>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>First success and work interaction</h3>
                <p className="fg-muted">The onboarding flow now records the intended first operator win and the baseline work-interaction posture.</p>
              </div>
              <span className="fg-pill" data-tone={firstSuccessTone}>
                {firstSuccessLabel}
              </span>
            </div>
            <p className="fg-muted">{firstSuccessSummary}</p>
            <p className="fg-muted">{firstSuccessDetail}</p>
            <div className="fg-grid fg-grid-compact">
              <article className="fg-kpi">
                <span className="fg-muted">Operator surface</span>
                <strong>{interview.operatorSurface}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Assistant mode</span>
                <strong>{interview.assistantMode}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Work interaction</span>
                <strong>{interview.workInteractionMode}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Inbox / Tasks / Notifications</span>
                <strong>{`${interview.inboxEnabled ? "yes" : "no"} / ${interview.tasksEnabled ? "yes" : "no"} / ${interview.notificationsEnabled ? "yes" : "no"}`}</strong>
              </article>
            </div>
            {firstSuccessLinks.length > 0 ? (
              <div className="fg-actions">
                {firstSuccessLinks.map((link) => (
                  <Link key={`first-success-${link.label}`} className="fg-nav-link" to={withInstanceScope(link.to, instanceId)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Setup status</h3>
                <p className="fg-muted">
                  {liveTrafficReady
                    ? "The control plane has interview truth, bootstrap, provider, and runtime access coverage to hand off into operations monitoring."
                    : "The checklist still exposes the next missing step or handoff instead of ending on raw onboarding lists."}
                </p>
              </div>
              <div className="fg-actions">
                <span className="fg-pill" data-tone={overallTone}>
                  {liveTrafficReady ? "Ready for live traffic" : `${completedSteps}/${totalSteps} steps complete`}
                </span>
                {goLiveLinks.map((link) => (
                  <Link key={link.label} className="fg-nav-link" to={withInstanceScope(link.to, instanceId)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="fg-grid fg-grid-compact">
              <article className="fg-kpi">
                <span className="fg-muted">Checklist progress</span>
                <strong className="fg-kpi-value">{completedSteps}/{totalSteps}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Runtime-ready providers</span>
                <strong className="fg-kpi-value">{runtimeReadyProviderCount}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Active runtime keys</span>
                <strong className="fg-kpi-value">{activeRuntimeKeyCount}</strong>
              </article>
              <article className="fg-kpi">
                <span className="fg-muted">Current session</span>
                <strong>{currentSessionLabel}</strong>
              </article>
            </div>
          </article>

          <article className="fg-card">
            <div className="fg-panel-heading">
              <div>
                <h3>Sequenced setup checklist</h3>
                <p className="fg-muted">The order stays explicit: interview truth first, then bootstrap, provider verification, runtime access issuance, and the go-live handoff.</p>
              </div>
            </div>

            <ol className="fg-checklist">
              {steps.map((step) => (
                <li key={step.id} className="fg-subcard fg-checklist-step">
                  <div className="fg-panel-heading">
                    <div className="fg-row">
                      <span className="fg-checklist-index" aria-hidden="true">
                        {step.step}
                      </span>
                      <div className="fg-checklist-copy">
                        <h4>{step.title}</h4>
                        <p className="fg-muted">{step.summary}</p>
                      </div>
                    </div>
                    <span className="fg-pill" data-tone={step.tone}>
                      {step.statusLabel}
                    </span>
                  </div>

                  <p className="fg-muted">{step.detail}</p>

                  {step.blockers.length > 0 ? (
                    <ul className="fg-list">
                      {step.blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  ) : null}

                  {step.links.length > 0 ? (
                    <div className="fg-actions">
                      {step.links.map((link) => (
                        <Link key={`${step.id}-${link.label}`} className="fg-nav-link" to={withInstanceScope(link.to, instanceId)}>
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </article>
        </>
      ) : null}
    </>
  );
}
