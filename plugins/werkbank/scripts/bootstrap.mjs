#!/usr/bin/env node
// SessionStart-Hook der Werkbank.
//
// Legt feste Pfade unter ~/.claude/werkbank/ an, weil sich der Plugin-Ordner bei jedem
// Update aendert, Skills und die Commit-Sperre aber einen stabilen Pfad brauchen:
//
//   ~/.claude/werkbank/session.mjs      Session-Tracker
//   ~/.claude/werkbank/sicherheit/      Sicherheits-Check + Commit-Pruefer
//   ~/.claude/werkbank/freigabe/        Freigabepruefung (node_modules bleiben erhalten)
//   ~/.claude/werkbank/.session-start   Zeitmarke fuer "seit Sessionbeginn geaendert"
//
// Es wird nichts gesendet und nichts ausserhalb von ~/.claude/werkbank/ angefasst.
// Fehler werden geschluckt — ein Hook darf die Session nie aufhalten.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  const wurzel = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const ziel = path.join(os.homedir(), ".claude", "werkbank");
  fs.mkdirSync(ziel, { recursive: true });

  const kopiere = (von, nach) => {
    if (!fs.existsSync(von)) return;
    fs.mkdirSync(nach, { recursive: true });
    for (const e of fs.readdirSync(von, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const a = path.join(von, e.name), b = path.join(nach, e.name);
      if (e.isDirectory()) kopiere(a, b); else fs.copyFileSync(a, b);
    }
  };

  const tracker = path.join(wurzel, "lib", "_session", "session.mjs");
  if (fs.existsSync(tracker)) fs.copyFileSync(tracker, path.join(ziel, "session.mjs"));
  kopiere(path.join(wurzel, "lib", "sicherheit"), path.join(ziel, "sicherheit"));
  kopiere(path.join(wurzel, "lib", "freigabe"), path.join(ziel, "freigabe"));
  fs.writeFileSync(path.join(ziel, ".session-start"), new Date().toISOString());
} catch { /* bewusst still */ }
process.exit(0);
