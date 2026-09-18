#!/usr/bin/env node
/**
 * Sicherheits-Check — FJ Design
 *
 * Bewusst ohne jede npm-Abhaengigkeit: nur Node-Built-ins. Ein Pruefer, der selbst
 * Fremdpakete zieht, waere genau der Angriffsweg, den er finden soll.
 *
 * Aufruf:  node pruefung.mjs <projektpfad> [--json] [--budget=60] [--live=<url>]
 * Exit:    0 = keine offenen kritischen Befunde
 *          2 = mindestens ein offener kritischer Befund  (Aufrufer blockiert damit)
 *          1 = Fehler im Pruefer selbst
 */
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { lektionSchreiben, uebersichtSchreiben, loesungNachtragen } from "./lernen.mjs";
import { abgleichen as hubAbgleichen } from "./hub.mjs";
import { wirktZufaellig, maskieren } from "./gemeinsam.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MUSTER = JSON.parse(fs.readFileSync(path.join(HIER, "muster.json"), "utf8"));
const CACHE = path.join(HIER, ".cache");

const argv = process.argv.slice(2);
const projekt = path.resolve(argv.find(a => !a.startsWith("--")) || process.cwd());
const alsJson = argv.includes("--json");
const budgetMs = (Number((argv.find(a => a.startsWith("--budget=")) || "").split("=")[1]) || 60) * 1000;
const liveArg = (argv.find(a => a.startsWith("--live=")) || "").split("=")[1] || null;
const erledigtId = (argv.find(a => a.startsWith("--erledigt=")) || "").split("=")[1] || null;
const zurueckId = (argv.find(a => a.startsWith("--zurueckstellen=")) || "").split("=")[1] || null;
const grund = (argv.find(a => a.startsWith("--grund=")) || "").split("=").slice(1).join("=") || null;
const wer = (argv.find(a => a.startsWith("--wer=")) || "").split("=")[1] || "FJ";
const loesung = (argv.find(a => a.startsWith("--loesung=")) || "").split("=").slice(1).join("=") || null;
const loesungFuer = (argv.find(a => a.startsWith("--loesung-fuer=")) || "").split("=")[1] || null;
const nachtragenModus = argv.includes("--nachtragen");
const keinHub = argv.includes("--kein-hub");
const hubAb = (argv.find(a => a.startsWith("--hub-ab=")) || "").split("=")[1] || "hoch";

/** Eine Zurueckstellung laeuft nach dieser Frist ab und muss neu entschieden werden. */
const ZURUECKSTELLUNG_TAGE = 30;

const t0 = Date.now();
const restzeit = () => budgetMs - (Date.now() - t0);
const abgelaufen = () => restzeit() <= 0;

/* ---------------------------------------------------------------- Hilfen */

function sh(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"], ...opts });
  } catch { return null; }
}

function id(...teile) {
  return crypto.createHash("sha1").update(teile.join("|")).digest("hex").slice(0, 12);
}



/** Markdown ist Dokumentation. Ein Codemuster darin beschreibt Code, es ist keiner. */
function istDoku(rel) { return /\.(md|mdx|txt|adoc|rst)$/i.test(rel); }

function istIgnoriert(rel) {
  return MUSTER.ignorierte_pfade.some(p => rel.includes(p)) ||
         MUSTER.binaer_endungen.some(e => rel.toLowerCase().endsWith(e)) ||
         rel.endsWith("pruefung.mjs");
}

/* ------------------------------------------------------- Projekt und Git */

