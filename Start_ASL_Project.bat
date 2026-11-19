@echo off
title ASL Project Startup Manager
echo.
echo =========================================
echo    STARTING ASL ENGINE - PLEASE WAIT...
echo =========================================
echo.

set "PY_EXE=python"

:: Set your Gemini API key for LLM-powered word autocomplete
:: Get a free key at https://aistudio.google.com/app/apikey
set "GEMINI_API_KEY="
set "PYTHONIOENCODING=utf-8"

if exist "%~dp0ASL Backend\venv\Scripts\python.exe" (
    "%~dp0ASL Backend\venv\Scripts\python.exe" -V >nul 2>&1
    if not errorlevel 1 (
        set "PY_EXE=%~dp0ASL Backend\venv\Scripts\python.exe"
    )
)

echo [1/2] Launching Backend Flask Server (Port 5000)...
cd /d "%~dp0\ASL Backend"
start "ASL Backend Server" cmd /k ""%PY_EXE%" app.py"

echo [2/2] Launching Frontend Interface (Port 8000)...
cd /d "%~dp0\ASL Frontend"
start "ASL Frontend Server" cmd /k ""%PY_EXE%" -m http.server 8000"

:: Wait 2 seconds for servers to initialize
timeout /t 2 /nobreak > NUL

:: Open browser with unique session parameter to force fresh reload (bypasses stale cached tabs)
echo Opening ASL Detector in your browser...
start http://localhost:8000/detector.html?t=%RANDOM%%TIME:~6,2%

echo.
echo =========================================
echo    System is RUNNING.
echo =========================================
timeout /t 3 > NUL
