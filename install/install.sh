#!/bin/bash
# Werkbank-Installer fuer macOS.
#
#   bash install.sh                       alles einrichten
#   bash install.sh --ohne-apps           VS Code / Obsidian nicht installieren
#   bash install.sh --helfer <github>     GitHub-Name des Helfers (Standard: fj70)
#   bash install.sh --org <name>          Werkstatt-Organisation auf GitHub (optional)
#   bash install.sh --probe               nur anzeigen, was passieren wuerde
#
# Der Installer bringt KEINE Zugangsdaten mit und fragt keine ab. Angemeldet wird sich danach
# selbst: bei Claude Code mit dem eigenen Konto, bei GitHub mit dem eigenen Konto.
set -u
WERKBANK_REPO="https://github.com/fjai-de/werkbank"
HELFER="fj70"; ORG="fjai-de"; APPS=1; PROBE=0
while [ $# -gt 0 ]; do case "$1" in
  --ohne-apps) APPS=0;; --probe) PROBE=1;; --helfer) shift; HELFER="${1:-$HELFER}";; --org) shift; ORG="${1:-}";;
  *) echo "Unbekannte Option: $1"; exit 1;; esac; shift; done

HIER="$(cd "$(dirname "$0")" && pwd)"
ROT=$'\033[31m'; GRUEN=$'\033[32m'; GELB=$'\033[33m'; AUS=$'\033[0m'
FEHLER=()
schritt() { echo; echo "${GRUEN}== $*${AUS}"; }
tu() { if [ $PROBE = 1 ]; then echo "   [probe] $*"; else "$@"; fi; }
versuch() { local was="$1"; shift; if [ $PROBE = 1 ]; then echo "   [probe] $*"; return 0; fi
  if "$@"; then return 0; else echo "${GELB}   ! $was fehlgeschlagen — mache weiter${AUS}"; FEHLER+=("$was"); return 1; fi; }
hat() { command -v "$1" >/dev/null 2>&1; }

[ "$(uname)" = "Darwin" ] || { echo "Dieses Skript ist fuer macOS. Windows: install.ps1"; exit 1; }

