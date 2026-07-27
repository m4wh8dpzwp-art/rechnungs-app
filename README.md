# Rechnungs-Archiv

Eigenständige Browser-App zum Einlesen und Archivieren von Rechnungen per Foto.
Kein Server, kein Build-Schritt, keine Installation — einfach `index.html` öffnen.

## Funktionsweise

1. Du lädst ein Foto/Scan einer Rechnung hoch (Klick, Drag&Drop oder Kamera auf dem Handy).
2. Das Bild wird direkt aus dem Browser an die Claude-API (Vision) geschickt und ausgewertet:
   Datum, Lieferant, Rechnungsnummer, Netto, MwSt-Satz, MwSt-Betrag, Gesamtbetrag, Währung,
   Kategorie, Notizen.
3. Du prüfst/korrigierst die erkannten Felder in einem Formular.
4. Beim Speichern wird:
   - eine Zeile in die Tabelle "Archiv" eingetragen (persistiert im Browser),
   - das Originalfoto automatisch benannt (`Datum_Lieferant.jpg`) archiviert,
   - die Excel-Datei `rechnungen.xlsx` neu erzeugt/aktualisiert (eine Zeile pro Rechnung).

## Erste Schritte

1. `index.html` im Browser öffnen (am besten Chrome oder Edge, siehe Hinweis unten).
2. Unter "Einstellungen" deinen Claude API-Key eintragen und auf "Key lokal speichern" klicken.
   - Einen Key bekommst du in der [Anthropic Console](https://console.anthropic.com/settings/keys).
   - Der Key wird nur in deinem Browser (`localStorage`) gespeichert und ausschließlich direkt
     an `api.anthropic.com` gesendet. Es gibt keinen Zwischenserver. Da alles client-seitig
     läuft, ist der Key im Browser (z.B. über die Entwicklertools) einsehbar — nutze die App
     daher nur auf deinem eigenen, vertrauenswürdigen Gerät.
3. Optional: "Archivordner wählen" klicken, um einen lokalen Ordner zu verbinden. Dann werden
   Fotos und `rechnungen.xlsx` automatisch dort abgelegt/aktualisiert, ohne dass du jede Datei
   einzeln herunterladen musst.
   - Funktioniert nur in Chromium-Browsern (Chrome, Edge, Brave, Opera) — nutzt die
     [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).
   - In Firefox/Safari nicht verfügbar: Fotos werden dann einzeln über den Download-Ordner
     archiviert, die Excel-Datei über den Button "Excel exportieren" heruntergeladen.
   - Die Ordnerverbindung gilt pro Browser-Sitzung (Tab-Neuladen erfordert erneutes Auswählen).
4. Rechnungsfoto hochladen, "Rechnung analysieren" klicken, Felder prüfen, "Speichern &
   archivieren" klicken.

## Technische Details

- Einzelne HTML-Datei (`index.html`) mit eingebettetem CSS/JS — keine Build-Tools nötig.
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
- Kein Mehrbenutzer-/Cloud-Sync — alles ist lokal im jeweiligen Browser.
- Bei sehr vielen Rechnungen könnte `localStorage` (i.d.R. ~5–10 MB) irgendwann eng werden; die
  Textdaten pro Rechnung sind aber klein, das reicht für tausende Einträge.
