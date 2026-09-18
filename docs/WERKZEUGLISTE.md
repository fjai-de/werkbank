# Werkzeugliste

Was auf die Teilnehmer-Rechner kommt — und was bewusst nicht.

## 1 · Programme

| Werkzeug | Wofür |
|---|---|
| VS Code + Claude-Code-Erweiterung | die Werkbank selbst |
| Claude Code (CLI) | dieselbe Werkbank im Terminal; Plugins, MCP, Updates |
| Git + GitHub CLI (`gh`) | Versionierung, privates Repo, Helfer einladen |
| Node.js | Hooks, Sicherheits-Check, Freigabe-Check, `npx`-MCPs |
| uv | installiert graphify ohne Python-Gebastel |
| Obsidian | Notizen und Wissens-Vault |

## 2 · Eigene Skills (Plugin `werkbank`)

| Skill | Wofür | Gruppe |
|---|---|---|
| `start` | Session beginnen: Projekt laden, Stand in drei Punkten, nächster Schritt | Session |
| `weitermachen-erstellen` | Übergabe schreiben, alte archivieren, Dauer festhalten — **mit blockierendem Sicherheits-Check** | Session |
| `hilfe-holen` | Stand pushen, Helfer auf genau dieses Repo einladen, Frage formulieren | Session |
| `werkbank-update` | neue Skills nachladen | Session |
| `idee` | Idee sofort auswerten: passt sie, taugt sie, machbar? | Denken |
| `roast` | ehrliche Kritik | Denken |
| `think` | Machbarkeit vor dem Bauen | Denken |
| `chain` | große Aufgabe in getrennte Schritte | Denken |
| `check` | Roast → Think → Chain am Stück | Denken |
| `projekt-analyse` | sind wir noch auf Kurs? | Denken |
| `feature-dev` | ein Feature planen, bauen, dokumentieren | Bauen |
| `neues-projekt` | Ordner, Git, `.gitignore`, privates Repo, Nulllinie | Bauen |
| `preview` | Seite im Telefon-Viewport | Bauen |
| `online-stellen` | App baubar machen (Port, Start, Lockdatei, Env-Namen), DEPLOY.md, beim Leiter anmelden | Bauen |
| `sicherheits-check` | Zugangsdaten, erfundene Pakete, unsichere Muster, Header; Historie mit Rückfall-Erkennung | Sicherheit |
| `freigabe-check` | Vollprüfung vor Veröffentlichung (TLS, Header, Pflichtangaben, Ladezeit, Barrierefreiheit, Telefon) | Sicherheit |
| `caveman` | knapper Antwortmodus | Tokens sparen |

Dazu die **Commit-Sperre** (globaler Git-Hook) und drei **Hooks** (Sessionstart, Übergabe, Stand sichern).

## 3 · Fremde Skills (vom Installer direkt bei der Quelle geholt)

| Skill | Quelle | Wofür |
|---|---|---|
| `graphify` | PyPI `graphifyy` | Wissensgraph über Code und Dokumente — Fragen über den Graphen statt Datei für Datei, **größter Token-Sparer** |
| `obsidian-markdown`, `obsidian-bases` | kepano/obsidian-skills | Obsidian-Notizen und -Datenbanken korrekt schreiben |
| `defuddle` | kepano/obsidian-skills | Webseiten als sauberes Markdown lesen — spart Tokens gegenüber rohem HTML |
| `skill-vetter` | useai-pro/openclaw-skills-security | fremde Skills vor der Installation prüfen |
| `find-skills` | vercel-labs/skills | passende Skills finden |
| `pdf`, `xlsx`, `pptx` | anthropics/skills | Dokumente lesen und erzeugen |
| `webapp-testing`, `playwright-cli` | anthropics/skills, microsoft | Web-Apps im Browser testen |
| `impeccable`, `web-design-guidelines` | pbakaus, vercel-labs | Oberflächen gestalten und prüfen |

Nicht mehr verfügbar: `obsidian-vault` (mattpocock/skills) — von der Quelle entfernt, Stand 19.09.2026.

## 4 · MCP-Server

| Server | Wofür | Schlüssel |
|---|---|---|
| Playwright | Browser steuern, Screenshots, `preview` | keiner |
| Context7 | aktuelle Bibliotheks-Doku statt veraltetem Modellwissen | keiner |

## 5 · Bewusst NICHT dabei

| Was | Warum |
|---|---|
| `hub`, `zeit`, `ki-key`, `kunde`, `dev-env`, `deploy-watch`, `coolify-manager`, `cockpit`, `content`, `newsfeed`, `agency` | hängen an FJ-Servern, FJ-Schlüsseln oder Kundendaten — wären ohne sie funktionslos und würden Interna verraten |
| Higgsfield-, Cloudflare-, Gmail-/Drive-Anbindungen | laufen über persönliche Konten; wer sie will, verbindet sein **eigenes** |
| Touch-ID-Wächter | an FJs Rechner und Schlüsselbund gebunden |
| HyperFrames-Videostrecke, GSAP, WordPress-, Rechts- und Finanz-Skills | Spezialwerkzeug — als Zusatzpakete nachlieferbar, sobald gebraucht |
| `settings.json`, `*.env`, Memory, Projekt-Historie | enthalten Zugangsdaten bzw. Kundendaten — werden vom Installer nie gelesen |

## 6 · Geplante Zusatzpakete (über `werkbank-update`)

| Paket | Inhalt | Stand |
|---|---|---|
| `ki-server` | lokale KI-Aufgaben in die Warteschlange des Werkstatt-Servers | Client + Server fertig und getestet, wartet auf die Hardware |
| `video` | HyperFrames-Strecke | offen |
| `wordpress` | wp-Skills | offen |
| `buero` | Verträge, NDA, Cashflow | offen |
