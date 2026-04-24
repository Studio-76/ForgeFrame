# API-AzureOpenAI

> Neu erzeugt aus offiziellen Referenzdokumentationen. Falls kein Reverse-Engineering-Dokument vorhanden war, enthält diese Datei primär offizielle Schnittstelleninformationen und Implementierungshinweise.


---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/AzureOpenAI`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – AzureOpenAI

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### Azure OpenAI in Microsoft Foundry Models REST API reference - Microsoft Foundry | Microsoft Learn
- Quelle: Pflichtquelle
- Original-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- Lokale Datei(en): HTML: `reference.html`, Text: `reference.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Azure OpenAI reference
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html`

### Azure OpenAI in Microsoft Foundry Models v1 API - Microsoft Foundry | Microsoft Learn
- Quelle: zusätzlich gefunden
- Original-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle
- Lokale Datei(en): HTML: `api-version-lifecycle.html`, Text: `api-version-lifecycle.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html`
- Hinweise: zusätzlich gefunden

### Resource Manager | Microsoft Learn
- Quelle: zusätzlich gefunden
- Original-URL: https://learn.microsoft.com/en-us/rest/api/aifoundry/accountmanagement/operation-groups?view=rest-aifoundry-accountmanagement-2025-06-01
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/rest/api/aifoundry/accountmanagement/operation-groups?view=rest-aifoundry-accountmanagement-2025-06-01
- Lokale Datei(en): HTML: `operation-groups.html`, Text: `operation-groups.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html`
- Hinweise: zusätzlich gefunden

### Erkannte URLs und Basisadressen

- `https://learn.microsoft.com/en-us/azure/foundry/openai/reference`
- `https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle`
- `https://learn.microsoft.com/en-us/rest/api/aifoundry/accountmanagement/operation-groups?view=rest-aifoundry-accountmanagement-2025-06-01`
- `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/`
- `https://ai.azure.com/.default`
- `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses`
- `https://YOUR-RESOURCE-NAME.services.ai.azure.com/openai/v1/`
- `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1`
- `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/chat/completions`
- `https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2024-06-01`
- `https://{endpoint`
- `https://aoairesource.openai.azure.com.`
- `https://{your-resource-name`
- `https://your-search-endpoint.search.windows.net/`
- `https://contoso.blob.windows.net/container/contoso.txt`
- `https://contoso.blob.windows.net/container/contoso2.txt`
- `https://dalletipusw2.blob.core.windows.net/private/images/e5451cc6-b1ad-4747-bd46-b89a3a3b8bc3/generated_00.png?se=2023-10-27T17%3A45%3A09Z&...`

### Erkannte Endpunkte / Pfade

- `/openai/v1/evals`
- `/evals`
- `/openai/v1/fine_tuning/alpha/graders/`
- `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"`
- `/openai/v1`
- `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/`
- `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/")`
- `POST https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses`
- `https://YOUR-RESOURCE-NAME.services.ai.azure.com/openai/v1/`
- `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1")`
- `https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1"`
- `POST https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/chat/completions`
- `POST https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2024-06-01`
- `POST https://{endpoint}/openai/deployments/{deployment-id}/embeddings?api-version=2024-10-21`
- `POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21`
- `/azure/ai-foundry/openai/concepts/models`

### Erkannte Umgebungsvariablen / Konstanten

- `REST`
- `AZURE_OPENAI_API_KEY`
- `YOUR`
- `RESOURCE`
- `NAME`
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI001`
- `POST`
- `AZURE_OPENAI_AUTH_TOKEN`
- `ASSISTANT`
- `TODO`
- `DALL`
- `YOUR_AUTH_TOKEN`
- `YYYY`
- `YOUR_RESOURCE_NAME`
- `YOUR_DEPLOYMENT_NAME`
- `DONE`
- `SCRAM`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

# Index – AzureOpenAI

---

**Quelle `INDEX.md`**

### Azure OpenAI in Microsoft Foundry Models REST API reference - Microsoft Foundry | Microsoft Learn
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/reference

---

**Quelle `INDEX.md`**

- Original-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- Lokale Datei(en): HTML: `reference.html`, Text: `reference.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Azure OpenAI reference
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

### Azure OpenAI in Microsoft Foundry Models v1 API - Microsoft Foundry | Microsoft Learn
- Quelle: zusätzlich gefunden

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle

---

**Quelle `INDEX.md`**

