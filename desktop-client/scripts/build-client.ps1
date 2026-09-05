param(
  [ValidateSet('LocalTest', 'Production')][string]$Mode = 'LocalTest',
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$clientRoot = Split-Path -Parent $PSScriptRoot
function Invoke-Checked([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command failed (exit $LASTEXITCODE)." }
}
foreach ($command in @('node', 'npm.cmd')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Install $command before continuing." }
}
Push-Location -LiteralPath $clientRoot
$previousConfig = $env:DESKTOP_CONFIG_FILE
try {
  $env:DESKTOP_CONFIG_FILE = if ($Mode -eq 'Production') { 'desktop.config.json' } else { 'desktop.config.local-test.json' }
  Invoke-Checked 'node' @('scripts/validate-build-config.js', $Mode)
  if ($CheckOnly) { Write-Host 'Configuration passed. No package built.'; exit 0 }
  Invoke-Checked 'npm.cmd' @('ci')
  Invoke-Checked 'npm.cmd' @('run', 'check')
  Invoke-Checked 'npm.cmd' @('test')
  $buildTask = if ($Mode -eq 'Production') { 'dist:win' } else { 'dist:local-test' }
  Invoke-Checked 'npm.cmd' @('run', $buildTask)
  $outputName = if ($Mode -eq 'Production') { 'dist' } else { 'dist-local-test' }
  $outputDirectory = Join-Path $clientRoot $outputName
  $config = Get-Content -Raw $env:DESKTOP_CONFIG_FILE | ConvertFrom-Json
  $package = Get-Content -Raw 'package.json' | ConvertFrom-Json
  foreach ($kind in @('Setup', 'Portable')) {
    $artifact = Join-Path $outputDirectory "$($config.artifactBaseName)-$kind-$($package.version)-x64.exe"
    if (-not (Test-Path -LiteralPath $artifact)) { throw "Missing artifact: $artifact" }
    Get-FileHash -Algorithm SHA256 -LiteralPath $artifact | Select-Object Path, Hash
  }
  Write-Host "Build complete: $outputDirectory. No desktop copies or uploads performed."
} finally {
  $env:DESKTOP_CONFIG_FILE = $previousConfig
  Pop-Location
}
