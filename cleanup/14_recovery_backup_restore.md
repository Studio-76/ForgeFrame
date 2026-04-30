# Codex-CLI-Auftrag: Recovery / Backup / Restore

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Recovery ist umfangreich, aber es droht zu einer Formularsammlung zu werden. Ziel ist echter Recovery-, Upgrade-, Rollback- und Restore-Vertrag.

## Ziel der Seite

Recovery wird zur Betriebsfähigkeitsseite für Backups, Restore-Tests, Upgrade-/Rollback-Nachweise, Policies, Datenklassen, Source Identity und Frische.

## Betroffene Frontend-Dateien

- frontend/src/pages/RecoveryPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/recovery.py

## Konkreter Umbauauftrag

1. Trenne die Seite in `Overview`, `Policies`, `Backup Evidence`, `Restore Evidence`, `Upgrade/Rollback`.
2. Coverage Summary muss pro Datenklasse zeigen: geschützt, Backup-Ziel, letzte Sicherung, letzter Restore-Test, Risiko.
3. Policy-Create/Edit als Drawer/Modal mit strukturierten Feldern statt langer Seitenform.
4. Import von Backup-/Restore-/Upgrade-Reports mit sofortiger Validierung und sichtbarem Ergebnis.
5. Zeige hart, wenn Restore nie getestet wurde; Backup allein ist nicht grün.

## Akzeptanzkriterien

- Ein Betreiber sieht sofort, welche Datenklasse ungeschützt oder ungetestet ist.
- Restore-Test-Evidence ist getrennt von Backup-Evidence.
- Upgrade/Rollback-Posture ist sichtbar und nicht nur Text.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
