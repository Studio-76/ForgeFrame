# API-Cerebras

> Neu erzeugt aus offiziellen Referenzdokumentationen. Falls kein Reverse-Engineering-Dokument vorhanden war, enthält diese Datei primär offizielle Schnittstelleninformationen und Implementierungshinweise.


---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/Cerebras`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – Cerebras

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### OpenAI Compatibility - Cerebras Inference
- Quelle: Pflichtquelle
- Original-URL: https://inference-docs.cerebras.ai/resources/openai
- Bereinigte Download-URL: https://inference-docs.cerebras.ai/resources/openai
- Lokale Datei(en): HTML: `openai.html`, Text: `openai.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Cerebras OpenAI compatibility
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://inference-docs.cerebras.ai/resources/openai`
- `https://api.cerebras.ai/v1:`
- `https://api.cerebras.ai/v1`

### Erkannte Endpunkte / Pfade

- `https://api.cerebras.ai/v1:`
- `https://api.cerebras.ai/v1"`

### Erkannte Umgebungsvariablen / Konstanten

- `CEREBRAS_API_KEY`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### OpenAI Compatibility - Cerebras Inference
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://inference-docs.cerebras.ai/resources/openai
- Bereinigte Download-URL: https://inference-docs.cerebras.ai/resources/openai

---

**Quelle `INDEX.md`**

- Original-URL: https://inference-docs.cerebras.ai/resources/openai
- Bereinigte Download-URL: https://inference-docs.cerebras.ai/resources/openai
- Lokale Datei(en): HTML: `openai.html`, Text: `openai.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://inference-docs.cerebras.ai/resources/openai
- Lokale Datei(en): HTML: `openai.html`, Text: `openai.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Cerebras OpenAI compatibility
- Download-Werkzeug: `urllib`

---

**Quelle `openai.txt`**

OpenAI Compatibility - Cerebras Inference

---

**Quelle `openai.txt`**

Get an API Key

---

**Quelle `openai.txt`**

OpenAI Compatibility

---

**Quelle `openai.txt`**

Python SDK

---

**Quelle `openai.txt`**

Node.js SDK

---

**Quelle `openai.txt`**

Models

---

**Quelle `openai.txt`**

Rate Limits

---

**Quelle `openai.txt`**

Streaming Responses

---

**Quelle `openai.txt`**

Tool Calling

---

**Quelle `openai.txt`**

Dedicated Endpoints

---

**Quelle `openai.txt`**

Configuring OpenAI to Use Cerebras API

---

**Quelle `openai.txt`**

Key Differences from OpenAI

---

**Quelle `openai.txt`**

Use the OpenAI Client Libraries with Cerebras Inference

---

**Quelle `openai.txt`**

We designed the Cerebras API to be mostly compatible with OpenAI’s client libraries, making it simple to configure your existing applications to run on Cerebras and take advantage of our inference capabilities.
We also offer dedicated Cerebras Python and Cerebras TypeScript SDKs.

---

**Quelle `openai.txt`**

To start using Cerebras with OpenAI’s client libraries, simply pass your Cerebras API key to the apiKey parameter and change the baseURL to https://api.cerebras.ai/v1:

---

**Quelle `openai.txt`**

import os
import openai

---

**Quelle `openai.txt`**

