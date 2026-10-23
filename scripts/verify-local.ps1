$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    docker compose config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Invalid Compose configuration' }
    $config = docker compose config --format json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read Compose configuration' }

    foreach ($service in @('postgres', 'redis', 'api', 'worker', 'web')) {
        $containerId = docker compose ps -q $service
        if (-not $containerId) { throw "Missing service: $service" }
        $health = docker inspect --format '{{.State.Health.Status}}' $containerId
        if ($LASTEXITCODE -ne 0 -or $health -ne 'healthy') { throw "Unhealthy service: $service" }
        Write-Host "$service : healthy"
    }
    foreach ($service in @('postgres', 'redis', 'worker')) {
        if ($config.services.$service.ports.Count -gt 0) { throw "Unexpected published port: $service" }
    }
    foreach ($service in @('api', 'web')) {
        foreach ($port in $config.services.$service.ports) {
            if ($port.host_ip -ne '127.0.0.1') { throw "Non-loopback port: $service" }
        }
    }
    if (-not $config.networks.local.internal) { throw 'Network must be internal' }

    $apiPort = $config.services.api.ports[0].published
    $webPort = $config.services.web.ports[0].published
    $ready = Invoke-RestMethod "http://127.0.0.1:$apiPort/health/ready" -TimeoutSec 10
    if ($ready.status -ne 'ready') { throw 'API not ready' }
    $page = Invoke-WebRequest "http://127.0.0.1:$webPort/" -UseBasicParsing -TimeoutSec 15
    if ($page.Content -notmatch 'FaseMarketplace' -or $page.Content -notmatch 'id="root"' -or $page.Content -notmatch '/src/main.tsx') {
        throw 'React entry point was not served'
    }
    $proxiedReady = Invoke-RestMethod "http://127.0.0.1:$webPort/api/health/ready" -TimeoutSec 10
    if ($proxiedReady.status -ne 'ready' -or $proxiedReady.dependencies.postgres -ne $true -or $proxiedReady.dependencies.redis -ne $true) {
        throw 'Web proxy did not report API readiness'
    }
    Write-Host 'Local smoke passed: services healthy, isolated ports, web -> API -> PostgreSQL/Redis.'
} finally {
    Pop-Location
}