/** Findet Git-Repos im Projekt (auch unter 01_dev/, wie in der FJ-Struktur ueblich). */
function repos(wurzel) {
  const gefunden = [];
  const suche = (dir, tiefe) => {
    if (tiefe > 3) return;
    let eintraege;
    try { eintraege = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (eintraege.some(e => e.isDirectory() && e.name === ".git")) { gefunden.push(dir); return; }
    for (const e of eintraege) {
      if (!e.isDirectory() || e.name === "node_modules" || e.name.startsWith(".")) continue;
      suche(path.join(dir, e.name), tiefe + 1);
    }
  };
  suche(wurzel, 0);
  return gefunden;
}

const sicherheitsDir = path.join(projekt, "10_Weitermachen", "sicherheit");
const standDatei = path.join(sicherheitsDir, "befunde.json");
const historieDatei = path.join(sicherheitsDir, "historie.md");

function ladeStand() {
  try { return JSON.parse(fs.readFileSync(standDatei, "utf8")); }
  catch { return { version: 1, letztePruefung: null, letzterCommit: {}, abhaengigkeiten: [], befunde: [] }; }
}

/* -------------------------------------------------------------- Pruefungen */

const befunde = [];
const hinweise = [];
/** Typen, die nur inkrementell geprueft werden: ihr Fehlen bedeutet NICHT "behoben". */
const nurInkrementell = t => t.startsWith("verlauf-") || t.startsWith("paket-");

function melde(typ, schwere, titel, ort, auszug, rat, zeile = null) {
  befunde.push({
    id: id(typ, ort, auszug || ""), typ, schwere, titel, ort, zeile,
    auszug: auszug ? maskieren(auszug) : null, rat, dauerhaft: nurInkrementell(typ)
  });
}

const flags = m => (m.ci ? "gi" : "g");
const regexZugang = MUSTER.zugangsdaten.map(m => ({ ...m, geheim: true, re: new RegExp(m.regex, flags(m)) }));
const regexUnsicher = MUSTER.unsicher.map(m => ({ ...m, geheim: false, re: new RegExp(m.regex, flags(m)) }));
const regexDateien = MUSTER.heikle_dateien.map(m => ({ ...m, re: new RegExp(m.regex) }));

let dateienGeprueft = 0;
const getrackteDateien = new Set();

function pruefeGetrackteDateien(repo) {
  const relRepo = path.relative(projekt, repo) || ".";
  const liste = sh("git", ["-C", repo, "ls-files", "-z"]);
  if (liste === null) return;
  for (const datei of liste.split("\0").filter(Boolean)) {
    getrackteDateien.add(path.join(relRepo, datei));
    for (const m of regexDateien) {
      if (m.re.test(datei)) melde("datei", m.schwere, m.titel, path.join(relRepo, datei), null, m.rat);
    }
  }
}

/** Inhaltssuche laeuft ueber das Dateisystem — auch dort, wo (noch) kein Git-Repo liegt. */
function pruefeInhalte(wurzel) {
  const stapel = [wurzel];
  while (stapel.length) {
    const dir = stapel.pop();
    let eintraege;
    try { eintraege = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of eintraege) {
      const abs = path.join(dir, e.name);
      const rel = path.relative(projekt, abs);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".git" || istIgnoriert(rel + "/")) continue;
        stapel.push(abs);
        continue;
      }
      if (!e.isFile() || istIgnoriert(rel)) continue;
      let st; try { st = fs.statSync(abs); } catch { continue; }
      if (st.size > 512 * 1024) continue;
      let text; try { text = fs.readFileSync(abs, "utf8"); } catch { continue; }
      if (text.includes("\0")) continue;
      dateienGeprueft++;
      const zeilen = text.split("\n");
      for (let i = 0; i < zeilen.length; i++) {
        const z = zeilen[i];
        if (z.length > 2000) continue;
        for (const m of [...regexZugang, ...regexUnsicher]) {
          m.re.lastIndex = 0;
          const tref = m.re.exec(z);
          if (!tref) continue;
          const wert = m.gruppe ? tref[m.gruppe] : tref[0];
          if (m.entropie && !wirktZufaellig(wert)) continue;
          // Unsichere Konstrukte in Dokumentation sind Beispiele, keine Ausfuehrung.
          if (!m.geheim && istDoku(rel)) continue;
          let schwere = m.schwere, rat = m.rat;
          if (m.id === "private-key") {
            if (getrackteDateien.has(rel)) {
              schwere = "kritisch";
              rat = "Schluessel liegt im Repository. Als kompromittiert behandeln, neu erzeugen, altes ueberall austauschen und aus dem Verlauf entfernen.";
            } else {
              rat = "Schluesselmaterial liegt offen im Projektordner, aber nicht im Repository. In den Schluesselbund oder nach ~/.ssh verschieben und die Dateirechte auf 600 setzen.";
            }
          }
          melde(m.id, schwere, m.titel, rel, m.geheim ? wert : null, rat, i + 1);
        }
      }
    }
  }
}

function pruefeGitignore(repo) {
  const rel = path.relative(projekt, repo) || ".";
  const gi = path.join(repo, ".gitignore");
  let inhalt = "";
  try { inhalt = fs.readFileSync(gi, "utf8"); } catch {
    melde("gitignore-fehlt", "mittel", "Keine .gitignore vorhanden", rel, null,
      "Anlegen und mindestens .env, node_modules/ und Schluesseldateien eintragen.");
    return;
  }
  if (!/^\s*\.env/m.test(inhalt)) {
    melde("gitignore-env", "hoch", ".env fehlt in der .gitignore", path.join(rel, ".gitignore"), null,
      "Zeile .env ergaenzen, sonst landen Zugangsdaten frueher oder spaeter im Repository.");
  }
}

