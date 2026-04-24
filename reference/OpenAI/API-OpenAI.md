# API-OpenAI.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## code-proxy

Provider: `openai-api`  
Praefixe: `openai/`, `cx/`, teilweise `codex/`  
Kategorie: `api`

## Endpoint

```http
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer <api_key_or_oauth_token>
Content-Type: application/json
```

`api_openai.go` setzt `baseURL := "https://api.openai.com"` und delegiert an `proxyExecute`, das `/v1/chat/completions` anhaengt.

## Modelle in code-proxy

Auszug:

- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `openai/gpt-4.1`
- `openai/gpt-4.1-mini`
- `openai/gpt-4.1-nano`
- `openai/o1`
- `openai/o1-mini`
- `openai/o3`
- `openai/o3-mini`
- `openai/o4-mini`
- `cx/gpt-5.3-codex`
- `cx/gpt-5.2-codex`
- `codex/5.4*` Varianten

## hermes-agent

Hermes nutzt fuer normale OpenAI-kompatible APIs den OpenAI Python SDK Client. Fuer neuere GPT-5.x bzw. direkte OpenAI-URLs kann `run_agent.py` automatisch auf einen Responses-/Codex-Modus wechseln, sofern `api_mode` nicht explizit gesetzt wurde.

## Minimaladapter

```python
from openai import OpenAI

client = OpenAI(api_key=api_key, base_url='https://api.openai.com/v1')
resp = client.chat.completions.create(
    model='gpt-4o',
    messages=[{'role': 'user', 'content': 'Hello'}],
)
print(resp.choices[0].message.content)
```

---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/OpenAI`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – OpenAI

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### Chat Completions Overview | OpenAI API Reference
- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/api/reference/chat-completions/overview
- Bereinigte Download-URL: https://developers.openai.com/api/reference/chat-completions/overview
- Lokale Datei(en): HTML: `chat-completions-overview.html`, Text: `chat-completions-overview.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI chat completions overview
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Completions API | OpenAI API
- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/api/docs/guides/completions
- Bereinigte Download-URL: https://developers.openai.com/api/docs/guides/completions
- Lokale Datei(en): HTML: `completions-guide.html`, Text: `completions-guide.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI completions guide
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`

### Migrate to the Responses API | OpenAI API
- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Bereinigte Download-URL: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Lokale Datei(en): HTML: `migrate-to-responses.html`, Text: `migrate-to-responses.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI migrate to responses
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Showcase | OpenAI Developers
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/showcase
- Bereinigte Download-URL: https://developers.openai.com/showcase
- Lokale Datei(en): HTML: `showcase.html`, Text: `showcase.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/api/reference/chat-completions/overview
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html`
- Hinweise: zusätzlich gefunden

### Blog | OpenAI Developers
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/blog
- Bereinigte Download-URL: https://developers.openai.com/blog
- Lokale Datei(en): HTML: `blog.html`, Text: `blog.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/api/reference/chat-completions/overview
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### Cookbook
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/cookbook
- Bereinigte Download-URL: https://developers.openai.com/cookbook
- Lokale Datei(en): HTML: `cookbook.html`, Text: `cookbook.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/api/docs/guides/completions
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### Community | OpenAI Developers
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/community
- Bereinigte Download-URL: https://developers.openai.com/community
- Lokale Datei(en): HTML: `community.html`, Text: `community.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/api/docs/guides/completions
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html`
- Hinweise: zusätzlich gefunden

### Developer quickstart | OpenAI API
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api/docs/quickstart
- Bereinigte Download-URL: https://developers.openai.com/api/docs/quickstart
- Lokale Datei(en): HTML: `quickstart.html`, Text: `quickstart.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/api/docs/guides/migrate-to-responses
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Models | OpenAI API
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api/docs/models
- Bereinigte Download-URL: https://developers.openai.com/api/docs/models
- Lokale Datei(en): HTML: `models.html`, Text: `models.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/api/docs/guides/migrate-to-responses
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html`
- Hinweise: zusätzlich gefunden

### Erkannte URLs und Basisadressen

- `https://developers.openai.com/api/reference/chat-completions/overview`
- `https://developers.openai.com/api/docs/guides/completions`
- `https://developers.openai.com/api/docs/guides/migrate-to-responses`
- `https://developers.openai.com/showcase`
- `https://developers.openai.com/blog`
- `https://developers.openai.com/cookbook`
- `https://developers.openai.com/community`
- `https://developers.openai.com/api/docs/quickstart`
- `https://developers.openai.com/api/docs/models`
- `https://api.openai.com/v1/chat/completions`
- `https://api.openai.com/v1/responses`
- `https://api.example.com/search?q=${query`
- `https://api.example.com/search?q={query`
- `https://api.example.com/search`
- `https://openai-documentation.vercel.app/images/cat_and_otter.png`
- `https://api.nga.gov/iiif/a2e6da57-3cd1-4235-b20e-95dcaefed6c8/full/!800,800/0/default.jpg`
- `https://www.berkshirehathaway.com/letters/2024ltr.pdf`
- `https://api.openai.com/v1/files`
- `https://dmcp-server.deno.dev/sse`

### Erkannte Endpunkte / Pfade

- `https://developers.openai.com/api/docs/guides/migrate-to-responses`
- `https://developers.openai.com/api/docs/models`
- `/v1/chat/completions`
- `/v1/responses`
- `https://api.openai.com/v1/chat/completions`
- `https://api.openai.com/v1/responses`
- `/openai/openai-go/v3/responses`
- `https://api.openai.com/v1/responses"`
- `https://api.openai.com/v1/files`
- `POST https://api.openai.com/v1/responses`

### Erkannte Umgebungsvariablen / Konstanten

- `AGENTS`
- `GOAT`
- `BREAKING`
- `PLANS`
- `NVIDIA`
- `ESP32`
- `GPT4`
- `APIM`
- `BYOB`
- `CLIP`
- `DALL`
- `INPUT`
- `OPENAI_API_KEY`
- `SEARCH_API_KEY`
- `README`
- `ASSISTANT`
- `TODO`
- `POST`
- `DHTML`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

# Index – OpenAI

---

**Quelle `INDEX.md`**

### Chat Completions Overview | OpenAI API Reference
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/api/reference/chat-completions/overview
- Bereinigte Download-URL: https://developers.openai.com/api/reference/chat-completions/overview

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/api/reference/chat-completions/overview
- Bereinigte Download-URL: https://developers.openai.com/api/reference/chat-completions/overview
- Lokale Datei(en): HTML: `chat-completions-overview.html`, Text: `chat-completions-overview.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://developers.openai.com/api/reference/chat-completions/overview
- Lokale Datei(en): HTML: `chat-completions-overview.html`, Text: `chat-completions-overview.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI chat completions overview
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Completions API | OpenAI API
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/api/docs/guides/completions
- Bereinigte Download-URL: https://developers.openai.com/api/docs/guides/completions

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/api/docs/guides/completions
- Bereinigte Download-URL: https://developers.openai.com/api/docs/guides/completions
- Lokale Datei(en): HTML: `completions-guide.html`, Text: `completions-guide.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://developers.openai.com/api/docs/guides/completions
- Lokale Datei(en): HTML: `completions-guide.html`, Text: `completions-guide.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI completions guide
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Migrate to the Responses API | OpenAI API
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Bereinigte Download-URL: https://developers.openai.com/api/docs/guides/migrate-to-responses

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Bereinigte Download-URL: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Lokale Datei(en): HTML: `migrate-to-responses.html`, Text: `migrate-to-responses.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Lokale Datei(en): HTML: `migrate-to-responses.html`, Text: `migrate-to-responses.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenAI migrate to responses
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Showcase | OpenAI Developers
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/showcase
- Bereinigte Download-URL: https://developers.openai.com/showcase

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/showcase
- Bereinigte Download-URL: https://developers.openai.com/showcase
- Lokale Datei(en): HTML: `showcase.html`, Text: `showcase.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/api/reference/chat-completions/overview
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Blog | OpenAI Developers
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/blog
- Bereinigte Download-URL: https://developers.openai.com/blog

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/blog
- Bereinigte Download-URL: https://developers.openai.com/blog
- Lokale Datei(en): HTML: `blog.html`, Text: `blog.txt`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/cookbook
- Bereinigte Download-URL: https://developers.openai.com/cookbook

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/cookbook
- Bereinigte Download-URL: https://developers.openai.com/cookbook
- Lokale Datei(en): HTML: `cookbook.html`, Text: `cookbook.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/api/docs/guides/completions
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Community | OpenAI Developers
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/community
- Bereinigte Download-URL: https://developers.openai.com/community

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/community
- Bereinigte Download-URL: https://developers.openai.com/community
- Lokale Datei(en): HTML: `community.html`, Text: `community.txt`

---

**Quelle `INDEX.md`**

