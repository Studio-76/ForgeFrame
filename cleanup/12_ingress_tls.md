# Codex-CLI-Auftrag: Ingress / TLS / Certificates

## Harte Arbeitsregel

Arbeite ausschließlich im aktuell ausgecheckten ForgeFrame-Repository. Verwende den vorhandenen Code als Ist-Basis. Verwende `ForgeFrame_ZIELBILD_V9.md` nur als Sollmaßstab, falls die Datei im Projektordner vorhanden ist; wenn sie fehlt, arbeite aus den in diesem Prompt beschriebenen Sollanforderungen. Keine kosmetische Scheinlösung bauen. Keine Buttons, Tabs oder Statusanzeigen stehen lassen, wenn sie keine reale API-, Persistenz- oder Laufzeitbedeutung haben. Wenn eine echte Funktion Backend-Unterstützung braucht und diese fehlt, implementiere den minimal sauberen Backend-/API-/Frontend-Pfad mit Tests oder klassifiziere den Zustand sichtbar als `not-ready`, `unsupported`, `bridge-only` oder `onboarding-only`.

## Aktuelle Problemhypothese

Ingress/TLS ist kritisch für Verkaufsfähigkeit. Die aktuelle Seite zeigt Checks und Blocker, muss aber zu einem geführten FQDN-/TLS-Betriebsflow werden.

## Ziel der Seite

Ingress/TLS wird zur Exponierungs- und Zertifikatszentrale: FQDN, DNS, Listener 80/443, same-origin, ACME, Zertifikatsstatus, Renew, Blocker und Ausnahme-Modus.

## Betroffene Frontend-Dateien

- frontend/src/pages/IngressTlsPage.tsx
- frontend/src/api/admin.ts
- backend/app/api/admin/ingress.py
- backend/app/api/admin/control_plane_bootstrap_domain.py

## Konkreter Umbauauftrag

1. Oben klarer Gesamtstatus: öffentlich produktionsbereit, Ausnahme-Modus, blockiert, nur lokal.
2. Zeige FQDN/DNS/Port80/Port443/HTTPS/Certificate als Checkliste mit Evidence und nächster Aktion.
3. Renew-Aktion nur aktivieren, wenn API und Status es zulassen; Ergebnis sichtbar machen.
4. Selbstsigniert/manuell/kein FQDN als bewussten Ausnahmezustand markieren, nicht kosmetisch grün.
5. Verlinke von Blockern zu Settings/Onboarding/Health, aber keine doppelten langen Erklärflächen.

## Akzeptanzkriterien

- Ein Betreiber erkennt exakt, warum HTTPS nicht produktionsbereit ist.
- Zertifikatslaufzeit und Verlängerungsfenster werden sichtbar.
- Renew erzeugt ein echtes Operationsergebnis.

## Pflichtprüfung

Führe mindestens aus:

```bash
cd frontend
npm run build
npm test -- --runInBand
```

Falls `npm test -- --runInBand` wegen Vitest-Optionen in diesem Projekt nicht unterstützt wird, führe stattdessen `npm test` aus und dokumentiere exakt, warum. Zusätzlich alle direkt betroffenen Backend-Tests oder Typechecks ausführen, sobald Backend-Endpunkte geändert wurden. Am Ende muss eine kurze Implementierungsnotiz mit geänderten Dateien, echten Funktionen und bewusst verbleibenden Blockern stehen.
