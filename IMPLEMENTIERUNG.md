# METALLWERK – Erweiterungsstand

## Umgesetzt

- Gemeinsame Einsätze mit mehreren Mitarbeitern, abweichenden Beginn-/Endzeiten, Ressourcen und Einsatzort. Ganze Teams oder einzelne Mitarbeiter verschieben; bestehende Drag-and-Drop-Aktion öffnet den prüfbaren Dialog.
- Konfliktprüfung für Personal, Abwesenheit, Ressourcen, Sperrzeiten und erforderliche Qualifikationen. Wochenüberschreitungen und verspätetes Material erzeugen Warnungen.
- Dauerhafte Timer mit Start, Pause, Fortsetzen, Stoppen und Schutz vor gleichzeitigen aktiven Timern. Manuelle Buchungen mit Überschneidungsprüfung, Mitternachtssplitting und konsistenter Betriebszeitzone.
- Tagesabschluss mit Einreichung, Freigabe, begründeter Rückgabe und protokollierter Korrektur. Pausen zählen nicht als produktive Stunden.
- Lagerartikel, auftragsbezogener Bedarf, Wareneingang, Reservierung, Freigabe, Verbrauch und begründete Inventurkorrektur. Reservierungen können den verfügbaren Bestand nicht doppelt beanspruchen.
- Mobile Einsatzrückmeldung mit Notizen, Mängeln, Verbrauch, Foto und Folgeterminbedarf. Temporäre Textentwürfe bleiben bei Verbindungsfehlern erhalten. Das Ergebnis eines einzelnen Einsatzes schließt den Gesamtauftrag nicht automatisch.
- Rollenmatrix und individuelle Rechte; Prüfung serverseitig auch bei direktem API-Zugriff. Finanzielle Felder werden vor der Übertragung an unberechtigte Mitarbeiter entfernt.
- Sechs bearbeitbare Auftragsvorlagen mit unabhängiger Kopie bei Auftragserstellung.
- Dispositionsliste mit vollständigem/teilweisem Planungsstand, Reststunden, Priorität, Material und Qualifikation.
- Ressourcen und Sperrzeiten; Auftragsnachkalkulation mit fehlenden Kosten als unbekannt statt 0 €.
- Wartungspläne mit Intervall, Vorlauf, Team, Checkliste und Materialhinweisen. Eindeutige Auftragskennung pro Wartungsplan und Fälligkeit.
- Zeittafel mit Heute/Morgen, aktueller/nächster Woche, Zeit, Standort, Ressourcen und letzter erfolgreicher Aktualisierung.
- Berechtigter Vollsicherungsexport mit sämtlichen Datenbanktabellen und den zugehörigen Dokumentdateien. SHA-256-Prüfsummen und ein Abschlussvermerk erkennen beschädigte oder abgebrochene Sicherungen.

## Datenintegrität

Die angewendete Migration `0000_old_spiral.sql` und ihr Snapshot bleiben unverändert. Die neue Migration `0001_wide_misty_knight.sql` ergänzt Tabellen sowie zwei Benutzerfelder mit konstanten Defaults. Vorhandene Daten werden nicht gelöscht. Alte Materialpositionen erhalten bei der ersten Initialisierung je einen eigenen Lagerartikel; gleichlautende Artikel werden nicht ungeprüft zusammengeführt.

Alle neuen Mutationen und die bisherigen Schreibwege verwenden eine gemeinsame Revisionsprüfung und eine transaktionale D1-Batch-Operation. Eine CHECK-Constraint erzwingt den Abbruch der ganzen Operation bei konkurrierenden Änderungen. Idempotenzkennungen verhindern doppelte Wiederholung nach verlorener Antwort. Berechtigungen werden aus dem aktuellen Datenbanksnapshot erneut ermittelt.

## Durchgeführte Prüfungen

26 automatisierte Tests gegen eine getrennte SQLite-Datenbank bestanden, darunter:

- additive Migration und bestehende Beispielrelationen
- vollständige Teamzuweisung, Einzel-/Teamverschiebung, vollständiger Rollback bei Konflikten
- zwei gleichzeitig schreibende Benutzer und wiederholte identische Buchung
- Personal-/Ressourcenkollisionen und Abwesenheiten
- unberechtigte Aktionen, individuelle Rechtssperre und ausgeblendete Kostendaten
- Timerzustand aus erneut gelesenem Datenbestand, Pause/Fortsetzen, Nachteinsatz und Sommerzeit
- Tagesfreigabe und begründete Korrektur
- Materialreservierung, Wareneingang, Verbrauch und Bestandskorrektur
- Folgeterminrückmeldung ohne Gesamtauftragsabschluss
- unabhängige Vorlagenkopie und idempotente Wartungserzeugung
- Wiederherstellung aller Tabellen in eine zweite, separate SQLite-Datenbank mit anschließendem Fremdschlüssel- und Datenvergleich

Produktionsdaten wurden für diese Tests nicht gelesen oder verändert. Die Tests prüfen die tatsächlich verwendete Geschäftslogik und die SQL-Schreiboperationen. Sie ersetzen keine Browser- oder HTTP-End-to-End-Prüfung.

