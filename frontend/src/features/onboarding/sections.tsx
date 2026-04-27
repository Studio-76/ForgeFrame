import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import type { RuntimeKeyFirstSuccessProbeResponse } from "../../api/admin";
import { withInstanceScope } from "../../app/tenantScope";
import type {
  ChecklistLink,
  ChecklistTone,
  OnboardingInterviewEvaluation,
  OnboardingInterviewState,
  OperatingModelDescriptor,
  WizardStepStatus,
} from "./helpers";
import { OPERATING_MODEL_DESCRIPTORS, type OnboardingOperatingModel } from "./helpers";

type WizardStep = {
  id: string;
  title: string;
  status: WizardStepStatus;
  summary: string;
  detail: string;
  blockers: string[];
  links: ChecklistLink[];
};

type ProviderConnectionRow = {
  provider: string;
  label: string;
  connectionStatus: "local" | "api-key" | "bridge-only" | "unsupported" | "onboarding-only";
  detail: string;
  tone: ChecklistTone;
};

type OnboardingContentProps = {
  error: string;
  loading: boolean;
  instanceId: string | null;
  steps: WizardStep[];
  interview: OnboardingInterviewState;
  interviewEvaluation: OnboardingInterviewEvaluation;
  persistedInterviewEvaluation: OnboardingInterviewEvaluation;
  operatingModelDescriptor: OperatingModelDescriptor;
  canPersistOnboarding: boolean;
  canConfigureRouting: boolean;
  canIssueRuntimeAccess: boolean;
  hasSelectedInstance: boolean;
  savePending: boolean;
  saveError: string;
  saveMessage: string;
  onInterviewSave: (event: FormEvent<HTMLFormElement>) => void;
  onInterviewFieldChange: <K extends keyof OnboardingInterviewState>(field: K, value: OnboardingInterviewState[K]) => void;
  operatorAgentLabel: string | null;
  providerRows: ProviderConnectionRow[];
  routingChoice: "simple" | "non_simple";
  routingPending: boolean;
  routingError: string;
  routingMessage: string;
  onRoutingChoiceChange: (value: "simple" | "non_simple") => void;
  onApplyRoutingChoice: () => void;
  runtimeKeyCount: number;
  issueKeyPending: boolean;
  issueKeyError: string;
  issueKeyMessage: string;
  issuedRuntimeToken: string;
  onIssueRuntimeKey: () => void;
  runtimeKeyTokenInput: string;
  onRuntimeKeyTokenInputChange: (value: string) => void;
  firstSuccessPending: boolean;
  firstSuccessError: string;
  firstSuccessResult: RuntimeKeyFirstSuccessProbeResponse["probe"] | null;
  onRunFirstSuccessProbe: () => void;
  tlsEvidenceReady: boolean;
  tlsEvidenceCheckedAt: string | null;
  tlsEvidenceBlockers: string[];
  goLiveSummary: string;
  goLiveBlockers: string[];
};

function toneForWizardStatus(status: WizardStepStatus): ChecklistTone {
  switch (status) {
    case "done":
      return "success";
    case "current":
      return "warning";
    case "blocked":
      return "danger";
    case "skipped":
    default:
      return "neutral";
  }
}

function statusLabel(status: WizardStepStatus): string {
  switch (status) {
    case "done":
      return "done";
    case "current":
      return "current";
    case "blocked":
      return "blocked";
    case "skipped":
    default:
      return "skipped";
  }
}

type InterviewFieldsProps = {
  disabled: boolean;
  hasSelectedInstance: boolean;
  interview: OnboardingInterviewState;
  operatingModelDescriptor: OperatingModelDescriptor;
  onInterviewFieldChange: <K extends keyof OnboardingInterviewState>(field: K, value: OnboardingInterviewState[K]) => void;
};

