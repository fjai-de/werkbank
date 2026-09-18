#!/usr/bin/env node
// KI-Warteschlange — stellt Auftraege vor einen oder mehrere Ollama-Server.
//
//   * Jede Person hat einen EIGENEN Zugangscode (zugang.json, nur als SHA-256 gespeichert).
//   * Rolle "chef" hat immer Vorrang: Chef-Auftraege stehen vor allen wartenden
//     Teilnehmer-Auftraegen. Mit "verdraengen": true wird zusaetzlich ein laufender
//     Teilnehmer-Auftrag abgebrochen und vorn in seiner Klasse wieder eingereiht.
//   * Keine Abhaengigkeiten, nur Node >= 18.
//
// Start:  node server.mjs            (liest config.json + zugang.json neben dieser Datei)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const lies = (datei, ersatz) => { try { return JSON.parse(fs.readFileSync(path.resolve(HIER, datei), "utf8")); } catch { return ersatz; } };

const cfg = Object.assign({
  port: 8790, host: "0.0.0.0",
  backends: [{ name: "gpu0", url: "http://127.0.0.1:11434", modelle: ["*"] }],
  standardModell: "qwen3:8b",
  verdraengen: false,          // laufende Teilnehmer-Auftraege fuer den Chef abbrechen
  maxWartendProPerson: 5,
  zeitlimitSekunden: 1800,
  ergebnisAufbewahrenMinuten: 60,
  maxAnfrageBytes: 2 * 1024 * 1024,
}, lies(process.env.KIWS_CONFIG || "config.json", {}));
if (process.env.KIWS_PORT) cfg.port = +process.env.KIWS_PORT;

const ZUGANG_DATEI = process.env.KIWS_ZUGANG || path.join(HIER, "zugang.json");
const zugaenge = () => { try { return JSON.parse(fs.readFileSync(ZUGANG_DATEI, "utf8")); } catch { return []; } };
const PRIO = { chef: 0, teilnehmer: 10 };

/* ---------- Zustand ---------- */
let lfd = 0;
const auftraege = new Map();                 // id -> Auftrag
const backends = cfg.backends.map(b => ({ ...b, laeuft: null }));

const hash = t => crypto.createHash("sha256").update(t).digest("hex");
function werIst(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
  if (!m) return null;
  const h = Buffer.from(hash(m[1]), "hex");
  for (const z of zugaenge()) {
    if (z.gesperrt) continue;
    const g = Buffer.from(z.hash, "hex");
    if (g.length === h.length && crypto.timingSafeEqual(g, h)) return { name: z.name, rolle: z.rolle === "chef" ? "chef" : "teilnehmer" };
  }
  return null;
}

const wartend = () => [...auftraege.values()].filter(a => a.status === "wartet").sort((a, b) => a.prio - b.prio || a.seq - b.seq);
const platzVon = a => a.status === "wartet" ? wartend().findIndex(x => x.id === a.id) + 1 : 0;
const kann = (b, modell) => b.modelle.includes("*") || b.modelle.includes(modell);

function verteilen() {
  for (const a of wartend()) {
    const frei = backends.find(b => !b.laeuft && kann(b, a.modell));
    if (frei) { starten(a, frei); continue; }
    // Vorrang mit Verdraengung: Chef wartet, passendes Backend ist von Teilnehmer belegt
    if (cfg.verdraengen && a.prio === PRIO.chef) {
      const opfer = backends.filter(b => b.laeuft && !b.laeuft.verdraengt && b.laeuft.prio > a.prio && kann(b, a.modell))
        .sort((x, y) => y.laeuft.gestartet - x.laeuft.gestartet)[0];
      if (opfer) { opfer.laeuft.verdraengt = true; opfer.laeuft.abbruch.abort(); }
    }
  }
}

async function starten(a, b) {
  a.status = "laeuft"; a.gestartet = Date.now(); a.backend = b.name; a.verdraengt = false;
  a.abbruch = new AbortController(); b.laeuft = a;
  const uhr = setTimeout(() => a.abbruch.abort(), cfg.zeitlimitSekunden * 1000);
  try {
    const r = await fetch(b.url + "/api/chat", {
      method: "POST", signal: a.abbruch.signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: a.modell, messages: a.messages, stream: false, think: false, options: a.optionen || {} }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ("Backend antwortet mit " + r.status));
    a.status = "fertig"; a.ergebnis = j.message?.content ?? "";
    a.werte = { eingabeTokens: j.prompt_eval_count, ausgabeTokens: j.eval_count };
  } catch (e) {
    if (a.verdraengt) { a.status = "wartet"; a.backend = null; a.verdraengungen = (a.verdraengungen || 0) + 1; }
    else if (a.storniert) { a.status = "storniert"; }
    else { a.status = "fehler"; a.fehler = a.abbruch.signal.aborted ? "Zeitlimit ueberschritten" : String(e.message || e); }
  } finally {
    clearTimeout(uhr); b.laeuft = null;
    if (a.status !== "wartet") { a.beendet = Date.now(); a.messages = undefined; }
    log(a.status, a);
    verteilen();
  }
}

