# API-GitHubCopilot.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## hermes-agent Provider

Provider-ID: `copilot`  
Auth type: `api_key`  
Base: `https://api.githubcopilot.com`  
Model endpoint: `https://api.githubcopilot.com/models`  
Base override: `COPILOT_API_BASE_URL`

## Tokenquellen

Hermes behandelt Copilot zur Laufzeit als API-Key/Bearer-Provider, wobei der Token aus GitHub OAuth/PAT/App-Token stammt:

1. `COPILOT_GITHUB_TOKEN`
2. `GH_TOKEN`
3. `GITHUB_TOKEN`
4. `gh auth token`

## Erlaubte Tokenarten laut Code

- `gho_` OAuth token: akzeptiert
- `github_pat_` fine-grained PAT mit Copilot Requests permission: akzeptiert
- `ghu_` GitHub App token: akzeptiert
- `ghp_` classic PAT: abgelehnt

## Copilot-spezifische Header

`hermes_cli/copilot_auth.py` baut diese Header:

```http
Editor-Version: vscode/1.104.1
User-Agent: HermesAgent/1.0
Copilot-Integration-Id: vscode-chat
Openai-Intent: conversation-edits
x-initiator: agent
```

Bei Vision:

```http
Copilot-Vision-Request: true
```

## Modelle in hermes-agent

Auszug:

- `gpt-5.4`
- `gpt-5.4-mini`
- `gpt-5-mini`
- `gpt-5.3-codex`
- `gpt-5.2-codex`
- `gpt-4.1`
- `gpt-4o`
- `gpt-4o-mini`
- `claude-opus-4.6`
- `claude-sonnet-4.6`
- `claude-sonnet-4.5`
- `claude-haiku-4.5`
- `gemini-2.5-pro`
- `grok-code-fast-1`

## Reasoning Effort Konstanten

- GPT-5: `minimal`, `low`, `medium`, `high`
- O-Serie: `low`, `medium`, `high`

## Copilot ACP

Provider-ID: `copilot-acp`  
Auth type: `external_process`  
Base: `acp://copilot`  
Base override: `COPILOT_ACP_BASE_URL`

Hermes modelliert ACP als externen Prozess, nicht als normalen HTTP-Provider.

---

## Offizielle Dokumentationsanreicherung: `Provider/GitHubCopilot`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – GitHubCopilot

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### REST API endpoints for Copilot - GitHub Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/rest/copilot
- Bereinigte Download-URL: https://docs.github.com/en/rest/copilot
- Lokale Datei(en): HTML: `rest-copilot.html`, Text: `rest-copilot.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: GitHub Copilot REST API
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### GitHub REST API documentation - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/rest
- Bereinigte Download-URL: https://docs.github.com/en/rest
- Lokale Datei(en): HTML: `rest.html`, Text: `rest.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/rest/copilot
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### About the REST API - GitHub Docs
- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api
- Bereinigte Download-URL: https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api
- Lokale Datei(en): HTML: `about-the-rest-api.html`, Text: `about-the-rest-api.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/rest/copilot
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: zusätzlich gefunden; Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://docs.github.com/en/rest/copilot`
- `https://docs.github.com/en/rest`
- `https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api`

### Erkannte Endpunkte / Pfade

- Keine Endpunkte automatisch erkannt.

### Erkannte Umgebungsvariablen / Konstanten

- `REST`
- `CORS`
- `JSONP`
- `OIDC`
- `SBOM`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

### REST API endpoints for Copilot - GitHub Docs
- Quelle: Pflichtquelle

---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.github.com/en/rest/copilot
- Bereinigte Download-URL: https://docs.github.com/en/rest/copilot

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/rest/copilot
- Bereinigte Download-URL: https://docs.github.com/en/rest/copilot
- Lokale Datei(en): HTML: `rest-copilot.html`, Text: `rest-copilot.txt`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/rest
- Bereinigte Download-URL: https://docs.github.com/en/rest

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/rest
- Bereinigte Download-URL: https://docs.github.com/en/rest
- Lokale Datei(en): HTML: `rest.html`, Text: `rest.txt`

