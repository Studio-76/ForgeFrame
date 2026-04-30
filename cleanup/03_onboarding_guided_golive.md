# Codex-CLI-Auftrag: Onboarding / Bootstrap / Readiness

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Die Onboarding-Seite ist bereits umfangreich, aber sie wirkt mehr wie eine Readiness-Sammlung als ein geführter Erstnutzungsprozess. Das Zielbild verlangt verständliche Betriebsarten, erste Instanz, Providerwahl, Routingdefaults, HTTPS/FQDN und First Success.

## Ziel der Seite

Baue daraus einen echten Wizard mit messbarem Fortschritt: Betriebsart wählen, erste Instanz erzeugen, Operator-Agent bestätigen, Provider/Target verbinden, Routing simple/non-simple setzen, Runtime-Key ausgeben, HTTPS/FQDN prüfen, First Success ausführen.

## Betroffene Frontend-Dateien

- frontend/src/pages/OnboardingPage.tsx
- frontend/src/features/onboarding/OnboardingPage.tsx
- frontend/src/features/onboarding/sections.tsx
- frontend/src/features/onboarding/helpers.ts
- frontend/src/api/admin.ts
- backend/app/api/admin/control_plane_bootstrap_domain.py
- backend/app/api/admin/instances.py
- backend/app/api/admin/keys.py

## Konkreter Umbauauftrag

1. Ersetze lose Readiness-Abschnitte durch Wizard-Schritte mit Status `done/current/blocked/skipped`.
2. Implementiere die Auswahl `Nur ich`, `Mein Team / meine Firma`, `Mehrere Kunden / Organisationen` und mappe sie sichtbar auf internen Betriebsmodus, Tenant-Erfordernis und Rollenmodell.
3. Erzeuge oder verlinke die erste Instanz direkt aus dem Wizard. Stelle sicher, dass der Default-Agent `Operator` als Produktobjekt sichtbar wird.
4. Baue Provider-/Target-Erstauswahl mit ehrlichem Status: lokal, API-Key, OAuth bridge-only, unsupported.
5. Führe simple/non-simple Routingdefault als verständliche Entscheidung ein: simple billig/lokal, non-simple Premium/OAuth.
6. Baue einen First-Success-Test: Runtime-Key vorhanden, `/v1/models` oder Chat-Probe erfolgreich, Ergebnis sichtbar.
7. FQDN/TLS nur dann als erfolgreich zeigen, wenn API-Evidence vorhanden ist; sonst klarer Blocker.

## Akzeptanzkriterien

- Onboarding kann ohne Shell-Wissen mindestens eine nutzbare Instanz und einen Runtime-Key herstellen.
- Jeder Schritt hat einen realen Status aus API/Persistenz.
- Bridge-only/OAuth-Lücken werden nicht als vollständig verbunden dargestellt.
- Onboarding endet mit einer konkreten Go-live-Zusammenfassung.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
