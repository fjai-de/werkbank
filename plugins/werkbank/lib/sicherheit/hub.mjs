// Platzhalter: In der Werkbank gibt es kein Ticketsystem, an das Befunde gemeldet werden.
// pruefung.mjs ruft abgleichen() auf — hier passiert bewusst nichts, es wird nichts gesendet.
export async function abgleichen() {
  return { angelegt: 0, erledigt: 0, uebernommen: 0, geparkt: 0, hinweis: null };
}
