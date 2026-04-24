# API-FireworksAI.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## Provider

- Hermes Provider-ID: `fireworks`
- Anzeige: Fireworks AI
- Typ: OpenAI-kompatibel
- Base URL: `https://api.fireworks.ai/inference/v1 bzw. base https://api.fireworks.ai/inference`
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

Nur als inferBaseURL in code-proxy sichtbar.

## ForgeFrame-Adapterhinweise

- Felder: `provider_id`, `base_url`, `api_key_env_vars`, `auth_type`, `model_normalization`, `api_mode`.
- Fuer Aggregatoren (`openrouter`, `nous`, `ai-gateway`, `kilocode`) Vendor-Slugs erhalten oder automatisch ergaenzen.
- Fuer native Provider wie Anthropic, Copilot, DeepSeek oder OpenCode Sonderregeln aus `model_normalize.py` beachten.
- Streaming als SSE `data:` implementieren, Non-Streaming als OpenAI-Response normalisieren.

---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/FireworksAI`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – FireworksAI

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### OpenAI compatibility - Fireworks AI Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.fireworks.ai/tools-sdks/openai-compatibility
- Bereinigte Download-URL: https://docs.fireworks.ai/tools-sdks/openai-compatibility
- Lokale Datei(en): HTML: `openai-compatibility.html`, Text: `openai-compatibility.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Fireworks AI OpenAI compatibility
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://docs.fireworks.ai/tools-sdks/openai-compatibility`
- `https://api.fireworks.ai/inference/v1`
- `https://api.fireworks.ai/inference/v1/completions`

### Erkannte Endpunkte / Pfade

- `https://api.fireworks.ai/inference/v1"`
- `https://api.fireworks.ai/inference/v1")`
- `/fireworks/models/llama-v3p1-8b-instruct`
- `https://api.fireworks.ai/inference/v1/completions`
- `/fireworks/models/starcoder-16b-w8a16`

### Erkannte Umgebungsvariablen / Konstanten

- `YOUR_FIREWORKS_API_KEY`
- `OPENAI_API_BASE`
- `OPENAI_API_KEY`
- `POST`
- `API_KEY`
- `DONE`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### OpenAI compatibility - Fireworks AI Docs
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.fireworks.ai/tools-sdks/openai-compatibility
- Bereinigte Download-URL: https://docs.fireworks.ai/tools-sdks/openai-compatibility

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.fireworks.ai/tools-sdks/openai-compatibility
- Bereinigte Download-URL: https://docs.fireworks.ai/tools-sdks/openai-compatibility
- Lokale Datei(en): HTML: `openai-compatibility.html`, Text: `openai-compatibility.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.fireworks.ai/tools-sdks/openai-compatibility
- Lokale Datei(en): HTML: `openai-compatibility.html`, Text: `openai-compatibility.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Fireworks AI OpenAI compatibility
- Download-Werkzeug: `urllib`

---

**Quelle `openai-compatibility.txt`**

OpenAI compatibility - Fireworks AI Docs

---

**Quelle `openai-compatibility.txt`**

API & SDK Reference

---

**Quelle `openai-compatibility.txt`**

OpenAI compatibility

---

**Quelle `openai-compatibility.txt`**

Billing & Pricing

---

**Quelle `openai-compatibility.txt`**

Models & Inference

---

**Quelle `openai-compatibility.txt`**

Specify endpoint and API key

---

**Quelle `openai-compatibility.txt`**

Using the OpenAI client

---

**Quelle `openai-compatibility.txt`**

Using environment variables

---

**Quelle `openai-compatibility.txt`**

Usage

---

**Quelle `openai-compatibility.txt`**

Token usage for streaming responses

---

**Quelle `openai-compatibility.txt`**

You can use the OpenAI Python client library to interact with Fireworks. This makes migration of existing applications already using OpenAI particularly easy.
For Anthropic SDK support, see Anthropic compatibility.

---

**Quelle `openai-compatibility.txt`**

