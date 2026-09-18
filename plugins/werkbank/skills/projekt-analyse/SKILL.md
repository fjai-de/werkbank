---
name: 'projekt-analyse'
description: 'Analysiert das aktuelle Projekt auf Richtung und Fokus — prüft ob wir uns in Details verlieren, ob der aktuelle Stand mit den Zielen übereinstimmt und ob der nächste Schritt korrekt ist. Trigger: "check ob wir uns verlaufen", "analyse das projekt", "sind wir noch on track", oder automatisch wenn zu viele Kleinstfixes ohne Fortschritt. Auch autonom auslösen wenn >5 Commits ohne Feature-Fortschritt.'
---

# Projekt-Analyse
Vollständiger Projekt-Check. Prüft ob das Projekt noch in die richtige Richtung geht.

---

## Schritt 1 — Projekt-Kontext laden

Lies folgende Dateien (parallel):
- `weitermachen.md` — ursprüngliche Ziele + nächste Schritte
- `CLAUDE.md` — falls vorhanden
- `package.json` — Tech-Stack und Dependencies
- Letzten 10 git-Commits: `git log --oneline -10`
- Aktuelle Branch-Situation: `git branch -a`

---

## Schritt 2 — Ziel vs. Realität

Vergleiche was geplant war mit dem was die letzten Commits zeigen:

**Fragen:**
- Stimmen die Commits mit den Zielen aus `weitermachen.md` überein?
- Gibt es viele "fix", "hotfix", "small change" Commits in Folge? → Detail-Trap
- Wurden Features geschippt oder nur Bugfixes gemacht?
- Ist der User-facing Wert der letzten Woche klar erkennbar?
- Gibt es offene TODOs die seit >3 Sessions nicht angegangen wurden?

---

## Schritt 3 — Technische Schulden prüfen

Kurzer Code-Scan:
- Gibt es `TODO`, `FIXME`, `HACK` Kommentare?
- Gibt es tote Code-Pfade (imports die nie benutzt werden)?
- Gibt es hartcodierte Secrets oder Pfade?
- Ist die Struktur noch clean oder gewachsen?

Nicht jedes Problem muss sofort gefixt werden — nur **blockendes** ansprechen.

---

## Schritt 4 — Aufwand vs. Wirkung

Bewerte die letzten Aktivitäten:

| Aktivität | Aufwand | Wirkung | Urteil |
|---|---|---|---|
| [Commit 1] | [hoch/mittel/niedrig] | [hoch/mittel/niedrig] | [sinnvoll/verschwendet] |

Muster erkennen: Werden zu viele Ressourcen für Details investiert die der User nicht sieht?

---

## Schritt 5 — Empfehlung

```
Projekt-Analyse: [Projektname]
Stand: [Datum]

Ziel-Erreichung: [0-100%] — [ein Satz Begründung]
Fokus-Status: [Im Flow / Detail-Trap / Drift]

Letzte 3 sinnvolle Commits:
• [Commit]
• [Commit]
• [Commit]

[Falls Detail-Trap oder Drift:]
Warnung: [Was genau passiert]
Empfehlung: [Konkrete Umsteuerung]

Nächster strategischer Schritt: [Was als nächstes wirklich wichtig ist]
Skill: [/feature-dev / /check / /chain]
```

---

## Wann autonom auslösen

Ohne explizite Anfrage prüfen und **leise warnen** (kein voller Report, nur Hinweis) wenn:
- 5 aufeinanderfolgende Commits enthalten nur "fix" oder "update" ohne Feature-Bezug
- Dieselbe Datei wird in >3 aufeinanderfolgenden Commits geändert
- `weitermachen.md` wurde seit >5 Sessions nicht aktualisiert

Hinweis-Format:
```
Projekt-Check: Ich sehe viele Kleinstfixes in Folge. Kurze Analyse? → /projekt-analyse
```