function pruefeVerlauf(repo, stand) {
  const rel = path.relative(projekt, repo) || ".";
  // Behauptet jemand, ein Verlaufsbefund sei erledigt, wird der Verlauf komplett
  // neu gelesen statt nur ab dem letzten Commit — sonst pruefen wir nie nach.
  const behauptetErledigt = (stand.befunde || []).some(b =>
    b.typ.startsWith("verlauf-") && b.ort.startsWith(rel) && b.status !== "offen");
  const seit = behauptetErledigt ? null : (stand.letzterCommit?.[rel] || null);
  if (behauptetErledigt) hinweise.push("Verlauf vollstaendig neu geprueft (fruehere Meldung 'erledigt' wird gegengeprueft).");
  const bereich = seit ? seit + "..HEAD" : "-50";
  const commits = sh("git", ["-C", repo, "log", "--oneline", seit ? bereich : "-50"]);
  const anzahl = commits ? commits.trim().split("\n").filter(Boolean).length : 0;
  if (!anzahl) return { commits: 0 };

  const diff = seit
    ? sh("git", ["-C", repo, "diff", "--unified=0", bereich])
    : sh("git", ["-C", repo, "log", "-p", "-50", "--unified=0"]);
  if (diff) {
    for (const z of diff.split("\n")) {
      if (!z.startsWith("+") || z.startsWith("+++")) continue;
      for (const m of regexZugang) {
        m.re.lastIndex = 0;
        const tref = m.re.exec(z);
        if (!tref) continue;
        const wert = m.gruppe ? tref[m.gruppe] : tref[0];
        if (m.entropie && !wirktZufaellig(wert)) continue;
        melde("verlauf-" + m.id, "kritisch", m.titel + " im Git-Verlauf", rel + " (Commit-Verlauf)", wert,
          m.rat + " Zusaetzlich: der Wert steht im Verlauf und bleibt dort, bis der Verlauf umgeschrieben wird.");
        break;
      }
    }
  }
  return { commits: anzahl };
}

function pruefeSichtbarkeit(repo) {
  const rel = path.relative(projekt, repo) || ".";
  const url = sh("git", ["-C", repo, "remote", "get-url", "origin"]);
  if (!url || !/github\.com/.test(url)) return null;
  const slug = (url.match(/github\.com[/:]([^/]+\/[^/.\s]+)/) || [])[1];
  if (!slug) return null;
  const out = sh("gh", ["repo", "view", slug, "--json", "visibility,isPrivate"]);
  if (!out) return null;
  try {
    const j = JSON.parse(out);
    if (j.isPrivate === false) {
      hinweise.push("Repository " + slug + " ist oeffentlich.");
      return { slug, oeffentlich: true, rel };
    }
    return { slug, oeffentlich: false, rel };
  } catch { return null; }
}

function pruefeAbhaengigkeiten(repo, stand) {
  const rel = path.relative(projekt, repo) || ".";
  const pj = path.join(repo, "package.json");
  if (!fs.existsSync(pj)) return { neu: [] };

  let paket; try { paket = JSON.parse(fs.readFileSync(pj, "utf8")); } catch { return { neu: [] }; }
  const deps = Object.keys({ ...(paket.dependencies || {}), ...(paket.devDependencies || {}) });

  const lock = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"].find(f => fs.existsSync(path.join(repo, f)));
  if (deps.length && !lock) {
    melde("lockfile-fehlt", "hoch", "Keine Lockdatei vorhanden", rel, null,
      "npm install ausfuehren und die Lockdatei einchecken. Ohne sie sind die Versionen nicht festgelegt.");
  } else if (lock) {
    const getrackt = sh("git", ["-C", repo, "ls-files", lock]);
    if (!getrackt || !getrackt.trim()) {
      melde("lockfile-nicht-getrackt", "mittel", "Lockdatei nicht unter Versionskontrolle", path.join(rel, lock), null,
        "Lockdatei einchecken, damit alle dieselben Versionen bekommen.");
    }
  }

  const bekannt = new Set(stand.abhaengigkeiten || []);
  const neu = deps.filter(d => !bekannt.has(d));
  return { neu, alle: deps, rel };
}

async function pruefeRegistry(neu, rel) {
  if (!neu.length) return;
  fs.mkdirSync(CACHE, { recursive: true });
  for (const paketName of neu.slice(0, 25)) {
    if (abgelaufen()) { hinweise.push("Zeitbudget erreicht — Registry-Pruefung unvollstaendig."); return; }
    const cacheDatei = path.join(CACHE, "pkg-" + paketName.replace(/[^a-z0-9._-]/gi, "_") + ".json");
    let info = null;
    try { info = JSON.parse(fs.readFileSync(cacheDatei, "utf8")); } catch {}
    if (!info) {
      try {
        const c = new AbortController();
        const tm = setTimeout(() => c.abort(), Math.min(6000, Math.max(1000, restzeit())));
        const r = await fetch("https://registry.npmjs.org/" + encodeURIComponent(paketName), { signal: c.signal });
        clearTimeout(tm);
        if (r.status === 404) {
          melde("paket-existiert-nicht", "kritisch", "Abhaengigkeit existiert nicht in der Registry", rel + " → " + paketName, null,
            "Dieses Paket gibt es nicht. Typischer Fall einer erfundenen Bibliothek. Eintrag entfernen und pruefen, woher er kam.");
          continue;
        }
        if (!r.ok) continue;
        const j = await r.json();
        const erstellt = j.time?.created || null;
        let downloads = null;
        try {
          const c2 = new AbortController();
          const tm2 = setTimeout(() => c2.abort(), 4000);
          const d = await fetch("https://api.npmjs.org/downloads/point/last-week/" + encodeURIComponent(paketName), { signal: c2.signal });
          clearTimeout(tm2);
          if (d.ok) downloads = (await d.json()).downloads;
        } catch {}
        info = { erstellt, downloads };
        fs.writeFileSync(cacheDatei, JSON.stringify(info));
      } catch { continue; }
    }
    if (!info) continue;
    const alterTage = info.erstellt ? (Date.now() - new Date(info.erstellt)) / 86400000 : 9999;
    if (alterTage < 90 && (info.downloads ?? 0) < 1000) {
      melde("paket-verdaechtig", "hoch", "Neue Abhaengigkeit mit wenig Verbreitung", rel + " → " + paketName, null,
        "Paket ist " + Math.round(alterTage) + " Tage alt und hat " + (info.downloads ?? "unbekannt") +
        " Downloads pro Woche. Vor der Uebernahme pruefen, ob der Name stimmt und wer dahintersteht.");
    }
  }
}

