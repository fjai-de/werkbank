#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node fehlt. Bitte erst Node installieren: https://nodejs.org"; read -r -p "Enter zum Schließen"; exit 1; }
node "./zeig-app.mjs" "$@"
read -r -p "Enter zum Schließen"
