# k8s/deploy.ps1
# Deploys SeniorSOS to the local Docker Desktop Kubernetes cluster.
#
#   .\k8s\deploy.ps1                       deploy (images must already be built)
#   .\k8s\deploy.ps1 -Build                build the images first, then deploy
#   .\k8s\deploy.ps1 -SkipMetricsServer    do not install the metrics add-on
#
# What it does:
#   1. Checks it is talking to the local "docker-desktop" cluster and nothing else.
#   2. Installs the metrics-server add-on (needed by the autoscaler) unless skipped.
#   3. Creates the namespace and a Secret built from backend/.env (the values
#      are never printed, written to the repository, or put on a command line).
#   4. Tags the images by content, applies the manifests, and waits until every
#      deployment is ready.
#
# What it does NOT do: touch the cloud databases. There is no migration, seed or
# any other job; the backend only connects to Neon, Atlas and Neo4j Aura with the
# credentials from backend/.env, exactly as `npm run dev` does.
#
# Safe to re-run at any time: it updates what changed and leaves the rest alone.

param(
  [switch]$Build,
  [switch]$SkipMetricsServer,
  [string]$ExpectedContext = 'docker-desktop'
)

$ErrorActionPreference = 'Stop'

$k8sDir = $PSScriptRoot
$rootDir = Split-Path -Parent $k8sDir
$envFile = Join-Path $rootDir 'backend/.env'
$namespace = 'seniorsos'
$secretName = 'seniorsos-secrets'

# Keys the ConfigMap owns (how the app runs in the cluster). They are left out
# of the Secret so there is exactly one source for each.
$ownedByConfigMap = @('NODE_ENV', 'PORT', 'CLIENT_ORIGIN', 'REDIS_URL', 'REDIS_STARTUP_WAIT_MS', 'TRUST_PROXY', 'API_TRANSCRIPT_LOG')

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found."
  }
}

function Invoke-Kubectl {
  & kubectl @args
  if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') failed." }
}

Assert-Command 'kubectl'
Assert-Command 'docker'

# ── 1. Safety: only ever deploy to the local Docker Desktop cluster ──────────
$context = (& kubectl config current-context 2>$null)
if ($context -ne $ExpectedContext) {
  throw "Refusing to deploy: the current kubectl context is '$context', not '$ExpectedContext'. " +
        "Enable Kubernetes in Docker Desktop (Settings > Kubernetes) and run: kubectl config use-context $ExpectedContext"
}
& kubectl get nodes *> $null
if ($LASTEXITCODE -ne 0) {
  throw "The '$context' cluster is not reachable. Start Docker Desktop and wait for Kubernetes to show 'running'."
}
Write-Host "Cluster: $context"

if (-not (Test-Path $envFile)) { throw "backend/.env was not found at $envFile." }

# ── 2. Images ────────────────────────────────────────────────────────────────
if ($Build) {
  Write-Host 'Building images...'
  # Docker prints its build progress on stderr, which Windows PowerShell 5.1
  # would turn into a terminating error under $ErrorActionPreference = 'Stop'.
  # Only the exit code decides whether the build worked.
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & docker compose -f (Join-Path $rootDir 'docker-compose.app.yml') build 2>&1 |
      ForEach-Object { if ($_ -match '^\s*(#\d+ \[|#\d+ (DONE|CACHED)|Image .* Built|.*error)') { "$_" } }
    $buildExit = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($buildExit -ne 0) { throw 'Image build failed.' }
}
foreach ($image in @('seniorsos-backend:local', 'seniorsos-frontend:local')) {
  & docker image inspect $image *> $null
  if ($LASTEXITCODE -ne 0) { throw "Image $image not found. Run .\k8s\deploy.ps1 -Build" }
}

# ── 3. Metrics add-on (autoscaler and `kubectl top`) ─────────────────────────
if (-not $SkipMetricsServer) {
  Invoke-Kubectl apply -f (Join-Path $k8sDir 'addons/metrics-server.yaml')
  Invoke-Kubectl rollout status deployment/metrics-server --namespace kube-system --timeout=180s
}

# ── 4. Namespace and Secret ──────────────────────────────────────────────────
Invoke-Kubectl apply -f (Join-Path $k8sDir 'base/namespace.yaml')

