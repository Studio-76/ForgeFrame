# ForgeGate Phase 15 — Operational Beta Axes

Phase 15 schärft das Produktmodell dauerhaft entlang von vier getrennten Achsen:

1. OAuth-/Account-Provider (OpenAI Codex, Gemini, Antigravity, GitHub Copilot, Claude Code)
2. Sonstige OpenAI-kompatible Provider
3. Lokale Provider (dedizierte Ollama-Achse)
4. OpenAI-kompatible Clients

## Kernänderungen

- Control-Plane Beta-Target-Matrix enthält jetzt operative Reifeachsen (runtime/streaming/verify/ui), Readiness-Score und Beta-Tier.
- OAuth-/Account-Semantik ist im Provider-Fähigkeitsmodell explizit (`provider_axis`, `auth_mechanism`) statt implizit.
- Gemini bekam eine echte Auth-/Readiness-Modellierung (OAuth/API-Key), ohne Fake-Runtime.
- OpenAI-kompatible Client-Achse wurde durch `POST /v1/responses` erweitert (kompatible Basissemantik via Chat-Runtime).
- Dedizierte Ollama-Template-Achse wurde im Harness als `ollama_local` eingebracht.

## Nicht-Ziel in Phase 15

- Keine vollständigen nativen Runtime-Adapter für alle OAuth-/Account-Provider.
- Keine vollständige OpenAI-API-Abdeckung.
- Keine Scope-Explosion in IAM/Billing/Multi-Tenant.
