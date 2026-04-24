# API-NousPortal.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## hermes-agent

Provider-ID: `nous`  
Inference Base: `https://inference-api.nousresearch.com/v1`  
Typ: Aggregator/OpenAI-kompatibel mit OAuth-/Agent-Key-Auth.

## Modelle

Hermes fuehrt fuer Nous u.a. Modelle mit Vendor-Slug:

- `moonshotai/kimi-k2.5`
- `anthropic/claude-opus-4.7`
- `anthropic/claude-opus-4.6`
- `anthropic/claude-sonnet-4.6`
- `openai/gpt-5.4`
- `openai/gpt-5.4-mini`
- `google/gemini-3-pro-preview`
- `qwen/qwen3.5-plus-02-15`
- `z-ai/glm-5.1`
- `x-ai/grok-4.20-beta`
- `nvidia/nemotron-3-super-120b-a12b`

## Modellformat

`model_normalize.py` behandelt `nous` als Aggregator. Das bedeutet:

```text
claude-sonnet-4.6 -> anthropic/claude-sonnet-4.6
gpt-5.4           -> openai/gpt-5.4
gemini-3-pro      -> google/gemini-3-pro
```

## Endpoint

Naheliegendes OpenAI-kompatibles Schema:

```http
POST https://inference-api.nousresearch.com/v1/chat/completions
Authorization: Bearer <agent_key_or_api_key>
Content-Type: application/json
```
