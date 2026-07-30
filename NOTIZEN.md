# Projektstatus — Rechnungs-App

Interne Arbeitsnotiz zum Wiedereinstieg. Die Nutzer-Dokumentation steht in [README.md](README.md);
hier steht nur, was dort **nicht** drinsteht: Architekturentscheidungen, offene Punkte,
Eigenheiten der Testumgebung.

Stand: 30.07.2026, Commit `24d2801`

---

## Überblick

Browser-App zum Erfassen, Archivieren und Auswerten von Rechnungen per Foto/PDF mit Claude Vision.
Rein client-seitig, kein Backend, kein Build-Schritt.

| | |
|---|---|
| Arbeitsverzeichnis | `~/rechnungs-app` (Windows-PC) |
| Live | https://m4wh8dpzwp-art.github.io/rechnungs-app/ |
| Code-Repo (öffentlich) | `m4wh8dpzwp-art/rechnungs-app`, GitHub Pages aus `main` / Root |
| Daten-Repo | privates Repo desselben Kontos; der Name steht in den Sync-Einstellungen der App |
| Hauptgerät | iPhone / Safari, zusätzlich Windows-PC |

## Dateien

```
index.html              Komplette App (Markup + CSS + JS in einer Datei, ~113 KB)
README.md               Nutzer-Dokumentation
NOTIZEN.md              Diese Datei
sw.js                   Service Worker — Offline-Start
manifest.webmanifest    Web-App-Manifest (Home-Bildschirm, standalone)
icons/                  icon-192.png, icon-512.png, apple-touch-icon.png (180px)
lib/xlsx.full.min.js    SheetJS 0.20.3 — Excel
lib/pdf-lib.min.js      pdf-lib 1.17.1 — PDF erzeugen und zusammenführen, UMD-Global `PDFLib`
Photo_Achive/           Leer, nicht versioniert (lokaler Archivordner des Nutzers)
```

Die Icons sind generiert, nicht gezeichnet: das Skript dazu steht nicht im Repo, die Form ist
aber trivial nachzubauen (weißer Beleg mit gezacktem unteren Rand auf `--accent`-Grün, Motiv im
Feld 20–80 von 100, damit es die Maskable-Safezone einhält).

Beide Bibliotheken sind bewusst lokal abgelegt statt per CDN — die App soll ohne fremde Hosts
funktionieren. `.gitignore` existiert nicht; versioniert sind nur die vier Dateien oben.

---

## Datenmodell

Ein Datensatz = **eine Rechnung** (nicht eine Steuerzeile). Felder ohne Unterstrich werden
synchronisiert, Felder mit Unterstrich sind rein lokal:

```jsonc
{
  "id": "1785245207053_xz8aux",       // Zeitstempel + Zufall, bestimmt auch die Dateipfade
  "datum": "2026-07-18",
  "lieferant": "Supermarkt Nord",
  "rechnungsnummer": "SN-77",
  "steuerzeilen": [                    // eine Zeile je MwSt-Satz
    { "mwst_satz": 19, "nettobetrag": 84.03, "mwst_betrag": 15.97 },
    { "mwst_satz": 7,  "nettobetrag": 46.73, "mwst_betrag": 3.27 }
  ],
  "nettobetrag": 130.76,               // abgeleitete Spiegelfelder (Summen)
  "mwst_betrag": 19.24,                //   mwst_satz nur bei genau einem Satz, sonst null
  "mwst_satz": null,
  "gesamtbetrag": 150,
  "waehrung": "EUR",                    // normalisiert auf Großschreibung beim Speichern
  "wechselkurs": null,                  // nur bei Fremdwährung gesetzt: 1 waehrung = wechselkurs EUR
  "kategorie": "Privat",
  "notizen": "",
  "belegTyp": "image/jpeg",            // oder application/pdf
  "belegPfad": "belege/<id>.jpg",      // Pfad im Daten-Repo
  "archiveFilename": "…",              // Name für Ordner-/Download-Ablage
  "erfasstAm": "2026-07-18T10:00:00.000Z",

  "_path": "daten/….json",             // lokal: JSON-Datei im Repo
  "_sha": "…",                         // lokal: Blob-sha für Updates
  "_dirty": true                       // lokal: geändert, muss hochgeladen werden
}
```

