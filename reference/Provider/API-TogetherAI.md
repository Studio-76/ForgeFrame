# API-TogetherAI.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## Provider

- Hermes Provider-ID: `together`
- Anzeige: Together AI
- Typ: OpenAI-kompatibel
- Base URL: `https://api.together.xyz/v1 bzw. base https://api.together.xyz`
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

code-proxy generisch; Modelle z.B. `together/meta-llama/Llama-3.3-70B-Instruct-Turbo`.

## ForgeFrame-Adapterhinweise

- Felder: `provider_id`, `base_url`, `api_key_env_vars`, `auth_type`, `model_normalization`, `api_mode`.
- Fuer Aggregatoren (`openrouter`, `nous`, `ai-gateway`, `kilocode`) Vendor-Slugs erhalten oder automatisch ergaenzen.
- Fuer native Provider wie Anthropic, Copilot, DeepSeek oder OpenCode Sonderregeln aus `model_normalize.py` beachten.
- Streaming als SSE `data:` implementieren, Non-Streaming als OpenAI-Response normalisieren.

---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/TogetherAI`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – TogetherAI

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### OpenAI Compatibility - Together AI Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.together.ai/docs/openai-api-compatibility
- Bereinigte Download-URL: https://docs.together.ai/docs/openai-api-compatibility
- Lokale Datei(en): HTML: `openai-api-compatibility.html`, Text: `openai-api-compatibility.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Together AI OpenAI compatibility
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://docs.together.ai/docs/openai-api-compatibility`
- `https://api.together.xyz/v1:`
- `https://api.together.xyz/v1`
- `https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg`

### Erkannte Endpunkte / Pfade

- `https://api.together.xyz/v1:`
- `https://api.together.xyz/v1"`

### Erkannte Umgebungsvariablen / Konstanten

- `GETTING`
- `STARTED`
- `INFERENCE`
- `TRAINING`
- `CAPABILITIES`
- `OTHER`
- `APIS`
- `TOGETHER_API_KEY`
- `A17B`
- `FLUX`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### OpenAI Compatibility - Together AI Docs
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.together.ai/docs/openai-api-compatibility
- Bereinigte Download-URL: https://docs.together.ai/docs/openai-api-compatibility

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.together.ai/docs/openai-api-compatibility
- Bereinigte Download-URL: https://docs.together.ai/docs/openai-api-compatibility
- Lokale Datei(en): HTML: `openai-api-compatibility.html`, Text: `openai-api-compatibility.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.together.ai/docs/openai-api-compatibility
- Lokale Datei(en): HTML: `openai-api-compatibility.html`, Text: `openai-api-compatibility.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Together AI OpenAI compatibility
- Download-Werkzeug: `urllib`

---

**Quelle `openai-api-compatibility.txt`**

OpenAI Compatibility - Together AI Docs

---

**Quelle `openai-api-compatibility.txt`**

OpenAI Compatibility

---

**Quelle `openai-api-compatibility.txt`**

Recommended Models

---

**Quelle `openai-api-compatibility.txt`**

Serverless Models

---

**Quelle `openai-api-compatibility.txt`**

Function Calling

---

**Quelle `openai-api-compatibility.txt`**

Vision LLMs

---

**Quelle `openai-api-compatibility.txt`**

Configuring OpenAI to use Together’s API

---

**Quelle `openai-api-compatibility.txt`**

Streaming a response

---

**Quelle `openai-api-compatibility.txt`**

Using Vision Models

---

**Quelle `openai-api-compatibility.txt`**

Generating vector embeddings

---

**Quelle `openai-api-compatibility.txt`**

Together’s API is compatible with OpenAI’s libraries, making it easy to try out our open-source models on existing applications.

---

**Quelle `openai-api-compatibility.txt`**

Together’s API endpoints for chat, vision, images, embeddings, speech are fully compatible with OpenAI’s API.
If you have an application that uses one of OpenAI’s client libraries, you can easily configure it to point to Together’s API servers, and start running your existing applications using our open-source models.

---

**Quelle `openai-api-compatibility.txt`**