### Developer quickstart | OpenAI API
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api/docs/quickstart
- Bereinigte Download-URL: https://developers.openai.com/api/docs/quickstart

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/api/docs/quickstart
- Bereinigte Download-URL: https://developers.openai.com/api/docs/quickstart
- Lokale Datei(en): HTML: `quickstart.html`, Text: `quickstart.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.openai.com/api/docs/guides/migrate-to-responses
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Models | OpenAI API
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.openai.com/api/docs/models
- Bereinigte Download-URL: https://developers.openai.com/api/docs/models

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.openai.com/api/docs/models
- Bereinigte Download-URL: https://developers.openai.com/api/docs/models
- Lokale Datei(en): HTML: `models.html`, Text: `models.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://developers.openai.com/api/docs/models
- Lokale Datei(en): HTML: `models.html`, Text: `models.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `blog.txt`**

Blog | OpenAI Developers

---

**Quelle `blog.txt`**

Guides and concepts for the OpenAI API

---

**Quelle `blog.txt`**

Endpoints, parameters, and responses

---

**Quelle `blog.txt`**

Apps SDK

---

**Quelle `blog.txt`**

Notebook examples for building with OpenAI models

---

**Quelle `blog.txt`**

Docs, videos, and demo apps for building with OpenAI

---

**Quelle `blog.txt`**

responses createreasoning_effortrealtimeprompt caching

---

**Quelle `blog.txt`**

Models

---

**Quelle `blog.txt`**

Images and vision

---

**Quelle `blog.txt`**

Function calling

---

**Quelle `blog.txt`**

Responses API

---

**Quelle `blog.txt`**

Using tools

---

**Quelle `blog.txt`**

Agents SDK

---

**Quelle `blog.txt`**

Models and providers

---

**Quelle `blog.txt`**

Tools

---

**Quelle `blog.txt`**

Tool search

---

**Quelle `blog.txt`**

More tools 
 Apply Patch

---

**Quelle `blog.txt`**

Streaming

---

**Quelle `blog.txt`**

Counting tokens

---

**Quelle `blog.txt`**

Reasoning 
 Reasoning models

---

**Quelle `blog.txt`**

External models

---

**Quelle `blog.txt`**

Usage 
 Using realtime models

---

**Quelle `blog.txt`**

Vision fine-tuning

---

**Quelle `blog.txt`**

Specialized models

---

**Quelle `blog.txt`**

Embeddings

---

**Quelle `blog.txt`**

Rate limits

---

**Quelle `blog.txt`**

Authentication

---

**Quelle `blog.txt`**

Codex SDK

---

**Quelle `blog.txt`**

Apps SDK Commerce

---

**Quelle `blog.txt`**

Define tools

---

**Quelle `blog.txt`**

Authenticate users

---

**Quelle `blog.txt`**

From prompts to products: One year of Responses

---

**Quelle `blog.txt`**

OpenAI Developer Blog

---

**Quelle `blog.txt`**

Insights for developers building with OpenAI

---

**Quelle `blog.txt`**

Five stories from developers building agentic products with the Responses API in its first year.

---

**Quelle `blog.txt`**

Using skills and GitHub Actions to optimize Codex workflows in the OpenAI Agents SDK repos.

---

**Quelle `blog.txt`**

Practical patterns for building with skills, hosted shell, and server-side compaction in the Responses API.

---

**Quelle `blog.txt`**

OpenAI for Developers in 2025

---

**Quelle `blog.txt`**

How Codex ran OpenAI DevDay 2025

---

**Quelle `blog.txt`**

Why we built the Responses API

---

**Quelle `chat-completions-overview.txt`**

Chat Completions Overview | OpenAI API Reference

---

**Quelle `chat-completions-overview.txt`**

Guides and concepts for the OpenAI API

---

**Quelle `chat-completions-overview.txt`**

Endpoints, parameters, and responses

---

**Quelle `chat-completions-overview.txt`**

Apps SDK

---

**Quelle `chat-completions-overview.txt`**

Notebook examples for building with OpenAI models

---

**Quelle `chat-completions-overview.txt`**

Docs, videos, and demo apps for building with OpenAI

---

**Quelle `chat-completions-overview.txt`**

responses createreasoning_effortrealtimeprompt caching

---

**Quelle `chat-completions-overview.txt`**

Models

---

**Quelle `chat-completions-overview.txt`**

Images and vision

---

**Quelle `chat-completions-overview.txt`**

Function calling

---

**Quelle `chat-completions-overview.txt`**

Responses API

---

**Quelle `chat-completions-overview.txt`**

Using tools

---

**Quelle `chat-completions-overview.txt`**

Agents SDK

---

**Quelle `chat-completions-overview.txt`**

Models and providers

---

**Quelle `chat-completions-overview.txt`**

Tools

---

**Quelle `chat-completions-overview.txt`**

Tool search

---

**Quelle `chat-completions-overview.txt`**

More tools 
 Apply Patch

---

**Quelle `chat-completions-overview.txt`**

Streaming

---

**Quelle `chat-completions-overview.txt`**

Counting tokens

---

**Quelle `chat-completions-overview.txt`**

Reasoning 
 Reasoning models

---

**Quelle `chat-completions-overview.txt`**

External models

---

**Quelle `chat-completions-overview.txt`**

Usage 
 Using realtime models

---

**Quelle `chat-completions-overview.txt`**

Vision fine-tuning

---

**Quelle `chat-completions-overview.txt`**

Specialized models

---

**Quelle `chat-completions-overview.txt`**

Embeddings

---

**Quelle `chat-completions-overview.txt`**

Rate limits

---

**Quelle `chat-completions-overview.txt`**

Authentication

---

**Quelle `chat-completions-overview.txt`**

Codex SDK

---

**Quelle `chat-completions-overview.txt`**

Apps SDK Commerce

---

**Quelle `chat-completions-overview.txt`**

Define tools

---

**Quelle `chat-completions-overview.txt`**

Authenticate users

---

**Quelle `chat-completions-overview.txt`**

From prompts to products: One year of Responses

---

**Quelle `chat-completions-overview.txt`**

Responses
Create a response

---

**Quelle `chat-completions-overview.txt`**

Count input tokens

---

**Quelle `chat-completions-overview.txt`**

Streaming events

---

**Quelle `chat-completions-overview.txt`**

Image generation streaming events

---

**Quelle `chat-completions-overview.txt`**

Image edit streaming events

---

**Quelle `chat-completions-overview.txt`**

Embeddings
Create an embedding

---

**Quelle `chat-completions-overview.txt`**

Models
Retrieve a model

---

**Quelle `chat-completions-overview.txt`**

List models

---

**Quelle `community.txt`**

Community | OpenAI Developers

---

**Quelle `community.txt`**

Guides and concepts for the OpenAI API

---

**Quelle `community.txt`**

Endpoints, parameters, and responses

---

**Quelle `community.txt`**

Apps SDK

---

**Quelle `community.txt`**

Notebook examples for building with OpenAI models

---

**Quelle `community.txt`**

Docs, videos, and demo apps for building with OpenAI

---

**Quelle `community.txt`**

responses createreasoning_effortrealtimeprompt caching

---

**Quelle `community.txt`**

Models

---

**Quelle `community.txt`**

Images and vision

---

**Quelle `community.txt`**

Function calling

---

**Quelle `community.txt`**

Responses API

---

**Quelle `community.txt`**

Using tools

---

**Quelle `community.txt`**

Agents SDK

---

**Quelle `community.txt`**

Models and providers

---

**Quelle `community.txt`**

Tools

---

**Quelle `community.txt`**

Tool search

---

**Quelle `community.txt`**

More tools 
 Apply Patch

---

**Quelle `community.txt`**

Streaming

---

**Quelle `community.txt`**

Counting tokens

---

**Quelle `community.txt`**

Reasoning 
 Reasoning models

---

**Quelle `community.txt`**

External models

---

**Quelle `community.txt`**

Usage 
 Using realtime models

---

**Quelle `community.txt`**

Vision fine-tuning

---

**Quelle `community.txt`**

Specialized models

---

**Quelle `community.txt`**

Embeddings

---

**Quelle `community.txt`**

Rate limits

---

**Quelle `community.txt`**

Authentication

---

**Quelle `community.txt`**

Codex SDK

---

**Quelle `community.txt`**

Apps SDK Commerce

---

**Quelle `community.txt`**

Define tools

---

**Quelle `community.txt`**

Authenticate users

---

**Quelle `community.txt`**

From prompts to products: One year of Responses

---

**Quelle `community.txt`**

We have a range of programs and initiatives for builders, organizers,
 maintainers, and student leaders who want to be part of the OpenAI
 community.

---

**Quelle `community.txt`**

Recent posts from the Codex and the broader OpenAI community.

---

**Quelle `community.txt`**

OpenAI got me with the 2x increased usage limits on the Codex desktop app. It's a really nice experience.

---

**Quelle `community.txt`**

Note this is not a coding task but more like research / documentation. Same prompt but GPT 5.4's proposed revisions captured my intent much...

---

**Quelle `community.txt`**

- use the studio to comment + collab with others
- get transcripts + add API keys for autosyncs/agent chat

---

**Quelle `community.txt`**

@OpenAIDevs ya'll cooked!

---

**Quelle `community.txt`**

OpenAI rolls out GPT-5.3-Codex with faster AI coding and measurable efficiency gains.

---

**Quelle `community.txt`**

Because codex is the best for development. Everyone knows this. We aren’t using the other coding tools anymore.

---

**Quelle `completions-guide.txt`**

Completions API | OpenAI API

---

**Quelle `completions-guide.txt`**

Guides and concepts for the OpenAI API

---

**Quelle `completions-guide.txt`**

Endpoints, parameters, and responses

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `community.txt`**

````text
codex is so good. point at messy PR, sizzles out the 3 fixes out of a big commit, cleanly separates it. done.
````

---

**Quelle `community.txt`**

````text
codex hitting that inflection point where it's better at remembering API docs than i am. the shift from "AI suggests code" to "AI owns the implementation layer" is wild
````

---

**Quelle `migrate-to-responses.txt`**

````text
curl -s https://api.openai.com/v1/chat/completions \
````

---

**Quelle `migrate-to-responses.txt`**

````text
curl -s https://api.openai.com/v1/responses \
````

---

**Quelle `migrate-to-responses.txt`**

````text
curl https://api.openai.com/v1/chat/completions \
````

---

**Quelle `migrate-to-responses.txt`**

````text
curl https://api.openai.com/v1/responses \
````

---

**Quelle `migrate-to-responses.txt`**

````text
curl https://api.example.com/search \
````

---

**Quelle `quickstart.txt`**

````text
export OPENAI_API_KEY="your_api_key_here"
````

---

**Quelle `quickstart.txt`**

````text
setx OPENAI_API_KEY "your_api_key_here"
````

---

**Quelle `quickstart.txt`**

````text
npm install openai
````

---

**Quelle `quickstart.txt`**

````text
pip install openai
````

---

**Quelle `quickstart.txt`**

````text
curl "https://api.openai.com/v1/responses" \
````

---

**Quelle `quickstart.txt`**

````text
curl https://api.openai.com/v1/files \
````

---

**Quelle `quickstart.txt`**

````text
curl -X POST https://api.openai.com/v1/responses \
````

---

**Quelle `quickstart.txt`**

````text
curl https://api.openai.com/v1/responses \
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/OpenAI/blog.txt</code></summary>

````text
Blog | OpenAI Developers

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

 Search the blog 

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

 OpenAI Developer Blog 
 
Insights for developers building with OpenAI

Mar 25

How Perplexity Brought Voice Search to Millions Using the Realtime API

Lessons from how Perplexity Computer's voice agent was built with the Realtime API.

Audio

Mar 20

Designing delightful frontends with GPT-5.4

Practical techniques for steering GPT-5.4 toward polished, production-ready frontend designs.

General

Mar 11

From prompts to products: One year of Responses

Five stories from developers building agentic products with the Responses API in its first year.

API

Mar 9

Using skills to accelerate OSS maintenance

Using skills and GitHub Actions to optimize Codex workflows in the OpenAI Agents SDK repos.

Codex

Feb 26

Building frontend UIs with Codex and Figma

Use Codex and Figma to bring real, running interfaces into Figma, refine them, and bring changes back to Codex.

Codex

Feb 23

Run long horizon tasks with Codex

Codex

Feb 11

Shell + Skills + Compaction: Tips for long-running agents that do real work

Practical patterns for building with skills, hosted shell, and server-side compaction in the Responses API.

API

Feb 4

15 lessons learned building ChatGPT Apps

And how we incorporated them into a Codex Skill to help you build ChatGPT Apps 10x faster.

Apps SDK

Jan 22

Testing Agent Skills Systematically with Evals

A practical guide to turning agent skills into something you can test, score, and improve over time.

Codex

Jan 11

Supercharging Codex with JetBrains MCP at Skyscanner

How Skyscanner integrated Codex CLI with JetBrains IDEs to speed up debugging, testing, and development workflows.

Codex

Dec 30

OpenAI for Developers in 2025

A year-end roundup of the biggest model, API, and platform shifts for building production-grade agents.

General

Dec 22

Updates for developers building with voice

New audio model snapshots and broader access to Custom Voices for production voice apps.

Audio

Nov 24

What makes a great ChatGPT app

How to build capabilities that make conversations better.

Apps SDK

Oct 27

Using Codex for education at Dagster Labs

Learn how Dagster uses Codex in their open-source projects to accelerate documentation, translate content across mediums, and even measure how complete their docs are.

Codex

Oct 10

How Codex ran OpenAI DevDay 2025

Learn how Codex helped us build experiences, demos, products, and more

Codex

Sep 22

Why we built the Responses API

How the Responses API unlocks persistent reasoning, hosted tools, and multimodal workflows for GPT-5.

API

Sep 12

Developer notes on the Realtime API

Details worth noticing in recent realtime speech-to-speech updates

Audio

Sep 11

Hello, world!

Introducing our developer blog

General
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/OpenAI/chat-completions-overview.txt</code></summary>

````text
Chat Completions Overview | OpenAI API Reference 

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

Chat Completions

Chat Completions

Overview

Chat Completions Overview

The Chat Completions API endpoint will generate a model response from a
list of messages comprising a conversation.

Related guides:

Quickstart

Text inputs and outputs

Image inputs

Audio inputs and outputs

Structured Outputs

Function calling

Conversation state

Starting a new project? We recommend trying Responses
to take advantage of the latest OpenAI platform features. Compare
Chat Completions with Responses.
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/OpenAI/community.txt</code></summary>

````text
Community | OpenAI Developers

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

 Search community pages 

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

 Community 

We have a range of programs and initiatives for builders, organizers,
 maintainers, and student leaders who want to be part of the OpenAI
 community.

Codex Ambassadors

Codex for Open Source

Join a meetup

Meet builders in person, swap workflows, and learn how others are
 shipping with Codex.

 Upcoming Apr 24, 2026 

 Community Meetup 
 
 Lima, Peru 

 Apr 24, 2026 

Hosted by Railly Hugo 

 Upcoming Apr 24, 2026 

 Community Hackathon 
 
 Singapore 

 Apr 24, 2026 

Hosted by Agrim Singh 

See all meetups

Codex for Students

Verified university students in the United States and Canada can
 claim $100 in ChatGPT credits to use in Codex.

 See offer 

What builders are sharing

Recent posts from the Codex and the broader OpenAI community.

 Bindu Reddy 

@bindureddy 

 Our ops team has switched to GPT 5.4 for ops and coding tasks

It’s just way better for ops, SRE and cloud configuration issues

Likely because it’s just a lot more aware of these knowledge bases 
 
 Apr 8, 2026 

 am.will 

@LLMJunky 

 The Codex app server was such a brilliant stroke of foresight that really doesn't get enough love

Not only are you allowed to use your chatgpt account with any harness, but you can build your own apps directly on top of theirs.

They just make building on and with codex such a great experience 
 
 Apr 4, 2026 

 David Marcus 

@davidmarcus 

 It's wild that every time you run a Codex code review from Claude Code, it finds critical issues. Not 95% of the times, 100%. 
 
 Mar 28, 2026 

 Garry Tan 

@garrytan 

 OK Codex is GOAT at finding bugs and finding plan errors 
 
 Mar 19, 2026 

 MJ 

@mjackson 

 If you haven't tried Codex yet, you're missing something BIG. 
 
 Mar 13, 2026 

 Victor Mota 

@vimota 

 OpenAI got me with the 2x increased usage limits on the Codex desktop app. It's a really nice experience.

Super smooth - claude code app is so laggy.

And the handoff experience is amazing.
> I started a session locally on codex app
> had to leave so I handed it off to codex cloud (with 2 attempts)
> got back to my computer, compared both attempts, picked the better one, synced it back to my computer
> continued to iterate on it locally 
 
 Mar 13, 2026 

 Derya Unutmaz, MD 

@DeryaTR_ 

 My new Sunday morning routine:

1. Get coffee
2. Check GPT-5.4 projects on the Codex App, continue & start new ones
4. Launch ChatGPT 5.4 Pro for fresh brainstorming sessions
5. Think/learn how to use the 90% of AI capabilities I have yet to explore
6. Drink more coffee 
 
 Mar 8, 2026 

 Evan You 

@youyuxi 

 Did a full repo internal / public docs vs. source code alignment check + update - GPT 5.4 did a significantly better job than Opus 4.6.

Note this is not a coding task but more like research / documentation. Same prompt but GPT 5.4's proposed revisions captured my intent much... 
 
 Mar 8, 2026 

 ashe 

@ashebytes 

 given the interest, I productized my video hub!

- have 1 place for video drafts + X, Youtube, tiktok vids
- use the studio to comment + collab with others
- get transcripts + add API keys for autosyncs/agent chat

made with codex 5.3 🖤 linked below 
 
 Mar 5, 2026 

 John Jung 

@johnjjung 

 Codex 5.3 xhigh spark has been phenomenal - you’re able to stay in a state of flow building. The focus and power of hitting problem after problem is incredible. 
 
 Mar 5, 2026 

 Mitchell Hashimoto 

@mitchellh 

 Ahhhh, Codex 5.3 (xhigh) with a vague prompt just solved a bug that I and others have been struggling to fix for over 6 months. Other reasoning levels with Codex failed, Opus 4.6 failed. Cost $4.14 and 45 minutes. 
 
 Mar 5, 2026 

 Theo - t3.gg 

@theo 

 Almost every verifiable problem I've been sent so far has been solved by 5.3 Codex.

Please make sure 5.3 Codex can't solve your problem before you submit it to me. I'm a youtuber not a prompt box. 
 
 Mar 2, 2026 

 Mitchell Hashimoto 

@mitchellh 

 I know this is pretty well established at this point, but Codex 5.3 is a much more effective model than Opus 4.6. I went back and forth on both for a bit, but haven't touched Opus at all now for a full week. First model to get me off of Opus... ever. Good job Codex team. 
 
 Feb 25, 2026 

 Mariusz Kurman 

@mkurman88 

 Those who wrote "Try Codex" when I was hyping CC were right. Codex 5.3 is another level. It delivers so much with such high quality - I'm literally shocked. 5.2 was a mess; 5.3 is in another league. 
 
 Feb 24, 2026 

 Dennis Hannusch 

@DennisHannusch 

 I started daily driving Codex with gpt-5.3-codex this week.. it's reaaally good.

I've gotten used to complex workflows and context management, but Codex just does what I ask. I keep expecting quality to drop deep into a session, but it doesn't.

@OpenAIDevs ya'll cooked! 
 
 Feb 11, 2026 

 ORO AI ✈️ ETHDenver 

@getoro_xyz 

 OpenAI rolls out GPT-5.3-Codex with faster AI coding and measurable efficiency gains.

Look at the chart. That Kurzweil Curve doesn't happen by accident.

It's the result of a new data diet plan, shifting toward real-world and private workflow data. 

 Feb 11, 2026 

 Christopher Ehrlich 

@ccccjjjjeeee 

 It actually worked!

For the past couple of days I've been throwing 5.3-codex at the C codebase for SimCity (1989) to port it to TypeScript.

Not reading any code, very little steering.

Today I have SimCity running in the browser.

I can't believe this new world we live in. 

 Feb 10, 2026 

 Dan Shipper 📧 

@danshipper 

 BREAKING:

At the Super Bowl halftime show, Bad Bunny says he prefers Opus 4.6 for vibe coding but turns to 5.3 Codex for gnarly engineering problems.

"Opus pa'' vibear, Codex pa'' lo heavy" - he said 
 
 Feb 9, 2026 

 Guillermo Rauch 

@rauchg 

 🆕 GPT 5.3 Codex (xhigh) achieves 90% on Next.js evals out of the box, "frame-mogging" the competition so to speak: 

 Feb 9, 2026 

 Angel ❄️ 

@Angaisb_ 

 GPT-5.3 Codex is actually pretty insane with Three.js

This Minecraft clone works smoothly and it didn't take too long to make

I also tried Opus 4.6, but for some reason it got stuck 
 
 Feb 5, 2026 

 Angel ❄️ 

@Angaisb_ 

 GPT-5.3-Codex with image gen skill (NBP)

I'm loving this model so much. This is one-shot 

 Video 

 Feb 5, 2026 

 Flavio Adamo 

@flavioAd 

 Codex app is the most 'non-native' app that somehow feels more native than native apps 

 Feb 2, 2026 

 Pallav Agarwal 

@pallavmac 

 Ok the new Codex app is incredible. You can build and run an Xcode project from Codex directly so you can vibecode iOS apps without opening Xcode! 
 
 Feb 2, 2026 

 Paul Solt 

@PaulSolt 

 The Codex app feels like the missing IDE layer for the Codex CLI.

One-click to open Xcode, run iOS/macOS apps, review diffs, and manage agents.

Hard to go back after this. 
 
 Feb 2, 2026 

 Kristen Anderson 

@FintechKristen 

 Because codex is the best for development. Everyone knows this. We aren’t using the other coding tools anymore. 
 
 Jan 28, 2026 

 Nate Berkopec 

@nateberkopec 

 I have not seen a better code review agent that Codex 5.2 xhigh /review. 

 Jan 27, 2026 

 Anthony 

@kr0der 

 Codex v0.91.0 has plan mode, and it's really thorough.

this one plan took 27% of its context. if you've used Codex you know that 27% is a lot which means it's thoroughly searching before creating plans - no rushing/taking shortcuts.

try it out by adding 'collaboration_modes =… 

 Jan 26, 2026 

 Rudrank Riyam 

@rudrank 

 I spent 3 hours debugging and running all kinds of tests with Opus 4.5 for the discrepancy between CLI vs iOS app embeddings and the retrieval

5.2 Codex xHigh did "thinking" for like 20 minutes and casually one-shot it 

 Jan 26, 2026 

 Thomas Ricouard 

@Dimillian 

 Yes. At this point, I don't care about speed anymore. Speed is solved by running multiple tasks in parallel.
What I want is an agent that can think out of the box like a human, and Codex does just that. 
 
 Jan 26, 2026 

 Rudrank Riyam 

@rudrank 

 Codex models is something you can just "trust" more than others

I was in car and saw an issue created, and I let a cloud agent work on it for ~17 minutes 

 Jan 25, 2026 

 Henry 

@henrytdowling 

 Codex is *really good* for coding, one day people will realize 
 
 Jan 23, 2026 

 Gavin Nelson 

@Gavmn 

 Favorite recent use of Codex:

- pull data from my Apple Music library with a two decade old mess of genre metadata

- use MusicKit to pull in proper Apple Music genre metadata

- write an Apple Script to update genres with the data from Apple's catalog

💆🏻‍♂️ 

 Jan 20, 2026 

 Xeophon 

@xeophon 

 Longest Codex run achieved with 8 hours 👀 
 
 Jan 18, 2026 

 Peter Steinberger 🦞 

@steipete 

 codex is so good. point at messy PR, sizzles out the 3 fixes out of a big commit, cleanly separates it. done.

also idk why it always says full gate but i fully adopted this. 

 Jan 13, 2026 

 Ian Nuttall 

@iannuttall 

 One thing I have noticed with Codex CLI and 5.2 Codex high model recently

I never worry about the context window or compaction any more

It just does it, really fast, and the agent carries on like nothing happened, no loss in quality 
 
 Jan 9, 2026 

 Aaron Francis 

@aarondfrancis 

 Codex just spent like 6 hours debugging CI while I played outside with my kids 
 
 Jan 2, 2026 

 AK 

@ak_cozmo 

 codex hitting that inflection point where it's better at remembering API docs than i am. the shift from "AI suggests code" to "AI owns the implementation layer" is wild

most underrated change: junior devs can now ship senior-level infra. distribution of execution ability is… 
 
 Dec 20, 2025 

 Numman Ali 

@nummanali 

 Bloody hell, I'll say this

GPT 5.2 Codex Extra High is a methodical beast

It's updating the OpenCode OpenAI Codex OAuth plugin

Literally not leaving any stone unturned

This is the first model that feels like it's building for itself ie leaving the door open for future work 
 
 Dec 19, 2025 

 Bindu Reddy 

@bindureddy 

 Our ops team has switched to GPT 5.4 for ops and coding tasks

It’s just way better for ops, SRE and cloud configuration issues

Likely because it’s just a lot more aware of these knowledge bases 
 
 Apr 8, 2026 

 David Marcus 

@davidmarcus 

 It's wild that every time you run a Codex code review from Claude Code, it finds critical issues. Not 95% of the times, 100%. 
 
 Mar 28, 2026 

 MJ 

@mjackson 

 If you haven't tried Codex yet, you're missing something BIG. 
 
 Mar 13, 2026 

 Derya Unutmaz, MD 

@DeryaTR_ 

 My new Sunday morning routine:

1. Get coffee
2. Check GPT-5.4 projects on the Codex App, continue & start new ones
4. Launch ChatGPT 5.4 Pro for fresh brainstorming sessions
5. Think/learn how to use the 90% of AI capabilities I have yet to explore
6. Drink more coffee 
 
 Mar 8, 2026 

 ashe 

@ashebytes 

 given the interest, I productized my video hub!

- have 1 place for video drafts + X, Youtube, tiktok vids
- use the studio to comment + collab with others
- get transcripts + add API keys for autosyncs/agent chat

made with codex 5.3 🖤 linked below 
 
 Mar 5, 2026 

 Mitchell Hashimoto 

@mitchellh 

 Ahhhh, Codex 5.3 (xhigh) with a vague prompt just solved a bug that I and others have been struggling to fix for over 6 months. Other reasoning levels with Codex failed, Opus 4.6 failed. Cost $4.14 and 45 minutes. 
 
 Mar 5, 2026 

 Mitchell Hashimoto 

@mitchellh 

 I know this is pretty well established at this point, but Codex 5.3 is a much more effective model than Opus 4.6. I went back and forth on both for a bit, but haven't touched Opus at all now for a full week. First model to get me off of Opus... ever. Good job Codex team. 
 
 Feb 25, 2026 

 Dennis Hannusch 

@DennisHannusch 

 I started daily driving Codex with gpt-5.3-codex this week.. it's reaaally good.

I've gotten used to complex workflows and context management, but Codex just does what I ask. I keep expecting quality to drop deep into a session, but it doesn't.

@OpenAIDevs ya'll cooked! 
 
 Feb 11, 2026 

 Christopher Ehrlich 

@ccccjjjjeeee 

 It actually worked!

For the past couple of days I've been throwing 5.3-codex at the C codebase for SimCity (1989) to port it to TypeScript.

Not reading any code, very little steering.

Today I have SimCity running in the browser.

I can't believe this new world we live in. 

 Feb 10, 2026 

 Guillermo Rauch 

@rauchg 

 🆕 GPT 5.3 Codex (xhigh) achieves 90% on Next.js evals out of the box, "frame-mogging" the competition so to speak: 

 Feb 9, 2026 

 Angel ❄️ 

@Angaisb_ 

 GPT-5.3-Codex with image gen skill (NBP)

I'm loving this model so much. This is one-shot 

 Video 

 Feb 5, 2026 

 Pallav Agarwal 

@pallavmac 

 Ok the new Codex app is incredible. You can build and run an Xcode project from Codex directly so you can vibecode iOS apps without opening Xcode! 
 
 Feb 2, 2026 

 Kristen Anderson 

@FintechKristen 

 Because codex is the best for development. Everyone knows this. We aren’t using the other coding tools anymore. 
 
 Jan 28, 2026 

 Anthony 

@kr0der 

 Codex v0.91.0 has plan mode, and it's really thorough.

this one plan took 27% of its context. if you've used Codex you know that 27% is a lot which means it's thoroughly searching before creating plans - no rushing/taking shortcuts.

try it out by adding 'collaboration_modes =… 

 Jan 26, 2026 

 Thomas Ricouard 

@Dimillian 

 Yes. At this point, I don't care about speed anymore. Speed is solved by running multiple tasks in parallel.
What I want is an agent that can think out of the box like a human, and Codex does just that. 
 
 Jan 26, 2026 

 Henry 

@henrytdowling 

 Codex is *really good* for coding, one day people will realize 
 
 Jan 23, 2026 

 Xeophon 

@xeophon 

 Longest Codex run achieved with 8 hours 👀 
 
 Jan 18, 2026 

 Ian Nuttall 

@iannuttall 

 One thing I have noticed with Codex CLI and 5.2 Codex high model recently

I never worry about the context window or compaction any more

It just does it, really fast, and the agent carries on like nothing happened, no loss in quality 
 
 Jan 9, 2026 

 AK 

@ak_cozmo 

 codex hitting that inflection point where it's better at remembering API docs than i am. the shift from "AI suggests code" to "AI owns the implementation layer" is wild

most underrated change: junior devs can now ship senior-level infra. distribution of execution ability is… 
 
 Dec 20, 2025 

 am.will 

@LLMJunky 

 The Codex app server was such a brilliant stroke of foresight that really doesn't get enough love

Not only are you allowed to use your chatgpt account with any harness, but you can build your own apps directly on top of theirs.

They just make building on and with codex such a great experience 
 
 Apr 4, 2026 

 Garry Tan 

@garrytan 

 OK Codex is GOAT at finding bugs and finding plan errors 
 
 Mar 19, 2026 

 Victor Mota 

@vimota 

 OpenAI got me with the 2x increased usage limits on the Codex desktop app. It's a really nice experience.

Super smooth - claude code app is so laggy.

And the handoff experience is amazing.
> I started a session locally on codex app
> had to leave so I handed it off to codex cloud (with 2 attempts)
> got back to my computer, compared both attempts, picked the better one, synced it back to my computer
> continued to iterate on it locally 
 
 Mar 13, 2026 

 Evan You 

@youyuxi 

 Did a full repo internal / public docs vs. source code alignment check + update - GPT 5.4 did a significantly better job than Opus 4.6.

Note this is not a coding task but more like research / documentation. Same prompt but GPT 5.4's proposed revisions captured my intent much... 
 
 Mar 8, 2026 

 John Jung 

@johnjjung 

 Codex 5.3 xhigh spark has been phenomenal - you’re able to stay in a state of flow building. The focus and power of hitting problem after problem is incredible. 
 
 Mar 5, 2026 

 Theo - t3.gg 

@theo 

 Almost every verifiable problem I've been sent so far has been solved by 5.3 Codex.

Please make sure 5.3 Codex can't solve your problem before you submit it to me. I'm a youtuber not a prompt box. 
 
 Mar 2, 2026 

 Mariusz Kurman 

@mkurman88 

 Those who wrote "Try Codex" when I was hyping CC were right. Codex 5.3 is another level. It delivers so much with such high quality - I'm literally shocked. 5.2 was a mess; 5.3 is in another league. 
 
 Feb 24, 2026 

 ORO AI ✈️ ETHDenver 

@getoro_xyz 

 OpenAI rolls out GPT-5.3-Codex with faster AI coding and measurable efficiency gains.

Look at the chart. That Kurzweil Curve doesn't happen by accident.

It's the result of a new data diet plan, shifting toward real-world and private workflow data. 

 Feb 11, 2026 

 Dan Shipper 📧 

@danshipper 

 BREAKING:

At the Super Bowl halftime show, Bad Bunny says he prefers Opus 4.6 for vibe coding but turns to 5.3 Codex for gnarly engineering problems.

"Opus pa'' vibear, Codex pa'' lo heavy" - he said 
 
 Feb 9, 2026 

 Angel ❄️ 

@Angaisb_ 

 GPT-5.3 Codex is actually pretty insane with Three.js

This Minecraft clone works smoothly and it didn't take too long to make

I also tried Opus 4.6, but for some reason it got stuck 
 
 Feb 5, 2026 

 Flavio Adamo 

@flavioAd 

 Codex app is the most 'non-native' app that somehow feels more native than native apps 

 Feb 2, 2026 

 Paul Solt 

@PaulSolt 

 The Codex app feels like the missing IDE layer for the Codex CLI.

One-click to open Xcode, run iOS/macOS apps, review diffs, and manage agents.

Hard to go back after this. 
 
 Feb 2, 2026 

 Nate Berkopec 

@nateberkopec 

 I have not seen a better code review agent that Codex 5.2 xhigh /review. 

 Jan 27, 2026 

 Rudrank Riyam 

@rudrank 

 I spent 3 hours debugging and running all kinds of tests with Opus 4.5 for the discrepancy between CLI vs iOS app embeddings and the retrieval

5.2 Codex xHigh did "thinking" for like 20 minutes and casually one-shot it 

 Jan 26, 2026 

 Rudrank Riyam 

@rudrank 

 Codex models is something you can just "trust" more than others

I was in car and saw an issue created, and I let a cloud agent work on it for ~17 minutes 

 Jan 25, 2026 

 Gavin Nelson 

@Gavmn 

 Favorite recent use of Codex:

- pull data from my Apple Music library with a two decade old mess of genre metadata

- use MusicKit to pull in proper Apple Music genre metadata

- write an Apple Script to update genres with the data from Apple's catalog

💆🏻‍♂️ 

 Jan 20, 2026 

 Peter Steinberger 🦞 

@steipete 

 codex is so good. point at messy PR, sizzles out the 3 fixes out of a big commit, cleanly separates it. done.

also idk why it always says full gate but i fully adopted this. 

 Jan 13, 2026 

 Aaron Francis 

@aarondfrancis 

 Codex just spent like 6 hours debugging CI while I played outside with my kids 
 
 Jan 2, 2026 

 Numman Ali 

@nummanali 

 Bloody hell, I'll say this

GPT 5.2 Codex Extra High is a methodical beast

It's updating the OpenCode OpenAI Codex OAuth plugin

Literally not leaving any stone unturned

This is the first model that feels like it's building for itself ie leaving the door open for future work 
 
 Dec 19, 2025 

 Bindu Reddy 

@bindureddy 

 Our ops team has switched to GPT 5.4 for ops and coding tasks

It’s just way better for ops, SRE and cloud configuration issues

Likely because it’s just a lot more aware of these knowledge bases 
 
 Apr 8, 2026 

 Garry Tan 

@garrytan 

 OK Codex is GOAT at finding bugs and finding plan errors 
 
 Mar 19, 2026 

 Derya Unutmaz, MD 

@DeryaTR_ 

 My new Sunday morning routine:

1. Get coffee
2. Check GPT-5.4 projects on the Codex App, continue & start new ones
4. Launch ChatGPT 5.4 Pro for fresh brainstorming sessions
5. Think/learn how to use the 90% of AI capabilities I have yet to explore
6. Drink more coffee 
 
 Mar 8, 2026 

 John Jung 

@johnjjung 

 Codex 5.3 xhigh spark has been phenomenal - you’re able to stay in a state of flow building. The focus and power of hitting problem after problem is incredible. 
 
 Mar 5, 2026 

 Mitchell Hashimoto 

@mitchellh 

 I know this is pretty well established at this point, but Codex 5.3 is a much more effective model than Opus 4.6. I went back and forth on both for a bit, but haven't touched Opus at all now for a full week. First model to get me off of Opus... ever. Good job Codex team. 
 
 Feb 25, 2026 

 ORO AI ✈️ ETHDenver 

@getoro_xyz 

 OpenAI rolls out GPT-5.3-Codex with faster AI coding and measurable efficiency gains.

Look at the chart. That Kurzweil Curve doesn't happen by accident.

It's the result of a new data diet plan, shifting toward real-world and private workflow data. 

 Feb 11, 2026 

 Guillermo Rauch 

@rauchg 

 🆕 GPT 5.3 Codex (xhigh) achieves 90% on Next.js evals out of the box, "frame-mogging" the competition so to speak: 

 Feb 9, 2026 

 Flavio Adamo 

@flavioAd 

 Codex app is the most 'non-native' app that somehow feels more native than native apps 

 Feb 2, 2026 

 Kristen Anderson 

@FintechKristen 

 Because codex is the best for development. Everyone knows this. We aren’t using the other coding tools anymore. 
 
 Jan 28, 2026 

 Rudrank Riyam 

@rudrank 

 I spent 3 hours debugging and running all kinds of tests with Opus 4.5 for the discrepancy between CLI vs iOS app embeddings and the retrieval

5.2 Codex xHigh did "thinking" for like 20 minutes and casually one-shot it 

 Jan 26, 2026 

 Henry 

@henrytdowling 

 Codex is *really good* for coding, one day people will realize 
 
 Jan 23, 2026 

 Peter Steinberger 🦞 

@steipete 

 codex is so good. point at messy PR, sizzles out the 3 fixes out of a big commit, cleanly separates it. done.

also idk why it always says full gate but i fully adopted this. 

 Jan 13, 2026 

 AK 

@ak_cozmo 

 codex hitting that inflection point where it's better at remembering API docs than i am. the shift from "AI suggests code" to "AI owns the implementation layer" is wild

most underrated change: junior devs can now ship senior-level infra. distribution of execution ability is… 
 
 Dec 20, 2025 

 am.will 

@LLMJunky 

 The Codex app server was such a brilliant stroke of foresight that really doesn't get enough love

Not only are you allowed to use your chatgpt account with any harness, but you can build your own apps directly on top of theirs.

They just make building on and with codex such a great experience 
 
 Apr 4, 2026 

 MJ 

@mjackson 

 If you haven't tried Codex yet, you're missing something BIG. 
 
 Mar 13, 2026 

 Evan You 

@youyuxi 

 Did a full repo internal / public docs vs. source code alignment check + update - GPT 5.4 did a significantly better job than Opus 4.6.

Note this is not a coding task but more like research / documentation. Same prompt but GPT 5.4's proposed revisions captured my intent much... 
 
 Mar 8, 2026 

 Mitchell Hashimoto 

@mitchellh 

 Ahhhh, Codex 5.3 (xhigh) with a vague prompt just solved a bug that I and others have been struggling to fix for over 6 months. Other reasoning levels with Codex failed, Opus 4.6 failed. Cost $4.14 and 45 minutes. 
 
 Mar 5, 2026 

 Mariusz Kurman 

@mkurman88 

 Those who wrote "Try Codex" when I was hyping CC were right. Codex 5.3 is another level. It delivers so much with such high quality - I'm literally shocked. 5.2 was a mess; 5.3 is in another league. 
 
 Feb 24, 2026 

 Christopher Ehrlich 

@ccccjjjjeeee 

 It actually worked!

For the past couple of days I've been throwing 5.3-codex at the C codebase for SimCity (1989) to port it to TypeScript.

Not reading any code, very little steering.

Today I have SimCity running in the browser.

I can't believe this new world we live in. 

 Feb 10, 2026 

 Angel ❄️ 

@Angaisb_ 

 GPT-5.3 Codex is actually pretty insane with Three.js

This Minecraft clone works smoothly and it didn't take too long to make

I also tried Opus 4.6, but for some reason it got stuck 
 
 Feb 5, 2026 

 Pallav Agarwal 

@pallavmac 

 Ok the new Codex app is incredible. You can build and run an Xcode project from Codex directly so you can vibecode iOS apps without opening Xcode! 
 
 Feb 2, 2026 

 Nate Berkopec 

@nateberkopec 

 I have not seen a better code review agent that Codex 5.2 xhigh /review. 

 Jan 27, 2026 

 Thomas Ricouard 

@Dimillian 

 Yes. At this point, I don't care about speed anymore. Speed is solved by running multiple tasks in parallel.
What I want is an agent that can think out of the box like a human, and Codex does just that. 
 
 Jan 26, 2026 

 Gavin Nelson 

@Gavmn 

 Favorite recent use of Codex:

- pull data from my Apple Music library with a two decade old mess of genre metadata

- use MusicKit to pull in proper Apple Music genre metadata

- write an Apple Script to update genres with the data from Apple's catalog

💆🏻‍♂️ 

 Jan 20, 2026 

 Ian Nuttall 

@iannuttall 

 One thing I have noticed with Codex CLI and 5.2 Codex high model recently

I never worry about the context window or compaction any more

It just does it, really fast, and the agent carries on like nothing happened, no loss in quality 
 
 Jan 9, 2026 

 Numman Ali 

@nummanali 

 Bloody hell, I'll say this

GPT 5.2 Codex Extra High is a methodical beast

It's updating the OpenCode OpenAI Codex OAuth plugin

Literally not leaving any stone unturned

This is the first model that feels like it's building for itself ie leaving the door open for future work 
 
 Dec 19, 2025 

 David Marcus 

@davidmarcus 

 It's wild that every time you run a Codex code review from Claude Code, it finds critical issues. Not 95% of the times, 100%. 
 
 Mar 28, 2026 

 Victor Mota 

@vimota 

 OpenAI got me with the 2x increased usage limits on the Codex desktop app. It's a really nice experience.

Super smooth - claude code app is so laggy.

And the handoff experience is amazing.
> I started a session locally on codex app
> had to leave so I handed it off to codex cloud (with 2 attempts)
> got back to my computer, compared both attempts, picked the better one, synced it back to my computer
> continued to iterate on it locally 
 
 Mar 13, 2026 

 ashe 

@ashebytes 

 given the interest, I productized my video hub!

- have 1 place for video drafts + X, Youtube, tiktok vids
- use the studio to comment + collab with others
- get transcripts + add API keys for autosyncs/agent chat

made with codex 5.3 🖤 linked below 
 
 Mar 5, 2026 

 Theo - t3.gg 

@theo 

 Almost every verifiable problem I've been sent so far has been solved by 5.3 Codex.

Please make sure 5.3 Codex can't solve your problem before you submit it to me. I'm a youtuber not a prompt box. 
 
 Mar 2, 2026 

 Dennis Hannusch 

@DennisHannusch 

 I started daily driving Codex with gpt-5.3-codex this week.. it's reaaally good.

I've gotten used to complex workflows and context management, but Codex just does what I ask. I keep expecting quality to drop deep into a session, but it doesn't.

@OpenAIDevs ya'll cooked! 
 
 Feb 11, 2026 

 Dan Shipper 📧 

@danshipper 

 BREAKING:

At the Super Bowl halftime show, Bad Bunny says he prefers Opus 4.6 for vibe coding but turns to 5.3 Codex for gnarly engineering problems.

"Opus pa'' vibear, Codex pa'' lo heavy" - he said 
 
 Feb 9, 2026 

 Angel ❄️ 

@Angaisb_ 

 GPT-5.3-Codex with image gen skill (NBP)

I'm loving this model so much. This is one-shot 

 Video 

 Feb 5, 2026 

 Paul Solt 

@PaulSolt 

 The Codex app feels like the missing IDE layer for the Codex CLI.

One-click to open Xcode, run iOS/macOS apps, review diffs, and manage agents.

Hard to go back after this. 
 
 Feb 2, 2026 

 Anthony 

@kr0der 

 Codex v0.91.0 has plan mode, and it's really thorough.

this one plan took 27% of its context. if you've used Codex you know that 27% is a lot which means it's thoroughly searching before creating plans - no rushing/taking shortcuts.

try it out by adding 'collaboration_modes =… 

 Jan 26, 2026 

 Rudrank Riyam 

@rudrank 

 Codex models is something you can just "trust" more than others

I was in car and saw an issue created, and I let a cloud agent work on it for ~17 minutes 

 Jan 25, 2026 

 Xeophon 

@xeophon 

 Longest Codex run achieved with 8 hours 👀 
 
 Jan 18, 2026 

 Aaron Francis 

@aarondfrancis 

 Codex just spent like 6 hours debugging CI while I played outside with my kids 
 
 Jan 2, 2026
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/OpenAI/completions-guide.txt</code></summary>

````text
Completions API | OpenAI API

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

 Copy Page 

 Completions API 

 Copy Page 

The completions API endpoint received its final update in July 2023 and has a different interface than the new Chat Completions endpoint. Instead of the input being a list of messages, the input is a freeform text string called a prompt.

An example legacy Completions API call looks like the following:

python

1
2
3
4
5
6
7
from openai import OpenAI
client = OpenAI()

response = client.completions.create(
model="gpt-3.5-turbo-instruct",
prompt="Write a tagline for an ice cream shop."
)

1
2
3
4
const completion = await openai.completions.create({
model: 'gpt-3.5-turbo-instruct',
prompt: 'Write a tagline for an ice cream shop.'
});

See the full API reference documentation to learn more.

Inserting text

The completions endpoint also supports inserting text by providing a suffix in addition to the standard prompt which is treated as a prefix. This need naturally arises when writing long-form text, transitioning between paragraphs, following an outline, or guiding the model towards an ending. This also works on code, and can be used to insert in the middle of a function or file.

Deep dive

Inserting text

To illustrate how suffix context effects generated text, consider the prompt, “Today I decided to make a big change.” There’s many ways one could imagine completing the sentence. But if we now supply the ending of the story: “I’ve gotten many compliments on my new hair!”, the intended completion becomes clear.

I went to college at Boston University. After getting my degree, I decided to make a change**. A big change!**

I packed my bags and moved to the west coast of the United States.

Now, I can’t get enough of the Pacific Ocean!

By providing the model with additional context, it can be much more steerable. However, this is a more constrained and challenging task for the model. To get the best results, we recommend the following:

Use max_tokens > 256. The model is better at inserting longer completions. With too small max_tokens, the model may be cut off before it’s able to connect to the suffix. Note that you will only be charged for the number of tokens produced even when using larger max_tokens.

Prefer finish_reason == “stop”. When the model reaches a natural stopping point or a user provided stop sequence, it will set finish_reason as “stop”. This indicates that the model has managed to connect to the suffix well and is a good signal for the quality of a completion. This is especially relevant for choosing between a few completions when using n > 1 or resampling (see the next point).

Resample 3-5 times. While almost all completions connect to the prefix, the model may struggle to connect the suffix in harder cases. We find that resampling 3 or 5 times (or using best_of with k=3,5) and picking the samples with “stop” as their finish_reason can be an effective way in such cases. While resampling, you would typically want a higher temperatures to increase diversity.

Note: if all the returned samples have finish_reason == “length”, it’s likely that max_tokens is too small and model runs out of tokens before it manages to connect the prompt and the suffix naturally. Consider increasing max_tokens before resampling.

Try giving more clues. In some cases to better help the model’s generation, you can provide clues by giving a few examples of patterns that the model can follow to decide a natural place to stop.

How to make a delicious hot chocolate:

1.** Boil water**
2. Put hot chocolate in a cup
3. Add boiling water to the cup 4. Enjoy the hot chocolate

Dogs are loyal animals.

Lions are ferocious animals.

Dolphins** are playful animals.**

Horses are majestic animals.

Completions response format

An example completions API response looks as follows:

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
11
12
13
14
15
16
17
18
19
{
 "choices": [
 {
 "finish_reason": "length",
 "index": 0,
 "logprobs": null,
 "text": "\n\n\"Let Your Sweet Tooth Run Wild at Our Creamy Ice Cream Shack"
 }
 ],
 "created": 1683130927,
 "id": "cmpl-7C9Wxi9Du4j1lQjdjhxBlO22M61LD",
 "model": "gpt-3.5-turbo-instruct",
 "object": "text_completion",
 "usage": {
 "completion_tokens": 16,
 "prompt_tokens": 10,
 "total_tokens": 26
 }
}

In Python, the output can be extracted with response['choices'][0]['text'].

The response format is similar to the response format of the Chat Completions API.

Inserting text

The completions endpoint also supports inserting text by providing a suffix in addition to the standard prompt which is treated as a prefix. This need naturally arises when writing long-form text, transitioning between paragraphs, following an outline, or guiding the model towards an ending. This also works on code, and can be used to insert in the middle of a function or file.

Deep dive

Inserting text

To illustrate how suffix context effects generated text, consider the prompt, “Today I decided to make a big change.” There’s many ways one could imagine completing the sentence. But if we now supply the ending of the story: “I’ve gotten many compliments on my new hair!”, the intended completion becomes clear.

I went to college at Boston University. After getting my degree, I decided to make a change**. A big change!**

I packed my bags and moved to the west coast of the United States.

Now, I can’t get enough of the Pacific Ocean!

By providing the model with additional context, it can be much more steerable. However, this is a more constrained and challenging task for the model. To get the best results, we recommend the following:

Use max_tokens > 256. The model is better at inserting longer completions. With too small max_tokens, the model may be cut off before it’s able to connect to the suffix. Note that you will only be charged for the number of tokens produced even when using larger max_tokens.

Prefer finish_reason == “stop”. When the model reaches a natural stopping point or a user provided stop sequence, it will set finish_reason as “stop”. This indicates that the model has managed to connect to the suffix well and is a good signal for the quality of a completion. This is especially relevant for choosing between a few completions when using n > 1 or resampling (see the next point).

Resample 3-5 times. While almost all completions connect to the prefix, the model may struggle to connect the suffix in harder cases. We find that resampling 3 or 5 times (or using best_of with k=3,5) and picking the samples with “stop” as their finish_reason can be an effective way in such cases. While resampling, you would typically want a higher temperatures to increase diversity.

Note: if all the returned samples have finish_reason == “length”, it’s likely that max_tokens is too small and model runs out of tokens before it manages to connect the prompt and the suffix naturally. Consider increasing max_tokens before resampling.

Try giving more clues. In some cases to better help the model’s generation, you can provide clues by giving a few examples of patterns that the model can follow to decide a natural place to stop.

How to make a delicious hot chocolate:

1.** Boil water**
2. Put hot chocolate in a cup
3. Add boiling water to the cup 4. Enjoy the hot chocolate

Dogs are loyal animals.

Lions are ferocious animals.

Dolphins** are playful animals.**

Horses are majestic animals.

Chat Completions vs. Completions

The Chat Completions format can be made similar to the completions format by constructing a request using a single user message. For example, one can translate from English to French with the following completions prompt:

Translate the following English text to French: "{text}"

And an equivalent chat prompt would be:

[{"role": "user", "content": 'Translate the following English text to French: "{text}"'}]

Likewise, the completions API can be used to simulate a chat between a user and an assistant by formatting the input accordingly.

The difference between these APIs is the underlying models that are available in each. The Chat Completions API is the interface to our most capable model (gpt-4o), and our most cost effective model (gpt-4o-mini).
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/OpenAI/cookbook.txt</code></summary>

````text
Cookbook

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

 Search the cookbook 

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

Cookbook

Recipes to help you build with OpenAI models.

EvalsResponses APIPrompting Guide

Featured

Building resilient prompts using an evaluation flywheel

Evals

Eval Driven System Design - From Prototype to Production

CompletionsEvalsFunctionsResponses

Exploring Model Graders for Reinforcement Fine-Tuning

Fine-tuning

Multi-Tool Orchestration with RAG approach using OpenAI's Responses API

FunctionsResponses

Web Search and States with Responses API

FunctionsResponses

Building a Voice Assistant with the Agents SDK

AudioResponsesSpeech

Popular

Web Search and States with Responses API

FunctionsResponses

MCP-Powered Agentic Voice Framework

Agents SDKFunctions

Doing RAG on PDFs using File Search in the Responses API

FunctionsResponses

Introduction to Structured Outputs

CompletionsFunctions

Using reasoning for data validation

CompletionsReasoning

How to call functions with chat models

CompletionsFunctions

All235

Filter

Building workspace agents in ChatGPT to complete repeatable, end-to-end work

ChatGPT
Apr 22, 2026
GPT Image Generation Models Prompting Guide

ImagesVision
Apr 21, 2026
Computer Use Agents in Daytona Sandboxes

Agents SDK
Apr 19, 2026
Migrate a Legacy Codebase with Sandbox Agents

Agents SDKEvals
Apr 7, 2026
Sora 2 Prompting Guide

Mar 12, 2026
Getting the Most out of GPT-5.4 for Vision and Document Understanding

ImagesVision
Mar 6, 2026
Realtime Prompting Guide

AudioResponsesSpeech
Feb 25, 2026
Codex Prompting Guide

CodexResponses
Feb 25, 2026
Building Governed AI Agents - A Practical Guide to Agentic Scaffolding

EvalsGuardrails
Feb 23, 2026
Prompt Caching 201

LatencyResponses
Feb 18, 2026
Skills in OpenAI API

Responses
Feb 10, 2026
Image Evals for Image Generation and Editing Use Cases

EvalsImagesVision
Jan 29, 2026
Realtime Eval Guide

AudioEvalsResponsesSpeech
Jan 25, 2026
Build your own content fact checker with gpt-oss-120B, Cerebras, and Parallel

gpt-ossOpen ModelsReasoning
Jan 13, 2026
Context Engineering for Personalization - State Management with Long-Term Memory Notes using OpenAI Agents SDK

Agents SDK
Jan 5, 2026
Prompt Personalities

Jan 5, 2026
Gpt-image-1.5 Prompting Guide

ImagesVision
Dec 16, 2025
OpenAI Compliance Logs Platform quickstart

ChatGPT
Dec 11, 2025
GPT-5.2 Prompting Guide

Dec 11, 2025
Transcribing User Audio with a Separate Realtime Request

AudioSpeech
Nov 20, 2025
Modernizing your Codebase with Codex

Codex
Nov 19, 2025
Build a coding agent with GPT 5.1

Agents SDK
Nov 13, 2025
GPT-5.1 Prompting Guide

Nov 13, 2025
Self-Evolving Agents - A Cookbook for Autonomous Agent Retraining

Evals
Nov 4, 2025
User guide for gpt-oss-safeguard

gpt-ossGuardrailsOpen Models
Oct 29, 2025
Build Code Review with the Codex SDK

Codex
Oct 21, 2025
Build, deploy, and optimize agentic workflows with AgentKit

Evals
Oct 17, 2025
Building with Realtime Mini

Oct 11, 2025
Using PLANS.md for multi-hour problem solving

Codex
Oct 7, 2025
Building resilient prompts using an evaluation flywheel

Evals
Oct 6, 2025
Building Consistent Workflows with Codex CLI & Agents SDK

Agents SDKCodex
Oct 1, 2025
Use Codex CLI to automatically fix CI failures

Codex
Sep 30, 2025
GPT-5 Troubleshooting Guide

Sep 17, 2025
Context Engineering - Short-Term Memory Management with Sessions from OpenAI Agents SDK

Agents SDK
Sep 9, 2025
Automating Code Quality and Security Fixes with Codex CLI on GitLab

Codex
Aug 29, 2025
Fine-tune gpt-oss for better Korean language performance

gpt-ossOpen Models
Aug 26, 2025
Using Evals API on Audio Inputs

AudioEvals
Aug 13, 2025
Verifying gpt-oss implementations

gpt-ossOpen Models
Aug 11, 2025
How to run gpt-oss locally with LM Studio

gpt-ossOpen Models
Aug 7, 2025
GPT-5 Prompt Migration and Improvement Using the New Optimizer

ReasoningResponses
Aug 7, 2025
GPT-5 prompting guide

ReasoningResponses
Aug 7, 2025
Frontend coding with GPT-5

ReasoningResponses
Aug 7, 2025
GPT-5 New Params and Tools

FunctionsReasoning
Aug 7, 2025
How to run gpt-oss-20b on Google Colab

gpt-ossOpen Models
Aug 6, 2025
Using NVIDIA TensorRT-LLM to run gpt-oss-20b

gpt-ossOpen Models
Aug 5, 2025
Fine-tuning with gpt-oss and Hugging Face Transformers

gpt-ossOpen Models
Aug 5, 2025
How to handle the raw chain of thought in gpt-oss

gpt-ossOpen Models
Aug 5, 2025
How to run gpt-oss with Transformers

gpt-ossOpen Models
Aug 5, 2025
How to run gpt-oss with vLLM

gpt-ossOpen Models
Aug 5, 2025
How to run gpt-oss locally with Ollama

gpt-ossOpen Models
Aug 5, 2025
OpenAI Harmony Response Format

gpt-ossOpenAI harmonyOpen Models
Aug 5, 2025
Temporal Agents with Knowledge Graphs

FunctionsResponses
Jul 22, 2025
Generate images with high input fidelity

Images
Jul 17, 2025
Using Evals API on Image Inputs

EvalsImages
Jul 15, 2025
Optimize Prompts

Agents SDKCompletionsResponses
Jul 14, 2025
Building a Supply-Chain Copilot with OpenAI Agent SDK and Databricks MCP Servers

Agents SDK
Jul 8, 2025
Prompt Migration Guide

CompletionsResponses
Jun 26, 2025
Introduction to deep research in the OpenAI API

Responses
Jun 25, 2025
Deep Research API with the Agents SDK

Agents SDK
Jun 25, 2025
Building a Deep Research MCP Server

Agents SDKResponses
Jun 25, 2025
Automate Jira ↔ GitHub with Codex

Codex
Jun 21, 2025
Fine-Tuning Techniques - Choosing Between SFT, DPO, and RFT (With a Guide to DPO)

Fine-tuning
Jun 18, 2025
MCP-Powered Agentic Voice Framework

Agents SDKFunctions
Jun 17, 2025
Evals API Use-case - MCP Evaluation

EvalsResponses
Jun 9, 2025
Evals API Use-case - Structured Outputs Evaluation

EvalsResponses
Jun 9, 2025
Evals API Use-case - Tools Evaluation

EvalsResponses
Jun 9, 2025
Evals API Use-case - Web Search Evaluation

EvalsResponses
Jun 9, 2025
Eval Driven System Design - From Prototype to Production

CompletionsEvalsFunctionsResponses
Jun 2, 2025
Selecting a Model Based on Stripe Conversion – A Practical Eval for Startups

Evals
Jun 2, 2025
Practical guide to data-intensive apps with the Realtime API

AudioSpeech
May 29, 2025
Multi-Agent Portfolio Collaboration with OpenAI Agents SDK

Agents SDKFunctionsResponses
May 28, 2025
o3/o4-mini Function Calling Guide

FunctionsReasoningResponses
May 26, 2025
Exploring Model Graders for Reinforcement Fine-Tuning

Fine-tuning
May 23, 2025
Reinforcement Fine-Tuning for Conversational Reasoning with the OpenAI API

EvalsFine-tuning
May 21, 2025
Guide to Using the Responses API's MCP Tool

May 21, 2025
Image Understanding with RAG

ImagesResponsesVision
May 16, 2025
Evals API Use-case - Responses Evaluation

EvalsResponses
May 13, 2025
Better performance from reasoning models using the Responses API

FunctionsResponses
May 11, 2025
Context Summarization with Realtime API

AudioSpeechTiktoken
May 10, 2025
Practical Guide for Model Selection for Real‑World Use Cases

FunctionsResponses
May 7, 2025
ElatoAI - Realtime Speech AI Agents for ESP32 on Arduino

AudioSpeech
May 1, 2025
Parallel Agents with the OpenAI Agents SDK

Agents SDK
May 1, 2025
Comparing Speech-to-Text Methods with the OpenAI API

Agents SDKAudioSpeech
Apr 29, 2025
Handling Function Calls with Reasoning Models

FunctionsReasoningResponses
Apr 25, 2025
Robust question answering with Chroma and OpenAI

CompletionsEmbeddings
Apr 23, 2025
Generate images with GPT Image

Images
Apr 23, 2025
Processing and narrating a video with GPT-4.1-mini's visual capabilities and GPT-4o TTS API

ResponsesSpeechVision
Apr 22, 2025
GPT-4.1 Prompting Guide

Responses
Apr 14, 2025
Evals API Use-case - Detecting prompt regressions

CompletionsEvals
Apr 8, 2025
Evals API Use-case - Bulk model and prompt experimentation

CompletionsEvals
Apr 8, 2025
Evals API Use-case - Monitoring stored completions

CompletionsEvals
Apr 8, 2025
GPT Actions library - Salesforce & Gong

ChatGPT
Apr 7, 2025
Evaluating Agents with Langfuse

Agents SDKEvals
Mar 31, 2025
Multi-Tool Orchestration with RAG approach using OpenAI's Responses API

FunctionsResponses
Mar 28, 2025
Building a Voice Assistant with the Agents SDK

AudioResponsesSpeech
Mar 27, 2025
Multi-Language One-Way Translation with the Realtime API

AudioSpeech
Mar 24, 2025
Automating Dispute Management with Agents SDK and Stripe API

Agents SDKFunctionsResponses
Mar 17, 2025
Web Search and States with Responses API

FunctionsResponses
Mar 11, 2025
Doing RAG on PDFs using File Search in the Responses API

FunctionsResponses
Mar 11, 2025
Build Your Own Code Interpreter - Dynamic Tool Generation and Execution With o3-mini

Completions
Feb 3, 2025
How to handle rate limits

CompletionsEmbeddings
Jan 22, 2025
How to use the Usage API and Cost API to monitor your OpenAI usage

Cost APIUsage API
Jan 14, 2025
Reasoning over Code Quality and Security in GitHub Pull Requests

CompletionsReasoning
Dec 24, 2024
Using GPT4 Vision with Function Calling

ChatVision
Dec 13, 2024
Embedding Wikipedia articles for search

CompletionsEmbeddings
Nov 26, 2024
GPT Actions library - Tray.ai APIM

ChatGPT
Nov 26, 2024
GPT Actions library - Google Calendar

ChatGPT
Nov 22, 2024
GPT Actions library - Workday

ChatGPT
Nov 20, 2024
Optimizing Retrieval-Augmented Generation using GPT-4o Vision Modality

CompletionsVision
Nov 12, 2024
Pinecone Vector Database and Retool Workflow with GPT Actions

ChatGPTEmbeddings
Nov 11, 2024
Vision Fine-tuning on GPT-4o for Visual Question Answering

CompletionsFine-tuningVision
Nov 1, 2024
Steering Text-to-Speech for more dynamic audio generation

AudioCompletions
Nov 1, 2024
Enhance your prompts with meta prompting

CompletionsReasoning
Oct 23, 2024
GPT Actions library - GitHub

ChatGPT
Oct 23, 2024
Voice Translation into Different Languages

AudioCompletions
Oct 21, 2024
Leveraging model distillation to fine-tune a model

CompletionsFine-tuning
Oct 16, 2024
Custom LLM as a Judge to Detect Hallucinations with Braintrust

CompletionsEvals
Oct 14, 2024
Orchestrating Agents: Routines and Handoffs

CompletionsFunctions
Oct 10, 2024
GPT Actions library - Google Ads via Adzviser

ChatGPT
Oct 10, 2024
Prompt Caching 101

CompletionsLatency
Oct 1, 2024
How to parse PDF docs for RAG

EmbeddingsVision
Sep 29, 2024
Using chained calls for o1 structured outputs

CompletionsReasoning
Sep 26, 2024
Building a Bring Your Own Browser (BYOB) Tool for Web Browsing and Summarization

Completions
Sep 26, 2024
GPT Actions library - Canvas Learning Management System

ChatGPT
Sep 17, 2024
Using reasoning for data validation

CompletionsReasoning
Sep 12, 2024
Using reasoning for routine generation

CompletionsReasoning
Sep 12, 2024
GPT Actions library - Retool Workflow

ChatGPT
Aug 28, 2024
GPT Actions library - Snowflake Middleware

ChatGPT
Aug 14, 2024
GPT Actions library - Snowflake Direct

ChatGPT
Aug 13, 2024
GPT Actions library (Middleware) - Google Cloud Function

ChatGPT
Aug 11, 2024
GPT Actions library - Google Drive

ChatGPT
Aug 11, 2024
GPT Actions library - AWS Redshift

ChatGPT
Aug 9, 2024
GPT Actions library - AWS Middleware

ChatGPT
Aug 9, 2024
Structured Outputs for Multi-Agent Systems

CompletionsFunctions
Aug 6, 2024
Introduction to Structured Outputs

CompletionsFunctions
Aug 6, 2024
GPT Actions library - Zapier

ChatGPT
Aug 5, 2024
GPT Actions library - Box

ChatGPT
Aug 2, 2024
GCP BigQuery Vector Search with GCP Functions and GPT Actions in ChatGPT

ChatGPTCompletionsEmbeddingsTiktoken
Aug 2, 2024
GPT Actions library - Confluence

ChatGPT
Jul 31, 2024
GPT Actions library - SQL Database

ChatGPT
Jul 31, 2024
GPT Actions library - Notion

ChatGPT
Jul 25, 2024
GPT Actions library - Gmail

ChatGPT
Jul 24, 2024
GPT Actions library - Jira

ChatGPT
Jul 24, 2024
How to fine-tune chat models

CompletionsFine-tuning
Jul 23, 2024
How to combine GPT4o mini with RAG to create a clothing matchmaker app

EmbeddingsVision
Jul 18, 2024
Using GPT4o mini to tag and caption images

EmbeddingsVision
Jul 18, 2024
Introduction to GPT-4o and GPT-4o mini

CompletionsVisionWhisper
Jul 18, 2024
GPT Actions library - Salesforce

ChatGPT
Jul 18, 2024
GPT Actions library - Outlook

ChatGPT
Jul 15, 2024
GPT Actions library - getting started

ChatGPT
Jul 9, 2024
GPT Actions library - BigQuery

ChatGPT
Jul 9, 2024
Data Extraction and Transformation in ELT Workflows using GPT-4o as an OCR Alternative

CompletionsVision
Jul 9, 2024
Azure AI Search with Azure Functions and GPT Actions in ChatGPT

ChatGPTCompletionsEmbeddingsTiktoken
Jul 8, 2024
Developing Hallucination Guardrails

Guardrails
May 29, 2024
GPT Actions library - Sharepoint (Return Docs)

ChatGPT
May 24, 2024
GPT Actions library - Sharepoint (Return Text)

ChatGPT
May 24, 2024
GPT Actions library (Middleware) - Azure Functions

ChatGPT
May 24, 2024
Using tool required for customer service

CompletionsFunctions
May 1, 2024
Batch processing with the Batch API

BatchCompletions
Apr 24, 2024
Summarizing Long Documents

Chat
Apr 19, 2024
Synthetic data generation (Part 1)

Completions
Apr 10, 2024
CLIP embeddings to improve multimodal RAG with GPT-4 Vision

EmbeddingsVision
Apr 10, 2024
Getting Started with OpenAI Evals

Completions
Mar 21, 2024
How to use the moderation API

Moderation
Mar 5, 2024
How to evaluate LLMs for SQL generation

Guardrails
Jan 23, 2024
Using logprobs

Completions
Dec 20, 2023
How to implement LLM guardrails

Guardrails
Dec 19, 2023
Creating slides with the Assistants API and DALL·E 3

AssistantsDALL-E
Dec 8, 2023
RAG with a Graph database

CompletionsEmbeddings
Dec 8, 2023
Supabase Vector Database

Embeddings
Dec 4, 2023
Semantic search using Supabase Vector

Embeddings
Dec 4, 2023
MongoDB Atlas Vector Search

CompletionsEmbeddings
Nov 21, 2023
Semantic search using MongoDB Atlas Vector Search and OpenAI

CompletionsEmbeddings
Nov 21, 2023
Assistants API Overview (Python SDK)

AssistantsFunctions
Nov 10, 2023
Fine tuning for function calling

CompletionsFine-tuningFunctions
Nov 7, 2023
What's new with DALL·E 3?

DALL-E
Nov 6, 2023
How to make your completions outputs consistent with the new seed parameter

Completions
Nov 6, 2023
Evaluate RAG with LlamaIndex

CompletionsEmbeddings
Nov 6, 2023
Named Entity Recognition to Enrich Text

CompletionsFunctions
Oct 20, 2023
Function calling with an OpenAPI specification

CompletionsFunctions
Oct 15, 2023
How to build an agent with the OpenAI Node.js SDK

CompletionsFunctions
Oct 5, 2023
Fine-tuning OpenAI models with Weights & Biases

CompletionsFine-tuningTiktoken
Oct 4, 2023
OpenAI API Monitoring with Weights & Biases Weave

CompletionsTiktoken
Oct 4, 2023
Question answering with LangChain, Deep Lake, & OpenAI

Embeddings
Sep 30, 2023
Neon as a vector database

Embeddings
Sep 28, 2023
Vector similarity search using Neon Postgres

Embeddings
Sep 28, 2023
How to automate AWS tasks with function calling

CompletionsEmbeddingsFunctions
Sep 27, 2023
Azure Chat Completion models with your own data (preview)

Completions
Sep 11, 2023
Azure AI Search as a vector database for OpenAI embeddings

Embeddings
Sep 11, 2023
Using Tair as a vector database for OpenAI embeddings

Embeddings
Sep 11, 2023
Question answering with Langchain, Tair and OpenAI

CompletionsEmbeddingsTiktoken
Sep 11, 2023
Fine-Tuning for retrieval augmented generation (RAG) with Qdrant

CompletionsEmbeddingsFine-tuning
Sep 4, 2023
What makes documentation good

Sep 1, 2023
Philosophy with vector embeddings, OpenAI and Cassandra / Astra DB

CompletionsEmbeddings
Aug 29, 2023
Philosophy with vector embeddings, OpenAI and Cassandra / Astra DB

CompletionsEmbeddings
Aug 29, 2023
Cassandra / Astra DB

Embeddings
Aug 29, 2023
Elasticsearch

CompletionsEmbeddings
Aug 29, 2023
Retrieval augmented generation using Elasticsearch and OpenAI

CompletionsEmbeddings
Aug 29, 2023
Semantic search using Elasticsearch and OpenAI

Embeddings
Aug 29, 2023
Data preparation and analysis for chat model fine-tuning

CompletionsFine-tuningTiktoken
Aug 22, 2023
How to evaluate a summarization task

CompletionsEmbeddings
Aug 16, 2023
Function calling for nearby places: Leveraging the Google Places API and customer profiles

CompletionsFunctions
Aug 11, 2023
Addressing transcription misspellings: prompt vs post-processing

CompletionsWhisper
Aug 11, 2023
Enhancing Whisper transcriptions: pre- & post-processing techniques

Whisper
Aug 11, 2023
Azure functions example

CompletionsFunctions
Jul 21, 2023
Visualizing the embeddings in Kangas

Embeddings
Jul 11, 2023
Using PolarDB-PG as a vector database for OpenAI embeddings

Embeddings
Jul 11, 2023
Search reranking with cross-encoders

CompletionsEmbeddings
Jun 28, 2023
Vector databases

Embeddings
Jun 28, 2023
Using Chroma for embeddings search

Embeddings
Jun 28, 2023
Using MyScale for embeddings search

Embeddings
Jun 28, 2023
Using Pinecone for embeddings search

Embeddings
Jun 28, 2023
Using Qdrant for embeddings search

Embeddings
Jun 28, 2023
Using Redis for embeddings search

Embeddings
Jun 28, 2023
Using Typesense for embeddings search

Embeddings
Jun 28, 2023
Using Weaviate for embeddings search

Embeddings
Jun 28, 2023
Whisper prompting guide

CompletionsWhisper
Jun 27, 2023
Financial document analysis with LlamaIndex

CompletionsEmbeddings
Jun 22, 2023
Question answering using a search API and re-ranking

CompletionsEmbeddings
Jun 16, 2023
How to use functions with a knowledge base

CompletionsFunctions
Jun 14, 2023
How to call functions with chat models

CompletionsFunctions
Jun 13, 2023
Semantic search with SingleStoreDB

CompletionsEmbeddings
May 22, 2023
SingleStoreDB

CompletionsEmbeddings
May 22, 2023
Using Weaviate with generative OpenAI module for generative search

CompletionsEmbeddings
May 22, 2023
Unit test writing using a multi-step prompt with legacy Completions

Completions
May 19, 2023
How to create dynamic masks with DALL·E and Segment Anything

DALL-E
May 19, 2023
Using Hologres as a vector database for OpenAI embeddings

Embeddings
May 19, 2023
Running hybrid VSS queries with Redis and OpenAI

Embeddings
May 11, 2023
Redis as a context store with Chat Completions

CompletionsEmbeddings
May 11, 2023
Kusto as a vector database for embeddings

Embeddings
May 10, 2023
Kusto as a vector database

Embeddings
May 10, 2023
Redis vectors as JSON with OpenAI

Embeddings
May 10, 2023
Question answering with Langchain, AnalyticDB and OpenAI

EmbeddingsTiktoken
May 5, 2023
How to build a tool-using agent with LangChain

CompletionsEmbeddings
May 2, 2023
Using MyScale as a vector database for OpenAI embeddings

Embeddings
May 1, 2023
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/OpenAI/migrate-to-responses.txt</code></summary>

````text
Migrate to the Responses API | OpenAI API

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

 Copy Page 

 Migrate to the Responses API 

 Copy Page 

The Responses API is our new API primitive, an evolution of Chat Completions which brings added simplicity and powerful agentic primitives to your integrations.

While Chat Completions remains supported, Responses is recommended for all new projects.

About the Responses API

The Responses API is a unified interface for building powerful, agent-like applications. It contains:

Built-in tools like web search, file search
, computer use, code interpreter, and remote MCPs.

Seamless multi-turn interactions that allow you to pass previous responses for higher accuracy reasoning results.

Native multimodal support for text and images.

Responses benefits

The Responses API contains several benefits over Chat Completions:

Better performance: Using reasoning models, like GPT-5, with Responses will result in better model intelligence when compared to Chat Completions. Our internal evals reveal a 3% improvement in SWE-bench with same prompt and setup.

Agentic by default: The Responses API is an agentic loop, allowing the model to call multiple tools, like web_search, image_generation, file_search, code_interpreter, remote MCP servers, as well as your own custom functions, within the span of one API request.

Lower costs: Results in lower costs due to improved cache utilization (40% to 80% improvement when compared to Chat Completions in internal tests).

Stateful context: Use store: true to maintain state from turn to turn, preserving reasoning and tool context from turn-to-turn.

Flexible inputs: Pass a string with input or a list of messages; use instructions for system-level guidance.

Encrypted reasoning: Opt-out of statefulness while still benefiting from advanced reasoning.

Future-proof: Future-proofed for upcoming models.

CapabilitiesChat Completions APIResponses API

Text generation

AudioComing soon

Vision

Structured Outputs

Function calling

Web search

File search

Computer use

Code interpreter

MCP

Image generation

Reasoning summaries

Examples

See how the Responses API compares to the Chat Completions API in specific scenarios.

Messages vs. Items

Both APIs make it easy to generate output from our models. The input to, and result of, a call to Chat completions is an array of Messages, while
the Responses API uses Items. An Item is a union of many types, representing the range of possibilities
of model actions. A message is a type of Item, as is a function_call or function_call_output. Unlike a Chat Completions Message, where
many concerns are glued together into one object, Items are distinct from one another and better represent the basic unit of model context.

Additionally, Chat Completions can return multiple parallel generations as choices, using the n param. In Responses, we’ve removed this param, leaving only one generation.

Chat Completions API

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
11
12
13
14
from openai import OpenAI
client = OpenAI()

completion = client.chat.completions.create(
model="gpt-5",
messages=[
{
"role": "user",
"content": "Write a one-sentence bedtime story about a unicorn."
}
]
)

print(completion.choices[0].message.content)

Responses API

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
model="gpt-5",
input="Write a one-sentence bedtime story about a unicorn."
)

print(response.output_text)

When you get a response back from the Responses API, the fields differ slightly.
Instead of a message, you receive a typed response object with its own id.
Responses are stored by default. Chat completions are stored by default for new accounts.
To disable storage when using either API, set store: false.

The objects you recieve back from these APIs will differ slightly. In Chat Completions, you receive an array of
choices, each containing a message. In Responses, you receive an array of Items labled output.

Chat Completions API

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
11
12
13
14
15
16
17
18
19
{
 "id": "chatcmpl-C9EDpkjH60VPPIB86j2zIhiR8kWiC",
 "object": "chat.completion",
 "created": 1756315657,
 "model": "gpt-5-2025-08-07",
 "choices": [
 {
 "index": 0,
 "message": {
 "role": "assistant",
 "content": "Under a blanket of starlight, a sleepy unicorn tiptoed through moonlit meadows, gathering dreams like dew to tuck beneath its silver mane until morning.",
 "refusal": null,
 "annotations": []
 },
 "finish_reason": "stop"
 }
 ],
 ...
}

Responses API

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
{
 "id": "resp_68af4030592c81938ec0a5fbab4a3e9f05438e46b5f69a3b",
 "object": "response",
 "created_at": 1756315696,
 "model": "gpt-5-2025-08-07",
 "output": [
 {
 "id": "rs_68af4030baa48193b0b43b4c2a176a1a05438e46b5f69a3b",
 "type": "reasoning",
 "content": [],
 "summary": []
 },
 {
 "id": "msg_68af40337e58819392e935fb404414d005438e46b5f69a3b",
 "type": "message",
 "status": "completed",
 "content": [
 {
 "type": "output_text",
 "annotations": [],
 "logprobs": [],
 "text": "Under a quilt of moonlight, a drowsy unicorn wandered through quiet meadows, brushing blossoms with her glowing horn so they sighed soft lullabies that carried every dreamer gently to sleep."
 }
 ],
 "role": "assistant"
 }
 ],
 ...
}

Additional differences

Responses are stored by default. Chat completions are stored by default for new accounts. To disable storage in either API, set store: false.

Reasoning models have a richer experience in the Responses API with improved tool usage. Starting with GPT-5.4, tool calling is not supported in Chat Completions with reasoning: none.

Structured Outputs API shape is different. Instead of response_format, use text.format in Responses. Learn more in the Structured Outputs guide.

The function-calling API shape is different, both for the function config on the request, and function calls sent back in the response. See the full difference in the function calling guide.

The Responses SDK has an output_text helper, which the Chat Completions SDK does not have.

In Chat Completions, conversation state must be managed manually. The Responses API has compatibility with the Conversations API for persistent conversations, or the ability to pass a previous_response_id to easily chain Responses together.

Migrating from Chat Completions

1. Update generation endpoints

Start by updating your generation endpoints from post /v1/chat/completions to post /v1/responses.

If you are not using functions or multimodal inputs, then you’re done! Simple message inputs are compatible from one API to the other:

Web search tool

javascript

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
11
12
13
14
15
16
17
18
19
20
INPUT='[
 { "role": "system", "content": "You are a helpful assistant." },
 { "role": "user", "content": "Hello!" }
]'

curl -s https://api.openai.com/v1/chat/completions \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d "{
 \"model\": \"gpt-5\",
 \"messages\": $INPUT
 }"

curl -s https://api.openai.com/v1/responses \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d "{
 \"model\": \"gpt-5\",
 \"input\": $INPUT
 }"

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
11
12
13
14
const context = [
 { role: 'system', content: 'You are a helpful assistant.' },
 { role: 'user', content: 'Hello!' }
];

const completion = await client.chat.completions.create({
 model: 'gpt-5',
 messages: messages
});

const response = await client.responses.create({
 model: "gpt-5",
 input: context
});

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
11
12
13
14
context = [
 { "role": "system", "content": "You are a helpful assistant." },
 { "role": "user", "content": "Hello!" }
]

completion = client.chat.completions.create(
 model="gpt-5",
 messages=messages
)

response = client.responses.create(
 model="gpt-5",
 input=context
)

Chat CompletionsResponses

Chat Completions

With Chat Completions, you need to create an array of messages that specify different roles and content for each role.

Generate text from a model

javascript

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
11
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await client.chat.completions.create({
 model: 'gpt-5',
 messages: [
 { 'role': 'system', 'content': 'You are a helpful assistant.' },
 { 'role': 'user', 'content': 'Hello!' }
 ]
});
console.log(completion.choices[0].message.content);

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
11
from openai import OpenAI
client = OpenAI()

completion = client.chat.completions.create(
 model="gpt-5",
 messages=[
 {"role": "system", "content": "You are a helpful assistant."},
 {"role": "user", "content": "Hello!"}
 ]
)
print(completion.choices[0].message.content)

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
curl https://api.openai.com/v1/chat/completions \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5",
 "messages": [
 {"role": "system", "content": "You are a helpful assistant."},
 {"role": "user", "content": "Hello!"}
 ]
 }'

Responses

With Responses, you can separate instructions and input at the top-level. The API shape is similar to Chat Completions but has cleaner semantics.

Generate text from a model

javascript

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
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await client.responses.create({
 model: 'gpt-5',
 instructions: 'You are a helpful assistant.',
 input: 'Hello!'
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
 model="gpt-5",
 instructions="You are a helpful assistant.",
 input="Hello!"
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
curl https://api.openai.com/v1/responses \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5",
 "instructions": "You are a helpful assistant.",
 "input": "Hello!"
 }'

2. Update item definitions

Chat CompletionsResponses

Chat Completions

With Chat Completions, you need to create an array of messages that specify different roles and content for each role.

Generate text from a model

javascript

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
11
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await client.chat.completions.create({
 model: 'gpt-5',
 messages: [
 { 'role': 'system', 'content': 'You are a helpful assistant.' },
 { 'role': 'user', 'content': 'Hello!' }
 ]
});
console.log(completion.choices[0].message.content);

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
11
from openai import OpenAI
client = OpenAI()

completion = client.chat.completions.create(
 model="gpt-5",
 messages=[
 {"role": "system", "content": "You are a helpful assistant."},
 {"role": "user", "content": "Hello!"}
 ]
)
print(completion.choices[0].message.content)

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
curl https://api.openai.com/v1/chat/completions \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5",
 "messages": [
 {"role": "system", "content": "You are a helpful assistant."},
 {"role": "user", "content": "Hello!"}
 ]
 }'

Responses

With Responses, you can separate instructions and input at the top-level. The API shape is similar to Chat Completions but has cleaner semantics.

Generate text from a model

javascript

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
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await client.responses.create({
 model: 'gpt-5',
 instructions: 'You are a helpful assistant.',
 input: 'Hello!'
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
 model="gpt-5",
 instructions="You are a helpful assistant.",
 input="Hello!"
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
curl https://api.openai.com/v1/responses \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5",
 "instructions": "You are a helpful assistant.",
 "input": "Hello!"
 }'

3. Update multi-turn conversations

If you have multi-turn conversations in your application, update your context logic.

Chat CompletionsResponses

Chat Completions

In Chat Completions, you have to store and manage context yourself.

Multi-turn conversation

javascript

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
11
12
13
14
15
16
let messages = [
 { 'role': 'system', 'content': 'You are a helpful assistant.' },
 { 'role': 'user', 'content': 'What is the capital of France?' }
 ];
const res1 = await client.chat.completions.create({
 model: 'gpt-5',
 messages
});

messages = messages.concat([res1.choices[0].message]);
messages.push({ 'role': 'user', 'content': 'And its population?' });

const res2 = await client.chat.completions.create({
 model: 'gpt-5',
 messages
});

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
messages = [
 {"role": "system", "content": "You are a helpful assistant."},
 {"role": "user", "content": "What is the capital of France?"}
]
res1 = client.chat.completions.create(model="gpt-5", messages=messages)

messages += [res1.choices[0].message]
messages += [{"role": "user", "content": "And its population?"}]

res2 = client.chat.completions.create(model="gpt-5", messages=messages)

Responses

With responses, the pattern is similar, you can pass outputs from one response to the input of another.

Multi-turn conversation

javascript

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
11
12
13
14
15
16
17
18
19
20
context = [
 { "role": "role", "content": "What is the capital of France?" }
]
res1 = client.responses.create(
 model="gpt-5",
 input=context,
)

// Append the first response’s output to context
context += res1.output

// Add the next user message
context += [
 { "role": "role", "content": "And it's population?" }
]

res2 = client.responses.create(
 model="gpt-5",
 input=context,
)

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
11
12
13
14
15
16
17
18
19
let context = [
 { role: "role", content: "What is the capital of France?" }
];

const res1 = await client.responses.create({
 model: "gpt-5",
 input: context,
});

// Append the first response’s output to context
context = context.concat(res1.output);

// Add the next user message
context.push({ role: "role", content: "And its population?" });

const res2 = await client.responses.create({
 model: "gpt-5",
 input: context,
});

As a simplification, we’ve also built a way to simply reference inputs and outputs from a previous response by passing its id.
You can use previous_response_id to form chains of responses that build upon one other or create forks in a history.

Multi-turn conversation

javascript

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
11
12
const res1 = await client.responses.create({
 model: 'gpt-5',
 input: 'What is the capital of France?',
 store: true
});

const res2 = await client.responses.create({
 model: 'gpt-5',
 input: 'And its population?',
 previous_response_id: res1.id,
 store: true
});

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
11
12
res1 = client.responses.create(
 model="gpt-5",
 input="What is the capital of France?",
 store=True
)

res2 = client.responses.create(
 model="gpt-5",
 input="And its population?",
 previous_response_id=res1.id,
 store=True
)

4. Decide when to use statefulness

Some organizations—such as those with Zero Data Retention (ZDR) requirements—cannot use the Responses API in a stateful way due to compliance or data retention policies. To support these cases, OpenAI offers encrypted reasoning items, allowing you to keep your workflow stateless while still benefiting from reasoning items.

To disable statefulness, but still take advantage of reasoning:

set store: false in the store field

add ["reasoning.encrypted_content"] to the include field

The API will then return an encrypted version of the reasoning tokens, which you can pass back in future requests just like regular reasoning items.
For ZDR organizations, OpenAI enforces store=false automatically. When a request includes encrypted_content, it is decrypted in-memory (never written to disk), used for generating the next response, and then securely discarded. Any new reasoning tokens are immediately encrypted and returned to you, ensuring no intermediate state is ever persisted.

5. Update function definitions

There are two minor, but notable, differences in how functions are defined between Chat Completions and Responses.

In Chat Completions, functions are defined using externally tagged polymorphism, whereas in Responses, they are internally-tagged.

In Chat Completions, functions are non-strict by default, whereas in the Responses API, functions are strict by default.

The Responses API function example on the right is functionally equivalent to the Chat Completions example on the left.

Chat Completions API

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
11
12
13
14
15
16
17
18
19
20
21
{
 "type": "function",
 "function": {
 "name": "get_weather",
 "description": "Determine weather in my location",
 "strict": true,
 "parameters": {
 "type": "object",
 "properties": {
 "location": {
 "type": "string",
 },
 },
 "additionalProperties": false,
 "required": [
 "location",
 "unit"
 ]
 }
 }
 }

Responses API

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
11
12
13
14
15
16
17
18
{
 "type": "function",
 "name": "get_weather",
 "description": "Determine weather in my location",
 "parameters": {
 "type": "object",
 "properties": {
 "location": {
 "type": "string",
 },
 },
 "additionalProperties": false,
 "required": [
 "location",
 "unit"
 ]
 }
 }

Follow function-calling best practices

In Responses, tool calls and their outputs are two distinct types of Items that are correlated using a call_id. See
the tool calling docs for more detail on how function calling works in Responses.

6. Update Structured Outputs definition

In the Responses API, defining structured outputs have moved from response_format to text.format:

Chat CompletionsResponses

Chat Completions

Structured Outputs

javascript

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
curl https://api.openai.com/v1/chat/completions \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5",
 "messages": [
 {
 "role": "user",
 "content": "Jane, 54 years old",
 }
 ],
 "response_format": {
 "type": "json_schema",
 "json_schema": {
 "name": "person",
 "strict": true,
 "schema": {
 "type": "object",
 "properties": {
 "name": {
 "type": "string",
 "minLength": 1
 },
 "age": {
 "type": "number",
 "minimum": 0,
 "maximum": 130
 }
 },
 "required": [
 "name",
 "age"
 ],
 "additionalProperties": false
 }
 }
 },
 "verbosity": "medium",
 "reasoning_effort": "medium"
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
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
from openai import OpenAI
client = OpenAI()

response = client.chat.completions.create(
 model="gpt-5",
 messages=[
 {
 "role": "user",
 "content": "Jane, 54 years old",
 }
 ],
 response_format={
 "type": "json_schema",
 "json_schema": {
 "name": "person",
 "strict": True,
 "schema": {
 "type": "object",
 "properties": {
 "name": {
 "type": "string",
 "minLength": 1
 },
 "age": {
 "type": "number",
 "minimum": 0,
 "maximum": 130
 }
 },
 "required": [
 "name",
 "age"
 ],
 "additionalProperties": False
 }
 }
 },
 verbosity="medium",
 reasoning_effort="medium"
)

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
const completion = await openai.chat.completions.create({
 model: "gpt-5",
 messages: [
 {
 "role": "user",
 "content": "Jane, 54 years old",
 }
 ],
 response_format: {
 type: "json_schema",
 json_schema: {
 name: "person",
 strict: true,
 schema: {
 type: "object",
 properties: {
 name: {
 type: "string",
 minLength: 1
 },
 age: {
 type: "number",
 minimum: 0,
 maximum: 130
 }
 },
 required: [
 name,
 age
 ],
 additionalProperties: false
 }
 }
 },
 verbosity: "medium",
 reasoning_effort: "medium"
});

Responses

Structured Outputs

javascript

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
curl https://api.openai.com/v1/responses \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5",
 "input": "Jane, 54 years old",
 "text": {
 "format": {
 "type": "json_schema",
 "name": "person",
 "strict": true,
 "schema": {
 "type": "object",
 "properties": {
 "name": {
 "type": "string",
 "minLength": 1
 },
 "age": {
 "type": "number",
 "minimum": 0,
 "maximum": 130
 }
 },
 "required": [
 "name",
 "age"
 ],
 "additionalProperties": false
 }
 }
 }
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
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
response = client.responses.create(
 model="gpt-5",
 input="Jane, 54 years old", 
 text={
 "format": {
 "type": "json_schema",
 "name": "person",
 "strict": True,
 "schema": {
 "type": "object",
 "properties": {
 "name": {
 "type": "string",
 "minLength": 1
 },
 "age": {
 "type": "number",
 "minimum": 0,
 "maximum": 130
 }
 },
 "required": [
 "name",
 "age"
 ],
 "additionalProperties": False
 }
 }
 }
)

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
const response = await openai.responses.create({
 model: "gpt-5",
 input: "Jane, 54 years old",
 text: {
 format: {
 type: "json_schema",
 name: "person",
 strict: true,
 schema: {
 type: "object",
 properties: {
 name: {
 type: "string",
 minLength: 1
 },
 age: {
 type: "number",
 minimum: 0,
 maximum: 130
 }
 },
 required: [
 name,
 age
 ],
 additionalProperties: false
 }
 },
 }
});

7. Upgrade to native tools

If your application has use cases that would benefit from OpenAI’s native tools, you can update your tool calls to use OpenAI’s tools out of the box.

Chat CompletionsResponses

Chat Completions

With Chat Completions, you cannot use OpenAI’s tools natively and have to write your own.

Web search tool

javascript

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
async function web_search(query) {
 const fetch = (await import('node-fetch')).default;
 const res = await fetch(`https://api.example.com/search?q=${query}`);
 const data = await res.json();
 return data.results;
}

