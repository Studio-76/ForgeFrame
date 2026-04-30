# Codex-CLI-Auftrag: Notifications / Outbox

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Notifications muss Outbox, Delivery Status, Preview, Retry und Reject abbilden. Aktuell ist es CRUD-lastig.

## Ziel der Seite

Notifications wird zur Zustell- und Outbox-Fläche: pending/sent/failed/rejected, Preview, Confirm/Reject/Retry, Channel/Fallback und Delivery Evidence.

## Betroffene Frontend-Dateien

- frontend/src/pages/NotificationsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/notifications.py

## Konkreter Umbauauftrag

1. Outbox-Tabelle nach Status gruppieren: pending approval/preview, queued, sent, failed, rejected.
2. Detailpanel mit Nachrichtenvorschau, Zielkontakt/Kanal, Fallback-Kette, Delivery Attempts.
3. Nutze vorhandene APIs `confirmNotification`, `rejectNotification`, `retryNotification` mit sichtbarem Ergebnis.
4. Create/Edit nur sekundär; Hauptfokus ist Zustellung kontrollieren.
5. Außenwirkung klar markieren: Draft/Preview vs echte Zustellung.

## Akzeptanzkriterien

- Eine Notification kann bestätigt, abgelehnt oder erneut versucht werden.
- Preview ist klar von Execute/Zustellung getrennt.
- Fehlgeschlagene Zustellung zeigt Grund und nächsten Schritt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
