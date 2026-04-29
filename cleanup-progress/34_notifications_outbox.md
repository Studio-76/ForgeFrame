# Promptdatei

`cleanup/34_notifications_outbox.md`

# Developer-Zusammenfassung

Notifications wurde von einer CRUD-Seite zu einer echten Outbox- und Delivery-Control-Flaeche umgebaut. Die Inventaransicht ist jetzt nach `pending approval / preview`, `queued`, `sent`, `failed` und `rejected` gruppiert; das Detailpanel zeigt Nachrichtenvorschau, aktive Zustellroute, konfigurierte Primaerroute, Fallback-Kette, persistierte Delivery-Attempts und den naechsten operativen Schritt. `confirmNotification`, `rejectNotification` und `retryNotification` liefern sichtbare Resultate, waehrend Create/Edit nur noch als sekundaerer Drawer-Pfad erscheinen.

Backend-seitig wurde ein persistiertes Delivery-Ledger auf Notification-Ebene eingefuehrt, das Attempt-History und die konfigurierte Primaerroute von der aktuell aktiven Zustellroute trennt. Dadurch bleibt nach einem Fallback-Handoff die Kette `Primaer -> Fallback` ehrlich sichtbar. Zusaetzlich wurde im Conversation-Service der Create-Flow mit expliziten `session.flush()`-Stufen gehaertet, damit die direkt betroffenen Backend-Tests unter strikten FK-Pruefungen sauber laufen.

# Geaenderte Dateien

- `frontend/src/pages/NotificationsPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/tasking-delivery-pages.test.tsx`
- `backend/app/tasks/models.py`
- `backend/app/tasks/service.py`
- `backend/app/conversations/service.py`
- `backend/tests/test_tasking_delivery_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Erste Audit-Runde: Bei Fallback-Retries wurde der Primaerkanal durch den aktiven Fallback-Kanal ueberschrieben; dadurch war die echte Zustellkette im Detailmodell nicht mehr rekonstruierbar.
- Erste Audit-Runde: Die UI benannte nach einem Fallback den aktiven Kanal irrefuehrend weiter als `primary` und konnte `Fallback -> Fallback` darstellen.
- Erste Audit-Runde: Frontend- und Backend-Tests deckten die getrennte Wahrheit fuer konfigurierte Primaerroute vs. aktive Delivery-Route nicht ab.

# Fix-Runden

- `1`

# Finale Freigabe

`APPROVED: frontend/src/pages/NotificationsPage.tsx, frontend/src/api/admin.ts, backend/app/tasks/models.py und backend/app/tasks/service.py setzen Prompt 34 jetzt sauber um. Die Outbox ist echt nach Zustellstatus gruppiert, Preview und Live-Delivery bleiben klar getrennt, confirm/reject/retry liefern sichtbare Resultate, und die zuvor falsche Fallback-Wahrheit ist behoben: konfigurierte Primaerroute und aktuell aktive Zustellroute werden getrennt modelliert, im UI ehrlich gezeigt und in backend/tests/test_tasking_delivery_admin_api.py sowie frontend/tests/tasking-delivery-pages.test.tsx explizit gegen Regression abgesichert.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- tasking-delivery-pages` -> erfolgreich, `12` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `49` Testdateien und `200` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_tasking_delivery_admin_api.py` -> erfolgreich, `3` Tests bestanden
