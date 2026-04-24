# API-MicrosoftAgentFramework

> Neu erzeugt aus offiziellen Referenzdokumentationen. Falls kein Reverse-Engineering-Dokument vorhanden war, enthält diese Datei primär offizielle Schnittstelleninformationen und Implementierungshinweise.


---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/MicrosoftAgentFramework`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – MicrosoftAgentFramework

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### OpenAI Integration | Microsoft Learn
- Quelle: Pflichtquelle
- Original-URL: https://learn.microsoft.com/en-us/agent-framework/integrations/openai-endpoints
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/agent-framework/integrations/openai-endpoints
- Lokale Datei(en): HTML: `openai-endpoints.html`, Text: `openai-endpoints.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Microsoft Agent Framework OpenAI endpoints
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html`

### Erkannte URLs und Basisadressen

- `https://learn.microsoft.com/en-us/agent-framework/integrations/openai-endpoints`
- `https://<your-openai-resource`
- `http://localhost:5209/v1/conversations`
- `http://localhost:5209/pirate/v1/responses`
- `http://localhost:5209/v1/conversations/conv_E9Ma6nQpRzYxRHxRRqoOWWsDjZVyZfKxlHhfCf02Yxyy9N2y/items?include=string`
- `http://localhost:11434/v1/`
- `https://your-hosted-agent.example.com/v1/`
- `http://localhost:1234/v1/`
- `http://localhost:8000/v1/`
- `https://your-resource.openai.azure.com/`

### Erkannte Endpunkte / Pfade

- `/pirate/v1/chat/completions`
- `POST http://localhost:5209/v1/conversations`
- `POST http://localhost:5209/pirate/v1/responses`
- `GET http://localhost:5209/v1/conversations/conv_E9Ma6nQpRzYxRHxRRqoOWWsDjZVyZfKxlHhfCf02Yxyy9N2y/items?include=string`
- `/math/v1/chat/completions`
- `/science/v1/chat/completions`
- `/math/v1/responses`
- `/science/v1/responses`
- `/api/responses`
- `http://localhost:11434/v1/"`
- `https://your-hosted-agent.example.com/v1/"`
- `http://localhost:11434/v1/`
- `http://localhost:1234/v1/`
- `http://localhost:8000/v1/`

