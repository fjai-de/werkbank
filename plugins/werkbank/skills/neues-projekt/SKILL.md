---
name: 'neues-projekt'
description: 'Legt ein neues Projekt sauber an — Ordnerstruktur, Git, .gitignore, privates GitHub-Repository, Sicherheits-Nulllinie, erste weitermachen.md. Trigger; "neues Projekt", "Projekt anlegen", "neue Website", "Projekt aufsetzen".'
---

# Neues Projekt

## 1 — Klären (eine Frage, nicht fünf)
Name, Zweck in einem Satz, Art (Website · Node-App · Skript · Sonstiges). Ablageort vorschlagen: `~/Projekte/<name>`.

## 2 — Ordnerstruktur

```
<name>/
  01_dev/            Code (hier liegt das Git-Repository)
  03_Materialien/    Bilder, Texte, Vorlagen
  04_Recherche/      Notizen, Quellen
  10_Weitermachen/   weitermachen.md, Sicherheits-Historie
```

## 3 — Git und .gitignore — **vor** der ersten Datei mit Inhalt

```bash
cd "<name>/01_dev" && git init -b main
```

`.gitignore` mindestens: `.env`, `.env.*`, `!.env.example`, `node_modules/`, `dist/`, `.DS_Store`, `*.pem`, `*.key`, `graphify-out/cache/`.
Zugangsdaten kommen in `.env`; ins Repository gehört nur eine `.env.example` mit leeren Werten.

## 4 — Vorbeugen und Nulllinie

```bash
node "$HOME/.claude/werkbank/sicherheit/lernen.mjs" --vorbeugen
node "$HOME/.claude/werkbank/sicherheit/pruefung.mjs" "<pfad>/01_dev"
```

## 5 — GitHub (privat)

```bash
gh auth status || gh auth login
ORG=$(node -e "try{console.log(require(require('os').homedir()+'/.claude/werkbank/werkbank.json').github_org||'')}catch{console.log('')}")
gh repo create "${ORG:+$ORG/}<name>" --private --source . --remote origin --push
```

Steht in `werkbank.json` eine `github_org` (Werkstatt-Organisation), landet das Repo dort — der Workshop-Leiter
ist dort Eigentümer und kann ohne weitere Einladung helfen. Ohne Eintrag landet es im eigenen Konto.

Immer **privat** anlegen. Öffentlich nur auf ausdrücklichen Wunsch und nach bestandenem Sicherheits-Check.
Soll der Workshop-Helfer mitlesen können → Skill `hilfe-holen`.

## 6 — Erste weitermachen.md
`10_Weitermachen/weitermachen.md` mit Ziel, Stand, nächsten drei Schritten. Danach den ersten Schritt vorschlagen.
