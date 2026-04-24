# OAUTH-OpenAICodex.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## code-proxy OAuth-Konfiguration

Provider: `codex`

```text
Client ID: app_EMoamEEZ73f0CkXaXp7hrann
Auth URL:  https://auth.openai.com/oauth/authorize
Token URL: https://auth.openai.com/oauth/token
Scopes:    openid email profile offline_access
Redirect:  http://localhost:1455/auth/callback
Content:   application/x-www-form-urlencoded
PKCE:      true
```

Extra Authorization Parameters:

```text
codex_cli_simplified_flow=true
id_token_add_organizations=true
originator=codex_cli_rs
prompt=login
```

## Token Exchange

```http
POST https://auth.openai.com/oauth/token
Content-Type: application/x-www-form-urlencoded
Accept: application/json

grant_type=authorization_code&
code=<code>&
client_id=app_EMoamEEZ73f0CkXaXp7hrann&
redirect_uri=http://localhost:1455/auth/callback&
code_verifier=<pkce_verifier>
```

Refresh:

```http
POST https://auth.openai.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=<refresh_token>&client_id=app_EMoamEEZ73f0CkXaXp7hrann
```

## hermes-agent

Provider-ID: `openai-codex`  
Auth type: `oauth_external`  
Inference Base: `https://chatgpt.com/backend-api/codex`  
Token URL: `https://auth.openai.com/oauth/token`  
Client ID: `app_EMoamEEZ73f0CkXaXp7hrann`

`codex_models.py` ruft Modelle ab ueber:

```http
GET https://chatgpt.com/backend-api/codex/models?client_version=1.0.0
Authorization: Bearer <access_token>
```

Gefiltert werden Modelle mit `supported_in_api == false` oder Visibility `hide|hidden`. Sortiert wird nach `priority`.

## Default Codex Modelle in hermes-agent

- `gpt-5.4-mini`
- `gpt-5.4`
- `gpt-5.3-codex`
- `gpt-5.2-codex`
- `gpt-5.1-codex-max`
- `gpt-5.1-codex-mini`

Hermes ergaenzt Forward-Compat-Slugs wie `gpt-5.3-codex-spark`, `gpt-5.4` und `gpt-5.4-mini`, wenn passende Template-Modelle sichtbar sind.

## Code Proxy CLI-Modus

`codex.go` startet:

```bash
codex exec --model <mapped_model> --full-auto -
```

Der Prompt wird via stdin uebergeben. Falls das Modell fuer den ChatGPT-Account nicht unterstuetzt wird, erkennt code-proxy stderr-Text mit `model is not supported` und `ChatGPT account` und versucht einen zweiten Lauf ohne `--model`.

## Modellmapping code-proxy

```text
5.4-xhigh      -> gpt-5.4-codex-xhigh
5.4            -> gpt-5.4-codex
5.2-codex      -> gpt-5.2-codex
5.2-base       -> gpt-5.2
5.1-mini-high  -> gpt-5.1-codex-mini-high
```

## Implementierungsnotiz

Codex-OAuth ist technisch sichtbar, aber ein eigener Drittclient sollte unbedingt gegen aktuelle OpenAI/Codex-Dokumentation und Nutzungsbedingungen geprueft werden. Fuer ForgeFrame empfiehlt sich ein eigener Adaptertyp `premium_oauth_openai_codex`, getrennt von normalem OpenAI API-Key-Betrieb.

---

## Offizielle Dokumentationsanreicherung: `Oauth/OpenAICodex`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – OpenAICodex

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### Authentication – Codex | OpenAI Developers
- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/codex/auth
- Bereinigte Download-URL: https://developers.openai.com/codex/auth
- Lokale Datei(en): HTML: `auth.html`, Text: `auth.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI Codex authentication
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`

### Maintain Codex account auth in CI/CD (advanced) | OpenAI Developers
- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/codex/auth/ci-cd-auth
- Bereinigte Download-URL: https://developers.openai.com/codex/auth/ci-cd-auth
- Lokale Datei(en): HTML: `ci-cd-auth.html`, Text: `ci-cd-auth.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI Codex CI/CD auth
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`

### App Server – Codex | OpenAI Developers
- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/codex/app-server
- Bereinigte Download-URL: https://developers.openai.com/codex/app-server
- Lokale Datei(en): HTML: `app-server.html`, Text: `app-server.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI Codex app server
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`

### OpenAI Developers
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/
- Bereinigte Download-URL: https://developers.openai.com/
- Lokale Datei(en): HTML: `document.html`, Text: `document.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/codex/auth
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### OpenAI API Platform Documentation
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api
- Bereinigte Download-URL: https://developers.openai.com/api
- Effektive End-URL: https://developers.openai.com/api/docs
- Lokale Datei(en): HTML: `api.html`, Text: `api.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/codex/auth
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### OpenAI API Platform Documentation
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api/docs
- Bereinigte Download-URL: https://developers.openai.com/api/docs
- Lokale Datei(en): HTML: `docs.html`, Text: `docs.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/codex/auth/ci-cd-auth
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### API Overview | OpenAI API Reference
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api/reference/overview
- Bereinigte Download-URL: https://developers.openai.com/api/reference/overview
- Lokale Datei(en): HTML: `overview.html`, Text: `overview.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/codex/auth/ci-cd-auth
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Codex | OpenAI Developers
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/codex
- Bereinigte Download-URL: https://developers.openai.com/codex
- Lokale Datei(en): HTML: `codex.html`, Text: `codex.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/codex/app-server
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### Codex use cases
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/codex/use-cases
- Bereinigte Download-URL: https://developers.openai.com/codex/use-cases
- Lokale Datei(en): HTML: `use-cases.html`, Text: `use-cases.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/codex/app-server
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html`
- Hinweise: zusätzlich gefunden

### Erkannte URLs und Basisadressen

- `https://developers.openai.com/codex/auth`
- `https://developers.openai.com/codex/auth/ci-cd-auth`
- `https://developers.openai.com/codex/app-server`
- `https://developers.openai.com/`
- `https://developers.openai.com/api`
- `https://developers.openai.com/api/docs`
- `https://developers.openai.com/api/reference/overview`
- `https://developers.openai.com/codex`
- `https://developers.openai.com/codex/use-cases`
- `https://api.openai.com/v1/responses`
- `https://.../design.png`
- `https://example.com/mcp`
- `https://example.com/demo-app.png`
- `https://chatgpt.com/apps/demo-app/demo-app`
- `https://chatgpt.com/...&redirect_uri=http%3A%2F%2Flocalhost%3A<port`
- `https://auth.openai.com/codex/device`
- `https://api.openai.com/v1/models`
- `https://api.openai.com/v1/chat/completions`

### Erkannte Endpunkte / Pfade

- `https://api.openai.com/v1/responses`
- `/absolute/path`
- `/list`
- `/oauth/login`
- `/oauthLogin/completed`
- `/read`
- `/resume`
- `/unarchive`
- `/rollback`
- `/start`
- `/fork`
- `/tokenUsage/updated`
- `/chatgptAuthTokens/refresh`
- `/.codex/auth.json`
- `https://api.openai.com/v1/models`
- `/completions`
- `https://api.openai.com/v1/chat/completions`

### Erkannte Umgebungsvariablen / Konstanten

- `AGENTS`
- `OPENAI_API_KEY`
- `JSONL`
- `PORT`
- `SKILL`
- `HEAD`
- `GITHUB_TOKEN`
- `AGENTS_MD`
- `CLAUDE`
- `SKILLS`
- `CONFIG`
- `PLUGINS`
- `MCP_SERVER_CONFIG`
- `ABCD`
- `RBAC`
- `CODEX_HOME`
- `CODEX_CA_CERTIFICATE`
- `SSL_CERT_FILE`
- `HTTPS`
- `MY_CONTAINER`
- `CONTAINER_HOME`
- `HOME`
- `ENV_VARIABLE_NAME`
- `AUTH_FILE`
- `CODEX_AUTH_JSON`
- `REST`
- `ORGANIZATION_ID`
- `PROJECT_ID`
- `UUID`
- `ASCII`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

# Index – OpenAICodex

---

**Quelle `INDEX.md`**

### Authentication – Codex | OpenAI Developers
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/codex/auth
- Bereinigte Download-URL: https://developers.openai.com/codex/auth

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/codex/auth
- Bereinigte Download-URL: https://developers.openai.com/codex/auth
- Lokale Datei(en): HTML: `auth.html`, Text: `auth.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI Codex authentication
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Maintain Codex account auth in CI/CD (advanced) | OpenAI Developers
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/codex/auth/ci-cd-auth
- Bereinigte Download-URL: https://developers.openai.com/codex/auth/ci-cd-auth

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/codex/auth/ci-cd-auth
- Bereinigte Download-URL: https://developers.openai.com/codex/auth/ci-cd-auth
- Lokale Datei(en): HTML: `ci-cd-auth.html`, Text: `ci-cd-auth.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI Codex CI/CD auth
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### App Server – Codex | OpenAI Developers
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/codex/app-server
- Bereinigte Download-URL: https://developers.openai.com/codex/app-server

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/codex/app-server
- Bereinigte Download-URL: https://developers.openai.com/codex/app-server
- Lokale Datei(en): HTML: `app-server.html`, Text: `app-server.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI Codex app server
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### OpenAI Developers
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/
- Bereinigte Download-URL: https://developers.openai.com/

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/
- Bereinigte Download-URL: https://developers.openai.com/
- Lokale Datei(en): HTML: `document.html`, Text: `document.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/codex/auth
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### OpenAI API Platform Documentation
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api
- Bereinigte Download-URL: https://developers.openai.com/api

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/api
- Bereinigte Download-URL: https://developers.openai.com/api
- Effektive End-URL: https://developers.openai.com/api/docs

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://developers.openai.com/api
- Effektive End-URL: https://developers.openai.com/api/docs
- Lokale Datei(en): HTML: `api.html`, Text: `api.txt`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api/docs
- Bereinigte Download-URL: https://developers.openai.com/api/docs

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/api/docs
- Bereinigte Download-URL: https://developers.openai.com/api/docs
- Lokale Datei(en): HTML: `docs.html`, Text: `docs.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/codex/auth/ci-cd-auth
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### API Overview | OpenAI API Reference
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api/reference/overview
- Bereinigte Download-URL: https://developers.openai.com/api/reference/overview

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/api/reference/overview
- Bereinigte Download-URL: https://developers.openai.com/api/reference/overview
- Lokale Datei(en): HTML: `overview.html`, Text: `overview.txt`

---

**Quelle `INDEX.md`**

### Codex | OpenAI Developers
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/codex
- Bereinigte Download-URL: https://developers.openai.com/codex

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/codex
- Bereinigte Download-URL: https://developers.openai.com/codex
- Lokale Datei(en): HTML: `codex.html`, Text: `codex.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/codex/app-server
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/codex/use-cases
- Bereinigte Download-URL: https://developers.openai.com/codex/use-cases

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/codex/use-cases
- Bereinigte Download-URL: https://developers.openai.com/codex/use-cases
- Lokale Datei(en): HTML: `use-cases.html`, Text: `use-cases.txt`

---

**Quelle `api.txt`**

OpenAI API Platform Documentation

---

**Quelle `api.txt`**

Guides and concepts for the OpenAI API

---

**Quelle `api.txt`**

Endpoints, parameters, and responses

---

**Quelle `api.txt`**

Apps SDK

---

**Quelle `api.txt`**

Notebook examples for building with OpenAI models

---

**Quelle `api.txt`**

Docs, videos, and demo apps for building with OpenAI

---

**Quelle `api.txt`**

responses createreasoning_effortrealtimeprompt caching

---

**Quelle `api.txt`**

Models

---

**Quelle `api.txt`**

Images and vision

---

**Quelle `api.txt`**

Function calling

---

**Quelle `api.txt`**

Responses API

---

**Quelle `api.txt`**

Using tools

---

**Quelle `api.txt`**

Agents SDK

---

**Quelle `api.txt`**

Models and providers

---

**Quelle `api.txt`**

Tools

---

**Quelle `api.txt`**

Tool search

---

**Quelle `api.txt`**

More tools 
 Apply Patch

---

**Quelle `api.txt`**

Streaming

---

**Quelle `api.txt`**

Counting tokens

---

**Quelle `api.txt`**

Reasoning 
 Reasoning models

---

**Quelle `api.txt`**

External models

---

**Quelle `api.txt`**

Usage 
 Using realtime models

---

**Quelle `api.txt`**

Vision fine-tuning

---

**Quelle `api.txt`**

Specialized models

---

**Quelle `api.txt`**

Embeddings

---

**Quelle `api.txt`**

Rate limits

---

**Quelle `api.txt`**

Authentication

---

**Quelle `api.txt`**

Codex SDK

---

**Quelle `api.txt`**

Apps SDK Commerce

---

**Quelle `api.txt`**

Define tools

---

**Quelle `api.txt`**

Authenticate users

---

**Quelle `api.txt`**

From prompts to products: One year of Responses

---

**Quelle `api.txt`**

Make your first API request in minutes. Learn the basics of the OpenAI platform.

---

**Quelle `api.txt`**

Get startedCreate API key

---

**Quelle `api.txt`**

7
curl https://api.openai.com/v1/responses \
 -H "Content-Type: application/json" \

---

**Quelle `api.txt`**

curl https://api.openai.com/v1/responses \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \

---

**Quelle `api.txt`**

-H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{

---

**Quelle `api.txt`**

9
import OpenAI from "openai";
const client = new OpenAI();

---

**Quelle `api.txt`**

import OpenAI from "openai";
const client = new OpenAI();

---

**Quelle `api.txt`**

const response = await client.responses.create({
 model: "gpt-5.4",

---

**Quelle `app-server.txt`**

App Server – Codex | OpenAI Developers

---

**Quelle `app-server.txt`**

Guides and concepts for the OpenAI API

---

**Quelle `app-server.txt`**

Endpoints, parameters, and responses

---

**Quelle `app-server.txt`**

Apps SDK

---

**Quelle `app-server.txt`**

Notebook examples for building with OpenAI models

---

**Quelle `app-server.txt`**

Docs, videos, and demo apps for building with OpenAI

---

**Quelle `app-server.txt`**

responses createreasoning_effortrealtimeprompt caching

---

**Quelle `app-server.txt`**

Models

---

**Quelle `app-server.txt`**

Images and vision

---

**Quelle `app-server.txt`**

Function calling

---

**Quelle `app-server.txt`**

Responses API

---

**Quelle `app-server.txt`**

Using tools

---

**Quelle `app-server.txt`**

Agents SDK

---

**Quelle `app-server.txt`**

Models and providers

---

**Quelle `app-server.txt`**

Tools

---

**Quelle `app-server.txt`**

Tool search

---

**Quelle `app-server.txt`**

More tools 
 Apply Patch

---

**Quelle `app-server.txt`**

Streaming

---

**Quelle `app-server.txt`**

Counting tokens

---

**Quelle `app-server.txt`**

Reasoning 
 Reasoning models

---

**Quelle `app-server.txt`**

External models

---

**Quelle `app-server.txt`**

Usage 
 Using realtime models

---

**Quelle `app-server.txt`**

Vision fine-tuning

---

**Quelle `app-server.txt`**

Specialized models

---

**Quelle `app-server.txt`**

Embeddings

---

**Quelle `app-server.txt`**

Rate limits

---

**Quelle `app-server.txt`**

Authentication

---

**Quelle `app-server.txt`**

Codex SDK

---

**Quelle `app-server.txt`**

Apps SDK Commerce

---

**Quelle `app-server.txt`**

Define tools

---

**Quelle `app-server.txt`**

Authenticate users

---

**Quelle `app-server.txt`**

From prompts to products: One year of Responses

---

**Quelle `app-server.txt`**

Codex app-server is the interface Codex uses to power rich clients (for example, the Codex VS Code extension). Use it when you want a deep integration inside your own product: authentication, conversation history, approvals, and streamed agent events. The app-server implementation is open source in the Codex GitHub repository (openai/codex/codex-rs/app-server). See the Open Source page for the full list of open-source Codex components.

---

**Quelle `app-server.txt`**

If you are automating jobs or running Codex in CI, use the
Codex SDK instead.

---

**Quelle `app-server.txt`**

Like MCP, codex app-server supports bidirectional communication using JSON-RPC 2.0 messages (with the "jsonrpc":"2.0" header omitted on the wire).

---

**Quelle `app-server.txt`**

GET /healthz returns 200 OK when the request doesn’t include an Origin header.

---

**Quelle `app-server.txt`**

Requests with an Origin header are rejected with 403 Forbidden.

---

**Quelle `app-server.txt`**

WebSocket transport is experimental and unsupported. Loopback listeners such as ws://127.0.0.1:PORT are appropriate for localhost and SSH port-forwarding workflows. Non-loopback WebSocket listeners currently allow unauthenticated connections by default during rollout, so configure WebSocket auth before exposing one remotely.

---

**Quelle `app-server.txt`**

--ws-auth capability-token --ws-token-file /absolute/path

---

**Quelle `app-server.txt`**

--ws-auth capability-token --ws-token-sha256 HEX

---

**Quelle `auth.txt`**

Authentication – Codex | OpenAI Developers

---

**Quelle `auth.txt`**

Guides and concepts for the OpenAI API

---

**Quelle `auth.txt`**

Endpoints, parameters, and responses

---

**Quelle `auth.txt`**

Apps SDK

---

**Quelle `auth.txt`**

Notebook examples for building with OpenAI models

---

**Quelle `auth.txt`**

Docs, videos, and demo apps for building with OpenAI

---

**Quelle `auth.txt`**

responses createreasoning_effortrealtimeprompt caching

---

**Quelle `auth.txt`**

Models

---

**Quelle `auth.txt`**

Images and vision

---

**Quelle `auth.txt`**

Function calling

---

**Quelle `auth.txt`**

Responses API

---

**Quelle `auth.txt`**

Using tools

---

**Quelle `auth.txt`**

Agents SDK

---

**Quelle `auth.txt`**

Models and providers

---

**Quelle `auth.txt`**

Tools

---

**Quelle `auth.txt`**

Tool search

---

**Quelle `auth.txt`**

More tools 
 Apply Patch

---

**Quelle `auth.txt`**

Streaming

---

**Quelle `auth.txt`**

Counting tokens

---

**Quelle `auth.txt`**

Reasoning 
 Reasoning models

---

**Quelle `auth.txt`**

External models

---

**Quelle `auth.txt`**

Usage 
 Using realtime models

---

**Quelle `auth.txt`**

Vision fine-tuning

---

**Quelle `auth.txt`**

Specialized models

---

**Quelle `auth.txt`**

Embeddings

---

**Quelle `auth.txt`**

Rate limits

---

**Quelle `auth.txt`**

Authentication

---

**Quelle `auth.txt`**

Codex SDK

---

**Quelle `auth.txt`**

Apps SDK Commerce

---

**Quelle `auth.txt`**

Define tools

---

**Quelle `auth.txt`**

Authenticate users

---

**Quelle `auth.txt`**

From prompts to products: One year of Responses

---

**Quelle `auth.txt`**

OpenAI authentication

---

**Quelle `auth.txt`**

Codex supports two ways to sign in when using OpenAI models:

---

**Quelle `auth.txt`**

Sign in with an API key for usage-based access

---

**Quelle `auth.txt`**

With sign in with ChatGPT, Codex usage follows your ChatGPT workspace permissions, RBAC, and ChatGPT Enterprise retention and residency settings

---

**Quelle `auth.txt`**

With an API key, usage follows your API organization’s retention and data-sharing settings instead

---

**Quelle `auth.txt`**

For the CLI, Sign in with ChatGPT is the default authentication path when no valid session is available.

---

**Quelle `auth.txt`**

When you sign in with ChatGPT from the Codex app, CLI, or IDE Extension, Codex opens a browser window for you to complete the login flow. After you sign in, the browser returns an access token to the CLI or IDE extension.

---

**Quelle `auth.txt`**

Sign in with an API key

---

**Quelle `ci-cd-auth.txt`**

Maintain Codex account auth in CI/CD (advanced) | OpenAI Developers

---

**Quelle `ci-cd-auth.txt`**

Guides and concepts for the OpenAI API

---

**Quelle `ci-cd-auth.txt`**

Endpoints, parameters, and responses

---

**Quelle `ci-cd-auth.txt`**

Apps SDK

---

**Quelle `ci-cd-auth.txt`**

Notebook examples for building with OpenAI models

---

**Quelle `ci-cd-auth.txt`**

Docs, videos, and demo apps for building with OpenAI

---

**Quelle `ci-cd-auth.txt`**

responses createreasoning_effortrealtimeprompt caching

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `api.txt`**

````text
curl https://api.openai.com/v1/responses \
````

---

**Quelle `app-server.txt`**

````text
codex app-server generate-ts --out ./schemas
````

---

**Quelle `app-server.txt`**

````text
codex app-server generate-json-schema --out ./schemas
````

---

**Quelle `auth.txt`**

````text
export CODEX_CA_CERTIFICATE=/path/to/corporate-root-ca.pem
````

---

**Quelle `auth.txt`**

````text
codex login
````

---

**Quelle `ci-cd-auth.txt`**

````text
codex login cannot run on the remote runner
````

---

**Quelle `ci-cd-auth.txt`**

````text
codex login
````

---

**Quelle `ci-cd-auth.txt`**

````text
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
````

---

**Quelle `ci-cd-auth.txt`**

````text
codex exec --json "Reply with the single word OK." >/dev/null
````

---

**Quelle `ci-cd-auth.txt`**

````text
codex exec step
````

---

**Quelle `ci-cd-auth.txt`**

````text
codex exec --json "summarize the failing tests"
````

---

**Quelle `docs.txt`**

````text
curl https://api.openai.com/v1/responses \
````

---

**Quelle `overview.txt`**

````text
curl https://api.openai.com/v1/models \
````

---

**Quelle `overview.txt`**

````text
curl https://api.openai.com/v1/chat/completions \
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>Oauth/OpenAICodex/api.txt</code></summary>

````text
OpenAI API Platform Documentation

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the API docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

Get started
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

Core concepts
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

Agents SDK
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

Tools
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

Run and scale
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

Evaluation
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

Realtime API
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

Model optimization
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

Specialized models
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

Going live
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

Legacy APIs
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

Resources
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

API Platform

Developer quickstart

Make your first API request in minutes. Learn the basics of the OpenAI platform.

Get startedCreate API key

javascript

1
2
3
4
5
6
7
curl https://api.openai.com/v1/responses \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5.4",
 "input": "Write a short bedtime story about a unicorn."
 }'

1
2
3
4
5
6
7
8
9
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
 model: "gpt-5.4",
 input: "Write a short bedtime story about a unicorn.",
});

