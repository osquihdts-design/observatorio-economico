@echo off
rem Doble clic para abrir el panel económico en el navegador.
cd /d "%~dp0"
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" servidor.py
pause
