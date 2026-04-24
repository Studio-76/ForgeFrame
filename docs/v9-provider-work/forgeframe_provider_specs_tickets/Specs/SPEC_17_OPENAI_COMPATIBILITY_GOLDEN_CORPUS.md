# SPEC 17 – OpenAI Compatibility Golden Corpus und Signoff

## Ziel
Maximale OpenAI-Kompatibilität wird messbar und signoff-fähig.

## Corpus-Klassen
Chat simple, Chat multimodal, Responses simple, Responses input_items, Streaming Chat, Streaming Responses, Tool Calling, Structured Output, Error Semantics, Unsupported/Partial Fields, Model Listing, Files, Embeddings.

## Signoff-Ausgabe
`supported`, `partial`, `unsupported`, `deviation_reason`, `evidence_source`, `last_verified_at`, `sample_request_id`, `raw_diff_summary`.

## Akzeptanz
Keine globale Behauptung maximaler Kompatibilität, wenn die Suite rot ist. Negative Fälle werden nicht als grün gezählt.
