#!/usr/bin/env node
// Fuer den Workshop-Leiter: Teilnehmer-Apps in Coolify anlegen — beliebig viele je Teilnehmer.
//
//   node app-anlegen.mjs fjai-de/anna-todo          eine App anlegen (liest DEPLOY.md aus dem Repo)
//   node app-anlegen.mjs --alle                     alle Org-Repos mit DEPLOY.md, die noch keine App haben
//   node app-anlegen.mjs --liste                    was laeuft, unter welcher Adresse
//   ... --probe                                     nur zeigen, was passieren wuerde
//
// Einstellungen: leiter/coolify.lokal.json (nicht im Repo). Der Coolify-Token kommt aus der Umgebung
// (Name in "tokenVariable"), nie aus einer Datei in diesem Repo. Teilnehmer bekommen ihn nie.
//
// Ablauf je App: Deploy-Key (nur lesen) ans Repo -> App in Coolify mit Limits + Health-Check ->
// GitHub-Webhook fuer Auto-Deploy bei Push auf main -> erster Deploy.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const PROBE = args.includes("--probe");
const cfg = JSON.parse(fs.readFileSync(path.join(HIER, "coolify.lokal.json"), "utf8"));
const TOKEN = process.env[cfg.tokenVariable];
if (!TOKEN) { console.error(`Umgebungsvariable ${cfg.tokenVariable} fehlt.`); process.exit(1); }

