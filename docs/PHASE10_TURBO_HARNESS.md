# ForgeGate Phase 10 Turbo

## Fokus
- Harness-Lifecycle robuster machen
- Discovery/Sync/Inventory orchestrierbarer machen
- generisches Streaming härten
- Client-/Integrations-Observability operativer machen

## Kernänderungen
- `HarnessStore` nutzt jetzt schema-versionierte, atomare Persistenz mit Corruption-Fallback (`*.corrupt`) und größerer Run-Historie.
- Profile tragen Lifecycle-/Verify-/Probe-Status sowie Success/Failure-Counter.
- Sync schreibt eigene Runs und aktualisiert Profilstatus konsistent.
- Generisches Streaming bricht nicht mehr still ab: Done-/Decode-/Connection-Fehler werden explizit behandelt.
- Neue operative Client-Sicht: `GET /admin/usage/clients`.
- UI zeigt stärkere Harness-Signale (Lifecycle, Verify-/Probe-Status, Harness-Run/Profile-Counts).

## Bewusst offen
- keine vollständige DB-Migrationsschicht
- keine komplette Workflow-Engine
- keine Multi-Tenant/IAM-Plattform
