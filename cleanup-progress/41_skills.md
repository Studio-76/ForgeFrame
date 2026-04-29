# Promptdatei

`cleanup/41_skills.md`

# Developer-Zusammenfassung

Skills wurde zu einer echten Skill-Registry umgebaut. Die Inventartabelle zeigt jetzt Name, Version, Status, Approval-Posture, Scope, aktive Scope-Flaechen, letzte Nutzung und letztes Outcome statt einer flachen Liste. Damit ist sofort sichtbar, welche Skills nur Drafts sind, welche aktiv genutzt werden und in welchem Scope sie tatsaechlich laufen.

Die Detailansicht fuehrt Registry-Overview, Provenienz, Boundary-Abgrenzung zu Plugin/Harness/Target, Versionen, Aktivierungen, Usage-Telemetrie und Recent Usage zusammen. Aktivierung ist nun scopebewusst und konfigurierbar ueber Version, Scope und Aktivierungsbedingungen. Archivieren bleibt eine eigene Lifecycle-Aktion und wird sichtbar von Loeschen getrennt. `recordSkillUsage` schreibt strukturierte Telemetrie mit Outcome-Mix; `activateSkill` und `archiveSkill` liefern klare, sichtbare Ergebnisse.

Create/Edit wurde von rohen JSON-Sammelfeldern auf strukturierte Registry-Felder fuer Provenienz, Default-Activation-Posture und Metadaten umgestellt. Backend-seitig liefern Skill-Vertraege jetzt Scope-Labels, Approval-Posture, Provenienz-Zusammenfassung, Telemetry-Summary, aktive Scope-Labels und Version-Nummern in Usage-Events. Der ehemals defekte Scope-Wechsel von `agent` nach `instance` leert `scope_agent_id` jetzt korrekt und ist im Frontend- und Backend-Test abgesichert.

# Geaenderte Dateien

- `frontend/src/pages/SkillsPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/skills-page.test.tsx`
- `backend/app/skills/models.py`
- `backend/app/skills/service.py`
- `backend/tests/test_skills_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- `backend/app/skills/service.py` konnte beim Scope-Wechsel von `agent` nach `instance` ein explizites `scope_agent_id: null` nicht von einem ausgelassenen Feld unterscheiden; der UI-Pfad war dadurch teilweise nicht funktionsfaehig.
- Die Regression auf diesem Scope-Clear-Pfad war anfangs weder im Frontend- noch im Backend-Test explizit abgedeckt.

# Fix-Runden

- `1`

# Finale Freigabe

`APPROVED`

`APPROVED

The previously broken scope-clear path is now correctly implemented and covered. frontend/src/pages/SkillsPage.tsx still sends scope_agent_id: null when switching to instance scope, and backend/app/skills/service.py now uses payload.model_fields_set to distinguish an explicit clear from an omitted field, so agent-to-instance transitions persist with scope_agent_id=None and scope_label="Instance scope" instead of failing validation. The regression coverage is real: frontend/tests/skills-page.test.tsx now asserts the update payload clears the scoped agent, and backend/tests/test_skills_admin_api.py explicitly exercises the persisted agent -> instance transition before activation.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- skills-page` -> erfolgreich, `2` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_skills_admin_api.py` -> erfolgreich, `1` Test bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_skills_admin_api.py backend/tests/test_learning_admin_api.py backend/tests/test_knowledge_memory_admin_api.py` -> erfolgreich, `13` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `52` Testdateien und `208` Tests bestanden