function pruefeAudit(repo) {
  const rel = path.relative(projekt, repo) || ".";
  const lockPfad = path.join(repo, "package-lock.json");
  if (!fs.existsSync(lockPfad)) return;
  if (abgelaufen()) { hinweise.push("Zeitbudget erreicht — npm audit uebersprungen."); return; }

  fs.mkdirSync(CACHE, { recursive: true });
  const hash = crypto.createHash("sha1").update(fs.readFileSync(lockPfad)).digest("hex").slice(0, 16);
  const cacheDatei = path.join(CACHE, "audit-" + hash + ".json");
  let ergebnis = null;
  try { ergebnis = JSON.parse(fs.readFileSync(cacheDatei, "utf8")); } catch {}
  if (!ergebnis) {
    const out = sh("npm", ["audit", "--omit=dev", "--json"], { cwd: repo, timeout: Math.min(25000, Math.max(3000, restzeit())) });
    if (!out) return;
    try { ergebnis = JSON.parse(out); fs.writeFileSync(cacheDatei, JSON.stringify(ergebnis)); } catch { return; }
  }
  const v = ergebnis.metadata?.vulnerabilities || {};
  const abb = { critical: "kritisch", high: "hoch", moderate: "mittel", low: "niedrig" };
  for (const [stufe, schwere] of Object.entries(abb)) {
    if (!v[stufe]) continue;
    melde("audit-" + stufe, stufe === "critical" ? "hoch" : schwere,
      v[stufe] + " Schwachstelle(n) der Stufe " + stufe + " in Abhaengigkeiten", rel, null,
      "npm audit fix ausfuehren; wo das nicht reicht, die betroffene Abhaengigkeit ersetzen.");
  }
}

async function pruefeHeader(url) {
  if (!url) return;
  if (abgelaufen()) { hinweise.push("Zeitbudget erreicht — Header-Pruefung uebersprungen."); return; }
  const noetig = {
    "strict-transport-security": "Strict-Transport-Security",
    "x-content-type-options": "X-Content-Type-Options",
    "x-frame-options": "X-Frame-Options",
    "content-security-policy": "Content-Security-Policy",
    "referrer-policy": "Referrer-Policy"
  };
  try {
    const c = new AbortController();
    const tm = setTimeout(() => c.abort(), Math.min(8000, Math.max(2000, restzeit())));
    const r = await fetch(url, { method: "GET", redirect: "follow", signal: c.signal });
    clearTimeout(tm);
    const fehlend = Object.entries(noetig).filter(([k]) => !r.headers.get(k)).map(([, n]) => n);
    if (fehlend.length >= 3) {
      melde("header", fehlend.length === 5 ? "hoch" : "mittel",
        fehlend.length + " von 5 Sicherheits-Headern fehlen", url, null,
        "Fehlend: " + fehlend.join(", ") + ". In der Server- oder Proxy-Konfiguration setzen — wenige Zeilen.");
    }
  } catch { hinweise.push("Live-URL nicht erreichbar: " + url); }
}

/* ------------------------------------------------------------------ Lauf */

const stand = ladeStand();

/* Manuelle Statuswechsel: sofort schreiben und beenden, ohne neuen Lauf. */
/* Bereits behobene Befunde nachtraeglich als Lektionen in den Vault schreiben —
   fuer Projekte, die vor der Vault-Anbindung geprueft wurden. */
if (nachtragenModus) {
  const fertig = (stand.befunde || []).filter(b => b.status === "behoben");
  if (!fertig.length) { console.log("Keine behobenen Befunde zum Nachtragen."); process.exit(0); }
  let n = 0;
  for (const b of fertig) { if (lektionSchreiben(b, path.basename(projekt), b.loesung)) n++; }
  if (n) uebersichtSchreiben();
  console.log(n + " von " + fertig.length + " behobenen Befunden als Lektion eingetragen.");
  const offeneLoesung = fertig.filter(b => !b.loesung);
  if (offeneLoesung.length) {
    console.log("\nOhne dokumentierte Loesung — bitte nachtragen:");
    for (const b of offeneLoesung) console.log("  --loesung-fuer=" + b.id + "  (" + b.titel + ")");
  }
  process.exit(0);
}

