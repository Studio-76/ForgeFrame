# SPEC 18 – Generic OpenAI Provider Expansion

## Ziel
OpenAI-kompatible Anbieter werden über ein generisches Provider-Framework integriert.

## Betroffene Provider
DeepSeek, Groq, Mistral, Together AI, Fireworks AI, Cerebras, OpenRouter, Vercel AI Gateway, Nous Portal, Kilo Code, Hugging Face Router, NVIDIA NIM, Arcee AI, Alibaba DashScope, Kimi/Moonshot, Ollama Cloud, xAI, Z.AI, Xiaomi MiMo, OpenCode Zen, OpenCode Go.

## Konfiguration je Provider
provider_id, display_name, default_base_url, base_url_join_policy, auth_header_policy, env_vars, model_prefix_policy, model_slug_policy, streaming_mode, responses_support, tools_support, embeddings_support, special_headers, unsupported_features.

## Akzeptanz
Neue Provider können per Registry-Konfiguration aufgenommen werden. Doppelte `/v1` werden verhindert. Streaming wird SSE-normalisiert. Abweichungen werden als Evidence sichtbar.
