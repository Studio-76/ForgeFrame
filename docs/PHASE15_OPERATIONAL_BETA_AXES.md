# ForgeGate Phase 15 — Operational Beta Axes

Phase 15 schärft das Produktmodell dauerhaft entlang von vier getrennten Achsen:

1. OAuth-/Account-Provider (OpenAI Codex, Gemini, Antigravity, GitHub Copilot, Claude Code)
2. Sonstige OpenAI-kompatible Provider
3. Lokale Provider (dedizierte Ollama-Achse)
4. OpenAI-kompatible Clients

## Kernänderungen

- Control-Plane Beta-Target-Matrix enthält jetzt operative Reifeachsen (runtime/streaming/verify/ui), Readiness-Score und Beta-Tier.
- OAuth-/Account-Semantik ist im Provider-Fähigkeitsmodell explizit (`provider_axis`, `auth_mechanism`) statt implizit.
- `generic_harness` leitet `auth_mechanism` jetzt aus den aktiv ausführbaren Harness-Profilen ab; gemischte aktive Profile werden als `mixed` plus Detailmenge statt als falsches `api_key` ausgewiesen.
- Gemini bekam eine echte Auth-/Readiness-Modellierung (OAuth/API-Key), ohne Fake-Runtime.
- Codex- und Gemini-Live-Claims werden nur dann auf `ready` angehoben, wenn Probe- oder Runtime-Evidenz vorliegt.
- Antigravity, GitHub Copilot und Claude Code bleiben in der aktuellen Beta-Matrix onboarding-/bridge-only statt native Runtime-Wahrheit zu implizieren.
- Ein nativer Anthropic-`/messages`-Pfad bleibt bewusst außerhalb der aktuellen Vier-Achsen-Beta-Matrix; die Control Plane darf ihn nicht als generischen OpenAI-kompatiblen Provider labeln.
- Die generische OpenAI-kompatible Provider-Achse hat jetzt mindestens einen end-to-end Harness-Proof; die Gesamtachse bleibt dennoch `partial`, damit bewiesene Profiltreue nicht als allgemeine Provider-Garantie überclaimt wird.
- OpenAI-kompatible Client-Achse wurde durch `POST /v1/responses` erweitert (kompatible Basissemantik via Chat-Runtime).
- Dedizierte Ollama-Template-Achse wurde im Harness als `ollama_local` eingebracht.

## Nicht-Ziel in Phase 15

- Keine vollständigen nativen Runtime-Adapter für alle OAuth-/Account-Provider.
- Keine vollständige OpenAI-API-Abdeckung.
- Keine Scope-Explosion in IAM/Billing/Multi-Tenant.
