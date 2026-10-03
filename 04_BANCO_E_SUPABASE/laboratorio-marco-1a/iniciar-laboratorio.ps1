# Laboratorio isolado: somente Docker local. Nao conecta nem escreve no Supabase remoto.
$ErrorActionPreference = 'Stop'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$env:DO_NOT_TRACK = '1'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$cli = Join-Path $root 'node_modules\supabase\dist\supabase.js'
$config = Join-Path $PSScriptRoot 'supabase\config.toml'
$network = 'metallo-marco1a-local'

if (-not (Test-Path -LiteralPath $cli)) {
  throw 'CLI local ausente. Na raiz do projeto, execute pnpm install --frozen-lockfile.'
}
if (-not (Test-Path -LiteralPath $config)) {
  throw 'Configuracao local do laboratorio ausente.'
}
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'supabase\.temp\project-ref')) {
  throw 'Projeto local vinculado a um remoto. Remova o vinculo antes de iniciar o laboratorio.'
}
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$docker = if ($dockerCommand) { $dockerCommand.Source } else {
  @(
    (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe')
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not (Test-Path -LiteralPath $docker)) {
  throw 'Docker nao encontrado. Instale e inicie um runtime Docker compativel antes de continuar.'
}

$serverType = & $docker info --format '{{.OSType}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $serverType.Trim() -ne 'linux') {
  throw 'Docker precisa estar em execucao com containers Linux.'
}

$endpoint = & $docker context inspect --format '{{.Endpoints.docker.Host}}'
if ($LASTEXITCODE -ne 0 -or -not $endpoint.Trim().StartsWith('npipe:////./pipe/')) {
  throw 'O contexto Docker precisa ser local (named pipe do Windows).'
}
# A opcao de bridge nao prevaleceu sobre os binds explicitos da CLI 2.117.0.
# Exigir a restricao suportada do Desktop ANTES de iniciar qualquer container.
# A existencia da regra de firewall sozinha nao demonstrou isolamento.
$settingsPath = Join-Path $env:APPDATA 'Docker\settings-store.json'
if (-not (Test-Path -LiteralPath $settingsPath)) { throw 'Configuracao do Docker Desktop nao encontrada.' }
$desktopSettings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
if ($desktopSettings.PortBindingBehavior -ne 'local-only-port-binding') {
  throw 'Inicio bloqueado: configure Docker Desktop / Network / Port binding behavior = Localhost only, com autorizacao para o alcance global dessa opcao. Nenhum container foi iniciado.'
}

& $docker network inspect $network *> $null
if ($LASTEXITCODE -ne 0) {
  & $docker network create -o 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1' $network | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar rede local com bind em 127.0.0.1.' }
}

try {
  node $cli start --workdir $PSScriptRoot --network-id $network --exclude vector | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'A pilha local nao iniciou.' }
  node (Join-Path $PSScriptRoot 'coletor-local\controlar.mjs') start
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar o coletor local supervisionado.' }
  $ports = @(54321, 54322, 54323, 54324, 54327)
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in $ports })
  $publicListeners = @($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') })
  if ($publicListeners.Count -gt 0) { throw 'Listener fora de loopback detectado; isolamento nao comprovado.' }
  foreach ($port in $ports) {
    if (-not ($listeners | Where-Object { $_.LocalPort -eq $port -and $_.LocalAddress -eq '127.0.0.1' })) {
      throw "Listener IPv4 de loopback ausente na porta $port."
    }
  }
  $names = @(& $docker ps --filter 'label=com.supabase.cli.project=laboratorio-marco-1a' --format '{{.Names}}')
  if ($LASTEXITCODE -ne 0 -or $names.Count -eq 0) { throw 'Containers do laboratorio nao identificados.' }
  foreach ($name in $names) {
    $bindings = & $docker inspect --format '{{json .NetworkSettings.Ports}}' $name | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao conferir bindings Docker.' }
    foreach ($prop in $bindings.PSObject.Properties) {
      foreach ($binding in @($prop.Value)) {
        if ($binding -and $binding.HostIp -notin @('127.0.0.1', '::1')) {
          throw "Binding Docker fora de loopback em $name."
        }
      }
    }
  }
} catch {
  node $cli stop --workdir $PSScriptRoot --project-id 'laboratorio-marco-1a' | Out-Null
  throw
}

Write-Host 'Laboratorio iniciado em http://127.0.0.1:54321 (API).'
Write-Host 'Banco em 127.0.0.1:54322; Studio em http://127.0.0.1:54323.'
Write-Host 'Consulte o relatorio 26 para conferir o estado restaurado da baseline e da migration 1A.'
Write-Host 'Bindings conferidos; execute o ensaio independente de rede antes de considerar o isolamento comprovado.'
