---
name: 'start'
description: 'Session-Start-Ritual — zeigt die Werkbank-Skills, fragt nach dem Projekt, liest die weitermachen.md, frischt den Wissensgraphen auf und nennt den nächsten Schritt. Trigger; der User schreibt nur "start" oder "start <pfad>". Immer als erstes ausführen, wenn eine Session mit "start" beginnt.'
---

# Session Start — Werkbank

Führe die Schritte **nacheinander** aus. Antworte knapp — Ergebnis, offene Punkte, nächster Schritt.

## Schritt 1 — Werkzeuge zeigen (kompakt, eine Tabelle)

| Skill | Auslöser | Zweck |
|---|---|---|
| `start` | "start" | Session beginnen, Projekt laden |
| `idee` | "ich habe eine Idee" | Idee sofort auswerten |
| `roast` / `think` / `chain` / `check` | "roast das", "ist das machbar", "arbeite das ab", "check das" | Kritik → Machbarkeit → Schritte |
| `feature-dev` | "feature bauen" | Feature planen, bauen, dokumentieren |
| `neues-projekt` | "neues Projekt" | Ordner, Git, privates GitHub-Repo, Sicherheits-Nulllinie |
| `projekt-analyse` | "sind wir noch auf Kurs" | Richtung prüfen |
| `preview` | "mobile preview" | Seite im Telefon-Viewport ansehen |
| `sicherheits-check` | "sicherheitscheck" | Zugangsdaten, Abhängigkeiten, unsichere Muster |
| `freigabe-check` | "kann das live" | Vollprüfung vor Veröffentlichung |
| `caveman` | "weniger tokens" | knapper Antwortmodus, spart Tokens |
| `weitermachen-erstellen` | "session beenden" | Übergabe schreiben (mit Sicherheits-Check) |
| `hilfe-holen` | "ich brauche hilfe" | Stand sichern und dem Helfer Zugriff auf das Repo geben |
| `werkbank-update` | "werkbank aktualisieren" | neue Skills nachladen |

Dazu, falls installiert: `graphify` (Wissensgraph), Obsidian-Skills, `defuddle`, `pdf`/`xlsx`/`pptx`,
`playwright-cli`, `impeccable`, `skill-vetter`, `find-skills`.

## Schritt 2 — Session-Journal starten

```bash
node "$HOME/.claude/werkbank/session.mjs" init --start "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Sobald der Projektpfad feststeht: `node "$HOME/.claude/werkbank/session.mjs" set --project "[PFAD]"`.
`weitermachen-erstellen` rechnet daraus am Ende die Session-Dauer.

## Schritt 3 — Arbeitsregeln (intern merken, nicht ausgeben)

- **Zugangsdaten nie in Code, Chat oder Repository.** Nur in `.env` (steht in `.gitignore`) oder in den
  Umgebungsvariablen der Plattform. Taucht ein Schlüssel im Chat auf: darauf hinweisen, dass er rotiert werden muss.
- Nach sinnvollen Arbeitsschritten committen und pushen — so kann auch aus der Ferne geholfen werden.
- Mobile first, kein seitliches Scrollen. Kein KI-Look: keine Emojis in Oberflächen.
- Rückfrage nur bei destruktiven Aktionen, kostenpflichtigen Aufrufen und Veröffentlichungen.
- Vor dem Installieren fremder Skills: `skill-vetter` drüberlaufen lassen.
- Große Recherchen und Log-Analysen an Subagenten geben — hält den Kontext klein und spart Tokens.

## Schritt 4 — Projekt wählen

Wurde ein Pfad mitgegeben (`start /pfad/zum/projekt`), direkt weiter. Sonst in einem Satz fragen:
„Welches Projekt? Pfad angeben — oder `neues Projekt`." Den aktuellen Ordner als Vorschlag nennen,
wenn er nach einem Projekt aussieht (`.git`, `package.json`, `weitermachen.md`).

## Schritt 5 — Stand lesen

1. `[pfad]/weitermachen.md` lesen (auch `10_Weitermachen/weitermachen.md`). Fehlt sie: `CLAUDE.md` oder `README.md`.
2. In **drei Punkten** zusammenfassen: zuletzt gemacht · als Nächstes geplant · offene Probleme.
3. Offene Sicherheitsbefunde (`10_Weitermachen/sicherheit/befunde.json`, Status `offen`, Schwere `kritisch`/`hoch`)
   **zuerst** nennen — Sicherheit steht über normalen Aufgaben.

## Schritt 6 — Wissensgraph

Ist `graphify` installiert (`command -v graphify`) und das Projekt eine echte Codebasis:

- `graphify-out/graph.json` vorhanden → `graphify update "[pfad]"` (nur Code, Sekunden, keine Kosten).
- Nicht vorhanden → einmal anbieten, ihn zu bauen. Nie bei Dumps, Medienordnern oder `node_modules`.

Fragen zur Architektur danach zuerst über den Graphen beantworten statt Dateien einzeln zu lesen — das spart Tokens.

## Schritt 7 — Nächster Schritt

Den **einen** nächsten konkreten Schritt vorschlagen und den passenden Skill dazu nennen.
