# API-Mistral.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## Provider

- Hermes Provider-ID: `mistral`
- Anzeige: Mistral AI
- Typ: OpenAI-kompatibel/native
- Base URL: `https://api.mistral.ai/v1 bzw. base https://api.mistral.ai`
- Auth: Bearer API key

## Grundschema

Soweit der Provider OpenAI-kompatibel ist:

```http
POST <base_url>/chat/completions
Authorization: Bearer <token>
Content-Type: application/json
```

Wenn die Base URL bereits auf `/v1` endet, wird direkt `/chat/completions` angehaengt. Im code-proxy-Generic-Provider wird dagegen intern immer `<baseURL>/v1/chat/completions` gebaut; dort muss `baseURL` entsprechend ohne `/v1` gesetzt sein.

## Modellformat

Nur als inferBaseURL in code-proxy sichtbar; hermes hat optional extra `mistral` dependency.

## ForgeFrame-Adapterhinweise

- Felder: `provider_id`, `base_url`, `api_key_env_vars`, `auth_type`, `model_normalization`, `api_mode`.
- Fuer Aggregatoren (`openrouter`, `nous`, `ai-gateway`, `kilocode`) Vendor-Slugs erhalten oder automatisch ergaenzen.
- Fuer native Provider wie Anthropic, Copilot, DeepSeek oder OpenCode Sonderregeln aus `model_normalize.py` beachten.
- Streaming als SSE `data:` implementieren, Non-Streaming als OpenAI-Response normalisieren.

---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/Mistral`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – Mistral

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### Migration guides | Mistral Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.mistral.ai/resources/migration-guides
- Bereinigte Download-URL: https://docs.mistral.ai/resources/migration-guides
- Lokale Datei(en): HTML: `migration-guides.html`, Text: `migration-guides.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Mistral migration guides
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Chat
- Quelle: Pflichtquelle
- Original-URL: https://docs.mistral.ai/api/endpoint/chat
- Bereinigte Download-URL: https://docs.mistral.ai/api/endpoint/chat
- Lokale Datei(en): HTML: `endpoint-chat.html`, Text: `endpoint-chat.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Mistral chat endpoint
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://docs.mistral.ai/resources/migration-guides`
- `https://docs.mistral.ai/api/endpoint/chat`
- `https://api.mistral.ai/v1/chat/completions`
- `https://api.openai.com/v1https://api.mistral.ai/v1`
- `https://api.mistral.ai/v1`

### Erkannte Endpunkte / Pfade

- `POST /v1/chat/completions`
- `/models`
- `https://api.mistral.ai/v1/chat/completions`
- `https://api.openai.com/v1https://api.mistral.ai/v1`
- `https://api.mistral.ai/v1"`
- `/INST`
- `/Mistral-7B-Instruct-v0.3`

### Erkannte Umgebungsvariablen / Konstanten

- `POST`
- `MUST`
- `DONE`
- `MISTRAL_API_KEY`
- `YOUR_APIKEY_HERE`
- `MISTRAL`
- `EXPLORE`
- `DOCUMENTATION`
- `BUILD`
- `LEGAL`
- `COMMUNITY`
- `INST`
- `AZUREAI_ENDPOINT`
- `AZUREAI_API_KEY`
- `GOOGLE_CLOUD_REGION`
- `GOOGLE_CLOUD_PROJECT_ID`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.mistral.ai/resources/migration-guides
- Bereinigte Download-URL: https://docs.mistral.ai/resources/migration-guides

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.mistral.ai/resources/migration-guides
- Bereinigte Download-URL: https://docs.mistral.ai/resources/migration-guides
- Lokale Datei(en): HTML: `migration-guides.html`, Text: `migration-guides.txt`

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.mistral.ai/api/endpoint/chat
- Bereinigte Download-URL: https://docs.mistral.ai/api/endpoint/chat

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.mistral.ai/api/endpoint/chat
- Bereinigte Download-URL: https://docs.mistral.ai/api/endpoint/chat
- Lokale Datei(en): HTML: `endpoint-chat.html`, Text: `endpoint-chat.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.mistral.ai/api/endpoint/chat
- Lokale Datei(en): HTML: `endpoint-chat.html`, Text: `endpoint-chat.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Mistral chat endpoint
- Download-Werkzeug: `urllib`