To start using Together with OpenAI’s client libraries, pass in your Together API key to the api_key option, and change the base_url to https://api.together.xyz/v1:

---

**Quelle `openai-api-compatibility.txt`**

import os
import openai

---

**Quelle `openai-api-compatibility.txt`**

client = openai.OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),

---

**Quelle `openai-api-compatibility.txt`**

api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

---

**Quelle `openai-api-compatibility.txt`**

You can find your API key in your settings page. If you don’t have an account, you can register for free.

---

**Quelle `openai-api-compatibility.txt`**

Now that your OpenAI client is configured to point to Together, you can start using one of our open-source models for your inference queries.
For example, you can query one of our chat models, like Llama 3.1 8B:

---

**Quelle `openai-api-compatibility.txt`**

response = client.chat.completions.create(
 model="openai/gpt-oss-20b",

---

**Quelle `openai-api-compatibility.txt`**

response = client.chat.completions.create(
 model="openai/gpt-oss-20b",
 messages=[

---

**Quelle `openai-api-compatibility.txt`**

You can also use OpenAI’s streaming capabilities to stream back your response:

---

**Quelle `openai-api-compatibility.txt`**

stream = client.chat.completions.create(
 model="Qwen/Qwen3.5-397B-A17B",

---

**Quelle `openai-api-compatibility.txt`**

],
 stream=True,
)

---

**Quelle `openai-api-compatibility.txt`**

for chunk in stream:
 print(chunk.choices[0].delta.content or "", end="", flush=True)

---

**Quelle `openai-api-compatibility.txt`**

response = client.chat.completions.create(
 model="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",

---

**Quelle `openai-api-compatibility.txt`**

"image_url": {
 "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
 },

---

**Quelle `openai-api-compatibility.txt`**

* It stretches out into the distance, disappearing into the horizon.
 * The boardwalk is flanked by tall grasses and reeds that reach up to the knees.
* **Field:**

---

**Quelle `openai-api-compatibility.txt`**

* **Field:**
 * The field is filled with tall, green grasses and reeds that sway gently in the breeze.
 * The grasses are so tall that they almost obscure the boardwalk, creating a sense of mystery and adventure.

---

**Quelle `openai-api-compatibility.txt`**

* The field is filled with tall, green grasses and reeds that sway gently in the breeze.
 * The grasses are so tall that they almost obscure the boardwalk, creating a sense of mystery and adventure.
 * In the distance, trees and bushes can be seen, adding depth and texture to the scene.

---

**Quelle `openai-api-compatibility.txt`**

from openai import OpenAI
import os

---

**Quelle `openai-api-compatibility.txt`**

client = OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),

---

**Quelle `openai-api-compatibility.txt`**

prompt = """
A children's book drawing of a veterinarian using a stethoscope to 
listen to the heartbeat of a baby otter.

---

**Quelle `openai-api-compatibility.txt`**

response.stream_to_file(speech_file_path)

---

**Quelle `openai-api-compatibility.txt`**

Use our embedding models to generate an embedding for some text input:

---

**Quelle `openai-api-compatibility.txt`**

response = client.embeddings.create(
 model="intfloat/multilingual-e5-large-instruct",

---

**Quelle `openai-api-compatibility.txt`**

print(response.data[0].embedding)

---

**Quelle `openai-api-compatibility.txt`**

from pydantic import BaseModel
from openai import OpenAI
import os, json

---

**Quelle `openai-api-compatibility.txt`**

completion = client.chat.completions.create(
 model="openai/gpt-oss-20b",

---

**Quelle `openai-api-compatibility.txt`**

completion = client.chat.completions.create(
 model="openai/gpt-oss-20b",
 messages=[

---

**Quelle `openai-api-compatibility.txt`**

from openai import OpenAI
import os, json

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `openai-api-compatibility.txt`**

````text
To start using Together with OpenAI’s client libraries, pass in your Together API key to the api_key option, and change the base_url to https://api.together.xyz/v1:
````

---

**Quelle `openai-api-compatibility.txt`**

````text
api_key=os.environ.get("TOGETHER_API_KEY"),
````

---

**Quelle `openai-api-compatibility.txt`**

````text
base_url="https://api.together.xyz/v1",
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/TogetherAI/openai-api-compatibility.txt</code></summary>

````text
OpenAI Compatibility - Together AI Docs

Skip to main content

Together AI Docs home page

Documentation

API Reference

Demos

Changelog

Guides

FAQ

Search...

Navigation

GETTING STARTED

OpenAI Compatibility

Search...

⌘K

GETTING STARTED

Overview

Quickstart

OpenAI Compatibility

Recommended Models

Skills and MCP

INFERENCE

Serverless Models

Dedicated Inference

Dedicated Containers

Model Quickstarts

TRAINING

Fine-tuning

GPU Clusters

CAPABILITIES

Chat

Structured Outputs

Function Calling

Reasoning

Image Generation

Video Generation

Vision LLMs

Voice

Other Modalities

Integrations

OTHER APIS

Batch

Evaluations

Code Execution

On this page

Configuring OpenAI to use Together’s API

Querying a chat model

Streaming a response

Using Vision Models

Image Generation

Text-to-Speech

Generating vector embeddings

Structured Outputs

Function Calling

Community libraries

GETTING STARTED

OpenAI Compatibility

Copy page

Together’s API is compatible with OpenAI’s libraries, making it easy to try out our open-source models on existing applications.

Copy page

Together’s API endpoints for chat, vision, images, embeddings, speech are fully compatible with OpenAI’s API.
If you have an application that uses one of OpenAI’s client libraries, you can easily configure it to point to Together’s API servers, and start running your existing applications using our open-source models.

​

Configuring OpenAI to use Together’s API

To start using Together with OpenAI’s client libraries, pass in your Together API key to the api_key option, and change the base_url to https://api.together.xyz/v1:

Python

TypeScript

import os
import openai

client = openai.OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

You can find your API key in your settings page. If you don’t have an account, you can register for free.

​

Querying a chat model

Now that your OpenAI client is configured to point to Together, you can start using one of our open-source models for your inference queries.
For example, you can query one of our chat models, like Llama 3.1 8B:

Python

TypeScript

import os
import openai

client = openai.OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

response = client.chat.completions.create(
 model="openai/gpt-oss-20b",
 messages=[
 {
 "role": "system",
 "content": "You are a travel agent. Be descriptive and helpful.",
 },
 {
 "role": "user",
 "content": "Tell me the top 3 things to do in San Francisco",
 },
 ],
)

print(response.choices[0].message.content)

​

Streaming a response

You can also use OpenAI’s streaming capabilities to stream back your response:

Python

TypeScript

import os
import openai

client = openai.OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

stream = client.chat.completions.create(
 model="Qwen/Qwen3.5-397B-A17B",
 messages=[
 {
 "role": "system",
 "content": "You are a travel agent. Be descriptive and helpful.",
 },
 {"role": "user", "content": "Tell me about San Francisco"},
 ],
 stream=True,
)

for chunk in stream:
 print(chunk.choices[0].delta.content or "", end="", flush=True)

​

Using Vision Models

Python

TypeScript

import os
import openai

client = openai.OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

response = client.chat.completions.create(
 model="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
 messages=[
 {
 "role": "user",
 "content": [
 {"type": "text", "text": "What's in this image?"},
 {
 "type": "image_url",
 "image_url": {
 "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
 },
 },
 ],
 }
 ],
)

print(response.choices[0].message.content)

Output:

Text

The image depicts a serene and idyllic scene of a wooden boardwalk winding through a lush, green field on a sunny day.

* **Sky:**
 * The sky is a brilliant blue with wispy white clouds scattered across it.
 * The clouds are thin and feathery, adding to the overall sense of tranquility.
* **Boardwalk:**
 * The boardwalk is made of weathered wooden planks, worn smooth by time and use.
 * It stretches out into the distance, disappearing into the horizon.
 * The boardwalk is flanked by tall grasses and reeds that reach up to the knees.
* **Field:**
 * The field is filled with tall, green grasses and reeds that sway gently in the breeze.
 * The grasses are so tall that they almost obscure the boardwalk, creating a sense of mystery and adventure.
 * In the distance, trees and bushes can be seen, adding depth and texture to the scene.
* **Atmosphere:**
 * The overall atmosphere is one of peace and serenity, inviting the viewer to step into the tranquil world depicted in the image.
 * The warm sunlight and gentle breeze create a sense of comfort and relaxation.

In summary, the image presents a picturesque scene of a wooden boardwalk meandering through a lush, green field on a sunny day, evoking feelings of peace and serenity.

​

Image Generation

Python

TypeScript

from openai import OpenAI
import os

client = OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

prompt = """
A children's book drawing of a veterinarian using a stethoscope to 
listen to the heartbeat of a baby otter.
"""

result = client.images.generate(
 model="black-forest-labs/FLUX.2-dev", prompt=prompt
)

print(result.data[0].url)

Output:

​

Text-to-Speech

Python

TypeScript

from openai import OpenAI
import os

client = OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

speech_file_path = "speech.mp3"

response = client.audio.speech.create(
 model="hexgrad/Kokoro-82M",
 input="Today is a wonderful day to build something people love!",
 voice="helpful woman",
)

response.stream_to_file(speech_file_path)

Output:

​

Generating vector embeddings

Use our embedding models to generate an embedding for some text input:

Python

TypeScript

import os
import openai

client = openai.OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

response = client.embeddings.create(
 model="intfloat/multilingual-e5-large-instruct",
 input="Our solar system orbits the Milky Way galaxy at about 515,000 mph",
)

print(response.data[0].embedding)

Output

Text

[0.2633975, 0.13856211, 0.14047204,... ]

​

Structured Outputs

Python

from pydantic import BaseModel
from openai import OpenAI
import os, json

client = OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

class CalendarEvent(BaseModel):
 name: str
 date: str
 participants: list[str]

completion = client.chat.completions.create(
 model="openai/gpt-oss-20b",
 messages=[
 {"role": "system", "content": "Extract the event information."},
 {
 "role": "user",
 "content": "Alice and Bob are going to a science fair on Friday. Answer in JSON",
 },
 ],
 response_format={
 "type": "json_schema",
 "json_schema": {
 "name": "calendar_event",
 "schema": CalendarEvent.model_json_schema(),
 },
 },
)

output = json.loads(completion.choices[0].message.content)
print(json.dumps(output, indent=2))

Output:

Text

{
 "name": "Alice and Bob",
 "date": "Friday",
 "participants": [
 "Alice",
 "Bob"
 ]
}

​

Function Calling

Python

TypeScript

from openai import OpenAI
import os, json

client = OpenAI(
 api_key=os.environ.get("TOGETHER_API_KEY"),
 base_url="https://api.together.xyz/v1",
)

tools = [
 {
 "type": "function",
 "function": {
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
 }
]

completion = client.chat.completions.create(
 model="zai-org/GLM-5",
 messages=[
 {"role": "user", "content": "What is the weather like in Paris today?"}
 ],
 tools=tools,
 tool_choice="auto",
)

print(
 json.dumps(
 completion.choices[0].message.model_dump()["tool_calls"], indent=2
 )
)

Output:

Text

[
 {
 "id": "call_nu2ifnvqz083p5kngs3a3aqz",
 "function": {
 "arguments": "{\"location\":\"Paris, France\"}",
 "name": "get_weather"
 },
 "type": "function",
 "index": 0
 }
]

​

Community libraries

The Together API is also supported by most OpenAI libraries built by the community.
Feel free to reach out to support if you come across some unexpected behavior when using our API.

Was this page helpful?

YesNo

Quickstart

Previous

Recommended Models

Next

⌘I

Together AI Docs home page

Company
About usCareers

Resources
CookbooksExample apps

Legal
Cookie PolicyConsent Preferences

Powered byThis documentation is built and hosted on Mintlify, a developer documentation platform

Assistant

Responses are generated using AI and may contain mistakes.
````

</details>
