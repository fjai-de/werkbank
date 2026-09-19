# Werkbank-Installer fuer Windows 10/11.
#
#   powershell -ExecutionPolicy Bypass -File install.ps1
#   ... -OhneApps            VS Code / Obsidian nicht installieren
#   ... -Helfer <github>     GitHub-Name des Helfers (Standard: fj70)
#   ... -Org <name>          Werkstatt-Organisation auf GitHub (optional)
#   ... -NurLaden         alle Programme nur nach install\pakete laden (fuer den USB-Stick; laeuft auch mit pwsh auf dem Mac)
#   ... -Probe               nur anzeigen, was passieren wuerde
#
# Der Installer bringt KEINE Zugangsdaten mit und fragt keine ab.
param([switch]$OhneApps, [switch]$Probe, [switch]$NurLaden, [string]$Helfer = "fj70", [string]$Org = "fjai-de")

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
# ---------- Programme: erst install\pakete (USB-Stick), sonst direkt vom Hersteller laden. Kein winget noetig. ----------
$Pakete = Join-Path $Hier "pakete"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = "SilentlyContinue"   # sonst ist Invoke-WebRequest zehnmal langsamer

function GitHubDatei($Repo, $Muster) {
  # Nicht "latest": manche Releases tragen nur Dateien fuer andere Systeme (Obsidian: nur .apk). Juengstes MIT passender Datei nehmen.
  $liste = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases?per_page=10" -Headers @{ "User-Agent" = "werkbank-installer" }
  foreach ($r in $liste) {
    if ($r.prerelease -or $r.draft) { continue }
    $a = $r.assets | Where-Object { $_.name -match $Muster } | Select-Object -First 1
    if ($a) { return @{ Url = $a.browser_download_url; Name = $a.name } }
  }
  throw "Keine Datei passend zu $Muster in $Repo"
}
function NodeDatei {
  # Erst in eine Variable: Invoke-RestMethod gibt die Liste sonst als EIN Objekt weiter
  $liste = Invoke-RestMethod "https://nodejs.org/dist/index.json"
  $v = ($liste | Where-Object { $_.lts } | Select-Object -First 1).version
  if ($v -notmatch "^v\d+\.\d+\.\d+$") { throw "Node-Version nicht ermittelt: $v" }
  return @{ Url = "https://nodejs.org/dist/$v/node-$v-x64.msi"; Name = "node-$v-x64.msi" }
}
# Name = Kennung, Datei = Muster im Ordner pakete, Quelle = liefert Url+Name, Art = wie installiert wird
$Programme = @(
  @{ Name = "Git";         Befehl = "git";         Datei = "Git-*-64-bit.exe";              Art = "inno"; Quelle = { GitHubDatei "git-for-windows/git" "^Git-[\d.]+-64-bit\.exe$" } },
  @{ Name = "Node";        Befehl = "node";        Datei = "node-v*-x64.msi";               Art = "msi";  Quelle = { NodeDatei } },
  @{ Name = "GitHub CLI";  Befehl = "gh";          Datei = "gh_*_windows_amd64.msi";        Art = "msi";  Quelle = { GitHubDatei "cli/cli" "_windows_amd64\.msi$" } },
  @{ Name = "uv";          Befehl = "uv";          Datei = "uv-x86_64-pc-windows-msvc.zip"; Art = "zip";  Quelle = { GitHubDatei "astral-sh/uv" "^uv-x86_64-pc-windows-msvc\.zip$" } },
  @{ Name = "cloudflared"; Befehl = "cloudflared"; Datei = "cloudflared-windows-amd64.msi"; Art = "msi";  Quelle = { GitHubDatei "cloudflare/cloudflared" "^cloudflared-windows-amd64\.msi$" } },
  @{ Name = "VS Code";     Befehl = "code";        Datei = "VSCodeUserSetup-x64*.exe";      Art = "vscode"; App = $true; Quelle = { @{ Url = "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user"; Name = "VSCodeUserSetup-x64.exe" } } },
  @{ Name = "Obsidian";    Pfad = "$env:LOCALAPPDATA\Programs\Obsidian\Obsidian.exe"; Datei = "Obsidian-*.exe"; Art = "nsis"; App = $true; Quelle = { GitHubDatei "obsidianmd/obsidian-releases" "^Obsidian-[\d.]+\.exe$" } }
)

