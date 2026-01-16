Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\marks\projects\my-task-tracker"

if (-not (Test-Path -LiteralPath $repoRoot)) {
  Write-Host "Repo not found at: $repoRoot" -ForegroundColor Red
  Write-Host "Edit TaskTracker.ps1 and update `$repoRoot to your local path."
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host "Starting Task Tracker..." -ForegroundColor Cyan

# Kill any existing processes on ports 5173 and 3001 to avoid conflicts
Write-Host "Checking for port conflicts..." -ForegroundColor Yellow
try {
  Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { 
    Write-Host "  Stopping process on port 5173 (PID: $($_.OwningProcess))" -ForegroundColor Yellow
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue 
  }
  Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { 
    Write-Host "  Stopping process on port 3001 (PID: $($_.OwningProcess))" -ForegroundColor Yellow
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue 
  }
} catch {
  # Ignore errors - ports may not be in use
}
Write-Host "Ports cleared." -ForegroundColor Green

# Check if dependencies are installed
$nodeModulesRoot = Join-Path $repoRoot "node_modules"
$nodeModulesServer = Join-Path $repoRoot "server\node_modules"
$nodeModulesClient = Join-Path $repoRoot "client\node_modules"

if (-not (Test-Path $nodeModulesRoot) -or -not (Test-Path $nodeModulesServer) -or -not (Test-Path $nodeModulesClient)) {
  Write-Host "Installing dependencies... (this may take a minute)" -ForegroundColor Yellow
  Push-Location $repoRoot
  npm install
  Push-Location "server"
  npm install
  Pop-Location
  Push-Location "client"
  npm install
  Pop-Location
  Pop-Location
  Write-Host "Dependencies installed." -ForegroundColor Green
}

# Start the dev stack (server + client) in a new terminal window
Write-Host "Starting servers..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" -WorkingDirectory $repoRoot -WindowStyle Minimized -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "Write-Host 'Task Tracker Servers Running - Close this window to stop' -ForegroundColor Green; npm run dev; Read-Host 'Press Enter to close'"
)

# Wait for servers to start
Write-Host "Waiting for servers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

# Check if servers are running
$serverRunning = $false
$clientRunning = $false
for ($i = 0; $i -lt 10; $i++) {
  try {
    $null = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    $serverRunning = $true
  } catch { }
  
  try {
    $null = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -ErrorAction SilentlyContinue
    $clientRunning = $true
  } catch { }
  
  if ($serverRunning -and $clientRunning) { break }
  Start-Sleep -Seconds 1
}

if ($serverRunning -and $clientRunning) {
  Write-Host "Servers started successfully!" -ForegroundColor Green
  # Open the app in your default browser
  Start-Process "http://localhost:5173/"
} else {
  Write-Host "Warning: Servers may not have started correctly." -ForegroundColor Yellow
  if (-not $serverRunning) { Write-Host "  - Backend server not responding on port 3001" -ForegroundColor Red }
  if (-not $clientRunning) { Write-Host "  - Frontend server not responding on port 5173" -ForegroundColor Red }
  Write-Host "Opening browser anyway..." -ForegroundColor Yellow
  Start-Process "http://localhost:5173/"
}