---

**Quelle `endpoint-chat.txt`**

Getting StartedModelsProductsDevelopersAdminAPI

---

**Quelle `endpoint-chat.txt`**

Embeddings

---

**Quelle `endpoint-chat.txt`**

Models

---

**Quelle `endpoint-chat.txt`**

Beta Libraries Accesses

---

**Quelle `endpoint-chat.txt`**

Chat Endpoints

---

**Quelle `endpoint-chat.txt`**

POST /v1/chat/completions

---

**Quelle `endpoint-chat.txt`**

max_tokens

---

**Quelle `endpoint-chat.txt`**

The maximum number of tokens to generate in the completion. The token count of your prompt plus max_tokens cannot exceed the model's context length.

---

**Quelle `endpoint-chat.txt`**

*array<SystemMessage|UserMessage|AssistantMessage|ToolMessage>

---

**Quelle `endpoint-chat.txt`**

The prompt(s) to generate completions for, encoded as a list of dict with role and content.

---

**Quelle `endpoint-chat.txt`**

ID of the model to use. You can use the List Available Models API to see all of your available models, or see our Model overview for model descriptions.

---

**Quelle `endpoint-chat.txt`**

Number of completions to return for each request, input tokens are only billed once.

---

**Quelle `endpoint-chat.txt`**

parallel_tool_calls

---

**Quelle `endpoint-chat.txt`**

Whether to enable parallel function calling during tool use, when enabled the model can call multiple tools in parallel.

---

**Quelle `endpoint-chat.txt`**

Available options to the prompt_mode argument on the chat completion endpoint.
Values represent high-level intent. Assignment to actual SPs is handled internally.

---

**Quelle `endpoint-chat.txt`**

Controls the reasoning effort level for reasoning models. "high" enables comprehensive reasoning traces, "none" disables reasoning effort.

---

**Quelle `endpoint-chat.txt`**

Stop generation if this token is detected. Or if one of these tokens is detected when providing an array

---

**Quelle `endpoint-chat.txt`**

stream

---

**Quelle `endpoint-chat.txt`**

Whether to stream back partial progress. If set, tokens will be sent as data-only server-side events as they become available, with the stream terminated by a data: [DONE] message. Otherwise, the server will hold the request open until the timeout or until completion, with the response containing the full result as JSON.

---

**Quelle `endpoint-chat.txt`**

What sampling temperature to use, we recommend between 0.0 and 0.7. Higher values like 0.7 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. We generally recommend altering this or top_p but not both. The default value varies depending on the model you are targeting. Call the /models endpoint to retrieve the appropriate value.

---

**Quelle `endpoint-chat.txt`**

tool_choice

---

**Quelle `endpoint-chat.txt`**

ToolChoice|"auto"|"none"|"any"|"required"

---

**Quelle `endpoint-chat.txt`**

Controls which (if any) tool is called by the model. none means the model will not call any tool and instead generates a message. auto means the model can pick between generating a message or calling one or more tools. any or required means the model must call one or more tools. Specifying a particular tool via \{"type": "function", "function": \{"name": "my_function"\}\} forces the model to call that tool.

---

**Quelle `endpoint-chat.txt`**

tools

---

**Quelle `endpoint-chat.txt`**

array<Tool>|null

---

**Quelle `endpoint-chat.txt`**

Nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.

---

**Quelle `endpoint-chat.txt`**

200 (text/event-stream)

---

**Quelle `endpoint-chat.txt`**

usage

---

**Quelle `endpoint-chat.txt`**

*UsageInfo

---

**Quelle `endpoint-chat.txt`**

event-stream<CompletionEvent>

---

**Quelle `endpoint-chat.txt`**

Test the endpoints live

---

**Quelle `endpoint-chat.txt`**

cURL

---

**Quelle `endpoint-chat.txt`**

async function run() {
 const result = await mistral.chat.complete({

---

**Quelle `endpoint-chat.txt`**

},
 ], stream=False)