**Zentrale Entscheidung — warum ein Array statt mehrerer Datensätze:** Mehrere MwSt-Sätze liegen
als `steuerzeilen` *innerhalb* der Rechnung. Die Alternative (ein Datensatz je Steuerzeile mit
gemeinsamer Gruppen-ID) hätte Sync, Belegdatei, Löschen und die Belegzählung überall auf
Gruppierung umbauen müssen. So blieb **eine Datei = eine Rechnung**, und der Sync-Code musste für
das Feature gar nicht angefasst werden.

**Abwärtskompatibilität:** `zeilenVon(beleg)` liefert entweder das Array oder — bei alten Belegen —
genau eine Zeile aus den flachen Feldern. Alles Weitere kennt nur diesen einen Weg. Alte Dateien
werden **nicht** migriert und nicht umgeschrieben.

## Speicherorte

| Was | Wo |
|---|---|
| API-Key, Modell, Sync-Zugang, Belegliste, offene Löschungen | `localStorage` (`rechnungsapp_*`) |
| Originaldateien (Foto/PDF) | `IndexedDB` `rechnungsapp` / Store `belege`, Key = Beleg-ID, Wert `{blob, typ, hochgeladen}` — dient als Upload-Warteschlange **und** Offline-Cache |
| Rechnungsdaten im Repo | `daten/<datum>_<lieferant>_<idsuffix>.json` |
| Originalbelege im Repo | `belege/<id>.<jpg\|pdf>` |

## Sync — Ablauf in `syncNow()`

1. Tree holen (`/git/trees/HEAD?recursive=1`)
2. Offene Löschungen (`pendingDeletes`) nachziehen
3. **1b** Noch nicht hochgeladene Belegdateien übertragen — **vor** dem JSON, damit `belegPfad`
   nie ins Leere zeigt; setzt `_dirty`
4. Neue und `_dirty`-Belege als JSON hochladen
5. Geänderte/fehlende Remote-JSONs nachladen (5 parallel)
6. Lokal entfernen, was remote gelöscht wurde

Merkposten:
- Eine Datei pro Rechnung → keine Konflikte beim parallelen Erfassen auf zwei Geräten
- Schreiben über Contents-PUT, **Lesen von Binärdateien über die Blobs-API** (Contents-API liefert
  Inhalte nur bis 1 MB)
- 409/422 → `sha` neu holen, genau einmal wiederholen
- Fotos vor Upload: max. 1600 px Kante, JPEG q0.8 (senkt auch die Bild-Tokens beim Auslesen)
- Belegdateien werden **nicht** beim Sync heruntergeladen, sondern erst bei Bedarf
  (Belegansicht, Bericht) und dann lokal gecacht
- `syncAgain`-Flag: Änderung während eines laufenden Syncs löst einen Nachlauf aus

**Zwei Absicherungen gegen Datenverlust** (entstanden, weil im Test tatsächlich 5 von 8 Belegen
verschwanden):
- Fehlt beim Abgleich ein Großteil der Belege (`>= max(3, 50 %)`), wird **nichts** gelöscht,
  sondern in der Sync-Leiste gewarnt
- Beim Wechsel auf ein anderes Repo werden `_path`/`_sha`/`belegPfad` zurückgesetzt, sodass alles
  neu hochgeladen statt als gelöscht gewertet wird

## Löschen mit Rückgängig

Der Beleg fliegt sofort aus `invoices` (Liste reagiert unmittelbar), `queueRemoteDelete` läuft
aber erst nach `UNDO_MS` = 8 s. Bis dahin liegt der Datensatz unverändert im `undoStapel`.

Drei Fallstricke, die dabei bedacht sind:

- **Der Sync hätte den Beleg zurückgeholt.** Schritt 3 in `syncNow()` lädt alles nach, was remote
  liegt und lokal fehlt — genau der Zustand während der Frist. Deshalb überspringt der Schritt
  Pfade, für die `undoWartet(path)` gilt.
- **Kein Schwebezustand beim Verlassen.** `pagehide` bestätigt die Löschung sofort, sonst wäre
  der Beleg lokal weg, im Repo aber noch da und käme beim nächsten Abgleich wieder.
- **Zweites Löschen während der Frist** bestätigt zuerst das erste. Es gibt also immer höchstens
  einen offenen Stapel, keinen Verlauf.

Wiederherstellen ist rein lokal: `_path`, `_sha` und die IndexedDB-Datei bleiben unangetastet,
also wird nichts erneut hochgeladen. `loescheMitUndo(records, meldung)` nimmt eine Liste — „Alle
Einträge löschen" geht durch denselben Weg.

Der Toast kann jetzt eine Aktion tragen: `toast(text, { label, fn, dauer })`.

