# Codex-CLI-Auftrag: Conversations

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Conversations ist mit 1292 Zeilen eine große CRUD-/Detailseite, aber das Zielbild verlangt einen zentralen Arbeitsbereich pro Instanz mit Agent-Mentions, Threads, Sessions, Runs, Tasks, Approvals und Artefakten.

## Ziel der Seite

Conversations wird zur primären Work-Interaction-Fläche: Conversation-Liste, Thread-/Session-Verlauf, Message Composer mit @Agent-Mention, Links zu Tasks/Runs/Approvals/Artifacts und Conversation Lenses.

## Betroffene Frontend-Dateien

- frontend/src/pages/ConversationsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/conversations.py
- backend/app/api/admin/agents.py

## Konkreter Umbauauftrag

1. Reduziere CRUD-Dominanz. Hauptlayout: links Conversation/Thread-Liste, Mitte Verlauf, rechts Kontext/Objekte.
2. Message Composer mit strukturierter Agent-Auswahl/Mention vorbereiten. Wenn Backend Mention-Referenzen nicht trägt, implementiere minimal oder zeige Feature als blockiert.
3. Zeige Beiträge nach Teilnehmer: Mensch, Agent, Systemereignis. Agenten nicht als freier Text verstecken.
4. Conversation Lenses: Filter nach Agent, an/von Agent, Thread, Task/Run/Approval-Verknüpfung.
5. Create/Edit Conversation als sekundäre Aktionen; Hauptfunktion ist Arbeit fortsetzen.
6. Verlinke Tasks, Runs, Approvals, Workspaces und Artifacts sichtbar.

## Akzeptanzkriterien

- Eine Conversation lässt sich öffnen und als Verlauf benutzen, nicht nur bearbeiten.
- @Agent-Adressierung ist strukturiert oder ehrlich als fehlender Backend-Support markiert.
- Thread/Session-Kontext ist sichtbar.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
