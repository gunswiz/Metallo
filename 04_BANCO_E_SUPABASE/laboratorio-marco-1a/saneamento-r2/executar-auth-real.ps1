# Reexecução Auth real R2: JWT de 60s somente no laboratório, com restauração obrigatória.
param([ValidateSet('r2','1c')][string]$EvidenceRevision = 'r2')
$ErrorActionPreference = 'Stop'
$lab = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$root = (Resolve-Path (Join-Path $lab '..\..')).Path
$config = Join-Path $lab 'supabase\config.toml'
$cli = Join-Path $root 'node_modules\supabase\dist\supabase.js'
$runner = Join-Path $root '01_WEB\node_modules\vitest\vitest.mjs'
$launcher = Join-Path $lab 'iniciar-laboratorio.ps1'
$collector = Join-Path $lab 'coletor-local\controlar.mjs'
$docker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
$report = if ($EvidenceRevision -eq '1c') { Join-Path $lab 'marco-1c\auth-real.json' } else { Join-Path $PSScriptRoot 'auth-real.json' }
if (-not (Test-Path -LiteralPath $cli) -or -not (Test-Path -LiteralPath $runner)) { throw 'Dependências locais ausentes.' }
if (Test-Path -LiteralPath (Join-Path $lab 'supabase\.temp\project-ref')) { throw 'Laboratório vinculado a remoto; execução bloqueada.' }
$original = [IO.File]::ReadAllBytes($config)
$source = [Text.Encoding]::UTF8.GetString($original)
if ([regex]::Matches($source, '(?m)^jwt_expiry = 3600$').Count -ne 1) { throw 'A configuração JWT original não é 3600s; nenhuma alteração feita.' }
function Assert-AuthExpiry([int]$seconds) {
  $authEnv = (& $docker inspect --format '{{json .Config.Env}}' 'supabase_auth_laboratorio-marco-1a' | ConvertFrom-Json)
  if ($LASTEXITCODE -ne 0 -or "GOTRUE_JWT_EXP=$seconds" -notin $authEnv) { throw "Auth local não está usando JWT de $seconds segundos." }
}
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$env:DO_NOT_TRACK = '1'
$env:METALLO_TEST_1B_AUTH = '1'
$env:METALLO_EVIDENCE_REVISION = $EvidenceRevision
$testExit = -1
try {
  [IO.File]::WriteAllText($config, ([regex]::Replace($source, '(?m)^jwt_expiry = 3600$', 'jwt_expiry = 60')), [Text.UTF8Encoding]::new($false))
  & node $cli stop --workdir $lab --project-id laboratorio-marco-1a
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao parar apenas o laboratório local.' }
  & $launcher
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao reiniciar o laboratório com JWT de 60s.' }
  Assert-AuthExpiry 60
  Push-Location (Join-Path $root '01_WEB')
  try {
    & node $runner run 10_TESTES/colaborador-auth-real.integration.tsx --reporter=json --outputFile=$report
    $testExit = $LASTEXITCODE
  } finally { Pop-Location }
} finally {
  [IO.File]::WriteAllBytes($config, $original)
  & node $cli stop --workdir $lab --project-id laboratorio-marco-1a
  if ($LASTEXITCODE -ne 0) { throw 'Configuração restaurada, mas falhou a parada local antes de reiniciar.' }
  & node $collector stop
  if ($LASTEXITCODE -ne 0) { throw 'Configuração restaurada, mas falhou a parada do coletor antes de reiniciar.' }
  & $launcher
  if ($LASTEXITCODE -ne 0) { throw 'Configuração restaurada, mas falhou o reinício local.' }
  Assert-AuthExpiry 3600
  if ([Convert]::ToHexString([IO.File]::ReadAllBytes($config)) -ne [Convert]::ToHexString($original)) { throw 'Configuração original não restaurada byte a byte.' }
}
if ($testExit -ne 0) { throw "Integração Auth real falhou (exit $testExit). Consulte o JSON da revisão $EvidenceRevision." }
Write-Host "Auth real $EvidenceRevision concluído; JWT local de 3600s restaurado e laboratório reiniciado."
