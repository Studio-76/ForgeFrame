# OAUTH-GoogleGemini.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## code-proxy Gemini OAuth Config

Provider: `gemini`

```text
Client ID: 681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com
Auth URL:  https://accounts.google.com/o/oauth2/v2/auth
Token URL: https://oauth2.googleapis.com/token
Scopes:    https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email
Redirect:  http://localhost:8085/callback
Content:   application/x-www-form-urlencoded
PKCE:      true
Extra:     access_type=offline, prompt=consent
```

## Token Exchange

```http
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=<code>&
client_id=<client_id>&
redirect_uri=http://localhost:8085/callback&
code_verifier=<pkce_verifier>
```

Refresh:

```text
grant_type=refresh_token&refresh_token=<refresh_token>&client_id=<client_id>
```

## hermes-agent Google Gemini CLI / Code Assist

Provider-ID: `google-gemini-cli`  
Auth type: `oauth_external`  
Inference Base: `cloudcode-pa://google`  
Refresh skew: 60 Sekunden vor Ablauf.

Modellliste:

- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`

## Implementierungsnotiz

Google-Gemini-OAuth ist technisch von Google AI Studio API-Key zu trennen:

- `gemini_api_key`: OpenAI-kompatible Gemini API oder native generateContent API.
- `google_gemini_cli_oauth`: Account-/CLI-/Code-Assist-gebundener Flow.

---

## Offizielle Dokumentationsanreicherung: `Oauth/Gemini`

> Ergänzt am 2026-04-24 03:20:41. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – Gemini

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### Gemini CLI Authentication Setup | gemini-cli
- Quelle: Pflichtquelle
- Original-URL: https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html
- Bereinigte Download-URL: https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html
- Lokale Datei(en): HTML: `gemini-cli-authentication.html`, Text: `gemini-cli-authentication.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Gemini CLI authentication
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`

### Set up Gemini Code Assist for individuals | Google for Developers
- Quelle: Pflichtquelle
- Original-URL: https://developers.google.com/gemini-code-assist/docs/set-up-gemini
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/set-up-gemini
- Lokale Datei(en): HTML: `set-up-gemini.html`, Text: `set-up-gemini.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Gemini Code Assist setup
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`

### Use the Gemini Code Assist chat | Google for Developers
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.google.com/gemini-code-assist/docs/use-gemini-code-assist-chat
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/use-gemini-code-assist-chat
- Lokale Datei(en): HTML: `use-gemini-code-assist-chat.html`, Text: `use-gemini-code-assist-chat.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.google.com/gemini-code-assist/docs/set-up-gemini
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### Gemini Code Assist chat features overview | Google for Developers
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.google.com/gemini-code-assist/docs/chat-overview
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/chat-overview
- Lokale Datei(en): HTML: `chat-overview.html`, Text: `chat-overview.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.google.com/gemini-code-assist/docs/set-up-gemini
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### Authentication with OAuth quickstart | Gemini API | Google AI for Developers
- Quelle: Pflichtquelle
- Original-URL: https://ai.google.dev/gemini-api/docs/oauth
- Bereinigte Download-URL: https://ai.google.dev/gemini-api/docs/oauth
- Lokale Datei(en): HTML: `gemini-api-oauth.html`, Text: `gemini-api-oauth.txt`
- Abrufdatum: `2026-04-24T05:09:30.736134+02:00`
- Zweck: Gemini API OAuth
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`

### Erkannte URLs und Basisadressen

- `https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html`
- `https://developers.google.com/gemini-code-assist/docs/set-up-gemini`
- `https://developers.google.com/gemini-code-assist/docs/use-gemini-code-assist-chat`
- `https://developers.google.com/gemini-code-assist/docs/chat-overview`
- `https://ai.google.dev/gemini-api/docs/oauth`
- `https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/generative-language.retriever`
- `https://generativelanguage.googleapis.com/v1/models`
- `https://www.googleapis.com/auth/generative-language.retriever`

### Erkannte Endpunkte / Pfade

- `https://ai.google.dev/gemini-api/docs/oauth`
- `GET https://generativelanguage.googleapis.com/v1/models`

### Erkannte Umgebungsvariablen / Konstanten

- `NVIDIA`
- `REST`
- `PROJECT`
- `SCOPES`
- `GOOGLE_CLOUD_PROJECT`
- `YOUR_PROJECT_ID`
- `GEMINI_API_KEY`
- `YOUR_GEMINI_API_KEY`
- `GOOGLE_CLOUD_LOCATION`
- `YOUR_PROJECT_LOCATION`
- `GOOGLE_API_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `YOUR_GOOGLE_API_KEY`
- `GOOGLE_GENAI_USE_VERTEXAI`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### Gemini CLI Authentication Setup | gemini-cli
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html
- Bereinigte Download-URL: https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html

---

**Quelle `INDEX.md`**

- Original-URL: https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html
- Bereinigte Download-URL: https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html
- Lokale Datei(en): HTML: `gemini-cli-authentication.html`, Text: `gemini-cli-authentication.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html
- Lokale Datei(en): HTML: `gemini-cli-authentication.html`, Text: `gemini-cli-authentication.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Gemini CLI authentication
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://developers.google.com/gemini-code-assist/docs/set-up-gemini
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/set-up-gemini

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.google.com/gemini-code-assist/docs/set-up-gemini
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/set-up-gemini
- Lokale Datei(en): HTML: `set-up-gemini.html`, Text: `set-up-gemini.txt`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.google.com/gemini-code-assist/docs/use-gemini-code-assist-chat
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/use-gemini-code-assist-chat

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.google.com/gemini-code-assist/docs/use-gemini-code-assist-chat
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/use-gemini-code-assist-chat
- Lokale Datei(en): HTML: `use-gemini-code-assist-chat.html`, Text: `use-gemini-code-assist-chat.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.google.com/gemini-code-assist/docs/set-up-gemini
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.google.com/gemini-code-assist/docs/chat-overview
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/chat-overview

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.google.com/gemini-code-assist/docs/chat-overview
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/chat-overview
- Lokale Datei(en): HTML: `chat-overview.html`, Text: `chat-overview.txt`

---

**Quelle `INDEX.md`**

### Authentication with OAuth quickstart | Gemini API | Google AI for Developers
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://ai.google.dev/gemini-api/docs/oauth
- Bereinigte Download-URL: https://ai.google.dev/gemini-api/docs/oauth

---

**Quelle `INDEX.md`**

