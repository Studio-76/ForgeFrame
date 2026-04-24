# API-ContinueOpenAI

> Neu erzeugt aus offiziellen Referenzdokumentationen. Falls kein Reverse-Engineering-Dokument vorhanden war, enthält diese Datei primär offizielle Schnittstelleninformationen und Implementierungshinweise.


---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/Continue`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – Continue

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### How to Configure OpenAI Models with Continue | Continue Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.continue.dev/customize/model-providers/top-level/openai
- Bereinigte Download-URL: https://docs.continue.dev/customize/model-providers/top-level/openai
- Lokale Datei(en): HTML: `openai.html`, Text: `openai.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Continue OpenAI provider
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://docs.continue.dev/customize/model-providers/top-level/openai`
- `http://localhost:8000/v1`

### Erkannte Endpunkte / Pfade

- `http://localhost:8000/v1`
- `/completions`
- `/responses`
- `/chat/completions`

### Erkannte Umgebungsvariablen / Konstanten

- `YAMLJSON`
- `MODEL_NAME`
- `MODEL_ID`
- `YOUR_OPENAI_API_KEY`
- `OPENAI_API_COMPATIBLE_PROVIDER_MODEL`
- `YOUR_CUSTOM_API_KEY`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### How to Configure OpenAI Models with Continue | Continue Docs
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.continue.dev/customize/model-providers/top-level/openai
- Bereinigte Download-URL: https://docs.continue.dev/customize/model-providers/top-level/openai

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.continue.dev/customize/model-providers/top-level/openai
- Bereinigte Download-URL: https://docs.continue.dev/customize/model-providers/top-level/openai
- Lokale Datei(en): HTML: `openai.html`, Text: `openai.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.continue.dev/customize/model-providers/top-level/openai
- Lokale Datei(en): HTML: `openai.html`, Text: `openai.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Continue OpenAI provider
- Download-Werkzeug: `urllib`

---

**Quelle `openai.txt`**

How to Configure OpenAI Models with Continue | Continue Docs

---

**Quelle `openai.txt`**

Customization OverviewModelsMCP serversRulesPrompts
Model Providers

---

**Quelle `openai.txt`**

Popular Providers
AnthropicAzure AI FoundryAmazon BedrockGeminiHugging FaceInceptionLM StudioOllamaOpenRouterOpenAITetrate Agent Router ServiceVertex AI

---

**Quelle `openai.txt`**

How to Understand Hub vs Local ConfigurationConfiguring Models, Rules, and ToolsCodebase and Documentation AwarenessUsing Plan Mode with ContinueUsing Ollama with Continue: A Developer's GuideUsing Instinct with Ollama in ContinueHow to Run Continue Without InternetHow to Build Custom Code RAGHow to Self-Host a Model

---

**Quelle `openai.txt`**

How to Configure OpenAI Models with Continue
Copy page

---

**Quelle `openai.txt`**

Discover OpenAI models here

---

**Quelle `openai.txt`**

Get an API key from the OpenAI Console

---

**Quelle `openai.txt`**

models:
 - name: <MODEL_NAME>

---

**Quelle `openai.txt`**

- name: <MODEL_NAME>
 provider: openai
 model: <MODEL_ID>

---

**Quelle `openai.txt`**

model: <MODEL_ID>
 apiKey: <YOUR_OPENAI_API_KEY>

---

**Quelle `openai.txt`**

OpenAI API compatible providers

---

**Quelle `openai.txt`**

OpenAI API compatible providers include

---

**Quelle `openai.txt`**

If you are using an OpenAI API compatible providers, you can change the apiBase like this:

---

**Quelle `openai.txt`**

models:
 - name: <OPENAI_API_COMPATIBLE_PROVIDER_MODEL>

---

**Quelle `openai.txt`**

models:
 - name: <OPENAI_API_COMPATIBLE_PROVIDER_MODEL>
 provider: openai

---

**Quelle `openai.txt`**

- name: <OPENAI_API_COMPATIBLE_PROVIDER_MODEL>
 provider: openai
 model: <MODEL_NAME>

---

**Quelle `openai.txt`**

model: <MODEL_NAME>
 apiBase: http://localhost:8000/v1
 apiKey: <YOUR_CUSTOM_API_KEY>

---

**Quelle `openai.txt`**

How to Force Legacy Completions Endpoint Usage

---

**Quelle `openai.txt`**

To force usage of completions instead of chat/completions endpoint you can set:

---

**Quelle `openai.txt`**

- name: <OPENAI_API_COMPATIBLE_PROVIDER_MODEL>
 provider: openai
 model: <MODEL_NAME>>

---

