# OAUTH-GitHubCopilot.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## code-proxy GitHub OAuth Config

Provider: `github`

```text
Client ID: Iv1.b507a08c87ecfe98
Auth URL:  https://github.com/login/device/code
Token URL: https://github.com/login/oauth/access_token
Scopes:    copilot
Callback:  none / device flow
Content:   application/json
PKCE:      false
```

Achtung: Die generische code-proxy OAuth-Engine ist primaer authorization-code-orientiert. GitHub Device Code braucht eigene Polling-Logik.

## hermes-agent Device Code Flow

Hermes nutzt Client ID:

```text
Ov23li8tweQw6odWQebz
```

Start:

```http
POST https://github.com/login/device/code
Accept: application/json
Content-Type: application/x-www-form-urlencoded
User-Agent: HermesAgent/1.0

client_id=Ov23li8tweQw6odWQebz&scope=read:user
```

Antwort enthaelt `verification_uri`, `user_code`, `device_code`, `interval`.

Polling:

```http
POST https://github.com/login/oauth/access_token
Accept: application/json
Content-Type: application/x-www-form-urlencoded
User-Agent: HermesAgent/1.0

client_id=Ov23li8tweQw6odWQebz&
device_code=<device_code>&
grant_type=urn:ietf:params:oauth:grant-type:device_code
```

Fehlerbehandlung:

- `authorization_pending`: weiter pollen
- `slow_down`: Intervall erhoehen
- `expired_token`: neu starten
- `access_denied`: abbrechen

## Implementierung

Nach erfolgreichem Device Flow wird das GitHub Access Token als Bearer gegen Copilot-nahe APIs verwendet. Hermes validiert vorab Tokenpraefixe und lehnt klassische `ghp_` PATs ab.

---

## Offizielle Dokumentationsanreicherung: `Oauth/GitHubCopilot`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – GitHubCopilot

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### Authenticating with Copilot SDK - GitHub Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk
- Lokale Datei(en): HTML: `authenticate-copilot-sdk.html`, Text: `authenticate-copilot-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: GitHub Copilot SDK authentication
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Using GitHub OAuth with Copilot SDK - GitHub Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- Lokale Datei(en): HTML: `github-oauth.html`, Text: `github-oauth.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: GitHub OAuth for Copilot SDK
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Authenticating GitHub Copilot CLI - GitHub Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- Lokale Datei(en): HTML: `authenticate-copilot-cli.html`, Text: `authenticate-copilot-cli.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: GitHub Copilot CLI authentication
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Authorizing OAuth apps - GitHub Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Bereinigte Download-URL: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Lokale Datei(en): HTML: `authorizing-oauth-apps.html`, Text: `authorizing-oauth-apps.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: GitHub OAuth app authorization
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### GitHub Copilot SDK - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk
- Lokale Datei(en): HTML: `copilot-sdk.html`, Text: `copilot-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Authenticating with the Copilot SDK - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk
- Lokale Datei(en): HTML: `authenticate-copilot-sdk-2.html`, Text: `authenticate-copilot-sdk-2.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Set up Copilot SDK - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk
- Lokale Datei(en): HTML: `set-up-copilot-sdk.html`, Text: `set-up-copilot-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### GitHub Copilot code suggestions in your IDE - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/concepts/completions/code-suggestions
- Bereinigte Download-URL: https://docs.github.com/en/copilot/concepts/completions/code-suggestions
- Lokale Datei(en): HTML: `code-suggestions.html`, Text: `code-suggestions.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### GitHub Copilot code referencing - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/concepts/completions/code-referencing
- Bereinigte Download-URL: https://docs.github.com/en/copilot/concepts/completions/code-referencing
- Lokale Datei(en): HTML: `code-referencing.html`, Text: `code-referencing.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### About GitHub Copilot Chat - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/concepts/chat
- Bereinigte Download-URL: https://docs.github.com/en/copilot/concepts/chat
- Lokale Datei(en): HTML: `chat.html`, Text: `chat.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### OAuth apps - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/apps/oauth-apps
- Bereinigte Download-URL: https://docs.github.com/en/apps/oauth-apps
- Lokale Datei(en): HTML: `oauth-apps.html`, Text: `oauth-apps.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Building OAuth apps - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
- Bereinigte Download-URL: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
- Lokale Datei(en): HTML: `building-oauth-apps.html`, Text: `building-oauth-apps.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk`
- `https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth`
- `https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli`
- `https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps`
- `https://docs.github.com/en/copilot/how-tos/copilot-sdk`
- `https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk`
- `https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk`
- `https://docs.github.com/en/copilot/concepts/completions/code-suggestions`
- `https://docs.github.com/en/copilot/concepts/completions/code-referencing`
- `https://docs.github.com/en/copilot/concepts/chat`
- `https://docs.github.com/en/apps/oauth-apps`
- `https://docs.github.com/en/apps/oauth-apps/building-oauth-apps`
- `https://github.com/login/device`
- `https://github.com/login/oauth/authorize`
- `https://github.com/login/oauth/access_token`
- `https://api.github.com/user`
- `https://github.com/login/device.`
- `https://github.com/login/device/code`
- `https://github.com/login/device</verification_uri`
- `https://github.com/login/oauth/access_token,`
- `https://github.com/login/device/code.`
- `https://github.com/login/oauth/access_token.`
- `http://example.com/path`
- `http://example.com/path/subdir/other`
- `http://oauth.example.com/path`
- `http://oauth.example.com/path/subdir/other`
- `http://example.com/bar`
- `http://example.com/`
- `http://example.com:8080/path`
- `http://oauth.example.com:8080/path`
- `http://example.org`
- `http://127.0.0.1/path`
- `http://127.0.0.1:1234/path`
- `https://github.com/settings/connections/applications/:client_id`
- `https://YOUR-APP.com/auth/callback`
- `https://api.github.com/user/orgs`

### Erkannte Endpunkte / Pfade

- `https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth`
- `https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps`
- `https://docs.github.com/en/apps/oauth-apps`
- `https://docs.github.com/en/apps/oauth-apps/building-oauth-apps`
- `/delegate`
- `/.copilot/config.json`
- `/logout`
- `GET https://github.com/login/oauth/authorize`
- `POST https://github.com/login/oauth/access_token`
- `/token_type`
- `/access_token`
- `POST https://github.com/login/oauth/access_token)`
- `http://oauth.example.com/path`
- `http://oauth.example.com/path/subdir/other`
- `http://oauth.example.com:8080/path`
- `/application/scope`
- `/copilot-sdk`
- `https://github.com/login/oauth/access_token"`

### Erkannte Umgebungsvariablen / Konstanten

- `BYOK`
- `README`
- `COPILOT_GITHUB_TOKEN`
- `GH_TOKEN`
- `GITHUB_TOKEN`
- `COPILOT_OFFLINE`
- `COPILOT_PROVIDER_BASE_URL`
- `GNOME`
- `COPILOT_PROVIDER_API_KEY`
- `SAML`
- `HOSTNAME`
- `HMAC`
- `CAPI_HMAC_KEY`
- `COPILOT_HMAC_KEY`
- `GITHUB_COPILOT_API_TOKEN`
- `COPILOT_API_URL`
- `GHES`
- `REST`
- `PKCE`
- `S256`
- `CORS`
- `OPTIONS`
- `POST`
- `OAUTH`
- `TOKEN`
- `WDJB`
- `MJHT`
- `CALLBACK`
- `GOOD`
- `MATLAB`
- `YOUR`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `USER`
- `ACCESS`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### Authenticating with Copilot SDK - GitHub Docs
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk
- Lokale Datei(en): HTML: `authenticate-copilot-sdk.html`, Text: `authenticate-copilot-sdk.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk
- Lokale Datei(en): HTML: `authenticate-copilot-sdk.html`, Text: `authenticate-copilot-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: GitHub Copilot SDK authentication
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Using GitHub OAuth with Copilot SDK - GitHub Docs
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- Lokale Datei(en): HTML: `github-oauth.html`, Text: `github-oauth.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- Lokale Datei(en): HTML: `github-oauth.html`, Text: `github-oauth.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: GitHub OAuth for Copilot SDK
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- Lokale Datei(en): HTML: `authenticate-copilot-cli.html`, Text: `authenticate-copilot-cli.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- Lokale Datei(en): HTML: `authenticate-copilot-cli.html`, Text: `authenticate-copilot-cli.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: GitHub Copilot CLI authentication
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Authorizing OAuth apps - GitHub Docs
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Bereinigte Download-URL: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Bereinigte Download-URL: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Lokale Datei(en): HTML: `authorizing-oauth-apps.html`, Text: `authorizing-oauth-apps.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Lokale Datei(en): HTML: `authorizing-oauth-apps.html`, Text: `authorizing-oauth-apps.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: GitHub OAuth app authorization
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### GitHub Copilot SDK - GitHub Docs
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk
- Lokale Datei(en): HTML: `copilot-sdk.html`, Text: `copilot-sdk.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk
- Lokale Datei(en): HTML: `copilot-sdk.html`, Text: `copilot-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk/authenticate-copilot-sdk
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Authenticating with the Copilot SDK - GitHub Docs
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk
- Lokale Datei(en): HTML: `authenticate-copilot-sdk-2.html`, Text: `authenticate-copilot-sdk-2.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/authenticate-copilot-sdk
- Lokale Datei(en): HTML: `authenticate-copilot-sdk-2.html`, Text: `authenticate-copilot-sdk-2.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

