#!/usr/bin/env node
// Zugangscodes verwalten. Der Code wird genau EINMAL angezeigt, gespeichert wird nur der SHA-256.
//
//   node zugang.mjs neu "Anna"            Teilnehmer-Code
//   node zugang.mjs neu "Friedrich" --chef  Code mit Vorrang
//   node zugang.mjs liste
//   node zugang.mjs sperren "Anna"
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const DATEI = process.env.KIWS_ZUGANG || path.join(path.dirname(fileURLToPath(import.meta.url)), "zugang.json");
const lies = () => { try { return JSON.parse(fs.readFileSync(DATEI, "utf8")); } catch { return []; } };
const schreib = l => { fs.writeFileSync(DATEI, JSON.stringify(l, null, 2)); try { fs.chmodSync(DATEI, 0o600); } catch {} };
const [befehl, name, ...rest] = process.argv.slice(2);

if (befehl === "neu" && name) {
  const l = lies().filter(z => z.name !== name);
  const code = "wb_" + crypto.randomBytes(24).toString("hex");
  l.push({ name, rolle: rest.includes("--chef") ? "chef" : "teilnehmer", hash: crypto.createHash("sha256").update(code).digest("hex"), angelegt: new Date().toISOString().slice(0, 10) });
  schreib(l);
  console.log(`Zugangscode für ${name} (wird nur jetzt angezeigt):\n\n  ${code}\n`);
} else if (befehl === "liste") {
  for (const z of lies()) console.log(`${z.name.padEnd(20)} ${z.rolle.padEnd(11)} ${z.angelegt}${z.gesperrt ? "  GESPERRT" : ""}`);
} else if (befehl === "sperren" && name) {
  const l = lies(); const z = l.find(x => x.name === name);
  if (!z) { console.error("unbekannt"); process.exit(1); }
  z.gesperrt = true; schreib(l); console.log("gesperrt: " + name);
} else {
  console.log('Aufruf: node zugang.mjs neu "<Name>" [--chef] | liste | sperren "<Name>"');
}
