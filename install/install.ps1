# Werkbank-Installer fuer Windows 10/11.
#
#   powershell -ExecutionPolicy Bypass -File install.ps1
#   ... -OhneApps            VS Code / Obsidian nicht installieren
#   ... -Helfer <github>     GitHub-Name des Helfers (Standard: fj70)
#   ... -Org <name>          Werkstatt-Organisation auf GitHub (optional)
#   ... -Probe               nur anzeigen, was passieren wuerde
#
# Der Installer bringt KEINE Zugangsdaten mit und fragt keine ab.
param([switch]$OhneApps, [switch]$Probe, [string]$Helfer = "fj70", [string]$Org = "fjai-de")

$WerkbankRepo = "https://github.com/fjai-de/werkbank"
$Hier = Split-Path -Parent $MyInvocation.MyCommand.Path
$Fehler = New-Object System.Collections.Generic.List[string]

function Schritt($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Green }
function Hat($n) { [bool](Get-Command $n -ErrorAction SilentlyContinue) }
function PfadNeuLaden {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.local\bin"
}
function Versuch([string]$Was, [scriptblock]$Tun) {
  if ($Probe) { Write-Host "   [probe] $Was"; return $true }
  try { & $Tun; if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) { throw "Exit $LASTEXITCODE" }; return $true }
  catch { Write-Host "   ! $Was fehlgeschlagen - mache weiter ($_)" -ForegroundColor Yellow; $Fehler.Add($Was); return $false }
}
function Winget($Id, $Name) {
  Versuch $Name { winget install --id $Id -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
    # winget meldet "bereits installiert" mit einem Exit-Code ungleich 0 — das ist kein Fehler
    if ($LASTEXITCODE -eq -1978335189) { $global:LASTEXITCODE = 0 } } | Out-Null
}

Schritt "1/9 winget"
if (-not (Hat winget)) { Write-Host "winget fehlt. Bitte 'App-Installer' aus dem Microsoft Store installieren und neu starten." -ForegroundColor Red; exit 1 }
Write-Host "   vorhanden"

Schritt "2/9 Grundwerkzeuge: Git, Node, GitHub CLI, uv"
if (-not (Hat git))  { Winget "Git.Git" "Git" }            else { Write-Host "   git vorhanden" }
if (-not (Hat node)) { Winget "OpenJS.NodeJS.LTS" "Node" } else { Write-Host "   node vorhanden" }
if (-not (Hat gh))   { Winget "GitHub.cli" "GitHub CLI" }  else { Write-Host "   gh vorhanden" }
if (-not (Hat uv))   { Winget "astral-sh.uv" "uv" }        else { Write-Host "   uv vorhanden" }
PfadNeuLaden

Schritt "3/9 Programme: VS Code, Obsidian"
if ($OhneApps) { Write-Host "   uebersprungen" } else {
  if (-not (Hat code)) { Winget "Microsoft.VisualStudioCode" "VS Code" } else { Write-Host "   VS Code vorhanden" }
  if (-not (Test-Path "$env:LOCALAPPDATA\Programs\Obsidian\Obsidian.exe")) { Winget "Obsidian.Obsidian" "Obsidian" } else { Write-Host "   Obsidian vorhanden" }
  PfadNeuLaden
}

Schritt "4/9 Claude Code"
if (Hat claude) { Write-Host "   vorhanden" }
else { Versuch "Claude Code" { Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression } | Out-Null; PfadNeuLaden }
if (Hat code) { Versuch "VS-Code-Erweiterung" { code --install-extension anthropic.claude-code --force | Out-Null } | Out-Null }

Schritt "5/9 Werkbank-Plugin"
$Quelle = $WerkbankRepo
if (-not $Probe) {
  git ls-remote $WerkbankRepo 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0 -and (Hat gh)) {
    # Das Repo ist privat: Zugriff hat nur, wer eingeladen ist UND bei GitHub angemeldet ist.
    gh auth status 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "   Das Werkbank-Repo ist privat - bitte jetzt mit dem EIGENEN GitHub-Konto anmelden."; gh auth login --hostname github.com --git-protocol https --web }
    gh auth setup-git 2>$null | Out-Null
    git ls-remote $WerkbankRepo 2>$null | Out-Null
  }
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path "$Hier\..\.claude-plugin\marketplace.json") {
      $Quelle = (Resolve-Path "$Hier\..").Path
      Write-Host "   Repo nicht erreichbar (Einladung schon angenommen?) - installiere aus dem lokalen Ordner. Umstellen spaeter: werkbank aktualisieren." -ForegroundColor Yellow
    } else { Write-Host "   Weder Repo noch lokaler Ordner gefunden." -ForegroundColor Red; $Fehler.Add("Plugin-Quelle") }
  }
}
Write-Host "   Quelle: $Quelle"
Versuch "Marketplace" { claude plugin marketplace add $Quelle } | Out-Null
Versuch "Plugin werkbank" { claude plugin install werkbank@fj-werkbank } | Out-Null

