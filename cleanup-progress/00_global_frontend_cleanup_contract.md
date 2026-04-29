# Progress

- Promptdatei: `/opt/ForgeFrame/cleanup/00_global_frontend_cleanup_contract.md`
- Developer-Zusammenfassung: `Runde 1: PageIntro auf kompakten PageHeader umgebaut, neue Shared-Bausteine fuer Header/Summary/Table/Detail/Diagnostics/States eingefuehrt, Dashboard und Logs auf die neuen Bausteine migriert, Status-Tone zentralisiert.`
- Geaenderte Dateien:
  - `frontend/src/app/navigation.ts`
  - `frontend/src/components/PageIntro.tsx`
  - `frontend/src/components/layout/AppHeader.tsx`
  - `frontend/src/components/layout/AppSidebar.tsx`
  - `frontend/src/components/ui/DataTable.tsx`
  - `frontend/src/components/ui/StateBlocks.tsx`
  - `frontend/src/components/ui/StatusBadge.tsx`
  - `frontend/src/features/logs/LogsPage.tsx`
  - `frontend/src/pages/DashboardPage.tsx`
  - `frontend/src/styles/theme.css`
  - `frontend/src/theme/tokens.css`
  - `frontend/src/components/ui/PageHeader.tsx`
  - `frontend/src/components/ui/ActionBar.tsx`
  - `frontend/src/components/ui/SummaryStrip.tsx`
  - `frontend/src/components/ui/EntityTable.tsx`
  - `frontend/src/components/ui/DetailPanel.tsx`
  - `frontend/src/components/ui/AdvancedDiagnostics.tsx`
- Audit-Ergebnis: `REJECTED`
- Konkrete Audit-Maengel:
  - `LogsPage` enthaelt eine tote sichtbare Aktion `Download latest export again` via `href="#"` plus `preventDefault()`.
  - Das Akzeptanzkriterium `Mindestens drei bestehende Seiten koennen auf den neuen Layout-Bausteinen aufgebaut werden` ist noch nicht erfuellt; real migriert sind nur `Dashboard` und `Logs`.
  - `OnboardingPage` wiederholt weiterhin breite In-Page-Navigation ueber `PageIntro` und verletzt damit den Vertragszweck, Navigation in Sidebar/Header zu halten.
- Fix-Runden: `1`
- Finale Freigabe: `APPROVED`
- Ausgefuehrte Pruefkommandos:
  - `cd frontend && npm run build` -> erfolgreich
  - `cd frontend && npm test -- --runInBand` -> fehlgeschlagen, Vitest/CACError: `Unknown option --runInBand`
  - `cd frontend && npm test` -> erfolgreich, `38/38` Testdateien, `144/144` Tests
  - `rg -n '<ActionBar|<SummaryStrip|<EntityTable|<DetailPanel|<AdvancedDiagnostics|<PermissionState|<BlockedState|<EmptyState' frontend/src/pages frontend/src/features` -> Shared-Bausteine real auf `Dashboard`, `Logs` und `Usage`
  - `rg -n 'href=\"#\"|preventDefault\\(\\)' frontend/src` -> kein Placebo-Link mehr im geprueften Logs-/Usage-/Onboarding-Umbau

## Finale Freigabe

`APPROVED`

- `LogsPage` nutzt fuer den letzten Export jetzt einen echten Download-Pfad ueber einen vom API-Pfad gelieferten `Blob`; keine tote Export-Aktion mehr.
- Der Shared-Operator-Vertrag ist real auf mindestens drei Seiten im Einsatz: `Dashboard`, `Logs`, `Usage`.
- `PageIntro` erzeugt keinen Wayfinding-Gridblock mehr, und `OnboardingPage` reduziert die In-Page-CTAs auf kontextuelle Minimalnavigation.

## Re-Audit 2026-04-29

- Promptdatei: `/opt/ForgeFrame/cleanup/00_global_frontend_cleanup_contract.md`
- Developer-Zusammenfassung: `Zusatzrunde: Header-Wayfinding aus den bereits migrierten Operatorseiten herausgenommen und in kontextuelle ActionBars innerhalb der Arbeitsflaeche verlagert; blocked-State visuell auf Danger-Vertrag korrigiert; letzter ad-hoc Shared-Status in Models auf Vertragswortschatz umgestellt.`
- Geaenderte Dateien:
  - `frontend/src/features/logs/LogsPage.tsx`
  - `frontend/src/features/onboarding/OnboardingPage.tsx`
  - `frontend/src/features/usage/UsagePage.tsx`
  - `frontend/src/features/usage/sections.tsx`
  - `frontend/src/pages/HarnessPage.tsx`
  - `frontend/src/pages/ModelsPage.tsx`
  - `frontend/src/pages/OAuthTargetsPage.tsx`
  - `frontend/src/pages/ProvidersPage.tsx`
  - `frontend/src/styles/theme.css`
- Audit-Ergebnis: `REJECTED`
- Konkrete Audit-Maengel:
  - `PageIntro` trug auf bereits migrierten Operatorseiten weiterhin Route-Wayfinding statt eines kompakten Headers.
  - `BlockedState` nutzte visuell noch Info- statt Danger-Ton.
  - `ModelsPage` speiste fuer einen Shared-Summary-Status noch den nicht-kanonischen Wert `warning` ein.
- Fix-Runden: `1`
- Finale Freigabe: `APPROVED`
- Ausgefuehrte Pruefkommandos:
  - `cd frontend && npm run build` -> erfolgreich; nur nicht-blockierende Vite-Warnung zu `index`-Chunk > 500 kB
  - `cd frontend && npm test -- --runInBand` -> fehlgeschlagen, Vitest/CACError: `Unknown option --runInBand`
  - `cd frontend && npm test` -> erfolgreich, `42/42` Testdateien, `160/160` Tests
  - `rg -n "links=\\[" frontend/src/features/logs/LogsPage.tsx frontend/src/features/usage/UsagePage.tsx frontend/src/features/onboarding/OnboardingPage.tsx frontend/src/pages/ProvidersPage.tsx frontend/src/pages/OAuthTargetsPage.tsx frontend/src/pages/HarnessPage.tsx frontend/src/pages/ModelsPage.tsx` -> keine Header-Route-Links mehr auf den migrierten Operatorseiten
  - `rg -n 'status:.*warning|data-state=\"blocked\"' frontend/src/pages/ModelsPage.tsx frontend/src/styles/theme.css` -> nur noch Vertragsstatus in `ModelsPage`; blocked-State auf Danger-Styling geprueft