const completion = await client.chat.completions.create({
 model: 'gpt-5',
 messages: [
 { role: 'system', content: 'You are a helpful assistant.' },
 { role: 'user', content: 'Who is the current president of France?' }
 ],
 functions: [
 {
 name: 'web_search',
 description: 'Search the web for information',
 parameters: {
 type: 'object',
 properties: { query: { type: 'string' } },
 required: ['query']
 }
 }
 ]
});

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
import requests

def web_search(query):
 r = requests.get(f"https://api.example.com/search?q={query}")
 return r.json().get("results", [])

completion = client.chat.completions.create(
 model="gpt-5",
 messages=[
 {"role": "system", "content": "You are a helpful assistant."},
 {"role": "user", "content": "Who is the current president of France?"}
 ],
 functions=[
 {
 "name": "web_search",
 "description": "Search the web for information",
 "parameters": {
 "type": "object",
 "properties": {"query": {"type": "string"}},
 "required": ["query"]
 }
 }
 ]
)

1
2
3
4
curl https://api.example.com/search \
 -G \
 --data-urlencode "q=your+search+term" \
 --data-urlencode "key=$SEARCH_API_KEY"

Responses

With Responses, you can simply specify the tools that you are interested in.

Web search tool

javascript

1
2
3
4
5
6
7
const answer = await client.responses.create({
 model: 'gpt-5.4',
 input: 'Who is the current president of France?',
 tools: [{ type: 'web_search' }]
});

