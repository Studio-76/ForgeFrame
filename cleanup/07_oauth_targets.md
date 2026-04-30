# Codex-CLI-Auftrag: OAuth Targets

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Die aktuelle OAuth-Targets-Seite zeigt Account-backed Targets, Session Truth, Bridge Posture und Probes, aber sie bietet keinen klaren Weg, OpenAI Codex, GitHub Copilot, Claude Code oder andere OAuth-Achsen wirklich zu verbinden. Damit verfehlt die Seite ihren Bedienzweck.

## Ziel der Seite

OAuth Targets wird zur Verbindungs- und Betriebsseite für accountgebundene Premium-Provider: pro Provider klarer Status, unterstützte Login-Methode, Connect/Complete/Test/Bridge/Disconnect, Session-/Grant-/Refresh-Wahrheit und Advanced Diagnostics.

## Betroffene Frontend-Dateien

- frontend/src/pages/OAuthTargetsPage.tsx
- frontend/src/features/providers/ProvidersSections.tsx
- frontend/src/features/providers/useProvidersControlPlane.ts
- frontend/src/api/admin.ts
- backend/app/api/admin/control_plane_oauth_targets_domain.py
- backend/app/api/admin/control_plane_oauth_operations_domain.py
- backend/app/auth/oauth/openai.py
- backend/app/settings/config.py

## Konkreter Umbauauftrag

1. Ersetze die aktuelle Diagnosefläche durch Provider-Karten: OpenAI Codex, GitHub Copilot, Claude Code, Antigravity, Gemini optional.
2. Jede Karte braucht Status: `not configured`, `token present`, `bridge-only`, `oauth unsupported`, `runtime-ready`, `probe failed`, `expired`, `needs refresh`.
3. Implementiere klare Aktionen: `Verbinden`, `Manuell Token hinterlegen`, `Device-Code starten` falls Backend kann, `Bridge-Profil synchronisieren`, `Verbindung testen`, `Trennen`.
4. Wenn das Backend aktuell nur extern beschaffte Tokens per Env unterstützt, darf die UI nicht `Connect` vorgaukeln. Zeige dann einen manuellen Setup-Flow mit exakten fehlenden Variablen und `probe` als nachgelagerten Test.
5. Codex-spezifisch: erkläre im UI knapp, ob `manual_redirect_completion`, Device-Code oder Bridge-only vorliegt; keine vollen OAuth-Claims ohne echten Flow.
6. Session-, Grant-, Runtime-, Streaming- und Tool-Wahrheit in Advanced Diagnostics, nicht in der Hauptkarte.

## Akzeptanzkriterien

- Ein Admin versteht ohne Codekenntnis, was bei Codex OAuth aktuell möglich ist und was fehlt.
- Probe-Buttons sind klar als Test markiert, nicht als Verbindungsaktion.
- Kein OAuth-Provider wird als vollständig verbunden angezeigt, wenn nur Bridge/Token/Probe vorhanden ist.
- Codex-Setup endet mit einem sichtbaren Status und nächstem Schritt.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
