#!/usr/bin/env node
/**
 * Freigabepruefung vor Veroeffentlichung — FJ Design
 *
 * Misst, statt zu vermuten. Jeder Befund traegt seinen Beleg mit sich.
 *
 * Aufruf:
 *   node freigabe.mjs <url> [--projekt=<pfad>] [--routen=/a,/b] [--wordpress]
 *                          [--intern] [--json] [--budget=180]
 *
 * Exit: 0 = freigegeben · 1 = Fehler im Pruefer · 3 = nicht freigegeben (Blocker)
 */
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";

const NICHTS = process.platform === "win32" ? "NUL" : "/dev/null";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = n => (argv.find(a => a.startsWith("--" + n + "=")) || "").split("=").slice(1).join("=") || null;
const hat = n => argv.includes("--" + n);

const zielRoh = argv.find(a => !a.startsWith("--"));
if (!zielRoh) { console.error("Aufruf: node freigabe.mjs <url> [--projekt=<pfad>] [--wordpress] [--intern]"); process.exit(1); }
const ziel = new URL(zielRoh.startsWith("http") ? zielRoh : "https://" + zielRoh);
const projekt = opt("projekt");
const routen = (opt("routen") || "").split(",").map(s => s.trim()).filter(Boolean);
const wpPruefen = hat("wordpress");
const intern = hat("intern");           // Seite soll NICHT indexiert werden (Demo, Entwurf)
const alsJson = hat("json");
const budgetMs = (Number(opt("budget")) || 180) * 1000;

const t0 = Date.now();
const rest = () => budgetMs - (Date.now() - t0);
const knapp = () => rest() < 5000;

/* ------------------------------------------------------------ Befundsammlung */
const befunde = [];
const RANG = { blocker: 0, warnung: 1, hinweis: 2 };
/** Auf internen Seiten sind Suchmaschinen-Signale kein Mangel — sie sollen ja
 *  nicht gefunden werden. Diese Befunde werden dort zu Hinweisen abgestuft. */
const NUR_OEFFENTLICH = new Set([
  "Keine Meta-Description", "Meta-Description zu lang", "Kein Canonical",
  "Keine strukturierten Daten", "Keine Sitemap", "Wenig Open-Graph-Angaben",
  "llms.txt fehlt", "robots.txt nennt keine Sitemap", "Keine robots.txt"
]);

function melde(bereich, stufe, titel, beleg, rat) {
  if (intern && NUR_OEFFENTLICH.has(titel)) return;      // interne Seite: nicht relevant
  befunde.push({ bereich, stufe, titel, beleg: beleg == null ? null : String(beleg), rat });
}
const geprueft = [];
function ok(bereich, titel, beleg) { geprueft.push({ bereich, titel, beleg: beleg == null ? null : String(beleg) }); }

async function hole(url, optionen = {}, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), Math.min(ms, Math.max(1500, rest())));
  try {
    const r = await fetch(url, { redirect: "follow", signal: c.signal, ...optionen });
    const text = optionen.method === "HEAD" ? "" : await r.text();
    return { ok: r.ok, status: r.status, url: r.url, headers: r.headers, text };
  } catch { return null; } finally { clearTimeout(t); }
}

const sh = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15000 }); } catch { return null; } };

