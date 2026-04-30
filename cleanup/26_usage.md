# Codex-CLI-Auftrag: Usage

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Usage ist ein Drilldown und sollte nicht mit Costs oder Logs verschwimmen. Es geht um Traffic, Provider-/Client-Hotspots, Modelle, Zeiträume und Druck auf Runtime.

## Ziel der Seite

Usage wird zur Nutzungsanalyse: Zeitraumfilter, Provider/Client/Model Drilldowns, Traffic-Volumen, Latenz/Fehler, Route zu Costs/Errors bei Auffälligkeiten.

## Betroffene Frontend-Dateien

- frontend/src/pages/UsagePage.tsx
- frontend/src/features/usage/UsagePage.tsx
- frontend/src/features/usage/sections.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/usage.py

## Konkreter Umbauauftrag

1. Filter oben: Zeitraum, Instanz, Provider, Client/API-Key, Modell.
2. Summary: Requests, Tokens, Streaming-Anteil, Fehlerquote, Latenz, Top-Provider, Top-Client.
3. Drilldown-Tabellen für Provider und Clients mit Deep-Links.
4. Kosten nur als Querverweis darstellen; echte Budget-/Kostensteuerung bleibt auf Costs.
5. Leere Daten als `no traffic in selected window` anzeigen, nicht als Fehler.

## Akzeptanzkriterien

- Nutzung kann nach Zeitraum und Instanz betrachtet werden.
- Top Provider/Clients sind erkennbar.
- Fehler-/Kostenauffälligkeiten verlinken zu Errors/Costs.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
