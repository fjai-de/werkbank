@echo off
rem Werkbank einrichten - Doppelklick genuegt. Laedt und installiert alle Programme.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install\install.ps1" %*
echo.
pause
