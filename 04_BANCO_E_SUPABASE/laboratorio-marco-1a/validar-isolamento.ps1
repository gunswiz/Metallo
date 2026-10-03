# Ensaio reproduzivel; encerra somente a pilha local ao terminar, preservando volumes.
$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$env:DO_NOT_TRACK = '1'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$cli = Join-Path $root 'node_modules\supabase\dist\supabase.js'
$docker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
$endpoint = & $docker context inspect --format '{{.Endpoints.docker.Host}}'
if ($LASTEXITCODE -ne 0 -or -not $endpoint.Trim().StartsWith('npipe:////./pipe/')) {
  throw 'Ensaio exige contexto Docker local, inclusive para o encerramento.'
}
try {
  & (Join-Path $PSScriptRoot 'iniciar-laboratorio.ps1')
  node (Join-Path $PSScriptRoot 'verificar-rede-local.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Ensaio de isolamento falhou; consultar rede-depois.json.' }
} finally {
  node $cli stop --workdir $PSScriptRoot --project-id 'laboratorio-marco-1a' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao parar o laboratorio. Conferir Docker e listeners.' }
  $listeners = @(Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in @(54320,54321,54322,54323,54324,54325,54326,54327,54328,54329,8083) } | Select-Object LocalAddress,LocalPort)
  $running = @(& $docker ps --filter 'label=com.supabase.cli.project=laboratorio-marco-1a' --format '{{.Names}}')
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao conferir containers restantes.' }
  $probes = @(& $docker ps -a --filter 'name=metallo-auditoria-' --format '{{.Names}}')
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao conferir remocao das sondas.' }
  $final = [ordered]@{
    at = (Get-Date).ToUniversalTime().ToString('o')
    stack_running = $running
    lab_listeners = $listeners
    probe_containers = $probes
    firewall = @(Get-NetFirewallProfile | Select-Object Name,Enabled)
    visual_preview_listeners = @(Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 3101 | Select-Object LocalAddress,LocalPort)
    passed = ($listeners.Count -eq 0 -and $running.Count -eq 0 -and $probes.Count -eq 0)
  }
  $final | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 -LiteralPath (Join-Path $PSScriptRoot 'auditoria-final\estado-final.json')
  if (-not $final.passed) { throw 'Ha listeners ou containers restantes; encerramento nao comprovado.' }
  Write-Host 'Pilha encerrada; ausencia de listeners e sondas confirmada.'
}
