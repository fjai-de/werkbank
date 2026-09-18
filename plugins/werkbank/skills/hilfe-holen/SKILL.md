---
name: 'hilfe-holen'
description: 'Sichert den aktuellen Stand auf GitHub und gibt dem Workshop-Helfer Zugriff auf genau dieses Repository, damit er aus der Ferne mitlesen und helfen kann. Trigger; "ich brauche hilfe", "hilfe holen", "kannst du friedrich fragen", "helfer einladen", "zugriff geben", "zugriff entziehen".'
---

# Hilfe holen

Der Helfer bekommt Zugriff auf **ein Repository**, nie auf das GitHub-Konto. Passwörter, Tokens und
Zwei-Faktor-Codes werden nie weitergegeben — auch nicht an den Helfer.

Wer der Helfer ist, steht in `~/.claude/werkbank/werkbank.json` unter `helfer_github`
(vom Installer gesetzt). Fehlt der Eintrag: nachfragen und dort speichern.

## Ablauf

1. **Voraussetzungen prüfen**
   ```bash
   gh auth status          # angemeldet? sonst: gh auth login
   git -C "[PFAD]" remote get-url origin   # gibt es ein GitHub-Repo?
   ```
   Kein Repo → mit dem Skill `neues-projekt` (Abschnitt GitHub) ein **privates** anlegen.

2. **Sicherheits-Check vor dem Hochladen** — nichts Geheimes auf GitHub:
   ```bash
   node "$HOME/.claude/werkbank/sicherheit/pruefung.mjs" "[PFAD]"
   ```
   Exit-Code 2 → erst beheben, dann weiter.

3. **Stand sichern**
   ```bash
   git -C "[PFAD]" add -A && git -C "[PFAD]" commit -m "Stand für Rückfrage" && git -C "[PFAD]" push
   ```

4. **Helfer einladen** — nur nötig, wenn das Repo im **eigenen Konto** liegt. Liegt es in der
   Werkstatt-Organisation (`gh repo view --json owner -q .owner.login` = `github_org` aus `werkbank.json`),
   hat der Workshop-Leiter als Eigentümer bereits Zugriff → weiter mit Schritt 5.
   ```bash
   HELFER=$(node -e "console.log(require(require('os').homedir()+'/.claude/werkbank/werkbank.json').helfer_github)")
   gh api -X PUT "repos/{owner}/{repo}/collaborators/$HELFER" -f permission=push
   ```
   (im Projektordner ausführen — `{owner}/{repo}` füllt `gh` selbst aus)

5. **Frage formulieren** — eine Datei `HILFE.md` im Projekt: Was wollte ich erreichen, was passiert
   stattdessen, was habe ich versucht, Fehlermeldung im Wortlaut. Committen und pushen.
   Dann dem User den Repo-Link nennen (`gh repo view --json url -q .url`), den er dem Helfer schickt.

## Zugriff wieder entziehen

```bash
gh api -X DELETE "repos/{owner}/{repo}/collaborators/$HELFER"
```
