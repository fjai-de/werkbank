#!/usr/bin/env node
// Client fuer die KI-Warteschlange.
//   node ki.mjs einrichten <url>          fragt den EIGENEN Zugangscode ab (nicht als Argument -> nicht im Verlauf)
//   node ki.mjs frage "<text>" [--modell m] [--datei pfad] [--system "<text>"]
//   node ki.mjs schlange | status <id> | storno <id>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const DATEI = path.join(os.homedir(), ".claude", "werkbank", "ki-server.json");
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : undefined; };

if (args[0] === "einrichten") {
  const url = (args[1] || "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(url)) { console.error("Aufruf: ki.mjs einrichten <url>"); process.exit(1); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  rl.question("Eigener Zugangscode (wb_…): ", code => {
    rl.close();
    fs.mkdirSync(path.dirname(DATEI), { recursive: true });
    fs.writeFileSync(DATEI, JSON.stringify({ url, code: code.trim() }, null, 2));
    try { fs.chmodSync(DATEI, 0o600); } catch {}
    console.error("Gespeichert in " + DATEI + " — diese Datei nie weitergeben oder einchecken.");
  });
} else {
  let z; try { z = JSON.parse(fs.readFileSync(DATEI, "utf8")); } catch { console.error("Noch nicht eingerichtet: node ki.mjs einrichten <url>"); process.exit(3); }
  const ruf = async (methode, pfad, body) => {
    const r = await fetch(z.url + pfad, { method: methode, headers: { authorization: "Bearer " + z.code, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error("Fehler " + r.status + ": " + (j.fehler || "")); process.exit(1); }
    return j;
  };
  if (args[0] === "schlange") console.log(JSON.stringify(await ruf("GET", "/schlange"), null, 2));
  else if (args[0] === "status" && args[1]) console.log(JSON.stringify(await ruf("GET", "/auftrag/" + args[1]), null, 2));
  else if (args[0] === "storno" && args[1]) console.log(JSON.stringify(await ruf("DELETE", "/auftrag/" + args[1])));
  else if (args[0] === "frage" && args[1]) {
    let text = args[1];
    const datei = opt("datei"); if (datei) text += "\n\n--- " + path.basename(datei) + " ---\n" + fs.readFileSync(datei, "utf8");
    const messages = []; if (opt("system")) messages.push({ role: "system", content: opt("system") });
    messages.push({ role: "user", content: text });
    let a = await ruf("POST", "/auftrag", { messages, modell: opt("modell") });
    let zuletzt = "";
    while (a.status === "wartet" || a.status === "laeuft") {
      const jetzt = a.status === "wartet" ? "wartet auf Platz " + a.platz : "läuft auf " + a.backend;
      if (jetzt !== zuletzt) { console.error("[" + a.id + "] " + jetzt); zuletzt = jetzt; }
      await new Promise(r => setTimeout(r, 2000));
      a = await ruf("GET", "/auftrag/" + a.id);
    }
    if (a.status !== "fertig") { console.error("Auftrag " + a.status + (a.fehler ? ": " + a.fehler : "")); process.exit(1); }
    console.log(a.ergebnis);
  } else { console.error('Aufruf: ki.mjs frage "<text>" [--modell m] [--datei pfad] | schlange | status <id> | storno <id> | einrichten <url>'); process.exit(1); }
}
