# OAUTH-ClaudeCode.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## code-proxy OAuth-Konfiguration

Provider: `claude`

```text
Client ID: 9d1c250a-e61b-44d9-88ed-5944d1962f5e
Auth URL:  https://claude.ai/oauth/authorize
Token URL: https://api.anthropic.com/v1/oauth/token
Scopes:    org:create_api_key user:profile user:inference
Redirect:  http://localhost:54545/callback
Content:   application/json
PKCE:      true
Extra:     code=true
```

## Token Exchange

Claude nutzt im code-proxy OAuth-Exchange JSON statt form-urlencoded:

```http
POST https://api.anthropic.com/v1/oauth/token
Content-Type: application/json
Accept: application/json

{
  "grant_type": "authorization_code",
  "code": "<code>",
  "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  "redirect_uri": "http://localhost:54545/callback",
  "code_verifier": "<pkce_verifier>",
  "state": "<state>"
}
```

Refresh ebenfalls JSON:

```json
{
  "grant_type": "refresh_token",
  "refresh_token": "<refresh_token>",
  "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
}
```

## Claude Code CLI Provider in code-proxy

Praefixe:

- `cli-cc/` = lokaler Claude-Code-CLI-Agent
- `cc/` = im Modellkatalog als OAuth-Modelle gefuehrt, intern aber gleicher Provider-Typ `claude-cli`

CLI-Aufruf:

```bash
claude --print   --model <model>   --output-format stream-json   --dangerously-skip-permissions   --verbose   [--effort low|medium|max]   [--system-prompt <system>]
```

Prompt wird ueber stdin uebergeben. code-proxy liest `stream-json` und extrahiert `assistant.message.content[].text`, Tool Uses, Tool Results und `cost_usd`.

## Hermes-Anthropic-Fallback

Hermes akzeptiert fuer `anthropic` auch `CLAUDE_CODE_OAUTH_TOKEN` als Credential-Quelle. Damit kann ein Claude-Code-OAuth-Token wie ein Bearer/API-Credential in die Anthropic-Schicht einfliessen.

## Implementierungsnotiz

Fuer ForgeFrame sollte Claude API-Key und Claude-Code-OAuth getrennt modelliert werden:

- `anthropic_api_key`: offiziell normale API.
- `claude_code_oauth`: Account-/CLI-naher Premiumfluss mit eigener Risk-/Terms-Markierung.

---

## Offizielle Dokumentationsanreicherung: `Oauth/ClaudeCode`

> Ergänzt am 2026-04-24 03:20:41. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – ClaudeCode

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### Authentication - Claude Code Docs
- Quelle: Pflichtquelle
- Original-URL: https://code.claude.com/docs/en/authentication
- Bereinigte Download-URL: https://code.claude.com/docs/en/authentication
- Lokale Datei(en): HTML: `authentication.html`, Text: `authentication.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Claude Code authentication
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Setup Guide
- Quelle: Pflichtquelle
- Original-URL: https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/setup.md
- Bereinigte Download-URL: https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/setup.md
- Lokale Datei(en): Markdown: `setup.md`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Claude Code Action setup auth
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/plain; charset=utf-8`

### Configure server-managed settings - Claude Code Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://code.claude.com/docs/en/server-managed-settings
- Bereinigte Download-URL: https://code.claude.com/docs/en/server-managed-settings
- Lokale Datei(en): HTML: `server-managed-settings.html`, Text: `server-managed-settings.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://code.claude.com/docs/en/authentication
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Troubleshooting - Claude Code Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://code.claude.com/docs/en/troubleshooting
- Bereinigte Download-URL: https://code.claude.com/docs/en/troubleshooting
- Lokale Datei(en): HTML: `troubleshooting.html`, Text: `troubleshooting.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://code.claude.com/docs/en/authentication
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://code.claude.com/docs/en/authentication`
- `https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/setup.md`
- `https://code.claude.com/docs/en/server-managed-settings`
- `https://code.claude.com/docs/en/troubleshooting`
- `https://github.com/apps/claude`
- `https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions`
- `https://github.com/settings/apps/new`
- `https://github.com/settings/apps`
- `https://docs.github.com/en/apps/creating-github-apps`
- `https://downloads.claude.ai`
- `http://proxy.example.com:8080`
- `https://claude.ai/install.sh`
- `https://claude.ai/install.ps1`
- `https://claude.ai/install.cmd`
- `https://downloads.claude.ai/claude-code-releases/{VERSION`

### Erkannte Endpunkte / Pfade

- `/create-github-app-token`
- `/model`
- `/login`

### Erkannte Umgebungsvariablen / Konstanten

- `CLAUDE_CONFIG_DIR`
- `CLAUDE_CODE_API_KEY_HELPER_TTL_MS`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_AUTH_TOKEN`
- `CLAUDE_CODE_USE_BEDROCK`
- `CLAUDE_CODE_USE_VERTEX`
- `CLAUDE_CODE_USE_FOUNDRY`
- `CLAUDE_CODE_OAUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `APP_ID`
- `APP_PRIVATE_KEY`
- `IMPORTANT`
- `WRONG`
- `CORRECT`
- `PATH`
- `WSL2`
- `HTTPS_PROXY`
- `HTTP_PROXY`
- `USERPROFILE`
- `HOME`
- `LOCALAPPDATA`
- `DOCTYPE`
- `NODE_EXTRA_CA_CERTS`
- `CRYPT_E_NO_REVOCATION_CHECK`
- `CRYPT_E_REVOCATION_OFFLINE`
- `TARGET`
- `WORKDIR`
- `CLAUDE_CODE_GIT_BASH_PATH`
- `VERSION`
- `ARM64`
- `NVM_DIR`
- `WSL1`
- `ANTHROPIC_MODEL`
- `BROWSER`
- `MSVC`
- `USE_BUILTIN_RIPGREP`
- `CLAUDE`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### Authentication - Claude Code Docs
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://code.claude.com/docs/en/authentication
- Bereinigte Download-URL: https://code.claude.com/docs/en/authentication

---

**Quelle `INDEX.md`**

- Original-URL: https://code.claude.com/docs/en/authentication
- Bereinigte Download-URL: https://code.claude.com/docs/en/authentication
- Lokale Datei(en): HTML: `authentication.html`, Text: `authentication.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://code.claude.com/docs/en/authentication
- Lokale Datei(en): HTML: `authentication.html`, Text: `authentication.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Claude Code authentication
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/setup.md
- Bereinigte Download-URL: https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/setup.md

---

**Quelle `INDEX.md`**

- Original-URL: https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/setup.md
- Bereinigte Download-URL: https://raw.githubusercontent.com/anthropics/claude-code-action/main/docs/setup.md
- Lokale Datei(en): Markdown: `setup.md`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://code.claude.com/docs/en/server-managed-settings
- Bereinigte Download-URL: https://code.claude.com/docs/en/server-managed-settings

---

**Quelle `INDEX.md`**

