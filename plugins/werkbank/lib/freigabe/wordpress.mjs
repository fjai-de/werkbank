/**
 * WordPress-spezifische Freigabeprüfungen.
 *
 * ACHTUNG — Grenze: Diese Prüfungen rufen gezielt bestimmte Pfade ab. Das ist
 * mehr, als ein normaler Besucher tut. Sie laufen deshalb NUR mit --wordpress
 * und ausschliesslich auf Seiten, die uns gehoeren oder fuer die eine
 * schriftliche Beauftragung vorliegt. Der Skill fragt das vorher ab.
 *
 * Es wird nichts ausgenutzt und nichts veraendert — nur gelesen, was der Server
 * von sich aus herausgibt.
 */
export async function pruefen({ ziel, html, hole, melde, ok, knapp }) {
  const basis = ziel.origin;

  /* --- Version sichtbar? --- */
  const gen = html ? (html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']WordPress ([\d.]+)/i) || [])[1] : null;
  if (gen) melde("WordPress", "warnung", "WordPress-Version im Quelltext sichtbar", "Version " + gen,
    "Generator-Meta entfernen. Die Version verraet Angreifern, welche Luecken in Frage kommen.");
  else ok("WordPress", "Keine Version im Generator-Meta", null);

  const readme = await hole(basis + "/readme.html", { method: "HEAD" });
  if (readme && readme.status === 200) melde("WordPress", "warnung", "readme.html oeffentlich erreichbar", "HTTP 200",
    "Datei loeschen — sie nennt die WordPress-Version im Klartext.");
  else ok("WordPress", "readme.html nicht erreichbar", "HTTP " + (readme?.status ?? "—"));

  /* --- Benutzer-Aufzaehlung --- */
  if (!knapp()) {
    const users = await hole(basis + "/wp-json/wp/v2/users");
    if (users && users.status === 200) {
      let n = 0, namen = [];
      try { const j = JSON.parse(users.text); n = Array.isArray(j) ? j.length : 0; namen = (j || []).map(u => u.slug).slice(0, 3); } catch {}
      if (n) melde("WordPress", "blocker", "Benutzernamen oeffentlich abrufbar", n + " Konten ueber /wp-json/wp/v2/users",
        "Damit hat ein Angreifer die halbe Anmeldung. REST-Route fuer Benutzer sperren oder auf angemeldete Nutzer beschraenken.");
      else ok("WordPress", "Benutzerliste leer", "HTTP 200, 0 Eintraege");
    } else ok("WordPress", "Benutzerliste nicht abrufbar", "HTTP " + (users?.status ?? "—"));
  }

  /* --- XML-RPC --- */
  if (!knapp()) {
    const x = await hole(basis + "/xmlrpc.php", { method: "POST", body: "<methodCall><methodName>system.listMethods</methodName></methodCall>", headers: { "Content-Type": "text/xml" } });
    if (x && x.status === 200 && /methodResponse/i.test(x.text || "")) melde("WordPress", "warnung", "XML-RPC ist offen", "system.listMethods antwortet",
      "XML-RPC wird fuer Anmelde-Angriffe und Verstaerkung genutzt. Abschalten, wenn nicht gebraucht.");
    else ok("WordPress", "XML-RPC nicht nutzbar", "HTTP " + (x?.status ?? "—"));
  }

  /* --- Debug-Protokoll --- */
  const dbg = await hole(basis + "/wp-content/debug.log", { method: "HEAD" });
  if (dbg && dbg.status === 200) melde("WordPress", "blocker", "Debug-Protokoll oeffentlich lesbar", "/wp-content/debug.log",
    "Sofort sperren. Solche Protokolle enthalten Pfade, Abfragen und gelegentlich Zugangsdaten.");
  else ok("WordPress", "Kein offenes Debug-Protokoll", "HTTP " + (dbg?.status ?? "—"));

  /* --- Verzeichnisauflistung --- */
  const up = await hole(basis + "/wp-content/uploads/");
  if (up && up.status === 200 && /Index of|<title>Verzeichnis/i.test(up.text || "")) melde("WordPress", "warnung", "Verzeichnisauflistung aktiv", "/wp-content/uploads/",
    "Auflistung abschalten — sonst ist jede hochgeladene Datei auffindbar, auch unverlinkte.");
  else ok("WordPress", "Keine Verzeichnisauflistung", null);

  /* --- Erweiterungen und ihre Versionen im Quelltext --- */
  if (html) {
    const plugins = [...new Set([...html.matchAll(/\/wp-content\/plugins\/([a-z0-9._-]+)\//gi)].map(m => m[1]))];
    const mitVersion = [...new Set([...html.matchAll(/\/wp-content\/plugins\/([a-z0-9._-]+)\/[^"']*\?ver=([\d.]+)/gi)].map(m => m[1] + " " + m[2]))];
    if (plugins.length) {
      ok("WordPress", "Erweiterungen im Quelltext sichtbar", plugins.length + ": " + plugins.slice(0, 6).join(", "));
      if (mitVersion.length) melde("WordPress", "hinweis", "Erweiterungs-Versionen im Dateipfad sichtbar", mitVersion.slice(0, 4).join(" · "),
        "Versionsnummern aus den Asset-URLs entfernen. Sie sind keine Luecke, erleichtern aber die Vorbereitung eines Angriffs.");
    }
  }

  /* --- Anmeldeseite --- */
  const login = await hole(basis + "/wp-login.php", { method: "HEAD" });
  if (login && login.status === 200) melde("WordPress", "hinweis", "Anmeldeseite oeffentlich erreichbar", "/wp-login.php",
    "Erwartbar. Bei Kundenseiten pruefen, ob Ratenbegrenzung oder Zwei-Faktor aktiv ist.");
}
