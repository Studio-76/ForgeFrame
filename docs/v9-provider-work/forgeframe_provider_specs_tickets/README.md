# ForgeFrame V9 Provider- und Restlücken-Specs für Codex

Dieses Paket basiert auf V9, der Codex-Rückmeldung nach Specs 01-13 und dem `provider-interface-official-enriched.zip`.

## Antwort auf die Ausgangsfrage
Für belastbare Architektur- und Umsetzungsspezifikationen liegt jetzt genug Material vor. Für echte Done-Behauptungen fehlen später nur noch Live-Credentials und Live-Provider-Evidence je OAuth-/Account-Provider.

## Inhalt
- `Specs/` Architektur- und Umsetzungsspezifikationen.
- `Tickets/` direkt abarbeitbare Tickets für Windows Codex CLI/IDE.
- `Matrices/` Provider-Matrizen.

## Harte Regel
Provider dürfen nur dann `runtime-ready` oder `fully-integrated` werden, wenn der jeweilige Signoff real grün ist. Ohne Credentials bleibt der Status maximal `contract-ready`, `adapter-ready-without-live-proof`, `bridge-only`, `onboarding-only` oder `partial-runtime`.
