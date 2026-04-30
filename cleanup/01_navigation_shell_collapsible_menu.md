# Codex-CLI-Auftrag: Navigation und Sidebar: gruppiert, ausklappbar, standardmäßig eingeklappt

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Die Navigation enthält sehr viele Einträge. Die Sidebar ist derzeit breit, permanent sichtbar und zeigt alle Gruppen mit allen Links. Damit wirkt das Produkt erschlagend, obwohl die Informationsarchitektur grundsätzlich schon in Gruppen vorhanden ist.

## Ziel der Seite

Baue die Navigation zu einem lesbaren, gruppierten und standardmäßig eingeklappten Produktmenü um. Desktop: schmale Sidebar als Default, Gruppen per Klick/Keyboard ausklappbar, aktive Gruppe automatisch geöffnet, Zustand persistent. Mobile: Drawer-Verhalten sauber beibehalten.

## Betroffene Frontend-Dateien

- frontend/src/app/navigation.ts
- frontend/src/components/layout/AppSidebar.tsx
- frontend/src/components/layout/SidebarContext.tsx
- frontend/src/components/layout/AppHeader.tsx
- frontend/src/components/layout/icons.tsx
- frontend/src/styles/theme.css

## Konkreter Umbauauftrag

1. Ändere `SidebarProvider`: Desktop-Default ist `isExpanded=false`; Zustand in `localStorage` speichern; Mobile bleibt davon unabhängig.
2. Baue pro NavigationSection einen echten Collapse-Header mit Icon, Label, Count/Badge und `aria-expanded`. Links werden nur gezeigt, wenn Sidebar offen und Gruppe geöffnet ist.
3. Aktive Gruppe anhand aktueller Route automatisch öffnen. Beim Wechsel der Route darf die aktive Gruppe nicht verschwinden.
4. Bei kollabierter Sidebar nur Icons/kompakte Tooltips zeigen; keine abgeschnittenen Linktexte.
5. Gruppiere Navigation fachlich enger: Command, Setup, Runtime, Governance, Work, Knowledge, Extension, System. Vermeide 16 Links in einer Gruppe ohne Unterstruktur.
6. Search/Command-Palette im Header bleibt der schnelle Direktzugriff auf alle Routen und muss gruppierte Labels anzeigen.
7. Baue Accessibility: Tastaturbedienung, `aria-current`, `aria-disabled`, Fokuszustände.

## Akzeptanzkriterien

- Beim ersten Laden auf Desktop ist die Sidebar eingeklappt.
- Ein Klick auf eine Gruppe öffnet/schließt die Gruppe.
- Die aktive Route ist sichtbar und die zugehörige Gruppe geöffnet.
- Mobile Navigation funktioniert weiter als Overlay.
- Kein Link aus `CONTROL_PLANE_ROUTES` geht verloren.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
