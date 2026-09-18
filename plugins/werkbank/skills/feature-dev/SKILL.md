---
name: 'feature-dev'
description: 'Plant, implementiert und dokumentiert ein einzelnes Feature innerhalb eines bestehenden Projekts. Trigger: "feature bauen", "feature-dev", "bau das feature", "implementiere", "füg hinzu". Verwenden wenn klar ist dass etwas gebaut wird und ein detaillierter technischer Plan + Doku für das Team gebraucht wird.'
---

# Feature Development
Für Features die bereits beschlossen sind. Kein Roast, kein "ob" — nur "wie genau" und dann umsetzen.

---

## Phase 1 — Technischer Plan

Bevor Code geschrieben wird: genau verstehen was angefasst wird.

### 1.1 Feature in einem Satz
Was soll nach dem Feature neu möglich sein?

### 1.2 Betroffene Files
Welche bestehenden Files werden geändert?
```
src/lib/db-service.ts       → neue Funktion X
src/app/api/X/route.ts      → neuer Endpoint
src/components/X.tsx        → neue UI-Komponente
```

### 1.3 Neue Files
Welche Files werden neu erstellt?

### 1.4 DB-Änderungen
Braucht das Feature eine Migration?
- Neue Tabelle?
- Neue Spalte?
- Migration-Script nötig?

### 1.5 API-Änderungen
Neue Endpoints? Geänderte Response-Formate?

### 1.6 Abhängigkeiten
Neue Packages? Externe APIs?

---

## Phase 2 — Umsetzung (Chain)

Plan aus Phase 1 als Chain ausführen:

```
Chain: Feature [Name]
□ 1. DB-Migration
□ 2. db-service.ts erweitern
□ 3. API-Route erstellen
□ 4. UI-Komponente bauen
□ 5. In bestehende Seite integrieren
□ 6. Testen
□ 7. Git commit + push
```

Jeden Schritt einzeln abschließen bevor der nächste startet.

---

## Phase 3 — Dokumentation

Nach der Umsetzung: kurze Doku für das Team.

Format (als Kommentar im Code ODER als kurze Zusammenfassung):

```
Feature: [Name]
Gebaut: [Datum]
Was es tut: [1 Satz]
Betroffene Files: [Liste]
DB-Änderung: [ja/nein, was]
Wie man es testet: [1-2 Schritte]
```

**Wo die Doku landet:**
- Kurzer Kommentar am Haupt-File des Features
- Commit-Message erklärt das "Warum"
- Bei größeren Features: Eintrag ins CHANGELOG.md (falls vorhanden)

---

## Abschluss

```
✓ Feature [Name] abgeschlossen
Plan: [X Files, DB: ja/nein] | Umsetzung: [X Schritte] | Doku: ✓
```
