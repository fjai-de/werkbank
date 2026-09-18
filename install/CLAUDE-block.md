<!-- WERKBANK:ANFANG — dieser Block wird vom Werkbank-Installer gepflegt -->
# Werkbank — gilt in jeder Session

## Antwortaufbau
1. Zuerst die Antwort: Ergebnis, Befunde, offene Punkte. Kurz, kein Fließtext.
2. Ganz zum Schluss, abgesetzt, der Block **„Was du jetzt tun musst"** — nummeriert, nur Aufgaben für mich selbst.
   Steht nichts an, entfällt der Block.

## Sicherheit — geht immer vor
- Zugangsdaten stehen nie im Code, im Chat oder im Repository — nur in `.env` (in `.gitignore`) oder in den
  Umgebungsvariablen der Plattform. Ein Wert, der einmal im Repository stand, gilt als kompromittiert: erst rotieren, dann aufräumen.
- Bei jeder `weitermachen.md` läuft der Skill `sicherheits-check`. Ein kritischer Befund blockiert das Session-Ende.
- Die globale Commit-Sperre (`~/.claude/git-hooks/pre-commit`) bleibt eingeschaltet. Fehlalarme werden als Muster korrigiert, nicht mit `--no-verify` umgangen.
- Vor jeder Veröffentlichung läuft der Skill `freigabe-check`. Fremde Systeme werden nie ungefragt geprüft.
- Fremde Skills vor der Installation mit `skill-vetter` prüfen.

## Tokens sparen
- Architekturfragen zuerst über den Wissensgraphen (`graphify-out/`) beantworten, nicht Datei für Datei.
- Webseiten mit `defuddle` lesen statt rohes HTML zu laden. Große Recherchen an Subagenten geben.
- `caveman` einschalten, wenn knappe Antworten reichen.

## Sessions
- Beginn mit `start`, Ende mit `weitermachen-erstellen`. Hilfe aus der Ferne über `hilfe-holen`.
<!-- WERKBANK:ENDE -->
