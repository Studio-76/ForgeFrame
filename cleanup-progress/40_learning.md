# Promptdatei

`cleanup/40_learning.md`

# Developer-Zusammenfassung

Learning wurde von einer flachen Event-CRUD-Seite zu einer Review-Flaeche fuer kontrollierte Persistenz umgebaut. Die Inventarsicht gruppiert Events jetzt nach `Suggested`, `Review required`, `Approved / promoted` und `Rejected` statt nur nach rohem Backend-Status. Jede Zeile zeigt Quelle, vorgeschlagenen Entscheidungsweg, Target/Scope, Risikolevel und Outcome, damit automatische Lernsignale nicht wie unkontrollierte Magie wirken.

Die Detailansicht fuehrt Trigger, Quelle, Explainability, vorgeschlagene Promotion, Risiko und reale Outcome-Links zusammen. Pattern Scan ist als echte Aktion mit sichtbarem Resultat vorhanden. Entscheidungen werden nicht mehr als generischer JSON-Blob behandelt, sondern als klare Pfade `Approve as history only`, `Reject`, `Promote boot memory`, `Promote durable memory`, `Draft skill` und `Require review`. Memory- und Skill-Promotion werden sichtbar getrennt; Durable-Memory-Promotion mit `runtime_inferred` oder `external_unverified` Trust verlangt jetzt eine Review-Schedule mit Datum/Notiz und blockiert den Submit vorher.

Backend-seitig liefern Learning-Vertraege jetzt abgeleitete Review-/Proposal-/Outcome-/Risk-Semantik fuer die UI. Die Decision-Logik wurde so umgebaut, dass bei fehlgeschlagener Memory- oder Skill-Promotion keine partielle Auditspur auf dem Learning Event stehen bleibt. Die Tests decken die neue Gruppierungs-/Explainability-Semantik, den Review-Gating-Pfad fuer Durable Memory und den Rollback bei fehlgeschlagener Promotion ab.

# Geaenderte Dateien

- `frontend/src/pages/LearningPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/learning-page.test.tsx`
- `backend/app/learning/models.py`
- `backend/app/learning/service.py`
- `backend/tests/test_learning_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- `frontend/src/pages/LearningPage.tsx` bot zunaechst keine Review-Schedule-Steuerung fuer Durable-Memory-Promotion mit `runtime_inferred` / `external_unverified` Trust.
- `frontend/tests/learning-page.test.tsx` deckte anfangs eine ungueltige Durable-Memory-Promotion ohne Review-Metadaten als erfolgreichen Pfad ab.
- `backend/app/learning/service.py` schrieb zuerst Audit-Felder wie `decided_at`, `decision_note` und `human_override`, bevor Memory-/Skill-Promotion erfolgreich abgeschlossen war.
- `backend/tests/test_learning_admin_api.py` pruefte den Rollback bei fehlgeschlagener Promotion zunaechst nicht.

# Fix-Runden

- `1`

# Finale Freigabe

`APPROVED`

`APPROVED

The previously rejected paths are now closed in the actual code. frontend/src/pages/LearningPage.tsx visibly requires and serializes metadata.review for durable memory with runtime_inferred / external_unverified trust, and frontend/tests/learning-page.test.tsx now proves both the blocked missing-review path and the valid reviewed promotion path. backend/app/learning/service.py no longer writes partial decision audit state before promotion succeeds, and backend/tests/test_learning_admin_api.py now covers rollback on failed durable-memory promotion so the event stays pending with no leaked decided_at, decision_note, override, or promoted IDs.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- learning-page` -> erfolgreich, `2` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_learning_admin_api.py` -> erfolgreich, `4` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_learning_admin_api.py backend/tests/test_knowledge_memory_admin_api.py` -> erfolgreich, `12` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `51` Testdateien und `206` Tests bestanden
