# Codex-CLI-Auftrag: Contacts

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Contacts sind Teil der Work-Interaction-Schicht und müssen Quelle, Kanäle, Verknüpfungen und Memory-Bezüge zeigen, nicht nur Stammdatensätze.

## Ziel der Seite

Contacts wird zur Kontaktverwaltung mit Source Truth, Channel Bindings, linked Conversations/Tasks/Notifications und Memory-Referenzen.

## Betroffene Frontend-Dateien

- frontend/src/pages/ContactsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/contacts.py

## Konkreter Umbauauftrag

1. Tabelle mit Name, Organisation, Source, Channels, letzter Kontakt, verknüpfte Conversations.
2. Detailpanel mit Channel-Adressen, source/provenance, consent/visibility falls vorhanden, Memory/Conversation-Links.
3. Create/Edit mit strukturierten Kontaktfeldern; freie JSON-Metadata nur Advanced.
4. Zeige Konflikte oder unvollständige Kontaktwege als Warning.
5. Verlinke zu Notifications und Conversations.

## Akzeptanzkriterien

- Ein Kontakt zeigt, über welche Kanäle er erreichbar ist.
- Quelle/Provenienz ist sichtbar.
- Verknüpfte Work-Objekte sind erreichbar.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