console.log(answer.output_text);

1
2
3
4
5
6
7
answer = client.responses.create(
 model="gpt-5.4",
 input="Who is the current president of France?",
 tools=[{"type": "web_search"}]
)

print(answer.output_text)

1
2
3
4
5
6
7
8
curl https://api.openai.com/v1/responses \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5.4",
 "input": "Who is the current president of France?",
 "tools": [{"type": "web_search"}]
 }'

Incremental migration

The Responses API is a superset of the Chat Completions API. The Chat Completions API will also continue to be supported. As such, you can incrementally adopt the Responses API if desired. You can migrate user flows who would benefit from improved reasoning models to the Responses API while keeping other flows on the Chat Completions API until you’re ready for a full migration.

As a best practice, we encourage all users to migrate to the Responses API to take advantage of the latest features and improvements from OpenAI.

Assistants API

Based on developer feedback from the Assistants API beta, we’ve incorporated key improvements into the Responses API to make it more flexible, faster, and easier to use. The Responses API represents the future direction for building agents on OpenAI.

We now have Assistant-like and Thread-like objects in the Responses API. Learn more in the migration guide. As of August 26th, 2025, we’re deprecating the Assistants API, with a sunset date of August 26, 2026.
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/OpenAI/models.txt</code></summary>

````text
Models | OpenAI API

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

