# OAUTH_MODES

## Ziel
Dokumentation der drei unterschiedlichen OAuth-Verfahren, die fachlich sauber getrennt werden müssen.

## 1) Browser-Callback-Flow
- Nutzer startet Auth im Browser.
- Provider leitet auf lokalen Callback zurück.
- Lokaler Listener verarbeitet Callback und finalisiert den Flow.

## 2) Manueller Redirect-Completion-Flow
- Nutzer startet Auth-Flow.
- Redirect-Ziel wird manuell im Browser geöffnet und abgeschlossen.
- Ergebnis (Code/Token) wird manuell zurück in den Client übertragen.

**Wichtig:** Verfahren 2 ist ein manueller Abschluss eines Redirect-basierten Flows, nicht der Device-/Hosted-Code-Flow.

## 3) Nativer Device-/Hosted-Code-Flow
- Client erhält Benutzer-Code und Verifikations-URL.
- Nutzer autorisiert auf separater Seite.
- Client pollt Token-Endpunkt bis Abschluss oder Timeout.

## Klare Abgrenzung
- Verfahren 2 und 3 sind **nicht identisch**.
- ForgeGate hat aktuell **keinen nativen Device-/Hosted-Code-Flow implementiert**.

## localhost vs 127.0.0.1
- `localhost` kann je System variieren (z. B. IPv4/IPv6-Auflösung).
- `127.0.0.1` ist ein expliziter IPv4-Loopback.
- Bei Callback-Registrierung und Redirect-Validierung muss diese Semantik bewusst berücksichtigt werden.
