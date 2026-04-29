Promptdatei: `cleanup/46_login_password_rotation.md`

Developer-Zusammenfassung:
- Login-Seite auf eine knappe, glaubwürdige Security-Boundary reduziert und mit sicheren Fehlermeldungen, Keyboard-Submit und klaren Hinweisen zur Pflichtrotation versehen.
- Session-Routing erweitert, damit `must_rotate_password` konsequent auf `/rotate-password` umleitet und die vorher angeforderte Zielroute über `next` konserviert.
- Password-Rotation-Gate auf echte Formularvalidierung, sichtbare Passwortregeln, sichere Fehlermeldungen und best-effort Session-Refresh nach erfolgreicher Rotation umgebaut.
- Nach erfolgreicher Rotation wird die Session sofort entsperrt, die Session-Truth nach Möglichkeit frisch geladen und anschließend zur ursprünglichen Route oder zum Dashboard zurückgeführt.
- Backend-Auth-API liefert für Password-Rotation nur noch gehärtete Fehlermeldungen statt roher interner Fehlercodes.
- Interaktive Frontend-Tests decken jetzt sowohl den Happy Path als auch den Refresh-Ausfall nach erfolgreicher Rotation ab.

Geänderte Dateien:
- `backend/app/api/admin/auth.py`
- `backend/tests/test_admin_password_rotation_gate.py`
- `frontend/src/app/App.tsx`
- `frontend/src/app/authRouting.ts`
- `frontend/src/features/auth/PasswordRotationGate.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/PasswordRotationPage.tsx`
- `frontend/tests/login-page.test.tsx`
- `frontend/tests/password-rotation-flow.test.tsx`
- `frontend/tests/password-rotation-gate.test.tsx`
- `frontend/tests/password-rotation-page.test.tsx`
- `frontend/tests/session-gate.test.ts`

Audit-Ergebnis:
- `APPROVED`

Konkrete Audit-Mängel:
- Erste Audit-Runde: erfolgreicher Passwortwechsel konnte durch einen nachgelagerten Fehler bei `fetchAdminSession()` fälschlich als Fehlschlag dargestellt werden; dadurch wäre weder sichere Rückleitung noch ehrlicher Erfolgszustand garantiert gewesen.
- Erste Audit-Runde: es fehlte ein Regressionstest für genau diesen Refresh-Fehler nach erfolgreicher Rotation.

Fix-Runden:
- Runde 1:
  - Rotationserfolg an `rotateOwnPassword()` gebunden statt an den optionalen Session-Refresh.
  - Entsperrte Session sofort aus Response plus aktueller Session abgeleitet; `/admin/auth/me` nur noch best-effort.
  - Regressionstest ergänzt, der trotz fehlgeschlagenem Session-Refresh die Rückkehr zur Zielroute und den entsperrten Zustand absichert.

Finale Freigabe:
- `APPROVED` durch Sub-Agent `Aquinas`

Ausgeführte Prüfkommandos:
- `cd frontend && npm test -- login-page auth-routing password-rotation-page password-rotation-gate password-rotation-flow session-gate`
  - PASS (`6` Testdateien, `20` Tests)
- `./.venv/bin/python -m pytest backend/tests/test_admin_password_rotation_gate.py`
  - PASS (`5 passed`)
- `cd frontend && npm run build`
  - PASS
- `cd frontend && npm test -- password-rotation-flow`
  - PASS (`1` Testdatei, `2` Tests)
- `cd frontend && npm test -- --runInBand`
  - FAIL, objektiver Tool-Blocker: dieses Projekt nutzt `vitest`, und `vitest run` kennt die Option `--runInBand` nicht (`CACError: Unknown option --runInBand`).
- `cd frontend && npm test`
  - PASS (`53` Testdateien, `215` Tests)
