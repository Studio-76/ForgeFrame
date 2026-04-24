# OAUTH-NousPortal.md

> Reverse-engineered from the accessible source snapshots of `DaCHRIS/code-proxy` and `DaCHRIS/hermes-agent` on 2026-04-24.  
> This describes implementation-relevant behavior found in those repos. It is not a statement that every flow is officially supported by the upstream vendor. Treat OAuth/account-token integrations especially carefully and verify vendor terms before production use.

## hermes-agent Provider

Provider-ID: `nous`  
Auth type: `oauth_device_code`  
Portal: `https://portal.nousresearch.com`  
Inference: `https://inference-api.nousresearch.com/v1`  
Client ID: `hermes-cli`  
Scope: `inference:mint_agent_key`

## Account Info

Hermes fragt die Account-/Subscription-Info so ab:

```http
GET https://portal.nousresearch.com/api/oauth/account
Authorization: Bearer <access_token>
Accept: application/json
```

Die Antwort enthaelt u.a. `subscription.monthly_charge`, `tier`, `credits_remaining` usw. Hermes nutzt das zur Free-/Paid-Tier-Erkennung und Modellfilterung.

## Konzept

Der OAuth-Token wird nicht direkt zwingend als Inferenz-Key genutzt. Der Scope `inference:mint_agent_key` deutet darauf hin, dass ein kurzlebiger Agent-/Inference-Key erzeugt wird. Hermes hat dafuer `DEFAULT_AGENT_KEY_MIN_TTL_SECONDS = 1800`.

## Implementierungsnotiz

Fuer ForgeFrame:

- Provider `nous_oauth` fuer Login/Account.
- Runtime-Credential als geminteter Agent-Key.
- Separater Refresh-/Mint-Pfad, bevor die TTL unterschritten wird.