function HolePaket($P, $Ziel) {
  $da = Get-ChildItem $Pakete -Filter $P.Datei -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($da) { return $da.FullName }
  $q = & $P.Quelle
  New-Item -ItemType Directory -Force -Path $Ziel | Out-Null
  $aus = Join-Path $Ziel $q.Name
  Write-Host "   lade $($q.Name) ..."
  Invoke-WebRequest -Uri $q.Url -OutFile $aus -UseBasicParsing -Headers @{ "User-Agent" = "werkbank-installer" }
  if ((Get-Item $aus).Length -lt 1MB) { throw "Download zu klein: $aus" }
  return $aus
}
function Installiere($P) {
  $datei = HolePaket $P (Join-Path $env:TEMP "werkbank-pakete")
  switch ($P.Art) {
    # Maschinenweite Installer fragen einmal nach Adminrechten (UAC) — der Rest laeuft im eigenen Benutzer
    "msi"    { $pr = Start-Process msiexec.exe -ArgumentList "/i `"$datei`" /qn /norestart" -Verb RunAs -Wait -PassThru; if ($pr.ExitCode -notin 0, 3010) { throw "msiexec Exit $($pr.ExitCode)" } }
    "inno"   { $pr = Start-Process $datei -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP-" -Verb RunAs -Wait -PassThru; if ($pr.ExitCode -ne 0) { throw "Exit $($pr.ExitCode)" } }
    "vscode" { $pr = Start-Process $datei -ArgumentList "/VERYSILENT /NORESTART /MERGETASKS=!runcode,addtopath" -Wait -PassThru; if ($pr.ExitCode -ne 0) { throw "Exit $($pr.ExitCode)" } }
    "nsis"   { $pr = Start-Process $datei -ArgumentList "/S" -Wait -PassThru; if ($pr.ExitCode -ne 0) { throw "Exit $($pr.ExitCode)" } }
    "zip"    { $bin = "$env:USERPROFILE\.local\bin"; New-Item -ItemType Directory -Force -Path $bin | Out-Null
               $tmp = Join-Path $env:TEMP "werkbank-uv"; Expand-Archive $datei $tmp -Force
               Get-ChildItem $tmp -Recurse -Filter *.exe | Copy-Item -Destination $bin -Force
               $u = [Environment]::GetEnvironmentVariable("Path", "User"); if ($u -notlike "*$bin*") { [Environment]::SetEnvironmentVariable("Path", "$u;$bin", "User") } }
  }
  $global:LASTEXITCODE = 0
}

if ($NurLaden) {
  Schritt "Lade alle Programme nach $Pakete"
  New-Item -ItemType Directory -Force -Path $Pakete | Out-Null
  foreach ($P in $Programme) {
    try { $q = & $P.Quelle; $aus = Join-Path $Pakete $q.Name
      if (Test-Path $aus) { Write-Host "   $($q.Name) vorhanden"; continue }
      Get-ChildItem $Pakete -Filter $P.Datei -ErrorAction SilentlyContinue | Remove-Item -Force   # alte Version raus
      Write-Host "   lade $($q.Name) ..."; Invoke-WebRequest -Uri $q.Url -OutFile $aus -UseBasicParsing -Headers @{ "User-Agent" = "werkbank-installer" }
    } catch { Write-Host "   ! $($P.Name): $_" -ForegroundColor Yellow; $Fehler.Add($P.Name) }
  }
  Get-ChildItem $Pakete | Select-Object Name, @{ n = "MB"; e = { [int]($_.Length / 1MB) } } | Format-Table -AutoSize
  if ($Fehler.Count) { Write-Host "Nicht geladen: $($Fehler -join ', ')" -ForegroundColor Yellow } else { Write-Host "Alles da. Ordner 'werkbank' komplett auf den Stick kopieren." -ForegroundColor Green }
  exit 0
}

Schritt "1/7 Programme laden und installieren"
if (Test-Path $Pakete) { Write-Host "   Quelle: Ordner pakete (USB-Stick), fehlendes wird aus dem Netz geladen" } else { Write-Host "   Quelle: direkt vom Hersteller" }
foreach ($P in $Programme) {
  if ($P.App -and $OhneApps) { continue }
  $da = if ($P.Befehl) { Hat $P.Befehl } else { Test-Path $P.Pfad }
  if ($da) { Write-Host "   $($P.Name) vorhanden"; continue }
  if (Versuch $P.Name { Installiere $P }) { if (-not $Probe) { Write-Host "   $($P.Name) installiert" } }
  PfadNeuLaden
}

Schritt "2/7 Claude Code"
if (Hat claude) { Write-Host "   vorhanden" }
else { Versuch "Claude Code" { Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression } | Out-Null; PfadNeuLaden }
if (Hat code) { Versuch "VS-Code-Erweiterung" { code --install-extension anthropic.claude-code --force | Out-Null } | Out-Null }

Schritt "3/7 Werkbank-Plugin"
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

Schritt "4/7 Feste Pfade, Helfer, Commit-Sperre"
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

Schritt "5/7 MCP-Server (ohne Schluessel)"
# Unter Windows muss npx ueber 'cmd /c' gestartet werden, sonst findet Claude Code den Server nicht.
foreach ($m in @(@("playwright", "@playwright/mcp@latest"), @("context7", "@upstash/context7-mcp@latest"))) {
  $n = $m[0]; $p = $m[1]
  if (-not $Probe) { claude mcp get $n 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { Write-Host "   $n vorhanden"; continue } }
  Versuch "MCP $n" { claude mcp add --scope user $n -- cmd /c npx -y $p | Out-Null } | Out-Null
}

Schritt "6/7 graphify und fremde Skills (von der Originalquelle)"
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

Schritt "7/7 CLAUDE.md und Notiz-Vault"
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
