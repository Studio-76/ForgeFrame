# Codex-CLI-Auftrag: Providers

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

`ProvidersPage` zieht sehr viele Provider-Control-Plane-Sektionen zusammen. Dadurch verschwimmen Provider-Onboarding, Provider-Inventar, Kompatibilität, Expansion Targets, Health Runs und Harness. Die Seite wirkt wie ein Sammelbecken.

## Ziel der Seite

Providers wird zur klaren Provider-Verwaltung: Provider hinzufügen/konfigurieren, Status prüfen, Kompatibilität sehen, Provider aktivieren/deaktivieren, Health auslösen. OAuth und Harness werden nur verlinkt oder als kompakte Cross-Reference geführt.

## Betroffene Frontend-Dateien

- frontend/src/pages/ProvidersPage.tsx
- frontend/src/features/providers/ProvidersSections.tsx
- frontend/src/features/providers/useProvidersControlPlane.ts
- frontend/src/api/admin.ts
- backend/app/api/admin/providers.py
- backend/app/api/admin/control_plane_provider_domain.py

## Konkreter Umbauauftrag

1. Trenne Provider-Hauptseite von OAuth Targets und Harness. Auf Providers bleiben nur Provider-Inventar, Add/Edit/Enable/Disable/Sync, Kompatibilitätskurzstatus und Health.
2. Baue Provider-Karten oder Tabelle mit Spalten: Provider, Achse, Auth-Art, Runtime-Status, Health, Modelle, Targets, letzte Probe, nächste Aktion.
3. Füge eine echte `Provider hinzufügen`-Aktion mit unterstützten Providerklassen ein: OpenAI-kompatibel, lokal/Ollama, OAuth/account-backed, Custom.
4. Begriffe wie `product axis contract` nur im Advanced-Diagnostics-Bereich anzeigen.
5. Health-Runs auf dieser Seite als kompakte, fokussierte Provider-Health-Fläche führen; Detaildiagnose optional ausklappen.

## Akzeptanzkriterien

- Ein neuer Provider kann angelegt oder bestehender Provider bearbeitet/aktiviert/deaktiviert werden.
- OAuth-Provider zeigen klar `connect required` statt nur Diagnose.
- Harness-Profile sind nicht mehr primärer Seiteninhalt.
- Provider-Health ist direkt erreichbar und nicht in einer Wand aus Karten versteckt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