Models

GPT-5.5 is currently available in ChatGPT and Codex, with API availability coming soon.

Choosing a model

If you're not sure where to start, use gpt-5.4, our flagship model for complex reasoning and coding. If you're optimizing for latency and cost, choose a smaller variant like gpt-5.4-mini or gpt-5.4-nano.

All latest OpenAI models support text and image input, text output, multilingual capabilities, and vision. Models are available via the Responses API and our Client SDKs.

Frontier models

Start with gpt-5.4 for complex reasoning and coding, or choose gpt-5.4-mini and gpt-5.4-nano for lower-latency, lower-cost workloads.

View allCompare models

GPT-5.4

Best intelligence at scale for agentic, coding, and professional workflows

Model ID

gpt-5.4

Reasoning

nonelowmediumhighxhigh

Input price

$2.50 / Input MTok

Output price

$15 / Output MTok

Latency

Fast

Max output

128K tokens

Context window

1M

Tools

Functions, Web search, File search, Computer use

Knowledge cutoff

Aug 31, 2025

GPT-5.4 mini

Our strongest mini model yet for coding, computer use, and subagents

Model ID

gpt-5.4-mini

Reasoning

nonelowmediumhighxhigh

Input price

$0.75 / Input MTok

Output price

$4.50 / Output MTok

