#!/usr/bin/env node
// zeig-app — macht die eigene App für ein paar Minuten von außen sichtbar.
//
//   node zeig-app.mjs            im Projektordner starten, Rest geht von selbst
//   node zeig-app.mjs 5173       wenn die App schon läuft und der Port bekannt ist
//
// Ablauf: laufende App finden (sonst starten) -> cloudflared holen, falls es fehlt ->
// Tunnel öffnen -> Link anzeigen und in die Zwischenablage legen. Strg+C beendet alles.
// Braucht nur Node. Kein Konto, keine Anmeldung, nichts wird dauerhaft installiert.

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";

const WIN = process.platform === "win32";
const ABLAGE = path.join(os.homedir(), ".zeig-app");
// 5000 und 7000 fehlen mit Absicht: dort sitzt am Mac der AirPlay-Empfänger.
const UEBLICHE_PORTS = [3000, 5173, 5174, 4321, 8080, 3001, 3002, 4200, 8000, 8787, 1234, 4173];
const kinder = [];

const sag = (...t) => console.log(...t);
function ende(text, code = 1) { if (text) console.error("\n" + text); aufraeumen(); process.exit(code); }
function aufraeumen() {
  for (const k of kinder) {
    try { WIN ? execFileSync("taskkill", ["/pid", String(k.pid), "/T", "/F"], { stdio: "ignore" }) : process.kill(-k.pid, "SIGTERM"); } catch {}
  }
}
process.on("SIGINT", () => { sag("\nBeendet. Der Link gilt jetzt nicht mehr."); aufraeumen(); process.exit(0); });
process.on("SIGTERM", () => { aufraeumen(); process.exit(0); });

