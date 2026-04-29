Promptdatei: `/opt/ForgeFrame/cleanup/18_security_policies.md`

Developer-Zusammenfassung:
- Die Security-Seite wurde zu einem echten Security-Center mit den Tabs `Posture`, `Admin Users`, `Sessions`, `Elevated Access`, `Provider Secrets` und `Credential Policy` umgebaut.
- Oben steht jetzt ein harter Blocker-Strip fuer `default_password`, `missing_rotation`, `open_sessions`, `secrets_missing`, `break_glass_active` und `approver_recovery`.
- `Admin Users` trennt Benutzeranlage, Profilpflege, Passwort-Reset, eigene Passwortrotation und per-Instance `Roles & scopes` in echte, getrennte Aktionen.
- `Sessions` markiert die aktuelle Browser-Session und erlaubt gezielte Revokes realer Admin-Sessions.
- `Elevated Access` bildet Request -> Approve/Reject -> Start -> Cancel/Expire als sichtbaren Statusfluss ab.
- `Provider Secrets` zeigt nur Posture, Rotation-Support und Rotations-Evidence; Secret-Werte werden nicht gerendert.
- Im Backend wurden Membership- und Security-Posture-Endpunkte erweitert, inklusive Membership-Upsert/Delete und blocker-/secret-state-Berechnung.
- Eine echte Backend-Regression wurde behoben: globale User-Defaults ueberschrieben scoped Membership-Rollen beim Authentifizieren. Scoped Rollen bleiben jetzt eigene Wahrheit; die globale Rolle dient nur noch als Ceiling.

Geaenderte Dateien:
- `frontend/src/features/security/SecurityPage.tsx`
- `frontend/src/features/security/sections.tsx`
- `frontend/src/features/security/helpers.ts`
- `frontend/src/features/security/pageState.ts`
- `frontend/src/api/admin.ts`
- `frontend/tests/security-page.test.tsx`
- `frontend/tests/governance-pages.test.tsx`
- `backend/app/api/admin/security_admin.py`
- `backend/app/governance/service.py`
- `backend/tests/test_governance_modules.py`
- `cleanup-progress/18_security_policies.md`

Audit-Ergebnis:
- Runde 1: `REJECTED`
- Runde 2: `REJECTED`
  - Grund: Die Fortschrittsdatei war nach dem technischen Fix noch nicht mit dem tatsaechlichen Re-Audit-Status abgeschlossen.
- Runde 3: `APPROVED`
  - Grund: Prompt 18 ist inhaltlich erfuellt; Security-Bereiche, echte Roles/Scopes, Elevated-Access-Lifecycle, Provider-Secret-Ehrlichkeit und Verifikationssignale wurden vom Auditor bestaetigt.

Konkrete Audit-Maengel:
- `Roles/Scopes` war nicht vollstaendig umgesetzt; es fehlte echte Membership-/Scope-Bedienung ueber UI und API.
- Die Fortschrittsdatei war nur ein Platzhalter und erfuellte die Dokumentationspflicht nicht.

Fix-Runden:
- Runde 1:
  - Frontend um `Roles & scopes` erweitert, inklusive Membership-Laden, Scope-Draft, Upsert und Remove.
  - API-Client um Membership-Endpunkte erweitert.
  - Security-Tests um echten Scope-Upsert-Flow erweitert.
  - Fortschrittsdatei vollstaendig neu geschrieben.
  - Backend-Bug behoben, der scoped Membership-Rollen bei Authentifizierung wieder auf globale Benutzerrollen zuruecksetzte.
- Runde 2:
  - Audit-Historie in dieser Fortschrittsdatei vervollstaendigt.
  - Den zweiten Auditor-Befund explizit dokumentiert, statt `ausstehend`-/Platzhalterstatus stehen zu lassen.
  - Die finale Freigabezeile wird mit dem naechsten expliziten Auditor-Urteil abgeschlossen.

Finale Freigabe:
- `APPROVED`
- Auditor-Begruendung:
  - Prompt 18 ist inhaltlich erfuellt. Die Security-Seite trennt die geforderten Bereiche sauber, setzt `Roles & scopes` jetzt mit echten Membership-Endpunkten und Laufzeitwirkung um, zeigt den Elevated-Access-Lifecycle sichtbar und ehrlich, und die Provider-Secret-Ansicht gibt nur Posture/Referenzen statt Secretwerten aus.
  - Build, relevante Frontend-Tests und die betroffenen Backend-Tests liefern dazu passende gruene Signale; der einzige zuletzt offene Punkt war nur noch das fehlende explizite Abschlussurteil in der Fortschrittsdatei.

Ausgefuehrte Pruefkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: erfolgreich
- `cd /opt/ForgeFrame/frontend && npm test -- security-page governance-pages`
  - Ergebnis: erfolgreich, `11` Tests bestanden
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: fehlgeschlagen, objektiver Tooling-Blocker
  - Exakter Grund: `CACError: Unknown option '--runInBand'`
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: erfolgreich, `46` Testdateien / `184` Tests bestanden
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_governance_modules.py::test_security_admin_endpoints_manage_users_sessions_and_secret_posture`
  - Ergebnis: zuerst fehlgeschlagen wegen Membership-Regression, nach Backend-Fix erfolgreich
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_governance_modules.py::test_security_posture_routes_are_operator_readable_for_elevated_access_requesters`
  - Ergebnis: erfolgreich
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_governance_modules.py::test_elevated_access_requester_cancellation_rejects_viewer_after_role_downgrade`
  - Ergebnis: erfolgreich
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_governance_modules.py::test_impersonation_sessions_are_read_only_for_control_plane_writes`
  - Ergebnis: erfolgreich
