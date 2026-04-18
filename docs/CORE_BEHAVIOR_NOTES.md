# CORE_BEHAVIOR_NOTES

Diese Notizen beschreiben Core-Semantik, die später neu rekonstruiert werden muss.

## Routing
- Modell-/Provider-Auswahl über deterministische Regeln.
- Erweiterbar für policies und capability checks.

## Streaming
- Unterschiedliche Fehlerpfade vor und nach erstem Content-Chunk.
- Keine versteckte Stream-Neustartlogik nach Content-Beginn.

## Fallback
- Endpoint-Fallback und Modell-Fallback getrennt behandeln.
- Zustandsabhängige, nachvollziehbare Entscheidungspfade.

## Provider Dispatch
- Einheitliche Adapter-Grenze für alle Provider.
- Normierte Fehlerabbildung Richtung API/Core.

## Rate Limits
- Limits als systemische Querschnittsfunktion.
- Beobachtbarkeit und kontrollierte Degradationspfade.

## Metrics / Telemetry
- Metriken, Tracing und Logs in klaren Modulen.
- Ereignis- und Fehlertransparenz als Betriebsgrundlage.

## Context Optimize
- Kontextreduktion/-strukturierung als eigenständiger Core-Baustein.
- Nicht mit Provider-spezifischem Payload-Mapping vermischen.
