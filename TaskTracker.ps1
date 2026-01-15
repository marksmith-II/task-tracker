Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\marks\projects\my-task-tracker"

if (-not (Test-Path -LiteralPath $repoRoot)) {
  Write-Host "Repo not found at: $repoRoot" -ForegroundColor Red
  Write-Host "Edit TaskTracker.ps1 and update `$repoRoot to your local path."
  exit 1
}

# Start the dev stack (server + client) in a minimized terminal window.
Start-Process -FilePath "powershell.exe" -WorkingDirectory $repoRoot -WindowStyle Minimized -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "npm run dev"
)

Start-Sleep -Seconds 2

# Open the app in your default browser.
Start-Process "http://localhost:5173/"

