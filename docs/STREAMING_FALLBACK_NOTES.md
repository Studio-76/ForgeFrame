# STREAMING_FALLBACK_NOTES

## Fehlerzeitpunkt im Streaming

### Pre-content Fehler
- Fehler tritt vor dem ersten Content auf.
- Fallback (abhängig von Policy) grundsätzlich möglich.

### Mid-stream Fehler
- Fehler nach Beginn der Content-Ausgabe.
- Kein transparenter Neustart auf anderes Ziel ohne Protokollbruch.

## No-Restart-Regel nach Content-Beginn
- Nach erstem sichtbaren Content darf kein stiller Neuversuch mit anderem Ziel erfolgen.
- Stattdessen klare Fehlerkommunikation und deterministische Endzustände.

## Endpoint-Fallback vs Modell-Fallback
- Endpoint-Fallback: alternatives Ziel innerhalb gleicher Modellstrategie.
- Modell-Fallback: Wechsel auf alternatives Modell/Capability-Profil.
- Beide Pfade benötigen getrennte Policies und Telemetrie.

## Provider-Fehlernormalisierung
- Provider-spezifische Fehler in normierte Kategorien überführen.
- Normalisierung muss Ursache und Recovery-Hinweise erhalten.

## Wichtige Randfälle
- Timeouts nach teilweisem Stream.
- Tool-Call-Ausgaben im Fehlerfenster.
- Disconnects zwischen Chunk-Segmenten.
- Retry-Fenster nur solange kein Content publiziert wurde.
