# CORE_BEHAVIOR_NOTES

Diese Notizen beschreiben Core-Semantik für den modularen ForgeGate-Runtime-Kern.

## Routing
- Modell-/Provider-Auswahl über deterministische Regeln.
- Erweiterbar für policies und capability checks.

## Streaming
- Unterschiedliche Fehlerpfade vor und nach erstem Content-Chunk.
- Keine versteckte Stream-Neustartlogik nach Content-Beginn.
- Stream-Ende erfordert explizites Done-Signal oder klaren Interrupt-Fehler.

## Provider Dispatch
- Einheitliche Adapter-Grenze für alle Provider.
- Normierte Fehlerabbildung Richtung API/Core.
- Non-stream und stream laufen durch denselben Routing→Dispatch→Provider-Kanal.

## Usage / Token / Kosten-Grundlagen
- Runtime-Responses können Usage-Daten tragen (`input/output/total tokens`).
- Kosten werden als actual/hypothetical/avoided vorbereitet.
- Ziel: Kostenanalyse ohne erzwungene Komplett-Billing-Plattform in dieser Phase.

## Fallback
- Endpoint-Fallback und Modell-Fallback getrennt behandeln.
- Zustandsabhängige, nachvollziehbare Entscheidungspfade.

## Rate Limits
- Limits als systemische Querschnittsfunktion.
- Beobachtbarkeit und kontrollierte Degradationspfade.

## Metrics / Telemetry
- Metriken, Tracing und Logs in klaren Modulen.
- Ereignis- und Fehlertransparenz als Betriebsgrundlage.

## Context Optimize
- Kontextreduktion/-strukturierung als eigenständiger Core-Baustein.
- Nicht mit Provider-spezifischem Payload-Mapping vermischen.
