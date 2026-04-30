# Codex-CLI-Auftrag: Knowledge Sources

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Knowledge Sources sollen Connector- und Kontextquellen mit Sync-State, Sichtbarkeit und Linkage darstellen. Die Seite darf nicht nur Source-CRUD sein.

## Ziel der Seite

Knowledge Sources wird zur Connector-/Kontextquellenfläche: Quelle, Scope, Sync-Status, Visibility, letzte Synchronisation, Fehler, verknüpfte Memory/Conversations/Skills.

## Betroffene Frontend-Dateien

- frontend/src/pages/KnowledgeSourcesPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/knowledge_sources.py

## Konkreter Umbauauftrag

1. Liste mit Source Type, Scope, Sync Status, Last Sync, Visibility, Error.
2. Detailpanel mit Connector-Konfiguration, indizierten Objekten/Counts falls vorhanden, letzte Fehler.
3. Sync auslösen nur wenn API vorhanden; sonst klarer missing-runtime-state.
4. Create/Edit nach Quellentyp strukturieren.
5. Zeige Unterschied zwischen Knowledge/Recall und Durable Memory deutlich.

## Akzeptanzkriterien

- Sync-Zustand ist sofort sichtbar.
- Source-Scope verhindert Verwechslung zwischen persönlichem, Instanz- und Tenant-Wissen.
- Fehler führen zu konkreten nächsten Schritten.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
