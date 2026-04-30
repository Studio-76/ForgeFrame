# Codex-CLI-Auftrag: Security & Policies

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Security mischt Elevated Access, Admin Posture, Sessions und Provider Secret Controls. Diese Themen sind richtig, brauchen aber klare Sicherheitsarchitektur statt langer Sammelfläche.

## Ziel der Seite

Security wird zur Sicherheitszentrale: Admin-Benutzer, Sessions, Rollen/Scopes, Elevated Access, Break Glass, Provider Secrets, Credential Policy und kritische Warnungen.

## Betroffene Frontend-Dateien

- frontend/src/pages/SecurityPage.tsx
- frontend/src/features/security/SecurityPage.tsx
- frontend/src/features/security/sections.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/security.py
- backend/app/api/admin/security_admin.py

## Konkreter Umbauauftrag

1. Trenne Tabs: `Posture`, `Admin Users`, `Sessions`, `Elevated Access`, `Provider Secrets`, `Credential Policy`.
2. Zeige oben harte Security-Blocker: Default Password, fehlende Rotation, offene Sessions, Secrets missing, break-glass aktiv.
3. Admin User Create/Edit/Rotate sauber als eigene Aktionen mit Berechtigungsprüfung.
4. Sessions widerrufbar anzeigen; eigene Session besonders markieren.
5. Elevated Access Flow: Request -> Approve -> Start -> Expire/Cancel mit sichtbarem Status.
6. Provider Secret Controls zeigen missing/rotatable/blocked, aber niemals Secretwerte.

## Akzeptanzkriterien

- Security-Status ist in 30 Sekunden bewertbar.
- Provider Secrets werden nicht preisgegeben.
- Elevated Access ist als zeitlich begrenzter Ausnahmezustand sichtbar.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
