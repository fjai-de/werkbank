---
name: 'preview'
description: 'Öffnet eine lokale oder Live-URL im mobilen Viewport und macht einen Screenshot — ohne vorher zu deployen. Trigger: "zeig mobile preview", "wie sieht das auf mobile aus", "preview", "check mobile", "mobile ansicht". Immer verwenden wenn der User eine Seite auf Mobile testen will bevor er deployed.'
---

# Mobile Preview
Nutzt Playwright MCP um eine Seite im Mobile-Viewport zu öffnen und als Screenshot zu zeigen. Kein Deploy nötig.

## Ablauf

### 1. URL ermitteln
- Lokaler Dev-Server: `http://localhost:PORT` (Port aus package.json oder dev-Ausgabe)
- Live-Site: URL direkt vom User

### 2. Browser auf Mobile-Viewport setzen
Playwright MCP — Viewport auf iPhone 14 Pro setzen:
- Breite: 390px
- Höhe: 844px
- User Agent: Mobile

### 3. Seite laden + Screenshot
- Navigiere zur URL
- Warte bis Seite geladen (networkidle)
- Screenshot machen
- Screenshot im Chat zeigen

### 4. Bericht
Nach dem Screenshot kurz melden:
- Sieht die Seite gut aus?
- Gibt es offensichtliche Layout-Probleme (Text zu klein, Overflow, Buttons zu klein)?
- Console-Errors vorhanden?

### 5. Optional: mehrere Viewports
Falls der User verschiedene Geräte testen will:
- **iPhone SE**: 375 × 667
- **iPhone 14 Pro**: 390 × 844
- **Samsung Galaxy**: 412 × 915
- **iPad**: 768 × 1024

---

## Voraussetzung
Playwright MCP muss aktiv sein (`claude mcp list` → playwright: ✓ Connected).  
Falls nicht verbunden: neue Session starten.

## Typischer Aufruf
```
/preview localhost:3000
/preview beispiel.de
/preview localhost:3001 ipad
```
