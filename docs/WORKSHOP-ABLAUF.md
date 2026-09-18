# Workshop-Ablauf — Einrichtung je Teilnehmer

Richtwert: 20–30 Minuten je Rechner, die meiste Zeit ist Download. Alle gleichzeitig starten lassen.

## Vorher (Workshop-Leiter)

- [ ] Repo `werkbank` liegt auf GitHub und ist ohne Anmeldung klonbar
- [ ] Ersatzweg: Ordner `werkbank` als ZIP auf zwei USB-Sticks (WLAN im Raum ist der Engpass)
- [ ] Jeder Teilnehmer hat ein **bezahltes Claude-Konto** (Pro oder Max) — vorab per Mail abfragen
- [ ] Jeder hat sein Handy für die Zwei-Faktor-Anmeldung dabei
- [ ] Mac: Teilnehmer kennt sein Rechner-Passwort und darf installieren · Windows: Adminrechte
- [ ] Firmenrechner? Vorher klären, ob Installation erlaubt ist

## Schritt 1 — GitHub-Konto (5 min, jeder selbst)

1. github.com/signup — **eigene** Mailadresse, **eigenes** Passwort, im eigenen Passwortmanager gespeichert
2. Zwei-Faktor-Anmeldung sofort einschalten (Settings → Password and authentication), Wiederherstellungscodes sichern
3. Benutzernamen dem Workshop-Leiter nennen

**Der Workshop-Leiter kennt kein Passwort und keinen 2FA-Code.** Zugriff läuft über Repositories, nicht über Konten.

## Schritt 2 — Installer (15 min)

Mac: `bash install/install.sh` · Windows: `powershell -ExecutionPolicy Bypass -File install\install.ps1`
Mit Werkstatt-Organisation: `--org <name>` bzw. `-Org <name>` anhängen.

## Schritt 3 — Anmelden (5 min, jeder selbst)

```
claude              eigenes Claude-Konto, im Browser
gh auth login       GitHub.com · HTTPS · Browser
git config --global user.name "…"   /   user.email "…"
```

## Schritt 4 — Funktionsprobe (5 min)

1. VS Code → Claude-Symbol → `start` → Skill-Tabelle erscheint
2. „neues Projekt: testseite" → Ordner, Git, privates Repo entstehen
3. Commit-Sperre zeigen: eine Datei mit einem erfundenen `ghp_…`-Token committen → **wird gestoppt** (guter Aha-Moment)
4. „ich brauche hilfe" → Einladung kommt beim Workshop-Leiter an

## Zugriff aus der Ferne — zwei Wege

| | Weg A: Einladung je Repo | Weg B: Werkstatt-Organisation |
|---|---|---|
| Wie | Teilnehmer schreibt „ich brauche hilfe" → Skill `hilfe-holen` lädt den Helfer als Mitarbeiter ein | Leiter legt eine kostenlose GitHub-Organisation an, lädt alle als Mitglieder ein; `neues-projekt` legt Repos dort an |
| Zugriff des Leiters | nur auf freigegebene Repos, jederzeit entziehbar | automatisch auf alle Repos der Organisation |
| Wem gehören die Repos | dem Teilnehmer | der Organisation (also dem Leiter) |
| Passt für | Teilnehmer, die später eigenständig arbeiten | betreute Gruppen, laufende Begleitung |

Beides geht nebeneinander. Für Live-Hilfe am Bildschirm zusätzlich: VS Code **Live Share** (Erweiterung, Anmeldung mit dem GitHub-Konto).

## Nachher

- Neue Skills: im Repo veröffentlichen, Version in `marketplace.json` erhöhen → Teilnehmer schreiben „werkbank aktualisieren"
- KI-Server: siehe `ki-warteschlange/README.md` — jeder Teilnehmer bekommt einen eigenen Zugangscode
