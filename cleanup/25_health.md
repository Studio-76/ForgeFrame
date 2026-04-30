# Codex-CLI-Auftrag: Health & Readiness

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Health/Readiness darf nicht nur Runtime-Health und Provider-Posture anzeigen. Es muss technische Health, Readiness und Signalpfad trennen.

## Ziel der Seite

Health wird zur operativen Zustandsseite: technische Health, Readiness, Provider Health, Signal Path, Migration/DB/Queue/Worker/TLS-Prüfungen, aktuelle Risiken.

## Betroffene Frontend-Dateien

- frontend/src/pages/HealthPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/control_plane_health_domain.py
- backend/app/api/admin/providers.py

## Konkreter Umbauauftrag

1. Trenne `Health` und `Readiness`: erreichbar vs einsatzbereit.
2. Zeige Checks gruppiert: DB/Migration, API, Frontend, Providers, Queue/Worker, TLS/FQDN, Observability.
3. Jeder Check braucht Status, letzte Prüfung, Evidence, Fehler, nächste Route.
4. Provider needing review mit Link zu Provider Health oder OAuth Targets.
5. Signal Path zeigt, ob Logs/Usage/Costs/Audit wirklich gespeist werden.

## Akzeptanzkriterien

- Keine readiness-grüne Anzeige bei fehlendem TLS/FQDN im public mode.
- Health und Readiness sind visuell getrennt.
- Jeder rote Check hat einen Korrekturpfad.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
