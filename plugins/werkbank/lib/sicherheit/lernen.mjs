/**
 * Lernen — schreibt behobene Befunde als Lektionen in den Obsidian-Vault.
 *
 * Eine Lektion je Befundtyp, nicht je Vorfall. Vorfaelle sammeln sich in einer
 * Tabelle darunter. So waechst aus wiederkehrenden Fehlern eine Regel, statt
 * eines Archivs von Einzelfaellen.
 *
 * CLI:  node lernen.mjs --vorbeugen        Checkliste aller Lektionen ausgeben
 *       node lernen.mjs --liste            Lektionen mit Vorfallzahl auflisten
 */
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";
import path from "node:path";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ZUHAUSE = os.homedir();
const VAULT = process.env.WERKBANK_VAULT || path.join(ZUHAUSE, "werkbank-vault");
const BEREICH = path.join(VAULT, "60_Sicherheit");
const LEKTIONEN = path.join(BEREICH, "Lektionen");
const UEBERSICHT = path.join(BEREICH, "00_Sicherheit-Uebersicht.md");

const DIDAKTIK = JSON.parse(fs.readFileSync(path.join(HIER, "lektionen.json"), "utf8"));

/** Laengste Praefix-Uebereinstimmung gewinnt. */
export function didaktikFuer(typ) {
  let treffer = null;
  for (const k of Object.keys(DIDAKTIK)) {
    if (k.startsWith("_")) continue;
    if (typ === k || typ.startsWith(k)) {
      if (!treffer || k.length > treffer.length) treffer = k;
    }
  }
  return { schluessel: treffer || "_standard", ...DIDAKTIK[treffer || "_standard"] };
}

const dateiname = t => t.replace(/[^A-Za-zÄÖÜäöüß0-9 -]/g, "").replace(/\s+/g, "-");

