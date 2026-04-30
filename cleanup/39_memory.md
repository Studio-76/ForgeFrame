# Codex-CLI-Auftrag: Memory

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Memory ist mit 1024 Zeilen groß und funktionsreich, aber muss stärker zwischen Boot Memory, Working Context, Durable Memory, Recall, Korrektur, Widerruf und Löschung unterscheiden.

## Ziel der Seite

Memory wird zur Governance-Fläche für Langzeitwahrheit: Einträge, Scope, Quelle, Trust, Status, Korrektur, Widerruf, Löschung und Verwendungsnachweis.

## Betroffene Frontend-Dateien

- frontend/src/pages/MemoryPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/memory.py

## Konkreter Umbauauftrag

1. Trenne Ansichten: `Durable Memory`, `Boot Memory Candidates`, `Working Context References`, `Revoked/Superseded`.
2. Tabelle mit Inhalt-Kurzfassung, Scope, Source, Trust, Status, Expires/Review, Last Used.
3. Detailpanel mit Quelle, Revisionen, Korrekturhistorie, Verwendung in Runs/Conversations/Skills.
4. Nutze vorhandene APIs `correctMemoryEntry`, `revokeMemoryEntry`, `deleteMemoryEntry` klar getrennt.
5. Create/Edit mit Review/Trust/Scope-Validierung; keine undifferenzierte Sammelhalde.

## Akzeptanzkriterien

- Korrigieren, widerrufen und löschen sind unterschiedliche sichtbare Aktionen.
- Memory-Scope und Trust sind immer sichtbar.
- Working Context wird nicht als Durable Memory dargestellt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
