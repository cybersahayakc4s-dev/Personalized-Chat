@echo off
echo ===================================================
echo Starting C4S-Connector Backend Server (FastAPI)
echo ===================================================
cd /d "%~dp0server"

:: Check and free port 8000 if occupied by a stale zombie process
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Freeing existing process on port 8000 [PID %%a]
    taskkill /F /PID %%a >nul 2>&1
)

:: Run safe dev server with scoped watchdir (app/) and fast shutdown timeout
python -m uvicorn app.main:combined_asgi_app --reload --reload-dir app --timeout-graceful-shutdown 1 --host 0.0.0.0 --port 8000
if errorlevel 1 (
    echo.
    echo Notice: Falling back to run_dev.py...
    python run_dev.py
)
pause
