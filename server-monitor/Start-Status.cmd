@echo off
cd /d "%~dp0"
if not exist "%~dp0api-token.txt" (
    copy "%~dp0api-token.example.txt" "%~dp0api-token.txt" >nul
    echo Paste the real Satisfactory API token into the file, save it, and close Notepad.
    start /wait "" notepad.exe "%~dp0api-token.txt"
)
if not exist "%~dp0github-token.txt" (
    copy "%~dp0github-token.example.txt" "%~dp0github-token.txt" >nul
    echo Paste your GitHub token for Thomzone-status, save, and close Notepad.
    start /wait "" notepad.exe "%~dp0github-token.txt"
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Thomzone-Status.ps1" -Watch -IntervalSeconds 900 -TokenFile "%~dp0api-token.txt" -GitHubTokenFile "%~dp0github-token.txt" -OutputPath "%~dp0server-status.json"
pause
