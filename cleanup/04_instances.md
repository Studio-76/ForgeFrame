# Codex-CLI-Auftrag: Instances

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Die Instances-Seite bietet Inventory, Create und Edit, aber sie macht nicht klar genug, dass Instanzen der verpflichtende Produktkern sind. Es fehlen handlungsorientierte Folgepfade: Operator-Agent, Provider Targets, Routing, Conversations, Budgets und Readiness je Instanz.

## Ziel der Seite

Instances wird zur zentralen Instanzverwaltung: Tabelle, Detailpanel, Create/Edit, Instanzstatus, zugehöriger Operator-Agent, Provider-/Routing-/Work-Interaction-Readiness und direkte Setup-Aktionen.

## Betroffene Frontend-Dateien

- frontend/src/pages/InstancesPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/instances.py
- backend/app/api/admin/agents.py
- frontend/src/components/InstanceScopeCard.tsx

## Konkreter Umbauauftrag

1. Baue eine echte Tabelle mit Suche/Filter nach Status, Betriebsmodus, Tenant/Organisation und Readiness.
2. Detailpanel pro Instanz: Stammdaten, Mode, Operator-Agent, Provider Targets, Routing Policy, Work-Interaction-Status, letzte Aktivität.
3. Beim Erstellen einer Instanz muss sichtbar werden, ob automatisch ein `Operator`-Agent angelegt wurde; falls Backend fehlt, implementiere oder zeige harten Blocker.
4. Füge Deep-Link-Aktionen hinzu: `Targets konfigurieren`, `Routing bearbeiten`, `Conversation öffnen`, `API-Key ausstellen`, `Readiness prüfen`.
5. Entferne generische Erklärungskarten, die keine Aktion auslösen.

## Akzeptanzkriterien

- Eine neue Instanz kann über die Seite angelegt und danach direkt weiter konfiguriert werden.
- Instanz ohne Operator-Agent wird als defekter Zustand angezeigt.
- Instanzscope in der URL bleibt bei Navigation erhalten.
- Build grün.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