---

**Quelle `INDEX.md`**

- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: Zusätzlich gefunden von https://docs.github.com/en/rest/copilot
- Download-Werkzeug: `urllib`

---

**Quelle `INDEX.md`**

- Quelle: zusätzlich gefunden
- Original-URL: https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api
- Bereinigte Download-URL: https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api
- Bereinigte Download-URL: https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api
- Lokale Datei(en): HTML: `about-the-rest-api.html`, Text: `about-the-rest-api.txt`

---

**Quelle `about-the-rest-api.txt`**

Rate limits

---

**Quelle `about-the-rest-api.txt`**

Authentication
Authenticating

---

**Quelle `about-the-rest-api.txt`**

Keeping API credentials secure

---

**Quelle `about-the-rest-api.txt`**

Endpoints for GitHub App installation tokens

---

**Quelle `about-the-rest-api.txt`**

Endpoints for GitHub App user tokens

---

**Quelle `about-the-rest-api.txt`**

Endpoints for fine-grained PATs

---

**Quelle `about-the-rest-api.txt`**

OAuth authorizations

---

**Quelle `about-the-rest-api.txt`**

Billing
Budgets

---

**Quelle `about-the-rest-api.txt`**

Billing usage

---

**Quelle `about-the-rest-api.txt`**

Copilot usage metrics

---

**Quelle `about-the-rest-api.txt`**

Credentials
Revocation

---

**Quelle `about-the-rest-api.txt`**

Source endpoints

---

**Quelle `about-the-rest-api.txt`**

Models
Catalog

---

**Quelle `about-the-rest-api.txt`**

Embeddings

---

**Quelle `about-the-rest-api.txt`**

Personal access tokens

---

**Quelle `about-the-rest-api.txt`**

Rate limit
Rate limit

---

**Quelle `about-the-rest-api.txt`**

Release assets

---

**Quelle `about-the-rest-api.txt`**

You can use GitHub's API to build scripts and applications that automate processes, integrate with GitHub, and extend GitHub. For example, you could use the API to triage issues, build an analytics dashboard, or manage releases.

---

**Quelle `about-the-rest-api.txt`**

Each REST API endpoint is documented individually, and the endpoints are categorized by the resource that they primarily affect. For example, you can find endpoints relating to issues in REST API endpoints for issues.

---

**Quelle `about-the-rest-api.txt`**

If you are familiar with REST APIs but new to GitHub's REST API, you may find it helpful to refer to the authentication documentation. For more information, see:

---

**Quelle `about-the-rest-api.txt`**

Keeping your API credentials secure

---

**Quelle `rest-copilot.txt`**

REST API endpoints for Copilot - GitHub Docs

---

**Quelle `rest-copilot.txt`**

Rate limits

---

**Quelle `rest-copilot.txt`**

Authentication
Authenticating

---

**Quelle `rest-copilot.txt`**

Keeping API credentials secure

---

**Quelle `rest-copilot.txt`**

Endpoints for GitHub App installation tokens

---

**Quelle `rest-copilot.txt`**

Endpoints for GitHub App user tokens

---

**Quelle `rest-copilot.txt`**

Endpoints for fine-grained PATs

---

**Quelle `rest-copilot.txt`**

OAuth authorizations

---

**Quelle `rest-copilot.txt`**

Billing
Budgets

---

**Quelle `rest-copilot.txt`**

Billing usage

---

**Quelle `rest-copilot.txt`**

Copilot usage metrics

---

**Quelle `rest-copilot.txt`**

Credentials
Revocation

---

**Quelle `rest-copilot.txt`**

Source endpoints

---

**Quelle `rest-copilot.txt`**

Models
Catalog

---

**Quelle `rest-copilot.txt`**

Embeddings

---

**Quelle `rest-copilot.txt`**

Personal access tokens

