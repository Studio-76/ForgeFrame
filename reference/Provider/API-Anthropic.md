# API-Anthropic.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## code-proxy

Provider: `anthropic-api`  
Praefix: `anthropic/`  
Kategorie: `api`

## Endpoint

```http
POST https://api.anthropic.com/v1/messages
Content-Type: application/json
anthropic-version: 2023-06-01
x-api-key: <api_key>
```

Falls `AuthMode == oauth` und `AccessToken` vorhanden ist:

```http
Authorization: Bearer <access_token>
```

statt `x-api-key`.

## Translation

code-proxy nimmt OpenAI Chat Completions entgegen und transformiert intern auf Anthropic Messages:

- OpenAI `messages[]` -> Anthropic `messages[]` + optional system prompt.
- OpenAI Streaming -> Anthropic SSE -> zurueck in OpenAI-kompatible SSE-Chunks.
- Non-Streaming Anthropic Response -> OpenAI `chat.completion` Format.

## Modelle

- `anthropic/claude-opus-4-6`
- `anthropic/claude-sonnet-4-6`
- `anthropic/claude-haiku-4-5`

## hermes-agent

Provider-ID: `anthropic`  
Auth type: `api_key`  
Base: `https://api.anthropic.com`  
Env vars:

1. `ANTHROPIC_API_KEY`
2. `ANTHROPIC_TOKEN`
3. `CLAUDE_CODE_OAUTH_TOKEN`

Hermes schaltet fuer `provider == "anthropic"` oder Base URL mit `api.anthropic.com` auf `anthropic_messages`.

## Minimaladapter

```python
import httpx

payload = {
    'model': 'claude-sonnet-4-6',
    'max_tokens': 4096,
    'messages': [{'role': 'user', 'content': 'Hello'}],
}
headers = {
    'x-api-key': api_key,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
}
r = httpx.post('https://api.anthropic.com/v1/messages', headers=headers, json=payload)
r.raise_for_status()
```

---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/Anthropic`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – Anthropic

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### OpenAI SDK compatibility - Claude API Docs
- Quelle: Pflichtquelle
- Original-URL: https://platform.claude.com/docs/en/api/openai-sdk
- Bereinigte Download-URL: https://platform.claude.com/docs/en/api/openai-sdk
- Lokale Datei(en): HTML: `openai-sdk.html`, Text: `openai-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Anthropic OpenAI SDK compatibility
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Admin API overview - Claude API Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://platform.claude.com/docs/en/build-with-claude/administration-api
- Bereinigte Download-URL: https://platform.claude.com/docs/en/build-with-claude/administration-api
- Lokale Datei(en): HTML: `administration-api.html`, Text: `administration-api.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://platform.claude.com/docs/en/api/openai-sdk
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Models overview - Claude API Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://platform.claude.com/docs/en/about-claude/models/overview
- Bereinigte Download-URL: https://platform.claude.com/docs/en/about-claude/models/overview
- Lokale Datei(en): HTML: `overview.html`, Text: `overview.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://platform.claude.com/docs/en/api/openai-sdk
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://platform.claude.com/docs/en/api/openai-sdk`
- `https://platform.claude.com/docs/en/build-with-claude/administration-api`
- `https://platform.claude.com/docs/en/about-claude/models/overview`
- `https://api.anthropic.com/v1/organizations/users?limit=10`
- `https://api.anthropic.com/v1/organizations/users/{user_id`
- `https://api.anthropic.com/v1/organizations/invites`
- `https://api.anthropic.com/v1/organizations/invites?limit=10`
- `https://api.anthropic.com/v1/organizations/invites/{invite_id`
- `https://api.anthropic.com/v1/organizations/workspaces/{workspace_id`
- `https://api.anthropic.com/v1/organizations/api_keys?limit=10&status=active&workspace_id=wrkspc_xxx`
- `https://api.anthropic.com/v1/organizations/api_keys/{api_key_id`
- `https://api.anthropic.com/v1/organizations/me`
- `https://api.anthropic.com/v1/`

### Erkannte Endpunkte / Pfade

- `https://platform.claude.com/docs/en/about-claude/models/overview`
- `https://api.anthropic.com/v1/organizations/users?limit=10"`
- `https://api.anthropic.com/v1/organizations/users/{user_id}"`
- `https://api.anthropic.com/v1/organizations/invites"`
- `https://api.anthropic.com/v1/organizations/invites?limit=10"`
- `https://api.anthropic.com/v1/organizations/invites/{invite_id}"`
- `https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members"`
- `https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members?limit=10"`
- `https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members/{user_id}"`
- `https://api.anthropic.com/v1/organizations/api_keys?limit=10&status=active&workspace_id=wrkspc_xxx"`
- `https://api.anthropic.com/v1/organizations/api_keys/{api_key_id}"`
- `/v1/organizations/me`
- `https://api.anthropic.com/v1/organizations/me"`
- `https://api.anthropic.com/v1/"`
- `/v1/messages`

### Erkannte Umgebungsvariablen / Konstanten

- `ANTHROPIC_ADMIN_KEY`
- `DELETE`
- `POST`
- `ADMIN_API_KEY`
- `SDKC`
- `SDKPHP`
- `ANTHROPIC_API_KEY`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### OpenAI SDK compatibility - Claude API Docs
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://platform.claude.com/docs/en/api/openai-sdk
- Bereinigte Download-URL: https://platform.claude.com/docs/en/api/openai-sdk