You can use the OpenAI client by initializing it with your Fireworks configuration:

---

**Quelle `openai-compatibility.txt`**

from openai import OpenAI

---

**Quelle `openai-compatibility.txt`**

# Initialize with Fireworks parameters
client = OpenAI(
 base_url="https://api.fireworks.ai/inference/v1",

---

**Quelle `openai-compatibility.txt`**

client = OpenAI(
 base_url="https://api.fireworks.ai/inference/v1",
 api_key="<YOUR_FIREWORKS_API_KEY>",

---

**Quelle `openai-compatibility.txt`**

You can also use environment variables with the client:

---

**Quelle `openai-compatibility.txt`**

import os
from openai import OpenAI

---

**Quelle `openai-compatibility.txt`**

# Initialize using environment variables
client = OpenAI(

---

**Quelle `openai-compatibility.txt`**

# Initialize using environment variables
client = OpenAI(
 base_url=os.environ.get("OPENAI_API_BASE", "https://api.fireworks.ai/inference/v1"),

---

**Quelle `openai-compatibility.txt`**

client = OpenAI(
 base_url=os.environ.get("OPENAI_API_BASE", "https://api.fireworks.ai/inference/v1"),
 api_key=os.environ.get("OPENAI_API_KEY"), # Set to your Fireworks API key

---

**Quelle `openai-compatibility.txt`**

base_url=os.environ.get("OPENAI_API_BASE", "https://api.fireworks.ai/inference/v1"),
 api_key=os.environ.get("OPENAI_API_KEY"), # Set to your Fireworks API key
)

---

**Quelle `openai-compatibility.txt`**

export OPENAI_API_BASE="https://api.fireworks.ai/inference/v1"
export OPENAI_API_KEY="<YOUR_FIREWORKS_API_KEY>"

---

**Quelle `openai-compatibility.txt`**

import openai

---

**Quelle `openai-compatibility.txt`**

# warning: it has a process-wide effect
openai.api_base = "https://api.fireworks.ai/inference/v1"
openai.api_key = "<YOUR_FIREWORKS_API_KEY>"

---

**Quelle `openai-compatibility.txt`**

openai.api_base = "https://api.fireworks.ai/inference/v1"
openai.api_key = "<YOUR_FIREWORKS_API_KEY>"

---

**Quelle `openai-compatibility.txt`**

Use OpenAI’s SDK how you’d normally would. Just ensure that the model parameter refers to one of Fireworks models.

---

**Quelle `openai-compatibility.txt`**

client = OpenAI(
 base_url="https://api.fireworks.ai/inference/v1",

---

**Quelle `openai-compatibility.txt`**

completion = client.completions.create(
 model="accounts/fireworks/models/llama-v3p1-8b-instruct",

---

**Quelle `openai-compatibility.txt`**

completion = client.completions.create(
 model="accounts/fireworks/models/llama-v3p1-8b-instruct",
 prompt="The quick brown fox",

---

**Quelle `openai-compatibility.txt`**

Works best for models fine-tuned for conversation (e.g. llama*-chat variants):

---

**Quelle `openai-compatibility.txt`**

chat_completion = client.chat.completions.create(
 model="accounts/fireworks/models/llama-v3p1-8b-instruct",

---

**Quelle `openai-compatibility.txt`**

chat_completion = client.chat.completions.create(
 model="accounts/fireworks/models/llama-v3p1-8b-instruct",
 messages=[

---

**Quelle `openai-compatibility.txt`**

max_tokens: behaves differently if the model context length is exceeded. If the length of prompt or messages plus max_tokens is higher than the model’s context window, max_tokens will be adjusted lower accordingly. OpenAI returns an invalid request error in this situation. Control this behavior with the context_length_exceeded_behavior parameter:

---

**Quelle `openai-compatibility.txt`**

truncate (default): Automatically adjusts max_tokens to fit within the context window

---

**Quelle `openai-compatibility.txt`**

error: Returns an error like OpenAI does

---

**Quelle `openai-compatibility.txt`**

OpenAI API returns usage stats (number of tokens in prompt and completion) for non-streaming responses but doesn’t for the streaming ones (see forum post).
Fireworks API returns usage stats in both cases. For streaming responses, the usage field is returned in the very last chunk on the response (i.e. the one having finish_reason set). For example:

---

**Quelle `openai-compatibility.txt`**

cURL

---

**Quelle `openai-compatibility.txt`**

curl --request POST \
 --url https://api.fireworks.ai/inference/v1/completions \

---

**Quelle `openai-compatibility.txt`**

curl --request POST \
 --url https://api.fireworks.ai/inference/v1/completions \
 --header "accept: application/json" \

---

**Quelle `openai-compatibility.txt`**

--url https://api.fireworks.ai/inference/v1/completions \
 --header "accept: application/json" \
 --header "authorization: Bearer $API_KEY" \

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `openai-compatibility.txt`**

````text
base_url="https://api.fireworks.ai/inference/v1",
````

---

**Quelle `openai-compatibility.txt`**

````text
api_key="<YOUR_FIREWORKS_API_KEY>",
````

---

**Quelle `openai-compatibility.txt`**

````text
base_url=os.environ.get("OPENAI_API_BASE", "https://api.fireworks.ai/inference/v1"),
````

---

**Quelle `openai-compatibility.txt`**

````text
api_key=os.environ.get("OPENAI_API_KEY"), # Set to your Fireworks API key
````

---

**Quelle `openai-compatibility.txt`**

````text
export OPENAI_API_BASE="https://api.fireworks.ai/inference/v1"
````

---

**Quelle `openai-compatibility.txt`**

````text
export OPENAI_API_KEY="<YOUR_FIREWORKS_API_KEY>"
````

---

**Quelle `openai-compatibility.txt`**

````text
openai.api_key = "<YOUR_FIREWORKS_API_KEY>"
````

---

**Quelle `openai-compatibility.txt`**

````text
curl --request POST \
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/FireworksAI/openai-compatibility.txt</code></summary>

````text
OpenAI compatibility - Fireworks AI Docs

Skip to main content

Fireworks AI Docs home page

Documentation

API & SDK Reference

CLI Reference

Demos

Changelog

Resources

Community

Status

Dashboard

Dashboard

Search...

Navigation

Reference

OpenAI compatibility

Search...

⌘K

Reference

Concepts

OpenAI compatibility

Anthropic compatibility

Examples

Courses

Cookbooks

FAQ

Account & Access

Billing & Pricing

Deployment & Infrastructure

Models & Inference

On this page

Specify endpoint and API key

Using the OpenAI client

Using environment variables

Alternative approach

Usage

Completion

Chat Completion

API compatibility

Differences

Token usage for streaming responses

Reference

OpenAI compatibility

Copy page

Copy page

You can use the OpenAI Python client library to interact with Fireworks. This makes migration of existing applications already using OpenAI particularly easy.
For Anthropic SDK support, see Anthropic compatibility.

​

Specify endpoint and API key

​

Using the OpenAI client

You can use the OpenAI client by initializing it with your Fireworks configuration:

from openai import OpenAI

# Initialize with Fireworks parameters
client = OpenAI(
 base_url="https://api.fireworks.ai/inference/v1",
 api_key="<YOUR_FIREWORKS_API_KEY>",
)

You can also use environment variables with the client:

import os
from openai import OpenAI

# Initialize using environment variables
client = OpenAI(
 base_url=os.environ.get("OPENAI_API_BASE", "https://api.fireworks.ai/inference/v1"),
 api_key=os.environ.get("OPENAI_API_KEY"), # Set to your Fireworks API key
)

​

Using environment variables

export OPENAI_API_BASE="https://api.fireworks.ai/inference/v1"
export OPENAI_API_KEY="<YOUR_FIREWORKS_API_KEY>"

​

Alternative approach

import openai

# warning: it has a process-wide effect
openai.api_base = "https://api.fireworks.ai/inference/v1"
openai.api_key = "<YOUR_FIREWORKS_API_KEY>"

​

Usage

Use OpenAI’s SDK how you’d normally would. Just ensure that the model parameter refers to one of Fireworks models.

​

Completion

Simple completion API that doesn’t modify provided prompt in any way:

from openai import OpenAI

client = OpenAI(
 base_url="https://api.fireworks.ai/inference/v1",
 api_key="<YOUR_FIREWORKS_API_KEY>",
)

completion = client.completions.create(
 model="accounts/fireworks/models/llama-v3p1-8b-instruct",
 prompt="The quick brown fox",
)
print(completion.choices[0].text)

​

Chat Completion

Works best for models fine-tuned for conversation (e.g. llama*-chat variants):

from openai import OpenAI

client = OpenAI(
 base_url="https://api.fireworks.ai/inference/v1",
 api_key="<YOUR_FIREWORKS_API_KEY>",
)

chat_completion = client.chat.completions.create(
 model="accounts/fireworks/models/llama-v3p1-8b-instruct",
 messages=[
 {
 "role": "system",
 "content": "You are a helpful assistant.",
 },
 {
 "role": "user",
 "content": "Say this is a test",
 },
 ],
)
print(chat_completion.choices[0].message.content)

​

API compatibility

​

Differences

The following options have minor differences:

max_tokens: behaves differently if the model context length is exceeded. If the length of prompt or messages plus max_tokens is higher than the model’s context window, max_tokens will be adjusted lower accordingly. OpenAI returns an invalid request error in this situation. Control this behavior with the context_length_exceeded_behavior parameter:

truncate (default): Automatically adjusts max_tokens to fit within the context window

error: Returns an error like OpenAI does

​

Token usage for streaming responses

OpenAI API returns usage stats (number of tokens in prompt and completion) for non-streaming responses but doesn’t for the streaming ones (see forum post).
Fireworks API returns usage stats in both cases. For streaming responses, the usage field is returned in the very last chunk on the response (i.e. the one having finish_reason set). For example:

cURL

curl --request POST \
 --url https://api.fireworks.ai/inference/v1/completions \
 --header "accept: application/json" \
 --header "authorization: Bearer $API_KEY" \
 --header "content-type: application/json" \
 --data '{"model": "accounts/fireworks/models/starcoder-16b-w8a16", "prompt": "def say_hello_world():", "max_tokens": 100, "stream": true}'

data: {..., "choices":[{"text":"\n print('Hello,","index":0,"finish_reason":null,"logprobs":null}],"usage":null}

data: {..., "choices":[{"text":" World!')\n\n\n","index":0,"finish_reason":null,"logprobs":null}],"usage":null}

data: {..., "choices":[{"text":"say_hello_","index":0,"finish_reason":null,"logprobs":null}],"usage":null}

data: {..., "choices":[{"text":"world()\n","index":0,"finish_reason":"stop","logprobs":null}],"usage":{"prompt_tokens":7,"total_tokens":24,"completion_tokens":17}}

data: [DONE]

Note, that if you’re using OpenAI SDK, they usage field won’t be listed in the SDK’s structure definition. But it can be accessed directly. For example:

Python

TypeScript

for chunk in client.chat.completions.create(stream=True, ...):
 if chunk.usage: # Available in final chunk
 print(f"Tokens: {chunk.usage.total_tokens}")

Was this page helpful?

YesNo

Concepts

Previous

Anthropic compatibility

Next

⌘I

Fireworks AI Docs home page
xdiscordgithubyoutubelinkedin

Legal
Terms of ServicePrivacy PolicyLicensesTrust

Contact Us
Inquiry Form

Resources
BlogCookbookPricing

xdiscordgithubyoutubelinkedin

Powered byThis documentation is built and hosted on Mintlify, a developer documentation platform

Assistant

Responses are generated using AI and may contain mistakes.
````

</details>
