# SPEC 22 – Credential Requirements und Live Signoff

## Ziel
Sicherer Live-Signoff ohne Secret-Leaks.

## Regeln
Secrets nie loggen. Live-Tests nur bei explizit gesetzten Secrets. Skip ist nicht Pass. Evidence wird persistiert. CI muss offline laufen können.

## Credential-Klassen
API key, OAuth access token, OAuth refresh token, device code session, external process token, AWS IAM, Google ADC/service account, Azure Entra token, GitHub PAT/OAuth/App token.
