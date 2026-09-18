---
name: 'weitermachen-erstellen'
description: 'Erstellt eine neue weitermachen.md für das aktuelle Projekt, archiviert die alte mit Versionsnummer im .sessions-Ordner, trackt die Session-Dauer und schreibt einen vollständigen Übergabe-Context für den nächsten Agenten. Trigger: "weitermachen.md erstellen", "session beenden", "übergabe erstellen".'
---

# Weitermachen.md Erstellen
Führe alle Schritte **der Reihe nach** aus. Das Ergebnis muss für einen fremden Agenten ohne Kontext verständlich sein.

---

## Schritt 1 — Projekt-Pfad bestimmen

Falls noch nicht bekannt: User fragen.
Falls aus aktiver Session bekannt (`~/.claude/projects/.session_active.json`): direkt verwenden.

---

## Schritt 2 — Session-Journal auslesen (Zeit + Aufgaben)

Das Journal (vom `/start`-Skill angelegt) ist die Quelle für Start-/Endzeit, Dauer, **erledigte
Aufgaben mit Zeit pro Aufgabe** und **offene Aufgaben**. Auslesen über den Node-Helper:

```bash
SESS="$HOME/.claude/werkbank/session.mjs"
node "$SESS" summary
```

Liefert JSON mit: `start`, `end` (= jetzt, der **Endpunkt** dieser Session), `duration`/`durationMin`,
`project`, `projectId`, `projectName`, `done[]` (`taskId, title, minutes, note, pushed`),
`taskMinutes` (Summe der Task-Zeiten), `remainderMin` (Dauer − Task-Zeiten = Overhead),
`openTaskIds[]`.

Werte merken: **START, END, DURATION, PROJECT, projectId, done[], openTaskIds[], remainderMin.**
Fehlt das Journal/`start` (z.B. Session ohne `/start`): END = jetzt, DURATION = unbekannt,
Aufgaben aus dem Chat-Verlauf rekonstruieren.

---

## Schritt 3 — Projekt-Kontext sammeln (parallel)

Lese folgende Quellen gleichzeitig:

1. Vorhandene `weitermachen.md` (falls existiert)
2. Letzte 15 git-Commits: `git -C [PFAD] log --oneline -15`
3. Aktueller Branch: `git -C [PFAD] branch --show-current`
4. Geänderte aber noch nicht committete Dateien: `git -C [PFAD] status --short`
5. `package.json` (falls vorhanden) — für Projektname und Tech-Stack
6. Letzter Deploy-Status falls bekannt

---

## Schritt 3b — Sicherheits-Check (Pflicht, blockierend)

> **Sicherheit geht vor.** Dieser Schritt läuft bei **jeder** weitermachen.md. Er wird nicht
> übersprungen, auch nicht bei kleinen Sessions. Details im Skill `sicherheits-check`.

```bash
node "$HOME/.claude/werkbank/sicherheit/pruefung.mjs" "[PROJEKT_PFAD]" --json
```

Auswertung des Exit-Codes:

- **0** → weiter mit Schritt 4. Ergebnis in einer Zeile vermerken.
- **2** → **abbrechen.** Es gibt mindestens einen offenen kritischen Befund. Die weitermachen.md
  wird **nicht** geschrieben, bevor entschieden ist:

  1. Befund zeigen — Titel, Ort, Kennung, Handlungsempfehlung.
     **Den gefundenen Wert selbst nie ausgeben**, der Prüfer liefert ihn bereits maskiert.
  2. Über `AskUserQuestion` genau zwei Wege anbieten:
     - **Jetzt beheben** → nach der Behebung erneut prüfen, dann weiter.
     - **Zurückstellen** → Begründung ist Pflicht:
       ```bash
       node "$HOME/.claude/werkbank/sicherheit/pruefung.mjs" "[PROJEKT_PFAD]" \
         --zurueckstellen=<KENNUNG> --grund="<Begründung>" --wer="<Name>"
       ```
  3. Bei Zugangsdaten immer zuerst **widerrufen und rotieren**, dann aufräumen. Ein Wert, der
     einmal im Repository stand, gilt als kompromittiert — auch nach dem Löschen.

Offene Befunde ab `hoch` stehen in der neuen weitermachen.md ganz oben.

---

## Schritt 4 — .sessions Ordner vorbereiten

```bash
# Ordner erstellen falls nicht vorhanden
mkdir -p "[PROJEKT_PFAD]/.sessions"

# Nächste Versionsnummer ermitteln (Node statt python3)
node -e "
const fs=require('fs');const dir='[PROJEKT_PFAD]/.sessions';
let v=0;try{for(const f of fs.readdirSync(dir)){const m=f.match(/_v(\d+)_/);if(m)v=Math.max(v,+m[1]);}}catch{}
console.log('v'+String(v+1).padStart(2,'0'));
"
```

---

## Schritt 5 — Alte weitermachen.md archivieren

Falls `[PROJEKT_PFAD]/weitermachen.md` existiert:

