---
name: 'werkbank-update'
description: 'Aktualisiert die Werkbank und installiert neue Skill-Pakete aus dem Werkbank-Marketplace nach. Trigger; "werkbank aktualisieren", "werkbank update", "neue skills", "skill nachinstallieren", "was gibt es neues in der werkbank".'
---

# Werkbank aktualisieren und Skills nachladen

Alle Pakete kommen aus dem Marketplace `fj-werkbank`. Neue Pakete erscheinen dort, sobald sie freigegeben sind.

```bash
claude plugin marketplace update fj-werkbank      # Katalog neu holen
claude plugin list                                # was ist installiert
claude plugin update werkbank@fj-werkbank         # Kernpaket aktualisieren
claude plugin install <paket>@fj-werkbank         # Zusatzpaket nachinstallieren
```

Danach Claude Code neu starten (oder `/reload-plugins`).

## Pakete

| Paket | Inhalt | Braucht |
|---|---|---|
| `werkbank` | Kern: Arbeitsweise, Sicherheit, Freigabe, Übergabe | nichts |
| `ki-server` | Aufwendige lokale KI-Aufgaben in die Warteschlange des Werkstatt-Servers stellen | **eigenen** Zugangscode vom Workshop-Leiter |

Den aktuellen Katalog zeigt `/plugin` → Reiter „Discover".

## Fremde Skills

Skills von außerhalb des Marketplace vorher mit `skill-vetter` prüfen. Installation immer aus dem
Home-Verzeichnis und global: `cd ~ && npx skills add <quelle> --skill <name> -g`.
