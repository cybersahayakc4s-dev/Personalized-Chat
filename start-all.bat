@echo off
echo ===================================================
echo Launching C4S-Connector (Backend + Frontend)
echo ===================================================

start "C4S-Connector - Backend" cmd /k "%~dp0start-server.bat"
timeout /t 2 /nobreak >nul
start "C4S-Connector - Frontend" cmd /k "%~dp0start-client.bat"

echo.
echo Both services are launching in separate windows.
echo - Backend API:  http://localhost:8000
echo - Frontend Web: http://localhost:5173
echo.
timeout /t 3 /nobreak >nul
start http://localhost:5173
