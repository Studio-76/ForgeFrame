# Promptdatei

`cleanup/37_contacts.md`

# Developer-Zusammenfassung

Contacts wurde von einer einfachen Stammdatenliste zu einer echten Kontaktverwaltung mit Source Truth, erreichbaren Kanaelen und verlinkten Work-Objekten umgebaut. Die Inventaransicht zeigt jetzt Name, Organisation, Source, Channel-Inventar, letzten echten Kontaktzeitpunkt und verknuepfte Conversations. Kontakte mit unvollstaendigen oder widerspruechlichen Routen werden sichtbar als Warnfall markiert.

Die Detailansicht fuehrt jetzt Channel-Adressen, Source/Provenance, Consent-/Visibility-Posture sowie Links zu Conversations, Tasks, Notifications und Memory zusammen. Create/Edit wurde auf strukturierte Kontaktfelder umgestellt; freie JSON-Metadaten liegen nur noch im Advanced-Bereich. Optionalfelder wie `source_id`, `primary_email` und `primary_phone` koennen beim Editieren jetzt auch wirklich geloescht werden und bleiben nicht mehr placebohaft stehen.

Backend-seitig wurden die Contact-Vertraege um Channel-Modelle, Route-Warnungen, `last_contact_at`, Provenance, Consent, Visibility-Notizen sowie verlinkte Tasks und Notifications erweitert. Die Service-Schicht berechnet daraus echte Route- und Link-Wahrheit, inklusive Clear-Semantik fuer explizit auf `null` gesetzte optionale Felder.

# Geaenderte Dateien

- `frontend/src/pages/ContactsPage.tsx`
- `frontend/src/api/admin.ts`
- `frontend/tests/knowledge-memory-pages.test.tsx`
- `backend/app/knowledge/models.py`
- `backend/app/knowledge/service.py`
- `backend/tests/test_knowledge_memory_admin_api.py`

# Audit-Ergebnis

`APPROVED`

# Konkrete Audit-Maengel

- Erste Audit-Runde: Der Edit-Flow konnte optionale Felder wie `source_id`, `primary_email`, `primary_phone`, `organization` und `title` nicht wirklich loeschen, weil das Backend `null` wie "beibehalten" behandelt hat.
- Erste Audit-Runde: Die Regressionstests deckten diesen Clear-Pfad nicht ab.

# Fix-Runden

- `1`

# Finale Freigabe

`APPROVED: backend/app/knowledge/service.py:643-684 now uses payload.model_fields_set to distinguish omitted fields from explicit clears, so source_id, primary_email, primary_phone, organization, and title actually persist as cleared when the frontend sends null. The regression coverage is now real: backend/tests/test_knowledge_memory_admin_api.py:385-428 proves the cleared values come back persisted in the API response, and frontend/tests/knowledge-memory-pages.test.tsx:657-669 proves the Contacts edit flow sends the explicit null clear payload for the affected fields.`

# Ausgefuehrte Pruefkommandos

- `cd /opt/ForgeFrame/frontend && npm test -- knowledge-memory-pages` -> erfolgreich, `3` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/python -m pytest backend/tests/test_knowledge_memory_admin_api.py` -> erfolgreich, zuerst `5`, final `6` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm run build` -> erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand` -> fehlgeschlagen, weil das Projekt `vitest run` nutzt und Vitest hier die CLI-Option `--runInBand` nicht unterstuetzt (`CACError: Unknown option --runInBand`)
- `cd /opt/ForgeFrame/frontend && npm test` -> erfolgreich, `50` Testdateien und `204` Tests bestanden
