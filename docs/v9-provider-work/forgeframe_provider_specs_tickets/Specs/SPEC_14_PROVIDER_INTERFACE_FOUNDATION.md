# SPEC 14 – Provider Interface Foundation und Provider Catalog

## Ziel
ForgeFrame bekommt eine einheitliche Provider-Grundarchitektur für alle API-, OAuth-, Account-, CLI-, Bridge-, SDK-, lokalen und Aggregator-Provider aus dem Provider-Dokumentationspaket.

## Kernregeln
- Keine Stubs als Produktwahrheit.
- Contract, Adapter, Evidence und Live-Signoff werden getrennt.
- Provider ohne Live-Evidence werden nicht als `fully-integrated` oder `runtime-ready` dargestellt.

## Provider-Klassen
`openai_compatible`, `openai_compatible_aggregator`, `openai_compatible_local`, `anthropic_messages`, `gemini_native`, `bedrock_converse`, `oauth_account_runtime`, `oauth_cli_bridge`, `external_process`, `agent_endpoint_compat`, `client_config_reference`, `unsupported_documented`.

## Reifestufen
`documented-only`, `contract-ready`, `adapter-ready-without-live-proof`, `onboarding-only`, `bridge-only`, `partial-runtime`, `runtime-ready`, `fully-integrated`.

## Evidence-Klassen
`docs_declared`, `repo_observed`, `unit_tested`, `contract_tested`, `live_probe_verified`, `streaming_verified`, `tool_calling_verified`, `error_fidelity_verified`, `credential_refresh_verified`, `ui_operator_verified`.

## Datenmodell
Ergänze Provider-/Target-Tabellen oder Registry-Objekte um: provider_id, display_name, provider_class, auth_modes_supported, api_modes_supported, base_url_default, base_url_override_env, token_env_vars, model_name_policy, streaming_support_claim, tools_support_claim, responses_support_claim, evidence_status, maturity_status, source_docs, last_probe_at, live_signoff_at, signoff_notes.

## Akzeptanz
Alle Provider aus den Matrix-Dateien sind bekannt. UI zeigt Contract vs. Evidence vs. Runtime getrennt. Status wird deterministisch aus Evidence abgeleitet.