function InterviewFields({
  disabled,
  hasSelectedInstance,
  interview,
  operatingModelDescriptor,
  onInterviewFieldChange,
}: InterviewFieldsProps) {
  return (
    <>
      <article className="fg-subcard">
        <h4>Betriebsart</h4>
        <div className="fg-grid fg-grid-compact">
          {OPERATING_MODEL_DESCRIPTORS.map((item) => (
            <label key={item.key}>
              <input
                type="radio"
                name="operatingModel"
                value={item.key}
                checked={interview.operatingModel === item.key}
                disabled={disabled}
                onChange={(event) => onInterviewFieldChange("operatingModel", event.target.value as OnboardingOperatingModel)}
              />
              {item.label}
            </label>
          ))}
        </div>
        <p className="fg-muted">{operatingModelDescriptor.description}</p>
        <ul className="fg-list">
          <li>Interner Modus: {operatingModelDescriptor.internalMode}</li>
          <li>Tenant-Erfordernis: {operatingModelDescriptor.tenantRequirement}</li>
          <li>Rollenmodell: {operatingModelDescriptor.roleModel}</li>
        </ul>
      </article>

      <article className="fg-subcard">
        <h4>Instanz und Scope</h4>
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
        <h4>Normative HTTPS Pfad</h4>
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
            DNS ready
          </label>
          <label>
            <input
              type="checkbox"
              name="port80Ready"
              checked={interview.port80Ready}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("port80Ready", event.target.checked)}
            />
            Port 80 reachable
          </label>
          <label>
            <input
              type="checkbox"
              name="port443Ready"
              checked={interview.port443Ready}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("port443Ready", event.target.checked)}
            />
            Port 443 reachable
          </label>
          <label>
            <input
              type="checkbox"
              name="certificateAutoRenew"
              checked={interview.certificateAutoRenew}
              disabled={disabled}
              onChange={(event) => onInterviewFieldChange("certificateAutoRenew", event.target.checked)}
            />
            Auto renew enabled
          </label>
        </div>
      </article>
    </>
  );
}

