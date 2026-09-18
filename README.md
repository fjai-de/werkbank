# Werkbank

Die Arbeitsumgebung von FJ Design für Claude Code — zum Mitnehmen. Ein Installer richtet einen
Mac oder Windows-PC so ein, dass man damit arbeitet wie an der Original-Werkbank: VS Code mit
Claude Code, dieselben Skills, dieselben Sicherheitsnetze.

**Was nicht mitkommt: Zugangsdaten.** Dieses Repository enthält keinen Schlüssel, kein Passwort,
keine interne Adresse. Jede Person meldet sich mit ihrem eigenen Claude-Konto und ihrem eigenen
GitHub-Konto an.

## Installieren

**Mac** — Terminal öffnen:

```bash
git clone https://github.com/fj-design-ai/werkbank ~/werkbank && bash ~/werkbank/install/install.sh
```

(Ohne Git: ZIP von GitHub laden, entpacken, `bash install/install.sh` im Ordner.)

**Windows 10/11** — PowerShell öffnen:

```powershell
git clone https://github.com/fj-design-ai/werkbank $HOME\werkbank; powershell -ExecutionPolicy Bypass -File $HOME\werkbank\install\install.ps1
```

(Ohne Git: ZIP laden, entpacken, `powershell -ExecutionPolicy Bypass -File install\install.ps1`.)

Der Installer lässt sich beliebig oft wiederholen. `--probe` bzw. `-Probe` zeigt nur, was passieren würde.

## Was eingerichtet wird

| Schritt | Inhalt |
|---|---|
| Werkzeuge | Git, Node, GitHub CLI, uv · VS Code, Obsidian · Claude Code + VS-Code-Erweiterung |
| Plugin `werkbank` | 16 Skills: `start`, `weitermachen-erstellen`, `idee`, `roast`, `think`, `chain`, `check`, `feature-dev`, `projekt-analyse`, `neues-projekt`, `preview`, `caveman`, `sicherheits-check`, `freigabe-check`, `hilfe-holen`, `werkbank-update` |
| Hooks | feste Pfade beim Sessionstart · Übergabe bei „machen wir morgen weiter" · Stand sichern vor der Komprimierung |
| Commit-Sperre | globaler `pre-commit`, der Zugangsdaten stoppt, bevor sie im Verlauf landen |
| MCP-Server | Playwright (Browser), Context7 (aktuelle Doku) — beide ohne Schlüssel |
| Fremde Skills | graphify, Obsidian, defuddle, pdf/xlsx/pptx, impeccable, playwright-cli, skill-vetter … — direkt von der Originalquelle, Liste in `install/fremd-skills.txt` |
| `~/.claude/CLAUDE.md` | ein markierter Block mit den Arbeitsregeln; vorhandener Inhalt bleibt |
| `~/werkbank-vault` | leerer Obsidian-Vault, in den der Sicherheits-Check seine Lektionen schreibt |

Vollständige Liste mit Begründung: [docs/WERKZEUGLISTE.md](docs/WERKZEUGLISTE.md)

## Später nachinstallieren

```bash
claude plugin marketplace update fj-werkbank
claude plugin install ki-server@fj-werkbank
```

Oder in Claude Code einfach „werkbank aktualisieren" schreiben.

## Wieder entfernen

```bash
claude plugin uninstall werkbank@fj-werkbank && claude plugin marketplace remove fj-werkbank
git config --global --unset core.hooksPath
```

Den Block zwischen `WERKBANK:ANFANG` und `WERKBANK:ENDE` aus `~/.claude/CLAUDE.md` löschen, `~/.claude/werkbank` löschen.

## Aufbau

```
.claude-plugin/marketplace.json   Katalog „fj-werkbank"
plugins/werkbank/                 Kernpaket
plugins/ki-server/                Zusatzpaket: Warteschlange des KI-Servers (Client)
ki-warteschlange/                 Server dazu — läuft nur beim Betreiber
install/                          install.sh · install.ps1 · fremd-skills.txt · CLAUDE-block.md
docs/                             Werkzeugliste, Workshop-Ablauf
```