## Offline (Service Worker)

`sw.js`, Cache-Name `rechnungsapp-v1`. Bewusst zweigeteilt:

- **`index.html` zuerst aus dem Netz**, Cache nur als Rückfall. Die ganze App steckt in dieser
  Datei; eine veraltete Kopie aus dem Cache wäre schlimmer als eine Sekunde Wartezeit. Jede
  erfolgreiche Antwort frischt die Offline-Kopie auf — deshalb muss `CACHE` beim Ändern von
  `index.html` **nicht** hochgezählt werden.
- **`lib/` und `icons/` zuerst aus dem Cache.** Ändern sich praktisch nie.
- **Fremde Hosts werden nicht angefasst** (`url.origin !== self.location.origin` → kein
  `respondWith`). Claude- und GitHub-Antworten dürfen nie im Cache landen.

Registriert wird nur unter `https`/`localhost` — im `file://`-Kontext gibt es keine Service
Worker, und ein Fehlversuch hinterlässt nur einen Konsolenfehler, den man später leicht für ein
echtes Live-Problem hält (siehe Testumgebung unten).

**Testen geht nur über HTTP.** `python -m http.server 8765 --bind 127.0.0.1 --directory <repo>`,
dann im Browser `http://localhost:8765/` (nicht `127.0.0.1`, sonst greift die Registrierungs-
bedingung nicht). Offline-Probe: Server abschießen und neu laden — die Seite muss trotzdem
kommen. Achtung, `fetch(..., {cache:'no-store'})` beweist dabei gar nichts, das umgeht nur den
HTTP-Cache und läuft weiterhin durch den Service Worker. Für den Beweis eine **nicht
gecachte** Adresse anfragen; erst deren `TypeError` zeigt, dass wirklich kein Server da ist.

## Fremdwährungen

**Der ursprüngliche Bug:** `fmtMoney` (`Intl.NumberFormat` mit `currency: "EUR"`) war fest verdrahtet
und wurde für **jeden** Betrag benutzt, unabhängig von `inv.waehrung`. Ein Beleg über 15000 HUF
erschien als „15.000,00 €" und floss 1:1 in alle Summen ein — sah aus wie eine (falsche)
automatische Umrechnung, war aber schlicht eine falsche Beschriftung plus ungeprüfte Summierung.
Der Fehler saß ausschließlich in Anzeige/Aggregation, nicht in der Extraktion: Claude liefert
`waehrung` und den Rohbetrag schon immer korrekt, bekommt dafür auch weiterhin **kein**
Wechselkurs-Feld im Tool-Schema — der Kurs kommt bewusst nie von Claude, nur vom Nutzer.

**Kernhelfer** (alle nahe `fmtMoney`/`fmtMoneyShort`):
- `waehrungCode(inv)` — normalisiert auf Großschreibung/trim, Rückfall auf "EUR". Case-insensitiv,
  damit auch älteste oder von Hand kleingeschriebene Werte (`"chf"`) korrekt als Fremdwährung
  erkannt werden.
- `istFremdwaehrung(inv)` — `waehrungCode(inv) !== "EUR"`.
- `kursGueltig(inv)` — `wechselkurs` ist eine endliche Zahl `> 0`.
- `formatBetrag(betrag, inv)` — Originalbetrag, **niemals umgerechnet**: bei Fremdwährung
  `"15.000,00 HUF"`, sonst normales `fmtMoney`.
