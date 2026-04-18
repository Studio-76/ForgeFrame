# MIGRATION_RULES

## Harte Migrationsregeln

1. Referenzcode ist nur Referenz.
2. Kein 1:1-Port von historischen Referenzdateien.
3. Keine Imports aus `reference/` in produktiven Code.
4. Semantik bewahren, Struktur neu aufbauen.
5. Implementierungen ForgeGate-nativ entwerfen.

## Kritische Semantikbereiche

### Codex OAuth / Discovery
- Verhalten verstehen, aber Flow neu für ForgeGate entwerfen.

### Streaming (pre-content vs mid-stream)
- Fehlerbehandlung abhängig vom Zeitpunkt des Fehlers.

### Tool Calling
- Semantische Konsistenz zwischen alten und neuen Feldformaten.

### Fallback-Semantik
- Klare Regeln, wann Endpoint- oder Modellwechsel zulässig sind.

### Auth-Modi
- Modi sauber trennen; keine impliziten Mischformen.

## Umsetzungsprinzip
- Erst dokumentieren, dann implementieren.
- Jede Migrationseinheit braucht nachvollziehbare Semantikbegründung.
