# Codex-CLI-Auftrag: Harness

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Harness ist derzeit aus Provider-Sektionen herausgeschnitten und wirkt wie ausgelagerte technische Proof-Fläche. Das Zielbild beschreibt den Harness aber als Produktkern für Profile, Templates, Preview, Verify, Dry Run, Probe, Execute, Import/Export und Rollback.

## Ziel der Seite

Harness wird zur echten Arbeitsfläche für generische Integrations- und Ausführungsprofile: Templates auswählen, Profile verwalten, Runs sehen, Preview/Verify/Dry-Run/Probe ausführen, Import/Export/Rollback bedienen.

## Betroffene Frontend-Dateien

- frontend/src/pages/HarnessPage.tsx
- frontend/src/features/providers/ProvidersSections.tsx
- frontend/src/features/providers/useProvidersControlPlane.ts
- frontend/src/api/admin.ts
- backend/app/api/admin/control_plane_harness_domain.py

## Konkreter Umbauauftrag

1. Erstelle eine eigenständige Harness-Page-Struktur statt Provider-Section-Reuse als Hauptlayout.
2. Links: Template-/Profile-Liste; Mitte: ausgewähltes Profil mit Config-Vertrag; Rechts: Aktionen und Run-Historie.
3. Implementiere echte Aktionen für vorhandene API-Funktionen: `verifyHarnessProfile`, `previewHarness`, `dryRunHarness`, `probeHarness`, `activate/deactivate`, `import/export`, `rollback`.
4. Zeige Profilstatus, Version, Scope, letzte Ausführung, letzter Fehler und Proof-Status.
5. Packe Roh-Snapshots und Proof-Carriers in `AdvancedDiagnostics`.

## Akzeptanzkriterien

- Ein Operator kann ein Profil auswählen und mindestens Verify/Preview/Dry Run/Probe sichtbar ausführen.
- Run-Ergebnis erscheint auf der Seite mit Zeit, Status, Fehler und Artefakt-/Log-Link.
- Die Seite ist ohne Provider-Seitenkontext verständlich.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
