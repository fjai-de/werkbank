@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node fehlt. Bitte erst Node installieren: https://nodejs.org & pause & exit /b 1)
node "%~dp0zeig-app.mjs" %*
pause
