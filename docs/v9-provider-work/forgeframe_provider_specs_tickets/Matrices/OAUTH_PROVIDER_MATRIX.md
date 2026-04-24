# OAuth / Account Provider Matrix

| Provider ID | Name | Class | Source docs | Integration truth |
|---|---|---|---|---|
| openai_codex | OpenAI Codex | oauth_pkce_account_runtime | OAUTH-OpenAICodex.md + API-OpenAICodex.md | OpenAI OAuth PKCE refresh token, Codex CLI/SDK, ChatGPT Codex backend |
| github_copilot | GitHub Copilot | github_oauth_pat_app_token_acp | OAUTH-GitHubCopilot.md + API-GitHubCopilot.md | GitHub device OAuth/PAT/App token; api.githubcopilot.com; ACP external_process |
| claude_code | Claude Code | oauth_cli_or_agent_sdk | OAUTH-ClaudeCode.md + API-ClaudeCode.md | Claude OAuth PKCE/API token; Claude Code CLI/Agent SDK |
| antigravity | Google Antigravity | google_oauth_desktop_agent | OAUTH-Antigravity.md + API-Antigravity.md | Google OAuth; Antigravity app/CLI docs; currently no stable HTTP runtime endpoint |
| google_gemini_oauth | Google Gemini OAuth / Code Assist | google_oauth_cli_code_assist | OAUTH-GoogleGemini.md + API-Gemini.md | Google OAuth, Gemini CLI/Code Assist, native Gemini/Vertex paths |
| nous_oauth | Nous Portal OAuth | oauth_device_code_agent_key | OAUTH-NousPortal.md + API-NousPortal.md | Device code OAuth and minted agent key |
| qwen_oauth | Qwen OAuth | oauth_bearer | OAUTH-Qwen.md | Qwen OAuth bearer / portal API |
