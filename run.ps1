$ErrorActionPreference = 'Stop'

$rootDir = $PSScriptRoot
$backendDir = Join-Path $rootDir 'backend'
$frontendDir = Join-Path $rootDir 'frontend'
$composeFile = Join-Path $rootDir 'docker-compose.yml'
$processes = @()

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. Install it and reopen PowerShell."
  }
}

function Invoke-Npm {
  param(
    [string]$Directory,
    [string[]]$Arguments
  )

  Push-Location $Directory
  try {
    & npm.cmd @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "npm $($Arguments -join ' ') failed in $Directory."
    }
  }
  finally {
    Pop-Location
  }
}

function Test-PortAvailable {
  param([int]$Port)

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    return $true
  }
  catch {
    return $false
  }
  finally {
    if ($listener) {
      $listener.Stop()
    }
  }
}

function Wait-ForDatabase {
  param(
    [string]$Service,
    [string[]]$CheckArguments
  )

  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    & docker compose -f $composeFile exec -T $Service @CheckArguments *> $null
    if ($LASTEXITCODE -eq 0) {
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "$Service did not become ready. Check with: docker compose logs $Service"
}

function Stop-ProcessTree {
  param([System.Diagnostics.Process]$Process)

  if ($Process -and -not $Process.HasExited) {
    & taskkill.exe /PID $Process.Id /T /F *> $null
  }
}

try {
  Set-Location $rootDir
  Assert-Command 'node'
  Assert-Command 'npm'
  Assert-Command 'docker'

  & docker compose version *> $null
  if ($LASTEXITCODE -ne 0) {
    throw 'Docker Compose is required. Start or install Docker Desktop, then retry.'
  }

  $nodeVersion = (& node -p "Number(process.versions.node.split('.')[0])")
  if ([int]$nodeVersion -lt 18) {
    throw 'Node.js 18 or newer is required.'
  }

  foreach ($port in @(5173, 5000)) {
    if (-not (Test-PortAvailable $port)) {
      throw "Port $port is already in use. Stop its current process, then rerun .\run.ps1."
    }
  }

  $envFile = Join-Path $backendDir '.env'
  if (-not (Test-Path $envFile)) {
    $envExample = Join-Path $backendDir '.env.example'
    if (-not (Test-Path $envExample)) {
      throw 'backend/.env.example is missing.'
    }
    Copy-Item $envExample $envFile
    Write-Host 'Created backend/.env from backend/.env.example.'
  }

  $dependenciesReady = (Test-Path (Join-Path $backendDir 'node_modules/.bin/prisma.cmd')) -and
    (Test-Path (Join-Path $frontendDir 'node_modules/.bin/vite.cmd'))

  if ($dependenciesReady) {
    Push-Location $backendDir
    try {
      & npm.cmd ls --depth=0 *> $null
      $dependenciesReady = $LASTEXITCODE -eq 0
    }
    finally {
      Pop-Location
    }
  }

  if (-not $dependenciesReady) {
    Write-Host 'Installing backend and frontend dependencies...'
    Invoke-Npm $backendDir @('ci')
    Invoke-Npm $frontendDir @('ci')
  }

  Write-Host 'Starting local PostgreSQL and MongoDB...'
  & docker compose -f $composeFile up -d
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not start the local databases with Docker Compose.'
  }

  Write-Host 'Waiting for databases to become ready...'
  Wait-ForDatabase 'postgres' @('pg_isready', '-U', 'seniorsos_user', '-d', 'seniorsos')
  Wait-ForDatabase 'mongodb' @('mongosh', '--quiet', '--eval', 'quit(db.adminCommand({ping: 1}).ok ? 0 : 1)')

  Write-Host 'Generating Prisma client and applying database migrations...'
  Invoke-Npm $backendDir @('run', 'db:generate')
  Invoke-Npm $backendDir @('run', 'db:migrate:prod')

  Write-Host 'Starting SeniorSOS frontend and backend...'
  $processes += Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort') `
    -WorkingDirectory $frontendDir -NoNewWindow -PassThru
  $processes += Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'dev') `
    -WorkingDirectory $backendDir -NoNewWindow -PassThru

  Write-Host 'Frontend: http://localhost:5173'
  Write-Host 'Backend:  http://localhost:5000'
  Write-Host 'Databases: PostgreSQL :5433, MongoDB :27018'
  Write-Host 'Press Ctrl+C to stop the frontend and backend.'

  while (($processes | Where-Object { -not $_.HasExited }).Count -eq $processes.Count) {
    Start-Sleep -Seconds 1
  }

  $failedProcess = $processes | Where-Object { $_.HasExited } | Select-Object -First 1
  if ($failedProcess) {
    throw "A development server exited (process $($failedProcess.Id))."
  }
}
finally {
  foreach ($process in $processes) {
    Stop-ProcessTree $process
  }
}