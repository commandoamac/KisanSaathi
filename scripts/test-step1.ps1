$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8787"
$devVarsPath = Join-Path $PSScriptRoot "..\.dev.vars"
$adminSecret = $null
$script:marketId = $null
$script:reporterTokens = @()
$script:failedChecks = 0
$script:runId = [Guid]::NewGuid().ToString("N").Substring(0, 10)
$script:district = "Step1 District $($script:runId)"

function Write-Check {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )

  try {
    & $Action
    Write-Host "PASS - $Name"
    return $true
  }
  catch {
    Write-Host "FAIL - $Name"
    $script:failedChecks += 1
    return $false
  }
}

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("GET", "POST")][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [hashtable]$Headers = @{},
    [object]$Body
  )

  $requestParameters = @{
    Uri             = "$baseUrl$Path"
    Method          = $Method
    Headers         = $Headers
    UseBasicParsing = $true
  }
  if ($PSBoundParameters.ContainsKey("Body")) {
    $requestParameters["ContentType"] = "application/json"
    $requestParameters["Body"] = ConvertTo-Json -InputObject $Body -Depth 8 -Compress
  }

  try {
    $response = Invoke-WebRequest @requestParameters
    $statusCode = [int]$response.StatusCode
    $content = [string]$response.Content
  }
  catch {
    $webResponse = $_.Exception.Response
    if ($null -eq $webResponse) {
      throw "Request could not reach the local API."
    }

    $statusCode = [int]$webResponse.StatusCode
    $stream = $webResponse.GetResponseStream()
    if ($null -eq $stream) {
      $content = ""
    }
    else {
      $reader = [System.IO.StreamReader]::new($stream)
      try {
        $content = $reader.ReadToEnd()
      }
      finally {
        $reader.Dispose()
        $stream.Dispose()
      }
    }
  }

  $json = $null
  if ($content) {
    try {
      $json = ConvertFrom-Json -InputObject $content
    }
    catch {
      $json = $null
    }
  }

  return [pscustomobject]@{
    Status = $statusCode
    Json   = $json
  }
}

