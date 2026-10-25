# k8s/verify.ps1
# Checks that SeniorSOS is healthy on the local Kubernetes cluster.
#
#   .\k8s\verify.ps1
#
# Read-only: it only looks (kubectl get/logs/top and a few HTTP GETs). It changes
# nothing in the cluster and never contacts or writes to the cloud databases
# directly. Exits with code 1 if any check FAILs, so it can be used in scripts.

param(
  [string]$ExpectedContext = 'docker-desktop',
  [string]$Url = 'http://localhost:8080'
)

$ErrorActionPreference = 'Continue'
$namespace = 'seniorsos'
$script:failures = 0
$script:warnings = 0

function Report([string]$Status, [string]$Name, [string]$Detail = '') {
  $color = switch ($Status) { 'PASS' { 'Green' } 'WARN' { 'Yellow' } default { 'Red' } }
  if ($Status -eq 'FAIL') { $script:failures++ }
  if ($Status -eq 'WARN') { $script:warnings++ }
  $line = "  [{0}] {1}" -f $Status, $Name
  if ($Detail) { $line += "  - $Detail" }
  Write-Host $line -ForegroundColor $color
}

function Get-Json([string[]]$KubectlArgs) {
  $out = & kubectl @KubectlArgs -o json 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $out) { return $null }
  return ($out -join "`n") | ConvertFrom-Json
}

function Invoke-Http([string]$Path) {
  # Returns @{ Status; Headers; Body } and never throws on 4xx/5xx.
  try {
    $r = Invoke-WebRequest -Uri ($Url + $Path) -UseBasicParsing -TimeoutSec 10
    return @{ Status = [int]$r.StatusCode; Headers = $r.Headers; Body = $r.Content }
  }
  catch {
    $resp = $_.Exception.Response
    if ($resp) { return @{ Status = [int]$resp.StatusCode; Headers = $resp.Headers; Body = '' } }
    return @{ Status = 0; Headers = @{}; Body = '' }
  }
}

Write-Host ''
Write-Host 'SeniorSOS Kubernetes check' -ForegroundColor Cyan

# ── Cluster ──────────────────────────────────────────────────────────────────
Write-Host "`nCluster"
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
  Report 'FAIL' 'kubectl is installed' 'not found'
  exit 1
}
$context = (& kubectl config current-context 2>$null)
if ($context -eq $ExpectedContext) { Report 'PASS' 'kubectl context' $context }
else { Report 'FAIL' 'kubectl context' "is '$context', expected '$ExpectedContext'"; exit 1 }

$nodes = Get-Json @('get', 'nodes')
if ($nodes -and $nodes.items.Count -gt 0) {
  $notReady = @($nodes.items | Where-Object { ($_.status.conditions | Where-Object { $_.type -eq 'Ready' }).status -ne 'True' })
  if ($notReady.Count -eq 0) { Report 'PASS' 'node is Ready' "$($nodes.items.Count) node(s), Kubernetes $($nodes.items[0].status.nodeInfo.kubeletVersion)" }
  else { Report 'FAIL' 'node is Ready' 'a node is not Ready' }
}
else {
  Report 'FAIL' 'cluster is reachable' 'start Docker Desktop and wait for Kubernetes to be running'
  exit 1
}

& kubectl get namespace $namespace *> $null
if ($LASTEXITCODE -eq 0) { Report 'PASS' "namespace '$namespace' exists" }
else { Report 'FAIL' "namespace '$namespace' exists" 'not deployed yet: run .\k8s\deploy.ps1'; exit 1 }

# ── Workloads ────────────────────────────────────────────────────────────────
Write-Host "`nWorkloads"
$minimum = @{ backend = 2; frontend = 2; redis = 1 }
foreach ($name in @('backend', 'frontend', 'redis')) {
  $d = Get-Json @('get', 'deployment', $name, '-n', $namespace)
  if (-not $d) { Report 'FAIL' "deployment/$name" 'missing'; continue }
  $want = [int]$d.spec.replicas
  $ready = [int]$d.status.readyReplicas
  if ($ready -ge $minimum[$name] -and $ready -eq $want) { Report 'PASS' "deployment/$name" "$ready/$want ready" }
  elseif ($ready -ge 1) { Report 'WARN' "deployment/$name" "$ready/$want ready (expected at least $($minimum[$name]); it may still be starting)" }
  else { Report 'FAIL' "deployment/$name" "$ready/$want ready" }
}

$pods = Get-Json @('get', 'pods', '-n', $namespace)
if ($pods) {
  $restarts = 0
  foreach ($p in $pods.items) { foreach ($c in $p.status.containerStatuses) { $restarts += [int]$c.restartCount } }
  if ($restarts -eq 0) { Report 'PASS' 'no pod has restarted' "$($pods.items.Count) pods" }
  else { Report 'WARN' 'pod restarts' "$restarts restart(s) in total; check: kubectl get pods -n $namespace" }
}

# ── Configuration ────────────────────────────────────────────────────────────
Write-Host "`nConfiguration"
$secret = Get-Json @('get', 'secret', 'seniorsos-secrets', '-n', $namespace)
if ($secret) {
  $keys = @($secret.data.PSObject.Properties.Name)
  $required = @('DATABASE_URL', 'MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET')
  $missing = @($required | Where-Object { $keys -notcontains $_ })
  if ($missing.Count -eq 0) { Report 'PASS' 'secret seniorsos-secrets' "$($keys.Count) settings (names only; values are never shown)" }
  else { Report 'FAIL' 'secret seniorsos-secrets' "missing: $($missing -join ', ')" }
}
else { Report 'FAIL' 'secret seniorsos-secrets' 'missing: run .\k8s\deploy.ps1' }

