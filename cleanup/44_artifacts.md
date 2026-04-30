# Codex-CLI-Auftrag: Artifacts

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Artifacts sind zentrale Ergebnis- und Hilfsobjekte. Die Seite muss Preview, Download, Metadaten, Verknüpfung, Versionen und Checksums zeigen, nicht nur Attachment-CRUD.

## Ziel der Seite

Artifacts wird zur Artefaktverwaltung: Inventar, Preview/Download, Owner/Scope, Linked Objects, Version/Checksum, Retention und Handoff-Nutzung.

## Betroffene Frontend-Dateien

- frontend/src/pages/ArtifactsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/artifacts.py

## Konkreter Umbauauftrag

1. Tabelle mit Artefakt, Typ, Scope, Größe/Checksum falls vorhanden, Version, linked Run/Workspace/Approval, erstellt am.
2. Detailpanel mit Preview, Download-Link oder klarer fehlender Blob-Storage-Unterstützung.
3. Create/Edit als Metadatenfluss; Upload nur implementieren, wenn Backend trägt, sonst nicht vortäuschen.
4. Verknüpfte Objekte als Chips/Links darstellen.
5. Retention/Archive-Status sichtbar machen, falls Daten vorhanden.

## Akzeptanzkriterien

- Ein Artefakt ist preview-/downloadfähig oder klar als Metadata-only markiert.
- Verknüpfungen zu Runs/Workspaces/Approvals sind sichtbar.
- Raw metadata ist Advanced, nicht Hauptinhalt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
