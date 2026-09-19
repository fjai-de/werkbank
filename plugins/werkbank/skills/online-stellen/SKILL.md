---
name: 'online-stellen'
description: 'Veröffentlicht eine App auf dem Werkstatt-Server unter einer echten Adresse (<name>-app.fjai.de). Prüft Start-Befehl, Port, Umgebungsvariablen und Sicherheit, schreibt DEPLOY.md, pusht und meldet die App über das Werkzeug werkstatt.mjs an. Trigger; "online stellen", "app veröffentlichen", "live stellen", "deploy", "kann das online".'
---

# Online stellen

Der Server gehört dem Workshop-Leiter. Er richtet die App **einmal** ein; danach baut jeder `git push`
auf `main` sie automatisch neu. Teilnehmer bekommen keinen Server-Zugang und brauchen keinen.

## 0 — Nur schnell zeigen? (ohne Server, sofort)

Für „schau mal, läuft" reicht eine vorübergehende Adresse direkt vom eigenen Rechner — kein Konto, keine Kosten:

```bash
# einmalig:  Mac: brew install cloudflared     Windows: winget install Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```

Die ausgegebene `https://….trycloudflare.com`-Adresse gilt, solange das Terminal offen ist. Jeder mit dem Link
sieht die App — nichts mit echten Daten oder Zugangsdaten so zeigen. Für dauerhaft online: weiter mit Schritt 1.

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

## 5 — Veröffentlichen

`WS` steht für: `node "${CLAUDE_PLUGIN_ROOT}/skills/online-stellen/werkstatt.mjs"`

**Einmalig verbinden.** Adresse und Zugangscode gibt der Workshop-Leiter. Den Code tippt der User **selbst** ins Terminal —
nie im Chat nennen lassen, nie in eine Datei im Projekt schreiben:

```bash
WS einrichten http://<adresse-vom-leiter>
```

**Veröffentlichen** (im Projektordner):

```bash
WS veroeffentlichen            # liest DEPLOY.md; --name, --port, --art überschreiben
```

Das Werkzeug trägt den Leseschlüssel des Servers ins eigene Repo ein (nur lesen), lädt den Workshop-Leiter als
Mitarbeiter ein, meldet die App an und wartet auf den Bau. Am Ende steht die Adresse: `https://<name>-app.fjai.de`.
Übertragen werden nur Repo-Name, Wunschname, Port, Bauart und die **Namen** der Umgebungsvariablen — keine Werte, keine Tokens.

- Exit-Code 3 → noch nicht verbunden: dem User den Einrichten-Befehl nennen.
- „Umgebungsvariablen fehlen noch" → Werte dem Leiter direkt geben, er trägt sie ein und baut.
- Danach gilt: **jeder Push auf `main` geht innerhalb von ein bis zwei Minuten online.** Halbfertiges auf einem eigenen
  Branch bauen (`git switch -c entwurf`). Sofort neu bauen: `WS veroeffentlichen` noch einmal. Stand: `WS status`.
- Höchstens fünf Apps je Person.

## Wenn der Bau auf dem Server scheitert

Der Workshop-Leiter sieht das Bau-Protokoll. Häufigste Ursachen: fehlende Lockdatei, `localhost` statt `0.0.0.0`,
fester Port, fehlende Umgebungsvariable, Paket nur in `devDependencies`, das zur Laufzeit gebraucht wird.
