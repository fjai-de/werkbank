---
name: 'think'
description: 'Prüft technische und praktische Machbarkeit bevor mit Umsetzung begonnen wird. Trigger: "ist das machbar", "wie würdest du das angehen", "prüf ob das geht", "think", "denk mal nach ob", "lohnt sich das technisch". Immer verwenden bevor ein größeres Feature oder Projekt gestartet wird.'
---

# Machbarkeits-Check
Bevor Code geschrieben wird: Denken. Dieser Skill prüft ob eine Idee technisch und praktisch umsetzbar ist — und wie.

## Think-Struktur

### 1. Was genau soll entstehen?
Formuliere das Ziel in einem Satz. Wenn unklar: nachfragen.

### 2. Technische Machbarkeit
- Welche Technologien/Tools werden gebraucht?
- Gibt es bekannte Blocker oder Limitierungen?
- Existiert das schon (Library, API, Service)?
- Passt es zum Stack, der im Projekt schon eingesetzt wird?

### 3. Aufwand-Schätzung
Grobe Einschätzung in T-Shirt-Größen:
- **XS** — < 1 Stunde
- **S** — halber Tag
- **M** — 1-2 Tage
- **L** — 1 Woche
- **XL** — länger, braucht eigenen Plan

### 4. Alternativen
Gibt es einen einfacheren Weg zum gleichen Ziel? Immer 1-2 Alternativen nennen.

### 5. Risiken & Abhängigkeiten
- Was kann schiefgehen?
- Wovon hängt das ab (externe APIs, Drittanbieter, bestehender Code)?

### 6. Empfehlung
- **Direkt umsetzen** — machbar, klarer Weg
- **Erst planen** — zu groß für direkten Start, Schritt-für-Schritt-Plan erstellen
- **Alternative wählen** — besserer Weg existiert

### 7. Vorgeschlagener Einstieg
Falls "Direkt umsetzen": erster konkreter Schritt.  
Falls "Erst planen": Verweis auf `/neues-projekt` oder Planung starten.

---

## Wichtig
- Keine Annahmen treffen — bei Unklarheit kurz nachfragen
- Stack-Kontext beachten: erst prüfen, womit das Projekt tatsächlich arbeitet (package.json,
  Dockerfile, CI-Konfiguration), und die Empfehlung daran ausrichten
- Bestehende Konventionen des Projekts nicht gegen den Strich bürsten
