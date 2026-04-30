# Codex-CLI-Auftrag: Errors & Incident Review

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Errors zeigt Alerts und Summary, muss aber zur Incident Review werden: gruppierte Fehler, betroffene Achse, aktuelle Wirkung, nächste Aktion, Link zu Logs/Health/Execution/Routing.

## Ziel der Seite

Errors wird zur Fehler- und Incident-Seite: Alerts, Error Shapes, Blocked Routing Failures, Provider/Runtime/Queue/Policy-Fehler, Triage und Deep-Links.

## Betroffene Frontend-Dateien

- frontend/src/pages/ErrorsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/logs.py

## Konkreter Umbauauftrag

1. Gruppiere Fehler nach Achse: Runtime, Provider, OAuth, Routing, Queue/Dispatch, Security, TLS, Work Interaction.
2. Fehlerliste mit Severity, Count, First/Last Seen, aktuelle Wirkung, nächster Schritt.
3. Blocked Routing Failures als eigener Block mit Policy/Budget/Capability-Grund.
4. Detailpanel mit Rohlogs, aber Kurzinterpretation oben.
5. Links zu Health, Logs, Routing, Provider Targets, Execution passend zum Fehler.

## Akzeptanzkriterien

- Fehler sind priorisiert und nicht nur chronologisch.
- Jeder kritische Fehler hat eine nächste Aktion.
- Logs bleiben Evidence, Errors bleibt Triage/Incident.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