**Quelle `openai.txt`**

model: <MODEL_NAME>>
 apiBase: http://localhost:8000/v1
 useLegacyCompletionsEndpoint: true

---

**Quelle `openai.txt`**

apiBase: http://localhost:8000/v1
 useLegacyCompletionsEndpoint: true

---

**Quelle `openai.txt`**

How to Disable the Responses API

---

**Quelle `openai.txt`**

By default, Continue uses OpenAI's /responses endpoint for o-series and gpt-5 models. If you encounter "organization must be verified" errors related to reasoning summaries or streaming, you can force the use of /chat/completions instead:

---

**Quelle `openai.txt`**

models:
 - name: gpt-5

---

**Quelle `openai.txt`**

- name: gpt-5
 provider: openai
 model: gpt-5

---

**Quelle `openai.txt`**

model: gpt-5
 useResponsesApi: false

---

**Quelle `openai.txt`**

On this page
ConfigurationOpenAI API compatible providersHow to Force Legacy Completions Endpoint UsageHow to Disable the Responses API

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten

- Keine Codebeispiele automatisch erkannt.

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/Continue/openai.txt</code></summary>

````text
How to Configure OpenAI Models with Continue | Continue Docs

Search...⌘K

DocsBlogSign in

ChecksCLIIDE Extensions

Getting Started

InstallQuick StartCustomization Overview

Features

Agent

Chat

Autocomplete

Edit

Customize

Customization OverviewModelsMCP serversRulesPrompts
Model Providers
Model Providers Overview
Popular Providers
AnthropicAzure AI FoundryAmazon BedrockGeminiHugging FaceInceptionLM StudioOllamaOpenRouterOpenAITetrate Agent Router ServiceVertex AI

More Providers

Model Roles

Deep Dives
Telemetry

Reference

config.yaml ReferenceMigrating Config to YAMLContinue Documentation MCP Serverconfig.json Reference (Deprecated)Context Providers (Deprecated)@Codebase (Deprecated)@Docs (Deprecated)

Guides

How to Understand Hub vs Local ConfigurationConfiguring Models, Rules, and ToolsCodebase and Documentation AwarenessUsing Plan Mode with ContinueUsing Ollama with Continue: A Developer's GuideUsing Instinct with Ollama in ContinueHow to Run Continue Without InternetHow to Build Custom Code RAGHow to Self-Host a Model

Help

FAQsTroubleshootingDocs Contributions

Continue Hub (deprecated)

Secrets

Configs

How to Configure OpenAI Models with Continue
Copy page

Discover OpenAI models here

Get an API key from the OpenAI Console

Configuration

YAMLJSON (Deprecated)

name: My Config
version: 0.0.1
schema: v1

models:
 - name: <MODEL_NAME>
 provider: openai
 model: <MODEL_ID>
 apiKey: <YOUR_OPENAI_API_KEY>

Check out a more advanced configuration here

OpenAI API compatible providers

OpenAI API compatible providers include

KoboldCpp

text-gen-webui

FastChat

LocalAI

llama-cpp-python

TensorRT-LLM

vLLM

BerriAI/litellm

Tetrate Agent Router Service

If you are using an OpenAI API compatible providers, you can change the apiBase like this:

YAMLJSON (Deprecated)

name: My Config
version: 0.0.1
schema: v1

models:
 - name: <OPENAI_API_COMPATIBLE_PROVIDER_MODEL>
 provider: openai
 model: <MODEL_NAME>
 apiBase: http://localhost:8000/v1
 apiKey: <YOUR_CUSTOM_API_KEY>

How to Force Legacy Completions Endpoint Usage

To force usage of completions instead of chat/completions endpoint you can set:

YAMLJSON (Deprecated)

name: My Config
version: 0.0.1
schema: v1

models:
 - name: <OPENAI_API_COMPATIBLE_PROVIDER_MODEL>
 provider: openai
 model: <MODEL_NAME>>
 apiBase: http://localhost:8000/v1
 useLegacyCompletionsEndpoint: true

How to Disable the Responses API

By default, Continue uses OpenAI's /responses endpoint for o-series and gpt-5 models. If you encounter "organization must be verified" errors related to reasoning summaries or streaming, you can force the use of /chat/completions instead:

YAMLJSON (Deprecated)

name: My Config
version: 0.0.1
schema: v1

models:
 - name: gpt-5
 provider: openai
 model: gpt-5
 useResponsesApi: false

OpenRouterTetrate Agent Router Service

On this page
ConfigurationOpenAI API compatible providersHow to Force Legacy Completions Endpoint UsageHow to Disable the Responses API
````

</details>
