#!/usr/bin/env node
/**
 * Commit-Sperre: prüft NUR die vorgemerkten Änderungen auf Zugangsdaten und
 * heikle Dateien. Läuft bei jedem Commit, muss deshalb schnell sein.
 *
 * Sie prüft absichtlich nicht alles — nur das, was sich nachträglich nicht mehr
 * zurücknehmen lässt. Ein Wert, der einmal im Verlauf steht, ist kompromittiert,
 * auch wenn der nächste Commit ihn löscht.
 *
 * Exit: 0 = darf committet werden · 1 = blockiert
 */
import { execFileSync } from "node:child_process";
import { wirktZufaellig, maskieren, regexZugang, regexDateien } from "./gemeinsam.mjs";

const sh = (args) => { try { return execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };

const befunde = [];
const dateien = (sh(["diff", "--cached", "--name-only", "--diff-filter=ACM"]) || "").split("\n").filter(Boolean);

/* 1) Heikle Dateien */
for (const m of regexDateien()) {
  for (const d of dateien) if (m.re.test(d)) befunde.push({ titel: m.titel, ort: d, wert: null, rat: m.rat });
}

/* 2) Zugangsdaten in den hinzugefügten Zeilen */
const diff = sh(["diff", "--cached", "-U0"]) || "";
let datei = null;
for (const z of diff.split("\n")) {
  if (z.startsWith("+++ b/")) { datei = z.slice(6); continue; }
  if (!z.startsWith("+") || z.startsWith("+++")) continue;
  if (z.length > 2000) continue;
  for (const m of regexZugang()) {
    m.re.lastIndex = 0;
    const tref = m.re.exec(z);
    if (!tref) continue;
    const wert = m.gruppe ? tref[m.gruppe] : tref[0];
    if (m.entropie && !wirktZufaellig(wert)) continue;
    befunde.push({ titel: m.titel, ort: datei || "(unbekannt)", wert, rat: m.rat });
    break;
  }
}

if (!befunde.length) process.exit(0);

const rot = s => (process.stdout.isTTY ? "\x1b[31m" + s + "\x1b[0m" : s);
console.error("");
console.error(rot("  COMMIT GESTOPPT — " + befunde.length + " Fund" + (befunde.length > 1 ? "e" : "") + " in den vorgemerkten Änderungen"));
console.error("");
for (const b of befunde) {
  console.error("  " + b.titel);
  console.error("    " + b.ort + (b.wert ? "   " + maskieren(b.wert) : ""));
  console.error("    → " + b.rat);
  console.error("");
}
console.error("  Warum blockiert: Ein Wert, der einmal im Verlauf steht, bleibt dort — auch");
console.error("  wenn der nächste Commit ihn löscht. Er gilt ab dann als kompromittiert.");
console.error("");
console.error("  Erst widerrufen und rotieren, dann aus der Änderung nehmen:");
console.error("    git restore --staged <datei>     # aus der Vormerkung nehmen");
console.error("    echo '.env' >> .gitignore        # dauerhaft ausschließen");
console.error("");
console.error("  Nur wenn es sicher ein Fehlalarm ist:  git commit --no-verify");
console.error("  Fehlalarme gehören als Musterkorrektur nach");
console.error("  ~/.claude/werkbank/sicherheit/muster.json — nicht in die Gewohnheit.");
console.error("");
process.exit(1);