```bash
# Datum + Version im Dateinamen
DATUM=$(date +%Y-%m-%d)
VERSION="v[NÄCHSTE_VERSION]"
cp "[PROJEKT_PFAD]/weitermachen.md" "[PROJEKT_PFAD]/.sessions/weitermachen_${VERSION}_${DATUM}.md"
```

---

## Schritt 6 — Neue weitermachen.md generieren

Analysiere den gesammelten Kontext und schreibe eine vollständige, selbsterklärende Datei.

**Inhalt der neuen weitermachen.md:**

```markdown
# Weitermachen — [PROJEKTNAME]

> Erstellt: [DATUM] [UHRZEIT]  
> Session: [START] → [END] ([DURATION])  
> Branch: [BRANCH]  
> Erstellt mit Claude Code

---

## Projektüberblick

[2-3 Sätze: Was ist das Projekt, was ist der Zweck, welche Tech wird verwendet]

---

## Was in dieser Session gemacht wurde

[Aus git log ableiten — gruppiert nach Feature/Fix/Refactor]
- [Commit-Beschreibung was wirklich passiert ist]
- ...

### Erledigte Aufgaben (mit Zeit)

[Aus Journal `done[]` — Titel + Minuten]
- [Task-Titel] — [MIN] min
- ...
- _Overhead (nicht task-gebunden): [REMAINDER] min_

---

## Aktueller Stand

**Zuletzt deployed:** [Branch/Commit]  
**Live URL:** [falls bekannt]  
**Build-Status:** [OK / fehlgeschlagen / ausstehend]

### Was funktioniert
- [Feature 1]
- [Feature 2]

### Was noch nicht funktioniert / offen
- [Problem 1]
- [Problem 2]

---

## Nächste Schritte (Priorität)

1. [Wichtigster nächster Schritt — konkret, umsetzbar]
2. [Zweiter Schritt]
3. [Dritter Schritt]

---

## Wichtige Hinweise für den nächsten Agenten

[Alles was nicht aus dem Code ersichtlich ist:]
- Gotchas, Workarounds, bekannte Bugs die absichtlich ignoriert werden
- ENV-Vars die gesetzt sein müssen
- Abhängigkeiten zu anderen Services
- Was NICHT geändert werden soll und warum

---

## Technische Details

**Stack:** [aus package.json]  
**GitHub Repo:** [remote URL]  
**Lokaler Pfad:** [PROJEKT_PFAD]

---

## Session-Zeiterfassung

| Session | Datum | Start | Ende | Dauer |
|---|---|---|---|---|
| [aus session_log.md, letzte Einträge] |
| Diese Session | [DATUM] | [START] | [END] | [DURATION] |

**Gesamtzeit Projekt:** [aus session_log.md + diese Session]
```

---

## Schritt 7 — session_log.md aktualisieren

Datei: `[PROJEKT_PFAD]/.sessions/session_log.md`

Falls nicht vorhanden: neu anlegen.

```bash
# Node statt python3 — nicht auf jeder Maschine ist python3 da
node -e "
const fs=require('fs');
const log='[PROJEKT_PFAD]/.sessions/session_log.md';
const [datum,start,end,dauer,version]=['[DATUM]','[SESSION_START]','[SESSION_END]','[DURATION]','[VERSION]'];
let total=0,content='';
try{content=fs.readFileSync(log,'utf8');for(const m of content.matchAll(/\| (\d+)h (\d+)min \|/g))total+=(+m[1])*60+(+m[2]);}catch{}
const dm=dauer.match(/(\d+)h (\d+)min/);if(dm)total+=(+dm[1])*60+(+dm[2]);
const line='| '+version+' | '+datum+' | '+start+' | '+end+' | '+dauer+' |\n';
const header='# Session Log\n\n| Version | Datum | Start | Ende | Dauer |\n|---|---|---|---|---|\n';
fs.writeFileSync(log,(content||header)+line);
console.log('Gesamtzeit: '+Math.floor(total/60)+'h '+(total%60)+'min');
"
```

## Schritt 8 — Session-Journal zurücksetzen

**Erst NACH** dem Schreiben der weitermachen.md, sonst geht die Session-Zeit verloren:

```bash
node "$HOME/.claude/werkbank/session.mjs" reset
```

---

## Schritt 9 — Bestätigung ausgeben

```
Session abgeschlossen — [PROJEKTNAME]

Archiviert: .sessions/weitermachen_[VERSION]_[DATUM].md
Neu erstellt: weitermachen.md
Session-Dauer: [DURATION]
Gesamtzeit Projekt: [GESAMT]

Nächste Session: die weitermachen.md lesen und dort weitermachen.
```

---

## Wichtige Regeln für die generierte weitermachen.md

- **Kein Insider-Kontext** — ein Agent der das Projekt nie gesehen hat muss sofort loslegen können
- **Konkrete Pfade** — absolute Pfade wo möglich
- **Keine vagen Formulierungen** — "fast fertig" → "Feature X fehlt noch: [was genau]"
- **Nächste Schritte als Befehle** — nicht "API einbinden" sondern "In `src/lib/api.ts` Funktion `fetchData()` ergänzen"
- **Gotchas explizit** — alles was den nächsten Agenten überraschen würde