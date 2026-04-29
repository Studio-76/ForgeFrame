# Progress

- Promptdatei: `/opt/ForgeFrame/cleanup/11_plugins.md`
- Developer-Zusammenfassung: `Die Plugins-Seite wurde in drei echte Operator-Panels getrennt: Katalog, Manifest bearbeiten und Instanz-Aktivierung. Der Katalog zeigt Status, Version, Provenienz, Security-Posture, Extension-Slots und aktivierte Instanzen. Der Manifest-Editor arbeitet primär strukturiert ueber Felder fuer Security-Posture, Config-Schema und Default-Config; Raw JSON bleibt nur noch als Advanced-Pfad sichtbar. Die Instanz-Aktivierung ist jetzt eine eigene Bindungsflaeche mit Scope-Check, Config-Contract-Pruefung und sichtbarer Blockierung bei deaktiviertem Manifest. Zusaetzlich wurde der Backend-Contract gehaertet: Required Keys aus dem Manifest-Schema werden jetzt fuer Default-Config und Bindings serverseitig erzwungen, und die Tests bilden die reale Instance-Membership-Wahrheit fuer Operator-Lesezugriffe ab.`
- Geaenderte Dateien:
  - `frontend/src/pages/PluginsPage.tsx`
  - `frontend/src/api/admin.ts`
  - `frontend/tests/plugins-page.test.tsx`
  - `backend/app/plugins/models.py`
  - `backend/app/plugins/service.py`
  - `backend/tests/test_plugins_admin_api.py`
- Audit-Ergebnis: `APPROVED`
- Konkrete Audit-Maengel:
  - `Runde 1`: Die neue Drei-Panel-Struktur war im Code bereits angelegt, aber die Frontend-Tests prueften noch gegen die alte Einflaechen-UI und die Backend-Pruefung nahm einen Operator-Lesezugriff ohne explizite Instance-Membership an, obwohl die restliche Admin-Oberflaeche dieselbe Membership-Grenze bereits real durchsetzt.
  - `Runde 2`: Der Config-Contract war noch nicht vollstaendig echt. Required Keys aus dem Manifest-Schema wurden serverseitig weder fuer Default-Config noch fuer Bindings erzwungen. Zusaetzlich spiegelte der Edit-Dialog Security-Posture-Entwuerfe nicht aus dem Draft, sondern aus der persistierten Detailwahrheit, und ungueltiges Advanced-JSON konnte in der Security-Posture den Renderpfad abbrechen.
- Fix-Runden: `2`
- Finale Freigabe: `APPROVED`
- Ausgefuehrte Pruefkommandos:
  - `cd frontend && npm run build` -> `PASS`
  - `cd frontend && npm test -- --runInBand` -> `FAIL, Vitest/CAC in diesem Projekt kennt die Option --runInBand nicht`
  - `cd frontend && npm test -- plugins-page` -> `PASS (3 Tests)`
  - `cd frontend && npm test` -> `PASS (42/42 Testdateien, 163/163 Tests)`
  - `/opt/ForgeFrame/.venv/bin/pytest backend/tests/test_plugins_admin_api.py` -> `PASS (3 Tests)`

## Finale Freigabe

- Audit-Ergebnis: `APPROVED`
- Begruendung:
  - Die Seite trennt Katalog, Manifest-Bearbeitung und Instanz-Aktivierung jetzt klar und ohne Mischoberflaeche.
  - Der Katalog zeigt die im Prompt geforderten Wahrheitsachsen: Status, Version, Provenienz/Vendor, Security-Posture, Extension-Slots und Aktivierung ueber Instanzen.
  - Manifest-Erstellung und -Bearbeitung laufen primaer ueber strukturierte Felder; Raw JSON bleibt ein optionaler Advanced-Pfad mit sichtbaren Validierungsfehlern statt versteckter Renderfehler.
  - Security-Posture-Warnungen wirken sichtbar auf Katalog, Editor und Detailpanel.
  - Die Instanz-Bindung ist eine eigene Aktion mit Scope-Check, Contract-Pruefung, Binding-Konfiguration und ehrlicher Blockierung, wenn das Manifest deaktiviert ist.
  - Default-Config und Binding-Config muessen Required Keys aus dem Manifest-Schema jetzt auch serverseitig erfuellen; damit ist der Config-Contract nicht nur UI-Kosmetik.
  - Operator-Read-Truth folgt jetzt derselben expliziten Instance-Membership-Wahrheit wie die restlichen instance-scoped Admin-Flaechen; Mutationen bleiben fuer Operatoren gesperrt.
