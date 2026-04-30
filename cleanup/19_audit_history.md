# Codex-CLI-Auftrag: Audit History

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Audit History ist derzeit ein Abschnitt innerhalb Logs. Als eigener Navigationseintrag muss der Anchor aber wie eine eigenständige, fokussierte Evidence-Suche funktionieren.

## Ziel der Seite

Audit History wird innerhalb Logs zu einer echten Audit-Recherchefläche mit Filtern, Detailpanel, Actor/Target, Aktion, Zeitraum, Export-Verknüpfung und Deep-Link-Fähigkeit.

## Betroffene Frontend-Dateien

- frontend/src/pages/LogsPage.tsx
- frontend/src/features/logs/LogsPage.tsx
- frontend/src/app/auditHistory.ts
- frontend/src/api/admin.ts
- backend/app/api/admin/logs.py

## Konkreter Umbauauftrag

1. Stelle sicher, dass `/logs#audit-history` direkt zur Audit-History springt und den Abschnitt visuell fokussiert.
2. Filter: Zeitraum, Actor, Target, Action, Severity/Outcome, Instance.
3. Audit-Tabelle statt Kartenliste: Zeitpunkt, Actor, Action, Target, Outcome, Correlation.
4. Detailpanel mit Rohdetails nur ausklappbar; Kurzinterpretation zuerst.
5. Verlinke aus relevanten Seiten mit vorausgefüllten Audit-Filtern.

## Akzeptanzkriterien

- Audit-History ist per URL-Hash direkt nutzbar.
- Filter ändern reproduzierbar die API-Abfrage oder lokalen Ergebnisfilter.
- Ein Audit-Ereignis lässt sich detailiert öffnen.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
