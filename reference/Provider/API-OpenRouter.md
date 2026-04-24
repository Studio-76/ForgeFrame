# API-OpenRouter.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## Provider

- Hermes Provider-ID: `openrouter`
- Anzeige: OpenRouter
- Typ: Aggregator/OpenAI-kompatibel
- Base URL: `Konstante aus `hermes_constants.OPENROUTER_BASE_URL` bzw. config`
- Auth: API key

## Grundschema

Soweit der Provider OpenAI-kompatibel ist:

```http
POST <base_url>/chat/completions
Authorization: Bearer <token>
Content-Type: application/json
```

Wenn die Base URL bereits auf `/v1` endet, wird direkt `/chat/completions` angehaengt. Im code-proxy-Generic-Provider wird dagegen intern immer `<baseURL>/v1/chat/completions` gebaut; dort muss `baseURL` entsprechend ohne `/v1` gesetzt sein.

## Modellformat

Modelle werden als vendor/model Slugs genutzt, z.B. `anthropic/claude-sonnet-4.6`, `openai/gpt-5.4`.

## ForgeFrame-Adapterhinweise

- Felder: `provider_id`, `base_url`, `api_key_env_vars`, `auth_type`, `model_normalization`, `api_mode`.
- Fuer Aggregatoren (`openrouter`, `nous`, `ai-gateway`, `kilocode`) Vendor-Slugs erhalten oder automatisch ergaenzen.
- Fuer native Provider wie Anthropic, Copilot, DeepSeek oder OpenCode Sonderregeln aus `model_normalize.py` beachten.
- Streaming als SSE `data:` implementieren, Non-Streaming als OpenAI-Response normalisieren.

---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/OpenRouter`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – OpenRouter

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### OpenRouter API Reference | Complete API Documentation | OpenRouter | Documentation
- Quelle: Pflichtquelle
- Original-URL: https://openrouter.ai/docs/api-reference/overview
- Bereinigte Download-URL: https://openrouter.ai/docs/api-reference/overview
- Effektive End-URL: https://openrouter.ai/docs/api/reference/overview
- Lokale Datei(en): HTML: `api-reference-overview.html`, Text: `api-reference-overview.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenRouter API overview
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### OpenAI SDK Integration | OpenRouter SDK Support | OpenRouter | Documentation
- Quelle: Pflichtquelle
- Original-URL: https://openrouter.ai/docs/guides/community/openai-sdk
- Bereinigte Download-URL: https://openrouter.ai/docs/guides/community/openai-sdk
- Lokale Datei(en): HTML: `openai-sdk.html`, Text: `openai-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenRouter OpenAI SDK
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://openrouter.ai/docs/api-reference/overview`
- `https://openrouter.ai/docs/api/reference/overview`
- `https://openrouter.ai/docs/guides/community/openai-sdk`
- `https://openrouter.ai/openapi.yaml`
- `https://openrouter.ai/openapi.json`
- `https://platform.openai.com/docs/guides/latency-optimization#use-predicted-outputs`
- `https://openrouter.ai/api/v1/chat/completions`
- `https://openrouter.ai/api/v1/generation?id=$GENERATION_ID`
- `https://openrouter.ai/api/v1`

### Erkannte Endpunkte / Pfade

- `/api/v1/chat/completions`
- `/models?supported_parameters=tools`
- `https://openrouter.ai/api/v1/chat/completions'`
- `/api/v1/generation`
- `https://openrouter.ai/api/v1/generation?id=$GENERATION_ID'`
- `https://openrouter.ai/api/v1"`

### Erkannte Umgebungsvariablen / Konstanten

- `YAML`
- `POST`
- `OPENROUTER_API_KEY`
- `YOUR_SITE_URL`
- `YOUR_SITE_NAME`
- `DONE`
- `BYOK`
- `GENERATION_ID`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://openrouter.ai/docs/api-reference/overview
- Bereinigte Download-URL: https://openrouter.ai/docs/api-reference/overview

---

**Quelle `INDEX.md`**