Latency

Faster

Max output

128K tokens

Context window

400K

Tools

Functions, Web search, File search, Computer use

Knowledge cutoff

Aug 31, 2025

GPT-5.4 nano

Our cheapest GPT-5.4-class model for simple high-volume tasks

Model ID

gpt-5.4-nano

Reasoning

nonelowmediumhighxhigh

Input price

$0.20 / Input MTok

Output price

$1.25 / Output MTok

Latency

Faster

Max output

128K tokens

Context window

400K

Tools

Functions, Web search, File search, MCP

Knowledge cutoff

Aug 31, 2025

View more

Specialized models

Purpose-built for specific tasks.

Image

Models for image generation and editing

GPT Image 2

State-of-the-art image generation model

Realtime

Models for realtime speech-to-speech

gpt-realtime-1.5

The best voice model for audio in, audio out

gpt-realtime-mini

Deprecated

A cost-efficient version of GPT Realtime

Speech generation

Models for generating natural-sounding speech from text

GPT-4o mini TTS

Deprecated

Text-to-speech model powered by GPT-4o mini

Transcription

Models for transcribing speech into text

GPT-4o Transcribe

Speech-to-text model powered by GPT-4o

GPT-4o mini Transcribe

Speech-to-text model powered by GPT-4o mini

Browse our full catalog of models