---

**Quelle `rest-copilot.txt`**

Rate limit
Rate limit

---

**Quelle `rest-copilot.txt`**

Release assets

---

**Quelle `rest-copilot.txt`**

REST API endpoints for Copilot

---

**Quelle `rest-copilot.txt`**

REST API endpoints for Copilot cloud agent management
Set the coding agent policy for an enterprise

---

**Quelle `rest-copilot.txt`**

REST API endpoints for Copilot content exclusion management
Get Copilot content exclusion rules for an organization

---

**Quelle `rest-copilot.txt`**

REST API endpoints for Copilot metrics
Get Copilot metrics for an organization

---

**Quelle `rest-copilot.txt`**

REST API endpoints for Copilot usage metrics
Get Copilot enterprise usage metrics for a specific day

---

**Quelle `rest-copilot.txt`**

Get Copilot enterprise usage metrics

---

**Quelle `rest-copilot.txt`**

Get Copilot users usage metrics for a specific day

---

**Quelle `rest-copilot.txt`**

Get Copilot users usage metrics

---

**Quelle `rest-copilot.txt`**

Get Copilot organization usage metrics for a specific day

---

**Quelle `rest-copilot.txt`**

Get Copilot organization usage metrics

---

**Quelle `rest-copilot.txt`**

Get Copilot organization users usage metrics for a specific day

---

**Quelle `rest-copilot.txt`**

Get Copilot organization users usage metrics

---

**Quelle `rest-copilot.txt`**

REST API endpoints for Copilot user management
Get Copilot seat information and settings for an organization

---

**Quelle `rest.txt`**

Rate limits

---

**Quelle `rest.txt`**

Authentication
Authenticating

---

**Quelle `rest.txt`**

Keeping API credentials secure

---

**Quelle `rest.txt`**

Endpoints for GitHub App installation tokens

---

**Quelle `rest.txt`**

Endpoints for GitHub App user tokens

---

**Quelle `rest.txt`**

Endpoints for fine-grained PATs

---

**Quelle `rest.txt`**

OAuth authorizations

---

**Quelle `rest.txt`**

Billing
Budgets

---

**Quelle `rest.txt`**

Billing usage

---

**Quelle `rest.txt`**

Copilot usage metrics

---

**Quelle `rest.txt`**

Credentials
Revocation

---

**Quelle `rest.txt`**

Source endpoints

---

**Quelle `rest.txt`**

Models
Catalog

---

**Quelle `rest.txt`**

Embeddings

---

**Quelle `rest.txt`**

Personal access tokens

---

**Quelle `rest.txt`**

Rate limit
Rate limit

---

**Quelle `rest.txt`**

Release assets

---

**Quelle `rest.txt`**

You can authenticate to the REST API to access more endpoints and have a higher rate limit.

---

**Quelle `rest.txt`**

Authenticate API requests

---

**Quelle `rest.txt`**

Administer enterprises and billing

---

**Quelle `rest.txt`**

Use the REST API to get billing usage information.

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten

- Keine Codebeispiele automatisch erkannt.

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>Provider/GitHubCopilot/about-the-rest-api.txt</code></summary>

````text
About the REST API - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

REST API/

About the REST API/

About the REST API

Home

REST API

API Version: 2026-03-10 (latest)

Quickstart

About the REST API
About the REST API

Comparing GitHub's APIs

API Versions

Breaking changes

OpenAPI description

Using the REST API
Getting started

Rate limits

Pagination

Libraries

Best practices

Troubleshooting

Timezones

CORS and JSONP

Issue event types

GitHub event types

Authentication
Authenticating

Keeping API credentials secure

Endpoints for GitHub App installation tokens

Endpoints for GitHub App user tokens

Endpoints for fine-grained PATs

Permissions for GitHub Apps

Permissions for fine-grained PATs

Guides
Script with JavaScript

Script with Ruby

Discover resources for a user

Delivering deployments

Rendering data as graphs

Working with comments

