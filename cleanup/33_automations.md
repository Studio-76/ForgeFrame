# Codex-CLI-Auftrag: Automations

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Automations verwaltet wiederkehrende Regeln, muss aber echte Trigger-Historie, nächste Ausführung, Zielobjekt und Sicherheit darstellen.

## Ziel der Seite

Automations wird zur Regel- und Trigger-Fläche: Regeln, Schedule, letzter/nächster Lauf, Trigger-History, Zielaktion, Test Trigger und Governance.

## Betroffene Frontend-Dateien

- frontend/src/pages/AutomationsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/automations.py

## Konkreter Umbauauftrag

1. Automations-Liste mit Status, Schedule, Next Run, Last Run, Target, Outcome.
2. Detailpanel mit Trigger-History und verknüpften Tasks/Notifications/Runs.
3. Create/Edit mit strukturiertem Schedule-Editor; Raw Cron/JSON nur Advanced.
4. Bestehende `triggerAutomation`-API als `Jetzt testen` nutzen, Ergebnis sichtbar machen.
5. Sicherheits-/Approval-Hinweis für Automationen mit Außenwirkung.

## Akzeptanzkriterien

- Nächster Lauf und letzter Lauf sind sichtbar.
- Test Trigger erzeugt ein sichtbares Ergebnis.
- Automationen mit Außenwirkung werden nicht harmlos dargestellt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