/* ====================================================== A · Transport ===== */
async function pruefeTransport() {
  const h1 = sh("curl", ["-sI", "-m", "15", "-o", NICHTS, "-w", "%{http_version} %{http_code}", ziel.href]);
  if (h1) {
    const [ver, code] = h1.trim().split(" ");
    if (code !== "200") melde("Transport", "blocker", "Startseite antwortet nicht mit 200", "HTTP " + code, "Vor der Freigabe klaeren, warum die Seite nicht ausliefert.");
    else ok("Transport", "Startseite antwortet", "HTTP 200");
    if (Number(ver) < 2) melde("Transport", "warnung", "Kein HTTP/2", "ausgehandelt: HTTP/" + ver,
      "HTTP/2 im Server oder Proxy aktivieren. Bei vielen Einzeldateien der groesste Einzelgewinn.");
    else ok("Transport", "HTTP/2 oder neuer", "HTTP/" + ver);
  }

  // HTTPS erzwungen?
  const klar = sh("curl", ["-sI", "-m", "12", "-o", NICHTS, "-w", "%{http_code} %{redirect_url}", "http://" + ziel.host + ziel.pathname]);
  if (klar) {
    const [code, ziel2] = klar.trim().split(" ");
    if (/^(301|302|307|308)$/.test(code) && /^https:/.test(ziel2 || "")) ok("Transport", "HTTP leitet auf HTTPS um", code);
    else if (code === "200") melde("Transport", "blocker", "Seite ist auch unverschluesselt erreichbar", "http:// antwortet mit 200",
      "Weiterleitung auf HTTPS einrichten. Bei Seiten hinter Cloudflare: dort 'Always Use HTTPS' fuer die Zone aktivieren — das gilt dann fuer alle Subdomains. HSTS allein reicht nicht, es wirkt erst nach dem ersten HTTPS-Besuch.");
  }

  // Kompression
  const komp = sh("curl", ["-sI", "-m", "12", "-H", "Accept-Encoding: gzip, deflate, br", "-o", NICHTS, "-w", "%{content_type}", ziel.href]);
  const kh = sh("curl", ["-sI", "-m", "12", "-H", "Accept-Encoding: gzip, deflate, br", ziel.href]);
  if (kh) {
    const enc = (kh.match(/content-encoding:\s*(\S+)/i) || [])[1];
    if (!enc) melde("Transport", "warnung", "Keine Kompression", "kein content-encoding", "gzip mindestens, besser Brotli aktivieren.");
    else if (/^gzip$/i.test(enc)) { ok("Transport", "Kompression aktiv", enc); melde("Transport", "hinweis", "Brotli fehlt", "nur " + enc, "Brotli spart gegenueber gzip nochmals rund 15 Prozent."); }
    else ok("Transport", "Kompression aktiv", enc);
  }

  // Zertifikat
  const cert = sh("bash", ["-c", "echo | openssl s_client -servername " + ziel.hostname + " -connect " + ziel.hostname + ":443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null"]);
  if (cert) {
    const bis = new Date((cert.match(/notAfter=(.*)/) || [])[1]);
    const tage = Math.round((bis - Date.now()) / 86400000);
    if (tage < 0) melde("Transport", "blocker", "TLS-Zertifikat abgelaufen", bis.toLocaleDateString("de-DE"), "Sofort erneuern.");
    else if (tage < 14) melde("Transport", "warnung", "TLS-Zertifikat laeuft bald ab", "noch " + tage + " Tage", "Erneuerung pruefen.");
    else ok("Transport", "TLS-Zertifikat gueltig", "noch " + tage + " Tage");
  }
}

/* ============================================== B · Sicherheits-Header ==== */
const HEADER = {
  "strict-transport-security": ["Strict-Transport-Security", "blocker"],
  "x-content-type-options": ["X-Content-Type-Options", "blocker"],
  "x-frame-options": ["X-Frame-Options", "warnung"],
  "content-security-policy": ["Content-Security-Policy", "warnung"],
  "referrer-policy": ["Referrer-Policy", "warnung"]
};
async function pruefeHeader(r) {
  if (!r) return;
  const fehlend = [];
  for (const [k, [name, stufe]] of Object.entries(HEADER)) {
    if (r.headers.get(k)) ok("Header", name + " gesetzt", r.headers.get(k).slice(0, 60));
    else fehlend.push([name, stufe]);
  }
  for (const [name, stufe] of fehlend)
    melde("Header", stufe, name + " fehlt", "nicht gesetzt",
      "In der Server- oder Proxy-Konfiguration ergaenzen. Bei nginx in JEDEM Block mit add_header wiederholen.");
}

/* ================================================== C · Auszeichnung ====== */
function textVon(html, re) { const m = html.match(re); return m ? m[1].trim() : null; }

