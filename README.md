# Rechnungs-Archiv

Eigenständige Browser-App zum Einlesen und Archivieren von Rechnungen per Foto.
Kein Server, kein Build-Schritt, keine Installation — einfach `index.html` öffnen.

**Live:** https://m4wh8dpzwp-art.github.io/rechnungs-app/ (mobil-optimiert, per
"Zum Home-Bildschirm" auf dem iPhone wie eine App nutzbar)

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

## Technische Details

- Einzelne HTML-Datei (`index.html`) mit eingebettetem CSS/JS — keine Build-Tools nötig.
- Mobile-first Oberfläche mit automatischem Hell-/Dunkelmodus (folgt der Systemeinstellung),
  iOS-Feinheiten berücksichtigt: Safe-Area-Ränder, 16px-Eingabefelder (kein Auto-Zoom in Safari),
  Kamera-Direktaufnahme via `capture="environment"`.
- Excel-Erzeugung läuft komplett im Browser über [SheetJS](https://sheetjs.com/)
  (`lib/xlsx.full.min.js`, lokal mitgeliefert, keine CDN-Abhängigkeit).
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
- Kein Mehrbenutzer-/Cloud-Sync — alles ist lokal im jeweiligen Browser. API-Key und Belegliste
  sind pro Gerät getrennt: auf dem iPhone muss der Key einmal separat eingegeben werden, und
  dort erfasste Belege erscheinen nicht am PC (und umgekehrt).
- Bei sehr vielen Rechnungen könnte `localStorage` (i.d.R. ~5–10 MB) irgendwann eng werden; die
  Textdaten pro Rechnung sind aber klein, das reicht für tausende Einträge.