function leseNotiz(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

/**
 * Traegt einen behobenen Befund in die Lektion ein.
 * @returns {{pfad:string, neu:boolean, vorfaelle:number}|null}
 */
export function lektionSchreiben(befund, projektName, loesung) {
  if (!fs.existsSync(VAULT)) return null;
  const d = didaktikFuer(befund.typ);
  const pfad = path.join(LEKTIONEN, dateiname(d.titel) + ".md");
  fs.mkdirSync(LEKTIONEN, { recursive: true });

  const heute = new Date().toISOString().slice(0, 10);
  const ort = (befund.ort || "").replace(/\|/g, "/");
  const loesungstext = (loesung || "").replace(/\|/g, "/").trim() || "_nicht dokumentiert_";
  const zeile = "| " + heute + " | [[" + projektName + "]] | `" + ort + "` | " + befund.schwere + " | " + loesungstext + " |";

  let inhalt = leseNotiz(pfad);
  const neu = !inhalt;

  if (neu) {
    inhalt = "---\n" +
      "typ: sicherheits-lektion\n" +
      "befundtyp: " + d.schluessel + "\n" +
      "schwere: " + befund.schwere + "\n" +
      "erstmals: " + heute + "\n" +
      "zuletzt: " + heute + "\n" +
      "vorfaelle: 1\n" +
      "tags: [sicherheit, lektion]\n" +
      "---\n\n" +
      "# " + d.titel + "\n\n" +
      "> [!warning] Aus einem echten Vorfall gelernt\n" +
      "> Diese Notiz entsteht automatisch, sobald ein Befund behoben wurde. Sie wird bei jedem\n" +
      "> weiteren Vorfall ergänzt. Teil von [[00_Sicherheit-Uebersicht]].\n\n" +
      "## Was passiert\n\n" + d.was + "\n\n" +
      "## Warum es passiert\n\n" + d.warum + "\n\n" +
      "## Vorbeugen\n\n" +
      d.vorbeugen.map(v => "- [ ] " + v).join("\n") + "\n\n" +
      "## Vorfälle\n\n" +
      "| Datum | Projekt | Ort | Schwere | Wie behoben |\n|---|---|---|---|---|\n" + zeile + "\n";
  } else {
    // Vorfall anhaengen, Kopf fortschreiben
    if (inhalt.includes("| " + heute + " | [[" + projektName + "]] | `" + ort + "`")) return null;
    inhalt = inhalt.replace(/\n$/, "") + "\n" + zeile + "\n";
    const anzahl = (inhalt.match(/^\| \d{4}-\d{2}-\d{2} \| \[\[/gm) || []).length;
    inhalt = inhalt.replace(/^zuletzt: .*$/m, "zuletzt: " + heute)
                   .replace(/^vorfaelle: .*$/m, "vorfaelle: " + anzahl);
  }
  fs.writeFileSync(pfad, inhalt);
  const anzahl = (inhalt.match(/^\| \d{4}-\d{2}-\d{2} \| \[\[/gm) || []).length;
  return { pfad, neu, vorfaelle: anzahl };
}

/** Sammelt alle Lektionen aus dem Vault. */
export function alleLektionen() {
  if (!fs.existsSync(LEKTIONEN)) return [];
  return fs.readdirSync(LEKTIONEN).filter(f => f.endsWith(".md")).map(f => {
    const t = fs.readFileSync(path.join(LEKTIONEN, f), "utf8");
    const feld = n => (t.match(new RegExp("^" + n + ": (.*)$", "m")) || [])[1] || "";
    const vorbeugen = (t.match(/## Vorbeugen\n\n([\s\S]*?)\n\n##/) || [])[1] || "";
    return {
      datei: f, titel: (t.match(/^# (.+)$/m) || [])[1] || f.replace(".md", ""),
      schwere: feld("schwere"), vorfaelle: Number(feld("vorfaelle")) || 0,
      erstmals: feld("erstmals"), zuletzt: feld("zuletzt"),
      punkte: vorbeugen.split("\n").filter(z => z.startsWith("- [ ]")).map(z => z.replace("- [ ] ", ""))
    };
  }).sort((a, b) => b.vorfaelle - a.vorfaelle);
}

/** Schreibt die Übersichtsnotiz mit der Vorbeugen-Checkliste neu. */
export function uebersichtSchreiben() {
  if (!fs.existsSync(VAULT)) return null;
  const l = alleLektionen();
  fs.mkdirSync(BEREICH, { recursive: true });
  const rang = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };

  let t = "---\ntyp: index\nstand: " + new Date().toISOString().slice(0, 10) +
    "\nerzeugt_von: sicherheits-check/lernen.mjs\ntags: [sicherheit, index]\n---\n\n" +
    "# Sicherheit — was wir aus Fehlern gelernt haben\n\n" +
    "> [!tip] Vor jedem neuen Projekt einmal lesen\n" +
    "> Jede Zeile hier stammt aus einem echten Vorfall, der behoben wurde. Der Zweck ist\n" +
    "> nicht die Dokumentation, sondern die Vermeidung: diese Fehler sollen in neuen\n" +
    "> Projekten gar nicht erst entstehen.\n\n" +
    "Automatisch fortgeschrieben vom Skill `/sicherheits-check`. Nicht von Hand ändern —\n" +
    "Ergänzungen gehören in die einzelnen Lektionen unter `Lektionen/`.\n\n";

  if (!l.length) {
    t += "_Noch keine Lektionen. Sie entstehen, sobald der erste Befund behoben wurde._\n";
  } else {
    t += "## Checkliste vor dem Start\n\n";
    const gesehen = new Set();
    for (const x of [...l].sort((a, b) => (rang[a.schwere] ?? 9) - (rang[b.schwere] ?? 9))) {
      for (const p of x.punkte) {
        if (gesehen.has(p)) continue;
        gesehen.add(p);
        t += "- [ ] " + p + "  <small>→ [[" + x.datei.replace(".md", "") + "]]</small>\n";
      }
    }
    t += "\n## Lektionen nach Häufigkeit\n\n| Lektion | Vorfälle | Schwere | erstmals | zuletzt |\n|---|---|---|---|---|\n";
    for (const x of l)
      t += "| [[" + x.datei.replace(".md", "") + "]] | " + x.vorfaelle + " | " + x.schwere + " | " + x.erstmals + " | " + x.zuletzt + " |\n";
    const vz = l.reduce((a, x) => a + x.vorfaelle, 0);
    t += "\n_" + l.length + (l.length === 1 ? " Lektion" : " Lektionen") + " aus " + vz +
      (vz === 1 ? " behobenem Vorfall" : " behobenen Vorfällen") + "._\n";
  }
  fs.writeFileSync(UEBERSICHT, t);
  return { pfad: UEBERSICHT, lektionen: l.length };
}

/** Traegt eine Loesung nachtraeglich in die Lektionstabelle ein. */
export function loesungNachtragen(befund, projektName, loesung) {
  const d = didaktikFuer(befund.typ);
  const pfad = path.join(LEKTIONEN, dateiname(d.titel) + ".md");
  let t = leseNotiz(pfad);
  if (!t) return false;
  const ort = (befund.ort || "").replace(/\|/g, "/");
  const zeilen = t.split("\n");
  let geaendert = false;
  for (let i = 0; i < zeilen.length; i++) {
    if (zeilen[i].includes("[[" + projektName + "]]") && zeilen[i].includes("`" + ort + "`")
        && zeilen[i].includes("_nicht dokumentiert_")) {
      zeilen[i] = zeilen[i].replace("_nicht dokumentiert_", loesung.replace(/\|/g, "/").trim());
      geaendert = true;
    }
  }
  if (geaendert) fs.writeFileSync(pfad, zeilen.join("\n"));
  return geaendert;
}

/* ------------------------------------------------------------------ CLI */
if (process.argv[1] && process.argv[1].endsWith("lernen.mjs")) {
  const a = process.argv.slice(2);
  if (a.includes("--vorbeugen")) {
    const l = alleLektionen();
    if (!l.length) { console.log("Noch keine Lektionen im Vault."); process.exit(0); }
    console.log("Sicherheit — Checkliste aus " + l.reduce((x, y) => x + y.vorfaelle, 0) + " behobenen Vorfällen:\n");
    const gesehen = new Set();
    for (const x of l) for (const p of x.punkte) {
      if (gesehen.has(p)) continue; gesehen.add(p);
      console.log("  [ ] " + p);
    }
    console.log("\nVollständig: " + UEBERSICHT.replace(ZUHAUSE, "~"));
  } else if (a.includes("--liste")) {
    for (const x of alleLektionen())
      console.log(String(x.vorfaelle).padStart(3) + "×  " + x.titel + "  (" + x.schwere + ", zuletzt " + x.zuletzt + ")");
  } else if (a.includes("--uebersicht")) {
    const r = uebersichtSchreiben();
    console.log(r ? "Übersicht geschrieben: " + r.pfad + " (" + r.lektionen + " Lektionen)" : "Vault nicht gefunden");
  } else {
    console.log("Optionen: --vorbeugen | --liste | --uebersicht");
  }
}
