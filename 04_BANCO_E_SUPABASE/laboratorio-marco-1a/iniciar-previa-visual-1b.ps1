# Prévia apenas visual: não inicia Docker nem cria cliente Supabase.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$env:METALLO_LOCAL_PREVIEW = '1'
$env:METALLO_COLABORADOR_VISUAL_PREVIEW = '1'
$env:METALLO_COLABORADOR_PREVIEW = '0'
# Sobrescreve qualquer .env.local da Gestão nesta sessão, evitando chamadas ao projeto remoto.
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'visual-only'
Write-Host 'Prévia visual sem Auth: http://127.0.0.1:3101/colaborador/inicio'
Set-Location -LiteralPath $root
& pnpm --filter '@metallo/web' dev --hostname 127.0.0.1 --port 3101
