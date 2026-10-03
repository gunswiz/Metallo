# Reproduz duas alteracoes observadas no catalogo remoto efetivo que nao estao
# descritas pelo historico SQL exportado. Executa somente no container local.
param([ValidatePattern('^(postgres|metallo_replay_[a-z0-9_]+)$')][string]$Database = 'postgres')
$ErrorActionPreference = 'Stop'
$container = 'supabase_db_laboratorio-marco-1a'
$docker = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $docker) { $docker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe' }
$endpoint = & $docker context inspect --format '{{.Endpoints.docker.Host}}'
if ($LASTEXITCODE -ne 0 -or $endpoint -notlike 'npipe:////./pipe/*') {
  throw 'Contexto Docker nao e o Docker Desktop local do Windows.'
}

$catalogPath = Join-Path $PSScriptRoot 'catalogo-remoto-funcoes.json'
$catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
$function = @($catalog.functions | Where-Object { $_.schema_name -eq 'public' -and $_.name -eq 'set_epi_employee_items' })
if ($function.Count -ne 1) { throw 'Definicao remota da funcao EPI ausente ou ambigua.' }
$sql = "alter table public.epi_professions alter column uniform_color set default 'gray';`n$($function[0].definition);`n"
$source = Join-Path $env:TEMP 'metallo-ajustes-catalogo-pre1a.sql'
[System.IO.File]::WriteAllText($source, $sql, [System.Text.UTF8Encoding]::new($false))
& $docker cp $source "${container}:/tmp/metallo-ajustes-catalogo-pre1a.sql" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ao copiar ajustes ao laboratorio.' }
& $docker exec $container psql -X -U postgres -d $Database -v ON_ERROR_STOP=1 -1 -q -f /tmp/metallo-ajustes-catalogo-pre1a.sql | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ao aplicar ajustes no laboratorio.' }
Write-Host 'Dois ajustes do catalogo efetivo aplicados apenas no laboratorio.'
