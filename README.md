# Rechnungs-Archiv

Eigenständige Browser-App zum Einlesen und Archivieren von Rechnungen per Foto.
Kein Server, kein Build-Schritt, keine Installation — einfach `index.html` öffnen.

**Live:** https://m4wh8dpzwp-art.github.io/rechnungs-app/ (mobil-optimiert, per
"Zum Home-Bildschirm" auf dem iPhone wie eine App nutzbar — auch ohne Netz)

## Funktionsweise

1. Du lädst ein Foto/Scan einer Rechnung hoch (Kamera, Galerie oder Drag&Drop am Desktop).
2. Das Bild wird direkt aus dem Browser an die Claude-API (Vision) geschickt und ausgewertet:
   Datum, Lieferant, Rechnungsnummer, Netto, MwSt-Satz, MwSt-Betrag, Gesamtbetrag, Währung,
   Kategorie, Notizen.
3. Du prüfst/korrigierst die erkannten Felder in einem Formular.
4. Beim Speichern wird:
   - ein Eintrag in die Übersicht aufgenommen (persistiert im Browser),
   - das Originalfoto automatisch benannt (`Datum_Lieferant.jpg`) archiviert,
   - die Excel-Datei `rechnungen.xlsx` neu erzeugt/aktualisiert (eine Zeile pro Rechnung).

Die Startansicht zeigt nur das Wesentliche: Erfassen, eine Kennzahlenzeile (Anzahl Belege,
Gesamtsumme, MwSt-Summe) und die Belegliste. Alles Weitere (API-Key, Modell, Archivordner,
Daten löschen) steckt hinter dem Zahnrad oben rechts.

## Erste Schritte

