---
name: 'idee'
description: 'Wenn der User "ich habe eine Idee" schreibt — sofort vollständig auswerten mit Roast + Think + Kontext-Check ob die Idee zum aktuellen Projekt passt oder ablenkt. Trigger: "ich habe eine Idee", "Idee:", "neue Idee". Auch mitten in Projekten verwenden.'
---

# Ideen-Auswertung
Wenn der User eine Idee einwirft, **sofort** diese 4 Phasen durchlaufen. Kein "klingt gut!" ohne Analyse.

---

## Phase 1 — KONTEXT: Passt die Idee gerade?

Bevor die Idee bewertet wird: **Ablenkungsprüfung**.

- Arbeiten wir gerade an einem aktiven Projekt?
- Ist die Idee für **dieses Projekt** oder ein neues?
- Würde die Umsetzung jetzt den aktuellen Sprint unterbrechen?

**Urteil:**
- `Im Flow` → Idee passt, sofort auswerten
- `Ablenkung` → Idee notieren, erst nach aktuellem Task evaluieren
- `Pivot` → Idee könnte das aktuelle Projekt ersetzen → bewusste Entscheidung nötig

Bei `Ablenkung`: kurz ansprechen, in `weitermachen.md` notieren und weitermachen.

---

## Phase 2 — ROAST: Ist die Idee sinnvoll?

Ehrliche Kritik, keine leere Begeisterung.

- **Idee in einem Satz** — wie würde ein skeptischer Investor sie beschreiben?
- **Stärken** — max. 2-3 echte Vorteile
- **Schwachstellen** — Markt, Aufwand, Timing, Konkurrenz, Komplexität
- **Dealbreaker** — gibt es einen Punkt der alles zu Fall bringt?
- **Urteil:** `Umsetzen` / `Anpassen` / `Stopp`

→ Bei `Stopp`: Erklärung, fertig. Kein Think, kein Plan.
→ Bei `Anpassen`: Verbesserte Version formulieren, dann weiter.

---

## Phase 3 — THINK: Ist sie machbar?

- **Ziel** — was soll am Ende da stehen?
- **Stack-Fit** — passt es zum Stack, der im Projekt schon da ist?
- **Aufwand** — XS / S / M / L / XL (ehrlich)
- **Abhängigkeiten** — braucht es externe APIs, neue Infra, Migration?
- **Risiken** — was kann konkret schiefgehen?
- **Empfehlung:** `Jetzt bauen` / `Erst planen` / `Zu groß → Teilschritt definieren`

---

## Phase 4 — ENTSCHEIDUNG: Was passiert jetzt?

Klare Handlungsempfehlung:

```
Idee: [Name]
Roast: [Urteil] | Think: [Aufwand] | Kontext: [Im Flow / Ablenkung / Pivot]

Empfehlung: [eine Zeile was jetzt getan werden soll]
Nächster Schritt: [konkret] → [/skill]
```

Bei Ablenkung:
```
Idee notiert in weitermachen.md.
Wir machen weiter mit: [aktueller Task]
```