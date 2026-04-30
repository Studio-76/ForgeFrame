# Codex-CLI-Auftrag: Globaler Frontend-Aufräumvertrag

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Das Frontend wirkt aktuell wie eine Sammlung von Admin-, Audit-, Debug- und Diagnoseflächen. Viele Seiten verwenden lange PageIntro-Wayfinding-Blöcke, viele Karten, technische Begriffe und verstreute Aktionen. Das Zielbild fordert ein hochwertiges B2B-Control-Plane-Produkt, aber es definiert nicht ausreichend konkrete Page-Journeys. Daher muss aus jeder Seite ein klarer Arbeitsfluss werden: Überblick -> Einordnung -> Detail -> Aktion.

## Ziel der Seite

Schaffe einen verbindlichen UI-Kontrakt, den alle folgenden Seitenumbauten verwenden: kompakte Seitentitel, klare Primäraktion, tabellarische Hauptflächen, Detail-Drawer/Panel, echte Empty-/Loading-/Error-/Permission-Zustände, Advanced-Diagnostics hinter expliziten Toggles und keine Wiederholung von Navigation innerhalb jeder Seite.

## Betroffene Frontend-Dateien

- frontend/src/components/PageIntro.tsx
- frontend/src/styles/theme.css
- frontend/src/theme/tokens.css
- frontend/src/app/navigation.ts
- frontend/src/components/layout/AppShell.tsx
- frontend/src/components/layout/AppSidebar.tsx
- frontend/src/components/layout/AppHeader.tsx

## Konkreter Umbauauftrag

1. Reduziere `PageIntro` auf einen kompakten, optionalen PageHeader. Entferne seitenweite Wayfinding-Kachelwüsten aus Standardseiten; Navigation gehört in Sidebar/Header, nicht auf jede Arbeitsfläche.
2. Lege wiederverwendbare UI-Bausteine an: `PageHeader`, `SummaryStrip`, `EntityTable`, `DetailPanel`, `AdvancedDiagnostics`, `ActionBar`, `EmptyState`, `PermissionState`, `BlockedState`.
3. Definiere ein klares Layout-Muster für dichte Operatorflächen: oben Status/Primäraktion, links Liste/Tabelle, rechts Detail/Aktion, unten/ausklappbar Diagnose.
4. Vereinheitliche Status-Töne für `ready`, `runtime-ready`, `partial`, `degraded`, `blocked`, `unsupported`, `bridge-only`, `onboarding-only`, `waiting_approval`, `budget_blocked`, `circuit_open`.
5. Baue keine Mockdaten ein. Jede neue Anzeige muss aus vorhandenen API-Daten kommen oder als echter Blocker/Empty-State dargestellt werden.

## Akzeptanzkriterien

- Mindestens drei bestehende Seiten können auf den neuen Layout-Bausteinen aufgebaut werden, ohne individuelle Sonder-CSS-Wüsten.
- PageIntro erzeugt nicht mehr automatisch eine Wayfinding-Grid-Fläche auf jeder Seite.
- Alle alten CSS-Klassen bleiben nur dort erhalten, wo sie noch verwendet werden; tote Styles werden entfernt oder konsolidiert.
- Frontend-Build ist grün.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
