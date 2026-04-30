# Codex-CLI-Auftrag: Skills

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Skills sind versionierbare, aktivierbare, governancefähige prozedurale Bausteine. Die Seite muss Versionen, Scope, Provenienz, Aktivierung und Telemetrie zeigen.

## Ziel der Seite

Skills wird zur Skill-Registry: Versionen, Aktivierungszustand, Scope, Provenance, Approval Status, Usage Telemetry, Activate/Archive/Record Usage.

## Betroffene Frontend-Dateien

- frontend/src/pages/SkillsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/skills.py

## Konkreter Umbauauftrag

1. Skill-Liste mit Name, Version, Status, Scope, aktiv in Instanzen, letzter Nutzung, Outcome.
2. Detailpanel mit Versionen, Aktivierungen, Provenienz, Review-/Approval-Status, Telemetrie.
3. Create Skill als Draft/Registry-Eintrag, nicht als bloßer Prompt-Text.
4. Nutze APIs `activateSkill`, `archiveSkill`, `recordSkillUsage` mit klar sichtbarem Ergebnis.
5. Skill klar von Plugin, Harness und Target abgrenzen.

## Akzeptanzkriterien

- Skill-Aktivierung ist scopebewusst sichtbar.
- Version/Provenienz werden angezeigt.
- Archivieren ist nicht mit Löschen verwechselt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
