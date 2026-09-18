---
name: 'chain'
description: 'Zerlegt eine komplexe Aufgabe in klar getrennte Schritte und arbeitet diese nacheinander ab — ohne zu mixen. Trigger: "chain", "schritt für schritt", "arbeite das ab", "zerlege die aufgabe", "mach das nacheinander". Verwenden bei größeren Aufgaben mit mehreren Teilbereichen die nicht gleichzeitig angegangen werden sollen.'
---

# Aufgaben-Chain
Komplexe Aufgaben werden in einzelne, abgeschlossene Schritte zerlegt. Jeder Schritt wird vollständig abgeschlossen bevor der nächste startet. Kein Mischen von Aufgaben.

## Chain-Prinzipien

1. **Ein Schritt = eine Sache** — nie zwei Dinge gleichzeitig ändern
2. **Erst fertig, dann weiter** — kein "und nebenbei noch..."
3. **Bestätigung bei kritischen Schritten** — kurz fragen bevor etwas Irreversibles passiert
4. **Fortschritt sichtbar machen** — immer zeigen wo wir stehen

---

## Chain-Ablauf

### Phase 1: Aufgabe analysieren
Alle Teilaufgaben identifizieren und in die richtige Reihenfolge bringen.

Format:
```
Chain erkannt: [Aufgabenname]
Schritte:
□ 1. [Schritt]
□ 2. [Schritt]
□ 3. [Schritt]
```

### Phase 2: Schritt für Schritt abarbeiten
Pro Schritt:
1. Ankündigen: **Schritt X/Y: [Name]**
2. Ausführen
3. Ergebnis zeigen
4. Abhaken: **✓ Schritt X abgeschlossen**
5. Kurze Pause wenn User-Input nötig

### Phase 3: Abschluss
```
✓ Chain abgeschlossen: [Aufgabenname]
Alle X Schritte erledigt.
```

---

## Wann unterbrechen?
- Wenn ein Schritt einen Fehler produziert → stoppen, erklären, Entscheidung abwarten
- Wenn ein Schritt destruktiv ist (Dateien löschen, DB löschen) → kurz bestätigen lassen
- Wenn sich die Anforderungen mitten im Chain ändern → Chain neu planen

---

## Beispiel

**Aufgabe:** "Migriere das Projekt von SQLite auf MySQL und deploye es"

```
Chain erkannt: SQLite → MySQL Migration + Deploy
Schritte:
□ 1. package.json: better-sqlite3 → mysql2 tauschen
□ 2. db.ts neu schreiben (Pool + lazy init)
□ 3. db-service.ts alle Funktionen async machen
□ 4. API Routes: await hinzufügen
□ 5. Dockerfile anpassen
□ 6. package-lock.json neu generieren + committen
□ 7. Deploy-Ziel vorbereiten: Datenbank anlegen, Env-Variablen eintragen
□ 8. Deploy + testen
```
Jeder Schritt wird einzeln abgearbeitet und bestätigt.