## Verbleibende Einschränkungen

- Die vorgesehene überwachte Browser-Vorschau ist in dieser Umgebung nicht verfügbar. Desktop-/Smartphone-Interaktionen, Fotoauswahl im Browser, echte Gerätewechsel und Bildschirmaktualisierung konnten deshalb nicht end-to-end geprüft werden.
- Ein unabhängiger Worker-Scheduled-Handler ist implementiert und mit gleichzeitigen Aufrufen geprüft. Seine Aktivierung ist noch blockiert: Die verfügbare Sites-Konfiguration und die Deployment-Schnittstelle bieten keine Cron-/Zeitplanverwaltung. Es wurde kein aktiver Zeitplan behauptet oder eingerichtet. Bis dahin bleiben Vorbereitung beim Abruf durch berechtigte Benutzer und manuelle Vorbereitung erhalten.
- Vollsicherung und Wiederherstellung sind mit Testdateien geprüft. Die Wiederherstellung erfolgt bewusst nur in ein neues lokales Ziel; ein Import in die laufende D1-/R2-Umgebung ist nicht enthalten. Die Datei enthält vertrauliche Betriebsdaten und wird nicht zusätzlich verschlüsselt. Große Sicherungen sind durch die Laufzeit- und Speichergrenzen des Hostings begrenzt.
- Ein temporärer Rückmeldungsentwurf speichert Text und Mengen lokal. Eine ausgewählte Fotodatei muss nach vollständigem Schließen/Neuladen des Browsers gegebenenfalls erneut ausgewählt werden. Keine Offline-Übertragung von Fotos.
- Änderungen an der Betriebszeitzone ändern die Interpretation noch nicht mit absoluten Zeitpunkten gespeicherter Altbuchungen und Ortszeitplanungen. Bereits mit absoluten Zeitpunkten gespeicherte Buchungen behalten ihre reale Dauer.
- Keine Änderung der Site-Zugriffsfreigabe und keine Umstellung auf Passwortanmeldung oder PostgreSQL.

Die Erweiterung benötigt noch die Browserabnahme. Am 24.09.2026 war die Browserverbindung verfügbar, der vorgeschriebene Vorschau-Dienst jedoch nicht. Keine Umgehung über Produktivdaten oder alternative Server.

## Vollsicherung wiederherstellen

In Einstellungen „Vollsicherung herunterladen“ wählen. Den Download vollständig aufbewahren. Im passenden Quellstand mit Node 22.13+ ausführen:

```sh
node scripts/restore-backup.mjs /pfad/sicherung.ndjson /pfad/neues-testziel
```

Das Ziel darf nicht existieren. Erst nach erfolgreicher Datenbank-, Beziehungs-, Mengen- und Prüfsummenprüfung entsteht `complete/` mit `database.sqlite`, `files/` und `manifest.json`. Das Werkzeug verbindet sich nicht mit Produktion. Bei Fehlern wird nur das eigens angelegte Testziel entfernt. Migrationen stammen aus dem vertrauenswürdigen Quellstand, niemals aus SQL im Sicherungsarchiv. Dokumentdateien behalten ihre Speicherkennungen.

## Wartungslauf

`worker/index.ts` exportiert `scheduled`; `lib/maintenance.ts` verarbeitet fällige Termine anhand der Betriebszeitzone, einschließlich null Tagen Vorlauf. Jeder Auftrag wird mit Systemakteur, Revisionsprüfung und Idempotenzkennung gespeichert. Pro Aufruf maximal 50 Versuche; größere Rückstände oder anhaltende Konflikte melden einen Fehler für einen erneuten Lauf. Ein künftig unterstützter Hosting-Zeitplan sollte mindestens täglich auslösen. Kein ungeschützter HTTP-Endpunkt und keine zusätzlichen Benutzerzugänge wurden angelegt.

## Zeittafel: Anzeige einstellen (08.10.2026)

- Zeilenhöhe von 160 bis 480 px per Schieberegler oder Zahleneingabe, Standard 220 px. Als Mindesthöhe umgesetzt, damit mehrere Einsätze vollständig lesbar bleiben.
- Mitarbeiterzeilen im Einstellungsdialog per Drag & Drop oder über zugängliche Schaltflächen nach oben/unten verschieben. Zurücksetzen stellt die ursprüngliche Reihenfolge und Standardhöhe her; Abbrechen verwirft den Entwurf.
- Gemeinsame Speicherung in `app_settings` unter `display`, ausschließlich mit Planungsrecht. Versionsprüfung schützt vor überschriebenen Änderungen; wiederholtes Absenden ist idempotent. Neue Mitarbeiter werden automatisch angehängt.
- Änderungen erscheinen nach Speichern sofort auf der aktuellen Tafel und über die vorhandene Synchronisierung auf anderen Tafeln. Filter der Disposition beeinflussen die Zeittafel nicht mehr.
- Keine Datenbankmigration erforderlich. Ein ergänzender Fachtest prüft Speicherung, Rechte, Eingabevalidierung und konkurrierende Änderungen (insgesamt 27 Fachtests).
