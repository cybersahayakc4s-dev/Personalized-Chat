# Personalize Chat - Windows Startup Setup Script
# This script registers Personalize Chat in your Windows Startup directory so it automatically launches on laptop boot.

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Personalize Chat - Windows Startup Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$StartupFolder = [System.Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupFolder "PersonalizeChat.lnk"

# Detect default chromium browser (Edge or Chrome)
$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $EdgePath)) {
    $EdgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $ChromePath)) {
    $ChromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

$BrowserPath = ""
if (Test-Path $EdgePath) {
    $BrowserPath = $EdgePath
} elseif (Test-Path $ChromePath) {
    $BrowserPath = $ChromePath
}

if (-not $BrowserPath) {
    Write-Host "[!] Could not locate Edge or Chrome. Creating standard web shortcut..." -ForegroundColor Yellow
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = "http://localhost:5173"
    $Shortcut.Description = "Personalize Chat Internal Office Web App"
    $Shortcut.Save()
} else {
    Write-Host "[+] Found browser: $BrowserPath" -ForegroundColor Green
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $BrowserPath
    # Launch in chromeless desktop app window mode
    $Shortcut.Arguments = "--app=http://localhost:5173 --start-maximized"
    $Shortcut.Description = "Personalize Chat Internal Office Web App"
    $Shortcut.WindowStyle = 1
    $Shortcut.Save()
}

Write-Host "[OK] Successfully installed startup shortcut at:" -ForegroundColor Green
Write-Host "     $ShortcutPath" -ForegroundColor White
Write-Host ""
Write-Host "Personalize Chat will now open automatically whenever this laptop turns on and you log in." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
