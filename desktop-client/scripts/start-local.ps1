param(
  [Parameter(Mandatory = $true)][string]$ServerDirectory,
  [switch]$CheckOnly,
  [switch]$SkipClient,
  [ValidateRange(10, 600)][int]$ReadyTimeoutSeconds = 120
)
$ErrorActionPreference = 'Stop'
$clientRoot = Split-Path -Parent $PSScriptRoot
function Invoke-Checked([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command failed (exit $LASTEXITCODE)." }
}
foreach ($command in @('docker', 'node', 'npm.cmd')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Install $command before continuing." }
}
$serverRoot = (Resolve-Path -LiteralPath $ServerDirectory).Path
$compose = Join-Path $serverRoot 'compose.local.yaml'
if (-not (Test-Path -LiteralPath $compose)) { throw 'Server directory must contain compose.local.yaml from the master branch.' }
$config = Get-Content -Raw (Join-Path $clientRoot 'desktop.config.local-test.json') | ConvertFrom-Json
if ($config.serverUrl.TrimEnd('/') -ne 'http://127.0.0.1:3000') { throw 'LocalTest URL must match compose.local.yaml: http://127.0.0.1:3000.' }
Invoke-Checked 'docker' @('info', '--format', '{{.ServerVersion}}')
Invoke-Checked 'docker' @('compose', 'version')
Invoke-Checked 'docker' @('compose', '-f', $compose, 'config', '--quiet')
if ($CheckOnly) { Write-Host 'Local prerequisites passed. No services started.'; exit 0 }
Invoke-Checked 'docker' @('compose', '-f', $compose, 'up', '-d', '--build')
$deadline = (Get-Date).AddSeconds($ReadyTimeoutSeconds)
$ready = $false
do {
  try {
    $status = Invoke-RestMethod -Uri "$($config.serverUrl)/api/status" -TimeoutSec 5
    $ready = $status.success -eq $true
  } catch { $ready = $false }
  if (-not $ready) { Start-Sleep -Seconds 2 }
} until ($ready -or (Get-Date) -ge $deadline)
if (-not $ready) { throw "Server did not become ready. Inspect: docker compose -f `"$compose`" logs --tail 100" }
Write-Host "Server ready: $($config.serverUrl). First deployment requires administrator setup and channel configuration."
if ($SkipClient) { exit 0 }
Push-Location -LiteralPath $clientRoot
try {
  Invoke-Checked 'npm.cmd' @('ci')
  Invoke-Checked 'npm.cmd' @('run', 'start:local-test')
} finally { Pop-Location }
