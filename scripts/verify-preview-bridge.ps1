$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $composeArgs = @('compose', '-p', 'fasemarketplace-hybrid', '-f', 'compose.hybrid.yaml', '-f', 'compose.preview.yaml')
    $json = docker @composeArgs config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Invalid local preview bridge configuration' }
    $config = $json | ConvertFrom-Json
    $gateway = $config.services.'preview-gateway'
    if ($gateway.ports[0].host_ip -ne '127.0.0.1') { throw 'Gateway must bind only loopback' }
    if ($gateway.environment.PSObject.Properties.Name.Count -ne 1 -or -not $gateway.environment.PREVIEW_BRIDGE_KEY) {
        throw 'Gateway must receive only its private bridge key'
    }
    $port = $gateway.ports[0].published
    try {
        $null = Invoke-WebRequest "http://127.0.0.1:$port/health/ready" -UseBasicParsing -TimeoutSec 5
        throw 'Unauthenticated gateway request unexpectedly accepted'
    } catch {
        if ([int]$_.Exception.Response.StatusCode -ne 401) { throw 'Gateway must return 401 without key' }
    }
    $result = Invoke-RestMethod "http://127.0.0.1:$port/health/ready" -TimeoutSec 20 -Headers @{
        Authorization = 'Bearer ' + $gateway.environment.PREVIEW_BRIDGE_KEY
    }
    if ($result.status -ne 'ready' -or $result.dependencies.postgres -ne $true -or
        $result.dependencies.redis -ne $true -or $result.marketplaceMode -ne 'mock') {
        throw 'Authenticated gateway readiness failed'
    }
    Write-Host 'Local preview bridge passed: unauthorized request refused; authenticated request reached hybrid API/Neon. No tunnel started.'
} finally { Pop-Location }