- Original-URL: https://openrouter.ai/docs/api-reference/overview
- Bereinigte Download-URL: https://openrouter.ai/docs/api-reference/overview
- Effektive End-URL: https://openrouter.ai/docs/api/reference/overview

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://openrouter.ai/docs/api-reference/overview
- Effektive End-URL: https://openrouter.ai/docs/api/reference/overview
- Lokale Datei(en): HTML: `api-reference-overview.html`, Text: `api-reference-overview.txt`

---

**Quelle `INDEX.md`**

### OpenAI SDK Integration | OpenRouter SDK Support | OpenRouter | Documentation
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://openrouter.ai/docs/guides/community/openai-sdk
- Bereinigte Download-URL: https://openrouter.ai/docs/guides/community/openai-sdk

---

**Quelle `INDEX.md`**

- Original-URL: https://openrouter.ai/docs/guides/community/openai-sdk
- Bereinigte Download-URL: https://openrouter.ai/docs/guides/community/openai-sdk
- Lokale Datei(en): HTML: `openai-sdk.html`, Text: `openai-sdk.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://openrouter.ai/docs/guides/community/openai-sdk
- Lokale Datei(en): HTML: `openai-sdk.html`, Text: `openai-sdk.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: OpenRouter OpenAI SDK
- Download-Werkzeug: `urllib`

---

**Quelle `api-reference-overview.txt`**

ModelsChatRankingsDocs

---

**Quelle `api-reference-overview.txt`**

DocsAPI ReferenceSDK Reference

---

**Quelle `api-reference-overview.txt`**

Streaming

---

**Quelle `api-reference-overview.txt`**

Embeddings

---

**Quelle `api-reference-overview.txt`**

Authentication

---

**Quelle `api-reference-overview.txt`**

Responses API

---

**Quelle `api-reference-overview.txt`**

Responses

---

**Quelle `api-reference-overview.txt`**

OAuth

---

**Quelle `api-reference-overview.txt`**

Endpoints

---

**Quelle `api-reference-overview.txt`**

API Keys

---

**Quelle `api-reference-overview.txt`**

Models

---

**Quelle `api-reference-overview.txt`**

Rerank

---

**Quelle `api-reference-overview.txt`**

Completions Request Format

---

**Quelle `api-reference-overview.txt`**

Headers

---

**Quelle `api-reference-overview.txt`**

CompletionsResponse Format

---

**Quelle `api-reference-overview.txt`**

OpenRouter’s request and response schemas are very similar to the OpenAI Chat API, with a few small differences. At a high level, OpenRouter normalizes the schema across models and providers so you only need to learn one.

---

**Quelle `api-reference-overview.txt`**

YAML: https://openrouter.ai/openapi.yaml

---

**Quelle `api-reference-overview.txt`**

JSON: https://openrouter.ai/openapi.json

---

**Quelle `api-reference-overview.txt`**

These specifications can be used with tools like Swagger UI, Postman, or any OpenAPI-compatible code generator to explore the API or generate client libraries.

---

**Quelle `api-reference-overview.txt`**

Here is the request schema as a TypeScript type. This will be the body of your POST request to the /api/v1/chat/completions endpoint (see the quick start above for an example).

---

**Quelle `api-reference-overview.txt`**

8 model?: string; // See "Supported Models" section

---

**Quelle `api-reference-overview.txt`**

11 // See "Structured Outputs" section below and models page for which models support it.

---

**Quelle `api-reference-overview.txt`**

15 stream?: boolean; // Enable streaming

---

**Quelle `api-reference-overview.txt`**

22 max_tokens?: number; // Range: [1, context_length)

---

**Quelle `api-reference-overview.txt`**

25 // Tool calling

---

**Quelle `api-reference-overview.txt`**

26 // Will be passed down as-is for providers implementing OpenAI's interface.

---

**Quelle `api-reference-overview.txt`**

28 // Otherwise, we transform the tools into a YAML template. The model responds with an assistant message.

---

**Quelle `api-reference-overview.txt`**

29 // See models supporting tool calling: openrouter.ai/models?supported_parameters=tools

---

**Quelle `api-reference-overview.txt`**

