# SPEC 16 – Native `/v1/responses` Object Model

## Ziel
`/v1/responses` wird native ForgeFrame-Produktwahrheit statt Chat-Message-Bridge.

## Kernobjekte
`native_responses`, `native_response_items`, `native_response_events`, `native_response_tool_calls`, `native_response_tool_outputs`, `native_response_follow_objects`, `native_response_stream_events`, `native_response_mappings`.

## Beziehungen
API Key, Instanz, Conversation, Thread, Run, Dispatch Job, Task, Approval, Artifact, Tool Call, Provider Target, Cost/Usage.

## Muss-Verhalten
Sync und Streaming erzeugen typisierte native Mapping-/Evidence-Objekte. Chat-Translation bleibt nur Adapter-/Compatibility-Schicht. Tool-Roundtrips sind nativ nachvollziehbar.