async function pruefeAuszeichnung(r) {
  if (!r || !r.text) return null;
  const h = r.text;

  const titel = textVon(h, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titel) melde("Auszeichnung", "blocker", "Kein Seitentitel", "<title> fehlt", "Titel setzen, hoechstens 60 Zeichen.");
  else if (titel.length > 60) melde("Auszeichnung", "warnung", "Seitentitel zu lang", titel.length + " Zeichen", "Auf 60 Zeichen kuerzen, sonst schneidet Google ab.");
  else ok("Auszeichnung", "Seitentitel", titel.length + " Zeichen");

  const desc = textVon(h, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
            || textVon(h, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  if (!desc) melde("Auszeichnung", "warnung", "Keine Meta-Description", "fehlt", "Beschreibung ergaenzen, hoechstens 155 Zeichen.");
  else if (desc.length > 155) melde("Auszeichnung", "hinweis", "Meta-Description zu lang", desc.length + " Zeichen", "Auf 155 Zeichen kuerzen.");
  else ok("Auszeichnung", "Meta-Description", desc.length + " Zeichen");

  const h1 = [...h.matchAll(/<h1[\s>]/gi)].length;
  if (h1 === 0) melde("Auszeichnung", "blocker", "Keine H1", "0 gefunden", "Genau eine H1 setzen — das staerkste Signal, worum es auf der Seite geht.");
  else if (h1 > 1) melde("Auszeichnung", "warnung", "Mehr als eine H1", h1 + " gefunden", "Auf eine H1 reduzieren.");
  else ok("Auszeichnung", "Genau eine H1", "1");

  const canon = textVon(h, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (!canon) melde("Auszeichnung", "warnung", "Kein Canonical", "fehlt", "Selbstverweisenden Canonical setzen.");
  else ok("Auszeichnung", "Canonical gesetzt", canon.slice(0, 70));

  if (!/<html[^>]+lang=/i.test(h)) melde("Auszeichnung", "warnung", "Kein lang-Attribut", "<html> ohne lang", "Sprache setzen, z. B. lang=\"de\".");
  else ok("Auszeichnung", "Sprache gesetzt", (h.match(/<html[^>]+lang=["']([^"']+)/i) || [])[1]);

  if (!/name=["']viewport["']/i.test(h)) melde("Auszeichnung", "blocker", "Kein Viewport-Meta", "fehlt", "Ohne Viewport-Meta ist die Seite auf Mobilgeraeten unbrauchbar.");
  else ok("Auszeichnung", "Viewport-Meta", "vorhanden");

  const og = [...h.matchAll(/property=["']og:/gi)].length;
  if (og < 3) melde("Auszeichnung", "hinweis", "Wenig Open-Graph-Angaben", og + " gefunden", "og:title, og:description und og:image ergaenzen — sonst sehen geteilte Links kahl aus.");
  else ok("Auszeichnung", "Open Graph", og + " Angaben");

  const ld = [...h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!ld.length) melde("Auszeichnung", "warnung", "Keine strukturierten Daten", "kein JSON-LD", "JSON-LD ergaenzen — Grundlage fuer Suchergebnisse und Antwortmaschinen.");
  else {
    let kaputt = 0, typen = [];
    for (const m of ld) { try { const j = JSON.parse(m[1]); (j["@graph"] || [j]).forEach(x => typen.push(x["@type"])); } catch { kaputt++; } }
    if (kaputt) melde("Auszeichnung", "blocker", "JSON-LD ist fehlerhaft", kaputt + " von " + ld.length + " nicht lesbar", "Ungueltiges JSON-LD wird ignoriert — Syntax pruefen.");
    else ok("Auszeichnung", "JSON-LD gueltig", typen.flat().filter(Boolean).join(", ").slice(0, 60));
  }

  // Indexierbarkeit — Absicht pruefen, nicht raten
  const robotsMeta = textVon(h, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i) || "";
  const robotsKopf = r.headers.get("x-robots-tag") || "";
  const gesperrt = /noindex/i.test(robotsMeta + " " + robotsKopf);
  if (intern && !gesperrt) melde("Auszeichnung", "blocker", "Interne Seite ist indexierbar", "kein noindex",
    "Mit --intern aufgerufen, aber die Seite ist fuer Suchmaschinen offen. noindex setzen.");
  else if (!intern && gesperrt) melde("Auszeichnung", "blocker", "Oeffentliche Seite ist auf noindex", (robotsMeta || robotsKopf).slice(0, 50),
    "Die Seite soll veroeffentlicht werden, ist aber fuer Suchmaschinen gesperrt. noindex entfernen.");
  else ok("Auszeichnung", intern ? "noindex gesetzt (interne Seite)" : "Indexierung erlaubt", (robotsMeta || robotsKopf || "kein robots-Tag").slice(0, 40));

  // Bilder ohne Alt
  const bilder = [...h.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const ohneAlt = bilder.filter(b => !/\salt=/i.test(b));
  if (ohneAlt.length) melde("Inhalt", ohneAlt.length > bilder.length / 2 ? "warnung" : "hinweis",
    "Bilder ohne Alt-Text", ohneAlt.length + " von " + bilder.length, "Alt-Texte ergaenzen — Barrierefreiheit und Bildersuche.");
  else if (bilder.length) ok("Inhalt", "Alle Bilder mit Alt-Text", bilder.length + " Bilder");

  return h;
}

/* ============================================ D · Dateien am Wurzelpfad === */
async function pruefeWurzeldateien() {
  const basis = ziel.origin;
  const robots = await hole(basis + "/robots.txt");
  if (!robots || robots.status !== 200) melde("Auslieferung", "warnung", "Keine robots.txt", "HTTP " + (robots?.status ?? "—"), "robots.txt anlegen, mindestens mit Verweis auf die Sitemap.");
  else {
    ok("Auslieferung", "robots.txt erreichbar", "HTTP 200");
    const gesperrt = (robots.text.match(/^Disallow:\s*(\/wp-content\/(themes|plugins)|\/assets|\/static|\/_next)/gim) || []);
    if (gesperrt.length) melde("Auslieferung", "blocker", "robots.txt sperrt Darstellungsdateien",
      gesperrt.join(" · ").slice(0, 90),
      "Google rendert die Seite vor der Bewertung. Was es nicht laden darf, fehlt beim Rendern. Diese Sperren entfernen.");
    if (!/sitemap:/i.test(robots.text)) melde("Auslieferung", "hinweis", "robots.txt nennt keine Sitemap", "kein Sitemap-Eintrag", "Zeile Sitemap: <url> ergaenzen.");
  }

  for (const [datei, stufe, rat] of [
    ["/sitemap.xml", "warnung", "Sitemap anlegen, damit Suchmaschinen alle Seiten finden."],
    ["/sitemap_index.xml", null, null],
    ["/llms.txt", "hinweis", "llms.txt anlegen — Orientierung fuer Antwortmaschinen."]
  ]) {
    if (stufe === null) continue;
    const r = await hole(ziel.origin + datei, { method: "HEAD" });
    if (r && r.status === 200) ok("Auslieferung", datei.slice(1) + " erreichbar", "HTTP 200");
    else if (datei === "/sitemap.xml") {
      const alt = await hole(ziel.origin + "/sitemap_index.xml", { method: "HEAD" });
      if (alt && alt.status === 200) ok("Auslieferung", "sitemap_index.xml erreichbar", "HTTP 200");
      else melde("Auslieferung", stufe, "Keine Sitemap", "HTTP " + (r?.status ?? "—"), rat);
    } else melde("Auslieferung", stufe, datei.slice(1) + " fehlt", "HTTP " + (r?.status ?? "—"), rat);
  }
}

/* =============================================== E · Pflichtangaben (DE) == */
async function pruefePflicht(html) {
  if (intern) { ok("Pflichtangaben", "Uebersprungen (interne Seite)", null); return; }
  const kandidaten = { Impressum: /href=["']([^"']*(impressum|imprint|legal-notice)[^"']*)["']/i,
                       Datenschutz: /href=["']([^"']*(datenschutz|privacy)[^"']*)["']/i };
  for (const [was, re] of Object.entries(kandidaten)) {
    const treffer = html ? (html.match(re) || [])[1] : null;
    if (!treffer) { melde("Pflichtangaben", "blocker", was + " nicht verlinkt", "kein Link gefunden",
      was + " muss von jeder Seite aus erreichbar sein. In Deutschland abmahnfaehig."); continue; }
    const url = new URL(treffer, ziel.origin).href;
    const r = await hole(url, { method: "HEAD" });
    if (r && r.status === 200) ok("Pflichtangaben", was + " erreichbar", url.slice(0, 60));
    else melde("Pflichtangaben", "blocker", was + " verlinkt, aber nicht erreichbar", "HTTP " + (r?.status ?? "—"), "Ziel des Links pruefen.");
  }
}

/* ================================================ F · Weitere Routen ====== */
async function pruefeRouten() {
  for (const rt of routen) {
    if (knapp()) { melde("Auslieferung", "hinweis", "Zeitbudget erreicht", "Routen nicht vollstaendig geprueft", "Mit hoeherem --budget erneut laufen lassen."); break; }
    const url = new URL(rt, ziel.origin).href;
    const r = await hole(url, { method: "HEAD" });
    if (r && r.status === 200) ok("Auslieferung", "Route antwortet: " + rt, "HTTP 200");
    else melde("Auslieferung", "blocker", "Route antwortet nicht: " + rt, "HTTP " + (r?.status ?? "—"), "Vor der Freigabe klaeren.");
  }
}

/* =============================================== G · Projekt und Repo ===== */
function pruefeProjekt() {
  if (!projekt) return;
  if (!fs.existsSync(projekt)) { melde("Projekt", "hinweis", "Projektpfad nicht gefunden", projekt, "Pfad pruefen."); return; }

  const stand = path.join(projekt, "10_Weitermachen", "sicherheit", "befunde.json");
  if (fs.existsSync(stand)) {
    try {
      const j = JSON.parse(fs.readFileSync(stand, "utf8"));
      const offen = j.befunde.filter(b => b.status === "offen");
      const schwer = offen.filter(b => b.schwere === "kritisch" || b.schwere === "hoch");
      if (schwer.length) melde("Projekt", "blocker", "Offene Sicherheitsbefunde", schwer.length + " ab Schwere hoch",
        "Erst den /sicherheits-check abarbeiten: " + schwer.map(b => b.id).join(", "));
      else ok("Projekt", "Keine schweren Sicherheitsbefunde offen", offen.length + " offen insgesamt");
      const alt = j.letztePruefung ? Math.round((Date.now() - new Date(j.letztePruefung)) / 86400000) : null;
      if (alt !== null && alt > 7) melde("Projekt", "warnung", "Sicherheitsprüfung veraltet", "vor " + alt + " Tagen", "/sicherheits-check erneut laufen lassen.");
    } catch {}
  } else melde("Projekt", "warnung", "Noch nie sicherheitsgeprueft", "keine befunde.json",
    "node ~/.claude/skills/sicherheits-check/pruefung.mjs \"" + projekt + "\" ausfuehren.");

  // Repo gesichert?
  const repos = [];
  const suche = (d, t) => {
    if (t > 3) return; let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    if (e.some(x => x.isDirectory() && x.name === ".git")) { repos.push(d); return; }
    for (const x of e) if (x.isDirectory() && !x.name.startsWith(".") && x.name !== "node_modules") suche(path.join(d, x.name), t + 1);
  };
  suche(projekt, 0);
  for (const r of repos) {
    const name = path.relative(projekt, r) || ".";
    const remote = sh("git", ["-C", r, "remote", "get-url", "origin"]);
    if (!remote) { melde("Projekt", "warnung", "Repo ohne Remote: " + name, "kein origin", "Ohne Remote gibt es keine Sicherung ausserhalb dieses Rechners."); continue; }
    const lokal = (sh("git", ["-C", r, "rev-parse", "HEAD"]) || "").trim();
    const zweig = (sh("git", ["-C", r, "branch", "--show-current"]) || "").trim();
    const fern = (sh("git", ["-C", r, "ls-remote", "origin", zweig]) || "").split("\t")[0];
    const offen = (sh("git", ["-C", r, "status", "--short"]) || "").trim();
    if (offen) melde("Projekt", "warnung", "Nicht eingecheckte Aenderungen: " + name, offen.split("\n").length + " Dateien", "Vor der Freigabe committen und pushen.");
    if (fern && lokal && fern !== lokal) melde("Projekt", "warnung", "Lokaler Stand nicht gepusht: " + name, zweig, "git push ausfuehren, sonst ist der Live-Stand nicht reproduzierbar.");
    else if (fern && lokal === fern) ok("Projekt", "Repo gesichert: " + name, zweig + " @ " + lokal.slice(0, 7));
  }
}

/* ================================================== H · WordPress ========= */
async function pruefeWordPress(html) {
  const modul = await import(pathToFileURL(path.join(HIER, "wordpress.mjs")).href);
  await modul.pruefen({ ziel, html, hole, melde, ok, knapp });
}

/* ==================================================== I · Browser ========= */
async function pruefeBrowser() {
  let modul;
  try { modul = await import(pathToFileURL(path.join(HIER, "browser.mjs")).href); }
  catch { melde("Messung", "hinweis", "Browser-Pruefungen nicht verfuegbar", "playwright fehlt",
    "npm install --prefix ~/.claude/skills/freigabe-check playwright axe-core"); return; }
  await modul.pruefen({ ziel, melde, ok, restMs: rest });
}

/* ======================================================== Ablauf ========== */
const start = await hole(ziel.href);
await pruefeTransport();
await pruefeHeader(start);
const html = await pruefeAuszeichnung(start);
await pruefeWurzeldateien();
await pruefePflicht(html);
await pruefeRouten();
pruefeProjekt();
if (wpPruefen) await pruefeWordPress(html);
if (!knapp()) await pruefeBrowser();
else melde("Messung", "hinweis", "Browser-Pruefungen uebersprungen", "Zeitbudget erreicht", "Mit hoeherem --budget erneut laufen lassen.");

/* ======================================================== Urteil ========== */
const blocker = befunde.filter(b => b.stufe === "blocker");
const warnungen = befunde.filter(b => b.stufe === "warnung");
const hinweise = befunde.filter(b => b.stufe === "hinweis");
const urteil = blocker.length ? "nicht freigegeben" : warnungen.length ? "freigegeben mit Auflagen" : "freigegeben";
const dauer = Math.round((Date.now() - t0) / 1000);

/* Bericht schreiben */
let bericht = null;
if (projekt && fs.existsSync(projekt)) {
  const dir = path.join(projekt, "10_Weitermachen", "freigabe");
  fs.mkdirSync(dir, { recursive: true });
  const d = new Date();
  bericht = path.join(dir, "freigabe_" + d.toISOString().slice(0, 10) + ".md");
  let t = "# Freigabeprüfung — " + ziel.href + "\n\n";
  t += "> Datum: " + d.toLocaleString("de-DE") + " · Dauer " + dauer + " s\n";
  t += "> Umfang: " + (intern ? "interne Seite" : "öffentliche Seite") + (wpPruefen ? " · WordPress-Prüfungen aktiv" : "") + "\n";
  t += "> **Urteil: " + urteil.toUpperCase() + "**\n\n";
  t += "| Stufe | Anzahl |\n|---|---|\n| Blocker | " + blocker.length + " |\n| Warnungen | " + warnungen.length + " |\n| Hinweise | " + hinweise.length + " |\n| Bestanden | " + geprueft.length + " |\n\n";
  for (const [stufe, liste, titel] of [["blocker", blocker, "Blocker — verhindern die Freigabe"], ["warnung", warnungen, "Warnungen — vor dem Start beheben"], ["hinweis", hinweise, "Hinweise"]]) {
    if (!liste.length) continue;
    t += "## " + titel + "\n\n";
    for (const b of liste) t += "- **" + b.titel + "** (" + b.bereich + ")" + (b.beleg ? " — `" + b.beleg + "`" : "") + "\n  " + b.rat + "\n";
    t += "\n";
  }
  t += "## Bestandene Prüfungen (" + geprueft.length + ")\n\n";
  for (const g of geprueft) t += "- " + g.titel + (g.beleg ? " — `" + g.beleg + "`" : "") + "\n";
  t += "\n---\n\n_Erzeugt von `/freigabe-check`. Diese Prüfung deckt Transport, Auszeichnung, Pflichtangaben, " +
       "Messwerte und Barrierefreiheit ab — sie ersetzt keinen Penetrationstest und keine inhaltliche Abnahme._\n";
  fs.writeFileSync(bericht, t);
}

/* Ausgabe */
if (alsJson) {
  console.log(JSON.stringify({ ziel: ziel.href, urteil, dauer, blocker, warnungen, hinweise, geprueft, bericht }, null, 2));
} else {
  console.log("\nFreigabeprüfung — " + ziel.href);
  console.log("Dauer " + dauer + " s · " + geprueft.length + " Prüfungen bestanden\n");
  for (const [stufe, liste, kopf] of [["BLOCKER", blocker, "BLOCKER"], ["WARNUNG", warnungen, "WARNUNG"], ["HINWEIS", hinweise, "HINWEIS"]]) {
    if (!liste.length) continue;
    console.log(kopf + "  " + liste.length);
    for (const b of liste) {
      console.log("  " + b.titel + (b.beleg ? "  [" + b.beleg + "]" : ""));
      console.log("      " + b.rat);
    }
    console.log("");
  }
  console.log("URTEIL: " + urteil.toUpperCase());
  if (bericht) console.log("Bericht: " + bericht);
}
process.exit(blocker.length ? 3 : 0);
