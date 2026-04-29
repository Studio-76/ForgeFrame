Promptdatei: `/opt/ForgeFrame/cleanup/16_api_keys.md`

Developer-Zusammenfassung:
- `ApiKeysPage` wurde von einer Kartenliste auf eine echte Schluesselverwaltungsoberflaeche mit Tabelle, Filterleiste, Summary-Metriken, Issue-Drawer, rechter Detailflaeche und separater Request-Path-Policy-Sektion umgebaut.
- Der Issue-/Rotate-Flow zeigt Secrets nur aus den echten Create/Rotate-Responses und praesentiert sie einmalig mit Warntext und Copy-Button.
- Rotation und Lifecycle wurden sauber getrennt: Rotation ist eine eigene Aktion, Statuswechsel (`activate`, `disable`, `revoke`) liegen in einem separaten Bereich.
- Account-Fokus aus `15_accounts` bleibt erhalten: `accountId` filtert die Key-Liste sichtbar auf die betroffenen Keys.
- Der Auditor fand zusaetzlich einen echten Backend-Sicherheitsmangel: `secret_hash` wurde in Runtime-Key-Responses serialisiert. Das wurde im Backend redigiert und mit einem API-Test abgesichert.

Geaenderte Dateien:
- `frontend/src/pages/ApiKeysPage.tsx`
- `frontend/tests/api-keys-page.test.tsx`
- `frontend/tests/governance-tenant-scope.test.tsx`
- `frontend/tests/audit-handoff-links.test.tsx`
- `backend/app/api/admin/keys.py`
- `backend/tests/test_admin_keys_redaction.py`

Audit-Ergebnis:
- Erste Audit-Runde: `REJECTED`
- Zweite Audit-Runde: `APPROVED`

Konkrete Audit-Maengel:
- Backend serialisierte `RuntimeKeyRecord.model_dump()` direkt und damit `secret_hash` an den Browser fuer Inventory-, Lifecycle- und Policy-Responses.

Fix-Runden:
- Runde 1:
  - API-Keys-Seite komplett neu aufgebaut: Tabelle mit `Label`, `Account`, `Instance Scope`, `Erlaubte Pfade`, `Status`, `Created`, `Last Used`, `Rotation`.
  - Issue-Drawer mit Validierung implementiert.
  - One-Time-Secret-Flaeche mit Copy-Button und Dismiss implementiert.
  - Rotation, Statuswechsel und Request-Path-Policy in getrennte Detailsektionen aufgeteilt.
  - Fokus-Handoff `accountId` sichtbar in der Key-Inventaransicht fortgefuehrt.
  - Frontend-Tests fuer Issue/Rotate/Status/Policy/Read-only hinzugefuegt.
- Runde 2:
  - Backend-Redaktions-Helper `_runtime_key_response(...)` eingefuehrt.
  - `GET /admin/keys/`, `POST activate|disable|revoke` und `PATCH request-path-policy` auf redigierte Responses umgestellt.
  - Backend-Test `test_admin_runtime_key_responses_never_serialize_secret_hash` hinzugefuegt.
  - Auditor hat den Leak und den Rest des Promptumfangs erneut geprueft und `APPROVED` erteilt.

Finale Freigabe:
- `APPROVED: secret_hash is now redacted from runtime-key inventory and lifecycle/policy mutation responses via _runtime_key_response in backend/app/api/admin/keys.py, while one-time secrets remain confined to create/rotate issued payloads; backend/tests/test_admin_keys_redaction.py verifies the redaction path. The rest of prompt 16 still holds: the table exposes the required columns, issue/rotate show a prominent one-time secret with copy support, request-path policy is a separate editable section, status controls are separated from rotation, read-only sessions hide mutation actions, and the frontend no longer models any stored secret field for inventory rows.`  
- Auditor/Sub-Agent: `Bohr` (`019dd78a-5bf5-7071-bf63-0d6cec4e4334`)

Ausgefuehrte Pruefkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- api-keys-page governance-tenant-scope audit-handoff-links`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Grund: Das Projekt nutzt `vitest run`; die Vitest/CAC-CLI kennt `--runInBand` nicht und bricht mit `CACError: Unknown option '--runInBand'` ab.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`46/46` Test Files, `180/180` Tests)
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_admin_keys_redaction.py`
  - Ergebnis: `PASS`