- Original-URL: https://code.claude.com/docs/en/server-managed-settings
- Bereinigte Download-URL: https://code.claude.com/docs/en/server-managed-settings
- Lokale Datei(en): HTML: `server-managed-settings.html`, Text: `server-managed-settings.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://code.claude.com/docs/en/authentication
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://code.claude.com/docs/en/troubleshooting
- Bereinigte Download-URL: https://code.claude.com/docs/en/troubleshooting

---

**Quelle `INDEX.md`**

- Original-URL: https://code.claude.com/docs/en/troubleshooting
- Bereinigte Download-URL: https://code.claude.com/docs/en/troubleshooting
- Lokale Datei(en): HTML: `troubleshooting.html`, Text: `troubleshooting.txt`

---

**Quelle `authentication.txt`**

Authentication - Claude Code Docs

---

**Quelle `authentication.txt`**

Authentication

---

**Quelle `authentication.txt`**

Agent SDK

---

**Quelle `authentication.txt`**

Usage and costs

---

**Quelle `authentication.txt`**

Track team usage with analytics

---

**Quelle `authentication.txt`**

Data usage

---

**Quelle `authentication.txt`**

Set up team authentication

---

**Quelle `authentication.txt`**

Claude Console authentication

---

**Quelle `authentication.txt`**

Cloud provider authentication

---

**Quelle `authentication.txt`**

Credential management

---

**Quelle `authentication.txt`**

Authentication precedence

---

**Quelle `authentication.txt`**

Generate a long-lived token

---

**Quelle `authentication.txt`**

Log in to Claude Code and configure authentication for individuals, teams, and organizations.

---

**Quelle `authentication.txt`**

Claude Code supports multiple authentication methods depending on your setup. Individual users can log in with a Claude.ai account, while teams can use Claude for Teams or Enterprise, the Claude Console, or a cloud provider like Amazon Bedrock, Google Vertex AI, or Microsoft Foundry.

---

**Quelle `authentication.txt`**

After installing Claude Code, run claude in your terminal. On first launch, Claude Code opens a browser window for you to log in.
If the browser doesn’t open automatically, press c to copy the login URL to your clipboard, then paste it into your browser.
If your browser shows a login code instead of redirecting back after you sign in, paste it into the terminal at the Paste code here if prompted prompt.

---

**Quelle `authentication.txt`**

If the browser doesn’t open automatically, press c to copy the login URL to your clipboard, then paste it into your browser.
If your browser shows a login code instead of redirecting back after you sign in, paste it into the terminal at the Paste code here if prompted prompt.
You can authenticate with any of these account types:

---

**Quelle `authentication.txt`**

If your browser shows a login code instead of redirecting back after you sign in, paste it into the terminal at the Paste code here if prompted prompt.
You can authenticate with any of these account types:

---

**Quelle `authentication.txt`**

Claude Console: log in with your Console credentials. Your admin must have invited you first.

---

**Quelle `authentication.txt`**

Cloud providers: if your organization uses Amazon Bedrock, Google Vertex AI, or Microsoft Foundry, set the required environment variables before running claude. No browser login is needed.

---

**Quelle `authentication.txt`**

To log out and re-authenticate, type /logout at the Claude Code prompt.
If you’re having trouble logging in, see authentication troubleshooting.

---

**Quelle `authentication.txt`**

Claude for Teams and Claude for Enterprise provide the best experience for organizations using Claude Code. Team members get access to both Claude Code and Claude on the web with centralized billing and team management.

---

**Quelle `authentication.txt`**

Claude for Teams: self-service plan with collaboration features, admin tools, and billing management. Best for smaller teams.

---

**Quelle `authentication.txt`**

For organizations that prefer API-based billing, you can set up access through the Claude Console.

---

**Quelle `authentication.txt`**

Claude Code role: users can only create Claude Code API keys

---

**Quelle `authentication.txt`**

Developer role: users can create any kind of API key

---

**Quelle `authentication.txt`**

Accept the Console invite

---

**Quelle `authentication.txt`**

Log in with Console account credentials

---

**Quelle `authentication.txt`**

Distribute the environment variables and instructions for generating cloud credentials to your users. Read more about how to manage configuration here.

---

**Quelle `authentication.txt`**

Claude Code securely manages your authentication credentials:

---

**Quelle `authentication.txt`**

Storage location: on macOS, credentials are stored in the encrypted macOS Keychain. On Linux and Windows, credentials are stored in ~/.claude/.credentials.json, or under $CLAUDE_CONFIG_DIR if that variable is set. On Linux, the file is written with mode 0600; on Windows, it inherits the access controls of your user profile directory.

---

**Quelle `authentication.txt`**

Supported authentication types: Claude.ai credentials, Claude API credentials, Azure Auth, Bedrock Auth, and Vertex Auth.

---

**Quelle `authentication.txt`**

Custom credential scripts: the apiKeyHelper setting can be configured to run a shell script that returns an API key.

---

**Quelle `authentication.txt`**

Refresh intervals: by default, apiKeyHelper is called after 5 minutes or on HTTP 401 response. Set CLAUDE_CODE_API_KEY_HELPER_TTL_MS environment variable for custom refresh intervals.

---

**Quelle `authentication.txt`**

Slow helper notice: if apiKeyHelper takes longer than 10 seconds to return a key, Claude Code displays a warning notice in the prompt bar showing the elapsed time. If you see this notice regularly, check whether your credential script can be optimized.

---

**Quelle `authentication.txt`**

apiKeyHelper, ANTHROPIC_API_KEY, and ANTHROPIC_AUTH_TOKEN apply to terminal CLI sessions only. Claude Desktop and remote sessions use OAuth exclusively and do not call apiKeyHelper or read API key environment variables.

---

**Quelle `authentication.txt`**

When multiple credentials are present, Claude Code chooses one in this order:

---

**Quelle `authentication.txt`**

Cloud provider credentials, when CLAUDE_CODE_USE_BEDROCK, CLAUDE_CODE_USE_VERTEX, or CLAUDE_CODE_USE_FOUNDRY is set. See third-party integrations for setup.

---

**Quelle `authentication.txt`**

ANTHROPIC_AUTH_TOKEN environment variable. Sent as the Authorization: Bearer header. Use this when routing through an LLM gateway or proxy that authenticates with bearer tokens rather than Anthropic API keys.

---

**Quelle `authentication.txt`**

ANTHROPIC_API_KEY environment variable. Sent as the X-Api-Key header. Use this for direct Anthropic API access with a key from the Claude Console. In interactive mode, you are prompted once to approve or decline the key, and your choice is remembered. To change it later, use the “Use custom API key” toggle in /config. In non-interactive mode (-p), the key is always used when present.

---

**Quelle `authentication.txt`**

apiKeyHelper script output. Use this for dynamic or rotating credentials, such as short-lived tokens fetched from a vault.

---

**Quelle `server-managed-settings.txt`**

Agent SDK

---

**Quelle `server-managed-settings.txt`**

Authentication

---

**Quelle `server-managed-settings.txt`**

Usage and costs

---

**Quelle `server-managed-settings.txt`**

Track team usage with analytics

---

**Quelle `server-managed-settings.txt`**

Data usage

---

**Quelle `server-managed-settings.txt`**

Choose between server-managed and endpoint-managed settings

---

**Quelle `server-managed-settings.txt`**

Server-managed settings allow administrators to centrally configure Claude Code through a web-based interface on Claude.ai. Claude Code clients automatically receive these settings when users authenticate with their organization credentials.
This approach is designed for organizations that do not have device management infrastructure in place, or need to manage settings for users on unmanaged devices.

---

**Quelle `server-managed-settings.txt`**

Claude Code supports two approaches for centralized configuration. Server-managed settings deliver configuration from Anthropic’s servers. Endpoint-managed settings are deployed directly to devices through native OS policies (macOS managed preferences, Windows registry) or managed settings files.

---

**Quelle `server-managed-settings.txt`**

Server-managed settingsOrganizations without MDM, or users on unmanaged devicesSettings delivered from Anthropic’s servers at authentication time

---

**Quelle `server-managed-settings.txt`**

Endpoint-managed settingsOrganizations with MDM or endpoint managementSettings deployed to devices via MDM configuration profiles, registry policies, or managed settings files

---

**Quelle `server-managed-settings.txt`**

If your devices are enrolled in an MDM or endpoint management solution, endpoint-managed settings provide stronger security guarantees because the settings file can be protected from user modification at the OS level.

---

**Quelle `server-managed-settings.txt`**

Add your configuration as JSON. All settings available in settings.json are supported, including hooks, environment variables, and managed-only settings like allowManagedPermissionRulesOnly.This example enforces a permission deny list, prevents users from bypassing permissions, and restricts permission rules to those defined in managed settings:

---

**Quelle `server-managed-settings.txt`**

"deny": [
 "Bash(curl *)",
 "Read(./.env)",

---

**Quelle `server-managed-settings.txt`**

"hooks": {
 "PostToolUse": [
 {

---

**Quelle `server-managed-settings.txt`**

Most settings keys work in any scope. A handful of keys are only read from managed settings and have no effect when placed in user or project settings files. See managed-only settings for the full list. Any setting not on that list can still be placed in managed settings and takes the highest precedence.

---

**Quelle `server-managed-settings.txt`**

Server-managed settings and endpoint-managed settings both occupy the highest tier in the Claude Code settings hierarchy. No other settings level can override them, including command line arguments.
Within the managed tier, the first source that delivers a non-empty configuration wins. Server-managed settings are checked first, then endpoint-managed settings. Sources do not merge: if server-managed settings deliver any keys at all, endpoint-managed settings are ignored entirely. If server-managed settings deliver nothing, endpoint-managed settings apply.

---

**Quelle `server-managed-settings.txt`**

Server-managed settings and endpoint-managed settings both occupy the highest tier in the Claude Code settings hierarchy. No other settings level can override them, including command line arguments.
Within the managed tier, the first source that delivers a non-empty configuration wins. Server-managed settings are checked first, then endpoint-managed settings. Sources do not merge: if server-managed settings deliver any keys at all, endpoint-managed settings are ignored entirely. If server-managed settings deliver nothing, endpoint-managed settings apply.
If you clear your server-managed configuration in the admin console with the intent of falling back to an endpoint-managed plist or registry policy, be aware that cached settings persist on client machines until the next successful fetch. Run /status to see which managed source is active.

---

**Quelle `server-managed-settings.txt`**

Within the managed tier, the first source that delivers a non-empty configuration wins. Server-managed settings are checked first, then endpoint-managed settings. Sources do not merge: if server-managed settings deliver any keys at all, endpoint-managed settings are ignored entirely. If server-managed settings deliver nothing, endpoint-managed settings apply.
If you clear your server-managed configuration in the admin console with the intent of falling back to an endpoint-managed plist or registry policy, be aware that cached settings persist on client machines until the next successful fetch. Run /status to see which managed source is active.

---

**Quelle `server-managed-settings.txt`**

Before enabling this setting, ensure your network policies allow connectivity to api.anthropic.com. If that endpoint is unreachable, the CLI exits at startup and users cannot start Claude Code.

---

**Quelle `server-managed-settings.txt`**

Custom environment variables: variables not in the known safe allowlist

---

**Quelle `server-managed-settings.txt`**

Custom API endpoints via ANTHROPIC_BASE_URL or LLM gateways

---

**Quelle `server-managed-settings.txt`**

User authenticates with a different organizationSettings are not delivered for accounts outside the managed organization

---

**Quelle `server-managed-settings.txt`**

User sets a non-default ANTHROPIC_BASE_URLServer-managed settings are bypassed when using third-party API providers

---

**Quelle `server-managed-settings.txt`**

To detect runtime configuration changes, use ConfigChange hooks to log modifications or block unauthorized changes before they take effect.
For stronger enforcement guarantees, use endpoint-managed settings on devices enrolled in an MDM solution.

---

**Quelle `server-managed-settings.txt`**

Endpoint-managed settings: managed settings deployed to devices by IT

---

**Quelle `server-managed-settings.txt`**

Authentication: set up user access to Claude Code

---

**Quelle `server-managed-settings.txt`**

AuthenticationAuto mode

---

**Quelle `server-managed-settings.txt`**

Terms and policies
Privacy choicesPrivacy policyDisclosure policyUsage policyCommercial termsConsumer terms

---

**Quelle `server-managed-settings.txt`**

Responses are generated using AI and may contain mistakes.

---

**Quelle `setup.md`**

1. Install the Claude GitHub app to your repository: https://github.com/apps/claude
2. Add authentication to your repository secrets ([Learn how to use secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)):

---

**Quelle `setup.md`**

1. Install the Claude GitHub app to your repository: https://github.com/apps/claude
2. Add authentication to your repository secrets ([Learn how to use secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)):
   - Either `ANTHROPIC_API_KEY` for API key authentication

---

**Quelle `setup.md`**

2. Add authentication to your repository secrets ([Learn how to use secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)):
   - Either `ANTHROPIC_API_KEY` for API key authentication
   - Or `CLAUDE_CODE_OAUTH_TOKEN` for OAuth token authentication (Pro and Max users can generate this by running `claude setup-token` locally)

---

**Quelle `setup.md`**

- Either `ANTHROPIC_API_KEY` for API key authentication
   - Or `CLAUDE_CODE_OAUTH_TOKEN` for OAuth token authentication (Pro and Max users can generate this by running `claude setup-token` locally)
3. Copy the workflow file from [`examples/claude.yml`](../examples/claude.yml) into your repository's `.github/workflows/`

---

**Quelle `setup.md`**

**🚀 [Download the Quick Setup Tool](./create-app.html)** (Right-click → "Save Link As" or "Download Linked File")

---

**Quelle `setup.md`**

The tool will automatically configure all required permissions and submit the manifest.

---

**Quelle `setup.md`**

- Use the [`github-app-manifest.json`](../github-app-manifest.json) file from this repository
   - Visit https://github.com/settings/apps/new (for personal) or your organization's app settings
   - Look for the "Create from manifest" option and paste the JSON content

---

**Quelle `setup.md`**

- After creating the app, you'll be redirected to the app settings
   - Scroll down to "Private keys"

---

**Quelle `setup.md`**

- Go to https://github.com/settings/apps (for personal apps) or your organization's settings
   - Click "New GitHub App"

---

**Quelle `setup.md`**

4. **Add the app credentials to your repository secrets:**

---

**Quelle `setup.md`**

steps:
         # Generate a token from your custom app
         - name: Generate GitHub App token

---

**Quelle `setup.md`**

# Generate a token from your custom app
         - name: Generate GitHub App token
           id: app-token

---

**Quelle `setup.md`**

- name: Generate GitHub App token
           id: app-token
           uses: actions/create-github-app-token@v1

---

**Quelle `setup.md`**

id: app-token
           uses: actions/create-github-app-token@v1
           with:

---

**Quelle `setup.md`**

# Use Claude with your custom app's token
         - uses: anthropics/claude-code-action@v1

---

**Quelle `setup.md`**

anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
             github_token: ${{ steps.app-token.outputs.token }}
             # ... other configuration

---

**Quelle `setup.md`**

- The custom app must have read/write permissions for Issues, Pull Requests, and Contents
- Your app's token will have the exact permissions you configured, nothing more

---

**Quelle `setup.md`**

For more information on creating GitHub Apps, see the [GitHub documentation](https://docs.github.com/en/apps/creating-github-apps).

---

**Quelle `setup.md`**

**⚠️ IMPORTANT: Never commit API keys directly to your repository! Always use GitHub Actions secrets.**

---

**Quelle `setup.md`**

To securely use your Anthropic API key:

---

**Quelle `setup.md`**

1. Add your API key as a repository secret:

---

**Quelle `setup.md`**

- Name it `ANTHROPIC_API_KEY`
   - Paste your API key as the value

---

**Quelle `setup.md`**

```yaml
# ❌ WRONG - Exposes your API key
anthropic_api_key: "sk-ant-..."