// ---------- Port finden ----------
function lauscht(port, host) {
  return new Promise(ok => {
    const s = net.connect({ port, host, timeout: 600 });
    s.once("connect", () => { s.destroy(); ok(true); });
    s.once("timeout", () => { s.destroy(); ok(false); });
    s.once("error", () => ok(false));
  });
}
// Liefert die Adresse, unter der die App wirklich antwortet (Vite lauscht oft nur auf ::1).
async function adresseVon(port) {
  if (await lauscht(port, "127.0.0.1")) return `http://127.0.0.1:${port}`;
  if (await lauscht(port, "::1")) return `http://[::1]:${port}`;
  return null;
}
// Echte Web-App? Muss auf HTTP antworten und darf kein Systemdienst sein (AirPlay meldet sich als AirTunes).
async function istWebApp(adresse) {
  try {
    const r = await fetch(adresse, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    return !/airtunes|airplay/i.test(r.headers.get("server") || "");
  } catch { return false; }
}
async function laufendeAppsSuchen() {
  const gefunden = [];
  for (const p of UEBLICHE_PORTS) { const a = await adresseVon(p); if (a && await istWebApp(a)) gefunden.push({ port: p, adresse: a }); }
  return gefunden;
}
async function laufendeAppSuchen() { return (await laufendeAppsSuchen())[0] || null; }
async function fragen(text) {
  const rl = (await import("node:readline/promises")).createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question(text); rl.close(); return a.trim();
}
async function wartenAuf(port, sekunden) {
  for (let i = 0; i < sekunden * 2; i++) {
    const a = await adresseVon(port); if (a) return a;
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

// ---------- App starten, falls nichts läuft ----------
function starteKind(befehl, args, opt = {}) {
  const k = spawn(befehl, args, { cwd: process.cwd(), shell: WIN, detached: !WIN, stdio: ["ignore", "pipe", "pipe"], ...opt });
  kinder.push(k);
  return k;
}
function statischerServer(ordner) {
  const TYPEN = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
  const wurzel = path.resolve(ordner);
  return new Promise((ok, nok) => {
    const srv = http.createServer((req, res) => {
      let ziel = path.normalize(path.join(wurzel, decodeURIComponent(new URL(req.url, "http://x").pathname)));
      if (!ziel.startsWith(wurzel)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(ziel) && fs.statSync(ziel).isDirectory()) ziel = path.join(ziel, "index.html");
      if (!fs.existsSync(ziel)) ziel = path.join(wurzel, "index.html"); // Einzelseiten-Apps
      fs.readFile(ziel, (f, daten) => {
        if (f) { res.writeHead(404); return res.end("nicht gefunden"); }
        res.writeHead(200, { "content-type": TYPEN[path.extname(ziel).toLowerCase()] || "application/octet-stream" });
        res.end(daten);
      });
    });
    srv.once("error", nok);
    srv.listen(0, "127.0.0.1", () => ok(srv.address().port));
  });
}
async function appStarten() {
  const pj = path.join(process.cwd(), "package.json");
  if (fs.existsSync(pj)) {
    let skripte = {};
    try { skripte = JSON.parse(fs.readFileSync(pj, "utf8")).scripts || {}; } catch { ende("package.json ist kaputt (kein gültiges JSON)."); }
    const name = ["dev", "start", "serve", "preview"].find(n => skripte[n]);
    if (name) {
      if (!fs.existsSync(path.join(process.cwd(), "node_modules"))) {
        sag("• Pakete fehlen noch — installiere (npm install), das dauert einen Moment …");
        try { execFileSync(WIN ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund"], { stdio: "inherit", shell: WIN }); }
        catch { ende("npm install ist fehlgeschlagen. Meldung oben an Friedrich schicken."); }
      }
      sag(`• Starte die App (npm run ${name}) …`);
      const k = starteKind(WIN ? "npm.cmd" : "npm", ["run", name], { env: { ...process.env, BROWSER: "none", FORCE_COLOR: "0" } });
      let gemeldet = null, letzte = "";
      const lesen = d => {
        const t = String(d).replace(/\x1b\[[0-9;]*m/g, ""); letzte = (letzte + t).slice(-1500);
        const m = t.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{2,5})/);
        if (m && !gemeldet) gemeldet = Number(m[1]);
      };
      k.stdout.on("data", lesen); k.stderr.on("data", lesen);
      let tot = false; k.once("exit", () => { tot = true; });
      for (let i = 0; i < 180; i++) {
        if (tot) ende("Die App ist beim Start abgestürzt. Letzte Ausgabe:\n\n" + letzte.trim());
        if (gemeldet) { const a = await wartenAuf(gemeldet, 20); if (a) return { port: gemeldet, adresse: a }; }
        else if (i > 10) { const l = await laufendeAppSuchen(); if (l) return l; }
        await new Promise(r => setTimeout(r, 500));
      }
      ende("Die App hat nach 90 Sekunden keinen Port geöffnet. Letzte Ausgabe:\n\n" + letzte.trim());
    }
  }
  for (const o of [".", "dist", "build", "public", "out"]) {
    if (fs.existsSync(path.join(process.cwd(), o, "index.html"))) {
      const port = await statischerServer(path.join(process.cwd(), o));
      sag(`• Statische Seite gefunden (${o === "." ? "index.html" : o + "/index.html"}).`);
      return { port, adresse: `http://127.0.0.1:${port}` };
    }
  }
  ende("Hier finde ich keine App.\n  → In den Projektordner wechseln (dort liegt package.json oder index.html) und nochmal starten.\n  → Oder die App selbst starten und den Port mitgeben:  node zeig-app.mjs 3000");
}

// ---------- cloudflared ----------
function imPfad(name) {
  try { return execFileSync(WIN ? "where" : "which", [name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/)[0].trim() || null; } catch { return null; }
}
async function laden(url, ziel) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`Download fehlgeschlagen (${r.status})`);
  fs.writeFileSync(ziel, Buffer.from(await r.arrayBuffer()));
}
async function cloudflaredHolen() {
  const vorhanden = imPfad("cloudflared"); if (vorhanden) return vorhanden;
  fs.mkdirSync(ABLAGE, { recursive: true });
  const ziel = path.join(ABLAGE, WIN ? "cloudflared.exe" : "cloudflared");
  if (fs.existsSync(ziel) && fs.statSync(ziel).size > 1e6) return ziel;
  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  const basis = "https://github.com/cloudflare/cloudflared/releases/latest/download/";
  sag("• Lade das Tunnel-Werkzeug (cloudflared, einmalig, ~40 MB) …");
  try {
    if (WIN) await laden(basis + "cloudflared-windows-amd64.exe", ziel);
    else if (process.platform === "darwin") {
      const tgz = path.join(ABLAGE, "cloudflared.tgz");
      await laden(basis + `cloudflared-darwin-${arch}.tgz`, tgz);
      execFileSync("tar", ["-xzf", tgz, "-C", ABLAGE]); fs.rmSync(tgz, { force: true });
    } else await laden(basis + `cloudflared-linux-${arch}`, ziel);
    if (!WIN) fs.chmodSync(ziel, 0o755);
  } catch (e) { ende("cloudflared ließ sich nicht laden: " + e.message + "\n  → Internet prüfen, dann nochmal."); }
  return ziel;
}
function tunnelOeffnen(programm, adresse) {
  // Leere Konfiguration: eine vorhandene ~/.cloudflared/config.yml würde den Schnell-Tunnel sonst verhindern.
  fs.mkdirSync(ABLAGE, { recursive: true });
  const leer = path.join(ABLAGE, "leer.yml"); fs.writeFileSync(leer, "");
  // Host-Header auf localhost: Vite und andere Dev-Server weisen fremde Hostnamen sonst ab.
  const k = spawn(programm, ["tunnel", "--config", leer, "--no-autoupdate", "--url", adresse, "--http-host-header", "localhost"],
    { detached: !WIN, stdio: ["ignore", "pipe", "pipe"] });
  kinder.push(k);
  return new Promise((ok, nok) => {
    let alles = "";
    const lesen = d => { alles = (alles + d).slice(-4000); const m = alles.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m) ok(m[0]); };
    k.stdout.on("data", lesen); k.stderr.on("data", lesen);
    k.once("exit", c => nok(new Error("cloudflared hat sich beendet (" + c + ").\n" + alles.trim().split("\n").slice(-6).join("\n"))));
    setTimeout(() => nok(new Error("Nach 45 Sekunden kam kein Link. Internet oder Firmen-Firewall?")), 45000);
  });
}
async function erreichbar(link) {
  for (let i = 0; i < 20; i++) {
    try { const r = await fetch(link, { redirect: "manual", signal: AbortSignal.timeout(6000) }); if (r.status < 500) return r.status; } catch {}
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}
function inZwischenablage(text) {
  try {
    const [b, a] = WIN ? ["clip", []] : process.platform === "darwin" ? ["pbcopy", []] : ["xclip", ["-selection", "clipboard"]];
    execFileSync(b, a, { input: text, stdio: ["pipe", "ignore", "ignore"] }); return true;
  } catch { return false; }
}

// ---------- Ablauf ----------
sag("\nzeig-app — ich mache deine App kurz von außen sichtbar.\n");
if (Number(process.versions.node.split(".")[0]) < 18) ende("Node ist zu alt (" + process.version + "). Bitte Node 18 oder neuer.");

let app;
const wunsch = Number(process.argv[2]);
if (wunsch) {
  const a = await adresseVon(wunsch);
  if (a && !(await istWebApp(a))) ende(`Auf Port ${wunsch} läuft keine Web-App (am Mac sind 5000/7000 der AirPlay-Empfänger).`);
  if (!a) ende(`Auf Port ${wunsch} läuft nichts. Erst die App starten, dann nochmal.`);
  app = { port: wunsch, adresse: a };
} else {
  const laufend = await laufendeAppsSuchen();
  if (laufend.length === 1) { app = laufend[0]; sag(`• Laufende App gefunden auf Port ${app.port}.`); }
  else if (laufend.length > 1 && process.stdin.isTTY) {
    sag("• Es laufen mehrere Apps: " + laufend.map(l => l.port).join(", "));
    const p = Number(await fragen("  Welchen Port soll ich zeigen? "));
    app = laufend.find(l => l.port === p) || ende("Diesen Port kenne ich nicht.");
  } else if (laufend.length > 1) { app = laufend[0]; sag(`• Mehrere Apps laufen, nehme Port ${app.port}. Anderer Port: node zeig-app.mjs <port>`); }
  else app = await appStarten();
}
sag(`• App antwortet unter ${app.adresse}`);

const programm = await cloudflaredHolen();
sag("• Öffne den Tunnel …");
let link;
try { link = await tunnelOeffnen(programm, app.adresse); } catch (e) { ende(e.message); }
const status = await erreichbar(link);
const kopiert = inZwischenablage(link);

sag("\n────────────────────────────────────────────────────────────");
sag("  Dein Link:\n");
sag("  " + link + "\n");
sag(kopiert ? "  Liegt in der Zwischenablage — einfach an Friedrich schicken." : "  Diesen Link an Friedrich schicken.");
sag("────────────────────────────────────────────────────────────");
if (!status) sag("\nHinweis: Der Link hat beim Selbsttest noch nicht geantwortet. Meist braucht er nur 1–2 Minuten.");
sag("\nWichtig:");
sag("  • Jeder mit dem Link sieht die App. Keine echten Kundendaten oder Passwörter darin zeigen.");
sag("  • Der Link gilt nur, solange dieses Fenster offen ist. Schließen oder Strg+C = Link tot.");
sag("  • Beim nächsten Start gibt es einen neuen Link.\n");
