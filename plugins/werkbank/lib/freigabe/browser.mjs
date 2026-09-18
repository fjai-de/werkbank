/**
 * Messungen im echten Browser: Ladeverhalten, Barrierefreiheit, JS-Fehler,
 * Verhalten auf dem Telefon. Nur was gemessen wurde, steht im Bericht.
 */
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { chromium, devices } from "playwright";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const AXE = fs.readFileSync(path.join(HIER, "node_modules", "axe-core", "axe.min.js"), "utf8");

export async function pruefen({ ziel, melde, ok, restMs }) {
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { melde("Messung", "hinweis", "Browser startet nicht", e.message.slice(0, 70), "npx playwright install chromium ausfuehren."); return; }

  try {
    /* ---------- Desktop: Ladeverhalten ---------- */
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const seite = await ctx.newPage();
    const jsFehler = [], konsole = [];
    seite.on("pageerror", e => jsFehler.push(String(e).slice(0, 100)));
    seite.on("console", m => { if (m.type() === "error") konsole.push(m.text().slice(0, 100)); });

    await seite.goto(ziel.href, { waitUntil: "load", timeout: Math.min(45000, Math.max(8000, restMs())) });
    await seite.waitForTimeout(2500);

    const m = await seite.evaluate(() => new Promise(res => {
      let lcp = 0, cls = 0;
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime); }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
      setTimeout(() => {
        const nav = performance.getEntriesByType("navigation")[0] || {};
        const r = performance.getEntriesByType("resource");
        const fcp = performance.getEntriesByType("paint").find(x => x.name === "first-contentful-paint");
        const h1 = document.querySelector("h1");
        res({
          ttfb: Math.round(nav.responseStart || 0), fcp: Math.round(fcp?.startTime || 0),
          lcp: Math.round(lcp), cls: +cls.toFixed(3),
          requests: r.length + 1,
          kb: Math.round((r.reduce((a, x) => a + (x.transferSize || 0), 0) + (nav.transferSize || 0)) / 1024),
          blockendeSkripte: document.querySelectorAll("script[src]:not([defer]):not([async])").length,
          h1Position: h1 ? Math.round(h1.getBoundingClientRect().top + scrollY) : null,
          extern: [...new Set(r.map(x => { try { return new URL(x.name).host; } catch { return null; } }).filter(h => h && h !== location.host))].slice(0, 5)
        });
      }, 1400);
    }));

    if (m.lcp > 4000) melde("Messung", "blocker", "Ladezeit deutlich zu hoch", "LCP " + (m.lcp / 1000).toFixed(1) + " s", "Google bewertet ab 4 s als schlecht. Groesstes sichtbares Element pruefen — meist ein Bild oder eine Werbeflaeche.");
    else if (m.lcp > 2500) melde("Messung", "warnung", "Ladezeit ueber dem Richtwert", "LCP " + (m.lcp / 1000).toFixed(1) + " s", "Google-Schwelle fuer 'gut' ist 2,5 s.");
    else ok("Messung", "Largest Contentful Paint", (m.lcp / 1000).toFixed(2) + " s");

    if (m.cls > 0.25) melde("Messung", "warnung", "Layout springt stark", "CLS " + m.cls, "Feste Hoehen fuer Bilder und Werbeflaechen reservieren.");
    else if (m.cls > 0.1) melde("Messung", "hinweis", "Layout springt leicht", "CLS " + m.cls, "Richtwert ist 0,1.");
    else ok("Messung", "Layoutstabilitaet", "CLS " + m.cls);

    ok("Messung", "Umfang", m.requests + " Anfragen, " + m.kb + " KB");
    if (m.requests > 60) melde("Messung", "hinweis", "Viele Einzelanfragen", m.requests + " Anfragen", "Zusammenfassen oder HTTP/2 sicherstellen.");
    if (m.blockendeSkripte > 5) melde("Messung", "warnung", "Viele blockierende Skripte", m.blockendeSkripte + " ohne defer/async", "defer ergaenzen, wo das Skript nicht sofort gebraucht wird.");
    else ok("Messung", "Blockierende Skripte", m.blockendeSkripte);

    if (m.h1Position !== null && m.h1Position > 900)
      melde("Inhalt", "warnung", "Ueberschrift beginnt unterhalb des Bildschirms", "y = " + m.h1Position + " px bei 900 px Hoehe",
        "Der Leser sieht zuerst alles ausser dem Thema. Reihenfolge drehen.");
    else if (m.h1Position !== null) ok("Inhalt", "Ueberschrift im Sichtbereich", "y = " + m.h1Position + " px");

    if (m.extern.length) melde("Messung", "hinweis", "Verbindungen zu fremden Hosts", m.extern.join(", "), "Datenschutzrechtlich pruefen — jede fremde Verbindung braucht eine Grundlage.");
    else ok("Messung", "Keine fremden Hosts", "0");

    if (jsFehler.length) melde("Messung", "blocker", "JavaScript-Fehler auf der Seite", jsFehler[0], "Fehler beheben — sie brechen oft still Funktionen ab.");
    else ok("Messung", "Keine JavaScript-Fehler", "0");
    if (konsole.length) melde("Messung", "hinweis", "Fehlermeldungen in der Konsole", konsole.length + " Stueck: " + konsole[0], "Ansehen, ob dahinter ein echter Fehler steckt.");

    /* ---------- Barrierefreiheit ---------- */
    await seite.addScriptTag({ content: AXE });
    const a = await seite.evaluate(async () => {
      const r = await axe.run(document, { resultTypes: ["violations"] });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help }));
    });
    const schwer = a.filter(v => v.impact === "critical" || v.impact === "serious");
    const stellen = a.reduce((x, v) => x + v.n, 0);
    if (schwer.length) melde("Barrierefreiheit", "warnung", "Schwere Verstoesse", stellen + " Stellen: " + schwer.map(v => v.help).slice(0, 2).join("; "),
      "Seit Juni 2025 gilt das Barrierefreiheitsstaerkungsgesetz. Kontraste und Beschriftungen zuerst.");
    else if (a.length) melde("Barrierefreiheit", "hinweis", "Leichte Verstoesse", stellen + " Stellen", "Bei Gelegenheit beheben.");
    else ok("Barrierefreiheit", "Keine Verstoesse (axe-core)", "0");

    await ctx.close();

    /* ---------- Telefon ---------- */
    const mob = await browser.newPage({ ...devices["iPhone 13"] });
    await mob.goto(ziel.href, { waitUntil: "load", timeout: Math.min(40000, Math.max(8000, restMs())) });
    await mob.waitForTimeout(1200);
    const t = await mob.evaluate(() => ({
      ueberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      klein: [...document.querySelectorAll("a,button,input,select")]
        .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44; }).length,
      gesamt: document.querySelectorAll("a,button,input,select").length
    }));
    if (t.ueberlauf > 0) melde("Inhalt", "blocker", "Seite scrollt auf dem Telefon seitlich", t.ueberlauf + " px zu breit", "Ein Element ist breiter als der Bildschirm. Vor der Freigabe beheben.");
    else ok("Inhalt", "Kein seitliches Scrollen auf dem Telefon", "0 px");
    if (t.klein > t.gesamt * 0.3 && t.klein > 5) melde("Barrierefreiheit", "warnung", "Viele zu kleine Tap-Ziele", t.klein + " von " + t.gesamt + " unter 44 px", "Mindestens 44 px Hoehe, sonst trifft man auf dem Telefon daneben.");
    else ok("Barrierefreiheit", "Tap-Ziele", t.klein + " von " + t.gesamt + " unter 44 px");
    await mob.close();

  } catch (e) {
    melde("Messung", "hinweis", "Browser-Pruefung abgebrochen", String(e.message || e).slice(0, 80), "Erneut versuchen oder --budget erhoehen.");
  } finally { try { await browser.close(); } catch {} }
}
