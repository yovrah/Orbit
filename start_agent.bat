@echo off
title Orbit Remote Agent
echo Starting Orbit Remote Agent...
cd /d "%~dp0agent"
if not exist "venv\Scripts\activate.bat" (
    echo Error: Virtual environment (venv) not found in %CD%
    pause
    exit /b
)
call venv\Scripts\activate.bat
python src/main.py
pause
