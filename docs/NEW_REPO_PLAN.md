# NEW_REPO_PLAN

## Produktziel
ForgeGate soll als Smart AI Gateway eine stabile, erweiterbare und provider-agnostische Ausführungsplattform für AI-Workloads bereitstellen.

## Nicht-Ziele (für das initiale Setup)
- Kein Port von Altcode in produktive Ordner.
- Keine vorgezogene Core-Implementierung.
- Keine halbfertigen Endpunkte als Pseudo-MVP.

## Was aus NadirClaw übernommen werden soll
- Semantik, Randfälle, Härtungswissen.
- Test- und Verhaltenshinweise für OAuth, Streaming, Tool Calling und Fallback.

## Was neu gebaut wird
- ForgeGate-Core-Architektur in neuer Struktur.
- Saubere Trennung von Runtime/API, Admin/API, Storage und Telemetrie.
- Neue Provider-Adapter mit einheitlichen Schnittstellen.

## Distincte Feature-Lücke (aktuell bewusst offen)
- Kein ausführbarer Core.
- Keine produktive OAuth- oder Provider-Integration.
- Kein abgeschlossenes API-Contracting.

## Zielarchitektur (hochlevel)
- Backend mit App-Schichten für API, Core, Provider, Auth, Storage, Telemetrie.
- Frontend als Admin-Plattform.
- Dokumentierte Trennung zwischen Referenz und Produktcode.

## MVP (nächste Stufe)
- Basis-Lifecycle für Runtime-Anfragen.
- Grundlegende Provider-Dispatch-Schnittstelle.
- Minimales Admin-Setup für Provider- und Key-Verwaltung.

## Phase 2
- Robuste Streaming- und Fallback-Semantik.
- Tool-Calling-Kompatibilität inkl. Legacy-Feldern.
- Verbesserte Observability und Nutzungsmetriken.

## Phase 3
- Erweiterte Routing-Strategien und Policy-Layer.
- Tiefere Multi-Account- und Multi-Provider-Strategien.
- Reife Betriebsmodi inkl. Migrations-/Rollout-Optionen.

## Migrationsstrategie
- Referenzcode bleibt ausschließlich in `reference/`.
- Semantik wird analysiert und neu umgesetzt, nicht kopiert.
- Jede Core-Komponente wird als ForgeGate-native Implementierung erstellt.

## Technische Prinzipien
- Deterministische Struktur vor Funktionsausbau.
- Explizite Zuständigkeiten je Modul.
- Kein implizites Übernehmen von Referenzlogik.
- Architekturentscheidungen zuerst dokumentieren, dann implementieren.

## Nächste Schritte
1. Scaffold validieren und stabil halten.
2. API-Verträge pro Layer definieren.
3. Core-Komponenten nacheinander implementieren.
4. Verhalten gegen Referenzsemantik testen.