export function OnboardingContent({
  error,
  loading,
  instanceId,
  steps,
  interview,
  interviewEvaluation,
  persistedInterviewEvaluation,
  operatingModelDescriptor,
  canPersistOnboarding,
  canConfigureRouting,
  canIssueRuntimeAccess,
  hasSelectedInstance,
  savePending,
  saveError,
  saveMessage,
  onInterviewSave,
  onInterviewFieldChange,
  operatorAgentLabel,
  providerRows,
  routingChoice,
  routingPending,
  routingError,
  routingMessage,
  onRoutingChoiceChange,
  onApplyRoutingChoice,
  runtimeKeyCount,
  issueKeyPending,
  issueKeyError,
  issueKeyMessage,
  issuedRuntimeToken,
  onIssueRuntimeKey,
  runtimeKeyTokenInput,
  onRuntimeKeyTokenInputChange,
  firstSuccessPending,
  firstSuccessError,
  firstSuccessResult,
  onRunFirstSuccessProbe,
  tlsEvidenceReady,
  tlsEvidenceCheckedAt,
  tlsEvidenceBlockers,
  goLiveSummary,
  goLiveBlockers,
}: OnboardingContentProps) {
  const stepOneCardEvaluation = hasSelectedInstance ? persistedInterviewEvaluation : interviewEvaluation;

  if (loading) {
    return (
      <article className="fg-card">
        <h3>Loading wizard state</h3>
      </article>
    );
  }

  return (
    <>
      {error ? <p className="fg-danger">{error}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <h3>Onboarding Wizard</h3>
        </div>
        <ol className="fg-checklist">
          {steps.map((step) => (
            <li key={step.id} className="fg-subcard fg-checklist-step">
              <div className="fg-panel-heading">
                <div>
                  <h4>{step.title}</h4>
                  <p className="fg-muted">{step.summary}</p>
                </div>
                <span className="fg-pill" data-tone={toneForWizardStatus(step.status)}>
                  {statusLabel(step.status)}
                </span>
              </div>
              <p className="fg-muted">{step.detail}</p>
              {step.blockers.length > 0 ? (
                <ul className="fg-list">
                  {step.blockers.map((blocker) => (
                    <li key={`${step.id}-${blocker}`}>{blocker}</li>
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

      <article className="fg-card">
        <div className="fg-panel-heading">
          <h3>1) Betriebsart und erste Instanz</h3>
          <span className="fg-pill" data-tone={stepOneCardEvaluation.tone}>
            {stepOneCardEvaluation.statusLabel}
          </span>
        </div>
        <p className="fg-muted">{stepOneCardEvaluation.summary}</p>
        <p className="fg-muted">{stepOneCardEvaluation.detail}</p>
        {stepOneCardEvaluation.blockers.length > 0 ? (
          <ul className="fg-list">
            {stepOneCardEvaluation.blockers.map((blocker) => (
              <li key={blocker.code}>
                {blocker.code}: {blocker.message}
              </li>
            ))}
          </ul>
        ) : null}
        {saveError ? <p className="fg-danger">{saveError}</p> : null}
        {saveMessage ? <p>{saveMessage}</p> : null}

        <form className="fg-stack" onSubmit={onInterviewSave}>
          <InterviewFields
            disabled={!canPersistOnboarding}
            hasSelectedInstance={hasSelectedInstance}
            interview={interview}
            operatingModelDescriptor={operatingModelDescriptor}
            onInterviewFieldChange={onInterviewFieldChange}
          />
          <div className="fg-actions">
            <button type="submit" disabled={!canPersistOnboarding || savePending}>
              {savePending ? "Saving onboarding state" : hasSelectedInstance ? "Save onboarding state" : "Create first instance"}
            </button>
          </div>
        </form>
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <h3>2) Operator-Agent</h3>
        </div>
        <p className="fg-muted">
          {operatorAgentLabel
            ? `Default operator product object detected: ${operatorAgentLabel}.`
            : "Default operator agent is still missing for the selected instance."}
        </p>
        <div className="fg-actions">
          <Link className="fg-nav-link" to={withInstanceScope("/instances", instanceId)}>Open Instances</Link>
          <Link className="fg-nav-link" to={withInstanceScope("/agents", instanceId)}>Open Agents</Link>
        </div>
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <h3>3) Provider / Target-Erstauswahl</h3>
        </div>
        <p className="fg-muted">Connection status is classified from real control-plane truth: local, API-key, bridge-only, onboarding-only, unsupported.</p>
        <div className="fg-grid fg-grid-compact">
          {providerRows.map((provider) => (
            <article className="fg-subcard" key={provider.provider}>
              <div className="fg-panel-heading">
                <h4>{provider.label}</h4>
                <span className="fg-pill" data-tone={provider.tone}>{provider.connectionStatus}</span>
              </div>
              <p className="fg-muted">{provider.detail}</p>
            </article>
          ))}
        </div>
        <div className="fg-actions">
          <Link className="fg-nav-link" to={withInstanceScope("/providers", instanceId)}>Open Providers</Link>
          <Link className="fg-nav-link" to={withInstanceScope("/provider-targets", instanceId)}>Open Provider Targets</Link>
        </div>
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <h3>4) Routing default</h3>
        </div>
        <div className="fg-grid fg-grid-compact">
          <label>
            <input
              type="radio"
              name="routingChoice"
              value="simple"
              checked={routingChoice === "simple"}
              onChange={() => onRoutingChoiceChange("simple")}
            />
            simple billig/lokal
          </label>
          <label>
            <input
              type="radio"
              name="routingChoice"
              value="non_simple"
              checked={routingChoice === "non_simple"}
              onChange={() => onRoutingChoiceChange("non_simple")}
            />
            non-simple Premium/OAuth
          </label>
        </div>
        {routingError ? <p className="fg-danger">{routingError}</p> : null}
        {routingMessage ? <p>{routingMessage}</p> : null}
        <div className="fg-actions">
          <button type="button" onClick={onApplyRoutingChoice} disabled={!canConfigureRouting || routingPending}>
            {routingPending ? "Applying routing defaults" : "Apply routing defaults"}
          </button>
          <Link className="fg-nav-link" to={withInstanceScope("/routing", instanceId)}>Open Routing</Link>
        </div>
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <h3>5) Runtime key issuance</h3>
        </div>
        <p className="fg-muted">Active runtime keys: {runtimeKeyCount}</p>
        {issueKeyError ? <p className="fg-danger">{issueKeyError}</p> : null}
        {issueKeyMessage ? <p>{issueKeyMessage}</p> : null}
        {issuedRuntimeToken ? (
          <p><code>{issuedRuntimeToken}</code></p>
        ) : null}
        <div className="fg-actions">
          <button type="button" onClick={onIssueRuntimeKey} disabled={!canIssueRuntimeAccess || issueKeyPending}>
            {issueKeyPending ? "Issuing runtime key" : "Issue runtime key"}
          </button>
          <Link className="fg-nav-link" to={withInstanceScope("/api-keys", instanceId)}>Open API Keys</Link>
        </div>
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <h3>6) FQDN / TLS evidence</h3>
          <span className="fg-pill" data-tone={tlsEvidenceReady ? "success" : "danger"}>
            {tlsEvidenceReady ? "done" : "blocked"}
          </span>
        </div>
        <p className="fg-muted">
          {tlsEvidenceReady
            ? `API evidence confirms FQDN and TLS readiness.${tlsEvidenceCheckedAt ? ` Last check ${tlsEvidenceCheckedAt}.` : ""}`
            : "FQDN/TLS remains blocked until bootstrap API checks show DNS, HTTPS listener, and certificate evidence."}
        </p>
        {tlsEvidenceBlockers.length > 0 ? (
          <ul className="fg-list">
            {tlsEvidenceBlockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : null}
        <div className="fg-actions">
          <Link className="fg-nav-link" to={withInstanceScope("/ingress-tls", instanceId)}>Open Ingress TLS</Link>
        </div>
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <h3>7) First success probe</h3>
          <span className="fg-pill" data-tone={firstSuccessResult?.success ? "success" : "warning"}>
            {firstSuccessResult?.success ? "done" : "current"}
          </span>
        </div>
        <label>
          Runtime key token
          <input
            name="runtimeKeyTokenInput"
            value={runtimeKeyTokenInput}
            onChange={(event) => onRuntimeKeyTokenInputChange(event.target.value)}
            placeholder="fg_live_..."
          />
        </label>
        {firstSuccessError ? <p className="fg-danger">{firstSuccessError}</p> : null}
        {firstSuccessResult ? (
          <ul className="fg-list">
            <li>/v1/models: {firstSuccessResult.models_probe.ok ? "ok" : "failed"} ({firstSuccessResult.models_probe.status_code ?? "n/a"})</li>
            <li>/v1/chat/completions: {firstSuccessResult.chat_probe.ok ? "ok" : firstSuccessResult.chat_probe.attempted ? "failed" : "not attempted"} ({firstSuccessResult.chat_probe.status_code ?? "n/a"})</li>
            <li>Executed at: {firstSuccessResult.executed_at.replace("T", " ").replace("Z", " UTC")}</li>
          </ul>
        ) : null}
        <div className="fg-actions">
          <button type="button" onClick={onRunFirstSuccessProbe} disabled={firstSuccessPending || !runtimeKeyTokenInput.trim()}>
            {firstSuccessPending ? "Running first success probe" : "Run first success probe"}
          </button>
        </div>
      </article>

      <article className="fg-card">
        <div className="fg-panel-heading">
          <h3>8) Go-live summary</h3>
        </div>
        <p className="fg-muted">{goLiveSummary}</p>
        {goLiveBlockers.length > 0 ? (
          <ul className="fg-list">
            {goLiveBlockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : (
          <p>Instance, provider, routing, runtime key, TLS evidence, and first-success probe are all in place.</p>
        )}
        <div className="fg-actions">
          <Link className="fg-nav-link" to={withInstanceScope("/dashboard", instanceId)}>Open Dashboard</Link>
        </div>
      </article>
    </>
  );
}
