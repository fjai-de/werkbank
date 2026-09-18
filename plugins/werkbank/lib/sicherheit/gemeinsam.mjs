/**
 * Gemeinsame Hilfen für Prüfer und Commit-Sperre — damit beide dieselben
 * Muster und dieselbe Bewertung verwenden. Eine Quelle, keine zwei Wahrheiten.
 */
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HIER = path.dirname(fileURLToPath(import.meta.url));
export const MUSTER = JSON.parse(fs.readFileSync(path.join(HIER, "muster.json"), "utf8"));

const platzhalter = MUSTER.platzhalter.map(p => p.toLowerCase());
const nichtGeheim = (MUSTER.nicht_geheim || []).map(r => new RegExp(r));

/** Sieht der Wert nach einem echten Geheimnis aus — oder nach Fließtext und Platzhalter? */
export function wirktZufaellig(s) {
  if (!s || s.length < 16) return false;
  const l = s.toLowerCase();
  if (platzhalter.some(p => l.includes(p))) return false;
  if (nichtGeheim.some(r => r.test(s))) return false;
  if (/^https?:\/\//.test(s)) return false;
  if (/^[a-f0-9]{32,}$/i.test(s) === false) {
    const klassen = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(s)).length;
    if (klassen < 2) return false;
  }
  return new Set(s).size >= 8;
}

/** Geheimnisse werden nie im Klartext ausgegeben. */
export function maskieren(s) {
  const t = String(s).trim();
  if (t.length <= 8) return "*".repeat(t.length);
  return t.slice(0, 4) + "…" + t.slice(-2) + " (" + t.length + " Zeichen)";
}

const flags = m => (m.ci ? "gi" : "g");
export const regexZugang = () => MUSTER.zugangsdaten.map(m => ({ ...m, geheim: true, re: new RegExp(m.regex, flags(m)) }));
export const regexDateien = () => MUSTER.heikle_dateien.map(m => ({ ...m, re: new RegExp(m.regex) }));
