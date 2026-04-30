# Codex-CLI-Auftrag: Accounts

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Accounts zeigt Runtime-Account-Inventar, aber es muss klarer zwischen Identität, Provider-Bindings, Lifecycle und Berechtigungen unterscheiden.

## Ziel der Seite

Accounts wird zur Verwaltung von Runtime-/Client-Identitäten mit Lifecycle, Bindings, Status, Scope und sicheren Mutationen.

## Betroffene Frontend-Dateien

- frontend/src/pages/AccountsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/accounts.py

## Konkreter Umbauauftrag

1. Baue eine Tabelle mit Account, Status, Scope, Provider-Bindings, Key-Anzahl, letzter Nutzung, Risiko.
2. Create/Edit in Drawer mit Validierung; keine unnötige Kartenliste.
3. Detailpanel mit Lifecycle-Aktionen: aktivieren/deaktivieren/archivieren je nachdem, was Backend trägt.
4. Read-only Session zeigt klare Review-Fläche ohne inaktive Formularbuttons.
5. Verlinke zu API Keys, Audit History und betroffenen Instances.

## Akzeptanzkriterien

- Account-Anlage und Update funktionieren weiter.
- Read-only Benutzer sieht keine scheinbar klickbaren Mutationsaktionen.
- Bindings und Scope sind verständlich.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
