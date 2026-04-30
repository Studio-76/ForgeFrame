# Codex-CLI-Auftrag: Provider Targets

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Provider Targets sind laut Zielbild die eigentlichen routing- und dispatchbaren Ziele. Die Seite muss daher mehr sein als Review: Sie muss Instanzbindung, Enablement, Priorität, Capability, Kostenklasse, Health und Queue-Eignung steuerbar machen.

## Ziel der Seite

Provider Targets wird zur operativen Target-Verwaltung pro Instanz: Target-Tabelle, Enable/Disable, Priorität, Capabilities, Cost/Quality, Lanes, Health, Fallback/Escalation-Zulässigkeit.

## Betroffene Frontend-Dateien

- frontend/src/pages/ProviderTargetsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/provider_targets.py
- backend/app/api/admin/control_plane_targets_domain.py

## Konkreter Umbauauftrag

1. Baue eine instanzgescopte Target-Tabelle mit Filtern nach Provider, Status, Cost Class, Quality Tier, Capability, Health.
2. Detailpanel: Auth-Typ, Modell, Capabilities, Execution Traits, Policy Flags, Kosten-/Qualitätsprofil, Queue-Eignung, letzte Probe.
3. Bestehende `updateProviderTarget`-Funktion nutzen, um enablement, priority und relevante editierbare Felder sauber zu ändern.
4. Füge Schutz ein: Premium/OAuth-Targets nicht global als Default aktivieren ohne sichtbare Warnung.
5. Verlinke Targets in Routing-Dry-Run und Provider Health.

## Akzeptanzkriterien

- Ein Admin kann ein Target aktivieren/deaktivieren und Priorität ändern.
- Unvollständig konfigurierte Targets sind nicht mit `ready` verwechselbar.
- Capabilities und Policy Flags sind getrennt dargestellt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
