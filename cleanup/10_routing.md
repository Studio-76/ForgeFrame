# Codex-CLI-Auftrag: Smart Execution Routing

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Die Routing-Seite ist eine der wichtigsten Seiten, aber sie ist sehr dicht. Sie muss simple/non-simple-Policy, Capability-Gating, Budgets, Circuit Breaker, Simulation und Entscheidungs-Explainability in eine klare Bedienlogik bringen.

## Ziel der Seite

Routing wird zum Policy-Editor und Simulator: simple/non-simple Regeln, Stage-Reihenfolge, Capability-first, Budget-/Circuit-Schutz, Dry-Run-Erklärung, Entscheidungshistorie und direkte Target-Referenzen.

## Betroffene Frontend-Dateien

- frontend/src/pages/RoutingPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/routing.py
- backend/app/api/admin/control_plane_routing_domain.py

## Konkreter Umbauauftrag

1. Oben: aktive Instanz, Policy-Status, wichtigste Blocker und Primäraktion `Policy bearbeiten` oder `Simulation starten`.
2. Policy-Editor als strukturierte Abschnitte: Klassifikation, erlaubte Target-Pools simple/non-simple, Fallbacks, Eskalation, Budgets, Circuit-Verhalten.
3. Dry-Run-Formular verständlich machen: Anfrageklasse, Capabilities, Budgetlage, Zielmodell/Provider, erwartete Lane. Ergebnis dreistufig: Kurzentscheidung, Faktoren, Rohdetails.
4. Budget und Circuit Breaker nicht als Nebenkarte verstecken; sie müssen erklären, wann Routing blockt.
5. Recent Decisions mit Grund, gewähltem Target, verworfenen Kandidaten und Link zu Logs/Execution.
6. Keine Vermischung von fachlicher Routing-Klasse und Execution-Lane.

## Akzeptanzkriterien

- Eine simple und eine non-simple Simulation zeigen nachvollziehbar unterschiedliche Target-Auswahl.
- Budget- oder Circuit-Blocker sind sichtbar und editierbar, sofern API erlaubt.
- Entscheidungsfaktoren sind menschenlesbar und technisch erweiterbar.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