Diverse models for a variety of tasks

View all modelsCompare models

How we use your data·Deprecated models
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/OpenAI/quickstart.txt</code></summary>

````text
Developer quickstart | OpenAI API

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

 Copy Page 

 Developer quickstart 
 
Take your first steps with the OpenAI API.

 Copy Page 

The OpenAI API provides a simple interface to state-of-the-art AI models for text generation, natural language processing, computer vision, and more. Get started by creating an API Key and running your first API call. Discover how to generate text, analyze images, build agents, and more.

Create and export an API key

Create an API Key

Before you begin, create an API key in the dashboard, which you’ll use to
securely access the API. Store the key
in a safe location, like a .zshrc
file or
another text file on your computer. Once you’ve generated an API key, export it
as an environment variable
in your terminal.

macOS / LinuxWindows

macOS / Linux

Export an environment variable on macOS or Linux systems

1
export OPENAI_API_KEY="your_api_key_here"

Windows

Export an environment variable in PowerShell

1
setx OPENAI_API_KEY "your_api_key_here"

OpenAI SDKs are configured to automatically read your API key from the system environment.

Install the OpenAI SDK and Run an API Call

JavaScriptPython.NETJavaGo

JavaScript

To use the OpenAI API in server-side JavaScript environments like Node.js, Deno, or Bun, you can use the official OpenAI SDK for TypeScript and JavaScript. Get started by installing the SDK using npm or your preferred package manager:

Install the OpenAI SDK with npm

1
npm install openai

With the OpenAI SDK installed, create a file called example.mjs and copy the example code into it:

Test a basic API request

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
 input: "Write a one-sentence bedtime story about a unicorn."
});

console.log(response.output_text);

Execute the code with node example.mjs (or the equivalent command for Deno or Bun). In a few moments, you should see the output of your API request.

Learn more on GitHub

Discover more SDK capabilities and options on the library’s GitHub README.

Python

To use the OpenAI API in Python, you can use the official OpenAI SDK for Python. Get started by installing the SDK using pip:

Install the OpenAI SDK with pip

1
pip install openai

With the OpenAI SDK installed, create a file called example.py and copy the example code into it:

Test a basic API request

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
 input="Write a one-sentence bedtime story about a unicorn."
)

print(response.output_text)

Execute the code with python example.py. In a few moments, you should see the output of your API request.

Learn more on GitHub

Discover more SDK capabilities and options on the library’s GitHub README.

.NET

In collaboration with Microsoft, OpenAI provides an officially supported API client for C#. You can install it with the .NET CLI from NuGet.

dotnet add package OpenAI

A simple API request to the Responses API would look like this:

Test a basic API request

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
11
12
13
14
15
16
17
18
19
20
21
using System;
using System.Threading.Tasks;
using OpenAI;

class Program
{
 static async Task Main()
 {
 var client = new OpenAIClient(
 Environment.GetEnvironmentVariable("OPENAI_API_KEY")
 );

 var response = await client.Responses.CreateAsync(new ResponseCreateRequest
 {
 Model = "gpt-5.4",
 Input = "Say 'this is a test.'"
 });

 Console.WriteLine($"[ASSISTANT]: {response.OutputText()}");
 }
}

To learn more about using the OpenAI API in .NET, check out the GitHub repo linked below!

Learn more on GitHub

Discover more SDK capabilities and options on the library’s GitHub README.

Java

OpenAI provides an API helper for the Java programming language, currently in beta. You can include the Maven dependency using the following configuration:

<dependency>
 <groupId>com.openai</groupId>
 <artifactId>openai-java</artifactId>
 <version>4.0.0</version>
</dependency>

A simple API request to Responses API would look like this:

Test a basic API request

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
11
12
13
14
15
16
17
18
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseCreateParams;

public class Main {
 public static void main(String[] args) {
 OpenAIClient client = OpenAIOkHttpClient.fromEnv();

 ResponseCreateParams params = ResponseCreateParams.builder()
 .input("Say this is a test")
 .model("gpt-5.4")
 .build();

 Response response = client.responses().create(params);
 System.out.println(response.outputText());
 }
}

To learn more about using the OpenAI API in Java, check out the GitHub repo linked below!

Learn more on GitHub

Discover more SDK capabilities and options on the library’s GitHub README.

Go

OpenAI provides an API helper for the Go programming language, currently in beta. You can import the library using the code below:

import (
 "github.com/openai/openai-go" // imported as openai
)

A simple API request to the Responses API would look like this:

Test a basic API request

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
package main

import (
 "context"
 "fmt"

 "github.com/openai/openai-go/v3"
 "github.com/openai/openai-go/v3/option"
 "github.com/openai/openai-go/v3/responses"
)

func main() {
 client := openai.NewClient(
 option.WithAPIKey("My API Key"), // or set OPENAI_API_KEY in your env
 )

 resp, err := client.Responses.New(context.TODO(), openai.ResponseNewParams{
 Model: "gpt-5.4",
 Input: responses.ResponseNewParamsInputUnion{OfString: openai.String("Say this is a test")},
 })
 if err != nil {
 panic(err.Error())
 }

 fmt.Println(resp.OutputText())
}

To learn more about using the OpenAI API in Go, check out the GitHub repo linked below!

Learn more on GitHub

Discover more SDK capabilities and options on the library’s GitHub README.

Responses starter app

Start building with the Responses API.

Text generation and prompting

Learn more about prompting, message roles, and building conversational apps.

Add credits to keep building

Go to billing

Congrats on running a free test API request! Start building real applications with higher limits and use our models to generate text, audio, images, videos and more.

Access dashboard features designed to help you ship faster:

Chat Playground

Build & test conversational prompts and embed them in your app.

Agent Builder

Build, deploy, and optimize agent workflows.

Analyze images and files

Send image URLs, uploaded files, or PDF documents directly to the model to extract text, classify content, or detect visual elements.

Image URLFile URLUpload file

Image URL

Analyze the content of an image

javascript

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
11
12
13
14
15
16
17
18
19
20
21
22
23
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
 model: "gpt-5",
 input: [
 {
 role: "user",
 content: [
 {
 type: "input_text",
 text: "What is in this image?",
 },
 {
 type: "input_image",
 image_url: "https://openai-documentation.vercel.app/images/cat_and_otter.png",
 },
 ],
 },
 ],
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
10
11
12
13
14
15
16
17
18
19
20
21
curl "https://api.openai.com/v1/responses" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5",
 "input": [
 {
 "role": "user",
 "content": [
 {
 "type": "input_text",
 "text": "What is in this image?"
 },
 {
 "type": "input_image",
 "image_url": "https://openai-documentation.vercel.app/images/cat_and_otter.png"
 }
 ]
 }
 ]
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
10
11
12
13
14
15
16
17
18
19
20
21
22
23
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
 model="gpt-5",
 input=[
 {
 "role": "user",
 "content": [
 {
 "type": "input_text",
 "text": "What teams are playing in this image?",
 },
 {
 "type": "input_image",
 "image_url": "https://api.nga.gov/iiif/a2e6da57-3cd1-4235-b20e-95dcaefed6c8/full/!800,800/0/default.jpg"
 }
 ]
 }
 ]
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
11
12
13
using OpenAI.Responses;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
OpenAIResponseClient client = new(model: "gpt-5", apiKey: key);

OpenAIResponse response = (OpenAIResponse)client.CreateResponse([
 ResponseItem.CreateUserMessageItem([
 ResponseContentPart.CreateInputTextPart("What is in this image?"),
 ResponseContentPart.CreateInputImagePart(new Uri("https://openai-documentation.vercel.app/images/cat_and_otter.png")),
 ]),
]);

Console.WriteLine(response.GetOutputText());

File URL

Use a file URL as input

javascript

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
11
12
13
14
15
16
17
18
19
20
21
curl "https://api.openai.com/v1/responses" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5",
 "input": [
 {
 "role": "user",
 "content": [
 {
 "type": "input_text",
 "text": "Analyze the letter and provide a summary of the key points."
 },
 {
 "type": "input_file",
 "file_url": "https://www.berkshirehathaway.com/letters/2024ltr.pdf"
 }
 ]
 }
 ]
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
10
11
12
13
14
15
16
17
18
19
20
21
22
23
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
 model: "gpt-5",
 input: [
 {
 role: "user",
 content: [
 {
 type: "input_text",
 text: "Analyze the letter and provide a summary of the key points.",
 },
 {
 type: "input_file",
 file_url: "https://www.berkshirehathaway.com/letters/2024ltr.pdf",
 },
 ],
 },
 ],
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
10
11
12
13
14
15
16
17
18
19
20
21
22
23
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
 model="gpt-5",
 input=[
 {
 "role": "user",
 "content": [
 {
 "type": "input_text",
 "text": "Analyze the letter and provide a summary of the key points.",
 },
 {
 "type": "input_file",
 "file_url": "https://www.berkshirehathaway.com/letters/2024ltr.pdf",
 },
 ],
 },
 ]
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
11
12
13
14
15
16
17
18
19
using OpenAI.Files;
using OpenAI.Responses;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
OpenAIResponseClient client = new(model: "gpt-5", apiKey: key);

