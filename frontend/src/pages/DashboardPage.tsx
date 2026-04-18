export function DashboardPage() {
  return (
    <section>
      <h2>ForgeGate Control Plane Dashboard</h2>
      <p className="fg-muted">
        Fokus dieses Ausbaus: Provider-Verwaltung, Model-Sync-Vorstufe und Usage/Kosten-Aggregationen über echte
        Admin-Endpunkte.
      </p>
      <ul>
        <li>Provider-Verwaltung und Sync-Aktionen unter „Providers“</li>
        <li>Usage-/Kosten-Aggregationen unter „Usage“</li>
        <li>Theme-System mit Dark-Default und Light-Option im Header</li>
      </ul>
    </section>
  );
}
