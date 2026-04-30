# Codex-CLI-Auftrag: Login und Password Rotation

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Login und Password Rotation sind nicht in der Hauptnavigation, prägen aber den ersten Eindruck und die Sicherheit. Sie müssen sauber, knapp und vertrauenswürdig sein.

## Ziel der Seite

Login und Passwortrotation werden zu klaren Security-Flows: Admin Login, Sessionfehler, Pflichtrotation, neue Passwortregeln, Erfolg und Rückkehr zur Control Plane.

## Betroffene Frontend-Dateien

- frontend/src/pages/LoginPage.tsx
- frontend/src/pages/PasswordRotationPage.tsx
- frontend/src/features/auth/PasswordRotationGate.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/auth.py

## Konkreter Umbauauftrag

1. Login-Seite optisch an neue Premium-Control-Plane anpassen, aber minimal halten.
2. Fehlerzustände klar und sicher anzeigen, ohne sensitive Details.
3. Password Rotation: Regeln/Anforderungen vor Eingabe sichtbar machen.
4. Nach erfolgreicher Rotation Session-State aktualisieren und zur vorherigen Zielroute oder Dashboard führen.
5. Keine Navigation in geschützte Bereiche erlauben, solange `must_rotate_password` aktiv ist.

## Akzeptanzkriterien

- Login/Rotation sind keyboard- und screenreader-tauglich.
- Pflichtrotation kann abgeschlossen werden und öffnet danach die Control Plane.
- Fehler sind verständlich und sicher.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