# ── The app, as a browser reaches it ─────────────────────────────────────────
Write-Host "`nThe app ($Url)"
$page = Invoke-Http '/'
if ($page.Status -eq 200 -and $page.Body -match 'id="root"') { Report 'PASS' 'frontend serves the app' }
else { Report 'FAIL' 'frontend serves the app' "HTTP $($page.Status)" }

$health = Invoke-Http '/health'
if ($health.Status -eq 200) {
  $h = $health.Body | ConvertFrom-Json
  if ($h.status -eq 'ok') { Report 'PASS' '/health through nginx to the backend' "status ok, redis $($h.services.redis)" }
  else { Report 'FAIL' '/health' $health.Body }
  if ($h.services.redis -eq 'up') { Report 'PASS' 'backend is connected to Redis' }
  else { Report 'WARN' 'backend is connected to Redis' "redis is '$($h.services.redis)' (the app still works, without caching)" }
}
else { Report 'FAIL' '/health through nginx to the backend' "HTTP $($health.Status) - is the backend ready?" }

$api = Invoke-Http '/api/skills'
if ($api.Status -eq 401) { Report 'PASS' '/api is proxied to the backend' 'answers 401 without a login, as it should' }
else { Report 'FAIL' '/api is proxied to the backend' "expected 401, got $($api.Status)" }

# ── Each backend copy ────────────────────────────────────────────────────────
Write-Host "`nBackend copies"
$backendPods = @(& kubectl get pods -n $namespace -l app=backend -o name 2>$null)
foreach ($pod in $backendPods) {
  $log = (& kubectl logs -n $namespace $pod 2>$null) -join "`n"
  $short = $pod -replace '^pod/', ''
  $checks = @(
    @{ Label = 'PostgreSQL (Neon)'; Pattern = 'Connected to PostgreSQL' },
    @{ Label = 'MongoDB (Atlas)'; Pattern = 'Connected to MongoDB' },
    @{ Label = 'Redis'; Pattern = '\[redis\] Connected' },
    @{ Label = 'Redis realtime adapter'; Pattern = 'Redis adapter enabled' }
  )
  $bad = @($checks | Where-Object { $log -notmatch $_.Pattern } | ForEach-Object { $_.Label })
  if ($bad.Count -eq 0) { Report 'PASS' $short 'databases connected, Redis adapter on (realtime works across copies)' }
  else { Report 'FAIL' $short "not connected: $($bad -join ', ')" }
}
$neo = (& kubectl logs -n $namespace $backendPods[0] 2>$null) -join "`n"
if ($neo -match '\[neo4j\] Connected') { Report 'PASS' 'Neo4j graph (Aura)' 'connected' }
else { Report 'WARN' 'Neo4j graph (Aura)' 'not connected: graph features (mutual connections) are off, the rest works' }

# ── Scaling and safety nets ──────────────────────────────────────────────────
Write-Host "`nScaling and safety"
& kubectl top pods -n $namespace *> $null
if ($LASTEXITCODE -eq 0) { Report 'PASS' 'metrics-server is working' 'kubectl top pods answers' }
else { Report 'WARN' 'metrics-server is working' 'metrics not available yet (it needs ~1 minute after install); autoscaling waits for it' }

foreach ($name in @('backend', 'frontend')) {
  $hpa = Get-Json @('get', 'hpa', $name, '-n', $namespace)
  if (-not $hpa) { Report 'FAIL' "autoscaler $name" 'missing'; continue }
  $detail = "$($hpa.spec.minReplicas) to $($hpa.spec.maxReplicas) copies, now $($hpa.status.currentReplicas)"
  # A real reading is a number. Right after a deploy the list can exist but be
  # empty, which must not count as a pass.
  $util = $null
  if ($hpa.status.currentMetrics) { $util = $hpa.status.currentMetrics[0].resource.current.averageUtilization }
  if ($null -ne $util) { Report 'PASS' "autoscaler $name" "$detail, CPU $util% (target $($hpa.spec.metrics[0].resource.target.averageUtilization)%)" }
  else { Report 'WARN' "autoscaler $name" "$detail, no CPU reading yet (give metrics-server a minute and re-run)" }
}
foreach ($name in @('backend', 'frontend')) {
  & kubectl get pdb $name -n $namespace *> $null
  if ($LASTEXITCODE -eq 0) { Report 'PASS' "disruption budget $name" 'at least 1 copy always stays up during drains' }
  else { Report 'FAIL' "disruption budget $name" 'missing' }
}

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host ''
if ($script:failures -eq 0) {
  $msg = 'All checks passed'
  if ($script:warnings -gt 0) { $msg += " ($($script:warnings) warning(s) above)" }
  Write-Host $msg -ForegroundColor Green
  Write-Host "Open $Url and log in to try it."
  exit 0
}
Write-Host "$($script:failures) check(s) FAILED. Details above." -ForegroundColor Red
Write-Host "Useful: kubectl get pods -n $namespace   |   kubectl logs -n $namespace deploy/backend   |   kubectl describe pod -n $namespace <name>"
exit 1
