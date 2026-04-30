# Codex-CLI-Auftrag: Audit Export

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Audit Export ist ein eigener Navigationseintrag, aber darf nicht nur ein Formular innerhalb Logs bleiben. Export ist Governance-Artefakt mit Zeitraum, Scope, Inhalt, Format und Ergebnis.

## Ziel der Seite

Audit Export wird zu einem klaren Evidence-Package-Flow: Scope wählen, Zeitraum setzen, Inhalte auswählen, Export generieren, Ergebnis herunterladen/verlinken, Fehler sauber anzeigen.

## Betroffene Frontend-Dateien

- frontend/src/pages/LogsPage.tsx
- frontend/src/features/logs/LogsPage.tsx
- frontend/src/app/auditHistory.ts
- frontend/src/api/admin.ts
- backend/app/api/admin/logs.py

## Konkreter Umbauauftrag

1. Stelle sicher, dass `/logs#audit-export` direkt zum Export-Panel springt.
2. Export-Formular mit klaren Feldern: Instance, Zeitraum, Actor/Action optional, Format, Include Raw Details.
3. Nach `generateAuditExport` Ergebnis sichtbar machen: Dateiname/Artefakt-ID/Größe/Zeitraum/Download oder API-Antwort.
4. Export-Fehler nicht als generisches Alert anzeigen, sondern mit Ursache und Korrekturhinweis.
5. Export von History Review trennen; History nutzt Filter, Export erzeugt Evidence Package.

## Akzeptanzkriterien

- Audit-Export kann aus der Navigation direkt gestartet werden.
- Export-Ergebnis ist sichtbar und nutzbar.
- Der Benutzer versteht, was im Export enthalten ist.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
