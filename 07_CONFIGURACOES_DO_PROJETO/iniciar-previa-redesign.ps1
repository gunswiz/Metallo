# Interface local com dados fictícios do metallo-teste. Não publica nem migra banco.
param([ValidateSet('gestao', 'colaborador')][string]$Area = 'gestao')
$ErrorActionPreference = 'Stop'
$previewRoot = Split-Path -Parent $PSScriptRoot
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://cvimwiqokkujfhwynhmt.supabase.co'
# Mesma chave PUBLICÁVEL do workflow teste-online.yml; não é uma credencial administrativa.
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH'
$env:NEXT_PUBLIC_METALLO_TESTE_PREVIEW = '1'
$env:METALLO_LOCAL_PREVIEW = '0'
$env:METALLO_COLABORADOR_PREVIEW = '0'
$env:METALLO_COLABORADOR_VISUAL_PREVIEW = '0'
$env:METALLO_4C_TELEMETRY = '0'
$env:METALLO_GESTAO_VISUAL_PREVIEW = if ($Area -eq 'gestao') { '1' } else { '0' }
$env:METALLO_COLABORADOR_TESTE_ONLINE = if ($Area -eq 'colaborador') { '1' } else { '0' }
$env:METALLO_COLABORADOR_TESTE_KEY = $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
$previewPort = if ($Area -eq 'gestao') { 3102 } else { 3101 }
$previewRoute = if ($Area -eq 'gestao') { '/login' } else { '/colaborador/login' }
Write-Host "Prévia local: http://127.0.0.1:$previewPort$previewRoute"
Set-Location -LiteralPath (Join-Path $previewRoot '01_WEB')
& node 'node_modules/next/dist/bin/next' dev --hostname 127.0.0.1 --port $previewPort
exit $LASTEXITCODE
