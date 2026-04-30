# Codex-CLI-Auftrag: Costs & Budget Controls

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Costs ist aktuell lesbarer als viele Seiten, aber muss harte Cost-Safety, Budget-Posture, blocked cost classes, circuit pressure und Kostenwahrheit noch stärker als steuerbare Funktion zeigen.

## Ziel der Seite

Costs wird zur Budget- und Cost-Safety-Seite: Budgets, actual/provider_reported/estimated/modeled/avoided, Circuit Breaker, Anomalien, blocked requests und Routing-Kostenmix.

## Betroffene Frontend-Dateien

- frontend/src/pages/CostsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/usage.py
- backend/app/api/admin/routing.py

## Konkreter Umbauauftrag

1. Trenne Kostenwahrheiten sichtbar: actual, provider_reported, estimated, modeled, avoided.
2. Budget-Posture mit Hard/Soft Limits, Verbrauch, Restbudget, Zeitraum, Blockierungsstatus.
3. Circuit Breaker pro Instanz/Provider/Cost Class mit Status und letzter Auslösung.
4. Blocked Cost Classes als konkrete Liste mit Grund und Link zur Routing-Policy.
5. Wenn Edit-Endpunkte vorhanden sind, Budget/Circuit direkt editierbar machen; sonst klar als read-only markieren.

## Akzeptanzkriterien

- Ein Operator erkennt, ob Kosten gerade blockieren oder nur warnen.
- Estimated/Modeled wird nicht als Billing-Wahrheit dargestellt.
- Routing-Kostenmix erklärt Premium-vs-Low-Cost-Nutzung.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