---

**Quelle `endpoint-chat.txt`**

curl https://api.mistral.ai/v1/chat/completions \
 -X POST \

---

**Quelle `endpoint-chat.txt`**

-X POST \
 -H 'Authorization: Bearer YOUR_APIKEY_HERE' \
 -H 'Content-Type: application/json' \

---

**Quelle `endpoint-chat.txt`**

-H 'Authorization: Bearer YOUR_APIKEY_HERE' \
 -H 'Content-Type: application/json' \
 -d '{

---

**Quelle `endpoint-chat.txt`**

"object": "chat.completion",
 "usage": {}
}

---

**Quelle `migration-guides.txt`**

Getting StartedModelsProductsDevelopersAdminAPI

---

**Quelle `migration-guides.txt`**

SDKs

---

**Quelle `migration-guides.txt`**

These guides cover the specific code changes needed to switch from another provider to the Mistral API. The Mistral Chat Completions API follows the same request structure as OpenAI, so most migrations involve changing the client import, base URL, and model name. Choose your source platform below to see the exact steps and a working code example.

---

**Quelle `migration-guides.txt`**

From OpenAI

---

**Quelle `migration-guides.txt`**

The Mistral API follows the same Chat Completions structure as the OpenAI API. For most applications, migration requires changing three things: the client import, the initialization call, and the model name.

---

**Quelle `migration-guides.txt`**

Migrate from OpenAI

---

**Quelle `migration-guides.txt`**

Copy section link
Migrate from OpenAI

---

**Quelle `migration-guides.txt`**

Before (OpenAI):

---

**Quelle `migration-guides.txt`**

from openai import OpenAI

---

**Quelle `migration-guides.txt`**

