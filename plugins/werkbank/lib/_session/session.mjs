#!/usr/bin/env node
// Session-Journal für FJ-Design-Sessions — eine Datei als Rückgrat der Zeiterfassung.
// Hält Start-/Endzeit, projectId/Name und erledigte (mit Zeit pro Aufgabe) + offene Tasks.
// Genutzt von den Skills: start (init), hub (done), weitermachen-erstellen (summary/mark-pushed/reset).
// Bewusst node statt python3 — python3 fehlt auf der Admin-Maschine.
//
// Befehle:
//   init   --start ISO --project PATH --projectId ID --name NAME --open id1,id2
//   set    [--projectId ID] [--name NAME] [--project PATH] [--open id1,id2]   (Felder nachtragen)
//   done   --taskId ID --title "..." --minutes N [--note "..."] [--pushed true]
//   summary                                                                    (JSON: Dauer, done[], open[])
//   mark-pushed                                                                 (alle done als gepusht markieren)
//   reset
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FILE = path.join(os.homedir(), '.claude', 'projects', '.session_active.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function save(d) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}
function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }

// --key value (Wert optional → 'true')
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    o[k] = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true';
  }
  return o;
}
const splitIds = (s) => (s ? String(s).split(',').map((x) => x.trim()).filter(Boolean) : []);

const [cmd, ...rest] = process.argv.slice(2);
const a = parseArgs(rest);
let d = load();

switch (cmd) {
  case 'init': {
    // Neue Session = frischer Stand (done leer, openTaskIds aus --open).
    d = {
      start: a.start || nowIso(),
      project: a.project || null,
      projectId: a.projectId || null,
      projectName: a.name || null,
      openTaskIds: splitIds(a.open),
      done: [],
      status: 'active',
    };
    save(d);
    console.log(`OK init start=${d.start} projectId=${d.projectId || '-'} open=${d.openTaskIds.length}`);
    break;
  }
  case 'set': {
    if (a.projectId) d.projectId = a.projectId;
    if (a.name) d.projectName = a.name;
    if (a.project) d.project = a.project;
    if (a.open) d.openTaskIds = splitIds(a.open);
    d.status = d.status || 'active';
    save(d);
    console.log(`OK set projectId=${d.projectId || '-'} open=${(d.openTaskIds || []).length}`);
    break;
  }
  case 'done': {
    if (!a.taskId && !a.title) { console.error('done braucht --taskId oder --title'); process.exit(1); }
    d.done = d.done || [];
    d.done.push({
      taskId: a.taskId || null,
      title: a.title || null,
      minutes: a.minutes ? Math.max(0, Math.round(Number(a.minutes))) : 0,
      note: a.note || null,
      at: nowIso(),
      pushed: a.pushed === 'true' || a.pushed === true,
    });
    if (a.taskId) d.openTaskIds = (d.openTaskIds || []).filter((x) => x !== a.taskId);
    save(d);
    console.log(`OK done +${a.minutes || 0}min (${d.done.length} gesamt)`);
    break;
  }
  case 'summary': {
    const start = d.start ? new Date(d.start) : null;
    const end = new Date();
    let durationMin = 0, duration = 'unbekannt';
    if (start && !isNaN(+start)) {
      durationMin = Math.max(0, Math.round((+end - +start) / 60000));
      duration = `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`;
    }
    const done = d.done || [];
    const taskMinutes = done.reduce((s, x) => s + (x.minutes || 0), 0);
    console.log(JSON.stringify({
      start: d.start || null,
      end: nowIso(),
      durationMin,
      duration,
      project: d.project || null,
      projectId: d.projectId || null,
      projectName: d.projectName || null,
      done,
      doneCount: done.length,
      taskMinutes,
      remainderMin: Math.max(0, durationMin - taskMinutes),
      openTaskIds: d.openTaskIds || [],
    }, null, 2));
    break;
  }
  case 'mark-pushed': {
    (d.done || []).forEach((x) => { x.pushed = true; });
    save(d);
    console.log(`OK mark-pushed ${(d.done || []).length}`);
    break;
  }
  case 'reset': {
    save({ start: null, project: null, projectId: null, projectName: null, openTaskIds: [], done: [], status: 'closed' });
    console.log('OK reset');
    break;
  }
  default:
    console.error('Befehle: init | set | done | summary | mark-pushed | reset');
    process.exit(1);
}