- Original-URL: https://ai.google.dev/gemini-api/docs/oauth
- Bereinigte Download-URL: https://ai.google.dev/gemini-api/docs/oauth
- Lokale Datei(en): HTML: `gemini-api-oauth.html`, Text: `gemini-api-oauth.txt`

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://ai.google.dev/gemini-api/docs/oauth
- Lokale Datei(en): HTML: `gemini-api-oauth.html`, Text: `gemini-api-oauth.txt`
- Abrufdatum: `2026-04-24T05:09:30.736134+02:00`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:09:30.736134+02:00`
- Zweck: Gemini API OAuth
- Download-Werkzeug: `urllib`

---

**Quelle `chat-overview.txt`**

Cast SDK Developer Console

---

**Quelle `gemini-api-oauth.txt`**

Authentication with OAuth quickstart  |  Gemini API  |  Google AI for Developers

---

**Quelle `gemini-api-oauth.txt`**

Get API key

---

**Quelle `gemini-api-oauth.txt`**

API keys

---

**Quelle `gemini-api-oauth.txt`**

Models

---

**Quelle `gemini-api-oauth.txt`**

All models

---

**Quelle `gemini-api-oauth.txt`**

Embeddings

---

**Quelle `gemini-api-oauth.txt`**

Function calling

---

**Quelle `gemini-api-oauth.txt`**

Tools

---

**Quelle `gemini-api-oauth.txt`**

Combine Tools and Function calling

---

**Quelle `gemini-api-oauth.txt`**

Get started using the GenAI SDK

---

**Quelle `gemini-api-oauth.txt`**

Tool use

---

**Quelle `gemini-api-oauth.txt`**

Ephemeral tokens

---

**Quelle `gemini-api-oauth.txt`**

OpenAI compatibility

---

**Quelle `gemini-api-oauth.txt`**

Token counting

---

**Quelle `gemini-api-oauth.txt`**

Vercel AI SDK

---

**Quelle `gemini-api-oauth.txt`**

Rate limits

---

**Quelle `gemini-api-oauth.txt`**

Billing info

---

**Quelle `gemini-api-oauth.txt`**

Migrate to Gen AI SDK

---

**Quelle `gemini-api-oauth.txt`**

OAuth authentication

---

**Quelle `gemini-api-oauth.txt`**

Authentication with OAuth quickstart

---

**Quelle `gemini-api-oauth.txt`**

The easiest way to authenticate to the Gemini API is to configure an API key, as
described in the Gemini API quickstart. If you

---

**Quelle `gemini-api-oauth.txt`**

described in the Gemini API quickstart. If you
need stricter access controls, you can use OAuth instead. This guide will help
you set up authentication with OAuth.

---

**Quelle `gemini-api-oauth.txt`**

need stricter access controls, you can use OAuth instead. This guide will help
you set up authentication with OAuth.

---

**Quelle `gemini-api-oauth.txt`**

This guide uses a simplified authentication approach that is appropriate
for a testing environment. For a production environment, learn

---

**Quelle `gemini-api-oauth.txt`**

about
authentication and authorization 
before

---

**Quelle `gemini-api-oauth.txt`**

before
choosing the access credentials 
that are appropriate for your app.

---

**Quelle `gemini-api-oauth.txt`**

Set up your cloud project for OAuth

---

**Quelle `gemini-api-oauth.txt`**

Set up application-default-credentials

---

**Quelle `gemini-api-oauth.txt`**

Manage credentials in your program instead of using gcloud auth

---

**Quelle `gemini-api-oauth.txt`**

2. Configure the OAuth consent screen

---

**Quelle `gemini-api-oauth.txt`**

Next configure the project's OAuth consent screen and add yourself as a test
user. If you've already completed this step for your Cloud project, skip to the

---

**Quelle `gemini-api-oauth.txt`**

Complete the rest of the form, accept the User Data Policy terms, and then
click Create.

---

**Quelle `gemini-api-oauth.txt`**

For now, you can skip adding scopes and click Save and Continue. In the
future, when you create an app for use outside of your Google Workspace

---

**Quelle `gemini-api-oauth.txt`**

future, when you create an app for use outside of your Google Workspace
organization, you must add and verify the authorization scopes that your
app requires.

---

**Quelle `gemini-api-oauth.txt`**

3. Authorize credentials for a desktop application

---

**Quelle `gemini-api-oauth.txt`**

To authenticate as an end user and access user data in your app, you need to
create one or more OAuth 2.0 Client IDs. A client ID is used to identify a

---

**Quelle `gemini-api-oauth.txt`**

To authenticate as an end user and access user data in your app, you need to
create one or more OAuth 2.0 Client IDs. A client ID is used to identify a
single app to Google's OAuth servers. If your app runs on multiple platforms,

---

**Quelle `gemini-api-oauth.txt`**

create one or more OAuth 2.0 Client IDs. A client ID is used to identify a
single app to Google's OAuth servers. If your app runs on multiple platforms,
you must create a separate client ID for each platform.

---

**Quelle `gemini-api-oauth.txt`**

single app to Google's OAuth servers. If your app runs on multiple platforms,
you must create a separate client ID for each platform.

---

**Quelle `gemini-api-oauth.txt`**

Go to Credentials

---

**Quelle `gemini-cli-authentication.txt`**

Gemini CLI Authentication Setup | gemini-cli

---

**Quelle `gemini-cli-authentication.txt`**

Gemini CLI Authentication Setup

---

**Quelle `gemini-cli-authentication.txt`**

Gemini CLI requires authentication using Google’s services. Before using Gemini CLI, configure one of the following authentication methods:

---

**Quelle `gemini-cli-authentication.txt`**

Recommended: Login with Google

---

**Quelle `gemini-cli-authentication.txt`**

Use Gemini API key

---

**Quelle `gemini-cli-authentication.txt`**

If you are running the Gemini CLI within a Google Cloud Shell environment, authentication is typically automatic using your Cloud Shell credentials.

---

**Quelle `gemini-cli-authentication.txt`**

Authenticate in Interactive mode

---

**Quelle `gemini-cli-authentication.txt`**

> 1. Login with Google
> 2. Use Gemini API key

---

**Quelle `gemini-cli-authentication.txt`**

> 1. Login with Google
> 2. Use Gemini API key
> 3. Vertex AI

---

**Quelle `gemini-cli-authentication.txt`**

The following sections provide instructions for each of these authentication options.

---

**Quelle `gemini-cli-authentication.txt`**

Select Login with Google. Gemini CLI will open a login prompt using your web browser.

---

**Quelle `gemini-cli-authentication.txt`**

If you are a Google AI Pro or Google AI Ultra subscriber, login with the Google account associated with your subscription.

---

**Quelle `gemini-cli-authentication.txt`**

Follow the on-screen instructions. Your credentials will be cached locally for future sessions.

---

**Quelle `gemini-cli-authentication.txt`**

Note: This method requires a web browser on a machine that can communicate with the terminal running the CLI (e.g., your local machine). The browser will be redirected to a localhost URL that the CLI listens on during setup.

---

**Quelle `gemini-cli-authentication.txt`**

Using the product outside the supported regions for free individual usage.

---

**Quelle `gemini-cli-authentication.txt`**

To set the project ID, export the GOOGLE_CLOUD_PROJECT environment variable:

---

**Quelle `gemini-cli-authentication.txt`**

To make this setting persistent, see Persisting Environment Variables.

---

**Quelle `gemini-cli-authentication.txt`**

Use Gemini API Key

---

**Quelle `gemini-cli-authentication.txt`**

If you don’t want to authenticate using your Google account, you can use an API key from Google AI Studio.

---

**Quelle `gemini-cli-authentication.txt`**

Obtain your API key from Google AI Studio.

---

**Quelle `gemini-cli-authentication.txt`**

Set the GEMINI_API_KEY environment variable:

---

**Quelle `gemini-cli-authentication.txt`**

Warning: Treat API keys, especially for services like Gemini, as sensitive credentials. Protect them to prevent unauthorized access and potential misuse of the service under your account.

---

**Quelle `gemini-cli-authentication.txt`**

If you intend to use Google Cloud’s Vertex AI platform, you have several authentication options:

---

**Quelle `gemini-cli-authentication.txt`**

Application Default Credentials (ADC) and gcloud.

---

**Quelle `gemini-cli-authentication.txt`**

A Google Cloud API key.

---

**Quelle `gemini-cli-authentication.txt`**

First: Set required environment variables

---

**Quelle `gemini-cli-authentication.txt`**

Regardless of your method of authentication, you’ll typically need to set the following variables: GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.

---

**Quelle `gemini-cli-authentication.txt`**

A. Vertex AI - Application Default Credentials (ADC) using gcloud

---

**Quelle `gemini-cli-authentication.txt`**

Consider this method of authentication if you have Google Cloud CLI installed.

---

**Quelle `gemini-cli-authentication.txt`**

gcloud auth application-default login

---

**Quelle `gemini-cli-authentication.txt`**

See Set up Application Default Credentials for details.

---

**Quelle `gemini-cli-authentication.txt`**

Consider this method of authentication in non-interactive environments, CI/CD, or if your organization restricts user-based ADC or API key creation.

---

**Quelle `gemini-cli-authentication.txt`**

Set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the JSON file’s absolute path:

---

**Quelle `gemini-cli-authentication.txt`**

# Replace /path/to/your/keyfile.json with the actual path
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/keyfile.json"

---

**Quelle `gemini-cli-authentication.txt`**

C. Vertex AI - Google Cloud API key

---

**Quelle `gemini-cli-authentication.txt`**

Obtain a Google Cloud API key: Get an API Key.

---

**Quelle `gemini-cli-authentication.txt`**

Set the GOOGLE_API_KEY environment variable:

---

**Quelle `gemini-cli-authentication.txt`**

# Replace YOUR_GOOGLE_API_KEY with your Vertex AI API key
export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"

---

**Quelle `gemini-cli-authentication.txt`**

Note: If you see errors like "API keys are not supported by this API...", your organization might restrict API key usage for this service. Try the Service Account JSON Key or ADC methods instead.

---

**Quelle `gemini-cli-authentication.txt`**

To make any of these Vertex AI environment variable settings persistent, see Persisting Environment Variables.

---

**Quelle `set-up-gemini.txt`**

Now you're ready to sign in to your Google Account and accept the
Gemini Privacy Notice in your IDE.

---

**Quelle `set-up-gemini.txt`**

In the Gemini Code Assist: Chat window, click Login to Google.

---

**Quelle `set-up-gemini.txt`**

In the Gemini Code Assist telemetry section, you can select whether or
not to send usage statistics, such as crash reports, to Google. Usage
statistics are subject to the

---

**Quelle `set-up-gemini.txt`**

out of allowing Google to use your data to develop and improve Google's
machine learning models. These privacy settings are stored at the IDE
level.

---

**Quelle `set-up-gemini.txt`**

always opted out of sharing your data to develop and improve Google's
machine learning models.

---

**Quelle `set-up-gemini.txt`**

In the section about Gemini Code Usage Statistics, you can select
whether or not to send usage statistics, such as crash reports, to Google.

---

**Quelle `set-up-gemini.txt`**

In the section about Gemini Code Usage Statistics, you can select
whether or not to send usage statistics, such as crash reports, to Google.
Usage statistics are subject to the

---

**Quelle `set-up-gemini.txt`**

whether or not to send usage statistics, such as crash reports, to Google.
Usage statistics are subject to the
Google privacy policy.

---

**Quelle `set-up-gemini.txt`**

Cast SDK Developer Console

---

**Quelle `use-gemini-code-assist-chat.txt`**

In the Gemini Code Assist tool window, enter a prompt and
then click Submit.

---

**Quelle `use-gemini-code-assist-chat.txt`**

If you want to re-use your previous prompts, you can find them in your
Query History in the Gemini Code Assist tool window by clicking
schedule Show Query History.

---

**Quelle `use-gemini-code-assist-chat.txt`**

In the Gemini Code Assist tool window, click
chat_bubble Recent

---

**Quelle `use-gemini-code-assist-chat.txt`**

Cast SDK Developer Console

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `gemini-api-oauth.txt`**

````text
curl -X GET https://generativelanguage.googleapis.com/v1/models \
````

---

**Quelle `gemini-api-oauth.txt`**

````text
pip install google-genai
````

---

**Quelle `gemini-api-oauth.txt`**

````text
pip install --upgrade -q google-api-python-client google-auth-httplib2 google-auth-oauthlib
````

---

**Quelle `gemini-cli-authentication.txt`**

````text
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
````

---

**Quelle `gemini-cli-authentication.txt`**

````text
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
````

---

**Quelle `gemini-cli-authentication.txt`**

````text
export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"
````

---

**Quelle `gemini-cli-authentication.txt`**

````text
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/keyfile.json"
````

---

**Quelle `gemini-cli-authentication.txt`**

````text
export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>Oauth/Gemini/chat-overview.txt</code></summary>

````text
Gemini Code Assist chat features overview  |  Google for Developers

 Skip to main content

 Gemini Code Assist

 /

 English

 Deutsch

 Español

 Español – América Latina

 Français

 Indonesia

 Italiano

 Polski

 Português – Brasil

 Tiếng Việt

 Türkçe

 Русский

 עברית

 العربيّة

 فارسی

 हिंदी

 বাংলা

 ภาษาไทย

 中文 – 简体

 中文 – 繁體

 日本語

 한국어

 Sign in

 Home

 Guides

 Resources

 Gemini Code Assist

 Home

 Home

 Guides

 Resources

 Discover

Overview

Gemini in Android Studio

Gemini CLI

 Privacy notices

Terms of Service and Privacy Policies

Gemini Code Assist for individuals privacy notice

Supported languages, IDEs, and interfaces

How Gemini Code Assist works

Gemini 3 with Gemini Code Assist

How Gemini Code Assist Standard and Enterprise use your data

Responsible AI

 Get started

Set up Gemini Code Assist for individuals

Use the Gemini Code Assist chat

Set up Gemini Code Assist Standard and Enterprise

 Code in IDEs

Code features overview

Code with Gemini Code Assist

 Chat in IDEs

Chat features overview

Chat with Gemini Code Assist

Agent mode overview

Use the Gemini Code Assist agent mode

 Use code customization (Enterprise)

Code customization overview

Configure code customization

Use code customization

Encrypt data with customer-managed encryption keys

 Review code in GitHub

Review GitHub code with Gemini Code Assist

Set up Gemini Code Assist for GitHub

Use Gemini Code Assist for GitHub

Customize Gemini Code Assist behavior in GitHub

Code review style guide

 Configure

Keyboard shortcuts

Exclude files from Gemini Code Assist use

Configure local codebase awareness

Use pre-release features in Gemini Code Assist for VS Code

Control Network Access with User Domain Restrictions

 Standard and Enterprise

Configure Gemini Code Assist logging

Configure VPC Service Controls

Turn off Gemini Code Assist

 Troubleshoot

Troubleshoot access to Gemini Code Assist features

Provide feedback

 Home

 Products

 Gemini Code Assist

 Guides

 Gemini Code Assist chat features overview

 Stay organized with collections

 Save and categorize content based on your preferences.

Page Summary

 outlined_flag

This document outlines the chat features supported by Gemini Code Assist.

Gemini Code Assist provides source citations when its suggestions directly quote at length from a specific source.

You can perform various chat actions with Gemini Code Assist in supported IDEs, such as explaining code, creating multiple chats, editing prompts, and managing conversation history.

Gemini Code Assist allows for prompting with selected code or terminal output and specifying files and folders in your workspace context.

This document outlines the chat features that Gemini Code Assist
supports.

Learn how and when
 Gemini Code Assist Standard and Enterprise use
 your data.

Learn how and when
 Gemini Code Assist for individuals uses your data.

To help you comply with any license requirements for your code,
Gemini Code Assist provides source citations when its suggestions
directly quote at length from a specific source. To learn more about how and
when Gemini cites sources, see

How Gemini helps you generate code and cites sources.

You can perform the following chat actions with
Gemini Code Assist in any of the
supported IDEs:

Use Gemini Code Assist to explain your code

Create multiple chats

Select a Gemini model

Edit a prior prompt

Regenerate a prompt response

Delete prompt and response pairs

Configure code preview pane

Prompt Gemini Code Assist with selected code using chat

Add selected code snippets to context

Add terminal output to the chat context

Specify files and folders in your workspace context

Revert to a checkpoint in chat

View code diffs

Generate a file outline

Create custom commands

Create rules

Exclude files from your context with an .aiexclude or .gitignore file

Use the Gemini Code Assist agent mode

Configure local codebase awareness

What's next

Set up Gemini Code Assist for individuals,
Gemini Code Assist Standard,
or Gemini Code Assist Enterprise
if you haven't already.

To begin using Gemini Code Assist chat features in your IDE,
see Chat with Gemini Code Assist.

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License. For details, see the Google Developers Site Policies. Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2026-01-26 UTC.

 [[["Easy to understand","easyToUnderstand","thumb-up"],["Solved my problem","solvedMyProblem","thumb-up"],["Other","otherUp","thumb-up"]],[["Missing the information I need","missingTheInformationINeed","thumb-down"],["Too complicated / too many steps","tooComplicatedTooManySteps","thumb-down"],["Out of date","outOfDate","thumb-down"],["Samples / code issue","samplesCodeIssue","thumb-down"],["Other","otherDown","thumb-down"]],["Last updated 2026-01-26 UTC."],[],[]]

Connect

 Blog

 Bluesky

 Instagram

 LinkedIn

 X (Twitter)

 YouTube

Programs

 Google Developer Program

 Google Developer Groups

 Google Developer Experts

 Accelerators

 Google Cloud & NVIDIA

Developer consoles

 Google API Console

 Google Cloud Platform Console

 Google Play Console

 Firebase Console

 Actions on Google Console

 Cast SDK Developer Console

 Chrome Web Store Dashboard

 Google Home Developer Console

 Android

 Chrome

 Firebase

 Google Cloud Platform

 Google AI

 All products

 Terms

 Privacy

 Manage cookies

 English

 Deutsch

 Español

 Español – América Latina

 Français

 Indonesia

 Italiano

 Polski

 Português – Brasil

 Tiếng Việt

 Türkçe

 Русский

 עברית

 العربيّة

 فارسی

 हिंदी

 বাংলা

 ภาษาไทย

 中文 – 简体

 中文 – 繁體

 日本語

 한국어
````

</details>


<details>
<summary>Textanlage: <code>Oauth/Gemini/gemini-api-oauth.txt</code></summary>

````text
Authentication with OAuth quickstart  |  Gemini API  |  Google AI for Developers

 Skip to main content

 /

 English

 Deutsch

 Español – América Latina

 Français

 Indonesia

 Italiano

 Polski

 Português – Brasil

 Shqip

 Tiếng Việt

 Türkçe

 Русский

 עברית

 العربيّة

 فارسی

 हिंदी

 বাংলা

 ภาษาไทย

 中文 – 简体

 中文 – 繁體

 日本語

 한국어

 Get API key

 Cookbook

 Community

 Sign in

 Docs

 API reference

 Gemini API

 Docs

 API reference

 Get API key

 Cookbook

 Community

 Get started

Overview

Quickstart

API keys

Libraries

Pricing

Interactions API

Coding agent setup

 Models

All models

Gemini 3

Nano Banana

Veo

Lyria 3

Lyria RealTime

Imagen

Text-to-speech

Embeddings

Robotics

 Core capabilities

Text

 Image

Image generation 🍌

Image understanding

 Video

Video generation

Video understanding

Documents

 Speech and audio

Speech generation

Audio understanding

 Thinking

Thinking

Thought signatures

Structured outputs

Function calling

Long context

 Agents

Overview

Deep Research Agent

 Tools

Overview

Google Search

Google Maps

Code execution

URL context

Computer Use

File Search

Combine Tools and Function calling

 Live API

Overview

 Get started

Get started using the GenAI SDK

Get started using raw WebSockets

Capabilities

Tool use

Session management

Ephemeral tokens

Best practices

 Optimization

Overview

Batch API

Flex inference

Priority inference

Context caching

 Guides

 File input

Input methods

Files API

OpenAI compatibility

Media resolution

Token counting

Prompt engineering

 Logs and datasets

Get started with logs

Data logging and sharing

 Safety

Safety settings

Safety guidance

 Frameworks

LangChain & LangGraph

CrewAI

LlamaIndex

Vercel AI SDK

Temporal

 Resources

Release notes

Deprecations

Rate limits

Billing info

Migrate to Gen AI SDK

API troubleshooting

Partner and library integrations

 Google AI Studio

Quickstart

Vibe code in Build mode

Developing Full-Stack Apps

Troubleshooting

Access for Workspace users

 Google Cloud Platform

Gemini Enterprise Agent Platform Gemini API

OAuth authentication

 Policies

Terms of service

Available regions

Abuse monitoring

Feedback information

 Gemini Deep Research is now available in preview with collaborative planning, visualization, MCP support, and more.

 Home

 Gemini API

 Docs

 Send feedback

 Authentication with OAuth quickstart

The easiest way to authenticate to the Gemini API is to configure an API key, as
described in the Gemini API quickstart. If you
need stricter access controls, you can use OAuth instead. This guide will help
you set up authentication with OAuth.

This guide uses a simplified authentication approach that is appropriate
for a testing environment. For a production environment, learn
about
authentication and authorization 
before
choosing the access credentials 
that are appropriate for your app.

Objectives

Set up your cloud project for OAuth

Set up application-default-credentials

Manage credentials in your program instead of using gcloud auth

Prerequisites

To run this quickstart, you need:

A Google Cloud project 

A local installation of the gcloud CLI 

Set up your cloud project

To complete this quickstart, you first need to setup your Cloud project.

1. Enable the API

Before using Google APIs, you need to turn them on in a Google Cloud project.

In the Google Cloud console, enable the Google Generative Language API.

Enable the API

2. Configure the OAuth consent screen

Next configure the project's OAuth consent screen and add yourself as a test
user. If you've already completed this step for your Cloud project, skip to the
next section.

In the Google Cloud console, go to Menu >
Google Auth platform > Overview.

Go to the Google Auth platform

Complete the project configuration form and set the user type to External
in the Audience section.

Complete the rest of the form, accept the User Data Policy terms, and then
click Create.

For now, you can skip adding scopes and click Save and Continue. In the
future, when you create an app for use outside of your Google Workspace
organization, you must add and verify the authorization scopes that your
app requires.

Add test users:

Navigate to the
Audience page of the
Google Auth platform.

Under Test users, click Add users.

Enter your email address and any other authorized test users, then
click Save.

3. Authorize credentials for a desktop application

To authenticate as an end user and access user data in your app, you need to
create one or more OAuth 2.0 Client IDs. A client ID is used to identify a
single app to Google's OAuth servers. If your app runs on multiple platforms,
you must create a separate client ID for each platform.

In the Google Cloud console, go to Menu > Google Auth platform >
Clients.

Go to Credentials

Click Create Client.

Click Application type > Desktop app.

In the Name field, type a name for the credential. This name is only
shown in the Google Cloud console.

Click Create. The OAuth client created screen appears, showing your new
Client ID and Client secret.

Click OK. The newly created credential appears under OAuth 2.0 Client
IDs.

Click the download button to save the JSON file. It will be saved as
client_secret_<identifier>.json, and rename it to client_secret.json
and move it to your working directory.

Set up Application Default Credentials

To convert the client_secret.json file into usable credentials, pass its
location the gcloud auth application-default login command's
--client-id-file argument.

gcloud auth application-default login \
 --client-id-file=client_secret.json \
 --scopes='https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/generative-language.retriever'

The simplified project setup in this tutorial triggers a "Google hasn't
verified this app." dialog. This is normal, choose "continue".

This places the resulting token in a well known location so it can be accessed
by gcloud or the client libraries.

Note: If running on Colab include --no-browser and carefully follow the
instructions it prints (don't just click the link). Also make sure your local
gcloud --version is the
latest to match Colab.

gcloud auth application-default login 

 --no-browser
 --client-id-file=client_secret.json 

 --scopes='https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/generative-language.retriever'

Once you have the Application Default Credentials (ADC) set, the client
libraries in most languages need minimal to no help to find them.

Curl

The quickest way to test that this is working is to use it to access the REST
API using curl:

access_token=$(gcloud auth application-default print-access-token)
project_id=<MY PROJECT ID>
curl -X GET https://generativelanguage.googleapis.com/v1/models \
 -H 'Content-Type: application/json' \
 -H "Authorization: Bearer ${access_token}" \
 -H "x-goog-user-project: ${project_id}" | grep '"name"'

Python

In python the client libraries should find them automatically:

pip install google-genai

A minimal script to test it might be:

from google import genai

client = genai.Client()
print('Available base models:', [m.name for m in client.models.list()])

Next steps

If that's working you're ready to try
Semantic retrieval on your text data.

Manage credentials yourself [Python]

In many cases you won't have the gcloud command available to create the access
token from the Client ID (client_secret.json). Google provides libraries in
many languages to let you manage that process within your app. This section
demonstrates the process, in python. There are equivalent examples of this sort
of procedure, for other languages, available in the
Drive API documentation

1. Install the necessary libraries

Install the Google client library for Python, and the Gemini client library.

pip install --upgrade -q google-api-python-client google-auth-httplib2 google-auth-oauthlib
pip install google-genai

2. Write the credential manager

To minimize the number of times you have to click through the authorization
screens, create a file called load_creds.py in your working directory to
caches a token.json file that it can reuse later, or refresh if it expires.

Start with the
following code to convert the client_secret.json file to a token usable with
genai.configure:

import os.path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/generative-language.retriever']

def load_creds():
 """Converts `client_secret.json` to a credential object.

 This function caches the generated tokens to minimize the use of the
 consent screen.
 """
 creds = None
 # The file token.json stores the user's access and refresh tokens, and is
 # created automatically when the authorization flow completes for the first
 # time.
 if os.path.exists('token.json'):
 creds = Credentials.from_authorized_user_file('token.json', SCOPES)
 # If there are no (valid) credentials available, let the user log in.
 if not creds or not creds.valid:
 if creds and creds.expired and creds.refresh_token:
 creds.refresh(Request())
 else:
 flow = InstalledAppFlow.from_client_secrets_file(
 'client_secret.json', SCOPES)
 creds = flow.run_local_server(port=0)
 # Save the credentials for the next run
 with open('token.json', 'w') as token:
 token.write(creds.to_json())
 return creds

3. Write your program

Now create your script.py:

import pprint
from google import genai
from load_creds import load_creds

creds = load_creds()

client = genai.Client(credentials=creds)

print()
print('Available base models:', [m.name for m in client.models.list()])

4. Run your program

In your working directory, run the sample:

python script.py

The first time you run the script, it opens a browser window and prompts you
to authorize access.

If you're not already signed in to your Google Account, you're prompted to
sign in. If you're signed in to multiple accounts, be sure to select the
account you set as a "Test Account" when configuring your project.

Note: The simplified project setup in this tutorial triggers a "Google
hasn't verified this app." dialog. This is normal, choose "continue".

Authorization information is stored in the file system, so the next time you
run the sample code, you aren't prompted for authorization.

You have successfully setup authentication.

 Send feedback

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License. For details, see the Google Developers Site Policies. Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2026-04-20 UTC.

 Need to tell us more?

 [[["Easy to understand","easyToUnderstand","thumb-up"],["Solved my problem","solvedMyProblem","thumb-up"],["Other","otherUp","thumb-up"]],[["Missing the information I need","missingTheInformationINeed","thumb-down"],["Too complicated / too many steps","tooComplicatedTooManySteps","thumb-down"],["Out of date","outOfDate","thumb-down"],["Samples / code issue","samplesCodeIssue","thumb-down"],["Other","otherDown","thumb-down"]],["Last updated 2026-04-20 UTC."],[],[]]

 Terms

 Privacy

 Manage cookies

 English

 Deutsch

 Español – América Latina

 Français

 Indonesia

 Italiano

 Polski

 Português – Brasil

 Shqip

 Tiếng Việt

 Türkçe

 Русский

 עברית

 العربيّة

 فارسی

 हिंदी

 বাংলা

 ภาษาไทย

 中文 – 简体

 中文 – 繁體

 日本語

 한국어
````

</details>


<details>
<summary>Textanlage: <code>Oauth/Gemini/gemini-cli-authentication.txt</code></summary>

````text
Gemini CLI Authentication Setup | gemini-cli

gemini-cli

Gemini CLI Authentication Setup

Gemini CLI requires authentication using Google’s services. Before using Gemini CLI, configure one of the following authentication methods:

Interactive mode:

Recommended: Login with Google

Use Gemini API key

Use Vertex AI

Headless (non-interactive) mode

Google Cloud Shell

Quick Check: Running in Google Cloud Shell?

If you are running the Gemini CLI within a Google Cloud Shell environment, authentication is typically automatic using your Cloud Shell credentials.

Authenticate in Interactive mode

When you run Gemini CLI through the command-line, Gemini CLI will provide the following options:

> 1. Login with Google
> 2. Use Gemini API key
> 3. Vertex AI

The following sections provide instructions for each of these authentication options.

Recommended: Login with Google

If you are running Gemini CLI on your local machine, the simplest method is logging in with your Google account.

Important: Use this method if you are a Google AI Pro or Google AI Ultra subscriber.

Select Login with Google. Gemini CLI will open a login prompt using your web browser.

If you are a Google AI Pro or Google AI Ultra subscriber, login with the Google account associated with your subscription.

Follow the on-screen instructions. Your credentials will be cached locally for future sessions.

Note: This method requires a web browser on a machine that can communicate with the terminal running the CLI (e.g., your local machine). The browser will be redirected to a localhost URL that the CLI listens on during setup.

(Optional) Set your GOOGLE_CLOUD_PROJECT

When you log in using a Google account, you may be prompted to select a GOOGLE_CLOUD_PROJECT.

This can be necessary if you are:

Using a Google Workspace account.

Using a Gemini Code Assist license from the Google Developer Program.

Using a license from a Gemini Code Assist subscription.

Using the product outside the supported regions for free individual usage.

A Google account holder under the age of 18.

If you fall into one of these categories, you must:

Have a Google Cloud Project ID.

Enable the Gemini for Cloud API.

Configure necessary IAM access permissions.

To set the project ID, export the GOOGLE_CLOUD_PROJECT environment variable:

# Replace YOUR_PROJECT_ID with your actual Google Cloud Project ID
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"

To make this setting persistent, see Persisting Environment Variables.

Use Gemini API Key

If you don’t want to authenticate using your Google account, you can use an API key from Google AI Studio.

Obtain your API key from Google AI Studio.

Set the GEMINI_API_KEY environment variable:

# Replace YOUR_GEMINI_API_KEY with the key from AI Studio
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

To make this setting persistent, see Persisting Environment Variables.

Warning: Treat API keys, especially for services like Gemini, as sensitive credentials. Protect them to prevent unauthorized access and potential misuse of the service under your account.

Use Vertex AI

If you intend to use Google Cloud’s Vertex AI platform, you have several authentication options:

Application Default Credentials (ADC) and gcloud.

A Service Account JSON key.

A Google Cloud API key.

First: Set required environment variables

Regardless of your method of authentication, you’ll typically need to set the following variables: GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.

To set these variables:

# Replace with your project ID and desired location (e.g., us-central1)
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"

A. Vertex AI - Application Default Credentials (ADC) using gcloud

Consider this method of authentication if you have Google Cloud CLI installed.

Note: If you have previously set GOOGLE_API_KEY or GEMINI_API_KEY, you must unset them to use ADC:

unset GOOGLE_API_KEY GEMINI_API_KEY

Ensure you have a Google Cloud project and Vertex AI API is enabled.

Log in to Google Cloud:

gcloud auth application-default login

See Set up Application Default Credentials for details.

Ensure GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION are set.

B. Vertex AI - Service Account JSON key

Consider this method of authentication in non-interactive environments, CI/CD, or if your organization restricts user-based ADC or API key creation.

Note: If you have previously set GOOGLE_API_KEY or GEMINI_API_KEY, you must unset them:

unset GOOGLE_API_KEY GEMINI_API_KEY

Create a service account and key and download the provided JSON file. Assign the “Vertex AI User” role to the service account.

Set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the JSON file’s absolute path:

# Replace /path/to/your/keyfile.json with the actual path
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/keyfile.json"

Ensure GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION are set.

Warning: Protect your service account key file as it provides access to your resources.

C. Vertex AI - Google Cloud API key

Obtain a Google Cloud API key: Get an API Key.

Set the GOOGLE_API_KEY environment variable:

# Replace YOUR_GOOGLE_API_KEY with your Vertex AI API key
export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"

Note: If you see errors like "API keys are not supported by this API...", your organization might restrict API key usage for this service. Try the Service Account JSON Key or ADC methods instead.

To make any of these Vertex AI environment variable settings persistent, see Persisting Environment Variables.

Persisting Environment Variables

To avoid setting environment variables in every terminal session, you can:

Add your environment variables to your shell configuration file: Append the export ... commands to your shell’s startup file (e.g., ~/.bashrc, ~/.zshrc, or ~/.profile) and reload your shell (e.g., source ~/.bashrc).

# Example for .bashrc
echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.bashrc
source ~/.bashrc

Warning: Be advised that when you export API keys or service account paths in your shell configuration file, any process executed from the shell can potentially read them.

Use a .env file: Create a .gemini/.env file in your project directory or home directory. Gemini CLI automatically loads variables from the first .env file it finds, searching up from the current directory, then in ~/.gemini/.env or ~/.env. .gemini/.env is recommended.

Example for user-wide settings:

mkdir -p ~/.gemini
cat >> ~/.gemini/.env <<'EOF'
GOOGLE_CLOUD_PROJECT="your-project-id"
# Add other variables like GEMINI_API_KEY as needed
EOF

Variables are loaded from the first file found, not merged.

Non-interactive mode / headless environments

Non-interative mode / headless environments will use your existing authentication method, if an existing authentication credential is cached.

If you have not already logged in with an authentication credential (such as a Google account), you must configure authentication using environment variables:

Gemini API Key: Set GEMINI_API_KEY.

Vertex AI:

Set GOOGLE_GENAI_USE_VERTEXAI=true.

With Google Cloud API Key: Set GOOGLE_API_KEY.

With ADC: Ensure ADC is configured (e.g., via a service account with GOOGLE_APPLICATION_CREDENTIALS) and set GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.

The CLI will exit with an error in non-interactive mode if no suitable environment variables are found.

What’s next?

Your authentication method affects your quotas, pricing, Terms of Service, and privacy notices. Review the following pages to learn more:

Gemini CLI: Quotas and Pricing.

Gemini CLI: Terms of Service and Privacy Notice.

 This site is open source. Improve this page.
````

</details>


<details>
<summary>Textanlage: <code>Oauth/Gemini/set-up-gemini.txt</code></summary>

````text
Set up Gemini Code Assist for individuals  |  Google for Developers

 Skip to main content

 Gemini Code Assist

 /

 English

 Deutsch

 Español

 Español – América Latina

 Français

 Indonesia

 Italiano

 Polski

 Português – Brasil

 Tiếng Việt

 Türkçe

 Русский

 עברית

 العربيّة

 فارسی

 हिंदी

 বাংলা

 ภาษาไทย

 中文 – 简体

 中文 – 繁體

 日本語

 한국어

 Sign in

 Home

 Guides

 Resources

 Gemini Code Assist

 Home

 Home

 Guides

 Resources

 Discover

Overview

Gemini in Android Studio

Gemini CLI

 Privacy notices

Terms of Service and Privacy Policies

Gemini Code Assist for individuals privacy notice

Supported languages, IDEs, and interfaces

How Gemini Code Assist works

Gemini 3 with Gemini Code Assist

How Gemini Code Assist Standard and Enterprise use your data

Responsible AI

 Get started

Set up Gemini Code Assist for individuals

Use the Gemini Code Assist chat

Set up Gemini Code Assist Standard and Enterprise

 Code in IDEs

Code features overview

Code with Gemini Code Assist

 Chat in IDEs

Chat features overview

Chat with Gemini Code Assist

Agent mode overview

Use the Gemini Code Assist agent mode

 Use code customization (Enterprise)

Code customization overview

Configure code customization

Use code customization

Encrypt data with customer-managed encryption keys

 Review code in GitHub

Review GitHub code with Gemini Code Assist

Set up Gemini Code Assist for GitHub

Use Gemini Code Assist for GitHub

Customize Gemini Code Assist behavior in GitHub

Code review style guide

 Configure

Keyboard shortcuts

Exclude files from Gemini Code Assist use

Configure local codebase awareness

Use pre-release features in Gemini Code Assist for VS Code

Control Network Access with User Domain Restrictions

 Standard and Enterprise

Configure Gemini Code Assist logging

Configure VPC Service Controls

Turn off Gemini Code Assist

 Troubleshoot

Troubleshoot access to Gemini Code Assist features

Provide feedback

 Home

 Products

 Gemini Code Assist

 Guides

 Set up Gemini Code Assist for individuals

 Stay organized with collections

 Save and categorize content based on your preferences.

Page Summary

 outlined_flag

This document provides instructions for setting up Gemini Code Assist for individuals in VS Code or IntelliJ, including other supported JetBrains IDEs.

Setting up Gemini Code Assist involves installing the extension, signing in with your Google Account, and reviewing the privacy notice.

Detailed steps are provided for both VS Code and IntelliJ on how to install the Gemini Code Assist extension.

Instructions are included for signing in to your Google Account within both VS Code and IntelliJ.

The document explains how to access and review the Gemini Code Assist for individuals privacy notice and privacy settings in both IDEs.

Note: If you're at a business or would like more team-level benefits, consider
Gemini Code Assist Standard or Enterprise.

This document describes how to set up Gemini Code Assist for
individuals in VS Code or IntelliJ. Users of
other supported JetBrains IDEs
should follow the IntelliJ instructions when setting up
Gemini Code Assist. You perform the following steps in your IDE:

Install the Gemini Code Assist extension.

Sign in with your Google Account.

Read the Gemini Privacy Notice.

Install the Gemini Code Assist extension

To install the Gemini Code Assist extension in your IDE, follow
these steps:

 VS Code 

To open the Extensions view in VS Code, click
 
Extensions or press Ctrl/Cmd+Shift+X.

Search for Gemini Code Assist.

Click Install.

If prompted, restart VS Code.

After the extension has successfully installed,
 Gemini Code Assist appears in the activity bar and is
 ready for use. You can further configure your
 Gemini Code Assist installation by specifying your
 preferences using the top-level application taskbar: navigate to
 Code > Settings > Settings
 > Extensions and search for Gemini Code Assist.

 IntelliJ 

Click settings IDE
and Project Settings > Plugins.

In the Marketplace tab, search for Gemini Code Assist.

Click Install to install the plugin.

When the installation is finished, click Restart IDE.

When the IDE restarts, Gemini Code Assist appears in your
activity bar.

Now you're ready to sign in to your Google Account and accept the
Gemini Privacy Notice in your IDE.

Sign in to Google Account

In this section, you sign in to your Google Account by following these steps:

 VS Code 

If you prefer to follow the Code with
 Gemini Code Assist
 walkthrough directly in your IDE, click Launch VS Code and follow the
 steps in the walkthrough to sign in to your Google Account.

Launch VS Code

Otherwise, follow these steps:

Launch your IDE.

In the activity bar, click
sparkGemini Code
Assist.

In the Gemini Code Assist: Chat window, click Login to Google.

When prompted to allow Gemini Code Assist to open the
external website, click Open.

Follow the prompts to sign in to your Google Account.

When asked if you downloaded Gemini Code Assist from
Google, click Sign In.

Note: If your sign-in attempts keep timing out, see the
 Sign-in attempts keep timing out issue in
 Known issues
 for more information on troubleshooting.

You're now connected to your Google Account.

Gemini Code Assist is ready to use.

 IntelliJ 

To sign in to your Google Account, follow these steps:

In the activity bar, click
spark Gemini Code
Assist.

Click Sign in. Alternatively, you can click Copy link
and paste the URL into your browser.

On the page that opens in the web browser, select your Google Account.

On the screen that asks you to make sure that you downloaded this app
from Google, click Sign in.

Gemini Code Assist is now authorized to access your
account.

Now that you're signed in to your Google Account, you can read and dismiss the
Gemini Privacy Notice in your IDE.

Review the Gemini Code Assist for individuals privacy notice

After you've installed Gemini Code Assist and successfully signed
into Gemini Code Assist for individuals, the free version of
Gemini Code Assist, you'll see a privacy notice appear in the
chat panel in the Gemini Code Assist extension. We encourage you
to read the privacy notice to understand how Google handles
your data in VS Code or IntelliJ.

If you're using Gemini Code Assist for individuals, you can view
or update your privacy settings at any time.

You can find the Gemini Code Assist for individuals privacy
notice and settings in two ways:

 VS Code 

In the Gemini Code Assist chat pane, click
more_horiz More and then select
Privacy settings.

In your IDE, navigate to
settings Settings
> Extensions > Gemini Code Assist.

In the Gemini Code Assist telemetry section, you can select whether or
not to send usage statistics, such as crash reports, to Google. Usage
statistics are subject to the
Google privacy policy.

You'll also see a link to the Gemini Code Assist for
individuals privacy notice
and privacy settings. This link opens a page where you can choose to opt
out of allowing Google to use your data to develop and improve Google's
machine learning models. These privacy settings are stored at the IDE
level.

Note: If you're using Gemini Code Assist Standard and
Enterprise editions, the Gemini Code Assist for individuals
privacy notice doesn't apply to you, since with these editions you're
always opted out of sharing your data to develop and improve Google's
machine learning models.

 IntelliJ 

In the gutter of your IDE, click
spark
Gemini Code Assist, and then select Privacy settings.

Navigate to settings
Settings > Settings > Gemini.

In the section about Gemini Code Usage Statistics, you can select
whether or not to send usage statistics, such as crash reports, to Google.
Usage statistics are subject to the
Google privacy policy.

You'll also see a link to the Gemini Code Assist for
individuals privacy notice
and privacy settings. This link opens a page where you can choose to opt
out of allowing Google to use your data to develop and improve Google's
machine learning models. These privacy settings are stored at the IDE
level.

Note: If you're using Gemini Code Assist Standard and
Enterprise editions, the Gemini Code Assist for individuals
privacy notice doesn't apply to you, since with these editions you're
always opted out of sharing your data to develop and improve Google's
machine learning models.

Now you're ready to use Gemini Code Assist in your IDE. To get
started, see
Code with Gemini Code Assist
and Chat with Gemini Code Assist.

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License. For details, see the Google Developers Site Policies. Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2026-02-23 UTC.

 [[["Easy to understand","easyToUnderstand","thumb-up"],["Solved my problem","solvedMyProblem","thumb-up"],["Other","otherUp","thumb-up"]],[["Missing the information I need","missingTheInformationINeed","thumb-down"],["Too complicated / too many steps","tooComplicatedTooManySteps","thumb-down"],["Out of date","outOfDate","thumb-down"],["Samples / code issue","samplesCodeIssue","thumb-down"],["Other","otherDown","thumb-down"]],["Last updated 2026-02-23 UTC."],[],[]]

Connect

 Blog

 Bluesky

 Instagram

 LinkedIn

 X (Twitter)

 YouTube

Programs

 Google Developer Program

 Google Developer Groups

 Google Developer Experts

 Accelerators

 Google Cloud & NVIDIA

Developer consoles

 Google API Console

 Google Cloud Platform Console

 Google Play Console

 Firebase Console

 Actions on Google Console

 Cast SDK Developer Console

 Chrome Web Store Dashboard

 Google Home Developer Console

 Android

 Chrome

 Firebase

 Google Cloud Platform

 Google AI

 All products

 Terms

 Privacy

 Manage cookies

 English

 Deutsch

 Español

 Español – América Latina

 Français

 Indonesia

 Italiano

 Polski

 Português – Brasil

 Tiếng Việt

 Türkçe

 Русский

 עברית

 العربيّة

 فارسی

 हिंदी

 বাংলা

 ภาษาไทย

 中文 – 简体

 中文 – 繁體

 日本語

 한국어
````

</details>


<details>
<summary>Textanlage: <code>Oauth/Gemini/use-gemini-code-assist-chat.txt</code></summary>

````text
Use the Gemini Code Assist chat  |  Google for Developers

 Skip to main content

 Gemini Code Assist

 /

 English

 Deutsch

 Español

 Español – América Latina

 Français

 Indonesia

 Italiano

 Polski

 Português – Brasil

 Tiếng Việt

 Türkçe

 Русский

 עברית

 العربيّة

 فارسی

 हिंदी

 বাংলা

 ภาษาไทย

 中文 – 简体

 中文 – 繁體

 日本語

 한국어

 Sign in

 Home

 Guides

 Resources

 Gemini Code Assist

 Home

 Home

 Guides

 Resources

 Discover

Overview

Gemini in Android Studio

Gemini CLI

 Privacy notices

Terms of Service and Privacy Policies

Gemini Code Assist for individuals privacy notice

Supported languages, IDEs, and interfaces

How Gemini Code Assist works

Gemini 3 with Gemini Code Assist

How Gemini Code Assist Standard and Enterprise use your data

Responsible AI

 Get started

Set up Gemini Code Assist for individuals

Use the Gemini Code Assist chat

Set up Gemini Code Assist Standard and Enterprise

 Code in IDEs

Code features overview

Code with Gemini Code Assist

 Chat in IDEs

Chat features overview

Chat with Gemini Code Assist

Agent mode overview

Use the Gemini Code Assist agent mode

 Use code customization (Enterprise)

Code customization overview

Configure code customization

Use code customization

Encrypt data with customer-managed encryption keys

 Review code in GitHub

Review GitHub code with Gemini Code Assist

Set up Gemini Code Assist for GitHub

Use Gemini Code Assist for GitHub

Customize Gemini Code Assist behavior in GitHub

Code review style guide

 Configure

Keyboard shortcuts

Exclude files from Gemini Code Assist use

Configure local codebase awareness

Use pre-release features in Gemini Code Assist for VS Code

Control Network Access with User Domain Restrictions

 Standard and Enterprise

Configure Gemini Code Assist logging

Configure VPC Service Controls

Turn off Gemini Code Assist

 Troubleshoot

Troubleshoot access to Gemini Code Assist features

Provide feedback

 Home

 Products

 Gemini Code Assist

 Guides

 Use the Gemini Code Assist chat

 Stay organized with collections

 Save and categorize content based on your preferences.

Page Summary

 outlined_flag

Gemini Code Assist chat provides AI-powered assistance within your IDE using natural language prompts.

You can open the Gemini Code Assist chat in both VS Code and IntelliJ IDEs to get explanations, suggestions, and guided workflows.

Query history is available in IntelliJ but not in VS Code.

Chat history can be cleared in both VS Code and IntelliJ to remove irrelevant context for future prompts.

This document describes how to get AI-powered assistance in the
Gemini Code Assist chat in your
integrated development environment (IDE).

Gemini Code Assist chat lets you write natural language statements
or questions (called prompts) to get in-depth explanations of your code,
suggested actions, or guided workflows that help you complete tasks quickly and
efficiently without leaving the IDE.

Open Gemini Code Assist chat

To open Gemini Code Assist chat in the IDE:

 VS Code 

In the activity bar of your IDE, click
spark
Gemini Code Assist.

In the Gemini Code Assist chat, enter a prompt and then click
send
Send.

 IntelliJ 

In the Gemini Code Assist tool window, enter a prompt and
then click Submit.

View query history

 VS Code 

If you want to re-use your previous prompts, you can find them in your
Query History in the Gemini Code Assist tool window by clicking
schedule Show Query History.

 IntelliJ 

If you want to re-use your previous prompts, you can find them in your
Query History in the Gemini Code Assist tool window by clicking
schedule Show Query History.

Clear chat history

Gemini Code Assist uses the chat history for additional context
when responding to your prompts. If your chat history is no longer relevant to
what you're trying to achieve, you can clear the chat history:

 VS Code 

In the Gemini Code Assist pane, click
history Resume
Previous Chat.

When the previous chats appear in the Select chat menu, hold your
pointer over the chat that you want to clear, and select Delete.

Note: Your chat threads persist across IDE sessions until you clear your
history.

When prompted to confirm the deletion of the chat thread, select
Delete.

 IntelliJ 

In the Gemini Code Assist tool window, click
chat_bubble Recent
Chats.

When the previous chats appear in the Recent Chats menu, hold your
pointer over the chat that you want to clear, and select
delete Delete.

Note: Your query and conversation history persist across IDE sessions
until you clear the history.

What's next

For more information on using Gemini Code Assist in the IDE, see
Code with Gemini Code Assist.

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License. For details, see the Google Developers Site Policies. Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-12-10 UTC.

 [[["Easy to understand","easyToUnderstand","thumb-up"],["Solved my problem","solvedMyProblem","thumb-up"],["Other","otherUp","thumb-up"]],[["Missing the information I need","missingTheInformationINeed","thumb-down"],["Too complicated / too many steps","tooComplicatedTooManySteps","thumb-down"],["Out of date","outOfDate","thumb-down"],["Samples / code issue","samplesCodeIssue","thumb-down"],["Other","otherDown","thumb-down"]],["Last updated 2025-12-10 UTC."],[],[]]

Connect

 Blog

 Bluesky

 Instagram

 LinkedIn

 X (Twitter)

 YouTube

Programs

 Google Developer Program

 Google Developer Groups

 Google Developer Experts

 Accelerators

 Google Cloud & NVIDIA

Developer consoles

 Google API Console

 Google Cloud Platform Console

 Google Play Console

 Firebase Console

 Actions on Google Console

 Cast SDK Developer Console

 Chrome Web Store Dashboard

 Google Home Developer Console

 Android

 Chrome

 Firebase

 Google Cloud Platform

 Google AI

 All products

 Terms

 Privacy

 Manage cookies

 English

 Deutsch

 Español

 Español – América Latina

 Français

 Indonesia

 Italiano

 Polski

 Português – Brasil

 Tiếng Việt

 Türkçe

 Русский

 עברית

 العربيّة

 فارسی

 हिंदी

 বাংলা

 ภาษาไทย

 中文 – 简体

 中文 – 繁體

 日本語

 한국어
````

</details>
