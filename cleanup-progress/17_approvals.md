Promptdatei: `/opt/ForgeFrame/cleanup/17_approvals.md`

Developer-Zusammenfassung:
- Die Approvals-Seite wurde von einer gruppierten Kartenqueue zu einer echten Entscheidungsflaeche mit serverseitig gespeister Filterleiste, Entscheidungstabelle und strukturiertem Detailpanel umgebaut.
- Die Queue arbeitet jetzt ueber echte Approval-Metadaten aus Backend und API-Contract: `approval_class`, `risk_level`, `due_state`, `next_step`, `consequence_summary`, `irreversible`.
- `approve/reject` bleiben auf der Approval-Seite; Run-Steuerung und Session-Issuance werden im Action-Preview und in den Folgehinweisen explizit auf `Execution Review` bzw. `Security & Policies` getrennt.
- Entscheidungskommentare sind jetzt optional und werden nach einer Entscheidung als bestaetigtes Ergebnis mit Audit-Link dargestellt.
- Das Detailpanel zeigt jetzt echte Audit-Verlaufseintraege mit `action`, `actor`, `created_at`, `status`, `details` und `decision_note` statt nur Audit-Referenzmetadaten.
- Im Backend wurde zusaetzlich ein echter Persistenzfehler in `ExecutionTransitionService.admit_create` beseitigt: fehlende Flush-Reihenfolge konnte FK-Verletzungen beim Anlegen von Runs/Attempts ausloesen.

Geaenderte Dateien:
- `frontend/src/features/approvals/ApprovalsPage.tsx`
- `frontend/src/features/approvals/sections.tsx`
- `frontend/src/features/approvals/helpers.ts`
- `frontend/src/features/approvals/presentation.ts`
- `frontend/src/api/admin.ts`
- `frontend/tests/approvals-page.test.tsx`
- `backend/app/api/admin/approvals.py`
- `backend/app/approvals/models.py`
- `backend/app/approvals/service.py`
- `backend/app/execution/service.py`
- `backend/tests/test_approvals_admin_api.py`

Audit-Ergebnis:
- Erste Audit-Runde: `REJECTED`
- Zweite Audit-Runde: `APPROVED`

Konkrete Audit-Maengel:
- Die Queue-Filter `type/risk/instance/due/class` liefen zunaechst weitgehend nur clientseitig auf einem begrenzten Snapshot und nicht ueber einen vollstaendigen serverseitigen Filterpfad.
- Das Detailpanel zeigte zunaechst nur Audit-Referenzmetadaten und keinen echten Audit-Verlauf mit Events, Actor, Zeit und Decision-Note.

Fix-Runden:
- Runde 1:
  - Approval-Contracts um `approval_class`, `risk_level`, `due_state`, `next_step`, `consequence_summary`, `irreversible`, `action_preview`, `affected_identity`, `affected_scope`, `consequence` und `audit_history` erweitert.
  - Queue-Tabelle mit den geforderten Spalten `Typ`, `Antragsteller`, `Ziel`, `Risiko`, `Status`, `Alter`, `naechster Schritt` eingefuehrt.
  - Detailflaeche auf `Decision overview`, `Action preview`, `Evidence`, `Affected identity and scope`, `Consequence and audit trail`, `Decision panel`, `System record` umgebaut.
  - Optionale Kommentierung fuer Approve/Reject im API- und UI-Pfad umgesetzt.
- Runde 2:
  - `fetchApprovals(...)` und `/admin/approvals` auf serverseitige Filter fuer `status`, `approvalType`, `risk`, `due`, `approvalClass`, `instanceId` erweitert.
  - `ApprovalAdminService.list_approvals(...)` filtert jetzt vor dem finalen `limit`; instanzgescopter Queue-View zieht keine Elevated-Access-Items mehr in denselben Slice.
  - Serverseitiger Regressionstest mit mehr als `200` Shared-Approvals hinzugefuegt, damit Execution-Approvals unter Queue-Druck nicht weggekapppt werden.
  - `ApprovalDetail.audit_history` liefert jetzt echte Audit-Eintraege; falls noch keine Audit-Events vorhanden sind, wird ein record-backed Fallback-Eintrag aus dem Approval selbst erzeugt.
  - Frontend rendert die Audit-Historie sichtbar im Detailpanel und behaelt den Sprunglink in die globale Audit-History als Zusatz.
  - `ExecutionTransitionService.admit_create` mit expliziten Flushes gehaertet, damit Run/Attempt/Outbox auch unter PostgreSQL FK-stabil persistieren.

Finale Freigabe:
- `APPROVED`
- Auditor/Sub-Agent: `Socrates` (`019dd8b2-0747-74b3-97be-004d812de6af`)

Ausgefuehrte Pruefkommandos:
- `cd /opt/ForgeFrame/frontend && npm run build`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame/frontend && npm test -- approvals-page`
  - Ergebnis: `PASS`
- `cd /opt/ForgeFrame && ./.venv/bin/pytest backend/tests/test_approvals_admin_api.py`
  - Ergebnis: `PASS` (`9 passed`)
- `cd /opt/ForgeFrame/frontend && npm test -- --runInBand`
  - Ergebnis: `FAIL`
  - Grund: Das Projekt nutzt `vitest run`; Vitest/CAC kennt `--runInBand` nicht und bricht mit `CACError: Unknown option '--runInBand'` ab.
- `cd /opt/ForgeFrame/frontend && npm test`
  - Ergebnis: `PASS` (`46/46` Test Files, `181/181` Tests)