if (loesungFuer) {
  const b = (stand.befunde || []).find(x => x.id === loesungFuer);
  if (!b) { console.error("Kein Befund mit der Kennung " + loesungFuer); process.exit(1); }
  if (!loesung) { console.error("Bitte --loesung=\"...\" angeben"); process.exit(1); }
  b.loesung = loesung;
  fs.mkdirSync(sicherheitsDir, { recursive: true });
  fs.writeFileSync(standDatei, JSON.stringify(stand, null, 2));
  const nachgetragen = loesungNachtragen(b, path.basename(projekt), loesung);
  fs.appendFileSync(historieDatei, "\n- " + new Date().toLocaleDateString("de-DE") + " · `" + loesungFuer +
    "` Loesung dokumentiert: " + loesung + "\n");
  console.log("Loesung gespeichert" + (nachgetragen ? " und in die Lektion im Vault eingetragen." : "."));
  process.exit(0);
}

if (erledigtId || zurueckId) {
  const zielId = erledigtId || zurueckId;
  const treffer = (stand.befunde || []).find(b => b.id === zielId);
  if (!treffer) { console.error("Kein Befund mit der Kennung " + zielId); process.exit(1); }
  if (zurueckId && !grund) { console.error("Zurueckstellen erfordert --grund=\"...\""); process.exit(1); }
  treffer.status = erledigtId ? "behoben" : "zurückgestellt";
  if (erledigtId) { treffer.behobenAm = new Date().toISOString().slice(0, 10); if (loesung) treffer.loesung = loesung; }
  else { treffer.begruendung = grund; treffer.entschiedenVon = wer; treffer.zurueckgestelltAm = new Date().toISOString().slice(0, 10); }
  fs.mkdirSync(sicherheitsDir, { recursive: true });
  fs.writeFileSync(standDatei, JSON.stringify(stand, null, 2));
  const zeile = "\n- " + new Date().toLocaleDateString("de-DE") + " · `" + zielId + "` " +
    (erledigtId ? "als behoben markiert" : "zurueckgestellt: " + grund + " (" + wer + ")") + "\n";
  fs.appendFileSync(historieDatei, zeile);
  console.log(erledigtId ? "Befund " + zielId + " als behoben markiert." : "Befund " + zielId + " zurueckgestellt.");
  process.exit(0);
}

const gefundeneRepos = repos(projekt);
pruefeInhalte(projekt);
let commitsGesamt = 0;
const neueCommits = {};
let sichtbarkeit = null;

for (const repo of gefundeneRepos) {
  const rel = path.relative(projekt, repo) || ".";
  pruefeGetrackteDateien(repo);
  pruefeGitignore(repo);
  const v = pruefeVerlauf(repo, stand);
  commitsGesamt += v.commits || 0;
  const head = sh("git", ["-C", repo, "rev-parse", "HEAD"]);
  if (head) neueCommits[rel] = head.trim();
  const s = pruefeSichtbarkeit(repo);
  if (s?.oeffentlich) sichtbarkeit = s;
  const dep = pruefeAbhaengigkeiten(repo, stand);
  if (dep.neu?.length) await pruefeRegistry(dep.neu, dep.rel);
  stand.abhaengigkeiten = [...new Set([...(stand.abhaengigkeiten || []), ...(dep.alle || [])])];
  pruefeAudit(repo);
}

/* Oeffentliches Repo + Zugangsdatum darin = die schlimmste Kombination. */
if (sichtbarkeit?.oeffentlich && befunde.some(b => b.schwere === "kritisch" && /token|key|passwor|secret|env|jwt/i.test(b.typ + b.titel))) {
  melde("oeffentlich-mit-geheimnis", "kritisch", "Oeffentliches Repository enthaelt ein Zugangsdatum",
    sichtbarkeit.slug, null,
    "Sofort handeln: Wert widerrufen und rotieren, dann Repository auf privat stellen. Ein einmal oeffentlicher Wert gilt als kompromittiert.");
}

let liveUrl = liveArg;
if (!liveUrl) {
  try {
    const wm = fs.readFileSync(path.join(projekt, "10_Weitermachen", "weitermachen.md"), "utf8");
    liveUrl = (wm.match(/\*\*Live[^:]*:\*\*\s*(https?:\/\/\S+)/i) || wm.match(/Live:\s*(https?:\/\/\S+)/i) || [])[1] || null;
    if (liveUrl) liveUrl = liveUrl.replace(/[.,)]+$/, "");
  } catch {}
}
await pruefeHeader(liveUrl);

/* ------------------------------------------------------ Abgleich mit Stand */

const jetzt = new Date();
const heute = jetzt.toISOString().slice(0, 10);
const alt = new Map((stand.befunde || []).map(b => [b.id, b]));
const aktuell = new Map();
for (const b of befunde) if (!aktuell.has(b.id)) aktuell.set(b.id, b);