using HttpClient http = new();
using Stream stream = await http.GetStreamAsync("https://www.berkshirehathaway.com/letters/2024ltr.pdf");
OpenAIFileClient files = new(key);
OpenAIFile file = files.UploadFile(stream, "2024ltr.pdf", FileUploadPurpose.UserData);

OpenAIResponse response = (OpenAIResponse)client.CreateResponse([
 ResponseItem.CreateUserMessageItem([
 ResponseContentPart.CreateInputTextPart("Analyze the letter and provide a summary of the key points."),
 ResponseContentPart.CreateInputFilePart(file.Id),
 ]),
]);

Console.WriteLine(response.GetOutputText());

Upload file

Upload a file and use it as input

javascript

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
curl https://api.openai.com/v1/files \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -F purpose="user_data" \
 -F file="@draconomicon.pdf"

curl "https://api.openai.com/v1/responses" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5",
 "input": [
 {
 "role": "user",
 "content": [
 {
 "type": "input_file",
 "file_id": "file-6F2ksmvXxt4VdoqmHRw6kL"
 },
 {
 "type": "input_text",
 "text": "What is the first dragon in the book?"
 }
 ]
 }
 ]
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
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
import fs from "fs";
import OpenAI from "openai";
const client = new OpenAI();

const file = await client.files.create({
 file: fs.createReadStream("draconomicon.pdf"),
 purpose: "user_data",
});

const response = await client.responses.create({
 model: "gpt-5",
 input: [
 {
 role: "user",
 content: [
 {
 type: "input_file",
 file_id: file.id,
 },
 {
 type: "input_text",
 text: "What is the first dragon in the book?",
 },
 ],
 },
 ],
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
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
from openai import OpenAI
client = OpenAI()

file = client.files.create(
 file=open("draconomicon.pdf", "rb"),
 purpose="user_data"
)

response = client.responses.create(
 model="gpt-5",
 input=[
 {
 "role": "user",
 "content": [
 {
 "type": "input_file",
 "file_id": file.id,
 },
 {
 "type": "input_text",
 "text": "What is the first dragon in the book?",
 },
 ]
 }
 ]
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
11
12
13
14
15
16
17
using OpenAI.Files;
using OpenAI.Responses;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
OpenAIResponseClient client = new(model: "gpt-5", apiKey: key);

OpenAIFileClient files = new(key);
OpenAIFile file = files.UploadFile("draconomicon.pdf", FileUploadPurpose.UserData);

OpenAIResponse response = (OpenAIResponse)client.CreateResponse([
 ResponseItem.CreateUserMessageItem([
 ResponseContentPart.CreateInputFilePart(file.Id),
 ResponseContentPart.CreateInputTextPart("What is the first dragon in the book?"),
 ]),
]);

Console.WriteLine(response.GetOutputText());

Image inputs guide

Learn to use image inputs to the model and extract meaning from images.

File inputs guide

Learn to use file inputs to the model and extract meaning from documents.

Extend the model with tools

Give the model access to external data and functions by attaching tools. Use built-in tools like web search or file search, or define your own for calling APIs, running code, or integrating with third-party systems.

Web searchFile searchFunction callingRemote MCP

Web search

Use web search in a response

javascript

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
11
12
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
 model: "gpt-5.4",
 tools: [
 { type: "web_search" },
 ],
 input: "What was a positive news story from today?",
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
10
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
 model="gpt-5.4",
 tools=[{"type": "web_search"}],
 input="What was a positive news story from today?"
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
curl "https://api.openai.com/v1/responses" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -d '{
 "model": "gpt-5.4",
 "tools": [{"type": "web_search"}],
 "input": "what was a positive news story from today?"
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
10
11
12
13
14
15
using OpenAI.Responses;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
OpenAIResponseClient client = new(model: "gpt-5.4", apiKey: key);

ResponseCreationOptions options = new();
options.Tools.Add(ResponseTool.CreateWebSearchTool());

OpenAIResponse response = (OpenAIResponse)client.CreateResponse([
 ResponseItem.CreateUserMessageItem([
 ResponseContentPart.CreateInputTextPart("What was a positive news story from today?"),
 ]),
], options);

Console.WriteLine(response.GetOutputText());

File search

Search your files in a response

javascript

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
11
12
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
 model="gpt-4.1",
 input="What is deep research by OpenAI?",
 tools=[{
 "type": "file_search",
 "vector_store_ids": ["<vector_store_id>"]
 }]
)
print(response)

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
11
12
13
14
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
 model: "gpt-4.1",
 input: "What is deep research by OpenAI?",
 tools: [
 {
 type: "file_search",
 vector_store_ids: ["<vector_store_id>"],
 },
 ],
});
console.log(response);

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
11
12
13
14
15
using OpenAI.Responses;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
OpenAIResponseClient client = new(model: "gpt-5", apiKey: key);

ResponseCreationOptions options = new();
options.Tools.Add(ResponseTool.CreateFileSearchTool(["<vector_store_id>"]));

OpenAIResponse response = (OpenAIResponse)client.CreateResponse([
 ResponseItem.CreateUserMessageItem([
 ResponseContentPart.CreateInputTextPart("What is deep research by OpenAI?"),
 ]),
], options);

Console.WriteLine(response.GetOutputText());

Function calling

Call your own function

javascript

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
import OpenAI from "openai";
const client = new OpenAI();

const tools = [
 {
 type: "function",
 name: "get_weather",
 description: "Get current temperature for a given location.",
 parameters: {
 type: "object",
 properties: {
 location: {
 type: "string",
 description: "City and country e.g. Bogotá, Colombia",
 },
 },
 required: ["location"],
 additionalProperties: false,
 },
 strict: true,
 },
];

const response = await client.responses.create({
 model: "gpt-5",
 input: [
 { role: "user", content: "What is the weather like in Paris today?" },
 ],
 tools,
});

console.log(response.output[0].to_json());

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
from openai import OpenAI

client = OpenAI()

tools = [
 {
 "type": "function",
 "name": "get_weather",
 "description": "Get current temperature for a given location.",
 "parameters": {
 "type": "object",
 "properties": {
 "location": {
 "type": "string",
 "description": "City and country e.g. Bogotá, Colombia",
 }
 },
 "required": ["location"],
 "additionalProperties": False,
 },
 "strict": True,
 },
]

response = client.responses.create(
 model="gpt-5",
 input=[
 {"role": "user", "content": "What is the weather like in Paris today?"},
 ],
 tools=tools,
)

print(response.output[0].to_json())

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
using System.Text.Json;
using OpenAI.Responses;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
OpenAIResponseClient client = new(model: "gpt-5", apiKey: key);

ResponseCreationOptions options = new();
options.Tools.Add(ResponseTool.CreateFunctionTool(
 functionName: "get_weather",
 functionDescription: "Get current temperature for a given location.",
 functionParameters: BinaryData.FromObjectAsJson(new
 {
 type = "object",
 properties = new
 {
 location = new
 {
 type = "string",
 description = "City and country e.g. Bogotá, Colombia"
 }
 },
 required = new[] { "location" },
 additionalProperties = false
 }),
 strictModeEnabled: true
 )
);

OpenAIResponse response = (OpenAIResponse)client.CreateResponse([
 ResponseItem.CreateUserMessageItem([
 ResponseContentPart.CreateInputTextPart("What is the weather like in Paris today?")
 ])
], options);

Console.WriteLine(JsonSerializer.Serialize(response.OutputItems[0]));

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
curl -X POST https://api.openai.com/v1/responses \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{
 "model": "gpt-5",
 "input": [
 {"role": "user", "content": "What is the weather like in Paris today?"}
 ],
 "tools": [
 {
 "type": "function",
 "name": "get_weather",
 "description": "Get current temperature for a given location.",
 "parameters": {
 "type": "object",
 "properties": {
 "location": {
 "type": "string",
 "description": "City and country e.g. Bogotá, Colombia"
 }
 },
 "required": ["location"],
 "additionalProperties": false
 },
 "strict": true
 }
 ]
 }'

Remote MCP

Call a remote MCP server

javascript

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
11
12
13
14
15
16
curl https://api.openai.com/v1/responses \ 
-H "Content-Type: application/json" \ 
-H "Authorization: Bearer $OPENAI_API_KEY" \ 
-d '{
 "model": "gpt-5",
 "tools": [
 {
 "type": "mcp",
 "server_label": "dmcp",
 "server_description": "A Dungeons and Dragons MCP server to assist with dice rolling.",
 "server_url": "https://dmcp-server.deno.dev/sse",
 "require_approval": "never"
 }
 ],
 "input": "Roll 2d4+1"
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
10
11
12
13
14
15
16
17
18
import OpenAI from "openai";
const client = new OpenAI();

const resp = await client.responses.create({
 model: "gpt-5",
 tools: [
 {
 type: "mcp",
 server_label: "dmcp",
 server_description: "A Dungeons and Dragons MCP server to assist with dice rolling.",
 server_url: "https://dmcp-server.deno.dev/sse",
 require_approval: "never",
 },
 ],
 input: "Roll 2d4+1",
});

console.log(resp.output_text);

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
11
12
13
14
15
16
17
18
19
from openai import OpenAI

client = OpenAI()

resp = client.responses.create(
 model="gpt-5",
 tools=[
 {
 "type": "mcp",
 "server_label": "dmcp",
 "server_description": "A Dungeons and Dragons MCP server to assist with dice rolling.",
 "server_url": "https://dmcp-server.deno.dev/sse",
 "require_approval": "never",
 },
 ],
 input="Roll 2d4+1",
)

print(resp.output_text)

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
11
12
13
14
15
16
17
18
19
using OpenAI.Responses;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
OpenAIResponseClient client = new(model: "gpt-5", apiKey: key);

ResponseCreationOptions options = new();
options.Tools.Add(ResponseTool.CreateMcpTool(
 serverLabel: "dmcp",
 serverUri: new Uri("https://dmcp-server.deno.dev/sse"),
 toolCallApprovalPolicy: new McpToolCallApprovalPolicy(GlobalMcpToolCallApprovalPolicy.NeverRequireApproval)
));

OpenAIResponse response = (OpenAIResponse)client.CreateResponse([
 ResponseItem.CreateUserMessageItem([
 ResponseContentPart.CreateInputTextPart("Roll 2d4+1")
 ])
], options);

Console.WriteLine(response.GetOutputText());

Use built-in tools

Learn about powerful built-in tools like web search and file search.

Function calling guide

Learn to enable the model to call your own custom code.

Stream responses and build realtime apps

Use server‑sent streaming events to show results as they’re generated, or the Realtime API for interactive voice and multimodal apps.

Stream server-sent events from the API

javascript

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
11
12
13
14
15
16
17
import { OpenAI } from "openai";
const client = new OpenAI();

const stream = await client.responses.create({
 model: "gpt-5",
 input: [
 {
 role: "user",
 content: "Say 'double bubble bath' ten times fast.",
 },
 ],
 stream: true,
});

for await (const event of stream) {
 console.log(event);
}

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
11
12
13
14
15
16
from openai import OpenAI
client = OpenAI()

stream = client.responses.create(
 model="gpt-5",
 input=[
 {
 "role": "user",
 "content": "Say 'double bubble bath' ten times fast.",
 },
 ],
 stream=True,
)

for event in stream:
 print(event)

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
11
12
13
14
15
16
17
18
using OpenAI.Responses;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
OpenAIResponseClient client = new(model: "gpt-5", apiKey: key);

var responses = client.CreateResponseStreamingAsync([
 ResponseItem.CreateUserMessageItem([
 ResponseContentPart.CreateInputTextPart("Say 'double bubble bath' ten times fast."),
 ]),
]);

await foreach (var response in responses)
{
 if (response is StreamingResponseOutputTextDeltaUpdate delta)
 {
 Console.Write(delta.Delta);
 }
}

Use streaming events

Use server-sent events to stream model responses to users fast.

Get started with the Realtime API

Use WebRTC or WebSockets for super fast speech-to-speech AI apps.

Build agents

Use the OpenAI platform to build agents capable of taking action—like controlling computers—on behalf of your users. Use the Agents SDK to create orchestration logic on the backend.

Build a language triage agent

javascript

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
11
12
13
14
15
16
17
18
19
20
21
import { Agent, run } from '@openai/agents';

const spanishAgent = new Agent({
 name: 'Spanish agent',
 instructions: 'You only speak Spanish.',
});

const englishAgent = new Agent({
 name: 'English agent',
 instructions: 'You only speak English',
});

const triageAgent = new Agent({
 name: 'Triage agent',
 instructions:
 'Handoff to the appropriate agent based on the language of the request.',
 handoffs: [spanishAgent, englishAgent],
});

const result = await run(triageAgent, 'Hola, ¿cómo estás?');
console.log(result.finalOutput);

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
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
from agents import Agent, Runner
import asyncio

spanish_agent = Agent(
 name="Spanish agent",
 instructions="You only speak Spanish.",
)

english_agent = Agent(
 name="English agent",
 instructions="You only speak English",
)

triage_agent = Agent(
 name="Triage agent",
 instructions="Handoff to the appropriate agent based on the language of the request.",
 handoffs=[spanish_agent, english_agent],
)

async def main():
 result = await Runner.run(triage_agent, input="Hola, ¿cómo estás?")
 print(result.final_output)

if __name__ == "__main__":
 asyncio.run(main())

Build agents that can take action

Learn how to use the OpenAI platform to build powerful, capable AI agents.
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/OpenAI/showcase.txt</code></summary>

````text
Showcase | OpenAI Developers

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

 Search developer resources 

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

 API examples 

Filters
 
 Reset filters 

Source
 
 All 

 OpenAI 

 Community 

Type
 
 All 

 App 

 Game 

 Landing Page 

 Storefront 

 Other 

Use case
 
 All 

 Creative tools 

 Data visualization 

 Documentation 

 Ecommerce 

 Games 

 Marketing sites 

 Visual experience 

Tech stack
 
 All 

 Next.js 

 React 

 Three.js 

 Apps built with OpenAI 
 
Explore demos built with Codex + GPT-5.4

Submit your project

Featured

Explore selected projects from OpenAI and the community.

 Watchmaker Landing Page 
 
 Haute horlogerie landing page for a luxury watchmaker. 

 Arcade Bar Landing Page 
 
 Neon arcade and pinball bar landing page with promotional sections. 

 Forged in Silence 
 
 A cinematic 3D katana experience that scrolls like a story and sells like... 

 London Dream Railway 
 
 A playful 3D toy-table version of London with miniature trains, landmarks... 

 All projects 

 Turn-based RPG 
 
 A browser demo that turns GPT-5.4 into a turn-based role-playing game with... 

 Neon FPS 
 
 Neon first-person shooter game with arcade-style combat. 

 Brick Platformer 
 
 Browser platformer game with brick rooftops and side-scrolling action. 

 Arcade Bar Landing Page 
 
 Neon arcade and pinball bar landing page with promotional sections. 

 Cold Brew House Landing Page 
 
 Cold brew coffee landing page with minimalist product storytelling. 

 Watchmaker Landing Page 
 
 Haute horlogerie landing page for a luxury watchmaker. 

 Theme Park Builder 
 
 Mini-game where you can build your own theme park. 

 Golden Gate Experience 
 
 Cinematic experience where you can fly around the Golden Gate Bridge. 

 Real estate data viz 
 
 App to get insights on the Paris real-estate market using the French Gov... 

 E-commerce website 
 
 Retail storefront demo with product browsing and shopping flows. 

 Procedural City Generator 
 
 Browser-based 3D city generator. 

 Codex 101 
 
 A bilingual 101 tutorial that helps developers learn Codex across CLI... 

 Forged in Silence 
 
 A cinematic 3D katana experience that scrolls like a story and sells like... 

 The TypewriterWeb Demonstration from 1999 
 
 A 1999 DHTML demo restored with Codex 5.4. 

 London Dream Railway 
 
 A playful 3D toy-table version of London with miniature trains, landmarks... 

No projects match these filters

Try clearing a few filters.

Filters

 Reset filters 

 Source 
 
 All 

 OpenAI 

 Community 

 Type 
 
 All 

 App 

 Game 

 Landing Page 

 Storefront 

 Other 

 Use case 
 
 All 

 Creative tools 

 Data visualization 

 Documentation 

 Ecommerce 

 Games 

 Marketing sites 

 Visual experience 

 Tech stack 
 
 All 

 Next.js 

 React 

 Three.js
````

</details>
