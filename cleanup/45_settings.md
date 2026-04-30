# Codex-CLI-Auftrag: System Settings

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Settings muss mutable environment defaults klar gruppieren und sicher editieren. Es darf keine undifferenzierte Key-Value-Liste bleiben.

## Ziel der Seite

Settings wird zur Systemkonfigurationsseite mit Gruppen, effektiven Werten, Defaults, Reset, Änderungsrisiko und Permission-State.

## Betroffene Frontend-Dateien

- frontend/src/pages/SettingsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/settings.py

## Konkreter Umbauauftrag

1. Gruppiere Settings nach Runtime, Security, Providers, Routing, TLS, Observability, UI.
2. Tabelle mit Key, Label, Effective Value, Default, Source, Mutable, Risk.
3. Edit/Reset-Aktionen inline oder im Detailpanel; Read-only sauber trennen.
4. Änderungen mit Bestätigung für riskante Settings.
5. Zeige nach Patch/Reset Operationsergebnis und aktualisiere Werte.

## Akzeptanzkriterien

- Settings sind gruppiert und suchbar.
- Reset-to-default funktioniert sichtbar.
- Read-only Benutzer sehen Review statt deaktivierter Formularwüste.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