Building a CI server

Get started - Git database

Get started - Checks

Encrypt secrets

Actions
Artifacts

Cache

GitHub-hosted runners

OIDC

Permissions

Secrets

Self-hosted runner groups

Self-hosted runners

Variables

Workflow jobs

Workflow runs

Workflows

Activity
Events

Feeds

Notifications

Starring

Watching

Apps
GitHub Apps

Installations

Marketplace

OAuth authorizations

Webhooks

Billing
Budgets

Billing usage

Branches
Branches

Protected branches

Campaigns
Security campaigns

Checks
Check runs

Check suites

Classroom
Classroom

Code scanning
Code scanning

Code security settings
Configurations

Codes of conduct
Codes of conduct

Codespaces
Codespaces

Organizations

Organization secrets

Machines

Repository secrets

User secrets

Collaborators
Collaborators

Invitations

Commits
Commits

Commit comments

Commit statuses

Copilot
Copilot cloud agent management

Copilot content exclusion management

Copilot metrics

Copilot usage metrics

Copilot user management

Credentials
Revocation

Dependabot
Alerts

Repository access

Secrets

Dependency graph
Dependency review

Dependency submission

Software bill of materials (SBOM)

Deploy keys
Deploy keys

Deployments
Deployment branch policies

Deployments

Environments

Protection rules

Deployment statuses

Emojis
Emojis

Enterprise teams
Enterprise team members

Enterprise team organizations

Enterprise teams

Gists
Gists

Comments

Git database
Blobs

Commits

References

Tags

Trees

Gitignore
Gitignore

Interactions
Organization

Repository

User

Issues
Assignees

Comments

Events

Issue dependencies

Issue field values

Issues

Labels

Milestones

Sub-issues

Timeline

Licenses
Licenses

Markdown
Markdown

Meta
Meta

Metrics
Community

Statistics

Traffic

Migrations
Organizations

Source endpoints

Users

Models
Catalog

Embeddings

Inference

Organizations
API Insights

Artifact metadata

Artifact attestations

Blocking users

Custom properties

Issue fields

Issue types

Members

Network configurations

Organization roles

Organizations

Outside collaborators

Personal access tokens

Rule suites

Rules

Security managers

Webhooks

Packages
Packages

Pages
Pages

Private registries
Organization configurations

Projects
Draft Project items

Project fields

Project items

Projects

Project views

Pull requests
Pull requests

Review comments

Review requests

Reviews

Rate limit
Rate limit

Reactions
Reactions

Releases
Releases

Release assets

Repositories
Attestations

Autolinks

Contents

Custom properties

Forks

Repositories

Rule suites

Rules

Webhooks

Search
Search

Secret scanning
Push protection

Secret scanning

Security advisories
Global security advisories

Repository security advisories

Teams
Members

Teams

Users
Attestations

Blocking users

Emails

Followers

GPG keys

Git SSH keys

Social accounts

SSH signing keys

Users

REST API/

About the REST API/

About the REST API

About the REST API

Get oriented to the REST API documentation.

Copy as Markdown

In this article

Getting started with the REST API

Further reading

You can use GitHub's API to build scripts and applications that automate processes, integrate with GitHub, and extend GitHub. For example, you could use the API to triage issues, build an analytics dashboard, or manage releases.

Each REST API endpoint is documented individually, and the endpoints are categorized by the resource that they primarily affect. For example, you can find endpoints relating to issues in REST API endpoints for issues.

Getting started with the REST API

If you are new to REST APIs, you may find it helpful to refer to the Quickstart or Getting Started guide for an introduction. For more information, see:

Quickstart for GitHub REST API

Getting started with the REST API

If you are familiar with REST APIs but new to GitHub's REST API, you may find it helpful to refer to the authentication documentation. For more information, see:

Authenticating to the REST API

If you are building scripts or applications that use the REST API, you may find some of the following guides helpful. For examples of scripting with the REST API, see:

Scripting with the REST API and JavaScript

