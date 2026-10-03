# Reproduz o historico do projeto de teste somente no container PostgreSQL local.
# Os nove SQLs EPI locais preenchem a lacuna de criacao de objetos no historico remoto.
param([switch]$ResumeAfterFirst, [ValidatePattern('^(postgres|metallo_replay_[a-z0-9_]+)$')][string]$Database = 'postgres')
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$remoteDir = Join-Path $PSScriptRoot 'historico-remoto'
$localDir = Join-Path $root '04_BANCO_E_SUPABASE\supabase\migrations'
$container = 'supabase_db_laboratorio-marco-1a'
$docker = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $docker) { $docker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe' }
if (-not (Test-Path -LiteralPath $docker)) { throw 'Docker local ausente.' }

$endpoint = & $docker context inspect --format '{{.Endpoints.docker.Host}}'
if ($LASTEXITCODE -ne 0 -or $endpoint -notlike 'npipe:////./pipe/*') {
  throw 'Contexto Docker nao e o Docker Desktop local do Windows.'
}
& $docker inspect $container --format '{{.State.Running}}' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL do laboratorio nao esta ativo.' }

$remote = @(Get-ChildItem -LiteralPath $remoteDir -Filter '*.sql' -File | Sort-Object Name)
if ($remote.Count -ne 33) { throw "Historico remoto incompleto: $($remote.Count)/33 arquivos." }
$pre = @($remote | Where-Object { $_.Name -lt '20260902' })
$post = @($remote | Where-Object { $_.Name -gt '20260902' })
$epiNames = @(
  '20260902231312_epi_management.sql',
  '20260903001647_epi_profession_kits.sql',
  '20260903050000_epi_grouped_deliveries.sql',
  '20260903061000_epi_requests.sql',
  '20260903070000_epi_employee_item_sets.sql',
  '20260903133000_epi_stock_variants.sql',
  '20260903140500_close_epi_requests_on_delivery.sql',
  '20260903154000_epi_request_variants.sql',
  '20260903184203_aso_and_rental_return.sql'
)
$epi = @($epiNames | ForEach-Object { Get-Item -LiteralPath (Join-Path $localDir $_) })
$files = @($pre) + @($epi) + @($post)
if ($files.Count -ne 42) { throw 'Sequencia da baseline incompleta.' }

$publicTableCount = [int](& $docker exec $container psql -U postgres -d $Database -Atc "select count(*) from pg_tables where schemaname='public'")
$expectedCount = if ($ResumeAfterFirst) { 5 } else { 0 }
if ($publicTableCount -ne $expectedCount) {
  throw "Estado local inesperado: $publicTableCount tabelas public; esperado $expectedCount."
}
if ($ResumeAfterFirst) { $files = @($files | Select-Object -Skip 1) }

foreach ($file in $files) {
  $target = "/tmp/metallo-$($file.Name)"
  $source = $file.FullName
  if ($file.Name -eq '20260903001647_epi_profession_kits.sql') {
    # O seed deste SQL exige created_by=auth.uid() antes de existir usuario Auth.
    # Catalogo e policies sao aplicados; dados de exemplo serao criados nos testes sinteticos.
    $sql = Get-Content -LiteralPath $source -Raw
    $marker = [regex]::Match($sql, '(?im)^insert into public\.epi_professions\b')
    if (-not $marker.Success) { throw 'Marcador do seed EPI nao encontrado.' }
    $source = Join-Path $env:TEMP 'metallo-epi-profession-kits-schema-only.sql'
    [System.IO.File]::WriteAllText($source, $sql.Substring(0, $marker.Index), [System.Text.UTF8Encoding]::new($false))
  }
  & $docker cp $source "${container}:$target" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Falha ao copiar $($file.Name) para o laboratorio." }
  & $docker exec $container psql -X -U postgres -d $Database -v ON_ERROR_STOP=1 -1 -q -f $target | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar $($file.Name) no laboratorio." }
  Write-Host "Aplicada: $($file.Name)"
}

& (Join-Path $PSScriptRoot 'ajustar-catalogo-local.ps1') -Database $Database
Write-Host 'Baseline local aplicada; comparar com o catalogo remoto antes da migration 1A.'
