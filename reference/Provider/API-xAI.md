# API-xAI.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## Provider

- Hermes Provider-ID: `xai`
- Anzeige: xAI
- Typ: Responses/Codex-Modus in Hermes
- Base URL: `https://api.x.ai/v1`
- Auth: XAI_API_KEY, override XAI_BASE_URL

## Grundschema

Soweit der Provider OpenAI-kompatibel ist:

```http
POST <base_url>/chat/completions
Authorization: Bearer <token>
Content-Type: application/json
```

Wenn die Base URL bereits auf `/v1` endet, wird direkt `/chat/completions` angehaengt. Im code-proxy-Generic-Provider wird dagegen intern immer `<baseURL>/v1/chat/completions` gebaut; dort muss `baseURL` entsprechend ohne `/v1` gesetzt sein.

## Modellformat

Hermes setzt fuer provider `xai` den API-Modus `codex_responses`.

## ForgeFrame-Adapterhinweise

- Felder: `provider_id`, `base_url`, `api_key_env_vars`, `auth_type`, `model_normalization`, `api_mode`.
- Fuer Aggregatoren (`openrouter`, `nous`, `ai-gateway`, `kilocode`) Vendor-Slugs erhalten oder automatisch ergaenzen.
- Fuer native Provider wie Anthropic, Copilot, DeepSeek oder OpenCode Sonderregeln aus `model_normalize.py` beachten.
- Streaming als SSE `data:` implementieren, Non-Streaming als OpenAI-Response normalisieren.

---

## Offizielle Dokumentationsanreicherung: `OpenAI/API/xAI`

> Ergänzt am 2026-04-24 03:20:42. Quelle ist das bereitgestellte `reference.zip`. Die zugehörigen `.txt`- und `.md`-Dateien wurden vollständig eingelesen. Für sehr große Textanlagen wird der Volltext in dieser ZIP-Fassung auf 40.000 Zeichen je Quelldatei begrenzt; die implementierungsrelevanten Extrakte oben bleiben vollständig aus allen Dateien erzeugt.

### Offizieller Quellenindex aus Referenz-ZIP

# Index – xAI

Abrufdatum: `2026-04-24T05:05:37.927618+02:00`

## Geladene Dokumente

### Inference API - REST API Reference | xAI Docs
- Quelle: Pflichtquelle
- Original-URL: https://docs.x.ai/developers/rest-api-reference
- Bereinigte Download-URL: https://docs.x.ai/developers/rest-api-reference
- Effektive End-URL: https://docs.x.ai/developers/rest-api-reference/inference
- Lokale Datei(en): HTML: `rest-api-reference.html`, Text: `rest-api-reference.txt`
- Abrufdatum: `2026-04-24T05:05:37.927618+02:00`
- Zweck: xAI REST API reference
- Download-Werkzeug: `urllib`
- HTTP-Status: `200`
- Inhaltstyp: `text/html; charset=utf-8`
- Hinweise: Seite wirkt teilweise clientseitig gerendert; Snapshot ist best effort.

### Erkannte URLs und Basisadressen

- `https://docs.x.ai/developers/rest-api-reference`
- `https://docs.x.ai/developers/rest-api-reference/inference`
- `https://api.x.ai.`

### Erkannte Endpunkte / Pfade

- Keine Endpunkte automatisch erkannt.

### Erkannte Umgebungsvariablen / Konstanten

- `REST`

### Implementierungsrelevante offizielle Extrakte


---

**Quelle `INDEX.md`**

- Quelle: Pflichtquelle
- Original-URL: https://docs.x.ai/developers/rest-api-reference
- Bereinigte Download-URL: https://docs.x.ai/developers/rest-api-reference

---

**Quelle `INDEX.md`**

- Original-URL: https://docs.x.ai/developers/rest-api-reference
- Bereinigte Download-URL: https://docs.x.ai/developers/rest-api-reference
- Effektive End-URL: https://docs.x.ai/developers/rest-api-reference/inference

---

**Quelle `INDEX.md`**

- Bereinigte Download-URL: https://docs.x.ai/developers/rest-api-reference
- Effektive End-URL: https://docs.x.ai/developers/rest-api-reference/inference
- Lokale Datei(en): HTML: `rest-api-reference.html`, Text: `rest-api-reference.txt`

---

**Quelle `rest-api-reference.txt`**

Models

---

**Quelle `rest-api-reference.txt`**

Accounts and Authorization

---

**Quelle `rest-api-reference.txt`**

Billing Management

---

**Quelle `rest-api-reference.txt`**

The xAI Inference REST API is a robust, high-performance RESTful interface designed for seamless integration into existing systems.
It offers advanced AI capabilities with full compatibility with the OpenAI REST API.

---

**Quelle `rest-api-reference.txt`**

The base for all routes is at https://api.x.ai. For all routes, you have to authenticate with the header Authorization: Bearer <your xAI API key>.

### Code-/Konfigurationsbeispiele aus offiziellen Dokumenten

- Keine Codebeispiele automatisch erkannt.

## Textanlagen aus der offiziellen Dokumentation


<details>
<summary>Textanlage: <code>OpenAI/API/xAI/rest-api-reference.txt</code></summary>

````text
Inference API - REST API Reference | xAI Docs

Docs

REST API

gRPC

Pricing

Search

⌘K

Toggle theme

Inference API

Overview

Chat

Images

Videos

Voice

Models

Batches

Other

Legacy & Deprecated

Collections API

Overview

Collection Management

Search in Collections

Files API

Overview

Upload

Manage

Download

Management API

Overview

Using Management API

Accounts and Authorization

Billing Management

Audit Logs

API Console

Loading...

DocsREST APIgRPCPricing

Inference API

Overview

Chat

Images

Videos

Voice

Models

Batches

Other

Legacy & Deprecated

Collections API

Overview

Collection Management

Search in Collections

Files API

Overview

Upload

Manage

Download

Management API

Overview

Using Management API

Accounts and Authorization

Billing Management

Audit Logs

API Console

Loading...

Inference API

Inference REST API Overview

Copy for LLMView as Markdown

The xAI Inference REST API is a robust, high-performance RESTful interface designed for seamless integration into existing systems.
It offers advanced AI capabilities with full compatibility with the OpenAI REST API.

The base for all routes is at https://api.x.ai. For all routes, you have to authenticate with the header Authorization: Bearer <your xAI API key>.

Chat

Images

Videos

Voice

Models

Files

Batches

Other

Legacy & Deprecated

Did you find this page helpful?

 Yes No

Last updated: March 6, 2026
````

</details>
