# SPEC 15 – Premium OAuth / Account Provider Contracts

## Ziel
OpenAI Codex, GitHub Copilot, Claude Code, Antigravity, Google Gemini OAuth, Nous Portal und Qwen OAuth werden als ehrliche Account-/OAuth-Achsen mit Contract, Adapter, Evidence und Reifestufen modelliert.

## Gemeinsamer Provider-Vertrag
Je Provider: Auth-Flow, Token-Quelle, Token-Refresh, Token-Revoke/Logout, Account-Probe, Model-Inventory, Runtime-Pfad, Streaming-Pfad, Tool-Calling, Fehlersemantik, Rate-Limit/Quota, Session-Reuse/Serialization, Secret-Speicherung.

## Statusregel
Ohne Live-Evidence maximal `contract-ready`, `adapter-ready-without-live-proof`, `bridge-only`, `onboarding-only` oder `partial-runtime`. `runtime-ready` braucht Live-Probe, Runtime-Test, Fehler-/Streaming-Nachweis und Credential-Evidence.

## Provider-Linien
- OpenAI Codex: tiefste Produktisierung, Codex CLI/SDK/Auth/Runtime/Streaming/Tool-/Operator-Wahrheit.
- GitHub Copilot: GitHub OAuth/PAT/App-Token, `api.githubcopilot.com`, ACP getrennt als `external_process`.
- Claude Code: CLI/Agent SDK nicht mit Anthropic API vermischen.
- Antigravity: ohne stabilen Runtime-Endpunkt nur Bridge/External-Process/Onboarding.
- Google Gemini OAuth: Google OAuth / Code Assist / Gemini CLI / native Gemini / Vertex trennen.
- Nous Portal: Device OAuth und geminteter Agent-Key trennen.
- Qwen OAuth: aufnehmen, aber ohne Live-Beweis nicht runtime-ready.
