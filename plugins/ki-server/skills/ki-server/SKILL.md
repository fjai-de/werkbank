---
name: 'ki-server'
description: 'Stellt aufwendige Aufgaben, die lokal laufen sollen, in die Warteschlange des Werkstatt-KI-Servers — Massenverarbeitung, lange Zusammenfassungen, Klassifizieren vieler Dateien, vertrauliche Texte, die nicht in die Cloud sollen. Trigger; "lokal laufen lassen", "auf dem ki-server", "in die warteschlange", "ki server status", "lokales modell".'
---

# KI-Server (Warteschlange)

Aufträge laufen auf dem Server des Workshop-Leiters, nicht auf diesem Rechner. Alle teilen sich
die Grafikkarten, deshalb gibt es eine Warteschlange. Aufträge des Betreibers haben Vorrang —
ein eigener Auftrag kann dadurch nach hinten rutschen oder kurz unterbrochen und neu gestartet werden.
Das ist so gewollt und kein Fehler.

`KI` steht unten für: `node "${CLAUDE_PLUGIN_ROOT}/skills/ki-server/ki.mjs"`

## Einrichten (einmalig)

Jede Person bekommt einen **eigenen** Zugangscode. Den Code tippt der User selbst ins Terminal —
nie im Chat nennen lassen, nie in eine Projektdatei schreiben:

```bash
KI einrichten https://<adresse-vom-workshop-leiter>
```

Exit-Code 3 bei anderen Befehlen heißt: noch nicht eingerichtet → dem User diesen Befehl nennen.

## Benutzen

```bash
KI frage "Fasse zusammen …" --datei notizen.md          # wartet und gibt das Ergebnis aus
KI frage "…" --modell qwen3:8b --system "Antworte auf Deutsch"
KI schlange                                              # wie voll ist es, wo stehe ich
KI status <id>    ·    KI storno <id>
```

## Wann ja, wann nein

- **Ja:** viele gleichartige Schritte, lange Texte, Inhalte die das Haus nicht verlassen sollen, alles was nicht eilt.
- **Nein:** kurze Fragen, Code-Arbeit im Projekt, alles was sofort gebraucht wird — das macht Claude selbst.
- Höchstens fünf wartende Aufträge je Person. Große Stapel nacheinander einstellen, nicht alle auf einmal.
- Keine Zugangsdaten in Aufträge packen.
