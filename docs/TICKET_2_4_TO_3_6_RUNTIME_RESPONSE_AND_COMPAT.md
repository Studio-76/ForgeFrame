## Tickets 2.4 bis 3.6 - Responses, Normalisierung und Kompatibilitaet

Stand: 20.04.2026

### Umgesetzt

- Zentrale Antwort-Normalisierung in `backend/app/core/response_normalization.py` eingefuehrt.
- `/v1/chat/completions` nutzt jetzt den gemeinsamen Chat-Normalisierer.
- `/v1/responses` liefert nicht mehr nur einen Vorstufen-Wrapper, sondern nutzt dieselbe semantische Ergebnisabbildung.
- Streaming fuer `/v1/responses` als SSE-Pfad vorbereitet.
- Kompatibilitaetsmatrix-Endpunkt fuer Provider, Capability-Tiefe und Tiers in der Admin-API ergaenzt.
- Providers-UI zeigt die Kompatibilitaetsmatrix sichtbar an.

### Ergebnis gegen Zielbild

- Chat und Responses divergieren weniger stark im Payload-Aufbau.
- Tool-Call- und Text-Output werden aus derselben Normalisierungsachse gebaut.
- Kompatibilitaet ist nicht mehr nur implizit im Adaptercode, sondern im UI und Admin-API sichtbar.

### Verifikation

- Python-Syntax-/Import-Checks fuer Response- und Registry-Anpassungen erfolgreich.

### Nicht moeglich auf dieser Workstation

- Kein Live-Test gegen echte Upstream-Streams oder echte Providerverbindungen.
- Keine ausführbare E2E-Matrix mangels Testumgebung.
