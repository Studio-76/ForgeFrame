# TOOL_CALLING_NOTES

## Kernbegriffe
- `tools`
- `tool_choice`
- `tool_calls`
- `tool_call_id`
- `role="tool"`
- `function_call`
- `function_response`

## Ziel
ForgeGate soll Tool-Calling-Pfade so verarbeiten, dass moderne und Legacy-Schnittstellen semantisch konsistent bleiben.

## Wichtige Anforderungen
- Pfadentscheidung: korrekte Verarbeitung je nach Payload-Form.
- Payload-Erhalt: relevante Felder dürfen nicht verloren gehen.
- Tool-Korrelation über `tool_call_id` muss erhalten bleiben.

## Legacy-Feldweitergabe
- Legacy-Felder (`function_call`, `function_response`) können als Kompatibilitätsdaten auftreten.
- Weitergabe und Normalisierung müssen bewusst und nachvollziehbar erfolgen.

## Warum beides wichtig ist
- Nur Pfadentscheidung ohne Payload-Erhalt bricht Interoperabilität.
- Nur Payload-Erhalt ohne korrekte Pfadentscheidung bricht Semantik.
- Robustes Verhalten erfordert daher beide Aspekte gleichzeitig.
