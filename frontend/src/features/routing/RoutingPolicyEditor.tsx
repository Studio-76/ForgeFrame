import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/StateBlocks";
import type { RoutingControlPlaneResponse, RoutingPolicyRecord } from "../../api/domain/routing";
import type { PolicyDraft } from "./types";
import { titleCase, toPolicyDraft, toneForStatus, parseTargetKeyList } from "./utils";

/**
 * Props for the policy editor section.
 */
export type RoutingPolicyEditorProps = {
  snapshot: RoutingControlPlaneResponse | null;
  policyDrafts: Record<string, PolicyDraft>;
  canMutate: boolean;
  actionError: string;
  onSetPolicyDrafts: (drafts: Record<string, PolicyDraft>) => void;
  onSavePolicy: (classification: RoutingPolicyRecord["classification"]) => void;
};

/**
 * Collapsible policy-editor section body.
 * Shows simple and non-simple policy forms with target key management.
 * Direct target keys are shown inside the editor, not in a permanent sidebar.
 */
export function RoutingPolicyEditor({
  snapshot,
  policyDrafts,
  canMutate,
  actionError,
  onSetPolicyDrafts,
  onSavePolicy,
}: RoutingPolicyEditorProps) {
  const policies = snapshot?.policies ?? [];
  const targets = snapshot?.targets ?? [];

  if (policies.length === 0) {
    return (
      <EmptyState
        title="No routing policies are available"
        description="This instance has no persisted routing policy records. Simulation cannot be trusted until the policy layer exists."
      />
    );
  }

  return (
    <div className="fg-card-grid">
      {policies.map((policy) => {
        const draft = policyDrafts[policy.classification] ?? toPolicyDraft(policy);

        const setDraft = (updated: PolicyDraft) => {
          onSetPolicyDrafts({
            ...policyDrafts,
            [policy.classification]: updated,
          });
        };

        return (
          <article key={policy.classification} className="fg-subcard">
            <div className="fg-panel-heading">
              <div>
                <h4>{policy.display_name}</h4>
                <p className="fg-muted">{policy.description}</p>
              </div>
              <StatusBadge
                tone={policy.classification === "simple" ? "success" : "warning"}
                status={policy.classification === "simple" ? "ready" : "partial"}
              >
                {titleCase(policy.classification)}
              </StatusBadge>
            </div>

            <section className="fg-subcard">
              <h5>Classification and lane</h5>
              <p>Routing class: {titleCase(policy.classification)}.</p>
              <p>Execution lane: {policy.execution_lane}. This is policy intent after classification, not the classification itself.</p>
              <div className="fg-inline-form">
                <label>
                  Execution lane
                  <select
                    aria-label={`${policy.classification} execution lane`}
                    value={draft.execution_lane}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        execution_lane: event.target.value as PolicyDraft["execution_lane"],
                      })
                    }
                  >
                    <option value="sync_interactive">sync_interactive</option>
                    <option value="queued_background">queued_background</option>
                  </select>
                </label>
                <label className="fg-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.prefer_local}
                    onChange={(event) => setDraft({ ...draft, prefer_local: event.target.checked })}
                  />
                  Prefer local targets
                </label>
                <label className="fg-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.prefer_low_latency}
                    onChange={(event) => setDraft({ ...draft, prefer_low_latency: event.target.checked })}
                  />
                  Prefer low latency
                </label>
              </div>
            </section>

            <section className="fg-subcard">
              <h5>Allowed target pool</h5>
              <p className="fg-muted">
                Preferred stage order is the comma order below. Use exact target keys so the stage list remains explicit and auditable.
              </p>
              <div className="fg-inline-form">
                <label>
                  Preferred target keys
                  <input
                    aria-label={`${policy.classification} preferred target keys`}
                    value={draft.preferred_target_keys}
                    onChange={(event) => setDraft({ ...draft, preferred_target_keys: event.target.value })}
                  />
                </label>
              </div>
              <div className="fg-detail-grid">
                {targets.map((target) => (
                  <p key={`${policy.classification}:${target.target_key}`}>
                    {target.target_key} to {target.label} · readiness={target.readiness_status} · cost={target.cost_class}
                  </p>
                ))}
              </div>
            </section>

            <section className="fg-subcard">
              <h5>Fallback and escalation</h5>
              <div className="fg-inline-form">
                <label className="fg-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.allow_fallback}
                    onChange={(event) => setDraft({ ...draft, allow_fallback: event.target.checked })}
                  />
                  Allow fallback stage
                </label>
                <label>
                  Fallback target keys
                  <input
                    aria-label={`${policy.classification} fallback target keys`}
                    value={draft.fallback_target_keys}
                    onChange={(event) => setDraft({ ...draft, fallback_target_keys: event.target.value })}
                  />
                </label>
                <label className="fg-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.allow_escalation}
                    onChange={(event) => setDraft({ ...draft, allow_escalation: event.target.checked })}
                  />
                  Allow escalation stage
                </label>
                <label>
                  Escalation target keys
                  <input
                    aria-label={`${policy.classification} escalation target keys`}
                    value={draft.escalation_target_keys}
                    onChange={(event) => setDraft({ ...draft, escalation_target_keys: event.target.value })}
                  />
                </label>
              </div>
            </section>

            <section className="fg-subcard">
              <h5>Budget and circuit behavior</h5>
              <div className="fg-inline-form">
                <label className="fg-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.allow_premium}
                    onChange={(event) => setDraft({ ...draft, allow_premium: event.target.checked })}
                  />
                  Premium targets allowed
                </label>
                <label className="fg-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.require_queue_eligible}
                    onChange={(event) => setDraft({ ...draft, require_queue_eligible: event.target.checked })}
                  />
                  Require queue-eligible targets
                </label>
              </div>
              <ul className="fg-list">
                <li>Blocked cost classes and hard-budget posture are enforced after this policy is chosen.</li>
                <li>Open circuits remove targets before stage selection and can force fallback or escalation.</li>
                <li>Request-path controls such as queue-background or pinned-target remain separate from the routing class.</li>
              </ul>
            </section>

            <div className="fg-actions fg-actions-end">
              <button type="button" onClick={() => void onSavePolicy(policy.classification)}>
                Save {policy.display_name}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
