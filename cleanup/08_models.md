# Codex-CLI-Auftrag: Models Register

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Die Models-Seite zeigt ein Persistenzregister, ist aber noch zu passiv. Modelle sind Routing- und Target-Wahrheit, nicht nur eine Liste.

## Ziel der Seite

Models wird zur Modellregister-Seite mit Suche, Capability-/Trust-Filter, Source/Observed/Tested-Evidence, Mapping zu Provider Targets und klaren stale/disabled/removed-Zuständen.

## Betroffene Frontend-Dateien

- frontend/src/pages/ModelsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/control_plane_models.py
- backend/app/api/admin/models.py

## Konkreter Umbauauftrag

1. Baue eine filterbare Tabelle: Modell, Provider, Routing-Key, Status, Capability-Profil, Quelle/Trust, letzte Discovery, Target-Abdeckung.
2. Füge Detailpanel mit deklarierter vs beobachteter vs testverifizierter Capability hinzu.
3. Zeige stale/removed/disabled klar und verhindere, dass diese Modelle als aktive Routingziele wirken.
4. Verlinke pro Modell zu Provider, Provider Targets und Routing-Policy.
5. Wenn Discovery/Sync-Endpunkte vorhanden sind, füge eine echte Sync-Aktion hinzu; sonst sauberer not-ready Zustand.

## Akzeptanzkriterien

- Modelle sind nach Provider, Capability und Status filterbar.
- Capability-Herkunft ist sichtbar.
- Ein Modell ohne Target-Abdeckung ist als nicht routingfähig erkennbar.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