Schritt "6/9 Feste Pfade, Helfer, Commit-Sperre"
$WB = "$env:USERPROFILE\.claude\werkbank"; $Hooks = "$env:USERPROFILE\.claude\git-hooks"
if (-not $Probe) {
  New-Item -ItemType Directory -Force -Path $WB, $Hooks | Out-Null
  $PluginLokal = "$Hier\..\plugins\werkbank"
  if (Test-Path "$PluginLokal\scripts\bootstrap.mjs") { $env:CLAUDE_PLUGIN_ROOT = (Resolve-Path $PluginLokal).Path; node "$PluginLokal\scripts\bootstrap.mjs"; Remove-Item Env:\CLAUDE_PLUGIN_ROOT }
  if (-not (Test-Path "$WB\werkbank.json")) { [IO.File]::WriteAllText("$WB\werkbank.json", "{`n  `"helfer_github`": `"$Helfer`",`n  `"github_org`": `"$Org`"`n}`n") }
  if (Test-Path "$WB\sicherheit\hooks\pre-commit") {
    Copy-Item "$WB\sicherheit\hooks\pre-commit" "$Hooks\pre-commit" -Force
    $Vorher = git config --global core.hooksPath
    if (-not $Vorher) { git config --global core.hooksPath "~/.claude/git-hooks"; Write-Host "   Commit-Sperre aktiv" }
    elseif ($Vorher -like "*\.claude/git-hooks" -or $Vorher -like "*.claude/git-hooks") { Write-Host "   Commit-Sperre war schon aktiv" }
    else { Write-Host "   core.hooksPath zeigt bereits auf $Vorher - nicht ueberschrieben." -ForegroundColor Yellow; $Fehler.Add("Commit-Sperre (fremder hooksPath)") }
  }
}

Schritt "7/9 MCP-Server (ohne Schluessel)"
# Unter Windows muss npx ueber 'cmd /c' gestartet werden, sonst findet Claude Code den Server nicht.
foreach ($m in @(@("playwright", "@playwright/mcp@latest"), @("context7", "@upstash/context7-mcp@latest"))) {
  $n = $m[0]; $p = $m[1]
  if (-not $Probe) { claude mcp get $n 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { Write-Host "   $n vorhanden"; continue } }
  Versuch "MCP $n" { claude mcp add --scope user $n -- cmd /c npx -y $p | Out-Null } | Out-Null
}

Schritt "8/9 graphify und fremde Skills (von der Originalquelle)"
if (-not (Hat graphify)) { Versuch "graphify" { uv tool install graphifyy | Out-Null } | Out-Null; PfadNeuLaden }
if (Hat graphify) { Versuch "graphify-Skill" { graphify install --platform windows | Out-Null } | Out-Null }
Push-Location $env:USERPROFILE
foreach ($zeile in Get-Content "$Hier\fremd-skills.txt") {
  if ($zeile -match '^\s*(#|$)') { continue }
  $teile = $zeile.Trim() -split '\s+'; $q = $teile[0]; $s = $teile[1]
  if ($s -eq "*") { Versuch "Skills $q" { npx -y skills add $q -g -y -a claude-code | Out-Null } | Out-Null }
  elseif (Test-Path "$env:USERPROFILE\.claude\skills\$s") { Write-Host "   $s vorhanden" }
  else { if (Versuch "Skill $s" { npx -y skills add $q --skill $s -g -y -a claude-code --copy | Out-Null }) { Write-Host "   $s" } }
}
Pop-Location

Schritt "9/9 CLAUDE.md und Notiz-Vault"
if (-not $Probe) {
  $CM = "$env:USERPROFILE\.claude\CLAUDE.md"; $Block = [IO.File]::ReadAllText("$Hier\CLAUDE-block.md")
  $Alt = if (Test-Path $CM) { [IO.File]::ReadAllText($CM) } else { "" }
  if ($Alt -match 'WERKBANK:ANFANG') { $Neu = [regex]::Replace($Alt, '(?s)<!-- WERKBANK:ANFANG.*?WERKBANK:ENDE -->\r?\n?', { param($x) $Block }) }
  elseif ($Alt.Trim()) { $Neu = $Alt.TrimEnd() + "`n`n" + $Block } else { $Neu = $Block }
  [IO.File]::WriteAllText($CM, $Neu, (New-Object Text.UTF8Encoding $false))
  $V = "$env:USERPROFILE\werkbank-vault"
  foreach ($o in "00_Eingang", "10_Projekte", "20_Wissen", "60_Sicherheit") { New-Item -ItemType Directory -Force -Path "$V\$o" | Out-Null }
  if (-not (Test-Path "$V\Start.md")) { [IO.File]::WriteAllText("$V\Start.md", "# Werkbank-Vault`n`nIn Obsidian ueber 'Ordner als Vault oeffnen' einbinden.`n") }
}

Write-Host ""; Write-Host "Fertig." -ForegroundColor Green
if ($Fehler.Count -gt 0) { Write-Host "Nicht geklappt:" -ForegroundColor Yellow; $Fehler | ForEach-Object { Write-Host "   - $_" } }
Write-Host @"

Jetzt noch selbst - jede Anmeldung mit dem EIGENEN Konto (neues Terminal oeffnen!):
  1. claude            -> im Browser mit dem eigenen Claude-Konto anmelden
  2. gh auth login     -> GitHub.com / HTTPS / im Browser anmelden
  3. git config --global user.name "Vorname Nachname"
     git config --global user.email "die-github-mailadresse"
  4. VS Code oeffnen, Claude-Symbol anklicken, "start" schreiben
"@
