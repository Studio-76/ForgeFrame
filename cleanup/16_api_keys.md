# Codex-CLI-Auftrag: API Keys

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

API Keys sind sicherheitskritisch. Die Seite muss Scope, Rotation, Status und One-Time-Secret sauber führen und nicht nur Key-Posture anzeigen.

## Ziel der Seite

API Keys wird zur sicheren Schlüsselverwaltung: ausstellen, Secret einmal anzeigen, rotieren, sperren, Request-Path-Policy prüfen und Scope/Instanzbindung sichtbar machen.

## Betroffene Frontend-Dateien

- frontend/src/pages/ApiKeysPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/keys.py

## Konkreter Umbauauftrag

1. Baue Tabelle mit Label, Account, Instance Scope, erlaubten Pfaden, Status, Created, Last Used, Rotation.
2. Issue-Key-Flow: nach Erstellung Secret prominent einmalig anzeigen mit Copy-Button und Warnung.
3. Rotation nutzt vorhandene API und zeigt neues Secret nur einmal.
4. Request-Path-Policy als eigener Abschnitt pro Key mit editierbaren Pfaden, falls Backend erlaubt.
5. Sperren/Statuswechsel klar trennen von Rotation.

## Akzeptanzkriterien

- Neues Secret wird nur unmittelbar nach Create/Rotate angezeigt.
- Key-Scope und erlaubte Runtime-Pfade sind sichtbar.
- Keine Secret-Werte werden aus vorhandenen Keys rekonstruiert oder vorgetäuscht.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