1. Die App über die Live-URL oben aufrufen, oder `index.html` lokal im Browser öffnen.
2. Über das Zahnrad → "Claude API" deinen API-Key eintragen und auf "Speichern" klicken.
   Beim allerersten Start öffnen sich die Einstellungen automatisch; ein roter Punkt am
   Zahnrad zeigt an, dass noch kein Key hinterlegt ist.
   - Einen Key bekommst du in der [Anthropic Console](https://console.anthropic.com/settings/keys).
   - Der Key wird nur in deinem Browser (`localStorage`) gespeichert und ausschließlich direkt
     an `api.anthropic.com` gesendet. Es gibt keinen Zwischenserver. Da alles client-seitig
     läuft, ist der Key im Browser (z.B. über die Entwicklertools) einsehbar — nutze die App
     daher nur auf deinem eigenen, vertrauenswürdigen Gerät.
3. Optional (nur Desktop-Chromium): Zahnrad → "Archivordner" → "Ordner wählen", um einen lokalen
   Ordner zu verbinden. Dann werden Fotos und `rechnungen.xlsx` automatisch dort
   abgelegt/aktualisiert, ohne dass du jede Datei einzeln herunterladen musst.
   - Funktioniert nur in Chromium-Browsern (Chrome, Edge, Brave, Opera) — nutzt die
     [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).
   - In Firefox/Safari (und auf dem iPhone) nicht verfügbar; der Abschnitt wird dort ausgeblendet.
     Fotos werden stattdessen einzeln heruntergeladen, die Excel-Datei über "Excel exportieren".
   - Die Ordnerverbindung gilt pro Browser-Sitzung (Tab-Neuladen erfordert erneutes Auswählen).
4. "Kamera" bzw. "Galerie" antippen, "Rechnung auslesen" klicken, Felder prüfen, "Speichern".

## Offline-Nutzung und Home-Bildschirm

Die App bringt ein Web-App-Manifest und einen Service Worker mit und lässt sich damit wie eine
installierte App verwenden:

- **iPhone/Safari:** Live-URL öffnen → Teilen → "Zum Home-Bildschirm". Die App startet danach
  ohne Browserleiste und mit eigenem Icon.
- **Desktop-Chromium:** In der Adressleiste erscheint ein Installationssymbol.

**Ohne Netz** startet die App weiterhin und zeigt Belegliste, Auswertung und alle bereits lokal
vorliegenden Belege. Was zwingend eine Verbindung braucht, meldet sich mit einem eigenen Fehler:
das **Auslesen** über die Claude-API und der **Abgleich** mit GitHub. Offline erfasste Belege
bleiben in der Warteschlange und gehen beim nächsten Sync raus.

Die Zwischenspeicherung ist bewusst zweigeteilt: `index.html` wird **immer zuerst aus dem Netz**
geholt — die gesamte App steckt in dieser einen Datei und ändert sich oft, eine veraltete Kopie
wäre schlimmer als eine Sekunde Wartezeit. Bibliotheken und Icons kommen dagegen zuerst aus dem
Cache. Ein normales Neuladen genügt also, um eine neue Version zu bekommen. Aufrufe an
`api.anthropic.com` und `api.github.com` laufen unangetastet durch und werden nie
zwischengespeichert.

## Mehrere MwSt-Sätze pro Rechnung

Eine Rechnung kann mehrere Steuersätze enthalten (z.B. Supermarkt mit 7 % und 19 %). Dafür trägt
jeder Beleg ein Array **`steuerzeilen`** mit je einem Eintrag pro Satz:

```json
"steuerzeilen": [
  { "mwst_satz": 19, "nettobetrag": 84.03, "mwst_betrag": 15.97 },
  { "mwst_satz": 7,  "nettobetrag": 46.73, "mwst_betrag": 3.27 }
]
```

- **Geteilt** über alle Zeilen einer Rechnung: Foto/PDF, Lieferant, Rechnungsnummer, Datum,
  Kategorie, Währung und der Gesamtbetrag. **Unterschiedlich** pro Zeile: Satz, Netto, MwSt.
- **Claude** bekommt `steuerzeilen` als Pflicht-Array im Tool-Schema und legt beim Auslesen
  automatisch je Satz eine Zeile an. Im Prüfformular lassen sich Zeilen ergänzen und entfernen.
- Unter den Zeilen steht die laufende Summe. Weicht sie um mehr als 2 Cent vom eingetragenen
  Gesamtbetrag ab, wird das rot angezeigt — der Gesamtbetrag bleibt aber frei editierbar, weil auf
  Belegen gerundet wird.
- **Zählweise:** In Auswertung und Bericht zählt eine Rechnung mit mehreren Sätzen weiterhin als
  **ein Beleg**. Nur in der MwSt-Aufschlüsselung werden die einzelnen Zeilen gezählt.
- **Alte Belege** ohne `steuerzeilen` funktionieren unverändert weiter: Sie werden beim Lesen als
  genau eine Zeile aus den flachen Feldern `nettobetrag` / `mwst_satz` / `mwst_betrag`
  interpretiert. Eine Migration ist nicht nötig, und die Dateien werden nicht umgeschrieben.
- Beim Speichern werden die flachen Felder als **abgeleitete Summen** mitgeschrieben
  (`nettobetrag` und `mwst_betrag` als Gesamtsumme, `mwst_satz` nur bei genau einem Satz). Das hält
  die Excel-Zeile lesbar und Belege für ältere App-Stände interpretierbar.

## Fremdwährungen

Ein Beleg in einer anderen Währung als EUR wird **nie automatisch umgerechnet**. Der Originalbetrag
bleibt unverändert und erscheint überall — Prüfformular, Liste, Belegansicht — mit seinem
Währungscode statt einem €-Zeichen, z.B. „15.000,00 HUF".

- **Wechselkurs manuell eintragen:** Sobald die Währung nicht EUR ist, erscheint ein zusätzliches
  Feld „Wechselkurs (1 [Währung] = ? €)" — beim Erfassen direkt im Prüfformular, nachträglich
  direkt in der Belegliste unter der jeweiligen Karte. Es gibt keine automatische Kursabfrage;
  der Kurs kommt ausschließlich vom Nutzer, mit sofortiger Vorschau des EUR-Äquivalents.
- **Ohne Kurs keine Summe:** Belege in Fremdwährung ohne hinterlegten Kurs fließen **nicht** in
  Gesamtsumme, MwSt-Summe, Auswertung nach Kategorie/MwSt-Satz oder den Bericht ein — weder 1:1
  noch anderweitig geschätzt. Ein Hinweis (z.B. „2 Belege in Fremdwährung ohne Kurs nicht
  enthalten") macht das an jeder betroffenen Stelle sichtbar, zusammen mit dem Originalbetrag der
  ausgeschlossenen Belege.
- **Mit Kurs vollständig enthalten:** Sobald ein Kurs eingetragen ist, zählt der Beleg mit seinem
  EUR-Äquivalent in allen Summen mit; die Belegkarte zeigt zusätzlich „≈ 50,00 € · Kurs 0,0025".
- Der Excel-Export enthält je Beleg die Spalten **Wechselkurs** und **Gesamt (EUR)** — Letztere
  bleibt leer, wenn (noch) kein Kurs hinterlegt ist, damit sich die Spalte ohne Verfälschung
  aufsummieren lässt.
- Der Währungscode wird beim Speichern auf Großschreibung normalisiert (`chf` → `CHF`), damit der
  Vergleich mit „EUR" zuverlässig funktioniert, unabhängig von der Schreibweise beim Eintippen.

## Kategorien und Auswertung

Es gibt genau vier feste Kategorien: **Mechatronik**, **Pension**, **Privat**, **HW**.

- **Vorauswahl beim Erfassen:** Direkt unter dem Aufnahmebereich stehen Chips für „Automatisch"
  und die vier Kategorien — wählbar **vor** dem Foto oder direkt danach. Eine hier getroffene Wahl
  **gewinnt gegenüber Claudes Vorschlag** und gilt für den aktuellen Beleg; nach dem Speichern
  steht sie wieder auf „Automatisch", damit sie nicht unbemerkt auf den nächsten Beleg wirkt.
- **Automatischer Vorschlag:** Steht die Vorauswahl auf „Automatisch", bekommt Claude die
  Kategorienliste als feste Auswahl vorgegeben und ordnet die Rechnung der am besten passenden zu.
  In beiden Fällen ist die Kategorie im Prüfformular vor dem Speichern änderbar.
- **Nachträglich zuordnen:** Jede Belegkarte in der Liste hat ein Kategorie-Feld. Belege ohne
  Kategorie sind an der gestrichelten Umrandung erkennbar. Die Änderung wird sofort gespeichert
  und – bei aktivem Sync – ins Repo übertragen.
- Enthält ein alter Beleg eine Kategorie außerhalb der vier, bleibt dieser Wert sichtbar und
  auswählbar, bis er umgestellt wird — es geht also nichts verloren.
- **Auswertung:** Über der Belegliste stehen zwei Filter (Jahr und Monat). Sie wirken auf die
  Kennzahlen, die Auswertung und die Liste. Die Auswertung hat zwei Blöcke: **nach Kategorie**
  (Summe, Anzahl Belege, MwSt, Anteil) und **nach MwSt-Satz** (Netto und MwSt je Satz, Anzahl
  Steuerzeilen).
- Der Excel-Export ("Alles als Excel") enthält weiterhin **alle** Belege samt Kategorie,
  unabhängig vom Filter. Für einen Zeitraum gibt es stattdessen den Bericht (siehe unten).

## Belegdateien und Bericht

**Erfassen:** Neben Fotos lassen sich auch **PDF-Rechnungen** hochladen; beide gehen denselben
Weg durch die Auslesung (Fotos als Bild, PDFs als Dokument an die Claude-API).

**Ansehen:** Ein Tipp auf eine Belegkarte öffnet den Originalbeleg in der App — Fotos direkt,
PDFs eingebettet, jeweils mit "In neuem Tab öffnen" und "Herunterladen". Bei Belegen ohne
hinterlegte Datei (z.B. vor dieser Version erfasst) lässt sich eine Datei nachtragen.

Über dem Beleg sitzt ein ausklappbarer Block **"Rechnungsdetails"** mit allen erfassten Feldern:
Lieferant, Datum, Rechnungsnummer, Kategorie, Gesamtbetrag, Währung (bei Fremdwährung zusätzlich
Wechselkurs und EUR-Äquivalent), Notizen, Erfassungszeitpunkt, Archivdateiname und – bei aktivem
Sync – ob der Beleg schon übertragen ist. Darunter stehen die **MwSt-Zeilen einzeln** mit Satz,
Netto und MwSt, bei mehreren Sätzen zusätzlich eine Summenzeile.

- Der Block ist eingeklappt, damit der Beleg selbst im Vordergrund bleibt; einmal aufgeklappt
  bleibt er es auch beim Öffnen des nächsten Belegs.
- Ergibt Netto + MwSt nicht den Gesamtbetrag (Toleranz 2 Cent), steht dort ein roter Hinweis mit
  der tatsächlichen Summe — praktisch beim Abgleich mit dem Foto.
- Die Details sind **rein lesend** und erscheinen auch dann, wenn zu einem Beleg keine Datei
  hinterlegt ist oder das Laden fehlschlägt. Änderbar sind weiterhin Kategorie und Wechselkurs
  direkt in der Belegliste.

**Speicherung:** Originaldateien liegen lokal in IndexedDB — als Warteschlange für den Upload und
als Offline-Cache. Fotos werden vor dem Speichern auf max. 1600 px Kantenlänge verkleinert und als
JPEG (Qualität 80 %) abgelegt; das begrenzt das Wachstum des Sync-Repos und senkt zugleich die
Bild-Tokens beim Auslesen. PDFs werden unverändert übernommen (max. 15 MB).

**Bericht:** Der Button "Bericht erstellen" öffnet einen Dialog mit Jahr, Monat und Kategorie.
Erzeugt werden **zwei getrennte Dateien**:

- ein **PDF** mit den Originalbelegen des Zeitraums hintereinander — Fotos seitenfüllend auf A4
  zentriert, PDF-Belege mit allen ihren Seiten übernommen;
- eine **Excel-Datei** mit zwei Blättern: "Auswertung" (Summen je Kategorie sowie je MwSt-Satz)
  und "Belege" (eine Zeile je Steuersatz; der Gesamtbetrag steht nur in der ersten Zeile eines
  Belegs, damit sich die Spalte ohne Doppelzählung summieren lässt).

Belege ohne hinterlegte Datei werden im PDF übersprungen; die Statuszeile nennt deren Anzahl.

## Löschen und Rückgängig

Ein Beleg verschwindet beim Antippen des ✕ sofort aus der Liste, tatsächlich gelöscht wird er
aber erst **acht Sekunden später**. Solange steht im Hinweis am unteren Rand ein
**"Rückgängig"** — ein Fehlgriff mit dem Daumen kostet also nichts.

- Wiederhergestellt wird der vollständige Beleg samt Originaldatei, Kategorie und Sync-Zustand.
  Weil dabei nichts verändert wurde, löst das Zurückholen auch kein erneutes Hochladen aus.
- Erst nach Ablauf der Frist werden die Datei im Daten-Repo und die lokal gespeicherte
  Belegdatei entfernt. Wird die App vorher geschlossen oder in den Hintergrund geschickt, wird
  die Löschung sofort ausgeführt — sie bleibt also nie in der Schwebe.
- Läuft in diesen Sekunden ein Abgleich, holt er den gelöschten Beleg **nicht** wieder aus dem
  Repo zurück.
- "Alle Einträge löschen" hat zusätzlich zum Bestätigungsdialog dasselbe Rückgängig.

## Synchronisierung zwischen Geräten (optional)

Ohne Einrichtung bleiben alle Daten nur auf dem jeweiligen Gerät. Wer dieselbe Belegliste auf
PC und iPhone haben will, kann sie über ein **privates GitHub-Repo** abgleichen. Synchronisiert
werden die Rechnungsdaten **und** die Originalbelege (Fotos/PDFs).

**Einrichtung:**

1. Auf GitHub ein **neues, privates** Repository anlegen (z.B. `rechnungs-daten`). Leer lassen —
   die App legt die Dateien selbst an.
2. Unter *Settings → Developer settings → Personal access tokens → Fine-grained tokens* einen
   Token erzeugen:
   - *Repository access*: **Only select repositories** → genau dieses eine Daten-Repo
   - *Repository permissions*: **Contents: Read and write** (mehr wird nicht benötigt)
3. In der App: Zahnrad → "Synchronisierung" → Benutzer, Repo-Name und Token eintragen →
   "Sync aktivieren". Die App prüft den Zugriff, warnt bei einem öffentlichen Repo und lädt
   anschließend alle bereits lokal erfassten Belege hoch.
4. Auf dem zweiten Gerät dieselben drei Angaben eintragen — die vorhandenen Belege werden
   heruntergeladen.

**Funktionsweise und Verhalten:**

- Pro Beleg wird eine eigene Datei geschrieben (`daten/2026-07-15_lieferant_a1b2.json`). Weil
  zwei Geräte nie dieselbe Datei anfassen, entstehen beim parallelen Erfassen keine Konflikte.
- Die Datei enthält alle Felder des Belegs einschließlich der Kategorie. Wird eine Kategorie
  nachträglich geändert, wird dieselbe Datei aktualisiert (kein zweiter Eintrag).
- **Originalbelege** werden als `belege/<id>.jpg` bzw. `belege/<id>.pdf` mitsynchronisiert. Die
  Datenzeile verweist über `belegPfad` darauf; die Datei wird immer vor der Datenzeile
  hochgeladen, damit kein Verweis ins Leere zeigt. Gelesen werden die Dateien über die
  **Blobs-API** (`/git/blobs/<sha>`), da die Contents-API Inhalte nur bis 1 MB ausliefert.
- Heruntergeladen werden Belegdateien erst bei Bedarf (Belegansicht oder Bericht) und dann lokal
  zwischengespeichert — ein Abgleich lädt also nicht das ganze Archiv.
- Beim Löschen eines Belegs werden Datenzeile und Belegdatei entfernt — nach Ablauf der
  Rückgängig-Frist (siehe oben).
- **Schutz vor Datenverlust:** Fehlt beim Abgleich auf einmal ein Großteil der Belege im Repo
  (z.B. falsches Repo verbunden), werden sie **nicht** lokal gelöscht; stattdessen erscheint ein
  Hinweis in der Sync-Leiste. Beim Wechsel auf ein anderes Repo werden gespeicherte Pfade
  zurückgesetzt, sodass alles neu hochgeladen statt als gelöscht gewertet wird.
- Beim Laden holt die App die Dateiliste über die Git-Trees-API und lädt nur Dateien, deren
  Inhalt sich geändert hat; `localStorage` dient als lokaler Cache.
- Schreibkonflikte (HTTP 409/422) werden erkannt und automatisch mit dem aktuellen Stand
  wiederholt.
- Ohne Verbindung gelöschte Belege werden vorgemerkt und beim nächsten erfolgreichen Sync im
  Repo nachgezogen — sie tauchen nicht wieder auf.
- Die Sync-Leiste über der Belegliste zeigt den Zeitpunkt des letzten Abgleichs, die Anzahl noch
  offener Einträge und Fehler; ein Tippen darauf startet einen erneuten Versuch. Noch nicht
  hochgeladene Belege tragen in der Liste einen kleinen grauen Punkt.
- Abgeglichen wird beim Start, nach dem Speichern/Löschen, beim Zurückkehren zur App (höchstens
  einmal pro Minute) und manuell.
- "Alle Einträge löschen" entfernt bei aktivem Sync auch die Dateien im Repo — der Bestätigungs-
  dialog weist darauf hin.

**Sicherheit:** Der Token liegt wie der Claude-Key nur im `localStorage` dieses Browsers und
geht ausschließlich an `api.github.com`. Da er auf ein einzelnes Repo und `Contents` beschränkt
ist, bliebe der Schaden bei einem Verlust auf dieses Daten-Repo begrenzt. Fine-grained Tokens
laufen ab (max. ~1 Jahr) und müssen dann neu hinterlegt werden.

## Technische Details

- Einzelne HTML-Datei (`index.html`) mit eingebettetem CSS/JS — keine Build-Tools nötig.
- Mobile-first Oberfläche mit automatischem Hell-/Dunkelmodus (folgt der Systemeinstellung),
  iOS-Feinheiten berücksichtigt: Safe-Area-Ränder, 16px-Eingabefelder (kein Auto-Zoom in Safari),
  Kamera-Direktaufnahme via `capture="environment"`.
- Bedienung: Tippflächen mindestens 44 px, sichtbare Druckzustände auf Buttons, Chips und
  Belegkarten, eingeblendete Bottom-Sheets, Ladezustand direkt im Button. Belegkarten sind auch
  per Tastatur erreichbar (Enter/Leertaste). `prefers-reduced-motion` wird respektiert.
- Vibration über `navigator.vibrate()` bei Auswahl, Erfolg und Fehler. **iOS Safari unterstützt
  das nicht** — dort wirkt ausschließlich die optische Rückmeldung.
- Offline-Fähigkeit über einen Service Worker (`sw.js`) samt Web-App-Manifest
  (`manifest.webmanifest`) und eigenen Icons (`icons/`). Registriert wird der Worker nur unter
  `https` bzw. `localhost` — beim lokalen Öffnen per `file://` gibt es keine Service Worker.
- Excel-Erzeugung läuft komplett im Browser über [SheetJS](https://sheetjs.com/)
  (`lib/xlsx.full.min.js`, lokal mitgeliefert, keine CDN-Abhängigkeit).
- PDF-Erzeugung und -Zusammenführung über [pdf-lib](https://pdf-lib.js.org/)
  (`lib/pdf-lib.min.js`, ebenfalls lokal mitgeliefert).
- Die Felderkennung nutzt die Claude-API mit erzwungenem Tool-Use
  (`tool_choice: {type: "tool", name: "extract_invoice"}`), damit die Antwort zuverlässig als
  strukturiertes JSON zurückkommt statt als Freitext.
- Erfasste Rechnungsdaten (Text, keine Bilder) werden zusätzlich in `localStorage` gehalten,
  damit die Tabelle auch nach einem Reload erhalten bleibt. "Alle Einträge löschen" leert nur
  diese Liste — bereits archivierte Fotos/Excel-Dateien sind davon nicht betroffen.
- Bilder selbst werden nicht in `localStorage` gespeichert (Speicherlimit), sondern direkt beim
  Speichern archiviert (Ordner oder Download).

## Grenzen / mögliche Erweiterungen

- Die Felderkennung per Vision-Modell ist nicht fehlerfrei — insbesondere bei schlechten Fotos,
  handschriftlichen Belegen oder unüblichen Layouts. Das Prüf-Formular vor dem Speichern ist
  bewusst Teil des Workflows.
- API-Key und Token sind pro Gerät getrennt und müssen auf jedem Gerät einmal eingegeben werden.
- Ohne aktivierte Synchronisierung sind die Beleglisten pro Gerät getrennt.
- Belege, die vor der Dateisynchronisierung erfasst wurden, haben keine hinterlegte Datei. Sie
  erscheinen in der Liste mit einem Hinweissymbol; die Datei lässt sich über die Belegansicht
  nachtragen.
- Git behält gelöschte Dateien in der Historie. Das Repo wächst also auch dann, wenn Belege
  gelöscht werden — bei verkleinerten Fotos (typisch 100–400 KB) ist das über Jahre unkritisch.
- Bei sehr vielen Rechnungen könnte `localStorage` (i.d.R. ~5–10 MB) irgendwann eng werden; die
  Textdaten pro Rechnung sind aber klein, das reicht für tausende Einträge.
