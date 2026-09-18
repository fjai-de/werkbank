# Teilnehmer-App in Coolify einrichten (je App einmal, ~3 min)

Voraussetzung, einmalig: Sources → GitHub App für die Organisation `fjai-de` angelegt und auf „All repositories" installiert.

1. Projekt `Workshop` → **+ New** → *Private Repository (with GitHub App)* → Repo wählen, Branch `main`
2. Build Pack laut `DEPLOY.md` im Repo: Nixpacks (Node) · Static · Dockerfile — Port eintragen
3. Domain: `https://<wunschname>-app.fjai.de` — **einlabelig**, zwei Ebenen brechen am Zertifikat
4. Environment Variables: Werte vom Teilnehmer direkt geben lassen, nie über Chat oder Repo
5. Dauerhafte Daten laut `DEPLOY.md` → Storages → Volume auf den genannten Pfad
6. **Resource Limits setzen:** Memory 512 MB, CPUs 0.5 — eine App in der Absturzschleife bremst sonst den ganzen Server
7. Health Check auf den genannten Pfad einschalten, *Auto Deploy* an lassen → Deploy

Danach baut jeder Push auf `main` neu. Absturzschleife erkennen: Status wechselt ständig `restarting` → App stoppen, Log an den Teilnehmer.