try {
  if (-not (Test-Path -LiteralPath $devVarsPath -PathType Leaf)) {
    Write-Host "FAIL - Read PRICE_ADMIN_SECRET from .dev.vars"
    throw "Required local admin configuration is missing."
  }

  $secretLine = Get-Content -LiteralPath $devVarsPath |
    Where-Object { $_ -match '^\s*PRICE_ADMIN_SECRET\s*=' } |
    Select-Object -First 1
  if (-not $secretLine) {
    Write-Host "FAIL - Read PRICE_ADMIN_SECRET from .dev.vars"
    throw "PRICE_ADMIN_SECRET is missing."
  }

  $adminSecret = ($secretLine -replace '^\s*PRICE_ADMIN_SECRET\s*=', "").Trim()
  if (
    $adminSecret.Length -ge 2 -and
    (($adminSecret.StartsWith('"') -and $adminSecret.EndsWith('"')) -or
      ($adminSecret.StartsWith("'") -and $adminSecret.EndsWith("'")))
  ) {
    $adminSecret = $adminSecret.Substring(1, $adminSecret.Length - 2)
  }
  if ([string]::IsNullOrWhiteSpace($adminSecret)) {
    Write-Host "FAIL - Read PRICE_ADMIN_SECRET from .dev.vars"
    throw "PRICE_ADMIN_SECRET is empty."
  }
  Write-Host "PASS - Read PRICE_ADMIN_SECRET from .dev.vars"

  $adminHeaders = @{ Authorization = "Bearer $adminSecret" }
  [void](Write-Check "Seed sample reporters" {
    $response = Invoke-JsonRequest -Method POST -Path "/api/reporters" `
      -Headers $adminHeaders -Body @{ action = "seed_samples" }
    if (
      $response.Status -ne 200 -or
      $null -eq $response.Json -or
      $null -eq $response.Json.seeded -or
      @($response.Json.seeded).Count -ne 3
    ) {
      throw "Sample reporter seed request failed."
    }
  })

  [void](Write-Check "Create a unique test market" {
    $marketBody = @{
      action   = "create_market"
      name     = "Step1 Mandi $($script:runId)"
      district = $script:district
      state    = "Step1 Test State"
    }
    $response = Invoke-JsonRequest -Method POST -Path "/api/reporters" `
      -Headers $adminHeaders -Body $marketBody
    if ($response.Status -ne 201 -or [string]::IsNullOrWhiteSpace($response.Json.id)) {
      throw "Market creation failed."
    }
    $script:marketId = [string]$response.Json.id
  })

  [void](Write-Check "Create three verified traders" {
    $tokens = [System.Collections.Generic.List[string]]::new()
    $phoneSuffixes = [System.Collections.Generic.HashSet[string]]::new()
    for ($index = 1; $index -le 3; $index++) {
      do {
        $suffix = Get-Random -Minimum 100000000 -Maximum 1000000000
      } while (-not $phoneSuffixes.Add([string]$suffix))

      $traderBody = @{
        phone        = "+919$suffix"
        display_name = "Step1 Test Trader $index"
        role         = "trader"
        verified     = $true
      }
      $response = Invoke-JsonRequest -Method POST -Path "/api/reporters" `
        -Headers $adminHeaders -Body $traderBody
      if (
        $response.Status -ne 201 -or
        [string]::IsNullOrWhiteSpace($response.Json.token)
      ) {
        throw "Trader creation failed."
      }
      $tokens.Add([string]$response.Json.token)
    }
    $script:reporterTokens = $tokens.ToArray()
  })

  $prices = @(1800, 1900, 2000)
  [void](Write-Check "Submit one price from each trader" {
    if ($script:reporterTokens.Count -ne 3 -or [string]::IsNullOrWhiteSpace($script:marketId)) {
      throw "Reporter or market setup did not complete."
    }
    for ($index = 0; $index -lt 3; $index++) {
      $reportHeaders = @{ Authorization = "Bearer $($script:reporterTokens[$index])" }
      $reportBody = @{
        crop              = "tomato"
        market            = $script:marketId
        price_per_quintal = $prices[$index]
        reporter_id       = "must-be-ignored"
      }
      $response = Invoke-JsonRequest -Method POST -Path "/api/prices" `
        -Headers $reportHeaders -Body $reportBody
      if ($response.Status -ne 201 -or $response.Json.price_per_quintal -ne $prices[$index]) {
        throw "A trader price report was rejected."
      }
    }
    $script:reportsSubmitted = $true
  })

  [void](Write-Check "GET returns the expected median and report count" {
    if (-not $script:reportsSubmitted) {
      throw "Price reports were not submitted."
    }
    $districtQuery = [Uri]::EscapeDataString($script:district)
    $response = Invoke-JsonRequest -Method GET `
      -Path "/api/prices?crop=tomato&district=$districtQuery&days=7"
    $pricesForMarket = @($response.Json.prices | Where-Object {
        $_.market.id -eq $script:marketId
      })
    if (
      $response.Status -ne 200 -or
      $pricesForMarket.Count -ne 1 -or
      $pricesForMarket[0].price_per_quintal -ne 1900 -or
      $pricesForMarket[0].report_count -ne 3
    ) {
      throw "Aggregated price or count did not match."
    }
  })

  [void](Write-Check "A second report from the same trader returns 429" {
    if ($script:reporterTokens.Count -ne 3 -or [string]::IsNullOrWhiteSpace($script:marketId)) {
      throw "Reporter or market setup did not complete."
    }
    $headers = @{ Authorization = "Bearer $($script:reporterTokens[0])" }
    $body = @{
      crop              = "tomato"
      market            = $script:marketId
      price_per_quintal = 2100
    }
    $response = Invoke-JsonRequest -Method POST -Path "/api/prices" `
      -Headers $headers -Body $body
    if ($response.Status -ne 429) {
      throw "Rate limit did not return 429."
    }
  })

  [void](Write-Check "A wrong reporter token returns 401 or 403" {
      if ([string]::IsNullOrWhiteSpace($script:marketId)) {
        throw "Market setup did not complete."
      }
      $headers = @{ Authorization = "Bearer $([Guid]::NewGuid().ToString('N'))" }
      $body = @{
        crop              = "tomato"
        market            = $script:marketId
        price_per_quintal = 2100
      }
      $response = Invoke-JsonRequest -Method POST -Path "/api/prices" `
        -Headers $headers -Body $body
      if ($response.Status -notin @(401, 403)) {
        throw "Wrong token was not rejected."
      }
    })
}
finally {
  $adminSecret = $null
  $adminHeaders = @{}
  $script:reporterTokens = @()
}

if ($script:failedChecks -gt 0) {
  exit 1
}
