# Workshop-Ablauf — Einrichtung je Teilnehmer

Richtwert: 20–30 Minuten je Rechner, die meiste Zeit ist Download. Alle gleichzeitig starten lassen.

## Vorher (Workshop-Leiter)

- [ ] Repo `fjai-de/werkbank` ist gepusht (privat)
- [ ] Ordner `werkbank` als ZIP auf zwei USB-Sticks — **der Hauptweg**, weil das Repo privat ist
- [ ] `install/pakete/` ist gefüllt (`pwsh install/install.ps1 -NurLaden`) und mit auf dem Stick
- [ ] Genug Plätze in der Organisation: `bash leiter/einladen.sh fjai-de --stand`
- [ ] Jeder Teilnehmer hat ein **bezahltes Claude-Konto** (Pro oder Max) — vorab per Mail abfragen
- [ ] Jeder hat sein Handy für die Zwei-Faktor-Anmeldung dabei
- [ ] Mac: Teilnehmer kennt sein Rechner-Passwort und darf installieren · Windows: Adminrechte
- [ ] Firmenrechner? Vorher klären, ob Installation erlaubt ist

## Schritt 1 — GitHub-Konto (5 min, jeder selbst)

1. github.com/signup — **eigene** Mailadresse, **eigenes** Passwort, im eigenen Passwortmanager gespeichert
2. Zwei-Faktor-Anmeldung sofort einschalten (Settings → Password and authentication), Wiederherstellungscodes sichern
3. Benutzernamen dem Workshop-Leiter nennen → er lädt ein: `bash leiter/einladen.sh fjai-de <name> …`
4. Einladung annehmen: github.com/orgs/fjai-de/invitation — **vor** dem Installer, sonst installiert er nur lokal

**Der Workshop-Leiter kennt kein Passwort und keinen 2FA-Code.** Zugriff läuft über Repositories, nicht über Konten.

## Schritt 2 — Installer (15 min)

Mac: Doppelklick auf `Werkbank-einrichten-Mac.command` · Windows: Doppelklick auf `Werkbank-einrichten-Windows.cmd` (UAC-Abfragen mit „Ja" bestätigen)
Der Installer fragt die GitHub-Anmeldung selbst ab (Browser). Organisation `fjai-de` ist voreingestellt; ohne Organisation: `--org ""`.

## Schritt 3 — entfällt

Anmeldung bei GitHub und Claude, Git-Absender und Annahme der Einladung erledigt der Installer selbst.
Der Teilnehmer bestätigt nur im Browser. **Reihenfolge wichtig:** GitHub-Konto anlegen → Leiter lädt ein → dann erst Installer starten.

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
