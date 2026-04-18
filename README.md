# ForgeGate — Smart AI Gateway

ForgeGate ist ein **neu aufgebautes Smart AI Gateway**, das mehrere AI-Provider über eine konsistente Runtime- und Admin-Plattform zusammenführt.

## Projektziel

Dieses Repository liefert zunächst das **Architektur- und Strukturfundament** für ForgeGate. Der produktive Core wird nachgelagert schrittweise neu implementiert.

## Entwicklungsstatus

- Status: **Initial Scaffold**
- Vorgehen: **Architecture-first**
- Core-Implementierung: **pending**

## Grundprinzipien dieses Repos

- ForgeGate wird **from scratch** aufgebaut.
- Der Ordner `reference/` ist ausschließlich Referenzmaterial.
- Es gibt **keine produktiven Imports** aus `reference/`.
- Es wurde bewusst noch **keine Business-Logik** implementiert.

## Repository-Überblick

```text
forgegate/
  docs/        # Architektur-, Scope- und Migrationsdokumentation
  reference/   # Referenzmaterial (nicht produktiv)
  backend/     # Neuer ForgeGate-Backend-Scaffold
  frontend/    # Neuer ForgeGate-Frontend-Scaffold
  scripts/     # Entwickler-Skripte (Platzhalter)
  docker/      # Container-Scaffold (Platzhalter)
```

## Nächster Ausbau (außerhalb dieses Scaffolds)

- Runtime API und Admin API als klar getrennte Schichten aufbauen.
- Provider-Adapter, Auth-Modi, Streaming- und Fallback-Semantik neu implementieren.
- Persistenz, Telemetrie und Admin-UI schrittweise produktiv ausbauen.
