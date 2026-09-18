---
name: sicherheits-check
description: 'Prüft ein Projekt auf die fünf Fehlermuster KI-gestützter Entwicklung — Zugangsdaten im Code, erfundene Abhängigkeiten, unsichere Voreinstellungen, ungeprüfte Auslieferung, fehlende Sicherheits-Header. Führt je Projekt eine Historie über gefundene und behobene Befunde. Trigger; "sicherheitscheck", "/sicherheits-check", "prüf die sicherheit", "security check", "ist das sicher". Läuft außerdem automatisch bei JEDER weitermachen.md und beim Anlegen eines neuen Projekts. Sicherheit hat Vorrang vor normalen Aufgaben.'
---

# Sicherheits-Check

Grundlage sind fünf Fehlermuster, die bei KI-gestützter Entwicklung besonders häufig auftreten. Dieser Skill prüft sie automatisch, statt sich darauf zu
verlassen, dass jemand daran denkt — genau das ist laut Studienlage das Hauptrisiko.

---

## Grundregel

**Sicherheit geht vor.** Ein kritischer Befund blockiert das Session-Ende. Er lässt sich
zurückstellen, aber nur mit Begründung, die in der Historie landet. Stilles Übergehen
ist nicht vorgesehen.

---

## Wann der Check läuft

