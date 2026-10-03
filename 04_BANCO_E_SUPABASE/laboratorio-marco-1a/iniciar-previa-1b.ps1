# Previa local do Colaborador. Use somente depois de iniciar-laboratorio.ps1.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$cli = Join-Path $root 'node_modules\supabase\dist\supabase.js'
if (-not (Test-Path -LiteralPath $cli)) { throw 'CLI local ausente; restaure as dependencias do projeto.' }
$status = (& node $cli status --workdir $PSScriptRoot -o json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0 -or $status.API_URL -ne 'http://127.0.0.1:54321') {
  throw 'Inicie primeiro o laboratorio Supabase local protegido.'
}
# Prévia vigente 4C: transporte normal; não herdar flags de comparações históricas.
Remove-Item Env:METALLO_4C_ROUND -ErrorAction SilentlyContinue
Remove-Item Env:METALLO_LOAD_TEST_CORE_PORT -ErrorAction SilentlyContinue
Remove-Item Env:METALLO_4C_TELEMETRY -ErrorAction SilentlyContinue
$env:METALLO_LOCAL_PREVIEW = '1'
$env:METALLO_COLABORADOR_PREVIEW = '1'
$env:METALLO_COLABORADOR_VISUAL_PREVIEW = '0'
$env:METALLO_COLABORADOR_LAB_URL = $status.API_URL
$env:METALLO_COLABORADOR_LAB_ANON_KEY = $status.ANON_KEY
$env:NEXT_PUBLIC_SUPABASE_URL = $status.API_URL
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $status.ANON_KEY
Write-Host 'Previa Metallo Colaborador: http://127.0.0.1:3101/colaborador/login'
Write-Host 'Home apos login: http://127.0.0.1:3101/colaborador/inicio'
Set-Location -LiteralPath $root
& pnpm --filter '@metallo/web' dev --hostname 127.0.0.1 --port 3101