---

**Quelle `setup.md`**

This applies to all sensitive values including API keys, access tokens, and credentials.
We also recommend that you always use short-lived tokens when possible

---

**Quelle `setup.md`**

3. Click "New repository secret"
4. For authentication, choose one:
   - API Key: Name: `ANTHROPIC_API_KEY`, Value: Your Anthropic API key (starting with `sk-ant-`)

---

**Quelle `setup.md`**

4. For authentication, choose one:
   - API Key: Name: `ANTHROPIC_API_KEY`, Value: Your Anthropic API key (starting with `sk-ant-`)
   - OAuth Token: Name: `CLAUDE_CODE_OAUTH_TOKEN`, Value: Your Claude Code OAuth token (Pro and Max users can generate this by running `claude setup-token` locally)

---

**Quelle `setup.md`**

- API Key: Name: `ANTHROPIC_API_KEY`, Value: Your Anthropic API key (starting with `sk-ant-`)
   - OAuth Token: Name: `CLAUDE_CODE_OAUTH_TOKEN`, Value: Your Claude Code OAuth token (Pro and Max users can generate this by running `claude setup-token` locally)
5. Click "Add secret"

---

**Quelle `setup.md`**

### Best Practices for Authentication

---

**Quelle `setup.md`**

1. ✅ Always use `${{ secrets.ANTHROPIC_API_KEY }}` or `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` in workflows
2. ✅ Never commit API keys or tokens to version control

---

**Quelle `setup.md`**

1. ✅ Always use `${{ secrets.ANTHROPIC_API_KEY }}` or `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` in workflows
2. ✅ Never commit API keys or tokens to version control
3. ✅ Regularly rotate your API keys and tokens

---

**Quelle `setup.md`**

2. ✅ Never commit API keys or tokens to version control
3. ✅ Regularly rotate your API keys and tokens
4. ✅ Use environment secrets for organization-wide access

---

**Quelle `setup.md`**

4. ✅ Use environment secrets for organization-wide access
5. ❌ Never share API keys or tokens in pull requests or issues
6. ❌ Avoid logging workflow variables that might contain keys

---

**Quelle `troubleshooting.txt`**

Agent SDK

---

**Quelle `troubleshooting.txt`**

Tools and plugins

---

**Quelle `troubleshooting.txt`**

Programmatic usage

---

**Quelle `troubleshooting.txt`**

curl: (56) Failure writing output to destination

---

**Quelle `troubleshooting.txt`**

Permissions and authentication

---

**Quelle `troubleshooting.txt`**

Authentication issues

---

**Quelle `troubleshooting.txt`**

OAuth error: Invalid code

---

**Quelle `troubleshooting.txt`**

403 Forbidden after login

---

**Quelle `troubleshooting.txt`**

OAuth login fails in WSL2

---

**Quelle `troubleshooting.txt`**

Not logged in or token expired

---

**Quelle `troubleshooting.txt`**

High CPU or memory usage

---

**Quelle `troubleshooting.txt`**

Discover solutions to common issues with Claude Code installation and usage.

---

**Quelle `troubleshooting.txt`**

syntax error near unexpected token '<'Install script returns HTML

---

**Quelle `troubleshooting.txt`**

curl: (56) Failure writing output to destinationDownload script first, then run it

---

**Quelle `troubleshooting.txt`**

OAuth error or 403 ForbiddenFix authentication

---

**Quelle `troubleshooting.txt`**

curl -sI https://downloads.claude.ai

---

**Quelle `troubleshooting.txt`**

export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080

---

**Quelle `troubleshooting.txt`**

export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
curl -fsSL https://claude.ai/install.sh | bash

---

**Quelle `troubleshooting.txt`**

export HTTPS_PROXY=http://proxy.example.com:8080
curl -fsSL https://claude.ai/install.sh | bash

---

**Quelle `troubleshooting.txt`**

If there’s no output, open System Settings, go to Environment Variables, and add %USERPROFILE%\.local\bin to your User PATH variable. Restart your terminal.Verify the fix worked:

---

**Quelle `troubleshooting.txt`**

bash: line 1: syntax error near unexpected token `<'
bash: line 1: `<!DOCTYPE html>'

---

**Quelle `troubleshooting.txt`**

The curl ... | bash command downloads the script and passes it directly to Bash for execution using a pipe (|). This error means the connection broke before the script finished downloading. Common causes include network interruptions, the download being blocked mid-stream, or system resource limits.
Solutions:

---

**Quelle `troubleshooting.txt`**

curl -fsSL https://downloads.claude.ai -o /dev/null

---

**Quelle `troubleshooting.txt`**

Errors like curl: (35) TLS connect error, schannel: next InitializeSecurityContext failed, or PowerShell’s Could not establish trust relationship for the SSL/TLS secure channel indicate TLS handshake failures.
Solutions:

---

**Quelle `troubleshooting.txt`**

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
irm https://claude.ai/install.ps1 | iex

---

**Quelle `troubleshooting.txt`**

On Windows, bypass certificate revocation checks if you see CRYPT_E_NO_REVOCATION_CHECK (0x80092012) or CRYPT_E_REVOCATION_OFFLINE (0x80092013). These mean curl reached the server but your network blocks the certificate revocation lookup, which is common behind corporate firewalls. Add --ssl-revoke-best-effort to the install command:

---

**Quelle `troubleshooting.txt`**

curl --ssl-revoke-best-effort -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd

---

**Quelle `troubleshooting.txt`**

Alternatively, install with winget install Anthropic.ClaudeCode, which avoids curl entirely.

---

**Quelle `troubleshooting.txt`**

If you see 'irm' is not recognized, The token '&&' is not valid, or 'bash' is not recognized as the name of a cmdlet, you copied the install command for a different shell or operating system.

---

**Quelle `troubleshooting.txt`**

irm https://claude.ai/install.ps1 | iex

---

**Quelle `troubleshooting.txt`**

curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd

---

**Quelle `troubleshooting.txt`**

curl -fsSL https://claude.ai/install.sh | bash

---

**Quelle `troubleshooting.txt`**

Close other processes to free memory before installing.

---

**Quelle `troubleshooting.txt`**

Set a working directory before running the installer. When run from /, the installer scans the entire filesystem, which causes excessive memory usage. Setting WORKDIR limits the scan to a small directory:

---

**Quelle `troubleshooting.txt`**

WORKDIR /tmp
RUN curl -fsSL https://claude.ai/install.sh | bash

---

**Quelle `troubleshooting.txt`**

If you’re on glibc but got the musl binary, remove the installation and reinstall. You can also manually download the correct binary using the manifest at https://downloads.claude.ai/claude-code-releases/{VERSION}/manifest.json. File a GitHub issue with the output of ldd /bin/ls and ls /lib/libc.musl*.

---

**Quelle `troubleshooting.txt`**

If you see dyld: cannot load, dyld: Symbol not found, or Abort trap: 6 during installation, the binary is incompatible with your macOS version or hardware.

---

**Quelle `troubleshooting.txt`**

Experiencing broken functionality after switching Node versions with nvm in WSL

---

**Quelle `troubleshooting.txt`**

These sections address login failures, token issues, and permission prompt behavior.

---

**Quelle `troubleshooting.txt`**

If you find yourself repeatedly approving the same commands, you can allow specific tools
to run without approval using the /permissions command. See Permissions docs.

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `authentication.txt`**

````text
claude setup-token
````

---

**Quelle `authentication.txt`**

````text
export CLAUDE_CODE_OAUTH_TOKEN=your-token
````

---

**Quelle `setup.md`**

````text
name: Claude with Custom App
   on:
     issue_comment:
       types: [created]
     # ... other triggers

   jobs:
     claude-response:
       runs-on: ubuntu-latest
       steps:
         # Generate a token from your custom app
         - name: Generate GitHub App token
           id: app-token
           uses: actions/create-github-app-token@v1
           with:
             app-id: ${{ secrets.APP_ID }}
             private-key: ${{ secrets.APP_PRIVATE_KEY }}

         # Use Claude with your custom app's token
         - uses: anthropics/claude-code-action@v1
           with:
             anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
             github_token: ${{ steps.app-token.outputs.token }}
             # ... other configuration
````

---

**Quelle `setup.md`**

````text
anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
````

---

**Quelle `setup.md`**

````text
# ❌ WRONG - Exposes your API key
anthropic_api_key: "sk-ant-..."
````

---

**Quelle `setup.md`**

````text
# ✅ CORRECT - Uses GitHub secrets
anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
````

---

**Quelle `setup.md`**

````text
anthropic_api_key: "sk-ant-..."
````

---

**Quelle `troubleshooting.txt`**

````text
curl -sI https://downloads.claude.ai
````

---

**Quelle `troubleshooting.txt`**

````text
export HTTP_PROXY=http://proxy.example.com:8080
````

---

**Quelle `troubleshooting.txt`**

````text
export HTTPS_PROXY=http://proxy.example.com:8080
````

---

**Quelle `troubleshooting.txt`**

````text
curl -fsSL https://claude.ai/install.sh | bash
````

---

**Quelle `troubleshooting.txt`**

````text
claude --version
````

---

**Quelle `troubleshooting.txt`**

````text
npm -g ls @anthropic-ai/claude-code 2>/dev/null
````

---

**Quelle `troubleshooting.txt`**

````text
npm uninstall -g @anthropic-ai/claude-code
````

---

**Quelle `troubleshooting.txt`**

````text
curl -fsSL https://downloads.claude.ai -o /dev/null
````

---

**Quelle `troubleshooting.txt`**

````text
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
````

---

**Quelle `troubleshooting.txt`**

````text
curl --ssl-revoke-best-effort -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
````

---

**Quelle `troubleshooting.txt`**

````text
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
````

---

**Quelle `troubleshooting.txt`**

````text
export NVM_DIR="$HOME/.nvm"
````

---

**Quelle `troubleshooting.txt`**

````text
export PATH="$HOME/.nvm/versions/node/$(node -v)/bin:$PATH"
````

---

**Quelle `troubleshooting.txt`**

````text
export BROWSER="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>Oauth/ClaudeCode/authentication.txt</code></summary>

````text
Authentication - Claude Code Docs

Skip to main content

Claude Code Docs home page

English

Search...

⌘KAsk AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Setup and access

Authentication

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Agent SDK

What's New

Resources

Setup and access

Administration overview

Advanced setup

Authentication

Server-managed settings

Auto mode

Usage and costs

Monitoring

Costs

Track team usage with analytics

Plugin distribution

Create and distribute a plugin marketplace

Plugin dependency versions

Security and data

Security

Data usage

Zero data retention

On this page

Log in to Claude Code

Set up team authentication

Claude for Teams or Enterprise

Claude Console authentication

Cloud provider authentication

Credential management

Authentication precedence

Generate a long-lived token

Setup and access

Authentication

Copy page

Log in to Claude Code and configure authentication for individuals, teams, and organizations.

Copy page