console.log(response.output_text);

1
2
3
4
5
6
7
8
9
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
 model="gpt-5.4",
 input="Write a short bedtime story about a unicorn."
)

print(response.output_text)

1
2
3
4
5
6
7
8
9
10
using OpenAI.Responses;

string apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
var client = new OpenAIResponseClient(model: "gpt-5.4", apiKey: apiKey);

OpenAIResponse response = client.CreateResponse(
 "Write a short bedtime story about a unicorn."
);

Console.WriteLine(response.GetOutputText());

Build paths

Responses API

Make direct model requests for text, structured output, tools, and multimodal workflows.

Start with Responses

Agents SDK

Build code-first agents that orchestrate tools, handoffs, approvals, tracing, and container-based execution.

Start with the Agents SDK

Models

Start with gpt-5.4 for complex reasoning and coding, or choose gpt-5.4-mini and gpt-5.4-nano for lower-latency, lower-cost workloads.

View all

GPT-5.4

Best intelligence at scale for agentic, coding, and professional workflows

GPT-5.4 mini

Our strongest mini model yet for coding, computer use, and subagents

GPT-5.4 nano

Our cheapest GPT-5.4-class model for simple high-volume tasks

Start building

Read and generate text

Use the API to prompt a model and generate text

Use a model's vision capabilities

Allow models to see and analyze images in your application

Generate images as output

Create images with GPT Image 2

Build apps with audio

Analyze, transcribe, and generate audio with API endpoints

Build agentic applications

Use the API to build agents that use tools and computers

Achieve complex tasks with reasoning

Use reasoning models to carry out complex tasks

Get structured data from models

Use Structured Outputs to get model responses that adhere to a JSON schema

Tailor to your use case

Adjust our models to perform specifically for your use case with fine-tuning, evals, and distillation

Help center

Frequently asked account and billing questions

Developer forum

Discuss topics with other developers

Cookbook

Open-source collection of examples and guides

Status

Check the status of OpenAI services
````

</details>


<details>
<summary>Textanlage: <code>Oauth/OpenAICodex/app-server.txt</code></summary>

````text
App Server – Codex | OpenAI Developers

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the Codex docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

Getting Started
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

Using Codex
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

Configuration
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

Administration
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

Automation
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

Learn
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

Releases
 
 Changelog 

 Feature Maturity 

 Open Source 

 Copy Page 

 Codex App Server 
 
Embed Codex into your product with the app-server protocol

 Copy Page 

Codex app-server is the interface Codex uses to power rich clients (for example, the Codex VS Code extension). Use it when you want a deep integration inside your own product: authentication, conversation history, approvals, and streamed agent events. The app-server implementation is open source in the Codex GitHub repository (openai/codex/codex-rs/app-server). See the Open Source page for the full list of open-source Codex components.

If you are automating jobs or running Codex in CI, use the
Codex SDK instead.

Protocol

Like MCP, codex app-server supports bidirectional communication using JSON-RPC 2.0 messages (with the "jsonrpc":"2.0" header omitted on the wire).

Supported transports:

