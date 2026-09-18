#!/usr/bin/env node
// UserPromptSubmit-Hook: Bei "machen wir morgen weiter" wird vor der Antwort eine Uebergabe verlangt.
let roh = "";
process.stdin.on("data", d => (roh += d));
process.stdin.on("end", () => {
  if (!roh.toLowerCase().includes("machen wir morgen weiter")) process.exit(0);
  const datum = new Date().toISOString().slice(0, 10);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext:
        `HANDOFF PFLICHT: Erstelle JETZT als allererstes (bevor du antwortest) eine Datei HANDOFF_${datum}.md im aktuellen Projektverzeichnis. ` +
        "Die Datei muss so vollständig sein, dass ein anderer Claude-Agent in einer neuen Session NUR mit dieser Datei weiterarbeiten kann — kein Projektscan nötig. " +
        "Pflichtstruktur: ## Projekt & Ziel, ## Was heute erledigt wurde (konkrete Änderungen mit Dateipfaden), ## Aktueller Stand (was funktioniert, was nicht, was offen), " +
        "## Nächste Schritte (nummeriert, konkret), ## Wichtige Dateipfade & Architektur, ## Offene Probleme & Fragen. " +
        "Schreibe keine Zugangsdaten in die Datei. Dann antworte normal mit 'Bis morgen!'",
    },
  }));
  process.exit(0);
});
