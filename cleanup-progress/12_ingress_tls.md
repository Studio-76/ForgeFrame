# Progress

- Promptdatei: `/opt/ForgeFrame/cleanup/12_ingress_tls.md`
- Developer-Zusammenfassung: `Die Ingress/TLS-Seite wurde von einer rohen Kartenliste zu einem gefuehrten Betriebsflow umgebaut. Oben steht jetzt ein expliziter Gesamtstatus mit den vier geforderten Lagen: oeffentlich produktionsbereit, Ausnahme-Modus, blockiert oder nur lokal. Die Hauptflaeche zeigt eine echte Checkliste fuer FQDN, DNS, Port 80, Port 443, Same-Origin-HTTPS und Zertifikat, jeweils mit Evidence und naechster Operator-Aktion. Blocker verlinken direkt nach Settings, Onboarding oder Health. Zertifikatslaufzeit und Renewal-Fenster sind in Summary und Detailpanel sichtbar. Die Renew-Aktion ist jetzt nicht mehr blind aktiv: Backend und Frontend kennen explizit `renewal_supported`, `renewal_allowed` und `renewal_blocked_reason`, und jede Renewal-Operation liefert ein sichtbares Ergebnis samt aktualisierter Ingress-Wahrheit zurueck.`
- Geaenderte Dateien:
  - `frontend/src/pages/IngressTlsPage.tsx`
  - `frontend/src/api/admin.ts`
  - `frontend/tests/ingress-page.test.tsx`
  - `frontend/tests/setup-module-pages.test.tsx`
  - `backend/app/api/admin/ingress.py`
  - `backend/app/ingress/service.py`
  - `backend/tests/test_ingress_admin_api.py`
- Audit-Ergebnis: `APPROVED`
- Konkrete Audit-Maengel:
  - `Runde 1`: Die alte Seite zeigte Ingress-, Listener-, Zertifikats- und Blockerwahrheit nur als lose Rohlisten. Es fehlten klarer Gesamtstatus, echte Checkliste mit Evidence und naechster Aktion, explizite Ausnahmezustandslogik sowie ein operator-tauglicher Renewal-Flow.
  - `Runde 2`: Der API-Vertrag reichte fuer ehrliches Renew-Gating noch nicht. Es fehlten Renewal-Freigabe, Blocked-Reason und aktualisierte Statuswahrheit nach einer Renew-Operation; ausserdem war Self-Signed/Manual/No-FQDN im Frontend noch nicht explizit als Ausnahmezustand modelliert.
  - `Runde 3`: Der erste Implementierungsschnitt enthielt einen TypeScript-Parserfehler im Helper-Signature-Pfad und deckte einen latent falschen ACME-Helper-Test auf, der die Challenge-Datei nicht am vom Script bedienten Webroot-Pfad ablegte.
- Fix-Runden: `3`
- Finale Freigabe: `APPROVED`
- Ausgefuehrte Pruefkommandos:
  - `cd frontend && npm run build` -> `PASS`
  - `cd frontend && npm test -- --runInBand` -> `FAIL, Vitest/CAC in diesem Projekt kennt die Option --runInBand nicht`
  - `cd frontend && npm test -- ingress-page setup-module-pages` -> `PASS (5 Tests)`
  - `cd frontend && npm test` -> `PASS (43/43 Testdateien, 166/166 Tests)`
  - `/opt/ForgeFrame/.venv/bin/pytest backend/tests/test_ingress_admin_api.py` -> `PASS (7 Tests)`

## Finale Freigabe

- Audit-Ergebnis: `APPROVED`
- Begruendung:
  - Der Betreiber sieht jetzt sofort, ob ForgeFrame oeffentlich produktionsbereit, bewusst im Ausnahme-Modus, blockiert oder nur lokal betrieben wird.
  - FQDN, DNS, Port 80, Port 443, Same-Origin-HTTPS und Zertifikat werden als echte Checkliste mit Evidence und naechster Aktion dargestellt.
  - Self-Signed, manual TLS und fehlender FQDN werden explizit als Ausnahmezustand markiert und nicht kosmetisch gruen dargestellt.
  - Zertifikatslaufzeit, Renewal-Fenster, Trust-State und letzte Fehler sind in der Detailwahrheit sichtbar.
  - Renew ist nur dann bedienbar, wenn der integrierte ACME-Vertrag wirklich erfuellt ist; sonst liefern API und UI denselben Blocked-Reason.
  - Eine ausgefuehrte Renewal-Operation zeigt ein echtes Ergebnis samt Rohoutput und aktualisierter Ingress-Wahrheit.
  - Blocker fuehren gezielt nach Settings, Onboarding oder Health, ohne die Seite wieder in lange Erklaerblaecke zu verwandeln.
