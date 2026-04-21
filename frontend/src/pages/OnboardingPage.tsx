import { useEffect, useState } from "react";

import { fetchBootstrapReadiness, fetchOauthOnboarding } from "../api/admin";

export function OnboardingPage() {
  const [bootstrap, setBootstrap] = useState<{ ready: boolean; checks: Array<Record<string, unknown>>; next_steps: string[] } | null>(null);
  const [oauthTargets, setOauthTargets] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [bootstrapPayload, oauthPayload] = await Promise.all([
          fetchBootstrapReadiness(),
          fetchOauthOnboarding(),
        ]);
        if (!mounted) {
          return;
        }
        setBootstrap({
          ready: Boolean(bootstrapPayload.ready),
          checks: bootstrapPayload.checks ?? [],
          next_steps: bootstrapPayload.next_steps ?? [],
        });
        setOauthTargets(oauthPayload.targets ?? []);
        setError("");
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Onboarding loading failed.");
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section>
      <h2>Onboarding</h2>
      <p className="fg-muted">Guided bootstrap, storage readiness and OAuth/account next steps.</p>
      {error ? <p className="fg-danger">{error}</p> : null}

      {bootstrap ? (
        <article className="fg-card" style={{ marginBottom: "0.75rem" }}>
          <h3>Bootstrap Readiness</h3>
          <p>ready={String(bootstrap.ready)}</p>
          <ul>
            {bootstrap.checks.map((check) => (
              <li key={String(check.id)}>
                {String(check.id)} · ok={String(check.ok)} · details={String(check.details)}
              </li>
            ))}
          </ul>
          <ol>
            {bootstrap.next_steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </article>
      ) : null}

      <article className="fg-card">
        <h3>OAuth / Account Provider Onboarding</h3>
        <ul>
          {oauthTargets.map((target) => (
            <li key={String(target.provider_key)}>
              {String(target.provider_key)} · readiness={String(target.readiness)} · depth={String(target.operational_depth)} · configured={String(target.configured)} · bridge={String(target.runtime_bridge_enabled)} · probe={String(target.probe_enabled)}
              {Array.isArray(target.next_steps) ? (
                <div className="fg-muted" style={{ marginTop: "0.25rem" }}>
                  next: {String((target.next_steps as unknown[])[0] ?? "none")}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