### Erkannte Umgebungsvariablen / Konstanten

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT_NAME`
- `POST`
- `OPENAI_BASE_URL`
- `AZURE_OPENAI_CHAT_MODEL`
- `AZURE_OPENAI_API_VERSION`
- `AZURE_OPENAI_MODEL`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### OpenAI Integration | Microsoft Learn
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://learn.microsoft.com/en-us/agent-framework/integrations/openai-endpoints
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/agent-framework/integrations/openai-endpoints

---

**Quelle `INDEX.md`**

- Original-URL: https://learn.microsoft.com/en-us/agent-framework/integrations/openai-endpoints
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/agent-framework/integrations/openai-endpoints
- Lokale Datei(en): HTML: `openai-endpoints.html`, Text: `openai-endpoints.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://learn.microsoft.com/en-us/agent-framework/integrations/openai-endpoints
- Lokale Datei(en): HTML: `openai-endpoints.html`, Text: `openai-endpoints.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Microsoft Agent Framework OpenAI endpoints
- Download-Werkzeug: `urllib`

---

**Quelle `openai-endpoints.txt`**

OpenAI Integration | Microsoft Learn

---

**Quelle `openai-endpoints.txt`**

Access to this page requires authorization. You can try signing in or changing directories.

---

**Quelle `openai-endpoints.txt`**

Access to this page requires authorization. You can try changing directories.

---

**Quelle `openai-endpoints.txt`**

OpenAI-Compatible Endpoints

---

**Quelle `openai-endpoints.txt`**

The Agent Framework supports OpenAI-compatible protocols for both hosting agents behind standard APIs and connecting to any OpenAI-compatible endpoint.

---

**Quelle `openai-endpoints.txt`**

What Are OpenAI Protocols?

---

**Quelle `openai-endpoints.txt`**

Two OpenAI protocols are supported:

---

**Quelle `openai-endpoints.txt`**

Chat Completions API — Standard stateless request/response format for chat interactions

---

**Quelle `openai-endpoints.txt`**

Responses API — Advanced format that supports conversations, streaming, and long-running agent processes

---

**Quelle `openai-endpoints.txt`**

The Responses API is now the default and recommended approach according to OpenAI's documentation. It provides a more comprehensive and feature-rich interface for building AI applications with built-in conversation management, streaming capabilities, and support for long-running processes.

---

**Quelle `openai-endpoints.txt`**

Use the Responses API when:

---

**Quelle `openai-endpoints.txt`**

You need server-side conversation management. However, that is not a requirement: you can still use Responses API in stateless mode.

---

**Quelle `openai-endpoints.txt`**

You're building long-running agent processes

---

**Quelle `openai-endpoints.txt`**

You need advanced streaming capabilities with detailed event types

---

**Quelle `openai-endpoints.txt`**

You want to track and manage individual responses (e.g., retrieve a specific response by ID, check its status, or cancel a running response)

---

**Quelle `openai-endpoints.txt`**

Use the Chat Completions API when:

---

**Quelle `openai-endpoints.txt`**

Migrating existing applications that rely on the Chat Completions format

---

**Quelle `openai-endpoints.txt`**

You're integrating with existing tools that only support Chat Completions

---

**Quelle `openai-endpoints.txt`**

Hosting Agents as OpenAI Endpoints (.NET)

---

**Quelle `openai-endpoints.txt`**

The Microsoft.Agents.AI.Hosting.OpenAI library enables you to expose AI agents through OpenAI-compatible HTTP endpoints, supporting both the Chat Completions and Responses APIs. This allows you to integrate your agents with any OpenAI-compatible client or tool.

---

**Quelle `openai-endpoints.txt`**

Microsoft.Agents.AI.Hosting.OpenAI

---

**Quelle `openai-endpoints.txt`**

Chat Completions API

---

**Quelle `openai-endpoints.txt`**

The Chat Completions API provides a simple, stateless interface for interacting with agents using the standard OpenAI chat format.

---

**Quelle `openai-endpoints.txt`**

Setting up an agent in ASP.NET Core with ChatCompletions integration

---

**Quelle `openai-endpoints.txt`**

Here's a complete example exposing an agent via the Chat Completions API:

---

**Quelle `openai-endpoints.txt`**

# Hosting.A2A.AspNetCore for OpenAI ChatCompletions/Responses protocol(s) integration
dotnet add package Microsoft.Agents.AI.Hosting.OpenAI --prerelease

---

**Quelle `openai-endpoints.txt`**

# Libraries to connect to Azure OpenAI
dotnet add package Azure.AI.OpenAI --prerelease

---

**Quelle `openai-endpoints.txt`**

# Libraries to connect to Azure OpenAI
dotnet add package Azure.AI.OpenAI --prerelease
dotnet add package Azure.Identity

---

**Quelle `openai-endpoints.txt`**

dotnet add package Microsoft.Extensions.AI
dotnet add package Microsoft.Extensions.AI.OpenAI --prerelease

---

**Quelle `openai-endpoints.txt`**

3. Configure Azure OpenAI connection

---

**Quelle `openai-endpoints.txt`**

The application requires an Azure OpenAI connection. Configure the endpoint and deployment name using dotnet user-secrets or environment variables.
You can also simply edit the appsettings.json, but that's not recommended for the apps deployed in production since some of the data can be considered to be secret.

---

**Quelle `openai-endpoints.txt`**

dotnet user-secrets set "AZURE_OPENAI_ENDPOINT" "https://<your-openai-resource>.openai.azure.com/"
dotnet user-secrets set "AZURE_OPENAI_DEPLOYMENT_NAME" "gpt-4o-mini"

---

**Quelle `openai-endpoints.txt`**

$env:AZURE_OPENAI_ENDPOINT = "https://<your-openai-resource>.openai.azure.com/"
$env:AZURE_OPENAI_DEPLOYMENT_NAME = "gpt-4o-mini"

---

**Quelle `openai-endpoints.txt`**

export AZURE_OPENAI_ENDPOINT="https://<your-openai-resource>.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o-mini"

---

**Quelle `openai-endpoints.txt`**

"AZURE_OPENAI_ENDPOINT": "https://<your-openai-resource>.openai.azure.com/",
 "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4o-mini"

---

**Quelle `openai-endpoints.txt`**

using Azure.AI.OpenAI;
using Azure.Identity;

---

**Quelle `openai-endpoints.txt`**

string endpoint = builder.Configuration["AZURE_OPENAI_ENDPOINT"]
 ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT is not set.");

---

**Quelle `openai-endpoints.txt`**

string endpoint = builder.Configuration["AZURE_OPENAI_ENDPOINT"]
 ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT is not set.");
string deploymentName = builder.Configuration["AZURE_OPENAI_DEPLOYMENT_NAME"]

---

**Quelle `openai-endpoints.txt`**

?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT is not set.");
string deploymentName = builder.Configuration["AZURE_OPENAI_DEPLOYMENT_NAME"]
 ?? throw new InvalidOperationException("AZURE_OPENAI_DEPLOYMENT_NAME is not set.");

---

**Quelle `openai-endpoints.txt`**

string deploymentName = builder.Configuration["AZURE_OPENAI_DEPLOYMENT_NAME"]
 ?? throw new InvalidOperationException("AZURE_OPENAI_DEPLOYMENT_NAME is not set.");

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `openai-endpoints.txt`**

````text
export AZURE_OPENAI_ENDPOINT="https://<your-openai-resource>.openai.azure.com/"
````

---

**Quelle `openai-endpoints.txt`**

````text
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o-mini"
````

---

**Quelle `openai-endpoints.txt`**

````text
The Python OpenAIChatCompletionClient and OpenAIChatClient both support a base_url parameter, enabling you to connect to any OpenAI-compatible endpoint — including self-hosted agents, local inference servers (Ollama, LM Studio, vLLM), or third-party OpenAI-compatible APIs.
````

---

**Quelle `openai-endpoints.txt`**

````text
pip install agent-framework
````

---

**Quelle `openai-endpoints.txt`**

````text
Use OpenAIChatCompletionClient with base_url to point to any Chat Completions-compatible server:
````

---

**Quelle `openai-endpoints.txt`**

````text
base_url="http://localhost:11434/v1/", # e.g. Ollama
````

---

**Quelle `openai-endpoints.txt`**

````text
api_key="not-needed", # placeholder for local servers
````

---

**Quelle `openai-endpoints.txt`**

````text
Use OpenAIChatClient with base_url for endpoints that support the Responses API:
````

---

**Quelle `openai-endpoints.txt`**

````text
base_url="https://your-hosted-agent.example.com/v1/",
````

---

**Quelle `openai-endpoints.txt`**

````text
api_key="your-api-key",
````

---

**Quelle `openai-endpoints.txt`**

````text
The base_url approach works with any server exposing the OpenAI Chat Completions format:
````

---

**Quelle `openai-endpoints.txt`**

````text
You can also set the OPENAI_BASE_URL environment variable instead of passing base_url directly. The client will use it automatically.
````

---

**Quelle `openai-endpoints.txt`**

````text
Use the same generic OpenAI clients for Azure OpenAI by passing explicit Azure routing inputs instead of base_url:
````

---

**Quelle `openai-endpoints.txt`**

````text
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
````

---

**Quelle `openai-endpoints.txt`**

````text
export AZURE_OPENAI_CHAT_MODEL="gpt-4o-mini"
````

---

**Quelle `openai-endpoints.txt`**

````text
export AZURE_OPENAI_API_VERSION="your-api-version"
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/MicrosoftAgentFramework/openai-endpoints.txt</code></summary>

````text
OpenAI Integration | Microsoft Learn

 Skip to main content

 Skip to Ask Learn chat experience

This browser is no longer supported.

 Upgrade to Microsoft Edge to take advantage of the latest features, security updates, and technical support.

 Download Microsoft Edge

 More info about Internet Explorer and Microsoft Edge

 Table of contents 

 Exit editor mode

 Ask Learn

 Ask Learn

 Reading mode

 Table of contents

 Read in English

 Add

 Add to plan

 Edit

Share via

 Facebook

 x.com

 LinkedIn

 Email

 Copy Markdown

 Print

 Note

 Access to this page requires authorization. You can try signing in or changing directories.

 Access to this page requires authorization. You can try changing directories.

OpenAI-Compatible Endpoints

 Feedback

 Summarize this article for me

 In this article

The Agent Framework supports OpenAI-compatible protocols for both hosting agents behind standard APIs and connecting to any OpenAI-compatible endpoint.

What Are OpenAI Protocols?

Two OpenAI protocols are supported:

Chat Completions API — Standard stateless request/response format for chat interactions

Responses API — Advanced format that supports conversations, streaming, and long-running agent processes

The Responses API is now the default and recommended approach according to OpenAI's documentation. It provides a more comprehensive and feature-rich interface for building AI applications with built-in conversation management, streaming capabilities, and support for long-running processes.

Use the Responses API when:

Building new applications (recommended default)

You need server-side conversation management. However, that is not a requirement: you can still use Responses API in stateless mode.

You want persistent conversation history

You're building long-running agent processes

You need advanced streaming capabilities with detailed event types

You want to track and manage individual responses (e.g., retrieve a specific response by ID, check its status, or cancel a running response)

Use the Chat Completions API when:

Migrating existing applications that rely on the Chat Completions format

You need simple, stateless request/response interactions

State management is handled entirely by your client

You're integrating with existing tools that only support Chat Completions

You need maximum compatibility with legacy systems

Hosting Agents as OpenAI Endpoints (.NET)

The Microsoft.Agents.AI.Hosting.OpenAI library enables you to expose AI agents through OpenAI-compatible HTTP endpoints, supporting both the Chat Completions and Responses APIs. This allows you to integrate your agents with any OpenAI-compatible client or tool.

NuGet Package:

Microsoft.Agents.AI.Hosting.OpenAI

Chat Completions API

The Chat Completions API provides a simple, stateless interface for interacting with agents using the standard OpenAI chat format.

Setting up an agent in ASP.NET Core with ChatCompletions integration

Here's a complete example exposing an agent via the Chat Completions API:

Prerequisites

1. Create an ASP.NET Core Web API project

Create a new ASP.NET Core Web API project or use an existing one.

2. Install required dependencies

Install the following packages:

.NET CLI

Run the following commands in your project directory to install the required NuGet packages:

# Hosting.A2A.AspNetCore for OpenAI ChatCompletions/Responses protocol(s) integration
dotnet add package Microsoft.Agents.AI.Hosting.OpenAI --prerelease

# Libraries to connect to Azure OpenAI
dotnet add package Azure.AI.OpenAI --prerelease
dotnet add package Azure.Identity
dotnet add package Microsoft.Extensions.AI
dotnet add package Microsoft.Extensions.AI.OpenAI --prerelease

# Swagger to test app
dotnet add package Microsoft.AspNetCore.OpenApi
dotnet add package Swashbuckle.AspNetCore

3. Configure Azure OpenAI connection

The application requires an Azure OpenAI connection. Configure the endpoint and deployment name using dotnet user-secrets or environment variables.
You can also simply edit the appsettings.json, but that's not recommended for the apps deployed in production since some of the data can be considered to be secret.

User-Secrets

ENV Windows

ENV unix

appsettings

dotnet user-secrets set "AZURE_OPENAI_ENDPOINT" "https://<your-openai-resource>.openai.azure.com/"
dotnet user-secrets set "AZURE_OPENAI_DEPLOYMENT_NAME" "gpt-4o-mini"

$env:AZURE_OPENAI_ENDPOINT = "https://<your-openai-resource>.openai.azure.com/"
$env:AZURE_OPENAI_DEPLOYMENT_NAME = "gpt-4o-mini"

export AZURE_OPENAI_ENDPOINT="https://<your-openai-resource>.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o-mini"

 "AZURE_OPENAI_ENDPOINT": "https://<your-openai-resource>.openai.azure.com/",
 "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4o-mini"

4. Add the code to Program.cs

Replace the contents of Program.cs with the following code:

using Azure.AI.OpenAI;
using Azure.Identity;
using Microsoft.Agents.AI.Hosting;
using Microsoft.Extensions.AI;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

string endpoint = builder.Configuration["AZURE_OPENAI_ENDPOINT"]
 ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT is not set.");
string deploymentName = builder.Configuration["AZURE_OPENAI_DEPLOYMENT_NAME"]
 ?? throw new InvalidOperationException("AZURE_OPENAI_DEPLOYMENT_NAME is not set.");

// Register the chat client
IChatClient chatClient = new AzureOpenAIClient(
 new Uri(endpoint),
 new DefaultAzureCredential())
 .GetChatClient(deploymentName)
 .AsIChatClient();
builder.Services.AddSingleton(chatClient);

builder.AddOpenAIChatCompletions();

// Register an agent
var pirateAgent = builder.AddAIAgent("pirate", instructions: "You are a pirate. Speak like a pirate.");

var app = builder.Build();

app.MapOpenApi();
app.UseSwagger();
app.UseSwaggerUI();

// Expose the agent via OpenAI ChatCompletions protocol
app.MapOpenAIChatCompletions(pirateAgent);

app.Run();

Testing the Chat Completions Endpoint

Once the application is running, you can test the agent using the OpenAI SDK or HTTP requests:

Using HTTP Request

POST {{baseAddress}}/pirate/v1/chat/completions
Content-Type: application/json
{
 "model": "pirate",
 "stream": false,
 "messages": [
 {
 "role": "user",
 "content": "Hey mate!"
 }
 ]
}

Note: Replace {{baseAddress}} with your server endpoint.

Here is a sample response:

{
 "id": "chatcmpl-nxAZsM6SNI2BRPMbzgjFyvWWULTFr",
 "object": "chat.completion",
 "created": 1762280028,
 "model": "gpt-5",
 "choices": [
 {
 "index": 0,
 "finish_reason": "stop",
 "message": {
 "role": "assistant",
 "content": "Ahoy there, matey! How be ye farin' on this fine day?"
 }
 }
 ],
 "usage": {
 "completion_tokens": 18,
 "prompt_tokens": 22,
 "total_tokens": 40,
 "completion_tokens_details": {
 "accepted_prediction_tokens": 0,
 "audio_tokens": 0,
 "reasoning_tokens": 0,
 "rejected_prediction_tokens": 0
 },
 "prompt_tokens_details": {
 "audio_tokens": 0,
 "cached_tokens": 0
 }
 },
 "service_tier": "default"
}

The response includes the message ID, content, and usage statistics.

Chat Completions also supports streaming, where output is returned in chunks as soon as content is available.
This capability enables displaying output progressively. You can enable streaming by specifying "stream": true.
The output format consists of Server-Sent Events (SSE) chunks as defined in the OpenAI Chat Completions specification.

POST {{baseAddress}}/pirate/v1/chat/completions
Content-Type: application/json
{
 "model": "pirate",
 "stream": true,
 "messages": [
 {
 "role": "user",
 "content": "Hey mate!"
 }
 ]
}

And the output we get is a set of ChatCompletions chunks:

data: {"id":"chatcmpl-xwKgBbFtSEQ3OtMf21ctMS2Q8lo93","choices":[],"object":"chat.completion.chunk","created":0,"model":"gpt-5"}

data: {"id":"chatcmpl-xwKgBbFtSEQ3OtMf21ctMS2Q8lo93","choices":[{"index":0,"finish_reason":"stop","delta":{"content":"","role":"assistant"}}],"object":"chat.completion.chunk","created":0,"model":"gpt-5"}

...

data: {"id":"chatcmpl-xwKgBbFtSEQ3OtMf21ctMS2Q8lo93","choices":[],"object":"chat.completion.chunk","created":0,"model":"gpt-5","usage":{"completion_tokens":34,"prompt_tokens":23,"total_tokens":57,"completion_tokens_details":{"accepted_prediction_tokens":0,"audio_tokens":0,"reasoning_tokens":0,"rejected_prediction_tokens":0},"prompt_tokens_details":{"audio_tokens":0,"cached_tokens":0}}}

The streaming response contains similar information, but delivered as Server-Sent Events.

Responses API

The Responses API provides advanced features including conversation management, streaming, and support for long-running agent processes.

Setting up an agent in ASP.NET Core with Responses API integration

Here's a complete example using the Responses API:

Prerequisites

Follow the same prerequisites as the Chat Completions example (steps 1-3).

4. Add the code to Program.cs

using Azure.AI.OpenAI;
using Azure.Identity;
using Microsoft.Agents.AI.Hosting;
using Microsoft.Extensions.AI;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

string endpoint = builder.Configuration["AZURE_OPENAI_ENDPOINT"]
 ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT is not set.");
string deploymentName = builder.Configuration["AZURE_OPENAI_DEPLOYMENT_NAME"]
 ?? throw new InvalidOperationException("AZURE_OPENAI_DEPLOYMENT_NAME is not set.");

// Register the chat client
IChatClient chatClient = new AzureOpenAIClient(
 new Uri(endpoint),
 new DefaultAzureCredential())
 .GetChatClient(deploymentName)
 .AsIChatClient();
builder.Services.AddSingleton(chatClient);

builder.AddOpenAIResponses();
builder.AddOpenAIConversations();

// Register an agent
var pirateAgent = builder.AddAIAgent("pirate", instructions: "You are a pirate. Speak like a pirate.");

var app = builder.Build();

app.MapOpenApi();
app.UseSwagger();
app.UseSwaggerUI();

// Expose the agent via OpenAI Responses protocol
app.MapOpenAIResponses(pirateAgent);
app.MapOpenAIConversations();

app.Run();

Testing the Responses API

The Responses API is similar to Chat Completions but is stateful, allowing you to pass a conversation parameter.
Like Chat Completions, it supports the stream parameter, which controls the output format: either a single JSON response or a stream of events.
The Responses API defines its own streaming event types, including response.created, response.output_item.added, response.output_item.done, response.completed, and others.

Create a Conversation and Response

You can send a Responses request directly, or you can first create a conversation using the Conversations API
and then link subsequent requests to that conversation.

To begin, create a new conversation:

POST http://localhost:5209/v1/conversations
Content-Type: application/json
{
 "items": [
 {
 "type": "message",
 "role": "user",
 "content": "Hello!"
 }
 ]
}

The response includes the conversation ID:

{
 "id": "conv_E9Ma6nQpRzYxRHxRRqoOWWsDjZVyZfKxlHhfCf02Yxyy9N2y",
 "object": "conversation",
 "created_at": 1762881679,
 "metadata": {}
}

Next, send a request and specify the conversation parameter.
(To receive the response as streaming events, set "stream": true in the request.)

POST http://localhost:5209/pirate/v1/responses
Content-Type: application/json
{
 "stream": false,
 "conversation": "conv_E9Ma6nQpRzYxRHxRRqoOWWsDjZVyZfKxlHhfCf02Yxyy9N2y",
 "input": [
 {
 "type": "message",
 "role": "user",
 "content": [
 {
 "type": "input_text",
 "text": "are you a feminist?"
 }
 ]
 }
 ]
}

The agent returns the response and saves the conversation items to storage for later retrieval:

{
 "id": "resp_FP01K4bnMsyQydQhUpovK6ysJJroZMs1pnYCUvEqCZqGCkac",
 "conversation": "conv_E9Ma6nQpRzYxRHxRRqoOWWsDjZVyZfKxlHhfCf02Yxyy9N2y",
 "object": "response",
 "created_at": 1762881518,
 "status": "completed",
 "incomplete_details": null,
 "output": [
 {
 "role": "assistant",
 "content": [
 {
 "type": "output_text",
 "text": "Arrr, matey! As a pirate, I be all about respect for the crew, no matter their gender! We sail these seas together, and every hand on deck be valuable. A true buccaneer knows that fairness and equality be what keeps the ship afloat. So, in me own way, I’d say I be supportin’ all hearty souls who seek what be right! What say ye?"
 }
 ],
 "type": "message",
 "status": "completed",
 "id": "msg_1FAQyZcWgsBdmgJgiXmDyavWimUs8irClHhfCf02Yxyy9N2y"
 }
 ],
 "usage": {
 "input_tokens": 26,
 "input_tokens_details": {
 "cached_tokens": 0
 },
 "output_tokens": 85,
 "output_tokens_details": {
 "reasoning_tokens": 0
 },
 "total_tokens": 111
 },
 "tool_choice": null,
 "temperature": 1,
 "top_p": 1 
}

The response includes conversation and message identifiers, content, and usage statistics.

To retrieve the conversation items, send this request:

GET http://localhost:5209/v1/conversations/conv_E9Ma6nQpRzYxRHxRRqoOWWsDjZVyZfKxlHhfCf02Yxyy9N2y/items?include=string

This returns a JSON response containing both input and output messages:

{
 "object": "list",
 "data": [
 {
 "role": "assistant",
 "content": [
 {
 "type": "output_text",
 "text": "Arrr, matey! As a pirate, I be all about respect for the crew, no matter their gender! We sail these seas together, and every hand on deck be valuable. A true buccaneer knows that fairness and equality be what keeps the ship afloat. So, in me own way, I’d say I be supportin’ all hearty souls who seek what be right! What say ye?",
 "annotations": [],
 "logprobs": []
 }
 ],
 "type": "message",
 "status": "completed",
 "id": "msg_1FAQyZcWgsBdmgJgiXmDyavWimUs8irClHhfCf02Yxyy9N2y"
 },
 {
 "role": "user",
 "content": [
 {
 "type": "input_text",
 "text": "are you a feminist?"
 }
 ],
 "type": "message",
 "status": "completed",
 "id": "msg_iLVtSEJL0Nd2b3ayr9sJWeV9VyEASMlilHhfCf02Yxyy9N2y"
 }
 ],
 "first_id": "msg_1FAQyZcWgsBdmgJgiXmDyavWimUs8irClHhfCf02Yxyy9N2y",
 "last_id": "msg_lUpquo0Hisvo6cLdFXMKdYACqFRWcFDrlHhfCf02Yxyy9N2y",
 "has_more": false
}

Exposing Multiple Agents

You can expose multiple agents simultaneously using both protocols:

var mathAgent = builder.AddAIAgent("math", instructions: "You are a math expert.");
var scienceAgent = builder.AddAIAgent("science", instructions: "You are a science expert.");

// Add both protocols
builder.AddOpenAIChatCompletions();
builder.AddOpenAIResponses();

var app = builder.Build();

// Expose both agents via Chat Completions
app.MapOpenAIChatCompletions(mathAgent);
app.MapOpenAIChatCompletions(scienceAgent);

// Expose both agents via Responses
app.MapOpenAIResponses(mathAgent);
app.MapOpenAIResponses(scienceAgent);

Agents will be available at:

Chat Completions: /math/v1/chat/completions and /science/v1/chat/completions

Responses: /math/v1/responses and /science/v1/responses

Custom Endpoints

You can customize the endpoint paths:

// Custom path for Chat Completions
app.MapOpenAIChatCompletions(mathAgent, path: "/api/chat");

// Custom path for Responses
app.MapOpenAIResponses(scienceAgent, responsesPath: "/api/responses");

Connecting to OpenAI-Compatible Endpoints (Python)

The Python OpenAIChatCompletionClient and OpenAIChatClient both support a base_url parameter, enabling you to connect to any OpenAI-compatible endpoint — including self-hosted agents, local inference servers (Ollama, LM Studio, vLLM), or third-party OpenAI-compatible APIs.

pip install agent-framework

Chat Completions Client

Use OpenAIChatCompletionClient with base_url to point to any Chat Completions-compatible server:

import asyncio
from agent_framework import tool
from agent_framework.openai import OpenAIChatCompletionClient

@tool(approval_mode="never_require")
def get_weather(location: str) -> str:
 """Get the weather for a location."""
 return f"Weather in {location}: sunny, 22°C"

async def main():
 # Point to any OpenAI-compatible endpoint
 agent = OpenAIChatCompletionClient(
 base_url="http://localhost:11434/v1/", # e.g. Ollama
 api_key="not-needed", # placeholder for local servers
 model="llama3.2",
 ).as_agent(
 name="WeatherAgent",
 instructions="You are a helpful weather assistant.",
 tools=get_weather,
 )

 response = await agent.run("What's the weather in Seattle?")
 print(response)

asyncio.run(main())

Responses Client

Use OpenAIChatClient with base_url for endpoints that support the Responses API:

import asyncio
from agent_framework.openai import OpenAIChatClient

async def main():
 agent = OpenAIChatClient(
 base_url="https://your-hosted-agent.example.com/v1/",
 api_key="your-api-key",
 model="gpt-4o-mini",
 ).as_agent(
 name="Assistant",
 instructions="You are a helpful assistant.",
 )

 # Non-streaming
 response = await agent.run("Hello!")
 print(response)

 # Streaming
 async for chunk in agent.run("Tell me a joke", stream=True):
 if chunk.text:
 print(chunk.text, end="", flush=True)

asyncio.run(main())

Common OpenAI-Compatible Servers

The base_url approach works with any server exposing the OpenAI Chat Completions format:

Server
Base URL
Notes

Ollama
http://localhost:11434/v1/
Local inference, no API key needed

LM Studio
http://localhost:1234/v1/
Local inference with GUI

vLLM
http://localhost:8000/v1/
High-throughput serving

Microsoft Foundry
Your deployment endpoint
Uses Azure credentials

Hosted Agent Framework agents
Your agent endpoint
.NET agents exposed via MapOpenAIChatCompletions

Note

You can also set the OPENAI_BASE_URL environment variable instead of passing base_url directly. The client will use it automatically.

Using Azure OpenAI Clients

Use the same generic OpenAI clients for Azure OpenAI by passing explicit Azure routing inputs instead of base_url:

import os
from agent_framework.openai import OpenAIChatClient
from azure.identity import AzureCliCredential

agent = OpenAIChatClient(
 model=os.environ["AZURE_OPENAI_CHAT_MODEL"],
 azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
 api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
 credential=AzureCliCredential(),
).as_agent(
 name="Assistant",
 instructions="You are a helpful assistant.",
)

Configure with environment variables:

export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_CHAT_MODEL="gpt-4o-mini"
export AZURE_OPENAI_API_VERSION="your-api-version"

OpenAIChatClient prefers AZURE_OPENAI_CHAT_MODEL; AZURE_OPENAI_MODEL remains the shared fallback if you need one.

See Also

Integrations Overview

A2A Integration

OpenAI Chat Completions API Reference

OpenAI Responses API Reference

Next steps

Hyperlight CodeAct

Feedback

 Was this page helpful?

 Yes

 No

 No

 Need help with this topic?

 Want to try using Ask Learn to clarify or guide you through this topic?

 Ask Learn

 Ask Learn

 Suggest a fix? 

 Additional resources

 Last updated on 
 2026-04-02

In this article

Was this page helpful?

 Yes

 No

 No

 Need help with this topic?

 Want to try using Ask Learn to clarify or guide you through this topic?

 Ask Learn

 Ask Learn

 Suggest a fix? 

 en-us

 Your Privacy Choices

 Theme

 Light 

 Dark 

 High contrast 

 AI Disclaimer

 Previous Versions

 Blog

 Contribute

 Privacy

 Consumer Health Privacy

 Terms of Use

 Trademarks

© Microsoft 2026
````

</details>
