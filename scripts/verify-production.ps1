$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $composeArgs = @('compose', '--env-file', '.env.production', '-p', 'fasemarketplace-production', '-f', 'compose.production.yaml')
    $json = docker @composeArgs config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Invalid production Compose configuration' }
    $config = $json | ConvertFrom-Json
    if ($config.name -ne 'fasemarketplace-production') { throw 'Wrong Compose project' }
    $gateway = $config.services.'production-gateway'
    if ($gateway.ports[0].host_ip -ne '127.0.0.1' -or $config.services.api.ports[0].host_ip -ne '127.0.0.1') {
        throw 'Production diagnostic ports must bind loopback only'
    }
    if ($config.services.redis.ports -or $config.services.web) { throw 'Unexpected public Redis or development web' }
    foreach ($name in @('api', 'worker')) {
        $service = $config.services.$name
        if ($service.volumes -or -not $service.read_only -or $service.environment.APP_ENV -ne 'production' -or
            $service.environment.NEON_BRANCH -ne 'production' -or $service.environment.MARKETPLACE_MODE -ne 'mock') {
            throw 'Invalid production runtime isolation'
        }
        if ($service.environment.PREVIEW_BRIDGE_KEY -or $service.environment.PRODUCTION_BRIDGE_KEY) {
            throw 'Backend must not inherit bridge credentials'
        }
    }
    $key = $gateway.environment.PRODUCTION_BRIDGE_KEY
    if (-not $key -or $gateway.environment.PREVIEW_BRIDGE_KEY -or $gateway.environment.DATABASE_URL) {
        throw 'Invalid gateway secret isolation'
    }
    $uri = 'http://127.0.0.1:' + $gateway.ports[0].published + '/health/ready'
    $rejected = Invoke-WebRequest $uri -SkipHttpErrorCheck -TimeoutSec 5
    if ($rejected.StatusCode -ne 401) { throw 'Gateway must reject missing credentials' }
    $rejected = Invoke-WebRequest $uri -Headers @{Authorization='Bearer invalid-preview-or-production-key'} -SkipHttpErrorCheck -TimeoutSec 5
    if ($rejected.StatusCode -ne 401) { throw 'Gateway must reject wrong credentials' }
    $result = Invoke-RestMethod $uri -Headers @{Authorization='Bearer ' + $key} -TimeoutSec 20
    if ($result.status -ne 'ready' -or $result.dependencies.postgres -ne $true -or
        $result.dependencies.redis -ne $true -or $result.marketplaceMode -ne 'mock') {
        throw 'Production readiness failed'
    }
    $containers = docker @composeArgs ps --format json | ForEach-Object { $_ | ConvertFrom-Json }
    foreach ($name in @('api', 'worker', 'redis', 'production-gateway')) {
        $container = $containers | Where-Object Service -eq $name
        if (-not $container -or $container.State -ne 'running' -or $container.Health -ne 'healthy') {
            throw "Production service not healthy: $name"
        }
    }
    Write-Host 'Production Docker smoke passed: isolated compiled runtime, authenticated readiness, Neon production and Redis; missing/wrong keys rejected. No business writes.'
} finally { Pop-Location }
