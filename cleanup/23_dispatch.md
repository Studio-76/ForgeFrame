# Codex-CLI-Auftrag: Dispatch

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Dispatch zeigt Worker-Leases, Outbox Pressure und Reconciliation. Das muss klar als technische Abarbeitungsschicht unterhalb von Runs und Queues sichtbar sein.

## Ziel der Seite

Dispatch wird zur Worker-/Lease-/Attempt-Fläche: aktive Leases, stalled attempts, outbox pressure, Reconciliation und technische Dispatch-Evidence.

## Betroffene Frontend-Dateien

- frontend/src/pages/DispatchPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/execution.py

## Konkreter Umbauauftrag

1. Strukturiere die Seite in `Worker Leases`, `Leased Attempts`, `Outbox Pressure`, `Reconciliation`.
2. Zeige pro Lease: Worker, Instance, Lane, Target, expires/renewed, stale-risk.
3. Reconcile-Aktion mit Ergebnis, Anzahl korrigierter Leases/Attempts, Fehlern.
4. Outbox Pressure mit Ursache und Link zu Notifications/Execution.
5. Technische Rohdetails in Advanced Diagnostics.

## Akzeptanzkriterien

- Stalled/expired leases sind deutlich sichtbar.
- Reconcile-Aktion funktioniert oder zeigt einen echten Permission/API-Blocker.
- Dispatch wird nicht als allgemeine Queue-Seite missverstanden.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
