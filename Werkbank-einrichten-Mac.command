#!/bin/bash
# Werkbank einrichten - Doppelklick genuegt.
cd "$(dirname "$0")" && bash install/install.sh
echo; read -r -p "Fenster schliessen mit Enter " _