- Original-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle
- Lokale Datei(en): HTML: `api-version-lifecycle.html`, Text: `api-version-lifecycle.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://learn.microsoft.com/en-us/azure/foundry/openai/reference
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://learn.microsoft.com/en-us/rest/api/aifoundry/accountmanagement/operation-groups?view=rest-aifoundry-accountmanagement-2025-06-01
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/rest/api/aifoundry/accountmanagement/operation-groups?view=rest-aifoundry-accountmanagement-2025-06-01

---

**Quelle `INDEX.md`**

- Original-URL: https://learn.microsoft.com/en-us/rest/api/aifoundry/accountmanagement/operation-groups?view=rest-aifoundry-accountmanagement-2025-06-01
- Bereinigte Download-URL: https://learn.microsoft.com/en-us/rest/api/aifoundry/accountmanagement/operation-groups?view=rest-aifoundry-accountmanagement-2025-06-01
- Lokale Datei(en): HTML: `operation-groups.html`, Text: `operation-groups.txt`

---

**Quelle `api-version-lifecycle.txt`**

Azure OpenAI in Microsoft Foundry Models v1 API - Microsoft Foundry | Microsoft Learn

---

**Quelle `api-version-lifecycle.txt`**

Access to this page requires authorization. You can try signing in or changing directories.

---

**Quelle `api-version-lifecycle.txt`**

Access to this page requires authorization. You can try changing directories.

---

**Quelle `api-version-lifecycle.txt`**

Azure OpenAI in Microsoft Foundry Models v1 API

---

**Quelle `api-version-lifecycle.txt`**

This article shows you how to use the v1 Azure OpenAI API. The v1 API simplifies authentication, removes the need for dated api-version parameters, and supports cross-provider model calls.

---

**Quelle `api-version-lifecycle.txt`**

A Foundry resource or Azure OpenAI resource deployed in a supported region

---

**Quelle `api-version-lifecycle.txt`**

For Microsoft Entra ID authentication: the Cognitive Services OpenAI User role assigned to your identity. For more information, see Role-based access control for Azure OpenAI

---

**Quelle `api-version-lifecycle.txt`**

Previously, Azure OpenAI received monthly updates of new API versions. Taking advantage of new features required constantly updating code and environment variables with each new API release. Azure OpenAI also required the extra step of using Azure specific clients which created overhead when migrating code between OpenAI and Azure OpenAI.

---

**Quelle `api-version-lifecycle.txt`**

Starting in August 2025, you can opt in to the next generation v1 Azure OpenAI APIs which add support for:

---

**Quelle `api-version-lifecycle.txt`**

OpenAI client support with minimal code changes to swap between OpenAI and Azure OpenAI when using key-based authentication.

---

**Quelle `api-version-lifecycle.txt`**

OpenAI client support for token based authentication and automatic token refresh without the need to take a dependency on a separate Azure OpenAI client.

---

**Quelle `api-version-lifecycle.txt`**

Make chat completions calls with models from other providers like DeepSeek and Grok which support the v1 chat completions syntax.

---

**Quelle `api-version-lifecycle.txt`**

Access to new API calls that are still in preview will be controlled by passing feature specific preview headers allowing you to opt in to the features you want, without having to swap API versions. Alternatively, some features will indicate preview status through their API path and don't require an additional header.

---

**Quelle `api-version-lifecycle.txt`**

When /openai/v1/evals was previously in preview it required passing an "aoai-evals":"preview" header. /evals is no longer in preview.

---

**Quelle `api-version-lifecycle.txt`**

/openai/v1/fine_tuning/alpha/graders/ is in preview and requires no custom header due to the presence of alpha in the API path.

---

**Quelle `api-version-lifecycle.txt`**

API Key:

---

**Quelle `api-version-lifecycle.txt`**

import os
from openai import OpenAI

---

**Quelle `api-version-lifecycle.txt`**

client = OpenAI(
 api_key=os.getenv("AZURE_OPENAI_API_KEY"),

---

**Quelle `api-version-lifecycle.txt`**

client = OpenAI(
 api_key=os.getenv("AZURE_OPENAI_API_KEY"),
 base_url="https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"

---

**Quelle `api-version-lifecycle.txt`**

api_key=os.getenv("AZURE_OPENAI_API_KEY"),
 base_url="https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"
)

---

**Quelle `api-version-lifecycle.txt`**

response = client.responses.create( 
 model="gpt-4.1-nano", # Replace with your model deployment name

---

**Quelle `api-version-lifecycle.txt`**

OpenAI() client is used instead of AzureOpenAI().

---

**Quelle `api-version-lifecycle.txt`**

base_url passes the Azure OpenAI endpoint and /openai/v1 is appended to the endpoint address.

---

**Quelle `api-version-lifecycle.txt`**

API Key with environment variables:

---

**Quelle `api-version-lifecycle.txt`**

Set the following environment variables before running the code:

---

**Quelle `api-version-lifecycle.txt`**

OPENAI_BASE_URL
https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/

---

**Quelle `api-version-lifecycle.txt`**

OPENAI_API_KEY
Your Azure OpenAI API key

---

**Quelle `api-version-lifecycle.txt`**

client = OpenAI()

---

**Quelle `api-version-lifecycle.txt`**

Handling automatic token refresh was previously handled through use of the AzureOpenAI() client. The v1 API removes this dependency, by adding automatic token refresh support to the OpenAI() client.

---

**Quelle `api-version-lifecycle.txt`**

from openai import OpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

---

**Quelle `api-version-lifecycle.txt`**

token_provider = get_bearer_token_provider(
 DefaultAzureCredential(), "https://ai.azure.com/.default"

---

**Quelle `api-version-lifecycle.txt`**

token_provider = get_bearer_token_provider(
 DefaultAzureCredential(), "https://ai.azure.com/.default"
)

---

**Quelle `api-version-lifecycle.txt`**

client = OpenAI( 
 base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",

---

**Quelle `api-version-lifecycle.txt`**

client = OpenAI( 
 base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/", 
 api_key = token_provider

---

**Quelle `api-version-lifecycle.txt`**

base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/", 
 api_key = token_provider 
)

---

**Quelle `api-version-lifecycle.txt`**

response = client.responses.create(
 model="gpt-4.1-nano",

---

**Quelle `api-version-lifecycle.txt`**

api_key parameter is set to token_provider, enabling automatic retrieval and refresh of an authentication token instead of using a static API key.

---

**Quelle `api-version-lifecycle.txt`**

OpenAIClient client = new(
 new ApiKeyCredential("{your-api-key}"),

---

**Quelle `api-version-lifecycle.txt`**

OpenAIClient client = new(
 new ApiKeyCredential("{your-api-key}"),
 new OpenAIClientOptions()

---

**Quelle `api-version-lifecycle.txt`**

new ApiKeyCredential("{your-api-key}"),
 new OpenAIClientOptions()
 {

---

**Quelle `operation-groups.txt`**

Access to this page requires authorization. You can try signing in or changing directories.

---

**Quelle `operation-groups.txt`**

Access to this page requires authorization. You can try changing directories.

---

**Quelle `operation-groups.txt`**

Encryption Scopes

---

**Quelle `operation-groups.txt`**

Models

---

**Quelle `operation-groups.txt`**

Private Endpoint Connections

---

**Quelle `operation-groups.txt`**

Usages

---

**Quelle `reference.txt`**

Azure OpenAI in Microsoft Foundry Models REST API reference - Microsoft Foundry | Microsoft Learn

---

**Quelle `reference.txt`**

Access to this page requires authorization. You can try signing in or changing directories.

---

**Quelle `reference.txt`**

Access to this page requires authorization. You can try changing directories.

---

**Quelle `reference.txt`**

Azure OpenAI in Microsoft Foundry Models REST API reference

---

**Quelle `reference.txt`**

This article provides details on the inference REST API endpoints for Azure OpenAI.

---

**Quelle `reference.txt`**

Managing and interacting with Azure OpenAI models and resources is divided across three primary API surfaces:

---

**Quelle `reference.txt`**

Each API surface/specification encapsulates a different set of Azure OpenAI capabilities. Each API has its own unique set of preview and stable/generally available (GA) API releases. Preview releases currently tend to follow a monthly cadence.

---

**Quelle `reference.txt`**

Authentication

---

**Quelle `reference.txt`**

Azure OpenAI provides two methods for authentication. You can use either API Keys or Microsoft Entra ID.

---

**Quelle `reference.txt`**

API Key authentication: For this type of authentication, all API requests must include the API Key in the api-key HTTP header. The Quickstart provides guidance for how to make calls with this type of authentication.

---

**Quelle `reference.txt`**

Microsoft Entra ID authentication: You can authenticate an API call using a Microsoft Entra token. Authentication tokens are included in a request as the Authorization header. The token provided must be preceded by Bearer, for example Bearer YOUR_AUTH_TOKEN. You can read our how-to guide on authenticating with Microsoft Entra ID.

---

**Quelle `reference.txt`**

POST https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2024-06-01

---

**Quelle `reference.txt`**

The rest of the article covers the GA release of the Azure OpenAI data plane inference specification, 2024-10-21.

---

**Quelle `reference.txt`**

Completions

---

**Quelle `reference.txt`**

POST https://{endpoint}/openai/deployments/{deployment-id}/completions?api-version=2024-10-21

---

**Quelle `reference.txt`**

endpoint
path

---

**Quelle `reference.txt`**

url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

---

**Quelle `reference.txt`**

Request Header

---

**Quelle `reference.txt`**

string
Provide Azure OpenAI API key here

---

**Quelle `reference.txt`**

Content-Type: application/json

---

**Quelle `reference.txt`**

string or array
The prompt(s) to generate completions for, encoded as a string, array of strings, array of tokens, or array of token arrays.

---

**Quelle `reference.txt`**

integer
Generates best_of completions server-side and returns the "best" (the one with the highest log probability per token). Results can't be streamed.

---

**Quelle `reference.txt`**

When used with n, best_of controls the number of candidate completions and n specifies how many to return â€“ best_of must be greater than n.

---

**Quelle `reference.txt`**

Note: Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for max_tokens and stop.

---

**Quelle `reference.txt`**

number
Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

---

**Quelle `reference.txt`**

object
Modify the likelihood of specified tokens appearing in the completion.

---

**Quelle `reference.txt`**

Accepts a JSON object that maps tokens (specified by their token ID in the GPT tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.

---

**Quelle `reference.txt`**

As an example, you can pass {"50256": -100} to prevent the <|endoftext|> token from being generated.

---

**Quelle `reference.txt`**

integer
Include the log probabilities on the logprobs most likely output tokens, as well the chosen tokens. For example, if logprobs is 5, the API will return a list of the five most likely tokens. The API will always return the logprob of the sampled token, so there may be up to logprobs+1 elements in the response.

---

**Quelle `reference.txt`**

max_tokens
integer

---

**Quelle `reference.txt`**

integer
The maximum number of tokens that can be generated in the completion.

---

**Quelle `reference.txt`**

The token count of your prompt plus max_tokens can't exceed the model's context length.
No

---

**Quelle `reference.txt`**

integer
How many completions to generate for each prompt.

---

**Quelle `reference.txt`**

number
Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.

---

**Quelle `reference.txt`**

string or array
Up to four sequences where the API will stop generating further tokens. The returned text won't contain the stop sequence.

---

**Quelle `reference.txt`**

stream
boolean

---

**Quelle `reference.txt`**

boolean
Whether to stream back partial progress. If set, tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message.
No

---

**Quelle `reference.txt`**

number
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

---

**Quelle `reference.txt`**

Responses

---

**Quelle `reference.txt`**

Content-Type
Type

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `api-version-lifecycle.txt`**

````text
api_key=os.getenv("AZURE_OPENAI_API_KEY"),
````

---

**Quelle `api-version-lifecycle.txt`**

````text
base_url="https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"
````

---

**Quelle `api-version-lifecycle.txt`**

````text
base_url passes the Azure OpenAI endpoint and /openai/v1 is appended to the endpoint address.
````

---

**Quelle `api-version-lifecycle.txt`**

````text
base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",
````

---

**Quelle `api-version-lifecycle.txt`**

````text
api_key = token_provider
````

---

**Quelle `api-version-lifecycle.txt`**

````text
api_key parameter is set to token_provider, enabling automatic retrieval and refresh of an authentication token instead of using a static API key.
````

---

**Quelle `api-version-lifecycle.txt`**

````text
curl -X POST https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses \
````

---

**Quelle `api-version-lifecycle.txt`**

````text
base_url will accept both https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/ and https://YOUR-RESOURCE-NAME.services.ai.azure.com/openai/v1/ formats.
````

---

**Quelle `api-version-lifecycle.txt`**

````text
api_key=token_provider,
````

---

**Quelle `api-version-lifecycle.txt`**

````text
curl -X POST https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/chat/completions \
````

---

**Quelle `reference.txt`**

````text
api_key
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/AzureOpenAI/api-version-lifecycle.txt</code></summary>

````text
Azure OpenAI in Microsoft Foundry Models v1 API - Microsoft Foundry | Microsoft Learn

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

Azure OpenAI in Microsoft Foundry Models v1 API

 Feedback

 Summarize this article for me

 In this article

This article shows you how to use the v1 Azure OpenAI API. The v1 API simplifies authentication, removes the need for dated api-version parameters, and supports cross-provider model calls.

Note

New API response objects might be added to the API response at any time. We recommend you only parse the response objects you require.

Prerequisites

An Azure subscription - Create one for free

A Foundry resource or Azure OpenAI resource deployed in a supported region

At least one model deployment

For Microsoft Entra ID authentication: the Cognitive Services OpenAI User role assigned to your identity. For more information, see Role-based access control for Azure OpenAI

API evolution

Previously, Azure OpenAI received monthly updates of new API versions. Taking advantage of new features required constantly updating code and environment variables with each new API release. Azure OpenAI also required the extra step of using Azure specific clients which created overhead when migrating code between OpenAI and Azure OpenAI.

Starting in August 2025, you can opt in to the next generation v1 Azure OpenAI APIs which add support for:

Ongoing access to the latest features with no need to specify new api-version's each month.

Faster API release cycle with new features launching more frequently.

OpenAI client support with minimal code changes to swap between OpenAI and Azure OpenAI when using key-based authentication.

OpenAI client support for token based authentication and automatic token refresh without the need to take a dependency on a separate Azure OpenAI client.

Make chat completions calls with models from other providers like DeepSeek and Grok which support the v1 chat completions syntax.

Access to new API calls that are still in preview will be controlled by passing feature specific preview headers allowing you to opt in to the features you want, without having to swap API versions. Alternatively, some features will indicate preview status through their API path and don't require an additional header.

Examples:

When /openai/v1/evals was previously in preview it required passing an "aoai-evals":"preview" header. /evals is no longer in preview.

/openai/v1/fine_tuning/alpha/graders/ is in preview and requires no custom header due to the presence of alpha in the API path.

For the initial v1 Generally Available (GA) API launch, only a subset of the inference and authoring API capabilities are supported. All GA features are supported for use in production. Support for more capabilities is being added rapidly.

Code changes

Python

C#

JavaScript

Go

Java

REST

v1 API

Python v1 examples

API Key:

import os
from openai import OpenAI

client = OpenAI(
 api_key=os.getenv("AZURE_OPENAI_API_KEY"),
 base_url="https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"
)

response = client.responses.create( 
 model="gpt-4.1-nano", # Replace with your model deployment name 
 input="This is a test.",
)

print(response.model_dump_json(indent=2)) 

Key differences from the previous API:

OpenAI() client is used instead of AzureOpenAI().

base_url passes the Azure OpenAI endpoint and /openai/v1 is appended to the endpoint address.

api-version is no longer a required parameter with the v1 GA API.

API Key with environment variables:

Set the following environment variables before running the code:

Variable
Value

OPENAI_BASE_URL
https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/

OPENAI_API_KEY
Your Azure OpenAI API key

Then create the client without parameters:

client = OpenAI()

Microsoft Entra ID:

Important

Handling automatic token refresh was previously handled through use of the AzureOpenAI() client. The v1 API removes this dependency, by adding automatic token refresh support to the OpenAI() client.

from openai import OpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
 DefaultAzureCredential(), "https://ai.azure.com/.default"
)

client = OpenAI( 
 base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/", 
 api_key = token_provider 
)

response = client.responses.create(
 model="gpt-4.1-nano",
 input= "This is a test" 
)

print(response.model_dump_json(indent=2)) 

base_url passes the Azure OpenAI endpoint and /openai/v1 is appended to the endpoint address.

api_key parameter is set to token_provider, enabling automatic retrieval and refresh of an authentication token instead of using a static API key.

v1 API

C# v1 examples

API Key:

OpenAIClient client = new(
 new ApiKeyCredential("{your-api-key}"),
 new OpenAIClientOptions()
 {
 Endpoint = new("https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"),
 })

Microsoft Entra ID:

#pragma warning disable OPENAI001

BearerTokenPolicy tokenPolicy = new(
 new DefaultAzureCredential(),
 "https://ai.azure.com/.default");
OpenAIClient client = new(
 authenticationPolicy: tokenPolicy,
 options: new OpenAIClientOptions()
 {
 Endpoint = new("https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"),
 })

v1 API

JavaScript v1 examples

API Key:

const client = new OpenAI({
 baseURL: "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",
 apiKey: "{your-api-key}" 
});

API Key with environment variables set for OPENAI_BASE_URL and OPENAI_API_KEY:

const client = new OpenAI();

Microsoft Entra ID:

const tokenProvider = getBearerTokenProvider(
 new DefaultAzureCredential(),
 'https://ai.azure.com/.default');
const client = new OpenAI({
 baseURL: "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",
 apiKey: tokenProvider
});

v1 API

Go v1 examples

API Key:

client := openai.NewClient(
 option.WithBaseURL("https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"),
 option.WithAPIKey("{your-api-key}")
)

API Key with environment variables set for OPENAI_BASE_URL and OPENAI_API_KEY:

client := openai.NewClient()

Microsoft Entra ID:

tokenCredential, err := azidentity.NewDefaultAzureCredential(nil)

client := openai.NewClient(
 option.WithBaseURL("https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"),
 azure.WithTokenCredential(tokenCredential)
)

Java v1 examples

v1 API

API Key:

OpenAIClient client = OpenAIOkHttpClient.builder()
 .baseUrl("https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/")
 .apiKey(apiKey)
 .build();

API Key with environment variables set for OPENAI_BASE_URL and OPENAI_API_KEY:

OpenAIClient client = OpenAIOkHttpClient.builder()
 .fromEnv()
 .build();

Microsoft Entra ID:

Credential tokenCredential = BearerTokenCredential.create(
 AuthenticationUtil.getBearerTokenSupplier(
 new DefaultAzureCredentialBuilder().build(),
 "https://ai.azure.com/.default"));
OpenAIClient client = OpenAIOkHttpClient.builder()
 .baseUrl("https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/")
 .credential(tokenCredential)
 .build();

v1 API

API Key:

curl -X POST https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses \
 -H "Content-Type: application/json" \
 -H "api-key: $AZURE_OPENAI_API_KEY" \
 -d '{
 "model": "gpt-4.1-nano",
 "input": "This is a test"
 }'

Microsoft Entra ID:

curl -X POST https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/responses \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN" \
 -d '{
 "model": "gpt-4o",
 "input": "This is a test"
 }'

Model support

For Azure OpenAI models we recommend using the Responses API, however, the v1 API also allows you to make chat completions calls with models from other providers like DeepSeek and Grok which support the OpenAI v1 chat completions syntax.

base_url will accept both https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/ and https://YOUR-RESOURCE-NAME.services.ai.azure.com/openai/v1/ formats.

Note

Responses API also works with Foundry Models sold directly by Azure, such as Microsoft AI, DeepSeek, and Grok models. To learn how to use the Responses API with these models, see How to generate text responses with Microsoft Foundry Models.

Python

C#

JavaScript

Go

Java

REST

from openai import OpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
 DefaultAzureCredential(), "https://ai.azure.com/.default"
)

client = OpenAI( 
 base_url = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/", 
 api_key=token_provider,
)
completion = client.chat.completions.create(
 model="MAI-DS-R1", # Replace with your model deployment name.
 messages=[
 {"role": "system", "content": "You are a helpful assistant."},
 {"role": "user", "content": "Tell me about the attention is all you need paper"}
 ]
)

#print(completion.choices[0].message)
print(completion.model_dump_json(indent=2))

using Azure.Identity;
using OpenAI;
using OpenAI.Chat;
using System.ClientModel.Primitives;

#pragma warning disable OPENAI001

BearerTokenPolicy tokenPolicy = new(
 new DefaultAzureCredential(),
 "https://ai.azure.com/.default");

ChatClient client = new(
 model: "MAI-DS-R1", // Replace with your model deployment name.
 authenticationPolicy: tokenPolicy,
 options: new OpenAIClientOptions() { 
 
 Endpoint = new Uri("https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1")
 }
);

ChatCompletion completion = client.CompleteChat("Tell me about the attention is all you need paper");

Console.WriteLine($"[ASSISTANT]: {completion.Content[0].Text}");

import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { OpenAI } from "openai";

const tokenProvider = getBearerTokenProvider(
 new DefaultAzureCredential(),
 'https://ai.azure.com/.default');
const client = new OpenAI({
 baseURL: "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/",
 apiKey: tokenProvider
});

const messages = [
 { role: 'system', content: 'You are a helpful assistant.' },
 { role: 'user', content: 'Tell me about the attention is all you need paper' }
];

// Make the API request with top-level await
const result = await client.chat.completions.create({ 
 messages, 
 model: 'MAI-DS-R1', // model deployment name
 max_tokens: 100 
});

// Print the full response
console.log('Full response:', result);

// Print just the message content from the response
console.log('Response content:', result.choices[0].message.content);

package main

import (
 "context"
 "fmt"
 "log"

 "github.com/Azure/azure-sdk-for-go/sdk/azidentity"
 "github.com/openai/openai-go/v3"
 "github.com/openai/openai-go/v3/azure"
 "github.com/openai/openai-go/v3/option"
)

func main() {
 // Create an Azure credential
 tokenCredential, err := azidentity.NewDefaultAzureCredential(nil)
 if err != nil {
 log.Fatalf("Failed to create credential: %s", err)
 }

 // Create a client with Azure OpenAI endpoint and token credential
 client := openai.NewClient(
 option.WithBaseURL("https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"),
 azure.WithTokenCredential(tokenCredential),
 )

 // Make a completion request
 chatCompletion, err := client.Chat.Completions.New(context.TODO(), openai.ChatCompletionNewParams{
 Messages: []openai.ChatCompletionMessageParamUnion{
 openai.UserMessage("Explain what the bitter lesson is?"),
 },
 Model: "MAI-DS-R1", // Use your deployed model name on Azure
 })
 if err != nil {
 log.Fatalf("Failed to get chat completions: %s", err)
 }

 fmt.Println(chatCompletion.Choices[0].Message.Content)
}

package com.example;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.ChatModel;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionCreateParams;

public class OpenAITest {
 public static void main(String[] args) {
 // Get API key from environment variable for security
 String apiKey = System.getenv("OPENAI_API_KEY");
 String resourceName = "https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1";
 String modelDeploymentName = "MAI-DS-R1"; //replace with your model deployment name

 try {
 OpenAIClient client = OpenAIOkHttpClient.builder()
 .baseUrl(resourceName)
 .apiKey(apiKey)
 .build();

 ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
 .addUserMessage("Explain what the bitter lesson is?")
 .model(modelDeploymentName)
 .build();
 ChatCompletion chatCompletion = client.chat().completions().create(params);
 }
 }
}

curl -X POST https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/chat/completions \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $AZURE_OPENAI_AUTH_TOKEN" \
 -d '{
 "model": "MAI-DS-R1",
 "messages": [
 {
 "role": "developer",
 "content": "You are a helpful assistant."
 },
 {
 "role": "user",
 "content": "Explain what the bitter lesson is?"
 }
 ]
 }'

v1 API support

v1 OpenAPI 3.0 spec

API version changelog

The following sections summarize changes between API versions.

Changes between v1 preview release and 2025-04-01-preview

v1 preview API

Video generation support

NEW Responses API features:

Remote Model Context Protocol (MCP) servers tool integration

Support for asynchronous background tasks

Encrypted reasoning items

Image generation

Changes between 2025-04-01-preview and 2025-03-01-preview

GPT-image-1 support

Reasoning summary for o3 and o4-mini

Evaluation API

Changes between 2025-03-01-preview and 2025-02-01-preview

Responses API

Computer use

Changes between 2025-02-01-preview and 2025-01-01-preview

Stored completions (distillation API support).

Changes between 2025-01-01-preview and 2024-12-01-preview

prediction parameter added for predicted outputs support.

gpt-4o-audio-preview model support.

Changes between 2024-12-01-preview and 2024-10-01-preview

store, and metadata parameters added for stored completions support.

reasoning_effort added for latest reasoning models.

user_security_context added for Microsoft Defender for Cloud integration.

Changes between 2024-09-01-preview and 2024-08-01-preview

max_completion_tokens added to support o1-preview and o1-mini models. max_tokens doesn't work with the o1 series models.

parallel_tool_calls added.

completion_tokens_details & reasoning_tokens added.

stream_options & include_usage added.

Changes between 2024-07-01-preview and 2024-08-01-preview API specification

Structured outputs support.

Large file upload API added.

On your data changes:

Mongo DB integration.

role_information parameter removed.

rerank_score added to citation object.

AML datasource removed.

AI Search vectorization integration improvements.

Changes between 2024-05-01-preview and 2024-07-01-preview API specification

Batch API support added

Vector store chunking strategy parameters

max_num_results that the file search tool should output.

Changes between 2024-04-01-preview and 2024-05-01-preview API specification

Assistants v2 support - File search tool and vector storage

Fine-tuning checkpoints, seed, events

On your data updates

DALL-E 2 now supports model deployment and can be used with the latest preview API.

Content filtering updates

Changes between 2024-03-01-preview and 2024-04-01-preview API specification

Breaking Change: Enhancements parameters removed. This impacts the gpt-4 Version: vision-preview model.

timestamp_granularities parameter added.

audioWord object added.

Additional TTS response_formats: wav & pcm.

Known issues

The 2025-04-01-preview Azure OpenAI spec uses OpenAPI 3.1. It's a known issue that this version isn't fully supported by Azure API Management.

Next steps

Supported programming languages for the v1 API

Foundry Models sold directly by Azure

Working with Azure OpenAI models

Azure OpenAI quotas and limits

v1 OpenAPI 3.0 spec

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
 2026-03-09

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


<details>
<summary>Textanlage: <code>OpenAI/API/AzureOpenAI/operation-groups.txt</code></summary>

````text
Resource Manager | Microsoft Learn

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

Resource Manager

 Feedback

 Summarize this article for me

 In this article

REST Operation Groups

Operation Group

Account Capability Hosts

Account Connections

Accounts

Check Domain Availability

Check Sku Availability

Commitment Plans

Commitment Tiers

Defender For AI Settings

Deleted Accounts

Deployments

Encryption Scopes

Location Based Model Capacities

Model Capacities

Models

Network Security Perimeter Configurations

Operations

Private Endpoint Connections

Private Link Resources

Project Capability Hosts

Project Connections

Projects

Rai Blocklist Items

Rai Blocklists

Rai Content Filters

Rai Policies

Resource Skus

Usages

calculate Model Capacity

 Additional resources

 Last updated on 
 2025-08-26

In this article

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


<details>
<summary>Textanlage: <code>OpenAI/API/AzureOpenAI/reference.txt</code></summary>

````text
Azure OpenAI in Microsoft Foundry Models REST API reference - Microsoft Foundry | Microsoft Learn

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

Azure OpenAI in Microsoft Foundry Models REST API reference

 Feedback

 Summarize this article for me

 In this article

This article provides details on the inference REST API endpoints for Azure OpenAI.

API specs

Managing and interacting with Azure OpenAI models and resources is divided across three primary API surfaces:

Control plane

Data plane - authoring

Data plane - inference

Each API surface/specification encapsulates a different set of Azure OpenAI capabilities. Each API has its own unique set of preview and stable/generally available (GA) API releases. Preview releases currently tend to follow a monthly cadence.

Important

There is now a new preview inference API. Learn more in our API lifecycle guide.

API
Latest preview release
Latest GA release
Specifications
Description

Control plane
2025-07-01-preview
2025-06-01
Spec files
The control plane API is used for operations like creating resources, model deployment, and other higher level resource management tasks. The control plane also governs what is possible to do with capabilities like Azure Resource Manager, Bicep, Terraform, and Azure CLI.

Data plane
v1 preview
v1
Spec files
The data plane API controls inference and authoring operations.

Authentication

Azure OpenAI provides two methods for authentication. You can use either API Keys or Microsoft Entra ID.

API Key authentication: For this type of authentication, all API requests must include the API Key in the api-key HTTP header. The Quickstart provides guidance for how to make calls with this type of authentication.

Microsoft Entra ID authentication: You can authenticate an API call using a Microsoft Entra token. Authentication tokens are included in a request as the Authorization header. The token provided must be preceded by Bearer, for example Bearer YOUR_AUTH_TOKEN. You can read our how-to guide on authenticating with Microsoft Entra ID.

REST API versioning

The service APIs are versioned using the api-version query parameter. All versions follow the YYYY-MM-DD date structure. For example:

POST https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2024-06-01

Data plane inference

The rest of the article covers the GA release of the Azure OpenAI data plane inference specification, 2024-10-21.

If you're looking for documentation on the latest preview API release, refer to the latest preview data plane inference API

Completions

POST https://{endpoint}/openai/deployments/{deployment-id}/completions?api-version=2024-10-21

Creates a completion for the provided prompt, parameters, and chosen model.

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the model which was deployed.

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: application/json

Name
Type
Description
Required
Default

prompt
string or array
The prompt(s) to generate completions for, encoded as a string, array of strings, array of tokens, or array of token arrays.

Note that <|endoftext|> is the document separator that the model sees during training, so if a prompt isn't specified the model will generate as if from the beginning of a new document.

Yes

best_of
integer
Generates best_of completions server-side and returns the "best" (the one with the highest log probability per token). Results can't be streamed.

When used with n, best_of controls the number of candidate completions and n specifies how many to return â€“ best_of must be greater than n.

Note: Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for max_tokens and stop.

No
1

echo
boolean
Echo back the prompt in addition to the completion

No
False

frequency_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

No
0

logit_bias
object
Modify the likelihood of specified tokens appearing in the completion.

Accepts a JSON object that maps tokens (specified by their token ID in the GPT tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.

As an example, you can pass {"50256": -100} to prevent the <|endoftext|> token from being generated.

No
None

logprobs
integer
Include the log probabilities on the logprobs most likely output tokens, as well the chosen tokens. For example, if logprobs is 5, the API will return a list of the five most likely tokens. The API will always return the logprob of the sampled token, so there may be up to logprobs+1 elements in the response.

The maximum value for logprobs is 5.

No
None

max_tokens
integer
The maximum number of tokens that can be generated in the completion.

The token count of your prompt plus max_tokens can't exceed the model's context length.
No
16

n
integer
How many completions to generate for each prompt.

Note: Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for max_tokens and stop.

No
1

presence_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.

No
0

seed
integer
If specified, our system will make a best effort to sample deterministically, such that repeated requests with the same seed and parameters should return the same result.

Determinism isn't guaranteed, and you should refer to the system_fingerprint response parameter to monitor changes in the backend.

No

stop
string or array
Up to four sequences where the API will stop generating further tokens. The returned text won't contain the stop sequence.

No

stream
boolean
Whether to stream back partial progress. If set, tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message.
No
False

suffix
string
The suffix that comes after a completion of inserted text.

This parameter is only supported for gpt-3.5-turbo-instruct.

No
None

temperature
number
What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.

We generally recommend altering this or top_p but not both.

No
1

top_p
number
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

We generally recommend altering this or temperature but not both.

No
1

user
string
A unique identifier representing your end-user, which can help to monitor and detect abuse.

No

Responses

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
createCompletionResponse
Represents a completion response from the API. Note: both the streamed and nonstreamed response objects share the same shape (unlike the chat endpoint).

Status Code: default

Description: Service unavailable

Content-Type
Type
Description

application/json
errorResponse

Examples

Example

Creates a completion for the provided prompt, parameters, and chosen model.

POST https://{endpoint}/openai/deployments/{deployment-id}/completions?api-version=2024-10-21

{
 "prompt": [
 "tell me a joke about mango"
 ],
 "max_tokens": 32,
 "temperature": 1.0,
 "n": 1
}

Responses:
Status Code: 200

{
 "body": {
 "id": "cmpl-7QmVI15qgYVllxK0FtxVGG6ywfzaq",
 "created": 1686617332,
 "choices": [
 {
 "text": "es\n\nWhat do you call a mango who's in charge?\n\nThe head mango.",
 "index": 0,
 "finish_reason": "stop",
 "logprobs": null
 }
 ],
 "usage": {
 "completion_tokens": 20,
 "prompt_tokens": 6,
 "total_tokens": 26
 }
 }
}

Embeddings

POST https://{endpoint}/openai/deployments/{deployment-id}/embeddings?api-version=2024-10-21

Get a vector representation of a given input that can be easily consumed by machine learning models and algorithms.

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: application/json

Name
Type
Description
Required
Default

input
string or array
Input text to embed, encoded as a string or array of tokens. To embed multiple inputs in a single request, pass an array of strings or array of token arrays. The input must not exceed the max input tokens for the model (8,192 tokens for text-embedding-ada-002), can't be an empty string, and any array must be 2,048 dimensions or less.
Yes

user
string
A unique identifier representing your end-user, which can help monitoring and detecting abuse.
No

input_type
string
input type of embedding search to use
No

encoding_format
string
The format to return the embeddings in. Can be either float or base64. Defaults to float.
No

dimensions
integer
The number of dimensions the resulting output embeddings should have. Only supported in text-embedding-3 and later models.
No

Responses

Name
Type
Description
Required
Default

object
string

Yes

model
string

Yes

data
array

Yes

usage
object

Yes

Properties for usage

prompt_tokens

Name
Type
Description
Default

prompt_tokens
integer

total_tokens

Name
Type
Description
Default

total_tokens
integer

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
object

Examples

Example

Return the embeddings for a given prompt.

POST https://{endpoint}/openai/deployments/{deployment-id}/embeddings?api-version=2024-10-21

{
 "input": [
 "this is a test"
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "data": [
 {
 "index": 0,
 "embedding": [
 -0.012838088,
 -0.007421397,
 -0.017617522,
 -0.028278312,
 -0.018666342,
 0.01737855,
 -0.01821495,
 -0.006950092,
 -0.009937238,
 -0.038580645,
 0.010674067,
 0.02412286,
 -0.013647936,
 0.013189907,
 0.0021125758,
 0.012406612,
 0.020790534,
 0.00074595667,
 0.008397198,
 -0.00535031,
 0.008968075,
 0.014351576,
 -0.014086051,
 0.015055214,
 -0.022211088,
 -0.025198232,
 0.0065186154,
 -0.036350243,
 0.009180495,
 -0.009698266,
 0.009446018,
 -0.008463579,
 -0.0040426035,
 -0.03443847,
 -0.00091273896,
 -0.0019217303,
 0.002349888,
 -0.021560553,
 0.016515596,
 -0.015572986,
 0.0038666942,
 -8.432463e-05
 ]
 }
 ],
 "usage": {
 "prompt_tokens": 4,
 "total_tokens": 4
 }
 }
}

Chat completions

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

Creates a completion for the chat message

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the model which was deployed.

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: application/json

Name
Type
Description
Required
Default

temperature
number
What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.

We generally recommend altering this or top_p but not both.

No
1

top_p
number
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

We generally recommend altering this or temperature but not both.

No
1

stream
boolean
If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message.
No
False

stop
string or array
Up to four sequences where the API will stop generating further tokens.

No

max_tokens
integer
The maximum number of tokens that can be generated in the chat completion.

The total length of input tokens and generated tokens is limited by the model's context length.
No

max_completion_tokens
integer
An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.
No

presence_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.

No
0

frequency_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

No
0

logit_bias
object
Modify the likelihood of specified tokens appearing in the completion.

Accepts a JSON object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.

No
None

user
string
A unique identifier representing your end-user, which can help to monitor and detect abuse.

No

messages
array
A list of messages comprising the conversation so far.
Yes

data_sources
array
The configuration entries for Azure OpenAI chat extensions that use them.
 This additional specification is only compatible with Azure OpenAI.
No

logprobs
boolean
Whether to return log probabilities of the output tokens or not. If true, returns the log probabilities of each output token returned in the content of message.
No
False

top_logprobs
integer
An integer between 0 and 20 specifying the number of most likely tokens to return at each token position, each with an associated log probability. logprobs must be set to true if this parameter is used.
No

n
integer
How many chat completion choices to generate for each input message. Note that you'll be charged based on the number of generated tokens across all of the choices. Keep n as 1 to minimize costs.
No
1

parallel_tool_calls
ParallelToolCalls
Whether to enable parallel function calling during tool use.
No
True

response_format
ResponseFormatText or ResponseFormatJsonObject or ResponseFormatJsonSchema
An object specifying the format that the model must output. Compatible with GPT-4o, GPT-4o mini, GPT-4 Turbo and all GPT-3.5 Turbo models newer than gpt-3.5-turbo-1106.

Setting to { "type": "json_schema", "json_schema": {...} } enables Structured Outputs which guarantees the model will match your supplied JSON schema.

Setting to { "type": "json_object" } enables JSON mode, which guarantees the message the model generates is valid JSON.

Important: when using JSON mode, you must also instruct the model to produce JSON yourself via a system or user message. Without this, the model may generate an unending stream of whitespace until the generation reaches the token limit, resulting in a long-running and seemingly "stuck" request. Also note that the message content may be partially cut off if finish_reason="length", which indicates the generation exceeded max_tokens or the conversation exceeded the max context length.

No

seed
integer
This feature is in Beta.
If specified, our system will make a best effort to sample deterministically, such that repeated requests with the same seed and parameters should return the same result.
Determinism isn't guaranteed, and you should refer to the system_fingerprint response parameter to monitor changes in the backend.

No

tools
array
A list of tools the model may call. Currently, only functions are supported as a tool. Use this to provide a list of functions the model may generate JSON inputs for. A max of 128 functions are supported.

No

tool_choice
chatCompletionToolChoiceOption
Controls which (if any) tool is called by the model. none means the model won't call any tool and instead generates a message. auto means the model can pick between generating a message or calling one or more tools. required means the model must call one or more tools. Specifying a particular tool via {"type": "function", "function": {"name": "my_function"}} forces the model to call that tool. none is the default when no tools are present. auto is the default if tools are present.
No

function_call
string or chatCompletionFunctionCallOption
Deprecated in favor of tool_choice.

Controls which (if any) function is called by the model.
none means the model won't call a function and instead generates a message.
auto means the model can pick between generating a message or calling a function.
Specifying a particular function via {"name": "my_function"} forces the model to call that function.

none is the default when no functions are present. auto is the default if functions are present.

No

functions
array
Deprecated in favor of tools.

A list of functions the model may generate JSON inputs for.

No

Responses

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
createChatCompletionResponse or createChatCompletionStreamResponse

Status Code: default

Description: Service unavailable

Content-Type
Type
Description

application/json
errorResponse

Examples

Example

Creates a completion for the provided prompt, parameters, and chosen model.

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

{
 "messages": [
 {
 "role": "system",
 "content": "you are a helpful assistant that talks like a pirate"
 },
 {
 "role": "user",
 "content": "can you tell me how to care for a parrot?"
 }
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "id": "chatcmpl-7R1nGnsXO8n4oi9UPz2f3UHdgAYMn",
 "created": 1686676106,
 "choices": [
 {
 "index": 0,
 "finish_reason": "stop",
 "message": {
 "role": "assistant",
 "content": "Ahoy matey! So ye be wantin' to care for a fine squawkin' parrot, eh? Well, shiver me timbers, let ol' Cap'n Assistant share some wisdom with ye! Here be the steps to keepin' yer parrot happy 'n healthy:\n\n1. Secure a sturdy cage: Yer parrot be needin' a comfortable place to lay anchor! Be sure ye get a sturdy cage, at least double the size of the bird's wingspan, with enough space to spread their wings, yarrrr!\n\n2. Perches 'n toys: Aye, parrots need perches of different sizes, shapes, 'n textures to keep their feet healthy. Also, a few toys be helpin' to keep them entertained 'n their minds stimulated, arrrh!\n\n3. Proper grub: Feed yer feathered friend a balanced diet of high-quality pellets, fruits, 'n veggies to keep 'em strong 'n healthy. Give 'em fresh water every day, or ye\u00e2\u20ac\u2122ll have a scurvy bird on yer hands!\n\n4. Cleanliness: Swab their cage deck! Clean their cage on a regular basis: fresh water 'n food daily, the floor every couple of days, 'n a thorough scrubbing ev'ry few weeks, so the bird be livin' in a tidy haven, arrhh!\n\n5. Socialize 'n train: Parrots be a sociable lot, arrr! Exercise 'n interact with 'em daily to create a bond 'n maintain their mental 'n physical health. Train 'em with positive reinforcement, treat 'em kindly, yarrr!\n\n6. Proper rest: Yer parrot be needin' \u00e2\u20ac\u2122bout 10-12 hours o' sleep each night. Cover their cage 'n let them slumber in a dim, quiet quarter for a proper night's rest, ye scallywag!\n\n7. Keep a weather eye open for illness: Birds be hidin' their ailments, arrr! Be watchful for signs of sickness, such as lethargy, loss of appetite, puffin' up, or change in droppings, and make haste to a vet if need be.\n\n8. Provide fresh air 'n avoid toxins: Parrots be sensitive to draft and pollutants. Keep yer quarters well ventilated, but no drafts, arrr! Be mindful of toxins like Teflon fumes, candles, or air fresheners.\n\nSo there ye have it, me hearty! With proper care 'n commitment, yer parrot will be squawkin' \"Yo-ho-ho\" for many years to come! Good luck, sailor, and may the wind be at yer back!"
 }
 }
 ],
 "usage": {
 "completion_tokens": 557,
 "prompt_tokens": 33,
 "total_tokens": 590
 }
 }
}

Example

Creates a completion based on Azure Search data and system-assigned managed identity.

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

{
 "messages": [
 {
 "role": "user",
 "content": "can you tell me how to care for a dog?"
 }
 ],
 "data_sources": [
 {
 "type": "azure_search",
 "parameters": {
 "endpoint": "https://your-search-endpoint.search.windows.net/",
 "index_name": "{index name}",
 "authentication": {
 "type": "system_assigned_managed_identity"
 }
 }
 }
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "id": "chatcmpl-7R1nGnsXO8n4oi9UPz2f3UHdgAYMn",
 "created": 1686676106,
 "choices": [
 {
 "index": 0,
 "finish_reason": "stop",
 "message": {
 "role": "assistant",
 "content": "Content of the completion [doc1].",
 "context": {
 "citations": [
 {
 "content": "Citation content.",
 "title": "Citation Title",
 "filepath": "contoso.txt",
 "url": "https://contoso.blob.windows.net/container/contoso.txt",
 "chunk_id": "0"
 }
 ],
 "intent": "dog care"
 }
 }
 }
 ],
 "usage": {
 "completion_tokens": 557,
 "prompt_tokens": 33,
 "total_tokens": 590
 }
 }
}

Example

Creates a completion based on Azure Search vector data, previous assistant message and user-assigned managed identity.

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

{
 "messages": [
 {
 "role": "user",
 "content": "can you tell me how to care for a cat?"
 },
 {
 "role": "assistant",
 "content": "Content of the completion [doc1].",
 "context": {
 "intent": "cat care"
 }
 },
 {
 "role": "user",
 "content": "how about dog?"
 }
 ],
 "data_sources": [
 {
 "type": "azure_search",
 "parameters": {
 "endpoint": "https://your-search-endpoint.search.windows.net/",
 "authentication": {
 "type": "user_assigned_managed_identity",
 "managed_identity_resource_id": "/subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/{resource-name}"
 },
 "index_name": "{index name}",
 "query_type": "vector",
 "embedding_dependency": {
 "type": "deployment_name",
 "deployment_name": "{embedding deployment name}"
 },
 "in_scope": true,
 "top_n_documents": 5,
 "strictness": 3,
 "role_information": "You are an AI assistant that helps people find information.",
 "fields_mapping": {
 "content_fields_separator": "\\n",
 "content_fields": [
 "content"
 ],
 "filepath_field": "filepath",
 "title_field": "title",
 "url_field": "url",
 "vector_fields": [
 "contentvector"
 ]
 }
 }
 }
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "id": "chatcmpl-7R1nGnsXO8n4oi9UPz2f3UHdgAYMn",
 "created": 1686676106,
 "choices": [
 {
 "index": 0,
 "finish_reason": "stop",
 "message": {
 "role": "assistant",
 "content": "Content of the completion [doc1].",
 "context": {
 "citations": [
 {
 "content": "Citation content 2.",
 "title": "Citation Title 2",
 "filepath": "contoso2.txt",
 "url": "https://contoso.blob.windows.net/container/contoso2.txt",
 "chunk_id": "0"
 }
 ],
 "intent": "dog care"
 }
 }
 }
 ],
 "usage": {
 "completion_tokens": 557,
 "prompt_tokens": 33,
 "total_tokens": 590
 }
 }
}

Example

Creates a completion for the provided Azure Cosmos DB.

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

{
 "messages": [
 {
 "role": "user",
 "content": "can you tell me how to care for a dog?"
 }
 ],
 "data_sources": [
 {
 "type": "azure_cosmos_db",
 "parameters": {
 "authentication": {
 "type": "connection_string",
 "connection_string": "mongodb+srv://rawantest:{password}$@{cluster-name}.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000"
 },
 "database_name": "vectordb",
 "container_name": "azuredocs",
 "index_name": "azuredocindex",
 "embedding_dependency": {
 "type": "deployment_name",
 "deployment_name": "{embedding deployment name}"
 },
 "fields_mapping": {
 "content_fields": [
 "content"
 ],
 "vector_fields": [
 "contentvector"
 ]
 }
 }
 }
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "id": "chatcmpl-7R1nGnsXO8n4oi9UPz2f3UHdgAYMn",
 "created": 1686676106,
 "choices": [
 {
 "index": 0,
 "finish_reason": "stop",
 "message": {
 "role": "assistant",
 "content": "Content of the completion [doc1].",
 "context": {
 "citations": [
 {
 "content": "Citation content.",
 "title": "Citation Title",
 "filepath": "contoso.txt",
 "url": "https://contoso.blob.windows.net/container/contoso.txt",
 "chunk_id": "0"
 }
 ],
 "intent": "dog care"
 }
 }
 }
 ],
 "usage": {
 "completion_tokens": 557,
 "prompt_tokens": 33,
 "total_tokens": 590
 }
 }
}

Transcriptions - Create

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/transcriptions?api-version=2024-10-21

Transcribes audio into the input language.

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the speech to text model.

For information about supported models, see [/azure/ai-foundry/openai/concepts/models#audio-models].

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: multipart/form-data

Name
Type
Description
Required
Default

file
string
The audio file object to transcribe.
Yes

prompt
string
An optional text to guide the model's style or continue a previous audio segment. The prompt should match the audio language.
No

response_format
audioResponseFormat
Defines the format of the output.
No

temperature
number
The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use log probability to automatically increase the temperature until certain thresholds are hit.
No
0

language
string
The language of the input audio. Supplying the input language in ISO-639-1 format will improve accuracy and latency.
No

Responses

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
audioResponse or audioVerboseResponse

text/plain
string
Transcribed text in the output format (when response_format was one of text, vtt or srt).

Examples

Example

Gets transcribed text and associated metadata from provided spoken audio data.

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/transcriptions?api-version=2024-10-21

Responses:
Status Code: 200

{
 "body": {
 "text": "A structured object when requesting json or verbose_json"
 }
}

Example

Gets transcribed text and associated metadata from provided spoken audio data.

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/transcriptions?api-version=2024-10-21

"---multipart-boundary\nContent-Disposition: form-data; name=\"file\"; filename=\"file.wav\"\nContent-Type: application/octet-stream\n\nRIFF..audio.data.omitted\n---multipart-boundary--"

Responses:
Status Code: 200

{
 "type": "string",
 "example": "plain text when requesting text, srt, or vtt"
}

Translations - Create

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/translations?api-version=2024-10-21

Transcribes and translates input audio into English text.

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the whisper model which was deployed.

For information about supported models, see [/azure/ai-foundry/openai/concepts/models#audio-models].

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: multipart/form-data

Name
Type
Description
Required
Default

file
string
The audio file to translate.
Yes

prompt
string
An optional text to guide the model's style or continue a previous audio segment. The prompt should be in English.
No

response_format
audioResponseFormat
Defines the format of the output.
No

temperature
number
The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use log probability to automatically increase the temperature until certain thresholds are hit.
No
0

Responses

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
audioResponse or audioVerboseResponse

text/plain
string
Transcribed text in the output format (when response_format was one of text, vtt or srt).

Examples

Example

Gets English language transcribed text and associated metadata from provided spoken audio data.

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/translations?api-version=2024-10-21

"---multipart-boundary\nContent-Disposition: form-data; name=\"file\"; filename=\"file.wav\"\nContent-Type: application/octet-stream\n\nRIFF..audio.data.omitted\n---multipart-boundary--"

Responses:
Status Code: 200

{
 "body": {
 "text": "A structured object when requesting json or verbose_json"
 }
}

Example

Gets English language transcribed text and associated metadata from provided spoken audio data.

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/translations?api-version=2024-10-21

"---multipart-boundary\nContent-Disposition: form-data; name=\"file\"; filename=\"file.wav\"\nContent-Type: application/octet-stream\n\nRIFF..audio.data.omitted\n---multipart-boundary--"

Responses:
Status Code: 200

{
 "type": "string",
 "example": "plain text when requesting text, srt, or vtt"
}

Image generation

POST https://{endpoint}/openai/deployments/{deployment-id}/images/generations?api-version=2024-10-21

Generates a batch of images from a text caption on a given dall-e model deployment

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the dall-e model which was deployed.

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: application/json

Name
Type
Description
Required
Default

prompt
string
A text description of the desired image(s). The maximum length is 4,000 characters.
Yes

n
integer
The number of images to generate.
No
1

size
imageSize
The size of the generated images.
No
1024x1024

response_format
imagesResponseFormat
The format in which the generated images are returned.
No
url

user
string
A unique identifier representing your end-user, which can help to monitor and detect abuse.
No

quality
imageQuality
The quality of the image that will be generated.
No
standard

style
imageStyle
The style of the generated images.
No
vivid

Responses

Status Code: 200

Description: Ok

Content-Type
Type
Description

application/json
generateImagesResponse

Status Code: default

Description: An error occurred.

Content-Type
Type
Description

application/json
dalleErrorResponse

Examples

Example

Creates images given a prompt.

POST https://{endpoint}/openai/deployments/{deployment-id}/images/generations?api-version=2024-10-21

{
 "prompt": "In the style of WordArt, Microsoft Clippy wearing a cowboy hat.",
 "n": 1,
 "style": "natural",
 "quality": "standard"
}

Responses:
Status Code: 200

{
 "body": {
 "created": 1698342300,
 "data": [
 {
 "revised_prompt": "A vivid, natural representation of Microsoft Clippy wearing a cowboy hat.",
 "prompt_filter_results": {
 "sexual": {
 "severity": "safe",
 "filtered": false
 },
 "violence": {
 "severity": "safe",
 "filtered": false
 },
 "hate": {
 "severity": "safe",
 "filtered": false
 },
 "self_harm": {
 "severity": "safe",
 "filtered": false
 },
 "profanity": {
 "detected": false,
 "filtered": false
 }
 },
 "url": "https://dalletipusw2.blob.core.windows.net/private/images/e5451cc6-b1ad-4747-bd46-b89a3a3b8bc3/generated_00.png?se=2023-10-27T17%3A45%3A09Z&...",
 "content_filter_results": {
 "sexual": {
 "severity": "safe",
 "filtered": false
 },
 "violence": {
 "severity": "safe",
 "filtered": false
 },
 "hate": {
 "severity": "safe",
 "filtered": false
 },
 "self_harm": {
 "severity": "safe",
 "filtered": false
 }
 }
 }
 ]
 }
}

Components

errorResponse

Name
Type
Description
Required
Default

error
error

No

errorBase

Name
Type
Description
Required
Default

code
string

No

message
string

No

error

Name
Type
Description
Required
Default

param
string

No

type
string

No

inner_error
innerError
Inner error with additional details.
No

innerError

Inner error with additional details.

Name
Type
Description
Required
Default

code
innerErrorCode
Error codes for the inner error object.
No

content_filter_results
contentFilterPromptResults
Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about jailbreak content and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.
No

innerErrorCode

Error codes for the inner error object.

Description: Error codes for the inner error object.

Type: string

Default:

Enum Name: InnerErrorCode

Enum Values:

Value
Description

ResponsibleAIPolicyViolation
The prompt violated one of more content filter rules.

dalleErrorResponse

Name
Type
Description
Required
Default

error
dalleError

No

dalleError

Name
Type
Description
Required
Default

param
string

No

type
string

No

inner_error
dalleInnerError
Inner error with additional details.
No

dalleInnerError

Inner error with additional details.

Name
Type
Description
Required
Default

code
innerErrorCode
Error codes for the inner error object.
No

content_filter_results
dalleFilterResults
Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about jailbreak content and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.
No

revised_prompt
string
The prompt that was used to generate the image, if there was any revision to the prompt.
No

contentFilterResultBase

Name
Type
Description
Required
Default

filtered
boolean

Yes

contentFilterSeverityResult

Name
Type
Description
Required
Default

filtered
boolean

Yes

severity
string

No

contentFilterDetectedResult

Name
Type
Description
Required
Default

filtered
boolean

Yes

detected
boolean

No

contentFilterDetectedWithCitationResult

Name
Type
Description
Required
Default

citation
object

No

Properties for citation

URL

Name
Type
Description
Default

URL
string

license

Name
Type
Description
Default

license
string

contentFilterResultsBase

Information about the content filtering results.

Name
Type
Description
Required
Default

sexual
contentFilterSeverityResult

No

violence
contentFilterSeverityResult

No

hate
contentFilterSeverityResult

No

self_harm
contentFilterSeverityResult

No

profanity
contentFilterDetectedResult

No

error
errorBase

No

contentFilterPromptResults

Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about jailbreak content and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.

Name
Type
Description
Required
Default

sexual
contentFilterSeverityResult

No

violence
contentFilterSeverityResult

No

hate
contentFilterSeverityResult

No

self_harm
contentFilterSeverityResult

No

profanity
contentFilterDetectedResult

No

error
errorBase

No

jailbreak
contentFilterDetectedResult

No

contentFilterChoiceResults

Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about third party text and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.

Name
Type
Description
Required
Default

sexual
contentFilterSeverityResult

No

violence
contentFilterSeverityResult

No

hate
contentFilterSeverityResult

No

self_harm
contentFilterSeverityResult

No

profanity
contentFilterDetectedResult

No

error
errorBase

No

protected_material_text
contentFilterDetectedResult

No

protected_material_code
contentFilterDetectedWithCitationResult

No

promptFilterResult

...[gekürzt in diesem Bundle: 54761 weitere Zeichen in der Quelldatei]
````

</details>

## Nachtrag: ungekürzte vollständige Textanlagen

<details>
<summary>VOLLSTÄNDIGE ungekürzte Textanlage: <code>OpenAI/API/AzureOpenAI/reference.txt</code></summary>

````text
Azure OpenAI in Microsoft Foundry Models REST API reference - Microsoft Foundry | Microsoft Learn

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

Azure OpenAI in Microsoft Foundry Models REST API reference

 Feedback

 Summarize this article for me

 In this article

This article provides details on the inference REST API endpoints for Azure OpenAI.

API specs

Managing and interacting with Azure OpenAI models and resources is divided across three primary API surfaces:

Control plane

Data plane - authoring

Data plane - inference

Each API surface/specification encapsulates a different set of Azure OpenAI capabilities. Each API has its own unique set of preview and stable/generally available (GA) API releases. Preview releases currently tend to follow a monthly cadence.

Important

There is now a new preview inference API. Learn more in our API lifecycle guide.

API
Latest preview release
Latest GA release
Specifications
Description

Control plane
2025-07-01-preview
2025-06-01
Spec files
The control plane API is used for operations like creating resources, model deployment, and other higher level resource management tasks. The control plane also governs what is possible to do with capabilities like Azure Resource Manager, Bicep, Terraform, and Azure CLI.

Data plane
v1 preview
v1
Spec files
The data plane API controls inference and authoring operations.

Authentication

Azure OpenAI provides two methods for authentication. You can use either API Keys or Microsoft Entra ID.

API Key authentication: For this type of authentication, all API requests must include the API Key in the api-key HTTP header. The Quickstart provides guidance for how to make calls with this type of authentication.

Microsoft Entra ID authentication: You can authenticate an API call using a Microsoft Entra token. Authentication tokens are included in a request as the Authorization header. The token provided must be preceded by Bearer, for example Bearer YOUR_AUTH_TOKEN. You can read our how-to guide on authenticating with Microsoft Entra ID.

REST API versioning

The service APIs are versioned using the api-version query parameter. All versions follow the YYYY-MM-DD date structure. For example:

POST https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2024-06-01

Data plane inference

The rest of the article covers the GA release of the Azure OpenAI data plane inference specification, 2024-10-21.

If you're looking for documentation on the latest preview API release, refer to the latest preview data plane inference API

Completions

POST https://{endpoint}/openai/deployments/{deployment-id}/completions?api-version=2024-10-21

Creates a completion for the provided prompt, parameters, and chosen model.

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the model which was deployed.

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: application/json

Name
Type
Description
Required
Default

prompt
string or array
The prompt(s) to generate completions for, encoded as a string, array of strings, array of tokens, or array of token arrays.

Note that <|endoftext|> is the document separator that the model sees during training, so if a prompt isn't specified the model will generate as if from the beginning of a new document.

Yes

best_of
integer
Generates best_of completions server-side and returns the "best" (the one with the highest log probability per token). Results can't be streamed.

When used with n, best_of controls the number of candidate completions and n specifies how many to return â€“ best_of must be greater than n.

Note: Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for max_tokens and stop.

No
1

echo
boolean
Echo back the prompt in addition to the completion

No
False

frequency_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

No
0

logit_bias
object
Modify the likelihood of specified tokens appearing in the completion.

Accepts a JSON object that maps tokens (specified by their token ID in the GPT tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.

As an example, you can pass {"50256": -100} to prevent the <|endoftext|> token from being generated.

No
None

logprobs
integer
Include the log probabilities on the logprobs most likely output tokens, as well the chosen tokens. For example, if logprobs is 5, the API will return a list of the five most likely tokens. The API will always return the logprob of the sampled token, so there may be up to logprobs+1 elements in the response.

The maximum value for logprobs is 5.

No
None

max_tokens
integer
The maximum number of tokens that can be generated in the completion.

The token count of your prompt plus max_tokens can't exceed the model's context length.
No
16

n
integer
How many completions to generate for each prompt.

Note: Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for max_tokens and stop.

No
1

presence_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.

No
0

seed
integer
If specified, our system will make a best effort to sample deterministically, such that repeated requests with the same seed and parameters should return the same result.

Determinism isn't guaranteed, and you should refer to the system_fingerprint response parameter to monitor changes in the backend.

No

stop
string or array
Up to four sequences where the API will stop generating further tokens. The returned text won't contain the stop sequence.

No

stream
boolean
Whether to stream back partial progress. If set, tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message.
No
False

suffix
string
The suffix that comes after a completion of inserted text.

This parameter is only supported for gpt-3.5-turbo-instruct.

No
None

temperature
number
What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.

We generally recommend altering this or top_p but not both.

No
1

top_p
number
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

We generally recommend altering this or temperature but not both.

No
1

user
string
A unique identifier representing your end-user, which can help to monitor and detect abuse.

No

Responses

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
createCompletionResponse
Represents a completion response from the API. Note: both the streamed and nonstreamed response objects share the same shape (unlike the chat endpoint).

Status Code: default

Description: Service unavailable

Content-Type
Type
Description

application/json
errorResponse

Examples

Example

Creates a completion for the provided prompt, parameters, and chosen model.

POST https://{endpoint}/openai/deployments/{deployment-id}/completions?api-version=2024-10-21

{
 "prompt": [
 "tell me a joke about mango"
 ],
 "max_tokens": 32,
 "temperature": 1.0,
 "n": 1
}

Responses:
Status Code: 200

{
 "body": {
 "id": "cmpl-7QmVI15qgYVllxK0FtxVGG6ywfzaq",
 "created": 1686617332,
 "choices": [
 {
 "text": "es\n\nWhat do you call a mango who's in charge?\n\nThe head mango.",
 "index": 0,
 "finish_reason": "stop",
 "logprobs": null
 }
 ],
 "usage": {
 "completion_tokens": 20,
 "prompt_tokens": 6,
 "total_tokens": 26
 }
 }
}

Embeddings

POST https://{endpoint}/openai/deployments/{deployment-id}/embeddings?api-version=2024-10-21

Get a vector representation of a given input that can be easily consumed by machine learning models and algorithms.

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: application/json

Name
Type
Description
Required
Default

input
string or array
Input text to embed, encoded as a string or array of tokens. To embed multiple inputs in a single request, pass an array of strings or array of token arrays. The input must not exceed the max input tokens for the model (8,192 tokens for text-embedding-ada-002), can't be an empty string, and any array must be 2,048 dimensions or less.
Yes

user
string
A unique identifier representing your end-user, which can help monitoring and detecting abuse.
No

input_type
string
input type of embedding search to use
No

encoding_format
string
The format to return the embeddings in. Can be either float or base64. Defaults to float.
No

dimensions
integer
The number of dimensions the resulting output embeddings should have. Only supported in text-embedding-3 and later models.
No

Responses

Name
Type
Description
Required
Default

object
string

Yes

model
string

Yes

data
array

Yes

usage
object

Yes

Properties for usage

prompt_tokens

Name
Type
Description
Default

prompt_tokens
integer

total_tokens

Name
Type
Description
Default

total_tokens
integer

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
object

Examples

Example

Return the embeddings for a given prompt.

POST https://{endpoint}/openai/deployments/{deployment-id}/embeddings?api-version=2024-10-21

{
 "input": [
 "this is a test"
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "data": [
 {
 "index": 0,
 "embedding": [
 -0.012838088,
 -0.007421397,
 -0.017617522,
 -0.028278312,
 -0.018666342,
 0.01737855,
 -0.01821495,
 -0.006950092,
 -0.009937238,
 -0.038580645,
 0.010674067,
 0.02412286,
 -0.013647936,
 0.013189907,
 0.0021125758,
 0.012406612,
 0.020790534,
 0.00074595667,
 0.008397198,
 -0.00535031,
 0.008968075,
 0.014351576,
 -0.014086051,
 0.015055214,
 -0.022211088,
 -0.025198232,
 0.0065186154,
 -0.036350243,
 0.009180495,
 -0.009698266,
 0.009446018,
 -0.008463579,
 -0.0040426035,
 -0.03443847,
 -0.00091273896,
 -0.0019217303,
 0.002349888,
 -0.021560553,
 0.016515596,
 -0.015572986,
 0.0038666942,
 -8.432463e-05
 ]
 }
 ],
 "usage": {
 "prompt_tokens": 4,
 "total_tokens": 4
 }
 }
}

Chat completions

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

Creates a completion for the chat message

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the model which was deployed.

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: application/json

Name
Type
Description
Required
Default

temperature
number
What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.

We generally recommend altering this or top_p but not both.

No
1

top_p
number
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

We generally recommend altering this or temperature but not both.

No
1

stream
boolean
If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message.
No
False

stop
string or array
Up to four sequences where the API will stop generating further tokens.

No

max_tokens
integer
The maximum number of tokens that can be generated in the chat completion.

The total length of input tokens and generated tokens is limited by the model's context length.
No

max_completion_tokens
integer
An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.
No

presence_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.

No
0

frequency_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

No
0

logit_bias
object
Modify the likelihood of specified tokens appearing in the completion.

Accepts a JSON object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.

No
None

user
string
A unique identifier representing your end-user, which can help to monitor and detect abuse.

No

messages
array
A list of messages comprising the conversation so far.
Yes

data_sources
array
The configuration entries for Azure OpenAI chat extensions that use them.
 This additional specification is only compatible with Azure OpenAI.
No

logprobs
boolean
Whether to return log probabilities of the output tokens or not. If true, returns the log probabilities of each output token returned in the content of message.
No
False

top_logprobs
integer
An integer between 0 and 20 specifying the number of most likely tokens to return at each token position, each with an associated log probability. logprobs must be set to true if this parameter is used.
No

n
integer
How many chat completion choices to generate for each input message. Note that you'll be charged based on the number of generated tokens across all of the choices. Keep n as 1 to minimize costs.
No
1

parallel_tool_calls
ParallelToolCalls
Whether to enable parallel function calling during tool use.
No
True

response_format
ResponseFormatText or ResponseFormatJsonObject or ResponseFormatJsonSchema
An object specifying the format that the model must output. Compatible with GPT-4o, GPT-4o mini, GPT-4 Turbo and all GPT-3.5 Turbo models newer than gpt-3.5-turbo-1106.

Setting to { "type": "json_schema", "json_schema": {...} } enables Structured Outputs which guarantees the model will match your supplied JSON schema.

Setting to { "type": "json_object" } enables JSON mode, which guarantees the message the model generates is valid JSON.

Important: when using JSON mode, you must also instruct the model to produce JSON yourself via a system or user message. Without this, the model may generate an unending stream of whitespace until the generation reaches the token limit, resulting in a long-running and seemingly "stuck" request. Also note that the message content may be partially cut off if finish_reason="length", which indicates the generation exceeded max_tokens or the conversation exceeded the max context length.

No

seed
integer
This feature is in Beta.
If specified, our system will make a best effort to sample deterministically, such that repeated requests with the same seed and parameters should return the same result.
Determinism isn't guaranteed, and you should refer to the system_fingerprint response parameter to monitor changes in the backend.

No

tools
array
A list of tools the model may call. Currently, only functions are supported as a tool. Use this to provide a list of functions the model may generate JSON inputs for. A max of 128 functions are supported.

No

tool_choice
chatCompletionToolChoiceOption
Controls which (if any) tool is called by the model. none means the model won't call any tool and instead generates a message. auto means the model can pick between generating a message or calling one or more tools. required means the model must call one or more tools. Specifying a particular tool via {"type": "function", "function": {"name": "my_function"}} forces the model to call that tool. none is the default when no tools are present. auto is the default if tools are present.
No

function_call
string or chatCompletionFunctionCallOption
Deprecated in favor of tool_choice.

Controls which (if any) function is called by the model.
none means the model won't call a function and instead generates a message.
auto means the model can pick between generating a message or calling a function.
Specifying a particular function via {"name": "my_function"} forces the model to call that function.

none is the default when no functions are present. auto is the default if functions are present.

No

functions
array
Deprecated in favor of tools.

A list of functions the model may generate JSON inputs for.

No

Responses

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
createChatCompletionResponse or createChatCompletionStreamResponse

Status Code: default

Description: Service unavailable

Content-Type
Type
Description

application/json
errorResponse

Examples

Example

Creates a completion for the provided prompt, parameters, and chosen model.

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

{
 "messages": [
 {
 "role": "system",
 "content": "you are a helpful assistant that talks like a pirate"
 },
 {
 "role": "user",
 "content": "can you tell me how to care for a parrot?"
 }
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "id": "chatcmpl-7R1nGnsXO8n4oi9UPz2f3UHdgAYMn",
 "created": 1686676106,
 "choices": [
 {
 "index": 0,
 "finish_reason": "stop",
 "message": {
 "role": "assistant",
 "content": "Ahoy matey! So ye be wantin' to care for a fine squawkin' parrot, eh? Well, shiver me timbers, let ol' Cap'n Assistant share some wisdom with ye! Here be the steps to keepin' yer parrot happy 'n healthy:\n\n1. Secure a sturdy cage: Yer parrot be needin' a comfortable place to lay anchor! Be sure ye get a sturdy cage, at least double the size of the bird's wingspan, with enough space to spread their wings, yarrrr!\n\n2. Perches 'n toys: Aye, parrots need perches of different sizes, shapes, 'n textures to keep their feet healthy. Also, a few toys be helpin' to keep them entertained 'n their minds stimulated, arrrh!\n\n3. Proper grub: Feed yer feathered friend a balanced diet of high-quality pellets, fruits, 'n veggies to keep 'em strong 'n healthy. Give 'em fresh water every day, or ye\u00e2\u20ac\u2122ll have a scurvy bird on yer hands!\n\n4. Cleanliness: Swab their cage deck! Clean their cage on a regular basis: fresh water 'n food daily, the floor every couple of days, 'n a thorough scrubbing ev'ry few weeks, so the bird be livin' in a tidy haven, arrhh!\n\n5. Socialize 'n train: Parrots be a sociable lot, arrr! Exercise 'n interact with 'em daily to create a bond 'n maintain their mental 'n physical health. Train 'em with positive reinforcement, treat 'em kindly, yarrr!\n\n6. Proper rest: Yer parrot be needin' \u00e2\u20ac\u2122bout 10-12 hours o' sleep each night. Cover their cage 'n let them slumber in a dim, quiet quarter for a proper night's rest, ye scallywag!\n\n7. Keep a weather eye open for illness: Birds be hidin' their ailments, arrr! Be watchful for signs of sickness, such as lethargy, loss of appetite, puffin' up, or change in droppings, and make haste to a vet if need be.\n\n8. Provide fresh air 'n avoid toxins: Parrots be sensitive to draft and pollutants. Keep yer quarters well ventilated, but no drafts, arrr! Be mindful of toxins like Teflon fumes, candles, or air fresheners.\n\nSo there ye have it, me hearty! With proper care 'n commitment, yer parrot will be squawkin' \"Yo-ho-ho\" for many years to come! Good luck, sailor, and may the wind be at yer back!"
 }
 }
 ],
 "usage": {
 "completion_tokens": 557,
 "prompt_tokens": 33,
 "total_tokens": 590
 }
 }
}

Example

Creates a completion based on Azure Search data and system-assigned managed identity.

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

{
 "messages": [
 {
 "role": "user",
 "content": "can you tell me how to care for a dog?"
 }
 ],
 "data_sources": [
 {
 "type": "azure_search",
 "parameters": {
 "endpoint": "https://your-search-endpoint.search.windows.net/",
 "index_name": "{index name}",
 "authentication": {
 "type": "system_assigned_managed_identity"
 }
 }
 }
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "id": "chatcmpl-7R1nGnsXO8n4oi9UPz2f3UHdgAYMn",
 "created": 1686676106,
 "choices": [
 {
 "index": 0,
 "finish_reason": "stop",
 "message": {
 "role": "assistant",
 "content": "Content of the completion [doc1].",
 "context": {
 "citations": [
 {
 "content": "Citation content.",
 "title": "Citation Title",
 "filepath": "contoso.txt",
 "url": "https://contoso.blob.windows.net/container/contoso.txt",
 "chunk_id": "0"
 }
 ],
 "intent": "dog care"
 }
 }
 }
 ],
 "usage": {
 "completion_tokens": 557,
 "prompt_tokens": 33,
 "total_tokens": 590
 }
 }
}

Example

Creates a completion based on Azure Search vector data, previous assistant message and user-assigned managed identity.

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

{
 "messages": [
 {
 "role": "user",
 "content": "can you tell me how to care for a cat?"
 },
 {
 "role": "assistant",
 "content": "Content of the completion [doc1].",
 "context": {
 "intent": "cat care"
 }
 },
 {
 "role": "user",
 "content": "how about dog?"
 }
 ],
 "data_sources": [
 {
 "type": "azure_search",
 "parameters": {
 "endpoint": "https://your-search-endpoint.search.windows.net/",
 "authentication": {
 "type": "user_assigned_managed_identity",
 "managed_identity_resource_id": "/subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/{resource-name}"
 },
 "index_name": "{index name}",
 "query_type": "vector",
 "embedding_dependency": {
 "type": "deployment_name",
 "deployment_name": "{embedding deployment name}"
 },
 "in_scope": true,
 "top_n_documents": 5,
 "strictness": 3,
 "role_information": "You are an AI assistant that helps people find information.",
 "fields_mapping": {
 "content_fields_separator": "\\n",
 "content_fields": [
 "content"
 ],
 "filepath_field": "filepath",
 "title_field": "title",
 "url_field": "url",
 "vector_fields": [
 "contentvector"
 ]
 }
 }
 }
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "id": "chatcmpl-7R1nGnsXO8n4oi9UPz2f3UHdgAYMn",
 "created": 1686676106,
 "choices": [
 {
 "index": 0,
 "finish_reason": "stop",
 "message": {
 "role": "assistant",
 "content": "Content of the completion [doc1].",
 "context": {
 "citations": [
 {
 "content": "Citation content 2.",
 "title": "Citation Title 2",
 "filepath": "contoso2.txt",
 "url": "https://contoso.blob.windows.net/container/contoso2.txt",
 "chunk_id": "0"
 }
 ],
 "intent": "dog care"
 }
 }
 }
 ],
 "usage": {
 "completion_tokens": 557,
 "prompt_tokens": 33,
 "total_tokens": 590
 }
 }
}

Example

Creates a completion for the provided Azure Cosmos DB.

POST https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-10-21

{
 "messages": [
 {
 "role": "user",
 "content": "can you tell me how to care for a dog?"
 }
 ],
 "data_sources": [
 {
 "type": "azure_cosmos_db",
 "parameters": {
 "authentication": {
 "type": "connection_string",
 "connection_string": "mongodb+srv://rawantest:{password}$@{cluster-name}.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000"
 },
 "database_name": "vectordb",
 "container_name": "azuredocs",
 "index_name": "azuredocindex",
 "embedding_dependency": {
 "type": "deployment_name",
 "deployment_name": "{embedding deployment name}"
 },
 "fields_mapping": {
 "content_fields": [
 "content"
 ],
 "vector_fields": [
 "contentvector"
 ]
 }
 }
 }
 ]
}

Responses:
Status Code: 200

{
 "body": {
 "id": "chatcmpl-7R1nGnsXO8n4oi9UPz2f3UHdgAYMn",
 "created": 1686676106,
 "choices": [
 {
 "index": 0,
 "finish_reason": "stop",
 "message": {
 "role": "assistant",
 "content": "Content of the completion [doc1].",
 "context": {
 "citations": [
 {
 "content": "Citation content.",
 "title": "Citation Title",
 "filepath": "contoso.txt",
 "url": "https://contoso.blob.windows.net/container/contoso.txt",
 "chunk_id": "0"
 }
 ],
 "intent": "dog care"
 }
 }
 }
 ],
 "usage": {
 "completion_tokens": 557,
 "prompt_tokens": 33,
 "total_tokens": 590
 }
 }
}

Transcriptions - Create

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/transcriptions?api-version=2024-10-21

Transcribes audio into the input language.

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the speech to text model.

For information about supported models, see [/azure/ai-foundry/openai/concepts/models#audio-models].

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: multipart/form-data

Name
Type
Description
Required
Default

file
string
The audio file object to transcribe.
Yes

prompt
string
An optional text to guide the model's style or continue a previous audio segment. The prompt should match the audio language.
No

response_format
audioResponseFormat
Defines the format of the output.
No

temperature
number
The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use log probability to automatically increase the temperature until certain thresholds are hit.
No
0

language
string
The language of the input audio. Supplying the input language in ISO-639-1 format will improve accuracy and latency.
No

Responses

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
audioResponse or audioVerboseResponse

text/plain
string
Transcribed text in the output format (when response_format was one of text, vtt or srt).

Examples

Example

Gets transcribed text and associated metadata from provided spoken audio data.

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/transcriptions?api-version=2024-10-21

Responses:
Status Code: 200

{
 "body": {
 "text": "A structured object when requesting json or verbose_json"
 }
}

Example

Gets transcribed text and associated metadata from provided spoken audio data.

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/transcriptions?api-version=2024-10-21

"---multipart-boundary\nContent-Disposition: form-data; name=\"file\"; filename=\"file.wav\"\nContent-Type: application/octet-stream\n\nRIFF..audio.data.omitted\n---multipart-boundary--"

Responses:
Status Code: 200

{
 "type": "string",
 "example": "plain text when requesting text, srt, or vtt"
}

Translations - Create

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/translations?api-version=2024-10-21

Transcribes and translates input audio into English text.

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the whisper model which was deployed.

For information about supported models, see [/azure/ai-foundry/openai/concepts/models#audio-models].

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: multipart/form-data

Name
Type
Description
Required
Default

file
string
The audio file to translate.
Yes

prompt
string
An optional text to guide the model's style or continue a previous audio segment. The prompt should be in English.
No

response_format
audioResponseFormat
Defines the format of the output.
No

temperature
number
The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use log probability to automatically increase the temperature until certain thresholds are hit.
No
0

Responses

Status Code: 200

Description: OK

Content-Type
Type
Description

application/json
audioResponse or audioVerboseResponse

text/plain
string
Transcribed text in the output format (when response_format was one of text, vtt or srt).

Examples

Example

Gets English language transcribed text and associated metadata from provided spoken audio data.

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/translations?api-version=2024-10-21

"---multipart-boundary\nContent-Disposition: form-data; name=\"file\"; filename=\"file.wav\"\nContent-Type: application/octet-stream\n\nRIFF..audio.data.omitted\n---multipart-boundary--"

Responses:
Status Code: 200

{
 "body": {
 "text": "A structured object when requesting json or verbose_json"
 }
}

Example

Gets English language transcribed text and associated metadata from provided spoken audio data.

POST https://{endpoint}/openai/deployments/{deployment-id}/audio/translations?api-version=2024-10-21

"---multipart-boundary\nContent-Disposition: form-data; name=\"file\"; filename=\"file.wav\"\nContent-Type: application/octet-stream\n\nRIFF..audio.data.omitted\n---multipart-boundary--"

Responses:
Status Code: 200

{
 "type": "string",
 "example": "plain text when requesting text, srt, or vtt"
}

Image generation

POST https://{endpoint}/openai/deployments/{deployment-id}/images/generations?api-version=2024-10-21

Generates a batch of images from a text caption on a given dall-e model deployment

URI Parameters

Name
In
Required
Type
Description

endpoint
path
Yes
string
url
Supported Azure OpenAI endpoints (protocol and hostname, for example: https://aoairesource.openai.azure.com. Replace "aoairesource" with your Azure OpenAI resource name). https://{your-resource-name}.openai.azure.com

deployment-id
path
Yes
string
Deployment ID of the dall-e model which was deployed.

api-version
query
Yes
string
API version

Request Header

Name
Required
Type
Description

api-key
True
string
Provide Azure OpenAI API key here

Request Body

Content-Type: application/json

Name
Type
Description
Required
Default

prompt
string
A text description of the desired image(s). The maximum length is 4,000 characters.
Yes

n
integer
The number of images to generate.
No
1

size
imageSize
The size of the generated images.
No
1024x1024

response_format
imagesResponseFormat
The format in which the generated images are returned.
No
url

user
string
A unique identifier representing your end-user, which can help to monitor and detect abuse.
No

quality
imageQuality
The quality of the image that will be generated.
No
standard

style
imageStyle
The style of the generated images.
No
vivid

Responses

Status Code: 200

Description: Ok

Content-Type
Type
Description

application/json
generateImagesResponse

Status Code: default

Description: An error occurred.

Content-Type
Type
Description

application/json
dalleErrorResponse

Examples

Example

Creates images given a prompt.

POST https://{endpoint}/openai/deployments/{deployment-id}/images/generations?api-version=2024-10-21

{
 "prompt": "In the style of WordArt, Microsoft Clippy wearing a cowboy hat.",
 "n": 1,
 "style": "natural",
 "quality": "standard"
}

Responses:
Status Code: 200

{
 "body": {
 "created": 1698342300,
 "data": [
 {
 "revised_prompt": "A vivid, natural representation of Microsoft Clippy wearing a cowboy hat.",
 "prompt_filter_results": {
 "sexual": {
 "severity": "safe",
 "filtered": false
 },
 "violence": {
 "severity": "safe",
 "filtered": false
 },
 "hate": {
 "severity": "safe",
 "filtered": false
 },
 "self_harm": {
 "severity": "safe",
 "filtered": false
 },
 "profanity": {
 "detected": false,
 "filtered": false
 }
 },
 "url": "https://dalletipusw2.blob.core.windows.net/private/images/e5451cc6-b1ad-4747-bd46-b89a3a3b8bc3/generated_00.png?se=2023-10-27T17%3A45%3A09Z&...",
 "content_filter_results": {
 "sexual": {
 "severity": "safe",
 "filtered": false
 },
 "violence": {
 "severity": "safe",
 "filtered": false
 },
 "hate": {
 "severity": "safe",
 "filtered": false
 },
 "self_harm": {
 "severity": "safe",
 "filtered": false
 }
 }
 }
 ]
 }
}

Components

errorResponse

Name
Type
Description
Required
Default

error
error

No

errorBase

Name
Type
Description
Required
Default

code
string

No

message
string

No

error

Name
Type
Description
Required
Default

param
string

No

type
string

No

inner_error
innerError
Inner error with additional details.
No

innerError

Inner error with additional details.

Name
Type
Description
Required
Default

code
innerErrorCode
Error codes for the inner error object.
No

content_filter_results
contentFilterPromptResults
Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about jailbreak content and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.
No

innerErrorCode

Error codes for the inner error object.

Description: Error codes for the inner error object.

Type: string

Default:

Enum Name: InnerErrorCode

Enum Values:

Value
Description

ResponsibleAIPolicyViolation
The prompt violated one of more content filter rules.

dalleErrorResponse

Name
Type
Description
Required
Default

error
dalleError

No

dalleError

Name
Type
Description
Required
Default

param
string

No

type
string

No

inner_error
dalleInnerError
Inner error with additional details.
No

dalleInnerError

Inner error with additional details.

Name
Type
Description
Required
Default

code
innerErrorCode
Error codes for the inner error object.
No

content_filter_results
dalleFilterResults
Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about jailbreak content and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.
No

revised_prompt
string
The prompt that was used to generate the image, if there was any revision to the prompt.
No

contentFilterResultBase

Name
Type
Description
Required
Default

filtered
boolean

Yes

contentFilterSeverityResult

Name
Type
Description
Required
Default

filtered
boolean

Yes

severity
string

No

contentFilterDetectedResult

Name
Type
Description
Required
Default

filtered
boolean

Yes

detected
boolean

No

contentFilterDetectedWithCitationResult

Name
Type
Description
Required
Default

citation
object

No

Properties for citation

URL

Name
Type
Description
Default

URL
string

license

Name
Type
Description
Default

license
string

contentFilterResultsBase

Information about the content filtering results.

Name
Type
Description
Required
Default

sexual
contentFilterSeverityResult

No

violence
contentFilterSeverityResult

No

hate
contentFilterSeverityResult

No

self_harm
contentFilterSeverityResult

No

profanity
contentFilterDetectedResult

No

error
errorBase

No

contentFilterPromptResults

Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about jailbreak content and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.

Name
Type
Description
Required
Default

sexual
contentFilterSeverityResult

No

violence
contentFilterSeverityResult

No

hate
contentFilterSeverityResult

No

self_harm
contentFilterSeverityResult

No

profanity
contentFilterDetectedResult

No

error
errorBase

No

jailbreak
contentFilterDetectedResult

No

contentFilterChoiceResults

Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about third party text and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.

Name
Type
Description
Required
Default

sexual
contentFilterSeverityResult

No

violence
contentFilterSeverityResult

No

hate
contentFilterSeverityResult

No

self_harm
contentFilterSeverityResult

No

profanity
contentFilterDetectedResult

No

error
errorBase

No

protected_material_text
contentFilterDetectedResult

No

protected_material_code
contentFilterDetectedWithCitationResult

No

promptFilterResult

Content filtering results for a single prompt in the request.

Name
Type
Description
Required
Default

prompt_index
integer

No

content_filter_results
contentFilterPromptResults
Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about jailbreak content and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.
No

promptFilterResults

Content filtering results for zero or more prompts in the request. In a streaming request, results for different prompts may arrive at different times or in different orders.

No properties defined for this component.

dalleContentFilterResults

Information about the content filtering results.

Name
Type
Description
Required
Default

sexual
contentFilterSeverityResult

No

violence
contentFilterSeverityResult

No

hate
contentFilterSeverityResult

No

self_harm
contentFilterSeverityResult

No

dalleFilterResults

Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about jailbreak content and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.

Name
Type
Description
Required
Default

sexual
contentFilterSeverityResult

No

violence
contentFilterSeverityResult

No

hate
contentFilterSeverityResult

No

self_harm
contentFilterSeverityResult

No

profanity
contentFilterDetectedResult

No

jailbreak
contentFilterDetectedResult

No

chatCompletionsRequestCommon

Name
Type
Description
Required
Default

temperature
number
What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.
We generally recommend altering this or top_p but not both.
No
1

top_p
number
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.
We generally recommend altering this or temperature but not both.
No
1

stream
boolean
If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message.
No
False

stop
string or array
Up to four sequences where the API will stop generating further tokens.
No

max_tokens
integer
The maximum number of tokens allowed for the generated answer. By default, the number of tokens the model can return will be (4096 - prompt tokens). This value is now deprecated in favor of max_completion_tokens, and isn't compatible with o1 series models.
No
4096

max_completion_tokens
integer
An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.
No

presence_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
No
0

frequency_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
No
0

logit_bias
object
Modify the likelihood of specified tokens appearing in the completion. Accepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.
No

user
string
A unique identifier representing your end-user, which can help Azure OpenAI to monitor and detect abuse.
No

createCompletionRequest

Name
Type
Description
Required
Default

prompt
string or array
The prompt(s) to generate completions for, encoded as a string, array of strings, array of tokens, or array of token arrays.

Note that <|endoftext|> is the document separator that the model sees during training, so if a prompt isn't specified the model will generate as if from the beginning of a new document.

Yes

best_of
integer
Generates best_of completions server-side and returns the "best" (the one with the highest log probability per token). Results can't be streamed.

When used with n, best_of controls the number of candidate completions and n specifies how many to return â€“ best_of must be greater than n.

Note: Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for max_tokens and stop.

No
1

echo
boolean
Echo back the prompt in addition to the completion

No
False

frequency_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

No
0

logit_bias
object
Modify the likelihood of specified tokens appearing in the completion.

Accepts a JSON object that maps tokens (specified by their token ID in the GPT tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.

As an example, you can pass {"50256": -100} to prevent the <|endoftext|> token from being generated.

No
None

logprobs
integer
Include the log probabilities on the logprobs most likely output tokens, as well the chosen tokens. For example, if logprobs is 5, the API will return a list of the five most likely tokens. The API will always return the logprob of the sampled token, so there may be up to logprobs+1 elements in the response.

The maximum value for logprobs is 5.

No
None

max_tokens
integer
The maximum number of tokens that can be generated in the completion.

The token count of your prompt plus max_tokens can't exceed the model's context length.
No
16

n
integer
How many completions to generate for each prompt.

Note: Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for max_tokens and stop.

No
1

presence_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.

No
0

seed
integer
If specified, our system will make a best effort to sample deterministically, such that repeated requests with the same seed and parameters should return the same result.

Determinism isn't guaranteed, and you should refer to the system_fingerprint response parameter to monitor changes in the backend.

No

stop
string or array
Up to four sequences where the API will stop generating further tokens. The returned text won't contain the stop sequence.

No

stream
boolean
Whether to stream back partial progress. If set, tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message.
No
False

suffix
string
The suffix that comes after a completion of inserted text.

This parameter is only supported for gpt-3.5-turbo-instruct.

No
None

temperature
number
What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.

We generally recommend altering this or top_p but not both.

No
1

top_p
number
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

We generally recommend altering this or temperature but not both.

No
1

user
string
A unique identifier representing your end-user, which can help to monitor and detect abuse.

No

createCompletionResponse

Represents a completion response from the API. Note: both the streamed and nonstreamed response objects share the same shape (unlike the chat endpoint).

Name
Type
Description
Required
Default

id
string
A unique identifier for the completion.
Yes

choices
array
The list of completion choices the model generated for the input prompt.
Yes

created
integer
The Unix timestamp (in seconds) of when the completion was created.
Yes

model
string
The model used for completion.
Yes

prompt_filter_results
promptFilterResults
Content filtering results for zero or more prompts in the request. In a streaming request, results for different prompts may arrive at different times or in different orders.
No

system_fingerprint
string
This fingerprint represents the backend configuration that the model runs with.

Can be used in conjunction with the seed request parameter to understand when backend changes have been made that might impact determinism.

No

object
enum
The object type, which is always "text_completion"
Possible values: text_completion
Yes

usage
completionUsage
Usage statistics for the completion request.
No

createChatCompletionRequest

Name
Type
Description
Required
Default

temperature
number
What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.

We generally recommend altering this or top_p but not both.

No
1

top_p
number
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

We generally recommend altering this or temperature but not both.

No
1

stream
boolean
If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only server-sent events as they become available, with the stream terminated by a data: [DONE] message.
No
False

stop
string or array
Up to four sequences where the API will stop generating further tokens.

No

max_tokens
integer
The maximum number of tokens that can be generated in the chat completion.

The total length of input tokens and generated tokens is limited by the model's context length.
No

max_completion_tokens
integer
An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.
No

presence_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.

No
0

frequency_penalty
number
Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

No
0

logit_bias
object
Modify the likelihood of specified tokens appearing in the completion.

Accepts a JSON object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.

No
None

user
string
A unique identifier representing your end-user, which can help to monitor and detect abuse.

No

messages
array
A list of messages comprising the conversation so far.
Yes

data_sources
array
The configuration entries for Azure OpenAI chat extensions that use them.
 This additional specification is only compatible with Azure OpenAI.
No

logprobs
boolean
Whether to return log probabilities of the output tokens or not. If true, returns the log probabilities of each output token returned in the content of message.
No
False

top_logprobs
integer
An integer between 0 and 20 specifying the number of most likely tokens to return at each token position, each with an associated log probability. logprobs must be set to true if this parameter is used.
No

n
integer
How many chat completion choices to generate for each input message. Note that you'll be charged based on the number of generated tokens across all of the choices. Keep n as 1 to minimize costs.
No
1

parallel_tool_calls
ParallelToolCalls
Whether to enable parallel function calling during tool use.
No
True

response_format
ResponseFormatText or ResponseFormatJsonObject or ResponseFormatJsonSchema
An object specifying the format that the model must output. Compatible with GPT-4o, GPT-4o mini, GPT-4 Turbo and all GPT-3.5 Turbo models newer than gpt-3.5-turbo-1106.

Setting to { "type": "json_schema", "json_schema": {...} } enables Structured Outputs which guarantees the model will match your supplied JSON schema.

Setting to { "type": "json_object" } enables JSON mode, which guarantees the message the model generates is valid JSON.

Important: when using JSON mode, you must also instruct the model to produce JSON yourself via a system or user message. Without this, the model may generate an unending stream of whitespace until the generation reaches the token limit, resulting in a long-running and seemingly "stuck" request. Also note that the message content may be partially cut off if finish_reason="length", which indicates the generation exceeded max_tokens or the conversation exceeded the max context length.

No

seed
integer
This feature is in Beta.
If specified, our system will make a best effort to sample deterministically, such that repeated requests with the same seed and parameters should return the same result.
Determinism isn't guaranteed, and you should refer to the system_fingerprint response parameter to monitor changes in the backend.

No

tools
array
A list of tools the model may call. Currently, only functions are supported as a tool. Use this to provide a list of functions the model may generate JSON inputs for. A max of 128 functions are supported.

No

tool_choice
chatCompletionToolChoiceOption
Controls which (if any) tool is called by the model. none means the model won't call any tool and instead generates a message. auto means the model can pick between generating a message or calling one or more tools. required means the model must call one or more tools. Specifying a particular tool via {"type": "function", "function": {"name": "my_function"}} forces the model to call that tool. none is the default when no tools are present. auto is the default if tools are present.
No

function_call
string or chatCompletionFunctionCallOption
Deprecated in favor of tool_choice.

Controls which (if any) function is called by the model.
none means the model won't call a function and instead generates a message.
auto means the model can pick between generating a message or calling a function.
Specifying a particular function via {"name": "my_function"} forces the model to call that function.

none is the default when no functions are present. auto is the default if functions are present.

No

functions
array
Deprecated in favor of tools.

A list of functions the model may generate JSON inputs for.

No

chatCompletionFunctions

Name
Type
Description
Required
Default

description
string
A description of what the function does, used by the model to choose when and how to call the function.
No

name
string
The name of the function to be called. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
Yes

parameters
FunctionParameters
The parameters the functions accepts, described as a JSON Schema object. See the guide for examples, and the JSON Schema reference for documentation about the format. 

Omitting parameters defines a function with an empty parameter list.
No

chatCompletionFunctionCallOption

Specifying a particular function via {"name": "my_function"} forces the model to call that function.

Name
Type
Description
Required
Default

name
string
The name of the function to call.
Yes

chatCompletionRequestMessage

This component can be one of the following:

chatCompletionRequestSystemMessage

Name
Type
Description
Required
Default

content
string or array
The contents of the system message.
Yes

role
enum
The role of the messages author, in this case system.
Possible values: system
Yes

name
string
An optional name for the participant. Provides the model information to differentiate between participants of the same role.
No

chatCompletionRequestUserMessage

Name
Type
Description
Required
Default

content
string or array
The contents of the user message.

Yes

role
enum
The role of the messages author, in this case user.
Possible values: user
Yes

name
string
An optional name for the participant. Provides the model information to differentiate between participants of the same role.
No

chatCompletionRequestAssistantMessage

Name
Type
Description
Required
Default

content
string or array
The contents of the assistant message. Required unless tool_calls or function_call is specified.

No

refusal
string
The refusal message by the assistant.
No

role
enum
The role of the messages author, in this case assistant.
Possible values: assistant
Yes

name
string
An optional name for the participant. Provides the model information to differentiate between participants of the same role.
No

tool_calls
chatCompletionMessageToolCalls
The tool calls generated by the model, such as function calls.
No

function_call
object
Deprecated and replaced by tool_calls. The name and arguments of a function that should be called, as generated by the model.
No

Properties for function_call

arguments

Name
Type
Description
Default

arguments
string
The arguments to call the function with, as generated by the model in JSON format. Note that the model doesn't always generate valid JSON, and may generate parameters not defined by your function schema. Validate the arguments in your code before calling your function.

name

Name
Type
Description
Default

name
string
The name of the function to call.

chatCompletionRequestToolMessage

Name
Type
Description
Required
Default

role
enum
The role of the messages author, in this case tool.
Possible values: tool
Yes

content
string or array
The contents of the tool message.
Yes

tool_call_id
string
Tool call that this message is responding to.
Yes

chatCompletionRequestFunctionMessage

Name
Type
Description
Required
Default

role
enum
The role of the messages author, in this case function.
Possible values: function
Yes

content
string
The contents of the function message.
Yes

name
string
The name of the function to call.
Yes

chatCompletionRequestSystemMessageContentPart

This component can be one of the following:

chatCompletionRequestUserMessageContentPart

This component can be one of the following:

chatCompletionRequestAssistantMessageContentPart

This component can be one of the following:

chatCompletionRequestToolMessageContentPart

This component can be one of the following:

chatCompletionRequestMessageContentPartText

Name
Type
Description
Required
Default

type
enum
The type of the content part.
Possible values: text
Yes

text
string
The text content.
Yes

chatCompletionRequestMessageContentPartImage

Name
Type
Description
Required
Default

type
enum
The type of the content part.
Possible values: image_url
Yes

image_url
object

Yes

Properties for image_url

url

Name
Type
Description
Default

url
string
Either a URL of the image or the base64 encoded image data.

detail

Name
Type
Description
Default

detail
string
Specifies the detail level of the image. Learn more in the Vision guide.
auto

chatCompletionRequestMessageContentPartRefusal

Name
Type
Description
Required
Default

type
enum
The type of the content part.
Possible values: refusal
Yes

refusal
string
The refusal message generated by the model.
Yes

azureChatExtensionConfiguration

A representation of configuration data for a single Azure OpenAI chat extension. This will be used by a chat
completions request that should use Azure OpenAI chat extensions to augment the response behavior.
The use of this configuration is compatible only with Azure OpenAI.

Name
Type
Description
Required
Default

type
azureChatExtensionType
A representation of configuration data for a single Azure OpenAI chat extension. This will be used by a chat
 completions request that should use Azure OpenAI chat extensions to augment the response behavior.
 The use of this configuration is compatible only with Azure OpenAI.
Yes

azureChatExtensionType

A representation of configuration data for a single Azure OpenAI chat extension. This will be used by a chat
completions request that should use Azure OpenAI chat extensions to augment the response behavior.
The use of this configuration is compatible only with Azure OpenAI.

Description: A representation of configuration data for a single Azure OpenAI chat extension. This will be used by a chat completions request that should use Azure OpenAI chat extensions to augment the response behavior. The use of this configuration is compatible only with Azure OpenAI.

Type: string

Default:

Enum Name: AzureChatExtensionType

Enum Values:

Value
Description

azure_search
Represents the use of Azure Search as an Azure OpenAI chat extension.

azure_cosmos_db
Represents the use of Azure Cosmos DB as an Azure OpenAI chat extension.

azureSearchChatExtensionConfiguration

A specific representation of configurable options for Azure Search when using it as an Azure OpenAI chat
extension.

Name
Type
Description
Required
Default

type
azureChatExtensionType
A representation of configuration data for a single Azure OpenAI chat extension. This will be used by a chat
 completions request that should use Azure OpenAI chat extensions to augment the response behavior.
 The use of this configuration is compatible only with Azure OpenAI.
Yes

parameters
azureSearchChatExtensionParameters
Parameters for Azure Search when used as an Azure OpenAI chat extension.
No

azureSearchChatExtensionParameters

Parameters for Azure Search when used as an Azure OpenAI chat extension.

Name
Type
Description
Required
Default

authentication
onYourDataApiKeyAuthenticationOptions or onYourDataSystemAssignedManagedIdentityAuthenticationOptions or onYourDataUserAssignedManagedIdentityAuthenticationOptions

Yes

top_n_documents
integer
The configured top number of documents to feature for the configured query.
No

in_scope
boolean
Whether queries should be restricted to use of indexed data.
No

strictness
integer
The configured strictness of the search relevance filtering. The higher of strictness, the higher of the precision but lower recall of the answer.
No

role_information
string
Give the model instructions about how it should behave and any context it should reference when generating a response. You can describe the assistant's personality and tell it how to format responses. There's a 100 token limit for it, and it counts against the overall token limit.
No

endpoint
string
The absolute endpoint path for the Azure Search resource to use.
Yes

index_name
string
The name of the index to use as available in the referenced Azure Search resource.
Yes

fields_mapping
azureSearchIndexFieldMappingOptions
Optional settings to control how fields are processed when using a configured Azure Search resource.
No

query_type
azureSearchQueryType
The type of Azure Search retrieval query that should be executed when using it as an Azure OpenAI chat extension.
No

semantic_configuration
string
The additional semantic configuration for the query.
No

filter
string
Search filter.
No

embedding_dependency
onYourDataEndpointVectorizationSource or onYourDataDeploymentNameVectorizationSource

No

azureSearchIndexFieldMappingOptions

Optional settings to control how fields are processed when using a configured Azure Search resource.

Name
Type
Description
Required
Default

title_field
string
The name of the index field to use as a title.
No

url_field
string
The name of the index field to use as a URL.
No

filepath_field
string
The name of the index field to use as a filepath.
No

content_fields
array
The names of index fields that should be treated as content.
No

content_fields_separator
string
The separator pattern that content fields should use.
No

vector_fields
array
The names of fields that represent vector data.
No

azureSearchQueryType

The type of Azure Search retrieval query that should be executed when using it as an Azure OpenAI chat extension.

Description: The type of Azure Search retrieval query that should be executed when using it as an Azure OpenAI chat extension.

Type: string

Default:

Enum Name: AzureSearchQueryType

Enum Values:

Value
Description

simple
Represents the default, simple query parser.

semantic
Represents the semantic query parser for advanced semantic modeling.

vector
Represents vector search over computed data.

vector_simple_hybrid
Represents a combination of the simple query strategy with vector data.

vector_semantic_hybrid
Represents a combination of semantic search and vector data querying.

azureCosmosDBChatExtensionConfiguration

A specific representation of configurable options for Azure Cosmos DB when using it as an Azure OpenAI chat
extension.

Name
Type
Description
Required
Default

type
azureChatExtensionType
A representation of configuration data for a single Azure OpenAI chat extension. This will be used by a chat
 completions request that should use Azure OpenAI chat extensions to augment the response behavior.
 The use of this configuration is compatible only with Azure OpenAI.
Yes

parameters
azureCosmosDBChatExtensionParameters
Parameters to use when configuring Azure OpenAI On Your Data chat extensions when using Azure Cosmos DB for
MongoDB vCore.
No

azureCosmosDBChatExtensionParameters

Parameters to use when configuring Azure OpenAI On Your Data chat extensions when using Azure Cosmos DB for
MongoDB vCore.

Name
Type
Description
Required
Default

authentication
onYourDataConnectionStringAuthenticationOptions
The authentication options for Azure OpenAI On Your Data when using a connection string.
Yes

top_n_documents
integer
The configured top number of documents to feature for the configured query.
No

in_scope
boolean
Whether queries should be restricted to use of indexed data.
No

strictness
integer
The configured strictness of the search relevance filtering. The higher of strictness, the higher of the precision but lower recall of the answer.
No

role_information
string
Give the model instructions about how it should behave and any context it should reference when generating a response. You can describe the assistant's personality and tell it how to format responses. There's a 100 token limit for it, and it counts against the overall token limit.
No

database_name
string
The MongoDB vCore database name to use with Azure Cosmos DB.
Yes

container_name
string
The name of the Azure Cosmos DB resource container.
Yes

index_name
string
The MongoDB vCore index name to use with Azure Cosmos DB.
Yes

fields_mapping
azureCosmosDBFieldMappingOptions
Optional settings to control how fields are processed when using a configured Azure Cosmos DB resource.
Yes

embedding_dependency
onYourDataEndpointVectorizationSource or onYourDataDeploymentNameVectorizationSource

Yes

azureCosmosDBFieldMappingOptions

Optional settings to control how fields are processed when using a configured Azure Cosmos DB resource.

Name
Type
Description
Required
Default

title_field
string
The name of the index field to use as a title.
No

url_field
string
The name of the index field to use as a URL.
No

filepath_field
string
The name of the index field to use as a filepath.
No

content_fields
array
The names of index fields that should be treated as content.
Yes

content_fields_separator
string
The separator pattern that content fields should use.
No

vector_fields
array
The names of fields that represent vector data.
Yes

onYourDataAuthenticationOptions

The authentication options for Azure OpenAI On Your Data.

Name
Type
Description
Required
Default

type
onYourDataAuthenticationType
The authentication types supported with Azure OpenAI On Your Data.
Yes

onYourDataAuthenticationType

The authentication types supported with Azure OpenAI On Your Data.

Description: The authentication types supported with Azure OpenAI On Your Data.

Type: string

Default:

Enum Name: OnYourDataAuthenticationType

Enum Values:

Value
Description

api_key
Authentication via API key.

connection_string
Authentication via connection string.

system_assigned_managed_identity
Authentication via system-assigned managed identity.

user_assigned_managed_identity
Authentication via user-assigned managed identity.

onYourDataApiKeyAuthenticationOptions

The authentication options for Azure OpenAI On Your Data when using an API key.

Name
Type
Description
Required
Default

type
onYourDataAuthenticationType
The authentication types supported with Azure OpenAI On Your Data.
Yes

key
string
The API key to use for authentication.
No

onYourDataConnectionStringAuthenticationOptions

The authentication options for Azure OpenAI On Your Data when using a connection string.

Name
Type
Description
Required
Default

type
onYourDataAuthenticationType
The authentication types supported with Azure OpenAI On Your Data.
Yes

connection_string
string
The connection string to use for authentication.
No

onYourDataSystemAssignedManagedIdentityAuthenticationOptions

The authentication options for Azure OpenAI On Your Data when using a system-assigned managed identity.

Name
Type
Description
Required
Default

type
onYourDataAuthenticationType
The authentication types supported with Azure OpenAI On Your Data.
Yes

onYourDataUserAssignedManagedIdentityAuthenticationOptions

The authentication options for Azure OpenAI On Your Data when using a user-assigned managed identity.

Name
Type
Description
Required
Default

type
onYourDataAuthenticationType
The authentication types supported with Azure OpenAI On Your Data.
Yes

managed_identity_resource_id
string
The resource ID of the user-assigned managed identity to use for authentication.
No

onYourDataVectorizationSource

An abstract representation of a vectorization source for Azure OpenAI On Your Data with vector search.

Name
Type
Description
Required
Default

type
onYourDataVectorizationSourceType
Represents the available sources Azure OpenAI On Your Data can use to configure vectorization of data for use with
vector search.
Yes

onYourDataVectorizationSourceType

Represents the available sources Azure OpenAI On Your Data can use to configure vectorization of data for use with
vector search.

Description: Represents the available sources Azure OpenAI On Your Data can use to configure vectorization of data for use with
vector search.

Type: string

Default:

Enum Name: OnYourDataVectorizationSourceType

Enum Values:

Value
Description

endpoint
Represents vectorization performed by public service calls to an Azure OpenAI embedding model.

deployment_name
Represents an Ada model deployment name to use. This model deployment must be in the same Azure OpenAI resource, but
On Your Data will use this model deployment via an internal call rather than a public one, which enables vector
search even in private networks.

onYourDataDeploymentNameVectorizationSource

The details of a vectorization source, used by Azure OpenAI On Your Data when applying vector search, that is based
on an internal embeddings model deployment name in the same Azure OpenAI resource.

Name
Type
Description
Required
Default

type
onYourDataVectorizationSourceType
Represents the available sources Azure OpenAI On Your Data can use to configure vectorization of data for use with
vector search.
Yes

deployment_name
string
Specifies the name of the model deployment to use for vectorization. This model deployment must be in the same Azure OpenAI resource, but On Your Data will use this model deployment via an internal call rather than a public one, which enables vector search even in private networks.
No

onYourDataEndpointVectorizationSource

The details of a vectorization source, used by Azure OpenAI On Your Data when applying vector search, that is based
on a public Azure OpenAI endpoint call for embeddings.

Name
Type
Description
Required
Default

type
onYourDataVectorizationSourceType
Represents the available sources Azure OpenAI On Your Data can use to configure vectorization of data for use with
vector search.
Yes

authentication
onYourDataApiKeyAuthenticationOptions
The authentication options for Azure OpenAI On Your Data when using an API key.
No

endpoint
string
Specifies the endpoint to use for vectorization. This endpoint must be in the same Azure OpenAI resource, but On Your Data will use this endpoint via an internal call rather than a public one, which enables vector search even in private networks.
No

azureChatExtensionsMessageContext

A representation of the additional context information available when Azure OpenAI chat extensions are involved
in the generation of a corresponding chat completions response. This context information is only populated when
using an Azure OpenAI request configured to use a matching extension.

Name
Type
Description
Required
Default

citations
array
The data source retrieval result, used to generate the assistant message in the response.
No

intent
string
The detected intent from the chat history, used to pass to the next turn to carry over the context.
No

citation

citation information for a chat completions response message.

Name
Type
Description
Required
Default

content
string
The content of the citation.
Yes

title
string
The title of the citation.
No

url
string
The URL of the citation.
No

filepath
string
The file path of the citation.
No

chunk_id
string
The chunk ID of the citation.
No

chatCompletionMessageToolCall

Name
Type
Description
Required
Default

id
string
The ID of the tool call.
Yes

type
toolCallType
The type of the tool call, in this case function.
Yes

function
object
The function that the model called.
Yes

Properties for function

name

Name
Type
Description
Default

name
string
The name of the function to call.

arguments

Name
Type
Description
Default

arguments
string
The arguments to call the function with, as generated by the model in JSON format. Note that the model doesn't always generate valid JSON, and may generate parameters not defined by your function schema. Validate the arguments in your code before calling your function.

toolCallType

The type of the tool call, in this case function.

Description: The type of the tool call, in this case function.

Type: string

Default:

Enum Name: ToolCallType

Enum Values:

Value
Description

function
The tool call type is function.

chatCompletionRequestMessageTool

Name
Type
Description
Required
Default

tool_call_id
string
Tool call that this message is responding to.
No

content
string
The contents of the message.
No

chatCompletionRequestMessageFunction

Name
Type
Description
Required
Default

role
enum
The role of the messages author, in this case function.
Possible values: function
No

name
string
The contents of the message.
No

content
string
The contents of the message.
No

createChatCompletionResponse

Represents a chat completion response returned by model, based on the provided input.

Name
Type
Description
Required
Default

id
string
A unique identifier for the chat completion.
Yes

prompt_filter_results
promptFilterResults
Content filtering results for zero or more prompts in the request. In a streaming request, results for different prompts may arrive at different times or in different orders.
No

choices
array
A list of chat completion choices. Can be more than one if n is greater than 1.
Yes

created
integer
The Unix timestamp (in seconds) of when the chat completion was created.
Yes

model
string
The model used for the chat completion.
Yes

system_fingerprint
string
This fingerprint represents the backend configuration that the model runs with.

Can be used in conjunction with the seed request parameter to understand when backend changes have been made that might impact determinism.

No

object
enum
The object type, which is always chat.completion.
Possible values: chat.completion
Yes

usage
completionUsage
Usage statistics for the completion request.
No

createChatCompletionStreamResponse

Represents a streamed chunk of a chat completion response returned by model, based on the provided input.

Name
Type
Description
Required
Default

id
string
A unique identifier for the chat completion. Each chunk has the same ID.
Yes

choices
array
A list of chat completion choices. Can contain more than one elements if n is greater than 1.

Yes

created
integer
The Unix timestamp (in seconds) of when the chat completion was created. Each chunk has the same timestamp.
Yes

model
string
The model to generate the completion.
Yes

system_fingerprint
string
This fingerprint represents the backend configuration that the model runs with.
Can be used in conjunction with the seed request parameter to understand when backend changes have been made that might impact determinism.

No

object
enum
The object type, which is always chat.completion.chunk.
Possible values: chat.completion.chunk
Yes

chatCompletionStreamResponseDelta

A chat completion delta generated by streamed model responses.

Name
Type
Description
Required
Default

content
string
The contents of the chunk message.
No

function_call
object
Deprecated and replaced by tool_calls. The name and arguments of a function that should be called, as generated by the model.
No

tool_calls
array

No

role
enum
The role of the author of this message.
Possible values: system, user, assistant, tool
No

refusal
string
The refusal message generated by the model.
No

Properties for function_call

arguments

Name
Type
Description
Default

arguments
string
The arguments to call the function with, as generated by the model in JSON format. Note that the model doesn't always generate valid JSON, and may generate parameters not defined by your function schema. Validate the arguments in your code before calling your function.

name

Name
Type
Description
Default

name
string
The name of the function to call.

chatCompletionMessageToolCallChunk

Name
Type
Description
Required
Default

index
integer

Yes

id
string
The ID of the tool call.
No

type
enum
The type of the tool. Currently, only function is supported.
Possible values: function
No

function
object

No

Properties for function

name

Name
Type
Description
Default

name
string
The name of the function to call.

arguments

Name
Type
Description
Default

arguments
string
The arguments to call the function with, as generated by the model in JSON format. Note that the model doesn't always generate valid JSON, and may generate parameters not defined by your function schema. Validate the arguments in your code before calling your function.

chatCompletionStreamOptions

Options for streaming response. Only set this when you set stream: true.

Name
Type
Description
Required
Default

include_usage
boolean
If set, an additional chunk will be streamed before the data: [DONE] message. The usage field on this chunk shows the token usage statistics for the entire request, and the choices field will always be an empty array. All other chunks will also include a usage field, but with a null value.

No

chatCompletionChoiceLogProbs

Log probability information for the choice.

Name
Type
Description
Required
Default

content
array
A list of message content tokens with log probability information.
Yes

refusal
array
A list of message refusal tokens with log probability information.
No

chatCompletionTokenLogprob

Name
Type
Description
Required
Default

token
string
The token.
Yes

logprob
number
The log probability of this token.
Yes

bytes
array
A list of integers representing the UTF-8 bytes representation of the token. Useful in instances where characters are represented by multiple tokens and their byte representations must be combined to generate the correct text representation. Can be null if there's no bytes representation for the token.
Yes

top_logprobs
array
List of the most likely tokens and their log probability, at this token position. In rare cases, there may be fewer than the number of requested top_logprobs returned.
Yes

chatCompletionResponseMessage

A chat completion message generated by the model.

Name
Type
Description
Required
Default

role
chatCompletionResponseMessageRole
The role of the author of the response message.
Yes

refusal
string
The refusal message generated by the model.
Yes

content
string
The contents of the message.
Yes

tool_calls
array
The tool calls generated by the model, such as function calls.
No

function_call
chatCompletionFunctionCall
Deprecated and replaced by tool_calls. The name and arguments of a function that should be called, as generated by the model.
No

context
azureChatExtensionsMessageContext
A representation of the additional context information available when Azure OpenAI chat extensions are involved
 in the generation of a corresponding chat completions response. This context information is only populated when
 using an Azure OpenAI request configured to use a matching extension.
No

chatCompletionResponseMessageRole

The role of the author of the response message.

Description: The role of the author of the response message.

Type: string

Default:

Enum Values:

assistant

chatCompletionToolChoiceOption

Controls which (if any) tool is called by the model. none means the model won't call any tool and instead generates a message. auto means the model can pick between generating a message or calling one or more tools. required means the model must call one or more tools. Specifying a particular tool via {"type": "function", "function": {"name": "my_function"}} forces the model to call that tool. none is the default when no tools are present. auto is the default if tools are present.

This component can be one of the following:

chatCompletionNamedToolChoice

Specifies a tool the model should use. Use to force the model to call a specific function.

Name
Type
Description
Required
Default

type
enum
The type of the tool. Currently, only function is supported.
Possible values: function
Yes

function
object

Yes

Properties for function

name

Name
Type
Description
Default

name
string
The name of the function to call.

ParallelToolCalls

Whether to enable parallel function calling during tool use.

No properties defined for this component.

chatCompletionMessageToolCalls

The tool calls generated by the model, such as function calls.

No properties defined for this component.

chatCompletionFunctionCall

Deprecated and replaced by tool_calls. The name and arguments of a function that should be called, as generated by the model.

Name
Type
Description
Required
Default

name
string
The name of the function to call.
Yes

arguments
string
The arguments to call the function with, as generated by the model in JSON format. Note that the model doesn't always generate valid JSON, and may generate parameters not defined by your function schema. Validate the arguments in your code before calling your function.
Yes

completionUsage

Usage statistics for the completion request.

Name
Type
Description
Required
Default

prompt_tokens
integer
Number of tokens in the prompt.
Yes

completion_tokens
integer
Number of tokens in the generated completion.
Yes

total_tokens
integer
Total number of tokens used in the request (prompt + completion).
Yes

completion_tokens_details
object
Breakdown of tokens used in a completion.
No

Properties for completion_tokens_details

reasoning_tokens

Name
Type
Description
Default

reasoning_tokens
integer
Tokens generated by the model for reasoning.

chatCompletionTool

Name
Type
Description
Required
Default

type
enum
The type of the tool. Currently, only function is supported.
Possible values: function
Yes

function
FunctionObject

Yes

FunctionParameters

The parameters the functions accepts, described as a JSON Schema object. See the guide for examples, and the JSON Schema reference for documentation about the format.

Omitting parameters defines a function with an empty parameter list.

No properties defined for this component.

FunctionObject

Name
Type
Description
Required
Default

description
string
A description of what the function does, used by the model to choose when and how to call the function.
No

name
string
The name of the function to be called. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
Yes

parameters
FunctionParameters
The parameters the functions accepts, described as a JSON Schema object. See the guide for examples, and the JSON Schema reference for documentation about the format. 

Omitting parameters defines a function with an empty parameter list.
No

strict
boolean
Whether to enable strict schema adherence when generating the function call. If set to true, the model will follow the exact schema defined in the parameters field. Only a subset of JSON Schema is supported when strict is true.
No
False

ResponseFormatText

Name
Type
Description
Required
Default

type
enum
The type of response format being defined: text
Possible values: text
Yes

ResponseFormatJsonObject

Name
Type
Description
Required
Default

type
enum
The type of response format being defined: json_object
Possible values: json_object
Yes

ResponseFormatJsonSchemaSchema

The schema for the response format, described as a JSON Schema object.

No properties defined for this component.

ResponseFormatJsonSchema

Name
Type
Description
Required
Default

type
enum
The type of response format being defined: json_schema
Possible values: json_schema
Yes

json_schema
object

Yes

Properties for json_schema

description

Name
Type
Description
Default

description
string
A description of what the response format is for, used by the model to determine how to respond in the format.

name

Name
Type
Description
Default

name
string
The name of the response format. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.

schema

Name
Type
Description
Default

schema
ResponseFormatJsonSchemaSchema
The schema for the response format, described as a JSON Schema object.

strict

Name
Type
Description
Default

strict
boolean
Whether to enable strict schema adherence when generating the output. If set to true, the model will always follow the exact schema defined in the schema field. Only a subset of JSON Schema is supported when strict is true.
False

chatCompletionChoiceCommon

Name
Type
Description
Required
Default

index
integer

No

finish_reason
string

No

createTranslationRequest

Translation request.

Name
Type
Description
Required
Default

file
string
The audio file to translate.
Yes

prompt
string
An optional text to guide the model's style or continue a previous audio segment. The prompt should be in English.
No

response_format
audioResponseFormat
Defines the format of the output.
No

temperature
number
The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use log probability to automatically increase the temperature until certain thresholds are hit.
No
0

audioResponse

Translation or transcription response when response_format was json

Name
Type
Description
Required
Default

text
string
Translated or transcribed text.
Yes

audioVerboseResponse

Translation or transcription response when response_format was verbose_json

Name
Type
Description
Required
Default

text
string
Translated or transcribed text.
Yes

task
string
Type of audio task.
No

language
string
Language.
No

duration
number
Duration.
No

segments
array

No

audioResponseFormat

Defines the format of the output.

Description: Defines the format of the output.

Type: string

Default:

Enum Values:

json

text

srt

verbose_json

vtt

createTranscriptionRequest

Transcription request.

Name
Type
Description
Required
Default

file
string
The audio file object to transcribe.
Yes

prompt
string
An optional text to guide the model's style or continue a previous audio segment. The prompt should match the audio language.
No

response_format
audioResponseFormat
Defines the format of the output.
No

temperature
number
The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use log probability to automatically increase the temperature until certain thresholds are hit.
No
0

language
string
The language of the input audio. Supplying the input language in ISO-639-1 format will improve accuracy and latency.
No

audioSegment

Transcription or translation segment.

Name
Type
Description
Required
Default

id
integer
Segment identifier.
No

seek
number
Offset of the segment.
No

start
number
Segment start offset.
No

end
number
Segment end offset.
No

text
string
Segment text.
No

tokens
array
Tokens of the text.
No

temperature
number
Temperature.
No

avg_logprob
number
Average log probability.
No

compression_ratio
number
Compression ratio.
No

no_speech_prob
number
Probability of no speech.
No

imageQuality

The quality of the image that will be generated.

Description: The quality of the image that will be generated.

Type: string

Default: standard

Enum Name: Quality

Enum Values:

Value
Description

standard
Standard quality creates images with standard quality.

hd
HD quality creates images with finer details and greater consistency across the image.

imagesResponseFormat

The format in which the generated images are returned.

Description: The format in which the generated images are returned.

Type: string

Default: url

Enum Name: ImagesResponseFormat

Enum Values:

Value
Description

url
The URL that provides temporary access to download the generated images.

b64_json
The generated images are returned as base64 encoded string.

imageSize

The size of the generated images.

Description: The size of the generated images.

Type: string

Default: 1024x1024

Enum Name: Size

Enum Values:

Value
Description

1792x1024
The desired size of the generated image is 1792x1024 pixels.

1024x1792
The desired size of the generated image is 1024x1792 pixels.

1024x1024
The desired size of the generated image is 1024x1024 pixels.

imageStyle

The style of the generated images.

Description: The style of the generated images.

Type: string

Default: vivid

Enum Name: Style

Enum Values:

Value
Description

vivid
Vivid creates images that are hyper-realistic and dramatic.

natural
Natural creates images that are more natural and less hyper-realistic.

imageGenerationsRequest

Name
Type
Description
Required
Default

prompt
string
A text description of the desired image(s). The maximum length is 4,000 characters.
Yes

n
integer
The number of images to generate.
No
1

size
imageSize
The size of the generated images.
No
1024x1024

response_format
imagesResponseFormat
The format in which the generated images are returned.
No
url

user
string
A unique identifier representing your end-user, which can help to monitor and detect abuse.
No

quality
imageQuality
The quality of the image that will be generated.
No
standard

style
imageStyle
The style of the generated images.
No
vivid

generateImagesResponse

Name
Type
Description
Required
Default

created
integer
The unix timestamp when the operation was created.
Yes

data
array
The result data of the operation, if successful
Yes

imageResult

The image url or encoded image if successful, and an error otherwise.

Name
Type
Description
Required
Default

url
string
The image url.
No

b64_json
string
The base64 encoded image
No

content_filter_results
dalleContentFilterResults
Information about the content filtering results.
No

revised_prompt
string
The prompt that was used to generate the image, if there was any revision to the prompt.
No

prompt_filter_results
dalleFilterResults
Information about the content filtering category (hate, sexual, violence, self_harm), if it has been detected, as well as the severity level (very_low, low, medium, high-scale that determines the intensity and risk level of harmful content) and if it has been filtered or not. Information about jailbreak content and profanity, if it has been detected, and if it has been filtered or not. And information about customer blocklist, if it has been filtered and its id.
No

Completions extensions

Completions extensions aren't part of the latest GA version of the Azure OpenAI data plane inference spec.

Chatmessage

The Chat message object isn't part of the latest GA version of the Azure OpenAI data plane inference spec.

Text to speech (Preview)

Is not currently part of the latest Azure OpenAI GA version of the Azure OpenAI data plane inference spec. Refer to the latest preview version for this capability.

Next steps

Learn about Models, and fine-tuning with the REST API.
Learn more about the underlying models that power Azure OpenAI.

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
 2026-02-27

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

