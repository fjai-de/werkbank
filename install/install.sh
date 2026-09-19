#!/bin/bash
# Werkbank-Installer fuer macOS.
#
#   bash install.sh                       alles einrichten
#   bash install.sh --ohne-apps           VS Code / Obsidian nicht installieren
#   bash install.sh --helfer <github>     GitHub-Name des Helfers (Standard: fj70)
#   bash install.sh --org <name>          Werkstatt-Organisation auf GitHub (optional)
#   bash install.sh --nur-laden         alle Mac-Programme nur nach install/pakete-mac laden (fuer den Stick)
#   bash install.sh --probe               nur anzeigen, was passieren wuerde
#
# Der Installer bringt KEINE Zugangsdaten mit und fragt keine ab. Angemeldet wird sich danach
# selbst: bei Claude Code mit dem eigenen Konto, bei GitHub mit dem eigenen Konto.
set -u
WERKBANK_REPO="https://github.com/fjai-de/werkbank"
HELFER="fj70"; ORG="fjai-de"; APPS=1; PROBE=0; NURLADEN=0
while [ $# -gt 0 ]; do case "$1" in
  --ohne-apps) APPS=0;; --probe) PROBE=1;; --nur-laden) NURLADEN=1;; --helfer) shift; HELFER="${1:-$HELFER}";; --org) shift; ORG="${1:-}";;
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

# ---------- Programme: erst install/pakete-mac (Stick), sonst direkt vom Hersteller. Kein Homebrew, kein sudo. ----------
# Laeuft damit auch auf aelteren Intel-Macs, auf denen Homebrew alles aus dem Quelltext bauen wuerde.
PAK="$HIER/pakete-mac"; BIN="$HOME/.local/bin"; ZW="${TMPDIR:-/tmp}/werkbank-pakete"
ARCH="$(uname -m)"; [ "$ARCH" = "arm64" ] || ARCH="x86_64"
OSV="$(sw_vers -productVersion)"; OSMAJ="${OSV%%.*}"; OSREST="${OSV#*.}"; OSMIN="${OSREST%%.*}"
UA="werkbank-installer"

gh_datei() { # <repo> <regex> -> URL des juengsten Releases MIT passender Datei
  curl -fsSL -A "$UA" "https://api.github.com/repos/$1/releases?per_page=10" 2>/dev/null | grep -o '"browser_download_url": *"[^"]*"' | cut -d'"' -f4 | grep -E "$2" | head -1; }
node_version() { # <arm64|x86_64> <os-major> <os-minor> -> passende Node-Version fuer dieses macOS
  local filter='$10!="-"'                                   # juengste LTS
  if [ "$2" -lt 11 ]; then filter='$1 ~ /^v20\./'           # macOS 10.15: hoechstens Node 20
  elif [ "$2" -lt 13 ] || { [ "$2" -eq 13 ] && [ "$3" -lt 5 ]; }; then filter='$1 ~ /^v22\./'; fi   # macOS 11–13.4: Node 22
  curl -fsSL "https://nodejs.org/dist/index.tab" 2>/dev/null | awk -F'\t' "NR>1 && $filter {print \$1; exit}"; }
node_url() { local a=x64; [ "$1" = "arm64" ] && a=arm64; echo "https://nodejs.org/dist/$2/node-$2-darwin-$a.tar.gz"; }
paket_url() { # <name> <arch> -> URL
  local a64=amd64 ax=x86_64; [ "$2" = "arm64" ] && a64=arm64 && ax=aarch64
  case "$1" in
    gh)          gh_datei cli/cli "_macOS_${a64}\.zip$";;
    uv)          gh_datei astral-sh/uv "/uv-${ax}-apple-darwin\.tar\.gz$";;
    cloudflared) gh_datei cloudflare/cloudflared "/cloudflared-darwin-${a64}\.tgz$";;
    vscode)      echo "https://update.code.visualstudio.com/latest/darwin-universal/stable";;
    obsidian)    gh_datei obsidianmd/obsidian-releases "/Obsidian-[0-9.]+\.dmg$";;
  esac; }
paket_name() { case "$1" in vscode) echo "VSCode-darwin-universal.zip";; *) basename "$2";; esac; }
hole() { # <url> <dateiname> -> Pfad (aus pakete-mac oder frisch geladen)
  if [ -f "$PAK/$2" ]; then echo "$PAK/$2"; return 0; fi
  mkdir -p "$ZW"; echo "   lade $2 ..." >&2
  curl -fSL --retry 2 -A "$UA" -o "$ZW/$2" "$1" 2>/dev/null && [ "$(wc -c < "$ZW/$2")" -gt 1000000 ] && echo "$ZW/$2"; }
