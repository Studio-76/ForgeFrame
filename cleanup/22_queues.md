# Codex-CLI-Auftrag: Queues

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Queues zeigt lane-backed Queue truth, darf aber nicht mit Execution Review verschwimmen. Queue beantwortet: warum wartet etwas, welche Lane ist belastet, was ist runnable, paused, quarantined?

## Ziel der Seite

Queues wird zur Lane- und Backlog-Fläche: Lanes, Backlog, Wartezeit, runnable/blocked/paused/quarantined, Fairness/Capacity-Signale und Links zu Runs.

## Betroffene Frontend-Dateien

- frontend/src/pages/QueuesPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/execution.py

## Konkreter Umbauauftrag

1. Oben Lane-Summary mit Queue-Length, runnable, running, paused, quarantined, oldest age.
2. Filter nach Lane, State, Instanz, Target, Alter.
3. Backlog-Tabelle mit Grund des Wartens, gewählter Lane, Run-Link, Target, nächster erlaubter Aktion.
4. Queue-Seite darf keine vollständige Run-Bedienung duplizieren; Run-Aktionen nur als Link zu Execution oder kompakte erlaubte Queue-Aktionen.
5. Zeige Empty-State `no backlog` als Erfolg, nicht als leere Seite.

## Akzeptanzkriterien

- Ein Operator erkennt überlastete Lanes sofort.
- Jeder Queue-Eintrag erklärt, warum er wartet.
- Execution-Detail ist direkt verlinkt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