const neu = [], weiterhin = [], behoben = [];
for (const [bid, b] of aktuell) {
  const vorher = alt.get(bid);
  if (!vorher) {
    neu.push({ ...b, zuerstGesehen: heute, zuletztGesehen: heute, status: "offen", hubTaskId: null });
  } else {
    const zusammen = { ...vorher, ...b, zuletztGesehen: heute };

    if (vorher.status === "behoben") {
      // Rueckfall: war als behoben eingetragen und ist wieder da.
      zusammen.status = "offen";
      zusammen.rueckfall = true;
      zusammen.warBehobenAm = vorher.behobenAm || vorher.zuletztGesehen || null;
      delete zusammen.behobenAm;
      // Die alte Aufgabe wurde als erledigt gemeldet — fuer den Rueckfall braucht es eine neue.
      zusammen.hubTaskId = null;
    } else if (vorher.status === "zurückgestellt") {
      const tage = vorher.zurueckgestelltAm
        ? Math.floor((Date.now() - new Date(vorher.zurueckgestelltAm)) / 86400000) : 999;
      if (tage >= ZURUECKSTELLUNG_TAGE) {
        // Zurueckstellungen laufen ab, damit sie keine dauerhafte Ausnahme werden.
        zusammen.status = "offen";
        zusammen.abgelaufen = true;
        zusammen.zurueckgestelltTage = tage;
        // Beim Zurueckstellen wurde die Aufgabe geschlossen — fuer den wieder offenen
        // Befund braucht es eine neue, sonst bliebe er im Hub unsichtbar.
        zusammen.hubTaskId = null;
      } else {
        zusammen.status = "zurückgestellt";
        zusammen.zurueckgestelltTage = tage;
      }
    } else {
      zusammen.status = vorher.status;
    }
    weiterhin.push(zusammen);
  }
}
/** Ein Paket-Befund gilt erst als behoben, wenn das Paket wirklich aus den
 *  Abhaengigkeiten verschwunden ist — nicht schon, weil es nicht neu war. */
const aktuellePakete = new Set();
for (const repo of gefundeneRepos) {
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
    for (const d of Object.keys({ ...(pj.dependencies || {}), ...(pj.devDependencies || {}) })) aktuellePakete.add(d);
  } catch {}
}

/** Frueher behobene Befunde. Sie bleiben im Zustand, damit ein Rueckfall auch nach Monaten
 *  noch als Rueckfall erkannt wird und nicht als neuer Befund — und damit eine Hub-Aufgabe,
 *  die bei einem Lauf mit --kein-hub offen blieb, spaeter noch geschlossen werden kann. */
const frueherBehoben = [];

for (const [bid, b] of alt) {
  if (aktuell.has(bid)) continue;
  if (b.status === "behoben") { frueherBehoben.push(b); continue; }
  if (b.dauerhaft) {
    if (b.typ.startsWith("paket-")) {
      const paketName = (b.ort.split("→").pop() || "").trim();
      if (paketName && !aktuellePakete.has(paketName)) { behoben.push({ ...b, status: "behoben", behobenAm: heute }); continue; }
    }
    // Git-Verlauf: ein einmal eingecheckter Wert bleibt im Verlauf. Nur ein Mensch
    // kann das schliessen (--erledigt), nachdem der Verlauf umgeschrieben wurde.
    if (b.status === "offen") { weiterhin.push({ ...b, zuletztGesehen: b.zuletztGesehen }); continue; }
    weiterhin.push(b);
    continue;
  }
  behoben.push({ ...b, status: "behoben", behobenAm: heute });
}

const neuerStand = {
  version: 1,
  letztePruefung: jetzt.toISOString(),
  letzterCommit: { ...(stand.letzterCommit || {}), ...neueCommits },
  abhaengigkeiten: stand.abhaengigkeiten || [],
  befunde: [...neu, ...weiterhin, ...behoben, ...frueherBehoben]
};

const offen = [...neu, ...weiterhin].filter(b => b.status === "offen");
const zurueckgestelltAktiv = weiterhin.filter(b => b.status === "zurückgestellt");
const rueckfaelle = offen.filter(b => b.rueckfall);
const abgelaufene = offen.filter(b => b.abgelaufen);
const kritischOffen = offen.filter(b => b.schwere === "kritisch");
const dauer = Math.round((Date.now() - t0) / 1000);

fs.mkdirSync(sicherheitsDir, { recursive: true });
fs.writeFileSync(standDatei, JSON.stringify(neuerStand, null, 2));

/* --- Aus behobenen Befunden Lektionen im Vault machen --- */
const gelernt = [];
const ohneLoesung = [];
for (const b of behoben) {
  // Nur mit dokumentierter Loesung entsteht eine Lektion. Ein Befund, der
  // verschwindet, weil sich eine Regel geaendert hat, ist keine Behebung —
  // daraus zu "lernen" wuerde den Wissensspeicher mit Phantomen fuellen.
  if (!b.loesung) { ohneLoesung.push(b); continue; }
  const r = lektionSchreiben(b, path.basename(projekt), b.loesung);
  if (r) gelernt.push({ ...b, ...r });
}
if (gelernt.length) uebersichtSchreiben();

/* --- Befunde in den Hub spiegeln --- */
let hubErgebnis = { angelegt: 0, erledigt: 0, uebernommen: 0, geparkt: 0, hinweis: null };
if (!keinHub) {
  hubErgebnis = await hubAbgleichen({
    projekt, befunde: neuerStand.befunde, behoben,
    abSchwere: hubAb, ablaufTage: ZURUECKSTELLUNG_TAGE,
    zeitLimit: Math.max(3000, Math.min(20000, restzeit()))
  });
  if (hubErgebnis.hinweis) hinweise.push(hubErgebnis.hinweis);
  // Die vergebenen Aufgaben-Kennungen gehoeren in den gespeicherten Stand.
  fs.writeFileSync(standDatei, JSON.stringify(neuerStand, null, 2));
}