client = openai.OpenAI(
 base_url="https://api.cerebras.ai/v1",

---

**Quelle `openai.txt`**

client = openai.OpenAI(
 base_url="https://api.cerebras.ai/v1",
 api_key=os.environ.get("CEREBRAS_API_KEY")

---

**Quelle `openai.txt`**

For gpt-oss-120b, the API supports both the system and developer message roles. Both are mapped to a developer-level instruction layer in the prompt hierarchy, elevated above normal user instructions and injected into the model’s internal system prompt. This gives you significant control over the assistant’s tone, style, and behavior while preserving the model’s built-in safety guardrails.
The developer role is functionally equivalent to system – the system role remains supported for backwards compatibility.

---

**Quelle `openai.txt`**

OpenAI’s API distinguishes between system and developer roles with different behavior. On Cerebras, both roles act at the developer level, meaning they may have stronger influence than system messages in OpenAI’s API.
As a result, the same prompt may yield different behavior here compared to OpenAI. This is expected.

---

**Quelle `openai.txt`**

OpenAI: Non-standard parameters (e.g., clear_thinking for Z.ai GLM) need to be passed through extra_body. Standard OpenAI parameters like reasoning_effort work directly.

---

**Quelle `openai.txt`**

Cerebras SDK: Non-standard parameters can be passed in either extra_body or as regular parameters like model.

---

**Quelle `openai.txt`**

Example: Using the OpenAI Client

---

**Quelle `openai.txt`**

When using the OpenAI client with Cerebras API, non-standard parameters must be passed through extra_body:

---

**Quelle `openai.txt`**

client = OpenAI(
 base_url="https://api.cerebras.ai/v1",

---

**Quelle `openai.txt`**

client = OpenAI(
 base_url="https://api.cerebras.ai/v1",
 api_key=os.environ.get("CEREBRAS_API_KEY")

---

**Quelle `openai.txt`**

response = client.chat.completions.create(
 model="zai-glm-4.7",

---

**Quelle `openai.txt`**

Example: Using the Cerebras SDK Client

---

**Quelle `openai.txt`**

When using the Cerebras SDK client, non-standard parameters can be passed as regular parameters:

---

**Quelle `openai.txt`**

Responses are generated using AI and may contain mistakes.

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `openai.txt`**

````text
base_url="https://api.cerebras.ai/v1",
````

---

**Quelle `openai.txt`**

````text
api_key=os.environ.get("CEREBRAS_API_KEY")
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/Cerebras/openai.txt</code></summary>

````text
OpenAI Compatibility - Cerebras Inference

Skip to main content

Cerebras Inference home page

Docs

API Reference

Cookbook

Community

Blog

Get an API Key

Get an API Key

Search...

Navigation

Compatibility

OpenAI Compatibility

Search...

⌘K

Python SDK

Node.js SDK

Get Started

Overview

Quickstart

Pricing

Models

Rate Limits

Capabilities

Reasoning

Streaming Responses

Predicted Outputs
Preview

Structured Outputs

Tool Calling

Prompt Caching

Payload Optimization

CePO: Cerebras Planning & Optimization​

Dedicated Endpoints

Overview

Features

Compatibility

OpenAI Compatibility

Migrate to GLM 4.7

Cloud Console

Projects
Preview

Resources

Designing for Cerebras

Integrations

Cerebras Code

API Playground

Support

Service Status

Error Codes

Change Log

Deprecations

Policies

Preview Releases

On this page

Configuring OpenAI to Use Cerebras API

Developer-Level Instructions via System and Developer Roles

Key Differences from OpenAI

Passing Non-Standard Parameters

Copy pageCopy MCP ServerView as Markdown

Compatibility

OpenAI Compatibility

Use the OpenAI Client Libraries with Cerebras Inference

We designed the Cerebras API to be mostly compatible with OpenAI’s client libraries, making it simple to configure your existing applications to run on Cerebras and take advantage of our inference capabilities.
We also offer dedicated Cerebras Python and Cerebras TypeScript SDKs.

​

Configuring OpenAI to Use Cerebras API

To start using Cerebras with OpenAI’s client libraries, simply pass your Cerebras API key to the apiKey parameter and change the baseURL to https://api.cerebras.ai/v1:

Python

Node.js

import os
import openai

client = openai.OpenAI(
 base_url="https://api.cerebras.ai/v1",
 api_key=os.environ.get("CEREBRAS_API_KEY")
)

​

Developer-Level Instructions via System and Developer Roles

This info is only applicable to the gpt-oss-120b model. 

For gpt-oss-120b, the API supports both the system and developer message roles. Both are mapped to a developer-level instruction layer in the prompt hierarchy, elevated above normal user instructions and injected into the model’s internal system prompt. This gives you significant control over the assistant’s tone, style, and behavior while preserving the model’s built-in safety guardrails.
The developer role is functionally equivalent to system – the system role remains supported for backwards compatibility.

​

Key Differences from OpenAI

OpenAI’s API distinguishes between system and developer roles with different behavior. On Cerebras, both roles act at the developer level, meaning they may have stronger influence than system messages in OpenAI’s API.
As a result, the same prompt may yield different behavior here compared to OpenAI. This is expected.

​

Passing Non-Standard Parameters

OpenAI: Non-standard parameters (e.g., clear_thinking for Z.ai GLM) need to be passed through extra_body. Standard OpenAI parameters like reasoning_effort work directly.

Cerebras SDK: Non-standard parameters can be passed in either extra_body or as regular parameters like model.

Example: Using the OpenAI Client

When using the OpenAI client with Cerebras API, non-standard parameters must be passed through extra_body:

Python

Node.js

client = OpenAI(
 base_url="https://api.cerebras.ai/v1",
 api_key=os.environ.get("CEREBRAS_API_KEY")
)

response = client.chat.completions.create(
 model="zai-glm-4.7",
 messages=[...],
 reasoning_effort="none", # Standard parameter, no extra_body needed
 extra_body={
 "clear_thinking": False # Non-standard: must use extra_body
 }
)

Example: Using the Cerebras SDK Client

When using the Cerebras SDK client, non-standard parameters can be passed as regular parameters:

Python

Node.js

client = Cerebras(
 api_key=os.environ.get("CEREBRAS_API_KEY")
)

response = client.chat.completions.create(
 model="zai-glm-4.7",
 messages=[...],
 reasoning_effort="none", # Standard parameter
 clear_thinking=False # Non-standard parameter
)

Was this page helpful?

YesNo

Metrics

Previous

Migrate to GLM 4.7

Next

⌘I

Assistant

Responses are generated using AI and may contain mistakes.
````

</details>
