@echo off
echo ===================================================
echo Starting C4S-Connector Frontend (React + Vite)
echo ===================================================
cd /d "%~dp0client"

:: Ensure Node.js and npm are available in PATH
where npm >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64" (
        set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;%PATH%"
    )
)

call npm run dev
pause
