# Ticket 03 - Runtime Compat fuer Responses, Streaming und Tool Calling

Status: funktional umgesetzt und regressionsgetestet

- `/v1/responses` verarbeitet erweiterte Inputformen, streamt Responses-SSE und normalisiert Tool-Call-Ausgaben.
- Der Responses-Pfad wurde gegen den Chat-Pfad korrigiert, damit Gateway-Identitaeten sauber uebergeben werden.
- Fehlerbilder fuer invalide Inputs, Tool-Choice-Konflikte und Provider-Readiness sind durch Tests abgesichert.

Verifikation:

- Backend-Tests fuer `/v1/chat/completions` und `/v1/responses` erfolgreich.
