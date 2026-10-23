$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $composeArgs = @('compose', '-p', 'fasemarketplace-hybrid', '-f', 'compose.hybrid.yaml')
    $json = docker @composeArgs config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Invalid hybrid configuration; check required Neon fields' }
    $config = $json | ConvertFrom-Json
    if ($config.name -ne 'fasemarketplace-hybrid') { throw 'Unexpected hybrid project name' }
    if (-not $config.services.web) { throw 'Missing hybrid web service' }
    if ($config.services.api.environment.DATABASE_PROVIDER -ne 'neon') { throw 'Hybrid API must use Neon' }
    if ($config.services.api.environment.MARKETPLACE_MODE -ne 'mock') { throw 'Hybrid must use mock mode' }
    if ($config.services.web.environment.VITE_DEVELOPMENT_MODE -ne 'hybrid') { throw 'Missing hybrid frontend metadata' }
    if ($config.services.web.environment.VITE_API_BASE_URL) { throw 'Hybrid web must use same-origin API proxy' }
    foreach ($key in $config.services.web.environment.PSObject.Properties.Name) {
        if ($key -match '(DATABASE|POSTGRES|REDIS|NEON|PASSWORD|SECRET|TOKEN)') { throw "Backend-only environment key in web: $key" }
    }
    if (-not $config.networks.local.internal) { throw 'Hybrid data network must be internal' }
    if ($config.services.postgres) { throw 'Hybrid must not start a local PostgreSQL service' }
    foreach ($service in @('redis', 'worker')) {
        if ($config.services.$service.ports.Count -gt 0) { throw "Unexpected published port: $service" }
    }
    foreach ($service in @('api', 'web')) {
        foreach ($port in $config.services.$service.ports) {
            if ($port.host_ip -ne '127.0.0.1') { throw "Non-loopback port: $service" }
        }
    }
    foreach ($service in @('redis', 'api', 'worker', 'web')) {
        $containerId = docker @composeArgs ps -q $service
        if ($LASTEXITCODE -ne 0 -or -not $containerId) { throw "Missing hybrid service: $service" }
        $health = docker inspect --format '{{.State.Health.Status}}' $containerId
        if ($LASTEXITCODE -ne 0 -or $health -ne 'healthy') { throw "Unhealthy hybrid service: $service" }
        Write-Host "$service : healthy"
    }
    $webPort = $config.services.web.ports[0].published
    $page = Invoke-WebRequest "http://127.0.0.1:$webPort/" -UseBasicParsing -TimeoutSec 15
    if ($page.Content -notmatch 'id="root"' -or $page.Content -notmatch '/src/main.tsx') { throw 'React entry point missing' }
    $ready = Invoke-RestMethod "http://127.0.0.1:$webPort/api/health/ready" -TimeoutSec 20
    if ($ready.status -ne 'ready' -or $ready.dependencies.postgres -ne $true -or $ready.dependencies.redis -ne $true -or $ready.marketplaceMode -ne 'mock') {
        throw 'Hybrid frontend proxy did not confirm Neon/Redis readiness in mock mode'
    }
    Write-Host 'Hybrid smoke passed: web -> hybrid API -> Neon/Redis; loopback ports and frontend environment checked.'
} finally {
    Pop-Location
}
