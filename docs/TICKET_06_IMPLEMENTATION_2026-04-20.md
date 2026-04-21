# Ticket 06 - Harness Versionierung, Import/Export und Operations

Status: umgesetzt

- Harness-Profile besitzen Revisionsnummern, Parent-Revisionen, Historie sowie Import-/Export- und Rollback-Pfade.
- Backend-API und Frontend bieten Export, Dry-Run-Import, produktiven Import und Rollback.
- Betriebsdaten wie Counters, letzte Nutzung und letzte Exporte/Importe werden fortgeschrieben.

Verifikation:

- Erweiterte Harness-Lifecycle-Tests erfolgreich.
- Compose-Smoke validiert Harness-Snapshot und Runs im Docker-Zielbild.