- `eurWert(betrag, inv)` — EUR-Äquivalent für Summen. Liefert **`null`**, nicht `0`, wenn
  Fremdwährung ohne gültigen Kurs vorliegt — der Unterschied ist zentral: Aufrufer müssen `null`
  explizit behandeln (zählen als „offen", nicht mitsummieren), ein 0 hätte sich unbemerkt in jede
  Summe eingeschlichen.
- Konvention: `wechselkurs` = wie viele EUR entspricht 1 Einheit der Fremdwährung (also
  `eur = betrag * wechselkurs`) — direkt multiplizierbar, keine Division, keine Richtungsverwechslung.

**Wo `eurWert()` überall greift:** Stat-Leiste, Auswertung nach Kategorie, Auswertung nach
MwSt-Satz, Bericht-Info-Zeile, `berichtExcel`-Auswertungsblatt, Excel-Spalte „Gesamt (EUR)".
Jede dieser Stellen zählt zusätzlich mit, wie viele Belege/Zeilen ausgeschlossen wurden, und
zeigt deren **Originalsumme je Währungscode** an (z.B. „2 Belege ohne Kurs (15.000 HUF, 30 USD)"),
damit nie nur "irgendwas fehlt" angezeigt wird, sondern was genau.

**Kurs eintragen — zwei Stellen, ein Datenfeld:**
- Prüfformular (`f_kursFeld`, nur sichtbar bei Fremdwährung, live per `input`-Event auf
  `f_waehrung`): direkt beim Erfassen, mit Live-Vorschau des EUR-Äquivalents.
- Belegliste (`.fx-input`, ein `<input>` pro fremdwährungs-Beleg, analog zum bestehenden
  `cat-select`-Muster): nachträglich, auch für längst gespeicherte Belege. Reagiert auf `change`
  (nicht `input`), weil jede Änderung ein volles `render()` auslöst — bei `input` würde das
  Eingabefeld bei jedem Tastendruck neu aufgebaut und den Fokus verlieren.
- Klick-Guard ergänzt: Der Listen-Klick-Handler, der die Belegansicht öffnet, ignoriert jetzt auch
  `input`-Elemente (vorher nur `select`/`button`) — sonst hätte ein Tipp ins Kurs-Feld die
  Lightbox aufgerissen.

**Bewusst NICHT gebaut:** automatische Kursabfrage (z.B. via Wechselkurs-API). Der Nutzer wollte
ausdrücklich reine manuelle Eingabe — kein zusätzlicher Netzaufruf, keine Abhängigkeit von einem
weiteren Fremddienst, kein Cache-/Aktualitäts-Problem für Kurse.

---

## Offene Punkte

1. ~~Sync wurde nie echt bestätigt.~~ **Erledigt (29.07.2026).** Der Nutzer hat bestätigt, dass
   die Synchronisierung läuft. Die fehlende Berechtigung *Contents: Read and write* am
   Fine-grained Token war die Ursache und ist nachgetragen. Damit stehen auch die daran
   hängenden Features (Belegdateien, Bericht-PDF) auf bestätigtem Boden.
2. **Automatisierte Sync-Tests laufen weiterhin gegen eine nachgebaute GitHub-API.** Der echte
   Endpunkt ist nur durch den Alltagsgebrauch abgedeckt, nicht durch einen Testlauf. Bei
   Änderungen am Sync also weiter damit rechnen, dass der Mock Abweichungen des echten
   Verhaltens verdeckt (Rate-Limits, sha-Konflikte, große Dateien).
3. ~~Mehrere MwSt-Sätze nie an einem echten Beleg getestet.~~ **Erledigt.** Am Live-Stand vom
   29.07.2026 liegen echte Belege mit korrekt getrennten Sätzen, darunter einer mit vier
   (0 / 3 / 13 / 25 %) und mehrere mit zwei. Auch ausländische Sätze (20 %, 10 %) werden sauber
   übernommen. Offen bleibt nur: Belege ohne erkennbaren Satz landen als „ohne Satz" mit
   MwSt-Betrag > 0 (z.B. 13,05 € ohne Satzangabe) — kosmetisch, aber die Aufschlüsselung nach
   Satz stimmt dann nicht vollständig.
4. **Bestandsbelege haben keine hinterlegte Datei** (vor der Dateisynchronisierung erfasst). Sie
   tragen ein Hinweissymbol; die Datei lässt sich über die Belegansicht nachtragen. Ohne Datei
   erscheinen sie nicht im Bericht-PDF.
5. **iOS: eingebettete PDF-Vorschau** im `<iframe>` ist erfahrungsgemäß eingeschränkt — deshalb
   der Knopf „In neuem Tab öffnen". Auf echtem iPhone nicht verifiziert.
6. **iOS: `navigator.vibrate()` funktioniert nicht.** Die Vibration ist eingebaut, wirkt dort aber
   nicht; spürbar ist nur die Optik (Druckzustände, einfahrende Sheets). Echte Taptic-Rückmeldung
   ginge nur nativ.
7. **Git-Historie wächst monoton** — gelöschte Belegdateien bleiben in der History. Bei
   verkleinerten Fotos (100–400 KB) über Jahre unkritisch.
8. **Kategorien sind fest** auf Mechatronik / Pension / Privat / HW; die Anlege- und
   Verwaltungsoberfläche wurde bewusst entfernt. Altwerte in bestehenden Belegen bleiben sichtbar
   und auswählbar, bis sie umgestellt werden.

### Bewertet, aber nicht gebaut: automatischer Belegzuschnitt

Kantenerkennung und Entzerrung wie bei Scanner-Apps wurde eingeschätzt, aber **nicht umgesetzt**.
Empfehlung war gestuft:

- **Stufe 0** (sofort, ohne Code): iOS-Scanner in Notizen/Dateien nutzen und das Ergebnis als PDF
  hochladen — die App nimmt PDFs ja an. Beste Qualität, null Aufwand.
- **Stufe 1** (überschaubar): manueller Zuschnitt mit vier ziehbaren Ecken, Perspektivkorrektur
  über eigene Pixelabbildung. **Kein OpenCV nötig**, hundertprozentig verlässlich.
- **Stufe 2** (groß): automatische Erkennung via OpenCV.js (Canny → Konturen → Viereck) nur als
  Vorbelegung der Ecken. Kostet mehrere MB WASM oder einen Emscripten-Build-Schritt, den das
  Projekt bisher bewusst nicht hat; Zuverlässigkeit bricht bei weißem Beleg auf hellem Tisch und
  bei gewellten Thermobons ein.

Nutzen liegt überwiegend in der Optik des Bericht-PDFs, kaum bei der Auslesegenauigkeit — Claude
liest schräge Belege ohnehin gut.

---

## Testumgebung — Eigenheiten (wichtig!)

Getestet wird in der Browser-Pane mit gemocktem `window.fetch` (Claude + GitHub), meist im
`file://`-Kontext. Dabei sind mehrfach Fehldiagnosen entstanden:

- **`localStorage` überlebt Navigationen im Sandbox nicht zuverlässig** und wird teils aus einem
  Snapshot wiederhergestellt. → Tests müssen **innerhalb einer Seiteninstanz** ablaufen, sonst
  laufen sie gegen den falschen Zustand.
- **`HTMLAnchorElement.prototype.click` überschreiben**, sonst blockiert Chromes
  Mehrfach-Download-Dialog den Testlauf (hat einmal zu einem 30-s-Timeout geführt).
- **Bildkomprimierung braucht ~1 s** — Wartezeiten großzügig ansetzen, sonst ist `current` beim
  Klick auf „Auslesen" noch leer und es passiert scheinbar nichts.
- **Konsolenfehler aus `file://`-Testläufen** tauchen später beim Prüfen der Live-Seite auf; an den
  `file:///C:/...`-Pfaden in der Stacktrace erkennbar. Nicht mit echten Live-Fehlern verwechseln.
- Nach Tests aufräumen: `localStorage.clear()` **und** `indexedDB.deleteDatabase('rechnungsapp')`.

## Arbeitsweise

Pro Änderung: bearbeiten → lokal gegen Mocks testen → Testdaten aufräumen → README anpassen →
auf Secrets prüfen (`grep -nE "github_pat_[A-Za-z0-9_]{10,}|sk-ant-[A-Za-z0-9_-]{15,}"`) →
committen → pushen → Deployment abwarten (`curl` gegen die Live-URL bis ein Marker des neuen
Stands erscheint, meist 3–5 Versuche à 15 s) → live verifizieren.

Zugangsdaten (Claude-Key, GitHub-Token) trägt **der Nutzer selbst** in der App ein — nie ich.
Für `git push` und Repo-Abfragen sorgt der Credential-Helper des Systems; einen Token muss ich
dafür weder sehen noch irgendwo hinterlegen.

Antworten auf Deutsch.

## Commit-Historie

| Commit | Inhalt |
|---|---|
| `24d2801` | Arbeitsnotiz zum Projektstand ins Repo aufnehmen |
| `b989cff` | Löschen mit Rückgängig, Offline-Start als PWA |
| `5139762` | Kategorie vor dem Auslesen wählbar, griffigere Bedienung |
| `3467cdf` | Mehrere MwSt-Sätze pro Rechnung |
| `b3be582` | Belegdateien synchronisieren, Belegansicht, PDF-Belege, Bericht |
| `cdbf056` | Kategorisierung mit Auswertung nach Monat und Jahr |
| `0cb7eb8` | Sync: echte Ursachendiagnose bei 404 |
| `7e88ec8` | Sync: aussagekräftigere 404-Meldung, Autokorrektur aus |
| `77990bf` | Optionale Geräte-Synchronisierung über privates GitHub-Repo |
| `5b753eb` | UI-Überarbeitung: Einstellungen ins Bottom-Sheet, mobile-first |
| `55a8a2d` | Erstversion |