client = OpenAI(api_key="sk-...")
response = client.chat.completions.create(

---

**Quelle `migration-guides.txt`**

client = OpenAI(api_key="sk-...")
response = client.chat.completions.create(
 model="gpt-4o",

---

**Quelle `migration-guides.txt`**

OpenAIMistral

---

**Quelle `migration-guides.txt`**

Python clientopenai.OpenAImistralai.Mistral

---

**Quelle `migration-guides.txt`**

Chat methodclient.chat.completions.createclient.chat.complete

---

**Quelle `migration-guides.txt`**

Streaming methodclient.chat.completions.create(stream=True)client.chat.stream

---

**Quelle `migration-guides.txt`**

Base URLhttps://api.openai.com/v1https://api.mistral.ai/v1

---

**Quelle `migration-guides.txt`**

OpenAI modelMistral equivalent

---

**Quelle `migration-guides.txt`**

text-embedding-3-smallmistral-embed

---

**Quelle `migration-guides.txt`**

Use the OpenAI-compatible base URL

---

**Quelle `migration-guides.txt`**

If your application uses an OpenAI-compatible client (LangChain, LlamaIndex, or any other third-party library), point it at the Mistral API by changing only the base URL and model name. No library swap required.

---

**Quelle `migration-guides.txt`**

client = OpenAI(
 api_key="your_mistral_api_key",

---

**Quelle `migration-guides.txt`**

api_key="your_mistral_api_key",
 base_url="https://api.mistral.ai/v1",
)

---

**Quelle `migration-guides.txt`**

response = client.chat.completions.create(
 model="mistral-large-latest",

---

**Quelle `migration-guides.txt`**

Tokenizer

---

**Quelle `migration-guides.txt`**

Mistral models use a different tokenizer than Llama. If you compute token counts manually or handle raw tokenization, update your tooling.

---

**Quelle `migration-guides.txt`**

Install the official Mistral tokenizer:

---

**Quelle `migration-guides.txt`**

Use it to tokenize text:

---

**Quelle `migration-guides.txt`**

from mistral_common.tokens.tokenizers.mistral import MistralTokenizer

---

**Quelle `migration-guides.txt`**

tokenizer = MistralTokenizer.v3()
result = tokenizer.encode_chat_completion(

---

**Quelle `migration-guides.txt`**

tokenizer = MistralTokenizer.v3()
result = tokenizer.encode_chat_completion(
 messages=[{"role": "user", "content": "Hello, world!"}]

---

**Quelle `migration-guides.txt`**

)
print(result.tokens)

---

**Quelle `migration-guides.txt`**

Mistral models on Hugging Face are also compatible with the transformers library. Use apply_chat_template to handle formatting automatically.

---

**Quelle `migration-guides.txt`**

Mistral models don't use the [INST] / [/INST] prompt format from Llama 2. Passing raw Llama 2-formatted strings to Mistral models produces degraded output. Update your prompt templates before testing.

---

**Quelle `migration-guides.txt`**

from transformers import AutoTokenizer

---

**Quelle `migration-guides.txt`**

tokenizer = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-Instruct-v0.3")
messages = [{"role": "user", "content": "Hello"}]

---

**Quelle `migration-guides.txt`**

messages = [{"role": "user", "content": "Hello"}]
formatted = tokenizer.apply_chat_template(messages, tokenize=False)

---

**Quelle `migration-guides.txt`**

All Mistral open-weight models are available on Hugging Face under the Mistral license.

---

**Quelle `migration-guides.txt`**

Migrate to Python SDK v2

---

**Quelle `migration-guides.txt`**

Copy section link
Migrate to Python SDK v2

---

**Quelle `migration-guides.txt`**

Version 2.0.0 of the Python SDK introduces a small number of breaking changes. All other APIs (chat, streaming, embeddings, agents, function calling, batch) are unchanged.

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `endpoint-chat.txt`**

````text
api_key=os.getenv("MISTRAL_API_KEY", ""),
````

---

**Quelle `endpoint-chat.txt`**

````text
curl https://api.mistral.ai/v1/chat/completions \
````

---

**Quelle `migration-guides.txt`**

````text
client = OpenAI(api_key="sk-...")
````

---

**Quelle `migration-guides.txt`**

````text
client = Mistral(api_key="your_mistral_api_key")
````

---

**Quelle `migration-guides.txt`**

````text
api_key="your_mistral_api_key",
````

---

**Quelle `migration-guides.txt`**

````text
base_url="https://api.mistral.ai/v1",
````

---

**Quelle `migration-guides.txt`**

````text
pip install mistral-common
````

---

**Quelle `migration-guides.txt`**

````text
pip install "mistralai>=2"
````

---

**Quelle `migration-guides.txt`**

````text
azure_api_key=os.environ["AZUREAI_API_KEY"],
````

---

**Quelle `migration-guides.txt`**

````text
api_key=os.environ["AZUREAI_API_KEY"],
````

---

**Quelle `migration-guides.txt`**

````text
Azure constructorazure_endpoint=, azure_api_key=server_url=, api_key=
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/Mistral/endpoint-chat.txt</code></summary>

````text
Chat

Docs & API

Search docs

⌘K

Getting StartedModelsProductsDevelopersAdminAPI

Search docs

⌘K

Toggle themeReach outTry Studio 

Download OpenAPI Spec

Getting Started

Chat

postChat Completion

Fim

Embeddings

Classifiers

Files

Models

Batch

Ocr

Audio Speech

Audio Transcriptions

Audio Voices

Beta

Beta Agents

Beta Conversations

Beta Libraries

Beta Libraries Accesses

Beta Libraries Documents

Beta Observability Campaigns

Beta Observability Chat Completion Events

Beta Observability Chat Completion Events Fields

Beta Observability Datasets

Beta Observability Datasets Records

Beta Observability Judges

Beta Workflows

Beta Workflows Deployments

Beta Workflows Events

Beta Workflows Executions

Beta Workflows Metrics

Beta Workflows Runs

Beta Workflows Schedules

Beta Workflows Workers

Deprecated

Deprecated Agents

Deprecated Fine Tuning

Getting Started

Chat

Chat Endpoints

Chat Completion API.

Toggle theme

Examples

Real world code examples

Chat Completion

POST /v1/chat/completions

Request Body

application/json

frequency_penalty

number

Default Value: 0

The frequency_penalty penalizes the repetition of words based on their frequency in the generated text. A higher frequency penalty discourages the model from repeating words that have already appeared frequently in the output, promoting diversity and reducing repetition.

guardrails

array<GuardrailConfig>|null

max_tokens

integer|null

The maximum number of tokens to generate in the completion. The token count of your prompt plus max_tokens cannot exceed the model's context length.

messages

*array<SystemMessage|UserMessage|AssistantMessage|ToolMessage>

The prompt(s) to generate completions for, encoded as a list of dict with role and content.

metadata

map<any>|null

model

*string

ID of the model to use. You can use the List Available Models API to see all of your available models, or see our Model overview for model descriptions.

n

integer|null

Number of completions to return for each request, input tokens are only billed once.

parallel_tool_calls

boolean

Default Value: true

Whether to enable parallel function calling during tool use, when enabled the model can call multiple tools in parallel.

prediction

Prediction|null

Enable users to specify an expected completion, optimizing response times by leveraging known or predictable content.

presence_penalty

number

Default Value: 0

The presence_penalty determines how much the model penalizes the repetition of words or phrases. A higher presence penalty encourages the model to use a wider variety of words and phrases, making the output more diverse and creative.

prompt_mode

"reasoning"

Available options to the prompt_mode argument on the chat completion endpoint.
Values represent high-level intent. Assignment to actual SPs is handled internally.
System prompt may include knowledge cutoff date, model capabilities, tone to use, safety guidelines, etc.

random_seed

integer|null

The seed to use for random sampling. If set, different calls will generate deterministic results.

reasoning_effort

"high"|"none"

Controls the reasoning effort level for reasoning models. "high" enables comprehensive reasoning traces, "none" disables reasoning effort.

response_format

ResponseFormat|null

Specify the format that the model must output. By default it will use \{ "type": "text" \}. Setting to \{ "type": "json_object" \} enables JSON mode, which guarantees the message the model generates is in JSON. When using JSON mode you MUST also instruct the model to produce JSON yourself with a system or a user message. Setting to \{ "type": "json_schema" \} enables JSON schema mode, which guarantees the message the model generates is in JSON and follows the schema you provide.

safe_prompt

boolean

Default Value: false

Whether to inject a safety prompt before all conversations.

stop

string|array<string>

Stop generation if this token is detected. Or if one of these tokens is detected when providing an array

stream

boolean

Default Value: false

Whether to stream back partial progress. If set, tokens will be sent as data-only server-side events as they become available, with the stream terminated by a data: [DONE] message. Otherwise, the server will hold the request open until the timeout or until completion, with the response containing the full result as JSON.

temperature

number|null

What sampling temperature to use, we recommend between 0.0 and 0.7. Higher values like 0.7 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. We generally recommend altering this or top_p but not both. The default value varies depending on the model you are targeting. Call the /models endpoint to retrieve the appropriate value.

tool_choice

ToolChoice|"auto"|"none"|"any"|"required"

Controls which (if any) tool is called by the model. none means the model will not call any tool and instead generates a message. auto means the model can pick between generating a message or calling one or more tools. any or required means the model must call one or more tools. Specifying a particular tool via \{"type": "function", "function": \{"name": "my_function"\}\} forces the model to call that tool.

tools

array<Tool>|null

top_p

number

Default Value: 1

Nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.

200 (application/json)

200 (text/event-stream)

Successful Response

choices

*array<ChatCompletionChoice>

created

*integer

id

*string

model

*string

object

*string

usage

*UsageInfo

Response Type

event-stream<CompletionEvent>

Successful Response

CompletionEvent

 {object}

Playground

Test the endpoints live

TypeScript

Python

cURL

import { Mistral } from "@mistralai/mistralai";

const mistral = new Mistral({
 apiKey: "MISTRAL_API_KEY",
});

async function run() {
 const result = await mistral.chat.complete({
 model: "mistral-small-latest",
 messages: [
 {
 content: "Who is the best French painter? Answer in one short sentence.",
 role: "user",
 },
 ],
 });

 console.log(result);
}

run();

import { Mistral } from "@mistralai/mistralai";

const mistral = new Mistral({
 apiKey: "MISTRAL_API_KEY",
});

async function run() {
 const result = await mistral.chat.complete({
 model: "mistral-small-latest",
 messages: [
 {
 content: "Who is the best French painter? Answer in one short sentence.",
 role: "user",
 },
 ],
 });

 console.log(result);
}

run();

from mistralai import Mistral
import os

with Mistral(
 api_key=os.getenv("MISTRAL_API_KEY", ""),
) as mistral:

 res = mistral.chat.complete(model="mistral-small-latest", messages=[
 {
 "content": "Who is the best French painter? Answer in one short sentence.",
 "role": "user",
 },
 ], stream=False)

 # Handle response
 print(res)

from mistralai import Mistral
import os

with Mistral(
 api_key=os.getenv("MISTRAL_API_KEY", ""),
) as mistral:

 res = mistral.chat.complete(model="mistral-small-latest", messages=[
 {
 "content": "Who is the best French painter? Answer in one short sentence.",
 "role": "user",
 },
 ], stream=False)

 # Handle response
 print(res)

curl https://api.mistral.ai/v1/chat/completions \
 -X POST \
 -H 'Authorization: Bearer YOUR_APIKEY_HERE' \
 -H 'Content-Type: application/json' \
 -d '{
 "messages": [
 {
 "content": "ipsum eiusmod"
 }
 ],
 "model": "mistral-large-latest"
}'

curl https://api.mistral.ai/v1/chat/completions \
 -X POST \
 -H 'Authorization: Bearer YOUR_APIKEY_HERE' \
 -H 'Content-Type: application/json' \
 -d '{
 "messages": [
 {
 "content": "ipsum eiusmod"
 }
 ],
 "model": "mistral-large-latest"
}'

200 (application/json)

200 (text/event-stream)

{
 "choices": [
 {
 "finish_reason": "stop",
 "index": "0",
 "message": {}
 }
 ],
 "created": "1702256327",
 "id": "cmpl-e5cc70bb28c444948073e77776eb30ef",
 "model": "mistral-small-latest",
 "object": "chat.completion",
 "usage": {}
}

{
 "choices": [
 {
 "finish_reason": "stop",
 "index": "0",
 "message": {}
 }
 ],
 "created": "1702256327",
 "id": "cmpl-e5cc70bb28c444948073e77776eb30ef",
 "model": "mistral-small-latest",
 "object": "chat.completion",
 "usage": {}
}

null

null

Fim

WHY MISTRAL

About usOur customersCareersContact us

EXPLORE

AI SolutionsPartnersResearch

DOCUMENTATION

DocumentationAmbassadorsCookbooks

BUILD

StudioMistral VibeMistral CodeMistral ComputeTry the API

LEGAL

Terms of servicePrivacy policyLegal noticePrivacy ChoicesBrand

COMMUNITY

Discord↗X↗Github↗LinkedIn↗Ambassadors

Mistral AI © 2026

Toggle theme
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/Mistral/migration-guides.txt</code></summary>

````text
Migration guides | Mistral Docs

Docs & API

Search docs

⌘K

Getting StartedModelsProductsDevelopersAdminAPI

Search docs

⌘K

Toggle themeReach outTry Studio 

Resources

SDKs

Cookbooks

Error glossary

Known limitations

Observability integrations

Deprecated features

Changelog

Migration guides

Community

Ambassadors

Developers

Resources

Migration guides

Migration guides

These guides cover the specific code changes needed to switch from another provider to the Mistral API. The Mistral Chat Completions API follows the same request structure as OpenAI, so most migrations involve changing the client import, base URL, and model name. Choose your source platform below to see the exact steps and a working code example.

From OpenAI

From self-hosted Llama

The Mistral API follows the same Chat Completions structure as the OpenAI API. For most applications, migration requires changing three things: the client import, the initialization call, and the model name.

Migrate from OpenAI

Copy section link
Migrate from OpenAI

Update the client

PythonTypeScript

Before (OpenAI):

from openai import OpenAI

client = OpenAI(api_key="sk-...")
response = client.chat.completions.create(
 model="gpt-4o",
 messages=[{"role": "user", "content": "Hello"}],
)

from openai import OpenAI

client = OpenAI(api_key="sk-...")
response = client.chat.completions.create(
 model="gpt-4o",
 messages=[{"role": "user", "content": "Hello"}],
)

After (Mistral):

from mistralai import Mistral

client = Mistral(api_key="your_mistral_api_key")
response = client.chat.complete(
 model="mistral-large-latest",
 messages=[{"role": "user", "content": "Hello"}],
)

from mistralai import Mistral

client = Mistral(api_key="your_mistral_api_key")
response = client.chat.complete(
 model="mistral-large-latest",
 messages=[{"role": "user", "content": "Hello"}],
)

Key differences

OpenAIMistral

Python clientopenai.OpenAImistralai.Mistral

Chat methodclient.chat.completions.createclient.chat.complete

Streaming methodclient.chat.completions.create(stream=True)client.chat.stream

Base URLhttps://api.openai.com/v1https://api.mistral.ai/v1

Model name mapping

OpenAI modelMistral equivalent

gpt-4omistral-large-latest

gpt-4o-minimistral-small-latest

text-embedding-3-smallmistral-embed

Use the OpenAI-compatible base URL

If your application uses an OpenAI-compatible client (LangChain, LlamaIndex, or any other third-party library), point it at the Mistral API by changing only the base URL and model name. No library swap required.

from openai import OpenAI

client = OpenAI(
 api_key="your_mistral_api_key",
 base_url="https://api.mistral.ai/v1",
)

response = client.chat.completions.create(
 model="mistral-large-latest",
 messages=[{"role": "user", "content": "Hello"}],
)

from openai import OpenAI

client = OpenAI(
 api_key="your_mistral_api_key",
 base_url="https://api.mistral.ai/v1",
)

response = client.chat.completions.create(
 model="mistral-large-latest",
 messages=[{"role": "user", "content": "Hello"}],
)

Migrate from self-hosted Llama

Copy section link
Migrate from self-hosted Llama

Tokenizer

Mistral models use a different tokenizer than Llama. If you compute token counts manually or handle raw tokenization, update your tooling.

Install the official Mistral tokenizer:

pip install mistral-common

pip install mistral-common

Use it to tokenize text:

from mistral_common.tokens.tokenizers.mistral import MistralTokenizer

tokenizer = MistralTokenizer.v3()
result = tokenizer.encode_chat_completion(
 messages=[{"role": "user", "content": "Hello, world!"}]
)
print(result.tokens)

from mistral_common.tokens.tokenizers.mistral import MistralTokenizer

tokenizer = MistralTokenizer.v3()
result = tokenizer.encode_chat_completion(
 messages=[{"role": "user", "content": "Hello, world!"}]
)
print(result.tokens)

Mistral models on Hugging Face are also compatible with the transformers library. Use apply_chat_template to handle formatting automatically.

Prompt format

warning

Mistral models don't use the [INST] / [/INST] prompt format from Llama 2. Passing raw Llama 2-formatted strings to Mistral models produces degraded output. Update your prompt templates before testing.

Use apply_chat_template to format prompts correctly:

from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-Instruct-v0.3")
messages = [{"role": "user", "content": "Hello"}]
formatted = tokenizer.apply_chat_template(messages, tokenize=False)

from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-Instruct-v0.3")
messages = [{"role": "user", "content": "Hello"}]
formatted = tokenizer.apply_chat_template(messages, tokenize=False)

Model selection

Self-hosted Llama modelMistral equivalent

Llama 3 8B InstructMistral 7B Instruct (open-weight)

Llama 3 70B InstructMixtral 8x22B Instruct (open-weight)

Any self-hostedAPI: mistral-large-latest (managed)

All Mistral open-weight models are available on Hugging Face under the Mistral license.

Migrate to Python SDK v2

Copy section link
Migrate to Python SDK v2

Version 2.0.0 of the Python SDK introduces a small number of breaking changes. All other APIs (chat, streaming, embeddings, agents, function calling, batch) are unchanged.

Update the package

SDK V1 corresponds to mistralai<2 and V2 to mistralai>=2. Run:

pip install "mistralai>=2"

pip install "mistralai>=2"

Update the import path

Before (V1):

from mistralai import Mistral

from mistralai import Mistral

After (V2):

from mistralai.client import Mistral

from mistralai.client import Mistral

Azure AI (if applicable)

Before (V1):

# pip install mistralai-azure>=1.0.0
from mistralai_azure import MistralAzure

client = MistralAzure(
 azure_endpoint=os.environ["AZUREAI_ENDPOINT"],
 azure_api_key=os.environ["AZUREAI_API_KEY"],
)

# pip install mistralai-azure>=1.0.0
from mistralai_azure import MistralAzure

client = MistralAzure(
 azure_endpoint=os.environ["AZUREAI_ENDPOINT"],
 azure_api_key=os.environ["AZUREAI_API_KEY"],
)

After (V2):

# pip install mistralai>=2.0.0
from mistralai.azure.client import MistralAzure

client = MistralAzure(
 server_url=os.environ["AZUREAI_ENDPOINT"],
 api_key=os.environ["AZUREAI_API_KEY"],
)

# pip install mistralai>=2.0.0
from mistralai.azure.client import MistralAzure

client = MistralAzure(
 server_url=os.environ["AZUREAI_ENDPOINT"],
 api_key=os.environ["AZUREAI_API_KEY"],
)

Google Cloud / Vertex AI (if applicable)

Before (V1):

# pip install mistralai[gcp]
from mistralai_gcp import MistralGoogleCloud

client = MistralGoogleCloud(
 region=os.environ["GOOGLE_CLOUD_REGION"],
 project_id=os.environ["GOOGLE_CLOUD_PROJECT_ID"],
)

# pip install mistralai[gcp]
from mistralai_gcp import MistralGoogleCloud

client = MistralGoogleCloud(
 region=os.environ["GOOGLE_CLOUD_REGION"],
 project_id=os.environ["GOOGLE_CLOUD_PROJECT_ID"],
)

After (V2):

# pip install mistralai>=2.0.0 (no separate package needed)
from mistralai.gcp.client import MistralGCP

# Auth is handled automatically via google.auth.default()
# Region defaults to "europe-west4"; override if needed:
# client = MistralGCP(region="us-central1", project_id="my-project")
client = MistralGCP()

# pip install mistralai>=2.0.0 (no separate package needed)
from mistralai.gcp.client import MistralGCP

# Auth is handled automatically via google.auth.default()
# Region defaults to "europe-west4"; override if needed:
# client = MistralGCP(region="us-central1", project_id="my-project")
client = MistralGCP()

Summary

AreaV1V2

Packagemistralai<2mistralai>=2

Core importfrom mistralai import Mistralfrom mistralai.client import Mistral

Azure importfrom mistralai_azure import MistralAzurefrom mistralai.azure.client import MistralAzure

Azure constructorazure_endpoint=, azure_api_key=server_url=, api_key=

GCP importfrom mistralai_gcp import MistralGoogleCloudfrom mistralai.gcp.client import MistralGCP

GCP authGOOGLE_CLOUD_REGION + GOOGLE_CLOUD_PROJECT_ID env varsautomatic via google.auth.default()

All other APIs—unchanged

Common questions

Copy section link
Common questions

Will my streaming implementation work without changes?

Does Mistral support the OpenAI function calling format?

What about system prompt behavior?

Contents

Migrate from OpenAI

Migrate from self-hosted Llama

Migrate to Python SDK v2

Common questions

Go to Top

WHY MISTRAL

About usOur customersCareersContact us

EXPLORE

AI SolutionsPartnersResearch

DOCUMENTATION

DocumentationAmbassadorsCookbooks

BUILD

StudioMistral VibeMistral CodeMistral ComputeTry the API

LEGAL

Terms of servicePrivacy policyLegal noticePrivacy ChoicesBrand

COMMUNITY

Discord↗X↗Github↗LinkedIn↗Ambassadors

Mistral AI © 2026

Toggle theme

ChangelogStudio
````

</details>
