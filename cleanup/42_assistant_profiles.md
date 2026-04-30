# Codex-CLI-Auftrag: Assistant Profiles

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Assistant Profiles sind persönliche/teambezogene Assistenzregeln mit Quiet Hours, Delivery Rules und Action Governance. Die Seite darf nicht nur Profil-CRUD sein.

## Ziel der Seite

Assistant Profiles wird zur Governance-Fläche für Assistenzverhalten: Profile, Scope, Quiet Hours, Delivery, erlaubte Aktionen, Evaluation und Risiken.

## Betroffene Frontend-Dateien

- frontend/src/pages/AssistantProfilesPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/assistant_profiles.py

## Konkreter Umbauauftrag

1. Liste mit Profil, Scope, Modus, Aktivstatus, quiet hours, direct-action policy, letzter Evaluation.
2. Detailpanel mit Regeln, erlaubten/gesperrten Actions, Channels, Contacts, Memory-Scope.
3. Evaluate Assistant Action als echtes Test-/Policy-Prüfwerkzeug mit Eingabe und Ergebnis.
4. Create/Edit strukturiert; Raw Policy JSON nur Advanced.
5. Zeige klare Warnung für Profile mit Außenaktionsrechten.

## Akzeptanzkriterien

- Ein Profil kann gegen eine Beispielaktion evaluiert werden.
- Quiet Hours und Delivery Rules sind sichtbar.
- High-risk/direct action wird deutlich markiert.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
