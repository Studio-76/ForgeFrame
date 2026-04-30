# Codex-CLI-Auftrag: Agents

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Agents ist zentral für Work Interaction. Die Seite muss den verpflichtenden Operator-Agent, Rollen, Participation Modes, Mention-Fähigkeit und Profile abbilden.

## Ziel der Seite

Agents wird zur Agentenregistry pro Instanz: Operator-Agent, spezialisierte Agenten, Status, Rolle, Participation Mode, Profile-Link, Rechte und Conversation-Beteiligung.

## Betroffene Frontend-Dateien

- frontend/src/pages/AgentsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/agents.py
- frontend/src/pages/ConversationsPage.tsx

## Konkreter Umbauauftrag

1. Markiere den pro Instanz verpflichtenden `Operator` klar als Coordinator/Lead-Agent und warnen, wenn er fehlt.
2. Agenten-Tabelle mit Name, Role Kind, Status, Participation Mode, Profile, letzter Aktivität.
3. Create/Edit mit Participation Modes: silent, mentioned-only, subscribed, assigned/owner, broadcast participant.
4. Zeige, ob Agent in Conversations adressierbar ist; verlinke zu Conversations.
5. Keine freien Fantasie-Rollen ohne Backend-Abbildung.

## Akzeptanzkriterien

- Operator-Agent ist sichtbar und umbenennbar, falls API das erlaubt.
- Participation Mode ist editierbar oder sauber als read-only markiert.
- Agenten sind nicht nur UI-Dekoration, sondern echte Instanzobjekte.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
