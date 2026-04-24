# API-VercelAIGateway.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## Provider

- Hermes Provider-ID: `ai-gateway`
- Anzeige: Vercel AI Gateway
- Typ: Aggregator/OpenAI-kompatibel
- Base URL: `https://ai-gateway.vercel.sh/v1`
- Auth: AI_GATEWAY_API_KEY

## Grundschema

Soweit der Provider OpenAI-kompatibel ist:

```http
POST <base_url>/chat/completions
Authorization: Bearer <token>
Content-Type: application/json
```

Wenn die Base URL bereits auf `/v1` endet, wird direkt `/chat/completions` angehaengt. Im code-proxy-Generic-Provider wird dagegen intern immer `<baseURL>/v1/chat/completions` gebaut; dort muss `baseURL` entsprechend ohne `/v1` gesetzt sein.

## Modellformat

Aggregator: Modellnamen als vendor/model Slugs.

## ForgeFrame-Adapterhinweise

- Felder: `provider_id`, `base_url`, `api_key_env_vars`, `auth_type`, `model_normalization`, `api_mode`.
- Fuer Aggregatoren (`openrouter`, `nous`, `ai-gateway`, `kilocode`) Vendor-Slugs erhalten oder automatisch ergaenzen.
- Fuer native Provider wie Anthropic, Copilot, DeepSeek oder OpenCode Sonderregeln aus `model_normalize.py` beachten.
- Streaming als SSE `data:` implementieren, Non-Streaming als OpenAI-Response normalisieren.

---

## Gemeinsame OpenAI-kompatible Referenz: `OpenAI/API/OpenAI`

Diese Anbieterdatei basiert auf einem OpenAI-kompatiblen Pass-through oder einer OpenAI-ähnlichen Provider-API. Die folgenden Punkte dienen als generischer Implementierungsrahmen; der jeweilige `base_url` und Auth-Header aus der Reverse-Engineering-Sektion bleiben maßgeblich.

### Relevante generische Endpunkte
- `https://developers.openai.com/api/docs/guides/migrate-to-responses`
- `https://developers.openai.com/api/docs/models`
- `/v1/chat/completions`
- `/v1/responses`
- `https://api.openai.com/v1/chat/completions`
- `https://api.openai.com/v1/responses`
- `/openai/openai-go/v3/responses`
- `https://api.openai.com/v1/responses"`
- `https://api.openai.com/v1/files`
- `POST https://api.openai.com/v1/responses`

### Relevante generische URLs
- `https://developers.openai.com/api/reference/chat-completions/overview`
- `https://developers.openai.com/api/docs/guides/completions`
- `https://developers.openai.com/api/docs/guides/migrate-to-responses`
- `https://developers.openai.com/showcase`
- `https://developers.openai.com/blog`
- `https://developers.openai.com/cookbook`
- `https://developers.openai.com/community`
- `https://developers.openai.com/api/docs/quickstart`
- `https://developers.openai.com/api/docs/models`
- `https://api.openai.com/v1/chat/completions`
- `https://api.openai.com/v1/responses`
- `https://api.example.com/search?q=${query`
- `https://api.example.com/search?q={query`
- `https://api.example.com/search`
- `https://openai-documentation.vercel.app/images/cat_and_otter.png`
- `https://api.nga.gov/iiif/a2e6da57-3cd1-4235-b20e-95dcaefed6c8/full/!800,800/0/default.jpg`
- `https://www.berkshirehathaway.com/letters/2024ltr.pdf`
- `https://api.openai.com/v1/files`
- `https://dmcp-server.deno.dev/sse`

### Adapter-Hinweis
- Für Provider mit OpenAI-kompatibler API genügt in der Regel ein gemeinsamer Client mit Provider-spezifischem `base_url`, `Authorization: Bearer <key>` und ggf. Modellnormalisierung.
- Für Anbieter mit Anthropic-kompatibler API, Responses-API oder Sonderheadern muss ein separater Adapterzweig existieren.