/* --------------------------------------------------------------- Historie */

const rang = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };
const sortiert = a => [...a].sort((x, y) => rang[x.schwere] - rang[y.schwere]);

let eintrag = "\n## " + jetzt.toLocaleDateString("de-DE") + " " + jetzt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + "\n\n";
eintrag += "Dauer " + dauer + " s · " + dateienGeprueft + " Dateien · " + commitsGesamt + " Commit(s) seit der letzten Pruefung";
eintrag += " · " + gefundeneRepos.length + " Repo(s)\n\n";
if (!neu.length && !behoben.length && !rueckfaelle.length && !abgelaufene.length) {
  eintrag += "Keine Veraenderung. Offen: " + offen.length +
    (zurueckgestelltAktiv.length ? ", zurueckgestellt: " + zurueckgestelltAktiv.length : "") + ".\n";
} else {
  if (rueckfaelle.length) {
    eintrag += "**RUECKFALL (" + rueckfaelle.length + "):**\n";
    for (const b of rueckfaelle)
      eintrag += "- `" + b.id + "` " + b.schwere.toUpperCase() + " — " + b.titel + " · " + b.ort +
        " (war am " + (b.warBehobenAm || "?") + " als behoben eingetragen)\n";
    eintrag += "\n";
  }
  if (abgelaufene.length) {
    eintrag += "**Zurueckstellung abgelaufen (" + abgelaufene.length + "):**\n";
    for (const b of abgelaufene)
      eintrag += "- `" + b.id + "` " + b.titel + " — nach " + b.zurueckgestelltTage + " Tagen wieder offen\n";
    eintrag += "\n";
  }
  if (neu.length) {
    eintrag += "**Neu (" + neu.length + "):**\n";
    for (const b of sortiert(neu)) eintrag += "- `" + b.id + "` " + b.schwere.toUpperCase() + " — " + b.titel + " · " + b.ort + (b.zeile ? ":" + b.zeile : "") + "\n";
    eintrag += "\n";
  }
  if (behoben.length) {
    eintrag += "**Behoben (" + behoben.length + "):**\n";
    for (const b of behoben) eintrag += "- `" + b.id + "` " + b.titel + " · " + b.ort + " (offen seit " + b.zuerstGesehen + ")\n";
    eintrag += "\n";
  }
  if (weiterhin.filter(b => b.status === "offen").length) {
    eintrag += "**Weiterhin offen (" + weiterhin.filter(b => b.status === "offen").length + "):**\n";
    for (const b of sortiert(weiterhin.filter(b => b.status === "offen")))
      eintrag += "- `" + b.id + "` " + b.schwere.toUpperCase() + " — " + b.titel + " · offen seit " + b.zuerstGesehen + "\n";
    eintrag += "\n";
  }
}
const zurueckgestellt = neuerStand.befunde.filter(b => b.status === "zurückgestellt");
if (zurueckgestellt.length) {
  eintrag += "**Zurueckgestellt (" + zurueckgestellt.length + "):**\n";
  for (const b of zurueckgestellt) eintrag += "- `" + b.id + "` " + b.titel + " — " + (b.begruendung || "ohne Begruendung") + " (" + (b.entschiedenVon || "—") + ")\n";
  eintrag += "\n";
}
if (hinweise.length) eintrag += "_Hinweise: " + hinweise.join(" · ") + "_\n";

if (!fs.existsSync(historieDatei)) {
  fs.writeFileSync(historieDatei, "# Sicherheits-Historie — " + path.basename(projekt) + "\n\n" +
    "Automatisch fortgeschrieben von `/sicherheits-check`. Nur anhaengen, nichts loeschen.\n" +
    "Zugangsdaten stehen hier nie im Klartext — nur maskiert und als stabile Kennung.\n");
}
fs.appendFileSync(historieDatei, eintrag);

/* ----------------------------------------------------------------- Ausgabe */

