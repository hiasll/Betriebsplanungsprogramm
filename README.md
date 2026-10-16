# Kreidl · Betriebsplanungsprogramm

Quellcode der Kreidl-Auftragsverwaltung und Betriebsplanung.

## Aktueller Stand

Übernommen aus dem veröffentlichten Sites-Projekt, Quellstand `7bc70b74c4b7c3089426428e6f724b4a0ec78052` (16.10.2026). Enthalten sind Planung und Zeittafel, Aufträge mit Zeit- und Materialbuchungen, CRM, Artikelstamm, Lager, Mitarbeiter, Abwesenheiten, Zeiterfassung, Auswertungen, Ressourcen, Vorlagen und Wartungen. Kunden unterstützen feste Stundensätze sowie Aktiv/Gesperrt/Archiviert.

## Technik

React 19, TypeScript, Vinext/Vite, Tailwind, Cloudflare Workers, D1 (SQLite) und R2. Abhängigkeiten sind in `package-lock.json` festgehalten. Node.js ab 22.13 erforderlich; die Build-Skripte verwenden Linux-Werkzeuge (`bash`, `timeout`, bei Installation `flock`).

## Entwicklung und Prüfung

```bash
npm ci
npm run dev
```

```bash
npx tsc --noEmit
node --test tests/*.test.mjs
npm run build
```

Die zuletzt veröffentlichte Version bestand 114 automatisierte Tests, Typprüfung und Produktionsbuild. Ein vollständiger visueller Browser- und Mehrbenutzertest steht noch aus.

## Hosting und Daten

Die Anwendung ist für ChatGPT Sites mit Cloudflare Workers vorbereitet. `.openai/hosting.json` enthält die Projektzuordnung und die Bindungsnamen `DB` (D1) und `BUCKET` (R2), keine Zugangsschlüssel. Die SQL-Migrationen stehen unter `drizzle/`.

Kundendaten, Buchungen, hochgeladene Dokumente und Sicherungen der produktiven Anwendung sind **nicht** Teil dieses Repositories. `lib/seed.ts` enthält Beispieldaten; unter `public/altbestand/` liegt die ältere, lokale Beispielanwendung.

Die Anmeldung setzt die vom Sites-Hosting geprüften Identitätsheader voraus. Für einen anderen Hoster müssen Anmeldung, vertrauenswürdige Identitätsprüfung, D1/R2 und Deployment gesondert eingerichtet werden. Dieses Repository allein stellt die Anwendung nicht unter GitHub Pages bereit.

## Synchronisierung

Eine mit der bestehenden Sites-Anwendung verknüpfte ChatGPT-Cloud-Aufgabe prüft den Branch `main` stündlich (Europe/Vienna). Neue Änderungen werden nach erfolgreicher Typprüfung, automatisierten Tests und Produktionsbuild in die bestehende Anwendung übernommen. Bei Fehlern oder Konflikten bleibt die bisherige Version online. Projekt-ID, Zugriffsfreigaben und produktive DB-/R2-Bindungen bleiben erhalten.

Die Übernahme erfolgt **von GitHub zur Site**. Änderungen, die direkt an der Site vorgenommen werden, werden nicht automatisch nach GitHub zurückgeschrieben. Der bisherige Anwendungslink bleibt bestehen. Der erste unbeaufsichtigte Lauf steht nach der Einrichtung noch aus.

Die ursprüngliche Dokumentation mit historischen Einschränkungen steht in [docs/README-ursprung.md](docs/README-ursprung.md). Weitere Implementierungsnotizen: [IMPLEMENTIERUNG.md](IMPLEMENTIERUNG.md).
