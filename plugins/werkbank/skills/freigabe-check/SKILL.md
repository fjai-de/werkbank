---
name: freigabe-check
description: 'Prüft eine Seite vollständig, bevor sie veröffentlicht oder an einen Kunden übergeben wird — Transport und TLS, Sicherheits-Header, Auszeichnung für Suche und Antwortmaschinen, Pflichtangaben, Ladezeiten, Barrierefreiheit, Verhalten auf dem Telefon und bei WordPress zusätzlich die typischen offenen Flanken. Ergebnis ist ein Urteil mit Bericht. Trigger; "freigabe", "/freigabe-check", "vor der veröffentlichung prüfen", "kann das live", "ist das startklar", "abnahme", "go-live check". Immer verwenden, bevor etwas live geht oder übergeben wird.'
---

# Freigabeprüfung

## Erste Nutzung auf diesem Rechner

Die Browser-Prüfungen brauchen Playwright. Fehlt `~/.claude/werkbank/freigabe/node_modules`, einmalig:

```bash
npm install --prefix "$HOME/.claude/werkbank/freigabe" && npx --prefix "$HOME/.claude/werkbank/freigabe" playwright install chromium
```

Unter Windows fällt die Zertifikats-Laufzeitprüfung weg, wenn `openssl` nicht im Pfad liegt — der Bericht weist das aus.

Der `/sicherheits-check` läuft bei jeder Session und schützt den Code. Diese Prüfung läuft
**einmal vor dem Start** und schaut auf das, was der Besucher tatsächlich bekommt.

Sie misst, statt zu vermuten. Jeder Befund trägt seinen Beleg mit sich, und was **nicht**
geprüft wurde, steht am Ende des Berichts.

---

## Aufruf

```bash
node ~/.claude/werkbank/freigabe/freigabe.mjs <url> [Optionen]
```

| Option | Wirkung |
|---|---|
| `--projekt=<pfad>` | Bindet den Projektordner ein: offene Sicherheitsbefunde, Git-Stand, und der Bericht wird dort abgelegt |
| `--routen=/a,/b` | Weitere Seiten, die antworten müssen |
| `--intern` | Die Seite soll **nicht** gefunden werden (Demo, Entwurf, Kundenvorschau). Blendet Suchmaschinen-Befunde aus und prüft stattdessen, ob `noindex` wirklich gesetzt ist |
| `--wordpress` | WordPress-Prüfungen einschalten — **nur nach Rückfrage**, siehe unten |
| `--budget=180` | Zeitbudget in Sekunden |
| `--json` | Maschinenlesbar |

**Exit-Code:** `0` = freigegeben oder mit Auflagen · `3` = **nicht freigegeben**, Blocker vorhanden · `1` = Fehler im Prüfer

---

## Ablauf

1. **Vorher fragen, wofür die Seite gedacht ist.** Öffentliche Seite oder interne Vorschau?
   Davon hängt ab, ob fehlende Auszeichnung ein Mangel oder egal ist — und ob `noindex`
   gewollt oder ein Fehler ist. Im Zweifel nachfragen, nicht raten.
2. **Bei WordPress: Eigentum klären.** Siehe Abschnitt „Grenze".
3. Prüfung laufen lassen, Bericht lesen.
4. **Blocker abarbeiten.** Ohne das keine Freigabe.
5. Ergebnis dem Auftraggeber nennen — mit Zahlen, nicht mit Zusicherungen.

---

## Was geprüft wird

