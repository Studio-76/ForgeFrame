# API-Gemini.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## code-proxy native Gemini Adapter

Provider: `gemini-api`  
Praefix: `gemini/`  
Kategorie: `api`

## API-Key Variante

```http
POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=<api_key>
Content-Type: application/json
```

Streaming:

```http
POST https://generativelanguage.googleapis.com/v1beta/models/<model>:streamGenerateContent?alt=sse&key=<api_key>
```

## OAuth/Bearer Variante

Wenn ein Access Token vorhanden ist:

```http
Authorization: Bearer <access_token>
```

## Vertex/Cloud AI Companion Variante

Wenn `Account.Metadata["project_id"]` gesetzt ist, nutzt code-proxy:

```text
https://us-central1-aiplatform.googleapis.com/v1/projects/<project_id>/locations/us-central1/publishers/google/models/<model>:generateContent
```

bzw. Streaming mit `:streamGenerateContent?alt=sse`.

## OpenAI -> Gemini Mapping

- OpenAI `system` -> Gemini `systemInstruction.parts[].text`
- OpenAI `user` -> Gemini `contents[].role = "user"`
- OpenAI `assistant` -> Gemini `contents[].role = "model"`
- `max_tokens` -> `generationConfig.maxOutputTokens`
- `temperature` -> `generationConfig.temperature`
- OpenAI `tools[].function` -> Gemini `tools[].functionDeclarations[]`

## Modellmapping code-proxy

```text
contains "2.5-pro" or "pro"     -> gemini-2.5-pro-preview-06-05
contains "2.5-flash" or "flash" -> gemini-2.5-flash-preview-05-20
contains "2.0"                  -> gemini-2.0-flash
default                         -> gemini-2.5-flash-preview-05-20
```

## hermes-agent Google AI Studio

Provider-ID: `gemini`  
Auth type: `api_key`  
Base: `https://generativelanguage.googleapis.com/v1beta/openai`  
Env vars: `GOOGLE_API_KEY`, `GEMINI_API_KEY`  
Override: `GEMINI_BASE_URL`

Hermes nutzt hier die OpenAI-kompatible Gemini-API, nicht zwingend die native generateContent-API.

---

## Offizielle Dokumentationsanreicherung: `Provider/Gemini`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – Gemini

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### Gemini CLI | Gemini Code Assist | Google for Developers
- Quelle: Pflichtquelle
- Original-URL: https://developers.google.com/gemini-code-assist/docs/gemini-cli
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/gemini-cli
- Lokale Datei(en): HTML: `gemini-cli.html`, Text: `gemini-cli.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Gemini Code Assist CLI
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`

### Set up Gemini Code Assist on GitHub | Google for Developers
- Quelle: Pflichtquelle
- Original-URL: https://developers.google.com/gemini-code-assist/docs/set-up-code-assist-github
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/set-up-code-assist-github
- Lokale Datei(en): HTML: `set-up-code-assist-github.html`, Text: `set-up-code-assist-github.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Gemini Code Assist GitHub setup
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`

### Chat with Gemini Code Assist | Google for Developers
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.google.com/gemini-code-assist/docs/chat-gemini
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/chat-gemini
- Lokale Datei(en): HTML: `chat-gemini.html`, Text: `chat-gemini.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.google.com/gemini-code-assist/docs/gemini-cli
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### Use the Gemini Code Assist agent mode | Google for Developers
- Quelle: zusätzlich gefunden
- Original-URL: https://developers.google.com/gemini-code-assist/docs/use-agentic-chat-pair-programmer
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/use-agentic-chat-pair-programmer
- Lokale Datei(en): HTML: `use-agentic-chat-pair-programmer.html`, Text: `use-agentic-chat-pair-programmer.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.google.com/gemini-code-assist/docs/gemini-cli
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden

### Erkannte URLs und Basisadressen

- `https://developers.google.com/gemini-code-assist/docs/gemini-cli`
- `https://developers.google.com/gemini-code-assist/docs/set-up-code-assist-github`
- `https://developers.google.com/gemini-code-assist/docs/chat-gemini`
- `https://developers.google.com/gemini-code-assist/docs/use-agentic-chat-pair-programmer`
- `https://your-gitlab-instance.com/api/v4/mcp`
- `https://observability.mcp.cloudflare.com/sse`
- `https://bindings.mcp.cloudflare.com/sse`
- `https://api.githubcopilot.com/mcp/`

### Erkannte Endpunkte / Pfade

- Keine Endpunkte automatisch erkannt.

### Erkannte Umgebungsvariablen / Konstanten