Claude Code supports multiple authentication methods depending on your setup. Individual users can log in with a Claude.ai account, while teams can use Claude for Teams or Enterprise, the Claude Console, or a cloud provider like Amazon Bedrock, Google Vertex AI, or Microsoft Foundry.

​

Log in to Claude Code

After installing Claude Code, run claude in your terminal. On first launch, Claude Code opens a browser window for you to log in.
If the browser doesn’t open automatically, press c to copy the login URL to your clipboard, then paste it into your browser.
If your browser shows a login code instead of redirecting back after you sign in, paste it into the terminal at the Paste code here if prompted prompt.
You can authenticate with any of these account types:

Claude Pro or Max subscription: log in with your Claude.ai account. Subscribe at claude.com/pricing.

Claude for Teams or Enterprise: log in with the Claude.ai account your team admin invited you to.

Claude Console: log in with your Console credentials. Your admin must have invited you first.

Cloud providers: if your organization uses Amazon Bedrock, Google Vertex AI, or Microsoft Foundry, set the required environment variables before running claude. No browser login is needed.

To log out and re-authenticate, type /logout at the Claude Code prompt.
If you’re having trouble logging in, see authentication troubleshooting.

​

Set up team authentication

For teams and organizations, you can configure Claude Code access in one of these ways:

Claude for Teams or Enterprise, recommended for most teams

Claude Console

Amazon Bedrock

Google Vertex AI

Microsoft Foundry

​

Claude for Teams or Enterprise

Claude for Teams and Claude for Enterprise provide the best experience for organizations using Claude Code. Team members get access to both Claude Code and Claude on the web with centralized billing and team management.

Claude for Teams: self-service plan with collaboration features, admin tools, and billing management. Best for smaller teams.

Claude for Enterprise: adds SSO, domain capture, role-based permissions, compliance API, and managed policy settings for organization-wide Claude Code configurations. Best for larger organizations with security and compliance requirements.

1

Subscribe

Subscribe to Claude for Teams or contact sales for Claude for Enterprise.

2

Invite team members

Invite team members from the admin dashboard.

3

Install and log in

Team members install Claude Code and log in with their Claude.ai accounts.

​

Claude Console authentication

For organizations that prefer API-based billing, you can set up access through the Claude Console.

1

Create or use a Console account

Use your existing Claude Console account or create a new one.

2

Add users

You can add users through either method:

Bulk invite users from within the Console: Settings -> Members -> Invite

Set up SSO

3

Assign roles

When inviting users, assign one of:

Claude Code role: users can only create Claude Code API keys

Developer role: users can create any kind of API key

4

Users complete setup

Each invited user needs to:

Accept the Console invite

Check system requirements

Install Claude Code

Log in with Console account credentials

​

Cloud provider authentication

For teams using Amazon Bedrock, Google Vertex AI, or Microsoft Foundry:

1

Follow provider setup

Follow the Bedrock docs, Vertex docs, or Microsoft Foundry docs.

2

Distribute configuration

Distribute the environment variables and instructions for generating cloud credentials to your users. Read more about how to manage configuration here.

3

Install Claude Code

Users can install Claude Code.

​

Credential management

Claude Code securely manages your authentication credentials:

Storage location: on macOS, credentials are stored in the encrypted macOS Keychain. On Linux and Windows, credentials are stored in ~/.claude/.credentials.json, or under $CLAUDE_CONFIG_DIR if that variable is set. On Linux, the file is written with mode 0600; on Windows, it inherits the access controls of your user profile directory.

Supported authentication types: Claude.ai credentials, Claude API credentials, Azure Auth, Bedrock Auth, and Vertex Auth.

Custom credential scripts: the apiKeyHelper setting can be configured to run a shell script that returns an API key.

Refresh intervals: by default, apiKeyHelper is called after 5 minutes or on HTTP 401 response. Set CLAUDE_CODE_API_KEY_HELPER_TTL_MS environment variable for custom refresh intervals.

Slow helper notice: if apiKeyHelper takes longer than 10 seconds to return a key, Claude Code displays a warning notice in the prompt bar showing the elapsed time. If you see this notice regularly, check whether your credential script can be optimized.

apiKeyHelper, ANTHROPIC_API_KEY, and ANTHROPIC_AUTH_TOKEN apply to terminal CLI sessions only. Claude Desktop and remote sessions use OAuth exclusively and do not call apiKeyHelper or read API key environment variables.

​

Authentication precedence

When multiple credentials are present, Claude Code chooses one in this order:

Cloud provider credentials, when CLAUDE_CODE_USE_BEDROCK, CLAUDE_CODE_USE_VERTEX, or CLAUDE_CODE_USE_FOUNDRY is set. See third-party integrations for setup.

ANTHROPIC_AUTH_TOKEN environment variable. Sent as the Authorization: Bearer header. Use this when routing through an LLM gateway or proxy that authenticates with bearer tokens rather than Anthropic API keys.

ANTHROPIC_API_KEY environment variable. Sent as the X-Api-Key header. Use this for direct Anthropic API access with a key from the Claude Console. In interactive mode, you are prompted once to approve or decline the key, and your choice is remembered. To change it later, use the “Use custom API key” toggle in /config. In non-interactive mode (-p), the key is always used when present.

apiKeyHelper script output. Use this for dynamic or rotating credentials, such as short-lived tokens fetched from a vault.

CLAUDE_CODE_OAUTH_TOKEN environment variable. A long-lived OAuth token generated by claude setup-token. Use this for CI pipelines and scripts where browser login isn’t available.

Subscription OAuth credentials from /login. This is the default for Claude Pro, Max, Team, and Enterprise users.

If you have an active Claude subscription but also have ANTHROPIC_API_KEY set in your environment, the API key takes precedence once approved. This can cause authentication failures if the key belongs to a disabled or expired organization. Run unset ANTHROPIC_API_KEY to fall back to your subscription, and check /status to confirm which method is active.
Claude Code on the Web always uses your subscription credentials. ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN in the sandbox environment do not override them.

​

Generate a long-lived token

For CI pipelines, scripts, or other environments where interactive browser login isn’t available, generate a one-year OAuth token with claude setup-token:

claude setup-token

The command walks you through OAuth authorization and prints a token to the terminal. It does not save the token anywhere; copy it and set it as the CLAUDE_CODE_OAUTH_TOKEN environment variable wherever you want to authenticate:

export CLAUDE_CODE_OAUTH_TOKEN=your-token

This token authenticates with your Claude subscription and requires a Pro, Max, Team, or Enterprise plan. It is scoped to inference only and cannot establish Remote Control sessions.
Bare mode does not read CLAUDE_CODE_OAUTH_TOKEN. If your script passes --bare, authenticate with ANTHROPIC_API_KEY or an apiKeyHelper instead.

Was this page helpful?

YesNo

Advanced setupServer-managed settings

⌘I

Claude Code Docs home page
xlinkedin

Company
AnthropicCareersEconomic FuturesResearchNewsTrust centerTransparency

Help and security
AvailabilityStatusSupport center

Learn
CoursesMCP connectorsCustomer storiesEngineering blogEventsPowered by ClaudeService partnersStartups program

Terms and policies
Privacy choicesPrivacy policyDisclosure policyUsage policyCommercial termsConsumer terms

Assistant

Responses are generated using AI and may contain mistakes.
````

</details>


<details>
<summary>Textanlage: <code>Oauth/ClaudeCode/server-managed-settings.txt</code></summary>

````text
Configure server-managed settings - Claude Code Docs

Skip to main content

Claude Code Docs home page

English

Search...

⌘KAsk AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Setup and access

Configure server-managed settings

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Agent SDK

What's New

Resources

Setup and access

Administration overview

Advanced setup

Authentication

Server-managed settings

Auto mode

Usage and costs

Monitoring

Costs

Track team usage with analytics

Plugin distribution

Create and distribute a plugin marketplace

Plugin dependency versions

Security and data

Security

Data usage

Zero data retention

On this page

Requirements

Choose between server-managed and endpoint-managed settings

Configure server-managed settings

Verify settings delivery

Access control

Managed-only settings

Current limitations

Settings delivery

Settings precedence

Fetch and caching behavior

Enforce fail-closed startup

Security approval dialogs

Platform availability

Audit logging

Security considerations

See also

Setup and access

Configure server-managed settings

Copy page

Centrally configure Claude Code for your organization through server-delivered settings, without requiring device management infrastructure.

Copy page

Server-managed settings allow administrators to centrally configure Claude Code through a web-based interface on Claude.ai. Claude Code clients automatically receive these settings when users authenticate with their organization credentials.
This approach is designed for organizations that do not have device management infrastructure in place, or need to manage settings for users on unmanaged devices.

Server-managed settings are available for Claude for Teams and Claude for Enterprise customers.

​

Requirements

To use server-managed settings, you need:

Claude for Teams or Claude for Enterprise plan

Claude Code version 2.1.38 or later for Claude for Teams, or version 2.1.30 or later for Claude for Enterprise

Network access to api.anthropic.com

​

Choose between server-managed and endpoint-managed settings

Claude Code supports two approaches for centralized configuration. Server-managed settings deliver configuration from Anthropic’s servers. Endpoint-managed settings are deployed directly to devices through native OS policies (macOS managed preferences, Windows registry) or managed settings files.

ApproachBest forSecurity model

Server-managed settingsOrganizations without MDM, or users on unmanaged devicesSettings delivered from Anthropic’s servers at authentication time

Endpoint-managed settingsOrganizations with MDM or endpoint managementSettings deployed to devices via MDM configuration profiles, registry policies, or managed settings files

If your devices are enrolled in an MDM or endpoint management solution, endpoint-managed settings provide stronger security guarantees because the settings file can be protected from user modification at the OS level.

​

Configure server-managed settings

1

Open the admin console

In Claude.ai, navigate to Admin Settings > Claude Code > Managed settings.

2

Define your settings

Add your configuration as JSON. All settings available in settings.json are supported, including hooks, environment variables, and managed-only settings like allowManagedPermissionRulesOnly.This example enforces a permission deny list, prevents users from bypassing permissions, and restricts permission rules to those defined in managed settings:

{
 "permissions": {
 "deny": [
 "Bash(curl *)",
 "Read(./.env)",
 "Read(./.env.*)",
 "Read(./secrets/**)"
 ],
 "disableBypassPermissionsMode": "disable"
 },
 "allowManagedPermissionRulesOnly": true
}

Hooks use the same format as in settings.json.This example runs an audit script after every file edit across the organization:

{
 "hooks": {
 "PostToolUse": [
 {
 "matcher": "Edit|Write",
 "hooks": [
 { "type": "command", "command": "/usr/local/bin/audit-edit.sh" }
 ]
 }
 ]
 }
}

To configure the auto mode classifier so it knows which repos, buckets, and domains your organization trusts:

{
 "autoMode": {
 "environment": [
 "Source control: github.example.com/acme-corp and all repos under it",
 "Trusted cloud buckets: s3://acme-build-artifacts, gs://acme-ml-datasets",
 "Trusted internal domains: *.corp.example.com"
 ]
 }
}

Because hooks execute shell commands, users see a security approval dialog before they’re applied. See Configure auto mode for how the autoMode entries affect what the classifier blocks and important warnings about the allow and soft_deny fields.

3

Save and deploy

Save your changes. Claude Code clients receive the updated settings on their next startup or hourly polling cycle.