| Bereich | Prüfungen |
|---|---|
| **Transport** | Antwortet die Seite · HTTP/2 · Kompression (gzip/Brotli) · HTTPS erzwungen · TLS-Zertifikat und Restlaufzeit |
| **Header** | Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, Referrer-Policy |
| **Auszeichnung** | Titel und Länge · Meta-Description · genau eine H1 · Canonical · `lang` · Viewport · Open Graph · JSON-LD vorhanden **und gültig** · Indexierbarkeit passend zur Absicht |
| **Auslieferung** | robots.txt · **sperrt sie Darstellungsdateien?** · Sitemap · llms.txt · alle angegebenen Routen |
| **Pflichtangaben** | Impressum und Datenschutz verlinkt **und erreichbar** — in Deutschland abmahnfähig |
| **Inhalt** | Bilder ohne Alt-Text · Position der Überschrift · seitliches Scrollen auf dem Telefon |
| **Messung** | LCP, CLS, TTFB, Anfragen, Übertragungsmenge · blockierende Skripte · JavaScript-Fehler · Verbindungen zu fremden Hosts |
| **Barrierefreiheit** | axe-core · Größe der Tap-Ziele |
| **Projekt** | Offene Sicherheitsbefunde · Alter der letzten Prüfung · Git-Stand gepusht · uncommittete Änderungen |
| **WordPress** | Nur mit `--wordpress`, siehe unten |

### Schwellen

- **Blocker** — verhindert die Freigabe: Seite antwortet nicht, unverschlüsselt erreichbar,
  Zertifikat abgelaufen, HSTS oder nosniff fehlen, keine H1, kein Viewport, ungültiges JSON-LD,
  robots.txt sperrt Darstellungsdateien, Impressum oder Datenschutz fehlen, LCP über 4 s,
  JavaScript-Fehler, seitliches Scrollen auf dem Telefon, offene schwere Sicherheitsbefunde
- **Warnung** — vor dem Start beheben, blockiert aber nicht
- **Hinweis** — bei Gelegenheit

---

## WordPress — Grenze, verbindlich

Die WordPress-Prüfungen rufen gezielt bestimmte Pfade ab (`/wp-json/wp/v2/users`, `xmlrpc.php`,
`readme.html`, `/wp-content/debug.log`). Das ist **mehr, als ein normaler Besucher tut**.

**Vor dem Einschalten von `--wordpress` immer klären:**

> Gehört die Seite uns oder liegt eine schriftliche Beauftragung vor?

- **Ja** → prüfen, Ergebnis in den Bericht.
- **Nein oder unklar** → **nicht** einschalten. Ohne Auftrag ist das unzulässig, und es
  widerspricht dem, was wir Kunden zusagen. Wer eine Prüfung will, bekommt ein Angebot.

Es wird nichts ausgenutzt und nichts verändert — nur gelesen, was der Server von sich aus
herausgibt. Das ändert aber nichts an der Auftragsfrage.

Geprüft wird: Version im Quelltext · `readme.html` · Benutzerliste über die REST-Schnittstelle ·
XML-RPC · offenes Debug-Protokoll · Verzeichnisauflistung · Erweiterungen und ihre Versionen ·
Erreichbarkeit der Anmeldeseite.

---

## Bericht

Mit `--projekt` entsteht `10_Weitermachen/freigabe/freigabe_<datum>.md`:
Urteil, Zählung nach Stufe, alle Befunde mit Beleg und Rat — und **alle bestandenen Prüfungen**.

Letzteres ist der eigentliche Wert gegenüber dem Kunden: nicht „ist sicher", sondern
„34 Prüfungen bestanden, hier ist die Liste, hier ist was offen blieb, hier ist was wir nicht
geprüft haben".

---

## Was diese Prüfung nicht leistet

- **Kein Penetrationstest.** Sie schaut auf die Oberfläche, nicht auf Geschäftslogik,
  Rechtekonzepte oder Architektur.
- **Keine inhaltliche Abnahme.** Ob die Texte stimmen, entscheidet ein Mensch.
- **Keine Aussage über Datenschutzkonformität.** Sie meldet Verbindungen zu fremden Hosts;
  ob dafür eine Grundlage besteht, ist eine juristische Frage.
- **Ein bestandener Lauf heißt „nichts von dem gefunden, wonach gesucht wurde"** — nicht „sicher".

Diese Einschränkungen gehören in jede Aussage gegenüber Kunden. Sie sind kein Kleingedrucktes,
sondern der Grund, warum man den Zahlen glauben kann.