- `YOUR_FILE_NAME_1`
- `YOUR_FILE_NAME_2`
- `FILE1`
- `FILE2`
- `GRPC`
- `GRPC_GO_LOG_SEVERITY_LEVEL`
- `NVIDIA`
- `TODO`
- `TOOL_NAME_1`
- `TOOL_NAME_2`
- `TOOL_NAME`
- `COMMAND`
- `GITHUB_PERSONAL_ACCESS_TOKEN`
- `ACCESS_TOKEN`
- `GEMINI`
- `AGENT`
- `FILENAME`
- `YOUR_KEY`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://developers.google.com/gemini-code-assist/docs/gemini-cli
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/gemini-cli

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.google.com/gemini-code-assist/docs/gemini-cli
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/gemini-cli
- Lokale Datei(en): HTML: `gemini-cli.html`, Text: `gemini-cli.txt`

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://developers.google.com/gemini-code-assist/docs/set-up-code-assist-github
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/set-up-code-assist-github

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.google.com/gemini-code-assist/docs/set-up-code-assist-github
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/set-up-code-assist-github
- Lokale Datei(en): HTML: `set-up-code-assist-github.html`, Text: `set-up-code-assist-github.txt`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.google.com/gemini-code-assist/docs/chat-gemini
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/chat-gemini

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.google.com/gemini-code-assist/docs/chat-gemini
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/chat-gemini
- Lokale Datei(en): HTML: `chat-gemini.html`, Text: `chat-gemini.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://developers.google.com/gemini-code-assist/docs/gemini-cli
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://developers.google.com/gemini-code-assist/docs/use-agentic-chat-pair-programmer
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/use-agentic-chat-pair-programmer

---

**Quelle `INDEX.md`**

- Original-URL: https://developers.google.com/gemini-code-assist/docs/use-agentic-chat-pair-programmer
- Bereinigte Download-URL: https://developers.google.com/gemini-code-assist/docs/use-agentic-chat-pair-programmer
- Lokale Datei(en): HTML: `use-agentic-chat-pair-programmer.html`, Text: `use-agentic-chat-pair-programmer.txt`

---

**Quelle `chat-gemini.txt`**

Gemini Code Assist allows managing chats, editing prompts, regenerating responses, and viewing code diffs.

---

**Quelle `chat-gemini.txt`**

In the Gemini Code Assist tool window, enter the prompt
Explain this code to me and click Submit.

---

**Quelle `chat-gemini.txt`**

If you want to re-use your previous prompts, you can find them in your
Query History in the Gemini Code Assist tool window by clicking
schedule Show Query

---

**Quelle `chat-gemini.txt`**

Expanded: Automatically expands all code blocks in
Gemini Code Assist chat responses.

---

**Quelle `chat-gemini.txt`**

Collapse: Automatically collapses all code blocks in
Gemini Code Assist chat responses.

---

**Quelle `chat-gemini.txt`**

For example, select a function in your code and enter the prompt Write
a unit test for this function.

---

**Quelle `chat-gemini.txt`**

In the activity bar, click spark
Gemini Code Assist to open the Gemini Code Assist tool window.

---

**Quelle `chat-gemini.txt`**

In the Gemini Code Assist tool window text field, enter a prompt for
the selected code.

---

**Quelle `chat-gemini.txt`**

For example, select a function in your code and enter the prompt Write a
unit test for this function.

---

**Quelle `chat-gemini.txt`**

If you've already clicked check Accept
changes for a chat generated code suggestion, then you have the option to

---

**Quelle `chat-gemini.txt`**

In this section, you prompt Gemini Code Assist to optimize your
code file, view the diff in your code file, and accept or reject changes as
preferred.

---

**Quelle `chat-gemini.txt`**

In the code file, click
check_small Accept or
close_small Reject.

---

**Quelle `chat-gemini.txt`**

If you want to accept or reject all of the suggested changes, click
Accept file or Reject file.

---

**Quelle `chat-gemini.txt`**

You can also use the Quick Preview in the prompt response to accept or
reject all suggestions across multiple code files.

---

**Quelle `chat-gemini.txt`**

In the code file, click
check_small Accept or
undo Reject.

---

**Quelle `chat-gemini.txt`**

In your IDE, navigate to Settings > Tools >
Gemini.

---

**Quelle `chat-gemini.txt`**

In the Value field, enter add comments to all functions without
comments in my code as the prompt.

---

**Quelle `chat-gemini.txt`**

In your IDE, navigate to Settings > Tools >
Gemini > Prompt Library.

---

**Quelle `chat-gemini.txt`**

In the Prompt Library's text box, enter the prompt:
Add comments to all functions without comments in this code.

---

**Quelle `chat-gemini.txt`**

For example, you can create a rule such as "Always give me concise responses in
Kotlin."

---

**Quelle `chat-gemini.txt`**

In the text field, enter a rule such as: Always generate unit tests when
creating a new function. You can also add one or more rules with multiple
lines in the text field.

---

**Quelle `chat-gemini.txt`**

To create a rule, go to
Settings > Tools > Gemini > Prompt Library > Rules and then edit the
text in the editor.

---

**Quelle `chat-gemini.txt`**

To set the scope of the rule, in the Scope drop-down, select IDE
or Project.

---

**Quelle `chat-gemini.txt`**

Chat responses may be truncated when they include an updated version of a
large open file

---

**Quelle `chat-gemini.txt`**

Vim: Cannot accept or dismiss code generation suggestions unless in
insert mode

---

**Quelle `chat-gemini.txt`**

When using the Vim plugin in normal mode, you can't accept or dismiss code
suggestions.

---

**Quelle `chat-gemini.txt`**

To work around this issue, press i to enter insert mode, and
then press Tab to accept the suggestion.

---

**Quelle `chat-gemini.txt`**

When you press Esc, both the IDE and
Gemini Code Assist suggestions are dismissed. This behavior
is different from the non-Vim behavior where pressing Esc

---

**Quelle `chat-gemini.txt`**

If your sign-in attempts keep timing out, try adding the
cloudcode.beta.forceOobLogin setting to your settings.json file:

---

**Quelle `chat-gemini.txt`**

"cloudcode.beta.forceOobLogin": true

---

**Quelle `chat-gemini.txt`**

Configure your firewall to allow access to oauth2.googleapis.com and
cloudaicompanion.googleapis.com.

---

**Quelle `chat-gemini.txt`**

You can use the grpc-health-probe tool to test connectivity. A
successful check results in the following output:

---

**Quelle `chat-gemini.txt`**

Cast SDK Developer Console

---

**Quelle `gemini-cli.txt`**

The Gemini CLI uses a reason and act (ReAct) loop with your built-in tools and local or remote MCP servers to complete complex use cases like fixing bugs, creating new features, and improving test coverage.

---

**Quelle `gemini-cli.txt`**

Gemini Code Assist for individuals, Standard, and Enterprise each provide quotas for using the Gemini CLI, shared with Gemini Code Assist agent mode.

---

**Quelle `gemini-cli.txt`**

Gemini Code Assist agent mode in VS Code is powered by Gemini CLI and offers a subset of its functionality directly within the chat in your IDE.

---

**Quelle `gemini-cli.txt`**

AI agent that provides access to Gemini directly in your terminal. The
Gemini CLI uses a reason and act (ReAct) loop with your built-in tools
and local or remote MCP servers to complete complex use cases like fixing bugs,

---

**Quelle `gemini-cli.txt`**

Each Gemini Code Assist edition
provides quotas for using the
Gemini CLI. Note that these quotas are shared between Gemini

---

**Quelle `gemini-cli.txt`**

provides quotas for using the
Gemini CLI. Note that these quotas are shared between Gemini
CLI and Gemini Code Assist agent mode. Gemini

---

**Quelle `gemini-cli.txt`**

CLI and Gemini Code Assist agent mode. Gemini
CLI also supports using a Gemini API key to
pay as you go.

---

**Quelle `gemini-cli.txt`**

Gemini Code Assist agent mode in VS Code is powered by
Gemini CLI. A subset of Gemini CLI functionality is
available directly in the Gemini Code Assist chat within VS Code.

---

**Quelle `gemini-cli.txt`**

Gemini CLI commands: /memory, /stats, /tools,
/mcp

---

**Quelle `gemini-cli.txt`**

built-in tools like grep, terminal, file read or file write

---

**Quelle `gemini-cli.txt`**

Cast SDK Developer Console

---

**Quelle `set-up-code-assist-github.txt`**

Ask your administrator to grant
you the Service Usage Admin role
and the geminicodeassistmanagement.scmConnectionAdmin role.

---

**Quelle `set-up-code-assist-github.txt`**

Ensure that the Google Cloud project you use during setup is
connected to a valid billing account.

---

**Quelle `set-up-code-assist-github.txt`**

You're redirected to the Admin Console for the
Gemini Code Assist app.

---

**Quelle `set-up-code-assist-github.txt`**

Login with your GitHub account.

---

**Quelle `set-up-code-assist-github.txt`**

Review and accept the Google Terms of Service, Generative AI Prohibited
Use Policy and Privacy Policy, and then click Complete setup.

---

**Quelle `set-up-code-assist-github.txt`**

In the Google Cloud console, go to the Gemini Code Assist
Agents & Tools page.

---

**Quelle `set-up-code-assist-github.txt`**

Go to Agents & Tools

---

**Quelle `set-up-code-assist-github.txt`**

The Request GitHub OAuth token dialog window open.

---

**Quelle `set-up-code-assist-github.txt`**

Follow the GitHub steps to authenticate to GitHub.

---

**Quelle `set-up-code-assist-github.txt`**

Cast SDK Developer Console

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Gemini Code Assist agent mode acts as a pair programmer in your IDE, allowing you to ask questions, improve generated content using context and tools, configure MCP servers, get solutions to complex tasks, generate code, and control agent behavior.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

You can configure tools for agent mode, including built-in tools and MCP servers, with different configuration methods for VS Code and IntelliJ.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Use context and built-in tools to improve generated content.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Control the agent behavior by commenting on, editing, and approving plans
and tool use during execution.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Gemini gives you a response to your prompt, or requests permission
to use a tool.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Click spark Gemini
in the tool window bar. Sign in if prompted to do so.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Caution: The agent has access to your machine's file system and terminal
actions as well as any tools you've configured for use. Be extremely
careful where and when you auto-approve changes.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Configure tools for agent mode

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Tools are a broad category of services that an agent can use for context and
actions in its response to your prompt. Some example tools are built-in tools

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Tools are a broad category of services that an agent can use for context and
actions in its response to your prompt. Some example tools are built-in tools
like grep and file read or write, local or remote Model Context Protocol (MCP)

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

like grep and file read or write, local or remote Model Context Protocol (MCP)
servers and their executable functions, or bespoke service implementations.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Control built-in tool use

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Agent mode has access to your built-in tools like file search, file read, file
write, terminal commands, and more.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

You can use the coreTools and excludeTools settings to control which tools
Gemini has access to in agent mode.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

coreTools
Lets you specify a list of tools that you want to be available to

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

coreTools
Lets you specify a list of tools that you want to be available to
the model. You can also specify command-specific restrictions for tools that

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Lets you specify a list of tools that you want to be available to
the model. You can also specify command-specific restrictions for tools that
support it. For example—adding the following to your

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Gemini settings JSON will only allow the shell ls -l command to
be executed:"coreTools": ["ShellTool(ls -l)"].
excludeTools

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

be executed:"coreTools": ["ShellTool(ls -l)"].
excludeTools
Lets you specify a list of tools that you don't want to be available to the

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

excludeTools
Lets you specify a list of tools that you don't want to be available to the
model. You can also specify command-specific restrictions for tools that

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Lets you specify a list of tools that you don't want to be available to the
model. You can also specify command-specific restrictions for tools that
support it. For example—adding the following to your Gemini

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

settings JSON will block the use of the rm -rf command:
"excludeTools": ["ShellTool(rm -rf)"].

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

A tool listed in both excludeTools and coreTools is excluded.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

To configure the built-in tools available in agent mode, do the following:

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

To restrict agent tool use to a list of approved tools, add the
following line to your Gemini settings JSON:

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

"coreTools": ["TOOL_NAME_1,TOOL_NAME_2"]

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Replace TOOL_NAME_1 and
TOOL_NAME_2 with the names of the

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Replace TOOL_NAME_1 and
TOOL_NAME_2 with the names of the
built-in tools you want the

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

TOOL_NAME_2 with the names of the
built-in tools you want the
agent to have access to.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

You can list as many built-in tools as you want.
By default all built-in tools are available to the agent.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

To restrict agent tool use to specific tool commands, add the
following line to your Gemini settings JSON:

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

"coreTools": ["TOOL_NAME(COMMAND)"]

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

TOOL_NAME: the name of the built-in tool

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

COMMAND: the name of the built-in tool command
you want the agent to be able to use.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

To exclude a tool from agent use, add the following line to your
Gemini settings JSON:

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

"excludeTools": ["TOOL_NAME_1,TOOL_NAME_2"]

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

Replace TOOL_NAME_1 and
TOOL_NAME_2 with the names of the
built-in tools you want to exclude from agent use.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

TOOL_NAME_2 with the names of the
built-in tools you want to exclude from agent use.

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

To exclude a tool command from agent use, add the following line to your
Gemini settings JSON:

---

**Quelle `use-agentic-chat-pair-programmer.txt`**

"excludeTools": ["TOOL_NAME(COMMAND)"]

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten


---

**Quelle `chat-gemini.txt`**

````text
export GRPC_GO_LOG_SEVERITY_LEVEL=info
````

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>Provider/Gemini/chat-gemini.txt</code></summary>

````text
Chat with Gemini Code Assist  |  Google for Developers

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

 Chat with Gemini Code Assist

 Stay organized with collections

 Save and categorize content based on your preferences.

Page Summary

 outlined_flag

Gemini Code Assist is an AI-powered collaborator in your IDE that helps with coding tasks.

You can use Gemini Code Assist to explain your code, generate code, manage project context, and create custom commands and rules.

Gemini Code Assist supports VS Code and IntelliJ and other supported JetBrains IDEs.

You can specify files, folders, and terminal output to provide context for Gemini Code Assist prompts.

Gemini Code Assist allows managing chats, editing prompts, regenerating responses, and viewing code diffs.

This document describes how you can use Gemini Code Assist,
an AI-powered collaborator in your IDE, to help you do the following in VS Code
or IntelliJ and other supported JetBrains IDEs:

Receive guidance to help you solve problems with your code.

Generate code for your project.

Manage the context of your project by specifying files and folders.

Create custom commands and rules.

If you're using Gemini Code Assist Enterprise, you
can use Code customization,
which lets you get code suggestions based on your organization's private
codebase directly from Gemini Code Assist Enterprise. Learn
how to configure code customization.

This document is intended for developers of all skill levels. It assumes you
have working knowledge of VS Code or IntelliJ and other supported JetBrains
IDEs. You can also use
Gemini in Android Studio.

Note: The behaviour of code generation, completion, and transformation are
non-deterministic when used simultaneously with other plugins that either
implement the same shortcuts and/or use the same platform API to process these
actions.

Before you begin

 VS Code 

 Set up Gemini Code Assist for individuals,
 Gemini Code Assist Standard,
 or Gemini Code Assist Enterprise
 if you haven't already.

Before testing Gemini Code Assist capabilities in your
code file, make sure your file's coding language is supported. For more
information on supported coding languages, see
Supported coding languages.

If you prefer to use your IDE behind a proxy, see
Network Connections in Visual Studio Code.

 IntelliJ 

 Set up Gemini Code Assist for individuals,
 Gemini Code Assist Standard,
 or Gemini Code Assist Enterprise
 if you haven't already.

Before testing Gemini Code Assist capabilities in your
code file, make sure your file's coding language is supported. For more
information on supported coding languages, see
Supported coding languages.

If you prefer to use your IDE behind a proxy, see
HTTP Proxy.

Use the Gemini Code Assist chat to explain your code

In this section, you prompt Gemini Code Assist to provide an
explanation of your existing code.

 VS Code 

To get an explanation of your code, follow these steps:

Open your code file.

In the activity bar of your IDE, click
spark Gemini Code
Assist.

In the Gemini Code Assist pane, enter the prompt Explain this code to
me and click send
Send.

Gemini Code Assist uses the code in your code file as a
reference to your prompt and responds with an explanation of your code.

To refer to a specific block of code instead of all the code in the file,
you can select the block in your code file and then prompt
Gemini Code Assist.

 IntelliJ 

To get an explanation of your code, follow these steps:

In your IDE, open your code file.

In the Gemini Code Assist tool window, enter the prompt
Explain this code to me and click Submit.

Gemini Code Assist uses the code in your code file as a
reference to your prompt and responds with an explanation of your code.

If you only want an explanation of a certain part of your code, you can select
certain code and then prompt Gemini Code Assist again.
Gemini Code Assist will only use the selected code as a
reference to its generated response.

When Gemini Code Assist provides you with code in its
response, you can select the following options listed at the end of its
response:

Insert at Cursor: Inserts the generated code into your current
file at your current cursor position.

Insert in New File: Opens a new file and inserts the generated
code into the new file.

These options are available when Gemini Code Assist identifies
the language used in your code block, and if this language is supported in
your current IDE.

View query history

If you want to re-use your previous prompts, you can find them in your
Query History in the Gemini Code Assist tool window by clicking
schedule Show Query
History.

Create multiple chats

You can create multiple chats with Gemini Code Assist which
contain their own context separate from other chats. Your chat history shows
your first chat and the last updated timestamp. There's a limit of 20 chats.
Once you reach this limit, the oldest chat is automatically deleted when you add
a new chat.

 VS Code 

To add a new chat, click add
New Chat and enter your prompt in the text field. After you enter the
prompt, Gemini Code Assist creates the new chat.

To access your previous chat, click
history Resume Previous Chat. A list
of your chats appear. Select the chat that you want to view.

To delete a chat thread, click Resume Previous Chat and then click
delete Delete next to the chat that
you want to delete.

 IntelliJ 

To add a new chat, click add
New Chat and enter your prompt in the text field. After you enter the
prompt, Gemini Code Assist creates the new chat.

To access your previous chat, click
chat_bubble Recent Chats. A list of
your chats appear. Select the chat that you want to view.

To delete a chat thread, click Recent chats and then click
delete Delete next to the chat that
you want to delete.

Clear chat history

Gemini Code Assist uses the chat history for additional context
when responding to your prompts. If your chat history is no longer relevant, you
can clear the chat history.

Manage your chat

You can manage your Gemini Code Assist chat settings by doing the
following:

Configure automatic scrolling

 VS Code 

By default, Gemini Code Assist automatically scrolls through
your chat. To disable this behavior, perform the following tasks:

Navigate to Settings > Extensions >
Gemini Code Assist.

Search for the Automatic Scrolling setting and unselect the checkbox.

 IntelliJ 

This feature isn't supported in Gemini Code Assist for
IntelliJ and other JetBrains IDEs.

Stop in-progress chat

 VS Code 

You can stop an in-progress chat response by pressing
stop Stop:

 IntelliJ 

You can stop an in-progress chat response by pressing
stop Stop:

Select the model

If you use Gemini Code Assist Standard or Enterprise,
or if you have a Google AI Pro or Ultra subscription, you can select the model
that Gemini Code Assist uses when processing your prompts.

 VS Code 

In the Gemini Code Assist chat pane, click the model
selector dropdown.

Select the model that you want Gemini Code Assist to use.

 IntelliJ 

In the Gemini Code Assist chat pane, click the model
selector dropdown.

Select the model that you want Gemini Code Assist to use.

Edit a prior prompt

When you edit a prior prompt, Gemini Code Assist regenerates the
response to the edited prompt. To edit your prompt, follow these steps:

 VS Code 

In the chat pane, hold your pointer over the prompt that you want to
edit.

Click edit Edit.

Make changes to your prompt and click Update.

Gemini Code Assist generates a new response to your
edited prompt.

 IntelliJ 

In the chat pane, hold your pointer over the prompt that you want to
edit.

Click edit Edit.

Make changes to your prompt and click Update.

Gemini Code Assist generates a new response to your
edited prompt.

Regenerate a prompt response

If preferred, you can regenerate a different response to your most recent
prompt by following these steps:

 VS Code 

In the Gemini Code Assist Chat pane, at the bottom of your
most recent response, click replay
Regenerate response.

Gemini Code Assist re-evaluates your recent prompt and
provides a new response.

 IntelliJ 

In the Gemini Code Assist Chat pane, at the bottom of your
most recent response, click replay
Regenerate response.

Gemini Code Assist re-evaluates your recent prompt and
provides a new response.

Delete prompt and response pairs

To delete your prompt and Gemini Code Assist's response to that
particular prompt, follow these steps:

 VS Code 

In the chat pane, hold your pointer over your prompt that you wish to
remove.

Click Delete.

When prompted to confirm if you want to delete the prompt and response
pair, select Delete. Otherwise, click Cancel to cancel the
operation.

Your prompt and response pair is removed from your chat history with
Gemini Code Assist.

 IntelliJ 

In the chat pane, hold your pointer over your prompt that you wish to
remove.

Click Delete.

When prompted to confirm if you want to delete the prompt and response
pair, select Delete. Otherwise, click Cancel to cancel the
operation.

Your prompt and response pair is removed from your chat history with
Gemini Code Assist.

Configure code preview pane

By default, the code preview pane setting for Gemini Code Assist
chat is enabled. With this setting enabled, the preview code block in the
Gemini Code Assist chat shows the first 6 lines of code. You can
expand and collapse code blocks.

To change the default setting, perform the following tasks:

 VS Code 

In your IDE, navigate to Settings > Extensions
> Gemini Code Assist.

Search for the Default Code Block Display setting.

Select one of the following options:

Expanded: Automatically expands all code blocks in
Gemini Code Assist chat responses.

Preview: Only shows the first 6 lines of code in the code block. You
must expand the code block in the Gemini Code Assist chat
response to see the rest of the code. This is the default setting.

Collapse: Automatically collapses all code blocks in
Gemini Code Assist chat responses.

When the IDE reloads, the new setting takes effect.

 IntelliJ 

This feature is the default in IntelliJ Gemini Code Assist
and other JetBrains IDEs and is not configurable.

Prompt Gemini Code Assist with selected code using chat

Gemini Code Assist can perform tasks or answer your questions
based on the code that you select. To get generated code that's based on a
prompt with selected code, follow these steps:

 VS Code 

In the activity bar, click
spark Gemini Code
Assist to open the Gemini Code Assist pane.

In your code file, select a block of code.

In the Gemini Code Assist pane text field, enter a prompt for the
selected code.

For example, select a function in your code and enter the prompt Write
a unit test for this function.

Gemini uses your selected code as reference and responds to
your prompt.

 IntelliJ 

In the activity bar, click spark
Gemini Code Assist to open the Gemini Code Assist tool window.

In your code file, select a block of code.

In the Gemini Code Assist tool window text field, enter a prompt for
the selected code.

For example, select a function in your code and enter the prompt Write a
unit test for this function.

Gemini Code Assist uses your selected code as reference and
responds to your prompt.

Add selected code snippets to context

You can select, attach, and direct Gemini Code Assist to focus on
code snippets. Code snippet selection enables discrete analysis of smaller code
blocks instead of entire files.

When you select a code snippet in your code file,
you can instruct Gemini Code Assist add the code snippet to the
Context Drawer.

Anything selected in the editor window, but not yet added to the Context Drawer,
is also automatically included in the context. Selected code snippets only show
up for a single chat turn. They won't persist in the Context Drawer, but remain
in your Gemini Code Assist chat history.

In this section, you add a selected code snippet to your context and get an
explanation about the code snippet from Gemini Code Assist:

 VS Code 

In your code file, select a code snippet.

In the Gemini Code Assist Chat text field, click
Add to Chat Context.

Gemini Code Assist adds the selected code snippet to your
Context Drawer.

In the Gemini Code Assist Chat text field, enter the
prompt what does this code do?.

Gemini Code Assist responds to your prompt based on your
selected code snippet in the Context Drawer.

 IntelliJ 

In your code file, select a code snippet.

Select the spark
Gemini icon and then select Add Selected Text to Chat
Context from the menu.

The code snippet is added to your Context Drawer.

Prompt Gemini Code Assist with selected terminal output using chat

Gemini Code Assist can perform tasks or answer your questions
based on selected terminal output. To get an explanation of selected terminal
output, follow these steps:

 VS Code 

In your IDE, open your terminal (View > Terminal).

Select any terminal output.

Right-click the selected terminal output and select Gemini Code Assist:
Add to Chat Context.

Gemini Code Assist adds your terminal output to the Context
Drawer.

In the Gemini Code Assist Chat text field, enter the
prompt what does this do?.

Gemini Code Assist responds to your prompt based on your
selected terminal output in the Context Drawer.

 IntelliJ 

In the Gemini Code Assist Chat text field, enter
@terminal.

In the list that appears, under Terminals, select the terminal that
you want to enquire about.

In the Gemini Code Assist Chat text field, enter the
prompt what does this do?.

Gemini Code Assist responds to your prompt based on your
selected terminal output.

Specify files and folders in your workspace context

By default, Gemini Code Assist uses the current open file as
context. You can specify files or folders in your workspace for
Gemini Code Assist to use as additional context. When you specify
a folder, Gemini Code Assist uses the files in the folder as well
as the files in subfolders as context.

Note: When you include a folder, Gemini Code Assist selects up to
the first 100 files it finds within the folder and its subfolders. If you
require codebase awareness beyond this limit, you may want to consider use of
code customization.

 VS Code 

To specify files or folders in your chat prompt, type @ and select
the file or folder you want to specify.

To get an explanation on the differences of two files in your codebase, follow
these steps:

In the activity bar, click
spark Gemini Code
Assist.

In the Gemini Code Assist pane, enter the prompt Explain the
difference between @YOUR_FILE_NAME_1 and @YOUR_FILE_NAME_2 and press
Enter (for Windows and Linux) or Return (for macOS), or
Tab. You can also click the name of the file in the list to select
the file. Clicking the file name adds the file to your prompt context and
opens the file in your IDE.

Gemini Code Assist responds to your prompt while using the
two files you specified for context. Gemini Code Assist also
includes the files you specified in Context Sources.

Now that you've specified those files, you can continue asking additional
questions or prompts in the same chat history, without having to specify the
files again.

For example: In the Gemini Code Assist pane, enter the prompt How can I
improve YOUR_FILE_NAME_1? (without the @ symbol) and press
Enter (for Windows and Linux) or Return (for macOS).

Gemini Code Assist responds to your enquiry about the file you
specified in your prompt.

Note: If you clear your chat history, Gemini Code Assist no
longer uses your files for context and you must re-specify the files in the
chat pane using the @ symbol if you want to make more enquiries
about the files.

 IntelliJ 

To specify files or folders in your chat prompt, type
@ and select the files or folders you want to specify.

To get an explanation on the differences of two files in your codebase, follow
these steps:

In the activity bar, click
spark Gemini Code
Assist.

In the Gemini Code Assist pane, enter the prompt Explain the
difference between @YOUR_FILE_NAME_1 and @YOUR_FILE_NAME_2 and press
Enter (for Windows and Linux) or Return (for macOS), or
Tab. You can also click the name of the file in the list to select
the file. Clicking the file name adds the file to your prompt context and
opens the file in your IDE.

Gemini Code Assist responds to your prompt while using the
two files you specified for context. Gemini Code Assist also
includes the files you specified in Context Sources.

Now that you've specified those files, you can continue asking additional
questions or prompts in the same chat history, without having to specify them
again.

For example: In the Gemini Code Assist pane, enter the prompt How can I
improve YOUR_FILE_NAME_1? (without the @ symbol) and press
Enter (for Windows and Linux) or Return (for macOS).

Gemini Code Assist responds to your enquiry about the file you
specified in your prompt.

Note: If you clear your chat history, Gemini Code Assist no
longer uses your files for context and you must re-specify the files or
folders in the chat pane using the @ symbol if you want to make
more enquiries about the files.

Manage files and folders in the Context Drawer

After you specify a file or folder to be used as context for your Gemini Code Assist prompts, these files and folders
are placed in the Context Drawer, where you can view and remove them from the
prompt context.

To manage the files and folders in your Context Drawer, perform the following
tasks:

 VS Code 
Note: Chats created with Gemini Code Assist for VS Code, prior
to version 2.34.0, won't retain and display the saved context in the Context
Drawer. This can lead to issues where the chat doesn't display the correct
context. To build and retain context among chats, we recommend you clear chats
prior to this version.

In the activity bar of your IDE, click
spark Gemini Code
Assist.

To view the files and folders in your Context Drawer, click Context
items.

To remove items from the Context Drawer, click
close Remove.

 IntelliJ 

In the activity bar, click
spark Gemini Code
Assist.

To view the files and folders in your Context Drawer, click Context.

To remove files and folders from the Context Drawer, click
close Remove.

Exclude files from local context

If files are specified in a .aiexclude or .gitignore file,
Gemini Code Assist by default excludes them from local use in the
context for code completion, code generation, code transformation, and chat.

To learn how to exclude files from local use, see
Exclude files from Gemini Code Assist use.

Revert to a checkpoint in chat

After applying the changes that Gemini Code Assist generates
based on your prompt, you can choose to revert the modified code file(s) to a
certain checkpoint, which reverts all of the applied changes to the code
file(s).

Reverting to a checkpoint does not revert manual changes that you may have
made to the code file(s).

To revert your code file to a checkpoint, follow these steps:

 VS Code 

In the Gemini Code Assist chat pane, click
undo Revert to checkpoint. This
reverts your code file back to the checkpoint state before the edits were
made.

 IntelliJ 

If you've already clicked check Accept
changes for a chat generated code suggestion, then you have the option to
rollback the changes using the undo
Rollback changes button:

In the Gemini Code Assist chat pane, click
undo Rollback Changes. This reverts
your code file back to the checkpoint state before the edits were made.

View code diffs

By default, Gemini Code Assist suggests changes to your code with
a code diff. You can trigger this diff any time you ask
Gemini Code Assist to make changes to your code.

In this section, you prompt Gemini Code Assist to optimize your
code file, view the diff in your code file, and accept or reject changes as
preferred.

 VS Code 

With your code file opened, prompt Gemini Code Assist to
optimize this file. If you want to optimize multiple files and folders,
prompt Gemini Code Assist to optimize @FILE1 and @FILE2.

Gemini Code Assist responds to your prompt with code change
suggestions in the code file(s) along with an inline diff that illustrates
these changes.

In the code file, click
check_small Accept or
close_small Reject.

If Gemini Code Assist suggests multiple changes throughout
your code file(s), click View above the suggestion and then click
Next or Previous, to cycles through the other suggestions.

If you want to accept or reject all of the suggested changes, click
Accept file or Reject file.

You can also use the Quick Preview in the prompt response to accept or
reject all suggestions across multiple code files.

 IntelliJ 

With your code file opened, prompt Gemini Code Assist to
optimize this file. If you want to optimize multiple files and
folders prompt Gemini Code Assist to
optimize @FILE1 and @FILE2.

Gemini Code Assist responds to your prompt with code
change suggestions in the code file(s) along with an inline diff that
illustrates these changes.

In the code file, click
check_small Accept or
undo Reject.

If Gemini Code Assist suggests multiple changes throughout
your code file(s), click
arrow_upward or
arrow_downward to cycle
through the other suggestions.

You can also use the Quick Preview in the prompt response to accept or
reject all suggestions across multiple code files.

Change diff view settings

 VS Code 

If you prefer, you can change this setting to have a separate diff view
 window in your IDE by following these steps:

In the activity bar, navigate to
settings Settings >
Settings.

In the User tab of the settings, navigate to Extensions
> Gemini Code Assist.

Scroll to the Geminicodeassist > Chat: Change View setting.

In the dropdown list, select one of the following options:

Inline suggestions (enabled by default): Code changes displayed in
your code file.

Default diff view: Opens a new file with side-by-side code
changes.

 IntelliJ 

In the chat response of the Gemini Code Assist sidebar Ask
panel, click the Preview in diff mode button
(compare_arrows).

A Side-by-side tab appears in the main coding pane.

Click on the Side-by-side tab to view side-by-side code changes.

Generate and view a file outline

By default, Gemini Code Assist generates an outline for the file
in focus in your IDE. Note that outlines don't persist between IDE sessions,
which means a new outline is generated for a given file when you start a new
session, unless you disable automatic outline generation.
To view the outline generated by Gemini Code Assist, do the
following:

 VS Code 

In the Explorer sidebar, click the
Gemini Code Assist outline icon.

The Gemini Code Assist outline pane opens.

By default, the outline pane automatically generates an outline for the
current file in focus.

If you previously
disabled automatic outline generation, click
the Generate outline button to generate an outline for the current
file in focus.

(Optional): Click on a node in the outline to automatically
scroll to that portion of the code file.

(Optional): Click the Eye icon in the outline pane to
display the outline in-line in the code file itself.

When you make changes to a file that has an outline, a new outline is not
automatically generated. Instead, an Obsolete banner appears at the
bottom of the outline with an option to manually Refresh the outline.

 IntelliJ 

In the Gemini Code Assist chat pane, click the Outline
tab.

The outline for the active file appears in the tab.

(Optional): Click the Eye icon associated with the file outline to
display the outline in-line in the code file itself.

(Optional): Click the Eye icon that appears next to the Outline
tab to display all available outlines in-line in their respective code
files.

When you make changes to a file that has an outline, a new outline is not
automatically generated. Instead, the option to manually Refresh outline
becomes available in the Outline tab.

Toggle automatic outline generation

To toggle automatic Gemini Code Assist outline generation of
your code files, do the following:

 VS Code 

Navigate to Settings > User >
Extensions > Gemini Code Assist.

In the Gemini Code Assist window, toggle
Outlines: Automatic Outline Generation.

If you disable automatic outline generation, you can manually generate an
outline for the file in focus by right-clicking in the file and selecting
Gemini Code Assist > Outline current file,
or by going to the Gemini Code Assist outline pane and
clicking the Generate outline button.

 IntelliJ 

In your IDE, navigate to Settings > Tools >
Gemini.

In the Gemini settings window, toggle
Enable automatic outline generation.

If you disable automatic outline generation, you can manually generate an
outline for the file in focus by going to the Outline tab and
clicking Generate Outline.

Create custom commands

By default, Gemini Code Assist provides commands like
/generate for VS Code and Generate Code for IntelliJ and
other supported JetBrains IDEs. You can also create your own
custom commands to help you accomplish repetitive tasks faster in your IDE.

In this section, you create a custom command called add-comments that adds
comments to the code in your code file. For IntelliJ and other supported
JetBrains IDEs, you'll create, save, and execute the custom command from the
Prompt Library, and from the in-editor prompt.

 VS Code 

In your code file, press Control+I (for Windows and Linux) or
Command+I (for macOS) to open the
Gemini Code Assist Quick Pick menu.

In the menu, search for and select Preferences: Open Settings (UI).

In the Search settings field, enter Geminicodeassist: Custom
Commands.

In the Custom Commands box, select Add Item.

In the Item field, enter add-comments as the name of the command.

In the Value field, enter add comments to all functions without
comments in my code as the prompt.

Click OK.

You can now use the custom command add-comments in your IDE. The command
appears in the list of commands in the Gemini Code Assist
Quick Pick menu (Control+I (for Windows and Linux) or
Command+I (for macOS)).

 IntelliJ 

In your IDE, navigate to Settings > Tools >
Gemini > Prompt Library.

In the Prompt Library window, click
add Add.

Name your custom command add-comments.

In the Prompt Library's text box, enter the prompt:
Add comments to all functions without comments in this code.

Select the Show in In-Editor Prompt checkbox if it's unselected.

Click OK to save the custom command in the Prompt Library.

In your code file, highlight the code that you want to modify.

Right-click the highlighted code and navigate to Gemini >
Prompt Library and then select the custom command add-comments.

Gemini Code Assist executes the add-comments command and
adds comments to your highlighted code.

You can also invoke the custom command with the in-editor prompt by
performing the following tasks:

In your code file, highlight the code that you want to modify, and press
Alt+\ (for Windows and Linux) or Cmd+\ (for macOS) to
open the Gemini Code Assist Quick Pick menu.

In the menu, select your custom command add-comments.

Gemini Code Assist executes the add-comments command and
adds comments to your highlighted code.

In the Gemini Code Assist chat pane, you can type @
to retrieve and use a saved prompt in your Prompt Library.

Create rules

You can create rules for Gemini Code Assist to follow, and the
rules are included in every chat prompt you enter.

Rules in Gemini let you define your preferences, such as:

Coding style

Output formats

Tech stack

Language

For example, you can create a rule such as "Always give me concise responses in
Kotlin."

 VS Code 

In your code file, press Control+I (for Windows and Linux) or
Command+I (for macOS) to open the
Gemini Code Assist Quick Pick menu.

In the menu, search for and select Preferences: Open Settings (UI).

In the Search settings field, enter Geminicodeassist: Rules.

In the text field, enter a rule such as: Always generate unit tests when
creating a new function. You can also add one or more rules with multiple
lines in the text field.

After adding rules in the Rules settings,
Gemini Code Assist considers the rule for every prompt or
request you make.

To remove the rule, delete the content from the Rules text field.

 IntelliJ 
Note: Rules aren't used in agent mode.

To create a rule, go to
Settings > Tools > Gemini > Prompt Library > Rules and then edit the
text in the editor.

To set the scope of the rule, in the Scope drop-down, select IDE
or Project.

IDE-level rules are private to yourself and can be used across
multiple projects.

Project-level rules can be shared among teammates working on the same
project.

To share prompts across the team you must add the .idea folder to the
version control system.

Known issues

This section outlines the known issues of Gemini Code Assist:

 VS Code 

Chat responses may be truncated when they include an updated version of a
large open file

To work around this issue, select a smaller section of code and include an
additional directive in the chat prompt, such as only output the selected
code.

Vim: Cannot accept or dismiss code generation suggestions unless in
insert mode

When using the Vim plugin in normal mode, you can't accept or dismiss code
suggestions.

To work around this issue, press i to enter insert mode, and
then press Tab to accept the suggestion.

Vim: Inconsistent behavior when pressing Esc to dismiss
suggestions

When you press Esc, both the IDE and
Gemini Code Assist suggestions are dismissed. This behavior
is different from the non-Vim behavior where pressing Esc
re-triggers Gemini Code Assist.

Sign-in attempts keep timing out

If your sign-in attempts keep timing out, try adding the
cloudcode.beta.forceOobLogin setting to your settings.json file:

 "cloudcode.beta.forceOobLogin": true

License recitation warnings don't persist across sessions

If license recitation warnings don't persist across sessions, refer to the
persistent logs:

Click View > Output.

Select Gemini Code Assist - Citations.

Connectivity issues in the Gemini Code Assist output
window

If you see a connection error or other connectivity problems in the
Gemini Code Assist output window, try the following:

Configure your firewall to allow access to oauth2.googleapis.com and
cloudaicompanion.googleapis.com.

Configure your firewall to allow communication over HTTP/2, which gRPC
uses.

You can use the grpc-health-probe tool to test connectivity. A
successful check results in the following output:

$ grpc-health-probe -addr cloudaicompanion.googleapis.com:443 -tls
error: this server does not implement the grpc health protocol
(grpc.health.v1.Health): GRPC target method can't be resolved

An unsuccessful check results in the following output:

timeout: failed to connect service "cloudaicompanion.googleapis.com:443" within 1s

To obtain more details, run the following before grpc-health-probe:

export GRPC_GO_LOG_SEVERITY_LEVEL=info

 IntelliJ 

There are no known issues for Gemini Code Assist for IntelliJ
and other supported JetBrains IDEs.

Leave feedback

To leave feedback of your experience, see

Provide Gemini for Google Cloud feedback.

What's next

Learn how to write better prompts.

Learn about Gemini Code Assist Standard and Enterprise pricing.

Learn about security, privacy, and compliance of Gemini Code Assist.

Learn how Gemini for Google Cloud uses your data.

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License. For details, see the Google Developers Site Policies. Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2026-03-24 UTC.

 [[["Easy to understand","easyToUnderstand","thumb-up"],["Solved my problem","solvedMyProblem","thumb-up"],["Other","otherUp","thumb-up"]],[["Missing the information I need","missingTheInformationINeed","thumb-down"],["Too complicated / too many steps","tooComplicatedTooManySteps","thumb-down"],["Out of date","outOfDate","thumb-down"],["Samples / code issue","samplesCodeIssue","thumb-down"],["Other","otherDown","thumb-down"]],["Last updated 2026-03-24 UTC."],[],[]]

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
<summary>Textanlage: <code>Provider/Gemini/gemini-cli.txt</code></summary>

````text
Gemini CLI  |  Gemini Code Assist  |  Google for Developers

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

 Gemini CLI

 Stay organized with collections

 Save and categorize content based on your preferences.

Page Summary

 outlined_flag

The Gemini command line interface (CLI) is an open source AI agent that provides access to Gemini directly in your terminal.

The Gemini CLI uses a reason and act (ReAct) loop with your built-in tools and local or remote MCP servers to complete complex use cases like fixing bugs, creating new features, and improving test coverage.

Gemini Code Assist for individuals, Standard, and Enterprise each provide quotas for using the Gemini CLI, shared with Gemini Code Assist agent mode.

The Gemini CLI is available without additional setup in Cloud Shell or can be set up in other environments.

Gemini Code Assist agent mode in VS Code is powered by Gemini CLI and offers a subset of its functionality directly within the chat in your IDE.

The Gemini command line interface (CLI) is an open source
AI agent that provides access to Gemini directly in your terminal. The
Gemini CLI uses a reason and act (ReAct) loop with your built-in tools
and local or remote MCP servers to complete complex use cases like fixing bugs,
creating new features, and improving test coverage. While the Gemini
CLI excels at coding, it's also a versatile local utility that you can use for
a wide range of tasks, from content generation and problem solving to deep
research and task management.

Each Gemini Code Assist edition
provides quotas for using the
Gemini CLI. Note that these quotas are shared between Gemini
CLI and Gemini Code Assist agent mode. Gemini
CLI also supports using a Gemini API key to
pay as you go.

The Gemini CLI is available without additional setup in
Cloud Shell. To get
started with Gemini CLI in other environments, see the
Gemini CLI documentation.

Privacy

For users of Gemini Code Assist Standard and Enterprise, the
data protection and privacy practices described in
Security, privacy, and compliance for Gemini Code Assist Standard and Enterprise
also apply to Gemini CLI.

For users of Gemini Code Assist for individuals, the data protection
and privacy practices described in the
Gemini Code Assist Privacy Notice for individuals
also apply to Gemini CLI.

Gemini Code Assist agent mode (Preview)

Gemini Code Assist agent mode in VS Code is powered by
Gemini CLI. A subset of Gemini CLI functionality is
available directly in the Gemini Code Assist chat within VS Code.

The following Gemini CLI features are available in
Gemini Code Assist for VS Code.

Model Context Protocol (MCP) servers

Gemini CLI commands: /memory, /stats, /tools,
/mcp

Yolo mode

built-in tools like grep, terminal, file read or file write

Web search

Web fetch

What's next

Read more about Gemini CLI documentation.

Download and install Gemini CLI.

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License. For details, see the Google Developers Site Policies. Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2026-02-02 UTC.

 [[["Easy to understand","easyToUnderstand","thumb-up"],["Solved my problem","solvedMyProblem","thumb-up"],["Other","otherUp","thumb-up"]],[["Missing the information I need","missingTheInformationINeed","thumb-down"],["Too complicated / too many steps","tooComplicatedTooManySteps","thumb-down"],["Out of date","outOfDate","thumb-down"],["Samples / code issue","samplesCodeIssue","thumb-down"],["Other","otherDown","thumb-down"]],["Last updated 2026-02-02 UTC."],[],[]]

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
<summary>Textanlage: <code>Provider/Gemini/set-up-code-assist-github.txt</code></summary>

````text
Set up Gemini Code Assist on GitHub  |  Google for Developers

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

 Set up Gemini Code Assist on GitHub

 Stay organized with collections

 Save and categorize content based on your preferences.

Page Summary

 outlined_flag

Gemini Code Assist on GitHub is a Gemini-powered agent that summarizes pull requests and provides code reviews.

You need a GitHub account and one or more repositories to set up Gemini Code Assist on GitHub.

Setting up Gemini Code Assist on GitHub involves installing the app and selecting repositories, with different steps for consumer and enterprise versions.

For the enterprise version, specific IAM roles may be required for setup within Google Cloud.

This page shows you how to set up
Gemini Code Assist on GitHub,
a Gemini-powered agent that automatically summarizes pull
requests and provides in-depth code reviews.

Before you begin

To set up Gemini Code Assist on GitHub, make sure you
do the following:

Consumer

Have a GitHub organization or personal account.

Note: The consumer version of Gemini Code Assist on
GitHub doesn't support organizations that enable private
connectivity.

Have one or more GitHub repositories that you want to enable
Gemini Code Assist on GitHub on.

If you don't have such a repository, you can create a fork of
our sample repository
to use.

Enterprise

Have a GitHub organization or personal account.

Have one or more GitHub repositories that you want to enable
Gemini Code Assist on GitHub on.

If you don't have such a repository, you can create a fork of
our sample repository
to use.

Ask your administrator to grant
you the Service Usage Admin role
and the geminicodeassistmanagement.scmConnectionAdmin role.

Important: The geminicodeassistmanagement.scmConnectionAdmin role
can't be granted using the Google Cloud console. Use the Google Cloud CLI
instead.

Alternatively, if you have the Admin or Owner basic roles,
you have the necessary IAM permissions to complete the
setup for the enterprise version.

Ensure that the Google Cloud project you use during setup is
connected to a valid billing account.

Install Gemini Code Assist on GitHub

The following steps show you how to set up Gemini Code Assist
on GitHub. Click the relevant tab for the version you want to set up,
either the consumer version or enterprise version.

Consumer

Go to the Gemini Code Assist
app page.

Sign in to your GitHub account if you haven't already.

Click Install.

A prompt to install the Gemini Code Assist app for a user
or organization is displayed.

When prompted to install the Gemini Code Assist app for a
user or organization, select the organization you intend to use it on.

After you've installed the Gemini Code Assist app for
your GitHub organization, you're prompted to select the
repositories to enable the Code Review integration.

You're redirected to the Admin Console for the
Gemini Code Assist app.

Login with your GitHub account.

Select a GitHub organization or personal account from the
drop-down menu.

Review and accept the Google Terms of Service, Generative AI Prohibited
Use Policy and Privacy Policy, and then click Complete setup.

Gemini Code Assist is added to the pull requests within
your selected repositories.

After creation, Gemini Code Assist provides suggestions to
your code review every time the pull request author or other human reviewers
add comments with the /gemini tag on the pull request.

Gemini Code Assist is now active for all the pull
requests within your selected repositories.

Enterprise

Preview

This feature is subject to the "Pre-GA Offerings Terms" in the General
 Service Terms section of the
 Service Specific Terms for Google Cloud.
 Pre-GA features are available "as is" and might have limited support. For
 more information, see the
 Google Cloud launch stage descriptions.

In the Google Cloud console, go to the Gemini Code Assist
Agents & Tools page.

Go to Agents & Tools 

If you haven't previously enabled the Developer Connect API,
you see a caution banner that prompts you to enable the API. If this
happens, click the Enable button associated with the banner, and
click the Enable button in the dialog window that appears.

In the Agents section, locate the
Code Assist Source Code Management card, and click Enable.

The Enable Code Assist Source Code Management pane opens.

In the Gemini Code Assist Management API section, click Enable.

In the Select a connection section, click the Connection
drop-down.

In the drop-down, click Create new connection.

The Link Git repositories via Developer Connect pane opens.

Note: Gemini Code Assist on GitHub creates the
Developer Connect connection in us-east1 and doesn't support
using existing connections you might have for other features, such as
code customization.

In the Provider drop-down, select the GitHub provider you
are using.

In the Name field, enter a name for your connection.

Click Continue.

The Request GitHub OAuth token dialog window open.

After reading the disclaimer, click I understand and continue.

In the Install Gemini Code Assist page, click the account you want to
install the app in.

Choose whether to install the app for All repositories or
Only select repositories.

Click Install.

Follow the GitHub steps to authenticate to GitHub.

Once access is confirmed, the dialog window closes and you return to the
Link Git repositories via Developer Connect pane.

In the Link repositories section, click the Repositories
drop-down, select the repositories you want to link, and click Ok.

Note: If you create a new GitHub repository in the future and
want to add it to the linked repositories in your connection, you must
use Developer Connect
to do so.

Click Link.

In the Select a connection drop-down, select the connection you
created.

Click Done.

Gemini Code Assist is now active for all the pull
requests within your selected repositories.

What's next

Learn more about Gemini Code Assist in GitHub.

Use Gemini Code Assist in GitHub.

Learn how to
customize Gemini Code Assist on GitHub behavior.

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License. For details, see the Google Developers Site Policies. Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2026-03-23 UTC.

 [[["Easy to understand","easyToUnderstand","thumb-up"],["Solved my problem","solvedMyProblem","thumb-up"],["Other","otherUp","thumb-up"]],[["Missing the information I need","missingTheInformationINeed","thumb-down"],["Too complicated / too many steps","tooComplicatedTooManySteps","thumb-down"],["Out of date","outOfDate","thumb-down"],["Samples / code issue","samplesCodeIssue","thumb-down"],["Other","otherDown","thumb-down"]],["Last updated 2026-03-23 UTC."],[],[]]

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
<summary>Textanlage: <code>Provider/Gemini/use-agentic-chat-pair-programmer.txt</code></summary>

````text
Use the Gemini Code Assist agent mode  |  Google for Developers

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

 Use the Gemini Code Assist agent mode

 Stay organized with collections

 Save and categorize content based on your preferences.

Page Summary

 outlined_flag

Gemini Code Assist agent mode acts as a pair programmer in your IDE, allowing you to ask questions, improve generated content using context and tools, configure MCP servers, get solutions to complex tasks, generate code, and control agent behavior.

Agent mode has limitations compared to standard Gemini Code Assist chat, notably the absence of recitation and source citations.

Before using agent mode, you need to set up your chosen edition of Gemini Code Assist in your IDE, with separate instructions provided for VS Code and IntelliJ.

To use agent mode, you switch to the agent tab within the Gemini Code Assist chat in your IDE and provide a detailed prompt.

You can configure tools for agent mode, including built-in tools and MCP servers, with different configuration methods for VS Code and IntelliJ.

Preview

This product or feature is in preview. Products and features that are
in preview are available "as is".

This document describes how to configure and use Gemini Code Assist
agent mode as a pair programmer in your integrated development environment
(IDE).

With agent mode, you can do any of the following and more:

Ask questions about your code.

Use context and built-in tools to improve generated content.

Configure MCP servers to extend the agent's abilities.

Get solutions to complex tasks with multiple steps.

Generate code from design documents, issues, and TODO comments.

Control the agent behavior by commenting on, editing, and approving plans
and tool use during execution.

Limitations

Some features of standard Gemini Code Assist chat
might not be available in agent mode or might work differently than they do in
standard chat.

Recitation is not available in agent mode. While in agent mode, Gemini
doesn't cite sources and you can't
disable code suggestions that match cited sources.

Before you begin

Set up the edition of Gemini Code Assist you want to use in
your IDE:

Gemini Code Assist for individuals

Gemini Code Assist Standard or Enterprise

Use agent mode

In agent mode, you can ask Gemini to complete high-level goals and
complex tasks.

To get the most out of agent mode, follow
prompting best practices and provide as much detail as
possible.

Caution: There isn't an option to undo changes made to resources outside your
IDE in agent mode, so be careful where you use it.

To switch to agent mode:

 VS Code 

To open the Gemini Code Assist chat, in the activity bar of your
IDE, click spark
Gemini Code Assist.

Click the Agent toggle to enter agent mode. The toggle is highlighted
when toggled to agent mode and grey when in regular chat.

In the Gemini Code Assist chat, enter your prompt.

Gemini gives you a response to your prompt, or requests permission
to use a tool.

To stop the agent, click stopStop.

To use the standard Gemini Code Assist chat, click
addNew chat to create a new
chat.

 IntelliJ 

Click spark Gemini
in the tool window bar. Sign in if prompted to do so.

Select the Agent tab.

Describe the task you want the agent to perform.

As the agent goes through the steps to accomplish the task, you'll have the
option to review and approve any changes.

Optional: To automatically approve changes, select
settings Agent options and
click the checkbox next to Auto-approve changes.

Caution: The agent has access to your machine's file system and terminal
actions as well as any tools you've configured for use. Be extremely
careful where and when you auto-approve changes.

Configure tools for agent mode

Tools are a broad category of services that an agent can use for context and
actions in its response to your prompt. Some example tools are built-in tools
like grep and file read or write, local or remote Model Context Protocol (MCP)
servers and their executable functions, or bespoke service implementations.

Control built-in tool use

Agent mode has access to your built-in tools like file search, file read, file
write, terminal commands, and more.

VS Code

You can use the coreTools and excludeTools settings to control which tools
Gemini has access to in agent mode.

coreTools
Lets you specify a list of tools that you want to be available to
the model. You can also specify command-specific restrictions for tools that
support it. For example—adding the following to your
Gemini settings JSON will only allow the shell ls -l command to
be executed:"coreTools": ["ShellTool(ls -l)"].
excludeTools
Lets you specify a list of tools that you don't want to be available to the
model. You can also specify command-specific restrictions for tools that
support it. For example—adding the following to your Gemini
settings JSON will block the use of the rm -rf command:
"excludeTools": ["ShellTool(rm -rf)"].

A tool listed in both excludeTools and coreTools is excluded.

To configure the built-in tools available in agent mode, do the following:

Open your Gemini settings JSON located in
~/.gemini/settings.json where ~ is your home directory.

To restrict agent tool use to a list of approved tools, add the
following line to your Gemini settings JSON:

"coreTools": ["TOOL_NAME_1,TOOL_NAME_2"]

Replace TOOL_NAME_1 and
TOOL_NAME_2 with the names of the
built-in tools you want the
agent to have access to.

You can list as many built-in tools as you want.
By default all built-in tools are available to the agent.

To restrict agent tool use to specific tool commands, add the
following line to your Gemini settings JSON:

"coreTools": ["TOOL_NAME(COMMAND)"]

Replace the following:

TOOL_NAME: the name of the built-in tool

COMMAND: the name of the built-in tool command
you want the agent to be able to use.

To exclude a tool from agent use, add the following line to your
Gemini settings JSON:

"excludeTools": ["TOOL_NAME_1,TOOL_NAME_2"]

Replace TOOL_NAME_1 and
TOOL_NAME_2 with the names of the
built-in tools you want to exclude from agent use.

To exclude a tool command from agent use, add the following line to your
Gemini settings JSON:

"excludeTools": ["TOOL_NAME(COMMAND)"]

Replace the following:

TOOL_NAME: the name of the built-in tool

COMMAND: the name of the built-in tool command
you want to exclude from agent use.

For more information about the coreTools and excludeTools configuration
settings, see the
Gemini CLI configuration documentation.

 IntelliJ 

This feature isn't supported in Gemini Code Assist for IntelliJ or
other JetBrains IDEs.

Configure MCP servers

Caution: MCP servers can run arbitrary code with the permissions available to
your user account. Make sure you trust the source of any MCP servers you use.

The following instructions show how to make MCP servers available for use in
agent mode in your IDE. After you make an MCP server available,
Gemini Code Assist automatically decides when and how to use the
server tools contained within that MCP server.

VS Code

To make MCP servers available for use in agent mode, add the configuration for
each server in your Gemini settings JSON file, according each
server's documentation.

Note: You can't use the command palette to install MCP servers for agent mode.
You must add MCP servers to your Gemini settings JSON file.

Install any dependencies required by the MCP servers you are adding.

Open your Gemini settings JSON file, located at
~/.gemini/settings.json where ~ is your home directory.

Configure each local or remote MCP server in the Gemini settings
JSON file, according to each server's instructions.

The following example Gemini settings JSON file configures two
remote Cloudflare MCP servers, a remote GitLab MCP server, and a local
GitHub MCP server for use with Gemini Code Assist in VS Code.

{
 "mcpServers": {
 "github": {
 "command": "npx",
 "args": ["-y", "@modelcontextprotocol/server-github"],
 "env": {
 "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_example_personal_access_token12345"
 }
 },
 "gitlab": {
 "command": "npx",
 "args": ["mcp-remote", "https://your-gitlab-instance.com/api/v4/mcp"]
 },
 "cloudflare-observability": {
 "command": "npx",
 "args": ["mcp-remote", "https://observability.mcp.cloudflare.com/sse"]
 },
 "cloudflare-bindings": {
 "command": "npx",
 "args": ["mcp-remote", "https://bindings.mcp.cloudflare.com/sse"]
 }
 }
}

Open the command palette and select Developer: Reload Window.

Your configured MCP servers are available for the agent to use in agent mode.

 IntelliJ 

To make MCP servers available for use in agent mode, add the configuration for
each server in a mcp.json file and place the mcp.json file in the
configuration directory for your IDE.

Install any dependencies required by the MCP servers you are adding.

Create a file named mcp.json in your IDE's
configuration directory.

Configure each local or remote MCP server in the mcp.json file,
according to each server's instructions.

The following example mcp.json file configures two remote Cloudflare MCP
servers, a remote GitLab MCP server, and a local GitHub MCP server for use
with Gemini Code Assist in IntelliJ.

{
 "mcpServers": {
 "github": {
 "command": "npx",
 "args": ["-y", "@modelcontextprotocol/server-github"],
 "env": {
 "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_example_personal_access_token12345"
 }
 },
 "gitlab": {
 "command": "npx",
 "args": ["mcp-remote", "https://your-gitlab-instance.com/api/v4/mcp"]
 },
 "cloudflare-observability": {
 "command": "npx",
 "args": ["mcp-remote", "https://observability.mcp.cloudflare.com/sse"]
 },
 "cloudflare-bindings": {
 "command": "npx",
 "args": ["mcp-remote", "https://bindings.mcp.cloudflare.com/sse"]
 }
 }
}

Your configured MCP servers are available for the agent to use in agent mode.

MCP server authentication

Some MCP servers require authentication. Follow the server documentation to
create any required user tokens, and then specify them appropriately. Typically,
you specify authentication tokens for local servers using the appropriate
server-specific environment variable, and you specify authentication tokens for
remote servers using the HTTP Authorization header.

 VS Code 

For MCP servers that require authentication, you can add them to your
Gemini settings JSON.

The following example shows how to specify a personal access token for the
GitHub local and remote MCP servers:

{
 "mcpServers": {
 "github-remote": {
 "httpUrl": "https://api.githubcopilot.com/mcp/",
 "headers": {
 "Authorization": "Bearer ACCESS_TOKEN"
 }
 },
 "github-local": {
 "command": "/Users/username/code/github-mcp-server/cmd/github-mcp-server/github-mcp-server",
 "args": ["stdio"],
 "env": {
 "GITHUB_PERSONAL_ACCESS_TOKEN": "ACCESS_TOKEN"
 }
 }
 }
}

Where ACCESS_TOKEN is the user's access token.

 IntelliJ 

For MCP servers that require authentication, you can add them to your
mcp.json file.

The following example adds a personal access token for the GitHub local server:

{
 "mcpServers": {
 "github-local": {
 "command": "/Users/username/code/github-mcp-server/cmd/github-mcp-server/github-mcp-server",
 "args": ["stdio"],
 "env": {
 "GITHUB_PERSONAL_ACCESS_TOKEN": "ACCESS_TOKEN"
 }
 }
 }
}

Where ACCESS_TOKEN is the user's access token.

Create a context file

Context allows an agent to generate better responses for a given prompt. Context
can be taken from files in your IDE, files in your local system folders, tool
responses, and your prompt details. For more information, see
Agent mode context.

 VS Code

Create a file named GEMINI.md in a location that matches the scope you
want the context to apply to. The following table details the locations for
context files for different scopes:

Scope
Location

All your projects
~/.gemini/GEMINI.md

A specific project
Your working directory or any parent directories up to either your project root (identified by a .git folder) or your home directory.

A specific component, module, or sub-section of a project
Subdirectories of your working directory.

The agent's memory system is created by loading context files from
multiple locations. Context from more specific files, like those for
specific components or modules, overrides or supplements content from
more general context files like the global context file at
~/.gemini/GEMINI.md.

Write any rules, style guide information, or context that you want the
agent to use in Markdown and save the file. For more information, see
the example context file on GitHub.

The agent includes the information in your context file along with any prompts
you send to it.

 IntelliJ 

Create a file named either GEMINI.md or AGENT.md at the root of your
project.

Write any rules, style guide information, or context that you want the
agent to use in Markdown and save the file.

The agent includes the information in your context file along with any prompts
you send to it. You can also add context by including a file manually with the
@FILENAME syntax where
FILENAME is the name of the file with contextual
information you want to include.

Use commands

Slash / commands let you quickly run commands similar to commands in a
terminal window.

VS Code

You can use the following built-in Gemini CLI commands in agent
mode:

/tools: Displays a list of tools that are available in your agent mode
session.

/mcp: Lists configured Model Context Protocol (MCP) servers, their
connection status, server details, and available tools.

For more information on Gemini CLI commands, see
Gemini CLI Commands and
Gemini custom commands. Note that not
all Gemini CLI commands are available in agent mode.

IntelliJ

This feature isn't supported in Gemini Code Assist for IntelliJ or
other JetBrains IDEs.

Always allow agent actions

You can automatically allow all agent actions.

Warning: The agent has access to your machine's file system and terminal actions
as well as any tools you've configured for use. Be extremely careful where and
when you automatically allow agent actions.

To automatically allow all agent actions:

VS Code

Use yolo mode to automatically allow all agent actions. Yolo mode can only be
used in a trusted workspace.

To configure yolo mode:

Open your VS Code user settings JSON file:

Open the Command palette (ctrl/command + Shift + P).

Select Preferences: Open User Settings (JSON).

Add the following to your VS Code user settings JSON file:

//other settings...

"geminicodeassist.agentYoloMode": true,
//other settings...

Open the command palette and select Developer: Reload Window.

Agent mode uses yolo mode, and won't ask for permission before taking actions
when you send it a prompt. When using a
restricted workspace the agent will prompt before
taking actions regardless of this setting.

 IntelliJ 

To automatically approve changes, in the Gemini chat agent tab,
select settings Agent options and then
click the checkbox next to Auto-approve changes.

Agent mode automatically approves all requests, and won't ask for permission
before taking actions when you send it a prompt.

Additional prompts

Try out the following prompts with your own information:

"What does this repository do? Help me understand the architecture."

"What does this [class/function] do?"

"Add a feature to this codebase - "[link-or-path-to-codebase]"."

"Refactor function [A] and [B] to use the common method [C]."

"Fix the GitHub issue [link-to-github-issue]."

"Build an application to do [goal] with a UI that lets the user do [task] in
the [environment]."

"Migrate library versions in this repository from [X] to [Y]."

"Optimize performance of this Go code so that it runs faster."

"Use [name-of-API] to build out this feature."

"Implement an algorithm to do [x], [Y], and [Z]."

Optional: Use an API Key

Gemini Code Assist includes different daily
quotas
for agentic features, depending on the tier you're in.

If you've exhausted your daily quota for Gemini Code Assist
agent mode, you can continue to use the service by providing an API key. You can
use either a Gemini API key or a
Vertex AI API key.

To add your API key:

Navigate to your IDE's settings.

Open the settings.json file.

Add the following line, replacing YOUR_KEY with your
API key:

"geminicodeassist.geminiApiKey": "YOUR_KEY"

What's next

Read the Gemini Code Assist overview.

Explore some example MCP servers.

Find more MCP servers on GitHub.

Send feedback from your IDE.

Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License, and code samples are licensed under the Apache 2.0 License. For details, see the Google Developers Site Policies. Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2026-02-24 UTC.

 [[["Easy to understand","easyToUnderstand","thumb-up"],["Solved my problem","solvedMyProblem","thumb-up"],["Other","otherUp","thumb-up"]],[["Missing the information I need","missingTheInformationINeed","thumb-down"],["Too complicated / too many steps","tooComplicatedTooManySteps","thumb-down"],["Out of date","outOfDate","thumb-down"],["Samples / code issue","samplesCodeIssue","thumb-down"],["Other","otherDown","thumb-down"]],["Last updated 2026-02-24 UTC."],[],[]]

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