Scripting with the REST API and Ruby

Building a GitHub App that responds to webhook events

Building a CLI with a GitHub App

Automatically redelivering failed deliveries for a repository webhook

For a list of libraries to facilitate scripting with the REST API, see Libraries for the REST API.

If you are building scripts or applications that use the REST API, you might also be interested in using webhooks to get notified about events or a GitHub App to access resources on behalf of a user or in an organization. For more information, see About webhooks and Deciding when to build a GitHub App.

Further reading

Comparing GitHub's REST API and GraphQL API

Best practices for using the REST API

Keeping your API credentials secure

Troubleshooting the REST API

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Provider/GitHubCopilot/rest-copilot.txt</code></summary>

````text
REST API endpoints for Copilot - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

REST API/

Copilot

Home

REST API

API Version: 2026-03-10 (latest)

Quickstart

About the REST API
About the REST API

Comparing GitHub's APIs

API Versions

Breaking changes

OpenAPI description

Using the REST API
Getting started

Rate limits

Pagination

Libraries

Best practices

Troubleshooting

Timezones

CORS and JSONP

Issue event types

GitHub event types

Authentication
Authenticating

Keeping API credentials secure

Endpoints for GitHub App installation tokens

Endpoints for GitHub App user tokens

Endpoints for fine-grained PATs

Permissions for GitHub Apps

Permissions for fine-grained PATs

Guides
Script with JavaScript

Script with Ruby

Discover resources for a user

Delivering deployments

Rendering data as graphs

Working with comments

Building a CI server

Get started - Git database

Get started - Checks

Encrypt secrets

Actions
Artifacts

Cache

GitHub-hosted runners

OIDC

Permissions

Secrets

Self-hosted runner groups

Self-hosted runners

Variables

Workflow jobs

Workflow runs

Workflows

Activity
Events

Feeds

Notifications

Starring

Watching

Apps
GitHub Apps

Installations

Marketplace

OAuth authorizations

Webhooks

Billing
Budgets

Billing usage

Branches
Branches

Protected branches

Campaigns
Security campaigns

Checks
Check runs

Check suites

Classroom
Classroom

Code scanning
Code scanning

Code security settings
Configurations

Codes of conduct
Codes of conduct

Codespaces
Codespaces

Organizations

Organization secrets

Machines

Repository secrets

User secrets

Collaborators
Collaborators

Invitations

Commits
Commits

Commit comments

Commit statuses

Copilot
Copilot cloud agent management

Copilot content exclusion management

Copilot metrics

Copilot usage metrics

Copilot user management

Credentials
Revocation

Dependabot
Alerts

Repository access

Secrets

Dependency graph
Dependency review

Dependency submission

Software bill of materials (SBOM)

Deploy keys
Deploy keys

Deployments
Deployment branch policies

Deployments

Environments

Protection rules

Deployment statuses

Emojis
Emojis

Enterprise teams
Enterprise team members

Enterprise team organizations

Enterprise teams

Gists
Gists

Comments

Git database
Blobs

Commits

References

Tags

Trees

Gitignore
Gitignore

Interactions
Organization

Repository

User

Issues
Assignees

Comments

Events

Issue dependencies

Issue field values

Issues

Labels

Milestones

Sub-issues

Timeline

Licenses
Licenses

Markdown
Markdown

Meta
Meta

Metrics
Community

Statistics

Traffic

Migrations
Organizations

Source endpoints

Users

Models
Catalog

Embeddings

Inference

Organizations
API Insights

Artifact metadata

Artifact attestations

Blocking users

Custom properties

Issue fields

Issue types

Members

Network configurations

Organization roles

Organizations

Outside collaborators

Personal access tokens

Rule suites

Rules

Security managers

Webhooks

Packages
Packages

Pages
Pages

Private registries
Organization configurations

Projects
Draft Project items

Project fields

Project items

Projects

Project views

Pull requests
Pull requests

Review comments

Review requests

Reviews

