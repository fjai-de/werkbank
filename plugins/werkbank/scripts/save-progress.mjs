#!/usr/bin/env node
// PreCompact-Hook: sichert den Stand als SESSION-PROGRESS.md im Projektordner,
// bevor der Kontext komprimiert wird. Rein lokal, Fehler werden geschluckt.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

try {
  const cwd = process.cwd();
  const git = (...a) => { try { return execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
  const branch = git("branch", "--show-current") || "kein git";
  const commits = git("log", "--oneline", "-5") || "kein git";
  const geaendert = git("status", "--short") || "—";

  let seit = 0;
  try { seit = Date.parse(fs.readFileSync(path.join(os.homedir(), ".claude", "werkbank", ".session-start"), "utf8")); } catch {}
  const AUSLASSEN = new Set([".git", "node_modules", ".next", "dist", "build", ".venv", "graphify-out"]);
  const frisch = [];
  const lauf = (dir, tiefe) => {
    if (tiefe > 5 || frisch.length >= 30) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (AUSLASSEN.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) lauf(p, tiefe + 1);
      else if (seit && fs.statSync(p).mtimeMs > seit && frisch.length < 30) frisch.push(path.relative(cwd, p));
    }
  };
  try { lauf(cwd, 0); } catch {}

  const jetzt = new Date().toISOString().slice(0, 16).replace("T", " ");
  const text = `# Session-Fortschritt – ${jetzt}

> Automatisch gespeichert vor der Kontext-Komprimierung.

## Arbeitsverzeichnis
\`${cwd}\`

## Git
- Branch: \`${branch}\`

### Letzte Commits
\`\`\`
${commits}
\`\`\`

### Geändert seit letztem Commit
\`\`\`
${geaendert}
\`\`\`

### In dieser Session angefasste Dateien
\`\`\`
${frisch.join("\n") || "—"}
\`\`\`
`;
  fs.writeFileSync(path.join(cwd, "SESSION-PROGRESS.md"), text);
} catch { /* bewusst still */ }
process.exit(0);