# Parse backend/.env the way dotenv does (strip surrounding quotes). kubectl's
# own --from-env-file would keep the quotes as part of the value and break every
# connection string, so the parsed values go to a temporary file instead.
$tmp = Join-Path $env:TEMP ("seniorsos-secret-{0}.env" -f ([guid]::NewGuid().ToString('N')))
try {
  $entries = New-Object System.Collections.Generic.List[string]
  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*#' -or $line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { continue }
    $key = $Matches[1]
    $value = $Matches[2].Trim()
    if ($value.Length -ge 2 -and (
          ($value.StartsWith('"') -and $value.EndsWith('"')) -or
          ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($ownedByConfigMap -contains $key) { continue }
    $entries.Add("$key=$value")
  }
  [System.IO.File]::WriteAllLines($tmp, $entries, (New-Object System.Text.UTF8Encoding($false)))

  # create --dry-run | apply makes this safe to re-run: it updates the Secret in place.
  $secretYaml = & kubectl create secret generic $secretName --namespace $namespace --from-env-file=$tmp --dry-run=client -o yaml
  if ($LASTEXITCODE -ne 0) { throw 'Could not build the Secret from backend/.env.' }
  $secretYaml | & kubectl apply -f -
  if ($LASTEXITCODE -ne 0) { throw 'Could not apply the Secret.' }
  Write-Host "Secret '$secretName' updated ($($entries.Count) settings from backend/.env; values not shown)."
}
finally {
  if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Force }
}

# ── 5. Application ───────────────────────────────────────────────────────────
# Each image is tagged with the first 12 characters of its content ID, and the
# manifests are rendered with those tags. A rebuilt image therefore gets a NEW
# tag and rolls out by itself. Re-using one fixed tag does not work: the cluster
# keeps the image it already has for a tag it has seen (imagePullPolicy
# IfNotPresent), so a rebuild would silently never reach the pods.
function Get-ContentTag([string]$Image) {
  $id = (& docker image inspect $Image --format '{{.Id}}')
  if ($LASTEXITCODE -ne 0 -or -not $id) { throw "Could not read the ID of image $Image." }
  return $id.Replace('sha256:', '').Substring(0, 12)
}

$images = @{}
foreach ($name in @('backend', 'frontend')) {
  $source = "seniorsos-${name}:local"
  $tag = Get-ContentTag $source
  & docker tag $source "seniorsos-${name}:$tag"
  if ($LASTEXITCODE -ne 0) { throw "Could not tag $source." }
  $images[$name] = $tag
  Write-Host "Image seniorsos-${name}: tag $tag"
}

$rendered = (& kubectl kustomize $k8sDir) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'kubectl kustomize failed.' }
foreach ($name in $images.Keys) {
  $rendered = $rendered.Replace("seniorsos-${name}:local", "seniorsos-${name}:$($images[$name])")
}
$rendered | & kubectl apply -f -
if ($LASTEXITCODE -ne 0) { throw 'kubectl apply failed.' }

# The autoscaler owns the replica count, so the manifests do not set one and a
# brand-new deployment starts with a single copy. Bring it up to the autoscaler's
# minimum straight away (without metrics the autoscaler cannot act at all).
foreach ($name in @('backend', 'frontend')) {
  $current = [int](& kubectl get deployment $name --namespace $namespace -o jsonpath='{.spec.replicas}')
  if ($current -lt 2) { Invoke-Kubectl scale "deployment/$name" --replicas=2 --namespace $namespace }
}

# A note on each version, so `kubectl rollout history` says what is in it.
foreach ($name in @('backend', 'frontend')) {
  & kubectl annotate "deployment/$name" --namespace $namespace --overwrite "kubernetes.io/change-cause=image seniorsos-${name}:$($images[$name])" *> $null
}

foreach ($deployment in @('redis', 'backend', 'frontend')) {
  Write-Host "Waiting for $deployment..."
  Invoke-Kubectl rollout status "deployment/$deployment" --namespace $namespace --timeout=300s
}

Write-Host ''
Invoke-Kubectl get pods --namespace $namespace
Write-Host ''
Write-Host 'SeniorSOS is running in the cluster:  http://localhost:8080'
Write-Host 'Check the setup:                      .\k8s\verify.ps1'
Write-Host 'Stop it (cloud data untouched):       .\k8s\teardown.ps1'