---

**Quelle `INDEX.md`**

- Original-URL: https://platform.claude.com/docs/en/api/openai-sdk
- Bereinigte Download-URL: https://platform.claude.com/docs/en/api/openai-sdk
- Lokale Datei(en): HTML: `openai-sdk.html`, Text: `openai-sdk.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://platform.claude.com/docs/en/api/openai-sdk
- Lokale Datei(en): HTML: `openai-sdk.html`, Text: `openai-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Anthropic OpenAI SDK compatibility
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://platform.claude.com/docs/en/build-with-claude/administration-api
- Bereinigte Download-URL: https://platform.claude.com/docs/en/build-with-claude/administration-api

---

**Quelle `INDEX.md`**

- Original-URL: https://platform.claude.com/docs/en/build-with-claude/administration-api
- Bereinigte Download-URL: https://platform.claude.com/docs/en/build-with-claude/administration-api
- Lokale Datei(en): HTML: `administration-api.html`, Text: `administration-api.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://platform.claude.com/docs/en/api/openai-sdk
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Models overview - Claude API Docs
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://platform.claude.com/docs/en/about-claude/models/overview
- Bereinigte Download-URL: https://platform.claude.com/docs/en/about-claude/models/overview

---

**Quelle `INDEX.md`**

- Original-URL: https://platform.claude.com/docs/en/about-claude/models/overview
- Bereinigte Download-URL: https://platform.claude.com/docs/en/about-claude/models/overview
- Lokale Datei(en): HTML: `overview.html`, Text: `overview.txt`

---

**Quelle `administration-api.txt`**

We use cookies to deliver and improve our services, analyze site usage, and if you agree, to customize or personalize your experience and market our services to you. You can read our Cookie Policy here.

---

**Quelle `administration-api.txt`**

Models & pricing

---

**Quelle `administration-api.txt`**

Client SDKs

---

**Quelle `administration-api.txt`**

Claude Code Analytics APIUsage and Cost API

---

**Quelle `administration-api.txt`**

Usage policy

---

**Quelle `administration-api.txt`**

The Admin API allows you to programmatically manage your organization's resources, including organization members, workspaces, and API keys. This provides programmatic control over administrative tasks that would otherwise require manual configuration in the Claude Console.

---

**Quelle `administration-api.txt`**

The Admin API requires a special Admin API key (starting with sk-ant-admin...) that differs from standard API keys. Only organization members with the admin role can provision Admin API keys through the Claude Console.

---

**Quelle `administration-api.txt`**

You make requests using your Admin API key in the x-api-key header

---

**Quelle `administration-api.txt`**

API keys

---

**Quelle `administration-api.txt`**

Monitoring and managing API key usage

---

**Quelle `administration-api.txt`**

developerCan use Workbench and manage API keys

---

**Quelle `administration-api.txt`**

billingCan use Workbench and manage billing details

---

**Quelle `administration-api.txt`**

cURL

---

**Quelle `administration-api.txt`**

# List organization members
curl "https://api.anthropic.com/v1/organizations/users?limit=10" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl "https://api.anthropic.com/v1/organizations/users?limit=10" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

---

**Quelle `administration-api.txt`**

--header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

---

**Quelle `administration-api.txt`**

# Update member role
curl "https://api.anthropic.com/v1/organizations/users/{user_id}" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl "https://api.anthropic.com/v1/organizations/users/{user_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \

---

**Quelle `administration-api.txt`**

--header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \
 --data '{"role": "developer"}'

---

**Quelle `administration-api.txt`**

# Remove member
curl --request DELETE "https://api.anthropic.com/v1/organizations/users/{user_id}" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl --request DELETE "https://api.anthropic.com/v1/organizations/users/{user_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

---

**Quelle `administration-api.txt`**

# Create invite
curl --request POST "https://api.anthropic.com/v1/organizations/invites" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl --request POST "https://api.anthropic.com/v1/organizations/invites" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \

---

**Quelle `administration-api.txt`**

--header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \
 --data '{

---

**Quelle `administration-api.txt`**

# List invites
curl "https://api.anthropic.com/v1/organizations/invites?limit=10" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl "https://api.anthropic.com/v1/organizations/invites?limit=10" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

---

**Quelle `administration-api.txt`**

# Delete invite
curl --request DELETE "https://api.anthropic.com/v1/organizations/invites/{invite_id}" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl --request DELETE "https://api.anthropic.com/v1/organizations/invites/{invite_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

---

**Quelle `administration-api.txt`**

# Add member to workspace
curl --request POST "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl --request POST "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \

---

**Quelle `administration-api.txt`**

# List workspace members
curl "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members?limit=10" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members?limit=10" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

---

**Quelle `administration-api.txt`**

# Update member role
curl --request POST "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members/{user_id}" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl --request POST "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members/{user_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \

---

**Quelle `administration-api.txt`**

# Remove member from workspace
curl --request DELETE "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members/{user_id}" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `administration-api.txt`**

curl --request DELETE "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members/{user_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

---

**Quelle `administration-api.txt`**

API Keys

---

**Quelle `administration-api.txt`**

Monitor and manage API keys:

---

**Quelle `administration-api.txt`**

# List API keys
curl "https://api.anthropic.com/v1/organizations/api_keys?limit=10&status=active&workspace_id=wrkspc_xxx" \

---

**Quelle `administration-api.txt`**

# List API keys
curl "https://api.anthropic.com/v1/organizations/api_keys?limit=10&status=active&workspace_id=wrkspc_xxx" \
 --header "anthropic-version: 2023-06-01" \

---

**Quelle `openai-sdk.txt`**

OpenAI SDK compatibility - Claude API Docs

---

**Quelle `openai-sdk.txt`**

We use cookies to deliver and improve our services, analyze site usage, and if you agree, to customize or personalize your experience and market our services to you. You can read our Cookie Policy here.

---

**Quelle `openai-sdk.txt`**

Models & pricing

---

**Quelle `openai-sdk.txt`**

Client SDKs

---

**Quelle `openai-sdk.txt`**

OverviewCLIPython SDKTypeScript SDKJava SDKGo SDKRuby SDKC# SDKPHP SDK

---

**Quelle `openai-sdk.txt`**

OpenAI SDK compatibility

---

**Quelle `openai-sdk.txt`**

Usage policy

---

**Quelle `openai-sdk.txt`**

Anthropic provides a compatibility layer that enables you to use the OpenAI SDK to test the Claude API. With a few code changes, you can quickly evaluate Anthropic model capabilities.

---

**Quelle `openai-sdk.txt`**

This compatibility layer is primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution for most use cases. While it is intended to remain fully functional and not have breaking changes, the priority is the reliability and effectiveness of the Claude API.

---

**Quelle `openai-sdk.txt`**

For more information on known compatibility limitations, see Important OpenAI compatibility limitations.

---

**Quelle `openai-sdk.txt`**

If you encounter any issues with the OpenAI SDK compatibility feature, please share your feedback via this compatibility feedback form.

---

**Quelle `openai-sdk.txt`**

Getting started with the OpenAI SDK

---

**Quelle `openai-sdk.txt`**

To use the OpenAI SDK compatibility feature, you'll need to:

---

**Quelle `openai-sdk.txt`**

Use an official OpenAI SDK

---

**Quelle `openai-sdk.txt`**

Update your base URL to point to the Claude API

---

**Quelle `openai-sdk.txt`**

Replace your API key with a Claude API key

---

**Quelle `openai-sdk.txt`**

from openai import OpenAI

---

**Quelle `openai-sdk.txt`**

client = OpenAI(
 api_key=os.environ.get("ANTHROPIC_API_KEY"), # Your Claude API key

---

**Quelle `openai-sdk.txt`**

client = OpenAI(
 api_key=os.environ.get("ANTHROPIC_API_KEY"), # Your Claude API key
 base_url="https://api.anthropic.com/v1/", # the Claude API endpoint

---

**Quelle `openai-sdk.txt`**

api_key=os.environ.get("ANTHROPIC_API_KEY"), # Your Claude API key
 base_url="https://api.anthropic.com/v1/", # the Claude API endpoint
)

---

**Quelle `openai-sdk.txt`**

response = client.chat.completions.create(
 model="claude-opus-4-7", # Claude model name

---

**Quelle `openai-sdk.txt`**

Important OpenAI compatibility limitations

---

**Quelle `openai-sdk.txt`**

Here are the most substantial differences from using OpenAI:

---

**Quelle `openai-sdk.txt`**

The strict parameter for function calling is ignored, which means the tool use JSON is not guaranteed to follow the supplied schema. For guaranteed schema conformance, use the native Claude API with Structured Outputs.

---

**Quelle `openai-sdk.txt`**

Prompt caching is not supported, but it is supported in the Anthropic SDK

---

**Quelle `openai-sdk.txt`**

If you’ve done lots of tweaking to your prompt, it’s likely to be well-tuned to OpenAI specifically. Consider using the prompt improver in the Claude Console as a good starting point.

---

**Quelle `openai-sdk.txt`**

Most of the inputs to the OpenAI SDK clearly map directly to Anthropic’s API parameters, but one distinct difference is the handling of system / developer prompts. These two prompts can be put throughout a chat conversation via OpenAI. Since Anthropic only supports an initial system message, the API takes all system/developer messages and concatenates them together with a single newline (\n) in between them. This full string is then supplied as a single system message at the start of the messages.

---

**Quelle `openai-sdk.txt`**

You can enable extended thinking capabilities by adding the thinking parameter. While this improves Claude's reasoning for complex tasks, the OpenAI SDK doesn't return Claude's detailed thought process. For full extended thinking features, including access to Claude's step-by-step reasoning output, use the native Claude API.

---

**Quelle `openai-sdk.txt`**

response = client.chat.completions.create(
 model="claude-sonnet-4-6",

---

**Quelle `openai-sdk.txt`**

messages=[{"role": "user", "content": "Who are you?"}],
 extra_body={"thinking": {"type": "enabled", "budget_tokens": 2000}},
)

---

**Quelle `openai-sdk.txt`**

Rate limits

---

**Quelle `openai-sdk.txt`**

Rate limits follow Anthropic's standard limits for the /v1/messages endpoint.

---

**Quelle `openai-sdk.txt`**

Detailed OpenAI compatible API support

---

**Quelle `openai-sdk.txt`**

max_tokensFully supported

---

**Quelle `openai-sdk.txt`**

max_completion_tokensFully supported

---

**Quelle `openai-sdk.txt`**

streamFully supported

---

**Quelle `openai-sdk.txt`**

stream_optionsFully supported

---

**Quelle `openai-sdk.txt`**

parallel_tool_callsFully supported

---

**Quelle `openai-sdk.txt`**

tools / functions fields

---

**Quelle `openai-sdk.txt`**

choices[].message.tool_callsFully supported

---

**Quelle `overview.txt`**

Models overview - Claude API Docs

---

**Quelle `overview.txt`**

We use cookies to deliver and improve our services, analyze site usage, and if you agree, to customize or personalize your experience and market our services to you. You can read our Cookie Policy here.

---

**Quelle `overview.txt`**

Models & pricing

---

**Quelle `overview.txt`**

Client SDKs

---

**Quelle `overview.txt`**

Models

---

**Quelle `overview.txt`**

Models overviewChoosing a modelWhat's new in Claude Opus 4.7Migration guideModel deprecationsModel cardsSystem prompts

---

**Quelle `overview.txt`**

Models overview

---

**Quelle `overview.txt`**

Usage policy

---

**Quelle `overview.txt`**

Claude is a family of state-of-the-art large language models developed by Anthropic. This guide introduces the available models and compares their performance.

---

**Quelle `overview.txt`**

All current Claude models support text and image input, text output, multilingual capabilities, and vision. Models are available via the Claude API, Amazon Bedrock, Vertex AI, and Microsoft Foundry.

---

**Quelle `overview.txt`**

Latest models comparison

---

**Quelle `overview.txt`**

Context window1M tokens1M tokens200k tokens

---

**Quelle `overview.txt`**

Max output128k tokens64k tokens64k tokens

---

**Quelle `overview.txt`**

1 - See the pricing page for complete pricing information including batch API discounts, prompt caching rates, extended thinking costs, and vision processing fees.

---

**Quelle `overview.txt`**

3 - Claude Opus 4.7 on AWS is available through Claude in Amazon Bedrock (the Messages-API Bedrock endpoint).

---

**Quelle `overview.txt`**

Models with the same snapshot date (e.g., 20240620) are identical across all platforms and do not change. The snapshot date in the model name ensures consistency and allows developers to rely on stable performance across different environments.

---

**Quelle `overview.txt`**

Starting with Claude Sonnet 4.5 and all subsequent models (including Claude Sonnet 4.6), AWS Bedrock offers two endpoint types: global endpoints (dynamic routing for maximum availability) and regional endpoints (guaranteed data routing through specific geographic regions). Google Vertex AI offers three endpoint types: global endpoints, multi-region endpoints (dynamic routing within a geographic area), and regional endpoints. For more information, see the third-party platform pricing section.

---

**Quelle `overview.txt`**

You can query model capabilities and token limits programmatically with the Models API. The response includes max_input_tokens, max_tokens, and a capabilities object for every available model.

---

**Quelle `overview.txt`**

The Max output values above apply to the synchronous Messages API. On the Message Batches API, Opus 4.7, Opus 4.6, and Sonnet 4.6 support up to 300k output tokens by using the output-300k-2026-03-24 beta header.

---

**Quelle `overview.txt`**

Legacy models

---

**Quelle `overview.txt`**

Claude 4 models excel in:

---

**Quelle `overview.txt`**

Engaging responses: Claude models are ideal for applications that require rich, human-like interactions.

---

**Quelle `overview.txt`**

If you prefer more concise responses, you can adjust your prompts to guide the model toward the desired output length. Refer to the prompt engineering guides for details.

---

**Quelle `overview.txt`**

If you're currently using Claude Opus 4.6 or older Claude models, consider migrating to Claude Opus 4.7 to take advantage of improved intelligence and a step-change jump in agentic coding. For detailed migration instructions, see Migrating to Claude Opus 4.7.

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `administration-api.txt`**

````text
curl "https://api.anthropic.com/v1/organizations/users?limit=10" \
````

---

**Quelle `administration-api.txt`**

````text
curl "https://api.anthropic.com/v1/organizations/users/{user_id}" \
````

---

**Quelle `administration-api.txt`**

````text
curl --request DELETE "https://api.anthropic.com/v1/organizations/users/{user_id}" \
````

---

**Quelle `administration-api.txt`**

````text
curl --request POST "https://api.anthropic.com/v1/organizations/invites" \
````

---

**Quelle `administration-api.txt`**

````text
curl "https://api.anthropic.com/v1/organizations/invites?limit=10" \
````

---

**Quelle `administration-api.txt`**

````text
curl --request DELETE "https://api.anthropic.com/v1/organizations/invites/{invite_id}" \
````

---

**Quelle `administration-api.txt`**

````text
curl --request POST "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members" \
````

---

**Quelle `administration-api.txt`**

````text
curl "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members?limit=10" \
````

---

**Quelle `administration-api.txt`**

````text
curl --request POST "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members/{user_id}" \
````

---

**Quelle `administration-api.txt`**

````text
curl --request DELETE "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members/{user_id}" \
````

---

**Quelle `administration-api.txt`**

````text
curl "https://api.anthropic.com/v1/organizations/api_keys?limit=10&status=active&workspace_id=wrkspc_xxx" \
````

---

**Quelle `administration-api.txt`**

````text
curl --request POST "https://api.anthropic.com/v1/organizations/api_keys/{api_key_id}" \
````

---

**Quelle `administration-api.txt`**

````text
curl "https://api.anthropic.com/v1/organizations/me" \
````

---

**Quelle `openai-sdk.txt`**

````text
api_key=os.environ.get("ANTHROPIC_API_KEY"), # Your Claude API key
````

---

**Quelle `openai-sdk.txt`**

````text
base_url="https://api.anthropic.com/v1/", # the Claude API endpoint
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/Anthropic/administration-api.txt</code></summary>

````text
Admin API overview - Claude API Docs

Cookie settings

We use cookies to deliver and improve our services, analyze site usage, and if you agree, to customize or personalize your experience and market our services to you. You can read our Cookie Policy here.

CustomizeCustomize Cookie SettingsRejectReject All CookiesAcceptAccept All Cookies

Loading...

Messages

Build

Admin

Models & pricing

Client SDKs

API Reference

English

Log in

Search...

⌘K

Administration

Admin API overviewWorkspacesData residencyAPI and data retention

Monitoring

Claude Code Analytics APIUsage and Cost API

3rd-party platforms

Amazon BedrockAmazon Bedrock (legacy)Microsoft FoundryVertex AI

Console

Log in

Administration

Admin API overview

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Solutions

AI agents

Code modernization

Coding

Customer support

Education

Financial services

Government

Life sciences

Partners

Amazon Bedrock

Google Cloud's Vertex AI

Learn

Blog

Courses

Use cases

Connectors

Customer stories

Engineering at Anthropic

Events

Powered by Claude

Service partners

Startups program

Company

Anthropic

Careers

Economic Futures

Research

News

Responsible Scaling Policy

Security and compliance

Transparency

Learn

Blog

Courses

Use cases

Connectors

Customer stories

Engineering at Anthropic

Events

Powered by Claude

Service partners

Startups program

Help and security

Availability

Status

Support

Discord

Terms and policies

Privacy policy

Responsible disclosure policy

Terms of service: Commercial

Terms of service: Consumer

Usage policy

Administration

Admin API overview

Copy page

Copy page

The Admin API is unavailable for individual accounts. To collaborate with teammates and add members, set up your organization in Console → Settings → Organization.

The Admin API allows you to programmatically manage your organization's resources, including organization members, workspaces, and API keys. This provides programmatic control over administrative tasks that would otherwise require manual configuration in the Claude Console.

The Admin API requires special access

The Admin API requires a special Admin API key (starting with sk-ant-admin...) that differs from standard API keys. Only organization members with the admin role can provision Admin API keys through the Claude Console.

How the Admin API works

When you use the Admin API:

You make requests using your Admin API key in the x-api-key header

The API allows you to manage:

Organization members and their roles

Organization member invites

Workspaces and their members

API keys

This is useful for:

Automating user onboarding/offboarding

Programmatically managing workspace access

Monitoring and managing API key usage

Organization roles and permissions

There are five organization-level roles. See more details in the API Console roles and permissions article.

RolePermissions

userCan use Workbench

claude_code_userCan use Workbench and Claude Code

developerCan use Workbench and manage API keys

billingCan use Workbench and manage billing details

adminCan do all of the above, plus manage users

Key concepts

Organization Members

You can list organization members, update member roles, and remove members.

cURL

# List organization members
curl "https://api.anthropic.com/v1/organizations/users?limit=10" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

# Update member role
curl "https://api.anthropic.com/v1/organizations/users/{user_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \
 --data '{"role": "developer"}'

# Remove member
curl --request DELETE "https://api.anthropic.com/v1/organizations/users/{user_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

Organization Invites

You can invite users to organizations and manage those invites.

cURL

# Create invite
curl --request POST "https://api.anthropic.com/v1/organizations/invites" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \
 --data '{
 "email": "[email protected]",
 "role": "developer"
 }'

# List invites
curl "https://api.anthropic.com/v1/organizations/invites?limit=10" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

# Delete invite
curl --request DELETE "https://api.anthropic.com/v1/organizations/invites/{invite_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

Workspaces

For a comprehensive guide to workspaces, including Console and API examples, see Workspaces.

Workspace Members

Manage user access to specific workspaces:

cURL

# Add member to workspace
curl --request POST "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \
 --data '{
 "user_id": "user_xxx",
 "workspace_role": "workspace_developer"
 }'

# List workspace members
curl "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members?limit=10" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

# Update member role
curl --request POST "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members/{user_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \
 --data '{
 "workspace_role": "workspace_admin"
 }'

# Remove member from workspace
curl --request DELETE "https://api.anthropic.com/v1/organizations/workspaces/{workspace_id}/members/{user_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

API Keys

Monitor and manage API keys:

cURL

# List API keys
curl "https://api.anthropic.com/v1/organizations/api_keys?limit=10&status=active&workspace_id=wrkspc_xxx" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY"

# Update API key
curl --request POST "https://api.anthropic.com/v1/organizations/api_keys/{api_key_id}" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ANTHROPIC_ADMIN_KEY" \
 --data '{
 "status": "inactive",
 "name": "New Key Name"
 }'

Accessing organization info

Get information about your organization programmatically with the /v1/organizations/me endpoint.

For example:

cURL

curl "https://api.anthropic.com/v1/organizations/me" \
 --header "anthropic-version: 2023-06-01" \
 --header "x-api-key: $ADMIN_API_KEY"

{
 "id": "12345678-1234-5678-1234-567812345678",
 "type": "organization",
 "name": "Organization Name"
}

This endpoint is useful for programmatically determining which organization an Admin API key belongs to.

For complete parameter details and response schemas, see the Organization Info API reference.

Usage and cost reports

Track your organization's usage and costs with the Usage and Cost API.

Claude Code analytics

Monitor developer productivity and Claude Code adoption with the Claude Code Analytics API.

Best practices

To effectively use the Admin API:

Use meaningful names and descriptions for workspaces and API keys

Implement proper error handling for failed operations

Regularly audit member roles and permissions

Clean up unused workspaces and expired invites

Monitor API key usage and rotate keys periodically

FAQ

What permissions are needed to use the Admin API?

Can I create new API keys through the Admin API?

What happens to API keys when removing a user?

Can organization admins be removed via the API?

How long do organization invites last?

For workspace-specific questions, see the Workspaces FAQ.

Was this page helpful?

How the Admin API works

Organization roles and permissions

Key concepts

Organization Members

Organization Invites

Workspaces

Workspace Members

API Keys

Accessing organization info

Usage and cost reports

Claude Code analytics

Best practices

FAQ
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/Anthropic/openai-sdk.txt</code></summary>

````text
OpenAI SDK compatibility - Claude API Docs

Cookie settings

We use cookies to deliver and improve our services, analyze site usage, and if you agree, to customize or personalize your experience and market our services to you. You can read our Cookie Policy here.

CustomizeCustomize Cookie SettingsRejectReject All CookiesAcceptAccept All Cookies

Loading...

Messages

Build

Admin

Models & pricing

Client SDKs

API Reference

English

Log in

Search...

⌘K

Client SDKs

OverviewCLIPython SDKTypeScript SDKJava SDKGo SDKRuby SDKC# SDKPHP SDK

Compatibility

OpenAI SDK compatibility

Console

Log in

Compatibility

OpenAI SDK compatibility

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Solutions

AI agents

Code modernization

Coding

Customer support

Education

Financial services

Government

Life sciences

Partners

Amazon Bedrock

Google Cloud's Vertex AI

Learn

Blog

Courses

Use cases

Connectors

Customer stories

Engineering at Anthropic

Events

Powered by Claude

Service partners

Startups program

Company

Anthropic

Careers

Economic Futures

Research

News

Responsible Scaling Policy

Security and compliance

Transparency

Learn

Blog

Courses

Use cases

Connectors

Customer stories

Engineering at Anthropic

Events

Powered by Claude

Service partners

Startups program

Help and security

Availability

Status

Support

Discord

Terms and policies

Privacy policy

Responsible disclosure policy

Terms of service: Commercial

Terms of service: Consumer

Usage policy

Compatibility

OpenAI SDK compatibility

Copy page

Anthropic provides a compatibility layer that enables you to use the OpenAI SDK to test the Claude API. With a few code changes, you can quickly evaluate Anthropic model capabilities.

Copy page

This compatibility layer is primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution for most use cases. While it is intended to remain fully functional and not have breaking changes, the priority is the reliability and effectiveness of the Claude API.

For more information on known compatibility limitations, see Important OpenAI compatibility limitations.

If you encounter any issues with the OpenAI SDK compatibility feature, please share your feedback via this compatibility feedback form.

For the best experience and access to Claude API full feature set (PDF processing, citations, extended thinking, and prompt caching), use the native Claude API.

Getting started with the OpenAI SDK

To use the OpenAI SDK compatibility feature, you'll need to:

Use an official OpenAI SDK

Change the following

Update your base URL to point to the Claude API

Replace your API key with a Claude API key

Update your model name to use a Claude model

Review the documentation below for what features are supported

Quick start example

PythonTypeScript

import os

from openai import OpenAI

client = OpenAI(
 api_key=os.environ.get("ANTHROPIC_API_KEY"), # Your Claude API key
 base_url="https://api.anthropic.com/v1/", # the Claude API endpoint
)

response = client.chat.completions.create(
 model="claude-opus-4-7", # Claude model name
 messages=[
 {"role": "system", "content": "You are a helpful assistant."},
 {"role": "user", "content": "Who are you?"},
 ],
)

print(response.choices[0].message.content)

Important OpenAI compatibility limitations

API behavior

Here are the most substantial differences from using OpenAI:

The strict parameter for function calling is ignored, which means the tool use JSON is not guaranteed to follow the supplied schema. For guaranteed schema conformance, use the native Claude API with Structured Outputs.

Audio input is not supported; it will simply be ignored and stripped from input

Prompt caching is not supported, but it is supported in the Anthropic SDK

System/developer messages are hoisted and concatenated to the beginning of the conversation, as Anthropic only supports a single initial system message.

Most unsupported fields are silently ignored rather than producing errors. These are all documented below.

Output quality considerations

If you’ve done lots of tweaking to your prompt, it’s likely to be well-tuned to OpenAI specifically. Consider using the prompt improver in the Claude Console as a good starting point.

System / developer message hoisting

Most of the inputs to the OpenAI SDK clearly map directly to Anthropic’s API parameters, but one distinct difference is the handling of system / developer prompts. These two prompts can be put throughout a chat conversation via OpenAI. Since Anthropic only supports an initial system message, the API takes all system/developer messages and concatenates them together with a single newline (\n) in between them. This full string is then supplied as a single system message at the start of the messages.

Extended thinking support

You can enable extended thinking capabilities by adding the thinking parameter. While this improves Claude's reasoning for complex tasks, the OpenAI SDK doesn't return Claude's detailed thought process. For full extended thinking features, including access to Claude's step-by-step reasoning output, use the native Claude API.

PythonTypeScript

response = client.chat.completions.create(
 model="claude-sonnet-4-6",
 messages=[{"role": "user", "content": "Who are you?"}],
 extra_body={"thinking": {"type": "enabled", "budget_tokens": 2000}},
)

Rate limits

Rate limits follow Anthropic's standard limits for the /v1/messages endpoint.

Detailed OpenAI compatible API support

Request fields

Simple fields

FieldSupport status

modelUse Claude model names

max_tokensFully supported

max_completion_tokensFully supported

streamFully supported

stream_optionsFully supported

top_pFully supported

parallel_tool_callsFully supported

stopAll non-whitespace stop sequences work

temperatureBetween 0 and 1 (inclusive). Values greater than 1 are capped at 1.

nMust be exactly 1

logprobsIgnored

metadataIgnored

response_formatIgnored. For JSON output, use Structured Outputs with the native Claude API

predictionIgnored

presence_penaltyIgnored

frequency_penaltyIgnored

seedIgnored

service_tierIgnored

audioIgnored

logit_biasIgnored

storeIgnored

userIgnored

modalitiesIgnored

top_logprobsIgnored

reasoning_effortIgnored

tools / functions fields

Show fields

messages array fields

Show fields

Response fields

FieldSupport status

idFully supported

choices[]Will always have a length of 1

choices[].finish_reasonFully supported

choices[].indexFully supported

choices[].message.roleFully supported

choices[].message.contentFully supported

choices[].message.tool_callsFully supported

objectFully supported

createdFully supported

modelFully supported

finish_reasonFully supported

contentFully supported

usage.completion_tokensFully supported

usage.prompt_tokensFully supported

usage.total_tokensFully supported

usage.completion_tokens_detailsAlways empty

usage.prompt_tokens_detailsAlways empty

choices[].message.refusalAlways empty

choices[].message.audioAlways empty

logprobsAlways empty

service_tierAlways empty

system_fingerprintAlways empty

Error message compatibility

The compatibility layer maintains consistent error formats with the OpenAI API. However, the detailed error messages will not be equivalent. Only use the error messages for logging and debugging.

Header compatibility

While the OpenAI SDK automatically manages headers, here is the complete list of headers supported by the Claude API for developers who need to work with them directly.

HeaderSupport Status

x-ratelimit-limit-requestsFully supported

x-ratelimit-limit-tokensFully supported

x-ratelimit-remaining-requestsFully supported

x-ratelimit-remaining-tokensFully supported

x-ratelimit-reset-requestsFully supported

x-ratelimit-reset-tokensFully supported

retry-afterFully supported

request-idFully supported

openai-versionAlways 2020-10-01

authorizationFully supported

openai-processing-msAlways empty

Was this page helpful?

Getting started with the OpenAI SDK

Quick start example

Important OpenAI compatibility limitations

API behavior

Output quality considerations

System / developer message hoisting

Extended thinking support

Rate limits

Detailed OpenAI compatible API support

Request fields

Response fields

Error message compatibility

Header compatibility
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/Anthropic/overview.txt</code></summary>

````text
Models overview - Claude API Docs

Cookie settings

We use cookies to deliver and improve our services, analyze site usage, and if you agree, to customize or personalize your experience and market our services to you. You can read our Cookie Policy here.

CustomizeCustomize Cookie SettingsRejectReject All CookiesAcceptAccept All Cookies

Loading...

Messages

Build

Admin

Models & pricing

Client SDKs

API Reference

English

Log in

Search...

⌘K

Models

Models overviewChoosing a modelWhat's new in Claude Opus 4.7Migration guideModel deprecationsModel cardsSystem prompts

Pricing

Pricing

Console

Log in

Models

Models overview

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Loading...

Solutions

AI agents

Code modernization

Coding

Customer support

Education

Financial services

Government

Life sciences

Partners

Amazon Bedrock

Google Cloud's Vertex AI

Learn

Blog

Courses

Use cases

Connectors

Customer stories

Engineering at Anthropic

Events

Powered by Claude

Service partners

Startups program

Company

Anthropic

Careers

Economic Futures

Research

News

Responsible Scaling Policy

Security and compliance

Transparency

Learn

Blog

Courses

Use cases

Connectors

Customer stories

Engineering at Anthropic

Events

Powered by Claude

Service partners

Startups program

Help and security

Availability

Status

Support

Discord

Terms and policies

Privacy policy

Responsible disclosure policy

Terms of service: Commercial

Terms of service: Consumer

Usage policy

Models

Models overview

Copy page

Claude is a family of state-of-the-art large language models developed by Anthropic. This guide introduces the available models and compares their performance.

Copy page

Choosing a model

If you're unsure which model to use, consider starting with Claude Opus 4.7 for the most complex tasks. It is our most capable generally available model, with a step-change improvement in agentic coding over Claude Opus 4.6.

All current Claude models support text and image input, text output, multilingual capabilities, and vision. Models are available via the Claude API, Amazon Bedrock, Vertex AI, and Microsoft Foundry.

Once you've picked a model, learn how to make your first API call.

Latest models comparison

FeatureClaude Opus 4.7Claude Sonnet 4.6Claude Haiku 4.5

DescriptionOur most capable generally available model for complex reasoning and agentic codingThe best combination of speed and intelligenceThe fastest model with near-frontier intelligence

Claude API IDclaude-opus-4-7claude-sonnet-4-6claude-haiku-4-5-20251001

Claude API aliasclaude-opus-4-7claude-sonnet-4-6claude-haiku-4-5

AWS Bedrock IDanthropic.claude-opus-4-73anthropic.claude-sonnet-4-6anthropic.claude-haiku-4-5-20251001-v1:0

GCP Vertex AI IDclaude-opus-4-7claude-sonnet-4-6claude-haiku-4-5@20251001

Pricing1$5 / input MTok
$25 / output MTok$3 / input MTok
$15 / output MTok$1 / input MTok
$5 / output MTok

Extended thinkingNoYesYes

Adaptive thinkingYesYesNo

Priority TierYesYesYes

Comparative latencyModerateFastFastest

Context window1M tokens1M tokens200k tokens

Max output128k tokens64k tokens64k tokens

Reliable knowledge cutoffJan 20262Aug 20252Feb 2025

Training data cutoffJan 2026Jan 2026Jul 2025

1 - See the pricing page for complete pricing information including batch API discounts, prompt caching rates, extended thinking costs, and vision processing fees.

2 - Reliable knowledge cutoff indicates the date through which a model's knowledge is most extensive and reliable. Training data cutoff is the broader date range of training data used. For more information, see Anthropic's Transparency Hub.

3 - Claude Opus 4.7 on AWS is available through Claude in Amazon Bedrock (the Messages-API Bedrock endpoint).

Claude Mythos Preview is offered separately as a research preview model for defensive cybersecurity workflows as part of Project Glasswing. Access is invitation-only and there is no self-serve sign-up.

Models with the same snapshot date (e.g., 20240620) are identical across all platforms and do not change. The snapshot date in the model name ensures consistency and allows developers to rely on stable performance across different environments.

Starting with Claude Sonnet 4.5 and all subsequent models (including Claude Sonnet 4.6), AWS Bedrock offers two endpoint types: global endpoints (dynamic routing for maximum availability) and regional endpoints (guaranteed data routing through specific geographic regions). Google Vertex AI offers three endpoint types: global endpoints, multi-region endpoints (dynamic routing within a geographic area), and regional endpoints. For more information, see the third-party platform pricing section.

You can query model capabilities and token limits programmatically with the Models API. The response includes max_input_tokens, max_tokens, and a capabilities object for every available model.

The Max output values above apply to the synchronous Messages API. On the Message Batches API, Opus 4.7, Opus 4.6, and Sonnet 4.6 support up to 300k output tokens by using the output-300k-2026-03-24 beta header.

Legacy models

Prompt and output performance

Claude 4 models excel in:

Performance: Top-tier results in reasoning, coding, multilingual tasks, long-context handling, honesty, and image processing. See the Claude 4 blog post for more information.

Engaging responses: Claude models are ideal for applications that require rich, human-like interactions.

If you prefer more concise responses, you can adjust your prompts to guide the model toward the desired output length. Refer to the prompt engineering guides for details.

For prompting best practices, see the prompting best practices guide.

Output quality: When migrating from previous model generations to Claude 4, you may notice larger improvements in overall performance.

Migrating to Claude Opus 4.7

If you're currently using Claude Opus 4.6 or older Claude models, consider migrating to Claude Opus 4.7 to take advantage of improved intelligence and a step-change jump in agentic coding. For detailed migration instructions, see Migrating to Claude Opus 4.7.

Get started with Claude

If you're ready to start exploring what Claude can do for you, dive in! Whether you're a developer looking to integrate Claude into your applications or a user wanting to experience the power of AI firsthand, the following resources can help.

Looking to chat with Claude? Visit claude.ai!

Intro to Claude

Explore Claude's capabilities and development flow.

Quickstart

Learn how to make your first API call in minutes.

Claude Console

Craft and test powerful prompts directly in your browser.

If you have any questions or need assistance, don't hesitate to reach out to the support team or consult the Discord community.

Was this page helpful?

Choosing a model

Latest models comparison

Prompt and output performance

Migrating to Claude Opus 4.7

Get started with Claude
````

</details>