### Set up Copilot SDK - GitHub Docs
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk
- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk
- Lokale Datei(en): HTML: `set-up-copilot-sdk.html`, Text: `set-up-copilot-sdk.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk
- Lokale Datei(en): HTML: `set-up-copilot-sdk.html`, Text: `set-up-copilot-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/concepts/completions/code-suggestions
- Bereinigte Download-URL: https://docs.github.com/en/copilot/concepts/completions/code-suggestions

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/copilot/concepts/completions/code-suggestions
- Bereinigte Download-URL: https://docs.github.com/en/copilot/concepts/completions/code-suggestions
- Lokale Datei(en): HTML: `code-suggestions.html`, Text: `code-suggestions.txt`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/concepts/completions/code-referencing
- Bereinigte Download-URL: https://docs.github.com/en/copilot/concepts/completions/code-referencing

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/copilot/concepts/completions/code-referencing
- Bereinigte Download-URL: https://docs.github.com/en/copilot/concepts/completions/code-referencing
- Lokale Datei(en): HTML: `code-referencing.html`, Text: `code-referencing.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/copilot/concepts/chat
- Bereinigte Download-URL: https://docs.github.com/en/copilot/concepts/chat

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/copilot/concepts/chat
- Bereinigte Download-URL: https://docs.github.com/en/copilot/concepts/chat
- Lokale Datei(en): HTML: `chat.html`, Text: `chat.txt`

---

**Quelle `authenticate-copilot-cli.txt`**

Authenticate Copilot CLI

---

**Quelle `authenticate-copilot-cli.txt`**

Concepts
Completions
Code suggestions

---

**Quelle `authenticate-copilot-cli.txt`**

OpenAI Codex

---

**Quelle `authenticate-copilot-cli.txt`**

Copilot usage metrics
All articles

---

**Quelle `authenticate-copilot-cli.txt`**

Copilot usage metrics

---

**Quelle `authenticate-copilot-cli.txt`**

Tools
AI tools

---

**Quelle `authenticate-copilot-cli.txt`**

Usage limits

---

**Quelle `authenticate-copilot-cli.txt`**

Billing
Copilot requests

---

**Quelle `authenticate-copilot-cli.txt`**

Billing for individuals

---

**Quelle `authenticate-copilot-cli.txt`**

FedRAMP models

---

**Quelle `authenticate-copilot-cli.txt`**

Base and LTS models

---

**Quelle `authenticate-copilot-cli.txt`**

New features and models

---

**Quelle `authenticate-copilot-cli.txt`**

Configure access to AI models

---

**Quelle `authenticate-copilot-cli.txt`**

Allowing tools

---

**Quelle `authenticate-copilot-cli.txt`**

Copilot SDK
Quickstart

---

**Quelle `authenticate-copilot-cli.txt`**

Set up Copilot SDK
Choosing a setup path

---

**Quelle `authenticate-copilot-cli.txt`**

GitHub OAuth

---

**Quelle `authenticate-copilot-cli.txt`**

Authentication
Authenticate Copilot SDK

---

**Quelle `authenticate-copilot-cli.txt`**

Use Copilot SDK
Working with hooks

---

**Quelle `authenticate-copilot-cli.txt`**

Streaming events

---

**Quelle `authenticate-copilot-cli.txt`**

Pre-tool use

---

**Quelle `authenticate-copilot-cli.txt`**

Post-tool use

---

**Quelle `authenticate-copilot-cli.txt`**

Troubleshooting
SDK and CLI compatibility

---

**Quelle `authenticate-copilot-cli.txt`**

Debug Copilot SDK

---

**Quelle `authenticate-copilot-cli.txt`**

Use AI models
Change the chat model

---

**Quelle `authenticate-copilot-cli.txt`**

Configure toolsets

---

**Quelle `authenticate-copilot-cli.txt`**

Authenticate to GHE.com

---

**Quelle `authenticate-copilot-cli.txt`**

Use your own API keys

---

**Quelle `authenticate-copilot-cli.txt`**

View license usage

---

**Quelle `authenticate-copilot-cli.txt`**

Manage MCP usage
Configure MCP registry

---

**Quelle `authenticate-copilot-cli.txt`**

View usage and adoption

---

**Quelle `authenticate-copilot-cli.txt`**

AI models
Supported models

---

**Quelle `authenticate-copilot-cli.txt`**

Copilot billing
Billing cycle

---

**Quelle `authenticate-copilot-cli.txt`**

Azure billing

---

**Quelle `authenticate-copilot-cli.txt`**

Copilot usage metrics
Copilot usage metrics data

---

**Quelle `authenticate-copilot-cli.txt`**

Interpret usage metrics

---

**Quelle `authenticate-copilot-cli.txt`**

Reconciling Copilot usage metrics

---

**Quelle `authenticate-copilot-cli.txt`**

Handle API rate limits

---

**Quelle `authenticate-copilot-cli.txt`**

Analyze functionality
Explore implementations

---

**Quelle `authenticate-copilot-cli.txt`**

Compare AI models

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Authenticating with the Copilot SDK - GitHub Docs

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Copilot SDK/

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Authentication

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Concepts
Completions
Code suggestions

---

**Quelle `authenticate-copilot-sdk-2.txt`**

OpenAI Codex

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Copilot usage metrics
All articles

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Copilot usage metrics

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Tools
AI tools

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Usage limits

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Billing
Copilot requests

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Billing for individuals

---

**Quelle `authenticate-copilot-sdk-2.txt`**

FedRAMP models

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Base and LTS models

---

**Quelle `authenticate-copilot-sdk-2.txt`**

New features and models

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Configure access to AI models

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Authenticate Copilot CLI

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Allowing tools

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Copilot SDK
Quickstart

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Set up Copilot SDK
Choosing a setup path

---

**Quelle `authenticate-copilot-sdk-2.txt`**

GitHub OAuth

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Authentication
Authenticate Copilot SDK

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Use Copilot SDK
Working with hooks

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Streaming events

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Pre-tool use

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Post-tool use

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Troubleshooting
SDK and CLI compatibility

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Debug Copilot SDK

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Use AI models
Change the chat model

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Configure toolsets

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Authenticate to GHE.com

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Use your own API keys

---

**Quelle `authenticate-copilot-sdk-2.txt`**

View license usage

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Manage MCP usage
Configure MCP registry

---

**Quelle `authenticate-copilot-sdk-2.txt`**

View usage and adoption

---

**Quelle `authenticate-copilot-sdk-2.txt`**

AI models
Supported models

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Copilot billing
Billing cycle

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Azure billing

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Copilot usage metrics
Copilot usage metrics data

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Interpret usage metrics

---

**Quelle `authenticate-copilot-sdk-2.txt`**

Reconciling Copilot usage metrics

---

**Quelle `authenticate-copilot-sdk.txt`**

Authenticating with Copilot SDK - GitHub Docs

---

**Quelle `authenticate-copilot-sdk.txt`**

Copilot SDK/

---

**Quelle `authenticate-copilot-sdk.txt`**

Authentication/

---

**Quelle `authenticate-copilot-sdk.txt`**

Authenticate Copilot SDK

---

**Quelle `authenticate-copilot-sdk.txt`**

Concepts
Completions
Code suggestions

---

**Quelle `authenticate-copilot-sdk.txt`**

OpenAI Codex

---

**Quelle `authenticate-copilot-sdk.txt`**

Copilot usage metrics
All articles

---

**Quelle `authenticate-copilot-sdk.txt`**

Copilot usage metrics

---

**Quelle `authenticate-copilot-sdk.txt`**

Tools
AI tools

---

**Quelle `authenticate-copilot-sdk.txt`**

Usage limits

---

**Quelle `authenticate-copilot-sdk.txt`**

Billing
Copilot requests

---

**Quelle `authenticate-copilot-sdk.txt`**

Billing for individuals

---

**Quelle `authenticate-copilot-sdk.txt`**

FedRAMP models

---

**Quelle `authenticate-copilot-sdk.txt`**

Base and LTS models

---

**Quelle `authenticate-copilot-sdk.txt`**

New features and models

---

**Quelle `authenticate-copilot-sdk.txt`**

Configure access to AI models

---

**Quelle `authenticate-copilot-sdk.txt`**

Authenticate Copilot CLI

---

**Quelle `authenticate-copilot-sdk.txt`**

Allowing tools

---

**Quelle `authenticate-copilot-sdk.txt`**

Copilot SDK
Quickstart

---

**Quelle `authenticate-copilot-sdk.txt`**

Set up Copilot SDK
Choosing a setup path

---

**Quelle `authenticate-copilot-sdk.txt`**

GitHub OAuth

---

**Quelle `authenticate-copilot-sdk.txt`**

Authentication
Authenticate Copilot SDK

---

**Quelle `authenticate-copilot-sdk.txt`**

Use Copilot SDK
Working with hooks

---

**Quelle `authenticate-copilot-sdk.txt`**

Streaming events

---

**Quelle `authenticate-copilot-sdk.txt`**

Pre-tool use

---

**Quelle `authenticate-copilot-sdk.txt`**

Post-tool use

---

**Quelle `authenticate-copilot-sdk.txt`**

Troubleshooting
SDK and CLI compatibility

---

**Quelle `authenticate-copilot-sdk.txt`**

Debug Copilot SDK

---

**Quelle `authenticate-copilot-sdk.txt`**

Use AI models
Change the chat model

---

**Quelle `authenticate-copilot-sdk.txt`**

Configure toolsets

---

**Quelle `authenticate-copilot-sdk.txt`**

Authenticate to GHE.com

---

**Quelle `authenticate-copilot-sdk.txt`**

Use your own API keys

---

**Quelle `authenticate-copilot-sdk.txt`**

View license usage

---

**Quelle `authenticate-copilot-sdk.txt`**

Manage MCP usage
Configure MCP registry

---

**Quelle `authenticate-copilot-sdk.txt`**

View usage and adoption

---

**Quelle `authenticate-copilot-sdk.txt`**

AI models
Supported models

---

**Quelle `authenticate-copilot-sdk.txt`**

Copilot billing
Billing cycle

---

**Quelle `authenticate-copilot-sdk.txt`**

Azure billing

---

**Quelle `authenticate-copilot-sdk.txt`**

Copilot usage metrics
Copilot usage metrics data

---

**Quelle `authenticate-copilot-sdk.txt`**

Interpret usage metrics

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `authorizing-oauth-apps.txt`**

````text
curl -H "Authorization: Bearer OAUTH-TOKEN" https://api.github.com/user
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/authenticate-copilot-cli.txt</code></summary>

````text
Authenticating GitHub Copilot CLI - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

GitHub Copilot/

How-tos/

Copilot CLI/

Set up Copilot CLI/

Authenticate Copilot CLI

Home

GitHub Copilot

Get started
Quickstart

What is GitHub Copilot?

Plans

Features

Best practices

Choose enterprise plan

Achieve company goals

Resources for approval

Concepts
Completions
Code suggestions

Code referencing

Chat

Agents
Cloud agent
About cloud agent

Agent management

Custom agents

Hooks

Access management

MCP and cloud agent

Risks and mitigations

Copilot CLI
About Copilot CLI

Comparing CLI features

Cancel and roll back

About remote access

Custom agents

About CLI plugins

Autonomous task completion

Parallel task execution

Researching with Copilot

Session data

LSP servers

Context management

Code review

Copilot Memory

Third-party agents

OpenAI Codex

Anthropic Claude

Agent skills

Enterprise management

Spark

Copilot usage metrics
All articles

Copilot usage metrics

Prompting
Prompt engineering

Response customization

Context
MCP

Spaces

Repository indexing

Content exclusion

Tools
AI tools

About Copilot integrations

Auto model selection

Usage limits

Billing
Copilot requests

Individual plans

Billing for individuals

Organizations and enterprises

Premium request management

Copilot-only enterprises

Policies

MCP management

FedRAMP models

Network settings

Base and LTS models

New features and models

How-tos
Copilot on GitHub
Set up Copilot
Enable Copilot
Set up for self

Set up for organization

Set up for enterprise

Set up a dedicated enterprise

Set up for students

Set up for teachers and OS maintainers

Configure access to AI models

Configure automatic review

Configure runners

Chat with Copilot
Get started with chat

Chat in GitHub

Chat in Mobile

Customize Copilot
Customize Copilot overview

Add custom instructions
Add personal instructions

Add repository instructions

Add organization instructions

Customize cloud agent
Create custom agents

Add agent skills

Extend cloud agent with MCP

Use hooks

Customize the agent environment

Customize the agent firewall

Test custom agents

Spaces
Create Copilot Spaces

Collaborate with others

Copilot for GitHub tasks
Use Copilot to create or update issues

Create a PR summary

Use the GitHub MCP Server from Copilot Chat

Use Copilot agents
Get started

Kick off a task

Research, plan, iterate

Manage and track agents

Copilot code review

Review Copilot output

Set up
Set up for self

Install Copilot extension

Get code suggestions
Get IDE code suggestions

Find matching code

Chat with Copilot
Get started with Chat in your IDE

Chat in IDE

Chat in Windows Terminal

Copilot CLI
All articles

Copilot CLI quickstart

Copilot CLI best practices

Set up Copilot CLI
Install Copilot CLI

Authenticate Copilot CLI

Configure Copilot CLI

Add LSP servers

Troubleshoot Copilot CLI auth

Allowing tools

Steer a session remotely

Automate with Copilot CLI
Quickstart

Run the CLI programmatically

Automate with Actions

Customize Copilot CLI
Overview

Add custom instructions

Use hooks

Add agent skills

Add MCP servers

Create custom agents

Use your own model provider

Plugins: Find and install

Plugins: Create a plugin

Plugins: Create a marketplace

Connect to VS Code

Use Copilot CLI agents
Overview

Delegate tasks to Copilot

Invoke custom agents

Steer agents

Agentic code review

Administer for enterprise

Speed up task completion

Manage pull requests

Roll back changes

Use session data

Copilot SDK
Quickstart

Set up Copilot SDK
Choosing a setup path

Azure Managed Identity

Backend services

Bundled CLI

GitHub OAuth

Local CLI

Scaling

Authentication
Authenticate Copilot SDK

Bring your own key (BYOK)

Use Copilot SDK
Working with hooks

Custom agents

Image input

MCP servers

Session persistence

Custom skills

Steering and queueing

Streaming events

Use hooks
Quickstart

Pre-tool use

Post-tool use

User prompt submitted

Session lifecycle

Error handling

Observability
OpenTelemetry

Integrations
Microsoft Agent Framework

Troubleshooting
SDK and CLI compatibility

Debug Copilot SDK

Debug MCP servers

Use Copilot agents
Cloud agent
Create a PR

Track Copilot sessions

Integrate cloud agent with Jira

Integrate cloud agent with Slack

Integrate cloud agent with Teams

Integrate cloud agent with Linear

Integrate cloud agent with Azure Boards

Changing the AI model

Configuring agent settings

Create custom agents in your IDE

Troubleshoot cloud agent

Request a code review
Use code review

Copilot Memory

Use AI models
Change the chat model

Change the completion model

Provide context
Use Copilot Spaces
Use Copilot Spaces

Use MCP in your IDE
Extend Copilot Chat with MCP

Set up the GitHub MCP Server

Enterprise configuration

Configure toolsets

Use the GitHub MCP Server

Change MCP registry

Configure custom instructions
Add repository instructions in your IDE

Configure content exclusion
Exclude content from Copilot

Review changes

Use Copilot for common tasks
Use Copilot in the CLI

Configure personal settings
Configure network settings

Configure in IDE

Authenticate to GHE.com

Manage and track spending
Monitor premium requests

Manage request allowances

Manage company spending

Manage your account
Get started with a Copilot plan

View and change your Copilot plan

Disable Copilot Free

Manage policies

Administer Copilot
Manage for organization
Manage plan
Cancel

Manage access
Grant access

Manage requests for access

Revoke access

Manage network access

Manage policies

Add Copilot cloud agent

Configure agent runners

Prepare for custom agents

Review activity
Review user activity data

Use your own API keys

Manage for enterprise
Manage plan
Subscribe

Cancel plan

Upgrade plan

Downgrade subscription

Manage access
Grant access

Disable for organizations

View license usage

Manage network access

Manage enterprise policies

Manage agents
Prepare for custom agents

Monitor agentic activity

Enable Copilot cloud agent

Block Copilot cloud agent

Manage Copilot code review

Manage Spark

Use your own API keys

Review audit logs

Manage MCP usage
Configure MCP registry

Configure MCP server access

Download activity report

View usage and adoption

View code generation

Troubleshoot Copilot
Troubleshoot common issues

View logs

Troubleshoot firewall settings

Troubleshoot network errors

Troubleshoot Spark

Reference
Chat cheat sheet

Customization cheat sheet

AI models
Supported models

Model comparison

Model hosting

Copilot feature matrix

Keyboard shortcuts

Copilot CLI reference
CLI command reference

CLI plugin reference

CLI programmatic reference

ACP server

CLI configuration directory

Custom agents configuration

Custom instructions support

Hooks configuration

Policy conflicts

Copilot allowlist reference

MCP allowlist enforcement

Metrics data

Copilot billing
Billing cycle

Seat assignment

License changes

Azure billing

Agentic audit log events

Agent session filters

Review excluded files

Copilot usage metrics
Copilot usage metrics data

Interpret usage metrics

Reconciling Copilot usage metrics

Copilot LoC metrics

Example schema

Tutorials
All tutorials

GitHub Copilot Chat Cookbook
All prompts

Communicate effectively
Create templates

Extract information

Synthesize research

Create diagrams

Generate tables

Debug errors
Debug invalid JSON

Handle API rate limits

Diagnose test failures

Analyze functionality
Explore implementations

Analyze feedback

Refactor code
Improve code readability

Fix lint errors

Refactor for optimization

Refactor for sustainability

Refactor design patterns

Refactor data access layers

Decouple business logic

Handle cross-cutting

Simplify inheritance hierarchies

Fix database deadlocks

Translate code

Document code
Create issues

Document legacy code

Explain legacy code

Explain complex logic

Sync documentation

Write discussions or blog posts

Testing code
Generate unit tests

Create mock objects

Create end-to-end tests

Update unit tests

Analyze security
Secure your repository

Manage dependency updates

Find vulnerabilities

Customization library
All customizations

Custom instructions
Your first custom instructions

Concept explainer

Debugging tutor

Code reviewer

GitHub Actions helper

Pull request assistant

Issue manager

Accessibility auditor

Testing automation

Prompt files
Your first prompt file

Create README

Onboarding plan

Document API

Review code

Generate unit tests

Custom agents
Your first custom agent

Implementation planner

Bug fix teammate

Cleanup specialist

Cloud agent
Get the best results

Pilot cloud agent

Improve a project

Build guardrails

Give access to resources

Spark
Your first spark

Prompt tips

Build and deploy apps

Deploy from CLI

Customize code review

Enhance agent mode with MCP

Compare AI models

Speed up development work

Roll out at scale
Assign licenses
Set up self-serve licenses

Track usage and adoption

Remind inactive users

Establish AI managers

Enable developers
Drive adoption

Integrate AI agents

Drive downstream impact
Increase test coverage

Accelerate pull requests

Reduce security debt

Measure trial success

Maintain codebase standards

Explore a codebase

Explore issues and discussions

Explore pull requests

Write tests

Refactor code

Optimize code reviews

Reduce technical debt

Review AI code

Learn a new language

Modernize legacy code

Modernize Java applications

Migrate a project

Plan a project

Vibe coding

Upgrade projects

Use hooks with Copilot CLI

Responsible use
Copilot inline suggestions

Chat in your IDE

Chat in GitHub

Chat in GitHub Mobile

Copilot CLI

Copilot in Windows Terminal

Copilot in GitHub Desktop

Pull request summaries

Commit message generation

Code review

Copilot cloud agent

Spark

Copilot Spaces

GitHub Copilot/

How-tos/

Copilot CLI/

Set up Copilot CLI/

Authenticate Copilot CLI

Authenticating GitHub Copilot CLI

Authenticate Copilot CLI so that you can use Copilot directly from the command line.

Who can use this feature?

GitHub Copilot CLI is available with all Copilot plans. If you receive Copilot from an organization, the Copilot CLI policy must be enabled in the organization's settings.

Copy as Markdown

In this article

About authentication

Unauthenticated use

Authenticating with OAuth

Authenticating with environment variables

Authenticating with GitHub CLI

Switching between accounts

Signing out and removing credentials

About authentication

If you use your own LLM provider API keys (BYOK), GitHub authentication is not required.

Authentication is required for any other GitHub Copilot CLI usage.

When authentication is required, Copilot CLI supports three methods. The method you use depends on whether you are working interactively or in an automated environment.

OAuth device flow: The default and recommended method for interactive use. When you run /login in Copilot CLI, the CLI generates a one-time code and directs you to authenticate in your browser. This is the simplest way to authenticate. See Authenticating with OAuth.

Environment variables: Recommended for CI/CD pipelines, containers, and non-interactive environments. You set a supported token as an environment variable (COPILOT_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN), and the CLI uses it automatically without prompting. See Authenticating with environment variables.

GitHub CLI fallback: If you have GitHub CLI (gh) (note: the gh CLI, not copilot) installed and authenticated, Copilot CLI can use its token automatically. This is the lowest priority method and activates only when no other credentials are found. See Authenticating with GitHub CLI.

Once authenticated, Copilot CLI remembers your login and automatically uses the token for all Copilot API requests. You can log in with multiple accounts, and the CLI will remember the last-used account. Token lifetime and expiration depend on how the token was created on your account or organization settings.

Unauthenticated use

If you configure Copilot CLI to use your own LLM provider API keys (BYOK), GitHub authentication is not required. Copilot CLI can connect directly to your configured provider without a GitHub account or token.

However, without GitHub authentication, the following features are not available:

/delegate: Requires Copilot cloud agent, which runs on GitHub's servers

GitHub MCP server: Requires authentication to access GitHub APIs

GitHub Code Search: Requires authentication to query GitHub's search index

You can combine BYOK with GitHub authentication to get the best of both: your preferred model for AI responses, plus access to GitHub-hosted features like /delegate and code search.

Offline mode

If you set the COPILOT_OFFLINE environment variable to true, Copilot CLI runs without contacting GitHub's servers. In offline mode:

No GitHub authentication is attempted.

The CLI only makes network requests to your configured BYOK provider.

Telemetry is fully disabled.

Offline mode is only fully air-gapped if your BYOK provider is local or otherwise within the same isolated environment (for example, a model running on-premises with no external network access). If COPILOT_PROVIDER_BASE_URL points to a remote or internet-accessible endpoint, prompts and code context will still be sent over the network to that provider. Without offline mode, even when using BYOK without GitHub authentication, telemetry is still sent normally.

Supported token types

Token typePrefixSupportedNotes

OAuth token (device flow)gho_YesDefault method via copilot login

Fine-grained PATgithub_pat_YesMust include required permissions Copilot Requests

GitHub App user-to-serverghu_YesVia environment variable

Classic PATghp_NoNot supported by Copilot CLI

How Copilot CLI stores credentials

By default, the CLI stores your OAuth token in your operating system's keychain under the service name copilot-cli:

PlatformKeychain

macOSKeychain Access

WindowsCredential Manager

Linuxlibsecret (GNOME Keyring, KWallet)

If the system keychain is unavailable—for example, on a headless Linux server without libsecret installed—the CLI prompts you to store the token in a plaintext configuration file at ~/.copilot/config.json.

When you run a command, Copilot CLI checks for credentials in the following order:

COPILOT_GITHUB_TOKEN environment variable

GH_TOKEN environment variable

GITHUB_TOKEN environment variable

OAuth token from the system keychain

GitHub CLI (gh auth token) fallback

Note

An environment variable silently overrides a stored OAuth token. If you set GH_TOKEN for another tool, the CLI uses that token instead of the OAuth token from copilot login. To avoid unexpected behavior, unset environment variables you do not intend the CLI to use.

When you configure BYOK provider environment variables (for example, COPILOT_PROVIDER_BASE_URL, COPILOT_PROVIDER_API_KEY), Copilot CLI uses these for AI model requests regardless of your GitHub authentication status. GitHub tokens are only needed for GitHub-hosted features.

Authenticating with OAuth

The OAuth device flow is the default authentication method for interactive use. You can authenticate by running /login from Copilot CLI or copilot login from your terminal.

Authenticate with /login

From Copilot CLI, run /login.

Bash/login
/login

Select the account you want to authenticate with. For GitHub Enterprise Cloud with data residency, enter the hostname of your instance

What account do you want to log into?
 1. GitHub.com
 2. GitHub Enterprise Cloud with data residency (*.ghe.com)

The CLI displays a one-time user code and automatically copies it to your clipboard and opens your browser.

Waiting for authorization...
Enter one-time code: 1234-5678 at https://github.com/login/device
Press any key to copy to clipboard and open browser...

Navigate to the verification URL at https://github.com/login/device if your browser did not open automatically.

Paste the one-time code in the field on the page.

If your organization uses SAML SSO, click Authorize next to each organization you want to grant access to.

Review the requested permissions and click Authorize GitHub Copilot CLI.

Return to your terminal. The CLI displays a success message when authentication is complete.

Signed in successfully as Octocat. You can now use Copilot.

Authenticate with copilot login

From the terminal, run copilot login. If you are using GitHub Enterprise Cloud with data residency, pass the hostname of your instance.

Bashcopilot login
copilot login

For GitHub Enterprise Cloud:

Bashcopilot login --host HOSTNAME
copilot login --host HOSTNAME

The CLI displays a one-time user code and automatically copies it to your clipboard and opens your browser.

To authenticate, visit https://github.com/login/device and enter code 1234-5678.

Navigate to the verification URL at https://github.com/login/device if your browser did not open automatically.

Paste the one-time code in the field on the page.

If your organization uses SAML SSO, click Authorize next to each organization you want to grant access to.

Review the requested permissions and click Authorize GitHub Copilot CLI.

Return to your terminal. The CLI displays a success message when authentication is complete.

Signed in successfully as Octocat.

Authenticating with environment variables

For non-interactive environments, you can authenticate by setting an environment variable with a supported token. This is ideal for CI/CD pipelines, containers, or headless servers.

Visit Fine-grained personal access tokens.

Under "Permissions," click Add permissions and select Copilot Requests.

Click Generate token.

Export the token in your terminal or environment configuration. Use the COPILOT_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN environment variable (in order of precedence).

Authenticating with GitHub CLI

If you have GitHub CLI installed and authenticated, Copilot CLI can use its token as a fallback. This method has the lowest priority and activates only when no environment variables are set and no stored token is found.

Verify that GitHub CLI is authenticated.

Bashgh auth status
gh auth status

If you use GitHub Enterprise Cloud with data residency, verify the correct hostname is authenticated.

Bashgh auth status --hostname HOSTNAME
gh auth status --hostname HOSTNAME

Run copilot. The Copilot CLI uses the GitHub CLI token automatically.

Run /user to verify your authenticated account in the CLI.

Switching between accounts

Copilot CLI supports multiple accounts. You can list available accounts and switch between them from within the CLI.
To list available accounts, run /user list from the Copilot CLI prompt.
To switch to a different account, type /user switch on the prompt.

To add another account, run copilot login from a new terminal session, or run the login command from within the CLI and authorize with the other account.

Signing out and removing credentials

To sign out, type /logout at the Copilot CLI prompt. This removes the locally stored token but does not revoke it on GitHub.

To revoke the OAuth app authorization on GitHub and prevent it from being used elsewhere, follow these steps.

Navigate to Settings > Applications > Authorized OAuth Apps.

Navigate to your settings page:

In the upper-right corner of any page on GitHub, click your profile picture.

Click Settings.

In the left sidebar, click Applications.

Under Authorized OAuth Apps, click next to GitHub CLI to expand the menu and select Revoke.

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/authenticate-copilot-sdk-2.txt</code></summary>

````text
Authenticating with the Copilot SDK - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

GitHub Copilot/

How-tos/

Copilot SDK/

Authentication

Home

GitHub Copilot

Get started
Quickstart

What is GitHub Copilot?

Plans

Features

Best practices

Choose enterprise plan

Achieve company goals

Resources for approval

Concepts
Completions
Code suggestions

Code referencing

Chat

Agents
Cloud agent
About cloud agent

Agent management

Custom agents

Hooks

Access management

MCP and cloud agent

Risks and mitigations

Copilot CLI
About Copilot CLI

Comparing CLI features

Cancel and roll back

About remote access

Custom agents

About CLI plugins

Autonomous task completion

Parallel task execution

Researching with Copilot

Session data

LSP servers

Context management

Code review

Copilot Memory

Third-party agents

OpenAI Codex

Anthropic Claude

Agent skills

Enterprise management

Spark

Copilot usage metrics
All articles

Copilot usage metrics

Prompting
Prompt engineering

Response customization

Context
MCP

Spaces

Repository indexing

Content exclusion

Tools
AI tools

About Copilot integrations

Auto model selection

Usage limits

Billing
Copilot requests

Individual plans

Billing for individuals

Organizations and enterprises

Premium request management

Copilot-only enterprises

Policies

MCP management

FedRAMP models

Network settings

Base and LTS models

New features and models

How-tos
Copilot on GitHub
Set up Copilot
Enable Copilot
Set up for self

Set up for organization

Set up for enterprise

Set up a dedicated enterprise

Set up for students

Set up for teachers and OS maintainers

Configure access to AI models

Configure automatic review

Configure runners

Chat with Copilot
Get started with chat

Chat in GitHub

Chat in Mobile

Customize Copilot
Customize Copilot overview

Add custom instructions
Add personal instructions

Add repository instructions

Add organization instructions

Customize cloud agent
Create custom agents

Add agent skills

Extend cloud agent with MCP

Use hooks

Customize the agent environment

Customize the agent firewall

Test custom agents

Spaces
Create Copilot Spaces

Collaborate with others

Copilot for GitHub tasks
Use Copilot to create or update issues

Create a PR summary

Use the GitHub MCP Server from Copilot Chat

Use Copilot agents
Get started

Kick off a task

Research, plan, iterate

Manage and track agents

Copilot code review

Review Copilot output

Set up
Set up for self

Install Copilot extension

Get code suggestions
Get IDE code suggestions

Find matching code

Chat with Copilot
Get started with Chat in your IDE

Chat in IDE

Chat in Windows Terminal

Copilot CLI
All articles

Copilot CLI quickstart

Copilot CLI best practices

Set up Copilot CLI
Install Copilot CLI

Authenticate Copilot CLI

Configure Copilot CLI

Add LSP servers

Troubleshoot Copilot CLI auth

Allowing tools

Steer a session remotely

Automate with Copilot CLI
Quickstart

Run the CLI programmatically

Automate with Actions

Customize Copilot CLI
Overview

Add custom instructions

Use hooks

Add agent skills

Add MCP servers

Create custom agents

Use your own model provider

Plugins: Find and install

Plugins: Create a plugin

Plugins: Create a marketplace

Connect to VS Code

Use Copilot CLI agents
Overview

Delegate tasks to Copilot

Invoke custom agents

Steer agents

Agentic code review

Administer for enterprise

Speed up task completion

Manage pull requests

Roll back changes

Use session data

Copilot SDK
Quickstart

Set up Copilot SDK
Choosing a setup path

Azure Managed Identity

Backend services

Bundled CLI

GitHub OAuth

Local CLI

Scaling

Authentication
Authenticate Copilot SDK

Bring your own key (BYOK)

Use Copilot SDK
Working with hooks

Custom agents

Image input

MCP servers

Session persistence

Custom skills

Steering and queueing

Streaming events

Use hooks
Quickstart

Pre-tool use

Post-tool use

User prompt submitted

Session lifecycle

Error handling

Observability
OpenTelemetry

Integrations
Microsoft Agent Framework

Troubleshooting
SDK and CLI compatibility

Debug Copilot SDK

Debug MCP servers

Use Copilot agents
Cloud agent
Create a PR

Track Copilot sessions

Integrate cloud agent with Jira

Integrate cloud agent with Slack

Integrate cloud agent with Teams

Integrate cloud agent with Linear

Integrate cloud agent with Azure Boards

Changing the AI model

Configuring agent settings

Create custom agents in your IDE

Troubleshoot cloud agent

Request a code review
Use code review

Copilot Memory

Use AI models
Change the chat model

Change the completion model

Provide context
Use Copilot Spaces
Use Copilot Spaces

Use MCP in your IDE
Extend Copilot Chat with MCP

Set up the GitHub MCP Server

Enterprise configuration

Configure toolsets

Use the GitHub MCP Server

Change MCP registry

Configure custom instructions
Add repository instructions in your IDE

Configure content exclusion
Exclude content from Copilot

Review changes

Use Copilot for common tasks
Use Copilot in the CLI

Configure personal settings
Configure network settings

Configure in IDE

Authenticate to GHE.com

Manage and track spending
Monitor premium requests

Manage request allowances

Manage company spending

Manage your account
Get started with a Copilot plan

View and change your Copilot plan

Disable Copilot Free

Manage policies

Administer Copilot
Manage for organization
Manage plan
Cancel

Manage access
Grant access

Manage requests for access

Revoke access

Manage network access

Manage policies

Add Copilot cloud agent

Configure agent runners

Prepare for custom agents

Review activity
Review user activity data

Use your own API keys

Manage for enterprise
Manage plan
Subscribe

Cancel plan

Upgrade plan

Downgrade subscription

Manage access
Grant access

Disable for organizations

View license usage

Manage network access

Manage enterprise policies

Manage agents
Prepare for custom agents

Monitor agentic activity

Enable Copilot cloud agent

Block Copilot cloud agent

Manage Copilot code review

Manage Spark

Use your own API keys

Review audit logs

Manage MCP usage
Configure MCP registry

Configure MCP server access

Download activity report

View usage and adoption

View code generation

Troubleshoot Copilot
Troubleshoot common issues

View logs

Troubleshoot firewall settings

Troubleshoot network errors

Troubleshoot Spark

Reference
Chat cheat sheet

Customization cheat sheet

AI models
Supported models

Model comparison

Model hosting

Copilot feature matrix

Keyboard shortcuts

Copilot CLI reference
CLI command reference

CLI plugin reference

CLI programmatic reference

ACP server

CLI configuration directory

Custom agents configuration

Custom instructions support

Hooks configuration

Policy conflicts

Copilot allowlist reference

MCP allowlist enforcement

Metrics data

Copilot billing
Billing cycle

Seat assignment

License changes

Azure billing

Agentic audit log events

Agent session filters

Review excluded files

Copilot usage metrics
Copilot usage metrics data

Interpret usage metrics

Reconciling Copilot usage metrics

Copilot LoC metrics

Example schema

Tutorials
All tutorials

GitHub Copilot Chat Cookbook
All prompts

Communicate effectively
Create templates

Extract information

Synthesize research

Create diagrams

Generate tables

Debug errors
Debug invalid JSON

Handle API rate limits

Diagnose test failures

Analyze functionality
Explore implementations

Analyze feedback

Refactor code
Improve code readability

Fix lint errors

Refactor for optimization

Refactor for sustainability

Refactor design patterns

Refactor data access layers

Decouple business logic

Handle cross-cutting

Simplify inheritance hierarchies

Fix database deadlocks

Translate code

Document code
Create issues

Document legacy code

Explain legacy code

Explain complex logic

Sync documentation

Write discussions or blog posts

Testing code
Generate unit tests

Create mock objects

Create end-to-end tests

Update unit tests

Analyze security
Secure your repository

Manage dependency updates

Find vulnerabilities

Customization library
All customizations

Custom instructions
Your first custom instructions

Concept explainer

Debugging tutor

Code reviewer

GitHub Actions helper

Pull request assistant

Issue manager

Accessibility auditor

Testing automation

Prompt files
Your first prompt file

Create README

Onboarding plan

Document API

Review code

Generate unit tests

Custom agents
Your first custom agent

Implementation planner

Bug fix teammate

Cleanup specialist

Cloud agent
Get the best results

Pilot cloud agent

Improve a project

Build guardrails

Give access to resources

Spark
Your first spark

Prompt tips

Build and deploy apps

Deploy from CLI

Customize code review

Enhance agent mode with MCP

Compare AI models

Speed up development work

Roll out at scale
Assign licenses
Set up self-serve licenses

Track usage and adoption

Remind inactive users

Establish AI managers

Enable developers
Drive adoption

Integrate AI agents

Drive downstream impact
Increase test coverage

Accelerate pull requests

Reduce security debt

Measure trial success

Maintain codebase standards

Explore a codebase

Explore issues and discussions

Explore pull requests

Write tests

Refactor code

Optimize code reviews

Reduce technical debt

Review AI code

Learn a new language

Modernize legacy code

Modernize Java applications

Migrate a project

Plan a project

Vibe coding

Upgrade projects

Use hooks with Copilot CLI

Responsible use
Copilot inline suggestions

Chat in your IDE

Chat in GitHub

Chat in GitHub Mobile

Copilot CLI

Copilot in Windows Terminal

Copilot in GitHub Desktop

Pull request summaries

Commit message generation

Code review

Copilot cloud agent

Spark

Copilot Spaces

GitHub Copilot/

How-tos/

Copilot SDK/

Authentication

Authenticating with the Copilot SDK

Choose the authentication method that best fits your deployment scenario for GitHub Copilot SDK.

Authenticating with Copilot SDK

Choose the authentication method in GitHub Copilot SDK that best fits your deployment scenario.

Bring your own key (BYOK)

Use Copilot SDK with your own API keys from different model providers, bypassing GitHub Copilot authentication.

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/authenticate-copilot-sdk.txt</code></summary>

````text
Authenticating with Copilot SDK - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

GitHub Copilot/

How-tos/

Copilot SDK/

Authentication/

Authenticate Copilot SDK

Home

GitHub Copilot

Get started
Quickstart

What is GitHub Copilot?

Plans

Features

Best practices

Choose enterprise plan

Achieve company goals

Resources for approval

Concepts
Completions
Code suggestions

Code referencing

Chat

Agents
Cloud agent
About cloud agent

Agent management

Custom agents

Hooks

Access management

MCP and cloud agent

Risks and mitigations

Copilot CLI
About Copilot CLI

Comparing CLI features

Cancel and roll back

About remote access

Custom agents

About CLI plugins

Autonomous task completion

Parallel task execution

Researching with Copilot

Session data

LSP servers

Context management

Code review

Copilot Memory

Third-party agents

OpenAI Codex

Anthropic Claude

Agent skills

Enterprise management

Spark

Copilot usage metrics
All articles

Copilot usage metrics

Prompting
Prompt engineering

Response customization

Context
MCP

Spaces

Repository indexing

Content exclusion

Tools
AI tools

About Copilot integrations

Auto model selection

Usage limits

Billing
Copilot requests

Individual plans

Billing for individuals

Organizations and enterprises

Premium request management

Copilot-only enterprises

Policies

MCP management

FedRAMP models

Network settings

Base and LTS models

New features and models

How-tos
Copilot on GitHub
Set up Copilot
Enable Copilot
Set up for self

Set up for organization

Set up for enterprise

Set up a dedicated enterprise

Set up for students

Set up for teachers and OS maintainers

Configure access to AI models

Configure automatic review

Configure runners

Chat with Copilot
Get started with chat

Chat in GitHub

Chat in Mobile

Customize Copilot
Customize Copilot overview

Add custom instructions
Add personal instructions

Add repository instructions

Add organization instructions

Customize cloud agent
Create custom agents

Add agent skills

Extend cloud agent with MCP

Use hooks

Customize the agent environment

Customize the agent firewall

Test custom agents

Spaces
Create Copilot Spaces

Collaborate with others

Copilot for GitHub tasks
Use Copilot to create or update issues

Create a PR summary

Use the GitHub MCP Server from Copilot Chat

Use Copilot agents
Get started

Kick off a task

Research, plan, iterate

Manage and track agents

Copilot code review

Review Copilot output

Set up
Set up for self

Install Copilot extension

Get code suggestions
Get IDE code suggestions

Find matching code

Chat with Copilot
Get started with Chat in your IDE

Chat in IDE

Chat in Windows Terminal

Copilot CLI
All articles

Copilot CLI quickstart

Copilot CLI best practices

Set up Copilot CLI
Install Copilot CLI

Authenticate Copilot CLI

Configure Copilot CLI

Add LSP servers

Troubleshoot Copilot CLI auth

Allowing tools

Steer a session remotely

Automate with Copilot CLI
Quickstart

Run the CLI programmatically

Automate with Actions

Customize Copilot CLI
Overview

Add custom instructions

Use hooks

Add agent skills

Add MCP servers

Create custom agents

Use your own model provider

Plugins: Find and install

Plugins: Create a plugin

Plugins: Create a marketplace

Connect to VS Code

Use Copilot CLI agents
Overview

Delegate tasks to Copilot

Invoke custom agents

Steer agents

Agentic code review

Administer for enterprise

Speed up task completion

Manage pull requests

Roll back changes

Use session data

Copilot SDK
Quickstart

Set up Copilot SDK
Choosing a setup path

Azure Managed Identity

Backend services

Bundled CLI

GitHub OAuth

Local CLI

Scaling

Authentication
Authenticate Copilot SDK

Bring your own key (BYOK)

Use Copilot SDK
Working with hooks

Custom agents

Image input

MCP servers

Session persistence

Custom skills

Steering and queueing

Streaming events

Use hooks
Quickstart

Pre-tool use

Post-tool use

User prompt submitted

Session lifecycle

Error handling

Observability
OpenTelemetry

Integrations
Microsoft Agent Framework

Troubleshooting
SDK and CLI compatibility

Debug Copilot SDK

Debug MCP servers

Use Copilot agents
Cloud agent
Create a PR

Track Copilot sessions

Integrate cloud agent with Jira

Integrate cloud agent with Slack

Integrate cloud agent with Teams

Integrate cloud agent with Linear

Integrate cloud agent with Azure Boards

Changing the AI model

Configuring agent settings

Create custom agents in your IDE

Troubleshoot cloud agent

Request a code review
Use code review

Copilot Memory

Use AI models
Change the chat model

Change the completion model

Provide context
Use Copilot Spaces
Use Copilot Spaces

Use MCP in your IDE
Extend Copilot Chat with MCP

Set up the GitHub MCP Server

Enterprise configuration

Configure toolsets

Use the GitHub MCP Server

Change MCP registry

Configure custom instructions
Add repository instructions in your IDE

Configure content exclusion
Exclude content from Copilot

Review changes

Use Copilot for common tasks
Use Copilot in the CLI

Configure personal settings
Configure network settings

Configure in IDE

Authenticate to GHE.com

Manage and track spending
Monitor premium requests

Manage request allowances

Manage company spending

Manage your account
Get started with a Copilot plan

View and change your Copilot plan

Disable Copilot Free

Manage policies

Administer Copilot
Manage for organization
Manage plan
Cancel

Manage access
Grant access

Manage requests for access

Revoke access

Manage network access

Manage policies

Add Copilot cloud agent

Configure agent runners

Prepare for custom agents

Review activity
Review user activity data

Use your own API keys

Manage for enterprise
Manage plan
Subscribe

Cancel plan

Upgrade plan

Downgrade subscription

Manage access
Grant access

Disable for organizations

View license usage

Manage network access

Manage enterprise policies

Manage agents
Prepare for custom agents

Monitor agentic activity

Enable Copilot cloud agent

Block Copilot cloud agent

Manage Copilot code review

Manage Spark

Use your own API keys

Review audit logs

Manage MCP usage
Configure MCP registry

Configure MCP server access

Download activity report

View usage and adoption

View code generation

Troubleshoot Copilot
Troubleshoot common issues

View logs

Troubleshoot firewall settings

Troubleshoot network errors

Troubleshoot Spark

Reference
Chat cheat sheet

Customization cheat sheet

AI models
Supported models

Model comparison

Model hosting

Copilot feature matrix

Keyboard shortcuts

Copilot CLI reference
CLI command reference

CLI plugin reference

CLI programmatic reference

ACP server

CLI configuration directory

Custom agents configuration

Custom instructions support

Hooks configuration

Policy conflicts

Copilot allowlist reference

MCP allowlist enforcement

Metrics data

Copilot billing
Billing cycle

Seat assignment

License changes

Azure billing

Agentic audit log events

Agent session filters

Review excluded files

Copilot usage metrics
Copilot usage metrics data

Interpret usage metrics

Reconciling Copilot usage metrics

Copilot LoC metrics

Example schema

Tutorials
All tutorials

GitHub Copilot Chat Cookbook
All prompts

Communicate effectively
Create templates

Extract information

Synthesize research

Create diagrams

Generate tables

Debug errors
Debug invalid JSON

Handle API rate limits

Diagnose test failures

Analyze functionality
Explore implementations

Analyze feedback

Refactor code
Improve code readability

Fix lint errors

Refactor for optimization

Refactor for sustainability

Refactor design patterns

Refactor data access layers

Decouple business logic

Handle cross-cutting

Simplify inheritance hierarchies

Fix database deadlocks

Translate code

Document code
Create issues

Document legacy code

Explain legacy code

Explain complex logic

Sync documentation

Write discussions or blog posts

Testing code
Generate unit tests

Create mock objects

Create end-to-end tests

Update unit tests

Analyze security
Secure your repository

Manage dependency updates

Find vulnerabilities

Customization library
All customizations

Custom instructions
Your first custom instructions

Concept explainer

Debugging tutor

Code reviewer

GitHub Actions helper

Pull request assistant

Issue manager

Accessibility auditor

Testing automation

Prompt files
Your first prompt file

Create README

Onboarding plan

Document API

Review code

Generate unit tests

Custom agents
Your first custom agent

Implementation planner

Bug fix teammate

Cleanup specialist

Cloud agent
Get the best results

Pilot cloud agent

Improve a project

Build guardrails

Give access to resources

Spark
Your first spark

Prompt tips

Build and deploy apps

Deploy from CLI

Customize code review

Enhance agent mode with MCP

Compare AI models

Speed up development work

Roll out at scale
Assign licenses
Set up self-serve licenses

Track usage and adoption

Remind inactive users

Establish AI managers

Enable developers
Drive adoption

Integrate AI agents

Drive downstream impact
Increase test coverage

Accelerate pull requests

Reduce security debt

Measure trial success

Maintain codebase standards

Explore a codebase

Explore issues and discussions

Explore pull requests

Write tests

Refactor code

Optimize code reviews

Reduce technical debt

Review AI code

Learn a new language

Modernize legacy code

Modernize Java applications

Migrate a project

Plan a project

Vibe coding

Upgrade projects

Use hooks with Copilot CLI

Responsible use
Copilot inline suggestions

Chat in your IDE

Chat in GitHub

Chat in GitHub Mobile

Copilot CLI

Copilot in Windows Terminal

Copilot in GitHub Desktop

Pull request summaries

Commit message generation

Code review

Copilot cloud agent

Spark

Copilot Spaces

GitHub Copilot/

How-tos/

Copilot SDK/

Authentication/

Authenticate Copilot SDK

Authenticating with Copilot SDK

Choose the authentication method in GitHub Copilot SDK that best fits your deployment scenario.

Who can use this feature?

GitHub Copilot SDK is available with all Copilot plans.

Copy as Markdown

In this article

Authentication methods overview

GitHub signed-in user

OAuth GitHub App

Environment variables

BYOK (bring your own key)

Authentication priority

Disabling auto sign-in

Next steps

Note

Copilot SDK is currently in public preview. Functionality and availability are subject to change.

Authentication methods overview

GitHub Copilot SDK supports multiple authentication methods to fit different use cases.

MethodUse caseCopilot subscription required

GitHub signed-in userInteractive apps where users sign in with GitHubYes

OAuth GitHub AppApps acting on behalf of users via OAuthYes

Environment variablesCI/CD, automation, server-to-serverYes

BYOK (bring your own key)Using your own API keys (Azure AI Foundry, OpenAI, etc)No

GitHub signed-in user

This is the default authentication method when running the GitHub Copilot CLI interactively, see Authenticating GitHub Copilot CLI. Users authenticate via the GitHub OAuth device flow, and the SDK uses their stored credentials.

How it works:

User runs the copilot CLI and signs in via GitHub OAuth.

Credentials are stored securely in the system keychain.

The SDK automatically uses stored credentials.

SDK configuration:

import { CopilotClient } from "@github/copilot-sdk";

// Default: uses signed-in user credentials
const client = new CopilotClient();

For examples in other languages, see Authentication in the github/copilot-sdk repository.

When to use this method:

Desktop applications where users interact directly

Development and testing environments

Any scenario where a user can sign in interactively

OAuth GitHub App

Use an OAuth GitHub App to authenticate users through your application and pass their credentials to the SDK. This lets your application make GitHub Copilot API requests on behalf of users who authorize your app.

How it works:

User authorizes your OAuth GitHub App.

Your app receives a user access token (gho_ or ghu_ prefix).

Pass the token to the SDK via the githubToken option.

SDK configuration:

import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient({
 githubToken: userAccessToken, // Token from OAuth flow
 useLoggedInUser: false, // Don't use stored CLI credentials
});

For examples in other languages, see Authentication in the github/copilot-sdk repository.

Supported token types:

gho_ — OAuth user access tokens

ghu_ — GitHub App user access tokens

github_pat_ — Fine-grained personal access tokens

Not supported:

ghp_ — Personal access tokens (classic) (closing down)

When to use this method:

Web applications where users sign in via GitHub

Software-as-a-service (SaaS) applications building on top of GitHub Copilot

Any multi-user application where you need to make requests on behalf of different users

Environment variables

For automation, CI/CD pipelines, and server-to-server scenarios, you can authenticate using environment variables.

Supported environment variables (in priority order):

COPILOT_GITHUB_TOKEN — Recommended for explicit Copilot usage

GH_TOKEN — GitHub CLI compatible

GITHUB_TOKEN — GitHub Actions compatible

The SDK automatically detects and uses these environment variables without any code changes required:

import { CopilotClient } from "@github/copilot-sdk";

// Token is read from environment variable automatically
const client = new CopilotClient();

When to use this method:

CI/CD pipelines (GitHub Actions, Jenkins, etc)

Automated testing

Server-side applications with service accounts

Development when you don't want to use interactive sign-in

BYOK (bring your own key)

BYOK lets you use your own API keys from model providers like Azure AI Foundry, OpenAI, or Anthropic. This bypasses GitHub Copilot authentication entirely.

Key benefits:

No GitHub Copilot subscription required

Use enterprise model deployments

Direct billing with your model provider

Support for Azure AI Foundry, OpenAI, Anthropic, and OpenAI-compatible endpoints

For complete setup instructions, including provider configuration options, limitations, and code examples, see Bring your own key (BYOK).

Authentication priority

When multiple authentication methods are available, the SDK uses them in this priority order:

Explicit githubToken — Token passed directly to the SDK constructor

HMAC key — CAPI_HMAC_KEY or COPILOT_HMAC_KEY environment variables

Direct API token — GITHUB_COPILOT_API_TOKEN with COPILOT_API_URL

Environment variable tokens — COPILOT_GITHUB_TOKEN → GH_TOKEN → GITHUB_TOKEN

Stored OAuth credentials — From previous copilot CLI sign-in

GitHub CLI — gh auth credentials

Disabling auto sign-in

To prevent the SDK from automatically using stored credentials or GitHub CLI authentication, set the useLoggedInUser option to false:

const client = new CopilotClient({
 useLoggedInUser: false, // Only use explicit tokens
});

For examples in other languages, see Authentication in the github/copilot-sdk repository.

Next steps

Bring your own key (BYOK)

MCP servers documentation—Connect to external tools using the SDK

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/authorizing-oauth-apps.txt</code></summary>

````text
Authorizing OAuth apps - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

Apps/

OAuth apps/

Building OAuth apps/

Authorizing OAuth apps

Home

Apps

Overview

Using GitHub Apps
About using apps

Install from Marketplace for user

Install from Marketplace for org

Install from third party

Install your own app

Request for org

Authorize

Approve new permissions

Review your authorizations

Review installations

Privileged apps

Creating GitHub Apps
About creating GitHub Apps
About creating apps

GitHub App versus other options

Best practices

Migrate from OAuth apps

Registering a GitHub App
Register a GitHub App

Callback URL

Setup URL

Permissions

Webhooks

Visibility

Rate limits

Custom badge

Authenticate with a GitHub App
About authentication

Authenticate as an app

Authenticate as an installation

Authenticate on behalf of users

Manage private keys

Generate a JWT

Generate an installation access token

Generate a user access token

Refresh user access tokens

Authenticate in Actions workflow

Writing code for a GitHub App
About writing GitHub App code

Quickstart

Respond to webhooks

Build a "Login" button

Build a CLI

Build CI checks

Sharing GitHub Apps
Share your app

Share with GHES

App manifest

App query parameters

Maintaining GitHub Apps
Modify app settings

Activate optional features

GitHub App managers

Manage allowed IP addresses

Suspend an installation

Transfer ownership

Delete your app

GitHub Marketplace
Overview
About GitHub Marketplace for apps

About marketplace badges

Publisher verification

Create Marketplace apps
Listing requirements

Security best practice

Customer experience best practice

View listing metrics

View listing transactions

Marketplace API usage
REST API

Webhook events

Testing your app

New purchases & free trials

Handling plan changes

Plan cancellations

List an app on the Marketplace
Draft an app listing

Write listing descriptions

Set listing pricing plans

Webhooks for plan changes

Submit your listing

Delete your listing

Sell apps on the Marketplace
Pricing plans for apps

Billing customers

Receive payment

OAuth apps
Using OAuth apps
Install app personal account

Install app organization

Authorizing OAuth apps

Review OAuth apps

Third-party applications

Privileged apps

Building OAuth apps
GitHub Apps & OAuth apps

Rate limits

Creating an OAuth app

Authenticate with an OAuth app

Authorizing OAuth apps

Scopes for OAuth apps

Create custom badges

Best practices

Maintaining OAuth apps
Modifying an OAuth app

Activate optional features

Transfer ownership

Troubleshoot authorization

Troubleshoot token request

Deleting an OAuth app

Apps/

OAuth apps/

Building OAuth apps/

Authorizing OAuth apps

Authorizing OAuth apps

You can enable other users to authorize your OAuth app.

Copy as Markdown

In this article

Web application flow

Device flow

Non-Web application flow

Redirect URLs

Creating multiple tokens for OAuth apps

Directing users to review their access

Troubleshooting

Further reading

Note

Consider building a GitHub App instead of an OAuth app.

Both OAuth apps and GitHub Apps use OAuth 2.0.

GitHub Apps can act on behalf of a user, similar to an OAuth app, or as themselves, which is beneficial for automations that do not require user input. Additionally, GitHub Apps use fine-grained permissions, give the user more control over which repositories the app can access, and use short-lived tokens. For more information, see Differences between GitHub Apps and OAuth apps and About creating GitHub Apps.

GitHub's OAuth implementation supports the standard authorization code grant type and the OAuth 2.0 Device Authorization Grant for apps that don't have access to a web browser.

If you want to skip authorizing your app in the standard way, such as when testing your app, you can use the non-web application flow.

To authorize your OAuth app, consider which authorization flow best fits your app.

web application flow: Used to authorize users for standard OAuth apps that run in the browser. (The implicit grant type is not supported.)

device flow: Used for headless apps, such as CLI tools.

Web application flow

Note

If you are building a GitHub App, you can still use the OAuth web application flow, but the setup has some important differences. See Authenticating with a GitHub App on behalf of a user for more information.

The web application flow to authorize users for your app is:

Users are redirected to request their GitHub identity

Users are redirected back to your site by GitHub

Your app accesses the API with the user's access token

1. Request a user's GitHub identity

GET https://github.com/login/oauth/authorize

This endpoint takes the following input parameters.

Query parameterTypeRequired?Description

client_idstringRequiredThe client ID you received from GitHub when you registered.

redirect_uristringStrongly recommendedThe URL in your application where users will be sent after authorization. See details below about redirect urls.

loginstringOptionalSuggests a specific account to use for signing in and authorizing the app.

scopestringContext dependentA space-delimited list of scopes. If not provided, scope defaults to an empty list for users that have not authorized any scopes for the application. For users who have authorized scopes for the application, the user won't be shown the OAuth authorization page with the list of scopes. Instead, this step of the flow will automatically complete with the set of scopes the user has authorized for the application. For example, if a user has already performed the web flow twice and has authorized one token with user scope and another token with repo scope, a third web flow that does not provide a scope will receive a token with user and repo scope.

statestringStrongly recommendedAn unguessable random string. It is used to protect against cross-site request forgery attacks.

code_challengestringStrongly recommendedUsed to secure the authentication flow with PKCE (Proof Key for Code Exchange). Required if code_challenge_method is included. Must be a 43 character SHA-256 hash of a random string generated by the client. See the PKCE RFC for more details about this security extension.

code_challenge_methodstringStrongly recommendedUsed to secure the authentication flow with PKCE (Proof Key for Code Exchange). Required if code_challenge is included. Must be S256 - the plain code challenge method is not supported.

allow_signupstringOptionalWhether or not unauthenticated users will be offered an option to sign up for GitHub during the OAuth flow. The default is true. Use false when a policy prohibits signups.

promptstringOptionalForces the account picker to appear if set to select_account. The account picker will also appear if the application has a non-HTTP redirect URI or if the user has multiple accounts signed in.

CORS pre-flight requests (OPTIONS) are not supported at this time.

2. Users are redirected back to your site by GitHub

If the user accepts your request, GitHub redirects back to your site with a temporary code in a code parameter as well as the state you provided in the previous step in a state parameter. The temporary code will expire after 10 minutes. If the states don't match, then a third party created the request, and you should abort the process.

Exchange this code for an access token:

POST https://github.com/login/oauth/access_token

This endpoint takes the following input parameters.

Parameter nameTypeRequired?Description

client_idstringRequiredThe client ID you received from GitHub for your OAuth app.

client_secretstringRequiredThe client secret you received from GitHub for your OAuth app.

codestringRequiredThe code you received as a response to Step 1.

redirect_uristringStrongly recommendedThe URL in your application where users are sent after authorization. We can use this to match against the URI originally provided when the code was issued, to prevent attacks against your service.

code_verifierstringStrongly recommendedUsed to secure the authentication flow with PKCE (Proof Key for Code Exchange). Required if code_challenge was sent during the user authorization. Must be the original value used to generate the code_challenge in the authorization request. This can be stored in a cookie alongside the state parameter or in a session variable during authentication, depending on your application architecture.

By default, the response takes the following form:

access_token=gho_16C7e42F292c6912E7710c838347Ae178B4a&scope=repo%2Cgist&token_type=bearer

You can also receive the response in different formats if you provide the format in the Accept header. For example, Accept: application/json or Accept: application/xml:

Accept: application/json
{
 "access_token":"gho_16C7e42F292c6912E7710c838347Ae178B4a",
 "scope":"repo,gist",
 "token_type":"bearer"
}

Accept: application/xml
<OAuth>
 <token_type>bearer</token_type>
 <scope>repo,gist</scope>
 <access_token>gho_16C7e42F292c6912E7710c838347Ae178B4a</access_token>
</OAuth>

3. Use the access token to access the API

The access token allows you to make requests to the API on a behalf of a user.

Authorization: Bearer OAUTH-TOKEN
GET https://api.github.com/user

For example, in curl you can set the Authorization header like this:

curl -H "Authorization: Bearer OAUTH-TOKEN" https://api.github.com/user

Every time you receive an access token, you should use the token to revalidate the user's identity. A user can change which account they are signed into when you send them to authorize your app, and you risk mixing user data if you do not validate the user's identity after every sign in.

Device flow

The device flow allows you to authorize users for a headless application, such as a CLI tool or the Git Credential Manager.

Before you can use the device flow to authorize and identify users, you must first enable it in your app's settings. For more information about enabling the device flow in your app, see Modifying a GitHub App registration for GitHub Apps and Modifying an OAuth app for OAuth apps.

Overview of the device flow

Your app requests device and user verification codes and gets the authorization URL where the user will enter the user verification code.

The app prompts the user to enter a user verification code at https://github.com/login/device.

The app polls for the user authentication status. Once the user has authorized the device, the app will be able to make API calls with a new access token.

Step 1: App requests the device and user verification codes from GitHub

POST https://github.com/login/device/code

Your app must request a user verification code and verification URL that the app will use to prompt the user to authenticate in the next step. This request also returns a device verification code that the app must use to receive an access token and check the status of user authentication.

The endpoint takes the following input parameters.

Parameter nameTypeDescription

client_idstringRequired. The client ID you received from GitHub for your app.

scopestringA space-delimited list of the scopes that your app is requesting access to. For more information, see Scopes for OAuth apps.

By default, the response takes the following form:

device_code=3584d83530557fdd1f46af8289938c8ef79f9dc5&expires_in=900&interval=5&user_code=WDJB-MJHT&verification_uri=https%3A%2F%2Fgithub.com%2Flogin%2Fdevice

Parameter nameTypeDescription

device_codestringThe device verification code is 40 characters and used to verify the device.

user_codestringThe user verification code is displayed on the device so the user can enter the code in a browser. This code is 8 characters with a hyphen in the middle.

verification_uristringThe verification URL where users need to enter the user_code: https://github.com/login/device.

expires_inintegerThe number of seconds before the device_code and user_code expire. The default is 900 seconds or 15 minutes.

intervalintegerThe minimum number of seconds that must pass before you can make a new access token request (POST https://github.com/login/oauth/access_token) to complete the device authorization. For example, if the interval is 5, then you cannot make a new request until 5 seconds pass. If you make more than one request over 5 seconds, then you will hit the rate limit and receive a slow_down error.

You can also receive the response in different formats if you provide the format in the Accept header. For example, Accept: application/json or Accept: application/xml:

Accept: application/json
{
 "device_code": "3584d83530557fdd1f46af8289938c8ef79f9dc5",
 "user_code": "WDJB-MJHT",
 "verification_uri": "https://github.com/login/device",
 "expires_in": 900,
 "interval": 5
}

Accept: application/xml
<OAuth>
 <device_code>3584d83530557fdd1f46af8289938c8ef79f9dc5</device_code>
 <user_code>WDJB-MJHT</user_code>
 <verification_uri>https://github.com/login/device</verification_uri>
 <expires_in>900</expires_in>
 <interval>5</interval>
</OAuth>

Step 2: Prompt the user to enter the user code in a browser

Your device will show the user verification code and prompt the user to enter the code at https://github.com/login/device.

Step 3: App polls GitHub to check if the user authorized the device

POST https://github.com/login/oauth/access_token

Your app will make device authorization requests that poll POST https://github.com/login/oauth/access_token, until the device and user codes expire or the user has successfully authorized the app with a valid user code. The app must use the minimum polling interval retrieved in step 1 to avoid rate limit errors. For more information, see Rate limits for the device flow.

The user must enter a valid code within 15 minutes (or 900 seconds). After 15 minutes, you will need to request a new device authorization code with POST https://github.com/login/device/code.

Once the user has authorized, the app will receive an access token that can be used to make requests to the API on behalf of a user.

The endpoint takes the following input parameters.

Parameter nameTypeDescription

client_idstringRequired. The client ID you received from GitHub for your OAuth app.

device_codestringRequired. The device_code you received from the POST https://github.com/login/device/code request.

grant_typestringRequired. The grant type must be urn:ietf:params:oauth:grant-type:device_code.

By default, the response takes the following form:

access_token=gho_16C7e42F292c6912E7710c838347Ae178B4a&token_type=bearer&scope=repo%2Cgist

You can also receive the response in different formats if you provide the format in the Accept header. For example, Accept: application/json or Accept: application/xml:

Accept: application/json
{
 "access_token": "gho_16C7e42F292c6912E7710c838347Ae178B4a",
 "token_type": "bearer",
 "scope": "repo,gist"
}

Accept: application/xml
<OAuth>
 <access_token>gho_16C7e42F292c6912E7710c838347Ae178B4a</access_token>
 <token_type>bearer</token_type>
 <scope>gist,repo</scope>
</OAuth>

Rate limits for the device flow

When a user submits the verification code on the browser, there is a rate limit of 50 submissions in an hour per application.

If you make more than one access token request (POST https://github.com/login/oauth/access_token) within the required minimum timeframe between requests (or interval), you'll hit the rate limit and receive a slow_down error response. The slow_down error response adds 5 seconds to the last interval. For more information, see the Error codes for the device flow.

Error codes for the device flow

Error codeDescription

authorization_pendingThis error occurs when the authorization request is pending and the user hasn't entered the user code yet. The app is expected to keep polling the POST https://github.com/login/oauth/access_token request without exceeding the interval, which requires a minimum number of seconds between each request.

slow_downWhen you receive the slow_down error, 5 extra seconds are added to the minimum interval or timeframe required between your requests using POST https://github.com/login/oauth/access_token. For example, if the starting interval required at least 5 seconds between requests and you get a slow_down error response, you must now wait a minimum of 10 seconds before making a new request for an OAuth access token. The error response includes the new interval that you must use.

expired_tokenIf the device code expired, then you will see the token_expired error. You must make a new request for a device code.

unsupported_grant_typeThe grant type must be urn:ietf:params:oauth:grant-type:device_code and included as an input parameter when you poll the OAuth token request POST https://github.com/login/oauth/access_token.

incorrect_client_credentialsFor the device flow, you must pass your app's client ID, which you can find on your app settings page. The client_secret is not needed for the device flow.

incorrect_device_codeThe device_code provided is not valid.

access_deniedWhen a user clicks cancel during the authorization process, you'll receive a access_denied error and the user won't be able to use the verification code again.

device_flow_disabledDevice flow has not been enabled in the app's settings. For more information, see Device flow.

For more information, see the OAuth 2.0 Device Authorization Grant.

Non-Web application flow

Non-web authentication is available for limited situations like testing. If you need to, you can use Basic Authentication to create a personal access token using your personal access tokens settings page. This technique enables the user to revoke access at any time.

Redirect URLs

The redirect_uri parameter is optional. If left out, GitHub will
redirect users to the callback URL configured in the OAuth app
settings. If provided, the redirect URL's host (excluding sub-domains) and port must exactly
match the callback URL. The redirect URL's path must reference a
subdirectory of the callback URL.

CALLBACK: http://example.com/path

GOOD: http://example.com/path
GOOD: http://example.com/path/subdir/other
GOOD: http://oauth.example.com/path
GOOD: http://oauth.example.com/path/subdir/other
BAD: http://example.com/bar
BAD: http://example.com/
BAD: http://example.com:8080/path
BAD: http://oauth.example.com:8080/path
BAD: http://example.org

Loopback redirect urls

The optional redirect_uri parameter can also be used for loopback URLs, which is useful for native applications running on a desktop computer. If the application specifies a loopback URL and a port, then after authorizing the application users will be redirected to the provided URL and port. The redirect_uri does not need to match the port specified in the callback URL for the app.

For the http://127.0.0.1/path callback URL, you can use this redirect_uri if your application is listening on port 1234:

http://127.0.0.1:1234/path

Note that OAuth RFC recommends not to use localhost, but instead to use loopback literal 127.0.0.1 or IPv6 ::1.

Creating multiple tokens for OAuth apps

You can create multiple tokens for a user/application/scope combination to create tokens for specific use cases.

This is useful if your OAuth app supports one workflow that uses GitHub for sign-in and only requires basic user information. Another workflow may require access to a user's private repositories. Using multiple tokens, your OAuth app can perform the web flow for each use case, requesting only the scopes needed. If a user only uses your application to sign in, they are never required to grant your OAuth app access to their private repositories.

There is a limit of ten tokens that are issued per user/application/scope combination, and a rate limit of ten tokens created per hour. If an application creates more than ten tokens for the same user and the same scopes, the oldest tokens with the same user/application/scope combination are revoked. However, hitting the hourly rate limit will not revoke your oldest token. Instead, it will trigger a re-authorization prompt within the browser, asking the user to double check the permissions they're granting your app. This prompt is intended to give a break to any potential infinite loop the app is stuck in, since there's little to no reason for an app to request ten tokens from the user within an hour.

Warning

Revoking all permission from an OAuth app deletes any SSH keys the application generated on behalf of the user, including deploy keys.

Directing users to review their access

You can link to authorization information for an OAuth app so that users can review and revoke their application authorizations.

To build this link, you'll need your OAuth app's client_id that you received from GitHub when you registered the application.

https://github.com/settings/connections/applications/:client_id

Tip

To learn more about the resources that your OAuth app can access for a user, see Discovering resources for a user.

Troubleshooting

Troubleshooting authorization request errors

Troubleshooting OAuth app access token request errors

Device flow errors

Token expiration and revocation

Further reading

About authentication to GitHub

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/building-oauth-apps.txt</code></summary>

````text
Building OAuth apps - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

Apps/

OAuth apps/

Building OAuth apps

Home

Apps

Overview

Using GitHub Apps
About using apps

Install from Marketplace for user

Install from Marketplace for org

Install from third party

Install your own app

Request for org

Authorize

Approve new permissions

Review your authorizations

Review installations

Privileged apps

Creating GitHub Apps
About creating GitHub Apps
About creating apps

GitHub App versus other options

Best practices

Migrate from OAuth apps

Registering a GitHub App
Register a GitHub App

Callback URL

Setup URL

Permissions

Webhooks

Visibility

Rate limits

Custom badge

Authenticate with a GitHub App
About authentication

Authenticate as an app

Authenticate as an installation

Authenticate on behalf of users

Manage private keys

Generate a JWT

Generate an installation access token

Generate a user access token

Refresh user access tokens

Authenticate in Actions workflow

Writing code for a GitHub App
About writing GitHub App code

Quickstart

Respond to webhooks

Build a "Login" button

Build a CLI

Build CI checks

Sharing GitHub Apps
Share your app

Share with GHES

App manifest

App query parameters

Maintaining GitHub Apps
Modify app settings

Activate optional features

GitHub App managers

Manage allowed IP addresses

Suspend an installation

Transfer ownership

Delete your app

GitHub Marketplace
Overview
About GitHub Marketplace for apps

About marketplace badges

Publisher verification

Create Marketplace apps
Listing requirements

Security best practice

Customer experience best practice

View listing metrics

View listing transactions

Marketplace API usage
REST API

Webhook events

Testing your app

New purchases & free trials

Handling plan changes

Plan cancellations

List an app on the Marketplace
Draft an app listing

Write listing descriptions

Set listing pricing plans

Webhooks for plan changes

Submit your listing

Delete your listing

Sell apps on the Marketplace
Pricing plans for apps

Billing customers

Receive payment

OAuth apps
Using OAuth apps
Install app personal account

Install app organization

Authorizing OAuth apps

Review OAuth apps

Third-party applications

Privileged apps

Building OAuth apps
GitHub Apps & OAuth apps

Rate limits

Creating an OAuth app

Authenticate with an OAuth app

Authorizing OAuth apps

Scopes for OAuth apps

Create custom badges

Best practices

Maintaining OAuth apps
Modifying an OAuth app

Activate optional features

Transfer ownership

Troubleshoot authorization

Troubleshoot token request

Deleting an OAuth app

Apps/

OAuth apps/

Building OAuth apps

Building OAuth apps

You can build OAuth apps for yourself or others to use. Learn how to register and set up permissions and authorization options for OAuth apps.

Differences between GitHub Apps and OAuth apps

In general, GitHub Apps are preferred to OAuth apps because they use fine-grained permissions, give more control over which repositories the app can access, and use short-lived tokens.

Rate limits for OAuth apps

Rate limits restrict the rate of traffic to GitHub.com, to help ensure consistent access for all users.

Creating an OAuth app

You can create and register an OAuth app under your personal account or under any organization you have administrative access to. While creating your OAuth app, remember to protect your privacy by only using information you consider public.

Authenticating to the REST API with an OAuth app

Learn about the different ways to authenticate with some examples.

Authorizing OAuth apps

You can enable other users to authorize your OAuth app.

Scopes for OAuth apps

Scopes let you specify exactly what type of access you need. Scopes limit access for OAuth tokens. They do not grant any additional permission beyond that which the user already has.

Creating a custom badge for your OAuth app

You can replace the default badge on your OAuth app by uploading your own logo image and customizing the background.

Best practices for creating an OAuth app

Follow these best practices to improve the security and performance of your OAuth app.

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/chat.txt</code></summary>

````text
About GitHub Copilot Chat - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

GitHub Copilot/

Concepts/

Chat

Home

GitHub Copilot

Get started
Quickstart

What is GitHub Copilot?

Plans

Features

Best practices

Choose enterprise plan

Achieve company goals

Resources for approval

Concepts
Completions
Code suggestions

Code referencing

Chat

Agents
Cloud agent
About cloud agent

Agent management

Custom agents

Hooks

Access management

MCP and cloud agent

Risks and mitigations

Copilot CLI
About Copilot CLI

Comparing CLI features

Cancel and roll back

About remote access

Custom agents

About CLI plugins

Autonomous task completion

Parallel task execution

Researching with Copilot

Session data

LSP servers

Context management

Code review

Copilot Memory

Third-party agents

OpenAI Codex

Anthropic Claude

Agent skills

Enterprise management

Spark

Copilot usage metrics
All articles

Copilot usage metrics

Prompting
Prompt engineering

Response customization

Context
MCP

Spaces

Repository indexing

Content exclusion

Tools
AI tools

About Copilot integrations

Auto model selection

Usage limits

Billing
Copilot requests

Individual plans

Billing for individuals

Organizations and enterprises

Premium request management

Copilot-only enterprises

Policies

MCP management

FedRAMP models

Network settings

Base and LTS models

New features and models

How-tos
Copilot on GitHub
Set up Copilot
Enable Copilot
Set up for self

Set up for organization

Set up for enterprise

Set up a dedicated enterprise

Set up for students

Set up for teachers and OS maintainers

Configure access to AI models

Configure automatic review

Configure runners

Chat with Copilot
Get started with chat

Chat in GitHub

Chat in Mobile

Customize Copilot
Customize Copilot overview

Add custom instructions
Add personal instructions

Add repository instructions

Add organization instructions

Customize cloud agent
Create custom agents

Add agent skills

Extend cloud agent with MCP

Use hooks

Customize the agent environment

Customize the agent firewall

Test custom agents

Spaces
Create Copilot Spaces

Collaborate with others

Copilot for GitHub tasks
Use Copilot to create or update issues

Create a PR summary

Use the GitHub MCP Server from Copilot Chat

Use Copilot agents
Get started

Kick off a task

Research, plan, iterate

Manage and track agents

Copilot code review

Review Copilot output

Set up
Set up for self

Install Copilot extension

Get code suggestions
Get IDE code suggestions

Find matching code

Chat with Copilot
Get started with Chat in your IDE

Chat in IDE

Chat in Windows Terminal

Copilot CLI
All articles

Copilot CLI quickstart

Copilot CLI best practices

Set up Copilot CLI
Install Copilot CLI

Authenticate Copilot CLI

Configure Copilot CLI

Add LSP servers

Troubleshoot Copilot CLI auth

Allowing tools

Steer a session remotely

Automate with Copilot CLI
Quickstart

Run the CLI programmatically

Automate with Actions

Customize Copilot CLI
Overview

Add custom instructions

Use hooks

Add agent skills

Add MCP servers

Create custom agents

Use your own model provider

Plugins: Find and install

Plugins: Create a plugin

Plugins: Create a marketplace

Connect to VS Code

Use Copilot CLI agents
Overview

Delegate tasks to Copilot

Invoke custom agents

Steer agents

Agentic code review

Administer for enterprise

Speed up task completion

Manage pull requests

Roll back changes

Use session data

Copilot SDK
Quickstart

Set up Copilot SDK
Choosing a setup path

Azure Managed Identity

Backend services

Bundled CLI

GitHub OAuth

Local CLI

Scaling

Authentication
Authenticate Copilot SDK

Bring your own key (BYOK)

Use Copilot SDK
Working with hooks

Custom agents

Image input

MCP servers

Session persistence

Custom skills

Steering and queueing

Streaming events

Use hooks
Quickstart

Pre-tool use

Post-tool use

User prompt submitted

Session lifecycle

Error handling

Observability
OpenTelemetry

Integrations
Microsoft Agent Framework

Troubleshooting
SDK and CLI compatibility

Debug Copilot SDK

Debug MCP servers

Use Copilot agents
Cloud agent
Create a PR

Track Copilot sessions

Integrate cloud agent with Jira

Integrate cloud agent with Slack

Integrate cloud agent with Teams

Integrate cloud agent with Linear

Integrate cloud agent with Azure Boards

Changing the AI model

Configuring agent settings

Create custom agents in your IDE

Troubleshoot cloud agent

Request a code review
Use code review

Copilot Memory

Use AI models
Change the chat model

Change the completion model

Provide context
Use Copilot Spaces
Use Copilot Spaces

Use MCP in your IDE
Extend Copilot Chat with MCP

Set up the GitHub MCP Server

Enterprise configuration

Configure toolsets

Use the GitHub MCP Server

Change MCP registry

Configure custom instructions
Add repository instructions in your IDE

Configure content exclusion
Exclude content from Copilot

Review changes

Use Copilot for common tasks
Use Copilot in the CLI

Configure personal settings
Configure network settings

Configure in IDE

Authenticate to GHE.com

Manage and track spending
Monitor premium requests

Manage request allowances

Manage company spending

Manage your account
Get started with a Copilot plan

View and change your Copilot plan

Disable Copilot Free

Manage policies

Administer Copilot
Manage for organization
Manage plan
Cancel

Manage access
Grant access

Manage requests for access

Revoke access

Manage network access

Manage policies

Add Copilot cloud agent

Configure agent runners

Prepare for custom agents

Review activity
Review user activity data

Use your own API keys

Manage for enterprise
Manage plan
Subscribe

Cancel plan

Upgrade plan

Downgrade subscription

Manage access
Grant access

Disable for organizations

View license usage

Manage network access

Manage enterprise policies

Manage agents
Prepare for custom agents

Monitor agentic activity

Enable Copilot cloud agent

Block Copilot cloud agent

Manage Copilot code review

Manage Spark

Use your own API keys

Review audit logs

Manage MCP usage
Configure MCP registry

Configure MCP server access

Download activity report

View usage and adoption

View code generation

Troubleshoot Copilot
Troubleshoot common issues

View logs

Troubleshoot firewall settings

Troubleshoot network errors

Troubleshoot Spark

Reference
Chat cheat sheet

Customization cheat sheet

AI models
Supported models

Model comparison

Model hosting

Copilot feature matrix

Keyboard shortcuts

Copilot CLI reference
CLI command reference

CLI plugin reference

CLI programmatic reference

ACP server

CLI configuration directory

Custom agents configuration

Custom instructions support

Hooks configuration

Policy conflicts

Copilot allowlist reference

MCP allowlist enforcement

Metrics data

Copilot billing
Billing cycle

Seat assignment

License changes

Azure billing

Agentic audit log events

Agent session filters

Review excluded files

Copilot usage metrics
Copilot usage metrics data

Interpret usage metrics

Reconciling Copilot usage metrics

Copilot LoC metrics

Example schema

Tutorials
All tutorials

GitHub Copilot Chat Cookbook
All prompts

Communicate effectively
Create templates

Extract information

Synthesize research

Create diagrams

Generate tables

Debug errors
Debug invalid JSON

Handle API rate limits

Diagnose test failures

Analyze functionality
Explore implementations

Analyze feedback

Refactor code
Improve code readability

Fix lint errors

Refactor for optimization

Refactor for sustainability

Refactor design patterns

Refactor data access layers

Decouple business logic

Handle cross-cutting

Simplify inheritance hierarchies

Fix database deadlocks

Translate code

Document code
Create issues

Document legacy code

Explain legacy code

Explain complex logic

Sync documentation

Write discussions or blog posts

Testing code
Generate unit tests

Create mock objects

Create end-to-end tests

Update unit tests

Analyze security
Secure your repository

Manage dependency updates

Find vulnerabilities

Customization library
All customizations

Custom instructions
Your first custom instructions

Concept explainer

Debugging tutor

Code reviewer

GitHub Actions helper

Pull request assistant

Issue manager

Accessibility auditor

Testing automation

Prompt files
Your first prompt file

Create README

Onboarding plan

Document API

Review code

Generate unit tests

Custom agents
Your first custom agent

Implementation planner

Bug fix teammate

Cleanup specialist

Cloud agent
Get the best results

Pilot cloud agent

Improve a project

Build guardrails

Give access to resources

Spark
Your first spark

Prompt tips

Build and deploy apps

Deploy from CLI

Customize code review

Enhance agent mode with MCP

Compare AI models

Speed up development work

Roll out at scale
Assign licenses
Set up self-serve licenses

Track usage and adoption

Remind inactive users

Establish AI managers

Enable developers
Drive adoption

Integrate AI agents

Drive downstream impact
Increase test coverage

Accelerate pull requests

Reduce security debt

Measure trial success

Maintain codebase standards

Explore a codebase

Explore issues and discussions

Explore pull requests

Write tests

Refactor code

Optimize code reviews

Reduce technical debt

Review AI code

Learn a new language

Modernize legacy code

Modernize Java applications

Migrate a project

Plan a project

Vibe coding

Upgrade projects

Use hooks with Copilot CLI

Responsible use
Copilot inline suggestions

Chat in your IDE

Chat in GitHub

Chat in GitHub Mobile

Copilot CLI

Copilot in Windows Terminal

Copilot in GitHub Desktop

Pull request summaries

Commit message generation

Code review

Copilot cloud agent

Spark

Copilot Spaces

GitHub Copilot/

Concepts/

Chat

About GitHub Copilot Chat

Learn how you can use GitHub Copilot Chat to enhance your coding experience.

Copy as Markdown

In this article

Limitations

Customizing Copilot Chat responses

AI models for Copilot Chat

Extending Copilot Chat

Overview

GitHub Copilot Chat is the AI-powered chat interface for GitHub Copilot. It allows you to interact with AI models to get coding assistance, explanations, and suggestions in a conversational format.

Copilot Chat can help you with a variety of coding-related tasks, like offering you code suggestions, providing natural language descriptions of a piece of code's functionality and purpose, generating unit tests for your code, and proposing fixes for bugs in your code.

GitHub Copilot Chat is available in various environments:

GitHub (the website)

A range of IDEs such as Visual Studio Code, Xcode, and JetBrains IDEs

GitHub Mobile

GitHub Copilot CLI

Different environments may have different features and capabilities, but the core functionality remains consistent across platforms. To explore the functionality available in each environment, see the GitHub Copilot Chat how-to guides and the Tutorials for GitHub Copilot.

Limitations

Copilot Chat is designed to assist with coding tasks, but you remain responsible for reviewing and validating the code it generates. It may not always produce correct or optimal solutions, and it can sometimes generate code that contains security vulnerabilities or other issues. Always test and review the code before using it in production.

Customizing Copilot Chat responses

GitHub Copilot in GitHub, Visual Studio Code, and Visual Studio can provide chat responses that are tailored to the way your team works, the tools you use, the specifics of your project, or your personal preferences, if you provide it with enough context to do so. Instead of repeating instructions in each prompt, you can create and save instructions for Copilot Chat to customize what responses you receive.

There are various ways you can create custom instructions for Copilot Chat. These fall into three main categories:

Personal instructions: You can add personal instructions so that all the chat responses you, as a user, receive are tailored to your preferences.

Repository instructions: You can store instructions files in a repository, so that all prompts asked in the context of the repository automatically include the instructions you've defined.

Organization instructions: If you are an organization owner, you can create a custom instructions file for an organization, so that all prompts asked in the context of any repository owned by the organization automatically include the instructions you've defined.

For more information, see Adding personal custom instructions for GitHub Copilot, Adding repository custom instructions for GitHub Copilot and Adding organization custom instructions for GitHub Copilot.

AI models for Copilot Chat

You can change the model Copilot uses to generate responses to chat prompts. You may find that different models perform better, or provide more useful responses, depending on the type of questions you ask. Options include premium models with advanced capabilities. See Changing the AI model for GitHub Copilot Chat.

Extending Copilot Chat

Copilot Chat can be extended in a variety of ways to enhance its functionality and integrate it with other tools and services. This can include using the Model Context Protocol (MCP) to provide context-aware AI assistance, or connecting third-party tools to leverage GitHub’s AI capabilities.

Extending Copilot Chat with MCP

MCP is an open standard that defines how applications share context with large language models (LLMs). MCP provides a standardized way to connect AI models to different data sources and tools, enabling them to work together more effectively.

You can configure MCP servers to provide context to Copilot Chat in various IDEs, such as Visual Studio Code and JetBrains IDEs. For Copilot Chat in GitHub, the GitHub MCP server is automatically configured, enabling Copilot Chat to perform a limited set of tasks, at your request, such as creating branches or merging pull requests. For more information, see Extending GitHub Copilot Chat with Model Context Protocol (MCP) servers and Using the GitHub MCP Server in your IDE.

Further reading

GitHub Copilot Chat how-to guides

Using GitHub Copilot CLI

GitHub Copilot Chat Cookbook

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/code-referencing.txt</code></summary>

````text
GitHub Copilot code referencing - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

GitHub Copilot/

Concepts/

Completions/

Code referencing

Home

GitHub Copilot

Get started
Quickstart

What is GitHub Copilot?

Plans

Features

Best practices

Choose enterprise plan

Achieve company goals

Resources for approval

Concepts
Completions
Code suggestions

Code referencing

Chat

Agents
Cloud agent
About cloud agent

Agent management

Custom agents

Hooks

Access management

MCP and cloud agent

Risks and mitigations

Copilot CLI
About Copilot CLI

Comparing CLI features

Cancel and roll back

About remote access

Custom agents

About CLI plugins

Autonomous task completion

Parallel task execution

Researching with Copilot

Session data

LSP servers

Context management

Code review

Copilot Memory

Third-party agents

OpenAI Codex

Anthropic Claude

Agent skills

Enterprise management

Spark

Copilot usage metrics
All articles

Copilot usage metrics

Prompting
Prompt engineering

Response customization

Context
MCP

Spaces

Repository indexing

Content exclusion

Tools
AI tools

About Copilot integrations

Auto model selection

Usage limits

Billing
Copilot requests

Individual plans

Billing for individuals

Organizations and enterprises

Premium request management

Copilot-only enterprises

Policies

MCP management

FedRAMP models

Network settings

Base and LTS models

New features and models

How-tos
Copilot on GitHub
Set up Copilot
Enable Copilot
Set up for self

Set up for organization

Set up for enterprise

Set up a dedicated enterprise

Set up for students

Set up for teachers and OS maintainers

Configure access to AI models

Configure automatic review

Configure runners

Chat with Copilot
Get started with chat

Chat in GitHub

Chat in Mobile

Customize Copilot
Customize Copilot overview

Add custom instructions
Add personal instructions

Add repository instructions

Add organization instructions

Customize cloud agent
Create custom agents

Add agent skills

Extend cloud agent with MCP

Use hooks

Customize the agent environment

Customize the agent firewall

Test custom agents

Spaces
Create Copilot Spaces

Collaborate with others

Copilot for GitHub tasks
Use Copilot to create or update issues

Create a PR summary

Use the GitHub MCP Server from Copilot Chat

Use Copilot agents
Get started

Kick off a task

Research, plan, iterate

Manage and track agents

Copilot code review

Review Copilot output

Set up
Set up for self

Install Copilot extension

Get code suggestions
Get IDE code suggestions

Find matching code

Chat with Copilot
Get started with Chat in your IDE

Chat in IDE

Chat in Windows Terminal

Copilot CLI
All articles

Copilot CLI quickstart

Copilot CLI best practices

Set up Copilot CLI
Install Copilot CLI

Authenticate Copilot CLI

Configure Copilot CLI

Add LSP servers

Troubleshoot Copilot CLI auth

Allowing tools

Steer a session remotely

Automate with Copilot CLI
Quickstart

Run the CLI programmatically

Automate with Actions

Customize Copilot CLI
Overview

Add custom instructions

Use hooks

Add agent skills

Add MCP servers

Create custom agents

Use your own model provider

Plugins: Find and install

Plugins: Create a plugin

Plugins: Create a marketplace

Connect to VS Code

Use Copilot CLI agents
Overview

Delegate tasks to Copilot

Invoke custom agents

Steer agents

Agentic code review

Administer for enterprise

Speed up task completion

Manage pull requests

Roll back changes

Use session data

Copilot SDK
Quickstart

Set up Copilot SDK
Choosing a setup path

Azure Managed Identity

Backend services

Bundled CLI

GitHub OAuth

Local CLI

Scaling

Authentication
Authenticate Copilot SDK

Bring your own key (BYOK)

Use Copilot SDK
Working with hooks

Custom agents

Image input

MCP servers

Session persistence

Custom skills

Steering and queueing

Streaming events

Use hooks
Quickstart

Pre-tool use

Post-tool use

User prompt submitted

Session lifecycle

Error handling

Observability
OpenTelemetry

Integrations
Microsoft Agent Framework

Troubleshooting
SDK and CLI compatibility

Debug Copilot SDK

Debug MCP servers

Use Copilot agents
Cloud agent
Create a PR

Track Copilot sessions

Integrate cloud agent with Jira

Integrate cloud agent with Slack

Integrate cloud agent with Teams

Integrate cloud agent with Linear

Integrate cloud agent with Azure Boards

Changing the AI model

Configuring agent settings

Create custom agents in your IDE

Troubleshoot cloud agent

Request a code review
Use code review

Copilot Memory

Use AI models
Change the chat model

Change the completion model

Provide context
Use Copilot Spaces
Use Copilot Spaces

Use MCP in your IDE
Extend Copilot Chat with MCP

Set up the GitHub MCP Server

Enterprise configuration

Configure toolsets

Use the GitHub MCP Server

Change MCP registry

Configure custom instructions
Add repository instructions in your IDE

Configure content exclusion
Exclude content from Copilot

Review changes

Use Copilot for common tasks
Use Copilot in the CLI

Configure personal settings
Configure network settings

Configure in IDE

Authenticate to GHE.com

Manage and track spending
Monitor premium requests

Manage request allowances

Manage company spending

Manage your account
Get started with a Copilot plan

View and change your Copilot plan

Disable Copilot Free

Manage policies

Administer Copilot
Manage for organization
Manage plan
Cancel

Manage access
Grant access

Manage requests for access

Revoke access

Manage network access

Manage policies

Add Copilot cloud agent

Configure agent runners

Prepare for custom agents

Review activity
Review user activity data

Use your own API keys

Manage for enterprise
Manage plan
Subscribe

Cancel plan

Upgrade plan

Downgrade subscription

Manage access
Grant access

Disable for organizations

View license usage

Manage network access

Manage enterprise policies

Manage agents
Prepare for custom agents

Monitor agentic activity

Enable Copilot cloud agent

Block Copilot cloud agent

Manage Copilot code review

Manage Spark

Use your own API keys

Review audit logs

Manage MCP usage
Configure MCP registry

Configure MCP server access

Download activity report

View usage and adoption

View code generation

Troubleshoot Copilot
Troubleshoot common issues

View logs

Troubleshoot firewall settings

Troubleshoot network errors

Troubleshoot Spark

Reference
Chat cheat sheet

Customization cheat sheet

AI models
Supported models

Model comparison

Model hosting

Copilot feature matrix

Keyboard shortcuts

Copilot CLI reference
CLI command reference

CLI plugin reference

CLI programmatic reference

ACP server

CLI configuration directory

Custom agents configuration

Custom instructions support

Hooks configuration

Policy conflicts

Copilot allowlist reference

MCP allowlist enforcement

Metrics data

Copilot billing
Billing cycle

Seat assignment

License changes

Azure billing

Agentic audit log events

Agent session filters

Review excluded files

Copilot usage metrics
Copilot usage metrics data

Interpret usage metrics

Reconciling Copilot usage metrics

Copilot LoC metrics

Example schema

Tutorials
All tutorials

GitHub Copilot Chat Cookbook
All prompts

Communicate effectively
Create templates

Extract information

Synthesize research

Create diagrams

Generate tables

Debug errors
Debug invalid JSON

Handle API rate limits

Diagnose test failures

Analyze functionality
Explore implementations

Analyze feedback

Refactor code
Improve code readability

Fix lint errors

Refactor for optimization

Refactor for sustainability

Refactor design patterns

Refactor data access layers

Decouple business logic

Handle cross-cutting

Simplify inheritance hierarchies

Fix database deadlocks

Translate code

Document code
Create issues

Document legacy code

Explain legacy code

Explain complex logic

Sync documentation

Write discussions or blog posts

Testing code
Generate unit tests

Create mock objects

Create end-to-end tests

Update unit tests

Analyze security
Secure your repository

Manage dependency updates

Find vulnerabilities

Customization library
All customizations

Custom instructions
Your first custom instructions

Concept explainer

Debugging tutor

Code reviewer

GitHub Actions helper

Pull request assistant

Issue manager

Accessibility auditor

Testing automation

Prompt files
Your first prompt file

Create README

Onboarding plan

Document API

Review code

Generate unit tests

Custom agents
Your first custom agent

Implementation planner

Bug fix teammate

Cleanup specialist

Cloud agent
Get the best results

Pilot cloud agent

Improve a project

Build guardrails

Give access to resources

Spark
Your first spark

Prompt tips

Build and deploy apps

Deploy from CLI

Customize code review

Enhance agent mode with MCP

Compare AI models

Speed up development work

Roll out at scale
Assign licenses
Set up self-serve licenses

Track usage and adoption

Remind inactive users

Establish AI managers

Enable developers
Drive adoption

Integrate AI agents

Drive downstream impact
Increase test coverage

Accelerate pull requests

Reduce security debt

Measure trial success

Maintain codebase standards

Explore a codebase

Explore issues and discussions

Explore pull requests

Write tests

Refactor code

Optimize code reviews

Reduce technical debt

Review AI code

Learn a new language

Modernize legacy code

Modernize Java applications

Migrate a project

Plan a project

Vibe coding

Upgrade projects

Use hooks with Copilot CLI

Responsible use
Copilot inline suggestions

Chat in your IDE

Chat in GitHub

Chat in GitHub Mobile

Copilot CLI

Copilot in Windows Terminal

Copilot in GitHub Desktop

Pull request summaries

Commit message generation

Code review

Copilot cloud agent

Spark

Copilot Spaces

GitHub Copilot/

Concepts/

Completions/

Code referencing

GitHub Copilot code referencing

GitHub Copilot checks suggestions for matches with publicly available code. Any matches are discarded or suggested with a code reference.

Tool navigation

Visual Studio Code

JetBrains IDEs

Visual Studio

Web browser

Copy as Markdown

In this article

About Copilot code referencing in JetBrains IDEs

About Copilot code referencing in Visual Studio Code

About Copilot code referencing on GitHub.com

About Copilot code referencing in Visual Studio

How code referencing finds matching code

Limitations

Further reading

About Copilot code referencing in JetBrains IDEs

Copilot code referencing identifies and attributes code suggestions by linking them to their original public sources, helping you understand where the code originates.

If you, or your organization, have allowed suggestions that match public code, GitHub Copilot can provide you with details of the code that a suggestion matches. This happens:

When you accept a Copilot inline suggestion in the editor.

When a response in Copilot Chat includes matching code.

Code referencing for Copilot inline suggestions

When you accept a Copilot inline suggestion that matches code in a public GitHub repository, information about the matching code is logged. The log entry includes the URLs of files containing matching code, and the name of the license that applies to that code, if any was found. This allows you to review these references and decide how to proceed. For example, you can decide what attribution to use, or whether you want to remove this code from your project.

Note

Code referencing for inline suggestions only occurs for matches of accepted Copilot suggestions. Code you have written, and Copilot suggestions you have altered, are not checked for matches to public code.

Typically, matches to public code occur in less than one percent of Copilot suggestions, so you should not expect to see code references for many suggestions.

Code referencing for Copilot Chat

When Copilot Chat provides a response that includes code that matches code in a public GitHub repository, this is indicated at the end of the response with a link to display details of the matched code in the editor.

About Copilot code referencing in Visual Studio Code

Copilot code referencing identifies and attributes code suggestions by linking them to their original public sources, helping you understand where the code originates.

If you, or your organization, have allowed suggestions that match public code, GitHub Copilot can provide you with details of the code that a suggestion matches. This happens:

When you accept a Copilot inline suggestion in the editor.

When a response in Copilot Chat includes matching code.

Code referencing for Copilot inline suggestions

When you accept a Copilot inline suggestion that matches code in a public GitHub repository, information about the matching code is logged. The log entry includes the URLs of files containing matching code, and the name of the license that applies to that code, if any was found. This allows you to review these references and decide how to proceed. For example, you can decide what attribution to use, or whether you want to remove this code from your project.

Note

Code referencing for inline suggestions only occurs for matches of accepted Copilot suggestions. Code you have written, and Copilot suggestions you have altered, are not checked for matches to public code.

Typically, matches to public code occur in less than one percent of Copilot suggestions, so you should not expect to see code references for many suggestions.

Code referencing for Copilot Chat

When Copilot Chat provides a response that includes code that matches code in a public GitHub repository, this is indicated at the end of the response with a link to display details of the matched code in the editor.

About Copilot code referencing on GitHub.com

Code referencing for Copilot Chat

If you, or your organization, have allowed suggestions that match public code, then whenever a response from Copilot Chat includes matching code, details of the matches will be included in the response.

Note

Typically, matches to public code occur infrequently, so you should not expect to see code references in many Copilot Chat responses.

Code referencing for Copilot cloud agent

When Copilot generates code that matches code in a public GitHub repository, this is indicated in the agent session logs with a link to display details of the matched code. For more information, see Tracking GitHub Copilot's sessions.

About Copilot code referencing in Visual Studio

Copilot code referencing identifies and attributes code suggestions by linking them to their original public sources, helping you understand where the code originates.

If you, or your organization, have allowed suggestions that match public code, GitHub Copilot can provide you with details of the code that a suggestion matches. This happens:

When you accept a Copilot inline suggestion in the editor.

When a response in Copilot Chat includes matching code.

Code referencing for Copilot inline suggestions

When you accept a Copilot inline suggestion that matches code in a public GitHub repository, information about the matching code is logged. The log entry includes the URLs of files containing matching code, and the name of the license that applies to that code, if any was found. This allows you to review these references and decide how to proceed. For example, you can decide what attribution to use, or whether you want to remove this code from your project.

Note

Code referencing for inline suggestions only occurs for matches of accepted Copilot suggestions. Code you have written, and Copilot suggestions you have altered, are not checked for matches to public code.

Typically, matches to public code occur in less than one percent of Copilot suggestions, so you should not expect to see code references for many suggestions.

Code referencing for Copilot Chat

When Copilot Chat provides a response that includes code that matches code in a public GitHub repository, this is indicated below the suggested code, with a link to display details of the matched code in the output log.

How code referencing finds matching code

Copilot code referencing compares potential code suggestions and the surrounding code of about 150 characters against an index of all public repositories on GitHub.com.

Code in private GitHub repositories, or code outside of GitHub, is not included in the search process.

Limitations

The search index is refreshed every few months. As a result, newly committed code, and code from public repositories deleted before the index was created, may not be included in the search. For the same reason, the search may return matches to code that has been deleted or moved since the index was created.

References to matching code are currently available in JetBrains IDEs, Visual Studio, Visual Studio Code, Copilot cloud agent, and on the GitHub website.

Further reading

Finding public code that matches GitHub Copilot suggestions

Managing GitHub Copilot policies as an individual subscriber

Managing policies and features for GitHub Copilot in your organization

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/code-suggestions.txt</code></summary>

````text
GitHub Copilot code suggestions in your IDE - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

GitHub Copilot/

Concepts/

Completions/

Code suggestions

Home

GitHub Copilot

Get started
Quickstart

What is GitHub Copilot?

Plans

Features

Best practices

Choose enterprise plan

Achieve company goals

Resources for approval

Concepts
Completions
Code suggestions

Code referencing

Chat

Agents
Cloud agent
About cloud agent

Agent management

Custom agents

Hooks

Access management

MCP and cloud agent

Risks and mitigations

Copilot CLI
About Copilot CLI

Comparing CLI features

Cancel and roll back

About remote access

Custom agents

About CLI plugins

Autonomous task completion

Parallel task execution

Researching with Copilot

Session data

LSP servers

Context management

Code review

Copilot Memory

Third-party agents

OpenAI Codex

Anthropic Claude

Agent skills

Enterprise management

Spark

Copilot usage metrics
All articles

Copilot usage metrics

Prompting
Prompt engineering

Response customization

Context
MCP

Spaces

Repository indexing

Content exclusion

Tools
AI tools

About Copilot integrations

Auto model selection

Usage limits

Billing
Copilot requests

Individual plans

Billing for individuals

Organizations and enterprises

Premium request management

Copilot-only enterprises

Policies

MCP management

FedRAMP models

Network settings

Base and LTS models

New features and models

How-tos
Copilot on GitHub
Set up Copilot
Enable Copilot
Set up for self

Set up for organization

Set up for enterprise

Set up a dedicated enterprise

Set up for students

Set up for teachers and OS maintainers

Configure access to AI models

Configure automatic review

Configure runners

Chat with Copilot
Get started with chat

Chat in GitHub

Chat in Mobile

Customize Copilot
Customize Copilot overview

Add custom instructions
Add personal instructions

Add repository instructions

Add organization instructions

Customize cloud agent
Create custom agents

Add agent skills

Extend cloud agent with MCP

Use hooks

Customize the agent environment

Customize the agent firewall

Test custom agents

Spaces
Create Copilot Spaces

Collaborate with others

Copilot for GitHub tasks
Use Copilot to create or update issues

Create a PR summary

Use the GitHub MCP Server from Copilot Chat

Use Copilot agents
Get started

Kick off a task

Research, plan, iterate

Manage and track agents

Copilot code review

Review Copilot output

Set up
Set up for self

Install Copilot extension

Get code suggestions
Get IDE code suggestions

Find matching code

Chat with Copilot
Get started with Chat in your IDE

Chat in IDE

Chat in Windows Terminal

Copilot CLI
All articles

Copilot CLI quickstart

Copilot CLI best practices

Set up Copilot CLI
Install Copilot CLI

Authenticate Copilot CLI

Configure Copilot CLI

Add LSP servers

Troubleshoot Copilot CLI auth

Allowing tools

Steer a session remotely

Automate with Copilot CLI
Quickstart

Run the CLI programmatically

Automate with Actions

Customize Copilot CLI
Overview

Add custom instructions

Use hooks

Add agent skills

Add MCP servers

Create custom agents

Use your own model provider

Plugins: Find and install

Plugins: Create a plugin

Plugins: Create a marketplace

Connect to VS Code

Use Copilot CLI agents
Overview

Delegate tasks to Copilot

Invoke custom agents

Steer agents

Agentic code review

Administer for enterprise

Speed up task completion

Manage pull requests

Roll back changes

Use session data

Copilot SDK
Quickstart

Set up Copilot SDK
Choosing a setup path

Azure Managed Identity

Backend services

Bundled CLI

GitHub OAuth

Local CLI

Scaling

Authentication
Authenticate Copilot SDK

Bring your own key (BYOK)

Use Copilot SDK
Working with hooks

Custom agents

Image input

MCP servers

Session persistence

Custom skills

Steering and queueing

Streaming events

Use hooks
Quickstart

Pre-tool use

Post-tool use

User prompt submitted

Session lifecycle

Error handling

Observability
OpenTelemetry

Integrations
Microsoft Agent Framework

Troubleshooting
SDK and CLI compatibility

Debug Copilot SDK

Debug MCP servers

Use Copilot agents
Cloud agent
Create a PR

Track Copilot sessions

Integrate cloud agent with Jira

Integrate cloud agent with Slack

Integrate cloud agent with Teams

Integrate cloud agent with Linear

Integrate cloud agent with Azure Boards

Changing the AI model

Configuring agent settings

Create custom agents in your IDE

Troubleshoot cloud agent

Request a code review
Use code review

Copilot Memory

Use AI models
Change the chat model

Change the completion model

Provide context
Use Copilot Spaces
Use Copilot Spaces

Use MCP in your IDE
Extend Copilot Chat with MCP

Set up the GitHub MCP Server

Enterprise configuration

Configure toolsets

Use the GitHub MCP Server

Change MCP registry

Configure custom instructions
Add repository instructions in your IDE

Configure content exclusion
Exclude content from Copilot

Review changes

Use Copilot for common tasks
Use Copilot in the CLI

Configure personal settings
Configure network settings

Configure in IDE

Authenticate to GHE.com

Manage and track spending
Monitor premium requests

Manage request allowances

Manage company spending

Manage your account
Get started with a Copilot plan

View and change your Copilot plan

Disable Copilot Free

Manage policies

Administer Copilot
Manage for organization
Manage plan
Cancel

Manage access
Grant access

Manage requests for access

Revoke access

Manage network access

Manage policies

Add Copilot cloud agent

Configure agent runners

Prepare for custom agents

Review activity
Review user activity data

Use your own API keys

Manage for enterprise
Manage plan
Subscribe

Cancel plan

Upgrade plan

Downgrade subscription

Manage access
Grant access

Disable for organizations

View license usage

Manage network access

Manage enterprise policies

Manage agents
Prepare for custom agents

Monitor agentic activity

Enable Copilot cloud agent

Block Copilot cloud agent

Manage Copilot code review

Manage Spark

Use your own API keys

Review audit logs

Manage MCP usage
Configure MCP registry

Configure MCP server access

Download activity report

View usage and adoption

View code generation

Troubleshoot Copilot
Troubleshoot common issues

View logs

Troubleshoot firewall settings

Troubleshoot network errors

Troubleshoot Spark

Reference
Chat cheat sheet

Customization cheat sheet

AI models
Supported models

Model comparison

Model hosting

Copilot feature matrix

Keyboard shortcuts

Copilot CLI reference
CLI command reference

CLI plugin reference

CLI programmatic reference

ACP server

CLI configuration directory

Custom agents configuration

Custom instructions support

Hooks configuration

Policy conflicts

Copilot allowlist reference

MCP allowlist enforcement

Metrics data

Copilot billing
Billing cycle

Seat assignment

License changes

Azure billing

Agentic audit log events

Agent session filters

Review excluded files

Copilot usage metrics
Copilot usage metrics data

Interpret usage metrics

Reconciling Copilot usage metrics

Copilot LoC metrics

Example schema

Tutorials
All tutorials

GitHub Copilot Chat Cookbook
All prompts

Communicate effectively
Create templates

Extract information

Synthesize research

Create diagrams

Generate tables

Debug errors
Debug invalid JSON

Handle API rate limits

Diagnose test failures

Analyze functionality
Explore implementations

Analyze feedback

Refactor code
Improve code readability

Fix lint errors

Refactor for optimization

Refactor for sustainability

Refactor design patterns

Refactor data access layers

Decouple business logic

Handle cross-cutting

Simplify inheritance hierarchies

Fix database deadlocks

Translate code

Document code
Create issues

Document legacy code

Explain legacy code

Explain complex logic

Sync documentation

Write discussions or blog posts

Testing code
Generate unit tests

Create mock objects

Create end-to-end tests

Update unit tests

Analyze security
Secure your repository

Manage dependency updates

Find vulnerabilities

Customization library
All customizations

Custom instructions
Your first custom instructions

Concept explainer

Debugging tutor

Code reviewer

GitHub Actions helper

Pull request assistant

Issue manager

Accessibility auditor

Testing automation

Prompt files
Your first prompt file

Create README

Onboarding plan

Document API

Review code

Generate unit tests

Custom agents
Your first custom agent

Implementation planner

Bug fix teammate

Cleanup specialist

Cloud agent
Get the best results

Pilot cloud agent

Improve a project

Build guardrails

Give access to resources

Spark
Your first spark

Prompt tips

Build and deploy apps

Deploy from CLI

Customize code review

Enhance agent mode with MCP

Compare AI models

Speed up development work

Roll out at scale
Assign licenses
Set up self-serve licenses

Track usage and adoption

Remind inactive users

Establish AI managers

Enable developers
Drive adoption

Integrate AI agents

Drive downstream impact
Increase test coverage

Accelerate pull requests

Reduce security debt

Measure trial success

Maintain codebase standards

Explore a codebase

Explore issues and discussions

Explore pull requests

Write tests

Refactor code

Optimize code reviews

Reduce technical debt

Review AI code

Learn a new language

Modernize legacy code

Modernize Java applications

Migrate a project

Plan a project

Vibe coding

Upgrade projects

Use hooks with Copilot CLI

Responsible use
Copilot inline suggestions

Chat in your IDE

Chat in GitHub

Chat in GitHub Mobile

Copilot CLI

Copilot in Windows Terminal

Copilot in GitHub Desktop

Pull request summaries

Commit message generation

Code review

Copilot cloud agent

Spark

Copilot Spaces

GitHub Copilot/

Concepts/

Completions/

Code suggestions

GitHub Copilot code suggestions in your IDE

Learn about Copilot code suggestions in different IDEs.

Tool navigation

Visual Studio Code

JetBrains IDEs

Visual Studio

Eclipse

Vim/Neovim

Azure Data Studio

Xcode

Copy as Markdown

In this article

About code suggestions in Visual Studio Code

About code suggestions in JetBrains IDEs

About code suggestions in Visual Studio

About code suggestions in Vim/Neovim

About code suggestions in Azure Data Studio

About code suggestions in Xcode

About code suggestions in Eclipse

Code suggestions that match public code

Changing the model used for inline suggestions

Effects of switching the AI model

Enabling the model switcher

Changing the model used for inline suggestions

Effects of switching the AI model

Enabling the model switcher

Changing the model used for inline suggestions

Effects of switching the AI model

Enabling the model switcher

Programming languages included in the default model

Next steps

About code suggestions in Visual Studio Code

Copilot in Visual Studio Code provides two kinds of code suggestions:

Next edit suggestions

Based on the edits you are making, Copilot both predicts the location of the next edit you'll want to make and what that edit should be. To enable next edit suggestions, see Configuring GitHub Copilot in your environment.

Ghost text suggestions

Copilot offers coding suggestions as you type. Start typing in the editor, and Copilot provides dimmed ghost text suggestions at your current cursor location. You can also describe something you want to do using natural language within a comment, and Copilot will suggest the code to accomplish your goal.

GitHub Copilot provides suggestions for numerous languages and a wide variety of frameworks, but works especially well for Python, JavaScript, TypeScript, Ruby, Go, C# and C++. GitHub Copilot can also assist in query generation for databases, generating suggestions for APIs and frameworks, and can help with infrastructure as code development.

About code suggestions in JetBrains IDEs

Copilot offers inline suggestions as you type.

GitHub Copilot provides suggestions for numerous languages and a wide variety of frameworks, but works especially well for Python, JavaScript, TypeScript, Ruby, Go, C# and C++. GitHub Copilot can also assist in query generation for databases, generating suggestions for APIs and frameworks, and can help with infrastructure as code development.

About code suggestions in Visual Studio

Copilot in Visual Studio provides two kinds of code suggestions:

Ghost text suggestions

Copilot offers coding suggestions as you type.

Next edit suggestions (public preview)

Based on the edits you are making, Copilot will predict the location of the next edit you are likely to make and suggest a completion for it. Suggestions may span a single symbol, an entire line, or multiple lines, depending on the scope of the potential change. To enable next edit suggestions, see Configuring GitHub Copilot in your environment.

GitHub Copilot provides suggestions for numerous languages and a wide variety of frameworks, but works especially well for Python, JavaScript, TypeScript, Ruby, Go, C# and C++. GitHub Copilot can also assist in query generation for databases, generating suggestions for APIs and frameworks, and can help with infrastructure as code development.

About code suggestions in Vim/Neovim

GitHub Copilot provides inline suggestions as you type in Vim/Neovim.

About code suggestions in Azure Data Studio

GitHub Copilot provides you with inline suggestions as you create SQL databases in Azure Data Studio.

About code suggestions in Xcode

GitHub Copilot in Xcode provides two kinds of code suggestions:

Ghost text suggestions

Copilot offers coding suggestions as you type. You can also describe something you want to do using natural language within a comment, and Copilot will suggest the code to accomplish your goal.

Next edit suggestions (public preview)

Based on the edits you are making, Copilot will predict the location of the next edit you are likely to make and suggest a completion for it. Suggestions may span an entire line, or multiple lines, depending on the scope of the potential change. Next edit suggestions are enabled by default. To disable, see Configuring GitHub Copilot in your environment.

About code suggestions in Eclipse

GitHub Copilot in Eclipse provides two kinds of code suggestions:

Ghost text suggestions

Copilot offers coding suggestions as you type. You can also describe something you want to do using natural language within a comment, and Copilot will suggest the code to accomplish your goal.

Next edit suggestions (public preview)

Based on the edits you are making, Copilot will predict the location of the next edit you are likely to make and suggest a completion for it. Suggestions may span a single symbol, an entire line, or multiple lines, depending on the scope of the potential change. To enable next edit suggestions, see Configuring GitHub Copilot in your environment.

GitHub Copilot provides suggestions for numerous languages and a wide variety of frameworks, but works especially well for Python, JavaScript, TypeScript, Ruby, Go, C# and C++. GitHub Copilot can also assist in query generation for databases, generating suggestions for APIs and frameworks, and can help with infrastructure as code development.

Code suggestions that match public code

GitHub Copilot checks each suggestion for matches with publicly available code. Matches may be discarded or suggested with a code reference, based on the setting of the "Suggestions matching public code" policy for your account or organization. See GitHub Copilot code referencing.

Changing the model used for inline suggestions

You can switch the AI model that's used for Copilot inline suggestions if:

An alternative model is currently available

You are using the latest releases of VS Code with the latest version of the GitHub Copilot extension

Changing the model only affects Copilot ghost text suggestions. It does not affect Copilot next edit suggestions.

Note

 The list of available models will change over time. When only one model is available for inline suggestions, the model picker will only show that model. Preview models and additional models will be added to the picker as they become available.

For details of how to switch the model for Copilot inline suggestions, see Changing the AI model for GitHub Copilot inline suggestions.

Effects of switching the AI model

Changing the model that's used for Copilot inline suggestions does not affect the model that's used by Copilot next edit suggestions or Copilot Chat. See Changing the AI model for GitHub Copilot Chat.

There are no changes to the data collection and usage policy if you change the AI model.

If you are on a Copilot Free plan, all completions count against your completions quota regardless of the model used. See Plans for GitHub Copilot.

The setting to enable or disable suggestions that match public code is applied irrespective of which model you choose. See Finding public code that matches GitHub Copilot suggestions.

Enabling the model switcher

If you have a Copilot Free or Copilot Pro plan, the model switcher for Copilot inline suggestions is automatically enabled.

If you're using a Copilot Business or Copilot Enterprise plan, the organization or enterprise that provides your plan must enable the Editor preview features setting. See Managing policies and features for GitHub Copilot in your organization or Managing policies and features for GitHub Copilot in your enterprise.

Changing the model used for inline suggestions

You can switch the AI model that's used for Copilot inline suggestions if:

An alternative model is currently available

You are using Visual Studio 17.14 Preview 2 or later

Note

 The list of available models will change over time. When only one model is available for inline suggestions, the model picker will only show that model. Preview models and additional models will be added to the picker as they become available.

For details of how to switch the model for Copilot inline suggestions, see Changing the AI model for GitHub Copilot inline suggestions.

Effects of switching the AI model

Changing the model that's used for Copilot inline suggestions does not affect the model that's used by Copilot next edit suggestions or Copilot Chat. See Changing the AI model for GitHub Copilot Chat.

There are no changes to the data collection and usage policy if you change the AI model.

If you are on a Copilot Free plan, all completions count against your completions quota regardless of the model used. See Plans for GitHub Copilot.

The setting to enable or disable suggestions that match public code is applied irrespective of which model you choose. See Finding public code that matches GitHub Copilot suggestions.

Enabling the model switcher

If you have a Copilot Free or Copilot Pro plan, the model switcher for Copilot inline suggestions is automatically enabled.

If you're using a Copilot Business or Copilot Enterprise plan, the organization or enterprise that provides your plan must enable the Editor preview features setting. See Managing policies and features for GitHub Copilot in your organization or Managing policies and features for GitHub Copilot in your enterprise.

Changing the model used for inline suggestions

You can switch the AI model that's used for Copilot inline suggestions if:

An alternative model is currently available

You are using the latest release of JetBrains IDEs with the latest version of the GitHub Copilot extension

Note

 The list of available models will change over time. When only one model is available for inline suggestions, the model picker will only show that model. Preview models and additional models will be added to the picker as they become available.

For details of how to switch the model for Copilot inline suggestions, see Changing the AI model for GitHub Copilot inline suggestions.

Effects of switching the AI model

Changing the model that's used for Copilot inline suggestions does not affect the model that's used by Copilot next edit suggestions or Copilot Chat. See Changing the AI model for GitHub Copilot Chat.

There are no changes to the data collection and usage policy if you change the AI model.

If you are on a Copilot Free plan, all completions count against your completions quota regardless of the model used. See Plans for GitHub Copilot.

The setting to enable or disable suggestions that match public code is applied irrespective of which model you choose. See Finding public code that matches GitHub Copilot suggestions.

Enabling the model switcher

If you have a Copilot Free or Copilot Pro plan, the model switcher for Copilot inline suggestions is automatically enabled.

If you're using a Copilot Business or Copilot Enterprise plan, the organization or enterprise that provides your plan must enable the Editor preview features setting. See Managing policies and features for GitHub Copilot in your organization or Managing policies and features for GitHub Copilot in your enterprise.

Programming languages included in the default model

The following programming languages and technologies are included in the training data for the default LLM used for Copilot inline suggestions:

C

C#

C++

Clojure

CSS

Dart

Dockerfile

Elixir

Emacs Lisp

Go

Haskell

HTML

Java

JavaScript

Julia

Jupyter Notebook

Kotlin

Lua

MATLAB

Objective-C

Perl

PHP

PowerShell

Python

R

Ruby

Rust

Scala

Shell

Swift

TeX

TypeScript

Vue

Next steps

Getting code suggestions in your IDE with GitHub Copilot

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/copilot-sdk.txt</code></summary>

````text
GitHub Copilot SDK - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

GitHub Copilot/

How-tos/

Copilot SDK

Home

GitHub Copilot

Get started
Quickstart

What is GitHub Copilot?

Plans

Features

Best practices

Choose enterprise plan

Achieve company goals

Resources for approval

Concepts
Completions
Code suggestions

Code referencing

Chat

Agents
Cloud agent
About cloud agent

Agent management

Custom agents

Hooks

Access management

MCP and cloud agent

Risks and mitigations

Copilot CLI
About Copilot CLI

Comparing CLI features

Cancel and roll back

About remote access

Custom agents

About CLI plugins

Autonomous task completion

Parallel task execution

Researching with Copilot

Session data

LSP servers

Context management

Code review

Copilot Memory

Third-party agents

OpenAI Codex

Anthropic Claude

Agent skills

Enterprise management

Spark

Copilot usage metrics
All articles

Copilot usage metrics

Prompting
Prompt engineering

Response customization

Context
MCP

Spaces

Repository indexing

Content exclusion

Tools
AI tools

About Copilot integrations

Auto model selection

Usage limits

Billing
Copilot requests

Individual plans

Billing for individuals

Organizations and enterprises

Premium request management

Copilot-only enterprises

Policies

MCP management

FedRAMP models

Network settings

Base and LTS models

New features and models

How-tos
Copilot on GitHub
Set up Copilot
Enable Copilot
Set up for self

Set up for organization

Set up for enterprise

Set up a dedicated enterprise

Set up for students

Set up for teachers and OS maintainers

Configure access to AI models

Configure automatic review

Configure runners

Chat with Copilot
Get started with chat

Chat in GitHub

Chat in Mobile

Customize Copilot
Customize Copilot overview

Add custom instructions
Add personal instructions

Add repository instructions

Add organization instructions

Customize cloud agent
Create custom agents

Add agent skills

Extend cloud agent with MCP

Use hooks

Customize the agent environment

Customize the agent firewall

Test custom agents

Spaces
Create Copilot Spaces

Collaborate with others

Copilot for GitHub tasks
Use Copilot to create or update issues

Create a PR summary

Use the GitHub MCP Server from Copilot Chat

Use Copilot agents
Get started

Kick off a task

Research, plan, iterate

Manage and track agents

Copilot code review

Review Copilot output

Set up
Set up for self

Install Copilot extension

Get code suggestions
Get IDE code suggestions

Find matching code

Chat with Copilot
Get started with Chat in your IDE

Chat in IDE

Chat in Windows Terminal

Copilot CLI
All articles

Copilot CLI quickstart

Copilot CLI best practices

Set up Copilot CLI
Install Copilot CLI

Authenticate Copilot CLI

Configure Copilot CLI

Add LSP servers

Troubleshoot Copilot CLI auth

Allowing tools

Steer a session remotely

Automate with Copilot CLI
Quickstart

Run the CLI programmatically

Automate with Actions

Customize Copilot CLI
Overview

Add custom instructions

Use hooks

Add agent skills

Add MCP servers

Create custom agents

Use your own model provider

Plugins: Find and install

Plugins: Create a plugin

Plugins: Create a marketplace

Connect to VS Code

Use Copilot CLI agents
Overview

Delegate tasks to Copilot

Invoke custom agents

Steer agents

Agentic code review

Administer for enterprise

Speed up task completion

Manage pull requests

Roll back changes

Use session data

Copilot SDK
Quickstart

Set up Copilot SDK
Choosing a setup path

Azure Managed Identity

Backend services

Bundled CLI

GitHub OAuth

Local CLI

Scaling

Authentication
Authenticate Copilot SDK

Bring your own key (BYOK)

Use Copilot SDK
Working with hooks

Custom agents

Image input

MCP servers

Session persistence

Custom skills

Steering and queueing

Streaming events

Use hooks
Quickstart

Pre-tool use

Post-tool use

User prompt submitted

Session lifecycle

Error handling

Observability
OpenTelemetry

Integrations
Microsoft Agent Framework

Troubleshooting
SDK and CLI compatibility

Debug Copilot SDK

Debug MCP servers

Use Copilot agents
Cloud agent
Create a PR

Track Copilot sessions

Integrate cloud agent with Jira

Integrate cloud agent with Slack

Integrate cloud agent with Teams

Integrate cloud agent with Linear

Integrate cloud agent with Azure Boards

Changing the AI model

Configuring agent settings

Create custom agents in your IDE

Troubleshoot cloud agent

Request a code review
Use code review

Copilot Memory

Use AI models
Change the chat model

Change the completion model

Provide context
Use Copilot Spaces
Use Copilot Spaces

Use MCP in your IDE
Extend Copilot Chat with MCP

Set up the GitHub MCP Server

Enterprise configuration

Configure toolsets

Use the GitHub MCP Server

Change MCP registry

Configure custom instructions
Add repository instructions in your IDE

Configure content exclusion
Exclude content from Copilot

Review changes

Use Copilot for common tasks
Use Copilot in the CLI

Configure personal settings
Configure network settings

Configure in IDE

Authenticate to GHE.com

Manage and track spending
Monitor premium requests

Manage request allowances

Manage company spending

Manage your account
Get started with a Copilot plan

View and change your Copilot plan

Disable Copilot Free

Manage policies

Administer Copilot
Manage for organization
Manage plan
Cancel

Manage access
Grant access

Manage requests for access

Revoke access

Manage network access

Manage policies

Add Copilot cloud agent

Configure agent runners

Prepare for custom agents

Review activity
Review user activity data

Use your own API keys

Manage for enterprise
Manage plan
Subscribe

Cancel plan

Upgrade plan

Downgrade subscription

Manage access
Grant access

Disable for organizations

View license usage

Manage network access

Manage enterprise policies

Manage agents
Prepare for custom agents

Monitor agentic activity

Enable Copilot cloud agent

Block Copilot cloud agent

Manage Copilot code review

Manage Spark

Use your own API keys

Review audit logs

Manage MCP usage
Configure MCP registry

Configure MCP server access

Download activity report

View usage and adoption

View code generation

Troubleshoot Copilot
Troubleshoot common issues

View logs

Troubleshoot firewall settings

Troubleshoot network errors

Troubleshoot Spark

Reference
Chat cheat sheet

Customization cheat sheet

AI models
Supported models

Model comparison

Model hosting

Copilot feature matrix

Keyboard shortcuts

Copilot CLI reference
CLI command reference

CLI plugin reference

CLI programmatic reference

ACP server

CLI configuration directory

Custom agents configuration

Custom instructions support

Hooks configuration

Policy conflicts

Copilot allowlist reference

MCP allowlist enforcement

Metrics data

Copilot billing
Billing cycle

Seat assignment

License changes

Azure billing

Agentic audit log events

Agent session filters

Review excluded files

Copilot usage metrics
Copilot usage metrics data

Interpret usage metrics

Reconciling Copilot usage metrics

Copilot LoC metrics

Example schema

Tutorials
All tutorials

GitHub Copilot Chat Cookbook
All prompts

Communicate effectively
Create templates

Extract information

Synthesize research

Create diagrams

Generate tables

Debug errors
Debug invalid JSON

Handle API rate limits

Diagnose test failures

Analyze functionality
Explore implementations

Analyze feedback

Refactor code
Improve code readability

Fix lint errors

Refactor for optimization

Refactor for sustainability

Refactor design patterns

Refactor data access layers

Decouple business logic

Handle cross-cutting

Simplify inheritance hierarchies

Fix database deadlocks

Translate code

Document code
Create issues

Document legacy code

Explain legacy code

Explain complex logic

Sync documentation

Write discussions or blog posts

Testing code
Generate unit tests

Create mock objects

Create end-to-end tests

Update unit tests

Analyze security
Secure your repository

Manage dependency updates

Find vulnerabilities

Customization library
All customizations

Custom instructions
Your first custom instructions

Concept explainer

Debugging tutor

Code reviewer

GitHub Actions helper

Pull request assistant

Issue manager

Accessibility auditor

Testing automation

Prompt files
Your first prompt file

Create README

Onboarding plan

Document API

Review code

Generate unit tests

Custom agents
Your first custom agent

Implementation planner

Bug fix teammate

Cleanup specialist

Cloud agent
Get the best results

Pilot cloud agent

Improve a project

Build guardrails

Give access to resources

Spark
Your first spark

Prompt tips

Build and deploy apps

Deploy from CLI

Customize code review

Enhance agent mode with MCP

Compare AI models

Speed up development work

Roll out at scale
Assign licenses
Set up self-serve licenses

Track usage and adoption

Remind inactive users

Establish AI managers

Enable developers
Drive adoption

Integrate AI agents

Drive downstream impact
Increase test coverage

Accelerate pull requests

Reduce security debt

Measure trial success

Maintain codebase standards

Explore a codebase

Explore issues and discussions

Explore pull requests

Write tests

Refactor code

Optimize code reviews

Reduce technical debt

Review AI code

Learn a new language

Modernize legacy code

Modernize Java applications

Migrate a project

Plan a project

Vibe coding

Upgrade projects

Use hooks with Copilot CLI

Responsible use
Copilot inline suggestions

Chat in your IDE

Chat in GitHub

Chat in GitHub Mobile

Copilot CLI

Copilot in Windows Terminal

Copilot in GitHub Desktop

Pull request summaries

Commit message generation

Code review

Copilot cloud agent

Spark

Copilot Spaces

GitHub Copilot/

How-tos/

Copilot SDK

GitHub Copilot SDK

Learn how to customize your Copilot experience using Copilot SDK.

Getting started with Copilot SDK

Learn how to install Copilot SDK and send your first message.

Set up Copilot SDK

Learn how to configure and deploy GitHub Copilot SDK for different environments.

Authenticating with the Copilot SDK

Choose the authentication method that best fits your deployment scenario for GitHub Copilot SDK.

Use Copilot SDK

Explore the capabilities you can add to your Copilot SDK application.

Use hooks

Customize the behavior of Copilot SDK sessions at key points in the conversation lifecycle using hooks.

Observability for Copilot SDK

Learn how to monitor and trace your Copilot SDK applications.

Copilot SDK integrations

Integrate Copilot SDK with third-party agent frameworks and orchestration platforms.

Troubleshooting Copilot SDK

Find solutions to common issues and resolve problems when using Copilot SDK.

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/github-oauth.txt</code></summary>

````text
Using GitHub OAuth with Copilot SDK - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

GitHub Copilot/

How-tos/

Copilot SDK/

Set up Copilot SDK/

GitHub OAuth

Home

GitHub Copilot

Get started
Quickstart

What is GitHub Copilot?

Plans

Features

Best practices

Choose enterprise plan

Achieve company goals

Resources for approval

Concepts
Completions
Code suggestions

Code referencing

Chat

Agents
Cloud agent
About cloud agent

Agent management

Custom agents

Hooks

Access management

MCP and cloud agent

Risks and mitigations

Copilot CLI
About Copilot CLI

Comparing CLI features

Cancel and roll back

About remote access

Custom agents

About CLI plugins

Autonomous task completion

Parallel task execution

Researching with Copilot

Session data

LSP servers

Context management

Code review

Copilot Memory

Third-party agents

OpenAI Codex

Anthropic Claude

Agent skills

Enterprise management

Spark

Copilot usage metrics
All articles

Copilot usage metrics

Prompting
Prompt engineering

Response customization

Context
MCP

Spaces

Repository indexing

Content exclusion

Tools
AI tools

About Copilot integrations

Auto model selection

Usage limits

Billing
Copilot requests

Individual plans

Billing for individuals

Organizations and enterprises

Premium request management

Copilot-only enterprises

Policies

MCP management

FedRAMP models

Network settings

Base and LTS models

New features and models

How-tos
Copilot on GitHub
Set up Copilot
Enable Copilot
Set up for self

Set up for organization

Set up for enterprise

Set up a dedicated enterprise

Set up for students

Set up for teachers and OS maintainers

Configure access to AI models

Configure automatic review

Configure runners

Chat with Copilot
Get started with chat

Chat in GitHub

Chat in Mobile

Customize Copilot
Customize Copilot overview

Add custom instructions
Add personal instructions

Add repository instructions

Add organization instructions

Customize cloud agent
Create custom agents

Add agent skills

Extend cloud agent with MCP

Use hooks

Customize the agent environment

Customize the agent firewall

Test custom agents

Spaces
Create Copilot Spaces

Collaborate with others

Copilot for GitHub tasks
Use Copilot to create or update issues

Create a PR summary

Use the GitHub MCP Server from Copilot Chat

Use Copilot agents
Get started

Kick off a task

Research, plan, iterate

Manage and track agents

Copilot code review

Review Copilot output

Set up
Set up for self

Install Copilot extension

Get code suggestions
Get IDE code suggestions

Find matching code

Chat with Copilot
Get started with Chat in your IDE

Chat in IDE

Chat in Windows Terminal

Copilot CLI
All articles

Copilot CLI quickstart

Copilot CLI best practices

Set up Copilot CLI
Install Copilot CLI

Authenticate Copilot CLI

Configure Copilot CLI

Add LSP servers

Troubleshoot Copilot CLI auth

Allowing tools

Steer a session remotely

Automate with Copilot CLI
Quickstart

Run the CLI programmatically

Automate with Actions

Customize Copilot CLI
Overview

Add custom instructions

Use hooks

Add agent skills

Add MCP servers

Create custom agents

Use your own model provider

Plugins: Find and install

Plugins: Create a plugin

Plugins: Create a marketplace

Connect to VS Code

Use Copilot CLI agents
Overview

Delegate tasks to Copilot

Invoke custom agents

Steer agents

Agentic code review

Administer for enterprise

Speed up task completion

Manage pull requests

Roll back changes

Use session data

Copilot SDK
Quickstart

Set up Copilot SDK
Choosing a setup path

Azure Managed Identity

Backend services

Bundled CLI

GitHub OAuth

Local CLI

Scaling

Authentication
Authenticate Copilot SDK

Bring your own key (BYOK)

Use Copilot SDK
Working with hooks

Custom agents

Image input

MCP servers

Session persistence

Custom skills

Steering and queueing

Streaming events

Use hooks
Quickstart

Pre-tool use

Post-tool use

User prompt submitted

Session lifecycle

Error handling

Observability
OpenTelemetry

Integrations
Microsoft Agent Framework

Troubleshooting
SDK and CLI compatibility

Debug Copilot SDK

Debug MCP servers

Use Copilot agents
Cloud agent
Create a PR

Track Copilot sessions

Integrate cloud agent with Jira

Integrate cloud agent with Slack

Integrate cloud agent with Teams

Integrate cloud agent with Linear

Integrate cloud agent with Azure Boards

Changing the AI model

Configuring agent settings

Create custom agents in your IDE

Troubleshoot cloud agent

Request a code review
Use code review

Copilot Memory

Use AI models
Change the chat model

Change the completion model

Provide context
Use Copilot Spaces
Use Copilot Spaces

Use MCP in your IDE
Extend Copilot Chat with MCP

Set up the GitHub MCP Server

Enterprise configuration

Configure toolsets

Use the GitHub MCP Server

Change MCP registry

Configure custom instructions
Add repository instructions in your IDE

Configure content exclusion
Exclude content from Copilot

Review changes

Use Copilot for common tasks
Use Copilot in the CLI

Configure personal settings
Configure network settings

Configure in IDE

Authenticate to GHE.com

Manage and track spending
Monitor premium requests

Manage request allowances

Manage company spending

Manage your account
Get started with a Copilot plan

View and change your Copilot plan

Disable Copilot Free

Manage policies

Administer Copilot
Manage for organization
Manage plan
Cancel

Manage access
Grant access

Manage requests for access

Revoke access

Manage network access

Manage policies

Add Copilot cloud agent

Configure agent runners

Prepare for custom agents

Review activity
Review user activity data

Use your own API keys

Manage for enterprise
Manage plan
Subscribe

Cancel plan

Upgrade plan

Downgrade subscription

Manage access
Grant access

Disable for organizations

View license usage

Manage network access

Manage enterprise policies

Manage agents
Prepare for custom agents

Monitor agentic activity

Enable Copilot cloud agent

Block Copilot cloud agent

Manage Copilot code review

Manage Spark

Use your own API keys

Review audit logs

Manage MCP usage
Configure MCP registry

Configure MCP server access

Download activity report

View usage and adoption

View code generation

Troubleshoot Copilot
Troubleshoot common issues

View logs

Troubleshoot firewall settings

Troubleshoot network errors

Troubleshoot Spark

Reference
Chat cheat sheet

Customization cheat sheet

AI models
Supported models

Model comparison

Model hosting

Copilot feature matrix

Keyboard shortcuts

Copilot CLI reference
CLI command reference

CLI plugin reference

CLI programmatic reference

ACP server

CLI configuration directory

Custom agents configuration

Custom instructions support

Hooks configuration

Policy conflicts

Copilot allowlist reference

MCP allowlist enforcement

Metrics data

Copilot billing
Billing cycle

Seat assignment

License changes

Azure billing

Agentic audit log events

Agent session filters

Review excluded files

Copilot usage metrics
Copilot usage metrics data

Interpret usage metrics

Reconciling Copilot usage metrics

Copilot LoC metrics

Example schema

Tutorials
All tutorials

GitHub Copilot Chat Cookbook
All prompts

Communicate effectively
Create templates

Extract information

Synthesize research

Create diagrams

Generate tables

Debug errors
Debug invalid JSON

Handle API rate limits

Diagnose test failures

Analyze functionality
Explore implementations

Analyze feedback

Refactor code
Improve code readability

Fix lint errors

Refactor for optimization

Refactor for sustainability

Refactor design patterns

Refactor data access layers

Decouple business logic

Handle cross-cutting

Simplify inheritance hierarchies

Fix database deadlocks

Translate code

Document code
Create issues

Document legacy code

Explain legacy code

Explain complex logic

Sync documentation

Write discussions or blog posts

Testing code
Generate unit tests

Create mock objects

Create end-to-end tests

Update unit tests

Analyze security
Secure your repository

Manage dependency updates

Find vulnerabilities

Customization library
All customizations

Custom instructions
Your first custom instructions

Concept explainer

Debugging tutor

Code reviewer

GitHub Actions helper

Pull request assistant

Issue manager

Accessibility auditor

Testing automation

Prompt files
Your first prompt file

Create README

Onboarding plan

Document API

Review code

Generate unit tests

Custom agents
Your first custom agent

Implementation planner

Bug fix teammate

Cleanup specialist

Cloud agent
Get the best results

Pilot cloud agent

Improve a project

Build guardrails

Give access to resources

Spark
Your first spark

Prompt tips

Build and deploy apps

Deploy from CLI

Customize code review

Enhance agent mode with MCP

Compare AI models

Speed up development work

Roll out at scale
Assign licenses
Set up self-serve licenses

Track usage and adoption

Remind inactive users

Establish AI managers

Enable developers
Drive adoption

Integrate AI agents

Drive downstream impact
Increase test coverage

Accelerate pull requests

Reduce security debt

Measure trial success

Maintain codebase standards

Explore a codebase

Explore issues and discussions

Explore pull requests

Write tests

Refactor code

Optimize code reviews

Reduce technical debt

Review AI code

Learn a new language

Modernize legacy code

Modernize Java applications

Migrate a project

Plan a project

Vibe coding

Upgrade projects

Use hooks with Copilot CLI

Responsible use
Copilot inline suggestions

Chat in your IDE

Chat in GitHub

Chat in GitHub Mobile

Copilot CLI

Copilot in Windows Terminal

Copilot in GitHub Desktop

Pull request summaries

Commit message generation

Code review

Copilot cloud agent

Spark

Copilot Spaces

GitHub Copilot/

How-tos/

Copilot SDK/

Set up Copilot SDK/

GitHub OAuth

Using GitHub OAuth with Copilot SDK

Let users authenticate with their GitHub accounts to use GitHub Copilot through your application.

Who can use this feature?

GitHub Copilot SDK is available with all Copilot plans.

Copy as Markdown

In this article

How it works

Step 1: Create a GitHub OAuth App

Step 2: Implement the OAuth flow

Step 3: Pass the token to the SDK

Enterprise and organization access

Supported token types

Token lifecycle management

Multi-user patterns

Limitations

Next steps

Note

Copilot SDK is currently in technical preview. Functionality and availability are subject to change.

"Connect users to GitHub Copilot by providing GitHub account authentication directly within your application.

Best for: Multi-user apps, internal tools with organization access control, SaaS products, and apps where users already have GitHub accounts.

How it works

You create a GitHub OAuth App (or GitHub App), users authorize it, and you pass their access token to the SDK. Copilot requests are made on behalf of each authenticated user, using their Copilot subscription. For detailed sequence diagrams of this flow and architecture, see the github/copilot-sdk repository.

Key characteristics:

Each user authenticates with their own GitHub account.

Copilot usage is billed to each user's subscription.

Supports GitHub organizations and enterprise accounts.

Your app never handles model API keys—GitHub manages everything.

Step 1: Create a GitHub OAuth App

Go to GitHub Settings > Developer Settings > OAuth Apps > New OAuth App. For organizations, go to Organization Settings > Developer Settings.

Fill in the following fields:

Application name: Your app's name.

Homepage URL: Your app's URL.

Authorization callback URL: Your OAuth callback endpoint (for example, https://YOUR-APP.com/auth/callback). Replace YOUR-APP.com with your domain.

Note your Client ID and generate a Client Secret.

Note

Both GitHub Apps and OAuth Apps work with the SDK. GitHub Apps offer finer-grained permissions and are recommended for new projects. OAuth Apps are simpler to set up. The token flow is the same from the SDK's perspective.

Step 2: Implement the OAuth flow

Your application handles the standard GitHub OAuth flow. The following shows the server-side token exchange:

// Server-side: exchange authorization code for user token
async function handleOAuthCallback(code: string): Promise<string> {
 const response = await fetch("https://github.com/login/oauth/access_token", {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 Accept: "application/json",
 },
 body: JSON.stringify({
 client_id: process.env.GITHUB_CLIENT_ID,
 client_secret: process.env.GITHUB_CLIENT_SECRET,
 code,
 }),
 });

 const data = await response.json();
 return data.access_token; // gho_xxxx or ghu_xxxx
}

Step 3: Pass the token to the SDK

Create an SDK client for each authenticated user, passing their token.

Node.js / TypeScript

import { CopilotClient } from "@github/copilot-sdk";

// Create a client for an authenticated user
function createClientForUser(userToken: string): CopilotClient {
 return new CopilotClient({
 githubToken: userToken,
 useLoggedInUser: false, // Don't fall back to CLI sign-in
 });
}

// Usage
const client = createClientForUser("USER-ACCESS-TOKEN");
const session = await client.createSession({
 sessionId: `user-${userId}-session`,
 model: "gpt-4.1",
});

const response = await session.sendAndWait({ prompt: "Hello!" });

Replace USER-ACCESS-TOKEN with the user's OAuth access token (for example, gho_xxxx).

Python

from copilot import CopilotClient, PermissionHandler

def create_client_for_user(user_token: str) -> CopilotClient:
 return CopilotClient({
 "github_token": user_token,
 "use_logged_in_user": False,
 })

# Usage
client = create_client_for_user("USER-ACCESS-TOKEN")
await client.start()

session = await client.create_session(
 on_permission_request=PermissionHandler.approve_all,
 model="gpt-4.1",
 session_id=f"user-{user_id}-session",
)

response = await session.send_and_wait({"prompt": "Hello!"})

Go

func createClientForUser(userToken string) *copilot.Client {
 return copilot.NewClient(&copilot.ClientOptions{
 GithubToken: userToken,
 UseLoggedInUser: copilot.Bool(false),
 })
}

// Usage
client := createClientForUser("USER-ACCESS-TOKEN")
client.Start(ctx)
defer client.Stop()

session, _ := client.CreateSession(ctx, &copilot.SessionConfig{
 SessionID: fmt.Sprintf("user-%s-session", userID),
 Model: "gpt-4.1",
})
response, _ := session.SendAndWait(ctx, copilot.MessageOptions{Prompt: "Hello!"})

.NET

CopilotClient CreateClientForUser(string userToken) =>
 new CopilotClient(new CopilotClientOptions
 {
 GithubToken = userToken,
 UseLoggedInUser = false,
 });

// Usage
await using var client = CreateClientForUser("USER-ACCESS-TOKEN");
await using var session = await client.CreateSessionAsync(new SessionConfig
{
 SessionId = $"user-{userId}-session",
 Model = "gpt-4.1",
});

var response = await session.SendAndWaitAsync(
 new MessageOptions { Prompt = "Hello!" });

Enterprise and organization access

GitHub OAuth naturally supports enterprise scenarios. When users authenticate with GitHub, their organization memberships and enterprise associations are included.

Verify organization membership

After OAuth, you can check that the user belongs to your organization:

async function verifyOrgMembership(
 token: string,
 requiredOrg: string
): Promise<boolean> {
 const response = await fetch("https://api.github.com/user/orgs", {
 headers: { Authorization: `Bearer ${token}` },
 });
 const orgs = await response.json();
 return orgs.some((org: any) => org.login === requiredOrg);
}

// In your auth flow
const token = await handleOAuthCallback(code);
if (!await verifyOrgMembership(token, "YOUR-ORG")) {
 throw new Error("User is not a member of the required organization");
}
const client = createClientForUser(token);

Replace YOUR-ORG with your GitHub organization name.

Enterprise Managed Users (EMU)

For managed user accounts, the flow is identical. EMU users authenticate through GitHub OAuth like any other user, and enterprise policies (IP restrictions, SAML SSO) are enforced by GitHub automatically.

// No special SDK configuration needed for EMU
const client = new CopilotClient({
 githubToken: emuUserToken,
 useLoggedInUser: false,
});

Supported token types

Token prefixSourceSupported

gho_OAuth user access tokenYes

ghu_GitHub App user access tokenYes

github_pat_Fine-grained personal access tokenYes

ghp_Personal access token (classic)No (closing down)

Token lifecycle management

Your application is responsible for token storage, refresh, and expiration handling. The SDK uses whatever token you provide—it doesn't manage the OAuth lifecycle.

Token refresh pattern

async function getOrRefreshToken(userId: string): Promise<string> {
 const stored = await tokenStore.get(userId);

 if (stored && !isExpired(stored)) {
 return stored.accessToken;
 }

 if (stored?.refreshToken) {
 const refreshed = await refreshGitHubToken(stored.refreshToken);
 await tokenStore.set(userId, refreshed);
 return refreshed.accessToken;
 }

 throw new Error("User must re-authenticate");
}

Multi-user patterns

One client per user (recommended)

Each user gets their own SDK client with their own token. This provides the strongest isolation.

const clients = new Map<string, CopilotClient>();

function getClientForUser(userId: string, token: string): CopilotClient {
 if (!clients.has(userId)) {
 clients.set(userId, new CopilotClient({
 githubToken: token,
 useLoggedInUser: false,
 }));
 }
 return clients.get(userId)!;
}

Limitations

LimitationDetails

Copilot subscription requiredEach user needs an active GitHub Copilot subscription.

Token management is your responsibilityYou must store, refresh, and handle token expiration.

GitHub account requiredUsers must have GitHub accounts.

Rate limits per userUsage is subject to each user's Copilot rate limits.

Next steps

To run the SDK on servers, see Setting up Copilot SDK for backend services.

To handle many concurrent users, see Scaling Copilot SDK deployments.

For installation and your first message, see Getting started with Copilot SDK.

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/oauth-apps.txt</code></summary>

````text
OAuth apps - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

Apps/

OAuth apps

Home

Apps

Overview

Using GitHub Apps
About using apps

Install from Marketplace for user

Install from Marketplace for org

Install from third party

Install your own app

Request for org

Authorize

Approve new permissions

Review your authorizations

Review installations

Privileged apps

Creating GitHub Apps
About creating GitHub Apps
About creating apps

GitHub App versus other options

Best practices

Migrate from OAuth apps

Registering a GitHub App
Register a GitHub App

Callback URL

Setup URL

Permissions

Webhooks

Visibility

Rate limits

Custom badge

Authenticate with a GitHub App
About authentication

Authenticate as an app

Authenticate as an installation

Authenticate on behalf of users

Manage private keys

Generate a JWT

Generate an installation access token

Generate a user access token

Refresh user access tokens

Authenticate in Actions workflow

Writing code for a GitHub App
About writing GitHub App code

Quickstart

Respond to webhooks

Build a "Login" button

Build a CLI

Build CI checks

Sharing GitHub Apps
Share your app

Share with GHES

App manifest

App query parameters

Maintaining GitHub Apps
Modify app settings

Activate optional features

GitHub App managers

Manage allowed IP addresses

Suspend an installation

Transfer ownership

Delete your app

GitHub Marketplace
Overview
About GitHub Marketplace for apps

About marketplace badges

Publisher verification

Create Marketplace apps
Listing requirements

Security best practice

Customer experience best practice

View listing metrics

View listing transactions

Marketplace API usage
REST API

Webhook events

Testing your app

New purchases & free trials

Handling plan changes

Plan cancellations

List an app on the Marketplace
Draft an app listing

Write listing descriptions

Set listing pricing plans

Webhooks for plan changes

Submit your listing

Delete your listing

Sell apps on the Marketplace
Pricing plans for apps

Billing customers

Receive payment

OAuth apps
Using OAuth apps
Install app personal account

Install app organization

Authorizing OAuth apps

Review OAuth apps

Third-party applications

Privileged apps

Building OAuth apps
GitHub Apps & OAuth apps

Rate limits

Creating an OAuth app

Authenticate with an OAuth app

Authorizing OAuth apps

Scopes for OAuth apps

Create custom badges

Best practices

Maintaining OAuth apps
Modifying an OAuth app

Activate optional features

Transfer ownership

Troubleshoot authorization

Troubleshoot token request

Deleting an OAuth app

Apps/

OAuth apps

OAuth apps

Learn how to build and maintain OAuth apps.

Using OAuth apps
Installing an OAuth app in your personal account

Installing an OAuth app in your organization

Authorizing OAuth apps

Reviewing your authorized OAuth apps

Connecting with third-party applications

Privileged OAuth apps

Building OAuth apps
Differences between GitHub Apps and OAuth apps

Rate limits for OAuth apps

Creating an OAuth app

Authenticating to the REST API with an OAuth app

Authorizing OAuth apps

Scopes for OAuth apps

Creating a custom badge for your OAuth app

Best practices for creating an OAuth app

Maintaining OAuth apps
Modifying an OAuth app

Activating optional features for OAuth apps

Transferring ownership of an OAuth app

Troubleshooting authorization request errors

Troubleshooting OAuth app access token request errors

Deleting an OAuth app

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Oauth/GitHubCopilot/set-up-copilot-sdk.txt</code></summary>

````text
Set up Copilot SDK - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

GitHub Copilot/

How-tos/

Copilot SDK/

Set up Copilot SDK

Home

GitHub Copilot

Get started
Quickstart

What is GitHub Copilot?

Plans

Features

Best practices

Choose enterprise plan

Achieve company goals

Resources for approval

Concepts
Completions
Code suggestions

Code referencing

Chat

Agents
Cloud agent
About cloud agent

Agent management

Custom agents

Hooks

Access management

MCP and cloud agent

Risks and mitigations

Copilot CLI
About Copilot CLI

Comparing CLI features

Cancel and roll back

About remote access

Custom agents

About CLI plugins

Autonomous task completion

Parallel task execution

Researching with Copilot

Session data

LSP servers

Context management

Code review

Copilot Memory

Third-party agents

OpenAI Codex

Anthropic Claude

Agent skills

Enterprise management

Spark

Copilot usage metrics
All articles

Copilot usage metrics

Prompting
Prompt engineering

Response customization

Context
MCP

Spaces

Repository indexing

Content exclusion

Tools
AI tools

About Copilot integrations

Auto model selection

Usage limits

Billing
Copilot requests

Individual plans

Billing for individuals

Organizations and enterprises

Premium request management

Copilot-only enterprises

Policies

MCP management

FedRAMP models

Network settings

Base and LTS models

New features and models

How-tos
Copilot on GitHub
Set up Copilot
Enable Copilot
Set up for self

Set up for organization

Set up for enterprise

Set up a dedicated enterprise

Set up for students

Set up for teachers and OS maintainers

Configure access to AI models

Configure automatic review

Configure runners

Chat with Copilot
Get started with chat

Chat in GitHub

Chat in Mobile

Customize Copilot
Customize Copilot overview

Add custom instructions
Add personal instructions

Add repository instructions

Add organization instructions

Customize cloud agent
Create custom agents

Add agent skills

Extend cloud agent with MCP

Use hooks

Customize the agent environment

Customize the agent firewall

Test custom agents

Spaces
Create Copilot Spaces

Collaborate with others

Copilot for GitHub tasks
Use Copilot to create or update issues

Create a PR summary

Use the GitHub MCP Server from Copilot Chat

Use Copilot agents
Get started

Kick off a task

Research, plan, iterate

Manage and track agents

Copilot code review

Review Copilot output

Set up
Set up for self

Install Copilot extension

Get code suggestions
Get IDE code suggestions

Find matching code

Chat with Copilot
Get started with Chat in your IDE

Chat in IDE

Chat in Windows Terminal

Copilot CLI
All articles

Copilot CLI quickstart

Copilot CLI best practices

Set up Copilot CLI
Install Copilot CLI

Authenticate Copilot CLI

Configure Copilot CLI

Add LSP servers

Troubleshoot Copilot CLI auth

Allowing tools

Steer a session remotely

Automate with Copilot CLI
Quickstart

Run the CLI programmatically

Automate with Actions

Customize Copilot CLI
Overview

Add custom instructions

Use hooks

Add agent skills

Add MCP servers

Create custom agents

Use your own model provider

Plugins: Find and install

Plugins: Create a plugin

Plugins: Create a marketplace

Connect to VS Code

Use Copilot CLI agents
Overview

Delegate tasks to Copilot

Invoke custom agents

Steer agents

Agentic code review

Administer for enterprise

Speed up task completion

Manage pull requests

Roll back changes

Use session data

Copilot SDK
Quickstart

Set up Copilot SDK
Choosing a setup path

Azure Managed Identity

Backend services

Bundled CLI

GitHub OAuth

Local CLI

Scaling

Authentication
Authenticate Copilot SDK

Bring your own key (BYOK)

Use Copilot SDK
Working with hooks

Custom agents

Image input

MCP servers

Session persistence

Custom skills

Steering and queueing

Streaming events

Use hooks
Quickstart

Pre-tool use

Post-tool use

User prompt submitted

Session lifecycle

Error handling

Observability
OpenTelemetry

Integrations
Microsoft Agent Framework

Troubleshooting
SDK and CLI compatibility

Debug Copilot SDK

Debug MCP servers

Use Copilot agents
Cloud agent
Create a PR

Track Copilot sessions

Integrate cloud agent with Jira

Integrate cloud agent with Slack

Integrate cloud agent with Teams

Integrate cloud agent with Linear

Integrate cloud agent with Azure Boards

Changing the AI model

Configuring agent settings

Create custom agents in your IDE

Troubleshoot cloud agent

Request a code review
Use code review

Copilot Memory

Use AI models
Change the chat model

Change the completion model

Provide context
Use Copilot Spaces
Use Copilot Spaces

Use MCP in your IDE
Extend Copilot Chat with MCP

Set up the GitHub MCP Server

Enterprise configuration

Configure toolsets

Use the GitHub MCP Server

Change MCP registry

Configure custom instructions
Add repository instructions in your IDE

Configure content exclusion
Exclude content from Copilot

Review changes

Use Copilot for common tasks
Use Copilot in the CLI

Configure personal settings
Configure network settings

Configure in IDE

Authenticate to GHE.com

Manage and track spending
Monitor premium requests

Manage request allowances

Manage company spending

Manage your account
Get started with a Copilot plan

View and change your Copilot plan

Disable Copilot Free

Manage policies

Administer Copilot
Manage for organization
Manage plan
Cancel

Manage access
Grant access

Manage requests for access

Revoke access

Manage network access

Manage policies

Add Copilot cloud agent

Configure agent runners

Prepare for custom agents

Review activity
Review user activity data

Use your own API keys

Manage for enterprise
Manage plan
Subscribe

Cancel plan

Upgrade plan

Downgrade subscription

Manage access
Grant access

Disable for organizations

View license usage

Manage network access

Manage enterprise policies

Manage agents
Prepare for custom agents

Monitor agentic activity

Enable Copilot cloud agent

Block Copilot cloud agent

Manage Copilot code review

Manage Spark

Use your own API keys

Review audit logs

Manage MCP usage
Configure MCP registry

Configure MCP server access

Download activity report

View usage and adoption

View code generation

Troubleshoot Copilot
Troubleshoot common issues

View logs

Troubleshoot firewall settings

Troubleshoot network errors

Troubleshoot Spark

Reference
Chat cheat sheet

Customization cheat sheet

AI models
Supported models

Model comparison

Model hosting

Copilot feature matrix

Keyboard shortcuts

Copilot CLI reference
CLI command reference

CLI plugin reference

CLI programmatic reference

ACP server

CLI configuration directory

Custom agents configuration

Custom instructions support

Hooks configuration

Policy conflicts

Copilot allowlist reference

MCP allowlist enforcement

Metrics data

Copilot billing
Billing cycle

Seat assignment

License changes

Azure billing

Agentic audit log events

Agent session filters

Review excluded files

Copilot usage metrics
Copilot usage metrics data

Interpret usage metrics

Reconciling Copilot usage metrics

Copilot LoC metrics

Example schema

Tutorials
All tutorials

GitHub Copilot Chat Cookbook
All prompts

Communicate effectively
Create templates

Extract information

Synthesize research

Create diagrams

Generate tables

Debug errors
Debug invalid JSON

Handle API rate limits

Diagnose test failures

Analyze functionality
Explore implementations

Analyze feedback

Refactor code
Improve code readability

Fix lint errors

Refactor for optimization

Refactor for sustainability

Refactor design patterns

Refactor data access layers

Decouple business logic

Handle cross-cutting

Simplify inheritance hierarchies

Fix database deadlocks

Translate code

Document code
Create issues

Document legacy code

Explain legacy code

Explain complex logic

Sync documentation

Write discussions or blog posts

Testing code
Generate unit tests

Create mock objects

Create end-to-end tests

Update unit tests

Analyze security
Secure your repository

Manage dependency updates

Find vulnerabilities

Customization library
All customizations

Custom instructions
Your first custom instructions

Concept explainer

Debugging tutor

Code reviewer

GitHub Actions helper

Pull request assistant

Issue manager

Accessibility auditor

Testing automation

Prompt files
Your first prompt file

Create README

Onboarding plan

Document API

Review code

Generate unit tests

Custom agents
Your first custom agent

Implementation planner

Bug fix teammate

Cleanup specialist

Cloud agent
Get the best results

Pilot cloud agent

Improve a project

Build guardrails

Give access to resources

Spark
Your first spark

Prompt tips

Build and deploy apps

Deploy from CLI

Customize code review

Enhance agent mode with MCP

Compare AI models

Speed up development work

Roll out at scale
Assign licenses
Set up self-serve licenses

Track usage and adoption

Remind inactive users

Establish AI managers

Enable developers
Drive adoption

Integrate AI agents

Drive downstream impact
Increase test coverage

Accelerate pull requests

Reduce security debt

Measure trial success

Maintain codebase standards

Explore a codebase

Explore issues and discussions

Explore pull requests

Write tests

Refactor code

Optimize code reviews

Reduce technical debt

Review AI code

Learn a new language

Modernize legacy code

Modernize Java applications

Migrate a project

Plan a project

Vibe coding

Upgrade projects

Use hooks with Copilot CLI

Responsible use
Copilot inline suggestions

Chat in your IDE

Chat in GitHub

Chat in GitHub Mobile

Copilot CLI

Copilot in Windows Terminal

Copilot in GitHub Desktop

Pull request summaries

Commit message generation

Code review

Copilot cloud agent

Spark

Copilot Spaces

GitHub Copilot/

How-tos/

Copilot SDK/

Set up Copilot SDK

Set up Copilot SDK

Learn how to configure and deploy GitHub Copilot SDK for different environments.

Choosing a setup path for Copilot SDK

Find the right setup guide that matches how you plan to use Copilot SDK.

Using Azure Managed Identity with Copilot SDK

Use Azure Managed Identity (Entra ID) to authenticate GitHub Copilot SDK with Azure AI Foundry models instead of static API keys.

Setting up Copilot SDK for backend services

Run GitHub Copilot SDK in server-side applications such as APIs, web backends, microservices, and background workers.

Using a bundled CLI with Copilot SDK

Package Copilot CLI alongside your application so that users do not need to install or configure anything separately.

Using GitHub OAuth with Copilot SDK

Let users authenticate with their GitHub accounts to use GitHub Copilot through your application.

Using a local CLI with Copilot SDK

Use GitHub Copilot SDK with the CLI already signed in on your machine—the simplest configuration, with no auth code or infrastructure required.

Scaling Copilot SDK deployments

Design your GitHub Copilot SDK deployment to serve multiple users, handle concurrent sessions, and scale horizontally across infrastructure.

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>
