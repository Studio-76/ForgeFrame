# Codex-CLI-Auftrag: Channels

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Channels sollen Zustellkanäle mit Fallback, Status und Notification-Linkage verwalten. Aktuell wirkt es wie generisches CRUD.

## Ziel der Seite

Channels wird zur Zustellkanalverwaltung: Kanaltyp, Status, Credentials-Posture, Fallback, Testzustellung, letzte Notifications und Fehler.

## Betroffene Frontend-Dateien

- frontend/src/pages/ChannelsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/channels.py

## Konkreter Umbauauftrag

1. Tabelle mit Channel, Typ, Status, Scope, Fallback-Rang, letzter Erfolg, letzter Fehler.
2. Detailpanel mit Credential/Secret-Posture ohne Secretwerte.
3. Test-Send nur implementieren, wenn Backend trägt; sonst sichtbarer not-ready Zustand.
4. Fallback-Kette pro Instanz/Kontakt sichtbar machen.
5. Create/Edit strukturiert nach Channel-Typ; Raw Metadata nur Advanced.

## Akzeptanzkriterien

- Zustellkanäle sind nach Status und Typ filterbar.
- Credentials werden nie angezeigt.
- Fallback-Posture ist erkennbar.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