| Auslöser | Umfang |
|---|---|
| **Jede `weitermachen.md`** (aus `/weitermachen-erstellen`, Schritt 3b) | Vollprüfung — verbindlich |
| **Neues Projekt** (aus `/neues-projekt`) | Nulllinie anlegen |
| **Auf Zuruf** („sicherheitscheck") | Vollprüfung |
| **Vor Live-Gang oder Übergabe** | Vollprüfung **plus** Freigabe-Checkliste unten |

---

## Ausführung

```bash
node ~/.claude/werkbank/sicherheit/pruefung.mjs "<PROJEKT_PFAD>"
```

Optionen:

| Option | Wirkung |
|---|---|
| `--json` | Maschinenlesbare Ausgabe |
| `--budget=60` | Zeitbudget in Sekunden, Standard 60 |
| `--live=<url>` | Live-URL erzwingen, sonst aus der weitermachen.md gelesen |
| `--erledigt=<id>` | Befund von Hand als behoben markieren |
| `--zurueckstellen=<id> --grund="..." --wer="..."` | Bewusst zurückstellen, Begründung ist Pflicht |

**Exit-Code:** `0` = kein offener kritischer Befund · `2` = mindestens einer · `1` = Fehler im Prüfer.
Aufrufer blockieren anhand von `2`.

---

## Was geprüft wird

| # | Fehlermuster | Prüfung |
|---|---|---|
| 1 | **Zugangsdaten im Code** | Alle Textdateien des Projekts plus die Commits seit der letzten Prüfung. Erkennt GitHub-, OpenAI-, AWS-, Google- und Slack-Schlüssel, private Schlüssel, JWT, Zugangsdaten in URLs und Zuweisungen wie `api_key = "…"`. Platzhalter werden über eine Wortliste und eine Zufälligkeitsprüfung ausgefiltert |
| 2 | **Erfundene Abhängigkeiten** | Neue Pakete werden gegen registry.npmjs.org geprüft: Existiert das Paket? Wie alt, wie verbreitet? Nicht existent → kritisch. Jünger als 90 Tage **und** unter 1.000 Downloads pro Woche → hoch |
| 3 | **Unsichere Voreinstellungen** | `eval`, `new Function`, `innerHTML` mit Variable, abgeschaltete Zertifikatsprüfung, offenes CORS, MD5/SHA-1, `Math.random()` für Token, Shell-Aufrufe mit eingesetzten Variablen, zusammengesetztes SQL |
| 4 | **Ungeprüfte Auslieferung** | Commits, Dateien und Zeilen seit der letzten Prüfung werden protokolliert. Fehlende Lockdatei, fehlende `.gitignore`, `.env` ohne `.gitignore`-Eintrag, eingecheckte Schlüssel- und Datenbankdateien |
| 5 | **Scheinbare Vollständigkeit** | Nicht automatisierbar → Freigabe-Checkliste unten |

Dazu zwei Betriebsprüfungen: `npm audit` für bekannte Schwachstellen und ein einzelner Abruf der
Live-URL auf die fünf Sicherheits-Header.

---

## Schwellen und Reaktion

| Schwere | Beispiele | Reaktion |
|---|---|---|
| **kritisch** | Zugangsdatum in Datei oder Verlauf, `.env` eingecheckt, nicht existentes Paket, öffentliches Repo mit Geheimnis | **Blockiert das Session-Ende.** |
| **hoch** | Fehlende Lockdatei, verdächtig junges Paket, abgeschaltete TLS-Prüfung, 5 von 5 Headern fehlen, npm-audit kritisch/hoch | Blockiert nicht, steht aber ganz oben in der weitermachen.md und bei jedem `/start`. |
| **mittel / niedrig** | `eval`, `innerHTML`, fehlende `.gitignore`, npm-audit mittel/niedrig | Historie und Ausgabe des Checks |

### Bei einem kritischen Befund

1. Befund im Klartext zeigen — **niemals den gefundenen Wert selbst**, nur maskiert.
2. Über `AskUserQuestion` genau zwei Wege anbieten:
   - **Jetzt beheben** → Anleitung aus dem Feld `rat`, danach erneut prüfen.
   - **Zurückstellen** → Begründung ist Pflicht, wird mit Datum und Name gespeichert.
3. Erst danach läuft `/weitermachen-erstellen` weiter.

Bei einem Zugangsdatum gilt immer: **erst widerrufen und rotieren, dann aufräumen.** Ein Wert,
der einmal im Repository stand, ist kompromittiert — auch nach dem Löschen, weil er im Verlauf bleibt.

---

## Commit-Sperre — der Fehler, der sich nicht zurücknehmen lässt

Alles andere kann man nachträglich beheben. Ein Zugangsdatum im Git-Verlauf nicht: Es bleibt
dort, auch wenn der nächste Commit es löscht, und gilt ab dem Moment als kompromittiert.
Deshalb greift hier eine Sperre **vor** dem Commit.

```
~/.claude/git-hooks/pre-commit        globaler Hook, gilt für alle Repositories
sicherheits-check/vor-commit.mjs      die Prüfung selbst
sicherheits-check/gemeinsam.mjs       Muster und Bewertung — geteilt mit pruefung.mjs
```

Eingerichtet mit:

```bash
git config --global core.hooksPath ~/.claude/git-hooks
```

**Geprüft wird nur die Vormerkung**, nicht das ganze Projekt: Zugangsdaten in hinzugefügten
Zeilen und heikle Dateinamen (`.env`, `*.pem`, `id_rsa`, Datenbankdateien). Läuft in
rund 50 Millisekunden, ist also bei jedem Commit tragbar.

Alles Übrige — unsichere Konstrukte, Abhängigkeiten, Header — bleibt beim Session-Ende. Die
Sperre soll schnell sein, nicht vollständig.

### Zwei Fallen, die dabei entstanden sind

**Ein globaler `hooksPath` verdeckt die Hooks im Repository.** Der Dispatcher führt einen
vorhandenen lokalen `pre-commit` deshalb ausdrücklich mit aus — und übernimmt dessen Exit-Code.
Wichtig dabei: `git rev-parse --git-path hooks/pre-commit` folgt selbst dem `hooksPath` und
zeigt dann auf den globalen Hook. Aufgelöst wird deshalb über `--absolute-git-dir`.

**Ein blockierter Commit darf nicht still scheitern.** Das Auto-Backup der Skills
(`scripts/auto-backup.sh`) beendete sich bei einem abgelehnten Commit wortlos — die Skills wären
wochenlang ungesichert geblieben, ohne dass es jemand merkt. Es meldet den Abbruch jetzt.

### Umgehen

`git commit --no-verify` bleibt möglich und soll es auch — eine Sperre, die man nicht umgehen
kann, wird umgangen, indem man sie abschaltet. Aber: **Ein Fehlalarm gehört als Musterkorrektur
nach `muster.json`**, nicht in die Gewohnheit. Wer zweimal `--no-verify` tippt, hat ein
Musterproblem, kein Commit-Problem.

---

## Historie

Je Projekt unter `10_Weitermachen/sicherheit/`:

- **`historie.md`** — wird nur ergänzt, nie gekürzt. Je Lauf: Datum, Dauer, Umfang, neue Befunde,
  behobene, weiterhin offene, zurückgestellte mit Begründung.
- **`befunde.json`** — Maschinenstand. Jeder Befund hat eine **stabile Kennung** aus Typ, Ort und
  Wert-Hash. Derselbe Befund bleibt über Wochen derselbe, statt bei jedem Lauf als neu zu erscheinen.

**In beiden Dateien steht nie ein Geheimnis im Klartext** — nur maskiert (`ghp_…45 (36 Zeichen)`).

Befunde aus dem **Git-Verlauf** und aus der **Registry-Prüfung** schließen sich nicht von selbst:
Der Verlauf wird nur inkrementell geprüft, ein Wert bleibt dort bis zum Umschreiben. Sie bleiben
offen, bis jemand sie mit `--erledigt=<id>` schließt. Paket-Befunde schließen sich automatisch,
sobald das Paket wirklich aus `package.json` verschwunden ist.

### Nichts ist dauerhaft ausgenommen

Ein einmal geschlossener Befund erzeugt **keine** Ausnahme für künftige Läufe. Sonst würden genau
dort Lücken entstehen, wo schon einmal etwas war.

| Fall | Verhalten beim nächsten Lauf |
|---|---|
| **Behoben, taucht wieder auf** | Wird als **Rückfall** gemeldet — eigener Block ganz oben im Bericht und in der Historie, mit dem Datum, an dem er als behoben eingetragen war. Der Status springt zurück auf offen |
| **Zurückgestellt** | Wird weiter bei jedem Lauf geprüft und bleibt im Bericht sichtbar — mit Begründung, Entscheider und Anzahl der Tage. Keine stille Ausnahme |
| **Zurückstellung älter als 30 Tage** | Läuft automatisch ab, der Status geht auf offen zurück, eigener Block „Zurückstellung abgelaufen — muss neu entschieden werden" |
| **Verlaufsbefund als erledigt gemeldet** | Der Git-Verlauf wird beim nächsten Lauf **vollständig** neu gelesen statt nur ab dem letzten Commit. Steht der Wert noch drin, kommt er als Rückfall zurück. `--erledigt` ist damit eine Behauptung, die überprüft wird — keine Tatsache |

Behobene Befunde bleiben deshalb dauerhaft in `befunde.json` stehen. Sie sind das Gedächtnis,
ohne das ein Rückfall nicht erkennbar wäre.


---

## Aus Fehlern lernen — Lektionen im Obsidian-Vault

Ein behobener Befund verschwindet nicht, sondern wird zu Wissen. Sobald ein Befund den Status
`behoben` erreicht, schreibt der Check ihn in den Vault:

```
~/werkbank-vault/60_Sicherheit/
├── 00_Sicherheit-Uebersicht.md   ← Checkliste + Rangliste, automatisch erzeugt
└── Lektionen/
    └── <Titel der Lektion>.md    ← eine Notiz je Befundtyp, nicht je Vorfall
```

**Eine Lektion je Typ, nicht je Vorfall.** Jeder weitere Vorfall hängt eine Zeile an die
Tabelle „Vorfälle" an und zählt den Kopf hoch. So wird aus einem wiederkehrenden Fehler
sichtbar eine Regel — statt eines Archivs von Einzelfällen.

Jede Notiz enthält: was passiert, warum es passiert, eine Vorbeugen-Checkliste und die Tabelle
aller Vorfälle mit **der tatsächlich verwendeten Lösung**. Die Didaktik dazu steht in
`lektionen.json` und ist ohne Code-Änderung erweiterbar.

### Die Lösung gehört dazu

Der Check kennt den generischen Rat, aber nicht, was tatsächlich getan wurde. Deshalb:

```bash
# beim Schließen gleich mitgeben
… --erledigt=<id> --loesung="eval durch JSON.parse ersetzt, Eingabe war ohnehin JSON"

# oder nachträglich, auch für automatisch geschlossene Befunde
… --loesung-fuer=<id> --loesung="…"

# bereits behobene Befunde nachträglich in den Vault schreiben
… --nachtragen
```

Fehlt die Lösung, steht in der Tabelle `_nicht dokumentiert_` und der Check fordert nach jedem
Lauf zum Nachtragen auf. Das ist Absicht: **Ein Befund ohne dokumentierte Lösung lehrt nichts.**

### Vorbeugen — der eigentliche Zweck

```bash
node ~/.claude/werkbank/sicherheit/lernen.mjs --vorbeugen   # Checkliste
node ~/.claude/werkbank/sicherheit/lernen.mjs --liste       # nach Häufigkeit
```

`/neues-projekt` gibt die Checkliste **vor dem ersten Commit** aus. Damit kommen die Lehren aus
allen bisherigen Projekten an, bevor der erste Fehler entstehen kann. Der Vault ist
graphify-indexiert — die Lektionen sind also auch über `/graphify query` auffindbar.

---


## Freigabe-Checkliste (nur vor Live-Gang oder Übergabe)

> Der messbare Teil davon läuft inzwischen automatisch:
> `node ~/.claude/werkbank/freigabe/freigabe.mjs <url> --projekt=<pfad>`
> Die Punkte unten sind das, was keine Automatik prüfen kann.

Diese Punkte kann keine Automatik prüfen. Vor dem Scharfschalten einmal durchgehen:

- [ ] Fehlerbehandlung und Grenzfälle sind umgesetzt, nicht nur der Normalfall
- [ ] Rechteprüfungen sitzen serverseitig, nicht nur in der Oberfläche
- [ ] Zugangsdaten liegen ausschließlich im Geheimnisspeicher der Plattform
- [ ] Das Zielsystem-Konto hat genau ein Recht, nicht alle
- [ ] Ein Mensch gibt frei, bevor etwas sichtbar wird
- [ ] Sicherheits-Header sind gesetzt
- [ ] Sicherung existiert und wurde einmal zurückgespielt
- [ ] Bei Kundenprojekten: externe Prüfung angeboten

---

## Grenze — verbindlich

Geprüft werden **ausschließlich eigene Systeme**. Bei fremden Domains nur das, was ein normaler
Besucher ohnehin abruft: ein einzelner Aufruf der bekannten Adresse, Antwortköpfe lesen.

**Niemals** Pfade abklopfen, Verzeichnisse raten, Anmeldungen durchprobieren oder Schwachstellen
ausprobieren. Ohne schriftliche Beauftragung ist das unzulässig — und es widerspricht dem, was wir
Kunden zusagen. Wer eine echte Prüfung will, bekommt ein Angebot, keinen heimlichen Scan.

---

## Was der Skill nicht leistet

- Kein Ersatz für einen Penetrationstest. Er fängt fünf benannte Muster ab, mehr nicht.
- Keine Garantie auf Vollständigkeit. Ein sauberer Lauf heißt „nichts von dem gefunden, wonach
  gesucht wurde" — nicht „sicher".
- Keine Prüfung von Geschäftslogik, Rechtekonzepten oder Architektur.
- Kein Versand von Code oder Befunden nach außen. Ausgehende Verbindungen gehen nur an
  registry.npmjs.org und die eigene Live-URL.