Rate limit
Rate limit

Reactions
Reactions

Releases
Releases

Release assets

Repositories
Attestations

Autolinks

Contents

Custom properties

Forks

Repositories

Rule suites

Rules

Webhooks

Search
Search

Secret scanning
Push protection

Secret scanning

Security advisories
Global security advisories

Repository security advisories

Teams
Members

Teams

Users
Attestations

Blocking users

Emails

Followers

GPG keys

Git SSH keys

Social accounts

SSH signing keys

Users

The REST API is now versioned. For more information, see "About API versioning."

REST API/

Copilot

REST API endpoints for Copilot

Use the REST API to monitor and manage GitHub Copilot.

REST API endpoints for Copilot cloud agent management
Set the coding agent policy for an enterprise

Add organizations to the enterprise coding agent policy

Remove organizations from the enterprise coding agent policy

Get Copilot coding agent permissions for an organization

Set Copilot coding agent permissions for an organization

List repositories enabled for Copilot coding agent in an organization

Set selected repositories for Copilot coding agent in an organization

Enable a repository for Copilot coding agent in an organization

Disable a repository for Copilot coding agent in an organization

REST API endpoints for Copilot content exclusion management
Get Copilot content exclusion rules for an organization

Set Copilot content exclusion rules for an organization

REST API endpoints for Copilot metrics
Get Copilot metrics for an organization

Get Copilot metrics for a team

REST API endpoints for Copilot usage metrics
Get Copilot enterprise usage metrics for a specific day

Get Copilot enterprise usage metrics

Get Copilot users usage metrics for a specific day

Get Copilot users usage metrics

Get Copilot organization usage metrics for a specific day

Get Copilot organization usage metrics

Get Copilot organization users usage metrics for a specific day

Get Copilot organization users usage metrics

REST API endpoints for Copilot user management
Get Copilot seat information and settings for an organization

List all Copilot seat assignments for an organization

Add teams to the Copilot subscription for an organization

Remove teams from the Copilot subscription for an organization

Add users to the Copilot subscription for an organization

Remove users from the Copilot subscription for an organization

Get Copilot seat assignment details for a user

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>


<details>
<summary>Textanlage: <code>Provider/GitHubCopilot/rest.txt</code></summary>

````text
GitHub REST API documentation - GitHub Docs

Skip to main content

GitHub Docs

Version: Free, Pro, & Team

Search or ask Copilot
Search or askCopilot

Select language: current language is English

Search or ask Copilot
Search or askCopilot

Open menu

Open Sidebar

REST API

Home

REST API

API Version: 2026-03-10 (latest)

Quickstart

About the REST API
About the REST API

Comparing GitHub's APIs

API Versions

Breaking changes

OpenAPI description

Using the REST API
Getting started

Rate limits

Pagination

Libraries

Best practices

Troubleshooting

Timezones

CORS and JSONP

Issue event types

GitHub event types

Authentication
Authenticating

Keeping API credentials secure

Endpoints for GitHub App installation tokens

Endpoints for GitHub App user tokens

Endpoints for fine-grained PATs

Permissions for GitHub Apps

Permissions for fine-grained PATs

Guides
Script with JavaScript

Script with Ruby

Discover resources for a user

Delivering deployments

Rendering data as graphs

Working with comments

Building a CI server

Get started - Git database

Get started - Checks

Encrypt secrets

Actions
Artifacts

Cache

GitHub-hosted runners

OIDC

Permissions

Secrets

Self-hosted runner groups

Self-hosted runners

Variables

Workflow jobs

Workflow runs

Workflows

Activity
Events

Feeds

Notifications

Starring

Watching

Apps
GitHub Apps

Installations

Marketplace

OAuth authorizations

Webhooks

Billing
Budgets

Billing usage

Branches
Branches

Protected branches

Campaigns
Security campaigns

Checks
Check runs

Check suites

Classroom
Classroom

Code scanning
Code scanning

Code security settings
Configurations