​

Verify settings delivery

To confirm that settings are being applied, ask a user to restart Claude Code. If the configuration includes settings that trigger the security approval dialog, the user sees a prompt describing the managed settings on startup. You can also verify that managed permission rules are active by having a user run /permissions to view their effective permission rules.

​

Access control

The following roles can manage server-managed settings:

Primary Owner

Owner

Restrict access to trusted personnel, as settings changes apply to all users in the organization.

​

Managed-only settings

Most settings keys work in any scope. A handful of keys are only read from managed settings and have no effect when placed in user or project settings files. See managed-only settings for the full list. Any setting not on that list can still be placed in managed settings and takes the highest precedence.

​

Current limitations

Server-managed settings have the following limitations:

Settings apply uniformly to all users in the organization. Per-group configurations are not yet supported.

MCP server configurations cannot be distributed through server-managed settings.

​

Settings delivery

​

Settings precedence

Server-managed settings and endpoint-managed settings both occupy the highest tier in the Claude Code settings hierarchy. No other settings level can override them, including command line arguments.
Within the managed tier, the first source that delivers a non-empty configuration wins. Server-managed settings are checked first, then endpoint-managed settings. Sources do not merge: if server-managed settings deliver any keys at all, endpoint-managed settings are ignored entirely. If server-managed settings deliver nothing, endpoint-managed settings apply.
If you clear your server-managed configuration in the admin console with the intent of falling back to an endpoint-managed plist or registry policy, be aware that cached settings persist on client machines until the next successful fetch. Run /status to see which managed source is active.

​

Fetch and caching behavior

Claude Code fetches settings from Anthropic’s servers at startup and polls for updates hourly during active sessions.
First launch without cached settings:

Claude Code fetches settings asynchronously

If the fetch fails, Claude Code continues without managed settings

There is a brief window before settings load where restrictions are not yet enforced

Subsequent launches with cached settings:

Cached settings apply immediately at startup

Claude Code fetches fresh settings in the background

Cached settings persist through network failures

Claude Code applies settings updates automatically without a restart, except for advanced settings like OpenTelemetry configuration, which require a full restart to take effect.

​

Enforce fail-closed startup

By default, if the remote settings fetch fails at startup, the CLI continues without managed settings. For environments where this brief unenforced window is unacceptable, set forceRemoteSettingsRefresh: true in your managed settings.
When this setting is active, the CLI blocks at startup until remote settings are freshly fetched. If the fetch fails, the CLI exits rather than proceeding without the policy. This setting self-perpetuates: once delivered from the server, it is also cached locally so that subsequent startups enforce the same behavior even before the first successful fetch of a new session.
To enable this, add the key to your managed settings configuration:

{
 "forceRemoteSettingsRefresh": true
}

Before enabling this setting, ensure your network policies allow connectivity to api.anthropic.com. If that endpoint is unreachable, the CLI exits at startup and users cannot start Claude Code.

​

Security approval dialogs

Certain settings that could pose security risks require explicit user approval before being applied:

Shell command settings: settings that execute shell commands

Custom environment variables: variables not in the known safe allowlist

Hook configurations: any hook definition

When these settings are present, users see a security dialog explaining what is being configured. Users must approve to proceed. If a user rejects the settings, Claude Code exits.

In non-interactive mode with the -p flag, Claude Code skips security dialogs and applies settings without user approval.

​

Platform availability

Server-managed settings require a direct connection to api.anthropic.com and are not available when using third-party model providers:

Amazon Bedrock

Google Vertex AI

Microsoft Foundry

Custom API endpoints via ANTHROPIC_BASE_URL or LLM gateways

​

Audit logging

Audit log events for settings changes are available through the compliance API or audit log export. Contact your Anthropic account team for access.
Audit events include the type of action performed, the account and device that performed the action, and references to the previous and new values.

​

Security considerations

Server-managed settings provide centralized policy enforcement, but they operate as a client-side control. On unmanaged devices, users with admin or sudo access can modify the Claude Code binary, filesystem, or network configuration.

ScenarioBehavior

User edits the cached settings fileTampered file applies at startup, but correct settings restore on the next server fetch

User deletes the cached settings fileFirst-launch behavior occurs: settings fetch asynchronously with a brief unenforced window

API is unavailableCached settings apply if available, otherwise managed settings are not enforced until the next successful fetch. With forceRemoteSettingsRefresh: true, the CLI exits instead of continuing

User authenticates with a different organizationSettings are not delivered for accounts outside the managed organization

User sets a non-default ANTHROPIC_BASE_URLServer-managed settings are bypassed when using third-party API providers

To detect runtime configuration changes, use ConfigChange hooks to log modifications or block unauthorized changes before they take effect.
For stronger enforcement guarantees, use endpoint-managed settings on devices enrolled in an MDM solution.

​

See also

Related pages for managing Claude Code configuration:

Settings: complete configuration reference including all available settings

Endpoint-managed settings: managed settings deployed to devices by IT

Authentication: set up user access to Claude Code

Security: security safeguards and best practices

Was this page helpful?

YesNo

AuthenticationAuto mode

⌘I

Claude Code Docs home page
xlinkedin

Company
AnthropicCareersEconomic FuturesResearchNewsTrust centerTransparency

Help and security
AvailabilityStatusSupport center

Learn
CoursesMCP connectorsCustomer storiesEngineering blogEventsPowered by ClaudeService partnersStartups program

Terms and policies
Privacy choicesPrivacy policyDisclosure policyUsage policyCommercial termsConsumer terms

Assistant

Responses are generated using AI and may contain mistakes.
````

</details>


<details>
<summary>Textanlage: <code>Oauth/ClaudeCode/setup.md</code></summary>

````text
# Setup Guide

## Manual Setup (Direct API)

**Requirements**: You must be a repository admin to complete these steps.

1. Install the Claude GitHub app to your repository: https://github.com/apps/claude
2. Add authentication to your repository secrets ([Learn how to use secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)):
   - Either `ANTHROPIC_API_KEY` for API key authentication
   - Or `CLAUDE_CODE_OAUTH_TOKEN` for OAuth token authentication (Pro and Max users can generate this by running `claude setup-token` locally)
3. Copy the workflow file from [`examples/claude.yml`](../examples/claude.yml) into your repository's `.github/workflows/`

## Using a Custom GitHub App

If you prefer not to install the official Claude app, you can create your own GitHub App to use with this action. This gives you complete control over permissions and access.

**When you may want to use a custom GitHub App:**

- You need more restrictive permissions than the official app
- Organization policies prevent installing third-party apps
- You're using AWS Bedrock or Google Vertex AI

### Option 1: Quick Setup with App Manifest (Recommended)

The fastest way to create a custom GitHub App is using our pre-configured manifest. This ensures all permissions are correctly set up with a single click.

**Steps:**

1. **Create the app:**

   **🚀 [Download the Quick Setup Tool](./create-app.html)** (Right-click → "Save Link As" or "Download Linked File")

   After downloading, open `create-app.html` in your web browser:

   - **For Personal Accounts:** Click the "Create App for Personal Account" button
   - **For Organizations:** Enter your organization name and click "Create App for Organization"

   The tool will automatically configure all required permissions and submit the manifest.

   Alternatively, you can use the manifest file directly:

   - Use the [`github-app-manifest.json`](../github-app-manifest.json) file from this repository
   - Visit https://github.com/settings/apps/new (for personal) or your organization's app settings
   - Look for the "Create from manifest" option and paste the JSON content

2. **Complete the creation flow:**

   - GitHub will show you a preview of the app configuration
   - Confirm the app name (you can customize it)
   - Click "Create GitHub App"
   - The app will be created with all required permissions automatically configured

3. **Generate and download a private key:**

   - After creating the app, you'll be redirected to the app settings
   - Scroll down to "Private keys"
   - Click "Generate a private key"
   - Download the `.pem` file (keep this secure!)

4. **Continue with installation** - Skip to step 3 in the manual setup below to install the app and configure your workflow.

### Option 2: Manual Setup

If you prefer to configure the app manually or need custom permissions:

1. **Create a new GitHub App:**

   - Go to https://github.com/settings/apps (for personal apps) or your organization's settings
   - Click "New GitHub App"
   - Configure the app with these minimum permissions:
     - **Repository permissions:**
       - Contents: Read & Write
       - Issues: Read & Write
       - Pull requests: Read & Write
     - **Account permissions:** None required
   - Set "Where can this GitHub App be installed?" to your preference
   - Create the app

2. **Generate and download a private key:**

   - After creating the app, scroll down to "Private keys"
   - Click "Generate a private key"
   - Download the `.pem` file (keep this secure!)

3. **Install the app on your repository:**

   - Go to the app's settings page
   - Click "Install App"
   - Select the repositories where you want to use Claude

4. **Add the app credentials to your repository secrets:**

   - Go to your repository's Settings → Secrets and variables → Actions
   - Add these secrets:
     - `APP_ID`: Your GitHub App's ID (found in the app settings)
     - `APP_PRIVATE_KEY`: The contents of the downloaded `.pem` file

5. **Update your workflow to use the custom app:**

   ```yaml
   name: Claude with Custom App
   on:
     issue_comment:
       types: [created]
     # ... other triggers

   jobs:
     claude-response:
       runs-on: ubuntu-latest
       steps:
         # Generate a token from your custom app
         - name: Generate GitHub App token
           id: app-token
           uses: actions/create-github-app-token@v1
           with:
             app-id: ${{ secrets.APP_ID }}
             private-key: ${{ secrets.APP_PRIVATE_KEY }}

         # Use Claude with your custom app's token
         - uses: anthropics/claude-code-action@v1
           with:
             anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
             github_token: ${{ steps.app-token.outputs.token }}
             # ... other configuration
   ```

**Important notes:**

- The custom app must have read/write permissions for Issues, Pull Requests, and Contents
- Your app's token will have the exact permissions you configured, nothing more

