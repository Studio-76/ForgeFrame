# OAUTH-Qwen.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## hermes-agent Provider

Provider-ID: `qwen-oauth`  
Auth type: `oauth_external`  
Base: `https://portal.qwen.ai/v1`  
Client ID: `f0304373b74a44d2b584a3fb70ca9e56`  
Token URL: `https://chat.qwen.ai/api/v1/oauth2/token`

## Qwen Portal Header

`run_agent.py` baut fuer Qwen Portal:

```http
User-Agent: QwenCode/0.14.1 (<os>; <machine>)
X-DashScope-CacheControl: enable
X-DashScope-UserAgent: QwenCode/0.14.1 (<os>; <machine>)
X-DashScope-AuthType: qwen-oauth
```

## Modellnormalisierung

`qwen-oauth` ist in Hermes ein Direct Provider mit matching-prefix stripping. `qwen/...` wird also fuer native Nutzung ggf. auf den Modellnamen ohne Providerpraefix reduziert, wenn passend.

## Implementierungsnotiz

Qwen OAuth sollte als eigener Premium-/Portal-Provider behandelt werden, nicht als normaler DashScope API-Key. Wichtig sind die spezifischen DashScope/QwenCode Header.
