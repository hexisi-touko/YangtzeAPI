[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [Parameter(Mandatory = $true)]
    [string]$Model,

    [int]$SequentialCount = 3,
    [int]$ConcurrentCount = 10,
    [int]$MaxTokens = 64,
    [int]$TimeoutSec = 120,
    [string]$Output = "load-balance-results.json"
)

$ErrorActionPreference = "Stop"

if ($SequentialCount -lt 1 -or $ConcurrentCount -lt 1) {
    throw "SequentialCount and ConcurrentCount must both be at least 1."
}

$uri = "$($BaseUrl.TrimEnd('/'))/v1/chat/completions"
$headers = @{ Authorization = "Bearer $ApiKey" }

function Send-TestRequest {
    param(
        [int]$RequestNumber,
        [string]$Phase
    )

    $body = @{
        model = $Model
        messages = @(
            @{ role = "user"; content = "Load-balance test. Return only: OK-$RequestNumber" }
        )
        max_tokens = $MaxTokens
        temperature = 0
        stream = $false
    } | ConvertTo-Json -Depth 8 -Compress

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest -Uri $uri -Method Post -Headers $headers `
            -ContentType "application/json" -Body $body -TimeoutSec $TimeoutSec `
            -SkipHttpErrorCheck
        $stopwatch.Stop()
        $content = $response.Content
        $preview = if ($content.Length -gt 300) { $content.Substring(0, 300) } else { $content }
        [pscustomobject]@{
            phase = $Phase
            request = $RequestNumber
            status = [int]$response.StatusCode
            elapsed_ms = $stopwatch.ElapsedMilliseconds
            ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
            response_preview = $preview
            error = $null
        }
    } catch {
        $stopwatch.Stop()
        [pscustomobject]@{
            phase = $Phase
            request = $RequestNumber
            status = $null
            elapsed_ms = $stopwatch.ElapsedMilliseconds
            ok = $false
            response_preview = $null
            error = $_.Exception.Message
        }
    }
}

Write-Host "Testing $uri"
Write-Host "Phase 1: sequential baseline ($SequentialCount requests)"
$results = @(
    1..$SequentialCount | ForEach-Object { Send-TestRequest -RequestNumber $_ -Phase "sequential" }
)

Write-Host "Phase 2: concurrent burst ($ConcurrentCount requests)"
$parallelResults = 1..$ConcurrentCount | ForEach-Object -Parallel {
    $requestNumber = $_
    $body = @{
        model = $using:Model
        messages = @(
            @{ role = "user"; content = "Load-balance test. Return only: OK-$requestNumber" }
        )
        max_tokens = $using:MaxTokens
        temperature = 0
        stream = $false
    } | ConvertTo-Json -Depth 8 -Compress

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest -Uri $using:uri -Method Post -Headers $using:headers `
            -ContentType "application/json" -Body $body -TimeoutSec $using:TimeoutSec `
            -SkipHttpErrorCheck
        $stopwatch.Stop()
        $content = $response.Content
        [pscustomobject]@{
            phase = "concurrent"
            request = $requestNumber
            status = [int]$response.StatusCode
            elapsed_ms = $stopwatch.ElapsedMilliseconds
            ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
            response_preview = if ($content.Length -gt 300) { $content.Substring(0, 300) } else { $content }
            error = $null
        }
    } catch {
        $stopwatch.Stop()
        [pscustomobject]@{
            phase = "concurrent"
            request = $requestNumber
            status = $null
            elapsed_ms = $stopwatch.ElapsedMilliseconds
            ok = $false
            response_preview = $null
            error = $_.Exception.Message
        }
    }
} -ThrottleLimit $ConcurrentCount
$results += @($parallelResults)

$summary = $results | Group-Object phase | ForEach-Object {
    $items = @($_.Group)
    $successful = @($items | Where-Object ok)
    [pscustomobject]@{
        phase = $_.Name
        total = $items.Count
        successful = $successful.Count
        failed = $items.Count - $successful.Count
        min_ms = if ($items.Count) { ($items.elapsed_ms | Measure-Object -Minimum).Minimum } else { $null }
        avg_ms = if ($items.Count) { [math]::Round(($items.elapsed_ms | Measure-Object -Average).Average, 1) } else { $null }
        max_ms = if ($items.Count) { ($items.elapsed_ms | Measure-Object -Maximum).Maximum } else { $null }
    }
}

$report = [pscustomobject]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    endpoint = $uri
    model = $Model
    summary = @($summary)
    requests = @($results)
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Output -Encoding utf8

$summary | Format-Table -AutoSize
Write-Host "Detailed results written to $Output"
Write-Host "Correlate this run with New API channel/upstream logs or usage records; client latency alone cannot identify which upstream handled a request."