schritt "1/9 Homebrew"
if ! hat brew; then
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
  [ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
fi
if ! hat brew; then
  echo "   Homebrew fehlt — wird installiert (fragt nach dem Mac-Passwort)."
  tu /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
  [ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
  if [ $PROBE = 0 ] && ! grep -q 'brew shellenv' "$HOME/.zprofile" 2>/dev/null; then
    echo 'eval "$('"$(command -v brew)"' shellenv)"' >> "$HOME/.zprofile"; fi
else echo "   vorhanden"; fi

schritt "2/9 Grundwerkzeuge: git, node, gh, uv"
for p in git node gh uv; do hat "$p" && echo "   $p vorhanden" || versuch "brew install $p" brew install "$p"; done

schritt "3/9 Programme: VS Code, Obsidian"
if [ $APPS = 1 ]; then
  [ -d "/Applications/Visual Studio Code.app" ] && echo "   VS Code vorhanden" || versuch "VS Code" brew install --cask visual-studio-code
  [ -d "/Applications/Obsidian.app" ] && echo "   Obsidian vorhanden" || versuch "Obsidian" brew install --cask obsidian
else echo "   uebersprungen"; fi

schritt "4/9 Claude Code"
export PATH="$HOME/.local/bin:$PATH"
if hat claude; then echo "   vorhanden ($(claude --version 2>/dev/null | head -1))"
else versuch "Claude Code" /bin/bash -c "curl -fsSL https://claude.ai/install.sh | bash"; fi
CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"; hat code && CODE="code"
if [ -x "$CODE" ] || hat code; then versuch "VS-Code-Erweiterung" "$CODE" --install-extension anthropic.claude-code --force >/dev/null; fi

schritt "5/9 Werkbank-Plugin"
QUELLE="$WERKBANK_REPO"
# Das Repo ist privat: Zugriff hat nur, wer eingeladen ist UND bei GitHub angemeldet ist.
if [ $PROBE = 0 ] && ! git ls-remote "$WERKBANK_REPO" >/dev/null 2>&1 && hat gh; then
  if ! gh auth status >/dev/null 2>&1; then
    echo "   Das Werkbank-Repo ist privat — bitte jetzt mit dem EIGENEN GitHub-Konto anmelden."
    gh auth login --hostname github.com --git-protocol https --web || true
  fi
  gh auth setup-git >/dev/null 2>&1 || true
fi
if ! git ls-remote "$WERKBANK_REPO" >/dev/null 2>&1; then
  if [ -f "$HIER/../.claude-plugin/marketplace.json" ]; then QUELLE="$(cd "$HIER/.." && pwd)"
    echo "${GELB}   Repo nicht erreichbar (Einladung schon angenommen?) — installiere aus dem lokalen Ordner. Umstellen spaeter: \"werkbank aktualisieren\".${AUS}"
  else echo "${ROT}   Weder Repo noch lokaler Ordner gefunden.${AUS}"; FEHLER+=("Plugin-Quelle"); fi
fi
echo "   Quelle: $QUELLE"
versuch "Marketplace" claude plugin marketplace add "$QUELLE"
versuch "Plugin werkbank" claude plugin install werkbank@fj-werkbank

schritt "6/9 Feste Pfade, Helfer, Commit-Sperre"
WB="$HOME/.claude/werkbank"; tu mkdir -p "$WB" "$HOME/.claude/git-hooks"
PLUGIN_LOKAL="$HIER/../plugins/werkbank"
if [ $PROBE = 0 ]; then
  [ -f "$PLUGIN_LOKAL/scripts/bootstrap.mjs" ] && CLAUDE_PLUGIN_ROOT="$PLUGIN_LOKAL" node "$PLUGIN_LOKAL/scripts/bootstrap.mjs"
  [ -f "$WB/werkbank.json" ] || printf '{\n  "helfer_github": "%s",\n  "github_org": "%s"\n}\n' "$HELFER" "$ORG" > "$WB/werkbank.json"
  if [ -f "$WB/sicherheit/hooks/pre-commit" ]; then
    cp "$WB/sicherheit/hooks/pre-commit" "$HOME/.claude/git-hooks/pre-commit"; chmod +x "$HOME/.claude/git-hooks/pre-commit"
    VORHER="$(git config --global core.hooksPath 2>/dev/null || true)"
    if [ -z "$VORHER" ]; then git config --global core.hooksPath "$HOME/.claude/git-hooks"; echo "   Commit-Sperre aktiv"
    elif [ "$VORHER" = "$HOME/.claude/git-hooks" ] || [ "$VORHER" = "~/.claude/git-hooks" ]; then echo "   Commit-Sperre war schon aktiv"
    else echo "${GELB}   core.hooksPath zeigt bereits auf $VORHER — nicht ueberschrieben.${AUS}"; FEHLER+=("Commit-Sperre (fremder hooksPath)"); fi
  fi
fi

schritt "7/9 MCP-Server (ohne Schluessel)"
for m in "playwright @playwright/mcp@latest" "context7 @upstash/context7-mcp@latest"; do set -- $m
  if claude mcp get "$1" >/dev/null 2>&1; then echo "   $1 vorhanden"; else versuch "MCP $1" claude mcp add --scope user "$1" -- npx -y "$2"; fi; done

schritt "8/9 graphify und fremde Skills (von der Originalquelle)"
hat graphify || versuch "graphify" uv tool install graphifyy
hat graphify && versuch "graphify-Skill" graphify install --platform claude
cd "$HOME" || exit 1
while read -r quelle skill; do
  case "$quelle" in ''|\#*) continue;; esac
  if [ "$skill" = "*" ]; then versuch "Skills $quelle" npx -y skills add "$quelle" -g -y -a claude-code </dev/null >/dev/null
  else [ -e "$HOME/.claude/skills/$skill" ] && { echo "   $skill vorhanden"; continue; }
    versuch "Skill $skill" npx -y skills add "$quelle" --skill "$skill" -g -y -a claude-code </dev/null >/dev/null && echo "   $skill"; fi
done < "$HIER/fremd-skills.txt"

schritt "9/9 CLAUDE.md und Notiz-Vault"
if [ $PROBE = 0 ]; then
  CM="$HOME/.claude/CLAUDE.md"; touch "$CM"
  if grep -q 'WERKBANK:ANFANG' "$CM"; then
    node -e 'const fs=require("fs");const[c,b]=process.argv.slice(1);fs.writeFileSync(c,fs.readFileSync(c,"utf8").replace(/<!-- WERKBANK:ANFANG[\s\S]*?WERKBANK:ENDE -->\n?/,fs.readFileSync(b,"utf8")))' "$CM" "$HIER/CLAUDE-block.md"
  else [ -s "$CM" ] && echo >> "$CM"; cat "$HIER/CLAUDE-block.md" >> "$CM"; fi
  V="$HOME/werkbank-vault"; mkdir -p "$V/00_Eingang" "$V/10_Projekte" "$V/20_Wissen" "$V/60_Sicherheit"
  [ -f "$V/Start.md" ] || printf '# Werkbank-Vault\n\nIn Obsidian ueber "Ordner als Vault oeffnen" einbinden.\n\n- 00_Eingang — schnelle Notizen\n- 10_Projekte — je Projekt eine Notiz\n- 20_Wissen — was du wiederverwenden willst\n- 60_Sicherheit — Lektionen, die der Sicherheits-Check selbst schreibt\n' > "$V/Start.md"
fi

echo; echo "${GRUEN}Fertig.${AUS}"
[ ${#FEHLER[@]} -gt 0 ] && { echo "${GELB}Nicht geklappt:${AUS}"; printf '   - %s\n' "${FEHLER[@]}"; }
cat <<EOT

Jetzt noch selbst — jede Anmeldung mit dem EIGENEN Konto:
  1. claude            → im Browser mit dem eigenen Claude-Konto anmelden
  2. gh auth login     → GitHub.com · HTTPS · im Browser anmelden
  3. git config --global user.name "Vorname Nachname"
     git config --global user.email "die-github-mailadresse"
  4. VS Code oeffnen, Claude-Symbol anklicken, "start" schreiben
EOT