const log = (was, a) => console.log(new Date().toISOString(), was.padEnd(9), a.id, a.wer.padEnd(14), a.modell, a.backend || "");

setInterval(() => {                           // alte Ergebnisse wegwerfen
  const grenze = Date.now() - cfg.ergebnisAufbewahrenMinuten * 60000;
  for (const [id, a] of auftraege) if (a.beendet && a.beendet < grenze) auftraege.delete(id);
}, 60000).unref();

/* ---------- HTTP ---------- */
const sende = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };
const sicht = a => ({
  id: a.id, status: a.status, platz: platzVon(a), modell: a.modell, backend: a.backend || null,
  wartetSeitSekunden: Math.round((Date.now() - a.eingang) / 1000), verdraengungen: a.verdraengungen || 0,
  ergebnis: a.status === "fertig" ? a.ergebnis : undefined, werte: a.werte, fehler: a.fehler,
});

function koerper(req) {
  return new Promise((ok, nein) => {
    let n = 0; const teile = [];
    req.on("data", d => { n += d.length; if (n > cfg.maxAnfrageBytes) { nein(new Error("zu gross")); req.destroy(); } else teile.push(d); });
    req.on("end", () => { try { ok(JSON.parse(Buffer.concat(teile).toString("utf8") || "{}")); } catch { nein(new Error("kein gueltiges JSON")); } });
    req.on("error", nein);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/gesund") return sende(res, 200, { ok: true });

  const wer = werIst(req);
  if (!wer) return sende(res, 401, { fehler: "Zugangscode fehlt oder ist ungueltig" });

  try {
    if (req.method === "POST" && url.pathname === "/auftrag") {
      const k = await koerper(req);
      const messages = Array.isArray(k.messages) ? k.messages : (typeof k.prompt === "string" ? [{ role: "user", content: k.prompt }] : null);
      if (!messages || !messages.length) return sende(res, 400, { fehler: "prompt oder messages fehlt" });
      const modell = String(k.modell || cfg.standardModell);
      if (!backends.some(b => kann(b, modell))) return sende(res, 400, { fehler: "Modell wird von keinem Backend angeboten: " + modell });
      const offen = [...auftraege.values()].filter(a => a.wer === wer.name && a.status === "wartet").length;
      if (wer.rolle !== "chef" && offen >= cfg.maxWartendProPerson) return sende(res, 429, { fehler: "Zu viele wartende Auftraege (max. " + cfg.maxWartendProPerson + ")" });
      const a = { id: crypto.randomBytes(6).toString("hex"), seq: ++lfd, wer: wer.name, prio: PRIO[wer.rolle], modell, messages,
        optionen: (k.optionen && typeof k.optionen === "object") ? k.optionen : {}, status: "wartet", eingang: Date.now() };
      auftraege.set(a.id, a); log("eingang", a); verteilen();
      return sende(res, 202, sicht(a));
    }

    const m = /^\/auftrag\/([0-9a-f]{12})$/.exec(url.pathname);
    if (m) {
      const a = auftraege.get(m[1]);
      if (!a || (a.wer !== wer.name && wer.rolle !== "chef")) return sende(res, 404, { fehler: "unbekannt" });
      if (req.method === "GET") return sende(res, 200, sicht(a));
      if (req.method === "DELETE") {
        if (a.status === "wartet") { a.status = "storniert"; a.beendet = Date.now(); a.messages = undefined; }
        else if (a.status === "laeuft") { a.storniert = true; a.abbruch.abort(); }
        return sende(res, 200, { id: a.id, status: "storniert" });
      }
    }

    if (req.method === "GET" && url.pathname === "/schlange") {
      const alle = [...auftraege.values()].filter(a => a.status === "wartet" || a.status === "laeuft");
      return sende(res, 200, {
        laufend: alle.filter(a => a.status === "laeuft").length, wartend: alle.filter(a => a.status === "wartet").length,
        backends: backends.map(b => ({ name: b.name, belegt: !!b.laeuft })),
        // Fremde Auftraege nur als Platzhalter — niemand sieht Inhalte oder Namen anderer (Chef sieht Namen)
        reihe: wartend().map((a, i) => ({ platz: i + 1, meiner: a.wer === wer.name, vorrang: a.prio === PRIO.chef, wer: wer.rolle === "chef" ? a.wer : undefined, id: a.wer === wer.name || wer.rolle === "chef" ? a.id : undefined })),
      });
    }
    return sende(res, 404, { fehler: "unbekannter Pfad" });
  } catch (e) { return sende(res, 400, { fehler: String(e.message || e) }); }
});

server.listen(cfg.port, cfg.host, () => console.log(`KI-Warteschlange auf ${cfg.host}:${cfg.port} — Backends: ${backends.map(b => b.name).join(", ")} — Verdraengen: ${cfg.verdraengen}`));
