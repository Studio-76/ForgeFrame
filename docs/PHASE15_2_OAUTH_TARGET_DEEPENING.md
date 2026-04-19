# ForgeGate Phase 15.2 — OAuth Target Deepening (Antigravity/Copilot/Claude Code)

Phase 15.2 operationalisiert die drei offenen OAuth-/Account-Zielachsen ohne Fake-Runtime:

- Antigravity
- GitHub Copilot
- Claude Code

## Neu in Phase 15.2

- Codebasierte OAuth-Target-Statusobjekte für die drei Achsen (configured / probe / bridge profile / readiness reason).
- Control-Plane Endpunkte:
  - `GET /admin/providers/oauth-account/targets`
  - `POST /admin/providers/oauth-account/bridge-profiles/sync`
- Probe-Semantik für alle drei offenen OAuth-Ziele via bestehendem Probe-Endpoint.
- Bridge-Profile-Sync erzeugt bei Bedarf OpenAI-compatible Harness-Profile je OAuth-Zielachse.
- Beta-Target-Matrix bezieht Reifegrade für Antigravity/Copilot/Claude Code aus echten Statusflags statt statischem `planned`.

## Nicht-Ziel

- Keine Vollruntime für alle drei Provider gleichzeitig.
- Keine Fake-Success-Pfade.