30 tools?: Tool[];

---

**Quelle `api-reference-overview.txt`**

31 tool_choice?: ToolChoice;

---

**Quelle `api-reference-overview.txt`**

36 top_k?: number; // Range: [1, Infinity) Not available for OpenAI models

---

**Quelle `api-reference-overview.txt`**

46 // https://platform.openai.com/docs/guides/latency-optimization#use-predicted-outputs

---

**Quelle `api-reference-overview.txt`**

51 models?: string[];

---

**Quelle `api-reference-overview.txt`**

57 // Debug options (streaming only)

---

**Quelle `api-reference-overview.txt`**

59 echo_upstream_body?: boolean; // If true, returns the transformed request body sent to the provider

---

**Quelle `api-reference-overview.txt`**

86 // for non-OpenAI models: `{name}: {content}`

---

**Quelle `api-reference-overview.txt`**

90 role: 'tool';

---

**Quelle `api-reference-overview.txt`**

92 tool_call_id: string;

---

**Quelle `api-reference-overview.txt`**

96type FunctionDescription = {

---

**Quelle `api-reference-overview.txt`**

102type Tool = {

---

**Quelle `openai-sdk.txt`**

OpenAI SDK Integration | OpenRouter SDK Support | OpenRouter | Documentation

---

**Quelle `openai-sdk.txt`**

ModelsChatRankingsDocs

---

**Quelle `openai-sdk.txt`**

DocsAPI ReferenceSDK Reference

---

**Quelle `openai-sdk.txt`**

Models

---

**Quelle `openai-sdk.txt`**

Authentication

---

**Quelle `openai-sdk.txt`**

Models & Routing

---

**Quelle `openai-sdk.txt`**

Tool Calling

---

**Quelle `openai-sdk.txt`**

Server Tools

---

**Quelle `openai-sdk.txt`**

Effect AI SDK

---

**Quelle `openai-sdk.txt`**

OpenAI SDK

---

**Quelle `openai-sdk.txt`**

Anthropic Agent SDK

---

**Quelle `openai-sdk.txt`**

Vercel AI SDK

---

**Quelle `openai-sdk.txt`**

Using the OpenAI SDK

---

**Quelle `openai-sdk.txt`**

Using OpenRouter with OpenAI SDK

---

**Quelle `openai-sdk.txt`**

Using pip install openai: github.

---

**Quelle `openai-sdk.txt`**

Using npm i openai: github.

---

**Quelle `openai-sdk.txt`**

1import OpenAI from "openai"

---

**Quelle `openai-sdk.txt`**

3const openai = new OpenAI({

---

**Quelle `openai-sdk.txt`**

4 baseURL: "https://openrouter.ai/api/v1",

---

**Quelle `openai-sdk.txt`**

6 defaultHeaders: {

---

**Quelle `openai-sdk.txt`**

12async function main() {

---

**Quelle `openai-sdk.txt`**

13 const completion = await openai.chat.completions.create({

---

**Quelle `openai-sdk.txt`**

14 model: "openai/gpt-4o",

---

**Quelle `openai-sdk.txt`**

Using OpenRouter with the Anthropic Agent SDK

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten

- Keine Codebeispiele automatisch erkannt.

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/OpenRouter/api-reference-overview.txt</code></summary>

````text
OpenRouter API Reference | Complete API Documentation | OpenRouter | Documentation

Search
/
Ask AI

ModelsChatRankingsDocs

DocsAPI ReferenceSDK Reference

DocsAPI ReferenceSDK Reference

API Guides

Overview

Streaming

Embeddings

Limits

Authentication

Parameters

Errors and Debugging

Responses API

API Reference

Responses

OAuth

Analytics

TTS

Chat

Credits

Embeddings

Endpoints

Generations

Guardrails

API Keys

Anthropic Messages

Models

Organization

Providers

Rerank

Video Generation

Workspaces

Light

On this page

OpenAPI Specification

Requests

Completions Request Format

Structured Outputs

Plugins

Headers

Assistant Prefill

Responses

CompletionsResponse Format

Finish Reason

Querying Cost and Stats

API Guides

API Reference

Copy page

An overview of OpenRouter's API

OpenRouter’s request and response schemas are very similar to the OpenAI Chat API, with a few small differences. At a high level, OpenRouter normalizes the schema across models and providers so you only need to learn one.

OpenAPI Specification

The complete OpenRouter API is documented using the OpenAPI specification. You can access the specification in either YAML or JSON format:

YAML: https://openrouter.ai/openapi.yaml

JSON: https://openrouter.ai/openapi.json

These specifications can be used with tools like Swagger UI, Postman, or any OpenAPI-compatible code generator to explore the API or generate client libraries.

Requests

Completions Request Format

Here is the request schema as a TypeScript type. This will be the body of your POST request to the /api/v1/chat/completions endpoint (see the quick start above for an example).

For a complete list of parameters, see the Parameters.

Request Schema

1// Definitions of subtypes are below

2type Request = {

3 // Either "messages" or "prompt" is required

4 messages?: Message[];

5 prompt?: string;

6

7 // If "model" is unspecified, uses the user's default

8 model?: string; // See "Supported Models" section

9

10 // Allows to force the model to produce specific output format.

11 // See "Structured Outputs" section below and models page for which models support it.

12 response_format?: ResponseFormat;

13

14 stop?: string | string[];

15 stream?: boolean; // Enable streaming

16

17 // Plugins to extend model capabilities (PDF parsing, response healing)

18 // See "Plugins" section: openrouter.ai/docs/guides/features/plugins

19 plugins?: Plugin[];

20

21 // See LLM Parameters (openrouter.ai/docs/api/reference/parameters)

22 max_tokens?: number; // Range: [1, context_length)

23 temperature?: number; // Range: [0, 2]

24

25 // Tool calling

26 // Will be passed down as-is for providers implementing OpenAI's interface.

27 // For providers with custom interfaces, we transform and map the properties.

28 // Otherwise, we transform the tools into a YAML template. The model responds with an assistant message.

29 // See models supporting tool calling: openrouter.ai/models?supported_parameters=tools

30 tools?: Tool[];

31 tool_choice?: ToolChoice;

32

33 // Advanced optional parameters

34 seed?: number; // Integer only

35 top_p?: number; // Range: (0, 1]

36 top_k?: number; // Range: [1, Infinity) Not available for OpenAI models

37 frequency_penalty?: number; // Range: [-2, 2]

38 presence_penalty?: number; // Range: [-2, 2]

39 repetition_penalty?: number; // Range: (0, 2]

40 logit_bias?: { [key: number]: number };

41 top_logprobs: number; // Integer only

42 min_p?: number; // Range: [0, 1]

43 top_a?: number; // Range: [0, 1]

44

45 // Reduce latency by providing the model with a predicted output

46 // https://platform.openai.com/docs/guides/latency-optimization#use-predicted-outputs

47 prediction?: { type: 'content'; content: string };

48

49 // OpenRouter-only parameters

50 // See "Model Routing" section: openrouter.ai/docs/guides/features/model-routing

51 models?: string[];

52 route?: 'fallback';

53 // See "Provider Routing" section: openrouter.ai/docs/guides/routing/provider-selection

54 provider?: ProviderPreferences;

55 user?: string; // A stable identifier for your end-users. Used to help detect and prevent abuse.

56

57 // Debug options (streaming only)

58 debug?: {

59 echo_upstream_body?: boolean; // If true, returns the transformed request body sent to the provider

60 };

61};

62

63// Subtypes:

64

65type TextContent = {

66 type: 'text';

67 text: string;

68};

69

70type ImageContentPart = {

71 type: 'image_url';

72 image_url: {

73 url: string; // URL or base64 encoded image data

74 detail?: string; // Optional, defaults to "auto"

75 };

76};

77

78type ContentPart = TextContent | ImageContentPart;

79

80type Message =

81 | {

82 role: 'user' | 'assistant' | 'system';

83 // ContentParts are only for the "user" role:

84 content: string | ContentPart[];

85 // If "name" is included, it will be prepended like this

86 // for non-OpenAI models: `{name}: {content}`

87 name?: string;

88 }

89 | {

90 role: 'tool';

91 content: string;

92 tool_call_id: string;

93 name?: string;

94 };

95

96type FunctionDescription = {

97 description?: string;

98 name: string;

99 parameters: object; // JSON Schema object

100};

101

102type Tool = {

103 type: 'function';

104 function: FunctionDescription;

105};

106

107type ToolChoice =

108 | 'none'

109 | 'auto'

110 | {

111 type: 'function';

112 function: {

113 name: string;

114 };

115 };

116

117// Response format for structured outputs

118type ResponseFormat =

119 | { type: 'json_object' }

120 | {

121 type: 'json_schema';

122 json_schema: {

123 name: string;

124 strict?: boolean;

125 schema: object; // JSON Schema object

126 };

127 };

128

129// Plugin configuration

130type Plugin = {

131 id: string; // 'web', 'file-parser', 'response-healing', 'context-compression'

132 enabled?: boolean;

133 // Additional plugin-specific options

134 [key: string]: unknown;

135};

Structured Outputs

The response_format parameter allows you to enforce structured JSON responses from the model. OpenRouter supports two modes:

{ type: 'json_object' }: Basic JSON mode - the model will return valid JSON

{ type: 'json_schema', json_schema: { ... } }: Strict schema mode - the model will return JSON matching your exact schema

For detailed usage and examples, see Structured Outputs. To find models that support structured outputs, check the models page.

Plugins

OpenRouter plugins extend model capabilities with features like web search, PDF processing, response healing, and context compression. Enable plugins by adding a plugins array to your request:

1{

2 "plugins": [

3 { "id": "web" },

4 { "id": "response-healing" }

5 ]

6}

Available plugins include web (real-time web search), file-parser (PDF processing), response-healing (automatic JSON repair), and context-compression (middle-out prompt compression). For detailed configuration options, see Plugins

Headers

OpenRouter allows you to specify some optional headers to identify your app and make it discoverable to users on our site.

HTTP-Referer: Identifies your app on openrouter.ai

X-OpenRouter-Title: Sets/modifies your app’s title (X-Title also accepted)

X-OpenRouter-Categories: Assigns marketplace categories (see App Attribution)

TypeScript

1fetch('https://openrouter.ai/api/v1/chat/completions', {

2 method: 'POST',

3 headers: {

4 Authorization: 'Bearer <OPENROUTER_API_KEY>',

5 'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.

6 'X-OpenRouter-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.

7 'Content-Type': 'application/json',

8 },

9 body: JSON.stringify({

10 model: 'openai/gpt-5.2',

11 messages: [

12 {

13 role: 'user',

14 content: 'What is the meaning of life?',

15 },

16 ],

17 }),

18});

Model routing

If the model parameter is omitted, the user or payer’s default is used.
Otherwise, remember to select a value for model from the supported
models or API, and include the organization
prefix. OpenRouter will select the least expensive and best GPUs available to
serve the request, and fall back to other providers or GPUs if it receives a
5xx response code or if you are rate-limited.

Streaming

Server-Sent Events
(SSE)
are supported as well, to enable streaming for all models. Simply send
stream: true in your request body. The SSE stream will occasionally contain
a “comment” payload, which you should ignore (noted below).

Non-standard parameters

If the chosen model doesn’t support a request parameter (such as logit_bias
in non-OpenAI models, or top_k for OpenAI), then the parameter is ignored.
The rest are forwarded to the underlying model API.

Assistant Prefill

OpenRouter supports asking models to complete a partial response. This can be useful for guiding models to respond in a certain way.

To use this features, simply include a message with role: "assistant" at the end of your messages array.

TypeScript

1fetch('https://openrouter.ai/api/v1/chat/completions', {

2 method: 'POST',

3 headers: {

4 Authorization: 'Bearer <OPENROUTER_API_KEY>',

5 'Content-Type': 'application/json',

6 },

7 body: JSON.stringify({

8 model: 'openai/gpt-5.2',

9 messages: [

10 { role: 'user', content: 'What is the meaning of life?' },

11 { role: 'assistant', content: "I'm not sure, but my best guess is" },

12 ],

13 }),

14});

Responses

CompletionsResponse Format

OpenRouter normalizes the schema across models and providers to comply with the OpenAI Chat API.

This means that choices is always an array, even if the model only returns one completion. Each choice will contain a delta property if a stream was requested and a message property otherwise. This makes it easier to use the same code for all models.

Here’s the response schema as a TypeScript type:

TypeScript

1// Definitions of subtypes are below

2type Response = {

3 id: string;

4 // Depending on whether you set "stream" to "true" and

5 // whether you passed in "messages" or a "prompt", you

6 // will get a different output shape

7 choices: (NonStreamingChoice | StreamingChoice | NonChatChoice)[];

8 created: number; // Unix timestamp

9 model: string;

10 object: 'chat.completion' | 'chat.completion.chunk';

11

12 system_fingerprint?: string; // Only present if the provider supports it

13

14 // Usage data is always returned for non-streaming.

15 // When streaming, usage is returned exactly once in the final chunk

16 // before the [DONE] message, with an empty choices array.

17 usage?: ResponseUsage;

18};

1// OpenRouter always returns detailed usage information.

2// Token counts are calculated using the model's native tokenizer.

3

4type ResponseUsage = {

5 /** Including images, input audio, and tools if any */

6 prompt_tokens: number;

7 /** The tokens generated */

8 completion_tokens: number;

9 /** Sum of the above two fields */

10 total_tokens: number;

11

12 /** Breakdown of prompt tokens (optional) */

13 prompt_tokens_details?: {

14 cached_tokens: number; // Tokens cached by the endpoint

15 cache_write_tokens?: number; // Tokens written to cache (models with explicit caching)

16 audio_tokens?: number; // Tokens used for input audio

17 video_tokens?: number; // Tokens used for input video

18 };

19

20 /** Breakdown of completion tokens (optional) */

21 completion_tokens_details?: {

22 reasoning_tokens?: number; // Tokens generated for reasoning

23 audio_tokens?: number; // Tokens generated for audio output

24 image_tokens?: number; // Tokens generated for image output

25 };

26

27 /** Cost in credits (optional) */

28 cost?: number;

29 /** Whether request used Bring Your Own Key */

30 is_byok?: boolean;

31 /** Detailed cost breakdown (optional) */

32 cost_details?: {

33 upstream_inference_cost?: number; // Only shown for BYOK requests

34 upstream_inference_prompt_cost: number;

35 upstream_inference_completions_cost: number;

36 };

37

38 /** Server-side tool usage (optional) */

39 server_tool_use?: {

40 web_search_requests?: number;

41 };

42};

1// Subtypes:

2type NonChatChoice = {

3 finish_reason: string | null;

4 text: string;

5 error?: ErrorResponse;

6};

7

8type NonStreamingChoice = {

9 finish_reason: string | null;

10 native_finish_reason: string | null;

11 message: {

12 content: string | null;

13 role: string;

14 tool_calls?: ToolCall[];

15 };

16 error?: ErrorResponse;

17};

18

19type StreamingChoice = {

20 finish_reason: string | null;

21 native_finish_reason: string | null;

22 delta: {

23 content: string | null;

24 role?: string;

25 tool_calls?: ToolCall[];

26 };

27 error?: ErrorResponse;

28};

29

30type ErrorResponse = {

31 code: number; // See "Error Handling" section

32 message: string;

33 metadata?: Record<string, unknown>; // Contains additional error information such as provider details, the raw error message, etc.

34};

35

36type ToolCall = {

37 id: string;

38 type: 'function';

39 function: FunctionCall;

40};

Here’s an example:

1{

2 "id": "gen-xxxxxxxxxxxxxx",

3 "choices": [

4 {

5 "finish_reason": "stop", // Normalized finish_reason

6 "native_finish_reason": "stop", // The raw finish_reason from the provider

7 "message": {

8 // will be "delta" if streaming

9 "role": "assistant",

10 "content": "Hello there!"

11 }

12 }

13 ],

14 "usage": {

15 "prompt_tokens": 10,

16 "completion_tokens": 4,

17 "total_tokens": 14,

18 "prompt_tokens_details": {

19 "cached_tokens": 0

20 },

21 "completion_tokens_details": {

22 "reasoning_tokens": 0

23 },

24 "cost": 0.00014

25 },

26 "model": "openai/gpt-4o" // Could also be "anthropic/claude-sonnet-4.6", etc, depending on the "model" that ends up being used

27}

Finish Reason

OpenRouter normalizes each model’s finish_reason to one of the following values: tool_calls, stop, length, content_filter, error.

Some models and providers may have additional finish reasons. The raw finish_reason string returned by the model is available via the native_finish_reason property.

Querying Cost and Stats

The token counts returned in the completions API response are calculated using the model’s native tokenizer. Credit usage and model pricing are based on these native token counts.

You can also use the returned id to query for the generation stats (including token counts and cost) after the request is complete via the /api/v1/generation endpoint. This is useful for auditing historical usage or when you need to fetch stats asynchronously.

Query Generation Stats

1const generation = await fetch(

2 'https://openrouter.ai/api/v1/generation?id=$GENERATION_ID',

3 { headers },

4);

5

6const stats = await generation.json();

Please see the Generation API reference for the full response shape.

Note that token counts are also available in the usage field of the response body for non-streaming completions.

Was this page helpful?
YesNo

Streaming

NextBuilt with

ModelsChatRankingsDocs
````

</details>


<details>
<summary>Textanlage: <code>OpenAI/API/OpenRouter/openai-sdk.txt</code></summary>

````text
OpenAI SDK Integration | OpenRouter SDK Support | OpenRouter | Documentation

Search
/
Ask AI

ModelsChatRankingsDocs

DocsAPI ReferenceSDK Reference

DocsAPI ReferenceSDK Reference

Overview

Quickstart

Principles

Models

Multimodal

Authentication

FAQ

Report Feedback

Enterprise

Models & Routing

Model Fallbacks

Provider Selection

Auto Exacto

Model Variants

Routers

Features

Workspaces

Presets

Response Caching

Tool Calling

Server Tools

Plugins

Structured Outputs

Message Transforms

Zero Completion Insurance

ZDR

App Attribution

Guardrails

Service Tiers

Input & Output Logging

Broadcast

Privacy

Best Practices

Guides

Community
Frameworks and Integrations Overview

Awesome OpenRouter

Effect AI SDK

Arize

LangChain

LiveKit

Langfuse

Mastra

OpenAI SDK

Anthropic Agent SDK

PydanticAI

TanStack AI

Vercel AI SDK

Xcode

Zapier

Infisical

Light

On this page

Using the OpenAI SDK

Community

OpenAI SDK

Copy page

Using OpenRouter with OpenAI SDK

Using the OpenAI SDK

Using pip install openai: github.

Using npm i openai: github.

You can also use
Grit to
automatically migrate your code. Simply run npx @getgrit/launcher openrouter.

TypeScriptPython

1import OpenAI from "openai"

2

3const openai = new OpenAI({

4 baseURL: "https://openrouter.ai/api/v1",

5 apiKey: "<OPENROUTER_API_KEY>",

6 defaultHeaders: {

7 "HTTP-Referer": "<YOUR_SITE_URL>", // Optional. Site URL for rankings on openrouter.ai.

8 "X-OpenRouter-Title": "<YOUR_SITE_NAME>", // Optional. Site title for rankings on openrouter.ai.

9 },

10})

11

12async function main() {

13 const completion = await openai.chat.completions.create({

14 model: "openai/gpt-4o",

15 messages: [

16 { role: "user", content: "Say this is a test" }

17 ],

18 })

19

20 console.log(completion.choices[0].message)

21}

22main();

Was this page helpful?
YesNo

Previous

Anthropic Agent SDK

Using OpenRouter with the Anthropic Agent SDK

NextBuilt with

ModelsChatRankingsDocs
````

</details>