if (alsJson) {
  console.log(JSON.stringify({
    projekt, dauerSekunden: dauer, dateienGeprueft, commits: commitsGesamt, repos: gefundeneRepos.length,
    neu, weiterhin: weiterhin.filter(b => b.status === "offen"), behoben,
    offen: offen.length, kritischOffen: kritischOffen.length,
    rueckfaelle, abgelaufene, zurueckgestellt: zurueckgestelltAktiv, gelernt, ohneLoesung, hub: hubErgebnis, hinweise, liveUrl,
    standDatei, historieDatei
  }, null, 2));
} else if (!neu.length && !behoben.length && !offen.length && !zurueckgestelltAktiv.length) {
  console.log("Sicherheit: keine Befunde · " + dateienGeprueft + " Dateien · " + dauer + " s");
} else if (!neu.length && !behoben.length && !offen.length) {
  console.log("Sicherheit: keine offenen Befunde, aber " + zurueckgestelltAktiv.length +
    " zurueckgestellt · " + dauer + " s");
  for (const b of zurueckgestelltAktiv)
    console.log("  [" + b.id + "] " + b.titel + " · " + b.ort + (b.zeile ? ":" + b.zeile : "") +
      "  seit " + b.zurueckgestelltTage + " Tagen, laeuft nach " + ZURUECKSTELLUNG_TAGE + " Tagen ab");
} else if (!neu.length && !behoben.length && !rueckfaelle.length && !abgelaufene.length) {
  console.log("Sicherheit: 0 neue Befunde, " + offen.length + " weiterhin offen" +
    (zurueckgestelltAktiv.length ? ", " + zurueckgestelltAktiv.length + " zurueckgestellt" : "") +
    (hubErgebnis.angelegt ? ", " + hubErgebnis.angelegt + " Hub-Aufgabe(n) angelegt" : "") +
    (hubErgebnis.geparkt ? ", " + hubErgebnis.geparkt + " Hub-Aufgabe(n) zu Zurueckstellungen geschlossen" : "") +
    " · " + dauer + " s");
} else {
  console.log("Sicherheits-Check — " + path.basename(projekt));
  console.log("Dauer " + dauer + " s · " + dateienGeprueft + " Dateien · " + commitsGesamt + " Commit(s) seit letzter Pruefung\n");
  if (rueckfaelle.length) {
    console.log("RUECKFALL  " + rueckfaelle.length + "  — war als behoben eingetragen und ist wieder da");
    for (const b of rueckfaelle)
      console.log("  [" + b.id + "] " + b.titel + " · " + b.ort + (b.zeile ? ":" + b.zeile : "") +
        "  (behoben gemeldet am " + (b.warBehobenAm || "unbekannt") + ")");
    console.log("");
  }
  if (abgelaufene.length) {
    console.log("ZURUECKSTELLUNG ABGELAUFEN  " + abgelaufene.length + "  — muss neu entschieden werden");
    for (const b of abgelaufene)
      console.log("  [" + b.id + "] " + b.titel + " · zurueckgestellt vor " + b.zurueckgestelltTage + " Tagen: " + (b.begruendung || "—"));
    console.log("");
  }
  for (const stufe of ["kritisch", "hoch", "mittel", "niedrig"]) {
    const g = offen.filter(b => b.schwere === stufe);
    if (!g.length) continue;
    console.log(stufe.toUpperCase() + "  " + g.length);
    for (const b of g) {
      const alterHinweis = b.zuerstGesehen && b.zuerstGesehen !== heute ? "  (offen seit " + b.zuerstGesehen + ")" : "  (neu)";
      console.log("  [" + b.id + "] " + b.titel + alterHinweis);
      console.log("      " + b.ort + (b.zeile ? ":" + b.zeile : "") + (b.auszug ? "   " + b.auszug : ""));
      console.log("      → " + b.rat);
    }
    console.log("");
  }
  if (zurueckgestelltAktiv.length) {
    console.log("ZURUECKGESTELLT  " + zurueckgestelltAktiv.length + "  (weiterhin vorhanden, nur bewusst aufgeschoben)");
    for (const b of zurueckgestelltAktiv) {
      console.log("  [" + b.id + "] " + b.titel + "  seit " + b.zurueckgestelltTage + " Tagen" +
        "  (laeuft nach " + ZURUECKSTELLUNG_TAGE + " Tagen ab)");
      console.log("      " + b.ort + (b.zeile ? ":" + b.zeile : ""));
      console.log("      Grund: " + (b.begruendung || "—") + " (" + (b.entschiedenVon || "—") + ")");
    }
    console.log("");
  }
  if (behoben.length) console.log("Seit der letzten Pruefung behoben: " + behoben.length);
  if (hubErgebnis.angelegt || hubErgebnis.erledigt || hubErgebnis.uebernommen) {
    const teile = [];
    if (hubErgebnis.angelegt) teile.push(hubErgebnis.angelegt + " neue [SEC]-Aufgabe" + (hubErgebnis.angelegt > 1 ? "n" : ""));
    if (hubErgebnis.erledigt) teile.push(hubErgebnis.erledigt + " als erledigt gemeldet");
    if (hubErgebnis.uebernommen) teile.push(hubErgebnis.uebernommen + " bestehende Aufgabe(n) verknuepft");
    console.log("Hub: " + teile.join(", "));
  }
  if (gelernt.length) {
    console.log("Als Lektion im Vault festgehalten: " + gelernt.map(g => g.titel + (g.vorfaelle > 1 ? " (" + g.vorfaelle + ". Vorfall)" : "")).join(", "));
  }
  if (ohneLoesung.length) {
    console.log("");
    console.log("Ohne dokumentierte Loesung entsteht keine Lektion. Bitte nachtragen:");
    for (const b of ohneLoesung)
      console.log("  node ~/.claude/werkbank/sicherheit/pruefung.mjs \"" + projekt + "\" --loesung-fuer=" + b.id + " --loesung=\"...\"");
  }
  if (hinweise.length) console.log("Hinweise: " + hinweise.join(" · "));
}

process.exit(kritischOffen.length ? 2 : 0);