aus_archiv() { # <archiv> <programmname> -> legt das Programm nach ~/.local/bin
  local t; t="$(mktemp -d)"; case "$1" in *.zip) ditto -xk "$1" "$t";; *) tar -xzf "$1" -C "$t";; esac
  local f; f="$(find "$t" -type f -name "$2" | head -1)"; [ -n "$f" ] || return 1
  mkdir -p "$BIN"; cp "$f" "$BIN/$2"; chmod +x "$BIN/$2"
  [ "$2" = "uv" ] && { f="$(find "$t" -type f -name uvx | head -1)"; [ -n "$f" ] && cp "$f" "$BIN/uvx" && chmod +x "$BIN/uvx"; }
  rm -rf "$t"; }

if [ $NURLADEN = 1 ]; then
  schritt "Lade alle Mac-Programme nach $PAK (Intel + Apple Silicon)"
  mkdir -p "$PAK"; cd "$PAK"
  lade1() { [ -n "$1" ] || { echo "${GELB}   ! keine Adresse fuer $2${AUS}"; FEHLER+=("$2"); return; }
    [ -f "$2" ] && { echo "   $2 vorhanden"; return; }; echo "   lade $2 ..."; curl -fSL --retry 2 -A "$UA" -o "$2" "$1" 2>/dev/null || { rm -f "$2"; FEHLER+=("$2"); }; }
  for A in x86_64 arm64; do
    for N in gh uv cloudflared; do U="$(paket_url $N $A)"; lade1 "$U" "$(paket_name $N "$U")"; done
    V="$(node_version $A 99 0)"; lade1 "$(node_url $A "$V")" "$(basename "$(node_url $A "$V")")"
  done
  for OS in "12 0" "10 15"; do V="$(node_version x86_64 $OS)"; lade1 "$(node_url x86_64 "$V")" "$(basename "$(node_url x86_64 "$V")")"; done   # aeltere Intel-Macs
  for N in vscode obsidian; do U="$(paket_url $N x)"; lade1 "$U" "$(paket_name $N "$U")"; done
  ls -lh "$PAK" | awk 'NR>1{print "   "$5"\t"$9}'
  [ ${#FEHLER[@]} -gt 0 ] && { echo "${GELB}Nicht geladen: ${FEHLER[*]}${AUS}"; exit 1; }
  echo "${GRUEN}Alles da.${AUS}"; exit 0
fi

schritt "1/9 Rechner: macOS $OSV, $ARCH"
[ "$OSMAJ" -lt 11 ] && echo "${GELB}   Aelteres macOS: aktuelles VS Code braucht macOS 11, Claude Code laeuft hier evtl. nur ueber npm. Es wird versucht.${AUS}"
mkdir -p "$BIN"; export PATH="$BIN:$HOME/.local/node/bin:$PATH"
if [ $PROBE = 0 ]; then for RC in "$HOME/.zprofile" "$HOME/.bash_profile"; do
  grep -q 'werkbank-pfad' "$RC" 2>/dev/null || printf '\n# werkbank-pfad\nexport PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"\n' >> "$RC"; done; fi

schritt "2/9 Grundwerkzeuge: git, node, gh, uv, cloudflared"
if xcode-select -p >/dev/null 2>&1 && hat git; then echo "   git vorhanden"
elif [ $PROBE = 1 ]; then echo "   [probe] Apple-Entwicklerwerkzeuge (git)"
else
  echo "   git fehlt — Apple fragt gleich in einem Fenster: dort 'Installieren' klicken. Das dauert einige Minuten."
  xcode-select --install >/dev/null 2>&1 || true
  W=0; until xcode-select -p >/dev/null 2>&1 && /usr/bin/git --version >/dev/null 2>&1; do sleep 10; W=$((W+10)); [ $((W % 60)) = 0 ] && echo "   … warte auf die Apple-Werkzeuge (${W}s)"; [ $W -ge 3600 ] && { FEHLER+=("git (Apple-Werkzeuge)"); break; }; done
fi
if hat node; then echo "   node vorhanden"
else V="$(node_version $ARCH $OSMAJ $OSMIN)"; U="$(node_url $ARCH "$V")"
  if [ $PROBE = 1 ]; then echo "   [probe] node $V"; else
    D="$(hole "$U" "$(basename "$U")")" && { rm -rf "$HOME/.local/node"; mkdir -p "$HOME/.local/node"; tar -xzf "$D" -C "$HOME/.local/node" --strip-components 1; }
    hat node && echo "   node $V installiert" || { echo "${GELB}   ! node fehlgeschlagen${AUS}"; FEHLER+=("node"); }; fi
fi
for N in gh uv cloudflared; do
  if hat $N; then echo "   $N vorhanden"; continue; fi
  if [ $PROBE = 1 ]; then echo "   [probe] $N"; continue; fi
  U="$(paket_url $N $ARCH)"; D="$(hole "$U" "$(paket_name $N "$U")")" && aus_archiv "$D" $N && echo "   $N installiert" || { echo "${GELB}   ! $N fehlgeschlagen${AUS}"; FEHLER+=("$N"); }
done

schritt "3/9 Programme: VS Code, Obsidian"
APPZIEL="/Applications"; [ -w "$APPZIEL" ] || { APPZIEL="$HOME/Applications"; mkdir -p "$APPZIEL"; }
if [ $APPS = 0 ]; then echo "   uebersprungen"; else
  if [ -d "/Applications/Visual Studio Code.app" ] || [ -d "$HOME/Applications/Visual Studio Code.app" ]; then echo "   VS Code vorhanden"
  elif [ $PROBE = 1 ]; then echo "   [probe] VS Code"
  else U="$(paket_url vscode x)"; D="$(hole "$U" "$(paket_name vscode "$U")")" && ditto -xk "$D" "$APPZIEL" && echo "   VS Code installiert" || { echo "${GELB}   ! VS Code fehlgeschlagen${AUS}"; FEHLER+=("VS Code"); }; fi
  if [ -d "/Applications/Obsidian.app" ] || [ -d "$HOME/Applications/Obsidian.app" ]; then echo "   Obsidian vorhanden"
  elif [ $PROBE = 1 ]; then echo "   [probe] Obsidian"
  else U="$(paket_url obsidian x)"; D="$(hole "$U" "$(paket_name obsidian "$U")")" && {
      M="$(hdiutil attach -nobrowse -readonly "$D" | awk -F'\t' '/\/Volumes\//{print $NF; exit}')"
      [ -n "$M" ] && cp -R "$M/Obsidian.app" "$APPZIEL/" && echo "   Obsidian installiert"; [ -n "$M" ] && hdiutil detach "$M" -quiet; } || { echo "${GELB}   ! Obsidian fehlgeschlagen${AUS}"; FEHLER+=("Obsidian"); }; fi
fi

schritt "4/9 Claude Code"
export PATH="$HOME/.local/bin:$PATH"
if hat claude; then echo "   vorhanden ($(claude --version 2>/dev/null | head -1))"
else versuch "Claude Code" /bin/bash -c "curl -fsSL https://claude.ai/install.sh | bash"
  hat claude || { echo "   Rueckfall: Installation ueber npm"; FEHLER=("${FEHLER[@]/Claude Code}"); versuch "Claude Code (npm)" npm install -g @anthropic-ai/claude-code; }
fi
CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"; [ -x "$CODE" ] || CODE="$HOME/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"; hat code && CODE="code"
if [ -x "$CODE" ] || hat code; then versuch "VS-Code-Erweiterung" "$CODE" --install-extension anthropic.claude-code --force >/dev/null; fi

schritt "4b Anmelden — jeweils mit dem EIGENEN Konto, der Browser öffnet sich von selbst"
if [ $PROBE = 0 ]; then
  if hat gh; then
    if ! gh auth status >/dev/null 2>&1; then echo "   GitHub: Code kopieren, im Browser einfügen, bestätigen."; gh auth login --hostname github.com --git-protocol https --web || true; fi
    gh auth setup-git >/dev/null 2>&1 || true
    # Git-Absender aus dem GitHub-Konto — niemand muss etwas tippen
    if [ -z "$(git config --global user.name 2>/dev/null)" ]; then
      LOGIN="$(gh api user -q .login 2>/dev/null || true)"
      if [ -n "$LOGIN" ]; then
        git config --global user.name "$(gh api user -q '.name // .login')"
        git config --global user.email "$(gh api user -q '"\(.id)+\(.login)@users.noreply.github.com"')"
        echo "   Git-Absender: $LOGIN"; fi
    fi
    # Einladung in die Organisation annehmen
    if [ -n "$ORG" ]; then
      STAND="$(gh api "user/memberships/orgs/$ORG" -q .state 2>/dev/null || true)"
      if [ "$STAND" = "pending" ]; then
        if gh api -X PATCH "user/memberships/orgs/$ORG" -f state=active >/dev/null 2>&1; then echo "   Einladung in $ORG angenommen"
        else open "https://github.com/orgs/$ORG/invitation"; read -r -p "   Einladung im Browser annehmen, dann Enter " _; fi
      elif [ "$STAND" != "active" ]; then echo "${GELB}   Noch keine Einladung in $ORG — Workshop-Leiter Bescheid geben. Es geht trotzdem weiter.${AUS}"; fi
    fi
  fi
  if hat claude; then
    if claude auth status >/dev/null 2>&1; then echo "   Claude: angemeldet"
    else echo "   Claude: im Browser mit dem eigenen Claude-Konto anmelden."; claude auth login --claudeai || true; fi
  fi
fi

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
if [ $PROBE = 0 ]; then
  mkdir -p "$HOME/Projekte"
  open -a "Visual Studio Code" "$HOME/Projekte" 2>/dev/null || true
fi
echo; echo "${GRUEN}VS Code ist offen. Links das Claude-Symbol anklicken und 'start' schreiben.${AUS}"
