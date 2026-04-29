# Progress

- Promptdatei: `/opt/ForgeFrame/cleanup/03_onboarding_guided_golive.md`
- Developer-Zusammenfassung: `Onboarding wurde zu einem echten Wizard mit persistierter Betriebsart-/Scope-Wahrheit, ehrlicher Provider-/TLS-Readiness, realem Routing-Default-Schritt, Runtime-Key-Ausgabe und persistierter First-Success-Probe pro Instanz umgebaut. Die Wizard-Schritte und die sichtbaren Karten folgen jetzt der persistierten Instanzwahrheit statt lokalem Draft-State.`
- Geaenderte Dateien:
  - `backend/app/api/admin/control_plane_bootstrap_domain.py`
  - `backend/app/api/admin/instances.py`
  - `backend/app/api/admin/keys.py`
  - `backend/tests/test_admin_keys_first_success_probe.py`
  - `frontend/src/api/admin.ts`
  - `frontend/src/features/onboarding/OnboardingPage.tsx`
  - `frontend/src/features/onboarding/helpers.ts`
  - `frontend/src/features/onboarding/sections.tsx`
  - `frontend/tests/onboarding-page.test.tsx`
- Audit-Ergebnis: `APPROVED`
- Konkrete Audit-Maengel:
  - `Bohr`: Schritt 1 und Go-Live nutzten lokale Formularvollstaendigkeit statt persistierter normativer Wahrheit; First-Success war nur React-State; Scope-Wechsel leerte Probe-/Key-State nicht sauber; Tests fehlten.
  - `Carver`: frisch persistierte First-Success-Probe blieb bei In-Session-Scope-Wechseln nicht erhalten; Routing-Entscheidung war nicht reload-sicher gegen Backend-Truth.
  - `Lorentz`: Routing-Step akzeptierte nur Teilwahrheit aus Backend-Policies und konnte Step 4/Go-Live zu frueh freigeben.
  - `Epicurus`: Routing-Truth wurde noch nicht gegen persistierten Wizard-Intent validiert; die sichtbare Schritt-1-Karte zeigte weiter Draft- statt Persistenzwahrheit.
- Fix-Runden: `4`
- Finale Freigabe: `APPROVED durch Pascal`
- Ausgefuehrte Pruefkommandos:
  - `cd frontend && npm run build` -> `passed`
  - `cd frontend && npm test -- --runInBand` -> `failed as tooling incompatibility (Vitest: Unknown option --runInBand)`
  - `cd frontend && npm test -- onboarding-page` -> `passed`
  - `cd frontend && npm test` -> `passed (40 test files, 149 tests)`
  - `cd /opt/ForgeFrame && .venv/bin/pytest backend/tests/test_admin_keys_first_success_probe.py` -> `passed (3 tests)`

## Revalidation 2026-04-29

- Audit-Ergebnis: `APPROVED`
- Konkrete Audit-Maengel: `keine`
- Finale Freigabe: `APPROVED`
- Begruendung:
  - Der Wizard bleibt auf aktuellem HEAD real zustandsgetrieben: Betriebsart, erste Instanz, Routingdefault, Runtime-Key und persistierte First-Success-Probe werden weiterhin aus echter Persistenz-/API-Wahrheit abgeleitet.
  - Der Global-Contract-Fix aus `00` hat nur die Header-Handoffs aus `PageIntro` in eine kontextuelle `ActionBar` verlagert; Wizard-Logik und Schrittstatus blieben unveraendert.
  - Die auf aktuellem HEAD erfolgreich gelaufenen Pruefkommandos `cd frontend && npm run build`, `cd frontend && npm test -- --runInBand` (Vitest-Option objektiv unsupported) und `cd frontend && npm test` decken den Onboarding-Stand mit ab.
