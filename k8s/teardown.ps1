# k8s/teardown.ps1
# Removes SeniorSOS from the local Docker Desktop Kubernetes cluster.
#
# It deletes the "seniorsos" namespace: the pods, services, Redis and the Secret
# built from backend/.env all go with it. Nothing outside that namespace is
# touched, and the external cloud databases (Neon, Atlas, Neo4j Aura) are never
# contacted; no data in them changes.

param(
  [string]$ExpectedContext = 'docker-desktop'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) { throw "Required command 'kubectl' was not found." }

$context = (& kubectl config current-context 2>$null)
if ($context -ne $ExpectedContext) {
  throw "Refusing to run: the current kubectl context is '$context', not '$ExpectedContext'."
}

& kubectl get namespace seniorsos *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Namespace "seniorsos" does not exist; nothing to remove.'
  return
}

Write-Host "Deleting namespace 'seniorsos' on $context..."
& kubectl delete namespace seniorsos --wait=true
if ($LASTEXITCODE -ne 0) { throw 'kubectl delete namespace failed.' }
Write-Host 'Done. The cloud databases were not touched.'
