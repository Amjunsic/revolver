@echo off
cd /d "%~dp0"
echo.
echo  Serving this folder: %CD%
echo  Open in your browser: http://127.0.0.1:5173/
echo  Press Ctrl+C to stop.
echo.
python -m http.server 5173
