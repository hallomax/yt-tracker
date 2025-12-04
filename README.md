# YT Tracker 📱

Eine minimalistische Progressive Web App zum Tracken neuer YouTube-Videos von deinen Lieblingskanälen.

**Kein API Key erforderlich!**

## Features

- 📺 **Kanäle verwalten** - Hinzufügen/Entfernen von YouTube-Kanälen
- 🆕 **Neue Videos** - Zeigt ungesehene Videos
- ✅ **Gesehen markieren** - Videos als gesehen markieren
- 📅 **Datumsfilter** - Nur Videos ab einem bestimmten Datum
- 📱 **PWA** - Installierbar auf Handy & Desktop
- 🔌 **Offline** - Gecachte Videos bleiben verfügbar

## Installation

### Desktop (Chrome/Edge)

1. Öffne die App im Browser
2. Klicke auf das **Installieren**-Symbol in der Adressleiste
3. Fertig!

### iPhone/iPad (Safari)

1. Öffne die App in Safari
2. Tippe auf **Teilen** (📤)
3. Wähle **"Zum Home-Bildschirm"**
4. Fertig!

### Android (Chrome)

1. Öffne die App in Chrome
2. Tippe auf die **drei Punkte** (⋮)
3. Wähle **"App installieren"**
4. Fertig!

## Lokaler Server starten

```bash
cd youtube_app
python3 -m http.server 8080
```

Dann öffne `http://localhost:8080`

## Für Handy im Netzwerk

Um die App auf dem Handy zu nutzen (gleiches WLAN):

```bash
# IP-Adresse herausfinden
ifconfig | grep "inet " | grep -v 127.0.0.1

# Server starten
python3 -m http.server 8080 --bind 0.0.0.0
```

Dann öffne `http://DEINE-IP:8080` auf dem Handy.

**Hinweis:** Für die volle PWA-Funktionalität (Installation) brauchst du HTTPS. Für lokale Tests funktioniert HTTP.

## Technologie

- Vanilla JavaScript (keine Frameworks)
- YouTube RSS Feeds (kein API Key)
- Piped API für Kanal-Suche
- LocalStorage für Datenspeicherung
- Service Worker für Offline-Caching

## Dateien

```
youtube_app/
├── index.html      # Haupt-HTML
├── styles.css      # Styling
├── app.js          # Logik
├── sw.js           # Service Worker
├── manifest.json   # PWA Manifest
└── icons/          # App Icons
    ├── icon-192.png
    └── icon-512.png
```

## Datenschutz

- ✅ Keine Anmeldung
- ✅ Keine Tracking
- ✅ Alle Daten lokal im Browser
- ✅ Open Source
