# Codex-CLI-Auftrag: Execution Review

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Execution Review ist für Runs und Operator-Aktionen zuständig. Es muss Run-Lifecycle, State, Approval-Waits, Replay und Kontrollaktionen hart abbilden.

## Ziel der Seite

Execution wird zur Run-Control-Fläche: Runs filtern, Detail/Evidence prüfen, pause/resume/interrupt/quarantine/restart/escalate/replay ausführen, Approval-Waits erkennen und Audit verlinken.

## Betroffene Frontend-Dateien

- frontend/src/pages/ExecutionPage.tsx
- frontend/src/features/execution/ExecutionPage.tsx
- frontend/src/features/execution/sections.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/execution.py

## Konkreter Umbauauftrag

1. Baue Filter nach Instanz, Run-State, Lane, Target, Approval-Wait, Fehler, Zeitraum.
2. Run-Tabelle: ID, Titel/Zweck, State, Lane, Target, Attempts, Kostenklasse, Start/Update, nächste Aktion.
3. Detailpanel mit Timeline, Dispatch-Jobs, Entscheidungen, Approval-Links, Artefakte, Raw Details.
4. Operator-Aktionen als klar getrennte Buttons: pause, resume, interrupt, quarantine, restart, escalate, replay. Nur aktiv, wenn Zustand es erlaubt.
5. Jede Aktion zeigt Ergebnis und aktualisiert Detail/Tabelle.

## Akzeptanzkriterien

- Mindestens eine Run-Aktion nutzt reale API und aktualisiert UI.
- Approval-Waits verlinken zur Approvals-Seite.
- Run-Lifecycle ist nicht nur Rohstatus, sondern verständlich erklärt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
