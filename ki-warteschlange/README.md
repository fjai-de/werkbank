# KI-Warteschlange

Läuft **nur beim Betreiber**, vor einem oder mehreren Ollama-Servern. Teilnehmer nutzen sie über das
Zusatzpaket `ki-server`. Keine Abhängigkeiten, nur Node ≥ 18.

## Vorrang

- Rolle `chef` steht **immer vor allen wartenden** Teilnehmer-Aufträgen.
- `"verdraengen": true` — zusätzlich wird ein **laufender** Teilnehmer-Auftrag abgebrochen, sobald ein
  Chef-Auftrag kein freies Backend findet. Der abgebrochene Auftrag geht nicht verloren: Er wird vorn in
  seiner Klasse wieder eingereiht und startet danach neu.
- Innerhalb einer Rolle gilt: wer zuerst kommt, ist zuerst dran. Höchstens fünf wartende Aufträge je Person.

## Einrichten

```bash
cp config.beispiel.json config.json        # Backends eintragen — je Grafikkarte ein Ollama
node zugang.mjs neu "Friedrich" --chef     # Code wird genau einmal angezeigt
node zugang.mjs neu "Anna"                 # je Teilnehmer ein eigener Code
node server.mjs
```

Zwei Grafikkarten = zwei Ollama-Instanzen, jede auf eine Karte festgelegt:

```bash
CUDA_VISIBLE_DEVICES=0 OLLAMA_HOST=127.0.0.1:11434 ollama serve   # RTX 5070 Ti (16 GB) — alle Modelle
CUDA_VISIBLE_DEVICES=1 OLLAMA_HOST=127.0.0.1:11435 ollama serve   # RTX 3070 (8 GB) — nur kleine Modelle
```

In `config.json` bekommt die 3070 eine feste Modell-Liste (`"modelle": ["qwen3:8b"]`), die 5070 Ti `["*"]`.

## Sicherheit

- Gespeichert wird nur der SHA-256 der Zugangscodes (`zugang.json`, nicht im Repo). Sperren: `node zugang.mjs sperren "Anna"`.
- Niemand sieht Inhalte oder Namen fremder Aufträge; die Schlange zeigt Fremde nur als Platz.
- Ollama selbst bleibt auf `127.0.0.1` — nach außen geht nur die Warteschlange.
- **Nicht nackt ins Internet stellen.** Davor gehört TLS: Cloudflare Tunnel oder ein Reverse Proxy.

## Schnittstelle

| Aufruf | Wirkung |
|---|---|
| `POST /auftrag` `{prompt \| messages, modell?, optionen?}` | einreihen → `{id, platz}` |
| `GET /auftrag/<id>` | Status, Platz, Ergebnis |
| `DELETE /auftrag/<id>` | stornieren (auch laufend) |
| `GET /schlange` | Auslastung und eigene Plätze |
| `GET /gesund` | Lebenszeichen, ohne Code |

Alle außer `/gesund` brauchen `Authorization: Bearer <zugangscode>`.

## Grenzen dieser Version

Aufträge liegen im Arbeitsspeicher — ein Neustart leert die Schlange. Ergebnisse werden 60 Minuten aufbewahrt.
Kein Streaming. Getestet gegen einen nachgebauten Ollama-Server, noch nicht gegen die echte Hardware.
