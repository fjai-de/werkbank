#!/usr/bin/env node
// Teilnehmer-Werkzeug: App ueber den Leitstand des Workshop-Leiters auf eine echte Adresse bringen.
//
//   node werkstatt.mjs einrichten <adresse>        fragt den EIGENEN Zugangscode ab (nicht als Argument -> nicht im Verlauf)
//   node werkstatt.mjs veroeffentlichen [--name wunschname] [--port 3000] [--art nixpacks|static|dockerfile]
//   node werkstatt.mjs status
//
// Es wird kein Token und kein Passwort uebertragen — nur Repo-Name, Wunschname, Port, Bauart und die NAMEN der Umgebungsvariablen.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { execFileSync } from "node:child_process";

const DATEI = path.join(os.homedir(), ".claude", "werkbank", "werkstatt.json");
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : undefined; };
const lauf = (cmd, a) => { try { return execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); } catch (e) { return null; } };
let z = null, schritt = "start", repoName = "";
const ende = async (t, code = 1) => {
  console.error(t);
  if (z && code !== 3) await fetch(z.url + "/api/meldung", { method: "POST", headers: { authorization: "Bearer " + z.code, "content-type": "application/json" }, body: JSON.stringify({ schritt, text: t, repo: repoName, system: process.platform + " node " + process.version }) }).catch(() => {});
  process.exit(code);
};

if (args[0] === "einrichten") {
  const url = (args[1] || "").replace(/\/+$/, ""); if (!/^https?:\/\//.test(url)) ende("Aufruf: werkstatt.mjs einrichten <adresse>");
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  rl.question("Eigener Zugangscode (ws_…): ", async code => {
    rl.close(); code = code.trim();
    const r = await fetch(url + "/api/ich", { headers: { authorization: "Bearer " + code } }).catch(() => null);
    if (!r || !r.ok) ende(r ? "Code wurde nicht angenommen." : "Leitstand nicht erreichbar: " + url);
    fs.mkdirSync(path.dirname(DATEI), { recursive: true }); fs.writeFileSync(DATEI, JSON.stringify({ url, code }, null, 2)); try { fs.chmodSync(DATEI, 0o600); } catch {}
    console.error("Verbunden als " + (await r.json()).github + ". Gespeichert in " + DATEI + " — nie weitergeben oder einchecken.");
  });
} else {
  try { z = JSON.parse(fs.readFileSync(DATEI, "utf8")); } catch { await ende("Noch nicht eingerichtet: node werkstatt.mjs einrichten <adresse-vom-leiter>", 3); }
  const ruf = async (m, p, b) => { const r = await fetch(z.url + p, { method: m, headers: { authorization: "Bearer " + z.code, "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).catch(() => null);
    if (!r) { console.error("Leitstand nicht erreichbar: " + z.url); process.exit(1); } const j = await r.json().catch(() => ({})); if (!r.ok) await ende("Abgelehnt: " + (j.fehler || r.status)); return j; };

  const herkunft = lauf("git", ["remote", "get-url", "origin"]); const m = /github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/.exec(herkunft || "");
  schritt = "repository finden";
  if (!m) await ende("Dieser Ordner hat kein GitHub-Repository (git remote origin fehlt). Erst: gh repo create <name> --private --source . --push");
  const repo = m[1] + "/" + m[2]; repoName = repo;

  if (args[0] === "status") { console.log(JSON.stringify(await ruf("GET", "/api/status?repo=" + encodeURIComponent(repo)), null, 2)); }
  else if (args[0] === "veroeffentlichen") {
    schritt = "commit und push pruefen";
    if (lauf("git", ["status", "--porcelain"])) await ende("Es gibt Aenderungen, die nicht committet sind. Erst committen und pushen — veroeffentlicht wird, was auf GitHub liegt.");
    const zweig = lauf("git", ["branch", "--show-current"]) || "main";
    if (lauf("git", ["rev-parse", "HEAD"]) !== lauf("git", ["rev-parse", "origin/" + zweig])) await ende("Der letzte Commit ist noch nicht gepusht: git push");

    schritt = "gh-anmeldung pruefen";
    if (lauf("gh", ["auth", "status"]) === null) await ende("GitHub CLI ist nicht angemeldet oder nicht installiert. Im Terminal: gh auth login");
    const ich = await ruf("GET", "/api/ich?repo=" + encodeURIComponent(repo));      // je Repo ein eigener Schluessel — GitHub laesst keinen doppelt zu
    schritt = "leseschluessel eintragen";
    // 1) Leseschluessel des Servers ans eigene Repo (nur lesen)
    const da = lauf("gh", ["api", `repos/${repo}/keys`, "-q", ".[].key"]) || "";
    const kern = ich.schluessel.split(" ").slice(0, 2).join(" ");
    if (!da.includes(kern.split(" ")[1])) { if (lauf("gh", ["api", "-X", "POST", `repos/${repo}/keys`, "-f", "title=werkstatt-server (nur lesen)", "-f", "key=" + ich.schluessel, "-F", "read_only=true"]) === null) await ende("Konnte den Leseschluessel nicht eintragen. Bist du mit gh angemeldet und gehoert dir das Repo?"); console.error("Leseschluessel eingetragen."); }
    // 2) Workshop-Leiter als Mitarbeiter, damit er helfen kann
    schritt = "leiter einladen";
    if (lauf("gh", ["api", `repos/${repo}/collaborators/${ich.helfer}`]) === null) { lauf("gh", ["api", "-X", "PUT", `repos/${repo}/collaborators/${ich.helfer}`, "-f", "permission=push"]); console.error("Workshop-Leiter " + ich.helfer + " eingeladen."); }

    // 3) Angaben aus DEPLOY.md, Schalter gehen vor
    schritt = "anmelden beim leitstand";
    let d = ""; try { d = fs.readFileSync("DEPLOY.md", "utf8"); } catch {}
    const feld = n => (new RegExp("^[-*]\\s*" + n + "\\s*:\\s*(.+)$", "mi").exec(d) || [])[1]?.trim() || "";
    const art = (opt("art") || feld("Art")).toLowerCase();
    const antwort = await ruf("POST", "/api/veroeffentlichen", {
      repo, branch: zweig, name: opt("name") || feld("Wunschname"),
      buildPack: art.includes("docker") ? "dockerfile" : art.includes("stat") ? "static" : "nixpacks",
      port: opt("port") || (/port\s*:\s*(\d{2,5})/i.exec(d) || [])[1],
      gesund: (/(\/[\w\-\/]*)/.exec(feld("Lebenszeichen")) || [])[1],
      envNamen: feld("Umgebungsvariablen").split(/[,\s]+/).filter(n => /^[A-Z][A-Z0-9_]+$/.test(n)),
    });
    console.error("Angemeldet: " + antwort.url + (antwort.hinweis ? "\n" + antwort.hinweis : ""));
    if (!antwort.hinweis) {
      let s = antwort.status, n = 0;
      while (n++ < 60 && !/running|exited|unhealthy|Fehler/.test(String(s))) { await new Promise(r => setTimeout(r, 10000)); s = (await ruf("GET", "/api/status?repo=" + encodeURIComponent(repo))).status; console.error("  Bau laeuft … " + s); }
      console.error(/running/.test(String(s)) ? "Online: " + antwort.url : "Status: " + s + " — dem Workshop-Leiter Bescheid geben, er sieht das Bau-Protokoll.");
    }
    console.log(antwort.url);
  } else await ende("Aufruf: werkstatt.mjs einrichten <adresse> | veroeffentlichen [--name x] [--port n] [--art …] | status");
}
