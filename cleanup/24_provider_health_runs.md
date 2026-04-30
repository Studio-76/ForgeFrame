# Codex-CLI-Auftrag: Provider Health & Runs Anchor

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Der Navigationseintrag `Provider Health & Runs` springt derzeit auf `/providers#provider-health-runs`. Damit muss auf Providers eine echte, fokussierbare Health-Run-Fläche existieren, nicht nur ein zufälliger Abschnitt.

## Ziel der Seite

Baue auf der Providers-Seite einen direkten Health-&-Runs-Abschnitt mit Anchor, Provider-Probes, letzten Runs, Fehlern und Deep-Links zu Provider/OAuth/Targets.

## Betroffene Frontend-Dateien

- frontend/src/pages/ProvidersPage.tsx
- frontend/src/features/providers/ProvidersSections.tsx
- frontend/src/app/navigation.ts
- frontend/src/api/admin.ts

## Konkreter Umbauauftrag

1. Füge einen stabilen DOM-Anchor `id="provider-health-runs"` an der richtigen Stelle ein.
2. Beim Öffnen mit Hash soll der Abschnitt sichtbar/fokussiert sein.
3. Health-Run-Tabelle: Provider, Target/Model, letzter Run, Status, Fehler, nächste Aktion.
4. Aktionen: Health Check ausführen, Probe anzeigen, zu OAuth/Targets wechseln.
5. Wenn Provider-Seite global aufgeräumt wird, bleibt dieser Abschnitt trotzdem als fokussierte Operations-Fläche erhalten.

## Akzeptanzkriterien

- Navigationseintrag führt zuverlässig zum Health-&-Runs-Abschnitt.
- Health Runs sind als eigene Aufgabe erkennbar.
- Fehler verlinken zu konkreten Setup-/OAuth-/Target-Seiten.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
