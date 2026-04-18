export function DashboardPage() {
  return (
    <section>
      <h2>ForgeGate Control Plane Dashboard</h2>
      <p>
        ForgeGate wird UI-first ausgebaut: Providerbetrieb, Modellpflege, OAuth/Keys, Discovery-Sync und
        Runtime-Auswertung sollen im Regelbetrieb über die UI erfolgen.
      </p>
      <ul>
        <li>Provider-Readiness und Modellstatus unter „Providers“</li>
        <li>Usage-/Kosten-Grundlagen unter „Usage“</li>
        <li>Shell bleibt Dev/Infra/Recovery-Werkzeug, nicht Primär-UX</li>
      </ul>
    </section>
  );
}
