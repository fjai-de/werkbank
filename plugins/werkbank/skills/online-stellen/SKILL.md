---
name: 'online-stellen'
description: 'Macht eine App bereit für die Veröffentlichung auf dem Werkstatt-Server und meldet sie beim Workshop-Leiter an. Prüft Start-Befehl, Port, Umgebungsvariablen und Sicherheit, schreibt DEPLOY.md und pusht. Trigger; "online stellen", "app veröffentlichen", "live stellen", "deploy", "kann das online".'
---

# Online stellen

Der Server gehört dem Workshop-Leiter. Er richtet die App **einmal** ein; danach baut jeder `git push`
auf `main` sie automatisch neu. Teilnehmer bekommen keinen Server-Zugang und brauchen keinen.

## 1 — Ist die App baubar? (selbst prüfen, nicht fragen)

| Prüfung | Soll |
|---|---|
| Start | Node: `package.json` hat `build` (falls nötig) und `start`. Statische Seite: `index.html` im Wurzel- oder `dist/`-Ordner. Sonst: `Dockerfile`. |
| Port | Server lauscht auf `process.env.PORT \|\| 3000` und auf `0.0.0.0` — **nicht** auf `localhost` |
| Lockdatei | `package-lock.json` ist eingecheckt |
| Sauberer Bau | `rm -rf node_modules && npm ci && npm run build` läuft lokal fehlerfrei durch |
| Daten | Dateien, die die App schreibt (SQLite, Uploads), liegen in **einem** Ordner, z. B. `data/` — sonst sind sie nach jedem Neubau weg |
| Lebenszeichen | `GET /` oder `/health` antwortet mit 200 |

Fehlt etwas: beheben, dann weiter. Eine App, die beim Start abstürzt, startet auf dem Server in Schleife neu
und bremst alle anderen aus — deshalb lokal **wirklich** starten und aufrufen, bevor gepusht wird.

## 2 — Umgebungsvariablen

Alle gelesenen Variablen (`process.env.*`) in `.env.example` auflisten — **nur Namen, keine Werte**.
Echte Werte gehören nie ins Repository und nie in den Chat. Der Teilnehmer gibt sie dem Workshop-Leiter
direkt; dieser trägt sie auf dem Server ein.

## 3 — Sicherheits-Check (blockierend)

```bash
node "$HOME/.claude/werkbank/sicherheit/pruefung.mjs" "[PFAD]"
```

Exit-Code 2 → nicht veröffentlichen, erst beheben.

## 4 — DEPLOY.md schreiben und pushen

`DEPLOY.md` im Wurzelordner, kurz:

```markdown
# Deploy
- Repository: <org>/<repo> · Branch: main
- Art: Node (Nixpacks) | statisch | Dockerfile
- Build: npm run build      Start: npm start      Port: 3000
- Umgebungsvariablen: NAME_A, NAME_B   (Werte kommen getrennt)
- Dauerhafte Daten: /app/data          (oder: keine)
- Lebenszeichen: /health
- Wunschname: <kurz, kleingeschrieben, ohne Punkt>
```

```bash
git add -A && git commit -m "Bereit zum Veröffentlichen" && git push
```

## 5 — Anmelden

Dem User sagen: „Sag dem Workshop-Leiter Bescheid — `DEPLOY.md` liegt im Repo." Link mit
`gh repo view --json url -q .url` nennen. Nach der Einrichtung gilt: **jeder Push auf `main` geht online.**
Halbfertiges deshalb auf einem eigenen Branch bauen (`git switch -c entwurf`) und erst zusammenführen, wenn es läuft.

## Wenn der Bau auf dem Server scheitert

Der Workshop-Leiter schickt die Fehlermeldung. Häufigste Ursachen: fehlende Lockdatei, `localhost` statt `0.0.0.0`,
fester Port, fehlende Umgebungsvariable, Paket nur in `devDependencies`, das zur Laufzeit gebraucht wird.
