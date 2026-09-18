#!/bin/bash
# Fuer den Workshop-Leiter: Teilnehmer in die Werkstatt-Organisation einladen und ihnen
# Lesezugriff auf das Werkbank-Repo geben.
#
#   bash einladen.sh <org> anna-gh ben-gh …        einladen
#   bash einladen.sh <org> --stand                 wer ist drin, wer hat noch nicht angenommen
#   bash einladen.sh <org> --entfernen anna-gh     Mitgliedschaft beenden
#
# Laeuft mit der EIGENEN gh-Anmeldung des Leiters (Scope admin:org). Teilnehmer bekommen nie diesen Zugang.
set -u
ORG="${1:?Aufruf: einladen.sh <org> <github-name>… | --stand | --entfernen <name>}"; shift
TEAM="teilnehmer"; REPO="werkbank"

if [ "${1:-}" = "--stand" ]; then
  echo "Mitglieder:";  gh api "orgs/$ORG/members" --paginate -q '.[].login' | sed 's/^/  /'
  echo "Offene Einladungen:"; gh api "orgs/$ORG/invitations" --paginate -q '.[].login' | sed 's/^/  /'
  echo "Plaetze: $(gh api "orgs/$ORG" -q '"\(.plan.filled_seats) von \(.plan.seats) belegt (Tarif \(.plan.name))"')"
  exit 0
fi
if [ "${1:-}" = "--entfernen" ]; then gh api -X DELETE "orgs/$ORG/memberships/${2:?name fehlt}" && echo "entfernt: $2"; exit $?; fi

# Team anlegen (geschlossen) und ans Werkbank-Repo haengen — nur lesen
gh api "orgs/$ORG/teams/$TEAM" >/dev/null 2>&1 || gh api -X POST "orgs/$ORG/teams" -f name="$TEAM" -f privacy=closed -f description="Workshop-Teilnehmer" >/dev/null
gh api -X PUT "orgs/$ORG/teams/$TEAM/repos/$ORG/$REPO" -f permission=pull >/dev/null 2>&1 || echo "! Repo $ORG/$REPO nicht gefunden — Team hat noch keinen Zugriff"

for NAME in "$@"; do
  # Team-Mitgliedschaft laedt automatisch in die Organisation ein (Rolle member)
  if gh api -X PUT "orgs/$ORG/teams/$TEAM/memberships/$NAME" -f role=member -q '"  \(.state)"' 2>/tmp/einladen.err; then echo "  $NAME eingeladen"
  else echo "  ! $NAME: $(sed -n 's/.*"message":"\([^"]*\)".*/\1/p' /tmp/einladen.err | head -1)"; fi
done
echo; echo "Teilnehmer nehmen an unter: https://github.com/orgs/$ORG/invitation"
