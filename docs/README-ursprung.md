> Aktueller Erweiterungsstand und Prüfbericht: [IMPLEMENTIERUNG.md](IMPLEMENTIERUNG.md). Die folgende MVP-Beschreibung dokumentiert den ursprünglichen Stand.

# METALLWERK – MVP

Deutschsprachige Betriebsplanung für Metallbau und Bauschlosserei. React, TypeScript, Vinext, Tailwind, Shadcn, Cloudflare D1 und R2.

## Informationsarchitektur
- Dashboard: Betriebskennzahlen, heutige Einsätze, Schnellanlage.
- Planung: Tag, Woche, zwei Wochen; Mitarbeiterzeilen, Auftragskarten; Gruppen-/Art-/Statusfilter; Drag & Drop mit überprüfbarem Verschieben-Dialog.
- Aufträge: Suche, Filter, Detail, Bearbeitung, Mitarbeiterzuweisung, Fertigungsschritte, Dokumente.
- CRM: Kunden mit Ansprechpartner, Kontaktdaten, Adresse und Auftragsübersicht.
- Material: Bedarf, Bestand, Reservierung, Bestellung und Liefertermin. Änderungen aktualisieren den Auftragsmaterialstatus.
- Mitarbeiter: Wochenstunden, Gruppen, Kontaktdaten, Qualifikationen und Abwesenheiten.
- Zeiterfassung: eigene Tagesaufträge, persistente Start-/Stop-Erfassung, manuelle Buchung.
- Zeitauswertung: Wochenwerte je Mitarbeiter und Zeitart.
- Zeittafel: Vollbild, Uhr, aktuelle Woche, optionale Rotation; Datenabruf alle 15 Sekunden.
- Einstellungen: Benutzerzuordnung, Rollen und Änderungsprotokoll.

## Datenmodell
`db/schema.ts` definiert 21 Tabellen. Die operativen Tabellen besitzen echte Fremdschlüssel und indizierte Mitarbeiter-/Datumsbeziehungen. Flexible Zusatzattribute liegen im JSON-Feld `data`, Kernrelationen und Suchschlüssel in eigenen Spalten. Die API liest die Tabellen mit separaten vorbereiteten Abfragen in einem Batch. Schemaänderungen erfolgen ausschließlich über Drizzle-Migrationen. Beispieldaten werden einmalig in einer transaktionalen, idempotenten Batch-Operation angelegt.

Kernrelationen: Kunden → Aufträge → Einteilungen / Arbeitsschritte / Material / Dokumente / Zeitbuchungen. Mitarbeiter → Einteilungen / Zeiten / Abwesenheiten / Benutzer. Weitere Tabellen für Kontakte, Standorte, Rollen, Berechtigungen, Lieferanten, Materialzuordnungen, Fahrzeuge und Geräte sind Erweiterungspunkte.

## Sicherheit und Synchronisierung
Die private Site verwendet die vom Hosting authentifizierten Identitätsheader. Der erste Besucher der zunächst ausschließlich dem Eigentümer zugänglichen Site wird Admin. Weitere Benutzer erhalten ausschließlich per expliziter E-Mail-Zuweisung Zugang zu den App-Daten. Das Bereitstellen einer Benutzerzuordnung ändert nicht die Site-Zugriffsfreigabe.

Admin verwaltet Benutzer; Geschäftsführung, Disposition und Büro bearbeiten Betriebsdaten. Werkstatt, Monteur und Service lesen eigene Einsätze und buchen eigene Zeiten. Die Prüfung erfolgt serverseitig, nicht nur in der Oberfläche. Änderungen verwenden Versionsnummern. Planung prüft Überschneidungen und Abwesenheit sowohl vorab als auch direkt in der schreibenden SQL-Anweisung. Dateizugriffe sind auf autorisierte Aufträge begrenzt; Uploads maximal 10 MB, kein HTML/SVG. Abfrage alle 15 Sekunden, keine WebSocket-Synchronisierung.

## MVP-Grenzen / nächste Ausbaustufen
- D1/SQLite und ChatGPT-Anmeldung statt PostgreSQL und eigenem Passwort-Login.
- Rechte sind derzeit rollengebunden; individuelle Rechte und feinere Trennung zwischen Büro/Disposition/Geschäftsführung sind noch nicht umgesetzt.
- Auswertung bisher wochenweise, ohne arbeitsrechtliche Feiertags-/Urlaubs-/Überstundenkonten. Sollstunden bleiben Wochenvertragssoll. Gebuchte Zeiträume werden ohne automatischen Pausenabzug ausgewertet; Pausen müssen gesondert gebucht werden.
- Kein Rechnungs-/Angebotseditor, keine E-Mail-/Push-Zustellung, keine externen ERP-Schnittstellen.
- Fahrzeug-/Maschinenkonflikte und die komplette Ressourcenstammdatenverwaltung sind noch nicht umgesetzt.
- Zusatzfelder, mehrere CRM-Kontakte/Standorte und rollenbezogene Produktions-/Baustellenansichten sind teilweise vorbereitet, noch nicht vollständig als Verwaltungsoberflächen umgesetzt.
- Keine Offline-Buchung. Zeiten werden minutengenau erfasst; Start und Ende müssen am selben Kalendertag liegen. Für tageübergreifende Arbeit getrennte Buchungen anlegen.

## Prüfung
Erfolgreicher Produktionsbuild und TypeScript-Prüfung. SQLite-Migration, sämtliche Beispielrelationen, Fremdschlüssel und Konfliktabfrage lokal geprüft. Keine Browser-/End-to-End-Prüfung durchgeführt. Vor einem betrieblichen Echtbetrieb sind fachliche Abnahme, Mehrbenutzertests, Backup-/Wiederherstellungsverfahren und die noch benötigten Ausbaustufen erforderlich.
