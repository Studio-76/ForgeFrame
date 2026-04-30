# Codex-CLI-Auftrag: Inbox

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Inbox ist derzeit CRUD-lastig. Die Inbox muss eine Triage-Queue sein: neu, relevant, delegiert, blockiert, wartend, erledigt, archiviert.

## Ziel der Seite

Inbox wird zur Triage-Fläche für eingehende Arbeit: Statuswechsel, Priorität, Zuordnung zu Conversation/Task/Agent, Blocker, Archive und direkte Weiterverarbeitung.

## Betroffene Frontend-Dateien

- frontend/src/pages/InboxPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/inbox.py

## Konkreter Umbauauftrag

1. Layout: links Triage-Liste mit Status/Priorität/Quelle, rechts Detail und Aktionen.
2. Statusaktionen direkt anbieten: relevant, delegieren, blockieren, warten, erledigen, archivieren, sofern API trägt.
3. Create Inbox Item als sekundärer manueller Eingang, nicht Hauptfokus.
4. Aus Inbox Item Task oder Conversation verlinken/erzeugen, wenn API vorhanden; andernfalls klare not-ready Aktion.
5. Filter nach Status, Priorität, Quelle, Agent/Owner.

## Akzeptanzkriterien

- Ein Inbox-Item kann triagiert werden.
- Wartende/blockierte Items sind erkennbar.
- Der nächste Arbeitspfad Conversation/Task ist sichtbar.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
