# Codex-CLI-Auftrag: Learning

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Learning muss ein kontrollierter Persistence Loop sein. Aktuell droht es als Event-CRUD verstanden zu werden.

## Ziel der Seite

Learning wird zur Review-Fläche für Lernereignisse: Pattern Scan, Vorschläge, Entscheidungen auto_reject/auto_draft/auto_suggest/review_required/auto_promote, Promotion zu Memory/Skill und Explainability.

## Betroffene Frontend-Dateien

- frontend/src/pages/LearningPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/learning.py

## Konkreter Umbauauftrag

1. Learning Events nach Status und Entscheidung gruppieren: suggested, review_required, approved/promoted, rejected.
2. Detailpanel mit Trigger, Quelle, vorgeschlagener Promotion, Risiko, Scope, Begründung.
3. Nutze `scanLearningPatterns` als klaren Scan-Button mit Ergebnis.
4. Nutze `decideLearningEvent` mit Optionen approve/reject/promote/draft entsprechend Backend.
5. Zeige, ob Ergebnis Memory oder Skill betrifft; nicht vermischen.

## Akzeptanzkriterien

- Ein Learning Event kann fundiert entschieden werden.
- Promotion ist sichtbar und auditierbar.
- Automatisches Lernen wird nicht als unkontrollierte Magie dargestellt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
