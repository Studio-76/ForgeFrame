# Codex-CLI-Auftrag: Release / Validation

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Release/Validation darf kein statisches Reporting sein. Das Zielbild verlangt reproduzierbare Release-Gates und Nachweise für Bootstrap, Runtime, Provider, Routing, Queue, Security, TLS und Tests.

## Ziel der Seite

Release/Validation wird zum Gateboard: harte Gates, Evidence, Blocker, letzte Prüfläufe, nächste Korrekturrouten und klarer Status `release-ready` nur bei realer Deckung.

## Betroffene Frontend-Dateien

- frontend/src/pages/ReleaseValidationPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/control_plane_bootstrap_domain.py
- backend/app/api/admin/control_plane_health_domain.py
- backend/app/api/admin/control_plane_routing_domain.py

## Konkreter Umbauauftrag

1. Baue Gate-Kategorien: Build/Test, Bootstrap, Runtime API, Provider, OAuth, Routing, Queue/Dispatch, Security, TLS, Backup/Recovery.
2. Jeder Gate-Eintrag braucht Status, Evidence-Quelle, Zeitpunkt, Blocker, Link zur zuständigen Seite.
3. Wenn kein automatischer Prüflauf existiert, zeige `manual evidence required` oder implementiere minimalen Read-Endpunkt, aber nicht fake-grün.
4. Operator Next Routes aus Blockern generieren, nicht statisch anzeigen.
5. Release-ready nur anzeigen, wenn alle harten Gates erfüllt sind.

## Akzeptanzkriterien

- Keine Release-Behauptung ohne Evidence-Zeitpunkt.
- Blocker sind nach Schwere sortiert.
- Jeder Blocker hat eine konkrete Zielseite.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
