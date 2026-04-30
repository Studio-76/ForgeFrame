# Codex-CLI-Auftrag: Plugins

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Die Plugins-Seite mischt Registry, Manifest-Erstellung, Selected Plugin Truth und Instance Binding. Das ist fachlich richtig, aber zu unklar geschnitten. Plugin ist Extension-System, nicht Skill, nicht Harness, nicht Target.

## Ziel der Seite

Plugins wird zur Extension-Verwaltung: Katalog, Manifest, Sicherheitsprüfung, Aktivierung pro Instanz, Extension Slots, Config Contracts und Audit-/Security-Posture.

## Betroffene Frontend-Dateien

- frontend/src/pages/PluginsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/plugins.py

## Konkreter Umbauauftrag

1. Trenne Layout in drei Tabs oder Panels: `Katalog`, `Manifest bearbeiten`, `Instanz-Aktivierung`.
2. Katalog-Tabelle mit Status, Version, Provenienz, Security Posture, Extension Slots, aktiviert in Instanzen.
3. Manifest-Editor mit Validierung und deutlichen Fehlern; kein rohes JSON als Primärbedienung, sondern strukturierte Felder plus Advanced JSON.
4. Instance Binding als eigenständige Aktion: aktivieren/deaktivieren, Config Contract erfüllen, Scope prüfen.
5. Klare Abgrenzung im Text: Plugin erweitert Produktfläche/Systemfunktion, Skill erweitert prozedurales Verhalten.

## Akzeptanzkriterien

- Ein Plugin kann angelegt/bearbeitet und pro Instanz gebunden werden.
- Security-Posture beeinflusst sichtbare Warnungen.
- Raw JSON ist optional, nicht die Hauptbedienung.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
