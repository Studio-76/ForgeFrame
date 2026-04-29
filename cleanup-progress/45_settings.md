Promptdatei: `cleanup/45_settings.md`

Developer-Zusammenfassung:
- Settings von einer flachen Kartenliste auf eine echte Systemkonfigurationsseite mit Gruppen, Suche, Inventartabellen und Detail-Editor umgebaut.
- Backend-Settings-Katalog um Gruppen (`runtime`, `security`, `providers`, `routing`, `tls`, `observability`, `ui`), Risk-Level, Risk-Hinweise, Confirmations und Allowed Values erweitert.
- Settings-API liefert jetzt `source`, `mutable`, `risk`, `allowed_values` und ein explizites `operation`-Ergebnis nach Patch/Reset.
- Patch- und Reset-Endpunkte aktualisieren die effektiven Werte direkt im Response und behandeln ungültige Werte sauber mit Fehlerantworten statt stillen Fehlschlägen.
- Frontend zeigt gruppierte Tabellen mit `Key`, `Label`, `Effective Value`, `Default`, `Source`, `Mutable`, `Risk`.
- Read-only-Sessions bekommen Review statt deaktivierter Editorfelder; Admins erhalten Detail-Editor und Reset-to-default mit Bestätigungsdialog für riskante Settings.

Geänderte Dateien:
- `backend/app/settings/service.py`
- `backend/app/api/admin/settings.py`
- `backend/tests/test_settings_admin_api.py`
- `frontend/src/api/admin.ts`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/tests/settings-page.test.tsx`

Audit-Ergebnis:
- `APPROVED`

Konkrete Audit-Mängel:
- Keine

Fix-Runden:
- Keine

Finale Freigabe:
- `APPROVED` durch Sub-Agent `Aquinas`

Ausgeführte Prüfkommandos:
- `cd frontend && npm test -- settings-page`
  - PASS
- `./.venv/bin/python -m pytest backend/tests/test_settings_admin_api.py backend/tests/test_settings.py`
  - PASS (`15 passed`)
- `cd frontend && npm run build`
  - PASS
- `cd frontend && npm test -- --runInBand`
  - FAIL, objektiver Tool-Blocker: dieses Projekt nutzt `vitest`, und `vitest run` kennt die Option `--runInBand` nicht (`CACError: Unknown option --runInBand`).
- `cd frontend && npm test`
  - PASS (`52` Testdateien, `211` Tests)