stdio (--listen stdio://, default): newline-delimited JSON (JSONL).

websocket (--listen ws://IP:PORT, experimental and unsupported): one JSON-RPC message per WebSocket text frame.

off (--listen off): don’t expose a local transport.

When you run with --listen ws://IP:PORT, the same listener also serves basic HTTP health probes:

GET /readyz returns 200 OK once the listener accepts new connections.

GET /healthz returns 200 OK when the request doesn’t include an Origin header.

Requests with an Origin header are rejected with 403 Forbidden.

WebSocket transport is experimental and unsupported. Loopback listeners such as ws://127.0.0.1:PORT are appropriate for localhost and SSH port-forwarding workflows. Non-loopback WebSocket listeners currently allow unauthenticated connections by default during rollout, so configure WebSocket auth before exposing one remotely.

Supported WebSocket auth flags:

--ws-auth capability-token --ws-token-file /absolute/path

--ws-auth capability-token --ws-token-sha256 HEX

--ws-auth signed-bearer-token --ws-shared-secret-file /absolute/path

For signed bearer tokens, you can also set --ws-issuer, --ws-audience, and --ws-max-clock-skew-seconds. Clients present the credential as Authorization: Bearer <token> during the WebSocket handshake, and app-server enforces auth before JSON-RPC initialize.

Prefer --ws-token-file over passing raw bearer tokens on the command line. Use --ws-token-sha256 only when the client keeps the raw high-entropy token in a separate local secret store; the hash is only a verifier, and clients still need the original token.

In WebSocket mode, app-server uses bounded queues. When request ingress is full, the server rejects new requests with JSON-RPC error code -32001 and message "Server overloaded; retry later." Clients should retry with an exponentially increasing delay and jitter.

Message schema

Requests include method, params, and id:

{ "method": "thread/start", "id": 10, "params": { "model": "gpt-5.4" } }

Responses echo the id with either result or error:

{ "id": 10, "result": { "thread": { "id": "thr_123" } } }
{ "id": 10, "error": { "code": 123, "message": "Something went wrong" } }

Notifications omit id and use only method and params:

{ "method": "turn/started", "params": { "turn": { "id": "turn_456" } } }

You can generate a TypeScript schema or a JSON Schema bundle from the CLI. Each output is specific to the Codex version you ran, so the generated artifacts match that version exactly:

codex app-server generate-ts --out ./schemas
codex app-server generate-json-schema --out ./schemas

Getting started

Start the server with codex app-server (default stdio transport) or codex app-server --listen ws://127.0.0.1:4500 (experimental WebSocket transport).

Connect a client over the selected transport, then send initialize followed by the initialized notification.

Start a thread and a turn, then keep reading notifications from the active transport stream.

Example (Node.js / TypeScript):

import { spawn } from "node:child_process";
import readline from "node:readline";

const proc = spawn("codex", ["app-server"], {
 stdio: ["pipe", "pipe", "inherit"],
});
const rl = readline.createInterface({ input: proc.stdout });

const send = (message: unknown) => {
 proc.stdin.write(`${JSON.stringify(message)}\n`);
};

let threadId: string | null = null;

rl.on("line", (line) => {
 const msg = JSON.parse(line) as any;
 console.log("server:", msg);

 if (msg.id === 1 && msg.result?.thread?.id && !threadId) {
 threadId = msg.result.thread.id;
 send({
 method: "turn/start",
 id: 2,
 params: {
 threadId,
 input: [{ type: "text", text: "Summarize this repo." }],
 },
 });
 }
});

send({
 method: "initialize",
 id: 0,
 params: {
 clientInfo: {
 name: "my_product",
 title: "My Product",
 version: "0.1.0",
 },
 },
});
send({ method: "initialized", params: {} });
send({ method: "thread/start", id: 1, params: { model: "gpt-5.4" } });

Core primitives

Thread: A conversation between a user and the Codex agent. Threads contain turns.

Turn: A single user request and the agent work that follows. Turns contain items and stream incremental updates.

Item: A unit of input or output (user message, agent message, command runs, file change, tool call, and more).

Use the thread APIs to create, list, or archive conversations. Drive a conversation with turn APIs and stream progress via turn notifications.

Lifecycle overview

Initialize once per connection: Immediately after opening a transport connection, send an initialize request with your client metadata, then emit initialized. The server rejects any request on that connection before this handshake.

Start (or resume) a thread: Call thread/start for a new conversation, thread/resume to continue an existing one, or thread/fork to branch history into a new thread id.

Begin a turn: Call turn/start with the target threadId and user input. Optional fields override model, personality, cwd, sandbox policy, and more.

Steer an active turn: Call turn/steer to append user input to the currently in-flight turn without creating a new turn.

Stream events: After turn/start, keep reading notifications on stdout: thread/archived, thread/unarchived, item/started, item/completed, item/agentMessage/delta, tool progress, and other updates.

Finish the turn: The server emits turn/completed with final status when the model finishes or after a turn/interrupt cancellation.

Initialization

Clients must send a single initialize request per transport connection before invoking any other method on that connection, then acknowledge with an initialized notification. Requests sent before initialization receive a Not initialized error, and repeated initialize calls on the same connection return Already initialized.

The server returns the user agent string it will present to upstream services plus platformFamily and platformOs values that describe the runtime target. Set clientInfo to identify your integration.

initialize.params.capabilities also supports per-connection notification opt-out via optOutNotificationMethods, which is a list of exact method names to suppress for that connection. Matching is exact (no wildcards/prefixes). Unknown method names are accepted and ignored.

Important: Use clientInfo.name to identify your client for the OpenAI Compliance Logs Platform. If you are developing a new Codex integration intended for enterprise use, please contact OpenAI to get it added to a known clients list. For more context, see the Codex logs reference.

Example (from the Codex VS Code extension):

{
 "method": "initialize",
 "id": 0,
 "params": {
 "clientInfo": {
 "name": "codex_vscode",
 "title": "Codex VS Code Extension",
 "version": "0.1.0"
 }
 }
}

Example with notification opt-out:

{
 "method": "initialize",
 "id": 1,
 "params": {
 "clientInfo": {
 "name": "my_client",
 "title": "My Client",
 "version": "0.1.0"
 },
 "capabilities": {
 "experimentalApi": true,
 "optOutNotificationMethods": ["thread/started", "item/agentMessage/delta"]
 }
 }
}

Experimental API opt-in

Some app-server methods and fields are intentionally gated behind experimentalApi capability.

Omit capabilities (or set experimentalApi to false) to stay on the stable API surface, and the server rejects experimental methods/fields.

Set capabilities.experimentalApi to true to enable experimental methods and fields.

{
 "method": "initialize",
 "id": 1,
 "params": {
 "clientInfo": {
 "name": "my_client",
 "title": "My Client",
 "version": "0.1.0"
 },
 "capabilities": {
 "experimentalApi": true
 }
 }
}

If a client sends an experimental method or field without opting in, app-server rejects it with:

<descriptor> requires experimentalApi capability

API overview

thread/start - create a new thread; emits thread/started and automatically subscribes you to turn/item events for that thread.

thread/resume - reopen an existing thread by id so later turn/start calls append to it.

thread/fork - fork a thread into a new thread id by copying stored history; emits thread/started for the new thread.

thread/read - read a stored thread by id without resuming it; set includeTurns to return full turn history. Returned thread objects include runtime status.

thread/list - page through stored thread logs; supports cursor-based pagination plus modelProviders, sourceKinds, archived, cwd, and searchTerm filters. Returned thread objects include runtime status.

thread/turns/list - page through a stored thread’s turn history without resuming it.

thread/loaded/list - list the thread ids currently loaded in memory.

thread/name/set - set or update a thread’s user-facing name for a loaded thread or a persisted rollout; emits thread/name/updated.

thread/metadata/update - patch SQLite-backed stored thread metadata; currently supports persisted gitInfo.

thread/archive - move a thread’s log file into the archived directory; returns {} on success and emits thread/archived.

thread/unsubscribe - unsubscribe this connection from thread turn/item events. If this was the last subscriber, the server unloads the thread after a no-subscriber inactivity grace period and emits thread/closed.

thread/unarchive - restore an archived thread rollout back into the active sessions directory; returns the restored thread and emits thread/unarchived.

thread/status/changed - notification emitted when a loaded thread’s runtime status changes.

thread/compact/start - trigger conversation history compaction for a thread; returns {} immediately while progress streams via turn/* and item/* notifications.

thread/shellCommand - run a user-initiated shell command against a thread. This runs outside the sandbox with full access and doesn’t inherit the thread sandbox policy.

thread/backgroundTerminals/clean - stop all running background terminals for a thread (experimental; requires capabilities.experimentalApi).

thread/rollback - drop the last N turns from the in-memory context and persist a rollback marker; returns the updated thread.

turn/start - add user input to a thread and begin Codex generation; responds with the initial turn and streams events. For collaborationMode, settings.developer_instructions: null means “use built-in instructions for the selected mode.”

thread/inject_items - append raw Responses API items to a loaded thread’s model-visible history without starting a user turn.

turn/steer - append user input to the active in-flight turn for a thread; returns the accepted turnId.

turn/interrupt - request cancellation of an in-flight turn; success is {} and the turn ends with status: "interrupted".

review/start - kick off the Codex reviewer for a thread; emits enteredReviewMode and exitedReviewMode items.

command/exec - run a single command under the server sandbox without starting a thread/turn.

command/exec/write - write stdin bytes to a running command/exec session or close stdin.

command/exec/resize - resize a running PTY-backed command/exec session.

command/exec/terminate - stop a running command/exec session.

command/exec/outputDelta (notify) - emitted for base64-encoded stdout/stderr chunks from a streaming command/exec session.

model/list - list available models (set includeHidden: true to include entries with hidden: true) with effort options, optional upgrade, and inputModalities.

experimentalFeature/list - list feature flags with lifecycle stage metadata and cursor pagination.

experimentalFeature/enablement/set - patch in-memory runtime enablement for supported feature keys such as apps and plugins.

collaborationMode/list - list collaboration mode presets (experimental, no pagination).

skills/list - list skills for one or more cwd values (supports forceReload and optional perCwdExtraUserRoots).

skills/changed (notify) - emitted when watched local skill files change.

marketplace/add - add a remote plugin marketplace and persist it into the user’s marketplace config.

plugin/list - list discovered plugin marketplaces and plugin state, including install/auth policy metadata, marketplace load errors, featured plugin ids, and local, Git, or remote plugin source metadata.

plugin/read - read one plugin by marketplace path or remote marketplace name and plugin name, including bundled skills, apps, and MCP server names when those details are available.

plugin/install - install a plugin from a marketplace path or remote marketplace name.

plugin/uninstall - uninstall an installed plugin.

app/list - list available apps (connectors) with pagination plus accessibility/enabled metadata.

skills/config/write - enable or disable skills by path.

mcpServer/oauth/login - start an OAuth login for a configured MCP server; returns an authorization URL and emits mcpServer/oauthLogin/completed on completion.

tool/requestUserInput - prompt the user with 1-3 short questions for a tool call (experimental); questions can set isOther for a free-form option.

config/mcpServer/reload - reload MCP server configuration from disk and queue a refresh for loaded threads.

mcpServerStatus/list - list MCP servers, tools, resources, and auth status (cursor + limit pagination). Use detail: "full" for full data or detail: "toolsAndAuthOnly" to omit resources.

mcpServer/resource/read - read a single MCP resource through an initialized MCP server.

mcpServer/tool/call - call a tool on a thread’s configured MCP server.

mcpServer/startupStatus/updated (notify) - emitted when a configured MCP server’s startup status changes for a loaded thread.

windowsSandbox/setupStart - start Windows sandbox setup for elevated or unelevated mode; returns quickly and later emits windowsSandbox/setupCompleted.

feedback/upload - submit a feedback report (classification + optional reason/logs + conversation id, plus optional extraLogFiles attachments).

config/read - fetch the effective configuration on disk after resolving configuration layering.

externalAgentConfig/detect - detect external-agent artifacts that can be migrated with includeHome and optional cwds; each detected item includes cwd (null for home).

externalAgentConfig/import - apply selected external-agent migration items by passing explicit migrationItems with cwd (null for home); plugin imports emit externalAgentConfig/import/completed.

config/value/write - write a single configuration key/value to the user’s config.toml on disk.

config/batchWrite - apply configuration edits atomically to the user’s config.toml on disk.

configRequirements/read - fetch requirements from requirements.toml and/or MDM, including allow-lists, pinned featureRequirements, and residency/network requirements (or null if you haven’t set any up).

fs/readFile, fs/writeFile, fs/createDirectory, fs/getMetadata, fs/readDirectory, fs/remove, fs/copy, fs/watch, fs/unwatch, and fs/changed (notify) - operate on absolute filesystem paths through the app-server v2 filesystem API.

Plugin summaries include a source union. Local plugins return
{ "type": "local", "path": ... }, Git-backed marketplace entries return
{ "type": "git", "url": ..., "path": ..., "refName": ..., "sha": ... },
and remote catalog entries return { "type": "remote" }. For remote-only
catalog entries, PluginMarketplaceEntry.path can be null; pass
remoteMarketplaceName instead of marketplacePath when reading or installing
those plugins.

Models

List models (model/list)

Call model/list to discover available models and their capabilities before rendering model or personality selectors.

{ "method": "model/list", "id": 6, "params": { "limit": 20, "includeHidden": false } }
{ "id": 6, "result": {
 "data": [{
 "id": "gpt-5.4",
 "model": "gpt-5.4",
 "displayName": "GPT-5.4",
 "hidden": false,
 "defaultReasoningEffort": "medium",
 "supportedReasoningEfforts": [{
 "reasoningEffort": "low",
 "description": "Lower latency"
 }],
 "inputModalities": ["text", "image"],
 "supportsPersonality": true,
 "isDefault": true
 }],
 "nextCursor": null
} }

Each model entry can include:

supportedReasoningEfforts - supported effort options for the model.

defaultReasoningEffort - suggested default effort for clients.

upgrade - optional recommended upgrade model id for migration prompts in clients.

upgradeInfo - optional upgrade metadata for migration prompts in clients.

hidden - whether the model is hidden from the default picker list.

inputModalities - supported input types for the model (for example text, image).

supportsPersonality - whether the model supports personality-specific instructions such as /personality.

isDefault - whether the model is the recommended default.

By default, model/list returns picker-visible models only. Set includeHidden: true if you need the full list and want to filter on the client side using hidden.

When inputModalities is missing (older model catalogs), treat it as ["text", "image"] for backward compatibility.

List experimental features (experimentalFeature/list)

Use this endpoint to discover feature flags with metadata and lifecycle stage:

{ "method": "experimentalFeature/list", "id": 7, "params": { "limit": 20 } }
{ "id": 7, "result": {
 "data": [{
 "name": "unified_exec",
 "stage": "beta",
 "displayName": "Unified exec",
 "description": "Use the unified PTY-backed execution tool.",
 "announcement": "Beta rollout for improved command execution reliability.",
 "enabled": false,
 "defaultEnabled": false
 }],
 "nextCursor": null
} }

stage can be beta, underDevelopment, stable, deprecated, or removed. For non-beta flags, displayName, description, and announcement may be null.

Threads

thread/read reads a stored thread without subscribing to it; set includeTurns to include turns.

thread/turns/list pages through a stored thread’s turn history without resuming it.

thread/list supports cursor pagination plus modelProviders, sourceKinds, archived, cwd, and searchTerm filtering.

thread/loaded/list returns the thread IDs currently in memory.

thread/archive moves the thread’s persisted JSONL log into the archived directory.

thread/metadata/update patches stored thread metadata, currently including persisted gitInfo.

thread/unsubscribe unsubscribes the current connection from a loaded thread and can trigger thread/closed after an inactivity grace period.

thread/unarchive restores an archived thread rollout back into the active sessions directory.

thread/compact/start triggers compaction and returns {} immediately.

thread/rollback drops the last N turns from the in-memory context and records a rollback marker in the thread’s persisted JSONL log.

thread/inject_items appends raw Responses API items to a loaded thread’s model-visible history without starting a user turn.

Start or resume a thread

Start a fresh thread when you need a new Codex conversation.

{ "method": "thread/start", "id": 10, "params": {
 "model": "gpt-5.4",
 "cwd": "/Users/me/project",
 "approvalPolicy": "never",
 "sandbox": "workspaceWrite",
 "personality": "friendly",
 "serviceName": "my_app_server_client"
} }
{ "id": 10, "result": {
 "thread": {
 "id": "thr_123",
 "preview": "",
 "ephemeral": false,
 "modelProvider": "openai",
 "createdAt": 1730910000
 }
} }
{ "method": "thread/started", "params": { "thread": { "id": "thr_123" } } }

serviceName is optional. Set it when you want app-server to tag thread-level metrics with your integration’s service name.

To continue a stored session, call thread/resume with the thread.id you recorded earlier. The response shape matches thread/start. You can also pass the same configuration overrides supported by thread/start, such as personality:

{ "method": "thread/resume", "id": 11, "params": {
 "threadId": "thr_123",
 "personality": "friendly"
} }
{ "id": 11, "result": { "thread": { "id": "thr_123", "name": "Bug bash notes", "ephemeral": false } } }

Resuming a thread doesn’t update thread.updatedAt (or the rollout file’s modified time) by itself. The timestamp updates when you start a turn.

If you mark an enabled MCP server as required in config and that server fails to initialize, thread/start and thread/resume fail instead of continuing without it.

dynamicTools on thread/start is an experimental field (requires capabilities.experimentalApi = true). Codex persists these dynamic tools in the thread rollout metadata and restores them on thread/resume when you don’t supply new dynamic tools.

If you resume with a different model than the one recorded in the rollout, Codex emits a warning and applies a one-time model-switch instruction on the next turn.

To branch from a stored session, call thread/fork with the thread.id. This creates a new thread id and emits a thread/started notification for it:

{ "method": "thread/fork", "id": 12, "params": { "threadId": "thr_123" } }
{ "id": 12, "result": { "thread": { "id": "thr_456" } } }
{ "method": "thread/started", "params": { "thread": { "id": "thr_456" } } }

When a user-facing thread title has been set, app-server hydrates thread.name on thread/list, thread/read, thread/resume, thread/unarchive, and thread/rollback responses. thread/start and thread/fork may omit name (or return null) until a title is set later.

Read a stored thread (without resuming)

Use thread/read when you want stored thread data but don’t want to resume the thread or subscribe to its events.

includeTurns - when true, the response includes the thread’s turns; when false or omitted, you get the thread summary only.

Returned thread objects include runtime status (notLoaded, idle, systemError, or active with activeFlags).

{ "method": "thread/read", "id": 19, "params": { "threadId": "thr_123", "includeTurns": true } }
{ "id": 19, "result": { "thread": { "id": "thr_123", "name": "Bug bash notes", "ephemeral": false, "status": { "type": "notLoaded" }, "turns": [] } } }

Unlike thread/resume, thread/read doesn’t load the thread into memory or emit thread/started.

List thread turns

Use thread/turns/list to page a stored thread’s turn history without resuming it. Results default to newest-first so clients can fetch older turns with nextCursor. The response also includes backwardsCursor; pass it as cursor with sortDirection: "asc" to fetch turns newer than the first item from the earlier page.

{ "method": "thread/turns/list", "id": 20, "params": {
 "threadId": "thr_123",
 "limit": 50,
 "sortDirection": "desc"
} }
{ "id": 20, "result": {
 "data": [],
 "nextCursor": "older-turns-cursor-or-null",
 "backwardsCursor": "newer-turns-cursor-or-null"
} }

List threads (with pagination & filters)

thread/list lets you render a history UI. Results default to newest-first by createdAt. Filters apply before pagination. Pass any combination of:

cursor - opaque string from a prior response; omit for the first page.

limit - server defaults to a reasonable page size if unset.

sortKey - created_at (default) or updated_at.

modelProviders - restrict results to specific providers; unset, null, or an empty array includes all providers.

sourceKinds - restrict results to specific thread sources. When omitted or [], the server defaults to interactive sources only: cli and vscode.

archived - when true, list archived threads only. When false or omitted, list non-archived threads (default).

cwd - restrict results to threads whose session current working directory exactly matches this path.

searchTerm - search stored thread summaries and metadata before pagination.

sourceKinds accepts the following values:

cli

vscode

exec

appServer

subAgent

subAgentReview

subAgentCompact

subAgentThreadSpawn

subAgentOther

unknown

Example:

{ "method": "thread/list", "id": 20, "params": {
 "cursor": null,
 "limit": 25,
 "sortKey": "created_at"
} }
{ "id": 20, "result": {
 "data": [
 { "id": "thr_a", "preview": "Create a TUI", "ephemeral": false, "modelProvider": "openai", "createdAt": 1730831111, "updatedAt": 1730831111, "name": "TUI prototype", "status": { "type": "notLoaded" } },
 { "id": "thr_b", "preview": "Fix tests", "ephemeral": true, "modelProvider": "openai", "createdAt": 1730750000, "updatedAt": 1730750000, "status": { "type": "notLoaded" } }
 ],
 "nextCursor": "opaque-token-or-null"
} }

When nextCursor is null, you have reached the final page.

Update stored thread metadata

Use thread/metadata/update to patch stored thread metadata without resuming the thread. Today this supports persisted gitInfo; omitted fields are left unchanged, and explicit null clears a stored value.

{ "method": "thread/metadata/update", "id": 21, "params": {
 "threadId": "thr_123",
 "gitInfo": { "branch": "feature/sidebar-pr" }
} }
{ "id": 21, "result": {
 "thread": {
 "id": "thr_123",
 "gitInfo": { "sha": null, "branch": "feature/sidebar-pr", "originUrl": null }
 }
} }

Track thread status changes

thread/status/changed is emitted whenever a loaded thread’s runtime status changes. The payload includes threadId and the new status.

{
 "method": "thread/status/changed",
 "params": {
 "threadId": "thr_123",
 "status": { "type": "active", "activeFlags": ["waitingOnApproval"] }
 }
}

List loaded threads

thread/loaded/list returns thread IDs currently loaded in memory.

{ "method": "thread/loaded/list", "id": 21 }
{ "id": 21, "result": { "data": ["thr_123", "thr_456"] } }

Unsubscribe from a loaded thread

thread/unsubscribe removes the current connection’s subscription to a thread. The response status is one of:

unsubscribed when the connection was subscribed and is now removed.

notSubscribed when the connection wasn’t subscribed to that thread.

notLoaded when the thread isn’t loaded.

If this was the last subscriber, the server keeps the thread loaded until it has no subscribers and no thread activity for 30 minutes. When the grace period expires, app-server unloads the thread and emits a thread/status/changed transition to notLoaded plus thread/closed.

{ "method": "thread/unsubscribe", "id": 22, "params": { "threadId": "thr_123" } }
{ "id": 22, "result": { "status": "unsubscribed" } }

If the thread later expires:

{ "method": "thread/status/changed", "params": {
 "threadId": "thr_123",
 "status": { "type": "notLoaded" }
} }
{ "method": "thread/closed", "params": { "threadId": "thr_123" } }

Archive a thread

Use thread/archive to move the persisted thread log (stored as a JSONL file on disk) into the archived sessions directory.

{ "method": "thread/archive", "id": 22, "params": { "threadId": "thr_b" } }
{ "id": 22, "result": {} }
{ "method": "thread/archived", "params": { "threadId": "thr_b" } }

Archived threads won’t appear in future calls to thread/list unless you pass archived: true.

Unarchive a thread

Use thread/unarchive to move an archived thread rollout back into the active sessions directory.

{ "method": "thread/unarchive", "id": 24, "params": { "threadId": "thr_b" } }
{ "id": 24, "result": { "thread": { "id": "thr_b", "name": "Bug bash notes" } } }
{ "method": "thread/unarchived", "params": { "threadId": "thr_b" } }

Trigger thread compaction

Use thread/compact/start to trigger manual history compaction for a thread. The request returns immediately with {}.

App-server emits progress as standard turn/* and item/* notifications on the same threadId, including a contextCompaction item lifecycle (item/started then item/completed).

{ "method": "thread/compact/start", "id": 25, "params": { "threadId": "thr_b" } }
{ "id": 25, "result": {} }

Run a thread shell command

Use thread/shellCommand for user-initiated shell commands that belong to a thread. The request returns immediately with {} while progress streams through standard turn/* and item/* notifications.

This API runs outside the sandbox with full access and doesn’t inherit the thread sandbox policy. Clients should expose it only for explicit user-initiated commands.

If the thread already has an active turn, the command runs as an auxiliary action on that turn and its formatted output is injected into the turn’s message stream. If the thread is idle, app-server starts a standalone turn for the shell command.

{ "method": "thread/shellCommand", "id": 26, "params": { "threadId": "thr_b", "command": "git status --short" } }
{ "id": 26, "result": {} }

Clean background terminals

Use thread/backgroundTerminals/clean to stop all running background terminals associated with a thread. This method is experimental and requires capabilities.experimentalApi = true.

{ "method": "thread/backgroundTerminals/clean", "id": 27, "params": { "threadId": "thr_b" } }
{ "id": 27, "result": {} }

Roll back recent turns

Use thread/rollback to remove the last numTurns entries from the in-memory context and persist a rollback marker in the rollout log. The returned thread includes turns populated after the rollback.

{ "method": "thread/rollback", "id": 28, "params": { "threadId": "thr_b", "numTurns": 1 } }
{ "id": 28, "result": { "thread": { "id": "thr_b", "name": "Bug bash notes", "ephemeral": false } } }

Turns

The input field accepts a list of items:

{ "type": "text", "text": "Explain this diff" }

{ "type": "image", "url": "https://.../design.png" }

{ "type": "localImage", "path": "/tmp/screenshot.png" }

You can override configuration settings per turn (model, effort, personality, cwd, sandbox policy, summary). When specified, these settings become the defaults for later turns on the same thread. outputSchema applies only to the current turn. For sandboxPolicy.type = "externalSandbox", set networkAccess to restricted or enabled; for workspaceWrite, networkAccess remains a boolean.

For turn/start.collaborationMode, settings.developer_instructions: null means “use built-in instructions for the selected mode” rather than clearing mode instructions.

Sandbox read access (ReadOnlyAccess)

sandboxPolicy supports explicit read-access controls:

readOnly: optional access ({ "type": "fullAccess" } by default, or restricted roots).

workspaceWrite: optional readOnlyAccess ({ "type": "fullAccess" } by default, or restricted roots).

Restricted read access shape:

{
 "type": "restricted",
 "includePlatformDefaults": true,
 "readableRoots": ["/Users/me/shared-read-only"]
}

On macOS, includePlatformDefaults: true appends a curated platform-default Seatbelt policy for restricted-read sessions. This improves tool compatibility without broadly allowing all of /System.

Examples:

{ "type": "readOnly", "access": { "type": "fullAccess" } }
{
 "type": "workspaceWrite",
 "writableRoots": ["/Users/me/project"],
 "readOnlyAccess": {
 "type": "restricted",
 "includePlatformDefaults": true,
 "readableRoots": ["/Users/me/shared-read-only"]
 },
 "networkAccess": false
}

Start a turn

{ "method": "turn/start", "id": 30, "params": {
 "threadId": "thr_123",
 "input": [ { "type": "text", "text": "Run tests" } ],
 "cwd": "/Users/me/project",
 "approvalPolicy": "unlessTrusted",
 "sandboxPolicy": {
 "type": "workspaceWrite",
 "writableRoots": ["/Users/me/project"],
 "networkAccess": true
 },
 "model": "gpt-5.4

...[gekürzt in diesem Bundle: 33004 weitere Zeichen in der Quelldatei]
````

</details>


<details>
<summary>Textanlage: <code>Oauth/OpenAICodex/auth.txt</code></summary>

````text
Authentication – Codex | OpenAI Developers

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the Codex docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

Getting Started
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

Using Codex
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

Configuration
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

Administration
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

Automation
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

Learn
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

Releases
 
 Changelog 

 Feature Maturity 

 Open Source 

 Copy Page 

 Authentication 
 
Sign-in methods for Codex

 Copy Page 

OpenAI authentication

Codex supports two ways to sign in when using OpenAI models:

Sign in with ChatGPT for subscription access

Sign in with an API key for usage-based access

Codex cloud requires signing in with ChatGPT. The Codex CLI and IDE extension support both sign-in methods.

Your sign-in method also determines which admin controls and data-handling policies apply.

With sign in with ChatGPT, Codex usage follows your ChatGPT workspace permissions, RBAC, and ChatGPT Enterprise retention and residency settings

With an API key, usage follows your API organization’s retention and data-sharing settings instead

For the CLI, Sign in with ChatGPT is the default authentication path when no valid session is available.

Sign in with ChatGPT

When you sign in with ChatGPT from the Codex app, CLI, or IDE Extension, Codex opens a browser window for you to complete the login flow. After you sign in, the browser returns an access token to the CLI or IDE extension.

Sign in with an API key

You can also sign in to the Codex app, CLI, or IDE Extension with an API key. Get your API key from the OpenAI dashboard.

OpenAI bills API key usage through your OpenAI Platform account at standard API rates. See the API pricing page.

Features that rely on ChatGPT credits, such as fast mode, are
available only when you sign in with ChatGPT. If you sign in with an API key,
Codex uses standard API pricing instead.

Recommendation is to use API key authentication for programmatic Codex CLI workflows (for example CI/CD jobs). Don’t expose Codex execution in untrusted or public environments.

Secure your Codex cloud account

Codex cloud interacts directly with your codebase, so it needs stronger security than many other ChatGPT features. Enable multi-factor authentication (MFA).

If you use a social login provider (Google, Microsoft, Apple), you aren’t required to enable MFA on your ChatGPT account, but you can set it up with your social login provider.

For setup instructions, see:

Google

Microsoft

Apple

If you access ChatGPT through single sign-on (SSO), your organization’s SSO administrator should enforce MFA for all users.

If you log in using an email and password, you must set up MFA on your account before accessing Codex cloud.

If your account supports more than one login method and one of them is email and password, you must set up MFA before accessing Codex, even if you sign in another way.

Login caching

When you sign in to the Codex app, CLI, or IDE Extension using either ChatGPT or an API key, Codex caches your login details and reuses them the next time you start the CLI or extension. The CLI and extension share the same cached login details. If you log out from either one, you’ll need to sign in again the next time you start the CLI or extension.

Codex caches login details locally in a plaintext file at ~/.codex/auth.json or in your OS-specific credential store.

For sign in with ChatGPT sessions, Codex refreshes tokens automatically during use before they expire, so active sessions usually continue without requiring another browser login.

Credential storage

Use cli_auth_credentials_store to control where the Codex CLI stores cached credentials:

# file | keyring | auto
cli_auth_credentials_store = "keyring"

file stores credentials in auth.json under CODEX_HOME (defaults to ~/.codex).

keyring stores credentials in your operating system credential store.

auto uses the OS credential store when available, otherwise falls back to auth.json.

If you use file-based storage, treat ~/.codex/auth.json like a password: it
contains access tokens. Don’t commit it, paste it into tickets, or share it in
chat.

Enforce a login method or workspace

In managed environments, admins may restrict how users are allowed to authenticate:

# Only allow ChatGPT login or only allow API key login.
forced_login_method = "chatgpt" # or "api"

# When using ChatGPT login, restrict users to a specific workspace.
forced_chatgpt_workspace_id = "00000000-0000-0000-0000-000000000000"

If the active credentials don’t match the configured restrictions, Codex logs the user out and exits.

These settings are commonly applied via managed configuration rather than per-user setup. See Managed configuration.

Login diagnostics

Direct codex login runs write a dedicated codex-login.log file under
your configured log directory. Use it when you need to debug browser-login or
device-code failures, or when support asks for login-specific logs.

Custom CA bundles

If your network uses a corporate TLS proxy or private root CA, set
CODEX_CA_CERTIFICATE to a PEM bundle before logging in. When
CODEX_CA_CERTIFICATE is unset, Codex falls back to SSL_CERT_FILE. The same
custom CA settings apply to login, normal HTTPS requests, and secure websocket
connections.

export CODEX_CA_CERTIFICATE=/path/to/corporate-root-ca.pem
codex login

Login on headless devices

If you are signing in to ChatGPT with the Codex CLI, there are some situations where the browser-based login UI may not work:

You’re running the CLI in a remote or headless environment.

Your local networking configuration blocks the localhost callback Codex uses to return the OAuth token to the CLI after you sign in.

In these situations, prefer device code authentication (beta). In the interactive login UI, choose Sign in with Device Code, or run codex login --device-auth directly. If device code authentication doesn’t work in your environment, use one of the fallback methods.

Preferred: Device code authentication (beta)

Enable device code login in your ChatGPT security settings (personal account) or ChatGPT workspace permissions (workspace admin).

In the terminal where you’re running Codex, choose one of these options:

In the interactive login UI, select Sign in with Device Code.

Run codex login --device-auth.

Open the link in your browser, sign in, then enter the one-time code.

If device code login isn’t enabled by the server, Codex falls back to the standard browser-based login flow.

Fallback: Authenticate locally and copy your auth cache

If you can complete the login flow on a machine with a browser, you can copy your cached credentials to the headless machine.

On a machine where you can use the browser-based login flow, run codex login.

Confirm the login cache exists at ~/.codex/auth.json.

Copy ~/.codex/auth.json to ~/.codex/auth.json on the headless machine.

Treat ~/.codex/auth.json like a password: it contains access tokens. Don’t commit it, paste it into tickets, or share it in chat.

If your OS stores credentials in a credential store instead of ~/.codex/auth.json, this method may not apply. See
Credential storage for how to configure file-based storage.

Copy to a remote machine over SSH:

ssh user@remote 'mkdir -p ~/.codex'
scp ~/.codex/auth.json user@remote:~/.codex/auth.json

Or use a one-liner that avoids scp:

ssh user@remote 'mkdir -p ~/.codex && cat > ~/.codex/auth.json' < ~/.codex/auth.json

Copy into a Docker container:

# Replace MY_CONTAINER with the name or ID of your container.
CONTAINER_HOME=$(docker exec MY_CONTAINER printenv HOME)
docker exec MY_CONTAINER mkdir -p "$CONTAINER_HOME/.codex"
docker cp ~/.codex/auth.json MY_CONTAINER:"$CONTAINER_HOME/.codex/auth.json"

For a more advanced version of this same pattern on trusted CI/CD runners, see
Maintain Codex account auth in CI/CD (advanced).
That guide explains how to let Codex refresh auth.json during normal runs and
then keep the updated file for the next job. API keys are still the recommended
default for automation.

Fallback: Forward the localhost callback over SSH

If you can forward ports between your local machine and the remote host, you can use the standard browser-based flow by tunneling Codex’s local callback server (default localhost:1455).

From your local machine, start port forwarding:

ssh -L 1455:localhost:1455 user@remote

In that SSH session, run codex login and follow the printed address on your local machine.

Alternative model providers

When you define a custom model provider in your configuration file, you can choose one of these authentication methods:

OpenAI authentication: Set requires_openai_auth = true to use OpenAI authentication. You can then sign in with ChatGPT or an API key. This is useful when you access OpenAI models through an LLM proxy server. When requires_openai_auth = true, Codex ignores env_key.

Environment variable authentication: Set env_key = "<ENV_VARIABLE_NAME>" to use a provider-specific API key from the local environment variable named <ENV_VARIABLE_NAME>.

No authentication: If you don’t set requires_openai_auth (or set it to false) and you don’t set env_key, Codex assumes the provider doesn’t require authentication. This is useful for local models.
````

</details>


<details>
<summary>Textanlage: <code>Oauth/OpenAICodex/ci-cd-auth.txt</code></summary>

````text
Maintain Codex account auth in CI/CD (advanced) | OpenAI Developers

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the Codex docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

Getting Started
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

Using Codex
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

Configuration
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

Administration
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

Automation
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

Learn
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

Releases
 
 Changelog 

 Feature Maturity 

 Open Source 

 Copy Page 

 Maintain Codex account auth in CI/CD (advanced) 
 
Use Codex's built-in refresh flow to keep auth.json working on trusted CI/CD runners

 Copy Page 

This guide shows how to keep ChatGPT-managed Codex auth working on a trusted
CI/CD runner without calling the OAuth token endpoint yourself.

The right way to authenticate automation is with an API key. Use this guide
only if you specifically need to run the workflow as your Codex account.

The pattern is:

Create auth.json once on a trusted machine with codex login.

Put that file on the runner.

Run Codex normally.

Let Codex refresh the session when it becomes stale.

Keep the refreshed auth.json for the next run.

This is an advanced workflow for enterprise and other trusted private
automation. API keys are still the recommended option for most CI/CD jobs.

Treat ~/.codex/auth.json like a password: it contains access tokens. Don’t
commit it, paste it into tickets, or share it in chat. Do not use this
workflow for public or open-source repositories.

Why this works

Codex already knows how to refresh a ChatGPT-managed session.

As of the current open-source client:

Codex loads the local auth cache from auth.json

if last_refresh is older than about 8 days, Codex refreshes the token
bundle before the run continues

after a successful refresh, Codex writes the new tokens and a new
last_refresh back to auth.json

if a request gets a 401, Codex also has a built-in refresh-and-retry path

That means the supported CI/CD strategy is not “call the refresh API yourself.”
It is “run Codex and persist the updated auth.json.”

When to use this

Use this guide only when all of the following are true:

you need ChatGPT-managed Codex auth rather than an API key

codex login cannot run on the remote runner

the runner is trusted private infrastructure

you can preserve the refreshed auth.json between runs

only one machine or serialized job stream will use a given auth.json copy

This guide applies to Codex-managed ChatGPT auth (auth_mode: "chatgpt").

It does not apply to:

API key auth

external-token host integrations (auth_mode: "chatgptAuthTokens")

generic OAuth clients outside Codex

If your credentials are stored in the OS keyring, switch to file-backed storage
first. See Credential storage.

Seed auth.json once

On a trusted machine where browser login is possible:

Configure Codex to store credentials in a file:

cli_auth_credentials_store = "file"

Run:

codex login

Verify the file looks like managed ChatGPT auth:

AUTH_FILE="${CODEX_HOME:-$HOME/.codex}/auth.json"

jq '{
 auth_mode,
 has_tokens: (.tokens != null),
 has_refresh_token: ((.tokens.refresh_token // "") != ""),
 last_refresh
}' "$AUTH_FILE"

Continue only if:

auth_mode is "chatgpt"

has_refresh_token is true

Then place the contents of auth.json into your CI/CD secret manager or copy
it to a trusted persistent runner.

Recommended pattern: GitHub Actions on a self-hosted runner

The simplest fully automated setup is a self-hosted GitHub Actions runner with a
persistent CODEX_HOME.

Why this pattern works well:

the runner can keep auth.json on disk between jobs

Codex can refresh the file in place

later jobs automatically pick up the refreshed tokens

you only need the original secret for bootstrap or reseeding

The critical detail is to seed auth.json only if it is missing. If you
rewrite the file from the original secret on every run, you throw away the
refreshed tokens that Codex just wrote.

Example scheduled workflow:

name: Keep Codex auth fresh

on:
 schedule:
 - cron: "0 9 * * 1"
 workflow_dispatch:

jobs:
 keep-codex-auth-fresh:
 runs-on: self-hosted
 steps:
 - name: Bootstrap auth.json if needed
 shell: bash
 env:
 CODEX_AUTH_JSON: ${{ secrets.CODEX_AUTH_JSON }}
 run: |
 export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
 mkdir -p "$CODEX_HOME"
 chmod 700 "$CODEX_HOME"

 if [ ! -f "$CODEX_HOME/auth.json" ]; then
 printf '%s' "$CODEX_AUTH_JSON" > "$CODEX_HOME/auth.json"
 chmod 600 "$CODEX_HOME/auth.json"
 fi

 - name: Run Codex
 shell: bash
 run: |
 codex exec --json "Reply with the single word OK." >/dev/null

What this does:

the first run seeds auth.json

later runs reuse the same file

once the cached session is old enough, Codex refreshes it during the normal
codex exec step

the refreshed file remains on disk for the next workflow run

A weekly schedule is usually enough because Codex treats the session as stale
after roughly 8 days in the current open-source client.

Ephemeral runners: restore, run Codex, persist the updated file

If you use GitHub-hosted runners, GitLab shared runners, or any other ephemeral
environment, the runner filesystem disappears after each job. In that setup,
you need a round-trip:

restore the current auth.json from secure storage

run Codex

write the updated auth.json back to secure storage

Generic GitHub Actions shape:

name: Run Codex with managed auth

on:
 workflow_dispatch:

jobs:
 codex-job:
 runs-on: ubuntu-latest
 steps:
 - name: Restore auth.json
 shell: bash
 run: |
 export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
 mkdir -p "$CODEX_HOME"
 chmod 700 "$CODEX_HOME"

 # Replace this with your secret manager or secure storage command.
 my-secret-cli read codex-auth-json > "$CODEX_HOME/auth.json"
 chmod 600 "$CODEX_HOME/auth.json"

 - name: Run Codex
 shell: bash
 run: |
 codex exec --json "summarize the failing tests"

 - name: Persist refreshed auth.json
 if: always()
 shell: bash
 run: |
 # Replace this with your secret manager or secure storage command.
 my-secret-cli write codex-auth-json < "$CODEX_HOME/auth.json"

The key requirement is that the write-back step stores the refreshed file that
Codex produced during the run, not the original seed.

You do not need a separate refresh command

Any normal Codex run can refresh the session.

That means you have two good options:

let your existing CI/CD Codex job refresh the file naturally

add a lightweight scheduled maintenance job, like the GitHub Actions example
above, if your real jobs do not run often enough

The first Codex run after the session becomes stale is the one that refreshes
auth.json.

Operational rules that matter

Use one auth.json per runner or per serialized workflow stream.

Do not share the same file across concurrent jobs or multiple machines.

Do not overwrite a persistent runner’s refreshed file from the original seed
on every run.

Do not store auth.json in the repository, logs, or public artifact storage.

Reseed from a trusted machine if built-in refresh stops working.

What to do when refresh stops working

This flow reduces manual work, but it does not guarantee the same session lasts
forever.

Reseed the runner with a fresh auth.json if:

Codex starts returning 401 and the runner can no longer refresh

the refresh token was revoked or expired

another machine or concurrent job rotated the token first

your secure-storage round trip failed and an old file was restored

To reseed:

Run codex login on a trusted machine.

Replace the stored CI/CD copy of auth.json.

Let the next runner job continue using Codex’s built-in refresh flow.

Verify that the runner is maintaining the session

Check that the runner still has managed auth tokens and that last_refresh
exists:

AUTH_FILE="${CODEX_HOME:-$HOME/.codex}/auth.json"

jq '{
 auth_mode,
 last_refresh,
 has_access_token: ((.tokens.access_token // "") != ""),
 has_id_token: ((.tokens.id_token // "") != ""),
 has_refresh_token: ((.tokens.refresh_token // "") != "")
}' "$AUTH_FILE"

If your runner is persistent, you should see the same file continue to exist
between runs. If your runner is ephemeral, confirm that your write-back step is
storing the updated file from the last job.

Source references

If you want to verify this behavior in the open-source client:

codex-rs/core/src/auth.rs
covers stale-token detection, automatic refresh, refresh-on-401 recovery, and
persistence of refreshed tokens

codex-rs/core/src/auth/storage.rs
covers file-backed auth.json storage
````

</details>


<details>
<summary>Textanlage: <code>Oauth/OpenAICodex/codex.txt</code></summary>

````text
Codex | OpenAI Developers

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the Codex docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

Getting Started
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

Using Codex
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

Configuration
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

Administration
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

Automation
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

Learn
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

Releases
 
 Changelog 

 Feature Maturity 

 Open Source 

 Codex 
 
One agent for everywhere you code

Codex is OpenAI’s coding agent for software development. ChatGPT Plus, Pro, Business, Edu, and Enterprise plans include Codex. It can help you:

Write code: Describe what you want to build, and Codex generates code that matches your intent, adapting to your existing project structure and conventions.

Understand unfamiliar codebases: Codex can read and explain complex or legacy code, helping you grasp how teams organize systems.

Review code: Codex analyzes code to identify potential bugs, logic errors, and unhandled edge cases.

Debug and fix problems: When something breaks, Codex helps trace failures, diagnose root causes, and suggest targeted fixes.

Automate development tasks: Codex can run repetitive workflows such as refactoring, testing, migrations, and setup tasks so you can focus on higher-level engineering work.

 Get started with Codex 

 Quickstart 
 
 Download and start building with Codex. 
 
 Get started 

 Explore use cases 
 
 Get inspiration on what you can build with Codex. 
 
 Learn more 

 Community 
 
 Read community posts, explore meetups, and connect with Codex builders. 
 
 See community 

 Codex for Open Source 
 
 Apply or nominate maintainers for API credits, ChatGPT Pro with Codex, and selective Codex Security access. 
 
 Learn more
````

</details>


<details>
<summary>Textanlage: <code>Oauth/OpenAICodex/docs.txt</code></summary>

````text
OpenAI API Platform Documentation

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the API docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

Get started
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

Core concepts
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

Agents SDK
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

Tools
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

Run and scale
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

Evaluation
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

Realtime API
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

Model optimization
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

Specialized models
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

Going live
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

Legacy APIs
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

Resources
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

API Platform

Developer quickstart

Make your first API request in minutes. Learn the basics of the OpenAI platform.

Get startedCreate API key

javascript

1
2
3
4
5
6
7
curl https://api.openai.com/v1/responses \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5.4",
 "input": "Write a short bedtime story about a unicorn."
 }'

1
2
3
4
5
6
7
8
9
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
 model: "gpt-5.4",
 input: "Write a short bedtime story about a unicorn.",
});

console.log(response.output_text);

1
2
3
4
5
6
7
8
9
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
 model="gpt-5.4",
 input="Write a short bedtime story about a unicorn."
)

print(response.output_text)

1
2
3
4
5
6
7
8
9
10
using OpenAI.Responses;

string apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
var client = new OpenAIResponseClient(model: "gpt-5.4", apiKey: apiKey);

OpenAIResponse response = client.CreateResponse(
 "Write a short bedtime story about a unicorn."
);

Console.WriteLine(response.GetOutputText());

Build paths

Responses API

Make direct model requests for text, structured output, tools, and multimodal workflows.

Start with Responses

Agents SDK

Build code-first agents that orchestrate tools, handoffs, approvals, tracing, and container-based execution.

Start with the Agents SDK

Models

Start with gpt-5.4 for complex reasoning and coding, or choose gpt-5.4-mini and gpt-5.4-nano for lower-latency, lower-cost workloads.

View all

GPT-5.4

Best intelligence at scale for agentic, coding, and professional workflows

GPT-5.4 mini

Our strongest mini model yet for coding, computer use, and subagents

GPT-5.4 nano

Our cheapest GPT-5.4-class model for simple high-volume tasks

Start building

Read and generate text

Use the API to prompt a model and generate text

Use a model's vision capabilities

Allow models to see and analyze images in your application

Generate images as output

Create images with GPT Image 2

Build apps with audio

Analyze, transcribe, and generate audio with API endpoints

Build agentic applications

Use the API to build agents that use tools and computers

Achieve complex tasks with reasoning

Use reasoning models to carry out complex tasks

Get structured data from models

Use Structured Outputs to get model responses that adhere to a JSON schema

Tailor to your use case

Adjust our models to perform specifically for your use case with fine-tuning, evals, and distillation

Help center

Frequently asked account and billing questions

Developer forum

Discuss topics with other developers

Cookbook

Open-source collection of examples and guides

Status

Check the status of OpenAI services
````

</details>


<details>
<summary>Textanlage: <code>Oauth/OpenAICodex/document.txt</code></summary>

````text
OpenAI Developers

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

 OpenAI for developers 
 
Docs and resources to help you build with, for, and on OpenAI.

New: Sandbox agents in the Agents SDK
 
Run agents in container-based environments with files, commands, skills, snapshots, and memory.

 API Platform 
 
 Use our APIs and models to build your own AI experiences. 

 Codex 
 
 Build and ship faster with our coding agent — everywhere you work. 

 Apps SDK 
 
 Extend ChatGPT with your apps built on top of the Model Context Protocol. 

Featured

 Introducing the Codex app 
 
 Video February 2, 2026 

 Apps SDK examples 
 
 Code October 6, 2025 

 ChatKit starter app 
 
 Code October 6, 2025 

 Agentic Commerce Protocol 
 
 Guide September 29, 2025 

Latest
 
View all

 Sora 2 Prompting Guide 
 
 Cookbook to craft effective video prompts for Sora 2 generation. 
 
 Cookbook 

 Codex Prompting Guide 
 
 Codex models advance the frontier of intelligence and efficiency and our recommended agentic coding model. Follow this guide closely to ensure you’re getting th 
 
 Cookbook 

 Introducing the Codex app 
 
 See the Codex app in action and how it helps you build and ship faster. 
 
 Video 

 Codex in JetBrains IDEs 
 
 How to use Codex inside JetBrains IDEs like Rider, IntelliJ, PyCharm, and WebStorm. 
 
 Video 

 Docs MCP 
 
 Search and read OpenAI developer docs from your editor using MCP. 
 
 Guide 

 Gpt-image-1.5 Prompting Guide 
 
 Cookbook to prompt gpt-image-1.5 for reliable image generation results. 
 
 Cookbook 

Explore

Blog

Resources

Cookbook

Help center
 
Frequently asked account and billing questions

Developer forum
 
Discuss topics with other developers

OpenAI for startups
 
Resources for ambitious founders building with OpenAI

Status
 
Check the status of OpenAI services
````

</details>


<details>
<summary>Textanlage: <code>Oauth/OpenAICodex/overview.txt</code></summary>

````text
API Overview | OpenAI API Reference 

 Skip to content 

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the API docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

 API API Reference Codex ChatGPT Resources 

API Reference

API Reference

Introduction

Authentication

Debugging requests

Backwards compatibility

Responses API

Overview

Responses
Create a response

Retrieve a response

Delete a response

List input items

Count input tokens

Cancel a response

Compact a response

Conversations
Create a conversation

Retrieve a conversation

Update a conversation

Delete a conversation

Items
Create an item

Retrieve an item

Delete an item

List items

Streaming events

Webhooks

Events

Platform APIs

Audio
Create a transcription

Create a translation

Create a speech

Create a voice

Voice Consents
Create a voice consent

Retrieve a voice consent

Update a voice consent

Delete a voice consent

List voice consents

Videos
Create a video

Create Character

Get Character

Retrieve a video

Delete a video

List videos

Download Content

Edit

Extend

Remix

Images
Generate an Image

Edit an Image

Create Variation

Image generation streaming events

Image edit streaming events

Embeddings
Create an embedding

Evals
Create an eval

Retrieve an eval

Update an eval

Delete an eval

List evals

Runs
Create a run

Retrieve a run

Delete a run

List runs

Cancel a run

Output Items
Retrieve an output item

List output items

Fine Tuning
Jobs
Create a job

Retrieve a job

List jobs

List Events

Cancel a job

Pause

Resume

Checkpoints
List checkpoints

Checkpoints
Permissions
Create a permission

Retrieve a permission

Delete a permission

List permissions

Alpha
Graders
Run

Validate

Batches
Create a batch

Retrieve a batch

List batches

Cancel a batch

Files
List files

Create a file

Retrieve a file

Delete a file

Retrieve file content

Uploads
Create an upload

Cancel an upload

Complete

Parts
Create a part

Models
Retrieve a model

Delete a model

List models

Moderations
Create a moderation

Vector Stores

Vector Stores
Create a vector store

Retrieve a vector store

Update a vector store

Delete a vector store

List vector stores

Search

Files
List files

Create a file

Retrieve a file

Update a file

Delete a file

Retrieve file content

File Batches
Create a file batch

Retrieve a file batch

List Files

Cancel a file batch

ChatKit

Sessions
Create a session

Cancel a session

Threads
Retrieve a thread

Delete a thread

List Items

List threads

Containers

Containers
Create a container

Retrieve a container

Delete a container

List containers

Files
List files

Create a file

Retrieve a file

Delete a file

Content
Retrieve a content

Skills

Skills
Create a skill

Retrieve a skill

Retrieve skill content

Update a skill

Delete a skill

List skills

Versions
Create skill version

Retrieve skill version

Retrieve Skill Version Content

Delete skill version

List skill versions

Realtime

Client Secrets
Create a client secret

Calls
Accept

Hangup

Refer

Reject

Client events

Server events

Administration

Overview

Audit Logs
Get Costs

List audit logs

Admin API Keys
Create an admin API key

Retrieve an admin API key

Delete an admin API key

List admin API keys

Usage
Get Audio Speeches

Get Audio Transcriptions

Get Code Interpreter Sessions

Get Completions

Get Embeddings

Get Images

Get Moderations

Get Vector Stores

Invites
Create an invite

Retrieve an invite

Delete an invite

List invites

Users
Retrieve an user

Update an user

Delete an user

List users

Roles
Create a role

Delete a role

List roles

Groups
Create a group

Update a group

Delete a group

List groups

Users
Create an user

Delete an user

List users

Roles
Create a role

Delete a role

List roles

Roles
Create a role

Update a role

Delete a role

List roles

Certificates
Create a certificate

Retrieve a certificate

Update a certificate

Delete a certificate

List certificates

Activate

Deactivate

Projects
Create a project

Retrieve a project

Update a project

List projects

Archive

Users
Create an user

Retrieve an user

Update an user

Delete an user

List users

Roles
Create a role

Delete a role

List roles

Service Accounts
Create a service account

Retrieve a service account

Delete a service account

List service accounts

API Keys
Retrieve an API key

Delete an API key

List API keys

Rate Limits
Update Rate Limit

List Rate Limits

Groups
Create a group

Delete a group

List groups

Roles
Create a role

Delete a role

List roles

Roles
Create a role

Update a role

Delete a role

List roles

Certificates
List certificates

Activate

Deactivate

Chat Completions

Chat Completions
Overview

Create a chat completion

Retrieve a chat completion

Update a chat completion

Delete a chat completion

List chat completions

List chat completions

Streaming events

Legacy

Realtime Beta
Overview

Sessions
Create a session

Transcription Sessions
Create a transcription session

Assistants
Create an assistant

Retrieve an assistant

Update an assistant

Delete an assistant

List assistants

Threads
Create a thread

Create And Run

Retrieve a thread

Update a thread

Delete a thread

Runs
Create a run

Retrieve a run

Update a run

List runs

Cancel a run

Submit Tool Outputs

Steps
Retrieve a step

List steps

Messages
Create a message

Retrieve a message

Update a message

Delete a message

List messages

Assistants streaming events

Completions
Create a completion

API Reference

Introduction

API Overview

Introduction
Section titled “Introduction”

This API reference describes the RESTful, streaming, and realtime APIs you can use to interact with the OpenAI platform. REST APIs are usable via HTTP in any environment that supports HTTP requests. Language-specific SDKs are listed on the libraries page.

Authentication
Section titled “Authentication”

The OpenAI API uses API keys for authentication. Create, manage, and learn more about API keys in your organization settings.

Remember that your API key is a secret! Do not share it with others or expose it in any client-side code (browsers, apps). API keys should be securely loaded from an environment variable or key management service on the server.

API keys should be provided via HTTP Bearer authentication.

Authorization: Bearer OPENAI_API_KEY

If you belong to multiple organizations or access projects through a legacy user API key, pass a header to specify which organization and project to use for an API request:

curl https://api.openai.com/v1/models \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -H "OpenAI-Organization: $ORGANIZATION_ID" \
 -H "OpenAI-Project: $PROJECT_ID"

Usage from these API requests counts as usage for the specified organization and project.Organization IDs can be found on your organization settings page.
Project IDs can be found on your general settings page by selecting the specific project.

Debugging requests
Section titled “Debugging requests”

In addition to error codes returned from API responses, you can inspect HTTP response headers containing the unique ID of a particular API request or information about rate limiting applied to your requests. Below is an incomplete list of HTTP headers returned with API responses:

API meta information

openai-organization: The organization associated with the request

openai-processing-ms: Time taken processing your API request

openai-version: REST API version used for this request (currently 2020-10-01)

x-request-id: Unique identifier for this API request (used in troubleshooting)

Rate limiting information

x-ratelimit-limit-requests

x-ratelimit-limit-tokens

x-ratelimit-remaining-requests

x-ratelimit-remaining-tokens

x-ratelimit-reset-requests

x-ratelimit-reset-tokens

OpenAI recommends logging request IDs in production deployments for more efficient troubleshooting with our support team, should the need arise. Our official SDKs provide a property on top-level response objects containing the value of the x-request-id header.

Supplying your own request ID with X-Client-Request-Id
Section titled “Supplying your own request ID with X-Client-Request-Id”

In addition to the server-generated x-request-id, you can supply your own unique identifier for each request via the X-Client-Request-Id request header. This header is not added automatically; you must explicitly set it on the request.

When you include X-Client-Request-Id:

You control the ID format (for example, a UUID or your internal trace ID), but it must contain only ASCII characters and be no more than 512 characters long; otherwise, the request will fail with a 400 error. We strongly recommend making this value unique per request.

OpenAI will log this value in our internal logs for supported endpoints, including chat/completions, embeddings, responses, and more.

In cases like timeouts or network issues when you can’t get the X-Request-Id response header, you can share the X-Client-Request-Id value with our support team, and we can look up whether we received the request and when.

Example:

curl https://api.openai.com/v1/chat/completions \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -H "X-Client-Request-Id: 123e4567-e89b-12d3-a456-426614174000"

Backwards compatibility
Section titled “Backwards compatibility”

OpenAI is committed to providing stability to API users by avoiding breaking changes in major API versions whenever reasonably possible. This includes:

The REST API (currently v1)

Our first-party SDKs (released SDKs adhere to semantic versioning)

Model families (like gpt-4o or o4-mini)

Model prompting behavior between snapshots is subject to change.
Model outputs are by their nature variable, so expect changes in prompting and model behavior between snapshots. For example, if you moved from gpt-4o-2024-05-13 to gpt-4o-2024-08-06, the same system or user messages could function differently between versions. The best way to ensure consistent prompting behavior and model output is to use pinned model versions, and to implement evals for your applications.

Backwards-compatible API changes:

Adding new resources (URLs) to the REST API and SDKs

Adding new optional API parameters

Adding new properties to JSON response objects or event data

Changing the order of properties in a JSON response object

Changing the length or format of opaque strings, like resource identifiers and UUIDs

Adding new event types (in either streaming or the Realtime API)

See the changelog for a list of backwards-compatible changes and rare breaking changes.
````

</details>


<details>
<summary>Textanlage: <code>Oauth/OpenAICodex/use-cases.txt</code></summary>

````text
Codex use cases

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the Codex docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

 Home 

 Collections 

Filters
 
 Reset filters 

Category
 
 All 

 Engineering 

 Evaluation 

 Front-end 

 Quality 

Native
 
 iOS 

 macOS 

Workflows
 
 Automation 

 Data 

 Integrations 

 Knowledge Work 

Team
 
 All 

 Design 

 Engineering 

 Operations 

 Product 

 QA 

Task type
 
 All 

 Analysis 

 Code 

 Design 

 Testing 

 Workflow 

Codex Use Cases

 Workflow Integrations Knowledge Work 

Collections

Production systems
 
Use Codex to navigate real codebases, make controlled changes, codify repeatable work, and keep production quality high.

Productivity and collaboration
 
Work with Codex to analyze data and complex source material, combine multiple apps and services, and turn insights into action.

Web development
 
Turn design inputs into responsive UI, and iterate on the frontend with scoped changes and fast reviews.

Native development
 
Build for iOS and macOS, refactor native UI, expose app actions, and verify your work with the right loop.

Game development
 
Develop games with Codex, from the first playable loop to production quality.

Featured

Start with the most common Codex workflows.

 Review pull requests faster 
 
 Catch regressions and potential issues before human review. 
 
 Integrations Workflow 

 Build responsive front-end designs 
 
 Turn screenshots and visual references into responsive UI with visual checks. 
 
 Front-end Design 

 All use cases 

 Add iOS app intents 
 
 Use Codex to make your app's actions and content available to Shortcuts, Siri, Spotlight... 
 
 iOS Code 

 Add Mac telemetry 
 
 Use Codex to instrument one Mac feature with Logger, run the app, and verify the action from... 
 
 macOS Code 

 Adopt liquid glass 
 
 Use Codex to migrate an existing SwiftUI app to Liquid Glass with iOS 26 APIs and Xcode 26. 
 
 iOS Code 

 Analyze datasets and ship reports 
 
 Turn messy data into clear analysis and visualizations. 
 
 Data Analysis 

 Automate bug triage 
 
 Turn daily bug reports into a prioritized list, then automate the sweep. 
 
 Automation Quality 

 Bring your app to ChatGPT 
 
 Turn your use cases into focused apps for ChatGPT. 
 
 Integrations Code 

 Build a Mac app shell 
 
 Use Codex to build a Mac-native SwiftUI app shell with a sidebar, detail pane, inspector... 
 
 macOS Code 

 Build for iOS 
 
 Use Codex to scaffold, build, and debug SwiftUI apps for iPhone and iPad. 
 
 iOS Code 

 Build for macOS 
 
 Use Codex to scaffold, build, and debug native Mac apps with SwiftUI. 
 
 macOS Code 

 Build responsive front-end designs 
 
 Turn screenshots and visual references into responsive UI with visual checks. 
 
 Front-end Design 

 Clean and prepare messy data 
 
 Process tabular data without affecting the original. 
 
 Data Knowledge Work 

 Complete tasks from messages 
 
 Turn iMessage threads into completed work across the apps involved. 
 
 Knowledge Work Integrations 

 Coordinate new-hire onboarding 
 
 Prepare onboarding trackers, team summaries, and welcome-space drafts. 
 
 Integrations Data 

 Create a CLI Codex can use 
 
 Give Codex a composable command for an API, log source, export, or team script. 
 
 Engineering Code 

 Create browser-based games 
 
 Define a game plan and let Codex build and test it in a live browser. 
 
 Engineering Code 

 Debug in iOS simulator 
 
 Use Codex and XcodeBuildMCP to drive your app in iOS Simulator, capture evidence, and... 
 
 iOS Code 

 Deploy an app or website 
 
 Build or update a web app, deploy a preview, and get a live URL. 
 
 Front-end Integrations 

 Generate slide decks 
 
 Manipulate pptx files and use image generation to automate slide creation. 
 
 Data Integrations 

 Iterate on difficult problems 
 
 Use Codex as a scored improvement loop to solve hard tasks. 
 
 Engineering Analysis 

 Kick off coding tasks from Slack 
 
 Turn Slack threads into scoped cloud tasks. 
 
 Integrations Workflow 

 Learn a new concept 
 
 Turn dense source material into a clear, reviewable learning report. 
 
 Knowledge Work Data 

 Make granular UI changes 
 
 Use Codex-Spark for fast, focused UI iteration in an existing app. 
 
 Front-end Design 

 Manage your inbox 
 
 Have Codex find the emails that matter and write the replies in your voice. 
 
 Automation Integrations 

 QA your app with Computer Use 
 
 Click through real product flows and log what breaks. 
 
 Automation Quality 

 Query tabular data 
 
 Ask a question about a CSV, spreadsheet, export, or data folder. 
 
 Data Knowledge Work 

 Refactor SwiftUI screens 
 
 Use Codex to split an oversized SwiftUI screen into small subviews without changing behavior... 
 
 iOS Code 

 Refactor your codebase 
 
 Remove dead code and modernize legacy patterns without changing behavior. 
 
 Engineering Code 

 Review pull requests faster 
 
 Catch regressions and potential issues before human review. 
 
 Integrations Workflow 

 Run code migrations 
 
 Migrate legacy stacks in controlled checkpoints. 
 
 Engineering Code 

 Save workflows as skills 
 
 Create a skill Codex can keep on hand for work you repeat. 
 
 Engineering Workflow 

 Set up a teammate 
 
 Give Codex a durable view of your work so it can notice what changed. 
 
 Automation Integrations 

 Turn feedback into actions 
 
 Synthesize feedback from multiple sources into a reviewable artifact. 
 
 Data Integrations 

 Turn Figma designs into code 
 
 Turn Figma selections into polished UI with structured design context and visual checks. 
 
 Front-end Design 

 Understand large codebases 
 
 Trace request flows, map unfamiliar modules, and find the right files fast. 
 
 Engineering Analysis 

 Upgrade your API integration 
 
 Upgrade your app to the latest OpenAI API models. 
 
 Evaluation Engineering 

 Use your computer with Codex 
 
 Let Codex click, type, and navigate apps on your Mac. 
 
 Knowledge Work Workflow 

No use cases match these filters

Try clearing a few filters or searching for a broader term.

Filters

 Reset filters 

Category
 
 All 

 Engineering 

 Evaluation 

 Front-end 

 Quality 

Native
 
 iOS 

 macOS 

Workflows
 
 Automation 

 Data 

 Integrations 

 Knowledge Work 

Team
 
 All 

 Design 

 Engineering 

 Operations 

 Product 

 QA 

Task type
 
 All 

 Analysis 

 Code 

 Design 

 Testing 

 Workflow
````

</details>

## Nachtrag: ungekürzte vollständige Textanlagen

<details>
<summary>VOLLSTÄNDIGE ungekürzte Textanlage: <code>Oauth/OpenAICodex/app-server.txt</code></summary>

````text
App Server – Codex | OpenAI Developers

 Home 

 API 

Docs
 
 Guides and concepts for the OpenAI API 

API reference
 
 Endpoints, parameters, and responses 

 Codex 

Docs
 
 Guides, concepts, and product docs for Codex 

Use cases
 
 Example workflows and tasks teams hand to Codex 

 ChatGPT 

Apps SDK
 
 Build apps to extend ChatGPT 

Commerce
 
 Build commerce flows in ChatGPT 

 Resources 

Showcase
 
 Demo apps to get inspired 

Blog
 
 Learnings and experiences from developers 

Cookbook
 
 Notebook examples for building with OpenAI models 

Learn
 
 Docs, videos, and demo apps for building with OpenAI 

Community
 
 Programs, meetups, and support for builders 

 Start searching 
 
API Dashboard

 Search the Codex docs 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Primary navigation 
 API API Reference Codex ChatGPT Resources 

Search docs

Suggested

responses createreasoning_effortrealtimeprompt caching

 Get started 
 
 Overview 

 Quickstart 

 Models 

 Pricing 

 Libraries 

 Latest: GPT-5.4 

 Prompt guidance 

 Core concepts 
 
 Text generation 

 Code generation 

 Images and vision 

 Audio and speech 

 Structured output 

 Function calling 

 Responses API 

 Using tools 

 Agents SDK 
 
 Overview 

 Quickstart 

 Agent definitions 

 Models and providers 

 Running agents 

 Sandbox agents 

 Orchestration 

 Guardrails 

 Results and state 

 Integrations and observability 

 Evaluate agent workflows 

 Voice agents 

 Agent Builder 
 Overview 

 Node reference 

 Safety in building agents 

 ChatKit 
 Overview 

 Customize 

 Widgets 

 Actions 

 Advanced integrations 

 Tools 
 
 Web search 

 MCP and Connectors 

 Skills 

 Shell 

 Computer use 

 File search and retrieval 
 File search 

 Retrieval 

 Tool search 

 More tools 
 Apply Patch 

 Local shell 

 Image generation 

 Code interpreter 

 Run and scale 
 
 Conversation state 

 Background mode 

 Streaming 

 WebSocket mode 

 Webhooks 

 File inputs 

 Context management 
 Compaction 

 Counting tokens 

 Prompt caching 

 Prompting 
 Overview 

 Prompt engineering 

 Citation formatting 

 Reasoning 
 Reasoning models 

 Reasoning best practices 

 Evaluation 
 
 Getting started 

 Working with evals 

 Prompt optimizer 

 External models 

 Best practices 

 Realtime API 
 
 Overview 

 Connect 
 WebRTC 

 WebSocket 

 SIP 

 Usage 
 Using realtime models 

 Managing conversations 

 MCP servers 

 Webhooks and server-side controls 

 Managing costs 

 Realtime transcription 

 Voice agents 

 Model optimization 
 
 Optimization cycle 

 Fine-tuning 
 Supervised fine-tuning 

 Vision fine-tuning 

 Direct preference optimization 

 Reinforcement fine-tuning 

 RFT use cases 

 Best practices 

 Graders 

 Specialized models 
 
 Image generation 

 Video generation 

 Text to speech 

 Speech to text 

 Deep research 

 Embeddings 

 Moderation 

 Going live 
 
 Production best practices 

 Latency optimization 
 Overview 

 Predicted Outputs 

 Priority processing 

 Cost optimization 
 Overview 

 Batch 

 Flex processing 

 Accuracy optimization 

 Safety 
 Safety best practices 

 Safety checks 

 Cybersecurity checks 

 Under 18 API Guidance 

 Legacy APIs 
 
 Assistants API 
 Migration guide 

 Deep dive 

 Tools 

 Resources 
 
 Terms and policies 

 Changelog 

 Your data 

 Permissions 

 Rate limits 

 Deprecations 

 MCP for deep research 

 Developer mode 

 ChatGPT Actions 
 Introduction 

 Getting started 

 Actions library 

 Authentication 

 Production 

 Data retrieval 

 Sending files 

 Docs Use cases 

 Getting Started 
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

 Using Codex 
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

 Configuration 
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

 Administration 
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

 Automation 
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

 Learn 
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

 Releases 
 
 Changelog 

 Feature Maturity 

 Open Source 

 Home 

 Collections 

 Apps SDK Commerce 

 Home 

 Quickstart 

 Core Concepts 
 
 MCP Apps in ChatGPT 

 MCP Server 

 UX principles 

 UI guidelines 

 Plan 
 
 Research use cases 

 Define tools 

 Design components 

 Build 
 
 Set up your server 

 Build your ChatGPT UI 

 Authenticate users 

 Manage state 

 Monetize your app 

 Examples 

 Deploy 
 
 Deploy your app 

 Connect from ChatGPT 

 Test your integration 

 Submit your app 

 Guides 
 
 Optimize Metadata 

 Security & Privacy 

 Troubleshooting 

 Resources 
 
 Changelog 

 App submission guidelines 

 Reference 

 Home 

 Guides 
 
 Get started 

 Best practices 

 File Upload 
 
 Overview 

 Products 

 API 
 
 Overview 

 Feeds 

 Products 

 Promotions 

 Showcase Blog Cookbook Learn Community 

 Home 

 API examples 

 All posts 

 Recent 
 
 How Perplexity Brought Voice Search to Millions Using the Realtime API 

 Designing delightful frontends with GPT-5.4 

 From prompts to products: One year of Responses 

 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 Topics 
 
 General 

 API 

 Apps SDK 

 Audio 

 Codex 

 Home 

 Topics 
 
 Agents 

 Evals 

 Multimodal 

 Text 

 Guardrails 

 Optimization 

 ChatGPT 

 Codex 

 gpt-oss 

 Contribute 
 
 Cookbook on GitHub 

 Home 

 Docs MCP 

 Categories 
 
 Demo apps 

 Videos 

 Topics 
 
 Agents 

 Audio & Voice 

 Computer Use 

 Codex 

 Evals 

 gpt-oss 

 Fine-tuning 

 Image generation 

 Scaling 

 Tools 

 Video generation 

 Community 

 Programs 
 
 Codex Ambassadors 

 Codex for Students 

 Codex for Open Source 

 Events 
 
 Meetups 

 Hackathon Support 

 Forum 

 Discord 

API Dashboard

Getting Started
 
 Overview 

 Quickstart 

 Explore use cases 

 Pricing 

 Concepts 
 Prompting 

 Customization 

 Memories 
 Chronicle 

 Sandboxing 

 Subagents 

 Workflows 

 Models 

 Cyber Safety 

Using Codex
 
 App 
 Overview 

 Features 

 Settings 

 Review 

 Automations 

 Worktrees 

 Local Environments 

 In-app browser 

 Computer Use 

 Commands 

 Windows 

 Troubleshooting 

 IDE Extension 
 Overview 

 Features 

 Settings 

 IDE Commands 

 Slash commands 

 CLI 
 Overview 

 Features 

 Command Line Options 

 Slash commands 

 Web 
 Overview 

 Environments 

 Internet Access 

 Integrations 
 GitHub 

 Slack 

 Linear 

 Codex Security 
 Overview 

 Setup 

 Improving the threat model 

 FAQ 

Configuration
 
 Config File 
 Config Basics 

 Advanced Config 

 Config Reference 

 Sample Config 

 Speed 

 Rules 

 Hooks 

 AGENTS.md 

 MCP 

 Plugins 
 Overview 

 Build plugins 

 Skills 

 Subagents 

Administration
 
 Authentication 

 Agent approvals & security 

 Remote connections 

 Enterprise 
 Admin Setup 

 Governance 

 Managed configuration 

 Windows 

Automation
 
 Non-interactive Mode 

 Codex SDK 

 App Server 

 MCP Server 

 GitHub Action 

Learn
 
 Best practices 

 Videos 

 Community 

 Blog 
 Using skills to accelerate OSS maintenance 

 Building frontend UIs with Codex and Figma 

 View all 

 Cookbooks 
 Codex Prompting Guide 

 Modernizing your Codebase with Codex 

 View all 

 Building AI Teams 

Releases
 
 Changelog 

 Feature Maturity 

 Open Source 

 Copy Page 

 Codex App Server 
 
Embed Codex into your product with the app-server protocol

 Copy Page 

Codex app-server is the interface Codex uses to power rich clients (for example, the Codex VS Code extension). Use it when you want a deep integration inside your own product: authentication, conversation history, approvals, and streamed agent events. The app-server implementation is open source in the Codex GitHub repository (openai/codex/codex-rs/app-server). See the Open Source page for the full list of open-source Codex components.

If you are automating jobs or running Codex in CI, use the
Codex SDK instead.

Protocol

Like MCP, codex app-server supports bidirectional communication using JSON-RPC 2.0 messages (with the "jsonrpc":"2.0" header omitted on the wire).

Supported transports:

stdio (--listen stdio://, default): newline-delimited JSON (JSONL).

websocket (--listen ws://IP:PORT, experimental and unsupported): one JSON-RPC message per WebSocket text frame.

off (--listen off): don’t expose a local transport.

When you run with --listen ws://IP:PORT, the same listener also serves basic HTTP health probes:

GET /readyz returns 200 OK once the listener accepts new connections.

GET /healthz returns 200 OK when the request doesn’t include an Origin header.

Requests with an Origin header are rejected with 403 Forbidden.

WebSocket transport is experimental and unsupported. Loopback listeners such as ws://127.0.0.1:PORT are appropriate for localhost and SSH port-forwarding workflows. Non-loopback WebSocket listeners currently allow unauthenticated connections by default during rollout, so configure WebSocket auth before exposing one remotely.

Supported WebSocket auth flags:

--ws-auth capability-token --ws-token-file /absolute/path

--ws-auth capability-token --ws-token-sha256 HEX

--ws-auth signed-bearer-token --ws-shared-secret-file /absolute/path

For signed bearer tokens, you can also set --ws-issuer, --ws-audience, and --ws-max-clock-skew-seconds. Clients present the credential as Authorization: Bearer <token> during the WebSocket handshake, and app-server enforces auth before JSON-RPC initialize.

Prefer --ws-token-file over passing raw bearer tokens on the command line. Use --ws-token-sha256 only when the client keeps the raw high-entropy token in a separate local secret store; the hash is only a verifier, and clients still need the original token.

In WebSocket mode, app-server uses bounded queues. When request ingress is full, the server rejects new requests with JSON-RPC error code -32001 and message "Server overloaded; retry later." Clients should retry with an exponentially increasing delay and jitter.

Message schema

Requests include method, params, and id:

{ "method": "thread/start", "id": 10, "params": { "model": "gpt-5.4" } }

Responses echo the id with either result or error:

{ "id": 10, "result": { "thread": { "id": "thr_123" } } }
{ "id": 10, "error": { "code": 123, "message": "Something went wrong" } }

Notifications omit id and use only method and params:

{ "method": "turn/started", "params": { "turn": { "id": "turn_456" } } }

You can generate a TypeScript schema or a JSON Schema bundle from the CLI. Each output is specific to the Codex version you ran, so the generated artifacts match that version exactly:

codex app-server generate-ts --out ./schemas
codex app-server generate-json-schema --out ./schemas

Getting started

Start the server with codex app-server (default stdio transport) or codex app-server --listen ws://127.0.0.1:4500 (experimental WebSocket transport).

Connect a client over the selected transport, then send initialize followed by the initialized notification.

Start a thread and a turn, then keep reading notifications from the active transport stream.

Example (Node.js / TypeScript):

import { spawn } from "node:child_process";
import readline from "node:readline";

const proc = spawn("codex", ["app-server"], {
 stdio: ["pipe", "pipe", "inherit"],
});
const rl = readline.createInterface({ input: proc.stdout });

const send = (message: unknown) => {
 proc.stdin.write(`${JSON.stringify(message)}\n`);
};

let threadId: string | null = null;

rl.on("line", (line) => {
 const msg = JSON.parse(line) as any;
 console.log("server:", msg);

 if (msg.id === 1 && msg.result?.thread?.id && !threadId) {
 threadId = msg.result.thread.id;
 send({
 method: "turn/start",
 id: 2,
 params: {
 threadId,
 input: [{ type: "text", text: "Summarize this repo." }],
 },
 });
 }
});

send({
 method: "initialize",
 id: 0,
 params: {
 clientInfo: {
 name: "my_product",
 title: "My Product",
 version: "0.1.0",
 },
 },
});
send({ method: "initialized", params: {} });
send({ method: "thread/start", id: 1, params: { model: "gpt-5.4" } });

Core primitives

Thread: A conversation between a user and the Codex agent. Threads contain turns.

Turn: A single user request and the agent work that follows. Turns contain items and stream incremental updates.

Item: A unit of input or output (user message, agent message, command runs, file change, tool call, and more).

Use the thread APIs to create, list, or archive conversations. Drive a conversation with turn APIs and stream progress via turn notifications.

Lifecycle overview

Initialize once per connection: Immediately after opening a transport connection, send an initialize request with your client metadata, then emit initialized. The server rejects any request on that connection before this handshake.

Start (or resume) a thread: Call thread/start for a new conversation, thread/resume to continue an existing one, or thread/fork to branch history into a new thread id.

Begin a turn: Call turn/start with the target threadId and user input. Optional fields override model, personality, cwd, sandbox policy, and more.

Steer an active turn: Call turn/steer to append user input to the currently in-flight turn without creating a new turn.

Stream events: After turn/start, keep reading notifications on stdout: thread/archived, thread/unarchived, item/started, item/completed, item/agentMessage/delta, tool progress, and other updates.

Finish the turn: The server emits turn/completed with final status when the model finishes or after a turn/interrupt cancellation.

Initialization

Clients must send a single initialize request per transport connection before invoking any other method on that connection, then acknowledge with an initialized notification. Requests sent before initialization receive a Not initialized error, and repeated initialize calls on the same connection return Already initialized.

The server returns the user agent string it will present to upstream services plus platformFamily and platformOs values that describe the runtime target. Set clientInfo to identify your integration.

initialize.params.capabilities also supports per-connection notification opt-out via optOutNotificationMethods, which is a list of exact method names to suppress for that connection. Matching is exact (no wildcards/prefixes). Unknown method names are accepted and ignored.

Important: Use clientInfo.name to identify your client for the OpenAI Compliance Logs Platform. If you are developing a new Codex integration intended for enterprise use, please contact OpenAI to get it added to a known clients list. For more context, see the Codex logs reference.

Example (from the Codex VS Code extension):

{
 "method": "initialize",
 "id": 0,
 "params": {
 "clientInfo": {
 "name": "codex_vscode",
 "title": "Codex VS Code Extension",
 "version": "0.1.0"
 }
 }
}

Example with notification opt-out:

{
 "method": "initialize",
 "id": 1,
 "params": {
 "clientInfo": {
 "name": "my_client",
 "title": "My Client",
 "version": "0.1.0"
 },
 "capabilities": {
 "experimentalApi": true,
 "optOutNotificationMethods": ["thread/started", "item/agentMessage/delta"]
 }
 }
}

Experimental API opt-in

Some app-server methods and fields are intentionally gated behind experimentalApi capability.

Omit capabilities (or set experimentalApi to false) to stay on the stable API surface, and the server rejects experimental methods/fields.

Set capabilities.experimentalApi to true to enable experimental methods and fields.

{
 "method": "initialize",
 "id": 1,
 "params": {
 "clientInfo": {
 "name": "my_client",
 "title": "My Client",
 "version": "0.1.0"
 },
 "capabilities": {
 "experimentalApi": true
 }
 }
}

If a client sends an experimental method or field without opting in, app-server rejects it with:

<descriptor> requires experimentalApi capability

API overview

thread/start - create a new thread; emits thread/started and automatically subscribes you to turn/item events for that thread.

thread/resume - reopen an existing thread by id so later turn/start calls append to it.

thread/fork - fork a thread into a new thread id by copying stored history; emits thread/started for the new thread.

thread/read - read a stored thread by id without resuming it; set includeTurns to return full turn history. Returned thread objects include runtime status.

thread/list - page through stored thread logs; supports cursor-based pagination plus modelProviders, sourceKinds, archived, cwd, and searchTerm filters. Returned thread objects include runtime status.

thread/turns/list - page through a stored thread’s turn history without resuming it.

thread/loaded/list - list the thread ids currently loaded in memory.

thread/name/set - set or update a thread’s user-facing name for a loaded thread or a persisted rollout; emits thread/name/updated.

thread/metadata/update - patch SQLite-backed stored thread metadata; currently supports persisted gitInfo.

thread/archive - move a thread’s log file into the archived directory; returns {} on success and emits thread/archived.

thread/unsubscribe - unsubscribe this connection from thread turn/item events. If this was the last subscriber, the server unloads the thread after a no-subscriber inactivity grace period and emits thread/closed.

thread/unarchive - restore an archived thread rollout back into the active sessions directory; returns the restored thread and emits thread/unarchived.

thread/status/changed - notification emitted when a loaded thread’s runtime status changes.

thread/compact/start - trigger conversation history compaction for a thread; returns {} immediately while progress streams via turn/* and item/* notifications.

thread/shellCommand - run a user-initiated shell command against a thread. This runs outside the sandbox with full access and doesn’t inherit the thread sandbox policy.

thread/backgroundTerminals/clean - stop all running background terminals for a thread (experimental; requires capabilities.experimentalApi).

thread/rollback - drop the last N turns from the in-memory context and persist a rollback marker; returns the updated thread.

turn/start - add user input to a thread and begin Codex generation; responds with the initial turn and streams events. For collaborationMode, settings.developer_instructions: null means “use built-in instructions for the selected mode.”

thread/inject_items - append raw Responses API items to a loaded thread’s model-visible history without starting a user turn.

turn/steer - append user input to the active in-flight turn for a thread; returns the accepted turnId.

turn/interrupt - request cancellation of an in-flight turn; success is {} and the turn ends with status: "interrupted".

review/start - kick off the Codex reviewer for a thread; emits enteredReviewMode and exitedReviewMode items.

command/exec - run a single command under the server sandbox without starting a thread/turn.

command/exec/write - write stdin bytes to a running command/exec session or close stdin.

command/exec/resize - resize a running PTY-backed command/exec session.

command/exec/terminate - stop a running command/exec session.

command/exec/outputDelta (notify) - emitted for base64-encoded stdout/stderr chunks from a streaming command/exec session.

model/list - list available models (set includeHidden: true to include entries with hidden: true) with effort options, optional upgrade, and inputModalities.

experimentalFeature/list - list feature flags with lifecycle stage metadata and cursor pagination.

experimentalFeature/enablement/set - patch in-memory runtime enablement for supported feature keys such as apps and plugins.

collaborationMode/list - list collaboration mode presets (experimental, no pagination).

skills/list - list skills for one or more cwd values (supports forceReload and optional perCwdExtraUserRoots).

skills/changed (notify) - emitted when watched local skill files change.

marketplace/add - add a remote plugin marketplace and persist it into the user’s marketplace config.

plugin/list - list discovered plugin marketplaces and plugin state, including install/auth policy metadata, marketplace load errors, featured plugin ids, and local, Git, or remote plugin source metadata.

plugin/read - read one plugin by marketplace path or remote marketplace name and plugin name, including bundled skills, apps, and MCP server names when those details are available.

plugin/install - install a plugin from a marketplace path or remote marketplace name.

plugin/uninstall - uninstall an installed plugin.

app/list - list available apps (connectors) with pagination plus accessibility/enabled metadata.

skills/config/write - enable or disable skills by path.

mcpServer/oauth/login - start an OAuth login for a configured MCP server; returns an authorization URL and emits mcpServer/oauthLogin/completed on completion.

tool/requestUserInput - prompt the user with 1-3 short questions for a tool call (experimental); questions can set isOther for a free-form option.

config/mcpServer/reload - reload MCP server configuration from disk and queue a refresh for loaded threads.

mcpServerStatus/list - list MCP servers, tools, resources, and auth status (cursor + limit pagination). Use detail: "full" for full data or detail: "toolsAndAuthOnly" to omit resources.

mcpServer/resource/read - read a single MCP resource through an initialized MCP server.

mcpServer/tool/call - call a tool on a thread’s configured MCP server.

mcpServer/startupStatus/updated (notify) - emitted when a configured MCP server’s startup status changes for a loaded thread.

windowsSandbox/setupStart - start Windows sandbox setup for elevated or unelevated mode; returns quickly and later emits windowsSandbox/setupCompleted.

feedback/upload - submit a feedback report (classification + optional reason/logs + conversation id, plus optional extraLogFiles attachments).

config/read - fetch the effective configuration on disk after resolving configuration layering.

externalAgentConfig/detect - detect external-agent artifacts that can be migrated with includeHome and optional cwds; each detected item includes cwd (null for home).

externalAgentConfig/import - apply selected external-agent migration items by passing explicit migrationItems with cwd (null for home); plugin imports emit externalAgentConfig/import/completed.

config/value/write - write a single configuration key/value to the user’s config.toml on disk.

config/batchWrite - apply configuration edits atomically to the user’s config.toml on disk.

configRequirements/read - fetch requirements from requirements.toml and/or MDM, including allow-lists, pinned featureRequirements, and residency/network requirements (or null if you haven’t set any up).

fs/readFile, fs/writeFile, fs/createDirectory, fs/getMetadata, fs/readDirectory, fs/remove, fs/copy, fs/watch, fs/unwatch, and fs/changed (notify) - operate on absolute filesystem paths through the app-server v2 filesystem API.

Plugin summaries include a source union. Local plugins return
{ "type": "local", "path": ... }, Git-backed marketplace entries return
{ "type": "git", "url": ..., "path": ..., "refName": ..., "sha": ... },
and remote catalog entries return { "type": "remote" }. For remote-only
catalog entries, PluginMarketplaceEntry.path can be null; pass
remoteMarketplaceName instead of marketplacePath when reading or installing
those plugins.

Models

List models (model/list)

Call model/list to discover available models and their capabilities before rendering model or personality selectors.

{ "method": "model/list", "id": 6, "params": { "limit": 20, "includeHidden": false } }
{ "id": 6, "result": {
 "data": [{
 "id": "gpt-5.4",
 "model": "gpt-5.4",
 "displayName": "GPT-5.4",
 "hidden": false,
 "defaultReasoningEffort": "medium",
 "supportedReasoningEfforts": [{
 "reasoningEffort": "low",
 "description": "Lower latency"
 }],
 "inputModalities": ["text", "image"],
 "supportsPersonality": true,
 "isDefault": true
 }],
 "nextCursor": null
} }

Each model entry can include:

supportedReasoningEfforts - supported effort options for the model.

defaultReasoningEffort - suggested default effort for clients.

upgrade - optional recommended upgrade model id for migration prompts in clients.

upgradeInfo - optional upgrade metadata for migration prompts in clients.

hidden - whether the model is hidden from the default picker list.

inputModalities - supported input types for the model (for example text, image).

supportsPersonality - whether the model supports personality-specific instructions such as /personality.

isDefault - whether the model is the recommended default.

By default, model/list returns picker-visible models only. Set includeHidden: true if you need the full list and want to filter on the client side using hidden.

When inputModalities is missing (older model catalogs), treat it as ["text", "image"] for backward compatibility.

List experimental features (experimentalFeature/list)

Use this endpoint to discover feature flags with metadata and lifecycle stage:

{ "method": "experimentalFeature/list", "id": 7, "params": { "limit": 20 } }
{ "id": 7, "result": {
 "data": [{
 "name": "unified_exec",
 "stage": "beta",
 "displayName": "Unified exec",
 "description": "Use the unified PTY-backed execution tool.",
 "announcement": "Beta rollout for improved command execution reliability.",
 "enabled": false,
 "defaultEnabled": false
 }],
 "nextCursor": null
} }

stage can be beta, underDevelopment, stable, deprecated, or removed. For non-beta flags, displayName, description, and announcement may be null.

Threads

thread/read reads a stored thread without subscribing to it; set includeTurns to include turns.

thread/turns/list pages through a stored thread’s turn history without resuming it.

thread/list supports cursor pagination plus modelProviders, sourceKinds, archived, cwd, and searchTerm filtering.

thread/loaded/list returns the thread IDs currently in memory.

thread/archive moves the thread’s persisted JSONL log into the archived directory.

thread/metadata/update patches stored thread metadata, currently including persisted gitInfo.

thread/unsubscribe unsubscribes the current connection from a loaded thread and can trigger thread/closed after an inactivity grace period.

thread/unarchive restores an archived thread rollout back into the active sessions directory.

thread/compact/start triggers compaction and returns {} immediately.

thread/rollback drops the last N turns from the in-memory context and records a rollback marker in the thread’s persisted JSONL log.

thread/inject_items appends raw Responses API items to a loaded thread’s model-visible history without starting a user turn.

Start or resume a thread

Start a fresh thread when you need a new Codex conversation.

{ "method": "thread/start", "id": 10, "params": {
 "model": "gpt-5.4",
 "cwd": "/Users/me/project",
 "approvalPolicy": "never",
 "sandbox": "workspaceWrite",
 "personality": "friendly",
 "serviceName": "my_app_server_client"
} }
{ "id": 10, "result": {
 "thread": {
 "id": "thr_123",
 "preview": "",
 "ephemeral": false,
 "modelProvider": "openai",
 "createdAt": 1730910000
 }
} }
{ "method": "thread/started", "params": { "thread": { "id": "thr_123" } } }

serviceName is optional. Set it when you want app-server to tag thread-level metrics with your integration’s service name.

To continue a stored session, call thread/resume with the thread.id you recorded earlier. The response shape matches thread/start. You can also pass the same configuration overrides supported by thread/start, such as personality:

{ "method": "thread/resume", "id": 11, "params": {
 "threadId": "thr_123",
 "personality": "friendly"
} }
{ "id": 11, "result": { "thread": { "id": "thr_123", "name": "Bug bash notes", "ephemeral": false } } }

Resuming a thread doesn’t update thread.updatedAt (or the rollout file’s modified time) by itself. The timestamp updates when you start a turn.

If you mark an enabled MCP server as required in config and that server fails to initialize, thread/start and thread/resume fail instead of continuing without it.

dynamicTools on thread/start is an experimental field (requires capabilities.experimentalApi = true). Codex persists these dynamic tools in the thread rollout metadata and restores them on thread/resume when you don’t supply new dynamic tools.

If you resume with a different model than the one recorded in the rollout, Codex emits a warning and applies a one-time model-switch instruction on the next turn.

To branch from a stored session, call thread/fork with the thread.id. This creates a new thread id and emits a thread/started notification for it:

{ "method": "thread/fork", "id": 12, "params": { "threadId": "thr_123" } }
{ "id": 12, "result": { "thread": { "id": "thr_456" } } }
{ "method": "thread/started", "params": { "thread": { "id": "thr_456" } } }

When a user-facing thread title has been set, app-server hydrates thread.name on thread/list, thread/read, thread/resume, thread/unarchive, and thread/rollback responses. thread/start and thread/fork may omit name (or return null) until a title is set later.

Read a stored thread (without resuming)

Use thread/read when you want stored thread data but don’t want to resume the thread or subscribe to its events.

includeTurns - when true, the response includes the thread’s turns; when false or omitted, you get the thread summary only.

Returned thread objects include runtime status (notLoaded, idle, systemError, or active with activeFlags).

{ "method": "thread/read", "id": 19, "params": { "threadId": "thr_123", "includeTurns": true } }
{ "id": 19, "result": { "thread": { "id": "thr_123", "name": "Bug bash notes", "ephemeral": false, "status": { "type": "notLoaded" }, "turns": [] } } }

Unlike thread/resume, thread/read doesn’t load the thread into memory or emit thread/started.

List thread turns

Use thread/turns/list to page a stored thread’s turn history without resuming it. Results default to newest-first so clients can fetch older turns with nextCursor. The response also includes backwardsCursor; pass it as cursor with sortDirection: "asc" to fetch turns newer than the first item from the earlier page.

{ "method": "thread/turns/list", "id": 20, "params": {
 "threadId": "thr_123",
 "limit": 50,
 "sortDirection": "desc"
} }
{ "id": 20, "result": {
 "data": [],
 "nextCursor": "older-turns-cursor-or-null",
 "backwardsCursor": "newer-turns-cursor-or-null"
} }

List threads (with pagination & filters)

thread/list lets you render a history UI. Results default to newest-first by createdAt. Filters apply before pagination. Pass any combination of:

cursor - opaque string from a prior response; omit for the first page.

limit - server defaults to a reasonable page size if unset.

sortKey - created_at (default) or updated_at.

modelProviders - restrict results to specific providers; unset, null, or an empty array includes all providers.

sourceKinds - restrict results to specific thread sources. When omitted or [], the server defaults to interactive sources only: cli and vscode.

archived - when true, list archived threads only. When false or omitted, list non-archived threads (default).

cwd - restrict results to threads whose session current working directory exactly matches this path.

searchTerm - search stored thread summaries and metadata before pagination.

sourceKinds accepts the following values:

cli

vscode

exec

appServer

subAgent

subAgentReview

subAgentCompact

subAgentThreadSpawn

subAgentOther

unknown

Example:

{ "method": "thread/list", "id": 20, "params": {
 "cursor": null,
 "limit": 25,
 "sortKey": "created_at"
} }
{ "id": 20, "result": {
 "data": [
 { "id": "thr_a", "preview": "Create a TUI", "ephemeral": false, "modelProvider": "openai", "createdAt": 1730831111, "updatedAt": 1730831111, "name": "TUI prototype", "status": { "type": "notLoaded" } },
 { "id": "thr_b", "preview": "Fix tests", "ephemeral": true, "modelProvider": "openai", "createdAt": 1730750000, "updatedAt": 1730750000, "status": { "type": "notLoaded" } }
 ],
 "nextCursor": "opaque-token-or-null"
} }

When nextCursor is null, you have reached the final page.

Update stored thread metadata

Use thread/metadata/update to patch stored thread metadata without resuming the thread. Today this supports persisted gitInfo; omitted fields are left unchanged, and explicit null clears a stored value.

{ "method": "thread/metadata/update", "id": 21, "params": {
 "threadId": "thr_123",
 "gitInfo": { "branch": "feature/sidebar-pr" }
} }
{ "id": 21, "result": {
 "thread": {
 "id": "thr_123",
 "gitInfo": { "sha": null, "branch": "feature/sidebar-pr", "originUrl": null }
 }
} }

Track thread status changes

thread/status/changed is emitted whenever a loaded thread’s runtime status changes. The payload includes threadId and the new status.

{
 "method": "thread/status/changed",
 "params": {
 "threadId": "thr_123",
 "status": { "type": "active", "activeFlags": ["waitingOnApproval"] }
 }
}

List loaded threads

thread/loaded/list returns thread IDs currently loaded in memory.

{ "method": "thread/loaded/list", "id": 21 }
{ "id": 21, "result": { "data": ["thr_123", "thr_456"] } }

Unsubscribe from a loaded thread

thread/unsubscribe removes the current connection’s subscription to a thread. The response status is one of:

unsubscribed when the connection was subscribed and is now removed.

notSubscribed when the connection wasn’t subscribed to that thread.

notLoaded when the thread isn’t loaded.

If this was the last subscriber, the server keeps the thread loaded until it has no subscribers and no thread activity for 30 minutes. When the grace period expires, app-server unloads the thread and emits a thread/status/changed transition to notLoaded plus thread/closed.

{ "method": "thread/unsubscribe", "id": 22, "params": { "threadId": "thr_123" } }
{ "id": 22, "result": { "status": "unsubscribed" } }

If the thread later expires:

{ "method": "thread/status/changed", "params": {
 "threadId": "thr_123",
 "status": { "type": "notLoaded" }
} }
{ "method": "thread/closed", "params": { "threadId": "thr_123" } }

Archive a thread

Use thread/archive to move the persisted thread log (stored as a JSONL file on disk) into the archived sessions directory.

{ "method": "thread/archive", "id": 22, "params": { "threadId": "thr_b" } }
{ "id": 22, "result": {} }
{ "method": "thread/archived", "params": { "threadId": "thr_b" } }

Archived threads won’t appear in future calls to thread/list unless you pass archived: true.

Unarchive a thread

Use thread/unarchive to move an archived thread rollout back into the active sessions directory.

{ "method": "thread/unarchive", "id": 24, "params": { "threadId": "thr_b" } }
{ "id": 24, "result": { "thread": { "id": "thr_b", "name": "Bug bash notes" } } }
{ "method": "thread/unarchived", "params": { "threadId": "thr_b" } }

Trigger thread compaction

Use thread/compact/start to trigger manual history compaction for a thread. The request returns immediately with {}.

App-server emits progress as standard turn/* and item/* notifications on the same threadId, including a contextCompaction item lifecycle (item/started then item/completed).

{ "method": "thread/compact/start", "id": 25, "params": { "threadId": "thr_b" } }
{ "id": 25, "result": {} }

Run a thread shell command

Use thread/shellCommand for user-initiated shell commands that belong to a thread. The request returns immediately with {} while progress streams through standard turn/* and item/* notifications.

This API runs outside the sandbox with full access and doesn’t inherit the thread sandbox policy. Clients should expose it only for explicit user-initiated commands.

If the thread already has an active turn, the command runs as an auxiliary action on that turn and its formatted output is injected into the turn’s message stream. If the thread is idle, app-server starts a standalone turn for the shell command.

{ "method": "thread/shellCommand", "id": 26, "params": { "threadId": "thr_b", "command": "git status --short" } }
{ "id": 26, "result": {} }

Clean background terminals

Use thread/backgroundTerminals/clean to stop all running background terminals associated with a thread. This method is experimental and requires capabilities.experimentalApi = true.

{ "method": "thread/backgroundTerminals/clean", "id": 27, "params": { "threadId": "thr_b" } }
{ "id": 27, "result": {} }

Roll back recent turns

Use thread/rollback to remove the last numTurns entries from the in-memory context and persist a rollback marker in the rollout log. The returned thread includes turns populated after the rollback.

{ "method": "thread/rollback", "id": 28, "params": { "threadId": "thr_b", "numTurns": 1 } }
{ "id": 28, "result": { "thread": { "id": "thr_b", "name": "Bug bash notes", "ephemeral": false } } }

Turns

The input field accepts a list of items:

{ "type": "text", "text": "Explain this diff" }

{ "type": "image", "url": "https://.../design.png" }

{ "type": "localImage", "path": "/tmp/screenshot.png" }

You can override configuration settings per turn (model, effort, personality, cwd, sandbox policy, summary). When specified, these settings become the defaults for later turns on the same thread. outputSchema applies only to the current turn. For sandboxPolicy.type = "externalSandbox", set networkAccess to restricted or enabled; for workspaceWrite, networkAccess remains a boolean.

For turn/start.collaborationMode, settings.developer_instructions: null means “use built-in instructions for the selected mode” rather than clearing mode instructions.

Sandbox read access (ReadOnlyAccess)

sandboxPolicy supports explicit read-access controls:

readOnly: optional access ({ "type": "fullAccess" } by default, or restricted roots).

workspaceWrite: optional readOnlyAccess ({ "type": "fullAccess" } by default, or restricted roots).

Restricted read access shape:

{
 "type": "restricted",
 "includePlatformDefaults": true,
 "readableRoots": ["/Users/me/shared-read-only"]
}

On macOS, includePlatformDefaults: true appends a curated platform-default Seatbelt policy for restricted-read sessions. This improves tool compatibility without broadly allowing all of /System.

Examples:

{ "type": "readOnly", "access": { "type": "fullAccess" } }
{
 "type": "workspaceWrite",
 "writableRoots": ["/Users/me/project"],
 "readOnlyAccess": {
 "type": "restricted",
 "includePlatformDefaults": true,
 "readableRoots": ["/Users/me/shared-read-only"]
 },
 "networkAccess": false
}

Start a turn

{ "method": "turn/start", "id": 30, "params": {
 "threadId": "thr_123",
 "input": [ { "type": "text", "text": "Run tests" } ],
 "cwd": "/Users/me/project",
 "approvalPolicy": "unlessTrusted",
 "sandboxPolicy": {
 "type": "workspaceWrite",
 "writableRoots": ["/Users/me/project"],
 "networkAccess": true
 },
 "model": "gpt-5.4",
 "effort": "medium",
 "summary": "concise",
 "personality": "friendly",
 "outputSchema": {
 "type": "object",
 "properties": { "answer": { "type": "string" } },
 "required": ["answer"],
 "additionalProperties": false
 }
} }
{ "id": 30, "result": { "turn": { "id": "turn_456", "status": "inProgress", "items": [], "error": null } } }

Inject items into a thread

Use thread/inject_items to append prebuilt Responses API items to a loaded thread’s prompt history without starting a user turn. These items are persisted to the rollout and included in subsequent model requests.

{ "method": "thread/inject_items", "id": 31, "params": {
 "threadId": "thr_123",
 "items": [
 {
 "type": "message",
 "role": "assistant",
 "content": [{ "type": "output_text", "text": "Previously computed context." }]
 }
 ]
} }
{ "id": 31, "result": {} }

Steer an active turn

Use turn/steer to append more user input to the active in-flight turn.

Include expectedTurnId; it must match the active turn id.

The request fails if there is no active turn on the thread.

turn/steer doesn’t emit a new turn/started notification.

turn/steer doesn’t accept turn-level overrides (model, cwd, sandboxPolicy, or outputSchema).

{ "method": "turn/steer", "id": 32, "params": {
 "threadId": "thr_123",
 "input": [ { "type": "text", "text": "Actually focus on failing tests first." } ],
 "expectedTurnId": "turn_456"
} }
{ "id": 32, "result": { "turnId": "turn_456" } }

Start a turn (invoke a skill)

Invoke a skill explicitly by including $<skill-name> in the text input and adding a skill input item alongside it.

{ "method": "turn/start", "id": 33, "params": {
 "threadId": "thr_123",
 "input": [
 { "type": "text", "text": "$skill-creator Add a new skill for triaging flaky CI and include step-by-step usage." },
 { "type": "skill", "name": "skill-creator", "path": "/Users/me/.codex/skills/skill-creator/SKILL.md" }
 ]
} }
{ "id": 33, "result": { "turn": { "id": "turn_457", "status": "inProgress", "items": [], "error": null } } }

Interrupt a turn

{ "method": "turn/interrupt", "id": 31, "params": { "threadId": "thr_123", "turnId": "turn_456" } }
{ "id": 31, "result": {} }

On success, the turn finishes with status: "interrupted".

Review

review/start runs the Codex reviewer for a thread and streams review items. Targets include:

uncommittedChanges

baseBranch (diff against a branch)

commit (review a specific commit)

custom (free-form instructions)

Use delivery: "inline" (default) to run the review on the existing thread, or delivery: "detached" to fork a new review thread.

Example request/response:

{ "method": "review/start", "id": 40, "params": {
 "threadId": "thr_123",
 "delivery": "inline",
 "target": { "type": "commit", "sha": "1234567deadbeef", "title": "Polish tui colors" }
} }
{ "id": 40, "result": {
 "turn": {
 "id": "turn_900",
 "status": "inProgress",
 "items": [
 { "type": "userMessage", "id": "turn_900", "content": [ { "type": "text", "text": "Review commit 1234567: Polish tui colors" } ] }
 ],
 "error": null
 },
 "reviewThreadId": "thr_123"
} }

For a detached review, use "delivery": "detached". The response is the same shape, but reviewThreadId will be the id of the new review thread (different from the original threadId). The server also emits a thread/started notification for that new thread before streaming the review turn.

Codex streams the usual turn/started notification followed by an item/started with an enteredReviewMode item:

{
 "method": "item/started",
 "params": {
 "item": {
 "type": "enteredReviewMode",
 "id": "turn_900",
 "review": "current changes"
 }
 }
}

When the reviewer finishes, the server emits item/started and item/completed containing an exitedReviewMode item with the final review text:

{
 "method": "item/completed",
 "params": {
 "item": {
 "type": "exitedReviewMode",
 "id": "turn_900",
 "review": "Looks solid overall..."
 }
 }
}

Use this notification to render the reviewer output in your client.

Command execution

command/exec runs a single command (argv array) under the server sandbox without creating a thread.

{ "method": "command/exec", "id": 50, "params": {
 "command": ["ls", "-la"],
 "cwd": "/Users/me/project",
 "sandboxPolicy": { "type": "workspaceWrite" },
 "timeoutMs": 10000
} }
{ "id": 50, "result": { "exitCode": 0, "stdout": "...", "stderr": "" } }

Use sandboxPolicy.type = "externalSandbox" if you already sandbox the server process and want Codex to skip its own sandbox enforcement. For external sandbox mode, set networkAccess to restricted (default) or enabled. For readOnly and workspaceWrite, use the same optional access / readOnlyAccess structure shown above.

Notes:

The server rejects empty command arrays.

sandboxPolicy accepts the same shape used by turn/start (for example, dangerFullAccess, readOnly, workspaceWrite, externalSandbox).

When omitted, timeoutMs falls back to the server default.

Set tty: true for PTY-backed sessions, and use processId when you plan to follow up with command/exec/write, command/exec/resize, or command/exec/terminate.

Set streamStdoutStderr: true to receive command/exec/outputDelta notifications while the command is running.

Read admin requirements (configRequirements/read)

Use configRequirements/read to inspect the effective admin requirements loaded from requirements.toml and/or MDM.

{ "method": "configRequirements/read", "id": 52, "params": {} }
{ "id": 52, "result": {
 "requirements": {
 "allowedApprovalPolicies": ["onRequest", "unlessTrusted"],
 "allowedSandboxModes": ["readOnly", "workspaceWrite"],
 "featureRequirements": {
 "personality": true,
 "unified_exec": false
 },
 "network": {
 "enabled": true,
 "allowedDomains": ["api.openai.com"],
 "allowUnixSockets": ["/tmp/example.sock"],
 "dangerouslyAllowAllUnixSockets": false
 }
 }
} }

result.requirements is null when no requirements are configured. See the docs on requirements.toml for details on supported keys and values.

Windows sandbox setup (windowsSandbox/setupStart)

Custom Windows clients can trigger sandbox setup asynchronously instead of blocking on startup checks.

{ "method": "windowsSandbox/setupStart", "id": 53, "params": { "mode": "elevated" } }
{ "id": 53, "result": { "started": true } }

App-server starts setup in the background and later emits a completion notification:

{
 "method": "windowsSandbox/setupCompleted",
 "params": { "mode": "elevated", "success": true, "error": null }
}

Modes:

elevated - run the elevated Windows sandbox setup path.

unelevated - run the legacy setup/preflight path.

Filesystem

The v2 filesystem APIs operate on absolute paths. Use fs/watch when a client needs to invalidate UI state after a file or directory changes.

{ "method": "fs/watch", "id": 54, "params": {
 "watchId": "0195ec6b-1d6f-7c2e-8c7a-56f2c4a8b9d1",
 "path": "/Users/me/project/.git/HEAD"
} }
{ "id": 54, "result": { "path": "/Users/me/project/.git/HEAD" } }
{ "method": "fs/changed", "params": {
 "watchId": "0195ec6b-1d6f-7c2e-8c7a-56f2c4a8b9d1",
 "changedPaths": ["/Users/me/project/.git/HEAD"]
} }
{ "method": "fs/unwatch", "id": 55, "params": {
 "watchId": "0195ec6b-1d6f-7c2e-8c7a-56f2c4a8b9d1"
} }
{ "id": 55, "result": {} }

Watching a file emits fs/changed for that file path, including updates delivered by replace or rename operations.

Events

Event notifications are the server-initiated stream for thread lifecycles, turn lifecycles, and the items within them. After you start or resume a thread, keep reading the active transport stream for thread/started, thread/archived, thread/unarchived, thread/closed, thread/status/changed, turn/*, item/*, and serverRequest/resolved notifications.

Notification opt-out

Clients can suppress specific notifications per connection by sending exact method names in initialize.params.capabilities.optOutNotificationMethods.

Exact-match only: item/agentMessage/delta suppresses only that method.

Unknown method names are ignored.

Applies to the current thread/*, turn/*, item/*, and related v2 notifications.

Doesn’t apply to requests, responses, or errors.

Fuzzy file search events (experimental)

The fuzzy file search session API emits per-query notifications:

fuzzyFileSearch/sessionUpdated - { sessionId, query, files } with the current matches for the active query.

fuzzyFileSearch/sessionCompleted - { sessionId } once indexing and matching for that query completes.

Windows sandbox setup events

windowsSandbox/setupCompleted - { mode, success, error } emitted after a windowsSandbox/setupStart request finishes.

Turn events

turn/started - { turn } with the turn id, empty items, and status: "inProgress".

turn/completed - { turn } where turn.status is completed, interrupted, or failed; failures carry { error: { message, codexErrorInfo?, additionalDetails? } }.

turn/diff/updated - { threadId, turnId, diff } with the latest aggregated unified diff across every file change in the turn.

turn/plan/updated - { turnId, explanation?, plan } whenever the agent shares or changes its plan; each plan entry is { step, status } with status in pending, inProgress, or completed.

thread/tokenUsage/updated - usage updates for the active thread.

turn/diff/updated and turn/plan/updated currently include empty items arrays even when item events stream. Use item/* notifications as the source of truth for turn items.

Items

ThreadItem is the tagged union carried in turn responses and item/* notifications. Common item types include:

userMessage - {id, content} where content is a list of user inputs (text, image, or localImage).

agentMessage - {id, text, phase?} containing the accumulated agent reply. When present, phase uses Responses API wire values (commentary, final_answer).

plan - {id, text} containing proposed plan text in plan mode. Treat the final plan item from item/completed as authoritative.

reasoning - {id, summary, content} where summary holds streamed reasoning summaries and content holds raw reasoning blocks.

commandExecution - {id, command, cwd, status, commandActions, aggregatedOutput?, exitCode?, durationMs?}.

fileChange - {id, changes, status} describing proposed edits; changes list {path, kind, diff}.

mcpToolCall - {id, server, tool, status, arguments, result?, error?}.

dynamicToolCall - {id, tool, arguments, status, contentItems?, success?, durationMs?} for client-executed dynamic tool invocations.

collabToolCall - {id, tool, status, senderThreadId, receiverThreadId?, newThreadId?, prompt?, agentStatus?}.

webSearch - {id, query, action?} for web search requests issued by the agent.

imageView - {id, path} emitted when the agent invokes the image viewer tool.

enteredReviewMode - {id, review} sent when the reviewer starts.

exitedReviewMode - {id, review} emitted when the reviewer finishes.

contextCompaction - {id} emitted when Codex compacts the conversation history.

For webSearch.action, the action type can be search (query?, queries?), openPage (url?), or findInPage (url?, pattern?).

The app server deprecates the legacy thread/compacted notification; use the contextCompaction item instead.

All items emit two shared lifecycle events:

item/started - emits the full item when a new unit of work begins; the item.id matches the itemId used by deltas.

item/completed - sends the final item once work finishes; treat this as the authoritative state.

Item deltas

item/agentMessage/delta - appends streamed text for the agent message.

item/plan/delta - streams proposed plan text. The final plan item may not exactly equal the concatenated deltas.

item/reasoning/summaryTextDelta - streams readable reasoning summaries; summaryIndex increments when a new summary section opens.

item/reasoning/summaryPartAdded - marks a boundary between reasoning summary sections.

item/reasoning/textDelta - streams raw reasoning text (when supported by the model).

item/commandExecution/outputDelta - streams stdout/stderr for a command; append deltas in order.

item/fileChange/outputDelta - contains the tool call response of the underlying apply_patch tool call.

Errors

If a turn fails, the server emits an error event with { error: { message, codexErrorInfo?, additionalDetails? } } and then finishes the turn with status: "failed". When an upstream HTTP status is available, it appears in codexErrorInfo.httpStatusCode.

Common codexErrorInfo values include:

ContextWindowExceeded

UsageLimitExceeded

HttpConnectionFailed (4xx/5xx upstream errors)

ResponseStreamConnectionFailed

ResponseStreamDisconnected

ResponseTooManyFailedAttempts

BadRequest, Unauthorized, SandboxError, InternalServerError, Other

When an upstream HTTP status is available, the server forwards it in httpStatusCode on the relevant codexErrorInfo variant.

Approvals

Depending on a user’s Codex settings, command execution and file changes may require approval. The app-server sends a server-initiated JSON-RPC request to the client, and the client responds with a decision payload.

Command execution decisions: accept, acceptForSession, decline, cancel, or { "acceptWithExecpolicyAmendment": { "execpolicy_amendment": ["cmd", "..."] } }.

File change decisions: accept, acceptForSession, decline, cancel.

Requests include threadId and turnId - use them to scope UI state to the active conversation.

The server resumes or declines the work and ends the item with item/completed.

Command execution approvals

Order of messages:

item/started shows the pending commandExecution item with command, cwd, and other fields.

item/commandExecution/requestApproval includes itemId, threadId, turnId, optional reason, optional command, optional cwd, optional commandActions, optional proposedExecpolicyAmendment, optional networkApprovalContext, and optional availableDecisions. When initialize.params.capabilities.experimentalApi = true, the payload can also include experimental additionalPermissions describing requested per-command sandbox access. Any filesystem paths inside additionalPermissions are absolute on the wire.

Client responds with one of the command execution approval decisions above.

serverRequest/resolved confirms that the pending request has been answered or cleared.

item/completed returns the final commandExecution item with status: completed | failed | declined.

When networkApprovalContext is present, the prompt is for managed network access (not a general shell-command approval). The current v2 schema exposes the target host and protocol; clients should render a network-specific prompt and not rely on command being a user-meaningful shell command preview.

Codex groups concurrent network approval prompts by destination (host, protocol, and port). The app-server may therefore send one prompt that unblocks multiple queued requests to the same destination, while different ports on the same host are treated separately.

File change approvals

Order of messages:

item/started emits a fileChange item with proposed changes and status: "inProgress".

item/fileChange/requestApproval includes itemId, threadId, turnId, optional reason, and optional grantRoot.

Client responds with one of the file change approval decisions above.

serverRequest/resolved confirms that the pending request has been answered or cleared.

item/completed returns the final fileChange item with status: completed | failed | declined.

tool/requestUserInput

When the client responds to item/tool/requestUserInput, app-server emits serverRequest/resolved with { threadId, requestId }. If the pending request is cleared by turn start, turn completion, or turn interruption before the client answers, the server emits the same notification for that cleanup.

Dynamic tool calls (experimental)

dynamicTools on thread/start and the corresponding item/tool/call request or response flow are experimental APIs.

When a dynamic tool is invoked during a turn, app-server emits:

item/started with item.type = "dynamicToolCall", status = "inProgress", plus tool and arguments.

item/tool/call as a server request to the client.

The client response payload with returned content items.

item/completed with item.type = "dynamicToolCall", the final status, and any returned contentItems or success value.

MCP tool-call approvals (apps)

App (connector) tool calls can also require approval. When an app tool call has side effects, the server may elicit approval with tool/requestUserInput and options such as Accept, Decline, and Cancel. Destructive tool annotations always trigger approval even when the tool also advertises less-privileged hints. If the user declines or cancels, the related mcpToolCall item completes with an error instead of running the tool.

Skills

Invoke a skill by including $<skill-name> in the user text input. Add a skill input item (recommended) so the server injects full skill instructions instead of relying on the model to resolve the name.

{
 "method": "turn/start",
 "id": 101,
 "params": {
 "threadId": "thread-1",
 "input": [
 {
 "type": "text",
 "text": "$skill-creator Add a new skill for triaging flaky CI."
 },
 {
 "type": "skill",
 "name": "skill-creator",
 "path": "/Users/me/.codex/skills/skill-creator/SKILL.md"
 }
 ]
 }
}

If you omit the skill item, the model will still parse the $<skill-name> marker and try to locate the skill, which can add latency.

Example:

$skill-creator Add a new skill for triaging flaky CI and include step-by-step usage.

Use skills/list to fetch available skills (optionally scoped by cwds, with forceReload). You can also include perCwdExtraUserRoots to scan extra absolute paths as user scope for specific cwd values. App-server ignores entries whose cwd isn’t present in cwds. skills/list may reuse a cached result per cwd; set forceReload: true to refresh from disk. When present, the server reads interface and dependencies from SKILL.json.

{ "method": "skills/list", "id": 25, "params": {
 "cwds": ["/Users/me/project", "/Users/me/other-project"],
 "forceReload": true,
 "perCwdExtraUserRoots": [
 {
 "cwd": "/Users/me/project",
 "extraUserRoots": ["/Users/me/shared-skills"]
 }
 ]
} }
{ "id": 25, "result": {
 "data": [{
 "cwd": "/Users/me/project",
 "skills": [
 {
 "name": "skill-creator",
 "description": "Create or update a Codex skill",
 "enabled": true,
 "interface": {
 "displayName": "Skill Creator",
 "shortDescription": "Create or update a Codex skill"
 },
 "dependencies": {
 "tools": [
 {
 "type": "env_var",
 "value": "GITHUB_TOKEN",
 "description": "GitHub API token"
 },
 {
 "type": "mcp",
 "value": "github",
 "transport": "streamable_http",
 "url": "https://example.com/mcp"
 }
 ]
 }
 }
 ],
 "errors": []
 }]
} }

The server also emits skills/changed notifications when watched local skill files change. Treat this as an invalidation signal and rerun skills/list with your current params when needed.

To enable or disable a skill by path:

{
 "method": "skills/config/write",
 "id": 26,
 "params": {
 "path": "/Users/me/.codex/skills/skill-creator/SKILL.md",
 "enabled": false
 }
}

Apps (connectors)

Use app/list to fetch available apps. In the CLI/TUI, /apps is the user-facing picker; in custom clients, call app/list directly. Each entry includes both isAccessible (available to the user) and isEnabled (enabled in config.toml) so clients can distinguish install/access from local enabled state. App entries can also include optional branding, appMetadata, and labels fields.

{ "method": "app/list", "id": 50, "params": {
 "cursor": null,
 "limit": 50,
 "threadId": "thread-1",
 "forceRefetch": false
} }
{ "id": 50, "result": {
 "data": [
 {
 "id": "demo-app",
 "name": "Demo App",
 "description": "Example connector for documentation.",
 "logoUrl": "https://example.com/demo-app.png",
 "logoUrlDark": null,
 "distributionChannel": null,
 "branding": null,
 "appMetadata": null,
 "labels": null,
 "installUrl": "https://chatgpt.com/apps/demo-app/demo-app",
 "isAccessible": true,
 "isEnabled": true
 }
 ],
 "nextCursor": null
} }

If you provide threadId, app feature gating (features.apps) uses that thread’s config snapshot. When omitted, app-server uses the latest global config.

app/list returns after both accessible apps and directory apps load. Set forceRefetch: true to bypass app caches and fetch fresh data. Cache entries are only replaced when refreshes succeed.

The server also emits app/list/updated notifications whenever either source (accessible apps or directory apps) finishes loading. Each notification includes the latest merged app list.

{
 "method": "app/list/updated",
 "params": {
 "data": [
 {
 "id": "demo-app",
 "name": "Demo App",
 "description": "Example connector for documentation.",
 "logoUrl": "https://example.com/demo-app.png",
 "logoUrlDark": null,
 "distributionChannel": null,
 "branding": null,
 "appMetadata": null,
 "labels": null,
 "installUrl": "https://chatgpt.com/apps/demo-app/demo-app",
 "isAccessible": true,
 "isEnabled": true
 }
 ]
 }
}

Invoke an app by inserting $<app-slug> in the text input and adding a mention input item with the app://<id> path (recommended).

{
 "method": "turn/start",
 "id": 51,
 "params": {
 "threadId": "thread-1",
 "input": [
 {
 "type": "text",
 "text": "$demo-app Pull the latest updates from the team."
 },
 {
 "type": "mention",
 "name": "Demo App",
 "path": "app://demo-app"
 }
 ]
 }
}

Config RPC examples for app settings

Use config/read, config/value/write, and config/batchWrite to inspect or update app controls in config.toml.

Read the effective app config shape (including _default and per-tool overrides):

{ "method": "config/read", "id": 60, "params": { "includeLayers": false } }
{ "id": 60, "result": {
 "config": {
 "apps": {
 "_default": {
 "enabled": true,
 "destructive_enabled": true,
 "open_world_enabled": true
 },
 "google_drive": {
 "enabled": true,
 "destructive_enabled": false,
 "default_tools_approval_mode": "prompt",
 "tools": {
 "files/delete": { "enabled": false, "approval_mode": "approve" }
 }
 }
 }
 }
} }

Update a single app setting:

{
 "method": "config/value/write",
 "id": 61,
 "params": {
 "keyPath": "apps.google_drive.default_tools_approval_mode",
 "value": "prompt",
 "mergeStrategy": "replace"
 }
}

Apply multiple app edits atomically:

{
 "method": "config/batchWrite",
 "id": 62,
 "params": {
 "edits": [
 {
 "keyPath": "apps._default.destructive_enabled",
 "value": false,
 "mergeStrategy": "upsert"
 },
 {
 "keyPath": "apps.google_drive.tools.files/delete.approval_mode",
 "value": "approve",
 "mergeStrategy": "upsert"
 }
 ]
 }
}

Detect and import external agent config

Use externalAgentConfig/detect to discover external-agent artifacts that can be migrated, then pass the selected entries to externalAgentConfig/import.

Detection example:

{ "method": "externalAgentConfig/detect", "id": 63, "params": {
 "includeHome": true,
 "cwds": ["/Users/me/project"]
} }
{ "id": 63, "result": {
 "items": [
 {
 "itemType": "AGENTS_MD",
 "description": "Import /Users/me/project/CLAUDE.md to /Users/me/project/AGENTS.md.",
 "cwd": "/Users/me/project"
 },
 {
 "itemType": "SKILLS",
 "description": "Copy skill folders from /Users/me/.claude/skills to /Users/me/.agents/skills.",
 "cwd": null
 }
 ]
} }

Import example:

{ "method": "externalAgentConfig/import", "id": 64, "params": {
 "migrationItems": [
 {
 "itemType": "AGENTS_MD",
 "description": "Import /Users/me/project/CLAUDE.md to /Users/me/project/AGENTS.md.",
 "cwd": "/Users/me/project"
 }
 ]
} }
{ "id": 64, "result": {} }

When a request includes plugin imports, the server emits externalAgentConfig/import/completed after the import finishes. This notification may arrive immediately after the response or after background remote imports complete.

Supported itemType values are AGENTS_MD, CONFIG, SKILLS, PLUGINS,
and MCP_SERVER_CONFIG. For PLUGINS items, details.plugins lists each
marketplaceName and the pluginNames Codex can try to migrate. Detection
returns only items that still have work to do. For example, Codex skips AGENTS
migration when AGENTS.md already exists and is non-empty, and skill imports
don’t overwrite existing skill directories.

When detecting plugins from .claude/settings.json, Codex reads configured
marketplace sources from extraKnownMarketplaces. If enabledPlugins contains
plugins from claude-plugins-official but the marketplace source is missing,
Codex infers anthropics/claude-plugins-official as the source.

Auth endpoints

The JSON-RPC auth/account surface exposes request/response methods plus server-initiated notifications (no id). Use these to determine auth state, start or cancel logins, logout, inspect ChatGPT rate limits, and notify workspace owners about depleted credits or usage limits.

Authentication modes

Codex supports these authentication modes. account/updated.authMode shows the active mode and includes the current ChatGPT planType when available. account/read also reports account and plan details.

API key (apikey) - the caller supplies an OpenAI API key with type: "apiKey", and Codex stores it for API requests.

ChatGPT managed (chatgpt) - Codex owns the ChatGPT OAuth flow, persists tokens, and refreshes them automatically. Start with type: "chatgpt" for the browser flow or type: "chatgptDeviceCode" for the device-code flow.

ChatGPT external tokens (chatgptAuthTokens) - experimental and intended for host apps that already own the user’s ChatGPT auth lifecycle. The host app supplies an accessToken, chatgptAccountId, and optional chatgptPlanType directly, and must refresh the token when asked.

API overview

account/read - fetch current account info; optionally refresh tokens.

account/login/start - begin login (apiKey, chatgpt, chatgptDeviceCode, or experimental chatgptAuthTokens).

account/login/completed (notify) - emitted when a login attempt finishes (success or error).

account/login/cancel - cancel a pending managed ChatGPT login by loginId.

account/logout - sign out; triggers account/updated.

account/updated (notify) - emitted whenever auth mode changes (authMode: apikey, chatgpt, chatgptAuthTokens, or null) and includes planType when available.

account/chatgptAuthTokens/refresh (server request) - request fresh externally managed ChatGPT tokens after an authorization error.

account/rateLimits/read - fetch ChatGPT rate limits.

account/rateLimits/updated (notify) - emitted whenever a user’s ChatGPT rate limits change.

account/sendAddCreditsNudgeEmail - ask ChatGPT to email a workspace owner about depleted credits or a reached usage limit.

mcpServer/oauthLogin/completed (notify) - emitted after a mcpServer/oauth/login flow finishes; payload includes { name, success, error? }.

mcpServer/startupStatus/updated (notify) - emitted when a configured MCP server’s startup status changes for a loaded thread; payload includes { name, status, error }.

1) Check auth state

Request:

{ "method": "account/read", "id": 1, "params": { "refreshToken": false } }

Response examples:

{ "id": 1, "result": { "account": null, "requiresOpenaiAuth": false } }
{ "id": 1, "result": { "account": null, "requiresOpenaiAuth": true } }
{
 "id": 1,
 "result": { "account": { "type": "apiKey" }, "requiresOpenaiAuth": true }
}
{
 "id": 1,
 "result": {
 "account": {
 "type": "chatgpt",
 "email": "user@example.com",
 "planType": "pro"
 },
 "requiresOpenaiAuth": true
 }
}

Field notes:

refreshToken (boolean): set true to force a token refresh in managed ChatGPT mode. In external token mode (chatgptAuthTokens), app-server ignores this flag.

requiresOpenaiAuth reflects the active provider; when false, Codex can run without OpenAI credentials.

2) Log in with an API key

Send:

{
 "method": "account/login/start",
 "id": 2,
 "params": { "type": "apiKey", "apiKey": "sk-..." }
}

Expect:

{ "id": 2, "result": { "type": "apiKey" } }

Notifications:

{
 "method": "account/login/completed",
 "params": { "loginId": null, "success": true, "error": null }
}
{
 "method": "account/updated",
 "params": { "authMode": "apikey", "planType": null }
}

3) Log in with ChatGPT (browser flow)

Start:

{ "method": "account/login/start", "id": 3, "params": { "type": "chatgpt" } }
{
 "id": 3,
 "result": {
 "type": "chatgpt",
 "loginId": "<uuid>",
 "authUrl": "https://chatgpt.com/...&redirect_uri=http%3A%2F%2Flocalhost%3A<port>%2Fauth%2Fcallback"
 }
}

Open authUrl in a browser; the app-server hosts the local callback.

Wait for notifications:

{
 "method": "account/login/completed",
 "params": { "loginId": "<uuid>", "success": true, "error": null }
}
{
 "method": "account/updated",
 "params": { "authMode": "chatgpt", "planType": "plus" }
}

3b) Log in with ChatGPT (device-code flow)

Use this flow when your client owns the sign-in ceremony or when a browser callback is brittle.

Start:

{
 "method": "account/login/start",
 "id": 4,
 "params": { "type": "chatgptDeviceCode" }
}
{
 "id": 4,
 "result": {
 "type": "chatgptDeviceCode",
 "loginId": "<uuid>",
 "verificationUrl": "https://auth.openai.com/codex/device",
 "userCode": "ABCD-1234"
 }
}

Show verificationUrl and userCode to the user; the frontend owns the UX.

Wait for notifications:

{
 "method": "account/login/completed",
 "params": { "loginId": "<uuid>", "success": true, "error": null }
}
{
 "method": "account/updated",
 "params": { "authMode": "chatgpt", "planType": "plus" }
}

3c) Log in with externally managed ChatGPT tokens (chatgptAuthTokens)

Use this experimental mode only when a host application owns the user’s ChatGPT auth lifecycle and supplies tokens directly. Clients must set capabilities.experimentalApi = true during initialize before using this login type.

Send:

{
 "method": "account/login/start",
 "id": 7,
 "params": {
 "type": "chatgptAuthTokens",
 "accessToken": "<jwt>",
 "chatgptAccountId": "org-123",
 "chatgptPlanType": "business"
 }
}

Expect:

{ "id": 7, "result": { "type": "chatgptAuthTokens" } }

Notifications:

{
 "method": "account/login/completed",
 "params": { "loginId": null, "success": true, "error": null }
}
{
 "method": "account/updated",
 "params": { "authMode": "chatgptAuthTokens", "planType": "business" }
}

When the server receives a 401 Unauthorized, it may request refreshed tokens from the host app:

{
 "method": "account/chatgptAuthTokens/refresh",
 "id": 8,
 "params": { "reason": "unauthorized", "previousAccountId": "org-123" }
}
{ "id": 8, "result": { "accessToken": "<jwt>", "chatgptAccountId": "org-123", "chatgptPlanType": "business" } }

The server retries the original request after a successful refresh response. Requests time out after about 10 seconds.

4) Cancel a ChatGPT login

{ "method": "account/login/cancel", "id": 4, "params": { "loginId": "<uuid>" } }
{ "method": "account/login/completed", "params": { "loginId": "<uuid>", "success": false, "error": "..." } }

5) Logout

{ "method": "account/logout", "id": 5 }
{ "id": 5, "result": {} }
{ "method": "account/updated", "params": { "authMode": null, "planType": null } }

6) Rate limits (ChatGPT)

{ "method": "account/rateLimits/read", "id": 6 }
{ "id": 6, "result": {
 "rateLimits": {
 "limitId": "codex",
 "limitName": null,
 "primary": { "usedPercent": 25, "windowDurationMins": 15, "resetsAt": 1730947200 },
 "secondary": null,
 "rateLimitReachedType": null
 },
 "rateLimitsByLimitId": {
 "codex": {
 "limitId": "codex",
 "limitName": null,
 "primary": { "usedPercent": 25, "windowDurationMins": 15, "resetsAt": 1730947200 },
 "secondary": null,
 "rateLimitReachedType": null
 },
 "codex_other": {
 "limitId": "codex_other",
 "limitName": "codex_other",
 "primary": { "usedPercent": 42, "windowDurationMins": 60, "resetsAt": 1730950800 },
 "secondary": null,
 "rateLimitReachedType": null
 }
 }
} }
{ "method": "account/rateLimits/updated", "params": {
 "rateLimits": {
 "limitId": "codex",
 "primary": { "usedPercent": 31, "windowDurationMins": 15, "resetsAt": 1730948100 }
 }
} }

Field notes:

rateLimits is the backward-compatible single-bucket view.

rateLimitsByLimitId (when present) is the multi-bucket view keyed by metered limit_id (for example codex).

limitId is the metered bucket identifier.

limitName is an optional user-facing label for the bucket.

usedPercent is current usage within the quota window.

windowDurationMins is the quota window length.

resetsAt is a Unix timestamp (seconds) for the next reset.

planType is included when the backend returns the ChatGPT plan associated with a bucket.

credits is included when the backend returns remaining workspace credit details.

rateLimitReachedType identifies the backend-classified limit state when one has been reached.

7) Notify a workspace owner about a limit

Use account/sendAddCreditsNudgeEmail to ask ChatGPT to email a workspace owner when credits are depleted or a usage limit has been reached.

{ "method": "account/sendAddCreditsNudgeEmail", "id": 7, "params": { "creditType": "credits" } }
{ "id": 7, "result": { "status": "sent" } }

Use creditType: "credits" when workspace credits are depleted, or creditType: "usage_limit" when the workspace usage limit has been reached. If the owner was already notified recently, the response status is cooldown_active.
````

</details>

