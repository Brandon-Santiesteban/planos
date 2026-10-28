@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
start "" "http://localhost:5173/?abrir=ejemplos/nueva-casa.casa.json&vista=3d"
call npm run dev
