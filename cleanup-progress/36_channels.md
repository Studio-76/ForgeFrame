# Promptdatei

`cleanup/36_channels.md`

# Developer-Zusammenfassung

Channels wurde von generischem CRUD zu einer echten Zustellkanalverwaltung umgebaut. Die Inventaransicht ist jetzt nach Status und Typ filterbar und zeigt pro Kanal Typ, Status, Scope, Fallback-Rang, letzten Erfolg und letzten Fehler. Die Detailansicht fuehrt Delivery-Posture, Credential-/Secret-Posture, Fallback-Kette, eingehende Fallback-Quellen und die letzten Notifications zusammen.

Backend-seitig wurden Delivery-Channel-Summaries um Scope, Fallback-Rang sowie letzte Success-/Failure-Daten erweitert. Channel-Details liefern jetzt eine redaktionssichere Credential-Posture, sanitisiertes Advanced-Metadata, Fallback-Kette und `not_ready`-Testsend-Posture. Webhook-Ziele werden maskiert, secretartige Metadatenfelder werden redigiert und nur Referenzen bleiben sichtbar. Da kein echter Test-Send-Endpunkt existiert, rendert das Frontend bewusst keinen Placebo-Button.

Create/Edit ist jetzt nach Channel-Typ strukturiert. Das Ziel-Feld bekommt typabhaengige Hinweise, maskierte Webhook-Ziele werden auf Edit nicht mehr zurueckgerendert, und Advanced-Metadata wird nur noch im entsprechenden Advanced-Bereich bearbeitet. Beim Editieren bleibt verborgenes Secret-Material erhalten, solange der Nutzer die Advanced-Payload nicht explizit ersetzt.

# Geaenderte Dateien

- `frontend/src/pages/ChannelsPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/tasking-delivery-pages.test.tsx`
- `backend/app/api/admin/channels.py`
- `backend/app/tasks/models.py`
- `backend/app/tasks/service.py`
- `backend/tests/test_tasking_delivery_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Keine weiteren Audit-Maengel nach dem ersten Auditor-Durchlauf.

# Fix-Runden

- `0`

# Finale Freigabe

`APPROVED: frontend/src/pages/ChannelsPage.tsx, frontend/src/api/admin.ts, backend/app/api/admin/channels.py and backend/app/tasks/service.py satisfy prompt 36 as a real channel-management surface: the inventory is filterable by type/status and shows channel/type/status/scope/fallback-rank/last-success/last-error, detail exposes credential posture and sanitized metadata without leaking secret values, fallback chain and inbound fallback sources are visible, and the page explicitly renders Test send as not_ready without a fake action because no backend send-test endpoint exists. Create/edit are structured by channel kind with raw metadata only inside Advanced, and the frontend/backend tests in frontend/tests/tasking-delivery-pages.test.tsx and backend/tests/test_tasking_delivery_admin_api.py cover the redaction, filter, fallback, and no-placebo-action paths without regression signals.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- tasking-delivery-pages` -> erfolgreich, `13` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_tasking_delivery_admin_api.py` -> erfolgreich, `4` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `50` Testdateien und `204` Tests bestanden
