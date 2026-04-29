# Promptdatei

`cleanup/42_assistant_profiles.md`

# Developer-Zusammenfassung

Assistant Profiles wurde von einer JSON-lastigen Profil-CRUD-Seite zu einer echten Governance-Flaeche fuer Assistenzverhalten umgebaut. Die Inventartabelle zeigt jetzt Profil, Scope, Operating Mode, Aktivstatus, Quiet-Hours-Zusammenfassung, Direct-Action-Posture und die letzte persistierte Evaluation. Damit ist sofort sichtbar, welche Profile persoenlich oder teamweit gelten, welche Memory-Posture sie haben und wo echte Aussenaktionsrechte bestehen.

Die Detailansicht fuehrt Scope, Memory-Scope, Quiet Hours, Delivery Rules, Action Governance, erlaubte und gesperrte Aktionen, Channels, Contacts, Mail-/Calendar-Sources und die letzte Policy-Evaluation zusammen. Profiles mit Aussenaktionsrechten werden mit einer klaren Risiko-Warnung markiert. `evaluate-action` ist jetzt kein Wegwerf-Check mehr, sondern persistiert die letzte Evaluation in der Profil-Truth, so dass sie in Liste und Detail wieder auftaucht.

Create/Edit wurde auf strukturierte Felder fuer Scope, Memory, Communication, Quiet Hours, Delivery und Action Governance umgestellt. Rohe Policy-JSON ist nur noch im Advanced-Bereich erlaubt. Backend-seitig liefern die Vertraege nun Scope-/Memory-Labels, Operating-Mode, Direct-Action-Labels, Risk-Warnings, Allowed/Blocked Actions und `last_evaluation`. Zusaetzlich kann `update_profile` explizite `null`-Clears fuer Contact- und Source-Links jetzt sauber von ausgelassenen Feldern unterscheiden.

# Geaenderte Dateien

- `frontend/src/pages/AssistantProfilesPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/assistant-profiles-page.test.tsx`
- `backend/app/api/admin/assistant_profiles.py`
- `backend/app/assistant_profiles/models.py`
- `backend/app/assistant_profiles/service.py`
- `backend/tests/test_assistant_profiles_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Keine. Aquinas hat den umgesetzten Stand fuer Prompt 42 ohne Nachbesserungsrunde freigegeben.

# Fix-Runden

- `0`

# Finale Freigabe

`APPROVED`

`APPROVED:

\`frontend/src/pages/AssistantProfilesPage.tsx\`, \`frontend/src/api/admin.ts\`, \`backend/app/api/admin/assistant_profiles.py\`, \`backend/app/assistant_profiles/models.py\`, and \`backend/app/assistant_profiles/service.py\` satisfy Prompt 42 as a real assistant-governance surface. The inventory renders the required scope/mode/status/quiet-hours/direct-action/last-evaluation truth, the detail panel exposes rules/actions/channels/contacts/memory scope with a clear external-action risk warning, \`evaluate-action\` is a real persisted policy check that feeds \`last_evaluation\`, and create/edit stay structured with raw policy JSON confined to the advanced section; the frontend/backend tests directly cover persistence, evaluation semantics, scope clearing, and last-evaluation visibility.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- assistant-profiles-page` -> erfolgreich, `2` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_assistant_profiles_admin_api.py` -> erfolgreich, `4` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `52` Testdateien und `208` Tests bestanden