For more information on creating GitHub Apps, see the [GitHub documentation](https://docs.github.com/en/apps/creating-github-apps).

## Security Best Practices

**⚠️ IMPORTANT: Never commit API keys directly to your repository! Always use GitHub Actions secrets.**

To securely use your Anthropic API key:

1. Add your API key as a repository secret:

   - Go to your repository's Settings
   - Navigate to "Secrets and variables" → "Actions"
   - Click "New repository secret"
   - Name it `ANTHROPIC_API_KEY`
   - Paste your API key as the value

2. Reference the secret in your workflow:
   ```yaml
   anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
   ```

**Never do this:**

```yaml
# ❌ WRONG - Exposes your API key
anthropic_api_key: "sk-ant-..."
```

**Always do this:**

```yaml
# ✅ CORRECT - Uses GitHub secrets
anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

This applies to all sensitive values including API keys, access tokens, and credentials.
We also recommend that you always use short-lived tokens when possible

## Setting Up GitHub Secrets

1. Go to your repository's Settings
2. Click on "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. For authentication, choose one:
   - API Key: Name: `ANTHROPIC_API_KEY`, Value: Your Anthropic API key (starting with `sk-ant-`)
   - OAuth Token: Name: `CLAUDE_CODE_OAUTH_TOKEN`, Value: Your Claude Code OAuth token (Pro and Max users can generate this by running `claude setup-token` locally)
5. Click "Add secret"

### Best Practices for Authentication

1. ✅ Always use `${{ secrets.ANTHROPIC_API_KEY }}` or `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` in workflows
2. ✅ Never commit API keys or tokens to version control
3. ✅ Regularly rotate your API keys and tokens
4. ✅ Use environment secrets for organization-wide access
5. ❌ Never share API keys or tokens in pull requests or issues
6. ❌ Avoid logging workflow variables that might contain keys
````

</details>


<details>
<summary>Textanlage: <code>Oauth/ClaudeCode/troubleshooting.txt</code></summary>

````text
Troubleshooting - Claude Code Docs

Skip to main content

Claude Code Docs home page

English

Search...

⌘KAsk AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Troubleshooting

Troubleshooting

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Agent SDK

What's New

Resources

Agents

Create custom subagents

Run agent teams

Tools and plugins

Model Context Protocol (MCP)

Discover and install prebuilt plugins

Create plugins

Extend Claude with skills

Automation

Automate with hooks

Push external events to Claude

Run prompts on a schedule

Programmatic usage

Troubleshooting

Troubleshooting

Debug configuration

Error reference

On this page

Troubleshoot installation issues

Debug installation problems

Check network connectivity

Verify your PATH

Check for conflicting installations

Check directory permissions

Verify the binary works

Common installation issues

Install script returns HTML instead of a shell script

command not found: claude after installation

curl: (56) Failure writing output to destination

TLS or SSL connection errors

Failed to fetch version from downloads.claude.ai

Windows: wrong install command

Install killed on low-memory Linux servers

Install hangs in Docker

Windows: Claude Desktop overrides claude CLI command

Windows: Claude Code on Windows requires git-bash

Windows: Claude Code does not support 32-bit Windows

Linux: wrong binary variant installed (musl/glibc mismatch)

Illegal instruction on Linux

dyld: cannot load on macOS

Windows installation issues: errors in WSL

WSL2 sandbox setup

Permission errors during installation

Native binary not found after npm install

Permissions and authentication

Repeated permission prompts

Authentication issues

OAuth error: Invalid code

403 Forbidden after login

Model not found or not accessible

This organization has been disabled with an active subscription

OAuth login fails in WSL2

Not logged in or token expired

Configuration file locations

Resetting configuration

Performance and stability

High CPU or memory usage

Auto-compaction stops with a thrashing error

Command hangs or freezes

Search and discovery issues

Slow or incomplete search results on WSL

IDE integration issues

JetBrains IDE not detected on WSL2

WSL2 networking modes

Report Windows IDE integration issues

Escape key not working in JetBrains IDE terminals

Markdown formatting issues

Missing language tags in code blocks

Inconsistent spacing and formatting

Reduce markdown formatting issues

Get more help

Troubleshooting

Troubleshooting

Copy page

Discover solutions to common issues with Claude Code installation and usage.

Copy page

​

Troubleshoot installation issues

If you’d rather skip the terminal entirely, the Claude Code Desktop app lets you install and use Claude Code through a graphical interface. Download it for macOS or Windows and start coding without any command-line setup.

Find the error message or symptom you’re seeing:

What you seeSolution

command not found: claude or 'claude' is not recognizedFix your PATH

syntax error near unexpected token '<'Install script returns HTML

curl: (56) Failure writing output to destinationDownload script first, then run it

Killed during install on LinuxAdd swap space for low-memory servers

TLS connect error or SSL/TLS secure channelUpdate CA certificates

Failed to fetch version or can’t reach download serverCheck network and proxy settings

irm is not recognized or && is not validUse the right command for your shell

'bash' is not recognized as the name of a cmdletUse the Windows installer command

Claude Code on Windows requires git-bashInstall or configure Git Bash

Claude Code does not support 32-bit WindowsOpen Windows PowerShell, not the x86 entry

Error loading shared libraryWrong binary variant for your system

Illegal instruction on LinuxArchitecture mismatch

dyld: cannot load, dyld: Symbol not found, or Abort trap on macOSBinary incompatibility

Invoke-Expression: Missing argument in parameter listInstall script returns HTML

App unavailable in regionClaude Code is not available in your country. See supported countries.

unable to get local issuer certificateConfigure corporate CA certificates

OAuth error or 403 ForbiddenFix authentication

API Error: 500, 529 Overloaded, 429, or other 4xx and 5xx errors not listed aboveSee the Error reference

If your issue isn’t listed, work through these diagnostic steps.

​

Debug installation problems

​

Check network connectivity

The installer downloads from downloads.claude.ai. Verify you can reach it:

curl -sI https://downloads.claude.ai

If this fails, your network may be blocking the connection. Common causes:

Corporate firewalls or proxies blocking downloads.claude.ai

Regional network restrictions: try a VPN or alternative network

TLS/SSL issues: update your system’s CA certificates, or check if HTTPS_PROXY is configured

If you’re behind a corporate proxy, set HTTPS_PROXY and HTTP_PROXY to your proxy’s address before installing. Ask your IT team for the proxy URL if you don’t know it, or check your browser’s proxy settings.
This example sets both proxy variables, then runs the installer through your proxy:

export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
curl -fsSL https://claude.ai/install.sh | bash

​

Verify your PATH

If installation succeeded but you get a command not found or not recognized error when running claude, the install directory isn’t in your PATH. Your shell searches for programs in directories listed in PATH, and the installer places claude at ~/.local/bin/claude on macOS/Linux or %USERPROFILE%\.local\bin\claude.exe on Windows.
Check if the install directory is in your PATH by listing your PATH entries and filtering for local/bin:

 macOS/Linux

 Windows PowerShell

 Windows CMD

echo $PATH | tr ':' '\n' | grep local/bin

If there’s no output, the directory is missing. Add it to your shell configuration:

# Zsh (macOS default)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Bash (Linux default)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

Alternatively, close and reopen your terminal.Verify the fix worked:

claude --version

$env:PATH -split ';' | Select-String 'local\\bin'

If there’s no output, add the install directory to your User PATH:

$currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
[Environment]::SetEnvironmentVariable('PATH', "$currentPath;$env:USERPROFILE\.local\bin", 'User')

Restart your terminal for the change to take effect.Verify the fix worked:

claude --version

echo %PATH% | findstr /i "local\bin"

If there’s no output, open System Settings, go to Environment Variables, and add %USERPROFILE%\.local\bin to your User PATH variable. Restart your terminal.Verify the fix worked:

claude --version

​

Check for conflicting installations

Multiple Claude Code installations can cause version mismatches or unexpected behavior. Check what’s installed:

 macOS/Linux

 Windows PowerShell

List all claude binaries found in your PATH:

which -a claude

Check whether the native installer and npm versions are present:

ls -la ~/.local/bin/claude

ls -la ~/.claude/local/

npm -g ls @anthropic-ai/claude-code 2>/dev/null

where.exe claude
Test-Path "$env:LOCALAPPDATA\Claude Code\claude.exe"

If you find multiple installations, keep only one. The native install at ~/.local/bin/claude is recommended. Remove any extra installations:
Uninstall an npm global install:

npm uninstall -g @anthropic-ai/claude-code

Remove a Homebrew install on macOS (use claude-code@latest if you installed that cask):

brew uninstall --cask claude-code

​

Check directory permissions

The installer needs write access to ~/.local/bin/ and ~/.claude/. If installation fails with permission errors, check whether these directories are writable:

test -w ~/.local/bin && echo "writable" || echo "not writable"
test -w ~/.claude && echo "writable" || echo "not writable"

If either directory isn’t writable, create the install directory and set your user as the owner:

sudo mkdir -p ~/.local/bin
sudo chown -R $(whoami) ~/.local

​

Verify the binary works

If claude is installed but crashes or hangs on startup, run these checks to narrow down the cause.
Confirm the binary exists and is executable:

ls -la $(which claude)

On Linux, check for missing shared libraries. If ldd shows missing libraries, you may need to install system packages. On Alpine Linux and other musl-based distributions, see Alpine Linux setup.

ldd $(which claude) | grep "not found"

Run a quick sanity check that the binary can execute:

claude --version

​

Common installation issues

These are the most frequently encountered installation problems and their solutions.

​

Install script returns HTML instead of a shell script

When running the install command, you may see one of these errors:

bash: line 1: syntax error near unexpected token `<'
bash: line 1: `<!DOCTYPE html>'

On PowerShell, the same problem appears as:

Invoke-Expression: Missing argument in parameter list.

This means the install URL returned an HTML page instead of the install script. If the HTML page says “App unavailable in region,” Claude Code is not available in your country. See supported countries.
Otherwise, this can happen due to network issues, regional routing, or a temporary service disruption.
Solutions:

Use an alternative install method:
On macOS or Linux, install via Homebrew:

brew install --cask claude-code

On Windows, install via WinGet:

winget install Anthropic.ClaudeCode

Retry after a few minutes: the issue is often temporary. Wait and try the original command again.

​

command not found: claude after installation

The install finished but claude doesn’t work. The exact error varies by platform:

PlatformError message

macOSzsh: command not found: claude

Linuxbash: claude: command not found

Windows CMD'claude' is not recognized as an internal or external command

PowerShellclaude : The term 'claude' is not recognized as the name of a cmdlet

This means the install directory isn’t in your shell’s search path. See Verify your PATH for the fix on each platform.

​

curl: (56) Failure writing output to destination

The curl ... | bash command downloads the script and passes it directly to Bash for execution using a pipe (|). This error means the connection broke before the script finished downloading. Common causes include network interruptions, the download being blocked mid-stream, or system resource limits.
Solutions:

Check network stability: Claude Code binaries are hosted at downloads.claude.ai. Test that you can reach it:

curl -fsSL https://downloads.claude.ai -o /dev/null

If the command completes silently, your connection is fine and the issue is likely intermittent. Retry the install command. If you see an error, your network may be blocking the download.

Try an alternative install method:
On macOS or Linux:

brew install --cask claude-code

On Windows:

winget install Anthropic.ClaudeCode

​

TLS or SSL connection errors

Errors like curl: (35) TLS connect error, schannel: next InitializeSecurityContext failed, or PowerShell’s Could not establish trust relationship for the SSL/TLS secure channel indicate TLS handshake failures.
Solutions:

Update your system CA certificates:
On Ubuntu/Debian:

sudo apt-get update && sudo apt-get install ca-certificates

On macOS via Homebrew:

brew install ca-certificates

On Windows, enable TLS 1.2 in PowerShell before running the installer:

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
irm https://claude.ai/install.ps1 | iex

Check for proxy or firewall interference: corporate proxies that perform TLS inspection can cause these errors, including unable to get local issuer certificate. Set NODE_EXTRA_CA_CERTS to your corporate CA certificate bundle:

export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem

Ask your IT team for the certificate file if you don’t have it. You can also try on a direct connection to confirm the proxy is the cause.

On Windows, bypass certificate revocation checks if you see CRYPT_E_NO_REVOCATION_CHECK (0x80092012) or CRYPT_E_REVOCATION_OFFLINE (0x80092013). These mean curl reached the server but your network blocks the certificate revocation lookup, which is common behind corporate firewalls. Add --ssl-revoke-best-effort to the install command:

curl --ssl-revoke-best-effort -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd

Alternatively, install with winget install Anthropic.ClaudeCode, which avoids curl entirely.

​

Failed to fetch version from downloads.claude.ai

The installer couldn’t reach the download server. This typically means downloads.claude.ai is blocked on your network.
Solutions:

Test connectivity directly:

curl -sI https://downloads.claude.ai

If behind a proxy, set HTTPS_PROXY so the installer can route through it. See proxy configuration for details.

export HTTPS_PROXY=http://proxy.example.com:8080
curl -fsSL https://claude.ai/install.sh | bash

If on a restricted network, try a different network or VPN, or use an alternative install method:
On macOS or Linux:

brew install --cask claude-code

On Windows:

winget install Anthropic.ClaudeCode

​

Windows: wrong install command

If you see 'irm' is not recognized, The token '&&' is not valid, or 'bash' is not recognized as the name of a cmdlet, you copied the install command for a different shell or operating system.

irm not recognized: you’re in CMD, not PowerShell. You have two options:
Open PowerShell by searching for “PowerShell” in the Start menu, then run the original install command:

irm https://claude.ai/install.ps1 | iex

Or stay in CMD and use the CMD installer instead:

curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd

&& not valid: you’re in PowerShell but ran the CMD installer command. Use the PowerShell installer:

irm https://claude.ai/install.ps1 | iex

bash not recognized: you ran the macOS/Linux installer on Windows. Use the PowerShell installer instead:

irm https://claude.ai/install.ps1 | iex

​

Install killed on low-memory Linux servers

If you see Killed during installation on a VPS or cloud instance:

Setting up Claude Code...
Installing Claude Code native build latest...
bash: line 142: 34803 Killed "$binary_path" install ${TARGET:+"$TARGET"}

The Linux OOM killer terminated the process because the system ran out of memory. Claude Code requires at least 4 GB of available RAM.
Solutions:

Add swap space if your server has limited RAM. Swap uses disk space as overflow memory, letting the install complete even with low physical RAM.
Create a 2 GB swap file and enable it:

sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

Then retry the installation:

curl -fsSL https://claude.ai/install.sh | bash

Close other processes to free memory before installing.

Use a larger instance if possible. Claude Code requires at least 4 GB of RAM.

​

Install hangs in Docker

When installing Claude Code in a Docker container, installing as root into / can cause hangs.
Solutions:

Set a working directory before running the installer. When run from /, the installer scans the entire filesystem, which causes excessive memory usage. Setting WORKDIR limits the scan to a small directory:

WORKDIR /tmp
RUN curl -fsSL https://claude.ai/install.sh | bash

Increase Docker memory limits if using Docker Desktop:

docker build --memory=4g .

​

Windows: Claude Desktop overrides claude CLI command

If you installed an older version of Claude Desktop, it may register a Claude.exe in the WindowsApps directory that takes PATH priority over Claude Code CLI. Running claude opens the Desktop app instead of the CLI.
Update Claude Desktop to the latest version to fix this issue.

​

Windows: Claude Code on Windows requires git-bash

Claude Code on native Windows needs Git for Windows, which includes Git Bash.
If Git is not installed, download and install it from git-scm.com/downloads/win. During setup, select “Add to PATH.” Restart your terminal after installing.
If Git is already installed but Claude Code still can’t find it, set the path in your settings.json file:

{
 "env": {
 "CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe"
 }
}

If your Git is installed somewhere else, find the path by running where.exe git in PowerShell and use the bin\bash.exe path from that directory.

​

Windows: Claude Code does not support 32-bit Windows

Windows includes two PowerShell entries in the Start menu: Windows PowerShell and Windows PowerShell (x86). The x86 entry runs as a 32-bit process and triggers this error even on a 64-bit machine. To check which case you’re in, run this in the same window that produced the error:

[Environment]::Is64BitOperatingSystem

If this prints True, your operating system is fine. Close the window, open Windows PowerShell without the x86 suffix, and run the install command again.
If this prints False, you are on a 32-bit edition of Windows. Claude Code requires a 64-bit operating system. See the system requirements.

​

Linux: wrong binary variant installed (musl/glibc mismatch)

If you see errors about missing shared libraries like libstdc++.so.6 or libgcc_s.so.1 after installation, the installer may have downloaded the wrong binary variant for your system.

Error loading shared library libstdc++.so.6: No such file or directory

This can happen on glibc-based systems that have musl cross-compilation packages installed, causing the installer to misdetect the system as musl.
Solutions:

Check which libc your system uses:

ldd /bin/ls | head -1

If it shows linux-vdso.so or references to /lib/x86_64-linux-gnu/, you’re on glibc. If it shows musl, you’re on musl.

If you’re on glibc but got the musl binary, remove the installation and reinstall. You can also manually download the correct binary using the manifest at https://downloads.claude.ai/claude-code-releases/{VERSION}/manifest.json. File a GitHub issue with the output of ldd /bin/ls and ls /lib/libc.musl*.

If you’re actually on musl (Alpine Linux), install the required packages:

apk add libgcc libstdc++ ripgrep

​

Illegal instruction on Linux

If the installer prints Illegal instruction instead of the OOM Killed message, the downloaded binary doesn’t match your CPU architecture. This commonly happens on ARM servers that receive an x86 binary, or on older CPUs that lack required instruction sets.

bash: line 142: 2238232 Illegal instruction "$binary_path" install ${TARGET:+"$TARGET"}

Solutions:

Verify your architecture:

uname -m

x86_64 means 64-bit Intel/AMD, aarch64 means ARM64. If the binary doesn’t match, file a GitHub issue with the output.

Try an alternative install method while the architecture issue is resolved:

brew install --cask claude-code

​

dyld: cannot load on macOS

If you see dyld: cannot load, dyld: Symbol not found, or Abort trap: 6 during installation, the binary is incompatible with your macOS version or hardware.

dyld: cannot load 'claude-2.1.42-darwin-x64' (load command 0x80000034 is unknown)
Abort trap: 6

A Symbol not found error that references libicucore also indicates your macOS version is older than the binary supports:

dyld: Symbol not found: _ubrk_clone
 Referenced from: claude-darwin-x64 (which was built for Mac OS X 13.0)
 Expected in: /usr/lib/libicucore.A.dylib

Solutions:

Check your macOS version: Claude Code requires macOS 13.0 or later. Open the Apple menu and select About This Mac to check your version.

Update macOS if you’re on an older version. The binary uses load commands that older macOS versions don’t support.

Try Homebrew as an alternative install method:

brew install --cask claude-code

​

Windows installation issues: errors in WSL

You might encounter the following issues in WSL:
OS/platform detection issues: if you receive an error during installation, WSL may be using Windows npm. Try:

Run npm config set os linux before installation

Install with npm install -g @anthropic-ai/claude-code --force --no-os-check. Do not use sudo.

Node not found errors: if you see exec: node: not found when running claude, your WSL environment may be using a Windows installation of Node.js. You can confirm this with which npm and which node, which should point to Linux paths starting with /usr/ rather than /mnt/c/. To fix this, try installing Node via your Linux distribution’s package manager or via nvm.
nvm version conflicts: if you have nvm installed in both WSL and Windows, you may experience version conflicts when switching Node versions in WSL. This happens because WSL imports the Windows PATH by default, causing Windows nvm/npm to take priority over the WSL installation.
You can identify this issue by:

Running which npm and which node - if they point to Windows paths (starting with /mnt/c/), Windows versions are being used

Experiencing broken functionality after switching Node versions with nvm in WSL

To resolve this issue, fix your Linux PATH to ensure the Linux node/npm versions take priority:
Primary solution: Ensure nvm is properly loaded in your shell
The most common cause is that nvm isn’t loaded in non-interactive shells. Add the following to your shell configuration file (~/.bashrc, ~/.zshrc, etc.):

# Load nvm if it exists
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

Or run directly in your current session:

source ~/.nvm/nvm.sh

Alternative: Adjust PATH order
If nvm is properly loaded but Windows paths still take priority, you can explicitly prepend your Linux paths to PATH in your shell configuration:

export PATH="$HOME/.nvm/versions/node/$(node -v)/bin:$PATH"

Avoid disabling Windows PATH importing via appendWindowsPath = false as this breaks the ability to call Windows executables from WSL. Similarly, avoid uninstalling Node.js from Windows if you use it for Windows development.

​

WSL2 sandbox setup

Sandboxing is supported on WSL2 but requires installing additional packages. If you see an error about missing bubblewrap or socat when running /sandbox, install the dependencies:

 Ubuntu/Debian

 Fedora

sudo apt-get install bubblewrap socat

sudo dnf install bubblewrap socat

WSL1 does not support sandboxing. If you see “Sandboxing requires WSL2”, you need to upgrade to WSL2 or run Claude Code without sandboxing.
Sandboxed commands cannot launch Windows binaries such as cmd.exe, powershell.exe, or executables under /mnt/c/. WSL hands these off to the Windows host over a Unix socket, which the sandbox blocks. If a command needs to invoke a Windows binary, add it to excludedCommands so it runs outside the sandbox.

​

Permission errors during installation

If the native installer fails with permission errors, the target directory may not be writable. See Check directory permissions.
If you previously installed with npm and are hitting npm-specific permission errors, switch to the native installer:

curl -fsSL https://claude.ai/install.sh | bash

​

Native binary not found after npm install

The @anthropic-ai/claude-code npm package pulls in the native binary through a per-platform optional dependency such as @anthropic-ai/claude-code-darwin-arm64. If running claude after install prints Could not find native binary package "@anthropic-ai/claude-code-<platform>", check the following causes:

Optional dependencies are disabled. Remove --omit=optional from your npm install command, --no-optional from pnpm, or --ignore-optional from yarn, and check that .npmrc does not set optional=false. Then reinstall. The native binary is delivered only as an optional dependency, so there is no JavaScript fallback if it is skipped.

Unsupported platform. Prebuilt binaries are published for darwin-arm64, darwin-x64, linux-x64, linux-arm64, linux-x64-musl, linux-arm64-musl, win32-x64, and win32-arm64. Claude Code does not ship a binary for other platforms; see the system requirements.

Corporate npm mirror is missing the platform packages. Ensure your registry mirrors all eight @anthropic-ai/claude-code-* platform packages in addition to the meta package.

Installing with --ignore-scripts does not trigger this error. The postinstall step that links the binary into place is skipped, so Claude Code falls back to a wrapper that locates and spawns the platform binary on each launch. This works but starts more slowly; reinstall with scripts enabled for direct execution.

​

Permissions and authentication

These sections address login failures, token issues, and permission prompt behavior.

​

Repeated permission prompts

If you find yourself repeatedly approving the same commands, you can allow specific tools
to run without approval using the /permissions command. See Permissions docs.

​

Authentication issues

If you’re experiencing authentication problems:

Run /logout to sign out completely

Close Claude Code

Restart with claude and complete the authentication process again

If the browser doesn’t open automatically during login, press c to copy the OAuth URL to your clipboard, then paste it into your browser manually.

​

OAuth error: Invalid code

If you see OAuth error: Invalid code. Please make sure the full code was copied, the login code expired or was truncated during copy-paste.
Solutions:

Press Enter to retry and complete the login quickly after the browser opens

Type c to copy the full URL if the browser doesn’t open automatically

If using a remote/SSH session, the browser may open on the wrong machine. Copy the URL displayed in the terminal and open it in your local browser instead.

​

403 Forbidden after login

If you see API Error: 403 {"error":{"type":"forbidden","message":"Request not allowed"}} after logging in:

Claude Pro/Max users: verify your subscription is active at claude.ai/settings

Console users: confirm your account has the “Claude Code” or “Developer” role assigned by your admin

Behind a proxy: corporate proxies can interfere with API requests. See network configuration for proxy setup.

​

Model not found or not accessible

If you see There's an issue with the selected model (...). It may not exist or you may not have access to it, the API rejected the configured model name.
Common causes:

A typo in the model name passed to --model

A stale or deprecated model ID saved in your settings

An API key without access to that model on your current usage tier

Check where the model is set, in priority order:

The --model flag

The ANTHROPIC_MODEL environment variable

The model field in .claude/settings.local.json

The model field in your project’s .claude/settings.json

The model field in ~/.claude/settings.json

To clear a stale value, remove the model field from your settings or unset ANTHROPIC_MODEL, and Claude Code will fall back to the default model for your account.
To browse models available to your account, start claude interactively and run /model to open the picker. For Vertex AI deployments, see the Vertex AI troubleshooting section.

​

This organization has been disabled with an active subscription

If you see API Error: 400 ... "This organization has been disabled" despite having an active Claude subscription, an ANTHROPIC_API_KEY environment variable is overriding your subscription. This commonly happens when an old API key from a previous employer or project is still set in your shell profile.
When ANTHROPIC_API_KEY is present and you have approved it, Claude Code uses that key instead of your subscription’s OAuth credentials. In non-interactive mode (-p), the key is always used when present. See authentication precedence for the full resolution order.
To use your subscription instead, unset the environment variable and remove it from your shell profile:

unset ANTHROPIC_API_KEY
claude

Check ~/.zshrc, ~/.bashrc, or ~/.profile for export ANTHROPIC_API_KEY=... lines and remove them to make the change permanent. Run /status inside Claude Code to confirm which authentication method is active.

​

OAuth login fails in WSL2

Browser-based login in WSL2 may fail if WSL can’t open your Windows browser. Set the BROWSER environment variable:

export BROWSER="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
claude

Or copy the URL manually: when the login prompt appears, press c to copy the OAuth URL, then paste it into your Windows browser.

​

Not logged in or token expired

If Claude Code prompts you to log in again after a session, your OAuth token may have expired.
Run /login to re-authenticate. If this happens frequently, check that your system clock is accurate, as token validation depends on correct timestamps.
On macOS, login can also fail when the Keychain is locked or its password is out of sync with your account password, which prevents Claude Code from saving credentials. Run claude doctor to check Keychain access. To unlock the Keychain manually, run security unlock-keychain ~/Library/Keychains/login.keychain-db. If unlocking doesn’t help, open Keychain Access, select the login keychain, and choose Edit > Change Password for Keychain “login” to resync it with your account password.

​

Configuration file locations

Claude Code stores configuration in several locations:

FilePurpose

~/.claude/settings.jsonUser settings (permissions, hooks, model overrides)

.claude/settings.jsonProject settings (checked into source control)

.claude/settings.local.jsonLocal project settings (not committed)

~/.claude.jsonGlobal state (theme, OAuth, MCP servers)

.mcp.jsonProject MCP servers (checked into source control)

managed-mcp.jsonManaged MCP servers

Managed settingsManaged settings (server-managed, MDM/OS-level policies, or file-based)

On Windows, ~ refers to your user home directory, such as C:\Users\YourName.
For details on configuring these files, see Settings and MCP.

​

Resetting configuration

To reset Claude Code to default settings, you can remove the configuration files:

# Reset all user settings and state
rm ~/.claude.json
rm -rf ~/.claude/

# Reset project-specific settings
rm -rf .claude/
rm .mcp.json

This will remove all your settings, MCP server configurations, and session history.

​

Performance and stability

These sections cover issues related to resource usage, responsiveness, and search behavior.

​

High CPU or memory usage

Claude Code is designed to work with most development environments, but may consume significant resources when processing large codebases. If you’re experiencing performance issues:

Use /compact regularly to reduce context size

Close and restart Claude Code between major tasks

Consider adding large build directories to your .gitignore file

If memory usage stays high after these steps, run /heapdump to write a JavaScript heap snapshot and a memory breakdown to ~/Desktop. The breakdown shows resident set size, JS heap, array buffers, and unaccounted native memory, which helps identify whether the growth is in JavaScript objects or in native code. Open the .heapsnapshot file in Chrome DevTools under Memory → Load to inspect retainers. Attach both files when reporting a memory issue on GitHub.

​

Auto-compaction stops with a thrashing error

If you see Autocompact is thrashing: the context refilled to the limit..., automatic compaction succeeded but a file or tool output immediately refilled the context window several times in a row. Claude Code stops retrying to avoid wasting API calls on a loop that isn’t making progress.
To recover:

Ask Claude to read the oversized file in smaller chunks, such as a specific line range or function, instead of the whole file

Run /compact with a focus that drops the large output, for example /compact keep only the plan and the diff

Move the large-file work to a subagent so it runs in a separate context window

Run /clear if the earlier conversation is no longer needed

​

Command hangs or freezes

If Claude Code seems unresponsive:

Press Ctrl+C to attempt to cancel the current operation

If unresponsive, you may need to close the terminal and restart

​

Search and discovery issues

If Search tool, @file mentions, custom agents, and custom skills aren’t working, install system ripgrep:

# macOS (Homebrew) 
brew install ripgrep

# Windows (winget)
winget install BurntSushi.ripgrep.MSVC

# Ubuntu/Debian
sudo apt install ripgrep

# Alpine Linux
apk add ripgrep

# Arch Linux
pacman -S ripgrep

Then set USE_BUILTIN_RIPGREP=0 in your environment.

​

Slow or incomplete search results on WSL

Disk read performance penalties when working across file systems on WSL may result in fewer-than-expected matches when using Claude Code on WSL. Search still functions, but returns fewer results than on a native filesystem.

/doctor will show Search as OK in this case.

Solutions:

Submit more specific searches: reduce the number of files searched by specifying directories or file types: “Search for JWT validation logic in the auth-service package” or “Find use of md5 hash in JS files”.

Move project to Linux filesystem: if possible, ensure your project is located on the Linux filesystem (/home/) rather than the Windows filesystem (/mnt/c/).

Use native Windows instead: consider running Claude Code natively on Windows instead of through WSL, for better file system performance.

​

IDE integration issues

If Claude Code does not connect to your IDE or behaves unexpectedly within an IDE terminal, try the solutions below.

​

JetBrains IDE not detected on WSL2

If you’re using Claude Code on WSL2 with JetBrains IDEs and getting “No available IDEs detected” errors, this is likely due to WSL2’s networking configuration or Windows Firewall blocking the connection.

​

WSL2 networking modes

WSL2 uses NAT networking by default, which can prevent IDE detection. You have two options:
Option 1: Configure Windows Firewall (recommended)

Find your WSL2 IP address:

wsl hostname -I
# Example output: 172.21.123.45

Open PowerShell as Administrator and create a firewall rule:

New-NetFirewallRule -DisplayName "Allow WSL2 Internal Traffic" -Direction Inbound -Protocol TCP -Action Allow -RemoteAddress 172.21.0.0/16 -LocalAddress 172.21.0.0/16

Adjust the IP range based on your WSL2 subnet from step 1.

Restart both your IDE and Claude Code

Option 2: Switch to mirrored networking
Add to .wslconfig in your Windows user directory:

[wsl2]
networkingMode=mirrored

Then restart WSL with wsl --shutdown from PowerShell.

These networking issues only affect WSL2. WSL1 uses the host’s network directly and doesn’t require these configurations.

For additional JetBrains configuration tips, see the JetBrains IDE guide.

​

Report Windows IDE integration issues

If you’re experiencing IDE integration problems on Windows, create an issue with the following information:

Environment type: native Windows (Git Bash) or WSL1/WSL2

WSL networking mode, if applicable: NAT or mirrored

IDE name and version

Claude Code extension/plugin version

Shell type: Bash, Zsh, PowerShell, etc.

​

Escape key not working in JetBrains IDE terminals

If you’re using Claude Code in JetBrains terminals and the Esc key doesn’t interrupt the agent as expected, this is likely due to a keybinding clash with JetBrains’ default shortcuts.
To fix this issue:

Go to Settings → Tools → Terminal

Either:

Uncheck “Move focus to the editor with Escape”, or

Click “Configure terminal keybindings” and delete the “Switch focus to Editor” shortcut

Apply the changes

This allows the Esc key to properly interrupt Claude Code operations.

​

Markdown formatting issues

Claude Code sometimes generates markdown files with missing language tags on code fences, which can affect syntax highlighting and readability in GitHub, editors, and documentation tools.

​

Missing language tags in code blocks

If you notice code blocks like this in generated markdown:

```
function example() {
 return "hello";
}
```

Instead of properly tagged blocks like:

```javascript
function example() {
 return "hello";
}
```

Solutions:

Ask Claude to add language tags: request “Add appropriate language tags to all code blocks in this markdown file.”

Use post-processing hooks: set up automatic formatting hooks to detect and add missing language tags. See Auto-format code after edits for an example of a PostToolUse formatting hook.

Manual verification: after generating markdown files, review them for proper code block formatting and request corrections if needed.

​

Inconsistent spacing and formatting

If generated markdown has excessive blank lines or inconsistent spacing:
Solutions:

Request formatting corrections: ask Claude to “Fix spacing and formatting issues in this markdown file.”

Use formatting tools: set up hooks to run markdown formatters like prettier or custom formatting scripts on generated markdown files.

Specify formatting preferences: include formatting requirements in your prompts or project memory files.

​

Reduce markdown formatting issues

To minimize formatting issues:

Be explicit in requests: ask for “properly formatted markdown with language-tagged code blocks”

Use project conventions: document your preferred markdown style in CLAUDE.md

Set up validation hooks: use post-processing hooks to automatically verify and fix common formatting issues

​

Get more help

If you’re experiencing issues not covered here:

See the Error reference for API Error: 5xx, 529 Overloaded, 429, and request validation errors that appear during a session

Use the /feedback command within Claude Code to report problems directly to Anthropic

Check the GitHub repository for known issues

Run /doctor to diagnose issues. It checks:

Installation type, version, and search functionality

Auto-update status and available versions

Invalid settings files (malformed JSON, incorrect types)

MCP server configuration errors, including the same server name defined in multiple scopes with different endpoints

Keybinding configuration problems

Context usage warnings (large CLAUDE.md files, high MCP token usage, unreachable permission rules)

Plugin and agent loading errors

Ask Claude directly about its capabilities and features - Claude has built-in access to its documentation

Was this page helpful?

YesNo

Programmatic usageDebug configuration

⌘I

Claude Code Docs home page
xlinkedin

Company
AnthropicCareersEconomic FuturesResearchNewsTrust centerTransparency

Help and security
AvailabilityStatusSupport center

Learn
CoursesMCP connectorsCustomer storiesEngineering blogEventsPowered by ClaudeService partnersStartups program

Terms and policies
Privacy choicesPrivacy policyDisclosure policyUsage policyCommercial termsConsumer terms

Assistant

Responses are generated using AI and may contain mistakes.
````

</details>
