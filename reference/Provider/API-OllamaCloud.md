# API-OllamaCloud.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## Provider

- Hermes Provider-ID: `ollama-cloud`
- Anzeige: Ollama Cloud
- Typ: OpenAI-kompatibel
- Base URL: `https://ollama.com/v1`
- Auth: OLLAMA_API_KEY

## Grundschema

Soweit der Provider OpenAI-kompatibel ist:

```http
POST <base_url>/chat/completions
Authorization: Bearer <token>
Content-Type: application/json
```

Wenn die Base URL bereits auf `/v1` endet, wird direkt `/chat/completions` angehaengt. Im code-proxy-Generic-Provider wird dagegen intern immer `<baseURL>/v1/chat/completions` gebaut; dort muss `baseURL` entsprechend ohne `/v1` gesetzt sein.

## Modellformat

Nicht mit lokalem Ollama verwechseln; `ollama` Alias = custom/local.

## ForgeFrame-Adapterhinweise

- Felder: `provider_id`, `base_url`, `api_key_env_vars`, `auth_type`, `model_normalization`, `api_mode`.
- Fuer Aggregatoren (`openrouter`, `nous`, `ai-gateway`, `kilocode`) Vendor-Slugs erhalten oder automatisch ergaenzen.
- Fuer native Provider wie Anthropic, Copilot, DeepSeek oder OpenCode Sonderregeln aus `model_normalize.py` beachten.
- Streaming als SSE `data:` implementieren, Non-Streaming als OpenAI-Response normalisieren.

---

## Gemeinsame OpenAI-kompatible Referenz: `OpenAI/API/Ollama`

Diese Anbieterdatei basiert auf einem OpenAI-kompatiblen Pass-through oder einer OpenAI-ähnlichen Provider-API. Die folgenden Punkte dienen als generischer Implementierungsrahmen; der jeweilige `base_url` und Auth-Header aus der Reverse-Engineering-Sektion bleiben maßgeblich.

### Relevante generische Endpunkte
- `/v1/chat/completions`
- `http://localhost:11434/v1/'`
- `/v1/responses`
- `/thinking`
- `/v1/completions`
- `/v1/models`
- `/v1/models/{model}`
- `/v1/embeddings`
- `/v1/images/generations`
- `/responses`
- `http://localhost:11434/v1/chat/completions`

### Relevante generische URLs
- `https://docs.ollama.com/api/openai-compatibility`
- `http://localhost:11434/v1/`
- `http://localhost:11434/v1/chat/completions`

### Adapter-Hinweis
- Für Provider mit OpenAI-kompatibler API genügt in der Regel ein gemeinsamer Client mit Provider-spezifischem `base_url`, `Authorization: Bearer <key>` und ggf. Modellnormalisierung.
- Für Anbieter mit Anthropic-kompatibler API, Responses-API oder Sonderheadern muss ein separater Adapterzweig existieren.