const gh = (...a) => execFileSync("gh", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ghJson = (...a) => JSON.parse(gh("api", ...a) || "null");
async function coolify(methode, pfad, body) {
  const r = await fetch(cfg.apiUrl.replace(/\/+$/, "") + "/api/v1" + pfad, {
    method: methode, headers: { authorization: "Bearer " + TOKEN, accept: "application/json", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = { roh: text.slice(0, 200) }; }
  if (!r.ok) throw new Error(`Coolify ${methode} ${pfad}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

/* DEPLOY.md lesen: Zeilen der Form "- Schluessel: Wert" */
function deployAngaben(repo) {
  let text;
  try { text = Buffer.from(ghJson(`repos/${repo}/contents/DEPLOY.md`).content, "base64").toString("utf8"); } catch { return null; }
  const feld = name => (new RegExp("^[-*]\\s*" + name + "\\s*:\\s*(.+)$", "mi").exec(text) || [])[1]?.trim();
  const art = (feld("Art") || "").toLowerCase();
  const zeile = feld("Build") || "";   // "npm run build      Start: npm start      Port: 3000"
  const port = (/port\s*:\s*(\d{2,5})/i.exec(text) || [])[1];
  return {
    buildPack: art.includes("docker") ? "dockerfile" : art.includes("stat") ? "static" : "nixpacks",
    port: port || (art.includes("stat") ? "80" : "3000"),
    envNamen: (feld("Umgebungsvariablen") || "").split(/[,\s]+/).filter(n => /^[A-Z][A-Z0-9_]+$/.test(n)),
    daten: (/(\/[\w\-\/]+)/.exec(feld("Dauerhafte Daten") || "") || [])[1] || null,
    gesund: (/(\/[\w\-\/]*)/.exec(feld("Lebenszeichen") || "") || [])[1] || "/",
    wunsch: (feld("Wunschname") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30),
    _build: zeile,
  };
}

const appName = repo => repo.split("/")[1].toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
// Einlabelig: <name>-app.fjai.de — zwei Ebenen brechen am Zertifikat.
const domain = name => `${cfg.domainSchema || "http"}://${name}${cfg.domainSuffix}`;

async function vorhandene() {
  const apps = await coolify("GET", "/applications");
  return apps.filter(a => (a.git_repository || "").includes(cfg.org + "/")).map(a => ({
    uuid: a.uuid, name: a.name, repo: (a.git_repository.match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/) || [])[1], fqdn: a.fqdn, status: a.status }));
}

async function anlegen(repo) {
  const d = deployAngaben(repo);
  if (!d) { console.log(`  ${repo}: keine DEPLOY.md — uebersprungen (Teilnehmer: "online stellen" schreiben)`); return; }
  const name = appName(repo), url = domain(d.wunsch || name);
  console.log(`\n== ${repo}\n   ${d.buildPack} · Port ${d.port} · ${url} · Env: ${d.envNamen.join(", ") || "—"} · Daten: ${d.daten || "—"}`);
  if (PROBE) return;

  // 1) Deploy-Key (nur lesen). Oeffentlicher Teil des EINEN Workshop-Schluessels aus Coolify.
  const schluessel = ghJson(`repos/${repo}/keys`);
  if (!schluessel.some(k => k.key.trim().split(" ").slice(0, 2).join(" ") === cfg.deployKeyOeffentlich.trim().split(" ").slice(0, 2).join(" ")))
    gh("api", "-X", "POST", `repos/${repo}/keys`, "-f", "title=coolify-workshop", "-f", "key=" + cfg.deployKeyOeffentlich, "-F", "read_only=true");

  // 2) App in Coolify
  const geheim = crypto.randomBytes(24).toString("hex");
  const app = await coolify("POST", "/applications/private-deploy-key", {
    project_uuid: cfg.projektUuid, server_uuid: cfg.serverUuid, environment_name: cfg.umgebung || "production",
    private_key_uuid: cfg.deployKeyUuid, git_repository: `git@github.com:${repo}.git`, git_branch: "main",
    build_pack: d.buildPack, ports_exposes: d.port, name, domains: url, instant_deploy: false,
    limits_memory: cfg.limitSpeicher || "512M", limits_cpus: cfg.limitCpus || "0.5",
    health_check_enabled: true, health_check_path: d.gesund, manual_webhook_secret_github: geheim,
    ...(d.buildPack === "static" ? { is_static: true } : {}),
  });
  console.log("   App angelegt: " + app.uuid);

  // 3) Env-Namen als leere Platzhalter — Werte traegt der Leiter in der Oberflaeche ein
  for (const n of d.envNamen) await coolify("POST", `/applications/${app.uuid}/envs`, { key: n, value: "", is_preview: false }).catch(e => console.log("   ! Env " + n + ": " + e.message.slice(0, 80)));
  if (d.daten) console.log(`   ! Dauerhafte Daten: in Coolify unter Storages ein Volume auf ${d.daten} legen (API kann das nicht).`);

  // 4) Webhook: Push auf main -> Neubau. Coolify prueft die Signatur selbst.
  if (cfg.webhookBasis) {
    gh("api", "-X", "POST", `repos/${repo}/hooks`, "-f", "name=web", "-F", "active=true", "-f", "events[]=push",
      "-f", "config[url]=" + cfg.webhookBasis.replace(/\/+$/, "") + "/webhooks/source/github/events/manual",
      "-f", "config[content_type]=json", "-f", "config[secret]=" + geheim);
    console.log("   Webhook gesetzt");
  } else console.log("   ! Kein webhookBasis in der Einstellung — Auto-Deploy bei Push ist AUS.");

  // 5) Erster Deploy — nur wenn keine Env-Werte fehlen
  if (d.envNamen.length) console.log("   Env-Werte eintragen, dann in Coolify auf Deploy klicken.");
  else { await coolify("GET", `/deploy?uuid=${app.uuid}&force=false`); console.log("   Deploy gestartet → " + url); }
}

if (args.includes("--liste")) {
  for (const a of await vorhandene()) console.log(`${(a.repo || a.name).padEnd(36)} ${String(a.status).padEnd(18)} ${a.fqdn || ""}`);
} else if (args.includes("--alle")) {
  const da = new Set((await vorhandene()).map(a => a.repo));
  const repos = JSON.parse(gh("api", `orgs/${cfg.org}/repos`, "--paginate", "-q", "[.[] | select(.archived|not) | .full_name]") || "[]")
    .filter(r => r !== `${cfg.org}/werkbank` && !da.has(r));
  if (!repos.length) console.log("Nichts Neues.");
  for (const r of repos) await anlegen(r).catch(e => console.log("   ! " + e.message));
} else {
  const repo = args.find(a => /^[\w.-]+\/[\w.-]+$/.test(a));
  if (!repo) { console.error("Aufruf: app-anlegen.mjs <org>/<repo> | --alle | --liste  [--probe]"); process.exit(1); }
  await anlegen(repo).catch(e => { console.error("! " + e.message); process.exit(1); });
}