Codes of conduct
Codes of conduct

Codespaces
Codespaces

Organizations

Organization secrets

Machines

Repository secrets

User secrets

Collaborators
Collaborators

Invitations

Commits
Commits

Commit comments

Commit statuses

Copilot
Copilot cloud agent management

Copilot content exclusion management

Copilot metrics

Copilot usage metrics

Copilot user management

Credentials
Revocation

Dependabot
Alerts

Repository access

Secrets

Dependency graph
Dependency review

Dependency submission

Software bill of materials (SBOM)

Deploy keys
Deploy keys

Deployments
Deployment branch policies

Deployments

Environments

Protection rules

Deployment statuses

Emojis
Emojis

Enterprise teams
Enterprise team members

Enterprise team organizations

Enterprise teams

Gists
Gists

Comments

Git database
Blobs

Commits

References

Tags

Trees

Gitignore
Gitignore

Interactions
Organization

Repository

User

Issues
Assignees

Comments

Events

Issue dependencies

Issue field values

Issues

Labels

Milestones

Sub-issues

Timeline

Licenses
Licenses

Markdown
Markdown

Meta
Meta

Metrics
Community

Statistics

Traffic

Migrations
Organizations

Source endpoints

Users

Models
Catalog

Embeddings

Inference

Organizations
API Insights

Artifact metadata

Artifact attestations

Blocking users

Custom properties

Issue fields

Issue types

Members

Network configurations

Organization roles

Organizations

Outside collaborators

Personal access tokens

Rule suites

Rules

Security managers

Webhooks

Packages
Packages

Pages
Pages

Private registries
Organization configurations

Projects
Draft Project items

Project fields

Project items

Projects

Project views

Pull requests
Pull requests

Review comments

Review requests

Reviews

Rate limit
Rate limit

Reactions
Reactions

Releases
Releases

Release assets

Repositories
Attestations

Autolinks

Contents

Custom properties

Forks

Repositories

Rule suites

Rules

Webhooks

Search
Search

Secret scanning
Push protection

Secret scanning

Security advisories
Global security advisories

Repository security advisories

Teams
Members

Teams

Users
Attestations

Blocking users

Emails

Followers

GPG keys

Git SSH keys

Social accounts

SSH signing keys

Users

The REST API is now versioned. For more information, see "About API versioning."

GitHub REST API documentation

Create integrations, retrieve data, and automate your workflows with the GitHub REST API.

Overview Quickstart 

Recommended

Quickstart for GitHub REST API

Learn how to get started with the GitHub REST API.

Getting started with the REST API

Learn how to use the GitHub REST API.

Authenticating to the REST API

You can authenticate to the REST API to access more endpoints and have a higher rate limit.

Articles

All categories

Learn about the REST API

About the OpenAPI description for the REST API

The GitHub REST API is fully described in an OpenAPI compliant document.

Learn about the REST API

About the REST API

Get oriented to the REST API documentation.

Learn about the REST API

API Versions

Learn how to specify which REST API version to use whenever you make a request to the REST API.

Authenticate API requests

Authenticating to the REST API

You can authenticate to the REST API to access more endpoints and have a higher rate limit.

Learn about the REST API

Best practices for using the REST API

Follow these best practices when using GitHub's API.

Administer enterprises and billing

Billing usage

Use the REST API to get billing usage information.

Learn about the REST API

Breaking changes

Learn about breaking changes that were introduced in each REST API version.

Administer enterprises and billing

Budgets

Use the REST API to get budget information.

Build apps and integrations

Building a CI server

Build your own CI system using the Status API.

Showing 1-9 of 190

Previous1234567…22Next

Help and support

Did you find what you needed?

 Yes No
Privacy policy

Help us make these docs great!

All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.
Make a contribution
Learn how to contribute

Still need help?

Ask the GitHub community

Contact support

Legal

© 2026 GitHub, Inc.

Terms

Privacy

Status

Pricing

Expert services

Blog
````

</details>
