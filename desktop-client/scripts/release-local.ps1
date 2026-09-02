$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$config = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'desktop.config.json') | ConvertFrom-Json
$package = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
$baseName = [string]$config.artifactBaseName
$version = [string]$package.version

npm run check
npm test
npm run visual:check
npm run dist:win

$artifacts = @(
  "$baseName-Setup-$version-x64.exe",
  "$baseName-Portable-$version-x64.exe"
)

$publishedPaths = @()
foreach ($artifact in $artifacts) {
  $source = Join-Path $projectRoot "dist\$artifact"
  if (-not (Test-Path -LiteralPath $source)) {
    throw "未找到构建产物：$source"
  }
  $destination = Join-Path $desktopDirectory $artifact
  $copied = $false
  for ($attempt = 1; $attempt -le 5; $attempt += 1) {
    try {
      Copy-Item -LiteralPath $source -Destination $destination -Force
      $copied = $true
      break
    }
    catch [System.IO.IOException] {
      if ($attempt -lt 5) { Start-Sleep -Milliseconds 500 }
    }
  }
  if (-not $copied) {
    $pendingName = "{0}-new{1}" -f [System.IO.Path]::GetFileNameWithoutExtension($artifact), [System.IO.Path]::GetExtension($artifact)
    $destination = Join-Path $desktopDirectory $pendingName
    Copy-Item -LiteralPath $source -Destination $destination -Force
    Write-Warning "原文件正在运行，已将新版本保存为：$destination"
  }
  $publishedPaths += $destination
}

function Get-Sha256([string]$filePath) {
  $stream = [System.IO.File]::OpenRead($filePath)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return [System.BitConverter]::ToString($sha256.ComputeHash($stream)).Replace('-', '')
  }
  finally {
    $sha256.Dispose()
    $stream.Dispose()
  }
}

$publishedPaths | ForEach-Object {
  $artifactPath = $_
  [PSCustomObject]@{
    Path = $artifactPath
    Hash = Get-Sha256 $artifactPath
  }
}
