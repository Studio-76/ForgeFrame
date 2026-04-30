# Codex-CLI-Auftrag: Dashboard / Command Center

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

`DashboardPage.tsx` zeigt KPI-, Alerts- und Needs-Attention-Karten, aber die Seite wirkt nicht wie eine echte Startzentrale. Sie sagt dem Operator nicht klar, was jetzt zu tun ist, welche Blocker kritisch sind und welche Produktachse zuerst geöffnet werden muss.

## Ziel der Seite

Das Dashboard wird zur echten Command-Center-Startseite: kritischer Zustand, nächster sinnvoller Arbeitsschritt, Go-Live-/Release-Reife, Security-Posture, Provider-/Routing-/Queue-/Cost-Druck und direkte Deep-Links.

## Betroffene Frontend-Dateien

- frontend/src/pages/DashboardPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/dashboard.py
- frontend/src/styles/theme.css

## Konkreter Umbauauftrag

1. Ersetze dekorative Karten durch eine priorisierte Attention-Liste mit Severity, Ursache, betroffener Achse und konkretem Deep-Link.
2. Zeige oben eine einzige klare Primäraktion: z. B. `Go-live Blocker beheben`, `Provider konfigurieren`, `Security abschließen` oder `Alles stabil`.
3. Führe Statusbereiche zusammen: Readiness, Security, Runtime, Routing/Queue, Cost. Jeder Bereich braucht Ampelstatus, Kurzgrund und nächste Aktion.
4. Wenn Dashboard-Daten fehlen, zeige einen echten Empty-/Not-configured-State mit Link zum Onboarding statt leerer Karten.
5. Entferne Navigationserklärungen aus der Seite; die Seite soll Entscheidungen treffen helfen, nicht das Menü erklären.

## Akzeptanzkriterien

- Ein Operator erkennt innerhalb von 10 Sekunden den wichtigsten nächsten Schritt.
- Jede angezeigte Warnung hat einen Link zu einer konkreten Seite.
- Keine Karte zeigt nur Rohzahlen ohne Einordnung.
- Loading, Error und Permission State sind sichtbar und verständlich.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
