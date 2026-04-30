# Codex-CLI-Auftrag: Approvals

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Approvals ist die zentrale Freigabeseite, darf aber nicht nur eine gemeinsame Queue sein. Execution-Approvals und Elevated-Access-Approvals brauchen klare Typisierung, Detailansicht, Risiko, Vorschau und Entscheidung.

## Ziel der Seite

Approvals wird zur echten Entscheidungsfläche: Queue, Filter, Detail, Preview/Evidence, Approve/Reject, Audit-Link und klare Trennung von Freigabeentscheidung vs Run-Steuerung.

## Betroffene Frontend-Dateien

- frontend/src/pages/ApprovalsPage.tsx
- frontend/src/features/approvals/ApprovalsPage.tsx
- frontend/src/features/approvals/sections.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/approvals.py

## Konkreter Umbauauftrag

1. Baue oben Filter nach Typ, Status, Risiko, Instanz, Fälligkeit, Approval-Klasse.
2. Liste/Tabelle zeigt: Typ, Antragsteller, Ziel, Risiko, Status, Alter, nächster Schritt.
3. Detailpanel: Action Preview, Evidence, betroffene Identität/Scope, Konsequenz, Audit-Historie.
4. Approve/Reject erfordern optional Kommentar und zeigen danach bestätigtes Ergebnis.
5. Keine Vermischung von `approve/reject` mit `pause/resume/retry` von Runs.

## Akzeptanzkriterien

- Ein Approver kann eine Freigabeentscheidung fundiert treffen.
- High-Risk/Irreversible wird sichtbar schärfer dargestellt.
- Entscheidung erzeugt sichtbaren Statuswechsel und Audit-Link.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
