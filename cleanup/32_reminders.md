# Codex-CLI-Auftrag: Reminders

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Reminders soll Due-State und Wiedervorlagen steuern, nicht nur Reminder-Datensätze verwalten.

## Ziel der Seite

Reminders wird zur Wiedervorlagenfläche: due/overdue/upcoming, Snooze/Complete/Cancel, Task-/Notification-/Automation-Linkage.

## Betroffene Frontend-Dateien

- frontend/src/pages/RemindersPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/reminders.py

## Konkreter Umbauauftrag

1. Gruppiere Reminder nach `overdue`, `due now`, `upcoming`, `completed/cancelled`.
2. Detailpanel mit Ursprung: Task, Conversation, Automation, Notification.
3. Aktionen `snooze`, `complete`, `cancel` implementieren, falls Backend vorhanden; sonst Statusänderung sauber blockieren.
4. Create/Edit als sekundärer Flow.
5. Zeige Zeitzone und genaue Fälligkeit transparent.

## Akzeptanzkriterien

- Überfällige Reminder sind sofort sichtbar.
- Ein Reminder kann bearbeitet oder sauber als nicht steuerbar klassifiziert werden.
- Reminder-Linkage zu Tasks/Notifications ist sichtbar.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
